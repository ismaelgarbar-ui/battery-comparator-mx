import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

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

// ─── Headers para simular navegador ───────────────────────────────────────────
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
  "Upgrade-Insecure-Requests": "1",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parsePrice(raw: string): number | null {
  const clean = raw.replace(/[^\d.]/g, "");
  const val = parseFloat(clean);
  return isNaN(val) ? null : val;
}

function inferGama(nombre: string): string {
  const n = nombre.toLowerCase();
  if (n.includes("agm") || n.includes("gel")) return "agm";
  if (
    n.includes("premium") ||
    n.includes("ultra") ||
    n.includes("máxima") ||
    n.includes("maxima") ||
    n.includes("platino")
  )
    return "premium";
  if (
    n.includes("estándar") ||
    n.includes("estandar") ||
    n.includes("standard") ||
    n.includes("plus")
  )
    return "estandar";
  if (
    n.includes("básica") ||
    n.includes("basica") ||
    n.includes("económica") ||
    n.includes("economica") ||
    n.includes("inicio")
  )
    return "basica";
  return "otro";
}

function inferAmperaje(nombre: string): number | null {
  // Busca patrones como "550CCA", "700 CCA", "45Ah", "60 Ah"
  const ccaMatch = nombre.match(/(\d{3,4})\s*(?:CCA|cca)/i);
  if (ccaMatch) return parseInt(ccaMatch[1]);
  const ahMatch = nombre.match(/(\d{2,3})\s*(?:Ah|AH|ah)/i);
  if (ahMatch) return parseInt(ahMatch[1]);
  return null;
}

function inferGarantia(texto: string): number | null {
  const m = texto.match(/(\d+)\s*(?:meses?|months?)/i);
  if (m) return parseInt(m[1]);
  const y = texto.match(/(\d+)\s*(?:años?|years?)/i);
  if (y) return parseInt(y[1]) * 12;
  return null;
}

function inferGrupo(nombre: string): string | null {
  // Grupos BCI comunes: 24, 24F, 35, 51, 65, 75, 86, 96R, etc.
  const match = nombre.match(/\b(24F?|35|51R?|65|75|86|96R|48|47|34|31)\b/);
  return match ? match[1] : null;
}

// ─── SCRAPER: O'Reilly México ─────────────────────────────────────────────────
async function scrapeOReilly(): Promise<BatteryProduct[]> {
  const products: BatteryProduct[] = [];
  const urls = [
    "https://www.oreillyauto.com.mx/baterias",
    "https://www.oreillyauto.com.mx/baterias?page=2",
    "https://www.oreillyauto.com.mx/baterias?page=3",
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: BROWSER_HEADERS });
      if (!res.ok) continue;
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      if (!doc) continue;

      // Selectores para O'Reilly MX (ajustar si cambia el HTML)
      const items = doc.querySelectorAll(
        ".product-item, .product-card, [class*='product']"
      );

      items.forEach((item) => {
        try {
          const nombre =
            item.querySelector(
              ".product-name, .product-title, h2, h3, [class*='name']"
            )?.textContent?.trim() ?? "";
          if (!nombre || nombre.length < 3) return;

          const precioRaw =
            item
              .querySelector(
                ".price, .product-price, [class*='price']:not([class*='old'])"
              )
              ?.textContent?.trim() ?? "";
          const precio = parsePrice(precioRaw);
          if (!precio || precio < 100) return;

          const precioOriginalRaw =
            item
              .querySelector(".old-price, .price-before, [class*='original']")
              ?.textContent?.trim() ?? "";
          const precio_original = precioOriginalRaw
            ? parsePrice(precioOriginalRaw)
            : null;

          const linkEl = item.querySelector("a[href]");
          const href = linkEl?.getAttribute("href") ?? "";
          const fullUrl = href.startsWith("http")
            ? href
            : `https://www.oreillyauto.com.mx${href}`;

          const imagen_url =
            item.querySelector("img")?.getAttribute("src") ?? null;

          products.push({
            tienda: "oreilly",
            nombre,
            gama: inferGama(nombre),
            amperaje: inferAmperaje(nombre),
            grupo: inferGrupo(nombre),
            garantia_meses: inferGarantia(nombre),
            precio,
            precio_original,
            url: fullUrl || url,
            imagen_url,
            disponible: true,
          });
        } catch {
          // producto individual falla, continúa con el siguiente
        }
      });

      // Pausa entre páginas para no saturar
      await new Promise((r) => setTimeout(r, 1500));
    } catch (err) {
      console.error("OReilly fetch error:", err);
    }
  }

  return products;
}

// ─── SCRAPER: AutoZone México ─────────────────────────────────────────────────
async function scrapeAutoZone(): Promise<BatteryProduct[]> {
  const products: BatteryProduct[] = [];

  // AutoZone MX usa búsqueda por categoría
  const urls = [
    "https://www.autozone.com.mx/baterias/baterias-de-carro",
    "https://www.autozone.com.mx/baterias/baterias-de-carro?currentPage=2",
    "https://www.autozone.com.mx/baterias/baterias-de-carro?currentPage=3",
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: BROWSER_HEADERS });
      if (!res.ok) continue;
      const html = await res.text();

      // AutoZone a veces inyecta datos en JSON dentro de la página
      const jsonMatch = html.match(
        /__NEXT_DATA__\s*=\s*({.+?})\s*<\/script>/s
      );
      if (jsonMatch) {
        try {
          const data = JSON.parse(jsonMatch[1]);
          // Navegar por la estructura de Next.js data
          const pageProps =
            data?.props?.pageProps?.searchResults?.products ||
            data?.props?.pageProps?.products ||
            [];

          for (const p of pageProps) {
            const nombre = p.name || p.title || "";
            if (!nombre) continue;
            const precio =
              parseFloat(p.price?.value || p.price || p.salePrice || "0") || 0;
            if (precio < 100) continue;

            products.push({
              tienda: "autozone",
              nombre,
              gama: inferGama(nombre),
              amperaje: inferAmperaje(nombre),
              grupo: inferGrupo(nombre),
              garantia_meses: inferGarantia(nombre),
              precio,
              precio_original:
                parseFloat(p.originalPrice?.value || p.listPrice || "0") ||
                null,
              url: p.url
                ? `https://www.autozone.com.mx${p.url}`
                : url,
              imagen_url: p.image?.url || p.thumbnail || null,
              disponible: p.inStock !== false,
            });
          }
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        } catch {
          // Si falla el parse JSON, caemos al HTML scraping
        }
      }

      // Fallback: parse HTML directo
      const doc = new DOMParser().parseFromString(html, "text/html");
      if (!doc) continue;

      const items = doc.querySelectorAll(
        "[class*='ProductCard'], [class*='product-card'], [class*='productCard']"
      );

      items.forEach((item) => {
        try {
          const nombre =
            item
              .querySelector("[class*='name'], [class*='title'], h2, h3")
              ?.textContent?.trim() ?? "";
          if (!nombre || nombre.length < 3) return;

          const precioRaw =
            item
              .querySelector("[class*='price']:not([class*='old']):not([class*='before'])")
              ?.textContent?.trim() ?? "";
          const precio = parsePrice(precioRaw);
          if (!precio || precio < 100) return;

          const linkEl = item.querySelector("a[href]");
          const href = linkEl?.getAttribute("href") ?? "";
          const fullUrl = href.startsWith("http")
            ? href
            : `https://www.autozone.com.mx${href}`;

          products.push({
            tienda: "autozone",
            nombre,
            gama: inferGama(nombre),
            amperaje: inferAmperaje(nombre),
            grupo: inferGrupo(nombre),
            garantia_meses: inferGarantia(nombre),
            precio,
            precio_original: null,
            url: fullUrl || url,
            imagen_url:
              item.querySelector("img")?.getAttribute("src") ?? null,
            disponible: true,
          });
        } catch {
          // continúa
        }
      });

      await new Promise((r) => setTimeout(r, 1500));
    } catch (err) {
      console.error("AutoZone fetch error:", err);
    }
  }

  return products;
}

// ─── SCRAPER: LTH (lthbaterias.com) ──────────────────────────────────────────
async function scrapeLTH(): Promise<BatteryProduct[]> {
  const products: BatteryProduct[] = [];
  const urls = [
    "https://www.lthbaterias.com/baterias-para-auto",
    "https://www.lthbaterias.com/baterias-para-auto?page=2",
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: BROWSER_HEADERS });
      if (!res.ok) continue;
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      if (!doc) continue;

      const items = doc.querySelectorAll(
        ".product-item, .product, [class*='product'], .item"
      );

      items.forEach((item) => {
        try {
          const nombre =
            item
              .querySelector(
                ".product-name, .product-title, h2, h3, h4, [class*='name'], [class*='title']"
              )
              ?.textContent?.trim() ?? "";
          if (!nombre || nombre.length < 3) return;

          const precioRaw =
            item
              .querySelector(
                ".price, [class*='price']:not([class*='old']):not([class*='before'])"
              )
              ?.textContent?.trim() ?? "";
          const precio = parsePrice(precioRaw);
          if (!precio || precio < 100) return;

          const linkEl = item.querySelector("a[href]");
          const href = linkEl?.getAttribute("href") ?? "";
          const fullUrl = href.startsWith("http")
            ? href
            : `https://www.lthbaterias.com${href}`;

          const garantiaEl = item.querySelector(
            "[class*='garantia'], [class*='warranty']"
          );
          const garantia_meses = garantiaEl
            ? inferGarantia(garantiaEl.textContent ?? "")
            : inferGarantia(nombre);

          products.push({
            tienda: "lth",
            nombre,
            gama: inferGama(nombre),
            amperaje: inferAmperaje(nombre),
            grupo: inferGrupo(nombre),
            garantia_meses,
            precio,
            precio_original: null,
            url: fullUrl || url,
            imagen_url:
              item.querySelector("img")?.getAttribute("src") ?? null,
            disponible: true,
          });
        } catch {
          // continúa
        }
      });

      await new Promise((r) => setTimeout(r, 1500));
    } catch (err) {
      console.error("LTH fetch error:", err);
    }
  }

  return products;
}

// ─── Guardar en Supabase ───────────────────────────────────────────────────────
async function saveProducts(
  products: BatteryProduct[],
  tienda: string
): Promise<{ count: number; error: string | null }> {
  if (products.length === 0) {
    return { count: 0, error: null };
  }

  const rows = products.map((p) => ({
    ...p,
    scraped_at: new Date().toISOString(),
  }));

  // Insertamos todos — mantenemos historial completo
  const { error } = await supabase.from("baterias").insert(rows);

  if (error) {
    return { count: 0, error: error.message };
  }

  return { count: rows.length, error: null };
}

async function logScraping(
  tienda: string,
  status: string,
  productos: number,
  mensaje?: string
) {
  await supabase.from("scraping_logs").insert({
    tienda,
    status,
    productos,
    mensaje: mensaje ?? null,
    ejecutado_at: new Date().toISOString(),
  });
}

// ─── Handler principal ────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      },
    });
  }

  const results: Record<string, { count: number; error: string | null }> = {};

  // Ejecutar scrapers en paralelo
  const [oreillyProducts, autozoneProducts, lthProducts] = await Promise.all([
    scrapeOReilly(),
    scrapeAutoZone(),
    scrapeLTH(),
  ]);

  // Guardar cada tienda
  results.oreilly = await saveProducts(oreillyProducts, "oreilly");
  results.autozone = await saveProducts(autozoneProducts, "autozone");
  results.lth = await saveProducts(lthProducts, "lth");

  // Logs
  await Promise.all([
    logScraping(
      "oreilly",
      results.oreilly.error ? "error" : "success",
      results.oreilly.count,
      results.oreilly.error ?? undefined
    ),
    logScraping(
      "autozone",
      results.autozone.error ? "error" : "success",
      results.autozone.count,
      results.autozone.error ?? undefined
    ),
    logScraping(
      "lth",
      results.lth.error ? "error" : "success",
      results.lth.count,
      results.lth.error ?? undefined
    ),
  ]);

  return new Response(JSON.stringify({ success: true, results }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
