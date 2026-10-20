import { describe, expect, it } from "vitest";
import { airlinePage, airportPage, errorsPage, renderPage, sitemapXml } from "./pages.js";

const TEMPLATE = `<html><head>
<title>Flight Atlas</title>
<meta name="description" content="Home" />
<link rel="canonical" href="https://flightatlas.io/" />
<meta property="og:title" content="Home" />
<meta property="og:description" content="Home" />
<meta property="og:url" content="https://flightatlas.io/" />
<script type="application/ld+json">{"@type": "WebSite"}</script>
</head><body><div id="root"></div><script type="module" src="/assets/index.js"></script></body></html>`;

const ATL = {
  properties: {
    IATA: "ATL",
    Name: "Hartsfield–Jackson Atlanta International Airport",
    destinations: 248,
  },
  geometry: { coordinates: [-84.42806, 33.63667] },
};

describe("renderPage", () => {
  it("gives an airport page its own head tags, structured data, and summary", () => {
    const html = renderPage(TEMPLATE, airportPage(ATL));

    expect(html).toContain("<title>ATL direct flights | Flight Atlas</title>");
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
      "<title>A&amp;B &quot;Air&quot; &lt;script&gt;&lt;/script&gt; routes | Flight Atlas</title>",
    );
    expect(html).not.toContain("<script></script>");
    expect(html).toContain("<\\/script>");
  });

  it("fails loudly when the template is missing a tag it fills in", () => {
    expect(() => renderPage("<html></html>", airportPage(ATL))).toThrow("Template is missing");
  });
});

describe("sitemapXml", () => {
  it("lists every URL with its date", () => {
    const xml = sitemapXml(["https://flightatlas.io/", "https://flightatlas.io/ATL"], "2026-10-13");
    expect(xml.match(/<url>/g)).toHaveLength(2);
    expect(xml).toContain("<loc>https://flightatlas.io/ATL</loc>");
    expect(xml).toContain("<lastmod>2026-10-13</lastmod>");
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
