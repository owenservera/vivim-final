/**
 * @module alerting
 *
 * Barrel export for the alerting subsystem.
 * Re-exports the existing {@link Alerter} together with the new
 * sliding-window, dedup, cooldown, and webhook modules.
 */

// Existing alerting core
export { Alerter } from './alerter'
// Alert cooldown tracking
export { AlertCooldown } from './cooldown'
// Alert deduplication
export { AlertDedup } from './dedup'
export type { SlidingWindowEntry } from './sliding-window'
// Sliding-window metric aggregation
export { SlidingWindow } from './sliding-window'

// Webhook delivery
export { sendWebhook } from './webhook'
