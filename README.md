# atmrOS

> Real World · Open Data · Community Grid — a MultaEnhavo project.

Display frontend for atmrOS, built with **SvelteKit**. Data collection happens
elsewhere (scanner hardware → API); this app is the map/dashboard/HUD that
_shows_ the data.

## Stack

- **SvelteKit 2** + **Svelte 5** (runes) + **Vite 5** + **TypeScript**
- `@sveltejs/adapter-auto` (auto-detects Vercel / Netlify / Node on deploy)
- **plausible-tracker** for privacy-friendly analytics (off by default)

## Getting started

```bash
npm install
cp .env.example .env   # optional, only needed to turn features on
npm run dev            # http://localhost:5173
```

Other scripts:

```bash
npm run build      # production build
npm run preview    # serve the production build locally
npm run check      # type-check (svelte-check)
```

## Project structure

```
src/
  app.html              app shell (loads the JBM font stylesheet)
  routes/
    +layout.svelte      root layout — initialises analytics on mount
    +page.svelte        landing / HUD page (ported from the original design)
  lib/
    analytics.ts        Plausible wiring (env-driven, inert until configured)
    hud.ts              boot sequence + animated canvases + live feed
    hud.css             the HUD/CRT/neon design system
static/
  favicon.svg
  fonts/jbm.css         JetBrains Mono, embedded as base64 (self-hosted)
reference/
  original-index.html   the original standalone HTML this app was ported from
```

## Analytics (Plausible)

Wired via the `plausible-tracker` npm package — **no third-party `<script>`
tag**. Domain and instance are baked in, so it works out of the box:

- **domain:** `atomar.org`
- **API host:** `https://analytics.multaenhavo.com` (self-hosted, MultaEnhavo)

Localhost is never tracked (plausible-tracker ignores it by default), so
**development stays silent** automatically. Both defaults are overridable at
runtime via env vars (`$env/dynamic/public`, no rebuild needed):

```bash
# only if you ever need to override the built-ins
PUBLIC_PLAUSIBLE_DOMAIN=atomar.org
PUBLIC_PLAUSIBLE_API_HOST=https://analytics.multaenhavo.com
```

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
