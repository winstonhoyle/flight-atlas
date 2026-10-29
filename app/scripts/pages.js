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

/** Airports with fewer destinations stay out of the sitemap and search results. */
export const MIN_INDEXED_DESTINATIONS = 3;

const link = (href, text) => `<a href="${href}">${escapeHtml(text)}</a>`;
const list = (items) => `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
const airportLink = (iata, names) =>
  names[iata] ? link(`/${iata}`, `${names[iata]} (${iata})`) : escapeHtml(iata);
const byText = (a, b) => a.text.localeCompare(b.text);

const section = (heading, summary, body, tag = "h2") =>
  `<section id="about" class="about"><${tag}>${escapeHtml(heading)}</${tag}><p>${escapeHtml(summary)}</p>${body}` +
  `<p>${link("/airports", "All airports")} · ${link("/", "Flight route map")}</p></section>`;

/** Unique values of `value(row)` for each `key(row)`. */
const groupSets = (rows, key, value) => {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(key(row))) groups.set(key(row), new Set());
    groups.get(key(row)).add(value(row));
  }
  return groups;
};

/** `routes` are this airport's [airline, src, dst] rows; `names` maps IATA to name for airports with a page. */
export const airportPage = (
  { properties: p, geometry },
  routes = [],
  names = {},
  airlines = {},
) => {
  const url = `${SITE_URL}/${p.IATA}`;
  const airlineDestinations = [
    ...groupSets(
      routes,
      (r) => r[0],
      (r) => r[2],
    ),
  ]
    .map(([code, dsts]) => ({ code, count: dsts.size, text: airlines[code] ?? code }))
    .sort((a, b) => b.count - a.count || byText(a, b))
    .map(
      ({ code, count, text }) =>
        `${airlines[code] ? link(`/airline/${code}`, text) : escapeHtml(text)}: ${destinations(count)}`,
    );
  const destinationAirlines = [
    ...groupSets(
      routes,
      (r) => r[2],
      (r) => r[0],
    ),
  ]
    .map(([dst, codes]) => ({ dst, codes, text: names[dst] ?? dst }))
    .sort(byText)
    .map(
      ({ dst, codes }) =>
        `${airportLink(dst, names)}: ${escapeHtml(
          [...codes]
            .map((c) => airlines[c] ?? c)
            .sort()
            .join(", "),
        )}`,
    );
  const place = p.City ? ` in ${p.City}` : "";
  return {
    noindex: p.destinations < MIN_INDEXED_DESTINATIONS,
    path: p.IATA,
    title: `${p.IATA} direct flights | ${SITE_NAME}`,
    description: `Direct flights from ${p.Name} (${p.IATA}) to ${destinations(p.destinations)}, on a map.`,
    url,
    heading: `Direct flights from ${p.Name} (${p.IATA})`,
    summary: `${p.Name} has direct flights to ${destinations(p.destinations)}.`,
    section: routes.length
      ? section(
          `Direct flights from ${p.Name} (${p.IATA})`,
          `${p.Name}${place} has direct flights to ${destinations(p.destinations)} on ${airlineDestinations.length} ${airlineDestinations.length === 1 ? "airline" : "airlines"}.`,
          `<h3>Airlines</h3>${list(airlineDestinations)}<h3>Destinations</h3>${list(destinationAirlines)}`,
        )
      : "",
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

/** `routes` are this airline's [airline, src, dst] rows; `names` maps IATA to name for airports with a page. */
export const airlinePage = (code, name, routes = [], names = {}) => {
  const url = `${SITE_URL}/airline/${code}`;
  const origins = [
    ...groupSets(
      routes,
      (r) => r[1],
      (r) => r[2],
    ),
  ]
    .map(([src, dsts]) => ({ src, count: dsts.size, text: names[src] ?? src }))
    .sort((a, b) => b.count - a.count || byText(a, b))
    .map(({ src, count }) => `${airportLink(src, names)}: ${destinations(count)}`);
  return {
    path: `airline/${code}`,
    title: `${name} routes | ${SITE_NAME}`,
    description: `Every direct route ${name} (${code}) flies from North American airports, on a map.`,
    url,
    heading: `${name} (${code}) routes`,
    summary: `The direct routes ${name} flies from North American airports.`,
    section: routes.length
      ? section(
          `${name} (${code}) routes`,
          `${name} flies direct from ${origins.length} ${origins.length === 1 ? "airport" : "airports"} on this map.`,
          `<h3>Airports</h3>${list(origins)}`,
        )
      : "",
    data: { "@context": "https://schema.org", "@type": "Airline", name, iataCode: code, url },
  };
};

export const errorsPage = () => {
  const url = `${SITE_URL}/errors`;
  const title = `Wikipedia data problems | ${SITE_NAME}`;
  return {
    path: "errors",
    title,
    description:
      "Wikipedia airport and airline pages the Flight Atlas scraper couldn't fully read, by airport and airline.",
    url,
    heading: "Wikipedia data problems",
    summary: "Pages the scraper couldn't fully read, so some routes may be missing from the map.",
    data: { "@context": "https://schema.org", "@type": "WebPage", name: title, url },
  };
};

/** Every airport with a page, alphabetically. A plain page: the app would send /airports home. */
export const airportsPage = (airports) => {
  const url = `${SITE_URL}/airports`;
  const title = `All airports | ${SITE_NAME}`;
  const items = airports
    .map(({ properties: p }) => ({ p, text: p.Name }))
    .sort(byText)
    .map(
      ({ p }) => `${link(`/${p.IATA}`, `${p.Name} (${p.IATA})`)}: ${destinations(p.destinations)}`,
    );
  return {
    path: "airports",
    noApp: true,
    title,
    description: `Direct flight routes from ${airports.length} North American airports, on a map.`,
    url,
    heading: "All airports",
    summary: `Direct flights from ${airports.length} North American airports.`,
    section: section(
      "All airports",
      `Direct flights from ${airports.length} North American airports. Pick one to see where it flies.`,
      list(items),
      "h1",
    ),
    data: { "@context": "https://schema.org", "@type": "CollectionPage", name: title, url },
  };
};

/** The home page's links to the busiest airports; `airports` arrive busiest first. */
export const homeSection = (airports, count = 30) =>
  section(
    "Busiest airports",
    "Direct flight routes from the North American airports with the most destinations.",
    list(
      airports
        .slice(0, count)
        .map(
          ({ properties: p }) =>
            `${link(`/${p.IATA}`, `${p.Name} (${p.IATA})`)}: ${destinations(p.destinations)}`,
        ),
    ),
  );

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
  if (page.noindex) {
    html = html.replace("</head>", '<meta name="robots" content="noindex" />\n</head>');
  }
  if (page.noApp) {
    html = html.replace(/<script type="module"[^>]*><\/script>/, "");
    return html.replace('<div id="root"></div>', `<div id="root">${page.section}</div>`);
  }
  return html.replace(
    '<div id="root"></div>',
    `<div id="root"><main><h1>${escapeHtml(page.heading)}</h1><p>${escapeHtml(page.summary)}</p></main></div>${page.section ?? ""}`,
  );
};

/** The home page keeps its own head tags and gains the section after #root. */
export const renderHome = (template, section) =>
  template.replace('<div id="root"></div>', `<div id="root"></div>${section}`);

export const sitemapXml = (urls, lastmod) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((loc) => `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`).join("\n")}
</urlset>
`;
