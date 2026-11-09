import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { I18nProvider } from "./i18n/I18nProvider";
import { localeOf } from "./i18n/translate";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider locale={localeOf(window.location.pathname)}>
      <App />
    </I18nProvider>
  </StrictMode>,
);
