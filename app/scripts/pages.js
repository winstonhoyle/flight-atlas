import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_NAMES,
  LOCALE_TAGS,
  OG_LOCALES,
  SITE_URL,
  alternates,
  translator,
  withLocale,
} from "../src/i18n/translate.js";

const SITE_NAME = "Flight Atlas";

/** The translator pages use when none is given. */
export const ENGLISH = translator({}, DEFAULT_LOCALE);

const escapeHtml = (text) =>
  String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/** Features with a valid IATA code, the first of each. Two airports can share a code, and a page is named by it. */
export const firstPerIata = (features) => {
  const seen = new Set();
  return features.filter((f) => {
    const iata = f.properties?.IATA ?? "";
    if (!/^[A-Z]{3}$/.test(iata) || seen.has(iata)) return false;
    seen.add(iata);
    return true;
  });
};

/** A routes.json row as an [airline, src, dst] row per airline; a code's `:s`/`:c`/`:sc` marker is dropped. */
export const legsOf = (pairs) =>
  pairs.flatMap(([src, dst, codes]) => codes.map((code) => [code.split(":")[0], src, dst]));

// Inside a <script> tag, "</" would end the tag early.
const jsonLd = (data) => JSON.stringify(data).replaceAll("</", "<\\/");

const destinations = ({ tn }, n) => tn("{n} destination", "{n} destinations", n);

/** Airports with fewer destinations stay out of the sitemap and search results. */
export const MIN_INDEXED_DESTINATIONS = 3;

const link = (href, text) => `<a href="${href}">${escapeHtml(text)}</a>`;
const list = (items) => `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
const airportLink = (iata, names, i18n) =>
  names[iata] ? link(i18n.href(`/${iata}`), `${names[iata]} (${iata})`) : escapeHtml(iata);
const byText = (a, b) => a.text.localeCompare(b.text);

/** The same page in each language, so a visitor and a crawler can switch. */
const languageLinks = (route, { locale }) =>
  `<p>${LOCALES.map((l) =>
    l === locale
      ? `<span lang="${LOCALE_TAGS[l]}">${LOCALE_NAMES[l]}</span>`
      : `<a href="${withLocale(route, l)}" hreflang="${LOCALE_TAGS[l]}" lang="${LOCALE_TAGS[l]}">${LOCALE_NAMES[l]}</a>`,
  ).join(" · ")}</p>`;

const section = (heading, summary, body, route, i18n, tag = "h2") =>
  `<section id="about" class="about"><${tag}>${escapeHtml(heading)}</${tag}><p>${escapeHtml(summary)}</p>${body}` +
  `<p>${link(i18n.href("/airports"), i18n.t("All airports"))} · ${link(i18n.href("/"), i18n.t("Flight route map"))}</p>` +
  `${languageLinks(route, i18n)}</section>`;

/** A page's fields in a language; `route` is its path without the language prefix. */
const page = (i18n, route, fields) => ({
  route,
  locale: i18n.locale,
  tag: i18n.tag,
  noscript: i18n.t("You need to enable JavaScript to run this app."),
  url: `${SITE_URL}${i18n.href(route)}`,
  ...fields,
});

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
  i18n = ENGLISH,
) => {
  const { t, tn } = i18n;
  const route = `/${p.IATA}`;
  const url = `${SITE_URL}${i18n.href(route)}`;
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
        `${airlines[code] ? link(i18n.href(`/airline/${code}`), text) : escapeHtml(text)}: ${destinations(i18n, count)}`,
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
        `${airportLink(dst, names, i18n)}: ${escapeHtml(
          [...codes]
            .map((c) => airlines[c] ?? c)
            .sort()
            .join(", "),
        )}`,
    );
  const where = p.City ? t("{name} in {city}", { name: p.Name, city: p.City }) : p.Name;
  const heading = t("Direct flights from {place} ({airport})", { place: p.Name, airport: p.IATA });
  return page(i18n, route, {
    noindex: p.destinations < MIN_INDEXED_DESTINATIONS,
    path: p.IATA,
    title: `${t("Direct flights from {place} ({airport})", { place: p.City || p.Name, airport: p.IATA })} | ${SITE_NAME}`,
    description: tn(
      "Direct flights from {place} ({airport}) to {n} destination, on a map.",
      "Direct flights from {place} ({airport}) to {n} destinations, on a map.",
      p.destinations,
      { place: p.Name, airport: p.IATA },
    ),
    heading,
    summary: tn(
      "{airport} has direct flights to {n} destination.",
      "{airport} has direct flights to {n} destinations.",
      p.destinations,
      { airport: p.Name },
    ),
    section: routes.length
      ? section(
          heading,
          t("{airport} has direct flights to {destinations} on {airlines}.", {
            airport: where,
            destinations: destinations(i18n, p.destinations),
            airlines: tn("{n} airline", "{n} airlines", airlineDestinations.length),
          }),
          `<h3>${escapeHtml(t("Airlines"))}</h3>${list(airlineDestinations)}<h3>${escapeHtml(t("Destinations"))}</h3>${list(destinationAirlines)}`,
          route,
          i18n,
        )
      : "",
    data: {
      "@context": "https://schema.org",
      "@type": "Airport",
      name: p.Name,
      iataCode: p.IATA,
      url,
      inLanguage: i18n.tag,
      geo: {
        "@type": "GeoCoordinates",
        latitude: geometry.coordinates[1],
        longitude: geometry.coordinates[0],
      },
    },
  });
};

/** `routes` are this airline's [airline, src, dst] rows; `names` maps IATA to name for airports with a page. */
export const airlinePage = (code, name, routes = [], names = {}, i18n = ENGLISH) => {
  const { t, tn } = i18n;
  const route = `/airline/${code}`;
  const url = `${SITE_URL}${i18n.href(route)}`;
  const origins = [
    ...groupSets(
      routes,
      (r) => r[1],
      (r) => r[2],
    ),
  ]
    .map(([src, dsts]) => ({ src, count: dsts.size, text: names[src] ?? src }))
    .sort((a, b) => b.count - a.count || byText(a, b))
    .map(({ src, count }) => `${airportLink(src, names, i18n)}: ${destinations(i18n, count)}`);
  const heading = t("{airline} ({code}) routes", { airline: name, code });
  return page(i18n, route, {
    path: `airline/${code}`,
    title: `${t("{airline} routes in the Americas", { airline: name })} | ${SITE_NAME}`,
    description: t(
      "Every direct route {airline} ({code}) flies from airports in the Americas, on a map.",
      { airline: name, code },
    ),
    heading,
    summary: t("The direct routes {airline} flies from airports in the Americas.", {
      airline: name,
    }),
    section: routes.length
      ? section(
          heading,
          tn(
            "{airline} flies direct from {n} airport on this map.",
            "{airline} flies direct from {n} airports on this map.",
            origins.length,
            { airline: name },
          ),
          `<h3>${escapeHtml(t("Airports"))}</h3>${list(origins)}`,
          route,
          i18n,
        )
      : "",
    data: {
      "@context": "https://schema.org",
      "@type": "Airline",
      name,
      iataCode: code,
      url,
      inLanguage: i18n.tag,
    },
  });
};

export const errorsPage = (i18n = ENGLISH) => {
  const { t } = i18n;
  const route = "/errors";
  const title = `${t("Wikipedia data problems")} | ${SITE_NAME}`;
  return page(i18n, route, {
    path: "errors",
    title,
    description: t(
      "Wikipedia airport and airline pages the Flight Atlas scraper couldn't fully read, by airport and airline.",
    ),
    heading: t("Wikipedia data problems"),
    summary: t(
      "Pages the scraper couldn't fully read, so some routes may be missing from the map.",
    ),
    data: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: title,
      url: `${SITE_URL}${i18n.href(route)}`,
      inLanguage: i18n.tag,
    },
  });
};

/** Written as 404.html: with it present, the host stops answering unknown paths with index.html. English only. */
export const notFoundPage = () => {
  const route = "/404";
  const title = `Page not found | ${SITE_NAME}`;
  return page(ENGLISH, route, {
    path: "404",
    noApp: true,
    noindex: true,
    title,
    description: "This page doesn't exist. Pick an airport on the map to see where it flies.",
    heading: "Page not found",
    summary: "This page doesn't exist.",
    section: section(
      "Page not found",
      "There's no page at this address. Check the airport code, or pick an airport on the map.",
      "",
      route,
      ENGLISH,
      "h1",
    ),
    data: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: title,
      url: `${SITE_URL}${route}`,
    },
  });
};

/** Every airport with a page, alphabetically. A plain page: the app would send /airports home. */
export const airportsPage = (airports, i18n = ENGLISH) => {
  const { t, tn } = i18n;
  const route = "/airports";
  const title = `${t("All airports")} | ${SITE_NAME}`;
  const items = airports
    .map(({ properties: p }) => ({ p, text: p.Name }))
    .sort(byText)
    .map(
      ({ p }) =>
        `${link(i18n.href(`/${p.IATA}`), `${p.Name} (${p.IATA})`)}: ${destinations(i18n, p.destinations)}`,
    );
  const n = airports.length;
  return page(i18n, route, {
    path: "airports",
    noApp: true,
    title,
    description: tn(
      "Direct flight routes from {n} airport in the Americas, on a map.",
      "Direct flight routes from {n} airports in the Americas, on a map.",
      n,
    ),
    heading: t("All airports"),
    summary: tn(
      "Direct flights from {n} airport in the Americas.",
      "Direct flights from {n} airports in the Americas.",
      n,
    ),
    section: section(
      t("All airports"),
      tn(
        "Direct flights from {n} airport in the Americas. Pick one to see where it flies.",
        "Direct flights from {n} airports in the Americas. Pick one to see where it flies.",
        n,
      ),
      list(items),
      route,
      i18n,
      "h1",
    ),
    data: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: title,
      url: `${SITE_URL}${i18n.href(route)}`,
      inLanguage: i18n.tag,
    },
  });
};

/** The home page: the app's own head tags in this language, and links to the busiest airports after #root. */
export const homePage = (airports = [], i18n = ENGLISH, count = 30) => {
  const { t } = i18n;
  const description = t(
    "A flight route map of every direct flight between airports in the Americas. Pick an airport to see where it flies nonstop and which airlines fly each route.",
  );
  return page(i18n, "/", {
    home: true,
    path: "",
    title: t("Flight Atlas: direct flight route map of the Americas"),
    description,
    imageAlt: t(
      "Flight Atlas: a map of direct flight routes from Kansas City across the Americas.",
    ),
    section: airports.length
      ? section(
          t("Busiest airports"),
          t("Direct flight routes from the airports in the Americas with the most destinations."),
          list(
            airports
              .slice(0, count)
              .map(
                ({ properties: p }) =>
                  `${link(i18n.href(`/${p.IATA}`), `${p.Name} (${p.IATA})`)}: ${destinations(i18n, p.destinations)}`,
              ),
          ),
          "/",
          i18n,
        )
      : "",
    data: {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url: `${SITE_URL}${i18n.href("/")}`,
      description: t("Every direct flight route between airports in the Americas, on a map."),
      inLanguage: i18n.tag,
    },
  });
};

const setAttr = (html, pattern, value) => {
  if (!pattern.test(html)) throw new Error(`Template is missing ${pattern}`);
  return html.replace(pattern, `$1${escapeHtml(value)}$2`);
};

/** Copies the built index.html with the page's own head tags and a text summary inside #root. */
export const renderPage = (template, page) => {
  let html = template.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(page.title)}</title>`);
  html = html.replace(/<html lang="[^"]*">/, `<html lang="${page.tag}">`);
  html = html.replace(
    /<noscript>[^<]*<\/noscript>/,
    `<noscript>${escapeHtml(page.noscript)}</noscript>`,
  );
  html = setAttr(html, /(<meta\s+name="description"\s+content=")[^"]*(")/, page.description);
  html = setAttr(html, /(<meta\s+property="og:description"\s+content=")[^"]*(")/, page.description);
  html = setAttr(html, /(<meta\s+property="og:title"\s+content=")[^"]*(")/, page.title);
  html = setAttr(html, /(<meta\s+property="og:url"\s+content=")[^"]*(")/, page.url);
  html = setAttr(html, /(<link\s+rel="canonical"\s+href=")[^"]*(")/, page.url);
  if (page.imageAlt) {
    html = setAttr(html, /(<meta\s+property="og:image:alt"\s+content=")[^"]*(")/, page.imageAlt);
  }
  html = html.replace(
    /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
    `<script type="application/ld+json">${jsonLd(page.data)}</script>`,
  );
  // Bing reads the language from content-language more than from hreflang.
  const tags = [
    `<meta http-equiv="content-language" content="${page.tag}" />`,
    `<meta property="og:locale" content="${OG_LOCALES[page.locale]}" />`,
  ];
  if (page.noindex) tags.push('<meta name="robots" content="noindex" />');
  else {
    for (const l of page.locales ?? LOCALES) {
      if (l !== page.locale) {
        tags.push(`<meta property="og:locale:alternate" content="${OG_LOCALES[l]}" />`);
      }
    }
    for (const { hreflang, href } of alternates(page.route, page.locales)) {
      tags.push(`<link rel="alternate" hreflang="${hreflang}" href="${href}" />`);
    }
  }
  html = html.replace("</head>", `${tags.join("\n")}\n</head>`);
  if (page.noApp) {
    html = html.replace(/<script type="module"[^>]*><\/script>/, "");
    return html.replace('<div id="root"></div>', `<div id="root">${page.section}</div>`);
  }
  if (page.home) {
    return html.replace('<div id="root"></div>', `<div id="root"></div>${page.section}`);
  }
  return html.replace(
    '<div id="root"></div>',
    `<div id="root"><main><h1>${escapeHtml(page.heading)}</h1><p>${escapeHtml(page.summary)}</p></main></div>${page.section ?? ""}`,
  );
};

/** Each route in every language it has, with links to its other languages. `locales` limits one to fewer. */
export const sitemapXml = (entries, lastmod) => {
  const urls = entries.flatMap(({ route, locales = LOCALES }) =>
    locales.map((locale) => {
      const links = alternates(route, locales)
        .map(
          ({ hreflang, href }) =>
            `\n    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${href}"/>`,
        )
        .join("");
      return `  <url>\n    <loc>${SITE_URL}${withLocale(route, locale)}</loc>\n    <lastmod>${lastmod}</lastmod>${locales.length > 1 ? links : ""}\n  </url>`;
    }),
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join("\n")}
</urlset>
`;
};

/**
 * The host's rewrite rules. A rule that matches two path segments would also answer /assets/index.js
 * and /es/ATL with the app, so each static path is let through first.
 */
export const redirectRules = (locales = LOCALES) => {
  const others = locales.filter((l) => l !== DEFAULT_LOCALE);
  return [
    ["/assets/*", "/assets/:splat", 200],
    ["/airline/:code", "/airline/:code", 200],
    ...others.flatMap((l) => [
      [`/${l}/airline/:code`, `/${l}/airline/:code`, 200],
      [`/${l}/:page`, `/${l}/:page`, 200],
      [`/${l}/:airport/airline/:code`, `/${l}/app`, 200],
      [`/${l}/:airport/:destination`, `/${l}/app`, 200],
    ]),
    ["/:airport/airline/:code", "/app", 200],
    ["/:airport/:destination", "/app", 200],
  ]
    .map((rule) => rule.join(" "))
    .join("\n")
    .concat("\n");
};
