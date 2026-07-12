// Laufzeit-Konfiguration des Frontends. Bewusst gekapselt, damit sich API und
// Basemap ohne Code-Änderung umstellen lassen (Env-Vars beim Astro-Build).

// atmrOS-API (Vektor-Tiles + Objekt-Panel).
export const API_BASE: string =
  import.meta.env.PUBLIC_API_BASE ?? "http://localhost:8000";

// Basemap-Style. Platzhalter: CARTO dark-matter (dunkel, kein Token nötig).
// Zum Selbst-Hosten später schlicht PUBLIC_BASEMAP_STYLE auf die eigene
// style.json (z.B. auf BunnyCDN) setzen — hier ändert sich nichts.
export const BASEMAP_STYLE: string =
  import.meta.env.PUBLIC_BASEMAP_STYLE ??
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

// Startausschnitt: Bayern.
export const START_CENTER: [number, number] = [11.4, 48.9];
export const START_ZOOM = 7;
