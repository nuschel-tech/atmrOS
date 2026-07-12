// Laufzeit-Konfiguration des Frontends. Bewusst gekapselt, damit sich API und
// Basemap ohne Code-Änderung umstellen lassen (Env-Vars beim Astro-Build).

// atmrOS-API (Vektor-Tiles + Objekt-Panel).
export const API_BASE: string =
  import.meta.env.PUBLIC_API_BASE ?? "http://localhost:8000";

// Basemap-Style-JSON. Selbst gehostet im Repo (web/public/basemap/style.json),
// dunkel/entsättigt/minimal. map.ts injiziert die pmtiles- und Glyph-URLs.
export const BASEMAP_STYLE_URL: string =
  import.meta.env.PUBLIC_BASEMAP_STYLE ?? "/basemap/style.json";

// Selbst gehostete Protomaps-Basemap als .pmtiles (z.B. auf BunnyCDN).
// Leer => nur dunkler Hintergrund (Punkte bleiben sichtbar). Siehe docs/BASEMAP.md.
export const PMTILES_URL: string = import.meta.env.PUBLIC_PMTILES_URL ?? "";

// Glyphs (Schrift-Stacks als .pbf) fürs Beschriften — ebenfalls selbst gehostet.
// Leer => Karte rendert ohne Labels (kein harter Fehler).
export const GLYPHS_URL: string = import.meta.env.PUBLIC_GLYPHS_URL ?? "";

// Startausschnitt: Bayern.
export const START_CENTER: [number, number] = [11.4, 48.9];
export const START_ZOOM = 7;
