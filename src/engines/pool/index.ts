// src/engines/pool/index.ts
// Barrel exports for Browser Pool.
// Phase 4: Eliminates cold startup via warm pools.

export type { AcquireResult, PoolOptions, PoolSlave } from './browser-pool.js'
export { BrowserPool } from './browser-pool.js'
export { Lease } from './lease.js'
