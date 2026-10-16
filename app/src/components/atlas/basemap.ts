import { fromLonLat } from "ol/proj";

export const DEFAULT_CENTER = fromLonLat([-98.5795, 39.8283]); // center of continental US
export const DEFAULT_ZOOM = 4;
export const MAX_ZOOM = 10;

export const TILE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}";
export const ATTRIBUTION =
  'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ | Route data from <a href="https://en.wikipedia.org/" target="_blank" rel="noopener noreferrer">Wikipedia</a> (<a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>)';
