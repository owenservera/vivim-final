# Domain Docs — vivim-final

## Layout

**Single-context** — one codebase, one domain.

## Context Files

- `CONTEXT.md` — not yet created. Domain vocabulary lives in `AGENTS.md` (Project Architecture section) and `docs/merged-design-v2/`.
- `docs/decisions/ADR-*.md` — architectural decision records (10 ADRs).
- `docs/roadmap/INVARIANTS.md` — non-negotiable boundary conditions.
- `docs/merged-design-v2/` — complete design docs (read in order 00-08, then SOTA-00 through SOTA-09).

## Domain Glossary (key terms)

| Term | Meaning |
|------|---------|
| **Engine** | A self-contained module in `src/engines/` that encapsulates a specific capability |
| **ChromeGovernor** | The single authority for all CDP operations (Invariant B1) |
| **CDP** | Chrome DevTools Protocol — used to control Chrome browsers |
| **Slave** | A Chrome instance managed by the governor (one per provider) |
| **Capability** | A DB-stored method that the UI executes (not hardcoded in code) |
| **HarnessDAG** | A directed acyclic graph of CDP actions (type, submit, click, etc.) |
| **Provider** | ChatGPT, Claude, or Gemini — the AI service being automated |
| **ProviderSession** | A DB record linking a provider account to a Chrome slave |
| **Conversation** | A DB record representing a chat session with a provider |
| **Store Contract** | Interface in `src/storage/contracts/` that engines depend on |
| **UnifiedCapability** | The single entry point for all operations (v10 invariant) |
| **NLCL** | Natural Language Command Layer — maps user phrases to capabilities |
| **Provider Onboarding** | The process of adding a new webapp provider via PRD-12's static phase map (discover → infer → test-selectors → test-parse → test-cap → test-frontend → verify → converge) |
| **Onboard Phase** | One of 8 discrete modes in the onboarding pipeline; each is independently runnable and repeatable |
| **Onboard Ledger** | Persisted state at `.runtime/onboard-ledger.json` supporting `--from` and `--resume` across sessions |
| **Selector Confidence** | A score (0.0–1.0) measuring how reliably a DOM selector identifies a UI element; minimum 0.8 to pass |
| **Parser Confidence** | A score (0.0–1.0) measuring parser correctness on captured stream data; minimum 0.7 to pass |
| **Confidence Gate** | A threshold check that halts onboarding on failure and appends a convergence task (never silently proceeds) |
| **Automation Activity Log** | JSONL file at `.runtime/activity.log` recording every LLM command, stream, probe, and parse result for post-mortem analysis |

## Reading Rules

When implementing a feature:
1. Read `AGENTS.md` for code conventions and invariants
2. Read relevant ADRs in `docs/decisions/`
3. Read engine specs in `docs/merged-design-v2/04-merged-engines.md`
4. Check `docs/roadmap/INVARIANTS.md` for boundary conditions
