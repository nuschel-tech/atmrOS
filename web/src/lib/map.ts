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
  NO_SUBTYPE,
  REFINED,
  categoryColorExpression,
  subtypeLabel,
} from "./categories";

const SRC = "atmros-infra";
const LAYER = "infra-points";
const LAYER_SEL = "infra-selected";

interface StatsResponse {
  by_category: Record<string, number>;
  by_subtype: Record<string, Record<string, number>>;
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
const hiddenCategories = new Set<string>();
const hiddenSubtypes = new Set<string>(); // Schlüssel: `${category}::${subVal}`
let selected: { type: string; id: number } | null = null;
let map: maplibregl.Map;

const subKey = (cat: string, sub: string): string => `${cat}::${sub}`;

// Dunkler Notfall-Style, falls keine pmtiles-URL gesetzt ist oder das
// Style-JSON nicht lädt — die Objekt-Punkte bleiben auf dunklem Grund sichtbar.
function fallbackStyle(): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {},
    layers: [{ id: "background", type: "background", paint: { "background-color": "#0a0c10" } }],
  };
}

// Selbst gehostete Protomaps-Basemap laden und die pmtiles-/Glyph-URLs
// injizieren. Ohne Glyphs werden Label-Layer entfernt (kein harter Fehler).
async function loadBasemapStyle(): Promise<maplibregl.StyleSpecification> {
  if (!PMTILES_URL) return fallbackStyle();
  try {
    const res = await fetch(BASEMAP_STYLE_URL);
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

export async function initMap(): Promise<void> {
  // pmtiles-Protokoll für MapLibre registrieren (Range-Requests auf die
  // .pmtiles-Datei, z.B. auf BunnyCDN).
  maplibregl.addProtocol("pmtiles", new Protocol().tile);

  map = new maplibregl.Map({
    container: "map",
    style: await loadBasemapStyle(),
    center: START_CENTER,
    zoom: START_ZOOM,
    attributionControl: { compact: true },
    // Cookie an die (ggf. cross-origin, aber same-site) API mitschicken, damit
    // die Vektor-Tiles hinter dem Gate geladen werden können.
    transformRequest: (url) =>
      url.startsWith(API_BASE) ? { url, credentials: "include" } : { url },
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

  map.on("load", () => {
    map.addSource(SRC, {
      type: "vector",
      tiles: [`${API_BASE}/tiles/{z}/{x}/{y}.pbf`],
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
    void loadStats();
  });

  document.getElementById("panel-close")?.addEventListener("click", () => {
    document.getElementById("panel")?.classList.remove("open");
    selected = null;
    applyFilters();
  });

  wireLegend();
}

// --- Filter -----------------------------------------------------------------
function baseFilter(): maplibregl.FilterSpecification {
  // Untertyp pro Feature (fehlend -> NO_SUBTYPE), als Komposit-Schlüssel.
  const subVal: unknown = ["case", ["has", "subtype"], ["to-string", ["get", "subtype"]], NO_SUBTYPE];
  const composite: unknown = ["concat", ["to-string", ["get", "category"]], "::", subVal];
  return [
    "all",
    ["!", ["in", ["get", "category"], ["literal", [...hiddenCategories]]]],
    ["!", ["in", composite, ["literal", [...hiddenSubtypes]]]],
  ] as unknown as maplibregl.FilterSpecification;
}

function applyFilters(): void {
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
async function loadStats(): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/stats`, { credentials: "include" });
    if (!res.ok) return;
    buildLegend((await res.json()) as StatsResponse);
  } catch {
    /* Legende bleibt leer — kein harter Fehler. */
  }
}

function buildLegend(stats: StatsResponse): void {
  const host = document.getElementById("legend-body");
  if (!host) return;
  const de = (n: number): string => n.toLocaleString("de-DE");
  const groups: string[] = [];

  for (const c of CATEGORIES) {
    const total = stats.by_category[c.id] ?? 0;
    const subs = REFINED.has(c.id) ? stats.by_subtype?.[c.id] : undefined;
    const hasSubs = !!subs && Object.keys(subs).length > 0;

    // Untertypen stecken hinter einem Pfeil (eingeklappt) — nur die zu groben
    // Kategorien haben welche. Echte Daten haben einen langen Freitext-Schwanz
    // (tower: ~74 Werte) -> Top-8 + Sammelzeile "andere".
    let subsHtml = "";
    if (subs) {
      const ordered = Object.entries(subs).sort((a, b) => b[1] - a[1]);
      const TOP = 8;
      const rows: string[] = [];
      for (const [sub, n] of ordered.slice(0, TOP)) {
        const label = sub === NO_SUBTYPE ? NO_SUBTYPE : subtypeLabel(sub);
        rows.push(
          `<div class="lg-sub" data-cat="${c.id}" data-sub="${escapeAttr(sub)}" role="button" tabindex="0">
             <span class="lbl">${escapeHtml(label)}</span>
             <span class="count">${de(n)}</span>
           </div>`,
        );
      }
      const rest = ordered.slice(TOP);
      if (rest.length) {
        const restVals = JSON.stringify(rest.map(([s]) => s));
        const restCount = rest.reduce((acc, [, n]) => acc + n, 0);
        rows.push(
          `<div class="lg-sub lg-rest" data-cat="${c.id}" data-subs="${escapeAttr(restVals)}" role="button" tabindex="0">
             <span class="lbl">andere (${rest.length} Typen)</span>
             <span class="count">${de(restCount)}</span>
           </div>`,
        );
      }
      subsHtml = `<div class="lg-subs" hidden>${rows.join("")}</div>`;
    }

    const arrow = hasSubs
      ? `<span class="lg-arrow" role="button" tabindex="0" aria-label="Untertypen ein-/ausklappen" aria-expanded="false">▸</span>`
      : "";

    groups.push(
      `<div class="lg-group" data-cat="${c.id}">
         <div class="lg-cat" data-cat="${c.id}" role="button" tabindex="0" aria-pressed="true">
           <span class="dot" style="background:${c.color}"></span>
           <span class="lbl">${c.label}</span>
           <span class="count">${de(total)}</span>
           ${arrow}
         </div>
         ${subsHtml}
       </div>`,
    );
  }
  host.innerHTML = groups.join("");
}

function wireLegend(): void {
  const host = document.getElementById("legend-body");
  if (!host) return;
  const onActivate = (target: HTMLElement): void => {
    // 1) Pfeil: nur auf-/zuklappen, Kategorie NICHT umschalten.
    const arrow = target.closest<HTMLElement>(".lg-arrow");
    if (arrow) {
      toggleExpand(arrow);
      return;
    }
    // 2) Untertyp-Zeile.
    const subRow = target.closest<HTMLElement>(".lg-sub");
    if (subRow) {
      const group = subRow.closest<HTMLElement>(".lg-group");
      const cat = subRow.dataset.cat!;
      if (group?.classList.contains("cat-off")) {
        // Hauptkategorie ist aus -> diesen Untertyp isolieren: Kategorie wieder
        // an, aber NUR dieser Untertyp sichtbar, alle anderen aus.
        isolateSubtype(group, cat, subRow);
      } else if (subRow.dataset.subs) {
        // Sammelzeile "andere": alle Rest-Untertypen gemeinsam schalten.
        const vals = JSON.parse(subRow.dataset.subs) as string[];
        const turningOff = !subRow.classList.contains("off");
        for (const v of vals) {
          const key = subKey(cat, v);
          if (turningOff) hiddenSubtypes.add(key);
          else hiddenSubtypes.delete(key);
        }
        subRow.classList.toggle("off", turningOff);
      } else {
        toggle(hiddenSubtypes, subKey(cat, subRow.dataset.sub!), subRow);
      }
      applyFilters();
      return;
    }
    // 3) Kategorie-Zeile: umschalten; alle Untertypen durchstreichen, wenn aus.
    const catRow = target.closest<HTMLElement>(".lg-cat");
    if (catRow) {
      const cat = catRow.dataset.cat!;
      toggle(hiddenCategories, cat, catRow);
      const off = hiddenCategories.has(cat);
      catRow.setAttribute("aria-pressed", String(!off));
      catRow.closest<HTMLElement>(".lg-group")?.classList.toggle("cat-off", off);
      applyFilters();
    }
  };
  host.addEventListener("click", (e) => onActivate(e.target as HTMLElement));
  host.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onActivate(e.target as HTMLElement);
    }
  });
}

function toggleExpand(arrow: HTMLElement): void {
  const subs = arrow.closest<HTMLElement>(".lg-group")?.querySelector<HTMLElement>(".lg-subs");
  if (!subs) return;
  const collapsed = subs.hasAttribute("hidden");
  subs.toggleAttribute("hidden", !collapsed);
  arrow.textContent = collapsed ? "▾" : "▸";
  arrow.setAttribute("aria-expanded", String(collapsed));
}

// Komposit-Schlüssel einer Untertyp-Zeile (Einzeltyp oder Sammelzeile "andere").
function subKeysOf(row: HTMLElement, cat: string): string[] {
  if (row.dataset.subs) {
    return (JSON.parse(row.dataset.subs) as string[]).map((v) => subKey(cat, v));
  }
  return [subKey(cat, row.dataset.sub!)];
}

// Aus dem "Kategorie-aus"-Zustand heraus genau einen Untertyp aktivieren:
// Kategorie wieder an, nur die geklickte Zeile sichtbar, alle anderen aus.
function isolateSubtype(group: HTMLElement, cat: string, clicked: HTMLElement): void {
  hiddenCategories.delete(cat);
  group.classList.remove("cat-off");
  const catRow = group.querySelector<HTMLElement>(".lg-cat");
  if (catRow) {
    catRow.classList.remove("off");
    catRow.setAttribute("aria-pressed", "true");
  }
  for (const row of group.querySelectorAll<HTMLElement>(".lg-sub")) {
    const isClicked = row === clicked;
    for (const key of subKeysOf(row, cat)) {
      if (isClicked) hiddenSubtypes.delete(key);
      else hiddenSubtypes.add(key);
    }
    row.classList.toggle("off", !isClicked);
  }
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

  let html = `
    <div class="source-card">
      <div class="k">Quelle</div>
      <div class="v">${escapeHtml(source)}
        &nbsp;·&nbsp;<a href="${obj.osm_url}" target="_blank" rel="noopener">OSM prüfen ↗</a>
      </div>
      <div class="split">
        <div><div class="k">Stand</div><div class="v">${observed}</div></div>
        <div><div class="k">Position</div><div class="v">${obj.lat.toFixed(5)}, ${obj.lon.toFixed(5)}</div></div>
      </div>
    </div>`;

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
