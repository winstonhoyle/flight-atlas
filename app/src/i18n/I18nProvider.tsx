import { useEffect, useMemo, type ReactNode } from "react";
import { I18nContext } from "./context";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import pt from "./locales/pt.json";
import { translator, type Catalog, type Locale } from "./translate";

const CATALOGS: Record<Locale, Catalog> = { en: {}, es, fr, pt };

export const I18nProvider = ({ locale, children }: { locale: Locale; children: ReactNode }) => {
  const value = useMemo(() => translator(CATALOGS[locale], locale), [locale]);
  useEffect(() => {
    document.documentElement.lang = value.tag;
  }, [value]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};
