// Serverseitiges Login-Gate. Läuft pro Request VOR jeder Route.
//   ATMROS_LAUNCHED=true            -> App für alle (Gate aus)
//   gültiges Cookie atmros_session  -> App durchlassen
//   sonst                           -> Coming-soon-Seite
// Nur /unlock und /lock sind im gesperrten Zustand erreichbar; alles andere
// (inkl. der App-Assets unter /_astro) bleibt hinter dem Gate — die Coming-
// soon-Seite ist voll selbst-enthalten und braucht keine Assets.

import { defineMiddleware } from "astro:middleware";

import { comingSoonHtml } from "./lib/comingsoon";
import { verifySession } from "./lib/session";

// /fonts: self-gehostete Roboto-woff2 — auch im gesperrten Zustand nötig
// (Coming-soon- und /unlock-Seite laden sie per @font-face).
const ALLOW = ["/unlock", "/lock", "/fonts"];

export const onRequest = defineMiddleware((context, next) => {
  if (process.env.ATMROS_LAUNCHED === "true") return next();

  const path = new URL(context.request.url).pathname;
  if (ALLOW.some((p) => path === p || path.startsWith(p + "/"))) return next();

  const cookie = context.cookies.get("atmros_session")?.value;
  if (verifySession(process.env.ATMROS_SESSION_SECRET ?? "", cookie)) return next();

  return new Response(comingSoonHtml(), {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
});
