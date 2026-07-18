# source-audit

Source-code audit subsystem for vivim-final. It is the creative-orchestration
skill that drives the deterministic mechanics in `devops/audit-code/` via
`bun run devops audit-code <scope> [flags]`. It does **not** replace
`devops audit` (that is the unit-completion trail → `PROGRESS.md`).

## When to Load

**Load this skill when:**
1. User says "audit the codebase", "run a source code audit", "code audit"
2. User asks "what's wrong with the code", "find bugs/vulnerabilities/dead code"
3. Before a release: "audit before release", "is this safe to ship"
4. User wants a security / quality / architecture / performance review
5. After a large change set and wants a health check

**Do NOT load when:**
- Resuming the devops implementation loop (use `devops` skill)
- Only a single unit needs work (implement directly)
- Topic is purely conversational

## Core Concepts

### 1. Priority Scheme (P0–P3)

| Priority | Meaning | Examples |
|---|---|---|
| **P0** | Critical — fix before release | secret leakage, `eval()`, real shell exec, Governor Canon (B1), Store-Contract (B2) violation, crash/data-loss |
| **P1** | High — correctness/architecture | `new Function` (verify trusted), swallowed errors, raw `Error` in engine (B7), missing engine test (D1), dead code on hot path |
| **P2** | Medium — quality/performance | `any` in engine (D2), N+1 loops, unused export/dependency, incomplete impl (drift), barrel gap (D4) |
| **P3** | Low — hygiene | leftover `console.*`, TODO/stub debt, naming/style |

Each finding links to an `invariant` id (e.g. `B1`) where it maps to an existing
boundary rule, and may link to a tracker `unit` / `ADR`.

### 2. Depth Tiers (cumulative)

| Tier | Runs | Cost |
|---|---|---|
| **surface** | security (secrets/eval/shell) + quality (console/`any`) + correctness (swallowed/dead) | ~12s |
| **standard** | surface + architecture (B invariants) + testing (D1) + performance + dependencies | ~25s |
| **deep** | standard + drift (truth scanner STUB/MIXED, barrel D4) | +slow |
| **full** | deep + baseline trend comparison (new/resolved vs last `--baseline`) | +analysis |

Default tier: **standard**.

### 3. Dimensions (audit categories)

`security` · `correctness` · `architecture` · `quality` · `performance` ·
`testing` · `dependencies` · `drift`.

- `architecture` reuses `devops/invariants.ts` (`checkInvariants`, category B) as
  the authoritative boundary checker — no duplication.
- `drift` reuses `devops/truth/scanner.ts` (`scanRoot`) for REAL/STUB/MIXED
  classification.
- `testing` reuses the engine/test walk to detect engines without unit tests.
- Gate/typecheck/lint are NOT re-run here (they live in `devops gate`); audit
  focuses on semantic findings the gate does not catch.

## Output Design

### Report — `docs/audits/CODE-AUDIT-<scope>-<date>.md`
Executive summary (risk H/M/L + P0–P3 counts) → priority legend → findings
grouped by priority → dimension → per-finding block (location, evidence,
impact, **Fix Instructions** with steps + effort + auto-fixable flag +
optional patch suggestion) → **Fix Backlog** table.

### Machine — `docs/audits/findings.json`
```json
{
  "run": { "scope": "standard", "commit": "d615ea0", "date": "2026-07-13", "filesScanned": 479, "root": "..." },
  "summary": { "P0": 0, "P1": 142, "P2": 35, "P3": 16, "risk": "M", "total": 193 },
  "findings": [ { "id": "AU-0001", "priority": "P1", "dimension": "security",
    "invariant": "B7", "title": "...", "description": "...", "file": "...", "line": 42,
    "evidence": "...", "impact": "...",
    "fix": { "summary": "...", "steps": ["..."], "patchSuggestion": "...", "effort": "M", "autoFixable": false },
    "status": "open", "linkedUnit": "11.2" } ]
}
```

### Debug / Fix-Instructed Outputs
Every finding carries a **Fix Instructions** block: plain-language summary,
ordered remediation steps, optional concrete `patchSuggestion`, effort estimate
(S/M/L), and an `autoFixable` flag. `audit-code fix <id>` prints it;
`audit-code fix <id> --apply` rewrites the file **only if** `autoFixable` is true
(safe, mechanical edits: delete a debug log line, add a barrel export). Manual
fixes are never auto-applied.

## Commands

```
bun run devops audit-code [scope] [flags]
  scope: surface | standard | deep | full      (default: standard)
  --dimension <name>     filter to one dimension
  --priority  <P0|P1|P2|P3>  minimum priority to include
  --report               (default) write + print report
  --json                 also emit findings.json (always persisted for --fix)
  --fix <id> [--apply]   show / opt-in apply a finding's fix
  --export               write findings.json only (no report)
  --baseline             save findings.json as a trend baseline
  --compare              (full) diff vs last baseline
  --to-units             promote P0/P1 → atomic-unit candidates (merge-gate)
```

## Workflow

```
1. Decide tier. Default `standard`. Use `surface` for a fast pre-commit check,
   `full` for a release gate.
2. Run: `bun run devops audit-code <scope>`
   - Reads the report printed to stdout + written to docs/audits/.
   - findings.json is always written (needed by --fix).
3. Triage by priority. Start with P0 (must fix before release), then P1.
4. For each finding: `bun run devops audit-code fix <id>` to see instructions.
   - If `autoFixable: yes` and the fix is safe, `bun run devops audit-code fix <id> --apply`.
   - Otherwise apply the steps manually, then verify with `bun run devops gate`.
5. (Release gate) Promote the rest: `bun run devops audit-code --to-units`
   writes docs/audits/AUDIT-UNITS-<date>.md. Route through the roadmap
   interview + merge-gate to add them to the tracker (user wins conflicts).
6. (Trend) `bun run devops audit-code full --baseline` after fixing, then
   `full --compare` next cycle to see new/resolved.
```

## Wiring into DevOps

- **CLI verb:** `audit-code` in `devops/index.ts` → `devops/audit-code/index.ts`.
- **Deterministic mechanics:** `devops/audit-code/` (Bun + stdlib only, like the
  rest of `devops/`). Reuses `invariants.ts`, `truth/scanner.ts`, `gate.ts`,
  `tracker.ts` patterns.
- **State:** `docs/audits/CODE-AUDIT-<scope>-<date>.md`, `findings.json`,
  `baseline-<date>.json`, `AUDIT-UNITS-<date>.md`.
- **Tracker coupling:** findings do NOT auto-mutate the tracker. `--to-units`
  produces *candidates*; the existing roadmap merge-gate (human approval) adds
  them — same governance as discovered units.
- **Gate integration (optional):** `bun run devops gate` already enforces B1/B2
  as hard blocks; the audit's P0 mirrors those. The audit adds the semantic
  layer (security, dead code, N+1, missing tests) the gate does not cover.

## Key Invariants

- **Reuse, don't duplicate.** Boundary checks come from `invariants.ts`;
  stub classification from `truth/scanner.ts`.
- **Never auto-apply unsafe fixes.** `autoFixable` is gated to mechanical edits.
- **Report-and-stop, not auto-edit.** The audit informs; humans (or the
  merge-gate) decide what enters the tracker.
- **User wins conflicts.** `--to-units` candidates are advisory until approved.
- **Local + deterministic.** No web search; the audit scans the working tree.