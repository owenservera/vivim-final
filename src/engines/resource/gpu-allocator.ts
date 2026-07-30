// src/engines/resource/gpu-allocator.ts
// GpuAllocator — dynamic GPU allocation based on Chrome RSS.
// Phase 6: Dynamically sets disableGpu on spawn based on chromeRssTotal.

import { getLogger } from '../../observability/logger.js'

export interface GpuAllocatorOptions {
  rssThresholdMb: number
  disableGpuAboveThreshold: boolean
}

const DEFAULT_OPTIONS: GpuAllocatorOptions = {
  rssThresholdMb: 2000, // 2GB
  disableGpuAboveThreshold: true,
}

export class GpuAllocator {
  private logger = getLogger('GpuAllocator')
  private opts: GpuAllocatorOptions
  private currentRssTotal = 0

  constructor(options?: Partial<GpuAllocatorOptions>) {
    this.opts = { ...DEFAULT_OPTIONS, ...options }
  }

  /**
   * Update total Chrome RSS (called by PressureFeed).
   */
  updateRssTotal(rssMb: number): void {
    this.currentRssTotal = rssMb
  }

  /**
   * Determine if GPU should be disabled for a new slave.
   */
  shouldDisableGpu(): boolean {
    if (!this.opts.disableGpuAboveThreshold) return false
    return this.currentRssTotal > this.opts.rssThresholdMb
  }

  /**
   * Get Chrome launch args for GPU allocation.
   */
  getGpuArgs(): string[] {
    if (this.shouldDisableGpu()) {
      this.logger.info('Disabling GPU due to high RSS', {
        currentRssMb: this.currentRssTotal,
        thresholdMb: this.opts.rssThresholdMb,
      })
      return ['--disable-gpu', '--disable-software-rasterizer']
    }
    return []
  }

  /**
   * Get current allocation status.
   */
  getStatus(): { rssTotalMb: number; gpuDisabled: boolean } {
    return {
      rssTotalMb: this.currentRssTotal,
      gpuDisabled: this.shouldDisableGpu(),
    }
  }
}
