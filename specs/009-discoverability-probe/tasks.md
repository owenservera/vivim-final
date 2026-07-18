# Tasks: Discoverability Probe (009)

> SPECKIT `tasks` artifact. Phased breakdown; each line is a DevOps-bridge-able unit.

- [ ] T1 [P] [US1] Two-command ceiling: boot server, run one discovery command, assert full capability visibility → `tests/e2e/discoverability/two-command-ceiling.test.ts`
- [ ] T2 [P] [US3] Latency budget harness: time each CLI discovery command, fail if p95 > 2s → `tests/e2e/discoverability/latency-budget.test.ts`
- [ ] T3 [P] [US4] Right-data coverage: cross-check registered caps vs CLI-reachable caps, report delta → `tests/e2e/discoverability/right-data-coverage.test.ts`
- [ ] T4 [P1] [US2] Oracle single-call: exercise kernel oracle `op:"all"` via CLI, assert topology+health+capability+config → `tests/e2e/discoverability/oracle-single-call.test.ts`
- [ ] T5 [P1] [US4] NL resolve speed: drive `interpret` via CLI, assert NL→capability latency + correctness → `tests/e2e/discoverability/nl-resolve-speed.test.ts`
- [ ] T6 [P] [R6] Gap log: write `DISCOVERABILITY-GAPS.md` with severity + invariant violations → `DISCOVERABILITY-GAPS.md`
- [ ] T7 [P] [R0] Shared harness: `tests/e2e/discoverability/harness.ts` (spawnCli, spawnDevops, startServer, parseCapabilities) consumed by T1–T5

## Dependencies

- T7 must land before T1–T5 (shared harness).
- T1, T2, T3, T5 require a running server (use harness.startServer).
- T4 requires the kernel oracle to be reachable via CLI (probe; if not, logs GAP-3).
- T6 is independent; written last after gaps are confirmed by T1–T5 output.

## Verification

- `bun run devops gate` (typecheck + lint + bun test) must pass for all new files.
- Each test prints a structured summary so the gap log (T6) can cite measured numbers.
