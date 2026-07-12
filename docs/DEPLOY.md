# Deployment: atmrOS auf atomar.org

Alles läuft **unter einer Domain** (`atomar.org`) — kein Subdomain:
- `https://atomar.org` → Frontend (Astro SSR)
- `https://atomar.org/api` → API (FastAPI)

Single-Origin heißt: das Login-Cookie fliegt automatisch mit, kein CORS, keine
Cookie-Domain. Fast alles ist in `.env.example` / `docker-compose.yml` schon auf
atomar.org und dein CDN vorbelegt — du musst praktisch nur **zwei Secrets**
erzeugen und den Proxy einrichten.

Dienste (siehe `docker-compose.yml`): `db` (PostGIS) · `api` (FastAPI unter
`/api`) · `web` (Astro SSR) · `ingest` (Einmal-Job).

---

## 0. Voraussetzungen

- Docker + Docker Compose auf dem Server.
- Nginx Proxy Manager (NPM) läuft bereits (für TLS).
- DNS: `atomar.org` (und optional `www.atomar.org`) zeigt auf die Server-IP.
- Basemap/Fonts liegen bereits auf `static.multaenhavo.com` (verifiziert:
  erreichbar, CORS offen, Range-fähig) — dazu ist nichts mehr zu tun.

## 1. Repo holen & `.env` anlegen

```bash
git clone <REPO-URL> atmros && cd atmros
git checkout claude/claude-md-first-pass-y1uz40
cp .env.example .env
```

Die `.env` ist bereits auf atomar.org + dein CDN vorbelegt. **Drei Werte**
setzen/prüfen:

```bash
openssl rand -hex 32
```
→ `ATMROS_SESSION_SECRET=...` (wird von web UND api geteilt).

```bash
docker run --rm httpd:2.4 htpasswd -nbBC 12 x 'DEIN-PASSWORT' | cut -d: -f2
```
→ `ATMROS_UNLOCK_PASSWORD_HASH='$2y$12$...'`  (in **einfachen** Anführungszeichen,
damit Compose die `$` nicht interpretiert).

Und ein ordentliches `POSTGRES_PASSWORD=...`.

`ATMROS_LAUNCHED=false` lassen — bis zum Launch zeigt die Seite Coming-soon.

## 2. Bauen & starten

```bash
docker compose build
docker compose up -d db api web
```

Sanity-Check (die API läuft unter `/api`):

```bash
docker compose ps
curl -s http://localhost:8000/api/health      # -> {"status":"ok"}
```

## 3. Daten laden (die Kette einmal laufen lassen)

```bash
docker compose run --rm ingest
```

Lädt das ~807-MB-Bayern-PBF, filtert, schreibt nach PostGIS (erster Lauf einige
Minuten; Log zählt pro Kategorie und meldet Peak-RAM). Ohne diesen Schritt ist
die Karte leer.

## 4. Reverse-Proxy (Nginx Proxy Manager)

**Ein** Proxy Host für `atomar.org`, plus **eine** Custom Location für die API.

Die Container heißen fix `atmros-web`, `atmros-api`, `atmros-db`. Läuft NPM im
selben Docker-Netz, kannst du direkt diese Namen als Forward-Hostname nehmen
(sonst die `<server-ip>` mit den gemappten Ports 4321/8000).

1. **Proxy Host anlegen**
   - Domain Names: `atomar.org` (ggf. `www.atomar.org`)
   - Forward Hostname/Port: `atmros-web` : `4321`  (bzw. `<server-ip>` : `4321`)
   - Tab **SSL**: Let's-Encrypt-Zertifikat, „Force SSL" + „HTTP/2" an
   - „Block Common Exploits" an; Websockets nicht nötig

2. **Custom Location für die API** (im selben Proxy Host, Tab „Custom locations")
   - Location: `/api`
   - Scheme: `http`
   - Forward Hostname/IP: `atmros-api`  (bzw. `<server-ip>`)
   - Forward Port: `8000`

   Das erzeugt `location /api { proxy_pass http://…:8000; }` — der Pfad `/api`
   bleibt erhalten, und die API bedient genau `/api/...` (via `ATMROS_API_ROOT_PATH`).
   **Kein** Rewrite/Strip nötig.

> Sicherheit: Die Ports 4321/8000 sollen nur über NPM erreichbar sein. Läuft NPM
> auf demselben Host, per Firewall 4321/8000 von außen sperren — oder NPM und
> atmrOS ins selbe Docker-Netz hängen und auf `atmros-web:4321` /
> `atmros-api:8000` forwarden.

## 5. Einloggen

1. `https://atomar.org` → **Coming-soon-Seite** (SYSTEM WIRD HOCHGEFAHREN).
2. `https://atomar.org/unlock` → Passwort eingeben.
3. Erfolg → Weiterleitung auf `/`, volle App: dunkle Bayern-Karte (Basemap vom
   CDN) + Infrastruktur-Punkte, Klick → Profiler-Panel mit Quelle.

Sitzung 30 Tage (signiertes Cookie). `…/lock` beendet sie. Die `/unlock`-URL
steht nirgends in der Coming-soon-Seite — nur du kennst sie.

## 6. Launch-Tag

Freischalten für alle — **ohne Rebuild**, nur Neustart:

```bash
# in .env:
ATMROS_LAUNCHED=true

docker compose up -d web api
```

Ab jetzt zeigt `https://atomar.org` direkt die App.

---

## Was wann neu gebaut werden muss

- **Frontend-Code/Style oder ein `PUBLIC_*` geändert** → web neu bauen
  (PUBLIC_* werden zur Build-Zeit eingebacken):
  `docker compose build web && docker compose up -d web`
- **Nur Gate-Secrets** (`ATMROS_LAUNCHED`, `…_SESSION_SECRET`, `…_PASSWORD_HASH`)
  → **kein** Rebuild, nur `docker compose up -d web api`.
- **API-Code** → `docker compose build api && docker compose up -d api`.
- **Frische Daten** → `docker compose run --rm ingest` (später systemd-Timer = Schritt 2).

## Troubleshooting

- **Nach `/unlock` wieder Coming-soon / bleibe ausgeloggt.** (a) Zugriff über
  **HTTPS**? Das Cookie ist `Secure`, über `http://` bleibt es aus. (b)
  `ATMROS_SESSION_SECRET` in web und api **identisch**? (c) Läuft die API
  wirklich unter `/api` (Custom Location gesetzt, `curl …/api/health` grün)?
- **Karte leer / Panel lädt nicht.** (a) `curl https://atomar.org/api/stats`
  ohne Cookie muss `401` liefern (Gate aktiv) — kommt `404`, greift die
  `/api`-Location nicht. (b) Lief `ingest` schon? (c) web nach einer
  `PUBLIC_*`-Änderung neu gebaut?
- **Basemap/Beschriftung fehlt.** `static.multaenhavo.com`-URLs erreichbar? Der
  Style nutzt den Fontstack „Noto Sans Regular" — muss unter
  `…/fonts/Noto%20Sans%20Regular/{range}.pbf` liegen (tut er).
- **`ingest`: „No space left on device".** PBF + Index brauchen Platz auf dem
  `/data`-Volume; Server-Disk prüfen.
- **RAM knapp beim Ingest (4-GB-Host).** Default `sparse_file_array` lassen.
