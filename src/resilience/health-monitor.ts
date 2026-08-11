/**
 * @module resilience/health-monitor
 *
 * Generic health monitoring with probe classification and event emission.
 * Periodically runs a user-supplied `probeFn` against a set of targets,
 * classifies each result as `ok`, `zombie`, or `crashed`, and emits a
 * {@link HealthEvent} for every non-ok outcome.
 *
 * @example
 * ```ts
 * const monitor = createHealthMonitor();
 *
 * monitor.start(
 *   [{ id: 'p1', name: 'provider-1', providerId: 'x', status: 'active' }],
 *   async (t) => ({
 *     pidAlive: await checkPid(t.id),
 *     endpointResponsive: await ping(t.id),
 *     latencyMs: await measureLatency(t.id),
 *   }),
 *   10_000,
 * );
 *
 * // later
 * monitor.stop();
 * console.log(monitor.getResults());
 * console.log(monitor.getEvents());
 * ```
 */

// -- Types -------------------------------------------------------------------

/** Classification result of a single health probe. */
export type ProbeClassification = 'ok' | 'zombie' | 'crashed'

/** A target to be health-checked. */
export interface HealthCheckTarget {
  /** Unique identifier for the target. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Owning provider (if applicable). */
  providerId?: string;
  /** Current status string reported by the target. */
  status: string;
  /** Arbitrary extra metadata attached to the target. */
  [key: string]: any;
}

/** Result of probing a single target. */
export interface HealthCheckResult {
  /** The target that was probed. */
  targetId: string;
  /** Probe classification. */
  classification: ProbeClassification;
  /** `true` when the target's process was alive at probe time. */
  pidAlive?: boolean;
  /** `true` when the target's HTTP endpoint responded. */
  endpointResponsive?: boolean;
  /** Round-trip latency to the endpoint (ms). */
  latencyMs?: number;
  /** Epoch-ms when the probe was performed. */
  checkedAt: number;
}

/** Emitted whenever a target transitions to a non-ok classification. */
export interface HealthEvent {
  /** Event discriminator (e.g. `"zombie"`, `"crashed"`). */
  type: string;
  /** Target identifier. */
  targetId: string;
  /** Owning provider (if known). */
  providerId?: string;
  /** Previous classification. */
  from: string;
  /** New classification. */
  to: string;
  /** Epoch-ms when the event was recorded. */
  timestamp: number;
  /** Optional extra data (latency, error message, etc.). */
  metadata?: Record<string, any>;
}

// -- Internal -----------------------------------------------------------------

interface HealthMonitorConfig {
  /** Override the default check interval (default 30 000 ms). */
  defaultIntervalMs: number;
}

interface HealthMonitorInstance {
  /** Begin periodic probing. */
  start: (
    targets: HealthCheckTarget[],
    probeFn: (target: HealthCheckTarget) => Promise<{
      pidAlive?: boolean;
      endpointResponsive?: boolean;
      latencyMs?: number;
    }>,
    intervalMs?: number,
  ) => void;
  /** Stop periodic probing and clear the timer. */
  stop: () => void;
  /** Return a snapshot of the most recent probe results per target. */
  getResults: () => HealthCheckResult[];
  /** Return all events emitted since the last {@link stop}. */
  getEvents: () => HealthEvent[];
}

// -- Classification ----------------------------------------------------------

/**
 * Classify a probe response.
 *
 * - `pidAlive` **and** `endpointResponsive` → `'ok'`
 * - `pidAlive` only → `'zombie'`
 * - neither → `'crashed'`
 */
function classify(
  pidAlive: boolean | undefined,
  endpointResponsive: boolean | undefined,
): ProbeClassification {
  if (pidAlive && endpointResponsive) return 'ok';
  if (pidAlive) return 'zombie';
  return 'crashed';
}

// -- Factory -----------------------------------------------------------------

/**
 * Create a health monitor instance.
 *
 * @param config - Optional configuration overrides.
 * @returns An object with `start`, `stop`, `getResults`, and `getEvents`.
 */
export function createHealthMonitor(config?: Partial<HealthMonitorConfig>): HealthMonitorInstance {
  const cfg: HealthMonitorConfig = {
    defaultIntervalMs: 30_000,
    ...config,
  };

  let timer: ReturnType<typeof setInterval> | null = null;
  let activeTargets: HealthCheckTarget[] = [];
  let probeFn: ((target: HealthCheckTarget) => Promise<{
    pidAlive?: boolean;
    endpointResponsive?: boolean;
    latencyMs?: number;
  }>) | null = null;

  const results = new Map<string, HealthCheckResult>();
  const events: HealthEvent[] = [];

  /** Run a single round of probes against all targets. */
  async function check(): Promise<void> {
    if (!probeFn) return;

    const now = Date.now();

    // Fire all probes concurrently for speed.
    const promises = activeTargets.map(async (target) => {
      try {
        const probe = await probeFn!(target);
        const classification = classify(probe.pidAlive, probe.endpointResponsive);

        const result: HealthCheckResult = {
          targetId: target.id,
          classification,
          pidAlive: probe.pidAlive,
          endpointResponsive: probe.endpointResponsive,
          latencyMs: probe.latencyMs,
          checkedAt: now,
        };

        const prev = results.get(target.id);

        // Emit event on classification change or first non-ok result.
        if (classification !== 'ok') {
          const prevClass = prev?.classification ?? 'unknown';
          if (prevClass === 'ok' || prevClass === 'unknown' || prevClass !== classification) {
            const event: HealthEvent = {
              type: classification,
              targetId: target.id,
              providerId: target.providerId,
              from: prevClass,
              to: classification,
              timestamp: now,
              metadata: {
                latencyMs: probe.latencyMs,
                pidAlive: probe.pidAlive,
                endpointResponsive: probe.endpointResponsive,
              },
            };
            events.push(event);
          }
        } else if (prev && prev.classification !== 'ok') {
          // Recovery event — transitioned back to ok.
          events.push({
            type: 'recovered',
            targetId: target.id,
            providerId: target.providerId,
            from: prev.classification,
            to: 'ok',
            timestamp: now,
          });
        }

        results.set(target.id, result);
      } catch (err) {
        // Probe itself threw — treat as crashed.
        const prev = results.get(target.id);
        const prevClass = prev?.classification ?? 'unknown';

        if (prevClass !== 'crashed') {
          events.push({
            type: 'crashed',
            targetId: target.id,
            providerId: target.providerId,
            from: prevClass,
            to: 'crashed',
            timestamp: now,
            metadata: { error: err instanceof Error ? err.message : String(err) },
          });
        }

        results.set(target.id, {
          targetId: target.id,
          classification: 'crashed',
          checkedAt: now,
        });
      }
    });

    await Promise.allSettled(promises);
  }

  return {
    /**
     * Begin periodic health checks.
     *
     * @param targets    - The set of targets to probe.
     * @param fn         - Async probe function invoked for each target.
     * @param intervalMs - Probe interval in ms (falls back to `defaultIntervalMs`).
     */
    start(
      targets: HealthCheckTarget[],
      fn: typeof probeFn,
      intervalMs?: number,
    ): void {
      this.stop(); // ensure no double-timers
      activeTargets = targets;
      probeFn = fn;
      // Run immediately, then schedule.
      void check();
      timer = setInterval(() => { void check(); }, intervalMs ?? cfg.defaultIntervalMs);
      // Allow the process to exit even if the timer is still active.
      if (timer.unref) timer.unref();
    },

    /** Stop periodic probing and clear the timer. */
    stop(): void {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    },

    /** Return a snapshot of the most recent probe results. */
    getResults(): HealthCheckResult[] {
      return Array.from(results.values());
    },

    /** Return all events emitted since the last `start` / `stop` cycle. */
    getEvents(): HealthEvent[] {
      return events.slice();
    },
  };
}
