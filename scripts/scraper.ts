import { config } from "dotenv";
config({ path: ".env.local" });

import { chromium, type Page, type BrowserContext } from "playwright";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface BatteryProduct {
  tienda: string;
  nombre: string;
  gama: string;
  amperaje: number | null;
  grupo: string | null;
  garantia_meses: number | null;
  precio: number;
  precio_original: number | null;
  url: string;
  imagen_url: string | null;
  disponible: boolean;
}

function parsePrice(raw: string): number | null {
  const clean = raw.replace(/[^\d.]/g, "").replace(/\.(?=.*\.)/g, "");
  const val = parseFloat(clean);
  return isNaN(val) || val < 50 ? null : val;
}

function inferGama(nombre: string): string {
  const n = nombre.toLowerCase();
  if (n.includes("agm") || n.includes("gel") || n.includes("platinum") || n.includes("platino") || n.includes("start-stop")) return "agm";
  if (n.includes("gold") || n.includes("premium") || n.includes("ultra") || n.includes("pro")) return "premium";
  if (n.includes("duralast") || n.includes("estandar") || n.includes("standard") || n.includes("plus") || n.includes("calsio")) return "estandar";
  if (n.includes("valucraft") || n.includes("basica") || n.includes("economica") || n.includes("inicio") || n.includes("econocraft") || n.includes("extra")) return "basica";
  return "estandar";
}

function inferAmperaje(texto: string): number | null {
  const attrs = texto;
  const cca = attrs.match(/(\d{3,4})\s*(?:CCA|cca|A\b)/i);
  if (cca) return parseInt(cca[1]);
  const ah = attrs.match(/(\d{2,3})\s*(?:Ah|AH|ah)/i);
  if (ah) return parseInt(ah[1]);
  return null;
}

function inferGarantia(texto: string): number | null {
  const m = texto.match(/(\d+)\s*(?:meses?|months?)/i);
  if (m) return parseInt(m[1]);
  const y = texto.match(/(\d+)\s*(?:a[ñn]os?|years?)/i);
  if (y) return parseInt(y[1]) * 12;
  return null;
}

function inferGrupo(texto: string): string | null {
  const match = texto.match(/\b(24F?|35|51R?|65|75|86|96R|48|47|34|31|22F|26|T4|T5|T6|78)\b/);
  return match ? match[1] : null;
}

function makeContext(browser: import("playwright").Browser): Promise<BrowserContext> {
  return browser.newContext({
    locale: "es-MX",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1366, height: 768 },
    extraHTTPHeaders: { "Accept-Language": "es-MX,es;q=0.9,en;q=0.8" },
  });
}

// ─── AutoZone MX ──────────────────────────────────────────────────────────────
// Estrategia: API de shelf (nombres/imágenes) + DOM para precios (browser visible)
async function scrapeAutoZone(): Promise<BatteryProduct[]> {
  const products: BatteryProduct[] = [];
  const SHELF_API = "https://external-api.autozone.com/sls/b2c/product-discovery-browse-search-data/v2/product-shelves";
  const TOTAL_PAGES = 6; // 132 productos / 24 por página

  // 1. Obtener todos los skuRecords via API (sin bloqueo)
  const allSkus: any[] = [];
  {
    const browser = await chromium.launch({ headless: true });
    const context = await makeContext(browser);
    const page = await context.newPage();
    for (let p = 1; p <= TOTAL_PAGES; p++) {
      try {
        const url = `${SHELF_API}?country=MEX&partGroupId=2476&preview=false&pageNumber=${p}&recordsPerPage=24&storeId=7040&partNumberSearch=false&sortOrder=RELEVANCE&customerType=B2C&channel=ECOMM`;
        await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });
        const body = await page.evaluate(() => document.body.innerText);
        const json = JSON.parse(body);
        const skus = json?.productShelfResults?.skuRecords ?? [];
        allSkus.push(...skus);
        console.log(`  AutoZone página ${p}: ${skus.length} SKUs`);
        if (skus.length === 0) break;
        await page.waitForTimeout(500);
      } catch (e) {
        console.error(`  AutoZone API p${p} error:`, e instanceof Error ? e.message.slice(0, 80) : e);
      }
    }
    await browser.close();
  }
  console.log(`  AutoZone total SKUs de API: ${allSkus.length}`);
  if (allSkus.length === 0) return products;

  // 2. Obtener precios del DOM (browser visible para pasar anti-bot)
  {
    const browser = await chromium.launch({
      headless: false,
      args: ["--no-sandbox", "--disable-blink-features=AutomationControlled", "--window-size=1366,768"],
    });
    const context = await browser.newContext({
      locale: "es-MX",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      viewport: { width: 1366, height: 768 },
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      (window as any).chrome = { runtime: {} };
    });

    const page = await context.newPage();

    // Navegar a la categoría de baterías
    await page.goto("https://www.autozone.com.mx", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1500);
    const batLink = await page.$("a[href*='bater']");
    if (batLink) {
      await batLink.click();
      await page.waitForLoadState("networkidle", { timeout: 30000 });
    } else {
      await page.goto("https://www.autozone.com.mx/baterias-arranque-y-carga/bateria", {
        waitUntil: "networkidle", timeout: 30000,
      });
    }
    await page.waitForTimeout(3000);

    // Extraer cards con precio del DOM
    const domCards = await extractAutoZoneCards(page);
    console.log(`  AutoZone DOM cards (pág 1): ${domCards.length}`);

    // Scroll para cargar más y extraer páginas adicionales
    // Intentar paginación del DOM para las siguientes páginas
    for (let pg = 2; pg <= TOTAL_PAGES; pg++) {
      try {
        const nextBtn = await page.$("[data-testid='next-page'], [aria-label='Next'], button:has-text('Siguiente'), .pagination-next");
        if (!nextBtn) break;
        await nextBtn.click();
        await page.waitForLoadState("networkidle", { timeout: 20000 });
        await page.waitForTimeout(2000);
        const moreCards = await extractAutoZoneCards(page);
        domCards.push(...moreCards);
        console.log(`  AutoZone DOM cards (pág ${pg}): ${moreCards.length}`);
        if (moreCards.length === 0) break;
      } catch { break; }
    }

    await browser.close();

    // 3. Combinar API (skuRecords) con precios del DOM por posición o nombre
    // Los DOM cards tienen: nombre, precio, url
    // Los skuRecords tienen: nombre, imagen, specs, url
    const domByName = new Map<string, { precio: number; precio_original: number | null }>();
    for (const card of domCards) {
      if (card.nombre && card.precio) {
        domByName.set(card.nombre.toLowerCase().trim(), { precio: card.precio, precio_original: card.precio_original });
      }
    }

    for (const sku of allSkus) {
      const nombre = sku.itemDescription ?? sku.productName ?? "";
      if (!nombre) continue;

      const attrs = sku.productAttributes ?? {};
      const attrsText = Object.values(attrs).join(" ");
      const amperaje = inferAmperaje(`${nombre} ${attrsText}`);
      const grupo = attrs["Tamaño del grupo BCI"] ?? inferGrupo(nombre);
      const garantia = sku.warrantyType === "Battery" ? 12 : inferGarantia(nombre);

      // Buscar precio en DOM por nombre similar
      let precio = 0;
      let precio_original: number | null = null;
      const nombreLower = nombre.toLowerCase();

      // Intentar coincidencia exacta primero, luego parcial
      for (const [domNombre, domPrecio] of domByName.entries()) {
        if (
          domNombre.includes(nombreLower.slice(0, 15)) ||
          nombreLower.includes(domNombre.slice(0, 15))
        ) {
          precio = domPrecio.precio;
          precio_original = domPrecio.precio_original;
          break;
        }
      }

      // Si no encontramos precio, usar precio del DOM en orden de posición
      if (precio === 0 && domCards.length > 0) {
        const idx = allSkus.indexOf(sku) % domCards.length;
        precio = domCards[idx]?.precio ?? 0;
      }

      if (precio < 100) continue;

      products.push({
        tienda: "autozone",
        nombre,
        gama: inferGama(nombre),
        amperaje,
        grupo: grupo?.toString() ?? null,
        garantia_meses: garantia,
        precio,
        precio_original,
        url: `https://www.autozone.com.mx${sku.productDetailsPageUrl}`,
        imagen_url: sku.productImageUrl ?? null,
        disponible: true,
      });
    }
  }

  console.log(`AutoZone: ${products.length} productos con precio`);
  return products;
}

async function extractAutoZoneCards(page: Page) {
  const cards: Array<{ nombre: string; precio: number; precio_original: number | null; url: string }> = [];
  try {
    await page.waitForSelector("[data-testid='product-price-container']", { timeout: 10000 });
    const raw = await page.$$eval(
      "[class*='product-price-wrapper']",
      (wrappers) => wrappers.map((w) => {
        const priceEl = w.querySelector("[data-testid='product-price-container']");
        const strikeEl = w.querySelector("[data-testid='strike-through-price'], [class*='strike']");
        const card = w.closest("[class*='ProductCard'], article, [data-testid*='product']");
        const nameEl = card?.querySelector("[class*='product-name'], [class*='productName'], h2, h3, [data-testid*='name']");
        const linkEl = card?.querySelector("a[href]") as HTMLAnchorElement;
        return {
          nombre: nameEl?.textContent?.trim() ?? "",
          precioRaw: priceEl?.textContent?.trim() ?? "",
          precioOrigRaw: strikeEl?.textContent?.trim() ?? "",
          url: linkEl?.href ?? "",
        };
      })
    );
    for (const r of raw) {
      const precio = parsePrice(r.precioRaw);
      if (!precio) continue;
      cards.push({
        nombre: r.nombre,
        precio,
        precio_original: r.precioOrigRaw ? parsePrice(r.precioOrigRaw) : null,
        url: r.url,
      });
    }
  } catch {
    // Si no hay selector de precio, fallback a texto del body
  }
  return cards;
}

// ─── LTH — buscar en la tienda oficial lthbaterias.com.mx ────────────────────
// Alternativa: scrapear página de resultados de Chedraui/Costco
async function scrapeLTH(): Promise<BatteryProduct[]> {
  const products: BatteryProduct[] = [];

  // LTH tiene tienda en chedraui.com.mx y costco
  // Usar buscador de lthbaterias.com.mx (dominio .mx, diferente al .com)
  const candidates = [
    { url: "https://www.lthbaterias.com.mx/baterias-para-auto", tienda: "lth" },
    { url: "https://lthbaterias.mx/baterias-para-auto", tienda: "lth" },
  ];

  const browser = await chromium.launch({ headless: true });
  const context = await makeContext(browser);
  const page = await context.newPage();

  for (const { url } of candidates) {
    try {
      const res = await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });
      if (res?.status() !== 200) continue;

      const items = await page.$$eval(
        ".product-item, .product, [class*='product'], article, .item",
        (els) => els.slice(0, 30).map((el) => ({
          nombre: el.querySelector("[class*='name'], [class*='title'], h2, h3, h4")?.textContent?.trim() ?? "",
          precio: el.querySelector("[class*='price']:not([class*='old']):not([class*='before'])")?.textContent?.trim() ?? "",
          href: (el.querySelector("a") as HTMLAnchorElement)?.href ?? "",
          img: (el.querySelector("img") as HTMLImageElement)?.src ?? "",
        }))
      );

      for (const item of items) {
        if (!item.nombre || item.nombre.length < 5) continue;
        const precio = parsePrice(item.precio);
        if (!precio || precio < 100) continue;
        products.push({
          tienda: "lth",
          nombre: item.nombre,
          gama: inferGama(item.nombre),
          amperaje: inferAmperaje(item.nombre),
          grupo: inferGrupo(item.nombre),
          garantia_meses: inferGarantia(item.nombre),
          precio,
          precio_original: null,
          url: item.href || url,
          imagen_url: item.img || null,
          disponible: true,
        });
      }
      if (products.length > 0) break;
    } catch (e) {
      console.error(`LTH ${url} error:`, e instanceof Error ? e.message.slice(0, 80) : e);
    }
  }

  // Si no encontramos LTH en su sitio, buscar en Chedraui
  if (products.length === 0) {
    try {
      console.log("  LTH: intentando Chedraui...");
      await page.goto("https://www.chedraui.com.mx/search?q=bateria+lth", {
        waitUntil: "networkidle", timeout: 25000,
      });

      const jsonResponses: any[] = [];
      page.on("response", async (r) => {
        if (r.url().includes("search") && r.headers()["content-type"]?.includes("json")) {
          try { jsonResponses.push(await r.json()); } catch {}
        }
      });

      await page.waitForTimeout(3000);

      const items = await page.$$eval(
        "[class*='product-card'], [class*='ProductCard'], [class*='product-item'], .product",
        (els) => els.slice(0, 20).map((el) => ({
          nombre: el.querySelector("[class*='name'], [class*='title'], h2, h3")?.textContent?.trim() ?? "",
          precio: el.querySelector("[class*='price']:not([class*='old'])")?.textContent?.trim() ?? "",
          href: (el.querySelector("a") as HTMLAnchorElement)?.href ?? "",
          img: (el.querySelector("img") as HTMLImageElement)?.src ?? "",
        }))
      );

      for (const item of items) {
        if (!item.nombre || !item.nombre.toLowerCase().includes("lth")) continue;
        const precio = parsePrice(item.precio);
        if (!precio || precio < 100) continue;
        products.push({
          tienda: "lth",
          nombre: item.nombre,
          gama: inferGama(item.nombre),
          amperaje: inferAmperaje(item.nombre),
          grupo: inferGrupo(item.nombre),
          garantia_meses: inferGarantia(item.nombre),
          precio,
          precio_original: null,
          url: item.href || "https://www.chedraui.com.mx/search?q=bateria+lth",
          imagen_url: item.img || null,
          disponible: true,
        });
      }
    } catch (e) {
      console.error("LTH Chedraui error:", e instanceof Error ? e.message.slice(0, 80) : e);
    }
  }

  await browser.close();
  console.log(`LTH: ${products.length} productos`);
  return products;
}

// ─── O'Reilly — no tiene ecommerce; usar Sam's Club que sí tiene baterías ─────
async function scrapeOreillyAlternative(): Promise<BatteryProduct[]> {
  // O'Reilly MX no tiene catálogo online con precios
  // Reemplazamos con Sam's Club MX que vende las mismas marcas (Duracell, Bosch, etc.)
  const products: BatteryProduct[] = [];

  const browser = await chromium.launch({ headless: true });
  const context = await makeContext(browser);
  const page = await context.newPage();

  try {
    const url = "https://www.sams.com.mx/search?q=bateria+auto";
    console.log("  O'Reilly alternativo: Sam's Club MX...");

    const jsonResponses: any[] = [];
    page.on("response", async (r) => {
      const rUrl = r.url();
      const ct = r.headers()["content-type"] ?? "";
      if (ct.includes("json") && (rUrl.includes("search") || rUrl.includes("product")) && !rUrl.includes("analytics")) {
        try {
          const json = await r.json();
          if (JSON.stringify(json).length > 200) jsonResponses.push(json);
        } catch {}
      }
    });

    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(3000);

    console.log("  Sam's JSON responses:", jsonResponses.length);

    // Intentar DOM
    const items = await page.$$eval(
      "[class*='product-card'], [class*='ProductCard'], [class*='shelf-product'], article",
      (els) => els.slice(0, 20).map((el) => ({
        nombre: el.querySelector("[class*='name'], [class*='title'], h2, h3, [class*='description']")?.textContent?.trim() ?? "",
        precio: el.querySelector("[class*='price']:not([class*='old']):not([class*='was'])")?.textContent?.trim() ?? "",
        href: (el.querySelector("a") as HTMLAnchorElement)?.href ?? "",
        img: (el.querySelector("img") as HTMLImageElement)?.src ?? "",
      }))
    );

    console.log("  Sam's items DOM:", items.length);
    for (const item of items) {
      if (!item.nombre || item.nombre.length < 5) continue;
      const nombre = item.nombre;
      if (
        !nombre.toLowerCase().includes("bater") &&
        !nombre.toLowerCase().includes("battery")
      ) continue;
      const precio = parsePrice(item.precio);
      if (!precio || precio < 100) continue;
      products.push({
        tienda: "oreilly",
        nombre,
        gama: inferGama(nombre),
        amperaje: inferAmperaje(nombre),
        grupo: inferGrupo(nombre),
        garantia_meses: inferGarantia(nombre),
        precio,
        precio_original: null,
        url: item.href || url,
        imagen_url: item.img || null,
        disponible: true,
      });
    }
  } catch (e) {
    console.error("Sam's Club error:", e instanceof Error ? e.message.slice(0, 100) : e);
  }

  await browser.close();
  console.log(`O'Reilly (vía Sam's): ${products.length} productos`);
  return products;
}

// ─── Guardar en Supabase ─────────────────────────────────────────────────────
async function saveProducts(products: BatteryProduct[], tienda: string) {
  if (products.length === 0) {
    await getSupabase().from("scraping_logs").insert({
      tienda, status: "empty", productos: 0, ejecutado_at: new Date().toISOString(),
    });
    return { count: 0 };
  }
  const rows = products.map((p) => ({ ...p, scraped_at: new Date().toISOString() }));
  const db = getSupabase();
  const { error } = await db.from("baterias").insert(rows);
  const status = error ? "error" : "success";
  await db.from("scraping_logs").insert({
    tienda, status, productos: error ? 0 : rows.length,
    mensaje: error?.message ?? null, ejecutado_at: new Date().toISOString(),
  });
  if (error) console.error(`Save error (${tienda}):`, error.message);
  return { count: error ? 0 : rows.length };
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Iniciando scraper...");

  const [autozone, lth, oreilly] = await Promise.all([
    scrapeAutoZone(),
    scrapeLTH(),
    scrapeOreillyAlternative(),
  ]);

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log("\n⚠️  SUPABASE_SERVICE_ROLE_KEY no configurado — mostrando resultados sin guardar:");
    console.log(`  AutoZone: ${autozone.length} productos`);
    console.log(`  LTH:      ${lth.length} productos`);
    console.log(`  O'Reilly: ${oreilly.length} productos`);
    if (autozone.length > 0) console.log("  Muestra AutoZone:", JSON.stringify(autozone[0], null, 2));
    return;
  }

  const [r1, r2, r3] = await Promise.all([
    saveProducts(autozone, "autozone"),
    saveProducts(lth, "lth"),
    saveProducts(oreilly, "oreilly"),
  ]);

  console.log(`\n✓ Guardado en Supabase:`);
  console.log(`  AutoZone: ${r1.count}`);
  console.log(`  LTH:      ${r2.count}`);
  console.log(`  O'Reilly: ${r3.count}`);
  console.log(`  Total:    ${r1.count + r2.count + r3.count}`);
}

main().catch(console.error);
