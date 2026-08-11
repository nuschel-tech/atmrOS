<div align="center">

# atmrOS

**Ganz Bayern. Eine Karte.**

Strom, Funk, Laden, Verkehr — die Infrastruktur einer Region auf einer dunklen
Karte. Aus offenen Daten, mit Gedächtnis, und jeder Punkt nennt seine Quelle.

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

## Was hier liegt

Sendemasten. Strommasten. Umspannwerke. Ladesäulen. Kameras. Türme.
Tankstellen. Alles auf **einer** Ebene, gemeinsam filterbar — nicht in sieben
getrennten Portalen.

**94.780 Objekte**, real gegen das volle Bayern-Extrakt verifiziert.

## Vier Grundsätze

**Alles an einem Ort.** Verschiedene Objekttypen aus OpenStreetMap,
verschmolzen zu einer Ebene. Du filterst sie zusammen, nicht nacheinander.

**Immer im Bild.** atmrOS speichert nie einen *Zustand*, sondern immer
**Beobachtungen mit Zeitstempel**. Aus derselben Tabelle fallen Live-Ansicht,
Archiv und Änderungen über Zeit — NEU, GEÄNDERT, GELÖSCHT, WIEDER.

**Zum Nachschauen gebaut.** Jedes Objekt trägt seine Quelle und sein
Stand-Datum, dazu einen Deep-Link zurück nach OpenStreetMap. Wenn du es genau
wissen willst, bist du einen Klick von der Quelle entfernt.

**Die Karte kennt dich nicht.** Gemessen werden Systeme, nie Menschen. Eine
Überwachungskamera ist ein Objekt; wer gefilmt wird, ist es nie.

> Und ein Kirchturm läuft hier nicht als „Sendemast" durch. `man_made=tower`,
> `mast` und `power=substation` sind zu grob — atmrOS erfasst den Untertyp
> (`tower:type`, `substation`) und macht ihn filterbar. Kirchtürme,
> Wehrtürme und Ortsnetzstationen bleiben getrennt.

## Woher der Name kommt

Der Anstoß kam aus **Watch Dogs**: dort zeigt das fiktive *ctOS* eine Stadt als
ein einziges vernetztes System. Von der Idee ist ein Gedanke geblieben —
Infrastruktur als Zusammenhang statt als Einzelpunkte. Der Rest ist anders
gebaut: echte offene Daten statt Spielkulisse, Systeme statt Menschen, jede
Anzeige mit Quelle und Stand.

## Die Kette

Sieben Schritte, lückenlos. Bricht einer ab, bricht die ganze Kette — halb
geschriebene Stände gibt es nicht.

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

Du brauchst Docker und Docker Compose. Sonst nichts.

```bash
cp .env.example .env      # Secrets erzeugen (siehe Kommentare in der Datei)
docker compose up -d db api web
docker compose run --rm ingest        # einmal die ganze Kette laufen lassen
```

Ein **Login-Gate** ist standardmäßig an (`ATMROS_LAUNCHED=false`): du siehst
eine Coming-soon-Seite, über `/unlock` mit Passwort kommst du an die App.
Reverse-Proxy, Timer und TLS stehen in **[`docs/DEPLOY.md`](./docs/DEPLOY.md)**.

### Endpunkte

| Endpunkt | Zweck |
|----------|-------|
| `GET /tiles/{z}/{x}/{y}.pbf` | Mapbox Vector Tile (`ST_AsMVT`), nur sichtbare Objekte |
| `GET /object/{osm_type}/{osm_id}` | Panel-Daten inkl. Historie + Quelle |
| `GET /stats` | Counts pro Kategorie **und Untertyp** + aktueller Stand |
| `GET /changes?since=` | Änderungen (`change_event`) für die Änderungsansicht |
| `GET /status` | ob gerade ein Ingest läuft |
| `GET /health` | Liveness |

## Ein Modell, drei Ansichten

Eine neue `observation`-Zeile entsteht nur, wenn sich der Attribut-Hash
gegenüber der letzten Beobachtung ändert. Ein zweiter Lauf über dasselbe
Extrakt erzeugt also keine Dubletten.

Verschwundene Objekte werden **nicht gelöscht**, sondern als abwesend markiert
(`present=false`). Taucht eines wieder auf, ist das ein *WIEDER*-Ereignis.

- **Live** — neueste Beobachtung je Objekt, nur präsente
- **Archiv** — alle Beobachtungen über Zeit
- **Änderungen** — Differenz zweier aufeinanderfolgender Scans

## Woher die Daten kommen

- **Geodaten:** [OpenStreetMap](https://www.openstreetmap.org/) über
  [Geofabrik](https://download.geofabrik.de/), Bayern-Extrakt. Lizenz **ODbL**,
  Namensnennung „**© OpenStreetMap-Mitwirkende**" — eingebaut in der App und
  bei jeder Weiterverwendung Pflicht.
- **Basiskarte:** selbst gehostete [Protomaps](https://protomaps.com/)-Kacheln
  (`.pmtiles`), Style unter `web/public/basemap/`. Siehe
  [`docs/BASEMAP.md`](./docs/BASEMAP.md).

## Vier Regeln, nicht verhandelbar

1. **Systeme messen, niemals Menschen.** Nur Infrastruktur, keine Personendaten.
2. **Jede Anzeige trägt Quelle und Stand-Datum.** Die Signatur des Projekts.
3. **Das Rohlager ist unantastbar.** Einmal geschrieben, nie geändert. Die
   SHA-256-Kette ist der Beweis.
4. **Lückenlos vor vollständig.** Der Ingest schreibt in *einer* Transaktion.
   Geht etwas schief, bricht er sauber ab statt halb zu committen.

## Status: In Bau

**Schritt 1 — die Kette läuft.** ✅ Gegen das volle Bayern-PBF verifiziert,
94.780 Objekte. Karte, Filter und Profiler-Panel mit Quelle stehen.

**Schritt 2 — Gedächtnis und Automatik.** ✅

- Diff-Logik (`change_event`: NEU/GEÄNDERT/GELÖSCHT/WIEDER) plus `present`-Modell
- Änderungsansicht unter `/changes`, Liste und Pink-Markierung auf der Karte
- Nightly-Ingest über systemd-Timer, Last-Modified-gesteuert — holt nur bei
  neuem Stand
- „Daten werden aktualisiert"-Banner und „neuer Stand"-Toast, ohne Neuladen

**Denkbar als Nächstes:** Archiv- und Zeitreise-Ansicht, Zweitquellen andocken
(Bundesnetzagentur-EMF, OpenChargeMap), Dichte- und Heatmap-Verdichtung.

## Über

Ein Projekt von **nuschel tech**, dem Software-Bereich von **MultaEnhavo**.
Kein Auftragsgeschäft, sondern ein Lab: gebaut, weil es uns interessiert,
betrieben auf eigener Infrastruktur.

Design: dunkel und technisch, an Leitstände angelehnt. Lesbar und ernst, kein
Glitch-Cosplay. Pink markiert echte Auffälligkeiten (NEU/GEÄNDERT), nicht als
Dauer-Deko.

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
