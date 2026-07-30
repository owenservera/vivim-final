// src/engines/pool/index.ts
// Barrel exports for Browser Pool.
// Phase 4: Eliminates cold startup via warm pools.

export { BrowserPool } from './browser-pool.js'
export { Lease } from './lease.js'
export type { PoolOptions, PoolSlave, AcquireResult } from './browser-pool.js'
