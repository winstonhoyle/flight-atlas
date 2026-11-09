import { describe, expect, it } from "vitest";
import { translator } from "../src/i18n/translate.js";
import {
  airlinePage,
  airportPage,
  airportsPage,
  errorsPage,
  firstPerIata,
  homePage,
  legsOf,
  notFoundPage,
  renderPage,
  sitemapXml,
} from "./pages.js";

const TEMPLATE = `<html lang="en"><head>
<title>Flight Atlas</title>
<meta name="description" content="Home" />
<link rel="canonical" href="https://flightatlas.io/" />
<meta property="og:title" content="Home" />
<meta property="og:description" content="Home" />
<meta property="og:url" content="https://flightatlas.io/" />
<meta property="og:image:alt" content="Alt" />
<script type="application/ld+json">{"@type": "WebSite"}</script>
</head><body><div id="root"></div><script type="module" src="/assets/index.js"></script></body></html>`;

const ATL = {
  properties: {
    IATA: "ATL",
    City: "Atlanta",
    Name: "Hartsfield–Jackson Atlanta International Airport",
    destinations: 248,
  },
  geometry: { coordinates: [-84.42806, 33.63667] },
};

describe("firstPerIata", () => {
  it("keeps one airport per code and drops bad codes", () => {
    const f = (IATA, Name) => ({ properties: { IATA, Name } });
    const kept = firstPerIata([
      f("YBW", "Springbank"),
      f("YBW", "Bedwell Harbour"),
      f("x1", "Bad"),
    ]);
    expect(kept.map((a) => a.properties.Name)).toEqual(["Springbank"]);
  });
});

describe("renderPage", () => {
  it("gives an airport page its own head tags, structured data, and summary", () => {
    const html = renderPage(TEMPLATE, airportPage(ATL));

    expect(html).toContain("<title>Direct flights from Atlanta (ATL) | Flight Atlas</title>");
    expect(html).toContain('<link rel="canonical" href="https://flightatlas.io/ATL" />');
    expect(html).toContain('<meta property="og:url" content="https://flightatlas.io/ATL" />');
    expect(html).toContain("to 248 destinations, on a map.");
    expect(html).toContain('"@type":"Airport"');
    expect(html).toContain('"latitude":33.63667');
    expect(html).not.toContain('"@type": "WebSite"');
    expect(html).toContain(
      "<h1>Direct flights from Hartsfield–Jackson Atlanta International Airport (ATL)</h1>",
    );
    expect(html).toContain('<script type="module" src="/assets/index.js"></script>');
  });

  it("gives the errors page its own canonical instead of the home page's", () => {
    const html = renderPage(TEMPLATE, errorsPage());

    expect(html).toContain('<link rel="canonical" href="https://flightatlas.io/errors" />');
    expect(html).toContain("<title>Wikipedia data problems | Flight Atlas</title>");
    expect(html).toContain('"@type":"WebPage"');
  });

  it("escapes names in HTML and in structured data", () => {
    const html = renderPage(TEMPLATE, airlinePage("XX", 'A&B "Air" <script></script>'));

    expect(html).toContain(
      "<title>A&amp;B &quot;Air&quot; &lt;script&gt;&lt;/script&gt; routes in the Americas | Flight Atlas</title>",
    );
    expect(html).not.toContain("<script></script>");
    expect(html).toContain("<\\/script>");
  });

  it("fails loudly when the template is missing a tag it fills in", () => {
    expect(() => renderPage("<html></html>", airportPage(ATL))).toThrow("Template is missing");
  });
});

describe("page sections", () => {
  const ROUTES = [
    ["DL", "ATL", "BOS"],
    ["DL", "ATL", "BOS"],
    ["B6", "ATL", "BOS"],
    ["DL", "ATL", "CDG"],
  ];
  const NAMES = { ATL: ATL.properties.Name, BOS: "Logan International Airport" };
  const AIRLINES = { DL: "Delta Air Lines", B6: "JetBlue" };

  it("lists an airport's airlines and destinations as links after #root", () => {
    const html = renderPage(TEMPLATE, airportPage(ATL, ROUTES, NAMES, AIRLINES));
    const about = html.slice(html.indexOf('<div id="root">'));

    expect(about).toMatch(/<\/div><section id="about"/);
    expect(about).toContain('<a href="/airline/DL">Delta Air Lines</a>: 2 destinations');
    expect(about).toContain('<a href="/airline/B6">JetBlue</a>: 1 destination');
    expect(about).toContain(
      '<a href="/BOS">Logan International Airport (BOS)</a>: Delta Air Lines, JetBlue',
    );
    expect(about).toContain("CDG: Delta Air Lines");
    expect(about).not.toContain('href="/CDG"');
    expect(html).not.toContain("noindex");
  });

  it("makes the 404 page a plain page kept out of search", () => {
    const html = renderPage(TEMPLATE, notFoundPage());
    expect(html).toContain('<meta name="robots" content="noindex" />');
    expect(html).toContain("<h1>Page not found</h1>");
    expect(html).not.toContain('<script type="module"');
  });

  it("keeps airports with few destinations out of search", () => {
    const small = { ...ATL, properties: { ...ATL.properties, destinations: 2 } };
    const html = renderPage(TEMPLATE, airportPage(small, ROUTES, NAMES, AIRLINES));
    expect(html).toContain('<meta name="robots" content="noindex" />\n</head>');
  });

  it("lists an airline's airports", () => {
    const page = airlinePage("DL", "Delta Air Lines", ROUTES, NAMES);
    expect(page.section).toContain(`<a href="/ATL">${NAMES.ATL} (ATL)</a>: 2 destinations`);
  });

  it("serves the airport directory without the app, which would send it home", () => {
    const bos = { properties: { IATA: "BOS", Name: NAMES.BOS, destinations: 156 } };
    const html = renderPage(TEMPLATE, airportsPage([ATL, bos]));

    expect(html).not.toContain('<script type="module"');
    expect(html).toContain('<link rel="canonical" href="https://flightatlas.io/airports" />');
    expect(html.indexOf('href="/ATL"')).toBeLessThan(html.indexOf('href="/BOS"'));
    expect(html).toContain(
      '<div id="root"><section id="about" class="about"><h1>All airports</h1>',
    );
  });

  it("adds the busiest airports to the home page and keeps its head", () => {
    const html = renderPage(TEMPLATE, homePage([ATL]));
    expect(html).toContain('<link rel="canonical" href="https://flightatlas.io/" />');
    expect(html).toContain("<title>Flight Atlas: direct flight route map of the Americas</title>");
    expect(html).toContain('<div id="root"></div><section id="about"');
    expect(html).toContain('<a href="/ATL">');
  });
});

describe("languages", () => {
  const es = translator(
    {
      "Direct flights from {place} ({airport})": "Vuelos directos desde {place} ({airport})",
      "Flight route map": "Mapa de rutas",
    },
    "es",
  );
  const ROUTES = [["DL", "ATL", "BOS"]];
  const NAMES = { ATL: ATL.properties.Name, BOS: "Logan International Airport" };
  const AIRLINES = { DL: "Delta Air Lines" };

  it("writes a translated page at its own URL, with its own language attribute", () => {
    const html = renderPage(TEMPLATE, airportPage(ATL, ROUTES, NAMES, AIRLINES, es));
    expect(html).toContain('<html lang="es-419">');
    expect(html).toContain("<title>Vuelos directos desde Atlanta (ATL) | Flight Atlas</title>");
    expect(html).toContain('<link rel="canonical" href="https://flightatlas.io/es/ATL" />');
    expect(html).toContain('"inLanguage":"es-419"');
  });

  it("links to the same language and to the other languages of the page", () => {
    const html = renderPage(TEMPLATE, airportPage(ATL, ROUTES, NAMES, AIRLINES, es));
    expect(html).toContain('<a href="/es/airline/DL">Delta Air Lines</a>');
    expect(html).toContain('<a href="/es/BOS">Logan International Airport (BOS)</a>');
    expect(html).toContain('<a href="/es/">Mapa de rutas</a>');
    expect(html).toContain('<a href="/ATL" hreflang="en" lang="en">English</a>');
    expect(html).toContain('<span lang="es-419">Español</span>');
  });

  it("declares every language of an indexed page, and the English one as the default", () => {
    const html = renderPage(TEMPLATE, airportPage(ATL, ROUTES, NAMES, AIRLINES, es));
    expect(html).toContain(
      '<link rel="alternate" hreflang="en" href="https://flightatlas.io/ATL" />',
    );
    expect(html).toContain(
      '<link rel="alternate" hreflang="fr-CA" href="https://flightatlas.io/fr/ATL" />',
    );
    expect(html).toContain(
      '<link rel="alternate" hreflang="x-default" href="https://flightatlas.io/ATL" />',
    );
  });

  it("declares the language for Bing and for link previews", () => {
    const html = renderPage(TEMPLATE, airportPage(ATL, ROUTES, NAMES, AIRLINES, es));
    expect(html).toContain('<meta http-equiv="content-language" content="es-419" />');
    expect(html).toContain('<meta property="og:locale" content="es_LA" />');
    expect(html).toContain('<meta property="og:locale:alternate" content="en_US" />');
    expect(html).toContain('<meta property="og:locale:alternate" content="pt_BR" />');
    // The page's own language is not listed as an alternate.
    expect(html.match(/content="es_LA"/g)).toHaveLength(1);
  });

  it("keeps the alternate locales off a page kept out of search", () => {
    const small = { ...ATL, properties: { ...ATL.properties, destinations: 2 } };
    const html = renderPage(TEMPLATE, airportPage(small, ROUTES, NAMES, AIRLINES, es));
    expect(html).toContain('<meta property="og:locale" content="es_LA" />');
    expect(html).not.toContain("og:locale:alternate");
  });

  it("gives a language its home at a slash URL", () => {
    const html = renderPage(TEMPLATE, homePage([ATL], es));
    expect(html).toContain('<link rel="canonical" href="https://flightatlas.io/es/" />');
    expect(html).toContain('hreflang="pt-BR" href="https://flightatlas.io/pt/"');
  });

  it("leaves hreflang off a page kept out of search", () => {
    const small = { ...ATL, properties: { ...ATL.properties, destinations: 2 } };
    expect(renderPage(TEMPLATE, airportPage(small, ROUTES, NAMES, AIRLINES, es))).not.toContain(
      '<link rel="alternate"',
    );
  });
});

describe("sitemapXml", () => {
  it("lists each route in every language with its date and its alternates", () => {
    const xml = sitemapXml([{ route: "/" }, { route: "/ATL" }], "2026-10-13");
    expect(xml.match(/<url>/g)).toHaveLength(8);
    expect(xml).toContain("<loc>https://flightatlas.io/ATL</loc>");
    expect(xml).toContain("<loc>https://flightatlas.io/es/ATL</loc>");
    expect(xml).toContain("<loc>https://flightatlas.io/fr/</loc>");
    expect(xml).toContain("<lastmod>2026-10-13</lastmod>");
    expect(xml).toContain(
      '<xhtml:link rel="alternate" hreflang="pt-BR" href="https://flightatlas.io/pt/ATL"/>',
    );
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
  });

  it("lists an English-only route once, without alternates", () => {
    const xml = sitemapXml([{ route: "/docs", locales: ["en"] }], "2026-10-13");
    expect(xml.match(/<url>/g)).toHaveLength(1);
    expect(xml).not.toContain("xhtml:link");
  });
});

describe("airportPage", () => {
  it("uses the singular for one destination", () => {
    const page = airportPage({ ...ATL, properties: { ...ATL.properties, destinations: 1 } });
    expect(page.summary).toBe(
      "Hartsfield–Jackson Atlanta International Airport has direct flights to 1 destination.",
    );
  });
});

describe("legsOf", () => {
  it("makes a row per airline and drops the seasonal or charter marker", () => {
    expect(legsOf([["ATL", "BOS", ["DL", "AA:s"]]])).toEqual([
      ["DL", "ATL", "BOS"],
      ["AA", "ATL", "BOS"],
    ]);
  });
});
