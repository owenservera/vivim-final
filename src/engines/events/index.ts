// src/engines/events/index.ts
// Barrel exports for Event Bus.
// Phase 7: Typed, in-process pub/sub for fleet lifecycle events.

export type { EventStore, FleetEventRow } from './db-subscriber.js'
export { DbSubscriber } from './db-subscriber.js'
export type { EventHandler, EventType, FleetEvent } from './event-bus.js'
export { EventBus, getEventBus } from './event-bus.js'
