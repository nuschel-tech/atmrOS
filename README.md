<div align="center">

# atmrOS

**Ganz Bayern. Eine Karte.**

Sieben Infrastruktur-Kategorien aus OpenStreetMap, zeitgestempelt in PostGIS,
als Vektor-Kacheln auf einer dunklen Karte. Jedes Objekt trägt Quelle und
Stand-Datum; Änderungen zwischen zwei Scans sind abfragbar.

![Status](https://img.shields.io/badge/Status-In%20Bau-F5A623)
![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/API-FastAPI-009688?logo=fastapi&logoColor=white)
![PostGIS](https://img.shields.io/badge/DB-PostGIS%2016-336791?logo=postgresql&logoColor=white)
![Astro](https://img.shields.io/badge/Web-Astro%20SSR-BC52EE?logo=astro&logoColor=white)
![MapLibre](https://img.shields.io/badge/Karte-MapLibre%20GL-396CB2?logo=maplibre&logoColor=white)
![Code: GPL-3.0](https://img.shields.io/badge/Code-GPL--3.0-E31C8D)
![Daten: ODbL](https://img.shields.io/badge/Daten-ODbL%20·%20OpenStreetMap-7EBC6F)

</div>

<!-- Screenshot: sobald docs/screenshot.png liegt (dunkle Karte + Profiler-Panel),
     die naechste Zeile einkommentieren. Bis dahin bleibt sie aus, sonst zeigt
     GitHub auf der Projektseite ein kaputtes Bildsymbol.
![atmrOS — Karte Bayerns mit Infrastruktur-Ebene und Profiler-Panel](docs/screenshot.png)
-->

---

Dies ist der vollständige Quellcode, nicht ein Ausschnitt davon. Pipeline,
Datenbankschema, API und Oberfläche liegen hier; wer die Kette selbst laufen
lassen will, braucht Docker und die drei Werte aus
[Selbst betreiben](#selbst-betreiben). Die Datenquelle ist öffentlich, der
Ingest ist reproduzierbar, das Ergebnis lässt sich nachrechnen. Der Betreiber
dieser Instanz ist damit nicht der einzig mögliche.

**Es läuft noch keine öffentliche Instanz.** Der Stand ist in
[Status](#status-in-bau) beschrieben.

## Was erfasst wird

Der Ingest kennt genau sieben Regeln, `(OSM-Key, OSM-Value) → Kategorie`.
Die Reihenfolge ist die Priorität: die erste Übereinstimmung gewinnt, damit
die Klassifikation deterministisch bleibt, auch wenn ein Element mehrere
passende Tags trägt.

| OSM-Tag | Kategorie | |
|---|---|---|
| `man_made=surveillance` | `surveillance` | Überwachungskameras |
| `man_made=mast` | `mast` | Sendemasten |
| `man_made=tower` | `tower` | Türme |
| `power=substation` | `substation` | Umspannwerke |
| `power=tower` | `power_tower` | Strommasten |
| `amenity=charging_station` | `charging_station` | Ladesäulen |
| `amenity=fuel` | `fuel` | Tankstellen |

Alles andere wird nicht gelesen. Ein Vorfilter über die Tag-Keys schließt den
Großteil der OSM-Elemente aus, bevor die Regeln überhaupt greifen.

**94.780 Objekte** im vollen Bayern-Extrakt (Stand der Verifikation).

### Untertypen, wo die Kategorie zu grob ist

`power=substation` erfasst überwiegend kleine Ortsnetzstationen, `tower` und
`mast` fangen Kirch-, Wasser- und Aussichtstürme mit ein. Für diese drei
Kategorien wird ein `subtype` aus den Tags gezogen — `substation` bzw.
`tower:type` — und über `object(category, subtype)` indiziert. Ein Kirchturm
läuft damit nicht als Sendemast durch.

### Was nicht im Modell steht

Die sieben Regeln matchen ausschließlich Infrastruktur-Objekte. Personen-
bezogene OSM-Tags werden weder gefiltert noch gespeichert; `observation.attrs`
enthält die Tags des getroffenen Objekts, sonst nichts. Eine Kamera ist ein
Punkt mit Kategorie und Untertyp — was sie aufnimmt, ist kein Feld im Schema.

## Woher der Name kommt

Der Anstoß kam aus **Watch Dogs**: dort zeigt das fiktive *ctOS* eine Stadt als
ein einziges vernetztes System. Von der Idee ist ein Gedanke geblieben —
Infrastruktur als Zusammenhang statt als Einzelpunkte. Der Rest ist anders
gebaut: echte offene Daten statt Spielkulisse, Systeme statt Menschen, jede
Anzeige mit Quelle und Stand.

## Die Kette

Sieben Schritte in einer Transaktion. Bricht einer ab, bricht der ganze Lauf;
halb geschriebene Stände gibt es nicht.

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

## Selbst betreiben

Voraussetzung ist Docker mit Compose. Sonst nichts.

```bash
cp .env.example .env      # anpassen, siehe Tabelle
docker compose up -d db api web
docker compose run --rm ingest        # einmal die ganze Kette laufen lassen
```

Drei Werte müssen gesetzt werden, alles andere in `.env.example` ist ein
brauchbarer Vorgabewert:

| Variable | Warum |
|---|---|
| `POSTGRES_PASSWORD` | Die Compose-Datei fällt ohne `.env` auf `atmros` zurück. Das ist für einen erreichbaren Host zu wenig. |
| `ATMROS_SESSION_SECRET` | Signiert das Session-Cookie, muss in `web` **und** `api` identisch sein. Erzeugen: `openssl rand -hex 32`. |
| `ATMROS_PBF_URL` | Steht auf dem Bayern-Extrakt von Geofabrik. Für eine andere Region hier den passenden PBF eintragen — die sieben Regeln sind nicht bayernspezifisch. |

Das **Login-Gate** ist optional und über `ATMROS_LAUNCHED` geschaltet. Bei
`false` zeigt die Instanz eine Coming-soon-Seite und lässt nur über `/unlock`
mit dem Passwort aus `ATMROS_UNLOCK_PASSWORD_HASH` durch; bei `true` läuft die
Karte offen. Wer die eigene Instanz von Anfang an öffentlich betreiben will,
setzt `true` und braucht weder Hash noch `/unlock`.

Der Ingest baut für die Way-Geometrie einen Node-Index. Vorgabe ist
`sparse_file_array` — der Index liegt auf der Platte, der Speicherbedarf bleibt
klein, und ein 4-GB-Host trägt den Lauf auch mit parallel arbeitendem Postgres.
`flex_mem` ist schneller, braucht für Bayern aber rund 2,1 GB Spitze (gemessen)
und ist erst ab reichlich RAM eine gute Idee.

Reverse-Proxy, Timer und TLS stehen in
**[`docs/DEPLOY.md`](./docs/DEPLOY.md)**, die selbst gehostete Basiskarte in
**[`docs/BASEMAP.md`](./docs/BASEMAP.md)**.

### Endpunkte

| Endpunkt | Zweck |
|----------|-------|
| `GET /tiles/{z}/{x}/{y}.pbf` | Mapbox Vector Tile (`ST_AsMVT`), nur sichtbare Objekte |
| `GET /object/{osm_type}/{osm_id}` | Panel-Daten inkl. Historie + Quelle |
| `GET /stats` | Counts pro Kategorie **und Untertyp** + aktueller Stand |
| `GET /changes?since=` | Änderungen (`change_event`) für die Änderungsansicht |
| `GET /status` | ob gerade ein Ingest läuft |
| `GET /health` | Liveness |

## Datenmodell

Gespeichert wird nie ein *Zustand*, sondern immer eine **Beobachtung mit
Zeitstempel**. Live-Ansicht, Archiv und Änderungen fallen aus denselben zwei
Tabellen.

| Tabelle | Inhalt |
|---|---|
| `object` | stabile Identität: `(osm_type, osm_id)` als PK, `category`, `subtype`, `present`, `first_seen`/`last_seen`, `geom geometry(Point,4326)` |
| `observation` | eine Zeile je *Änderung*: `attrs jsonb` (die OSM-Tags), `attr_hash char(64)`, `source`, `source_url`, `observed_at` |
| `change_event` | Diff zweier Scans: `event_type` ∈ `NEW` / `CHANGED` / `DELETED` / `RESTORED`, dazu `diff jsonb` |
| `ingest_state` | eine Zeile, Status des laufenden Ingests für den Banner im Frontend |

Vier Entscheidungen, die im Schema stehen und einen Grund haben:

- **Ways und Areas werden auf einen Repräsentativpunkt reduziert** (Mittel der
  gültigen Knoten). Marker-tauglich und MVT-freundlich; die Geometrie liegt
  einheitlich als Punkt in 4326.
- **Die Dedup gegen den letzten Hash passiert app-seitig, nicht als
  `UNIQUE(object, hash)`.** Ein Objekt, das auf einen früheren Hash
  zurückspringt, muss eine neue Zeile erzeugen — sonst würde die
  Constraint ein `RESTORED` fälschlich blocken.
- **Verschwundene Objekte werden nicht gelöscht**, sondern auf
  `present=false` gesetzt. Die Historie bleibt, die Live-Ansicht filtert.
- **Keine gespeicherte 3857-Spalte.** `ST_Transform` ist `STABLE`, nicht
  `IMMUTABLE`, und darf deshalb nicht in einer generierten Spalte stehen. Der
  Tile-Endpunkt transformiert stattdessen die Kachel-Bounds nach 4326 und
  trifft damit den GiST-Index auf `object.geom`.

Daraus die drei Ansichten:

- **Live** — neueste Beobachtung je Objekt, `present = true`
- **Archiv** — alle Beobachtungen über Zeit
- **Änderungen** — `change_event` zwischen zwei aufeinanderfolgenden Scans

## Woher die Daten kommen

- **Geodaten:** [OpenStreetMap](https://www.openstreetmap.org/) über
  [Geofabrik](https://download.geofabrik.de/), Bayern-Extrakt. Lizenz **ODbL**,
  Namensnennung „**© OpenStreetMap-Mitwirkende**" — eingebaut in der App und
  bei jeder Weiterverwendung Pflicht.
- **Basiskarte:** selbst gehostete [Protomaps](https://protomaps.com/)-Kacheln
  (`.pmtiles`), Style unter `web/public/basemap/`. Siehe
  [`docs/BASEMAP.md`](./docs/BASEMAP.md).

## Vier Regeln, nicht verhandelbar

1. **Nur Infrastruktur.** Die Filterregeln matchen Objekte, keine
   personenbezogenen Tags. Was nicht in der Tabelle oben steht, wird nicht
   eingelesen.
2. **Jede Zeile trägt ihre Herkunft.** `source` und `source_url` stehen in
   *jeder* `observation`, nicht global in einer Konfigurationsdatei.
3. **Das Rohlager ist unantastbar.** Die gefilterten Objekte liegen als
   Parquet mit SHA-256-Manifest. Einmal geschrieben, nie geändert.
4. **Lückenlosigkeit vor Features.** Ein Ingest committet ganz oder gar
   nicht.

## Status: In Bau

Der Code läuft, eine öffentliche Instanz gibt es noch nicht. Wer heute
hineinschauen will, betreibt ihn selbst.

**Schritt 1 — die Kette läuft.** ✅ Gegen das volle Bayern-PBF verifiziert,
94.780 Objekte. Karte, Filter und Profiler-Panel mit Quelle stehen.

**Schritt 2 — Gedächtnis und Automatik.** ✅

- Diff-Logik (`change_event.event_type`: `NEW` / `CHANGED` / `DELETED` /
  `RESTORED`) plus `present`-Modell
- Änderungsansicht unter `/changes`, Liste und Pink-Markierung auf der Karte
- Nightly-Ingest über systemd-Timer, Last-Modified-gesteuert — holt nur bei
  neuem Stand
- „Daten werden aktualisiert"-Banner und „neuer Stand"-Toast, ohne Neuladen

**Denkbar als Nächstes:** Archiv- und Zeitreise-Ansicht, Zweitquellen andocken
(Bundesnetzagentur-EMF, OpenChargeMap), Dichte- und Heatmap-Verdichtung.

## Mitmachen

Issues sind willkommen, Pull Requests auch. Was hilft:

- **Fehlklassifikation melden.** Am nützlichsten mit Region, Kategorie und dem
  OSM-Objekt — Typ und ID reichen, damit sich der Fall nachstellen lässt.
- **Neue Kategorien** gehören in `CATEGORY_RULES` in
  `pipeline/atmros/config.py`. Eine Regel ist ein Paar aus OSM-Tag und
  Kategorie; die Reihenfolge entscheidet, wenn mehrere passen.
- **Andere Regionen.** Der Ingest hängt an `ATMROS_PBF_URL`, nicht an Bayern.
  Wer einen anderen Extrakt fährt und dabei über Kanten stolpert, soll sie
  bitte aufschreiben.

Die vier Regeln oben sind keine Stilfrage, sondern der Grund, warum es das
Projekt in dieser Form gibt. Ein Vorschlag, der eine davon aufhebt, wird nicht
übernommen. Beiträge stehen unter GPL-3.0, wie der Rest des Codes.

## Über

Ein Projekt von **nuschel tech**, dem Software-Bereich von **MultaEnhavo**.
Kein Auftragsgeschäft, sondern ein Lab: gebaut, weil es uns interessiert,
betrieben auf eigener Infrastruktur.

Die Oberfläche ist dunkel gehalten und an Leitstände angelehnt. Die
Akzentfarbe Pink ist reserviert: sie markiert `NEW`- und `CHANGED`-Ereignisse
auf der Karte und wird sonst nicht verwendet.

## Lizenz und Name

**Code: [GPL-3.0](./LICENSE).** Wer eine geänderte Fassung **weitergibt** — als
Abbild, als Auslieferung, als Fork mit Binaries — muss den Quellcode
mitliefern. Reines Hosten ohne Weitergabe einer Kopie löst diese Pflicht nicht
aus; dafür gäbe es die AGPL.

**Daten: ODbL.** Die Geodaten sind von der GPL nicht berührt. Namensnennung bei
jeder Verwendung, Share-alike, sobald jemand die abgeleitete Datenbank
weitergibt. Zwei Lizenzen, zwei Geltungsbereiche.

**Name: nicht mitlizenziert.** Der Code ist frei, der Name nicht. „atmrOS",
„nuschel tech" und das Nuschel-Zeichen bleiben ausgenommen — die GPL überträgt
keine Rechte an Kennzeichen, und ihr Abschnitt 7(e) erlaubt ausdrücklich, das
klarzustellen. Wer eine geänderte Fassung weitergibt, wählt bitte einen eigenen
Namen. „Basiert auf atmrOS" ist dagegen willkommen.

Einzelheiten zu Daten, Basiskarte und Namen: [`NOTICE`](./NOTICE).

atmrOS ist ein unabhängiges Projekt und steht in keiner Verbindung zu Ubisoft
oder zu Watch Dogs.
