# DevOps Loop Enhancements & Automated Development Tricks

**Compiled:** 2026-07-19
**Sources:** `docs/plans/*` (19 plan files), `devops/` source code, `AGENTS.md`, `opencode.json`
**Status:** Inventory of what's implemented vs. pending, plus actionable tricks

---

## 1. What's Already Implemented (Verified)

| Enhancement | Location | Status |
|-------------|----------|--------|
| Scoped `devops fmt` command | `devops/index.ts` | ✅ Implemented |
| `.gitattributes` (CRLF normalization) | `.gitattributes` | ✅ Implemented |
| `devops gc` (git housekeeping) | `devops/index.ts` | ✅ Implemented |
| `devops context` (context detection) | `devops/index.ts` | ✅ Implemented |
| `devops gate --strict` (warning debt) | `devops/gate.ts` | ✅ Implemented |
| Coverage threshold in gate | `devops/gate.ts` | ✅ Implemented |
| Health endpoints (`/healthz`, `/readyz`, `/livez`) | `src/server/index.ts` | ✅ Implemented |
| MCP servers configured | `opencode.json` | ✅ 1+ configured |

---

## 2. What's Pending (From Plans)

| Enhancement | Source Plan | Effort | Priority |
|-------------|-------------|--------|----------|
| `devops mark <id> done "<msg>"` single-pass | devops-toolkit-upgrades.md | Low | P2 |
| `devops parallelize` (subagent fan-out) | devops-upgrade-impl.md | High | P1 |
| OTel instrumentation (`otel-sink.ts`) | devops-upgrade-impl.md | High | P2 |
| pino structured logging (`src/lib/logger.ts`) | devops-upgrade-impl.md | Med | P2 |
| Context-checkpoint plugin (pre-compaction) | opencode-pre-compaction-hook.md | Med | P1 |
| Agent regression suite (`tests/agent/`) | devops-upgrade-impl.md | Med | P3 |
| Idempotency keys + rate limiting | devops-upgrade-impl.md | Med | P3 |
| Supply chain security (Socket.dev) | devops-upgrade-impl.md | Low | P3 |

---

## 3. Top 10 Automated Development Tricks

These are patterns extracted from the plans and existing code that **work today**:

### Trick 1: Scoped Format (never break the loop)
```powershell
# Instead of repo-wide `bun run format` (aborts on first error in ANY file)
bun run devops fmt          # Only formats changed files vs base branch
```
**Why:** `bun run format` = `biome check --write` aborts on the FIRST error in ANY file, including pre-existing errors in untouched files. The scoped version only touches `git diff --name-only main...HEAD` + untracked `*.ts`.

### Trick 2: Strict Gate (catch warning debt)
```powershell
bun run devops gate --strict    # Fails on new warnings in touched files
```
**Why:** `biome check` warnings don't fail the default gate. Strict mode scopes to changed files — new warnings in touched files fail, legacy warnings in untouched files stay non-blocking.

### Trick 3: Context-Aware Loop Start
```powershell
bun run devops context          # Detect active plan/session before looping
bun run devops select           # Then pick next unit
```
**Why:** The `devops context` command scans `.kilo/plans/`, `docs/session/`, and `PROGRESS.md` to detect if you're mid-implementation. Avoids being yanked into atomic units when you have active work.

### Trick 4: Single-Pass Audit Commit
```powershell
# Current: mark done → commit → second commit renames [PENDING-COMMIT] → <sha>
# Target: mark done with message does both in one step
bun run devops mark <id> done "<msg>"   # (PENDING - not yet implemented)
```
**Why:** Eliminates the two-commit anti-pattern where `PROGRESS.md` gets a `[PENDING-COMMIT]` placeholder then a second commit renames it to `<sha>`.

### Trick 5: Git Hygiene Automation
```powershell
bun run devops gc                # git gc --prune=now (guarded to daily)
```
**Why:** Prevents "too many unreachable loose objects" noise. `.gitattributes` with `* text=auto eol=lf` stops CRLF churn on Windows.

### Trick 6: Verification Order (codified)
```
typecheck → targeted lint on changed files → unit tests → full gate
```
**Why:** This order from the toolkit-upgrades plan is the standard. Never run repo-wide `bun run format` during the loop — use `devops fmt`.

### Trick 7: Prisma `any` Escape-Hatch (sanctioned)
```ts
// biome-ignore lint/suspicious/noExplicitAny: intentional Prisma escape hatch
private get p(): any { return this.db.prisma }
```
**Why:** Generated Prisma client types are verbose and add no safety at the call site. Contain the `any` at the `p` getter — never propagate into engine code.

### Trick 8: DRIFT Reconciliation Template
When atomic spec conflicts with design:
```
timestamp | unit_id | name | finding | resolution | sha
```
Log to `PROGRESS.md` + patch the atomic file. This is the ad-hoc pattern from units 4.4–4.6, now should be templated.

### Trick 9: Event-Naming Discipline
New transitions get specific event types:
```
binding:status_changed   # NOT capability:status_changed
```
Don't overload existing events — create a new scope for new concepts.

### Trick 10: Pre-Compaction Hook (automated context preservation)
```json
// opencode.json (PENDING - not yet implemented)
{
  "experimental": {
    "context_checkpoint_threshold": 0.8,
    "context_checkpoint_prompt": "Summarize current work and next steps"
  }
}
```
**Why:** Triggers a summarize prompt at 80% of context limit, preserving work-in-progress before auto-compaction. Alternative: use `/session-objectives` skill manually.

---

## 4. The DevOps Loop (Current Architecture)

```
bun run devops select        # Pick next implementable unit (dependency-ordered)
bun run devops context       # Detect active plan/session
bun run devops mark <id> in_progress
  → implement (engine + tests + seeds)
bun run devops gate          # typecheck + biome + bun test
bun run devops fmt           # Scoped format (changed files only)
bun run devops mark <id> done
bun run devops report        # Progress summary
```

### Loop Variants
| Command | Purpose |
|---------|---------|
| `bun run devops run` | Autonomous closure loop (no human) |
| `bun run devops agent-loop` | Full loop with kilo worker |
| `bun run devops runtime-test` | Provider testing loop (30+ subcommands) |
| `bun run devops agentic` | Limited-context agentic loop |

---

## 5. Recommended Next Enhancements (Priority Order)

| # | Enhancement | Why | Effort |
|---|-------------|-----|--------|
| 1 | `devops mark <id> done "<msg>"` | Eliminates 2-commit anti-pattern | 30 min |
| 2 | Context-checkpoint plugin | Prevents context loss on compaction | 2 hr |
| 3 | `devops parallelize` | Subagent fan-out for independent units | 4 hr |
| 4 | pino logging | Structured logs for debugging | 2 hr |
| 5 | OTel sink | Trace LLM calls / engine perf | 4 hr |
| 6 | Agent regression suite | Prevent prompt regressions | 3 hr |

---

## 6. Where to Find More

| Topic | File |
|-------|------|
| Full toolkit upgrades | `docs/plans/1783633791586-devops-toolkit-upgrades.md` |
| Context-aware improvements | `docs/plans/1783721877000-context-aware-devops-improvement.md` |
| Pre-compaction hook | `docs/plans/1783827600085-opencode-pre-compaction-hook.md` |
| 7-week upgrade roadmap | `docs/plans/1783721778699-devops-upgrade-implementation-plan.md` |
| Runtime skill upgrade | `docs/plans/1783972084594-vivim-runtime-skill-upgrade.md` |
| Agentic backbone | `docs/plans/1784415743937-agentic-backbone-data-model.md` |
| DevOps hygiene | `docs/plans/1783617940191-land-unit-3-13-and-devops-hygiene.md` |
