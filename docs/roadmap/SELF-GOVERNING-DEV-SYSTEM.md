# Self-Governing Development System: Design & Implementation

**Status:** Architecture proposal
**Date:** 2026-07-17
**Author:** Agent (Build)
**References:** `AGENTS.md`, `INVARIANTS.md`, `DEVOPS-SYSTEM-REFERENCE.md`, devops/index.ts

---

## 1. The Problem

The production master plan audit (PRODUCTION-MASTER-PLAN-AUDIT.md) revealed that even with full codebase knowledge, an agent can:

1. **Over-claim capability existence** — 8 capabilities claimed "exists" were only string names in JSON, not registered handlers
2. **Under-report feature completion** — Canvas had 14 React components, plan rated it as 20% done
3. **Miss phantom engines** — 4 engines in CHANGELOG don't exist as files
4. **Claim stale metadata** — "28+ capabilities" when actual count is 50

These are systemic errors. They will happen again on every new plan without automated verification.

## 2. The Solution: Self-Governing Pipeline

A 3-phase pipeline that moves from user moments → verified capabilities → plan → tests → release, with automated gates at each step.

```
USER MOMENTS (100 moments in docs/roadmap/moments.json)
    │
    ▼
┌──────────────────────────────────────────────┐
│  GATE M1: `devops moments verify`            │
│  Every moment → capability or gap            │
│  Moments without caps → auto-generate cap    │
│  Moments with caps → test-cap execution      │
│  Report: moments.json enriched with status   │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│  GATE M2: `devops audit-plan`                │
│  Plan vs. live codebase                      │
│  Every claim in plan → grep source           │
│  "Exists" claims → verify registration       │
│  "Not implemented" claims → verify absence    │
│  File paths → verify exist                   │
│  Report: findings.json (P0-P3)               │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│  GATE M3: `devops plan generate`             │
│  From verified moments.json + audit-plan     │
│  Autogenerate phases, units, dependencies    │
│  Estimate effort (S/M/L/XL) from code stats  │
│  Validate: no self-referencing deps          │
│  Output: corrected tracker entries           │
└──────────────┬───────────────────────────────┘
               │
               ▼
          devops loop (implementation)
```

### GATE M1: `devops moments verify`
```
bun run devops moments verify [--all] [--moment=<id>]
```
- Reads `docs/roadmap/moments.json` (source of truth for all 100 user moments)
- For each moment:
  1. If status is `done` → runs `test-cap` to confirm capability actually executes
  2. If status is `partial` → checks if claimed files exist and capability is registered
  3. If status is `pending` → confirms capability is NOT registered (if it IS, status auto-promotes)
  4. Writes back enriched `moments.json` with `verifiedAt`, `capabilityId`, `testResult`
- Returns: `{ total, done_verified, done_failed, partial_promoted, pending_confirmed, errors[] }`

### GATE M2: `devops audit-plan`
```
bun run devops audit-plan <plan-file> [--fix]
```
- Reads a master plan markdown file (like PRODUCTION-MASTER-PLAN.md)
- Parses all claims:
  - `✅ Done` → verifies file exists, capability registered, test passes
  - `⚠️ Partial` → verifies at least one of the claimed files/caps exists
  - `❌ Not implemented` → verifies claimed files do NOT exist
- Cross-references against:
  - `capability-bootstrap.ts` → grep all registered capability IDs
  - NLCL catalog.ts → grep all registered command patterns
  - Canvas registry → grep all canvas definitions
  - Prisma schema → grep all table names
  - File system → verify file paths
- Output: `docs/audits/PLAN-AUDIT-<plan>-<date>.md` with finding list

### GATE M3: `devops plan generate`
```
bun run devops plan generate --from=moments.json [--out=tracker-entries.md]
```
- Reads verified `moments.json`
- Groups pending moments into phases by domain
- Estimates effort from file complexity (lines of code in touched files)
- Validates dependencies: no circular deps, no self-refs
- Generates atomic unit entries in tracker format

---

## 3. New Files

### `docs/roadmap/moments.json` — Source of Truth (NEW)

```json
{
  "version": 1,
  "generatedAt": 1752758400000,
  "total": 100,
  "moments": [
    {
      "id": "A1",
      "domain": "platform",
      "name": "User launches vivim for first time, runs db:setup",
      "description": "Fresh install: migrate + seed completes, server boots with all providers",
      "status": "done",
      "capabilityId": "cap:admin:db_setup",
      "capabilitySlug": "admin_db_setup",
      "verifiedAt": 1752758400000,
      "testResult": "pass",
      "priority": "P0",
      "files": ["prisma/seed.ts", "src/server/index.ts", "package.json"]
    },
    {
      "id": "C1",
      "domain": "chat_advanced",
      "name": "User selects a different model in ChatGPT",
      "description": "Dropdown in chat header switches model via CDP click on model selector",
      "status": "pending",
      "capabilityId": null,
      "capabilitySlug": "provider_select_model",
      "verifiedAt": null,
      "testResult": null,
      "priority": "P1",
      "files": ["src/engines/capability-bootstrap.ts", "web/sandbox/src/features/conversation-surface.tsx"]
    }
  ]
}
```

### `devops/moments/` — New Subsystem (NEW)

```
devops/moments/
  index.ts           — CLI dispatcher: verify, status, generate, audit
  verify.ts          — M1: verify each moment against live code
  enrich.ts          — Cross-reference moments with capability registry
  trace.ts           — Map moments → capabilities → tests (traceability matrix)
  types.ts           — Moment, MomentStatus, MomentDomain types
```

### `devops/audit-plan.ts` — Plan Auditor (NEW)

```
devops/audit-plan.ts  — M2: parse plan markdown, audit every claim
```

### `devops/plan-generator.ts` — Plan Generator (NEW)

```
devops/plan-generator.ts  — M3: auto-generate phases from verified moments
```

### `.opencode/skill/devops-moments/SKILL.md` — Agent Skill (NEW)

Governs how agents generate plans. Prevents the 8 errors found in the audit.

---

## 4. Agent Skill: devops-moments

**When to load:** Before writing any master plan, PRD, or production roadmap. Before claiming a feature "exists" or "doesn't exist."

### Agent Guards (Never Violate)

1. **Claim Verification Guard:** Before writing `✅ Done` or `⚠️ Partial` in any plan:
   - For "capability exists" → grep `capability-bootstrap.ts` for the capability ID
   - For "engine exists" → check `src/engines/<name>.ts` exists
   - For "UI component exists" → check `web/*.tsx` for the component file
   - For "table exists" → check `prisma/schema.prisma` for the model name

2. **Count Verification Guard:** Before writing "N capabilities":
   - Run `grep` on capability-bootstrap.ts for registered capability IDs
   - Count them. Use the COUNT as the number. Never estimate.

3. **File Coverage Guard:** Before rating a subsystem:
   - `glob` the directory for all `.ts`, `.tsx` files
   - Read at minimum the index/barrel + the main entry file
   - Count lines. Cross-reference with your plan's "done" list.

4. **CHANGELOG Distrust Guard:** Never trust the CHANGELOG for "implemented". Always verify:
   - CHANGELOG says engine X in Phase 31 → check `src/engines/` for the file
   - Missing file → mark as `vaporware` in the audit, not `partial`

5. **Capability Registry Single Source:** The capability-bootstrap.ts `makeCapability()` calls are the ONLY source of truth for "capability exists". JSON manifest strings like `"capabilities": ["select_model"]` are capability NAMES, not implementations. They need a `makeCapability()` call to be real.

### Workflow: Generate a Plan

```
1. Run `bun run devops moments verify --all`
   → Enriched moments.json with live codebase state
   
2. Run `bun run devops audit-plan docs/roadmap/PRODUCTION-MASTER-PLAN.md`
   → Finding list (P0-P3)
   
3. Fix all P0 findings before publishing plan
   
4. Run `bun run devops plan generate --from=moments.json`
   → Auto-generated tracker entries
   
5. Run `bun run devops invariants check --category B`
   → Architectural compliance
   
6. Publish plan + audit report
```

### Workflow: Real-World Test a Moment

```
1. `bun run devops runtime-test test-cap --slug=<capabilitySlug> --input='{...}'`
   → Returns { ok, output, latencyMs, error }
   
2. If ok: mark moment as `done_verified` in moments.json
3. If fail: mark moment as `pending` with error detail
4. For UI moments: `bun run devops runtime-test verify --url=<frontend>`
   → Writes render proof to .runtime/screenshots/
```

---

## 5. New Invariants (Category E — Plan Accuracy)

Added to `devops/invariants.ts`:

| ID | Check | Severity |
|----|-------|----------|
| **E1** | Plan "done" claims verified against capability registry | block |
| **E2** | Plan "exists" claims grep-verified against source files | block |
| **E3** | Plan capability count matches actual registration count (±0 tolerance) | block |
| **E4** | Plan file paths resolve to existing files | block |
| **E5** | No plan claim references CHANGELOG-only engines without file check | block |
| **E6** | Every plan unit has a `Depends:` and `Produces:` field | warning |
| **E7** | Every user moment has a `capabilityId` or `gap` annotation | warning |
| **E8** | Plan phases don't self-reference in dependencies | block |

---

## 6. Devops Command Additions

### `devops moments <subcommand>` (NEW)
```
devops moments verify [--all] [--moment=<id>] [--live]
  → Verify every moment against live capability registry + source files
  
devops moments status [--domain=<name>]
  → Print moments summary: done/partial/pending per domain
  
devops moments trace <moment-id>
  → Print full traceability chain: moment → capability → test → file
  
devops moments generate --domain=<name> --count=<N>
  → Generate N new moments for a domain (AI-assisted, human-reviewed)
```

### `devops audit-plan <file>` (NEW)
```
devops audit-plan <plan-file> [--fix] [--severity=P0|P1|P2|P3]
  → Parse plan markdown, audit every claim against live code
  
devops audit-plan PRODUCTION-MASTER-PLAN.md --severity=P0
  → Only show critical findings
```

### `devops plan generate` (NEW)
```
devops plan generate --from=<moments.json> [--out=<tracker-entries.md>]
  → Auto-generate phase plan from verified moments
```

---

## 7. Integration with Existing Devops

### Gate Enhancement
`devops gate --full` now includes:
- Category E invariants (plan accuracy)
- `devops moments verify` for all moments marked `done`
- `devops audit-plan` on the current master plan (if exists)

### Lefthook Enhancement
Pre-commit hook additions:
```yaml
pre-commit:
  commands:
    moments:
      glob: "docs/roadmap/moments.json"
      run: bun run devops moments verify --changed
```

### Oracle Query Enhancement
New oracle queries:
```
bun run cli oracle query plan-health
  → Completion %, moments verified, plan audit P0 count
  
bun run cli oracle query trace <moment-id>
  → Full traceability chain
```

---

## 8. Implementation Phases

### Phase 200: Self-Governing Foundation (5 units)

| # | Unit | File | Depends |
|---|------|------|---------|
| 200.1 | `moments.json` — initial 100 moments as structured JSON | `docs/roadmap/moments.json` (NEW) | — |
| 200.2 | `devops/moments/verify.ts` — M1 gate: verify each moment | `devops/moments/verify.ts` (NEW) | 200.1 |
| 200.3 | `devops/audit-plan.ts` — M2 gate: parse + audit plan markdown | `devops/audit-plan.ts` (NEW) | — |
| 200.4 | `devops/plan-generator.ts` — M3 gate: generate phases from moments | `devops/plan-generator.ts` (NEW) | 200.2 |
| 200.5 | Wire `devops moments`, `devops audit-plan`, `devops plan` to CLI dispatcher | `devops/index.ts` (EDIT) | 200.2, 200.3, 200.4 |

### Phase 201: Invariants + Skills (3 units)

| # | Unit | File | Depends |
|---|------|------|---------|
| 201.1 | Category E invariants (E1-E8) in `invariants.ts` | `devops/invariants.ts` (EDIT) | 200.2, 200.3 |
| 201.2 | `devops-moments` skill (5 agent guards) | `.opencode/skill/devops-moments/SKILL.md` (NEW) | — |
| 201.3 | Gate integration — `devops gate --full` runs M1+M2 | `devops/gate.ts` (EDIT) | 201.1 |

### Phase 202: Live Testing (2 units)

| # | Unit | File | Depends |
|---|------|------|---------|
| 202.1 | `devops moments verify --live` — runs `test-cap` for each done moment | `devops/moments/verify.ts` (EDIT) | 200.2 |
| 202.2 | Moments traceability matrix — `devops moments trace` | `devops/moments/trace.ts` (NEW) | 200.1 |

---

## 9. Verification: Will This Prevent the Audit Findings?

| Audit Finding | Prevented By | Mechanism |
|--------------|-------------|-----------|
| F1: 8 caps over-claimed | **E2 + Agent Guard 1** | `audit-plan` verifies `makeCapability()` calls for every "exists" claim |
| F2: Canvas under-reported | **Agent Guard 3** | Glob file listing + line count before rating subsystem |
| F3: Phantom engines | **E5 + Agent Guard 4** | CHANGELOG distrust — always verify file exists |
| F4: Wrong cap count | **E3 + Agent Guard 2** | grep count of capability IDs, never estimate |
| F5: File conflicts | **E4** | Verify file paths exist before assigning agents |
| F6: Wrong deps order | **E8** | Validate no self-referencing deps in plan generator |

---

## 10. Compliance Summary

| Component | Status | Action |
|-----------|--------|--------|
| Skills: devops-fullstack, devops-roadmap | Existing | Extend with moments guard rules |
| Skills: devops-moments | **NEW** | Phase 201.2 |
| Devops: moments subsystem | **NEW** | Phase 200 |
| Devops: audit-plan | **NEW** | Phase 200.3 |
| Devops: plan-generator | **NEW** | Phase 200.4 |
| Devops: invariants (Category E) | **EDIT** | Phase 201.1 |
| Devops: gate integration | **EDIT** | Phase 201.3 |
| Devops: CLI dispatcher | **EDIT** | Phase 200.5 |
| Lefthook | **EDIT** | Phase 201.3 |
| Source of truth: moments.json | **NEW** | Phase 200.1 |
