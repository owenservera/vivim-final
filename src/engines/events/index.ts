// src/engines/events/index.ts
// Barrel exports for Event Bus.
// Phase 7: Typed, in-process pub/sub for fleet lifecycle events.

export { EventBus, getEventBus } from './event-bus.js'
export { DbSubscriber } from './db-subscriber.js'
export type { FleetEvent, EventType, EventHandler } from './event-bus.js'
export type { FleetEventRow, EventStore } from './db-subscriber.js'
