// Shared by the app and by scripts/build-pages.js, so it is plain JS.

export const LOCALES = ["en", "es", "fr", "pt"];
export const DEFAULT_LOCALE = "en";

export const SITE_URL = "https://flightatlas.io";

/**
 * The BCP 47 tag of each language, for `lang`, hreflang, and date and plural rules: Latin American
 * Spanish, Canadian French and Brazilian Portuguese. The Americas are the audience.
 */
export const LOCALE_TAGS = { en: "en", es: "es-419", fr: "fr-CA", pt: "pt-BR" };

/** Open Graph's own spelling of each language, for link previews. */
export const OG_LOCALES = { en: "en_US", es: "es_LA", fr: "fr_CA", pt: "pt_BR" };

/** The language names, each in its own language. */
export const LOCALE_NAMES = { en: "English", es: "Español", fr: "Français", pt: "Português" };

/** The locale a path starts with (`/es/ATL`), or the default for `/ATL`. */
export const localeOf = (pathname) => {
  const first = pathname.split("/")[1] ?? "";
  return LOCALES.includes(first) && first !== DEFAULT_LOCALE ? first : DEFAULT_LOCALE;
};

/** The tag for the language a path is in. */
export const tagOf = (pathname) => LOCALE_TAGS[localeOf(pathname)];

/** The path without its locale prefix: `/es/ATL` is `/ATL`, `/es/` is `/`. */
export const stripLocale = (pathname) => {
  const prefix = `/${localeOf(pathname)}`;
  if (prefix === `/${DEFAULT_LOCALE}` && !pathname.startsWith(prefix + "/")) return pathname;
  return pathname.startsWith(prefix) ? pathname.slice(prefix.length) || "/" : pathname;
};

/** `/ATL` in a locale: `/es/ATL`. The default locale has no prefix. */
export const withLocale = (pathname, locale) =>
  locale === DEFAULT_LOCALE ? pathname : `/${locale}${pathname === "/" ? "/" : pathname}`;

/** A route in every language it has, for hreflang tags and the sitemap; the default language is also `x-default`. */
export const alternates = (route, locales = LOCALES) => [
  ...locales.map((l) => ({ hreflang: LOCALE_TAGS[l], href: `${SITE_URL}${withLocale(route, l)}` })),
  { hreflang: "x-default", href: `${SITE_URL}${withLocale(route, DEFAULT_LOCALE)}` },
];

const interpolate = (text, vars) =>
  text.replace(/\{(\w+)\}/g, (whole, name) => (vars && name in vars ? String(vars[name]) : whole));

/**
 * `catalog` maps an English message to its translation: a string, or [one, other] for a plural.
 * A message with no translation reads as its English text.
 */
export const translator = (catalog, locale = DEFAULT_LOCALE) => {
  const plurals = new Intl.PluralRules(LOCALE_TAGS[locale]);
  return {
    locale,
    tag: LOCALE_TAGS[locale],
    /** A site path in this locale: `/ATL` is `/es/ATL` in Spanish. */
    href: (path) => withLocale(path, locale),
    t: (message, vars) => interpolate(catalog[message] || message, vars),
    tn: (singular, plural, n, vars) => {
      const index = plurals.select(n) === "one" ? 0 : 1;
      const text = catalog[singular]?.[index] || [singular, plural][index];
      return interpolate(text, { n, ...vars });
    },
  };
};
