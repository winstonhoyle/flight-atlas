import { createContext, useContext } from "react";
import { translator, type Translator } from "./translate";

/** English until a provider says otherwise, so components work in tests without one. */
export const I18nContext = createContext<Translator>(translator({}));

export const useI18n = () => useContext(I18nContext);
