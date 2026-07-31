# Changelog

Alle nennenswerten Änderungen an atmrOS. Format angelehnt an
[Keep a Changelog](https://keepachangelog.com/de/), Versionierung nach
[SemVer](https://semver.org/lang/de/) (`0.x` = Pre-Launch; Launch wird `1.0.0`).

Versions-Quelle ist die Datei [`VERSION`](./VERSION); die laufende Version ist
in der Software selbst sichtbar (Web-HUD, Coming-soon, `GET /health`). Bumpen
mit `node scripts/bump-version.mjs <version>` (hält `VERSION`,
`web/package.json` und `api/app/version.py` synchron).

## [Unreleased]

### Geplant
- Tiefere BunnyCDN-Einbindung: Full-Site-Pull-Zone; Infra-Daten als
  versionierte PMTiles auf dem CDN (Karten-Traffic am VPS vorbei)
- Light Mode (heller Basemap-Style) + optionaler Theme-Picker
- Archiv-/Zeitreise-Ansicht, Zweitquellen (BNetzA-EMF, OpenChargeMap)

## [0.7.1] — 2026-07-30

**Heller, freundlicher, leuchtender.**

### Geändert
- Dynamic-Color-Engine: Surface-Lift für Dark (+6 Ton, +6 Chroma, konfigurierbar
  via `M3_SURFACE_LIFT`/`M3_SURFACE_CHROMA`) — alle Flächen wärmer und heller,
  Akzente/on-Farben bleiben spec-konform; Coming-soon/Unlock ziehen automatisch mit
- Karten-UI voller M3 Expressive: App Bar und Legende mit warmem
  primary-container-Schimmer und Schatten, „Änderungen" als Tonal-Button
  (Spring-Hover), Zähler als Pill, Aufklapper als Kreis-Buttons mit
  primary-container-Aktivzustand, größere Kategorie-Punkte mit Shape-Morph
- Basemap auf die angehobene Surface-Familie harmonisiert

## [0.7.0] — 2026-07-30

**Neues Farbschema: Orange-UI, Marken-Pink als exklusives Signal.**

### Geändert
- UI-Seed von Pink `#e31c8d` auf kräftiges Orange `#ff4d00` — die komplette
  Palette (UI, Coming-soon, Unlock, Karte) wird daraus generiert
- Das Marken-Pink ist jetzt EXKLUSIV das Änderungs-Signal: NEU/GEÄNDERT als
  feste `--atmr-signal-*`-Konstanten (Chips, Zähler-Badge, Karten-Highlight) —
  auf dem Orange-UI maximal auffällig; RESTORED/DELETED unverändert
  secondary/outline, Auswahl = primary (Orange)
- Basemap auf die Orange-Surface-Familie harmonisiert (warme Ember-Töne)
- Kategoriefarbe Umspannwerke von Gold auf Lime (Kollision mit Orange-Primary)

## [0.6.0] — 2026-07-30

**Material 3 Expressive: das gesamte UI.** Der komplette Umbau ist damit
abgeschlossen — App, Coming-soon und Unlock sprechen eine Designsprache.

### Geändert
- Kern-UI vollständig auf M3-Tokens umgestellt (keine rohen Hex-Werte mehr):
  Top App Bar (Pill, Tonal-Surface), Legende als Tonal-Card mit Pill-Zeilen,
  Chevron-Aufklapper mit Feder-Rotation und Shape-Morph-Punkten,
  Profiler- und Änderungs-Panel als Side Sheets mit XL-Rundungen,
  Quelle-Block als Filled Card in primary-container (Kern-Signatur betont),
  „neuer Stand" als echte M3-Snackbar (inverse surface),
  „Daten werden aktualisiert" als secondary-Tonal-Pill
- Signal-Disziplin formalisiert: tertiary ist exklusiv für Änderungs-Ereignisse
  (NEU/GEÄNDERT), RESTORED = secondary, DELETED = outline; Auswahl = primary —
  alle Kartenfarben kommen jetzt aus der Dynamic-Color-Engine
- Basemap-Style an die M3-Surface-Familie angeglichen (warme Plum-Töne statt
  kühlem Blau — Karte und UI verschmelzen)
- /unlock-Seite auf M3 Expressive (Tonal-Card, handgebautes Filled Text Field,
  Filled Button, Petal-Deko, error-container-Meldung) — bewusst weiterhin
  selbst-enthalten, da /_astro im gesperrten Zustand blockiert ist
- Rohdaten (Attribute, IDs, Zeitstempel) behalten Mono als bewusstes Detail

## [0.5.0] — 2026-07-30

**Material 3 Expressive: Fundament.** Designwechsel weg von der ctOS-Ästhetik
(Lizenz-/Trade-Dress-Bedenken) hin zum Signature-Design der MultaEnhavo-Entwicklung.

### Hinzugefügt
- Dynamic-Color-Engine: `npm run tokens` generiert alle 37 M3-Farbrollen
  (Dark + Light) aus dem Marken-Seed `#e31c8d` via
  `@material/material-color-utilities` (HCT, Scheme `vibrant`)
- M3-Fundament `web/src/styles/m3.css`: Roboto self-hosted (DSGVO, kein
  Google-CDN), Type-/Shape-/Motion-Tokens, State-Layer-Konvention
- `@material/web`-Primitives (Buttons, Icon-Buttons, Chips, Text Field,
  Progress) als selektiv geladene Web Components
- Wiederverwendbare Expressive-Bausteine (wavy progress, Petal-Shapes,
  Spring-Entrances)
- Versionierung: `VERSION`, dieses Changelog, `scripts/bump-version.mjs`,
  Version sichtbar in API (`/health`) und Web-HUD

### Geändert
- Coming-soon-Seite komplett auf M3 Expressive umgebaut (Tonal-Cards, Chips,
  wavy progress, Cookie-Shapes, federnde Motion) und aus der Color-Engine
  gespeist; echtes Roboto über freigegebenes `/fonts`
- CLAUDE.md/README: M3 Expressive als verbindliches Design-System
  festgeschrieben, ctOS-Richtung verworfen
- README public-tauglich neu aufgesetzt (Konzept, Architektur, Lizenz)

## [0.4.0] — 2026-07-13

**Gedächtnis & Automatik (Schritt 2).** Die Kette erinnert sich und läuft von allein.

### Hinzugefügt
- Diff-Logik: jeder Ingest leitet `change_event` ab
  (NEU/GEÄNDERT/GELÖSCHT/WIEDER) inkl. Attribut-Diff; `object.present`
  markiert Verschwundenes statt zu löschen
- Änderungsansicht: `GET /changes` + Header-Button mit Zähler, Drawer-Liste,
  Event-Highlight auf der Karte
- Ingest-Status: `ingest_state`-Tabelle + offener `GET /status`,
  „Daten werden aktualisiert"-Banner im Frontend
- „Neuer Stand"-Toast: Tile-Versionierung über `?v=<Stand>` — frische Daten
  ohne Seiten-Reload und ohne Cache-Verzicht
- Nightly-Ingest: `ingest --if-modified` (HEAD-Vergleich Last-Modified) +
  systemd-Timer/-Service (alle 2 h; lädt nur bei echtem neuen Stand)

### Geändert
- `/tiles` und `/stats` filtern auf präsente Objekte (Live-Ansicht ohne
  Gelöschte); `/object` behält die volle Historie

## [0.3.1] — 2026-07-13

### Behoben
- Charset-Bug: fehlender `<head>`/`meta charset` ließ UTF-8 als Latin-1
  rendern („Â·", kaputte Umlaute)

### Geändert
- Untertypen der Legende als Dropdown (Pfeil pro Kategorie, eingeklappt);
  deaktivierte Hauptkategorie streicht alle Untertypen durch
- Klick auf Untertyp bei deaktivierter Hauptkategorie isoliert genau diesen
  Untertyp; größerer, besser sichtbarer Aufklapp-Pfeil
- Deutsche Labels für viele weitere OSM-Untertypen

## [0.3.0] — 2026-07-12

**Deployment auf atomar.org.**

### Hinzugefügt
- Single-Origin-Deployment: Web auf `/`, API unter `/api`
  (`ATMROS_API_ROOT_PATH`), kein CORS/Cookie-Domain-Gefrickel
- Feste Container-Namen `atmros-db` / `atmros-api` / `atmros-web`
- `docs/DEPLOY.md` (Nginx Proxy Manager, Secrets, Launch-Schalter) und
  `docs/BASEMAP.md` (pmtiles erzeugen, Bunny/CDN, Glyphs)
- Basemap-/Glyph-Defaults auf das MultaEnhavo-CDN verdrahtet

## [0.2.1] — 2026-07-12

### Behoben
- Rohlager von geopandas/GDAL auf reines pyarrow umgestellt: explizites
  Schema, lon/lat als float64, atomares Schreiben (`*.part` → `os.replace`),
  Archiv-JSON bitgleich zum `attr_hash`-Input (`canonical_attrs`)
- osmium-Pin auf `>=4.3,<5`

## [0.2.0] — 2026-07-12

**Produktionshärtung nach dem ersten echten Bayern-Lauf** (94.780 Objekte).

### Behoben
- Ingest-Crash: `TagList` (osmium 4.x) hat kein `.keys()` — classify() auf
  `__contains__` umgestellt; PyPI-Paketname `osmium` statt `pyosmium`

### Hinzugefügt
- RAM-schonender Node-Index als Default (`sparse_file_array`, ~0,7 GB weniger
  Peak) + Peak-RAM-Logging
- Untertyp-Erfassung (`object.subtype` aus `tower:type`/`substation`):
  ein Kirchturm läuft nicht mehr als Sendemast
- Login-Gate: Coming-soon bis Launch, `/unlock` (bcrypt + Rate-Limit),
  signiertes HMAC-Cookie identisch in Web (Node) und API (Python),
  `ATMROS_LAUNCHED` als Launch-Schalter
- Selbst gehostete Protomaps-Basemap (pmtiles-Protokoll, dunkler Style im
  Repo) statt Fremd-CDN

## [0.1.0] — 2026-07-12

**Schritt 1: die Kette läuft.**

### Hinzugefügt
- Pipeline: Geofabrik-Bayern-PBF → osmium-Filter (7 Objekttypen) → Rohlager
  (Parquet + SHA-256-Manifest, unantastbar) → PostGIS (`object`/`observation`,
  Beobachtungen mit Zeitstempel, Dedup über Attribut-Hash)
- API: Vektor-Tiles (`ST_AsMVT`), Objekt-Panel mit Historie + Quelle, Stats
- Web: dunkle MapLibre-Karte Bayerns, Filter-Legende, Profiler-Panel mit
  Quelle + Stand-Datum + OSM-Deep-Link
- Docker-Compose-Stack (PostGIS, FastAPI, Astro)
