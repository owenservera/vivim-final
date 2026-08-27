// src/engines/actor/index.ts
// Barrel exports for Actor Model.
// Phase 3: Each browser becomes an autonomous actor.

export { ActorSupervisor } from './actor-supervisor.js'
export { BrowserActor } from './browser-actor.js'
export { Mailbox } from './mailbox.js'
export type { ActorMsg, FailureClass, RecoveryStrategy } from './messages.js'
export { isCommandMsg, isLifecycleMsg } from './messages.js'
