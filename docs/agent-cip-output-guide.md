# Agent CIP Output Guide — vivim-final (embedding-free pipeline)

**Repo root:** `C:\0-BlackBoxProject-0\vivim-final`  
**Pipeline mode:** No embedding (`--reembed` / `embed` / `rebuild` skipped). `.cip/config.toml` overrides set `embed.backend = "none"`, `autostart = false`, `retrieval.vector_k = 0`, `retrieval.hybrid_weight = 1.0` (pure lexical) to prevent `search` / `context` from loading an embedder.  

> ⚠️ `search` and `context` trigger embed loading unless the above `.cip/config.toml` override is active. If you see `"loading embedding model..."`, the pipeline is no longer embedding-free — abort and verify `.cip/config.toml`.  
**Agent load point:** Read this before consuming any `cip` output. Every output format below is produced by the current CLI build (`lib/cipkg/cli.py`, v1.0 + v2 gap-fill + MDM + DIL).

---

## 0. How to re-run (embedding-free full system)

Run from inside `vivim-final` (or set `CIP_ROOT` / `cd` there):

```powershell
# Index (scan + link, NO embed)
python -m lib.cipkg.cli index --full

# Analysis / health
python -m lib.cipkg.cli analyze
python -m lib.cipkg.cli doctor --static
python -m lib.cipkg.cli doctor --config
python -m lib.cipkg.cli doctor --runtime

# Audit surfaces
python -m lib.cipkg.cli audit
python -m lib.cipkg.cli findings --structured
python -m lib.cipkg.cli findings --structured --severity critical
python -m lib.cipkg.cli impact --structured --target src/main.ts --depth 2

# Gap-fill (no embed dependency)
python -m lib.cipkg.cli dead --limit 50
python -m lib.cipkg.cli circular
python -m lib.cipkg.cli metrics
python -m lib.cipkg.cli env --limit 60
python -m lib.cipkg.cli score
python -m lib.cipkg.cli blame src/main.ts 42
python -m lib.cipkg.cli migrations

# Retrieval / navigation (works on indexed symbols + lexical FTS5, no vectors)
python -m lib.cipkg.cli search "auth middleware" -k 10
python -m lib.cipkg.cli symbol "useAuth"
python -m lib.cipkg.cli graph sym_abc --direction both --depth 1
python -m lib.cipkg.cli context --symbol sym_abc
python -m lib.cipkg.cli suggest-context --file src/main.ts

# MDM (L0-LA) — multi-layer extraction; independent of embeddings
python -m lib.cipkg.cli mdm-scan
python -m lib.cipkg.cli mdm-report --markdown > .cip/reports/mdm.md
python -m lib.cipkg.cli mdm-trace LA-GAP-003
python -m lib.cipkg.cli mdm-gaps

# DIL (doc intelligence layer)
python -m lib.cipkg.cli docs status
python -m lib.cipkg.cli docs refresh --path src/main.ts --target docstring
python -m lib.cipkg.cli docs review --approve-all
python -m lib.cipkg.cli docs watch

# Journey / flow tracing
python -m lib.cipkg.cli journey list
python -m lib.cipkg.cli journey trace cli:init

# Agent hooks / session / learning
python -m lib.cipkg.cli session start
python -m lib.cipkg.cli session status
python -m lib.cipkg.cli hook post-edit --file src/main.ts
python -m lib.cipkg.cli learning analyze
python -m lib.cipkg.cli learning patterns

# Export / summary
python -m lib.cipkg.cli export --format json --out .cip/reports/export.json
python -m lib.cipkg.cli summary src/main.ts
python -m lib.cipkg.cli map
```

---

## 1. Search & Retrieval (`search`, `symbol`, `graph`, `context`, `suggest-context`)

| Command | What it reads | Embedding needed? | Agent action |
|---|---|---|---|
| `search` | Lexical FTS5 (`.cip/data/index.db`) + index edges | No (vector_k disabled when no embed) | Read `results[].snippet`, `file`, `score`. Sort by relevance manually if vector scores missing. |
| `symbol` | Symbol table from `indexer` AST parse | No | Get exact `file:line` definition. Use for jump-to-def. |
| `graph` | `edges` table (symbol refs, imports) | No | Read `nodes` and `edges`. Build dependency graph locally. |
| `context` | Combined lexical + symbol + budget-limited snippet retrieval | No (falls back to lexical + edges) | Read `context[].snippet`; respect `budget` token count. Good for RAG prompt construction. |
| `suggest-context` | `predict.suggest_context_for_edit()` | No | Read `suggested_context[].file` list. Feed into edit prompt as supporting files. |

**Agent rule:** If `search` returns empty, check `.cip/config.toml` exclusions; run `index --full` again before concluding nothing exists.

---

## 2. Audit (`audit`, `findings`, `impact`)

- `audit` → `audit_file()` or full-repo `audit()` refresh. Returns structured findings by severity (`critical`, `high`, `warning`, `info`).
- `findings --structured` → machine-actionable (`rule`, `severity`, `file`, `line`, `message`, `suggested_fix`). **Always use `--structured`** when feeding an autonomous fix agent; `findings` without flag is human-readable.
- `findings --structured --rule RULE_ID --path src/` → filter to a single detector family (e.g., `S1-swallow-scanner`).
- `impact --structured --target sym_123 --depth 2` → blast-radius analysis via `edges` table (calls, references, imports). Returns `affected_files`, `test_files`, `impact_level` (`high`/`medium`/`low`).

**Agent rule:** Before applying any fix, run `impact --structured` on the symbol being edited. If `impact_level == high`, create a checkpoint (`docs/agent-cip-output-guide.md` §6 discipline from `AGENTS.md` / `RUNBOOK.md`).

---

## 3. Health & Self-Diagnostics (`doctor`, `analyze`, `gate`)

| Scope | Command | Reads | Agent action |
|---|---|---|---|
| Static detectors (S1 swallow + S2 lint) | `doctor --static` | `rules.py` detectors, `tests/detectors/` fixtures | Read `findings`. Zero FPs required on `tests/data/clean_ref/`. |
| Config self-consistency | `doctor --config` | `.cip/config.toml` vs `config.default.toml` / profile mappings | Read `drift` array. Fix TOML mismatches before running other detectors. |
| Runtime / API contract | `doctor --runtime` | `index.db` meta, daemon health, FTS5 status, commit lag | Read `daemon_str`, `vector_coverage`, `fresh`, `lag_s`. If daemon stopped, start it (`cip daemon start`) or accept slower local embed; but since pipeline is embedding-free, daemon is optional. |
| Full report + info table | `doctor` (no flag) | Same as above + `gapfill.score()` health score, DB size, dims | Read all rows. If `vector_coverage` shows `0.0%`, that is expected in embedding-free mode — not an error. |

- `analyze` → comprehensive `repo_health_report()`; similar to `doctor` but more narrative (`issues`, `recommendations`, `score`). Good for high-level status summaries.
- `gate` → quality gate (`exit 1` on `critical` findings). Always pass `--docs --strict-docs` when documentation accuracy is required.

**Agent rule:** When `doctor` reports `vector_coverage: 0.0%` in this embedding-free run, do **not** treat as failure — verify `index --full` completed without errors and `chunks > 0`.

---

## 4. Master Data Model (`mdm-scan`, `mdm-report`, `mdm-trace`, `mdm-gaps`)

These are multi-layer (L0-LA) extraction and synthesis commands. They read `lib/cipkg/mdm_engine.py` and `mdm_synthesis.py` outputs stored in `.cip/data/` (SQLite) and `.cip/reports/`.

- `mdm-scan`: runs full `run_mdm_extraction()` (L0 raw sources, L1 parsed AST, L2 normalized entities, L3 relationships, L4 wiring gaps) + `synthesize_la_findings()`.
- `mdm-report --markdown`: produces executive report with sections for each layer. Save to `.cip/reports/mdm.md` for agent review.
- `mdm-trace <finding_id>`: returns step-by-step explainability (`trace_steps`). Read each step (`source`, `operation`, `evidence_line`) before acting on a synthesized gap.
- `mdm-gaps`: lists `L4` silent wiring gaps (IPC, events, routes). Read `gaps[].type`, `severity`, `affected_file`.

**Agent rule:** For any `mdm-trace` output, the agent must verify `evidence_line` points to a real file line (not a ghost reference) before proposing a structural fix.

---

## 5. Documentation Intelligence (`docs` subcommands + DIL engine)

- `docs status`: reconciliation stats (`total_units`, `current`, `stale`, `missing`, `findings_count`). A `stale` count > 0 means doc/code drift detected by `DILEngine.reconcile_units()`.
- `docs refresh --path ... --target docstring`: regenerates docstrings/specs with ZHT. Read `refreshed[].draft` before applying.
- `docs review --approve-all`: bulk-approve pending drafts (`pending_reviews`). Only approve if `draft` content aligns with code evidence.
- `docs watch`: foreground vibe-watcher (`vw.engine.reconcile_units()` + `evaluate_and_record()`). Read `initial_findings` array for live drift.

**Agent rule:** Never approve `pending_reviews` without reading the associated code snippet (`docs refresh` output links to `.cip/reports/` drafts). Preserve existing inline comments (per `CLAUDE.md` / `AGENTS.md` §Comment Preservation).

---

## 6. Journey & Flow (`journey`)

- `journey list`: discovered journeys (user + execution). Read `journeys[].id`, `.type`, `.steps`.
- `journey trace cli:init`: sequence steps for an entrypoint. Read `steps[].operation`, `.source_file`, `.timestamp`.
- `journey rebuild`: re-extracts all from call graph. Use when `list` returns empty but journeys are expected.

---

## 7. Learning & Memory (`session`, `learning`, `hook`)

- `session start`: creates session file with repo context. Run before any multi-step work.
- `session end`: collects session data (commands used, files edited, errors). Read `learning_data`.
- `learning analyze`: analyzes recent sessions for patterns. Output: `pattern_frequency`, `recommended_next_actions`.
- `learning patterns`: agent-specific pattern detection (`agent_id`, `pattern_type`, `confidence`). Read `confidence` before trusting a pattern recommendation.
- `hook post-edit`: agent integration hook. Pass edited file path; returns `affected_context`.

**Agent rule (from AGENTS.md 120K-rule / `token_compaction_system.md`):** Every autonomous session must have first todo = restore docs (`RUNBOOK.md`, `TRACKER.md`, `LEDGER.md`) and last todo = checkpoint. After any `learning patterns` output, persist findings to `.cip/reports/` or a persistent file; do not rely on session context memory.

---

## 8. Export & Summary (`export`, `summary`, `map`)

- `export --format json --out .cip/reports/export.json`: machine-readable index state (`files`, `symbols`, `chunks`, `edges`, `vectors` — note `vectors` will be 0 in embedding-free mode).
- `export --format lsif`: Language Server Index Format for external navigation.
- `summary <path>`: structural summary (`functions`, `classes`, `imports`, `exports`). Read for quick code orientation.
- `map`: repo-level symbol map (like a lightweight index map for token-efficient navigation). Good for building token-lean agent context (`AGENTS.md` §Repo maps).

---

## 9. Predicted Next Actions (`predict`, `route`)

- `predict --operation edit --symbol sym_abc --query "add validation"`: predicts likely next files / operations based on current symbol and operation string. Read `predictions[].file`, `.operation`, `.confidence`.
- `route --agent --query "how to deploy"`: agent-aware routing with `confidence_scores`. Use when navigating between modules (e.g., from `frontend/` to `prisma/` or `.opencode/`).

---

## 10. Verification & Gate (`verify`, `gate`, `selftest`)

- `verify --typecheck --lint --blocking`: full verification gate (`broken` tests + typecheck + lint + audit). If `blocking` and `can_proceed == false`, agent must not proceed to fix/apply phase.
- `selftest`: runs `selftest.run_selftest()`; returns `exit_code`. Must be 0 before any campaign checkpoint.
- `gate --docs --strict-docs`: documentation health gate (`ok`, `critical_findings`). If `ok == false`, fix docs before code changes.

---

## 11. How the Agent Should Consume Outputs (workflow)

Based on `AGENTS.md` Workflow 2 (`Making a Safe Change`) and `RUNBOOK.md` §4 process:

1. **Restore** (anti-erasure): Read `.cip/config.toml`, `docs/runbooks/` (if present), `docs/agent-cip-output-guide.md` (this doc), `AGENTS.md` 120K rules.
2. **Index**: `index --full` (embedding-free).
3. **Context**: `suggest-context --file <target>` → get editing context.
4. **Search**: `search` for target symbol / error message; confirm symbol location via `symbol`.
5. **Impact**: `impact --structured --target <sym>` → understand blast radius.
6. **Audit**: `audit` / `findings --structured` → check existing defects in target file.
7. **Analyze**: `analyze` → health overview.
8. **Doctor**: `doctor --static` / `--config` / `--runtime` → verify system clean.
9. **Edit** (if authorized by user / gate): edit file; preserve all comments (`CLAUDE.md`).
10. **Hook**: `hook post-edit --file ...` → collect post-edit state.
11. **Checkpoint**: write `.cip/reports/checkpoint-[timestamp].md` with `TRACKER` + `LEDGER` updates (per `RUNBOOK.md` §6).
12. **Re-run**: `index --full` → `doctor --static` → verify `findings` unchanged or improved; `impact` after edit shows reduced blast radius.
13. **End session**: `session end` → `learning analyze`.

---

## 12. File References (persistent artifacts)

All persistent outputs should land in `.cip/reports/` or `.cip/fixplan/` (not just stdout). Use `export --out .cip/reports/export-[date].json` to capture machine state.

- `.cip/config.toml` — repo profile + exclusions (read before `search`).
- `.cip/data/index.db` — SQLite index; queried by `search`, `graph`, `context`. Not edited directly by agent.
- `.cip/reports/` — agent-written reports (`checkpoint-*`, `mdm.md`, `export-*.json`).
- `.cip/fixplan/` — `fix-plan.json` from `fixplan`; `fixrun` reports. Read before applying automated fixes.
- `docs/agent-cip-output-guide.md` — this file (re-read at session start).
- `docs/dev/cip-bugfix-campaign/RUNBOOK.md` / `PROFILE.cip.md` / `TRACKER.md` / `LEDGER.md` — campaign docs (read for method, never edit `09-bugs-and-issues.md`).

---

## 13. Constraints & Rules (from AGENTS.md + RUNBOOK)

- **No embeddings** = no `embed`, `rebuild`, `sync` with embed, or daemon embedding calls. `search` uses lexical FTS5 + edges; `context` uses lexical + budget; `suggest-context` uses prediction engine without vector similarity.
- **Detect-first / fix-last** (`RUNBOOK.md` §4): never fix code before detector fires (`findings --structured`) and stays silent on clean (`tests/data/clean_ref/`). If running against `vivim-final` (not a clean reference repo), treat `findings` as evidence of broken code.
- **0 FPs on clean_ref**: any new detector must show 0 false positives on `tests/data/clean_ref/` before fix application. In `vivim-final`, clean_ref is not present; use `tests/data/clean_ref/` from the `index` repo if comparing detector behavior.
- **Comment preservation**: never strip/remove inline code comments when editing (`CLAUDE.md`).
- **Parametrized SQL / no eval**: any agent script that writes to `.cip/data/` must use `store.connect()` context managers; never interpolate user input into SQL.
- **Session budget**: keep session under 120K tokens (per `AGENTS.md`). After deep work on `vivim-final`, write `CHECKPOINT.md` before continuing.
