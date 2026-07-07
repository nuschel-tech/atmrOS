/**
 * Plausible Analytics wiring for atmrOS.
 *
 * Uses the `plausible-tracker` npm package (no <script> tag needed).
 * It stays completely inert until you provide a domain, so nothing is
 * loaded or sent in development or on preview builds.
 *
 * Configure via public env vars (see .env.example):
 *   PUBLIC_PLAUSIBLE_DOMAIN    e.g. "atomar.org"   -> enables tracking
 *   PUBLIC_PLAUSIBLE_API_HOST  optional; defaults to the self-hosted
 *                              instance at https://analytics.multaenhavo.com
 */

/** Self-hosted Plausible instance (MultaEnhavo). Override via env if needed. */
const DEFAULT_API_HOST = 'https://analytics.multaenhavo.com';
import Plausible from 'plausible-tracker';
import { env } from '$env/dynamic/public';

type Plausible = ReturnType<typeof Plausible>;

let instance: Plausible | null = null;

/**
 * Initialise Plausible once, on the client, after mount.
 * Returns the tracker instance, or null if analytics is disabled.
 */
export function initAnalytics(): Plausible | null {
  if (instance) return instance;

  const domain = env.PUBLIC_PLAUSIBLE_DOMAIN?.trim();
  if (!domain) return null; // analytics disabled — no domain configured

  instance = Plausible({
    domain,
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
