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

import { writeFileSync, mkdirSync } from "node:fs";
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
} from "@material/material-color-utilities";

// UI-Seed: kräftiges Orange (Infrastruktur/Energie). Das Marken-Pink #e31c8d
// ist bewusst NICHT mehr der UI-Seed — es lebt als exklusive Signalfarbe für
// Änderungs-Ereignisse weiter (siehe m3.css --atmr-signal-*).
const SEED = process.env.M3_SEED ?? "#ff4d00";
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

// "Heller, freundlicher, leuchtender": Dark-Surfaces einen Tick anheben und
// wärmer machen (Ton +LIFT, Chroma +CHROMA) — nur Flächenrollen, Akzente und
// on-*-Farben bleiben spec-konform. Konfigurierbar via M3_SURFACE_LIFT/_CHROMA.
const SURFACE_LIFT = Number(process.env.M3_SURFACE_LIFT ?? 6);
const SURFACE_CHROMA = Number(process.env.M3_SURFACE_CHROMA ?? 6);
const LIFT_ROLES = [
  "background", "surface", "surfaceDim", "surfaceBright", "surfaceVariant",
  "surfaceContainerLowest", "surfaceContainerLow", "surfaceContainer",
  "surfaceContainerHigh", "surfaceContainerHighest",
];

function liftHex(hex) {
  const h = Hct.fromInt(argbFromHex(hex));
  h.tone = Math.min(98, h.tone + SURFACE_LIFT);
  h.chroma = h.chroma + SURFACE_CHROMA;
  return hexFromArgb(h.toInt());
}

const dark = buildScheme(true);
const light = buildScheme(false);
if (SURFACE_LIFT || SURFACE_CHROMA) {
  for (const role of LIFT_ROLES) {
    if (dark[role]) dark[role] = liftHex(dark[role]); // nur Dark anheben
  }
}

const header =
  `/* AUTO-GENERIERT — nicht von Hand editieren.\n` +
  `   npm run tokens  |  Seed ${SEED} · Scheme ${SCHEME} · Contrast ${CONTRAST} */\n`;

const cssVars = (roles, indent = "  ") =>
  Object.entries(roles)
    .map(([k, v]) => `${indent}--md-sys-color-${kebab(k)}: ${v};`)
    .join("\n");

const css =
  `${header}:root {\n${cssVars(dark)}\n}\n\n` +
  `/* Light-Scheme: vorbereitet, Aktivierung via <html data-theme="light"> */\n` +
  `:root[data-theme="light"] {\n${cssVars(light)}\n}\n`;

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

console.log(`m3-tokens: ${Object.keys(dark).length} Rollen · Seed ${SEED} · ${SCHEME}`);
console.log(`  primary(dark)=${dark.primary}  surface(dark)=${dark.surface}`);
