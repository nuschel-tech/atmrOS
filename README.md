# atmrOS

> Real World · Open Data · Community Grid — a MultaEnhavo project.

Display frontend for atmrOS, built with **SvelteKit**. Data collection happens
elsewhere (scanner hardware → API); this app is the map/dashboard/HUD that
_shows_ the data.

## Stack

- **SvelteKit 2** + **Svelte 5** (runes) + **Vite 8** + **TypeScript**
- `@sveltejs/adapter-static` — prerenders to plain HTML/CSS/JS
- **@barbapapazes/plausible-tracker** for privacy-friendly analytics

## Getting started

```bash
npm install
cp .env.example .env   # optional, only needed to turn features on
npm run dev            # http://localhost:5173
```

Other scripts:

```bash
npm run build      # static build -> /var/www/atomar (see below)
npm run preview    # serve the production build locally
npm run check      # type-check (svelte-check)
```

## Building / deploying

The app builds to a **static site** (adapter-static, everything prerendered),
so any web server can serve it. The output directory defaults to the VPS web
root `/var/www/atomar`:

```bash
npm run build            # writes the site into /var/www/atomar
```

The build user needs write access to that directory (e.g. `sudo chown -R $USER
/var/www/atomar` once, or run the build as a user that owns it). To build
somewhere else — e.g. for local testing — set `BUILD_OUT_DIR`:

```bash
BUILD_OUT_DIR=./build npm run build
```

Point your web server (nginx/Apache) at the output directory and serve
`index.html` as the root document. No Node runtime is required to serve it.

## Project structure

```
src/
  app.html              app shell (loads the JBM font stylesheet)
  routes/
    +layout.svelte      root layout — initialises analytics on mount
    +page.svelte        landing / HUD page (ported from the original design)
    +layout.ts          enables prerendering (static build)
  lib/
    analytics.ts        Plausible wiring (hardcoded domain/host, silent in dev)
    hud.ts              boot sequence + animated canvases + live feed
    hud.css             the HUD/CRT/neon design system
static/
  favicon.svg
  fonts/jbm.css         JetBrains Mono, embedded as base64 (self-hosted)
reference/
  original-index.html   the original standalone HTML this app was ported from
```

## Analytics (Plausible)

Wired via the maintained `@barbapapazes/plausible-tracker` npm package —
**no third-party `<script>` tag**. Domain and instance are baked in, so it
works out of the box:

- **domain:** `atomar.org`
- **API host:** `https://analytics.multaenhavo.com` (self-hosted, MultaEnhavo)

Tracking is disabled under `npm run dev` (via SvelteKit's `dev` flag), so
**local development stays silent**; production builds track. To change the
domain or host, edit the two constants at the top of `src/lib/analytics.ts`.

Track custom events anywhere in the app:

```ts
import { trackEvent } from '$lib/analytics';
trackEvent('scanner_open');
```

## Roadmap (per feature list)

- **Map** — MapLibre GL JS (+ deck.gl for heavy point layers): fog of war,
  GPS tracks, live planes/weather, WiFi APs, cell towers, air quality, layer toggles
- **Dashboard** — live stats fed from the API
- **Data** — public API, raw export (CSV / GeoJSON), auto-upload to
  WiGLE / OpenCellID / OSM
- **Scanner** — separate hardware companion (browsers can't scan WiFi/cell);
  posts to the API
- **Account** — admin-only area, track upload, API-key management
