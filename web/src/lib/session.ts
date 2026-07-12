// Signiertes Session-Cookie. Format:  <token>.<sig>
//   token = base64url(JSON({exp}))
//   sig   = base64url(HMAC_SHA256(secret, token))
// Bewusst simpel und sprachneutral: die FastAPI-Seite verifiziert exakt
// dasselbe Format mit demselben Secret (app/session.py), ohne geteilte Lib.

import { createHmac, timingSafeEqual } from "node:crypto";

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
  const t = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = t.length % 4 === 0 ? 0 : 4 - (t.length % 4);
  return Buffer.from(t + "=".repeat(pad), "base64");
}

function sign(secret: string, token: string): string {
  return b64url(createHmac("sha256", secret).update(token).digest());
}

const now = (): number => Math.floor(Date.now() / 1000);

export function signSession(secret: string, ttlDays: number): string {
  const token = b64url(Buffer.from(JSON.stringify({ exp: now() + ttlDays * 86400 }), "utf8"));
  return `${token}.${sign(secret, token)}`;
}

export function verifySession(secret: string, value: string | undefined): boolean {
  if (!secret || !value) return false;
  const dot = value.lastIndexOf(".");
  if (dot < 0) return false;
  const token = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = sign(secret, token);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try {
    const payload = JSON.parse(b64urlDecode(token).toString("utf8")) as { exp?: number };
    return typeof payload.exp === "number" && payload.exp > now();
  } catch {
    return false;
  }
}
