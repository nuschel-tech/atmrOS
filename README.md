# atmrOS — Schritt 1

**Das ehrliche ctOS.** Eine dunkle Karte Bayerns, die offene Geodatenquellen zu
*einer* Infrastruktur-Ebene verschmilzt. Jede Anzeige trägt ihre Quelle + ihr
Stand-Datum. Konzept & Grundregeln: siehe [`CLAUDE.md`](./CLAUDE.md).

Dies ist **Schritt 1**: die Kette einmal sichtbar durchlaufen —
`SAMMELN → FILTERN → ROHLAGER → SPEICHERN → ZEIGEN`. Noch ohne Nightly/Diff
(das ist Schritt 2).

## Die Kette in diesem Repo

```
pipeline/  SAMMELN + FILTERN + ROHLAGER + SPEICHERN
           Bayern-PBF -> pyosmium-Filter -> GeoParquet+Hash -> PostGIS
db/        Kernschema (object / observation / change_event)
api/       FastAPI: Vektor-Tiles (ST_AsMVT) + /object-Panel + /stats
web/       Astro + MapLibre: dunkle Karte, Klick -> Profiler-Panel mit Quelle
```

## Starten (Hetzner / lokal mit Docker)

```bash
cp .env.example .env          # POSTGRES_PASSWORD u.a. anpassen
docker compose up -d db api web
docker compose run --rm ingest        # einmal die Kette laufen lassen
```

Dann `http://localhost:4321` öffnen: dunkle Karte Bayerns, Infrastruktur als
Punkte, **Klick auf ein Objekt → Panel mit Attributen + Quelle + Stand-Datum.**
Das ist das Erfolgskriterium aus `CLAUDE.md`.

> Der `ingest`-Lauf lädt das ~806 MB Bayern-PBF und braucht beim ersten Mal
> einige Minuten (Download + Parse + Schreiben). Fortschritt im Log:
> `docker compose run --rm ingest` gibt Zähler pro Kategorie aus.

## Endpunkte der API

| Endpunkt | Zweck |
|----------|-------|
| `GET /tiles/{z}/{x}/{y}.pbf` | Mapbox Vector Tile via `ST_AsMVT` |
| `GET /object/{osm_type}/{osm_id}` | Panel-Daten inkl. Historie + Quelle |
| `GET /stats` | Counts pro Kategorie (füllt die Legende) |
| `GET /health` | Liveness |

## Datenmodell (ein Modell, drei Ansichten)

Es wird nie ein *Zustand* gespeichert, sondern **Beobachtungen mit Zeitstempel**.
Eine neue `observation`-Zeile entsteht nur, wenn sich der `attr_hash` gegenüber
der letzten Beobachtung ändert — re-Runs desselben Extrakts erzeugen also keine
Dubletten. Daraus fallen später Live / Archiv / Änderungen aus *einer* Tabelle.

## Konfiguration

Alles über `.env` (siehe `.env.example`). Zwei bewusst gekapselte Schalter:

- **`PUBLIC_API_BASE`** — öffentliche API-URL für den Browser (Build-Zeit).
- **`PUBLIC_BASEMAP_STYLE`** — Basemap. Platzhalter: CARTO dark-matter (kein
  Token nötig). Zum Selbst-Hosten später schlicht auf die eigene `style.json`
  (z.B. BunnyCDN) zeigen — kein Code ändert sich.

## Grundregeln (aus CLAUDE.md, hier umgesetzt)

1. **Systeme messen, nie Menschen** — nur Infrastruktur-Objekte, keine Personendaten.
2. **Jede Anzeige trägt Quelle + Stand-Datum** — prominent im Panel, plus OSM-Deep-Link.
3. **Rohlager unantastbar** — jeder Lauf schreibt GeoParquet + SHA-256 in
   `manifest.jsonl`; bestehende Dateien werden nie überschrieben.
4. **Lückenlosigkeit vor Features** — der Ingest schreibt in *einer* Transaktion;
   bei Fehler Exit-Code ≠ 0, nie halb-fertig stillschweigend committen.

## Lokal ohne Docker entwickeln (Auszüge)

```bash
# Ingest gegen ein kleines lokales PBF, ohne DB (nur zählen + Sample-GeoJSON):
cd pipeline && pip install -r requirements.txt
python -m atmros.ingest --pbf /pfad/zu/klein.osm.pbf --dry-run

# API:
cd api && pip install -r requirements.txt
DATABASE_URL=postgresql+psycopg://atmros:atmros@localhost/atmros uvicorn app.main:app --reload

# Web:
cd web && npm install && npm run dev
```

## Status & nächster Schritt

**Schritt 1 (dies):** Kette lauffähig, Karte + Panel mit Quelle. ✅
**Schritt 2:** systemd-Timer (Nightly-Ingest) + Diff-Logik (`change_event`:
NEW/CHANGED/DELETED/RESTORED) + Archiv-/Änderungsansicht. Das Schema dafür
steht bereits (`change_event`), die Tabelle ist in Schritt 1 nur noch leer.
