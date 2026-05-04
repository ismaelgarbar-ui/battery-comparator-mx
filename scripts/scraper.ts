import { config } from "dotenv";
config({ path: ".env.local" });

import { chromium } from "playwright";
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
  // "$3,649.00" → 3649  |  "3649" → 3649
  const clean = raw.replace(/[$,\s]/g, "").replace(/\.00$/, "");
  const val = parseFloat(clean);
  return isNaN(val) || val < 50 ? null : val;
}

function inferGama(nombre: string): string {
  const n = nombre.toLowerCase();
  if (n.includes("agm") || n.includes("platinum") || n.includes("platino") || n.includes("gel") || n.includes("optima")) return "agm";
  if (n.includes("gold") || n.includes("premium") || n.includes("ultra") || n.includes("pro")) return "premium";
  if (n.includes("valucraft") || n.includes("basica") || n.includes("economica") || n.includes("inicio")) return "basica";
  if (n.includes("duralast") || n.includes("estandar") || n.includes("standard") || n.includes("plus")) return "estandar";
  return "estandar";
}

function inferAmperaje(texto: string): number | null {
  const cca = texto.match(/(\d{3,4})\s*(?:CCA|cca)\b/i);
  if (cca) return parseInt(cca[1]);
  const ah = texto.match(/(\d{2,3})\s*(?:Ah|AH)\b/i);
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
  const match = texto.match(/\b(24F?|35|51R?|65|75|86|96R|48|47|34|78|31|22F|26|T4|T5|T6|34-78)\b/);
  return match ? match[1] : null;
}

// ─── AutoZone MX — scrape DOM completo paginado ────────────────────────────
// Cada card tiene nombre + precio juntos → no hay error de mapeo
async function scrapeAutoZone(): Promise<BatteryProduct[]> {
  const products: BatteryProduct[] = [];

  const browser = await chromium.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled", "--window-size=1366,768"],
  });
  const context = await browser.newContext({
    locale: "es-MX",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1366, height: 768 },
    extraHTTPHeaders: { "Accept-Language": "es-MX,es;q=0.9" },
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    (window as any).chrome = { runtime: {} };
  });

  const page = await context.newPage();

  try {
    // Navegar desde el home como humano para pasar DataDome
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

    const BASE_URL = "https://www.autozone.com.mx/baterias-arranque-y-carga/bateria";
    const MAX_PAGES = 8;

    const extractCards = async () =>
      page.$$eval(
        "[class*='product-price-wrapper']",
        (wrappers) => wrappers.map((wrapper) => {
          const priceEl = wrapper.querySelector("[data-testid='product-price-container']");
          const strikeEl = wrapper.querySelector("[data-testid='strike-through-price'], [class*='strikethrough'], [class*='strike']");
          const price = priceEl?.textContent?.trim() ?? "";
          const origPrice = strikeEl?.textContent?.trim() ?? "";
          const card = wrapper.closest("li, article, [class*='ProductCard'], [class*='product-card']") ??
            wrapper.parentElement?.parentElement;
          const name = card?.querySelector(
            "[class*='product-name'], [class*='productName'], [class*='description'], h2, h3, [data-testid*='name']"
          )?.textContent?.trim() ?? "";
          const link = (card?.querySelector("a[href]") as HTMLAnchorElement)?.href ?? "";
          const img = (card?.querySelector("img[src]") as HTMLImageElement)?.src ?? "";
          return { name, price, origPrice, link, img };
        })
      );

    // Página 1 ya está cargada tras navegar desde home
    for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
      console.log(`  AutoZone página ${pageNum}...`);

      if (pageNum > 1) {
        await page.goto(`${BASE_URL}?pageNumber=${pageNum}`, {
          waitUntil: "networkidle", timeout: 30000,
        });
      }

      await page.waitForTimeout(2000);
      await page.waitForSelector("[data-testid='product-price-container']", { timeout: 15000 }).catch(() => {});

      const cards = await extractCards();
      console.log(`    Cards extraídas: ${cards.length}`);

      if (cards.length === 0) {
        console.log("    Sin cards — fin de páginas.");
        break;
      }

      for (const card of cards) {
        if (!card.name || card.name.length < 5) continue;
        const precio = parsePrice(card.price);
        if (!precio || precio < 100) continue;
        const precio_original = card.origPrice ? parsePrice(card.origPrice) : null;

        products.push({
          tienda: "autozone",
          nombre: card.name,
          gama: inferGama(card.name),
          amperaje: inferAmperaje(card.name),
          grupo: inferGrupo(card.name),
          garantia_meses: inferGarantia(card.name),
          precio,
          precio_original: precio_original && precio_original > precio ? precio_original : null,
          url: card.link || BASE_URL,
          imagen_url: card.img || null,
          disponible: true,
        });
      }

      // Si cargaron menos de 20 cards, es la última página
      if (cards.length < 20) {
        console.log("    Página incompleta — fin de paginación.");
        break;
      }
    }
  } catch (err) {
    console.error("AutoZone error:", err instanceof Error ? err.message : err);
  } finally {
    await browser.close();
  }

  // Deduplicar por nombre
  const seen = new Set<string>();
  const unique = products.filter((p) => {
    const key = p.nombre.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`AutoZone: ${unique.length} productos únicos (de ${products.length} totales)`);
  return unique;
}

// ─── Guardar en Supabase ─────────────────────────────────────────────────────
async function saveProducts(products: BatteryProduct[], tienda: string) {
  const db = getSupabase();
  if (products.length === 0) {
    await db.from("scraping_logs").insert({
      tienda, status: "empty", productos: 0, ejecutado_at: new Date().toISOString(),
    });
    return { count: 0 };
  }
  const rows = products.map((p) => ({ ...p, scraped_at: new Date().toISOString() }));
  const { error } = await db.from("baterias").insert(rows);
  const status = error ? "error" : "success";
  await db.from("scraping_logs").insert({
    tienda, status, productos: error ? 0 : rows.length,
    mensaje: error?.message ?? null, ejecutado_at: new Date().toISOString(),
  });
  if (error) console.error(`Save error (${tienda}):`, error.message);
  return { count: error ? 0 : rows.length };
}

async function main() {
  console.log("Iniciando scraper AutoZone MX...");
  const autozone = await scrapeAutoZone();

  if (autozone.length > 0) {
    console.log("\nMuestra de precios:");
    autozone.slice(0, 5).forEach((p) => console.log(`  $${p.precio} — ${p.nombre.slice(0, 60)}`));
  }

  const r = await saveProducts(autozone, "autozone");
  console.log(`\n✓ Guardados en Supabase: ${r.count} productos`);
}

main().catch(console.error);
