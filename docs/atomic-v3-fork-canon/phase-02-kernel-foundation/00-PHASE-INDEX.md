# Phase 2: Kernel Foundation

**Source:** v5 Phase 00 (`docs/atomic-v5/phase-00-kernel-core/` + `docs/atomic-v5/phase-00-surgical-edit/`)
**Units:** 9 | **Done:** 0 | **Pending:** 9
**Dependencies:** Phase 1 (error classes, ID system)
**⚠ Must complete before Phase 3.** All subsequent engines register with KernelRegistry.

## Units

| Fork ID | v5 ID | Name | Status | File |
|---------|-------|------|--------|------|
| 2.1 | 0.0 | CapabilityEventBus Upgrade: error isolation, envelopes, wildcards, DLQ | `[ ]` | `docs/atomic-v5/phase-00-surgical-edit/0.0-capability-event-bus-upgrade.md` |
| 2.2 | 0.5 | Prisma Schema Migration: 4 kernel tables | `[ ]` | `docs/atomic-v5/phase-00-surgical-edit/0.5-prisma-schema-migration.md` |
| 2.3 | 0.7 | Test Infrastructure Consolidation: shared mocks, coverage targets | `[ ]` | `docs/atomic-v5/phase-00-surgical-edit/0.7-test-infrastructure.md` |
| 2.4 | 0.1 | KernelRegistry: engine/store/capability self-registration | `[ ]` | `docs/atomic-v5/phase-00-kernel-core/0.1-kernel-registry.md` |
| 2.5 | 0.2 | KernelContext: unified context object for all engines | `[ ]` | `docs/atomic-v5/phase-00-kernel-core/0.2-kernel-context.md` |
| 2.6 | 0.3 | KernelTracer: span-based tracing engine | `[ ]` | `docs/atomic-v5/phase-00-kernel-core/0.3-kernel-tracer.md` |
| 2.7 | 0.4 | KernelProvenance: causal chain recording | `[ ]` | `docs/atomic-v5/phase-00-kernel-core/0.4-kernel-provenance.md` |
| 2.8 | 0.6 | KernelBootstrap: wire into createServerWithEngines | `[ ]` | `docs/atomic-v5/phase-00-kernel-core/0.6-kernel-bootstrap.md` |
| 2.9 | 0.6a | Server Bootstrap Refactor: kernel-first bootstrap | `[ ]` | `docs/atomic-v5/phase-00-surgical-edit/0.6a-server-bootstrap-refactor.md` |

## Internal Dependencies

```
2.1 (0.0) ──┐ (no deps, can parallel)
2.2 (0.5) ──┤ (no deps, can parallel)
2.3 (0.7) ──┘ (no deps, can parallel)
                     ↓
2.4 (0.1) ➔ 2.5 (0.2) ➔ 2.6 (0.3) ➔ 2.7 (0.4) ➔ 2.8 (0.6) ➔ 2.9 (0.6a)
Registry → Context → Tracer → Provenance → Bootstrap → Refactor
```
