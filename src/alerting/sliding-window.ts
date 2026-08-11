/**
 * @module alerting/sliding-window
 *
 * Generic sliding-window data structure for metric aggregation.
 * Entries are timestamped and automatically pruned when they fall
 * outside the configured window.
 *
 * @example
 * ```ts
 * const w = new SlidingWindow(60_000);
 * w.add(Date.now(), 42);
 * w.add(Date.now(), 58);
 * console.log(w.compute(Date.now(), 'avg')); // 50
 * ```
 */

// -- Types -------------------------------------------------------------------

/** A single timestamped entry in the sliding window. */
export interface SlidingWindowEntry {
  /** Epoch-ms timestamp of the entry. */
  ts: number;
  /** Numeric value (latency, count, etc.). */
  value: number;
}

// -- Implementation -----------------------------------------------------------

/**
 * Fixed-duration sliding window for metric aggregation.
 *
 * The window keeps entries in insertion order and prunes stale entries
 * lazily on every {@link add} and {@link compute} call.
 */
export class SlidingWindow {
  private readonly entries: SlidingWindowEntry[] = [];
  private readonly windowMs: number;

  /**
   * @param windowMs - Width of the sliding window in milliseconds.
   */
  constructor(windowMs: number) {
    if (windowMs <= 0) {
      throw new RangeError(`windowMs must be > 0, got ${windowMs}`);
    }
    this.windowMs = windowMs;
  }

  /**
   * Add a value to the window and prune stale entries.
   *
   * @param ts    - Epoch-ms timestamp of the measurement.
   * @param value - Numeric metric value.
   */
  add(ts: number, value: number): void {
    this.entries.push({ ts, value });
    this.prune(ts);
  }

  /**
   * Remove entries whose timestamp is outside the window relative to `now`.
   */
  private prune(now: number): void {
    const cutoff = now - this.windowMs;
    // Entries are appended in order, so we can shift from the front.
    while (this.entries.length > 0 && this.entries[0].ts < cutoff) {
      this.entries.shift();
    }
  }

  /**
   * Compute an aggregated metric over the current window.
   *
   * @param ts     - The reference timestamp (treated as "now" for pruning).
   * @param metric - The aggregation function to apply.
   * @returns The computed value, or `0` when the window is empty.
   */
  compute(ts: number, metric: 'avg' | 'max' | 'min' | 'count' | 'sum'): number {
    this.prune(ts);

    if (this.entries.length === 0) return 0;

    switch (metric) {
      case 'count':
        return this.entries.length;

      case 'sum': {
        let total = 0;
        for (let i = 0; i < this.entries.length; i++) {
          total += this.entries[i].value;
        }
        return total;
      }

      case 'avg': {
        let total = 0;
        for (let i = 0; i < this.entries.length; i++) {
          total += this.entries[i].value;
        }
        return total / this.entries.length;
      }

      case 'max': {
        let m = -Infinity;
        for (let i = 0; i < this.entries.length; i++) {
          if (this.entries[i].value > m) m = this.entries[i].value;
        }
        return m;
      }

      case 'min': {
        let m = Infinity;
        for (let i = 0; i < this.entries.length; i++) {
          if (this.entries[i].value < m) m = this.entries[i].value;
        }
        return m;
      }
    }
  }

  /**
   * Return the number of entries currently inside the window
   * (after pruning relative to the latest entry's timestamp).
   */
  size(): number {
    if (this.entries.length > 0) {
      this.prune(this.entries[this.entries.length - 1].ts);
    }
    return this.entries.length;
  }

  /**
   * Remove all entries from the window.
   */
  clear(): void {
    this.entries.length = 0;
  }
}
