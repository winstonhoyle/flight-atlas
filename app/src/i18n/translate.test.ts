import { describe, expect, it } from "vitest";
import { alternates, localeOf, stripLocale, tagOf, translator, withLocale } from "./translate";

describe("locale paths", () => {
  it("reads the locale from the first path segment", () => {
    expect(localeOf("/es/ATL")).toBe("es");
    expect(localeOf("/fr/")).toBe("fr");
    expect(localeOf("/ATL")).toBe("en");
    expect(localeOf("/pt")).toBe("pt");
    expect(localeOf("/en/ATL")).toBe("en");
    expect(localeOf("/")).toBe("en");
  });

  it("strips and adds the prefix", () => {
    expect(stripLocale("/es/ATL/DFW")).toBe("/ATL/DFW");
    expect(stripLocale("/es/")).toBe("/");
    expect(stripLocale("/es")).toBe("/");
    expect(stripLocale("/ATL")).toBe("/ATL");
    expect(withLocale("/ATL", "es")).toBe("/es/ATL");
    expect(withLocale("/", "fr")).toBe("/fr/");
    expect(withLocale("/ATL", "en")).toBe("/ATL");
  });
});

describe("language tags", () => {
  it("uses Latin American Spanish, Canadian French and Brazilian Portuguese", () => {
    expect(tagOf("/es/ATL")).toBe("es-419");
    expect(tagOf("/fr/")).toBe("fr-CA");
    expect(tagOf("/pt/airline/DL")).toBe("pt-BR");
    expect(tagOf("/ATL")).toBe("en");
  });

  it("names each language's tag in its alternates, with English as the default", () => {
    expect(alternates("/ATL").map((a) => a.hreflang)).toEqual([
      "en",
      "es-419",
      "fr-CA",
      "pt-BR",
      "x-default",
    ]);
    expect(alternates("/ATL")[1].href).toBe("https://flightatlas.io/es/ATL");
    expect(alternates("/ATL").at(-1)?.href).toBe("https://flightatlas.io/ATL");
  });
});

describe("translator", () => {
  const es = translator(
    { "Back to the map": "Volver al mapa", "{n} destination": ["{n} destino", "{n} destinos"] },
    "es",
  );

  it("translates, fills placeholders, and falls back to English", () => {
    expect(es.t("Back to the map")).toBe("Volver al mapa");
    expect(es.t("Data from {month}", { month: "May" })).toBe("Data from May");
    expect(es.t("Missing")).toBe("Missing");
  });

  it("picks the plural form of the language", () => {
    expect(es.tn("{n} destination", "{n} destinations", 1)).toBe("1 destino");
    expect(es.tn("{n} destination", "{n} destinations", 5)).toBe("5 destinos");
    expect(es.tn("{n} airport", "{n} airports", 2)).toBe("2 airports");
  });

  it("treats 0 as singular in French", () => {
    const fr = translator({ "{n} problem": ["{n} problème", "{n} problèmes"] }, "fr");
    expect(fr.tn("{n} problem", "{n} problems", 0)).toBe("0 problème");
    expect(fr.tn("{n} problem", "{n} problems", 2)).toBe("2 problèmes");
  });
});
