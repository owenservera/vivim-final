---
name: convergence-auditor
description: Frontend version convergence auditor. Given a delivered frontend version (dev-poc/canvas/vN), audits integration+convergence state, vision-vs-goals alignment, and generates the next-version blueprint upload pack (MASTER-PROMPT.txt + reference bundles) for a remote full-stack dev agent. Triggers on: "audit version", "convergence check", "next version blueprint", "frontend handoff", "run converge".
---

# Convergence Auditor — Remote Frontend Dev Agent Handoff

We develop the **frontend** on a separate machine. Versions (v2→v8) arrive as
complete standalone apps under `dev-poc/canvas/vN`, built by a full-stack agent
that **cannot read our source** — it only receives a `.txt` brief.

This skill closes the loop: audit → blueprint → remote builds → re-audit.

## When to use

- A new version was delivered as a complete frontend app under `dev-poc/canvas/vN`.
- You need to know if the version actually integrates with our backend.
- You need to decide what to tell the remote agent to build next.
- You want to detect context drift (stale master prompt, own backend, etc.).

## Pipeline

```
1. FIRST RUN:  bun run dev-poc/canvas/_audit/gen-baseline.ts
   (generates dev-poc/canvas/_baseline/baseline-{01..04}.txt — one-time setup)

2. PER VERSION: two options:

   A) One-shot (recommended):
      pwsh dev-poc/canvas/_audit/converge.ps1 -Version vN -Next vM
      pwsh dev-poc/canvas/_audit/converge.ps1 -Version vN -Next vM -Open
        (opens HTML explainer in browser)

   B) Step-by-step:
      bun run dev-poc/canvas/_audit/audit-version.ts --version vN
      bun run dev-poc/canvas/_audit/build-next-version.ts --version vN --next vM
      bun run dev-poc/canvas/_audit/verify-convergence.ts --version vN --next vM
        (Phase E: Before/After HTML explainer generated for user interview)

3. VERIFY with user:
   a) Open dev-poc/canvas/vM/convergence-before-after.html in browser
   b) Present the structured interview context from Phase E output
   c) Let user validate direction, adjust priorities, introduce core upgrades
   d) Iterate blueprint if user feedback changes scope

4. UPLOAD to remote agent:
   dev-poc/canvas/vM/MASTER-PROMPT.txt
   dev-poc/canvas/vM/COMBINED-PROMPTS.txt
```

## How the audit works

### Phase A — Integration audit (6 convergence contracts)
| Contract | Severity | What it checks |
|----------|----------|----------------|
| `backend-url` | BLOCKER | Uses `http://localhost:9420/api/...` (not relative) |
| `ws-endpoint` | BLOCKER | Connects `ws://localhost:9420/ws` |
| `zod-v3` | major | `package.json` pins `zod@^3.23` |
| `no-own-backend` | BLOCKER | No `src/server/`, `prisma/`, `src/engines/` |
| `frontend-backend-invariant` | major | Uses `capabilities/:id/execute` not hardcoded slug checks |
| `master-prompt-version` | major | Master prompt header version matches dir name |

### Phase B — Convergence-state audit
- Diffs against prior version's `_audit/ledger.json`
- Detects regressions (pass→fail, features dropped)
- Catches stale master prompt drift (e.g. "BUILD V6" in a v8 dir)

### Phase C — Vision-vs-goals audit
Scores each item as **advanced | partial | missing | regressed** against:
- **L1**: Agent-brief 5 canvas wishes + V8 master-prompt vision (G1-G6)
- **L2**: Product roadmap GOALS.md, M4-CANVAS-PLAN.md, INVARIANTS.md

### Phase D — Core enhancements
Produces prioritized fix list: blockers first, then missing vision items.

### Phase E — Verification (Before/After + User Interview)
Run after the blueprint is generated to validate the convergence trajectory
before sending to the remote agent:

1. **HTML Visual Explainer** — `verify-convergence.ts` builds a standalone
   `convergence-before-after.html` with a Before/After comparison table showing:
   - Integration contracts (Before=vN fail → After=vNEXT pass)
   - Vision items (Before=missing → After=advanced)
   - Summary metrics bar (contracts pass/fail, vision advanced/missing, fix count)
2. **Interview Context** — outputs structured findings (broken contracts, missing
   vision, fix targets, advance targets) as a validation checklist.
3. **User Validation** — present the explainer + findings to the user; let them:
   - Validate the Before→After trajectory matches the product vision
   - Reprioritize MUST-FIX items
   - Introduce core upgrades or features missing from the blueprint
   - Iterate the blueprint pack before sending to the remote agent
4. **Findings JSON** — written to `_audit/verify-findings.json` so consuming
   agents can parse the structured assessment programmatically.

## Blueprint output

```
dev-poc/canvas/vNEXT/
├── MASTER-PROMPT.txt          # Full instruction prompt for remote agent
├── BUNDLE-01-preserve-code.txt    # vN source patterns to KEEP (excludes backend code)
├── BUNDLE-02-schema-contracts.txt # Backend API contracts + data models
├── BUNDLE-03-baseline.txt         # Vision baselines (portable, self-contained)
├── BUNDLE-04-fix-targets.txt      # Audit findings as MUST-FIX list
└── COMBINED-PROMPTS.txt           # Verbatin concatenation of all bundles
```

## Vision baselines

Baselines are extracted from real repo docs into portable `.txt` files:

| Baseline | Source | Contains |
|----------|--------|----------|
| `baseline-01-agent-brief-wishes.txt` | `agent-brief/00-02` | 5 canvas wishes + known gaps |
| `baseline-02-v8-vision.txt` | `v8/V8_MASTER_PROMPT.txt` | V8 Central UI Engine vision + G1-G6 |
| `baseline-03-roadmap-goals.txt` | `docs/roadmap/{GOALS,M4-CANVAS-PLAN,INVARIANTS}` | Product goals + invariants |
| `baseline-04-convergence-contracts.txt` | N/A (handwritten) | The 6 convergence contracts |

Regenerate baselines when vision docs change: `bun run dev-poc/canvas/_audit/gen-baseline.ts`

## Known drift patterns (watch for these)

1. **Stale master prompt**: header version ≠ dir version (v7 said "BUILD V6")
2. **Own backend**: delivered version has `src/server/` + `prisma/` (v8 did this)
3. **Relative API calls**: `/api/...` instead of `http://localhost:9420/api/...`
4. **No WebSocket**: version has no `ws://` connection to backend
5. **No baseline kept**: if `_baseline/` is missing, run `gen-baseline.ts`
6. **Huge BUNDLE-01 preserve file**: >2MB means inefficient; consider listing key files only

## Files map

| File | Role |
|------|------|
| `.opencode/skill/convergence-auditor/SKILL.md` | This skill |
| `dev-poc/canvas/_audit/gen-baseline.ts` | One-time baseline extraction |
| `dev-poc/canvas/_audit/audit-version.ts` | Phase A-D auditor |
| `dev-poc/canvas/_audit/build-next-version.ts` | vNEXT blueprint generator |
| `dev-poc/canvas/_audit/verify-convergence.ts` | Phase E: Before/After HTML explainer + interview context |
| `dev-poc/canvas/_audit/lib/visual-explainer.ts` | HTML visual explainer generator |
| `dev-poc/canvas/_audit/converge.ps1` | One-shot converge wrapper (now includes Phase E) |
| `dev-poc/canvas/_audit/concatenate-prompts.ts` | Reusable bundle concatenator |
| `dev-poc/canvas/_audit/lib/contracts.ts` | 6 convergence contract checkers |
| `dev-poc/canvas/_audit/lib/grep.ts` | Bounded grep (no full-file load) |
| `dev-poc/canvas/_audit/lib/baseline.ts` | Vision baseline loader |
| `dev-poc/canvas/_audit/lib/report.ts` | Report + ledger writer |
| `dev-poc/canvas/_baseline/baseline-*.txt` | Self-contained vision reference |
