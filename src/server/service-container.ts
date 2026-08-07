// src/server/service-container.ts
// Enhanced DI container with module lifecycle management and typed service resolution.
//
// This closes SOTA-AUDIT-V2 §2.2 Gap O-1: the ProviderOnboardingOrchestrator
// existed but was never wired into any surface. The CLI command (onboard-provider.ts)
// calls `ctx.container.resolve('onboardingOrchestrator')` — without a container,
// the entire pipeline was unreachable from any CLI/API/UI surface.
//
// WP-02: Module Lifecycle & Dependency Injection Enhancement
// - Added ModuleLifecycle interface (init/start/stop hooks)
// - Added ServiceDescriptor wrapping instances with optional lifecycle + tags
// - Added lifecycle management methods (initAll/startAll/stopAll)
// - Added typed convenience methods (resolveRequired/resolveOptional)
// - Added tag-based query (findByTag) and introspection (list)
//
// Design choices:
//  - Strings as keys (not symbols): keeps the surface simple, debuggable,
//    and JSON-serializable for future REST exposure.
//  - Fail-fast on duplicate registration: catches boot-order bugs immediately.
//  - Fail-fast on unknown resolution: catches missing-dependency bugs at the
//    call site rather than producing silent `undefined`.
//  - stopAll runs in reverse registration order: services that were started
//    last should be stopped first (LIFO teardown).
//  - Lifecycle hooks are optional per-service: most services are simple
//    singletons that don't need async teardown.

// ── Lifecycle interface ──────────────────────────────────────────────────

/**
 * Optional lifecycle hooks that a registered service may implement.
 * Called at well-defined points during server boot and shutdown.
 */
export interface ModuleLifecycle {
  /** Called after all modules are registered, before server starts accepting traffic. */
  init?(): Promise<void>
  /** Called when server is ready to accept traffic. */
  start?(): Promise<void>
  /** Called during graceful shutdown (in reverse registration order). */
  stop?(): Promise<void>
}

// ── Service descriptor ───────────────────────────────────────────────────

/**
 * Wraps a service instance with optional lifecycle hooks and tags.
 * Stored internally in the registry Map.
 */
export interface ServiceDescriptor<T = unknown> {
  /** The service instance. */
  instance: T
  /** Optional lifecycle hooks for init/start/stop phases. */
  lifecycle?: ModuleLifecycle
  /** Tags for grouping and querying (e.g., 'engine', 'store', 'infra'). */
  tags?: string[]
}

// ── Service container ────────────────────────────────────────────────────

export class ServiceContainer {
  private readonly registry = new Map<string, ServiceDescriptor>()
  /** Tracks insertion order for reverse-order shutdown. */
  private readonly insertionOrder: string[] = []

  /**
   * Register a service instance under `name`. Throws if `name` is already
   * registered — this catches double-boot bugs that would otherwise silently
   * replace the first registration.
   */
  register<T>(
    name: string,
    instance: T,
    opts?: { lifecycle?: ModuleLifecycle; tags?: string[] },
  ): void {
    if (this.registry.has(name)) {
      throw new Error(`ServiceContainer: '${name}' already registered`)
    }
    this.registry.set(name, {
      instance,
      lifecycle: opts?.lifecycle,
      tags: opts?.tags ?? [],
    })
    this.insertionOrder.push(name)
  }

  /**
   * Resolve a service by name. Throws if not registered — fail-fast at the
   * call site beats silent `undefined` propagation.
   */
  resolve<T>(name: string): T {
    if (!this.registry.has(name)) {
      throw new Error(`ServiceContainer: '${name}' not registered`)
    }
    return this.registry.get(name)?.instance as T
  }

  /** Test-only / safe — check whether a service is registered without throwing. */
  has(name: string): boolean {
    return this.registry.has(name)
  }

  /** Test-only — clear all registrations (used by test setup/teardown). */
  clear(): void {
    this.registry.clear()
    this.insertionOrder.length = 0
  }

  // ── Typed convenience ──────────────────────────────────────────────

  /**
   * Alias for `resolve` — explicitly named for call-site clarity.
   * Throws if not registered.
   */
  resolveRequired<T>(name: string): T {
    return this.resolve<T>(name)
  }

  /**
   * Safe resolution — returns undefined if not registered instead of throwing.
   * Useful for optional dependencies where the caller handles the absence.
   */
  resolveOptional<T>(name: string): T | undefined {
    const desc = this.registry.get(name)
    return desc ? (desc.instance as T) : undefined
  }

  // ── Lifecycle management ──────────────────────────────────────────────

  /**
   * Call `init()` on all registered services that have a lifecycle with init.
   * Iterates in registration order.
   */
  async initAll(): Promise<void> {
    for (const name of this.insertionOrder) {
      const desc = this.registry.get(name)!
      if (desc.lifecycle?.init) {
        await desc.lifecycle.init()
      }
    }
  }

  /**
   * Call `start()` on all registered services that have a lifecycle with start.
   * Iterates in registration order.
   */
  async startAll(): Promise<void> {
    for (const name of this.insertionOrder) {
      const desc = this.registry.get(name)!
      if (desc.lifecycle?.start) {
        await desc.lifecycle.start()
      }
    }
  }

  /**
   * Call `stop()` on all registered services that have a lifecycle with stop.
   * Iterates in REVERSE registration order (LIFO teardown) so services that
   * depend on others are torn down first.
   */
  async stopAll(): Promise<void> {
    for (let i = this.insertionOrder.length - 1; i >= 0; i--) {
      const name = this.insertionOrder[i]!
      const desc = this.registry.get(name)!
      if (desc.lifecycle?.stop) {
        await desc.lifecycle.stop()
      }
    }
  }

  // ── Tag-based queries ─────────────────────────────────────────────────

  /**
   * Find all registered service names that have the given tag.
   */
  findByTag(tag: string): string[] {
    const result: string[] = []
    for (const [name, desc] of this.registry) {
      if (desc.tags?.includes(tag)) {
        result.push(name)
      }
    }
    return result
  }

  // ── Introspection ────────────────────────────────────────────────────

  /**
   * List all registered services with their tags.
   * Useful for debugging, health checks, and admin endpoints.
   */
  list(): Array<{ name: string; tags: string[] }> {
    return this.insertionOrder.map((name) => {
      const desc = this.registry.get(name)!
      return { name, tags: desc.tags ?? [] }
    })
  }
}

/**
 * Module-level singleton container. The boot path (src/server/index.ts) populates
 * it after the governor + stores + orchestrator come up. The CLI bridge
 * (src/cli/index.ts) reads from it when dispatching the `onboard` command.
 */
export const serviceContainer = new ServiceContainer()
