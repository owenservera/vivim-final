# Research Plan: OpenCode `local-agent` Provider — Deep Protocol Understanding

**Feature**: `022-local-agent-opencode` | **Date**: 2026-07-19
**Mode**: Research-only (no source changes). Output = 10 documented research briefs with verified facts + examples.

## Baseline (what we already know — verified 2026-07-19 on this host)

- `opencode` runs via bun (`C:\Users\VIVIM.inc\.bun\bin\opencode.cmd`), kill present, Node v24, Windows.
- 4 verified Zen free models run with **no key, cost 0**: `deepseek-v4-flash-free`, `hy3-free`, `mimo-v2.5-free`, `north-mini-code-free`. `nemotron-3-ultra-free` excluded (timed out >5 min).
- One-shot path verified: `opencode run --auto --model <id> --format json "<prompt>"` → exit 0; JSON tail `{"type":"text","part":{"type":"text","text":"PONG"},"tokens":{"total":68608,"input":68591,"output":3,"reasoning":14,"cost":0}}`.
- `serve` starts **unsecured** by default (observed log `OPENCODE_SERVER_PASSWORD is not set; server is unsecured`). Always set `OPENCODE_SERVER_PASSWORD`.
- Spec `specs/022-local-agent-opencode/spec.md` is **v1 one-shot only** (`run`, no `serve`/ACP). Executor shells `opencode` via `Bun.spawn`; must NOT import `ChromeGovernor` (Governor Canon).
- Existing docs: `docs/research/reports/opencode-agentic-{capabilities-sota,impl-docs}-2026.md` + `evidence/opencode-agentic/notes.md` are **doc-derived inventories**, not empirically verified for the deep protocol mechanics.

## Critical gap

We have a capability *inventory* but **no verified, documented, example-backed understanding** of the actual wire protocol. The 10 areas below are the ones blocking a "fully documented real understanding" of full comms protocol, tooluse, context, etc. Each must be grounded in **live execution on this host + official docs**, not inference.

## The 10 research areas (each → one brief in `docs/research/briefs/opencode-deep/`)

1. **Full `--format json` event-stream contract (comms protocol)**
   - Reconstruct the *complete* ordered event schema from `step_start` → `text`/`reasoning`/`tool_call` → `step_finish` → terminal, including every field (`part`, `tokens`, `session`, `permission`, `variant`).
   - Capture a real multi-event transcript (long prompt) and document field-by-field. Verify vs `docs/research/reports/opencode-agentic-impl-docs-2026.md` PART 3/4.
   - Deliverable: canonical event grammar + recorded sample → maps to `ContentBlock[]` (`src/schema/streaming.ts`).

2. **Tool-use loop mechanics (TUI-internal tool calls)**
   - What does the agent actually invoke when it needs to `edit`/`bash`/`read`/`grep`? Are tool calls surfaced in `--format json` as distinct event types, or only as final text?
   - Run a task that *requires* a tool (e.g. "read stream-parser.ts and summarize") and capture the raw stream to see `tool_call`/`permission` events.
   - Document: event shape, approval flow under `--auto`, how tool *results* return into the stream. Feeds `tool.*` capability class (cap list item D).

3. **Context window, compaction & session state (context)**
   - `opencode.json` has `compaction.auto/prune/reserved:10000`. What is the real context contract? When does compaction fire, what `reserved` means, and is there a `compaction` event in `--format json`?
   - Test a long multi-turn session; capture compaction trigger + resulting event. Document token accounting (`tokens.input/reasoning/output`) semantics and cost:0 guarantee for free models.
   - Feeds `ConversationManager.captureAsNode()` fork-linking + node-layer v2 versioning.

4. **`serve` HTTP API — full surface & auth (security-critical)**
   - The #1 open risk: unsecured `serve`. Document exact auth model: `OPENCODE_SERVER_PASSWORD` (username default `opencode`), token header name, how `/session/:id/message` is authed.
   - Enumerate ALL endpoints from live `GET /doc` OpenAPI 3.1 on `127.0.0.1:<port>`; confirm request/response shapes for `POST /session`, `POST /session/:id/message`, `GET /event`, `POST /session/:id/prompt_async`.
   - Document readiness race (health probe lost to startup) + safe boot/wait pattern. Determines whether `serve` is viable beyond v1.

5. **ACP (Agent Client Protocol) stdio contract (embed path)**
   - `opencode acp --cwd <repo>` emits nd-JSON on stdin/stdout. Document the ACP message framing (handshake, `initialize`, `prompt`, `notification` types), vs the `--format json` CLI events.
   - Verify ACP is the better embed contract for `CapabilityComposer` DAG fan-out (per impl doc PART 3.3). Capture a real ACP session transcript.
   - Decision input: `run` (one-shot) vs `acp` (managed subagent) vs `serve` (persistent) for v2.

6. **Permission model & tool gating (safety)**
   - `permission: allow|ask|deny` + glob; `permission.task` scoping subagents. How is `ask` resolved headlessly (implied: auto-answered / denied)? What is deny-by-default behavior?
   - Verify: run with `permission:{"*":"deny"}` + a tool-needing prompt → does it error or skip? Document exit behavior.
   - Maps to `requiresConfirmation` + `permission` map on `UnifiedCapability` (cap class C/E).

7. **Multi-turn / session resume & forking (state)**
   - `--session <id>`, `--continue`, `--fork`, `/session/:id/fork`. What is the session artifact on disk? Is `--continue` truly mutually exclusive with prompt+`--auto` (per impl doc limitation)?
   - Test resume: run, capture session id, `--session <id>` second message → verify continuity + event diff. Feeds `agent.session.fork/create/delete` caps.

8. **Streaming / SSE transport & partial-delivery semantics**
   - `--format json` is it line-delimited? Does `serve`'s `GET /event` SSE carry the *same* events as CLI json? Document delimiters, flush cadence, partial-block reassembly for `StreamParserEngine`.
   - Needed because `LocalAgentProviderExecutor.parse()` must handle partial/streamed chunks without a DB parser that assumes complete payloads.

9. **Error, failure & signal semantics (robustness)**
   - Exit codes `0`/`1`/`124`(timeout) confirmed in docs but not stress-tested. What events precede a non-zero exit (e.g. `error` event type)? How does SIGTERM kill behave mid-stream?
   - Force failures: bad model, denied tool, hung prompt → capture exit + stdout/stderr. Define `EngineError` mapping for `capability:failed`.

10. **Config precedence, providers & model routing (wiring)**
    - `opencode.json` resolution order (global → project → `OPENCODE_CONFIG_CONTENT`), how `model`/`small_model`/per-agent `model` override, and how the `opencode/` Zen provider group is registered (local vs keyed).
    - Verify: can we pin `default_agent`/per-capability model purely via committed config without secrets? Document the `{env:VAR}` trust boundary (global only).
    - Feeds `LocalAgentStore` config shape + seed manifest (`seeds/providers/local-agent.ts`).

## Method per area (recommended)

1. Live capture on this host: `opencode run --auto --model opencode/<free> --format json "<task>" 2>&1 | Tee-Object -FilePath docs/research/evidence/opencode-deep/<area>.transcript.txt`
2. For `serve`/ACP: start in background, hit with PowerShell `Invoke-RestMethod` / capture stdio; use `OPENCODE_SERVER_PASSWORD` + localhost bind.
3. Cross-check every claim against official docs: `opencode.ai/docs/{agents,tools,cli,server,config,providers}` (already linked in impl doc PART 9).
4. Write a brief per area: **Verified facts (with transcript excerpt) · Official doc confirmation · Gap/risk · Mapping to vivim engine/contract · Example snippet**.

## Output location

`docs/research/briefs/opencode-deep/<NN>-<area>.md` (10 files) + `docs/research/evidence/opencode-deep/*.transcript.txt` (raw captures). Append a consolidated index `docs/research/briefs/opencode-deep/INDEX.md`.

## Open questions to resolve through research

- Is `--format json` the *complete* comms contract, or does `serve`/ACP expose richer tool/permission events not visible in one-shot?
- Can `serve` be made safe enough (password + localhost) to justify v2 persistent backend?
- Does tool-use actually surface as parseable events, or only final synthesized text (affects `tool.*` capability feasibility)?

## Validation

- Each brief cites a real transcript excerpt from this host.
- Cross-surface parity unaffected (local-agent stays out of `ChromeGovernor`).
- Findings feed a v2 spec update (currently out of scope to implement).
