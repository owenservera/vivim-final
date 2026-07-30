// src/fleet/index.ts
// Barrel exports for Fleet subsystem.
// Phase 10: Distributed fleet management.

export { WorkerNode } from './worker-node.js'
export { FleetManager } from './fleet-manager.js'
export { RemoteCdp } from './remote-cdp.js'
export type { WorkerNodeConfig, WorkerStatus, WorkerNodeStats } from './worker-node.js'
export type { FleetConfig, FleetStats } from './fleet-manager.js'
export type { RemoteCdpConfig } from './remote-cdp.js'
