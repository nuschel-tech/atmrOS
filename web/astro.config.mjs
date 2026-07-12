import { defineConfig } from "astro/config";

// Statische Site — die Karte ist eine SPA, die zur Laufzeit die atmrOS-API
// abfragt. Kein SSR nötig; passt hinter den bestehenden Nginx Proxy Manager.
export default defineConfig({
  server: { host: true, port: 4321 },
});
