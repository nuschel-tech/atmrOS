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
- Archiv-/Zeitreise-Ansicht
- Stufe B, weitere Quellen: BNetzA-Ladesäulenregister (CC BY 4.0, Cross-Check
  zu OSM; vorher Identitätsbildung klären — Zeilen ohne stabile ID),
  Marktstammdatenregister (dl-de/by-2-0, täglicher Gesamtdatenexport, der
  große Brocken); GKD Bayern (CC BY-**SA**!), DWD, Energie-Atlas dahinter.
  BNetzA-EMF weiter ohne offenen Bulk-Download -> Merkliste

## [0.15.0] — 2026-07-31

**Karten-Dramaturgie: die Infrastruktur leuchtet.**

### Geändert
- Neuer Glow-Layer unter den Objekt-Punkten: bei Übersichts-Zoom
  verschmelzen die Objekte zu farbigen Lichtfeldern, nah dran wird der
  Glow zum Halo um klickbare Punkte (Light-Theme: gedimmt)
- Punkt-Staffelung neu abgestimmt (Kerne wachsen von 1,1 px auf 5,5 px,
  Kontur erst ab z9); Parameter an synthetischer Bayern-Punktwolke
  visuell verifiziert
- Änderungs-Highlights pulsieren, solange die Änderungsansicht offen ist
  (statisch bei `prefers-reduced-motion`)
- Basemap mit mehr Tiefe: Flächen dunkler, Wasser leuchtender,
  Straßenhierarchie gespreizt (Generator, beide Themes) — Live-Sichtung
  der echten Basemap steht aus

## [0.14.0] — 2026-07-31

**Stufe B, Quelle 2: PEGELONLINE — die Kette kann jetzt mehrere Quellen.**

### Hinzugefügt
- Neue Quelle `wsv/pegelonline` (WSV, Lizenz dl-zero-de/2.0):
  `python -m atmros.pegel` filtert die Stationsliste kuratiert auf Bayern
  (BBox + Donau/Main ab km ~70/Main-Donau-Kanal, Grenzpegel am bayerischen
  Ufer inklusive) — 31 Pegel als Objekte `p/<Pegelnummer>` durch dieselbe
  Kette: Rohlager (eigener Datei-Präfix) → observation → Diff → Tiles
- Live-Wasserstand im Profiler-Panel: `GET /pegel/{id}/current` als
  Server-Proxy (5-Min-Cache; keine Nutzer-IPs an Dritte). Messwerte gehen
  bewusst NICHT ins Archiv — Stammdaten sind Beobachtungen, Pegelstände
  sind Messungen
- Legende: PEGELONLINE als zweite Quellen-Kachel mit eigenem Stand
  (`/stats` liefert `by_source`); Kategorie „Pegel" mit Gewässer-Drilldown
- Betrieb: `atmros-pegel.service`/`.timer` (täglich), DEPLOY.md-Abschnitt

### Geändert
- Diff pro Quelle gescoped (`db.write_run`): ein Quelle-2-Lauf sieht nur
  eigene Objekte — Fundament für alle weiteren Stufe-B-Quellen
- Kategorien-Grid zeigt nur noch Kategorien der geöffneten Quelle
- `/object` akzeptiert `p`-Objekte; Deep-Link zeigt für Pegel auf die
  WSV-Stammdaten; API braucht dafür neu `requests`

## [0.13.0] — 2026-07-31

**Quellen-zentrierte Legende.**

### Geändert
- Die Legende beginnt jetzt bei der Datenquelle: eine Kachel pro Quelle
  mit Name, Herkunft, Stand-Datum und Objektzahl („hier ist Quelle 1,
  klick drauf") → Kategorien der Quelle → kuratierte Untertypen, mit
  Zurück-Kette über alle drei Ebenen in derselben Card
- Quelle-Kachel schaltet die ganze Quelle um (Einzel-Auswahl der
  Kategorien bleibt dabei erhalten); Klick auf eine Kategorie bei
  ausgeschalteter Quelle isoliert sie (gleiche Geste wie bei Untertypen);
  „zurücksetzen" im Kategorien-Kopf hebt alle Filter der Quelle auf
- Vorbereitet für Stufe B: neue Quellen (PEGELONLINE, BNetzA-Register,
  MaStR …) werden eigene Einträge neben OpenStreetMap

## [0.12.0] — 2026-07-31

**Stufe A: vier neue Ebenen aus dem Bayern-PBF.**

### Hinzugefügt
- Neue Kategorien aus derselben Quelle (null neue Abhängigkeiten, real
  gezählt im vollen Dry-Run — jetzt 145.035 Objekte statt 94.780):
  - **Stromerzeuger** (`power=generator`, ~28.800): Solar/PV 25.697 ·
    Windkraft 1.292 · Wasserkraft 762 · Biomasse 554 · Biogas 270
  - **Schaltkästen** (`man_made=street_cabinet`, ~16.400): Strom · Telekom ·
    Verkehrstechnik · Straßenbeleuchtung
  - **Wasser** (`water_works`/`wastewater_plant`/`water_tower`, ~3.900):
    Kläranlagen 2.497 · Wasserwerke 1.134 · Wassertürme 247
  - **Sirenen** (`emergency=siren`, 1.198)
- Alle vier mit kuratierten Untertypen von Anfang an (Taxonomie wie 0.11.0)

### Geändert
- Funktion-vor-Bauform konsequent: `power=generator` und `emergency=siren`
  greifen vor `man_made=mast`/`tower` (Windrad = Erzeuger, Sirenenmast =
  Sirene); Schaltkästen mit `power=substation` zählen als Umspannwerke
- Untertyp-Quelle deklarativ (`SUBTYPE_KEY`), Kategorien-Liste dedupliziert

## [0.11.0] — 2026-07-31

**Kuratierte Untertypen statt 1:1-Rohwerte.**

### Geändert
- Untertypen werden im Ingest auf eine kuratierte Taxonomie normalisiert
  (`SUBTYPE_MAP`): Schreibvarianten gemergt (`watch_tower`/`watchtower` →
  Wehr- & Wachtürme, `telecommunication`/`radio`/`radar` → Funk &
  Telekommunikation, `transformer_tower`/`kiosk` → Ortsnetzstationen);
  Tagging-Müll („yes", Tippfehler, Freitext) und Nicht-Infrastruktur
  (Sprung-/Kletterturm) fallen bewusst raus. Die Roh-Tags bleiben
  unverändert in `attrs` und im Rohlager — kuratiert wird nur, was Filter
  und Zähler sehen
- Klassifikations-Priorität gedreht: Funktion vor Bauform —
  `power=substation`/`power=tower` gewinnen jetzt gegen
  `man_made=mast`/`tower` (eine Turmstation ist eine Stromstation, kein
  Turm); greift für Bestandsobjekte automatisch beim nächsten Ingest
- Drilldown-Labels neu formuliert (z.B. „Kraftwerkseinspeisung",
  „Flutlicht & Beleuchtung", „Glockentürme")

### Entfernt
- „(ohne Angabe)"-Pseudo-Zeile und Sammelzeile „andere" im Drilldown;
  `/stats` liefert nur noch benannte kuratierte Untertypen. Objekte ohne
  kuratierten Untertyp zählen weiter in der Kachel-Summe und folgen dem
  Kategorie-Schalter

### Hinzugefügt
- „zurücksetzen"-Button im Drilldown-Kopf: hebt alle Untertyp-Filter der
  offenen Kategorie auf (auch nach „nur dieser Untertyp"-Isolation)

## [0.10.1] — 2026-07-31

**Filter modernisiert: Kachel-Grid + Drilldown.**

### Geändert
- Kategorien-Filter als gleich breite Kacheln im 2-Spalten-Grid
  (Quick-Settings-Muster) statt unterschiedlich breiter Chips
- Untertypen als Drilldown IN der Card (Pfeil → Detailansicht mit
  Zurück-Button) statt schwebendem Popover nach oben
- Labels kurz und klar: alles Plural, „Überwachungskamera" → „Kameras"
- App stirbt nicht mehr ohne WebGL: Legende, Zähler, Änderungsliste und
  Info-Dialog funktionieren auch, wenn die Karte nicht initialisiert
  werden kann (alte Geräte)

## [0.10.0] — 2026-07-31

**Der Rahmen der App: Boot, App Bar, Chips, Controls.**

### Hinzugefügt
- atmrOS-Boot-Animation beim Seitenstart (Wortmark + wavy progress, federnd;
  blendet aus, sobald Karte + Daten stehen; hartes 2,5-s-Timeout; reduced-motion
  respektiert)
- Zoom + Info als gemeinsame M3-Control-Säule unten rechts (ersetzt die grauen
  MapLibre-Default-Buttons); Info öffnet einen zentralen Dialog mit Version,
  Datenstand (live), Datenquellen (ODbL), Software-Lizenzen und
  Impressum/Datenschutz; dazu dezente „© OpenStreetMap"-Zeile an der Karte

### Geändert
- App Bar entschlackt: links nur das Wortmark, „Änderungen" als Aktion oben
  rechts; der Entwickler-Subtitle entfällt (Version lebt im Info-Dialog)
- Kategorien-Filter als M3-Filter-Chips (Farbpunkt, Zähler, aus = Outline +
  durchgestrichen); Untertypen öffnen als Popover über dem Chip-Feld —
  alle Verhaltensweisen (Isolieren, „andere"-Bucket) erhalten

## [0.9.0] — 2026-07-31

**Light Mode — folgt dem OS.**

### Hinzugefügt
- Light-Scheme aktiv: Theme folgt ausschließlich `prefers-color-scheme`
  (kein manueller Umschalter). Tokens als Media-Query aus derselben Engine,
  `color-scheme` gesetzt (native Scrollbars/Controls passen sich an)
- Helle Basemap: Generator erzeugt `style-light.json` mit (dunkle Linien auf
  hellem Grund); die Karte wählt den Style zur Ladezeit, ein OS-Wechsel lädt
  die Seite sauber neu
- Karten-Paints scheme-bewusst (Auswahl/Ereignisse/Fallback aus dem aktiven
  Scheme); Signal-Pink-Töne mit Light-Varianten (Container hell, Text dunkel)
- Coming-soon und /unlock ebenfalls OS-gesteuert hell/dunkel

## [0.8.0] — 2026-07-31

**Neues Farbschema: leuchtendes Cyan.**

### Geändert
- UI-Seed von Orange auf Cyan `#00bcd4`: kühle Töne bleiben auch auf dunklen
  Flächen als Farbe erkennbar (dunkles Orange = zwangsläufig Braun/Rost) —
  primary jetzt elektrisches `#00daf5`, Flächen tiefes Petrol-Glühen statt
  Terrakotta. Das Marken-Pink bleibt exklusives Änderungs-Signal und hat auf
  Cyan maximalen Komplementär-Pop.
- Kategoriefarbe Türme von Teal auf Amber (Teal kollidierte mit dem Cyan-UI;
  Orange/Amber ist durch den Seed-Wechsel wieder frei)
- Basemap automatisch mitsynchronisiert (Petrol-Familie, Wasser dunkles Violett)

## [0.7.2] — 2026-07-31

**Ember statt Braun.**

### Geändert
- Flächenfarben kommen jetzt direkt aus der Orange-Tonpalette mit hoher Chroma
  („Ember-Modus", Default; `M3_SURFACE_MODE=spec` schaltet zurück) — dunkles
  Orange mit wenig Chroma las sich als Braun, erst kräftige Chroma bei
  mittleren Tönen wirkt orange. Surfaces: Glut-Orange bis Rost/Terrakotta.
- Basemap wird vom Token-Generator automatisch mitsynchronisiert
  (`npm run tokens` patcht style.json aus derselben Palette) — Karte und UI
  können nicht mehr auseinanderlaufen.

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
