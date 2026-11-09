import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_LOCALE, LOCALES, translator } from "../src/i18n/translate.js";
import {
  airlinePage,
  airportPage,
  airportsPage,
  errorsPage,
  firstPerIata,
  homePage,
  legsOf,
  notFoundPage,
  redirectRules,
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

const LOCALES_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "i18n",
  "locales",
);

const translatorFor = (locale) => {
  const file = path.join(LOCALES_DIR, `${locale}.json`);
  const catalog = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  return translator(catalog, locale);
};

/** ATL.html, not ATL/index.html: Pages serves it at /ATL, where a folder would redirect to /ATL/. */
const fileFor = (locale, filePath) =>
  path.join(DIST, locale === DEFAULT_LOCALE ? "" : locale, `${filePath || "index"}.html`);

const write = (file, html) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
};

/** The API's data as [airports, airlines, routes, lastmod], or null while it is unavailable. */
const loadData = async () => {
  try {
    const [airports, airlines, routes, months] = await Promise.all([
      fetchJSON("/airports"),
      fetchJSON("/airlines"),
      fetchJSON("/routes"),
      fetchJSON("/available_months"),
    ]);
    const lastmod = months[0]
      ? `${months[0].year}-${months[0].month.padStart(2, "0")}-01`
      : new Date().toISOString().slice(0, 10);
    return { airports, airlines, routes, lastmod };
  } catch (err) {
    console.warn(`pages: API unavailable (${err.message}); writing the home pages only`);
    return null;
  }
};

/** Every page of the site in one language. */
const pagesIn = (i18n, data) => {
  const pages = [errorsPage(i18n)];
  if (!data) return [homePage([], i18n), ...pages];
  const listed = firstPerIata(data.airports.features ?? []);
  const names = Object.fromEntries(listed.map((f) => [f.properties.IATA, f.properties.Name]));
  const linked = Object.fromEntries(
    Object.entries(data.airlines).filter(([code]) => /^[A-Z0-9]{2,3}$/.test(code)),
  );
  const legs = legsOf(data.routes);
  const bySrc = groupBy(legs, 1);
  const byAirline = groupBy(legs, 0);
  for (const feature of listed) {
    pages.push(airportPage(feature, bySrc.get(feature.properties.IATA), names, linked, i18n));
  }
  for (const [code, name] of Object.entries(linked)) {
    pages.push(airlinePage(code, name, byAirline.get(code), names, i18n));
  }
  pages.push(airportsPage(listed, i18n));
  return [homePage(listed, i18n), ...pages];
};

const main = async () => {
  const template = fs.readFileSync(path.join(DIST, "index.html"), "utf8");
  const data = await loadData();
  let count = 0;
  let english = [];

  for (const locale of LOCALES) {
    const i18n = translatorFor(locale);
    const pages = pagesIn(i18n, data);
    if (locale === DEFAULT_LOCALE) english = pages;
    for (const page of pages) write(fileFor(locale, page.path), renderPage(template, page));
    // What _redirects serves for /ATL/DFW and /ATL/airline/DL, which have no file of their own.
    const shell = { ...homePage([], i18n), noindex: true };
    write(fileFor(locale, "app"), renderPage(template, shell));
    count += pages.length + 1;
  }
  write(fileFor(DEFAULT_LOCALE, "404"), renderPage(template, notFoundPage()));
  fs.writeFileSync(path.join(DIST, "_redirects"), redirectRules());

  const indexed = english.filter((p) => !p.noindex);
  const entries = [
    ...indexed.map((p) => ({ route: p.route })),
    { route: "/docs", locales: [DEFAULT_LOCALE] },
  ];
  fs.writeFileSync(
    path.join(DIST, "sitemap.xml"),
    sitemapXml(entries, data?.lastmod ?? new Date().toISOString().slice(0, 10)),
  );
  const urls = entries.reduce((n, e) => n + (e.locales ?? LOCALES).length, 0);
  console.log(
    `pages: ${count + 1} pages in ${LOCALES.length} languages (${english.length - indexed.length} noindex in each) and a sitemap of ${urls} URLs`,
  );
};

await main();
