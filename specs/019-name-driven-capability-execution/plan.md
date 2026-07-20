# Implementation Plan: DB-Driven Capability Execution (Boot Snapshot)

**Branch**: `019-name-driven-capability-execution` | **Date**: 2026-07-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/019-name-driven-capability-execution/spec.md`

## Summary

The DB already stores parser logic (`provider_parser.parser_logic_code`) and the ported
capability taxonomy/bindings/programs, but neither is executable at runtime. This feature
makes the DB the source of truth via (a) a boot-time `CapabilitySnapshot` loaded from
`capability_binding` filtered by registered providers, and (b) parser-execution hardening:
wire the `SandboxRunner` into the server path and populate the `fallbackParserId` graph
from seed manifests. Execution stays by-need and sandboxed; CDP commands may remain static.

## Technical Context

**Language/Version**: TypeScript 5.x (strict, ESNext) / Bun runtime
**Primary Dependencies**: Bun, Prisma v6.5, Zod, React 19
**Storage**: SQLite via Prisma (`dev.db` prod, `prisma/test.db` test)
**Testing**: Bun test runner (`bun test`)
**Target Platform**: Windows (PowerShell 7+), Bun HTTP server
**Project Type**: Full-stack monorepo (13 engines + API + React frontend)
**Linter/Formatter**: Biome
**Build**: tsup (ESM + DTS)

**Performance Goals**: Snapshot load at boot (<50ms for ~350 bindings); zero per-request DB
queries for capability resolution; parser inline-logic exec <5ms in sandbox.

**Constraints**:
- Governor Canon — snapshot loader + registrar never import `BunCdpClient`.
- Store Contracts — read via `CapabilityStore` / `ProviderStore` contracts, not impls.
- One Entry Point — ported capabilities reachable via `POST /api/capabilities/:id/execute`.
- Sandbox-first — inline parser logic executes inside `SandboxRunner`, fail closed otherwise.

## Constitution Check

*GATE: Must pass before implementation. Re-check after design.*

- [x] Governor Canon: no engine imports BunCdpClient directly (snapshot reads only taxonomy/binding/program tables)
- [x] Store Contracts: `CapabilitySnapshot` depends on `CapabilityStore` + `ProviderStore` contracts
- [x] One Entry Point: ported caps resolved + executed through `governor.executeCapability` / registry
- [x] Custom errors: use `EngineError` from `src/errors.ts`
- [x] TypeScript strict: no `any`, `type` imports, `.js` extensions
- [x] Tests: unit for snapshot + parser, integration for boot load, typecheck + lint gates

## Project Structure

### Documentation (this feature)

```text
specs/019-name-driven-capability-execution/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── capability-snapshot.md
└── tasks.md             # Phase 2 output (devops loop generates)
```

### Source Code Changes

```text
src/
├── engines/
│   ├── capability-snapshot.ts        # NEW — boot loader into in-memory map
│   ├── cdp-capability-registrar.ts   # extend executeCapability to read snapshot
│   └── stream-parser.ts              # R1.1 — require SandboxRunner (already gated)
├── storage/contracts/
│   ├── capability-store.ts           # add loadSnapshot(providerIds)
│   └── parser-store.ts               # (done) getParserByProviderAndVersion/getParserById
├── storage/impl/
│   ├── capability-store-impl.ts      # NEW — loadSnapshot query (binding→taxonomy→program)
│   └── parser-store-impl.ts          # (done) semver + graph resolution
├── engines/provider-registrar.ts     # R1.2/R1.3 — populate fallbackParserId, default inline
└── server/index.ts                   # R2.2 — wire snapshot.load at boot; R1.1 — pass sandbox
```

**Structure Decision**: Extends existing 13-engine monorepo. No new layers; snapshot is a
thin read-only projection engine; registrar gains a 2-pass insert.

## Complexity Tracking

> No Constitution violations. Sandbox requirement is stricter (fail-closed) than current
> host-eval fallback, but that is a hardening, not a violation.
