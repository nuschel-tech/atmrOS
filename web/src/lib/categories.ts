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

// Als MapLibre-'match'-Ausdruck: category -> Farbe.
export function categoryColorExpression(): unknown[] {
  const expr: unknown[] = ["match", ["get", "category"]];
  for (const c of CATEGORIES) {
    expr.push(c.id, c.color);
  }
  expr.push("#666"); // Fallback
  return expr;
}
