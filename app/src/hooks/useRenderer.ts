import { useCallback, useState } from "react";
import { canWebGL, type Renderer } from "@/utils/renderer";

const KEY = "renderer";

/** The saved drawing choice. GPU drawing is opt-in, and falls back to canvas where WebGL isn't available. */
export const useRenderer = () => {
  const [renderer, setRenderer] = useState<Renderer>(() => {
    try {
      return localStorage.getItem(KEY) === "webgl" && canWebGL() ? "webgl" : "canvas";
    } catch {
      return "canvas";
    }
  });

  const choose = useCallback((next: Renderer) => {
    setRenderer(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Private windows can refuse storage; the choice still holds for this visit.
    }
  }, []);

  return [renderer, choose] as const;
};
