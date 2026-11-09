export type Locale = "en" | "es" | "fr" | "pt";
export type Catalog = Record<string, string | string[]>;
export type Vars = Record<string, string | number>;
export type Translator = {
  locale: Locale;
  /** The BCP 47 tag, such as `es-419`, for `lang` and Intl. */
  tag: string;
  /** A site path in this locale: `/ATL` is `/es/ATL` in Spanish. */
  href: (path: string) => string;
  /** The English message in this locale; `{name}` is replaced from `vars`. */
  t: (message: string, vars?: Vars) => string;
  /** The singular or plural message for `n`; `{n}` is the count. */
  tn: (singular: string, plural: string, n: number, vars?: Vars) => string;
};

export type Translate = Translator["t"];

export const SITE_URL: string;
export const LOCALE_TAGS: Record<Locale, string>;
export const OG_LOCALES: Record<Locale, string>;
export const tagOf: (pathname: string) => string;
export const alternates: (
  route: string,
  locales?: Locale[],
) => { hreflang: string; href: string }[];
export const LOCALES: Locale[];
export const DEFAULT_LOCALE: Locale;
export const LOCALE_NAMES: Record<Locale, string>;
export const localeOf: (pathname: string) => Locale;
export const stripLocale: (pathname: string) => string;
export const withLocale: (pathname: string, locale: Locale) => string;
export const translator: (catalog: Catalog, locale?: Locale) => Translator;
