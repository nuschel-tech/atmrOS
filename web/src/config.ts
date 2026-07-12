// Laufzeit-Konfiguration des Frontends. Bewusst gekapselt, damit sich API und
// Basemap ohne Code-Änderung umstellen lassen (Env-Vars beim Astro-Build).

// atmrOS-API (Vektor-Tiles + Objekt-Panel).
export const API_BASE: string =
  import.meta.env.PUBLIC_API_BASE ?? "http://localhost:8000";

// Basemap-Style-JSON. Selbst gehostet im Repo (web/public/basemap/style.json),
// dunkel/entsättigt/minimal. map.ts injiziert die pmtiles- und Glyph-URLs.
export const BASEMAP_STYLE_URL: string =
  import.meta.env.PUBLIC_BASEMAP_STYLE ?? "/basemap/style.json";

// Selbst gehostete Protomaps-Basemap als .pmtiles (MultaEnhavo-CDN).
// Leer => nur dunkler Hintergrund (Punkte bleiben sichtbar). Siehe docs/BASEMAP.md.
export const PMTILES_URL: string =
  import.meta.env.PUBLIC_PMTILES_URL ??
  "https://static.multaenhavo.com/atmros/basemap/bayern-basemap.pmtiles";

// Glyphs (Schrift-Stacks als .pbf) fürs Beschriften — ebenfalls selbst gehostet.
// {fontstack}/{range} setzt MapLibre ein (z.B. "Noto Sans Regular"/"0-255").
export const GLYPHS_URL: string =
  import.meta.env.PUBLIC_GLYPHS_URL ??
  "https://static.multaenhavo.com/atmros/fonts/{fontstack}/{range}.pbf";

// Startausschnitt: Bayern.
export const START_CENTER: [number, number] = [11.4, 48.9];
export const START_ZOOM = 7;
