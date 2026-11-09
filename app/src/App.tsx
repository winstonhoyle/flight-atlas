import { MapComponent } from "@/components/atlas/MapComponent";
import { ErrorsPage } from "@/components/errors/ErrorsPage";
import { stripLocale } from "@/i18n/translate";

function App() {
  return stripLocale(window.location.pathname).replace(/\/+$/, "") === "/errors" ? (
    <ErrorsPage />
  ) : (
    <MapComponent />
  );
}

export default App;
