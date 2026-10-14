import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SITE_URL = (process.env.SITE_URL || "https://flightatlas.io").replace(/\/$/, "");
const API_BASE = process.env.VITE_API_BASE || "https://api.flightatlas.io";
const OUT_FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "sitemap.xml",
);

const fetchJSON = async (endpoint, attempts = 10) => {
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(`${API_BASE}${endpoint}`, { signal: AbortSignal.timeout(10000) });
    if (res.status === 200) return res.json();
    if (res.status !== 202) throw new Error(`HTTP ${res.status} on ${endpoint}`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`${endpoint} still processing after ${attempts} attempts`);
};

const urlEntry = (loc, lastmod, priority) =>
  `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <priority>${priority}</priority>\n  </url>`;

const main = async () => {
  const today = new Date().toISOString().slice(0, 10);
  const entries = [urlEntry(`${SITE_URL}/`, today, "1.0")];

  try {
    const [airports, airlines] = await Promise.all([
      fetchJSON("/airports"),
      fetchJSON("/airlines"),
    ]);

    const iataCodes = [
      ...new Set(
        (airports.features || [])
          .map((f) => f.properties?.IATA)
          .filter((code) => /^[A-Z]{3}$/.test(code || "")),
      ),
    ].sort();
    const airlineCodes = Object.keys(airlines)
      .filter((code) => /^[A-Z0-9]{2,3}$/.test(code))
      .sort();

    iataCodes.forEach((code) => entries.push(urlEntry(`${SITE_URL}/${code}`, today, "0.8")));
    airlineCodes.forEach((code) =>
      entries.push(urlEntry(`${SITE_URL}/airline/${code}`, today, "0.6")),
    );
    console.log(`sitemap: ${iataCodes.length} airports, ${airlineCodes.length} airlines`);
  } catch (err) {
    console.warn(`sitemap: API unavailable (${err.message}); writing home page only`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>
`;
  fs.writeFileSync(OUT_FILE, xml);
};

await main();
