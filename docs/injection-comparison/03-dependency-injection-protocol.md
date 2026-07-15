# 03 — Dependency-Injection Protocol

How each repo supplies dependencies to the units that need them.

## vivim-final: object-graph DI via `KernelContext` + store contracts

### The container

There is a single **context object** — `KernelContext` (`kernel-context.ts`) —
passed to (or reachable by) every engine:

```ts
interface KernelContext {
  kernel: Kernel
  registry: KernelRegistry
  tracer: KernelTracer
  provenance: KernelProvenance
  eventBus: CapabilityEventBus
  config: ConfigManager
  store: KernelStore | null
  logger: KernelLogger
  oracle: { query; diagnostic; actuator; events } | null
}
```

Engines receive their dependencies **explicitly in the constructor** (manual
constructor injection), e.g. `CapabilityEngine(governor, store, eventBus)`.

### The hard DI seam: store contracts

A governing invariant (AGENTS.md "Store Contracts"):

> Engines depend on `src/storage/contracts/*.ts`, never `src/storage/impl/*.ts`.

This is the formal dependency-injection boundary. Persistence is injected as an
**interface**. The impl (`*-impl.ts`) is constructed elsewhere and handed to the
engine. This gives:

- Compile-time seam between logic and storage.
- Swappable backends (the `StoreFactory` selects `sqlite | postgres | mysql`).
- Testability: a mock contract satisfies the engine.

### Observers as injected behaviour

`KernelRegistry` exposes `onRegister` / `onStatusChange` callbacks — a lightweight
**observer injection**: behaviour is injected to react to registration/status
events without the emitter depending on the listener.

### Bootstrap wiring

`bootstrapKernel` (`kernel-bootstrap.ts`) is the composition root. It:

1. Constructs `KernelRegistry`, `KernelTracer`, `KernelProvenance`, `ConfigManager`.
2. Calls `createKernel({...})` to build the `KernelContext`.
3. Declaratively `registerEngine` / `registerStore` / `registerRoute` for each
   subsystem (governor, conversation-manager, unified-registry, NLCL commands as
   capabilities, db, routes).
4. Constructs the `oracle` sub-system and attaches it to the context.

This is **explicit, centralised, declarative composition** — textbook DI composition
root.

## cap-store (OG): parameter threading, no container

cap-store has **no DI container and no context object**. Dependencies travel as
**function parameters**, most importantly `db: CapStoreDb`:

```ts
executeBinding(db: CapStoreDb, opts: ExecuteOptions)
resolve(opts: { db, verb, args?, targets? })
dispatch(db: CapStoreDb, req: DispatchRequest)
```

Cross-cutting services (logger, fleet, diagnostics) are **imported as singletons**
rather than injected:

```ts
import { fleetSupervisor as fleet } from './fleet-supervisor.js'
import { getLogger } from '../cli/diag/logger.js'
```

### What this buys / costs

- **Buys**: simplicity, no boilerplate, easy to call any function from anywhere.
- **Costs**:
  - No compile-time seam between logic and storage (a concrete `CapStoreDb` is
    threaded everywhere).
  - Harder to substitute backends/mocks without also swapping the imported
    singleton graph.
  - No central place that *declares* the system's composition (there is no registry
    equivalent).

## Side-by-side

| Aspect | vivim-final | cap-store (OG) |
|---|---|---|
| Container | `KernelContext` object | none |
| Injection style | constructor (manual) | function-parameter threading |
| Persistence seam | interface contracts (`contracts/*.ts`) | concrete `CapStoreDb` param |
| Cross-cutting | injected into context | imported singletons |
| Composition root | `bootstrapKernel` (declarative) | implicit (module imports) |
| Observers | `onRegister`/`onStatusChange` | n/a |
| Backend swap | `StoreFactory` + contract | swap `CapStoreDb` impl |

## Takeaway

vivim-final treats DI as a **first-class architectural protocol** (context + contract
+ composition root). cap-store treats dependencies as **ordinary parameters + module
singletons** — pragmatic, but with no enforced seam. The contract seam is the single
most exportable idea from vivim-final into cap-store-style code.
