/**
 * @module alerting/dedup
 *
 * Alert deduplication — suppresses repeated alerts for the same
 * (provider, condition) pair within a configurable cooldown window.
 *
 * @example
 * ```ts
 * const dedup = new AlertDedup();
 *
 * if (dedup.isDuplicate('stripe', 'rate-limit', 60_000, Date.now())) {
 *   return; // already alerted recently
 * }
 * dedup.mark('stripe', 'rate-limit', Date.now());
 * // fire alert...
 * ```
 */

/**
 * Alert deduplication tracker.
 *
 * Maintains a map of `(providerId, conditionId)` → last-seen timestamp.
 * {@link isDuplicate} returns `true` when the same alert was seen
 * within `cooldownMs` of the supplied `now`.
 */
export class AlertDedup {
  /**
   * Internal map keyed by `"providerId|conditionId"` (or `"null|conditionId"`
   * when `providerId` is `null`).
   */
  private seen = new Map<string, number>()

  /** Build the composite key used internally. */
  private key(providerId: string | null, conditionId: string): string {
    return `${providerId ?? 'null'}|${conditionId}`
  }

  /**
   * Check whether an alert for the given (provider, condition) pair has
   * already been seen within the cooldown window.
   *
   * @param providerId  - Provider identifier (may be `null` for global alerts).
   * @param conditionId - Unique condition identifier (e.g. `"rate-limit"`).
   * @param cooldownMs  - Cooldown window in milliseconds.
   * @param now         - Current epoch-ms timestamp.
   * @returns `true` if the alert is a duplicate and should be suppressed.
   */
  isDuplicate(
    providerId: string | null,
    conditionId: string,
    cooldownMs: number,
    now: number,
  ): boolean {
    const lastSeen = this.seen.get(this.key(providerId, conditionId))
    if (lastSeen === undefined) return false
    return now - lastSeen < cooldownMs
  }

  /**
   * Record that an alert for the given (provider, condition) pair was
   * observed at the supplied timestamp.
   *
   * @param providerId  - Provider identifier (may be `null`).
   * @param conditionId - Unique condition identifier.
   * @param ts          - Epoch-ms timestamp of the alert.
   */
  mark(providerId: string | null, conditionId: string, ts: number): void {
    this.seen.set(this.key(providerId, conditionId), ts)
  }

  /**
   * Clear the dedup record for a single (provider, condition) pair.
   *
   * @param providerId  - Provider identifier (may be `null`).
   * @param conditionId - Unique condition identifier.
   */
  clear(providerId: string | null, conditionId: string): void {
    this.seen.delete(this.key(providerId, conditionId))
  }

  /**
   * Clear **all** dedup records.
   */
  clearAll(): void {
    this.seen.clear()
  }
}
