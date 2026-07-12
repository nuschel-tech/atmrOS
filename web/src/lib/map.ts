// ZEIGEN — dunkle MapLibre-Karte, Objekt-Layer aus den atmrOS-Vektor-Tiles,
// Klick -> Profiler-Panel mit Attributen + Quelle.

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { API_BASE, BASEMAP_STYLE, START_CENTER, START_ZOOM } from "../config";
import {
  ACCENT,
  CATEGORIES,
  CATEGORY_BY_ID,
  categoryColorExpression,
} from "./categories";

const SRC = "atmros-infra";
const LAYER = "infra-points";
const LAYER_SEL = "infra-selected";

interface ObjectDetail {
  osm_type: string;
  osm_id: number;
  category: string;
  first_seen: string;
  last_seen: string;
  osm_url: string;
  current: {
    observed_at: string;
    source: string;
    source_url: string;
    attrs: Record<string, string>;
  } | null;
  history: { observed_at: string; attr_hash: string; source: string }[];
}

export function initMap(): void {
  const map = new maplibregl.Map({
    container: "map",
    style: BASEMAP_STYLE,
    center: START_CENTER,
    zoom: START_ZOOM,
    attributionControl: { compact: true },
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
        "circle-radius": [
          "interpolate", ["linear"], ["zoom"],
          6, 1.6, 10, 3, 14, 5,
        ],
        "circle-opacity": 0.85,
        "circle-stroke-width": 0.4,
        "circle-stroke-color": "#000000",
      },
    });

    // Auswahl-Highlight (Pink = echte Auffälligkeit, hier: aktives Objekt).
    map.addLayer({
      id: LAYER_SEL,
      type: "circle",
      source: SRC,
      "source-layer": "infra",
      filter: ["==", ["get", "osm_id"], -1],
      paint: {
        "circle-radius": [
          "interpolate", ["linear"], ["zoom"], 6, 4, 10, 7, 14, 10,
        ],
        "circle-color": ACCENT,
        "circle-opacity": 0.25,
        "circle-stroke-width": 1.6,
        "circle-stroke-color": ACCENT,
      },
    });

    map.on("click", LAYER, (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const osmType = String(f.properties?.osm_type);
      const osmId = Number(f.properties?.osm_id);
      map.setFilter(LAYER_SEL, [
        "all",
        ["==", ["get", "osm_type"], osmType],
        ["==", ["get", "osm_id"], osmId],
      ]);
      void openPanel(osmType, osmId);
    });

    map.on("mouseenter", LAYER, () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", LAYER, () => (map.getCanvas().style.cursor = ""));

    void loadStats();
  });

  wireCloseButton(map);
}

function wireCloseButton(map: maplibregl.Map): void {
  document.getElementById("panel-close")?.addEventListener("click", () => {
    document.getElementById("panel")?.classList.remove("open");
    map.setFilter(LAYER_SEL, ["==", ["get", "osm_id"], -1]);
  });
}

async function loadStats(): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/stats`);
    if (!res.ok) return;
    const data = (await res.json()) as { by_category: Record<string, number> };
    for (const c of CATEGORIES) {
      const el = document.querySelector(`[data-count="${c.id}"]`);
      if (el) el.textContent = (data.by_category[c.id] ?? 0).toLocaleString("de-DE");
    }
  } catch {
    /* Legende bleibt ohne Zahlen — kein harter Fehler. */
  }
}

async function openPanel(osmType: string, osmId: number): Promise<void> {
  const panel = document.getElementById("panel");
  const body = document.getElementById("panel-body");
  const head = document.getElementById("panel-head-content");
  if (!panel || !body || !head) return;

  panel.classList.add("open");
  body.innerHTML = `<div class="spinner">// lade Objekt ${osmType}/${osmId} …</div>`;
  head.innerHTML = "";

  try {
    const res = await fetch(`${API_BASE}/object/${osmType}/${osmId}`);
    if (!res.ok) throw new Error(String(res.status));
    const obj = (await res.json()) as ObjectDetail;
    renderPanel(head, body, obj);
  } catch {
    body.innerHTML = `<div class="panel-empty">Objekt nicht ladbar.</div>`;
  }
}

function renderPanel(head: HTMLElement, body: HTMLElement, obj: ObjectDetail): void {
  const cat = CATEGORY_BY_ID[obj.category];
  const color = cat?.color ?? "#666";
  const label = cat?.label ?? obj.category;

  head.innerHTML = `
    <span class="cat-dot" style="background:${color}"></span>
    <div class="title">
      <div class="cat">${escapeHtml(label)}</div>
      <div class="id">${obj.osm_type}/${obj.osm_id}</div>
    </div>`;

  const current = obj.current;
  const observed = current ? formatDate(current.observed_at) : "—";
  const source = current ? current.source : "—";

  // Quelle prominent — Kern-Signatur.
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
