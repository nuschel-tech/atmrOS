# atmrOS — Projektkontext für Claude Code

> Diese Datei ist die Übergabe aus einer langen Konzeptsession. Sie enthält das
> geprüfte Konzept, verifizierte Datenquellen (echt getestet, mit Zahlen), den
> Stack und den ersten Bauschritt. Lies sie ganz, bevor du beginnst.

---

## Was atmrOS ist (in einem Satz)

**Das ehrliche ctOS.** Eine dunkle Karte Bayerns, die mehrere offene Geodatenquellen
zu *einer* Infrastruktur-Ebene verschmilzt (Sendemasten, Strommasten, Umspannwerke,
Ladesäulen, Überwachungskameras, Tankstellen). Live sichtbar wie im Spiel Watch Dogs,
aber **mit Gedächtnis**: jeder Scan wird als zeitgestempelte Beobachtung gespeichert,
Veränderungen werden über Zeit sichtbar. Klickt man ein Objekt an, öffnet sich ein
Profiler-Panel mit allen Attributen — **und der offengelegten Datenquelle.**

Das Alleinstellungsmerkmal gegenüber existierenden Apps (Ladesäulen-Finder etc.):
Es ist **kein Single-Purpose-Werkzeug**, sondern eine *Verknüpfung* — die unsichtbare
Verkabelung einer Region als Gesamtbild. Und es ist das Auge, das **zugibt, woher es sieht**
(jedes Objekt trägt seine Quelle + Stand-Datum). ctOS lügt und tut allwissend; atmrOS ist
der ehrliche Zwilling.

## Was es NICHT ist

- Kein Werkzeug, das ein Nutzerproblem löst ("finde die nächste Ladesäule").
- Kein Aktivismus-/Systemkritik-Projekt (das wurde in der Session verworfen).
- Kein Marktplatz um Nutzer. Der Sinn ist: **die Kette läuft, und das Ergebnis ist
  sichtbar auf einer Domain.** Vitrine, nicht Marktplatz.

## Der eigentliche Antrieb (wichtig fürs Priorisieren)

Der Betreiber zieht seine Befriedigung aus der **funktionierenden Kette**, nicht aus dem
Thema: Sammeln läuft → Speichern läuft → Verknüpfen läuft → Verdichten läuft → Anzeigen läuft.
Wenn du priorisieren musst: **eine saubere, lückenlose, fehlerfreie Pipeline ist wichtiger
als Feature-Fülle.** Der Betreiber hasst "hässliche Clusterfucks mit vielen Bugs". Baue
lieber wenig, das perfekt durchläuft, als viel, das wackelt.

---

## Die Kette (das Herzstück)

```
1. SAMMELN     Geofabrik Bayern-PBF laden (täglich frisch)
2. FILTERN     relevante Objekttypen extrahieren
3. SPEICHERN   als zeitgestempelte Beobachtungen in PostGIS
4. VERKNÜPFEN  alle Quellen in EIN Geo-Modell, eine Ebene
5. VERDICHTEN  zählen, clustern, Dichte pro Sektor
6. ERINNERN    Diff gegen letzten Scan → Veränderungen
7. ZEIGEN      dunkle Vektorkarte, Klick → Profiler-Panel mit Quelle
```

**Zentrale Design-Entscheidung:** Es wird **nie ein "Zustand" gespeichert, sondern immer
Beobachtungen mit Zeitstempel.** Daraus ergeben sich beide Ansichten aus derselben Tabelle:
- **Live** = neueste Beobachtung pro Objekt
- **Archiv** = alle Beobachtungen über Zeit
- **Änderungen** = Differenz zweier aufeinanderfolgender Beobachtungen

Ein Datenmodell, drei Ansichten. Kein zweites System für "Archiv".

---

## Verifizierte Datenquellen (echt getestet am 12.07.2026)

### Hauptquelle: Geofabrik Bayern-Extrakt ✅
- **URL:** `https://download.geofabrik.de/europe/germany/bayern-latest.osm.pbf`
- **Größe:** 806 MB, `last-modified` täglich ~01:00 Uhr — also täglich frisch
- **Lizenz:** ODbL (frei nutzbar mit Namensnennung "© OpenStreetMap-Mitwirkende")
- **Warum PBF statt Overpass-API:** Overpass ist ein Ad-hoc-Abfragedienst mit Rate-Limit.
  Bayern-weite Nightly-Queries dagegen fliegen raus (in der Session real ins Limit gelaufen).
  Das PBF ist der offizielle Bulk-Weg: einmal laden, lokal parsen, kein fremder Dienst belastet.
  **Das ist auch die ehrlichere Kette** — echte Datenverarbeitung statt fremde API hämmern.

### Objekt-Volumen (Bayern, real gezählt)
| Typ | OSM-Tag | ~Anzahl Bayern |
|-----|---------|----------------|
| Sendemasten | `man_made=mast` | ~10.000 |
| Türme | `man_made=tower` | ~4.500 |
| Strommasten | `power=tower` | sehr viele (Hauptmasse) |
| Umspannwerke | `power=substation` | Tausende |
| Ladesäulen | `amenity=charging_station` | Tausende |
| Überwachungskameras | `man_made=surveillance` | Hunderte+ |
| Tankstellen | `amenity=fuel` | Tausende |

Gesamt grob im **niedrigen sechsstelligen Bereich**. In PostGIS trivial (< 100 MB).
Auf der Karte via Vektor-Tiles / Clustering problemlos.

### Beispiel-Objekt (real, Ladesäule bei Erding) — zeigt Panel-Reichtum
```
@ 48.3110, 11.9093
  operator = Stadtwerke Erding
  capacity = 2
  socket:type2 = 2
  socket:type2:output = 22 kW
  opening_hours = 24/7
  fee = yes
  motorcar = yes
  website = https://www.stadtwerke-erding.de/de/Strom/E-Mobility/
```
→ Das ist ein fertiges Profiler-Panel, **kein Feld muss erfunden werden.**

### Zweitquellen (später andocken, Fundament identisch)
- **Bundesnetzagentur EMF-Standortdatenbank** — Funkanlagen-Standorte mit Karte.
  Zäher (Kartendienst, keine saubere API), als Anreicherung für Masten.
- **OpenChargeMap** — Ladesäulen mit Live-Status. Braucht kostenlosen API-Key
  (`api.openchargemap.io/v3/poi`, ohne Key → HTTP 403). Reichere OSM-Ladesäulen damit an.
- **Overpass API** — nur für Ad-hoc/kleine Abfragen, NICHT für Nightly-Bulk.
  Endpoint: `https://overpass-api.de/api/interpreter` (POST, `data=` urlencoded).

---

## Stack (technisch das Beste für diese Aufgabe)

Bewusst gewählt für: Geo-Verarbeitung, saubere Pipeline, wartbar, und Dinge die in
diesem Umfeld erprobt und stabil sind.

### Datenpipeline (Schritt 1–6)
- **Sprache:** Python 3.12
- **PBF-Parsing:** `osmium` (PyPI-Paket, Import `import osmium`; schnell, C++-Kern, streamt das PBF ohne alles in RAM zu laden)
- **DB-Zugriff:** `psycopg` (v3) + `SQLAlchemy` Core
- **Orchestrierung:** simples Python-Script + **systemd-Timer** auf dem Hetzner
  (kein Airflow o.ä. — Overkill; die Kette soll simpel und lückenlos sein, nicht fancy)
- **Rohdaten-Archiv:** jedes Tages-PBF-Extrakt der gefilterten Objekte als
  komprimiertes Parquet ablegen (lon/lat als float64-Spalten, reines pyarrow —
  keine geopandas/GDAL-Kette) + SHA-256 in `manifest.jsonl` (Beweis-Kette,
  unveränderlich). Nur die gefilterten Objekte, nicht das 806-MB-Vollextrakt behalten.

### Datenbank
- **PostgreSQL 16 + PostGIS 3.4** (räumliche Queries, Cluster, Dichte-Aggregation)
- Kernschema (bewusst schlank):
  ```sql
  -- Stammobjekt: stabile Identität pro OSM-Element
  object(osm_type, osm_id PRIMARY KEY-Teil, first_seen, last_seen, category, geom)
  -- Beobachtungen: eine Zeile NUR wenn sich der Hash ggü. letztem Scan ändert
  observation(id, osm_type, osm_id, observed_at, attrs JSONB, attr_hash, source, source_url)
  -- Events fallen beim Diff raus: NEW / CHANGED / DELETED / RESTORED
  change_event(id, osm_type, osm_id, event_type, observed_at, diff JSONB)
  ```
  → Nur geänderte Objekte erzeugen neue Zeilen. DB bleibt klein trotz täglicher Scans.

### Backend/API
- **FastAPI** (Python — hält alles in einer Sprache, async, sauber typisiert)
- Liefert **Vektor-Tiles** dynamisch aus PostGIS via `ST_AsMVT`
  (das ist der professionelle Weg für 100k+ Punkte auf einer Karte — keine 100k
  Marker im DOM, sondern GPU-gerenderte Tiles)
- Endpunkte grob: `/tiles/{z}/{x}/{y}.pbf`, `/object/{osm_type}/{osm_id}` (Panel-Daten
  inkl. Historie), `/changes?since=`, `/stats` (Dichte/Counts pro Sektor)

### Frontend
- **Astro** (der Betreiber nutzt Astro für alle seine Sites — konsistent mit dem
  bestehenden Design-System, s.u.)
- **MapLibre GL JS** für die Karte (offen, GPU-Vektor-Rendering, kein Mapbox-Token nötig)
- Dunkles Basemap-Design (dark, entsättigt), Objekte als Vektor-Layer mit Clustering
- Profiler-Panel als Overlay beim Klick — Attribute + **Quelle + Stand-Datum** prominent

### Hosting
- **Hetzner** (hat der Betreiber schon). Docker-Compose: Postgres/PostGIS, FastAPI,
  Astro-Build hinter dem bestehenden Nginx Proxy Manager. Assets ggf. über BunnyCDN
  (nutzt er bereits, GDPR-konform).

---

## Design-System (MUSS eingehalten werden) — Material 3 Expressive

**Entscheidung (Juli 2026, ersetzt die frühere ctOS-Richtung):** atmrOS nutzt
**Material 3 Expressive** — das Signature-Design der MultaEnhavo-Entwicklung,
Open Source (Apache-2.0), keine Lizenzrisiken. Die frühere Watch-Dogs/ctOS-
Ästhetik ist **verworfen** (Trade-Dress-/Lizenzbedenken, nicht integrierbar).
Frühere Sessions-Notizen zu Terminal-Optik/Switzer/Squircle gelten NICHT mehr.

- **Farben: Dynamic Color.** Schemes werden aus dem Marken-Seed Pink `#e31c8d`
  **generiert** (`@material/material-color-utilities`, HCT), nicht handgepickt.
  Es gelten die M3-Farbrollen (primary/secondary/tertiary/surface-Stufen …).
  Dark ist Default; Light-Scheme wird miterzeugt.
- **Signal-Disziplin bleibt:** Änderungs-Ereignisse (NEU/GEÄNDERT) bekommen eine
  exklusive Rolle (tertiary), damit Auffälligkeit Auffälligkeit bleibt.
- **Font: Roboto** (nicht Roboto Flex), **self-hosted** (woff2 im Repo/Bundle —
  kein Google-Fonts-CDN, DSGVO). Monospace nur noch als Detail für Rohdaten
  (Attribute, Hashes, IDs), falls überhaupt.
- **Expressive-Merkmale erwünscht:** Tonal Surfaces, große Display-Typo,
  Shape-Scale bis Pill, Cookie-/Petal-Shapes, federnde Overshoot-Motion,
  wavy progress, State-Layers. `prefers-reduced-motion` respektieren.
- **Komponenten:** `@material/web` selektiv für Primitives (Buttons, Chips,
  Text Fields …; Achtung: M3 classic + Maintenance-Mode — Expressive-Schicht
  und fehlende Teile wie Side Sheets/Snackbar selbst bauen). Kein Framework-
  Zwang, kein Dynamic-Color-Verzicht.
- **Dichte:** etwas kompakter als Stock-M3 fahren — atmrOS ist ein Karten-/
  Daten-Tool, kein Consumer-Feed.

> Hinweis: atomar.org hat bereits eine Live-Coming-Soon-Seite. atmrOS ist eine
> **Fähigkeit von MultaEnhavo** (dem angemeldeten Betrieb, der auch die Brands
> MaximalNico, LumeraPixel, X7F9 Audiowave betreibt), nicht ein eigenes Sub-Brand.
> Impressum/Copyright/Datenschutz laufen über MultaEnhavo.

---

## Grundregeln (nicht verhandelbar)

1. **Systeme messen, niemals Menschen.** Nur Infrastruktur-Objekte. Keine Personendaten.
   (Überwachungskameras als Objekt: ja. Wer gefilmt wird: niemals.)
2. **Jede Anzeige trägt ihre Quelle + Stand-Datum.** Das ist die Kern-Signatur.
3. **Rohlager ist unantastbar.** Einmal geschrieben, nie verändert. Hash-Kette als Beweis.
4. **Lückenlosigkeit vor Features.** Der Wert des Archivs ist, dass es keine Lücken hat.
   Nightly-Job muss robust sein (Retry, Fehler loggen, aber Kette nie stillschweigend brechen).

## Versionierung & Releases

SemVer, `0.x` bis zum Launch (Launch = `1.0.0`). Quelle der Wahrheit: `VERSION`
im Repo-Root; `node scripts/bump-version.mjs <ver>` synchronisiert
`web/package.json` und `api/app/version.py` (api-Build-Context ist nur `./api`,
deshalb die generierte Datei). **Jedes Release:** CHANGELOG.md-Abschnitt
(deutsch, Keep-a-Changelog-Stil) + annotierter Tag `vX.Y.Z`. Version ist im
Web-HUD und in `GET /health` sichtbar — die drei Stellen nie von Hand
auseinanderlaufen lassen.

---

## ERSTER BAUSCHRITT (klein, sichtbar, ein Durchlauf)

Ziel: **einmal die ganze Kette durchlaufen sehen**, noch ohne Gedächtnis/Nightly.

1. Projekt-Grundgerüst: Docker-Compose mit PostGIS + FastAPI + Astro
2. `ingest.py`: Bayern-PBF laden → mit osmium die o.g. Objekttypen filtern →
   in `object` + erste `observation` schreiben (mit `source='osm/geofabrik'`,
   `source_url` = Geofabrik-URL, `observed_at` = PBF `last-modified`)
3. FastAPI: `/tiles/{z}/{x}/{y}.pbf` via `ST_AsMVT` + `/object/{type}/{id}`
4. Astro + MapLibre: dunkle Karte Bayern, Objekt-Layer aus den Tiles,
   Klick → Panel mit Attributen + Quelle
5. **Erfolgskriterium:** Karte lädt, Objekte sichtbar, Klick zeigt echtes Panel mit
   Quelle. Das ist der erste sichtbare "die-Kette-läuft"-Moment.

**Danach (Schritt 2):** systemd-Timer für Nightly-Ingest + Diff-Logik (`change_event`),
dann die Archiv-/Änderungsansicht. Erst wenn Schritt 1 sauber läuft.

---

## Was in dieser Session schon existiert / geprüft wurde

- OSM Overpass liefert real (getestet, 429 Objekte allein im Kasten um Erding)
- Geofabrik Bayern-PBF verifiziert: 806 MB, täglich aktualisiert
- Objekt-Attribute reichen für vollwertige Panels (Beispiel Ladesäule oben)
- ctOS-Profiler-Panel-Layout wurde als HTML-Prototyp schon gebaut (Dark, Terminal-Stil,
  Attribut-Reihen, Quellenangabe) — als visuelle Referenz nachbaubar
- Stack-Entscheidung PBF statt Overpass ist begründet (Rate-Limit real erreicht)
