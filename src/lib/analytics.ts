/**
 * Plausible Analytics wiring for atmrOS.
 *
 * Uses the `plausible-tracker` npm package (no <script> tag needed).
 * Site domain and API host are baked in below; localhost is never tracked
 * (plausible-tracker ignores it by default), so development stays silent.
 *
 * Both defaults can be overridden via public env vars (see .env.example):
 *   PUBLIC_PLAUSIBLE_DOMAIN    override the tracked site domain
 *   PUBLIC_PLAUSIBLE_API_HOST  override the Plausible instance
 */
import Plausible from 'plausible-tracker';
import { env } from '$env/dynamic/public';

/** Tracked site domain. Override via env if needed. */
const DEFAULT_DOMAIN = 'atomar.org';
/** Self-hosted Plausible instance (MultaEnhavo). Override via env if needed. */
const DEFAULT_API_HOST = 'https://analytics.multaenhavo.com';

type Plausible = ReturnType<typeof Plausible>;

let instance: Plausible | null = null;

/**
 * Initialise Plausible once, on the client, after mount.
 * Returns the tracker instance.
 */
export function initAnalytics(): Plausible | null {
  if (instance) return instance;

  instance = Plausible({
    domain: env.PUBLIC_PLAUSIBLE_DOMAIN?.trim() || DEFAULT_DOMAIN,
    apiHost: env.PUBLIC_PLAUSIBLE_API_HOST?.trim() || DEFAULT_API_HOST,
    // atmrOS is a single-page HUD; track SPA navigations automatically.
    hashMode: false
  });

  instance.enableAutoPageviews();
  return instance;
}

/**
 * Track a custom event, e.g. trackEvent('scanner_open').
 * No-op when analytics is disabled.
 */
export function trackEvent(
  name: string,
  props?: Record<string, string | number | boolean>
): void {
  instance?.trackEvent(name, props ? { props } : undefined);
}
