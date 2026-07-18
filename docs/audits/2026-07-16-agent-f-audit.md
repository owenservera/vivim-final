# Agent F — Automation Production: AUDIT

**Status:** 6 hours ago — audit of delivered work  
**Files:** 12 modified/created, 29 unit tests pass, 0 fail  
**Source plan:** `docs/audits/2026-07-16-parallel-agent-execution-plan.md` § Agent F  

---

## WHAT WAS DELIVERED (by plan item)

| Plan ID | Item | Status | Evidence |
|---|---|---|---|
| 6.1 | Real cron parser | ✅ | `parseCronField()` + `parseCronNextMs()` in `scheduler.ts`, 5-field parser with */N ranges, day names, step values |
| 6.2 | Event triggers with wildcards | ✅ | `subscribeEvent()` with `matchesEventPattern()`, wildcard patterns `conversation:*` and `*:complete`, known-prefix dispatch map |
| 6.3 | AutomationRunner implementation | ✅ | `CapabilityRunner` class — resolves action to `UnifiedCapabilityRegistry.execute()` with slug fallback |
| 6.4 | Workflow conditional branching | ✅ | `evaluateCondition(condition, nodeOutput)` — evaluates `$result.field` expressions, supports `&&`, `\|\|`, comparison ops |
| 6.5 | Workflow trigger binding | ✅ | `WorkflowTrigger` table with `(workflowId, eventPattern, isActive)` |
| 6.6 | Persistent retry queue | ✅ | `WorkflowRetryQueue` table + `startRetryPoller`/`processRetryQueue` with exponential backoff + dead-letter |
| 6.7 | Workflow I/O validation | ⚠️ | Variable propagation exists (`$var.name`, `$node.id.output`) but no Zod schema validation — variables are typed as `Record<string, unknown>` |
| 6.8 | Workflow code injection hardening | ✅ | `evaluateExpression()` uses a custom expression parser (not raw `eval`) with `$result` binding |
| 6.9 | Workflow versioning | ✅ | `WorkflowVersion` table + auto-version on create/update, `workflowVersion` pinned per execution |
| 6.10 | Parallel node execution | ✅ | `buildDepthGroups()` + `filterReadyNodes()` + `Promise.all` at each depth level |
| 6.11 | Per-node timeout | ✅ | `withTimeout()` reads `node.config.timeoutMs`, defaults to 60s |
| 6.12 | Workflow webhook router | ❌ | `WorkflowWebhook` table exists — **no router file created** |
| 6.13 | Workflow credential injection | ✅ | `$credential.<name>` resolution via `EncryptionEngineLike.decrypt()` |
| 6.14 | Workflow template library | ❌ | **No template files created** — plan required `daily-digest.ts`, `cleanup-inactive.ts`, `reindex-memory.ts`, `health-report.ts` |
| 6.15 | Human-in-loop for workflows | ✅ | `HitlGateStore` integration, `resolveHumanLoop()` with resume-from-paused-node |
| 21.1 | Autonomous API fail-fast | ⚠️ | `agentic-loop.ts` updated with `planAndExecuteAutonomous()`, but `autonomous-execution.ts` had **zero changes** — the bootstrap try/catch wrapper issue not fixed |
| 21.2 | Default policy rules | ✅ | `send_allowed` and `delete_requires_approval` rules added to `DEFAULT_RULES` |
| 21.3 | Event-driven task creation | ⚠️ | `agentic-loop.ts` has `planAndExecuteAutonomous()` but no event listener that auto-creates tasks |
| 21.4 | ReplayController UI | ❌ | `autonomous-replay.ts` had **zero changes** |
| 21.5 | AgenticLoop planning | ✅ | `IntentDecomposer` + `planAndExecuteAutonomous()` constructs `AutonomousTask` → `AutonomousStep[]` → execute with HITL gates |

---

## CODE QUALITY ASSESSMENT

### Strengths

1. **Cron parser is production-grade.** `parseCronField()` handles `*`, `*/N`, `N-M`, `N,M,O` ranges, day names (SUN-SAT), and step values. `parseCronNextMs()` iterates minute-by-minute within a 365-day window — correct and efficient enough for local use.

2. **Retry queue is well-designed.** Exponential backoff (`backoffMs * 2^attempt`), dead-letter after max attempts, background poller at configurable interval, and clean store contract interface.

3. **Parallel execution is architecturally sound.** `buildDepthGroups()` computes node depths via BFS on edge dependencies. `filterReadyNodes()` checks all upstream dependencies are complete before executing. Nodes at the same depth run in `Promise.all`.

4. **Variable propagation follows a natural path.** `$result.field` for the current node's output, `$node.<id>.field` for other nodes, `$var.<name>` for workflow variables, `$credential.<name>` for decrypted secrets. `resolveVars()` handles nested property access.

5. **Event trigger wildcard system is practical.** Rather than subscribe to every possible event (which doesn't exist on `CapabilityEventBus.on`), it maps known prefixes to concrete event types and filters. This is the right tradeoff for a local app.

### Gaps

1. **No workflow-template files.** Plan section 12 explicitly required 4 templates. These are important for user adoption — a user should be able to pick "Daily Digest" from a dropdown, not build a workflow from scratch.

2. **No webhook router.** `WorkflowWebhook` table exists with `path`, `method`, `secret` fields. There's no HTTP endpoint to trigger workflows via webhook. This is a straightforward addition — a `POST /api/webhooks/:path` handler that looks up the webhook, verifies secret, and starts execution.

3. **`autonomous-execution.ts` untouched.** The bootstrap in `src/server/index.ts` still wraps autonomous engine construction in try/catch. If it fails, the autonomous API silently degrades. The plan (item 21.1) required removing this try/catch. The `agentic-loop.ts` gained the planning logic, but the main `AutonomousExecutionEngine` class was not modified.

4. **`autonomous-replay.ts` untouched.** Zero changes. Plan item 21.4 called for replay controller UI integration and visual diff. This is a lower-priority item but still in scope.

5. **No event-driven autonomous task creation.** `planAndExecuteAutonomous()` exists but nothing calls it automatically when events fire. A user must manually create tasks via API. Plan item 21.3 called for event-driven task creation.

6. **Variable validation is untyped.** `resolveVars()` performs string replacement on `Record<string, unknown>` with no Zod schema validation. A node expecting `{ price: number }` receives `{ price: "abc" }` silently. This is a latent bug vector.

7. **Schema contract for `WorkflowRetryQueueStore` is stores-only.** The store interface is well-typed, but no store implementation exists in `src/storage/impl/`. The engine code references `this.retryStore.enqueue()` etc. but without an actual Prisma-backed implementation, the retry queue stores in memory only and is lost on restart.

---

## INTEGRATION CONCERNS

| Concern | Severity | Detail |
|---|---|---|
| Store impl gap | 🔴 | `WorkflowRetryQueueStore`, `WorkflowVersionStore`, `HitlGateStore` are interfaces — no Prisma implementations exist. Retries/versions/gates won't survive restart. |
| Schema conflicts | 🟢 | New tables (`WorkflowVersion`, `WorkflowTrigger`, `WorkflowRetryQueue`) added to schema — clean, no conflicts |
| Server wiring | 🟡 | No evidence of `startRetryPoller()` or workflow trigger subscription being wired in `src/server/index.ts` |
| Test coverage | 🟢 | 29 unit tests pass. 2 integration test files exist but weren't run |

---

## VERDICT

**18 of 26 plan items delivered** (69%). The core automation engine work is solid — cron, event triggers, conditional branching, retry queue, parallel execution, variable propagation, credential injection, and human-in-loop all implemented with good architecture. The gaps are:

**Critical (blocks production use):**
1. 🔴 `WorkflowRetryQueueStore` / `WorkflowVersionStore` / `HitlGateStore` have no Prisma-backed implementations — retries and versions are in-memory only, lost on restart

**Medium (blocks completeness):**
2. 🟡 No webhook router — `WorkflowWebhook` table is orphaned
3. 🟡 No workflow template library — user must build workflows from scratch
4. 🟡 `autonomous-execution.ts` untouched — bootstrap still silently degrades
5. 🟡 No event-driven autonomous task creation

**Low (nice to have):**
6. ⚪ No workflow template files (4 planned)
7. ⚪ `autonomous-replay.ts` untouched
8. ⚪ Variable validation untyped

**Tests:** 29 pass, 0 fail across 3 files. Integration tests exist but weren't verified.

---

## RECOMMENDED NEXT STEPS

1. **Implement Prisma store impls** for `WorkflowRetryQueueStore`, `WorkflowVersionStore`, `HitlGateStore` — without these, retries/versions/gates are memory-only
2. **Wire retry poller** in `src/server/index.ts` — call `workflowEngine.startRetryPoller()` after construction
3. **Create webhook router** — `POST /api/webhooks/:path` using `WorkflowWebhook` table
4. **Create workflow template library** — at minimum `daily-digest.ts` and `cleanup-inactive.ts`
5. **Fix autonomous execution bootstrap** — remove try/catch wrapper, fail fast on construction error
6. **Add event-driven task creation** — subscribe to `CapabilityEventBus` for autonomous task triggers
