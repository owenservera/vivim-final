# MASTER BLUEPRINT — inferred intent (DRAFT, docs-only)

> This document infers WHAT THE principal WANTED from docs + archives only.
> It is NOT implementation guidance. Facts live in GENOME.md and CENSUS.md.
> Generated: 2026-08-27T03:28:25.084Z — 3225 intent statements mined.

## Intent signal per topic

| Topic | Signals |
|---|---|
| conversation | 174 |
| memory | 80 |
| collections | 14 |
| providers | 241 |
| sync-p2p | 41 |
| documentation | 95 |
| capability-system | 377 |
| desktop-app | 50 |
| agent-execution | 103 |
| sovereignty | 11 |
| parser-system | 34 |
| ui-ux | 202 |

## conversation
- `findings --structured` → machine-actionable (`rule`, `severity`, `file`, `line`, `message`, `suggested_fix`). **Always use `--structured`** when feeding an autonomous fix agent; `findings` without flag is human-readable.
- Decision**: Only the `ChromeGovernor` engine may interact with the Chrome DevTools Protocol (CDP). No other engine or transport may import or use `BunCdpClient` directly. All CDP-mediated actions (provider setup, message capture, response parsing, etc.) must go through the ChromeGovernor.
- Validation**: The heuristic must correctly identify the format for all current providers (`chatgpt`, `claude`, `gemini`, `deepseek`, `qwen`, `grok`) and must not misclassify the generic/system parsers.
- Boundary**: The `seeds/` directory is the second source of truth (after code). Parser logic lives only in the DB (`parser_logic_code` with `logic_type=inline`). File-based parsers are rejected (`allowFileLogic` must be explicitly enabled). The `StreamParserEngine` loads parser logic from the DB, not from files.
- Parser validation**: The `StreamParserEngine` validates parser logic against the DB (`parser_logic_code` must be `inline`). File-based parsers are rejected (`ARCHITECTURAL_DECISIONS.md` §Decision 4).
- 2. Should `Mintlify` analytics model (`routes → searches → chat behavior → feature usage`) be integrated into our feedback loop (`P9`)?
- Endpoints like `/api/conversations/:id/send` block forever waiting for a CDP browser that isn't attached. Always wrap `fetch` calls with `AbortController` + timeout so the test completes.
- 1. **UI slot IDs must be namespaced** — The frontend `SLOT_IDS` in `frontend/src/ui/slots.ts` use `chat.actionBar`, `chat.composer`, `chat.sidebar` (not short names). The taxonomy pipeline's `CATEGORY_POSITIONS` table must use these exact values or `ui_position` silently fails.

## memory
- Agent rule (from AGENTS.md 120K-rule / `token_compaction_system.md`):** Every autonomous session must have first todo = restore docs (`RUNBOOK.md`, `TRACKER.md`, `LEDGER.md`) and last todo = checkpoint. After any `learning patterns` output, persist findings to `.cip/reports/` or a persistent file; do not rely on session context memory.
- Review cadence: any behavior-changing commit touching a cited file must bump that
- 6. **Perform final audit** (`Migration 014` / `Phase 24`): Independent review of the reasoning discoverability (`FINAL_ARCHITECTURE_SUMMARY.md` must answer: can a fresh senior architect understand the WHY?).
- Why now**: The FSRS-6 scheduling (`ARCHITECTURAL_DECISIONS.md` §Decision 1; `SOTA_GAP_ANALYSIS.md` Problem 3) is a core feature; its integration with the version chain must be verified.
- Validation**: Tests must pass for 100+ random payloads through version chain rebuilds. If any FSRS state is lost or altered, the `rebuildGraphFromNodes()` logic (or the `NodeVersion` model) must be fixed.
- Priority Queue scheduling: scheduling based on priority (e.g., recent recall quality + importance) rather than a fixed interval formula.
- FSRS-6 vs alternative schedules** (SM-2, Priority Queue, Half-Yearly, Expanding Spacing).
- Priority Queue-based scheduling (used in some LLM memory systems) adapts interval based on recent recall patterns.

## collections
- await manager.setMetadata('msg1', { tags: ['tag1'], collectionIds: [], isPinned: false, isArchived: false, readStatus: 'unread', priority: 'normal' });
- await manager.setMetadata('msg2', { tags: ['tag2'], collectionIds: [], isPinned: false, isArchived: false, readStatus: 'unread', priority: 'normal' });
- await manager.setMetadata('msg3', { tags: ['tag1'], collectionIds: [], isPinned: false, isArchived: false, readStatus: 'unread', priority: 'normal' });
- NFR-3.1:** Collection deletion must cascade to items
- NFR-3.3:** Item operations must handle missing collections gracefully
- M2 (Collections System):** Backend collection APIs must be implemented
- NFR-3.2:** Collections panel must be collapsible on mobile
- NFR-3.1:** Collection deletion must cascade to items

## providers
- Introduces a layer of indirection: all CDP traffic must go through the ChromeGovernor.
- `claude-investigate/` is a *dev signals directory* that landed in tracking. Should likely have been gitignored.
- 3. **What lives in `claude-investigate/`?** Is it dev-only signal that should be gitignored?
- Why**: The DB is the source of truth, but the hot loop (capability resolution, provider selection, parser fallback) must be fast. The static protocol allows the engine to resolve capabilities and select parsers without DB latency, improving performance. It also decouples the hot loop from the DB lifecycle, making the system more resilient to DB failures.
- SOTA reference**: Playwright `CDPSession` event monitoring (`session.on('event')`) can detect unexpected events; the sidecar should use similar monitoring for security.
- SOTA reference**: Playwright `CDPSession.detach()` provides clean session teardown; the Governor should implement automatic session cleanup on provider failure or timeout.
- Graceful degradation**: If Chrome is unavailable, the system should fall back to API-mode (use provider REST API instead of CDP-based UI automation). This graceful degradation is planned but not fully implemented.
- 3. **`claude-investigate/`** (dev signals directory): Should it be gitignored? It was committed in `3949aa5` but serves no user-facing purpose.

## sync-p2p
- Schema migrations must be applied to both databases, requiring synchronization.
- The Tauri layer must be kept in sync with the Bun backend (API contracts, event formats).
- /** Marker field — always 'async'. */
- on schema v15 must not corrupt each other's data during sync.** The
- it('should do something', async () => {
- it('should handle null result', async () => {
- it('should create when not found', async () => {
- it('should do something', async () => {

## documentation
- `gate` → quality gate (`exit 1` on `critical` findings). Always pass `--docs --strict-docs` when documentation accuracy is required.
- Say this explicitly in onboarding; testers must expect manual updates.
- Non-negotiable principle: **the wiki is a projection of code truth, never a parallel narrative.**
- block what they haven't. The Codex wiki is always one search away.
- Existing Vivim component:** `OnboardingTour` already exists in `frontend/src/components/canvas`. It should be replaced/extended with Tour Kit for production quality, not rebuilt from scratch.
- The system must trust that the repair helpers are correct and do not introduce false positives.
- Evidence**: `.gitignore` line 84 excludes `docs/`; all forensic docs (`REPOSITORY_FORENSIC_AUDIT.md`, `ARCHITECTURAL_ERAS.md`, etc.) must be added with `git add -f`.
- Evidence**: `.gitignore:84` excludes `docs/`; forensic docs (`REPOSITORY_FORENSIC_AUDIT.md`, `ARCHITECTURAL_ERAS.md`, etc.) must be added with `-f`.

## capability-system
- Requires discipline: every new capability must be registered in the DB and NLCL catalog.
- No engine or transport should need to embed parser logic in code; if they do, they must opt-in via `allowFileLogic`.
- Requires discipline: every capability must be registered with the correct metadata for all surfaces.
- Risk**: MEDIUM — assertions catch violations at runtime but do not prevent them at compile time; the contract relies on developer discipline (every engine must declare the boundary).
- Why now**: The repair engine (`ARCHITECTURAL_DECISIONS.md` §Decision 6; `SOTA_GAP_ANALYSIS.md` Problem 9) fixes common LLM payload defects. Its correctness must be verified to prevent false positives/negatives.
- Why now**: The capability registry (`ARCHITECTURAL_DECISIONS.md` §Decision 2; `SOTA_GAP_ANALYSIS.md` Problem 4) must scale. Embedding-based lookup improves accuracy but is optional.
- Same registry, but expanded to 459 engine files (up from 341). The capability registry must handle a growing number of capabilities without degrading mapping accuracy or execution speed. The `catalog.ts` file is the primary NL→capability binding file; there is no automated taxonomy generation or semantic search.
- Why**: The capability registry must scale from ~30 capabilities (v0.1.0) to potentially 100+ (given 459 engine files). Semantic lookup improves accuracy without requiring manual catalog updates.

## desktop-app
- Windows version? (must be 10/11 x64 for alpha)
- Must honor CSS variables for theme consistency with existing app
- locally. The landing page is the first screen after install. It must:
- Any forward migration must decide whether to bring *all* of these forward or only the *abi-clean* ones (e.g., the static protocol generator is +abi-clean; the DB split is not immediately; the Tauri layer is additive but not in core contracts).
- SOTA reference**: MCP spec §Security (user consent, data privacy, tool safety) applies to any user-facing interface; the desktop layer must ensure that user data is protected and that the user understands what actions are being taken.
- Every diagram below is **mandatory unless genuinely inapplicable** (e.g., no auth means skip the auth sequence diagram, but say so explicitly). Diagrams must be internally consistent with each other and with the inventory from Phase A — same component names everywhere.
- Version management:** `scripts/tauri/version.ts` is the single source of truth — reads/writes `tauri.conf.json` + `Cargo.toml` + derives exe metadata at compile time. Always pass `--version` to scope state correctly.
- 10. **Triple-Layer State:** Profile + DB + runtime must stay consistent. Profile dir is canonical, DB and runtime are derived from profile state.

## agent-execution
- Agent rule:** For any `mdm-trace` output, the agent must verify `evidence_line` points to a real file line (not a ghost reference) before proposing a structural fix.
- `verify --typecheck --lint --blocking`: full verification gate (`broken` tests + typecheck + lint + audit). If `blocking` and `can_proceed == false`, agent must not proceed to fix/apply phase.
- 11. How the Agent Should Consume Outputs (workflow)
- Parametrized SQL / no eval**: any agent script that writes to `.cip/data/` must use `store.connect()` context managers; never interpolate user input into SQL.
- Impact**: The pre-existing errors prevent clean `typecheck` passes; they must be fixed separately (owned by other agents, per AGENTS.md).
- Note**: Per AGENTS.md (`§Typecheck guardrail`): "Only run a typecheck when the full task list / todos are complete AND you have asked the human first." The errors are pre-existing and should not block this audit/reconstruction work.
- | **Agent must manually read source** (`01-DISCOVERY-PROTOCOL.md` is a checklist, not a script) | `scripts/auto-discover.ts` parses `src/` + `prisma/` + `seeds/` automatically |
- | Open questions visibility | Hidden unless agent writes `OPEN-QUESTIONS.md` | Always visible in manifest (`open_questions` array) | Always visible |

## sovereignty
- "findings": [ { "id": "AU-0001", "priority": "P1", "dimension": "security",
- "findings": [ { "id": "AU-0001", "priority": "P1", "dimension": "security",
- `P0` — ships right now, must fix (security hole, data loss, crash on main path)
- | **FIX-B2-1** | `prisma/schema.prisma` has 196 models in a single 3,811-LOC file | Triaged: maintainability concern only, no correctness/security risk. Deferred to post-alpha per ADR-014. Header comment added to `prisma/schema.prisma` pointing to the ADR. Convention: new models must include a `// ctx: <bounded-context>` comment. | ⏸️ DEFERRED |
- "findings": [ { "id": "AU-0001", "priority": "P1", "dimension": "security",
- "findings": [ { "id": "AU-0001", "priority": "P1", "dimension": "security",
- "findings": [ { "id": "AU-0001", "priority": "P1", "dimension": "security",
- "findings": [ { "id": "AU-0001", "priority": "P1", "dimension": "security",

## parser-system
- `export --format json --out .cip/reports/export.json`: machine-readable index state (`files`, `symbols`, `chunks`, `edges`, `vectors` — note `vectors` will be 0 in embedding-free mode).
- Parser logic (`logic_code`) must be stored in the DB as inline JavaScript; file-based parsers are rejected unless `allowFileLogic` is explicitly enabled (Invariant 6).
- Fix**: Not yet fixed; `biome.json` should either include `.md` formatting rules or the `.lefthook.yml` glob should be adjusted.
- Migration ordering**: The `seeds/harness/commands.seed.ts` and `seeds/parsers/harvest.seed.ts` show that seed scripts must apply to both DBs in the correct order. The `migration_lock.toml` indicates Prisma manages migrations per DB.
- Dev fallback is intentionally insecure — production deployments MUST set the env var.
- // RPC vs Google AI Studio SSE) — the chosen parser must understand
- `Parser '${row.name}' uses file logic but allowFileLogic is false — parsing logic must live in the DB`,
- warnings.push('No deltaPathJson set — parser must locate the response field itself.')

## ui-ux
- No screenshots-as-truth: UI changes faster than prose. Prefer "reach it" paths over pixel descriptions; screenshots allowed but must carry a captured-on version stamp.
- Requires discipline: every seed change must be accompanied by a DB update (handled by the seed scripts).
- Validation**: Characterization tests must still pass; performance improvement can be measured informally (faster DB reads/writes) but is not required for correctness.
- Audience: design/brand stakeholders, execs skimming for narrative, and future contributors who want the "why" before the "how." This is the one file allowed genuine narrative/vision voice — but it must still be traceable to the real product, not generic startup prose.
- For each sequence diagram, one paragraph stating what invariant must hold for the flow to be considered correct (e.g. "the DB write must complete before the UI optimistically-updates" or the reverse, if that's what the code actually does — note if it's optimistic vs. pessimistic).
- Only after this entire checklist passes should you report the task complete on the v1 scope. Then continue — do not stop here — into the v2 checks below, which are equally required.
- Adds a new architectural component (Extension Host) that must be built
- `src/extensions/` host layer) plus `frontend`'s always-loaded shell. It is

## INTENT-DRIFT records (fill at Pro gate G2)

For each: docs claim → code reality → principal decision. None filled yet — census data required.