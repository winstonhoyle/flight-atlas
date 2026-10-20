import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import type { Connect, Plugin } from "vite";

// Cloudflare Pages serves public/docs.html at /docs; do the same locally.
const docsUrl: Connect.NextHandleFunction = (req, _res, next) => {
  if (req.url?.split("?")[0] === "/docs") req.url = req.url.replace("/docs", "/docs.html");
  next();
};
const cleanDocsUrl: Plugin = {
  name: "clean-docs-url",
  configureServer: (server) => void server.middlewares.use(docsUrl),
  configurePreviewServer: (server) => void server.middlewares.use(docsUrl),
};

export default defineConfig({
  plugins: [react(), cleanDocsUrl],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    port: 3000,
    // File events from Windows drives don't reach WSL, so poll there.
    watch: { usePolling: __dirname.startsWith("/mnt/") },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
