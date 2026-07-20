# Tasks: Convergence Auditor (028)

## Phase 0 — Research (done, findings in research.md)
- [x] Inspect v6/v7/v8 upload format (MASTER-PROMPT.txt + BUNDLE-*.txt + COMBINED-PROMPTS.txt)
- [x] Read agent-brief 00-02, v8/V8_MASTER_PROMPT.txt, docs/roadmap/{GOALS,M4-CANVAS-PLAN,INVARIANTS}.md
- [x] Confirm drift symptoms: v7 master prompt says "BUILD V6"; v8 has own backend

## Phase 1 — Baseline extraction
- [ ] T1: Write `dev-poc/canvas/_audit/gen-baseline.ts` that reads the 4 source docs and writes `dev-poc/canvas/_baseline/baseline-0{1..4}.txt`
- [ ] T2: Run it; verify 4 baseline files exist and are self-contained

## Phase 2 — Audit engine (Phase A-D)
- [ ] T3: `lib/contracts.ts` — define 6 ConvergenceContracts + checker returning status+evidence
- [ ] T4: `lib/grep.ts` — bounded grep over delivered version (stream, cap output)
- [ ] T5: `lib/baseline.ts` — load `_baseline/*.txt` into VisionBaseline
- [ ] T6: `lib/report.ts` — write CONVERGENCE-REPORT.md + ledger.json
- [ ] T7: `audit-version.ts` — orchestrate A (contracts), B (ledger diff), C (vision score), D (enhancements)
- [ ] T8: Run `audit-version.ts --version v8`; verify report flags own-backend + missing integration

## Phase 3 — Blueprint generator
- [ ] T9: `concatenate-prompts.ts` — reusable concatenator (upgrade of V6 script)
- [ ] T10: `build-next-version.ts` — emit vNEXT MASTER-PROMPT.txt + BUNDLE-*.txt + COMBINED-PROMPTS.txt
- [ ] T11: Run `build-next-version.ts --version v8 --next v9`; verify pack self-contained + combined concatenates

## Phase 4 — Wrapper + skill
- [ ] T12: `converge.ps1` — one-shot audit→blueprint, $PSScriptRoot-safe
- [ ] T13: `.opencode/skill/convergence-auditor/SKILL.md` — triggers + workflow doc
- [ ] T14: Upgrade `V6/concatenate-prompts.ps1` to call reusable concatenator (compat)

## Phase 5 — Verify
- [ ] T15: `bun test` on audit/blueprint unit checks (contract checker, concatenator)
- [ ] T16: End-to-end: `pwsh dev-poc/canvas/_audit/converge.ps1 -Version v8 -Next v9` produces both artifacts
- [ ] T17: Confirm SC-001..SC-005 from spec hold
