// Kategorien = die eine verschmolzene Infrastruktur-Ebene. Label (DE) + Farbe.
//
// Farbregel (M3/CLAUDE.md): UI-Seed ist Orange; primary markiert die Auswahl.
// Das Marken-Pink #e31c8d ist EXKLUSIV für Änderungs-Ereignisse (NEU/GEÄNDERT)
// reserviert — nie als Kategorie- oder Deko-Farbe.

import { M3_DARK, M3_LIGHT } from "./m3-color.generated";

// Theme folgt dem OS (kein manueller Umschalter). Kartenfarben sind kein CSS —
// hier wird das passende Scheme zur Ladezeit gewählt; bei OS-Wechsel lädt
// map.ts die Seite neu. Guard: Modul läuft nur im Browser, defensiv trotzdem.
const IS_LIGHT =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-color-scheme: light)").matches;

// Aktives Scheme für Karten-Paints (Auswahl, Ereignisse, Fallback-Hintergrund).
export const M3 = IS_LIGHT ? M3_LIGHT : M3_DARK;

// Marken-Signal (fest, nicht aus dem Seed generiert — s. m3.css).
export const SIGNAL = "#e31c8d";
export const SIGNAL_BRIGHT = "#ffb0ce";

export interface Category {
  id: string;
  label: string;
  color: string;
}

// Labels: kurz, Plural, karten-tauglich (gleich breite Kacheln). Die Schärfe
// ("Kirchturm ist kein Sendemast") liefert die Untertypen-Ansicht.
export const CATEGORIES: Category[] = [
  { id: "mast",             label: "Sendemasten",   color: "#4b9fd4" },
  { id: "tower",            label: "Türme",         color: "#e5a44e" },
  { id: "power_tower",      label: "Strommasten",   color: "#8a8f98" },
  { id: "substation",       label: "Umspannwerke",  color: "#b3c94f" },
  { id: "generator",        label: "Stromerzeuger", color: "#ddc94a" },
  { id: "street_cabinet",   label: "Schaltkästen",  color: "#b08d6b" },
  { id: "water",            label: "Wasser",        color: "#4ec9b8" },
  { id: "siren",            label: "Sirenen",       color: "#e0715c" },
  { id: "charging_station", label: "Ladesäulen",    color: "#3fb27f" },
  { id: "surveillance",     label: "Kameras",       color: "#c56b7e" },
  { id: "fuel",             label: "Tankstellen",   color: "#9a7bd0" },
];

// Auswahl-/Signalfarbe aus der Dynamic-Color-Engine (primary, dark).
export const ACCENT = M3.primary;

export const CATEGORY_BY_ID: Record<string, Category> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
);

// Kategorien, die ohne Untertyp zu grob sind (Ehrlichkeit: ein Kirchturm ist
// kein Sendemast, eine Ortsnetzstation kein Umspannwerk).
export const REFINED = new Set([
  "substation", "tower", "mast", "generator", "street_cabinet", "water",
]);

// Kuratierte Untertypen: der Ingest normalisiert die Roh-Tags auf diese
// kanonischen IDs (pipeline/atmros/config.py SUBTYPE_MAP — dort ist die
// Taxonomie definiert, hier stehen nur die Anzeige-Labels). Was keine
// kanonische ID trägt, erscheint nicht im Drilldown — die Roh-Tags bleiben
// im Profiler-Panel vollständig sichtbar (Quelle lügt nicht).
const SUBTYPE_LABELS: Record<string, string> = {
  // substation
  minor_distribution: "Ortsnetzstationen",
  distribution: "Verteilnetz",
  transmission: "Übertragungsnetz",
  generation: "Kraftwerkseinspeisung",
  industrial: "Industrie",
  traction: "Bahnstrom",
  converter: "HGÜ-Konverter",
  // tower / mast
  communication: "Funk & Telekommunikation",
  bell_tower: "Glockentürme",
  defensive: "Wehr- & Wachtürme",
  observation: "Aussichtstürme",
  lighting: "Flutlicht & Beleuchtung",
  cooling: "Kühltürme",
  water: "Wassertürme",
  siren: "Sirenen",
  monitoring: "Messmasten",
  // generator (generator:source)
  solar: "Solar / PV",
  wind: "Windkraft",
  hydro: "Wasserkraft",
  biomass: "Biomasse",
  biogas: "Biogas",
  // street_cabinet
  power: "Strom",
  telecom: "Telekommunikation",
  traffic_control: "Verkehrstechnik",
  street_lighting: "Straßenbeleuchtung",
  // water (man_made-Wert der greifenden Regel)
  water_works: "Wasserwerke",
  wastewater_plant: "Kläranlagen",
  water_tower: "Wassertürme",
};

// Nur kuratierte Untertypen bekommen eine Drilldown-Zeile.
export function curatedLabel(value: string): string | null {
  return SUBTYPE_LABELS[value] ?? null;
}

// Panel/Änderungsliste: kuratiertes Label, sonst ehrlicher Rohwert.
export function subtypeLabel(value: string): string {
  return SUBTYPE_LABELS[value] ?? value;
}

// Änderungs-Ereignisse: Label (DE) + Kartenfarbe + CSS-Klasse für die
// Tonal-Chips. Marken-Pink = exklusive Auffälligkeits-Rolle (NEU/GEÄNDERT).
export const EVENT_META: Record<string, { label: string; color: string; cls: string }> = {
  NEW: { label: "NEU", color: SIGNAL, cls: "ev-new" },
  CHANGED: { label: "GEÄNDERT", color: SIGNAL, cls: "ev-changed" },
  RESTORED: { label: "WIEDER DA", color: M3.secondary, cls: "ev-restored" },
  DELETED: { label: "GELÖSCHT", color: M3.outline, cls: "ev-deleted" },
};

export function eventColorExpression(): unknown[] {
  const expr: unknown[] = ["match", ["get", "event_type"]];
  for (const [id, meta] of Object.entries(EVENT_META)) {
    expr.push(id, meta.color);
  }
  expr.push(ACCENT); // Fallback
  return expr;
}

// Als MapLibre-'match'-Ausdruck: category -> Farbe.
export function categoryColorExpression(): unknown[] {
  const expr: unknown[] = ["match", ["get", "category"]];
  for (const c of CATEGORIES) {
    expr.push(c.id, c.color);
  }
  expr.push("#666"); // Fallback
  return expr;
}
