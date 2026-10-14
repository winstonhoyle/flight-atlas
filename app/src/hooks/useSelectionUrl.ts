import { useEffect, useEffectEvent, useRef } from "react";
import {
  buildSelectionPath,
  parseSelectionPath,
  selectionTitle,
  type Selection,
} from "@/utils/selectionPath";

const SITE_URL = "https://flightatlas.io";

type Options = {
  /** True once the airports and airlines the URL refers to have loaded. */
  ready: boolean;
  selection: Selection;
  /** Drops codes that don't exist in the loaded data. */
  resolve: (selection: Selection) => Selection;
  apply: (selection: Selection) => void;
  airlineName?: string;
};

/**
 * Keeps the selection and the URL in step: the URL is read once the data loads and again
 * on Back/Forward, and each new selection pushes a history entry.
 */
export const useSelectionUrl = ({ ready, selection, resolve, apply, airlineName }: Options) => {
  const appliedRef = useRef(false);

  const applyLocation = useEffectEvent(() => {
    const wanted = resolve(parseSelectionPath(window.location.pathname));
    apply(wanted);
    const path = buildSelectionPath(wanted);
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
    const path = buildSelectionPath({ airport, destination, airline });
    if (path !== window.location.pathname) window.history.pushState(null, "", path);
  }, [airport, destination, airline]);

  useEffect(() => {
    const current = { airport, destination, airline };
    document.title = selectionTitle(current, airlineName);
    document
      .querySelector('link[rel="canonical"]')
      ?.setAttribute("href", `${SITE_URL}${buildSelectionPath(current)}`);
  }, [airport, destination, airline, airlineName]);
};
