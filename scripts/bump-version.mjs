// Versions-Bump für atmrOS — hält alle Versionsstellen synchron.
//
//   node scripts/bump-version.mjs 0.6.0
//
// Schreibt: VERSION, web/package.json (version), api/app/version.py.
// Danach: CHANGELOG.md-Abschnitt anlegen und committen. Keine git-Tags —
// die Version ist in der Software sichtbar (Web-HUD, Coming-soon, /health).

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error("Aufruf: node scripts/bump-version.mjs <semver>  (z.B. 0.6.0)");
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// 1) VERSION (Quelle der Wahrheit)
writeFileSync(join(root, "VERSION"), version + "\n");

// 2) web/package.json
const pkgPath = join(root, "web/package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.version = version;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

// 3) api/app/version.py (eigene Datei, weil der api-Build-Context nur ./api ist)
writeFileSync(
  join(root, "api/app/version.py"),
  `"""AUTO-GENERIERT durch scripts/bump-version.mjs — nicht von Hand editieren."""\n\n` +
  `__version__ = "${version}"\n`,
);

console.log(`atmrOS -> ${version}  (VERSION, web/package.json, api/app/version.py)`);
console.log("Nächster Schritt: CHANGELOG.md ergänzen und committen.");
