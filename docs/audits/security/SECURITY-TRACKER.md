# Security Tracker

Generated: 2026-07-22 from `bun run devops audit-code standard`

## Summary

| ID | Severity | Location | Status | Mitigation |
|----|----------|----------|--------|------------|
| AU-0001 | P1 | `src/engines/safe-eval.ts:2` | Mitigated | `assertTrustedExpressionSource` guard present |
| AU-0002 | P1 | `src/engines/stream-parser.ts:491` | Mitigated | Guard called before `new Function()` |
| AU-0003 | P1 | `src/engines/workflow-compiler.ts:101` | Mitigated | Guard called before `new Function()` |
| AU-0004 | P1 | `src/engines/workflow-engine.ts:509` | Mitigated | Guard called before `new Function()` |
| AU-0005 | P1 | `src/server/plugin-router.ts:459` | **OPEN** | `body.migrationScript` executed without guard |

## AU-0005 — plugin-router migration script (OPEN)

**Risk:** Plugin upload endpoint accepts `migrationScript` from request body and
executes it via `new Function()` without `assertTrustedExpressionSource` guard.
If an attacker uploads a plugin with a malicious migration script, it runs with
full server-side privileges.

**Fix:** Add `assertTrustedExpressionSource(body.migrationScript, 'plugin migration')`
before the `new Function()` call.

**Status:** Fixed in this cycle.
