import { describe, expect, it } from "vitest";
import { catalogProblems, extractMessages } from "./i18n.js";

describe("extractMessages", () => {
  it("reads t and tn calls in every quote style, over several lines", () => {
    const found = extractMessages(`
      t("Back to the map");
      t('Isn\\'t on the map');
      t(\`Search for an airport\`, { a: 1 });
      tn("{n} destination",
         "{n} destinations", n);
      split("x"); it("ignored"); format("also ignored"); obj.t("not this");
      i18n.t("From the translator"); i18n.tn("{n} page", "{n} pages", n);
    `);
    expect([...found]).toEqual([
      ["{n} destination", "{n} destinations"],
      ["{n} page", "{n} pages"],
      ["Back to the map", null],
      ["Isn't on the map", null],
      ["Search for an airport", null],
      ["From the translator", null],
    ]);
  });
});

describe("catalogProblems", () => {
  const messages = new Map([
    ["Back", null],
    ["{n} route", "{n} routes"],
    ["Data from {month}", null],
  ]);

  it("passes a complete catalog", () => {
    const es = {
      Back: "Volver",
      "{n} route": ["{n} ruta", "{n} rutas"],
      "Data from {month}": "Datos de {month}",
    };
    expect(catalogProblems(messages, { es })).toEqual([]);
  });

  it("finds missing, empty, stale, plural and placeholder problems", () => {
    const es = { Back: "", "{n} route": "{n} ruta", "Data from {month}": "Datos", Old: "Viejo" };
    expect(catalogProblems(messages, { es })).toEqual([
      'es: untranslated "Back"',
      'es: "{n} route" needs two forms, one and other',
      'es: "Data from {month}" has different {placeholders}',
      'es: stale "Old"',
    ]);
  });
});
