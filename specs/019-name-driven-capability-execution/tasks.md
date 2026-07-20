# Tasks: DB-Driven Capability Execution

**Feature**: 019-name-driven-capability-execution
**Date**: 2026-07-18

Atomic units, ordered. Each maps to a requirement.

## T1 — `CapabilityStore.loadSnapshot` contract + impl  [R2.1]
- Add `loadSnapshot(providerIds: string[]): Promise<SnapshotRow[]>` to
  `src/storage/contracts/capability-store.ts`.
- Implement in `src/storage/impl/capability-store-impl.ts`: one bulk query —
  `capabilityBinding` where `providerId IN providerIds AND status='active'`,
  include taxonomy + best program (`bestProgramId`/`currentProgramId`).
- Map to `SnapshotRow`.

## T2 — `CapabilitySnapshot` engine  [R2.1, R2.2]
- New `src/engines/capability-snapshot.ts`.
- `load(registeredProviderIds)` → `store.loadSnapshot` → build maps
  `bySlug` (`slug@providerId`), `byId` (`globalId@providerId`), `bySlug` fallback
  (provider-agnostic).
- `getBySlug`, `getById`, `all()`. `executable = programId != null`.

## T3 — Wire snapshot at boot + execute non-CDP caps  [R2.2, R2.3]
- `src/server/index.ts`: after `registrar.seedAll()`, compute registered provider ids
  from `providerStore.listDefinitions({isActive:1})`; `snapshot.load(ids)`; log count.
- Extend `governor.executeCapability` (`src/engines/chrome-governor.ts`): if slug not
  `cap:cdp:`, resolve from snapshot; if executable, run best program via `browserHarness`
  / harness executor; else throw precise error.
- Pass snapshot into governor (e.g. `governor.setCapabilitySnapshot(snapshot)`).

## T4 — Parser sandbox in server path  [R1.1]
- `src/server/index.ts:261`: construct `SandboxRunner` (as `discovery-stack.ts:72` does)
  and pass to `new StreamParserEngine(parserStore, undefined, sandboxRunner)`.
- `StreamParserEngine` already gates `loadFileParser` on `allowFileLogic` (Phase A, done).

## T5 — Registrar populates fallbackParserId  [R1.2]
- `src/engines/provider-registrar.ts`: 2-pass insert. Pass 1 inserts all parsers (capture
  ids). Pass 2 resolves `parser.fallback` (provider slug) → row id and `update`s
  `fallbackParserId`. Remove hardcoded `null` (line 151).

## T6 — Registrar defaults inline + validates  [R1.3]
- `provider-registrar.ts:143`: default `logic_type` to `'inline'`.
- Validate inline parsers carry `logic_code`; throw `EngineError` if `inline` + no code.

## T7 — Test isolation (test.db)  [R3.1]
- Add `prisma/test.db` regeneration: `DATABASE_URL="file:./prisma/test.db" bunx prisma db push`.
- Seed script variant against test.db.

## T8 — Unit + integration tests
- `tests/unit/engines/capability-snapshot.test.ts` (mocked store).
- `tests/unit/engines/stream-parser.test.ts` (rewrite for inline + fallback graph).
- `tests/integration/capability-snapshot.test.ts` (test.db).

## T9 — Devops gates
- `bun run devops invariants check --category B`
- `bun run devops audit-code standard`
- `bun run devops verify-cross-surface`
- `bun test`
