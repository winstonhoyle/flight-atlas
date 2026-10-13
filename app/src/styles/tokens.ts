const cache = new Map<string, string>();

/**
 * Resolves a CSS custom property from tokens.css to its value. Leaflet paints on canvas and
 * SVG attributes, where var() doesn't work, so map code reads colors through this.
 */
export const tokenValue = (name: `--${string}`): string => {
  let value = cache.get(name);
  if (value === undefined) {
    value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (value) cache.set(name, value);
  }
  return value;
};
