# Basemap: selbst gehostete Protomaps-Kacheln über BunnyCDN

atmrOS nutzt eine **selbst gehostete** dunkle Basemap statt eines Fremd-CDN
(DSGVO-Linie, konsistent mit dem übrigen Self-Hosting). Technik: eine einzige
`.pmtiles`-Datei (Protomaps) auf BunnyCDN, die MapLibre per HTTP-Range-Requests
liest — kein Kachel-Server nötig.

Der Style liegt im Repo unter `web/public/basemap/style.json` (dunkel,
entsättigt, minimal) und ist von dir anpassbar. Er zielt auf das
**Protomaps-Basemaps-Schema** (Source-Layer `earth`, `water`, `roads`,
`boundaries`, `places`, `buildings`, `landuse`). Zur Laufzeit injiziert
`web/src/lib/map.ts` die konkreten URLs aus zwei Env-Vars:

| Env-Var | Zweck |
|---------|-------|
| `PUBLIC_PMTILES_URL` | URL der `.pmtiles`-Datei auf Bunny |
| `PUBLIC_GLYPHS_URL`  | Glyphs (Schrift-Stacks) als `{fontstack}/{range}.pbf` |

Sind sie leer, rendert die Karte nur einen dunklen Hintergrund — die
Objekt-Punkte bleiben sichtbar. Kein harter Fehler.

---

## 1. `bayern.pmtiles` erzeugen

### Variante A — Region aus dem Protomaps-Planet schneiden (einfachster Weg)

Die [`pmtiles` CLI](https://github.com/protomaps/go-pmtiles/releases)
installieren und aus dem täglichen Protomaps-Build nur Bayern extrahieren.
Das liefert exakt das Schema, auf das `style.json` zielt.

```bash
# Bounding-Box Bayern: minLon,minLat,maxLon,maxLat
pmtiles extract https://build.protomaps.com/20260712.pmtiles bayern.pmtiles \
  --bbox=8.9,47.2,13.9,50.6 --maxzoom=14
```

Datum in der URL auf einen vorhandenen Build anpassen (Liste unter
`build.protomaps.com`). `--maxzoom=14` reicht für unsere Punkt-Karte und hält
die Datei klein.

### Variante B — selbst bauen (volle Kontrolle, kein Fremd-Build)

Mit [Planetiler](https://github.com/onthegomap/planetiler) und dem
Protomaps-Basemaps-Profil aus dem bereits vorhandenen Bayern-PBF:

```bash
# protomaps/basemaps-Profil (erzeugt das passende Schema)
git clone https://github.com/protomaps/basemaps && cd basemaps
# Bayern-PBF (dasselbe wie fürs Ingest) reinreichen:
java -jar planetiler.jar --profile=protomaps \
  --osm-path=bayern-latest.osm.pbf --output=bayern.pmtiles --maxzoom=14
```

## 2. Glyphs (Beschriftung) beschaffen

`style.json` nutzt den Font-Stack **„Noto Sans Regular"**. Vorgerenderte
Glyph-Pakete (`{fontstack}/{range}.pbf`) liegen z.B. im Repo
[`protomaps/basemaps-assets`](https://github.com/protomaps/basemaps-assets)
unter `fonts/`. Den Ordner `fonts/` mit hochladen (siehe unten). Alternativ mit
[`fontnik`](https://github.com/mapbox/node-fontnik) aus einer `.ttf` selbst
erzeugen.

Willst du zunächst ohne Labels starten: `PUBLIC_GLYPHS_URL` leer lassen — die
Label-Layer werden dann automatisch weggelassen.

## 3. Auf BunnyCDN hochladen

1. In Bunny eine **Storage Zone** anlegen und eine **Pull/CDN Zone** damit
   verbinden (liefert eine `…​.b-cdn.net`-URL).
2. Hochladen:
   - `bayern.pmtiles` → z.B. `basemap/bayern.pmtiles`
   - `fonts/` (die Glyph-`.pbf`) → z.B. `basemap/fonts/…`
3. **CORS** an der Zone aktivieren (der Browser lädt die `.pmtiles`
   cross-origin per Range-Request): erlaube deine Web-Origin (z.B.
   `https://atomar.org`) und die Header/Methoden `GET, HEAD, Range`.
   Bunny liefert Range-Requests standardmäßig aus — nur CORS muss passen.

## 4. Verdrahten

In `.env` setzen (Build-Zeit-Variablen → beim `docker compose build web`
eingebacken):

```dotenv
PUBLIC_PMTILES_URL=https://DEINE-ZONE.b-cdn.net/basemap/bayern.pmtiles
PUBLIC_GLYPHS_URL=https://DEINE-ZONE.b-cdn.net/basemap/fonts/{fontstack}/{range}.pbf
```

Dann:

```bash
docker compose build web && docker compose up -d web
```

Fertig: dunkle, selbst gehostete Bayern-Basemap. Die ODbL-Attribution
(„© OpenStreetMap-Mitwirkende") ist in `style.json` gesetzt und erscheint über
die MapLibre-Attribution-Control.

## Optik anpassen

`web/public/basemap/style.json` direkt editieren — Farben, Linienbreiten,
welche `places`-`kind`s beschriftet werden. Leitlinie: die Karte ist
**Hintergrund**, kein Hauptdarsteller. Straßen dünn, Labels dezent grau, keine
POI-Icons. Die Akzentfarbe Pink gehört den Objekten, nicht der Basemap.
