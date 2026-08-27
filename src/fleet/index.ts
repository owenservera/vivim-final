// src/fleet/index.ts
// Barrel exports for Fleet subsystem.
// Phase 10: Distributed fleet management.

export type { FleetConfig, FleetStats } from './fleet-manager.js'
export { FleetManager } from './fleet-manager.js'
export type { RemoteCdpConfig } from './remote-cdp.js'
export { RemoteCdp } from './remote-cdp.js'
export type { WorkerNodeConfig, WorkerNodeStats, WorkerStatus } from './worker-node.js'
export { WorkerNode } from './worker-node.js'
