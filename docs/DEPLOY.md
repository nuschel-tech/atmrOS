# Deployment: atmrOS auf dem eigenen Server

Ziel: Stack läuft auf dem Hetzner hinter dem Nginx Proxy Manager (NPM). Du
siehst öffentlich die **Coming-soon-Seite**, kannst dich über `/unlock`
einloggen und die volle App sehen. Am Launch-Tag legst du einen Schalter um.

Der Stack besteht aus vier Diensten (siehe `docker-compose.yml`):
`db` (PostGIS) · `api` (FastAPI) · `web` (Astro SSR) · `ingest` (Einmal-Job).

---

## 0. Voraussetzungen

- Docker + Docker Compose auf dem Server.
- Der Nginx Proxy Manager läuft bereits (für TLS/HTTPS).
- Zwei DNS-Einträge auf die Server-IP, z.B.
  - `map.DEINE-DOMAIN` → Frontend
  - `api.DEINE-DOMAIN` → API

  (Namen frei wählbar. Wichtig: **beide auf derselben Registrable-Domain**
  `DEINE-DOMAIN` — sonst wird das Session-Cookie nicht an die API geschickt.)

## 1. Repo holen

```bash
git clone <REPO-URL> atmros && cd atmros
git checkout claude/claude-md-first-pass-y1uz40
```

## 2. `.env` anlegen

```bash
cp .env.example .env
```

Dann `.env` bearbeiten. Die drei Dinge, die wirklich zählen:

**a) Zufälligen Session-Secret erzeugen** (gleich für web UND api):

```bash
openssl rand -hex 32
```
→ als `ATMROS_SESSION_SECRET=...` eintragen.

**b) Passwort-Hash erzeugen** (bcrypt, NICHT das Klartext-Passwort):

```bash
docker run --rm httpd:2.4 htpasswd -nbBC 12 x 'DEIN-PASSWORT' | cut -d: -f2
```
→ als `ATMROS_UNLOCK_PASSWORD_HASH=...` eintragen (beginnt mit `$2y$`).

> Achtung: In `.env` das `$` nicht escapen und den Wert am besten in einfache
> Anführungszeichen setzen, damit Compose nichts interpoliert:
> `ATMROS_UNLOCK_PASSWORD_HASH='$2y$12$....'`

**c) Domains verdrahten** — in `.env`:

```dotenv
# Startzustand: gesperrt -> Coming-soon. Am Launch-Tag auf true.
ATMROS_LAUNCHED=false

# öffentliche API-URL, wie der BROWSER sie erreicht (Build-Zeit!)
PUBLIC_API_BASE=https://api.DEINE-DOMAIN

# CORS: exakte Web-Origin (kein "*" mit Cookie)
ATMROS_CORS_ORIGINS=https://map.DEINE-DOMAIN

# Cookie für beide Subdomains derselben Site gültig machen
ATMROS_COOKIE_DOMAIN=.DEINE-DOMAIN

# DB-Passwort setzen
POSTGRES_PASSWORD=<etwas-langes>
```

Die Basemap (`PUBLIC_PMTILES_URL`, `PUBLIC_GLYPHS_URL`) kannst du fürs Erste
**leer lassen** — dann zeigt die Karte einen dunklen Hintergrund, die
Infrastruktur-Punkte sind trotzdem da. Das Aufsetzen der eigenen Kacheln steht
in [`BASEMAP.md`](./BASEMAP.md) und kann jederzeit später passieren.

## 3. Bauen & starten

```bash
docker compose build          # baut api + web (PUBLIC_* werden ins web-Bundle gebacken)
docker compose up -d db api web
```

Kurz prüfen:

```bash
docker compose ps
curl -s http://localhost:8000/health      # -> {"status":"ok"}
```

## 4. Daten laden (die Kette einmal laufen lassen)

```bash
docker compose run --rm ingest
```

Das lädt das ~807-MB-Bayern-PBF, filtert und schreibt nach PostGIS. Erster Lauf
dauert einige Minuten; das Log zählt pro Kategorie mit und meldet am Ende Peak-RAM.
Ohne diesen Schritt ist die Karte leer.

## 5. Reverse-Proxy (Nginx Proxy Manager)

Zwei **Proxy Hosts** anlegen, beide mit SSL (Let's Encrypt, „Force SSL" an):

| Domain | Forward Hostname / Port |
|--------|-------------------------|
| `map.DEINE-DOMAIN` | `<server-ip>` : `4321` |
| `api.DEINE-DOMAIN` | `<server-ip>` : `8000` |

- „Block Common Exploits" an, „Websockets" nicht nötig.
- NPM setzt `X-Forwarded-For`/`-Proto` automatisch — braucht die Rate-Limit-
  und die Secure-Cookie-Logik.

> Sicherheit: Die Ports 4321/8000 sollten **nur** über NPM erreichbar sein.
> Entweder NPM läuft auf demselben Host (dann per Firewall 4321/8000 von außen
> sperren) oder du hängst NPM und atmrOS ins selbe Docker-Netz und forwardest
> auf `web:4321` / `api:8000` statt auf die Server-IP.

## 6. Einloggen

1. `https://map.DEINE-DOMAIN` öffnen → **Coming-soon-Seite** (SYSTEM WIRD
   HOCHGEFAHREN).
2. `https://map.DEINE-DOMAIN/unlock` öffnen → Passwort eingeben.
3. Bei Erfolg wirst du auf `/` weitergeleitet und siehst die volle App:
   dunkle Karte, Infrastruktur-Punkte, Klick → Profiler-Panel mit Quelle.

Die Sitzung hält 30 Tage (signiertes Cookie). `…/lock` beendet sie wieder.
Die `/unlock`-URL taucht nirgends in der Coming-soon-Seite auf — nur du kennst sie.

## 7. Launch-Tag

App für alle freischalten — **ohne Rebuild**, nur Neustart:

```bash
# in .env:
ATMROS_LAUNCHED=true

docker compose up -d web api    # Container neu mit der neuen Env starten
```

Ab jetzt ist das Gate aus, `https://map.DEINE-DOMAIN` zeigt direkt die App.

---

## Updates & was wann neu gebaut werden muss

- **Code-/Style-Änderungen am Frontend, oder `PUBLIC_*` geändert** → das web-Bundle
  muss neu gebaut werden (PUBLIC_* werden zur Build-Zeit eingebacken):
  ```bash
  docker compose build web && docker compose up -d web
  ```
- **Nur Gate-Secrets geändert** (`ATMROS_LAUNCHED`, `…_SESSION_SECRET`,
  `…_PASSWORD_HASH`, `…_COOKIE_DOMAIN`) → **kein** Rebuild, nur Neustart:
  ```bash
  docker compose up -d web api
  ```
- **API-Code geändert** → `docker compose build api && docker compose up -d api`.
- **Frische Daten** → `docker compose run --rm ingest` (später per systemd-Timer,
  das ist Schritt 2).

## Troubleshooting

- **Nach `/unlock` lande ich wieder auf Coming-soon / bleibe ausgeloggt.**
  Fast immer das Cookie: (a) Zugriff über **HTTPS** (das Cookie ist `Secure`)?
  (b) `ATMROS_COOKIE_DOMAIN=.DEINE-DOMAIN` gesetzt und web+api auf Subdomains
  **derselben** Domain? (c) `ATMROS_SESSION_SECRET` in web und api **identisch**?
- **Karte bleibt leer, Panel lädt nicht, Netzwerk-Fehler auf die API.**
  (a) `PUBLIC_API_BASE` auf die echte `https://api.…`-URL gesetzt und web
  **neu gebaut**? (b) `ATMROS_CORS_ORIGINS` == exakt `https://map.…` (mit https,
  ohne Slash am Ende)? (c) Lief der `ingest`-Job schon?
- **`ingest` bricht mit „No space left on device" ab.** PBF + Index brauchen
  Platz auf dem `/data`-Volume; Server-Disk prüfen.
- **RAM knapp beim Ingest (4-GB-Host).** Default `ATMROS_OSM_INDEX=sparse_file_array`
  belassen (RAM-schonend). `flex_mem` ist schneller, braucht aber ~2,1 GB.
