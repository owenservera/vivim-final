// src/server/service-container.ts
// Minimal DI container — NOT a framework. Just a typed Map<string, unknown>
// with fail-fast semantics on duplicate registration / unknown resolution.
//
// This closes SOTA-AUDIT-V2 §2.2 Gap O-1: the ProviderOnboardingOrchestrator
// existed but was never wired into any surface. The CLI command (onboard-provider.ts)
// calls `ctx.container.resolve('onboardingOrchestrator')` — without a container,
// the entire pipeline was unreachable from any CLI/API/UI surface.
//
// Design choices:
//  - Strings as keys (not symbols): keeps the surface simple, debuggable,
//    and JSON-serializable for future REST exposure.
//  - Fail-fast on duplicate registration: catches boot-order bugs immediately.
//  - Fail-fast on unknown resolution: catches missing-dependency bugs at the
//    call site rather than producing silent `undefined`.
//  - No async init: instances are constructed by the boot path and registered
//    as already-initialized singletons. Async init is a separate concern
//    (and the boot path in src/server/index.ts already handles it).

export class ServiceContainer {
  private readonly registry = new Map<string, unknown>()

  /**
   * Register a service instance under `name`. Throws if `name` is already
   * registered — this catches double-boot bugs that would otherwise silently
   * replace the first registration.
   */
  register<T>(name: string, instance: T): void {
    if (this.registry.has(name)) {
      throw new Error(`ServiceContainer: '${name}' already registered`)
    }
    this.registry.set(name, instance)
  }

  /**
   * Resolve a service by name. Throws if not registered — fail-fast at the
   * call site beats silent `undefined` propagation.
   */
  resolve<T>(name: string): T {
    if (!this.registry.has(name)) {
      throw new Error(`ServiceContainer: '${name}' not registered`)
    }
    return this.registry.get(name) as T
  }

  /** Test-only — check whether a service is registered without throwing. */
  has(name: string): boolean {
    return this.registry.has(name)
  }

  /** Test-only — clear all registrations (used by test setup/teardown). */
  clear(): void {
    this.registry.clear()
  }
}

/**
 * Module-level singleton container. The boot path (src/server/index.ts) populates
 * it after the governor + stores + orchestrator come up. The CLI bridge
 * (src/cli/index.ts) reads from it when dispatching the `onboard` command.
 */
export const serviceContainer = new ServiceContainer()
