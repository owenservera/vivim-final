# 02 — Philosophical Divergence: Code-First Kernel vs Data-First CDP

This document frames the **deepest** difference — the axis everything else hangs on.

## The axis: *what gets injected, and when*

```
vivim-final:   [code objects]  ──(register at bootstrap)──▶  [running kernel]
               engines, capabilities, stores, routes
                      │
                      │  every engine receives a KernelContext (DI)
                      ▼
               one wired, observable, multi-surface system

cap-store (OG): [DB rows]  ──(load at execute-time)──▶  [live Chrome slave]
               taxonomy → binding → program → recipe
                      │
                      │  program translated to CDP steps, injected into a page
                      ▼
               one DOM action sequence performed in a browser
```

## vivim-final: everything is a registered code object

In vivim-final, the unit of capability is a **first-class code artifact**:

- Engines are TypeScript classes constructed with explicit dependencies
  (`CapabilityEngine(governor, store, eventBus)`).
- Capabilities are objects with a `handler` closure
  (`unified-registry.ts` `UnifiedCapability`).
- The system describes *itself* through a `KernelRegistry` that knows the
  dependency graph, status, and provenance of every engine/store/capability/route.

The philosophical stance: **the platform is a self-describing graph of wired
components**, and "injection" means *connecting those components and declaring them
to the kernel*.

Consequences:

- Capabilities exist **before any request arrives** (compile/bootstrap time).
- The kernel can answer "what are you made of?" (`registry.describe()`).
- Multi-surface parity is enforced **statically** (`validateCapability` throws if a
  capability claims a surface without the matching export block).

## cap-store (OG): everything is a DB row executed at call time

In cap-store, the unit of capability is **persisted data**:

- A `verb` resolves to a `taxonomy` global; the global has `ProviderBinding`s.
- A binding points at a `best_program_id` → an `ActionProgram` (a list of `click`,
  `type`, `wait`, `navigate`, `arm` ops).
- At `executeBinding`, the program is converted to a `Recipe` and the steps are
  **injected into a real browser** via CDP.

The philosophical stance: **the platform is a data-driven action dispatcher**, and
"injection" means *loading a recipe and performing it against a runtime target*.

Consequences:

- Capabilities are **discovered per request** from the DB.
- The system's behaviour can change **without code changes** (new binding/program
  row = new behaviour).
- Execution is **imperative and side-effecting** against a live DOM, not a closure
  invocation.

## Why this matters for "injection"

| | vivim-final | cap-store (OG) |
|---|---|---|
| What is injected | components + wiring | behaviour + data |
| When | bootstrap / compile time | execute time |
| Where it lands | the kernel graph | a Chrome page |
| Mutation cost | recompile + re-register | insert a DB row |
| Self-description | intrinsic (registry) | extrinsic (must query DB) |

Both are legitimate; they answer different questions:

- vivim-final answers *"how is this system composed and observed?"*
- cap-store answers *"how do we perform this action in a provider's UI?"*

The synthesis (doc 09) is that **both injections are needed**: vivim-final's wiring
substrate to *host* capabilities, cap-store's program→recipe injection to *perform*
them.
