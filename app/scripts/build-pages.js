import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SITE_URL,
  airlinePage,
  airportPage,
  airportsPage,
  errorsPage,
  homeSection,
  renderHome,
  renderPage,
  sitemapXml,
} from "./pages.js";

const API_BASE = process.env.VITE_API_BASE || "https://api.flightatlas.io";
const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");

const fetchJSON = async (endpoint) => {
  const res = await fetch(`${API_BASE}${endpoint}`, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${endpoint}`);
  return res.json();
};

const groupBy = (rows, key) => {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row[key])) groups.set(row[key], []);
    groups.get(row[key]).push(row);
  }
  return groups;
};

const main = async () => {
  const template = fs.readFileSync(path.join(DIST, "index.html"), "utf8");
  // Without its own page, /errors falls back to index.html, whose canonical points home.
  const pages = [errorsPage()];
  let lastmod = new Date().toISOString().slice(0, 10);
  try {
    const [airports, airlines, routes, months] = await Promise.all([
      fetchJSON("/airports"),
      fetchJSON("/airlines"),
      fetchJSON("/routes"),
      fetchJSON("/available_months"),
    ]);
    if (months[0]) lastmod = `${months[0].year}-${months[0].month.padStart(2, "0")}-01`;

    const listed = (airports.features ?? []).filter((f) =>
      /^[A-Z]{3}$/.test(f.properties?.IATA ?? ""),
    );
    const names = Object.fromEntries(listed.map((f) => [f.properties.IATA, f.properties.Name]));
    const linked = Object.fromEntries(
      Object.entries(airlines).filter(([code]) => /^[A-Z0-9]{2,3}$/.test(code)),
    );
    const bySrc = groupBy(routes, 1);
    const byAirline = groupBy(routes, 0);

    for (const feature of listed) {
      pages.push(airportPage(feature, bySrc.get(feature.properties.IATA), names, linked));
    }
    for (const [code, name] of Object.entries(linked)) {
      pages.push(airlinePage(code, name, byAirline.get(code), names));
    }
    pages.push(airportsPage(listed));
    fs.writeFileSync(path.join(DIST, "index.html"), renderHome(template, homeSection(listed)));
  } catch (err) {
    console.warn(`pages: API unavailable (${err.message}); writing the home page only`);
  }

  // ATL.html, not ATL/index.html: Pages serves it at /ATL, where a folder would redirect to /ATL/.
  for (const page of pages) {
    const file = path.join(DIST, `${page.path}.html`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, renderPage(template, page));
  }
  const indexed = pages.filter((p) => !p.noindex);
  const urls = [`${SITE_URL}/`, `${SITE_URL}/docs`, ...indexed.map((p) => p.url).sort()];
  fs.writeFileSync(path.join(DIST, "sitemap.xml"), sitemapXml(urls, lastmod));
  console.log(
    `pages: ${pages.length} pages (${pages.length - indexed.length} noindex) and a sitemap of ${urls.length} URLs`,
  );
};

await main();
