export const SITE_URL = "https://flightatlas.io";
const SITE_NAME = "Flight Atlas";

const escapeHtml = (text) =>
  String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

// Inside a <script> tag, "</" would end the tag early.
const jsonLd = (data) => JSON.stringify(data).replaceAll("</", "<\\/");

const destinations = (n) => `${n} ${n === 1 ? "destination" : "destinations"}`;

export const airportPage = ({ properties: p, geometry }) => {
  const url = `${SITE_URL}/${p.IATA}`;
  return {
    path: p.IATA,
    title: `${p.IATA} direct flights | ${SITE_NAME}`,
    description: `Direct flights from ${p.Name} (${p.IATA}) to ${destinations(p.destinations)}, on a map.`,
    url,
    heading: `Direct flights from ${p.Name} (${p.IATA})`,
    summary: `${p.Name} has direct flights to ${destinations(p.destinations)}.`,
    data: {
      "@context": "https://schema.org",
      "@type": "Airport",
      name: p.Name,
      iataCode: p.IATA,
      url,
      geo: {
        "@type": "GeoCoordinates",
        latitude: geometry.coordinates[1],
        longitude: geometry.coordinates[0],
      },
    },
  };
};

export const airlinePage = (code, name) => {
  const url = `${SITE_URL}/airline/${code}`;
  return {
    path: `airline/${code}`,
    title: `${name} routes | ${SITE_NAME}`,
    description: `Every direct route ${name} (${code}) flies from U.S. airports, on a map.`,
    url,
    heading: `${name} (${code}) routes`,
    summary: `The direct routes ${name} flies from U.S. airports.`,
    data: { "@context": "https://schema.org", "@type": "Airline", name, iataCode: code, url },
  };
};

const setAttr = (html, pattern, value) => {
  if (!pattern.test(html)) throw new Error(`Template is missing ${pattern}`);
  return html.replace(pattern, `$1${escapeHtml(value)}$2`);
};

/** Copies the built index.html with the page's own head tags and a text summary inside #root. */
export const renderPage = (template, page) => {
  let html = template.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(page.title)}</title>`);
  html = setAttr(html, /(<meta\s+name="description"\s+content=")[^"]*(")/, page.description);
  html = setAttr(html, /(<meta\s+property="og:description"\s+content=")[^"]*(")/, page.description);
  html = setAttr(html, /(<meta\s+property="og:title"\s+content=")[^"]*(")/, page.title);
  html = setAttr(html, /(<meta\s+property="og:url"\s+content=")[^"]*(")/, page.url);
  html = setAttr(html, /(<link\s+rel="canonical"\s+href=")[^"]*(")/, page.url);
  html = html.replace(
    /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
    `<script type="application/ld+json">${jsonLd(page.data)}</script>`,
  );
  return html.replace(
    '<div id="root"></div>',
    `<div id="root"><main><h1>${escapeHtml(page.heading)}</h1><p>${escapeHtml(page.summary)}</p></main></div>`,
  );
};

export const sitemapXml = (urls, lastmod) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((loc) => `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`).join("\n")}
</urlset>
`;
