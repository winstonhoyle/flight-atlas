import { useEffect, useEffectEvent, useRef } from "react";
import { useI18n } from "@/i18n/context";
import { SITE_URL, alternates } from "@/i18n/translate";
import {
  buildSelectionPath,
  parseSelectionPath,
  selectionTitle,
  type Selection,
} from "@/utils/selectionPath";

type Options = {
  ready: boolean;
  selection: Selection;
  resolve: (selection: Selection) => Selection;
  apply: (selection: Selection) => void;
  airlineName?: string;
  airportCity?: string;
};

export const useSelectionUrl = ({
  ready,
  selection,
  resolve,
  apply,
  airlineName,
  airportCity,
}: Options) => {
  const appliedRef = useRef(false);
  const { t, href } = useI18n();

  const applyLocation = useEffectEvent(() => {
    const wanted = resolve(parseSelectionPath(window.location.pathname));
    apply(wanted);
    const path = href(buildSelectionPath(wanted));
    if (path !== window.location.pathname) window.history.replaceState(null, "", path);
  });

  useEffect(() => {
    if (!ready || appliedRef.current) return;
    appliedRef.current = true;
    applyLocation();
  }, [ready]);

  useEffect(() => {
    const onPopState = () => applyLocation();
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const { airport, destination, airline } = selection;

  useEffect(() => {
    if (!appliedRef.current) return;
    const path = href(buildSelectionPath({ airport, destination, airline }));
    if (path !== window.location.pathname) window.history.pushState(null, "", path);
  }, [airport, destination, airline, href]);

  useEffect(() => {
    const current = { airport, destination, airline };
    const path = buildSelectionPath(current);
    document.title = selectionTitle(t, current, airlineName, airportCity);
    document
      .querySelector('link[rel="canonical"]')
      ?.setAttribute("href", `${SITE_URL}${href(path)}`);
    for (const { hreflang, href: alternate } of alternates(path)) {
      document
        .querySelector(`link[rel="alternate"][hreflang="${hreflang}"]`)
        ?.setAttribute("href", alternate);
    }
  }, [airport, destination, airline, airlineName, airportCity, t, href]);
};
