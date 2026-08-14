// src/engines/resource/index.ts
// Barrel exports for Adaptive Resource Manager.
// Phase 6: Self-managing fleet based on host pressure.

export type { AdaptiveLimiterOptions } from './adaptive-limiter.js'
export { AdaptiveLimiter } from './adaptive-limiter.js'
export type { GpuAllocatorOptions } from './gpu-allocator.js'
export { GpuAllocator } from './gpu-allocator.js'
export type { Pressure, PressureFeedOptions } from './pressure-feed.js'
export { PressureFeed } from './pressure-feed.js'
export type { ResourceManagerOptions } from './resource-manager.js'
export { ResourceManager } from './resource-manager.js'
