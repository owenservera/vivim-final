/**
 * @module alerting/cooldown
 *
 * Alert cooldown tracker — ensures that a specific (provider, condition)
 * alert is not fired more frequently than the configured cooldown.
 *
 * Unlike {@link AlertDedup}, this is a **fire-rate** limiter: it records
 * when an alert was *last fired* and gates on that, rather than on when
 * it was last *observed*.
 *
 * @example
 * ```ts
 * const cd = new AlertCooldown();
 *
 * if (!cd.canFire('stripe', 'rate-limit', 60_000, Date.now())) {
 *   return; // cooldown not elapsed
 * }
 * cd.record('stripe', 'rate-limit', Date.now());
 * // fire alert...
 * ```
 */

/**
 * Alert cooldown tracker.
 *
 * Guarantees that a given (providerId, conditionId) alert is only
 * considered fireable once per `cooldownMs` window.
 */
export class AlertCooldown {
  /**
   * Map of `"providerId|conditionId"` → epoch-ms timestamp of last fire.
   */
  private lastFired = new Map<string, number>();

  /** Build the composite key used internally. */
  private key(providerId: string | null, conditionId: string): string {
    return `${providerId ?? 'null'}|${conditionId}`;
  }

  /**
   * Determine whether the alert for the given (provider, condition) pair
   * is eligible to be fired right now.
   *
   * @param providerId  - Provider identifier (may be `null` for global alerts).
   * @param conditionId - Unique condition identifier.
   * @param cooldownMs  - Minimum interval between consecutive fires (ms).
   * @param now         - Current epoch-ms timestamp.
   * @returns `true` if the alert may be fired.
   */
  canFire(providerId: string | null, conditionId: string, cooldownMs: number, now: number): boolean {
    const last = this.lastFired.get(this.key(providerId, conditionId));
    if (last === undefined) return true;
    return (now - last) >= cooldownMs;
  }

  /**
   * Record that an alert for the given (provider, condition) pair was
   * fired at the supplied timestamp.
   *
   * @param providerId  - Provider identifier (may be `null`).
   * @param conditionId - Unique condition identifier.
   * @param ts          - Epoch-ms timestamp when the alert fired.
   */
  record(providerId: string | null, conditionId: string, ts: number): void {
    this.lastFired.set(this.key(providerId, conditionId), ts);
  }

  /**
   * Reset the cooldown for a single (provider, condition) pair,
   * allowing it to fire immediately on the next check.
   *
   * @param providerId  - Provider identifier (may be `null`).
   * @param conditionId - Unique condition identifier.
   */
  reset(providerId: string | null, conditionId: string): void {
    this.lastFired.delete(this.key(providerId, conditionId));
  }
}
