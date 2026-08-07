import { EngineError } from '../../errors.js'
import { catchDebug } from '../../lib/catch-logger.js'
import type {
  CapabilityDescriptor,
  EngineDescriptor,
  HealthState,
  RouteDescriptor,
  StoreDescriptor,
  SystemTopology,
} from '../../storage/contracts/kernel-store.js'

type RegisterCallback = (desc: EngineDescriptor) => void
type StatusChangeCallback = (id: string, from: string, to: string) => void

export class KernelRegistry {
  private engines = new Map<string, EngineDescriptor>()
  private stores = new Map<string, StoreDescriptor>()
  private capabilities = new Map<string, CapabilityDescriptor>()
  private routes = new Map<string, RouteDescriptor>()

  private registerCallbacks: Set<RegisterCallback> = new Set()
  private statusChangeCallbacks: Set<StatusChangeCallback> = new Set()

  registerEngine(desc: Omit<EngineDescriptor, 'registeredAt' | 'updatedAt'>): void {
    const now = Date.now()
    const entry: EngineDescriptor = {
      ...desc,
      registeredAt: now,
      updatedAt: now,
    }
    this.engines.set(desc.id, entry)
    for (const cb of this.registerCallbacks) {
      try {
        cb(entry)
      } catch {
        catchDebug(_err, 'engines:kernel:kernel-registry:34')
        /* callback error should not prevent registration */
      }
    }
  }

  registerStore(desc: Omit<StoreDescriptor, 'registeredAt' | 'updatedAt'>): void {
    const now = Date.now()
    const entry: StoreDescriptor = { ...desc, registeredAt: now, updatedAt: now }
    this.stores.set(desc.id, entry)
  }

  registerCapability(desc: Omit<CapabilityDescriptor, 'registeredAt' | 'updatedAt'>): void {
    const now = Date.now()
    const entry: CapabilityDescriptor = { ...desc, registeredAt: now, updatedAt: now }
    this.capabilities.set(desc.id, entry)
  }

  registerRoute(desc: Omit<RouteDescriptor, 'registeredAt' | 'updatedAt'>): void {
    const now = Date.now()
    const entry: RouteDescriptor = { ...desc, registeredAt: now, updatedAt: now }
    this.routes.set(desc.id, entry)
  }

  describe(): SystemTopology {
    return {
      engines: [...this.engines.values()],
      stores: [...this.stores.values()],
      capabilities: [...this.capabilities.values()],
      routes: [...this.routes.values()],
      timestamp: Date.now(),
    }
  }

  listEngines(filter?: { layer?: string; kind?: string; status?: string }): EngineDescriptor[] {
    let result = [...this.engines.values()]
    if (filter?.layer) result = result.filter((e) => e.layer === filter.layer)
    if (filter?.kind) result = result.filter((e) => e.kind === filter.kind)
    if (filter?.status) result = result.filter((e) => e.status === filter.status)
    return result
  }

  getEngine(id: string): EngineDescriptor | null {
    return this.engines.get(id) ?? null
  }

  getDependencies(id: string): string[] {
    const desc = this.engines.get(id)
    if (!desc) return []
    const deps: string[] = []
    const visited = new Set<string>()
    const queue = [...desc.dependencies]
    for (const depId of queue) {
      if (visited.has(depId)) continue
      visited.add(depId)
      deps.push(depId)
      const dep = this.engines.get(depId)
      if (dep) queue.push(...dep.dependencies)
    }
    return deps
  }

  dependentsOf(id: string): string[] {
    const result: string[] = []
    for (const [, desc] of this.engines) {
      if (desc.dependencies.includes(id)) {
        result.push(desc.id)
      }
    }
    return result
  }

  updateHealth(id: string, health: HealthState): void {
    const desc = this.engines.get(id)
    if (!desc) throw new EngineError(`Engine ${id} not found in registry`)
    const _from = desc.status
    desc.health = health
    desc.updatedAt = Date.now()
    if (health.status === 'healthy') {
      this.markRunning(id)
    } else if (health.status === 'unhealthy') {
      this.markError(id, health.details ? JSON.stringify(health.details) : 'unhealthy')
    }
  }

  markWired(id: string): void {
    this.updateStatus(id, 'wired')
  }

  markRunning(id: string): void {
    this.updateStatus(id, 'running')
  }

  markError(id: string, error: string): void {
    const desc = this.engines.get(id)
    if (desc) desc.metadata = { ...desc.metadata, error }
    this.updateStatus(id, 'error')
  }

  markStopped(id: string): void {
    this.updateStatus(id, 'stopped')
  }

  onRegister(callback: (desc: EngineDescriptor) => void): () => void {
    this.registerCallbacks.add(callback)
    return () => {
      this.registerCallbacks.delete(callback)
    }
  }

  onStatusChange(callback: (id: string, from: string, to: string) => void): () => void {
    this.statusChangeCallbacks.add(callback)
    return () => {
      this.statusChangeCallbacks.delete(callback)
    }
  }

  private updateStatus(id: string, to: string): void {
    const desc = this.engines.get(id)
    if (!desc) return
    const from = desc.status
    desc.status = to as EngineDescriptor['status']
    desc.updatedAt = Date.now()
    for (const cb of this.statusChangeCallbacks) {
      try {
        cb(id, from, to)
      } catch {
        catchDebug(_err, 'engines:kernel:kernel-registry:160')
        /* callback error should not prevent status update */
      }
    }
  }
}
