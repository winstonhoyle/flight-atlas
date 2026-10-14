const cache = new Map<string, string>();

/** Leaflet paints on canvas and SVG attributes, where var() doesn't work. */
export const tokenValue = (name: `--${string}`): string => {
  let value = cache.get(name);
  if (value === undefined) {
    value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (value) cache.set(name, value);
  }
  return value;
};
