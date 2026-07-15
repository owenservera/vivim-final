// src/engines/capability-discovery-loop.ts
// CapabilityDiscoveryLoop — auto-discovers capabilities and stores them in registry.

import type { KernelStore } from '../storage/contracts/kernel-store.js'
import type { CapabilityEventBus } from './capability-event-bus.js'
import type { UnifiedCapabilityRegistry } from './unified-registry.js'

// ── Types ───────────────────────────────────────────────────────────────

export interface DiscoveredCapability {
  id: string
  slug: string
  name: string
  description: string
  category: string
  surfaces: string[]
  discoveredAt: number
  confidence: number
}

export interface DiscoveryOptions {
  scanIntervalMs?: number
  minConfidence?: number
  sources?: string[]
}

// ── CapabilityDiscoveryLoop ────────────────────────────────────────────

export class CapabilityDiscoveryLoop {
  private running = false
  private interval?: ReturnType<typeof setInterval>
  private discovered: DiscoveredCapability[] = []

  constructor(
    private readonly eventBus: CapabilityEventBus,
    private readonly registry: UnifiedCapabilityRegistry,
    private readonly store?: KernelStore,
    private readonly opts: DiscoveryOptions = {},
  ) {}

  // Start discovery loop
  start(): void {
    if (this.running) return

    this.running = true
    const intervalMs = this.opts.scanIntervalMs ?? 30000
    this.interval = setInterval(() => this.scan(), intervalMs)

    this.eventBus.emit({ type: 'discovery:started', intervalMs })
  }

  // Stop discovery loop
  stop(): void {
    this.running = false
    if (this.interval) clearInterval(this.interval)
    this.interval = undefined

    this.eventBus.emit({ type: 'discovery:stopped' })
  }

  // One-off scan
  async scan(): Promise<DiscoveredCapability[]> {
    const caps = this.registry.list()
    const newCaps: DiscoveredCapability[] = []

    for (const cap of caps) {
      const id = cap.id
      const existing = this.discovered.find((c) => c.id === id)

      if (!existing) {
        const discovered: DiscoveredCapability = {
          id: cap.id,
          slug: cap.slug ?? cap.id,
          name: cap.name,
          description: cap.description,
          category: cap.category,
          surfaces: cap.surfaces ?? [],
          discoveredAt: Date.now(),
          confidence: 1.0,
        }
        this.discovered.push(discovered)
        newCaps.push(discovered)

        this.eventBus.emit({ type: 'capability:discovered', capabilityId: id })
      }
    }

    return newCaps
  }

  // Get discovered capabilities
  listDiscovered(): DiscoveredCapability[] {
    return [...this.discovered]
  }

  // Clear discovered capabilities
  clear(): void {
    this.discovered = []
  }

  // Generate a discovery report
  report(): {
    total: number
    byCategory: Record<string, number>
    bySurface: Record<string, number>
  } {
    const byCategory: Record<string, number> = {}
    const bySurface: Record<string, number> = {}

    for (const cap of this.discovered) {
      byCategory[cap.category] = (byCategory[cap.category] ?? 0) + 1
      for (const surf of cap.surfaces) {
        bySurface[surf] = (bySurface[surf] ?? 0) + 1
      }
    }

    return { total: this.discovered.length, byCategory, bySurface }
  }
}
