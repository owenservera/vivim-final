# Feature Spec: DB-Driven Capability Execution (Boot Snapshot)

**Feature branch**: `019-name-driven-capability-execution`
**Date**: 2026-07-18
**Status**: Active
**Related**: 015-mvp-implementation (frontend glue), parser-execution gap analysis

## Problem Statement

The system ports two bodies of logic into the database but does not execute them at
runtime:

1. **Parsing logic** — `provider_parser` rows carry `parser_logic_code` (inline TS),
   but `StreamParserEngine` executes it correctly only when a `SandboxRunner` is wired.
   The production server constructs the engine **without** a sandbox, silently degrading
   to host `new Function` + a string assertion. Worse, the registrar writes
   `fallbackParserId: null` unconditionally, dropping the manifest `fallback` field, so
   the DB `fallbackParserId` graph (self-relation) is never populated — the engine's
   graph-walk short-circuits to a single terminal node.

2. **Capability taxonomy** — 253 taxonomy items + 104 bindings were ported from OG into
   `capability_taxonomy` / `capability_binding`, but they are **write-only**. At boot,
   only the static in-memory `CDP_PROTOCOL_CATALOG` (96 commands) is registered as live
   `cap:cdp:*` capabilities. `governor.executeCapability()` hard-fails on any non-`cap:cdp:`
   slug, so the ported capabilities are invisible and unexecutable at runtime. The DB is
   a side-effect, not the source of truth for execution.

## Goal

Make the database the **source of truth** for both parser logic and capability execution,
with a boot-time snapshot loaded into memory (fast, no per-request DB hit), and a by-need
sandboxed execution system. CDP protocol commands may stay in the static catalog; the
ported taxonomy + bindings + programs must be loaded from the DB snapshot and become
executable through the One Entry Point.

## Requirements

### R1 — Parser execution hardening
- R1.1 `StreamParserEngine` MUST receive a `SandboxRunner` in the production server path
  (`src/server/index.ts`); fail closed if absent rather than degrading to host eval.
- R1.2 `ProviderRegistrar` MUST populate `fallbackParserId` from the manifest `fallback`
  field via a 2-pass insert (insert all parsers, then resolve `fallback` slug → row id).
- R1.3 `ProviderRegistrar` MUST default `logic_type` to `inline` and validate that inline
  parsers carry `logic_code`.

### R2 — Capability boot snapshot
- R2.1 A `CapabilitySnapshot` engine loads `capability_binding` rows filtered by the set
  of registered/active providers, joining `capability_taxonomy` + best `capability_program`,
  into an in-memory map at boot.
- R2.2 The snapshot is static for the process lifetime (no per-request DB query).
- R2.3 `governor.executeCapability()` MUST resolve non-`cap:cdp:` capabilities from the
  snapshot and execute their best program via the harness executor when available.
- R2.4 The registered-providers filter = active `ProviderDefinition` rows (or
  `ProviderAccount` rows with `is_default`).

### R3 — Dev/test isolation
- R3.1 A separate test DB (`prisma/test.db`) seeded from the same port script, regenerable
  via `DATABASE_URL=file:./test.db`, without touching prod.

### R4 — Constitution compliance
- R4.1 Governor Canon: snapshot loader never imports `BunCdpClient`.
- R4.2 Store Contracts: snapshot reads through `CapabilityStore` / `ProviderStore` contracts.
- R4.3 One Entry Point: ported capabilities reachable via `POST /api/capabilities/:id/execute`.

## Out of Scope
- Boot-snapshot system for parser *logic* versioning (user owns that layer).
- Frontend chat surface (covered by 015).
- Re-porting more taxonomy items.

## Success Criteria
- `bun test` green for parser + snapshot.
- At boot, ported capabilities appear in the in-memory registry/resolver (visible).
- A non-CDP capability slug resolves from the snapshot and executes its best program.
- `StreamParserEngine` runs inline logic inside a sandbox in the server path.
- `fallbackParserId` populated for seeded parsers that declare `fallback`.
