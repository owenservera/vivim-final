// src/engines/actor/index.ts
// Barrel exports for Actor Model.
// Phase 3: Each browser becomes an autonomous actor.

export { Mailbox } from './mailbox.js'
export { BrowserActor } from './browser-actor.js'
export { ActorSupervisor } from './actor-supervisor.js'
export type { ActorMsg, FailureClass, RecoveryStrategy } from './messages.js'
export { isLifecycleMsg, isCommandMsg } from './messages.js'
