# Implementation Plan: Convergence Auditor for Remote Frontend Dev Agent

**Branch**: `028-convergence-auditor` | **Date**: 2026-07-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/028-convergence-auditor/spec.md`

## Summary

We develop the frontend on a separate machine. Each version (v2→v8) arrives as a complete standalone app under `dev-poc/canvas/vN`, built by a full-stack agent that **cannot read our source** — it only receives a concatenated `.txt` brief (the proven `MASTER-PROMPT.txt` + reference bundles pattern already used in V6/V7/V8 `upload/` folders).

Today nothing audits the delivered version before the next brief is written. A real drift already exists: `v7/upload/MASTER-PROMPT.txt` still says "BUILD V6", and v8 arrived as a Next.js app with its own `src/server/` + `prisma/`, violating the ZERO-BACKEND contract.

This feature delivers a **convergence-auditor** skill + scripts that, given a delivered version, (A) audits integration + convergence state, (B) audits the version vs our vision/goals, (C) identifies core enhancements, and (D) generates the next-version blueprint as a concatenated `.txt` upload pack + full instruction prompt — closing the loop: audit → blueprint → remote builds vNEXT → re-audit.

## Technical Context

**Language/Version**: TypeScript 5.x (strict, ESNext) / Bun runtime for `.ts` scripts; PowerShell 7+ for wrappers.
**Primary Dependencies**: Bun, Node `fs`/`path` (no external libs — keep scripts dependency-free for portability), Zod (optional, for report schema validation).
**Storage**: Filesystem only — reports/ledgers/packs written under `dev-poc/canvas/`. No DB.
**Testing**: Bun test runner (`bun test`) for the auditor/blueprint unit checks.
**Target Platform**: Windows (PowerShell 7+), Bun.
**Project Type**: Devops tooling (skill + scripts) — NOT a product engine; stays out of `src/engines`.
**Linter/Formatter**: Biome (project default).

**Constraints**:
- Governor Canon / Store Contracts / One Entry Point do not directly apply (this is tooling outside `src/`), but the **FRONTEND=BACKEND invariant** and **ZERO-BACKEND contract** ARE the audit subject.
- Shell rules (AGENTS.md): PS1 scripts use `$PSScriptRoot`, invoked only via `pwsh scripts/<name>.ps1` from repo root.
- The blueprint pack MUST be fully self-contained (remote agent can't read our repo).

## Constitution Check

- [x] Scope is devops tooling, not an engine — Governor Canon N/A.
- [x] No engine touches CDP — N/A.
- [x] No `src/` modification — system lives under `dev-poc/canvas/_audit/`, `.opencode/skill/`, and spec dir.
- [x] PowerShell 7+ compatible; `$PSScriptRoot`-safe invocation.
- [x] Self-contained blueprint output (no unresolved repo paths).

## Project Structure

### Documentation (this feature)

```text
specs/028-convergence-auditor/
├── spec.md              # Feature spec (above)
├── plan.md              # This file
├── data-model.md        # Entity shapes (ConvergenceContract, VisionBaseline, Ledger, BlueprintPack)
├── tasks.md             # Phase breakdown
└── research.md         # Findings from inspecting v6/v7/v8 + baseline docs
```

### Source Code (deliverables)

```text
.opencode/skill/convergence-auditor/
└── SKILL.md             # Skill: triggers, 4-phase workflow, baselines, invocation

dev-poc/canvas/_baseline/              # Generated, self-contained vision baseline (.txt)
├── baseline-01-agent-brief-wishes.txt
├── baseline-02-v8-vision.txt
├── baseline-03-roadmap-goals.txt
└── baseline-04-convergence-contracts.txt

dev-poc/canvas/_audit/
├── audit-version.ts     # Phase A-D: integration, convergence, vision, enhancements
├── build-next-version.ts# Emits vNEXT MASTER-PROMPT + BUNDLE-* + COMBINED
├── converge.ps1         # One-shot: audit -> blueprint (PS1-safe)
├── lib/
│   ├── contracts.ts     # ConvergenceContract definitions + checker
│   ├── baseline.ts      # Load _baseline/*.txt
│   ├── grep.ts          # Bounded grep over delivered version (no full-file load)
│   └── report.ts        # CONVERGENCE-REPORT.md + ledger.json writer
└── concatenate-prompts.ts # Reusable concatenator (upgrades V6 script)

dev-poc/canvas/V6/concatenate-prompts.ps1  # Upgraded to reusable (kept for compat)
```

## Implementation Approach

1. **Baseline extraction** (`dev-poc/canvas/_baseline/`): a bun script reads `agent-brief/00-02`, `v8/V8_MASTER_PROMPT.txt`, and `docs/roadmap/{GOALS,M4-CANVAS-PLAN,INVARIANTS}.md`, and writes 4 bounded `.txt` files. This makes the vision reference portable + self-contained.
2. **Contract checker** (`lib/contracts.ts`): encodes the convergence contracts (absolute backend URL present, WS endpoint, Zod `^3.23` in package.json, absence of `src/server/`, `prisma/`, own engines). Returns pass/fail + evidence paths.
3. **Bounded grep** (`lib/grep.ts`): ripgrep-style scan over the delivered version without loading huge files (v8 `BUNDLE-04-engines.txt` is 1.2 MB) — stream + match, cap output.
4. **Audit engine** (`audit-version.ts`): runs Phase A (contracts), B (ledger diff vs prior), C (baseline vision scoring), D (enhancements). Writes `CONVERGENCE-REPORT.md` (human) + `ledger.json` (machine, for next-version diff).
5. **Blueprint generator** (`build-next-version.ts`): reads audit report + baselines + selected reference code/schema from delivered version, writes `vNEXT/MASTER-PROMPT.txt` (full prompt), `BUNDLE-*.txt` (preserve-code, schema, data-model, known-gaps), `COMBINED-PROMPTS.txt`.
6. **Wrapper** (`converge.ps1`): runs audit then blueprint; `$PSScriptRoot`-safe.
7. **Skill** (`SKILL.md`): documents triggers + workflow so any agent can invoke.

## Risks

- **Missing `03-wishlist-top5.md`**: fallback to `00-MASTER-INDEX.md` 5-wish summary + `02` known-gaps; auditor notes the gap.
- **Huge delivered files**: grep is bounded; report size capped.
- **Stale master prompt**: Phase B compares `MASTER-PROMPT.txt` header version string vs dir name — catches v7 "BUILD V6" drift.
- **Self-containment**: blueprint bundles must inline everything the remote agent needs; no `../../src` references.
