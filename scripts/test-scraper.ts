import { config } from "dotenv";
config({ path: ".env.local" });

import { chromium } from "playwright";

async function getAutoZonePrices() {
  console.log("\n✅ AutoZone — inspeccionando productAttributes y buscando endpoint de precios...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "es-MX",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  const apiUrl = "https://external-api.autozone.com/sls/b2c/product-discovery-browse-search-data/v2/product-shelves?country=MEX&partGroupId=2476&preview=false&pageNumber=1&recordsPerPage=24&storeId=7040&partNumberSearch=false&sortOrder=RELEVANCE&customerType=B2C&channel=ECOMM";

  try {
    const res = await page.goto(apiUrl, { waitUntil: "networkidle", timeout: 20000 });
    const body = await page.evaluate(() => document.body.innerText);
    const json = JSON.parse(body);
    const skus = json.productShelfResults.skuRecords;

    console.log(`  Total skuRecords: ${skus.length}`);

    // Inspeccionar productAttributes y otros campos relevantes del primer SKU
    const first = skus[0];
    console.log("\n  productAttributes del item 0:");
    console.log("  ", JSON.stringify(first.productAttributes));
    console.log("\n  availability:", JSON.stringify(first.availability));
    console.log("  warrantyType:", first.warrantyType);
    console.log("  productSpec:", JSON.stringify(first.productSpec)?.slice(0, 400));
    console.log("  badges:", JSON.stringify(first.badges));
    console.log("  displayNotes:", JSON.stringify(first.displayNotes));

    // Extraer itemIds para el endpoint de precios
    const itemIds = skus.map((s: any) => s.itemId).join(",");
    console.log("\n  itemIds:", itemIds.slice(0, 200));

    // El endpoint de deals/precios que interceptamos antes
    const dealsUrl = `https://www.autozone.com.mx/ecomm/b2c/browse/v4/deal/details/${skus.slice(0, 5).map((s: any) => `${s.itemId}:${Math.floor(Math.random() * 9999999999)}`).join(",")}`;
    console.log("\n  Intentando endpoint de deals:", dealsUrl.slice(0, 150));

    // Mejor: buscar precio en el endpoint de pricing
    const pricingUrls = [
      `https://external-api.autozone.com/sls/b2c/product-pricing/v1/pricing?country=MEX&skuIds=${skus.slice(0, 5).map((s: any) => s.itemId).join(",")}&storeId=7040&customerType=B2C`,
      `https://www.autozone.com.mx/api/pricing?skuIds=${skus.slice(0, 3).map((s: any) => s.itemId).join(",")}&country=MEX`,
      `https://external-api.autozone.com/sls/b2c/product-pricing/v2/prices?country=MEX&itemIds=${skus.slice(0, 3).map((s: any) => s.itemId).join(",")}&storeId=7040`,
    ];

    for (const pUrl of pricingUrls) {
      const res2 = await page.goto(pUrl, { waitUntil: "networkidle", timeout: 10000 });
      const body2 = await page.evaluate(() => document.body.innerText);
      console.log(`\n  Pricing URL: ${pUrl.slice(0, 100)}`);
      console.log("  Status:", res2?.status());
      console.log("  Body:", body2.slice(0, 400));
    }

  } catch (e) {
    console.error("  Error:", e instanceof Error ? e.message.slice(0, 200) : e);
  }

  await browser.close();
}

async function getAutoZonePricesIntercepted() {
  console.log("\n✅ AutoZone — interceptar endpoint de precios desde browser real...");
  const browser = await chromium.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
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
  const priceApis: Array<{ url: string; body: string }> = [];

  page.on("response", async (response) => {
    const url = response.url();
    if (
      (url.includes("pric") || url.includes("deal") || url.includes("offer") || url.includes("cost")) &&
      !url.includes("analytics") && !url.includes("google") && !url.includes("qualtrics")
    ) {
      try {
        const body = await response.text();
        if (body.includes("price") || body.includes("Price") || body.includes("$")) {
          priceApis.push({ url: url.slice(0, 200), body: body.slice(0, 600) });
        }
      } catch {}
    }
  });

  try {
    await page.goto("https://www.autozone.com.mx", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1500);

    // Navegar a baterías
    const link = await page.$("a[href*='bater']");
    if (link) {
      await link.click();
      await page.waitForLoadState("networkidle", { timeout: 30000 });
      await page.waitForTimeout(4000);
    }

    console.log("  URL actual:", page.url());
    console.log("  Price API calls:", priceApis.length);
    for (const api of priceApis.slice(0, 6)) {
      console.log("\n  URL:", api.url);
      console.log("  Body:", api.body);
    }

    // Buscar precios en el DOM directamente
    const precios = await page.$$eval(
      "[class*='price'], [class*='Price'], [data-testid*='price'], [class*='dollar'], [class*='amount']",
      (els) => els.slice(0, 10).map((el) => ({
        text: el.textContent?.trim().slice(0, 50),
        class: el.className.slice(0, 60),
        dataAttr: el.getAttribute("data-testid"),
      }))
    );
    console.log("\n  Elementos con precio en DOM:", JSON.stringify(precios, null, 2));

  } catch (e) {
    console.error("  Error:", e instanceof Error ? e.message.slice(0, 200) : e);
  }

  await browser.close();
}

async function main() {
  await getAutoZonePrices();
  await getAutoZonePricesIntercepted();
}

main().catch(console.error);
