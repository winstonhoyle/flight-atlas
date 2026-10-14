import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SITE_URL, airlinePage, airportPage, renderPage, sitemapXml } from "./pages.js";

const API_BASE = process.env.VITE_API_BASE || "https://api.flightatlas.io";
const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");

const fetchJSON = async (endpoint, attempts = 10) => {
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(`${API_BASE}${endpoint}`, { signal: AbortSignal.timeout(10000) });
    if (res.status === 200) return res.json();
    if (res.status !== 202) throw new Error(`HTTP ${res.status} on ${endpoint}`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`${endpoint} still processing after ${attempts} attempts`);
};

const main = async () => {
  const template = fs.readFileSync(path.join(DIST, "index.html"), "utf8");
  const pages = [];
  try {
    const [airports, airlines] = await Promise.all([
      fetchJSON("/airports"),
      fetchJSON("/airlines"),
    ]);
    for (const feature of airports.features ?? []) {
      if (/^[A-Z]{3}$/.test(feature.properties?.IATA ?? "")) pages.push(airportPage(feature));
    }
    for (const [code, name] of Object.entries(airlines)) {
      if (/^[A-Z0-9]{2,3}$/.test(code)) pages.push(airlinePage(code, name));
    }
  } catch (err) {
    console.warn(`pages: API unavailable (${err.message}); writing the home page only`);
  }

  // ATL.html, not ATL/index.html: Pages serves it at /ATL, where a folder would redirect to /ATL/.
  for (const page of pages) {
    const file = path.join(DIST, `${page.path}.html`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, renderPage(template, page));
  }
  const urls = [`${SITE_URL}/`, ...pages.map((p) => p.url).sort()];
  fs.writeFileSync(
    path.join(DIST, "sitemap.xml"),
    sitemapXml(urls, new Date().toISOString().slice(0, 10)),
  );
  console.log(`pages: ${pages.length} pages and a sitemap of ${urls.length} URLs`);
};

await main();
