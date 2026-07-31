// ZEIGEN — dunkle MapLibre-Karte, Objekt-Layer aus den atmrOS-Vektor-Tiles,
// Klick -> Profiler-Panel mit Attributen + Quelle. Legende mit Kategorie- und
// Untertyp-Filtern (Ehrlichkeit: Kirchturm != Sendemast).

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Protocol } from "pmtiles";

import {
  API_BASE,
  BASEMAP_STYLE_URL,
  GLYPHS_URL,
  PMTILES_URL,
  START_CENTER,
  START_ZOOM,
} from "../config";
import {
  ACCENT,
  CATEGORIES,
  CATEGORY_BY_ID,
  EVENT_META,
  REFINED,
  SOURCES,
  categoryColorExpression,
  curatedLabel,
  eventColorExpression,
  subtypeLabel,
} from "./categories";
import { M3 } from "./categories";

const SRC = "atmros-infra";
const LAYER = "infra-points";
const LAYER_SEL = "infra-selected";
const CHG_SRC = "atmros-changes";
const CHG_LAYER = "changes-highlight";

interface ChangeItem {
  osm_type: string;
  osm_id: number;
  event_type: string;
  observed_at: string;
  category: string;
  subtype: string | null;
  lon: number;
  lat: number;
  diff: Record<string, unknown> | null;
}

interface StatsResponse {
  by_category: Record<string, number>;
  by_subtype: Record<string, Record<string, number>>;
  latest_observed_at: string | null;
  by_source?: Record<string, string>; // observation.source -> Stand (ISO)
}

interface ObjectDetail {
  osm_type: string;
  osm_id: number;
  category: string;
  subtype: string | null;
  first_seen: string;
  last_seen: string;
  lon: number;
  lat: number;
  osm_url: string;
  current: {
    observed_at: string;
    source: string;
    source_url: string;
    attrs: Record<string, string>;
  } | null;
  history: { observed_at: string; attr_hash: string; source: string }[];
}

// --- Filter-Zustand ---------------------------------------------------------
const hiddenSources = new Set<string>();
const hiddenCategories = new Set<string>();
const hiddenSubtypes = new Set<string>(); // Schlüssel: `${category}::${subVal}`
let selected: { type: string; id: number } | null = null;
let map: maplibregl.Map;

// Quelle aus -> alle ihre Kategorien wirken ausgeblendet, OHNE die
// Einzel-Auswahl des Nutzers zu überschreiben (Quelle an -> Auswahl wie vorher).
function effectiveHiddenCategories(): Set<string> {
  const out = new Set(hiddenCategories);
  for (const src of SOURCES) {
    if (!hiddenSources.has(src.id)) continue;
    for (const cat of src.categories) out.add(cat);
  }
  return out;
}

// --- Daten-Version (Cache-Busting fürs "neuer Stand"-Update) ----------------
// Die Tile-URL trägt ?v=<Stand>. Ändert sich der Stand (nach einem Ingest),
// wechselt die URL -> MapLibre lädt die Tiles frisch, ohne Seiten-Reload und
// ohne den 1-Stunden-Cache auszuhebeln.
let dataVersion = "";
let latestStats: StatsResponse | null = null;
let pollTimer: number | undefined;
const POLL_MS = 120_000; // alle 2 Min: Ingest-Status + neuer Stand prüfen

const subKey = (cat: string, sub: string): string => `${cat}::${sub}`;

function tileUrl(version: string): string {
  const v = version ? `?v=${encodeURIComponent(version)}` : "";
  return `${API_BASE}/tiles/{z}/{x}/{y}.pbf${v}`;
}

// Dunkler Notfall-Style, falls keine pmtiles-URL gesetzt ist oder das
// Style-JSON nicht lädt — die Objekt-Punkte bleiben auf dunklem Grund sichtbar.
function fallbackStyle(): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {},
    layers: [{ id: "background", type: "background", paint: { "background-color": M3.surface } }],
  };
}

// Theme folgt dem OS: heller Basemap-Style bei Light-Präferenz. Bei einem
// OS-Wechsel zur Laufzeit lädt die Seite neu (seltenes Ereignis; ein
// setStyle-Umbau müsste alle eigenen Layer neu aufbauen — nicht wert).
const PREFERS_LIGHT =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-color-scheme: light)").matches;

function basemapStyleUrl(): string {
  return PREFERS_LIGHT
    ? BASEMAP_STYLE_URL.replace(/style\.json$/, "style-light.json")
    : BASEMAP_STYLE_URL;
}

// Selbst gehostete Protomaps-Basemap laden und die pmtiles-/Glyph-URLs
// injizieren. Ohne Glyphs werden Label-Layer entfernt (kein harter Fehler).
async function loadBasemapStyle(): Promise<maplibregl.StyleSpecification> {
  if (!PMTILES_URL) return fallbackStyle();
  try {
    const res = await fetch(basemapStyleUrl());
    if (!res.ok) return fallbackStyle();
    const style = (await res.json()) as maplibregl.StyleSpecification & {
      sources: Record<string, { url?: string }>;
      glyphs?: string;
    };
    style.sources.protomaps.url = `pmtiles://${PMTILES_URL}`;
    if (GLYPHS_URL) {
      style.glyphs = GLYPHS_URL;
    } else {
      delete style.glyphs;
      style.layers = style.layers.filter((l) => l.type !== "symbol");
    }
    return style;
  } catch {
    return fallbackStyle();
  }
}

// Boot-Overlay ausblenden — idempotent; hartes Timeout stellt sicher, dass die
// Animation nie blockiert (auch wenn Basemap/API lahm sind).
function dismissBoot(): void {
  const el = document.getElementById("boot");
  if (!el || el.classList.contains("done")) return;
  el.classList.add("done");
  el.addEventListener("transitionend", () => el.remove(), { once: true });
  setTimeout(() => el.remove(), 700); // Fallback, falls transitionend ausbleibt
}

export async function initMap(): Promise<void> {
  setTimeout(dismissBoot, 2500); // Boot darf nie länger als 2,5 s stehen

  // pmtiles-Protokoll für MapLibre registrieren (Range-Requests auf die
  // .pmtiles-Datei, z.B. auf BunnyCDN).
  maplibregl.addProtocol("pmtiles", new Protocol().tile);

  // OS wechselt das Farbschema -> sauber neu aufsetzen (Basemap + Paints).
  window.matchMedia?.("(prefers-color-scheme: light)")
    .addEventListener?.("change", () => window.location.reload());

  try {
    map = new maplibregl.Map({
      container: "map",
      style: await loadBasemapStyle(),
      center: START_CENTER,
      zoom: START_ZOOM,
      // Eigene M3-Controls (Zoom+Info-Säule); ODbL-Hinweis als eigene Mini-Zeile
      // + Volltext im Info-Dialog.
      attributionControl: false,
      // Cookie an die (ggf. cross-origin, aber same-site) API mitschicken, damit
      // die Vektor-Tiles hinter dem Gate geladen werden können.
      transformRequest: (url) =>
        url.startsWith(API_BASE) ? { url, credentials: "include" } : { url },
    });
  } catch (e) {
    // Kein WebGL (alte Geräte/Headless): App nicht sterben lassen — Legende,
    // Stats, Änderungsliste und Info-Dialog funktionieren auch ohne Karte.
    console.warn("atmrOS: Karte nicht verfügbar (WebGL?)", e);
    wireMapControls();
    const stats = await fetchStats();
    if (stats) {
      latestStats = stats;
      buildLegend(stats);
      setInfoStand(stats.latest_observed_at);
    }
    startVersionPolling();
    dismissBoot();
    return;
  }
  wireMapControls();

  map.on("load", async () => {
    // Stand zuerst holen -> Tile-URL bekommt ?v=<Stand>, Legende wird gefüllt.
    const stats = await fetchStats();
    if (stats) {
      latestStats = stats;
      dataVersion = stats.latest_observed_at ?? "";
      buildLegend(stats);
      setInfoStand(stats.latest_observed_at);
    }

    map.addSource(SRC, {
      type: "vector",
      tiles: [tileUrl(dataVersion)],
      minzoom: 0,
      maxzoom: 14,
    });

    map.addLayer({
      id: LAYER,
      type: "circle",
      source: SRC,
      "source-layer": "infra",
      paint: {
        "circle-color": categoryColorExpression() as maplibregl.DataDrivenPropertyValueSpecification<string>,
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 1.6, 10, 3, 14, 5],
        "circle-opacity": 0.85,
        "circle-stroke-width": 0.4,
        "circle-stroke-color": "#000000",
      },
    });

    map.addLayer({
      id: LAYER_SEL,
      type: "circle",
      source: SRC,
      "source-layer": "infra",
      filter: ["==", ["get", "osm_id"], -1],
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 4, 10, 7, 14, 10],
        "circle-color": ACCENT,
        "circle-opacity": 0.25,
        "circle-stroke-width": 1.6,
        "circle-stroke-color": ACCENT,
      },
    });

    // Änderungs-Highlight: leere GeoJSON-Quelle, wird bei Bedarf befüllt.
    map.addSource(CHG_SRC, { type: "geojson", data: emptyFC() });
    map.addLayer({
      id: CHG_LAYER,
      type: "circle",
      source: CHG_SRC,
      layout: { visibility: "none" },
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 5, 10, 9, 14, 13],
        "circle-color": eventColorExpression() as maplibregl.DataDrivenPropertyValueSpecification<string>,
        "circle-opacity": 0.18,
        "circle-stroke-width": 2,
        "circle-stroke-color": eventColorExpression() as maplibregl.DataDrivenPropertyValueSpecification<string>,
      },
    }, LAYER); // unter den Objekt-Punkten

    map.on("click", LAYER, (e) => {
      const f = e.features?.[0];
      if (!f) return;
      selected = { type: String(f.properties?.osm_type), id: Number(f.properties?.osm_id) };
      applyFilters();
      void openPanel(selected.type, selected.id);
    });
    map.on("mouseenter", LAYER, () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", LAYER, () => (map.getCanvas().style.cursor = ""));

    applyFilters();
    startVersionPolling();
    dismissBoot(); // Karte + Stats stehen — Bühne frei
  });

  document.getElementById("panel-close")?.addEventListener("click", () => {
    document.getElementById("panel")?.classList.remove("open");
    selected = null;
    applyFilters();
  });
  document.getElementById("toast-apply")?.addEventListener("click", applyNewVersion);
  document.getElementById("changes-toggle")?.addEventListener("click", toggleChanges);
  document.getElementById("changes-close")?.addEventListener("click", () => setChanges(false));

  wireLegend();
}

// --- Zoom+Info-Controls + Info-Dialog ---------------------------------------
type MdDialog = HTMLElement & { show: () => void; close: () => void };

function wireMapControls(): void {
  document.getElementById("zoom-in")?.addEventListener("click", () => map?.zoomIn());
  document.getElementById("zoom-out")?.addEventListener("click", () => map?.zoomOut());
  const dialog = document.getElementById("info-dialog") as MdDialog | null;
  document.getElementById("info-open")?.addEventListener("click", () => dialog?.show());
  document.getElementById("info-close")?.addEventListener("click", () => dialog?.close());
}

function setInfoStand(iso: string | null): void {
  const el = document.getElementById("info-stand");
  if (el && iso) el.textContent = formatDate(iso);
}

// --- Änderungsansicht -------------------------------------------------------
let changesOn = false;

function emptyFC(): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

function toggleChanges(): void {
  setChanges(!changesOn);
}

function setChanges(on: boolean): void {
  changesOn = on;
  document.getElementById("changes")?.toggleAttribute("hidden", !on);
  document.getElementById("changes-toggle")?.setAttribute("aria-pressed", String(on));
  if (map?.getLayer(CHG_LAYER)) {
    map.setLayoutProperty(CHG_LAYER, "visibility", on ? "visible" : "none");
  }
  if (on) void loadChanges();
}

async function loadChanges(): Promise<void> {
  const list = document.getElementById("changes-list");
  if (list) list.innerHTML = `<div class="spinner">// lade Änderungen …</div>`;
  let data: { count: number; changes: ChangeItem[] };
  try {
    const res = await fetch(`${API_BASE}/changes`, { credentials: "include" });
    if (!res.ok) throw new Error(String(res.status));
    data = (await res.json()) as { count: number; changes: ChangeItem[] };
  } catch {
    if (list) list.innerHTML = `<div class="panel-empty">Änderungen nicht ladbar.</div>`;
    return;
  }

  // Karten-Highlight aus den Änderungen.
  const src = map?.getSource(CHG_SRC) as maplibregl.GeoJSONSource | undefined;
  src?.setData({
    type: "FeatureCollection",
    features: data.changes.map((c) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [c.lon, c.lat] },
      properties: { event_type: c.event_type },
    })),
  });

  // Zähler im Header.
  const badge = document.getElementById("changes-count");
  if (badge) {
    badge.textContent = String(data.count);
    badge.toggleAttribute("hidden", data.count === 0);
  }
  renderChangesList(data.changes);
}

function renderChangesList(changes: ChangeItem[]): void {
  const list = document.getElementById("changes-list");
  if (!list) return;
  if (!changes.length) {
    list.innerHTML = `<div class="panel-empty">Keine Änderungen in den letzten 7 Tagen.</div>`;
    return;
  }
  list.innerHTML = changes
    .map((c, idx) => {
      const ev = EVENT_META[c.event_type] ?? { label: c.event_type, color: ACCENT, cls: "ev-changed" };
      const cat = CATEGORY_BY_ID[c.category];
      const catLabel = cat?.label ?? c.category;
      const sub = c.subtype ? ` · ${escapeHtml(subtypeLabel(c.subtype))}` : "";
      return `<button class="chg-row" data-i="${idx}">
          <span class="chg-badge ${ev.cls}">${escapeHtml(ev.label)}</span>
          <span class="chg-body">
            <span class="chg-cat">${escapeHtml(catLabel)}${sub}</span>
            <span class="chg-when">${formatDate(c.observed_at)} · ${c.osm_type}/${c.osm_id}</span>
          </span>
        </button>`;
    })
    .join("");

  list.querySelectorAll<HTMLElement>(".chg-row").forEach((row) => {
    row.addEventListener("click", () => {
      const c = changes[Number(row.dataset.i)];
      if (!c) return;
      map?.flyTo({ center: [c.lon, c.lat], zoom: Math.max(map.getZoom(), 13) });
      selected = { type: c.osm_type, id: c.osm_id };
      applyFilters();
      void openPanel(c.osm_type, c.osm_id);
    });
  });
}

// --- Polling: Ingest-Status + neuer Stand -----------------------------------
function startVersionPolling(): void {
  if (pollTimer !== undefined) return;
  pollTimer = window.setInterval(() => void poll(), POLL_MS);
}

async function poll(): Promise<void> {
  // "Daten werden aktualisiert"-Banner spiegeln.
  setUpdating((await fetchStatus()) === "running");

  const stats = await fetchStats();
  if (!stats) return;
  const v = stats.latest_observed_at ?? "";
  // Nur melden, wenn wir schon einen Stand kannten und er sich geändert hat.
  if (v && dataVersion && v !== dataVersion) {
    latestStats = stats;
    showToast();
  }
}

async function fetchStatus(): Promise<string> {
  try {
    const res = await fetch(`${API_BASE}/status`, { credentials: "include" });
    if (!res.ok) return "idle";
    return ((await res.json()) as { status?: string }).status ?? "idle";
  } catch {
    return "idle";
  }
}

function setUpdating(on: boolean): void {
  const el = document.getElementById("updating");
  if (!el) return;
  el.toggleAttribute("hidden", !on);
}

function applyNewVersion(): void {
  if (!latestStats) return;
  dataVersion = latestStats.latest_observed_at ?? dataVersion;
  const src = map?.getSource(SRC) as maplibregl.VectorTileSource | undefined;
  src?.setTiles([tileUrl(dataVersion)]); // frische Tiles, kein Reload
  buildLegend(latestStats);              // Legenden-Zahlen aktualisieren
  setInfoStand(latestStats.latest_observed_at);
  hideToast();
}

function showToast(): void {
  document.getElementById("toast")?.removeAttribute("hidden");
}

function hideToast(): void {
  document.getElementById("toast")?.setAttribute("hidden", "");
}

// Sammel-Schlüssel für Features ohne kuratierten Untertyp: keine eigene Zeile
// im Drilldown, aber beim Isolieren ("nur dieser Untertyp") mit ausblendbar.
const SUB_REST = "∅";

// --- Filter -----------------------------------------------------------------
function baseFilter(): maplibregl.FilterSpecification {
  // Untertyp pro Feature (fehlend -> Sammel-Schlüssel), als Komposit-Schlüssel.
  const subVal: unknown = ["case", ["has", "subtype"], ["to-string", ["get", "subtype"]], SUB_REST];
  const composite: unknown = ["concat", ["to-string", ["get", "category"]], "::", subVal];
  return [
    "all",
    ["!", ["in", ["get", "category"], ["literal", [...effectiveHiddenCategories()]]]],
    ["!", ["in", composite, ["literal", [...hiddenSubtypes]]]],
  ] as unknown as maplibregl.FilterSpecification;
}

function applyFilters(): void {
  if (!map) return; // degradierter Modus ohne Karte
  const base = baseFilter();
  map.setFilter(LAYER, base);
  if (selected) {
    map.setFilter(LAYER_SEL, [
      "all",
      base as unknown,
      ["==", ["get", "osm_type"], selected.type],
      ["==", ["get", "osm_id"], selected.id],
    ] as unknown as maplibregl.FilterSpecification);
  } else {
    map.setFilter(LAYER_SEL, ["==", ["get", "osm_id"], -1]);
  }
}

// --- Legende ----------------------------------------------------------------
async function fetchStats(): Promise<StatsResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/stats`, { credentials: "include" });
    if (!res.ok) return null;
    return (await res.json()) as StatsResponse;
  } catch {
    return null; // kein harter Fehler — Legende/Version bleiben wie sie sind
  }
}

// Legende als dreistufiger Drilldown IN derselben Card, kein schwebendes
// Popover: Quellen (die Kern-Signatur als Einstieg) -> Kategorien der Quelle
// (gleich breite Kacheln, Quick-Settings-Muster) -> kuratierte Untertypen.
let legendView: "sources" | "cats" | "subs" = "sources";
let currentSource: string | null = null;
let detailCat: string | null = null;

const de = (n: number): string => n.toLocaleString("de-DE");

const CHEVRON =
  `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">` +
  `<path d="M9.3 6.7a1 1 0 0 1 1.4-1.4l6 6a1 1 0 0 1 0 1.4l-6 6a1 1 0 0 1-1.4-1.4L14.6 12z"/></svg>`;

function showLegendView(view: "sources" | "cats" | "subs"): void {
  document.getElementById("legend-sources")?.toggleAttribute("hidden", view !== "sources");
  document.getElementById("legend-cats")?.toggleAttribute("hidden", view !== "cats");
  document.getElementById("legend-detail")?.toggleAttribute("hidden", view !== "subs");
  legendView = view;
  if (view !== "subs") detailCat = null;
  if (view === "sources") currentSource = null;
}

// --- Ansicht 0: Quellen ------------------------------------------------------
function buildSources(stats: StatsResponse): void {
  const host = document.getElementById("legend-sources");
  if (!host) return;
  const fmtStand = (iso: string | null | undefined): string | null =>
    iso ? new Date(iso).toLocaleDateString("de-DE",
      { day: "2-digit", month: "2-digit", year: "numeric" }) : null;
  const rows: string[] = [];
  for (const [i, src] of SOURCES.entries()) {
    const total = src.categories.reduce(
      (acc, cat) => acc + (stats.by_category[cat] ?? 0), 0);
    // Quelle noch ohne Daten (Ingest lief nie) -> ehrlich zeigen, nicht bauen.
    const stand = fmtStand(stats.by_source?.[src.db]);
    const off = hiddenSources.has(src.id);
    rows.push(
      `<div class="src-tile${off ? " off" : ""} m3e-pop" style="--m3e-delay:${i * 35}ms" ` +
      `role="button" tabindex="0" aria-pressed="${!off}" data-src="${src.id}">` +
      `<span class="txt"><span class="lbl">${escapeHtml(src.label)}</span>` +
      `<span class="sub">${escapeHtml(src.sub)}${stand ? ` · Stand ${stand}` : ""}</span></span>` +
      `<span class="count">${de(total)}</span>` +
      `<span class="tile-expand" role="button" tabindex="0" data-expand-src="${src.id}" ` +
      `aria-label="Kategorien von ${escapeAttr(src.label)}">${CHEVRON}</span></div>`,
    );
  }
  host.innerHTML = rows.join("");
}

// --- Ansicht 1: Kategorien EINER Quelle --------------------------------------
function buildLegend(stats: StatsResponse): void {
  buildSources(stats);
  // Grid gehört immer zur gerade geöffneten Quelle.
  if (currentSource) buildGrid(stats, currentSource);
  // Offene Detailansicht mit frischen Zahlen neu aufbauen (Daten-Update).
  if (detailCat) renderDetail(detailCat);
}

function buildGrid(stats: StatsResponse, srcId: string): void {
  const host = document.getElementById("legend-grid");
  if (!host) return;
  const tiles: string[] = [];

  for (const [i, c] of CATEGORIES.filter((c) => c.src === srcId).entries()) {
    const total = stats.by_category[c.id] ?? 0;
    const subs = REFINED.has(c.id) ? stats.by_subtype?.[c.id] : undefined;
    // Drilldown nur, wenn es kuratierte Untertypen zu zeigen gibt.
    const hasSubs = !!subs && Object.keys(subs).some((s) => curatedLabel(s) !== null);
    const off = hiddenCategories.has(c.id);

    const expand = hasSubs
      ? `<span class="tile-expand" role="button" tabindex="0" data-expand="${c.id}" ` +
        `aria-label="Untertypen von ${c.label}">${CHEVRON}</span>`
      : "";

    tiles.push(
      `<div class="cat-tile${off ? " off" : ""} m3e-pop" style="--m3e-delay:${i * 35}ms" ` +
      `role="button" tabindex="0" aria-pressed="${!off}" data-cat="${c.id}">` +
      `<span class="dot" style="background:${c.color}"></span>` +
      `<span class="txt"><span class="lbl">${c.label}</span>` +
      `<span class="count">${de(total)}</span></span>${expand}</div>`,
    );
  }
  host.innerHTML = tiles.join("");
}

function sourceOf(catId: string): string | null {
  return SOURCES.find((s) => s.categories.includes(catId))?.id ?? null;
}

function showCats(srcId: string): void {
  const src = SOURCES.find((s) => s.id === srcId);
  const title = document.getElementById("cats-title");
  if (!src || !title) return;
  currentSource = srcId;
  if (latestStats) buildGrid(latestStats, srcId);
  title.textContent = src.label;
  document.getElementById("legend-cats")
    ?.classList.toggle("src-off", hiddenSources.has(srcId));
  showLegendView("cats");
}

// --- Ansicht 2: Untertypen-Drilldown -----------------------------------------
function renderDetail(catId: string): void {
  const detail = document.getElementById("legend-detail");
  const list = document.getElementById("subs-list");
  const title = document.getElementById("detail-title");
  const dot = document.getElementById("detail-dot");
  const subs = latestStats?.by_subtype?.[catId];
  const cat = CATEGORY_BY_ID[catId];
  if (!detail || !list || !title || !dot || !subs || !cat) return;

  title.textContent = cat.label;
  (dot as HTMLElement).style.background = cat.color;

  // Nur kuratierte Untertypen (Ingest normalisiert auf kanonische IDs) — kein
  // "(ohne Angabe)", keine Sammelzeile. Der Rest zählt in der Kachel-Summe mit
  // und folgt dem Kategorie-Schalter als Ganzes.
  const ordered = Object.entries(subs)
    .filter(([sub]) => curatedLabel(sub) !== null)
    .sort((a, b) => b[1] - a[1]);
  const rows: string[] = [];
  for (const [sub, n] of ordered) {
    const off = hiddenSubtypes.has(subKey(catId, sub));
    rows.push(
      `<div class="lg-sub${off ? " off" : ""}" data-cat="${catId}" data-sub="${escapeAttr(sub)}" role="button" tabindex="0">
         <span class="lbl">${escapeHtml(curatedLabel(sub)!)}</span>
         <span class="count">${de(n)}</span>
       </div>`,
    );
  }
  list.innerHTML = rows.join("");
  detail.classList.toggle("cat-off", effectiveHiddenCategories().has(catId));
  showLegendView("subs");
  detailCat = catId;
}

function tileOf(catId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`.cat-tile[data-cat="${catId}"]`);
}

function wireLegend(): void {
  const srcHost = document.getElementById("legend-sources");
  const host = document.getElementById("legend-grid");
  const list = document.getElementById("subs-list");
  if (!srcHost || !host || !list) return;

  // Nach Set-Änderungen alles aus dem Zustand neu zeichnen — eine Wahrheit,
  // kein Klassen-Gefummel über drei Ansichten hinweg.
  const refresh = (): void => {
    if (latestStats) buildLegend(latestStats);
    if (currentSource) {
      document.getElementById("legend-cats")
        ?.classList.toggle("src-off", hiddenSources.has(currentSource));
    }
    applyFilters();
  };

  const onSourceArea = (target: HTMLElement): void => {
    // 1) Pfeil: reinschauen, was die Quelle liefert — NICHT umschalten.
    const expand = target.closest<HTMLElement>("[data-expand-src]");
    if (expand) {
      showCats(expand.dataset.expandSrc!);
      return;
    }
    // 2) Kachel: ganze Quelle umschalten (Einzel-Auswahl bleibt erhalten).
    const tile = target.closest<HTMLElement>(".src-tile");
    if (tile) {
      const src = tile.dataset.src!;
      toggle(hiddenSources, src, tile);
      tile.setAttribute("aria-pressed", String(!hiddenSources.has(src)));
      applyFilters();
    }
  };

  const onTileArea = (target: HTMLElement): void => {
    // 1) Pfeil: Drilldown öffnen — Kategorie NICHT umschalten.
    const expand = target.closest<HTMLElement>("[data-expand]");
    if (expand) {
      renderDetail(expand.dataset.expand!);
      return;
    }
    const tile = target.closest<HTMLElement>(".cat-tile");
    if (!tile) return;
    const cat = tile.dataset.cat!;
    const src = sourceOf(cat);
    if (src && hiddenSources.has(src)) {
      // Quelle ist aus -> diese Kategorie isolieren: Quelle wieder an,
      // NUR die geklickte Kategorie sichtbar (gleiches Muster wie Untertypen).
      hiddenSources.delete(src);
      const srcDef = SOURCES.find((s) => s.id === src)!;
      for (const c of srcDef.categories) {
        if (c === cat) hiddenCategories.delete(c);
        else hiddenCategories.add(c);
      }
      refresh(); // Zustand über alle Ansichten neu zeichnen
    } else {
      // 2) Kachel: Kategorie umschalten.
      toggle(hiddenCategories, cat, tile);
      tile.setAttribute("aria-pressed", String(!hiddenCategories.has(cat)));
      applyFilters();
    }
  };

  const onSubRow = (target: HTMLElement): void => {
    const row = target.closest<HTMLElement>(".lg-sub");
    if (!row) return;
    const cat = row.dataset.cat!;
    if (effectiveHiddenCategories().has(cat)) {
      // Kategorie (oder ihre Quelle) ist aus -> diesen Untertyp isolieren:
      // Quelle + Kategorie wieder an, NUR die geklickte Zeile sichtbar — alle
      // anderen Zeilen UND der Rest ohne kuratierten Untertyp aus.
      const src = sourceOf(cat);
      if (src) hiddenSources.delete(src);
      hiddenCategories.delete(cat);
      document.getElementById("legend-detail")?.classList.remove("cat-off");
      hiddenSubtypes.add(subKey(cat, SUB_REST));
      for (const r of document.querySelectorAll<HTMLElement>("#subs-list .lg-sub")) {
        const isClicked = r === row;
        const key = subKey(cat, r.dataset.sub!);
        if (isClicked) hiddenSubtypes.delete(key);
        else hiddenSubtypes.add(key);
        r.classList.toggle("off", !isClicked);
      }
      if (latestStats) buildSources(latestStats);
      const tile = tileOf(cat);
      tile?.classList.remove("off");
      tile?.setAttribute("aria-pressed", "true");
    } else {
      toggle(hiddenSubtypes, subKey(cat, row.dataset.sub!), row);
      // Sobald wieder eine Zeile aktiv geschaltet wird, endet die Isolation —
      // der nicht kuratierte Rest kommt mit zurück.
      if (!row.classList.contains("off")) hiddenSubtypes.delete(subKey(cat, SUB_REST));
    }
    applyFilters();
  };

  const keyable = (handler: (t: HTMLElement) => void) => (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handler(e.target as HTMLElement);
    }
  };
  srcHost.addEventListener("click", (e) => onSourceArea(e.target as HTMLElement));
  srcHost.addEventListener("keydown", keyable(onSourceArea));
  host.addEventListener("click", (e) => onTileArea(e.target as HTMLElement));
  host.addEventListener("keydown", keyable(onTileArea));
  list.addEventListener("click", (e) => onSubRow(e.target as HTMLElement));
  list.addEventListener("keydown", keyable(onSubRow));
  document.getElementById("cats-back")?.addEventListener("click", () => showLegendView("sources"));
  document.getElementById("detail-back")?.addEventListener("click", () => {
    if (currentSource) showCats(currentSource);
    else showLegendView("sources");
  });
  // "zurücksetzen" in der Kategorien-Ansicht: alle Kategorie- UND
  // Untertyp-Filter der aktuellen Quelle aufheben.
  document.getElementById("cats-all")?.addEventListener("click", () => {
    const src = SOURCES.find((s) => s.id === currentSource);
    if (!src) return;
    hiddenSources.delete(src.id);
    for (const cat of src.categories) {
      hiddenCategories.delete(cat);
      resetSubtypeKeys(cat);
    }
    refresh();
  });
  document.getElementById("detail-all")?.addEventListener("click", () => {
    if (detailCat) resetSubtypes(detailCat);
  });
}

// Alle Untertyp-Schlüssel einer Kategorie löschen (ohne Neuzeichnen).
function resetSubtypeKeys(cat: string): void {
  for (const key of [...hiddenSubtypes]) {
    if (key.startsWith(`${cat}::`)) hiddenSubtypes.delete(key);
  }
}

// Alle Untertyp-Filter einer Kategorie zurücksetzen (inkl. Isolation/Rest).
function resetSubtypes(cat: string): void {
  resetSubtypeKeys(cat);
  for (const r of document.querySelectorAll<HTMLElement>("#subs-list .lg-sub")) {
    r.classList.remove("off");
  }
  applyFilters();
}

function toggle(set: Set<string>, key: string, row: HTMLElement): void {
  if (set.has(key)) {
    set.delete(key);
    row.classList.remove("off");
  } else {
    set.add(key);
    row.classList.add("off");
  }
}

// --- Profiler-Panel ---------------------------------------------------------
async function openPanel(osmType: string, osmId: number): Promise<void> {
  const panel = document.getElementById("panel");
  const body = document.getElementById("panel-body");
  const head = document.getElementById("panel-head-content");
  if (!panel || !body || !head) return;

  panel.classList.add("open");
  body.innerHTML = `<div class="spinner">// lade Objekt ${osmType}/${osmId} …</div>`;
  head.innerHTML = "";

  try {
    const res = await fetch(`${API_BASE}/object/${osmType}/${osmId}`, { credentials: "include" });
    if (!res.ok) throw new Error(String(res.status));
    renderPanel(head, body, (await res.json()) as ObjectDetail);
  } catch {
    body.innerHTML = `<div class="panel-empty">Objekt nicht ladbar.</div>`;
  }
}

function renderPanel(head: HTMLElement, body: HTMLElement, obj: ObjectDetail): void {
  const cat = CATEGORY_BY_ID[obj.category];
  const color = cat?.color ?? "#666";
  const label = cat?.label ?? obj.category;
  const subLabel = obj.subtype ? subtypeLabel(obj.subtype) : null;

  head.innerHTML = `
    <span class="cat-dot" style="background:${color}"></span>
    <div class="title">
      <div class="cat">${escapeHtml(label)}</div>
      <div class="id">${obj.osm_type}/${obj.osm_id}${subLabel ? ` · <span class="sub">${escapeHtml(subLabel)}</span>` : ""}</div>
    </div>`;

  const current = obj.current;
  const observed = current ? formatDate(current.observed_at) : "—";
  const source = current ? current.source : "—";

  const checkLabel = obj.osm_type === "p" ? "WSV prüfen" : "OSM prüfen";
  let html = `
    <div class="source-card">
      <div class="k">Quelle</div>
      <div class="v">${escapeHtml(source)}
        &nbsp;·&nbsp;<a href="${obj.osm_url}" target="_blank" rel="noopener">${checkLabel} ↗</a>
      </div>
      <div class="split">
        <div><div class="k">Stand</div><div class="v">${observed}</div></div>
        <div><div class="k">Position</div><div class="v">${obj.lat.toFixed(5)}, ${obj.lon.toFixed(5)}</div></div>
      </div>
    </div>`;

  // Pegel: aktueller Wasserstand live (API-Proxy) — bewusst getrennt von den
  // archivierten Stammdaten, mit eigener Quellen-/Zeitangabe.
  if (obj.category === "pegel") {
    html += `<div id="pegel-live" class="live-card"><span class="lbl">Wasserstand</span>
      <span class="val">// lade …</span></div>`;
  }

  const attrs = current?.attrs ?? {};
  const keys = Object.keys(attrs).sort();
  if (keys.length) {
    html += `<div class="section-label">Attribute (${keys.length})</div><div class="attrs">`;
    for (const k of keys) {
      html += `<div class="attr-row"><div class="k">${escapeHtml(k)}</div><div class="val">${renderValue(attrs[k])}</div></div>`;
    }
    html += `</div>`;
  } else {
    html += `<div class="panel-empty">Keine Attribute erfasst.</div>`;
  }

  const n = obj.history.length;
  html += `<div class="hist">// ${n} Beobachtung${n === 1 ? "" : "en"} · erstmals gesehen ${formatDate(obj.first_seen)}</div>`;
  body.innerHTML = html;
  if (obj.category === "pegel") void loadPegelCurrent(obj.osm_id);
}

// Live-Wasserstand nachladen und in die Karte im Panel schreiben.
async function loadPegelCurrent(osmId: number): Promise<void> {
  const el = document.getElementById("pegel-live");
  if (!el) return;
  try {
    const res = await fetch(`${API_BASE}/pegel/${osmId}/current`, { credentials: "include" });
    if (!res.ok) throw new Error(String(res.status));
    const m = (await res.json()) as {
      value_cm: number | null; timestamp: string | null; state: string | null;
    };
    if (m.value_cm == null) throw new Error("no value");
    const state = m.state === "high" ? " · hoch" : m.state === "low" ? " · niedrig" : "";
    const ts = m.timestamp ? formatDate(m.timestamp) : "";
    el.innerHTML = `<span class="lbl">Wasserstand</span>
      <span class="val"><b>${escapeHtml(String(m.value_cm))} cm</b>${escapeHtml(state)}</span>
      <span class="ts">live · ${escapeHtml(ts)} · PEGELONLINE</span>`;
  } catch {
    el.innerHTML = `<span class="lbl">Wasserstand</span>
      <span class="val">derzeit nicht abrufbar</span>`;
  }
}

function renderValue(v: string): string {
  if (/^https?:\/\//i.test(v)) {
    return `<a href="${encodeURI(v)}" target="_blank" rel="noopener">${escapeHtml(v)} ↗</a>`;
  }
  return escapeHtml(v);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
