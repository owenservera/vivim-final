// src/engines/resource/resource-manager.ts
// ResourceManager — unified resource management for the fleet.
// Phase 6: Coordinates PressureFeed, AdaptiveLimiter, and GpuAllocator.

import { PressureFeed } from './pressure-feed.js'
import { AdaptiveLimiter } from './adaptive-limiter.js'
import { GpuAllocator } from './gpu-allocator.js'
import { getLogger } from '../../observability/logger.js'

export interface ResourceManagerOptions {
  pressure?: Partial<import('./pressure-feed.js').PressureFeedOptions>
  limiter?: Partial<import('./adaptive-limiter.js').AdaptiveLimiterOptions>
  gpu?: Partial<import('./gpu-allocator.js').GpuAllocatorOptions>
}

export class ResourceManager {
  public readonly pressureFeed: PressureFeed
  public readonly adaptiveLimiter: AdaptiveLimiter
  public readonly gpuAllocator: GpuAllocator
  private logger = getLogger('ResourceManager')

  constructor(options?: ResourceManagerOptions) {
    this.pressureFeed = new PressureFeed(options?.pressure)
    this.adaptiveLimiter = new AdaptiveLimiter(
      () => this.pressureFeed.getPressure().cpuPct,
      () => 0, // Queue depth provided by scheduler
      options?.limiter,
    )
    this.gpuAllocator = new GpuAllocator(options?.gpu)
  }

  /**
   * Start all resource management subsystems.
   */
  start(): void {
    this.logger.info('Starting resource manager')
    this.pressureFeed.start()
    this.adaptiveLimiter.start()
  }

  /**
   * Stop all resource management subsystems.
   */
  stop(): void {
    this.logger.info('Stopping resource manager')
    this.pressureFeed.stop()
    this.adaptiveLimiter.stop()
  }

  /**
   * Get current concurrency limit.
   */
  getMaxConcurrent(): number {
    return this.adaptiveLimiter.getMaxConcurrent()
  }

  /**
   * Get GPU launch args for a new slave.
   */
  getGpuArgs(): string[] {
    return this.gpuAllocator.getGpuArgs()
  }

  /**
   * Update Chrome fleet metrics.
   */
  updateFleetMetrics(rssTotalMb: number, rendererCount: number): void {
    this.pressureFeed.updateChromeMetrics(rssTotalMb, rendererCount)
    this.gpuAllocator.updateRssTotal(rssTotalMb)
  }
}
