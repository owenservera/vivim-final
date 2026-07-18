# CLI Gap Analysis — 20-Step Recipe

**Goal:** Identify every CLI-command hole, document findings, and produce a fix plan.

## Context
- `src/cli/index.ts` is the CLI entry — currently hardcodes `serve` + `help`, multi-word commands broken
- `registry-bridge.ts` is supposed to sync `UnifiedCapabilityRegistry` → `CommandRegistry` — **never called**
- 196 taxonomy-pool capabilities ALL declare `cliCommand` — 100% surfaces-cli coverage, 0% reach the CLI
- Pool has 58+ duplicate alias collisions
- Hand-written commands (`automate.ts`, `moments.ts`) bypass the registry entirely

## Recipe

### Phase A — Source Inventory (Steps 1–6)
1. Scan `src/cli/` — catalog every file, its exports, its actual usage
2. Scan `src/cli/index.ts` — trace `main()` parse/resolve/execute flow; identify single-token bug
3. Count hand-written commands in `src/cli/commands/` — which use registry, which bypass
4. Extract all `cliCommand { name, aliases }` from taxonomy pool (`pool.taxonomy.json`)
5. Detect duplicate alias collisions in pool
6. Detect duplicate CLI-name collisions in pool

### Phase B — Registry & Bridge Analysis (Steps 7–10)
7. Grep all callers of `connectCapabilityRegistry` — confirm dead code
8. Read `syncCliFromUnified` — does it handle multi-word names? alias dedup?
9. Read `capability-bootstrap.ts` — which capabilities have `surface: 'cli'` + `cliCommand`?
10. Read `capability-bootstrap-generated.ts` — what does `registerGeneratedCapabilities` register?

### Phase C — Runtime Tracing (Steps 11–13)
11. Start server, inspect `reg.list({ surface: 'cli' })` output at boot
12. Run `bun run src/cli/index.ts help` — verify empty output
13. Run `bun run src/cli/index.ts admin db status` — confirm "Unknown command" + why

### Phase D — Findings & Fix Plan (Steps 14–17)
14. Aggregate all findings into 3 severity tiers (P0 = broken resolve, P1 = unreachable commands, P2 = alias collisions)
15. Design fix for `main()` to use `registry.resolve()` instead of `find()`
16. Design fix for `connectCapabilityRegistry` to be called during server boot
17. Design dedup strategy for taxonomy pool aliases

### Phase E — Implementation & Verify (Steps 18–20)
18. ✅ Implement all P0 fixes (resolve, bridge wiring)
19. ✅ Implement P1 fixes (verify `help`, multi-word dispatch, alias dedup)
20. ✅ Final verification — `bun run src/cli/index.ts help` lists all 196, multi-word commands resolve

### Phase F — Follow-up Hardening (Steps 21–25)
21. ✅ De-dup 68 conflicts in `pool.taxonomy.json` → 0 alias collisions (verified by verify-cross-surface)
22. ✅ Unify `automate` + `moments` into CommandRegistry via `src/cli/commands/builtins.ts`
23. ✅ Add regression test `tests/unit/cli/dispatch.test.ts` (6 pass)
24. ✅ Optimize `verify-cross-surface --runtime` to bounded concurrency (8 in-flight)
25. ✅ Document thin-client architecture in AGENTS.md (CLI Dispatch subsection)

**All steps complete.** CLI now exposes 196 capabilities + 2 builtins via `help`,
multi-word dispatch works (`admin db status`), and the cross-surface gate passes
with 0 alias collisions.
