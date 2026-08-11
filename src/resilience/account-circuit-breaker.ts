/**
 * @module resilience/account-circuit-breaker
 *
 * Per-account circuit breaker with sliding-window failure tracking and
 * exponential cooldown backoff (with jitter).  Designed to sit alongside
 * the general-purpose `circuit-breaker.ts` and provide account-scoped
 * protection against cascading failures.
 *
 * @example
 * ```ts
 * const breaker = new AccountCircuitBreaker();
 *
 * try {
 *   breaker.assertCanProceed('acc:123');
 *   await callProvider('acc:123');
 *   breaker.recordSuccess('acc:123');
 * } catch (err) {
 *   if (err instanceof CircuitOpenError) {
 *     // schedule retry after err.retryAfterMs
 *   }
 *   breaker.recordFailure('acc:123');
 * }
 * ```
 */

// -- Types -------------------------------------------------------------------

/** Possible states of a single account's circuit breaker. */
export type BreakerState = 'closed' | 'open' | 'half-open'

/** Configuration knobs for the per-account circuit breaker. */
export interface AccountBreakerConfig {
  /** Number of failures inside the sliding window before the circuit opens. */
  threshold: number;
  /** Width of the sliding window in milliseconds. */
  windowMs: number;
  /** Initial cooldown after the circuit opens (ms). */
  cooldownMs: number;
  /** Multiplier applied to the cooldown on each successive re-open. */
  cooldownBackoffMultiplier: number;
  /** Absolute ceiling for the backoff-cooled cooldown (ms). */
  maxCooldownMs: number;
}

/** Thrown by {@link AccountCircuitBreaker.assertCanProceed} when the circuit is open. */
export class CircuitOpenError extends Error {
  /** Suggested retry delay in milliseconds. */
  public readonly retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super(`Circuit open — retry after ${retryAfterMs}ms`);
    this.name = 'CircuitOpenError';
    this.retryAfterMs = retryAfterMs;
  }
}

// -- Internal slot type ------------------------------------------------------

interface AccountSlot {
  state: BreakerState;
  failures: Array<{ timestamp: number }>;
  openedAt: number | null;
  currentCooldownMs: number;
}

// -- Implementation -----------------------------------------------------------

/**
 * Per-account circuit breaker with sliding-window failure tracking and
 * exponential cooldown backoff (+-20 % jitter).
 *
 * Each account key (e.g. `"acc:stripe:123"`) is tracked independently so that
 * one misbehaving account does not affect the others.
 */
export class AccountCircuitBreaker {
  private readonly accounts = new Map<string, AccountSlot>();
  private readonly config: AccountBreakerConfig;

  /**
 * @param config  Override any subset of the default configuration.
 * @defaultconfig `{ threshold: 4, windowMs: 60_000, cooldownMs: 60_000, cooldownBackoffMultiplier: 1.5, maxCooldownMs: 300_000 }`
 */
  constructor(config?: Partial<AccountBreakerConfig>) {
    this.config = {
      threshold: 4,
      windowMs: 60_000,
      cooldownMs: 60_000,
      cooldownBackoffMultiplier: 1.5,
      maxCooldownMs: 300_000,
      ...config,
    };
  }

  // -- private helpers --------------------------------------------------------

  /** Lazily create (or return existing) slot for an account key. */
  private slot(key: string): AccountSlot {
    let s = this.accounts.get(key);
    if (!s) {
      s = {
        state: 'closed',
        failures: [],
        openedAt: null,
        currentCooldownMs: this.config.cooldownMs,
      };
      this.accounts.set(key, s);
    }
    return s;
  }

  /** Remove failures that have fallen outside the sliding window. */
  private pruneFailures(s: AccountSlot, now: number): void {
    const cutoff = now - this.config.windowMs;
    // Failures are always appended in order, so we can shift from the front.
    while (s.failures.length > 0 && s.failures[0].timestamp < cutoff) {
      s.failures.shift();
    }
  }

  /**
 * Compute the next cooldown with exponential backoff and +-20 % jitter.
 * Result is clamped to `maxCooldownMs`.
 */
  private nextCooldown(current: number): number {
    const base = Math.min(
      current * this.config.cooldownBackoffMultiplier,
      this.config.maxCooldownMs,
    );
    // +-20 % jitter
    const jitter = base * 0.2;
    const jittered = base + (Math.random() * 2 - 1) * jitter;
    return Math.max(0, Math.round(Math.min(jittered, this.config.maxCooldownMs)));
  }

  // -- public API -------------------------------------------------------------

  /**
 * Assert that calls for `accountKey` are currently allowed.
 *
 * - **closed**  -> pass through.
 * - **open**    -> if cooldown has elapsed, transition to **half-open** and allow;
 *                otherwise throw {@link CircuitOpenError}.
 * - **half-open** -> allow (single-probe mode).
 *
 * @throws {CircuitOpenError} When the circuit is open and the cooldown has not elapsed.
 */
  assertCanProceed(accountKey: string): void {
    const s = this.slot(accountKey);
    const now = Date.now();

    if (s.state === 'open') {
      if (s.openedAt === null) {
        // Defensive: should never happen, but recover gracefully.
        s.state = 'closed';
        return;
      }

      const elapsed = now - s.openedAt;
      if (elapsed >= s.currentCooldownMs) {
        // Cooldown elapsed — transition to half-open to allow a single probe.
        s.state = 'half-open';
        return;
      }

      const retryAfter = s.currentCooldownMs - elapsed;
      throw new CircuitOpenError(retryAfter);
    }

    // closed or half-open — allow
  }

  /**
 * Record a successful call for `accountKey`.
 *
 * Resets the failure window, transitions to **closed**, and restores the
 * cooldown to its initial value.
 */
  recordSuccess(accountKey: string): void {
    const s = this.slot(accountKey);
    s.failures = [];
    s.state = 'closed';
    s.openedAt = null;
    s.currentCooldownMs = this.config.cooldownMs;
  }

  /**
 * Record a failed call for `accountKey`.
 *
 * Behaviour depends on current state:
 * - **half-open** → immediately re-open with increased cooldown (backoff + jitter).
 * - **closed**   → append timestamped failure, prune old entries.
 *               If `failures.length >= threshold` the circuit opens.
 */
  recordFailure(accountKey: string): void {
    const s = this.slot(accountKey);
    const now = Date.now();

    if (s.state === 'half-open') {
      // Re-open with backoff + jitter
      s.state = 'open';
      s.openedAt = now;
      s.currentCooldownMs = this.nextCooldown(s.currentCooldownMs);
      return;
    }

    // closed state — record and evaluate
    s.failures.push({ timestamp: now });
    this.pruneFailures(s, now);

    if (s.failures.length >= this.config.threshold) {
      s.state = 'open';
      s.openedAt = now;
      // Keep currentCooldownMs as-is on first open (it is already the initial value)
    }
  }

  /**
 * Return the current {@link BreakerState} for `accountKey`.
 * Returns `'closed'` for unknown keys (they have not failed yet).
 */
  getState(accountKey: string): BreakerState {
    return this.accounts.get(accountKey)?.state ?? 'closed';
  }

  /**
 * Return the number of milliseconds until the circuit for `accountKey`
 * may transition from **open** to **half-open**.
 *
 * Returns `0` when the circuit is **not** open.
 */
  getRetryAfterMs(accountKey: string): number {
    const s = this.accounts.get(accountKey);
    if (!s || s.state !== 'open' || s.openedAt === null) return 0;

    const elapsed = Date.now() - s.openedAt;
    const remaining = s.currentCooldownMs - elapsed;
    return remaining > 0 ? remaining : 0;
  }

  /**
 * Manually reset the circuit breaker for `accountKey` to the **closed** state,
 * clearing all failure history and restoring the initial cooldown.
 */
  reset(accountKey: string): void {
    this.accounts.delete(accountKey);
  }

  /**
 * Return a snapshot of every tracked account's current state.
 *
 * Useful for diagnostics dashboards and observability endpoints.
 */
  getAll(): Map<string, BreakerState> {
    const result = new Map<string, BreakerState>();
    for (const [key, s] of this.accounts) {
      result.set(key, s.state);
    }
    return result;
  }
}
