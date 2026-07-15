// Kategorien = die eine verschmolzene Infrastruktur-Ebene. Label (DE) + Farbe.
//
// Farbregel (Design-System): gedämpfte, entsättigte Kategoriefarben. Das Pink
// #e31c8d ist RESERVIERT für echte Auffälligkeiten (Auswahl, später NEU/
// GEÄNDERT) — nie als Kategorie-Dauerfarbe.

export interface Category {
  id: string;
  label: string;
  color: string;
}

export const CATEGORIES: Category[] = [
  { id: "mast",             label: "Sendemast",         color: "#4b9fd4" },
  { id: "tower",            label: "Turm",              color: "#5bc0be" },
  { id: "power_tower",      label: "Strommast",         color: "#8a8f98" },
  { id: "substation",       label: "Umspannwerk",       color: "#c9a227" },
  { id: "charging_station", label: "Ladesäule",         color: "#3fb27f" },
  { id: "surveillance",     label: "Überwachungskamera", color: "#c56b7e" },
  { id: "fuel",             label: "Tankstelle",        color: "#9a7bd0" },
];

export const ACCENT = "#e31c8d";

export const CATEGORY_BY_ID: Record<string, Category> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
);

// Kategorien, die ohne Untertyp zu grob sind (Ehrlichkeit: ein Kirchturm ist
// kein Sendemast, eine Ortsnetzstation kein Umspannwerk).
export const REFINED = new Set(["substation", "tower", "mast"]);

// Platzhalter für fehlende Untertyp-Angabe — ehrlich sichtbar, nicht verschluckt.
export const NO_SUBTYPE = "(ohne Angabe)";

// Bekannte OSM-Untertypwerte -> lesbares Label. Unbekannte fallen auf den
// Rohwert zurück.
const SUBTYPE_LABELS: Record<string, string> = {
  // power=substation -> substation=*
  minor_distribution: "Ortsnetzstation",
  distribution: "Verteilnetz",
  transmission: "Übertragungsnetz (Umspannwerk)",
  traction: "Bahnstrom",
  industrial: "Industrie",
  converter: "Konverter (HGÜ)",
  transition: "Übergang Freileitung/Kabel",
  generation: "Kraftwerk (Erzeugung)",
  transformer: "Trafostation",
  transformer_tower: "Turmstation",
  kiosk: "Trafokiosk",
  compensation: "Kompensationsanlage",
  // man_made=tower / mast -> tower:type=*
  communication: "Kommunikation",
  telecommunication: "Telekommunikation",
  radio: "Funkturm",
  radar: "Radarturm",
  water: "Wasserturm",
  bell_tower: "Kirch-/Glockenturm",
  observation: "Aussichtsturm",
  watchtower: "Wachturm",
  watch_tower: "Wachturm",
  cooling: "Kühlturm",
  lighting: "Beleuchtung",
  defensive: "Wehrturm",
  lightning_protection: "Blitzschutz",
  monitoring: "Messturm",
  diving: "Sprungturm",
  siren: "Sirene",
  advertising: "Werbeturm",
  tent: "Zeltmast",
  hose: "Schlauchturm",
  climbing: "Kletterturm",
  chimney: "Schornstein",
  minaret: "Minarett",
  clock: "Uhrturm",
  clock_tower: "Uhrturm",
  ventilation: "Lüftungsturm",
  staircase: "Treppenturm",
  monument: "Denkmalturm",
  silo: "Silo",
  aircraft_control: "Flugsicherung",
  air_traffic_control: "Flugsicherung",
  airport_control: "Flugsicherung",
};

export function subtypeLabel(value: string): string {
  return SUBTYPE_LABELS[value] ?? value;
}

// Änderungs-Ereignisse: Label (DE) + Farbe. Pink = echte Auffälligkeit
// (NEU/GEÄNDERT/WIEDER); Gelöschtes gedämpft grau.
export const EVENT_META: Record<string, { label: string; color: string }> = {
  NEW: { label: "NEU", color: "#e31c8d" },
  CHANGED: { label: "GEÄNDERT", color: "#e31c8d" },
  RESTORED: { label: "WIEDER DA", color: "#5bc0be" },
  DELETED: { label: "GELÖSCHT", color: "#8a8f98" },
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
