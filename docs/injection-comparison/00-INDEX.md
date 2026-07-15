# Injection Methodology Comparison — vivim-final vs cap-store (OG)

> Scope: **methodology and conceptual design** of *injection* — how engines,
> capabilities, providers, configurations, and side-effects are **wired into** the
> running system — not the line-by-line orchestration logic.
>
> Two repos compared:
> - **vivim-final** — `C:\0-BlackBoxProject-0\vivim-final` (cap-store v1 Knowledge-Graph Rebuild)
> - **cap-store (OG)** — `C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\cap-store` (v0.1/0.2 executor library)

## What "injection" means in each repo

| Repo | Primary meaning of "inject" |
|------|------------------------------|
| **vivim-final** | **Dependency injection** of code objects into a kernel meta-layer: a `KernelContext` passed to every engine constructor, **store contracts** as the DI seam, and **capability registration** into a unified multi-surface registry. |
| **cap-store (OG)** | **Data-driven injection into a live browser**: load a `ProviderBinding` + `ActionProgram` from the DB at execute-time, translate it to a CDP `Recipe`, and inject the action sequence into a hidden Chrome slave. |

These are not the same axis. vivim-final injects *code and wiring*; cap-store injects
*behaviour into a runtime target*. This is the deepest divergence and the spine of
every comparison below.

## Document set

1. [01-executive-summary.md](./01-executive-summary.md) — one-page synthesis + verdict
2. [02-philosophical-divergence.md](./02-philosophical-divergence.md) — code-first kernel vs data-first CDP
3. [03-dependency-injection-protocol.md](./03-dependency-injection-protocol.md) — KernelContext/contracts vs param-passing
4. [04-capability-registration-injection.md](./04-capability-registration-injection.md) — UnifiedCapabilityRegistry vs taxonomy/binding/program
5. [05-execution-injection-boundary.md](./05-execution-injection-boundary.md) — Governor Canon vs fleet+CDP recipe
6. [06-lifecycle-protocol.md](./06-lifecycle-protocol.md) — kernel status vs status ladder + confidence
7. [07-surface-exposure-protocol.md](./07-surface-exposure-protocol.md) — 5-surface auto-export vs REST/WS execute
8. [08-resolution-routing-protocol.md](./08-resolution-routing-protocol.md) — NLCL interpret vs router verb fan-out
9. [09-conceptual-synthesis.md](./09-conceptual-synthesis.md) — shared invariants, convergences, recommendations
10. [10-glossary.md](./10-glossary.md) — term mapping across the two codebases

## Reading order

Start at `01` for the verdict, then read `02`–`08` topically, then `09` for the
synthesis, and `10` whenever a term differs between the repos.
