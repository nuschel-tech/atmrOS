// Simples In-Memory-Rate-Limit für /unlock: 5 Versuche / 15 Min / IP.
// Reicht für ein Single-Process-SSR (Node standalone). Kein externer Store nötig.

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function rateLimit(ip: string): { ok: boolean; retryMinutes: number } {
  const t = Date.now();
  const b = buckets.get(ip);
  if (!b || t > b.resetAt) {
    buckets.set(ip, { count: 1, resetAt: t + WINDOW_MS });
    return { ok: true, retryMinutes: 0 };
  }
  b.count += 1;
  if (b.count > MAX_ATTEMPTS) {
    return { ok: false, retryMinutes: Math.ceil((b.resetAt - t) / 60000) };
  }
  return { ok: true, retryMinutes: 0 };
}

// Client-IP hinter dem Nginx Proxy Manager: erste Adresse aus X-Forwarded-For.
export function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
