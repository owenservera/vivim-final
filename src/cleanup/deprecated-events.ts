// src/cleanup/deprecated-events.ts
// Registry of deprecated event types and their replacements.
// Based on @deprecated JSDoc annotations in capability-event-bus.ts.

/** Describes a deprecated event type and how to migrate away from it. */
export interface DeprecatedEvent {
  /** Deprecated event type (exact string used in `type` field). */
  deprecated: string
  /** Replacement event type (if any). */
  replacement?: string
  /** Version when deprecated. */
  deprecatedIn: string
  /** Whether the event is still emitted somewhere in `src/` (grace period). */
  stillEmitted: boolean
  /** Human-readable migration guide. */
  migration: string
}

// ── Registry ─────────────────────────────────────────────────────────────
//
// All entries mirror the `@deprecated` JSDoc comments found in
// `src/engines/capability-event-bus.ts`.  The `stillEmitted` flag was
// verified by searching `src/` for literal emit calls.

export const DEPRECATED_EVENTS: DeprecatedEvent[] = [
  // ── Capability events (never emitted) ──────────────────────────────
  {
    deprecated: 'capability:confidence_changed',
    deprecatedIn: '0.9.0',
    stillEmitted: false,
    migration:
      'This event was never emitted. Subscribers in ProviderHealthKernel should use provider:health_changed instead.',
  },
  {
    deprecated: 'capability:selector_drifted',
    deprecatedIn: '0.9.0',
    stillEmitted: false,
    migration:
      'This event was never emitted. Selector drift is recorded via CapabilityStore.recordDrift() instead.',
  },
  {
    deprecated: 'capability:status_changed',
    deprecatedIn: '0.9.0',
    stillEmitted: false,
    migration: 'This event was never emitted. Binding status changes use binding:status_changed.',
  },

  // ── Account events (never emitted) ────────────────────────────────
  {
    deprecated: 'account:login_state',
    deprecatedIn: '0.9.0',
    stillEmitted: false,
    migration:
      'Account lifecycle events were designed but never implemented. No replacement; remove subscribers.',
  },
  {
    deprecated: 'account:plan_tier_changed',
    deprecatedIn: '0.9.0',
    stillEmitted: false,
    migration:
      'Account lifecycle events were designed but never implemented. No replacement; remove subscribers.',
  },
  {
    deprecated: 'account:created',
    deprecatedIn: '0.9.0',
    stillEmitted: false,
    migration:
      'Account lifecycle events were designed but never implemented. No replacement; remove subscribers.',
  },
  {
    deprecated: 'account:removed',
    deprecatedIn: '0.9.0',
    stillEmitted: false,
    migration:
      'Account lifecycle events were designed but never implemented. No replacement; remove subscribers.',
  },

  // ── Fleet events (still emitted by ChromeGovernor) ─────────────────
  {
    deprecated: 'fleet:slave_status',
    deprecatedIn: '0.9.0',
    stillEmitted: true,
    migration:
      'ChromeGovernor still emits this. Migrate subscribers to listen on the durable EventRecord outbox filtered by source="executor" instead.',
  },
  {
    deprecated: 'fleet:crash_detected',
    deprecatedIn: '0.9.0',
    stillEmitted: true,
    migration:
      'ChromeGovernor still emits this. Migrate subscribers to use the ErrorTracker engine for crash detection.',
  },
  {
    deprecated: 'fleet:circuit_changed',
    deprecatedIn: '0.9.0',
    stillEmitted: true,
    migration:
      'ChromeGovernor still emits this. Migrate subscribers to use GovernorStore.getCircuitStates() for circuit breaker state.',
  },
]

// ── Lookup helpers ──────────────────────────────────────────────────────

/** Check if an event type is deprecated. Returns the entry or `undefined`. */
export function isEventDeprecated(type: string): DeprecatedEvent | undefined {
  return DEPRECATED_EVENTS.find((e) => e.deprecated === type)
}

/** Get all deprecated events that are still being emitted (grace period). */
export function getActiveDeprecatedEvents(): DeprecatedEvent[] {
  return DEPRECATED_EVENTS.filter((e) => e.stillEmitted)
}

/** Generate a deprecation warning message for logging. */
export function deprecationWarning(event: DeprecatedEvent): string {
  const replacement = event.replacement ? ` Use "${event.replacement}" instead.` : ''
  return `Deprecated event emitted: "${event.deprecated}" (since v${event.deprecatedIn}).${replacement} ${event.migration}`
}
