# Data Model: Convergence Auditor

Entities persisted as JSON / markdown under `dev-poc/canvas/`. No database.

## ConvergenceContract

A non-negotiable integration rule the delivered frontend MUST honor.

```ts
interface ConvergenceContract {
  id: string;            // e.g. "backend-url", "ws-endpoint", "zod-v3", "no-own-backend"
  description: string;   // human-readable rule
  severity: "blocker" | "major" | "minor";
  // checker returns:
  status: "pass" | "fail" | "warn" | "na";
  evidence: string[];    // file paths / matched lines proving status
  note?: string;
}
```

Canonical contracts (baseline-04):
- `backend-url` — fetch/XHR use absolute `http://localhost:9420/api/...` (blocker)
- `ws-endpoint` — WebSocket connects `ws://localhost:9420/ws` (blocker)
- `zod-v3` — `package.json` pins `zod@^3.23` not `^4` (major)
- `no-own-backend` — no `src/server/`, no `prisma/`, no `src/engines/`, no own DB (blocker)
- `frontend-backend-invariant` — UI drives backend via `POST /api/capabilities/:id/execute` + `POST /api/interpret`, no hardcoded `if (slug===...)` second transport (major)
- `master-prompt-version` — `MASTER-PROMPT.txt` header version string === dir version (major, drift guard)

## VisionBaseline

Self-contained vision reference (L1 + L2) extracted into `dev-poc/canvas/_baseline/`.

```ts
interface VisionItem {
  id: string;            // e.g. "wish-1-sse", "goal-G001"
  layer: "L1-wishes" | "L1-v8-vision" | "L2-roadmap";
  statement: string;     // the goal/wish text
  source: string;        // baseline file + anchor
}

interface VisionBaseline {
  items: VisionItem[];   // 5 wishes + v8 priorities + roadmap goals
}
```

## ConvergenceLedger (per version)

Machine-readable scores for regression diffing (Phase B).

```ts
interface LedgerEntry {
  version: string;            // "v8"
  auditedAt: string;          // ISO
  contracts: Record<string, "pass"|"fail"|"warn"|"na">;
  vision: Record<string, "advanced"|"partial"|"missing"|"regressed">; // by VisionItem.id
  enhancements: string[];     // Phase D prioritized gaps
}

interface ConvergenceLedger {
  entries: LedgerEntry[];
}
```

Diff rule (Phase B): for each contract/vision key present in both prior + current,
if prior=`pass` and current=`fail` → REGRESSION; if prior missing → NEW.

## BlueprintPack (next version output)

```ts
interface BlueprintPack {
  version: string;            // "v9"
  masterPromptPath: string;   // v9/MASTER-PROMPT.txt
  bundles: { name: string; path: string; role: string }[]; // BUNDLE-*.txt
  combinedPath: string;       // v9/COMBINED-PROMPTS.txt
}
```

Bundle roles:
- `BUNDLE-01-preserve-code.txt` — prior-version components/patterns to KEEP (from vN src)
- `BUNDLE-02-schema-contracts.txt` — backend API + Prisma shape the frontend integrates with
- `BUNDLE-03-data-models.txt` — data-model dumps / types the frontend must honor
- `BUNDLE-04-known-gaps.txt` — the audit's Phase A/B/C failures → explicit FIX instructions

## Report Artifacts

- `vN/CONVERGENCE-REPORT.md` — human-readable Phase A–D with evidence (FR-007).
- `vN/_audit/ledger.json` — `ConvergenceLedger` single-entry append (for next diff).
- `vNEXT/MASTER-PROMPT.txt` — full instruction prompt for the remote agent.
- `vNEXT/COMBINED-PROMPTS.txt` — verbatim concatenation of all bundles.
