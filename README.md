<div align="center">

# atmrOS

**Das ehrliche ctOS.** Eine dunkle Karte Bayerns, die offene Geodaten zu *einer*
Infrastruktur-Ebene verschmilzt — mit Gedächtnis, und jede Anzeige nennt ihre Quelle.

![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/API-FastAPI-009688?logo=fastapi&logoColor=white)
![PostGIS](https://img.shields.io/badge/DB-PostGIS%2016-336791?logo=postgresql&logoColor=white)
![Astro](https://img.shields.io/badge/Web-Astro%20SSR-BC52EE?logo=astro&logoColor=white)
![MapLibre](https://img.shields.io/badge/Karte-MapLibre%20GL-396CB2?logo=maplibre&logoColor=white)
![Daten: ODbL](https://img.shields.io/badge/Daten-ODbL%20·%20OpenStreetMap-7EBC6F)

</div>

<!-- Screenshot: docs/screenshot.png ablegen (dunkle Karte + Profiler-Panel). -->
![atmrOS — Karte Bayerns mit Infrastruktur-Ebene und Profiler-Panel](docs/screenshot.png)

---

## Was ist atmrOS?

Wie das *ctOS* aus **Watch Dogs** — nur ehrlich. atmrOS legt die unsichtbare
Verkabelung einer Region als **ein** Gesamtbild auf eine dunkle Karte:
Sendemasten, Strommasten, Umspannwerke, Ladesäulen, Überwachungskameras,
Türme, Tankstellen. Kein Single-Purpose-Finder, sondern die **Verknüpfung**
vieler offener Quellen zu einer Ebene.

Drei Dinge machen es aus:

- **Eine Ebene.** Verschiedene Objekttypen aus OpenStreetMap, verschmolzen und
  gemeinsam filterbar — nicht sieben getrennte Apps.
- **Mit Gedächtnis.** Es wird nie ein *Zustand* gespeichert, sondern immer
  **Beobachtungen mit Zeitstempel**. Daraus fallen Live-Ansicht, Archiv und
  **Änderungen über Zeit** (NEU / GEÄNDERT / GELÖSCHT / WIEDER) aus *einer* Tabelle.
- **Ehrlich.** Jedes Objekt trägt im Profiler-Panel seine **Quelle + Stand-Datum**
  und einen Deep-Link zurück zu OpenStreetMap. Und es misst nur **Systeme, nie
  Menschen** — eine Überwachungskamera ist ein Objekt; wer gefilmt wird, ist es nie.

> Ehrlichkeit im Detail: Ein Kirchturm läuft hier **nicht** als „Sendemast"
> durch. `man_made=tower`/`mast` und `power=substation` sind zu grob, deshalb
> erfasst atmrOS den Untertyp (`tower:type`, `substation`) und macht ihn
> filterbar — Kirch-/Wehrtürme, Ortsnetzstationen usw. sind klar getrennt.

## Die Kette

Das Herzstück ist eine lückenlose Pipeline:

```
1. SAMMELN     Geofabrik Bayern-PBF laden (Last-Modified-gesteuert)
2. FILTERN     relevante Objekttypen extrahieren (osmium)
3. ROHLAGER    gefilterte Objekte als Parquet + SHA-256-Manifest (unantastbar)
4. SPEICHERN   als zeitgestempelte Beobachtungen in PostGIS
5. VERKNÜPFEN  alle Objekte in EINER Ebene
6. ERINNERN    Diff gegen letzten Scan → change_event
7. ZEIGEN      dunkle Vektorkarte, Klick → Profiler-Panel mit Quelle
```

## Architektur

| Dienst | Rolle |
|--------|-------|
| **pipeline** (Python + osmium) | SAMMELN · FILTERN · ROHLAGER · SPEICHERN · ERINNERN |
| **db** (PostgreSQL 16 + PostGIS 3.4) | `object` / `observation` / `change_event` |
| **api** (FastAPI) | Vektor-Tiles via `ST_AsMVT`, Objekt-Panel, Stats, Änderungen |
| **web** (Astro SSR + MapLibre GL) | dunkle Karte, Filter-Legende, Profiler-Panel, Änderungsansicht |

```
pipeline/   Ingest (osmium) + Diff-Logik + Rohlager
db/init/    Kernschema
api/app/    FastAPI-Endpunkte
web/src/    Astro-Seiten + MapLibre-Logik
deploy/     systemd-Timer für den Nightly-Ingest
docs/       DEPLOY.md · BASEMAP.md
```

## Schnellstart

Voraussetzung: Docker + Docker Compose.

```bash
cp .env.example .env      # Secrets erzeugen (siehe Kommentare in der Datei)
docker compose up -d db api web
docker compose run --rm ingest        # einmal die ganze Kette laufen lassen
```

Standardmäßig ist ein **Login-Gate** aktiv (`ATMROS_LAUNCHED=false`) → man sieht
eine Coming-soon-Seite; über `/unlock` mit Passwort kommt man an die App.
Vollständige Anleitung (Reverse-Proxy, Timer, TLS): **[`docs/DEPLOY.md`](./docs/DEPLOY.md)**.

### API-Endpunkte

| Endpunkt | Zweck |
|----------|-------|
| `GET /tiles/{z}/{x}/{y}.pbf` | Mapbox Vector Tile (`ST_AsMVT`), nur sichtbare Objekte |
| `GET /object/{osm_type}/{osm_id}` | Panel-Daten inkl. Historie + Quelle |
| `GET /stats` | Counts pro Kategorie **und Untertyp** + aktueller Stand |
| `GET /changes?since=` | Änderungen (`change_event`) für die Änderungsansicht |
| `GET /status` | ob gerade ein Ingest läuft |
| `GET /health` | Liveness |

## Datenmodell — ein Modell, drei Ansichten

Eine neue `observation`-Zeile entsteht nur, wenn sich der Attribut-Hash gegenüber
der letzten Beobachtung ändert. Re-Runs desselben Extrakts erzeugen also keine
Dubletten. Verschwundene Objekte werden **nicht gelöscht**, sondern als abwesend
markiert (`present=false`) — kommt ein Objekt zurück, ist das ein *WIEDER*-Ereignis.

- **Live** = neueste Beobachtung je Objekt (nur präsente)
- **Archiv** = alle Beobachtungen über Zeit
- **Änderungen** = Differenz zweier aufeinanderfolgender Scans

## Datenquellen & Lizenz

- **Geodaten:** [OpenStreetMap](https://www.openstreetmap.org/) via
  [Geofabrik](https://download.geofabrik.de/) (Bayern-Extrakt).
  Lizenz **ODbL** — „**© OpenStreetMap-Mitwirkende**". Diese Namensnennung ist
  in der App eingebaut und bei jeder Weiterverwendung erforderlich.
- **Basemap:** selbst gehostete [Protomaps](https://protomaps.com/)-Kacheln
  (`.pmtiles`), Style im Repo unter `web/public/basemap/`. Siehe
  [`docs/BASEMAP.md`](./docs/BASEMAP.md).

## Grundregeln (nicht verhandelbar)

1. **Systeme messen, niemals Menschen.** Nur Infrastruktur-Objekte, keine Personendaten.
2. **Jede Anzeige trägt ihre Quelle + Stand-Datum.** Die Kern-Signatur des Projekts.
3. **Das Rohlager ist unantastbar.** Einmal geschrieben, nie verändert — SHA-256-Kette als Beweis.
4. **Lückenlosigkeit vor Features.** Der Ingest schreibt in *einer* Transaktion; bei Fehler bricht die Kette sauber ab, statt halb zu committen.

## Versionierung

[SemVer](https://semver.org/lang/de/); `0.x` = Pre-Launch, der öffentliche
Launch wird `1.0.0`. Quelle der Wahrheit ist [`VERSION`](./VERSION), Historie
in [`CHANGELOG.md`](./CHANGELOG.md). Bump:

```bash
node scripts/bump-version.mjs 0.6.0   # hält VERSION, web & api synchron
```

Die laufende Version ist in der Software selbst sichtbar: im Web-HUD, auf der
Coming-soon-Seite und unter `GET /health`.

## Status

**Schritt 1 – die Kette läuft.** ✅ Real gegen das volle Bayern-PBF verifiziert
(94.780 Objekte). Karte, Filter, Profiler-Panel mit Quelle.

**Schritt 2 – Gedächtnis & Automatik.** ✅
- Diff-Logik (`change_event`: NEU/GEÄNDERT/GELÖSCHT/WIEDER) + `present`-Modell
- Änderungsansicht (`/changes`, Liste + Pink-Highlight auf der Karte)
- Last-Modified-gesteuerter Nightly-Ingest (systemd-Timer, holt nur bei neuem Stand)
- „Daten werden aktualisiert"-Banner + „neuer Stand"-Toast (kein Reload nötig)

**Denkbar als Nächstes:** Archiv-/Zeitreise-Ansicht, Zweitquellen andocken
(Bundesnetzagentur-EMF, OpenChargeMap-Anreicherung), Dichte-/Heatmap-Verdichtung.

## Über

Eine Fähigkeit von **MultaEnhavo**. Design: **Material 3 Expressive** — das
Signature-Design der MultaEnhavo-Entwicklung. Dynamic Color aus dem Marken-Seed
Pink `#e31c8d`, Roboto (self-hosted), Dark-First. Änderungs-Ereignisse
(NEU/GEÄNDERT) behalten eine exklusive Signalrolle.

**Lizenz:** Geodaten © OpenStreetMap-Mitwirkende (ODbL). Der Projektcode steht
unter der vom Betreiber gewählten Lizenz (siehe `LICENSE`, falls vorhanden).
