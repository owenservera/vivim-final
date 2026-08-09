// src/server/module-registry.ts
// Declarative module definitions for the service container.
//
// WP-02: Module Lifecycle & Dependency Injection Enhancement
// Provides a typed ModuleRegistry that:
// - Accepts ModuleDefinition objects describing each engine's name, tags, deps, factory
// - Performs topological sort based on dependsOn to determine initialization order
// - Detects circular dependencies and throws a clear error
// - Bootstraps all modules into a ServiceContainer in dependency order
//
// This is a DECLARATIVE layer — the actual bootstrap still happens in
// bootstrap-engines.ts (which we're NOT modifying yet — just providing
// the infrastructure for future migration).

import type { ServiceContainer } from './service-container.js'

// ── Module definition ───────────────────────────────────────────────────

/**
 * Declarative definition of an engine module.
 * Describes what a module needs (dependsOn), how to create it (create),
 * what tags it belongs to, and optional lifecycle hooks.
 */
export interface ModuleDefinition {
  /** Unique module name (must match the key used in ServiceContainer). */
  name: string
  /** Tags for grouping (e.g., 'engine', 'store', 'infra'). */
  tags: string[]
  /** Dependencies — other module names that must be registered before this one. */
  dependsOn?: string[]
  /** Factory function to create the module instance. Receives already-bootstrapped deps. */
  create: (deps: ModuleDependencies) => Promise<unknown> | unknown
  /** Optional lifecycle hooks, called after the instance is created. */
  lifecycle?: {
    init?: (instance: unknown) => Promise<void>
    start?: (instance: unknown) => Promise<void>
    stop?: (instance: unknown) => Promise<void>
  }
}

/**
 * The resolved dependency map passed to each module's create() factory.
 * Keys are the dependency module names, values are their resolved instances.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ModuleDependencies = Record<string, any>

// ── Module registry ─────────────────────────────────────────────────────

/**
 * Typed module registry with topological sort for dependency resolution.
 *
 * Usage:
 *   const registry = new ModuleRegistry()
 *   registry.define({ name: 'eventBus', tags: ['infra'], create: () => bus })
 *   registry.define({ name: 'convManager', tags: ['engine'], dependsOn: ['eventBus'], create: (d) => new ConvManager(d.eventBus) })
 *   await registry.bootstrap(container)
 */
export class ModuleRegistry {
  private readonly modules = new Map<string, ModuleDefinition>()

  /**
   * Define a new module. Throws if a module with the same name already exists.
   */
  define(def: ModuleDefinition): void {
    if (this.modules.has(def.name)) {
      throw new Error(`ModuleRegistry: module '${def.name}' already defined`)
    }
    this.modules.set(def.name, def)
  }

  /**
   * Get a module definition by name.
   */
  get(name: string): ModuleDefinition | undefined {
    return this.modules.get(name)
  }

  /**
   * Get all module definitions in no particular order.
   */
  getAll(): ModuleDefinition[] {
    return Array.from(this.modules.values())
  }

  /**
   * Get modules by tag.
   */
  getByTag(tag: string): ModuleDefinition[] {
    return this.getAll().filter((m) => m.tags.includes(tag))
  }

  /**
   * Compute the topological sort order based on dependsOn relationships.
   * Throws if a circular dependency is detected.
   *
   * Uses Kahn's algorithm for deterministic ordering.
   */
  resolveOrder(): string[] {
    const inDegree = new Map<string, number>()
    const adjacency = new Map<string, string[]>()

    // Initialize all modules with zero in-degree
    for (const name of this.modules.keys()) {
      inDegree.set(name, 0)
      adjacency.set(name, [])
    }

    // Build adjacency list and compute in-degrees
    for (const def of this.modules.values()) {
      const deps = def.dependsOn ?? []
      for (const dep of deps) {
        // Validate that the dependency exists
        if (!this.modules.has(dep)) {
          throw new Error(
            `ModuleRegistry: module '${def.name}' depends on '${dep}', which is not defined`,
          )
        }
        adjacency.get(dep)?.push(def.name)
        inDegree.set(def.name, (inDegree.get(def.name) ?? 0) + 1)
      }
    }

    // Kahn's algorithm: start with modules that have no dependencies
    const queue: string[] = []
    for (const [name, degree] of inDegree) {
      if (degree === 0) {
        queue.push(name)
      }
    }

    // Sort the queue for deterministic output (alphabetical order for ties)
    queue.sort()

    const result: string[] = []
    while (queue.length > 0) {
      const name = queue.shift()!
      result.push(name)

      // Reduce in-degree for dependents
      const dependents = adjacency.get(name)!
      const newQueueEntries: string[] = []
      for (const dep of dependents) {
        const newDegree = inDegree.get(dep)! - 1
        inDegree.set(dep, newDegree)
        if (newDegree === 0) {
          newQueueEntries.push(dep)
        }
      }
      // Insert newly ready modules in sorted order for determinism
      newQueueEntries.sort()
      queue.push(...newQueueEntries)
      queue.sort()
    }

    // If not all modules are in the result, there's a cycle
    if (result.length !== this.modules.size) {
      const cycleModules = Array.from(this.modules.keys()).filter((n) => !result.includes(n))
      throw new Error(
        `ModuleRegistry: circular dependency detected among modules: ${cycleModules.join(', ')}`,
      )
    }

    return result
  }

  /**
   * Create and register all modules into a ServiceContainer in dependency order.
   * Calls each module's create() factory, passing its dependencies as the deps map.
   * Then registers the instance with optional lifecycle and tags.
   */
  async bootstrap(container: ServiceContainer): Promise<void> {
    const order = this.resolveOrder()
    const created = new Map<string, unknown>()

    for (const name of order) {
      const def = this.modules.get(name)!

      // Build the dependency map for this module
      const deps: ModuleDependencies = {}
      for (const depName of def.dependsOn ?? []) {
        deps[depName] = created.get(depName)
      }

      // Create the instance
      const instance = await def.create(deps)
      created.set(name, instance)

      // Register into the container with lifecycle and tags
      container.register(name, instance, {
        lifecycle: def.lifecycle
          ? {
              init: def.lifecycle.init ? async () => def.lifecycle?.init?.(instance) : undefined,
              start: def.lifecycle.start ? async () => def.lifecycle?.start?.(instance) : undefined,
              stop: def.lifecycle.stop ? async () => def.lifecycle?.stop?.(instance) : undefined,
            }
          : undefined,
        tags: def.tags,
      })
    }
  }
}
