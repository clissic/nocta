const apiKey = import.meta.env.VITE_CARTO_BASEMAPS_API_KEY?.trim();

export const CARTO_DARK_TILE_URL =
  `https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png` +
  (apiKey ? `?key=${encodeURIComponent(apiKey)}` : "");

export const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
