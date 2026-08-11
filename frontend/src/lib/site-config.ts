/**
 * lib/site-config.ts
 * ----------------------------------------------------------------
 * Single source of truth for site-wide configuration values.
 * Imported by layout.tsx, sitemap.ts, robots.ts, JsonLd.tsx, etc.
 */

export const SITE_HOST = process.env.SITE_HOST ?? 'http://localhost:3000'
export const SITE_NAME = 'Vivim'
export const SITE_DESCRIPTION =
  'Plugin-based, hot-swappable, live-configurable UI system. The interface is data, not code.'
