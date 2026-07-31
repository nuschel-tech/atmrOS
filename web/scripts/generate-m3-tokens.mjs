// M3-Dynamic-Color-Token-Generator.
//
// Erzeugt aus dem Marken-Seed die kompletten M3-Farbrollen (Dark + Light) via
// @material/material-color-utilities (HCT) und schreibt sie als
//   src/styles/m3-color.generated.css   (CSS-Variablen --md-sys-color-*)
//   src/lib/m3-color.generated.ts       (TS-Maps für Inline-HTML wie comingsoon)
//
// Aufruf:  npm run tokens
// Konfiguration (env):
//   M3_SEED      Seed-Hex (Default #e31c8d)
//   M3_SCHEME    vibrant | tonalspot | expressive | fidelity | content (Default vibrant)
//                Achtung: "expressive" ROTIERT den Primary-Hue weg vom Seed
//                (Pink -> Blau) — fürs Branding ist vibrant der richtige Modus.
//   M3_CONTRAST  -1..1 (Default 0)

import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  argbFromHex,
  hexFromArgb,
  Hct,
  MaterialDynamicColors,
  SchemeContent,
  SchemeExpressive,
  SchemeFidelity,
  SchemeTonalSpot,
  SchemeVibrant,
  TonalPalette,
} from "@material/material-color-utilities";

// UI-Seed: leuchtendes Cyan. Kühle Töne bleiben auch auf dunklen Flächen als
// Farbe erkennbar (dunkles Orange dagegen = Braun/Rost) — deshalb liest sich
// dieses Scheme "leuchtend". Das Marken-Pink #e31c8d ist bewusst NICHT der
// UI-Seed — es ist die exklusive Signalfarbe für Änderungs-Ereignisse und hat
// auf Cyan maximalen Komplementär-Pop (siehe m3.css --atmr-signal-*).
const SEED = process.env.M3_SEED ?? "#00bcd4";
const SCHEME = (process.env.M3_SCHEME ?? "vibrant").toLowerCase();
const CONTRAST = Number(process.env.M3_CONTRAST ?? 0);

const SCHEMES = {
  vibrant: SchemeVibrant,
  tonalspot: SchemeTonalSpot,
  expressive: SchemeExpressive,
  fidelity: SchemeFidelity,
  content: SchemeContent,
};
const Ctor = SCHEMES[SCHEME];
if (!Ctor) {
  console.error(`Unbekanntes M3_SCHEME "${SCHEME}" (erlaubt: ${Object.keys(SCHEMES).join(", ")})`);
  process.exit(1);
}

// Die M3-Farbrollen, die wir als Tokens führen (kebab-case = CSS-Suffix).
const ROLES = [
  "primary", "onPrimary", "primaryContainer", "onPrimaryContainer",
  "secondary", "onSecondary", "secondaryContainer", "onSecondaryContainer",
  "tertiary", "onTertiary", "tertiaryContainer", "onTertiaryContainer",
  "error", "onError", "errorContainer", "onErrorContainer",
  "background", "onBackground",
  "surface", "surfaceDim", "surfaceBright",
  "surfaceContainerLowest", "surfaceContainerLow", "surfaceContainer",
  "surfaceContainerHigh", "surfaceContainerHighest",
  "onSurface", "surfaceVariant", "onSurfaceVariant",
  "outline", "outlineVariant",
  "inverseSurface", "inverseOnSurface", "inversePrimary",
  "surfaceTint", "shadow", "scrim",
];

const kebab = (s) => s.replace(/([A-Z])/g, "-$1").toLowerCase();

function buildScheme(dark) {
  const scheme = new Ctor(Hct.fromInt(argbFromHex(SEED)), dark, CONTRAST);
  const out = {};
  for (const role of ROLES) {
    const dc = MaterialDynamicColors[role];
    if (!dc) {
      console.warn(`Rolle fehlt in dieser Paketversion, übersprungen: ${role}`);
      continue;
    }
    out[role] = hexFromArgb(dc.getArgb(scheme));
  }
  return out;
}

// "Ember-Modus": Dark-Surfaces kommen direkt aus der SEED-Tonpalette mit
// hoher Chroma — dunkles Orange mit wenig Chroma wäre Braun; erst kräftige
// Chroma bei mittleren Tönen liest sich als Orange. Nur Flächenrollen;
// Akzente und on-*-Farben bleiben spec-konform (Kontrast: on-surface Ton 90+
// gegen Flächen Ton <= 40). M3_SURFACE_MODE=spec schaltet zurück auf Stock.
const SURFACE_MODE = (process.env.M3_SURFACE_MODE ?? "ember").toLowerCase();
const SURFACE_CHROMA = Number(process.env.M3_SURFACE_CHROMA ?? 30);
const TONE_SHIFT = Number(process.env.M3_SURFACE_TONE_SHIFT ?? 0);

// Tonstufen der Flächenrollen im Ember-Modus (M3-Ordnung bleibt erhalten).
const EMBER_TONES = {
  surfaceContainerLowest: 15,
  surfaceDim: 19,
  surface: 19,
  background: 19,
  surfaceContainerLow: 24,
  surfaceContainer: 27,
  surfaceContainerHigh: 32,
  surfaceContainerHighest: 37,
  surfaceBright: 46,
  surfaceVariant: 40,
};

const dark = buildScheme(true);
const light = buildScheme(false);

if (SURFACE_MODE === "ember") {
  const seedHue = Hct.fromInt(argbFromHex(SEED)).hue;
  const pal = TonalPalette.fromHueAndChroma(seedHue, SURFACE_CHROMA);
  for (const [role, tone] of Object.entries(EMBER_TONES)) {
    dark[role] = hexFromArgb(pal.tone(Math.max(0, Math.min(98, tone + TONE_SHIFT))));
  }
}

// --- Basemap synchron halten: style.json-Farben aus derselben Palette -------
// (verhindert, dass Karte und UI je wieder auseinanderlaufen)
function syncBasemap() {
  const stylePath = join(root, "public/basemap/style.json");
  let style;
  try {
    style = JSON.parse(readFileSync(stylePath, "utf8"));
  } catch {
    return console.warn("basemap: style.json nicht gefunden/lesbar — übersprungen");
  }
  const seedHue = Hct.fromInt(argbFromHex(SEED)).hue;
  const pal = TonalPalette.fromHueAndChroma(seedHue, SURFACE_CHROMA);
  const waterPal = TonalPalette.fromHueAndChroma(285, 14); // Violett-Stich = Wasser
  const t = (tone) => hexFromArgb(pal.tone(tone));
  const w = (tone) => hexFromArgb(waterPal.tone(tone));

  // Dunkel: helle Linien auf dunklem Grund. Hell: dunkle Linien auf hellem Grund.
  const paints = {
    dark: {
      background: { "background-color": t(15) },
      earth: { "fill-color": t(19) },
      landuse: { "fill-color": t(24) },
      water: { "fill-color": w(16) },
      buildings: { "fill-color": t(32) },
      roads_minor: { "line-color": t(30) },
      roads_major: { "line-color": t(37) },
      roads_highway: { "line-color": t(45) },
      boundaries: { "line-color": t(45) },
      places_locality: { "text-color": t(80), "text-halo-color": t(19) },
    },
    light: {
      background: { "background-color": t(95) },
      earth: { "fill-color": t(97) },
      landuse: { "fill-color": t(93) },
      water: { "fill-color": w(88) },
      buildings: { "fill-color": t(87) },
      roads_minor: { "line-color": t(85) },
      roads_major: { "line-color": t(77) },
      roads_highway: { "line-color": t(66) },
      boundaries: { "line-color": t(60) },
      places_locality: { "text-color": t(35), "text-halo-color": t(97) },
    },
  };

  for (const [mode, patch] of Object.entries(paints)) {
    const out = JSON.parse(JSON.stringify(style));
    for (const layer of out.layers) {
      if (patch[layer.id]) Object.assign((layer.paint ??= {}), patch[layer.id]);
    }
    const file = mode === "dark" ? "style.json" : "style-light.json";
    writeFileSync(join(root, "public/basemap", file), JSON.stringify(out, null, 2) + "\n");
  }
  console.log("basemap: style.json (dark) + style-light.json aus derselben Palette");
}

const header =
  `/* AUTO-GENERIERT — nicht von Hand editieren.\n` +
  `   npm run tokens  |  Seed ${SEED} · Scheme ${SCHEME} · Contrast ${CONTRAST} */\n`;

const cssVars = (roles, indent = "  ") =>
  Object.entries(roles)
    .map(([k, v]) => `${indent}--md-sys-color-${kebab(k)}: ${v};`)
    .join("\n");

// Theme folgt AUSSCHLIESSLICH dem OS (prefers-color-scheme) — kein manueller
// Umschalter. Dark ist die Basis, Light überschreibt per Media Query.
const css =
  `${header}:root {\n${cssVars(dark)}\n  color-scheme: dark;\n}\n\n` +
  `@media (prefers-color-scheme: light) {\n` +
  `  :root {\n${cssVars(light, "    ")}\n    color-scheme: light;\n  }\n}\n`;

const ts =
  `// AUTO-GENERIERT — nicht von Hand editieren. npm run tokens\n` +
  `// Seed ${SEED} · Scheme ${SCHEME} · Contrast ${CONTRAST}\n` +
  `export const M3_DARK = ${JSON.stringify(dark, null, 2)} as const;\n\n` +
  `export const M3_LIGHT = ${JSON.stringify(light, null, 2)} as const;\n`;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(join(root, "src/styles"), { recursive: true });
mkdirSync(join(root, "src/lib"), { recursive: true });
writeFileSync(join(root, "src/styles/m3-color.generated.css"), css);
writeFileSync(join(root, "src/lib/m3-color.generated.ts"), ts);

console.log(`m3-tokens: ${Object.keys(dark).length} Rollen · Seed ${SEED} · ${SCHEME} · Flächen ${SURFACE_MODE}`);
console.log(`  primary(dark)=${dark.primary}  surface(dark)=${dark.surface}  container-high=${dark.surfaceContainerHigh}`);

syncBasemap();
