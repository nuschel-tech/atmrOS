/**
 * Plausible Analytics wiring for atmrOS.
 *
 * Uses the maintained `@barbapapazes/plausible-tracker` npm package
 * (no <script> tag needed). Site domain and API host are hardcoded below.
 *
 * Tracking is disabled under `vite dev` (SvelteKit's `dev` flag), so local
 * development is silent; production builds track. Note: the tracker's own
 * `ignoredHostnames` check runs against the *configured* domain, not the
 * browser hostname, so with a hardcoded domain it can't gate dev for us —
 * we gate on `dev` instead.
 */
import { createPlausibleTracker } from '@barbapapazes/plausible-tracker';
import { useAutoPageviews } from '@barbapapazes/plausible-tracker/extensions';
import { dev } from '$app/environment';

/** Tracked site domain (Plausible "site"). */
const DOMAIN = 'atomar.org';
/** Self-hosted Plausible instance (MultaEnhavo). */
const API_HOST = 'https://analytics.multaenhavo.com';

type Tracker = ReturnType<typeof createPlausibleTracker>;

let instance: Tracker | null = null;

/**
 * Initialise Plausible once, on the client, after mount.
 * Also starts automatic pageview tracking for SPA navigations.
 * Returns null (no-op) during local development.
 */
export function initAnalytics(): Tracker | null {
  if (dev) return null; // never track under `vite dev`
  if (instance) return instance;

  instance = createPlausibleTracker({
    domain: DOMAIN,
    apiHost: API_HOST,
    // atmrOS is a single-page HUD; track SPA navigations automatically.
    hashMode: false
  });

  useAutoPageviews(instance).install();
  return instance;
}

/**
 * Track a custom event, e.g. trackEvent('scanner_open').
 * No-op in development or before analytics is initialised.
 */
export function trackEvent(
  name: string,
  props?: Record<string, string | number | boolean>
): void {
  instance?.trackEvent(name, props ? { props } : undefined);
}
