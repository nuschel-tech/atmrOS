import { defineConfig } from "astro/config";
import node from "@astrojs/node";

// SSR (Node-Adapter) statt statisch — nötig fürs serverseitige Login-Gate:
// die Middleware entscheidet pro Request, ob die App oder die Coming-soon-Seite
// ausgeliefert wird. Ein reines Frontend-Gate würde die Daten leaken.
export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  server: { host: true, port: 4321 },
});
