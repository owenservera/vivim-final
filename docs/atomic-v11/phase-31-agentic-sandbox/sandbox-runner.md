# Unit 31.1 — SandboxRunner (hardened execution)

**Fork ID:** 3.13 (v3: 2.13) | **Status:** `[x]` | **Class:** C

> **Audit (2026-07-13):** No `SandboxRunner` class, no `sandbox-runner.ts`, no `sandbox_audit` table. `src/engines/stream-parser.ts:195` still uses `new Function(...)` (the exact vulnerable pattern this unit must replace). Confirmed `[ ]`.
> **Implementation (2026-07-13):** Added `src/engines/sandbox-runner.ts` (`SandboxRunner` — frozen null-prototype `node:vm` context, `SandboxPermissions`, CPU budget via `vm` timeout, memory budget via injectable `memoryProbe` watchdog, per-run `SandboxAudit` row). Added `SandboxAudit` Prisma model + migration `20260713000000_add_sandbox_audit` + `SandboxAuditStore` contract/impl. `StreamParserEngine.loadInlineParser` now routes inline parser code through `SandboxRunner` (legacy `new Function` kept as fallback only when no runner injected). 6 unit tests pass.
**Source spec:** `docs/atomic-v3-fork-canon/phase-03-agentic-core/2.13-sandbox-runner.md`
**Depends on:** Phase 2 KernelRegistry

## Context
`StreamParserEngine.loadInlineParser` runs DB-stored JS via `new Function('module','exports',code)` (`src/engines/stream-parser.ts`). Live-capability inline handlers compound this: no isolation, no resource limit, no permission model. `SandboxRunner` executes untrusted code in a hardened `node:vm` context.

## Current State
- `src/engines/stream-parser.ts:195` — vulnerable `new Function` pattern (baseline to keep, but new inline capability code MUST use SandboxRunner).
- `src/engines/errors.ts` — typed `EngineError` / `CapStoreError`.
- No `sandbox_audit` table or `SandboxRunner` class yet.

## Requirements
New `src/engines/sandbox-runner.ts`:
- `vm.createContext` with a **frozen** context — no `process`, `require`, `fetch`.
- `SandboxPermissions { canFetch: string[], canReadFile: string[], canWriteFile: string[], canUseClipboard: boolean }`.
- CPU budget via `vm` timeout + `AsyncResource`; memory budget via `process.memoryUsage()` polling that destroys context on breach.
- Audit row in `sandbox_audit` for every invocation (ok + fail).
- New `SandboxAuditStore` contract under `src/storage/contracts/`.

## Acceptance Criteria
1. `run()` has no access to `process` / `require` / `fetch`.
2. Code exceeding `cpuMs` is aborted (no hang).
3. Code exceeding `memoryBytes` is aborted.
4. A `sandbox_audit` row is written for every invocation.
5. `bun run devops invariants check --category F` (no eval outside SandboxRunner) passes.

## Tests
`tests/unit/engines/sandbox-runner.test.ts` — safe code returns value + audit row; `process` access → `ok:false`; infinite loop → CPU abort; `canUseClipboard:false` → `navigator` undefined.

## DevOps
```powershell
bun run devops invariants check --category F
bun run devops gate
```
