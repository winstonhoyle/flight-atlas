export const sanitizeIATA = (str) => str.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
