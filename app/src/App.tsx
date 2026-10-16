import { MapComponent } from "@/components/atlas/MapComponent";
import { ErrorsPage } from "@/components/errors/ErrorsPage";

function App() {
  return window.location.pathname.replace(/\/+$/, "") === "/errors" ? (
    <ErrorsPage />
  ) : (
    <MapComponent />
  );
}

export default App;
