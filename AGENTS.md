# AGENTS.md — vivim-final Project Instructions

## Project Overview

**vivim-final** is cap-store v1 Knowledge Graph Rebuild — a local-first AI conversation platform built with Bun + Prisma + TypeScript.

- **Runtime:** Bun
- **Language:** TypeScript (strict mode, ESNext target)
- **ORM:** Prisma v6.5
- **Linter/Formatter:** Biome
- **Git Hooks:** Lefthook
- **Testing:** Bun test runner
- **Build:** tsup (ESM + DTS)

## Architecture

13 engines organized in layers:
- **L0-L1:** Provider Knowledge Graph (ProviderRegistrar, ProviderHealthKernel)
- **L2-L3:** Capability System (CapabilityResolutionEngine, CapabilityEngine)
- **L4:** Session & State (ConversationManager, StreamBlockStore)
- **Chrome Layer:** ChromeGovernor (CDP proxy, lifecycle, trace, health)
- **Cross-cutting:** CapabilityEventBus, ConfigManager, StreamParserEngine
- **Lifecycle:** RegistrationAuditor, VersionManager, TelemetryAggregator

Design docs are in `docs/merged-design-v2/`. Read in order 00-08 for v1, then SOTA-00 through SOTA-09.

## Provider System (KNOW THIS FIRST)

### What Providers Exist

The system supports **6 providers**: `chatgpt`, `claude`, `gemini`, `deepseek`, `qwen`, `grok`.
Each is seeded from `seeds/providers/<slug>.json` (manifest with endpoints, parsers, models, capabilities).

### Provider File Layout

| File | Purpose |
|------|---------|
| `seeds/providers/<slug>.json` | Provider manifest (selectors, endpoints, parsers, models) |
| `seeds/parsers/harvested/<slug>-*.ts` | Stream parser `LOGIC_CODE` (inline, DB-driven) |
| `seeds/adapters/<slug>.ts` | Import adapter for external data portability |
| `src/engine/provider-selectors.ts` | CDP selector fallback lists (composer, send button, URL patterns) |
| `src/engine/conversation-manager.ts` | Provider-specific capture patterns + response parsing |

### What "Testing a Provider" Means

Testing a provider is an **8-phase onboarding pipeline** (`devops/onboard-controller.ts`):

```
discover → infer → test-selectors → test-parse → test-cap → test-frontend → verify → converge
```

| Phase | Command | What It Does | Pass Gate |
|-------|---------|-------------|-----------|
| discover | `bun run devops discover-protocol <url> --hint=<name>` | CDP protocol discovery: composer selectors, send method, capture patterns, response DOM | Returns manifest with detected selectors + format |
| infer | `bun run devops runtime-test onboard infer --provider=<slug>` | Infer parser from real streaming data | Confidence >= 0.7 |
| test-selectors | `bun run devops runtime-test onboard test-selectors --provider=<slug>` | Validate all CDP selectors against live DOM | All selectors match |
| test-parse | `bun run devops runtime-test onboard test-parse --provider=<slug>` | Real wire-format parsing against fixtures | All known formats parse |
| test-cap | `bun run devops runtime-test onboard test-cap --provider=<slug>` | Capability registration + execution via `/api/interpret` | Capability resolves |
| test-frontend | `bun run devops runtime-test onboard test-frontend --provider=<slug>` | E2E frontend: canvas mount + capability invoke + DOM assert | UI renders capability |
| verify | `bun run devops runtime-test onboard verify --provider=<slug>` | Final cross-surface verification | CLI + API + MCP + UI all resolve |
| converge | `bun run devops runtime-test onboard converge --provider=<slug>` | Convergence analysis: spec + code + arch alignment | No drift from spec |

### Existing Provider Test Status (Capability Matrix)

Parsers live **only** in the DB (inline `logic_code`, `logic_type=inline`). The
`provider-protocol.ts` static file is generated from the DB. Capabilities are
**provider-bound** (e.g. `send_message`, `select_model`), NOT per-provider UnifiedCapability
slugs like `gemini_send`. Verify a capability via the interpreter, not `--slug=gemini_send`:

| Provider | Status | Parsers (DB) | Capabilities | Gaps |
|----------|--------|--------------|--------------|------|
| claude | `seeded + registered` | `claude/001_streaming_sse` (inline) | `send_message`, `select_model` | none |
| gemini | `seeded + registered` | `gemini/001_batchexecute`, `gemini/002_ai_studio` + generic fallback | `send_message`, `select_model` | no stream_config row (custom batchexecute RPC) |
| chatgpt | `seeded + partial` | `chatgpt/001_openai_sse` (inline) + generic fallback | `send_message` | parser uses API format; wire uses chat UI format — needs real-world validation |
| deepseek | `seeded` | none configured | `send_message` | no parser row yet |
| qwen | `seeded` | none configured | `send_message` | no parser row yet |
| grok | `seeded` | none configured | `send_message` | no parser row yet |

> The 13-provider protocol also includes `generic`, `facebook`, `x`, `mistral`, `cohere`,
> `anthropic` (framework aliases). See `src/__generated__/provider-protocol.ts` for the full list.

### How to Check Provider Status

```bash
# Full preflight (all providers)
bun run devops runtime-test preflight

# Single provider deep-dive
bun run devops runtime-test status --provider=gemini

# Check individual dimensions:
bun run devops runtime-test health                     # DB + server
bun run devops runtime-test setup --provider=gemini --account=gemini_owservera@gmail.com   # Restore profile → launch
bun run devops runtime-test onboard --provider=gemini  # 8-phase onboarding pipeline
bun run devops discover-protocol https://gemini.google.com/app --hint=gemini
bun run devops runtime-test test --nl="send message to gemini"
# Capabilities are provider-bound (e.g. send_message), exposed via the interpreter:
bun run devops runtime-test test --nl="send message to gemini"
```

> **Provider Protocol Data Layer (`src/__generated__/provider-protocol.ts`):**
> The DB is the single source of truth; `bun run gen:protocol` compiles it to a static file
> (plus an editable dev clone `provider-protocol.dev.ts`). During testing/devops you can flip the
> system to read the dev clone and promote fixes back:
> ```bash
> bun run devops protocol dev            # how to set PROVIDER_PROTOCOL_SOURCE=dev
> bun run devops protocol diff           # show dev vs prod provider deltas
> bun run devops protocol promote --provider=gemini   # push dev overrides → DB → regenerate prod
> bun run devops protocol prod           # flip back to prod (default)
> # regen prod, preserving the dev clone (default); --reset-dev resyncs dev from prod
> bun run gen:protocol
> bun run gen:protocol --reset-dev
> ```

### Chrome Profile Layout (CANONICAL — do not deviate)

Chrome slaves (logged-in browser profiles) live **only** under `chrome-profiles/<providerSlug>/<accountId>`:

```
chrome-profiles/
  gemini/owservera/      # one authenticated profile per provider
  chatgpt/owservera/
  claude/owservera/
  discovery/protocol-probe/
```

- This is the resolved `profileBaseDir` (`ProfileAllocator` → `chrome-profiles/`; overridable via `dataDir`/config, see `src/config.ts` + `src/executor/profile-allocator.ts`).
- **Never** create top-level `gemini/`, `chatgpt/`, `claude/` directories at the repo root — those are stray duplicates and get deleted.
- **One account per provider** is the intended steady state (`owservera` for all three). When adopting/cleaning up, keep a single `owservera` profile and delete the rest.
- Each profile dir holds a `.profile-meta.json` (`providerSlug`, `accountId`, `allocatedAt`, `lastUsed`).
- The profile dir is the source of truth for "is this provider authenticated" (`ProfileAllocator.isAuthenticated` checks `Cookies`/`Network/Cookies`), not the `Account` DB row.

### CDP Connection Gotchas (Provider-Specific)

- **Gemini** uses Quill-based `div.ql-editor[contenteditable="true"]` composer. Send requires clicking the send button (Enter doesn't work in Quill). Streaming is custom Google RPC batchexecute format (NOT SSE).
- **ChatGPT** uses `#prompt-textarea` / `textarea[data-testid="prompt-textarea"]`. Streaming is `data: {message: {content: {parts: [text]}}}` with `[DONE]` terminator.
- **Claude** uses `div[contenteditable="true"]` with ProseMirror. Streaming is Anthropic SSE format (`data: {type, delta, content_block_start/stop}`).

## Code Conventions

### TypeScript
- Use `@/*` path aliases (maps to `./src/*`)
- Prefer `type` imports: `import type { Foo } from './bar.js'`
- Use `.js` extension in imports (Bun ESM requirement)
- No `any` — use `unknown` + type narrowing
- Use Zod for runtime validation at boundaries
- Prefer `const` over `let`, avoid `var`
- Use ULID for IDs (`src/ids.ts`)
- Export from `src/index.ts` as barrel

### Error Handling
- Custom error classes from `src/errors.ts`
- Never swallow errors silently
- Use `Result<T, E>` pattern where appropriate
- Log errors with context before throwing

### Database
- All schema in Prisma (`prisma/schema.prisma`)
- Migrations via `bunx prisma migrate dev`
- Seeds in `seeds/` directory
- Use transactions for multi-table writes
- Never bypass Prisma for raw SQL unless performance-critical

### Typecheck guardrail (CRITICAL)
- **NEVER run `tsc` / `bunx tsc --noEmit` / `bun run typecheck` unless the human explicitly directs it.**
- Only run a typecheck when the full task list / todos are complete AND you have asked the human first.
- Mid-task typechecking is wasteful (the project has many pre-existing errors in `tests/` owned by other agents). Build the feature first; verify at the human's request.

### Testing
- Unit tests: `tests/unit/` — test individual functions
- Integration tests: `tests/integration/` — test engine interactions with mocked stores
- E2E tests: `tests/e2e/` — full stack tests
- Mock store contracts for unit/isolation tests
- Aim for 80%+ coverage on engines

### File Organization
```
src/
  cli/          # CLI entry points
  config.ts     # Configuration
  engines/      # Core engines (one file per engine)
  errors.ts     # Custom error classes
  ids.ts        # ID generation (ULID)
  index.ts      # Public barrel exports
  schema/       # Zod schemas
  server/       # HTTP server / API routes
  storage/      # Database access layer (Prisma wrappers)
tests/
  unit/         # Unit tests
  integration/  # Integration tests
  e2e/          # End-to-end tests
  helpers/      # Test utilities
seeds/          # Database seed files
```

## When Implementing Engines

1. Read the engine spec from `docs/merged-design-v2/04-merged-engines.md` or `05-merged-lifecycles.md`
2. Define TypeScript interface first (match spec exactly)
3. Define Store Contract (what the engine needs from storage)
4. Implement with proper error handling
5. Write unit tests with mocked store contract
6. Write integration tests for engine-to-engine interactions

## Invariants (Boundary Conditions)

**Full document:** `docs/roadmap/INVARIANTS.md`

Non-negotiable constraints enforced by `bun run devops invariants check`.

### Critical Boundaries (Never Violate)

1. **Governor Canon:** Only `ChromeGovernor` touches CDP. No engine imports `BunCdpClient`.
2. **Store Contracts:** Engines depend on `src/storage/contracts/*.ts`, never `src/storage/impl/*.ts`.
3. **Research-First:** No implementation without research report classification.
4. **Phase Gates:** Phase N requires phase N-1 complete.
5. **DB-Only Parser Logic:** `StreamParserEngine` loads parser logic **only** from DB (`parser_logic_code` with `logic_type=inline`). File-based parsers are rejected unless `allowFileLogic` is explicitly enabled. All seeded parsers live in `seeds/parsers/harvested/*.ts` as `LOGIC_CODE` strings and are upserted into DB via `seeds/parsers/harvest.seed.ts`.

### Harness Command Registry (Completed — spec 017)

Browser-free schema repair pipeline with declarative harness commands.

**Engines:**
- `src/engines/harness-command-registry.ts` — semver version resolution, required-field validation
- `src/engines/harness-repair-engine.ts` — Zod schema repair with alias remapping, code-fence strip, trailing-comma fix, apostrophe-safe quote balancing
- `src/engines/harness-feedback-coordinator.ts` — escalating retry prompts with exponential backoff + diff (never repeats same prompt)

**Prisma models:**
- `HarnessCommand` — versioned command definitions with JSON schema (seeded from `seeds/harness/commands.json`)
- `RepairSession` — audit trail for LLM payload repairs

**Storage contracts:**
- `GovernorStore` — `getHarnessCommand`, `listHarnessCommands`, `upsertHarnessCommand`, `getProviderFleetConfig`
- `HarnessRepairStore` — `createRepairSession`, `findRepairSessionsByConversation`

**Repair metadata side-table:** `src/schema/repair-metadata.ts` — `registerRepair`/`getRepairMetadata` with `repairString`/`repairNumber`/`repairBoolean` helpers. Never monkey-patches Zod prototypes.

**Seeding:** `seeds/harness/commands.seed.ts` → `seedHarnessCommands()` called in `src/engines/capability-bootstrap.ts` at boot.

**Key rules:**
- String schemas passthrough (never rewrite interior apostrophes)
- Zod 3.23+ `_def.shape()` is a function — call it
- Field-level `repairString({aliases})` for alias remapping (not top-level `registerRepair`)

### Parser System (Completed — features 019 + 020)

DB-only parser execution with real fallback chains. Parsers never live in engine code — they are DB rows executed via `SandboxRunner`.

**Engines:**
- `src/engines/stream-parser.ts` — `StreamParserEngine` loads inline `logic_code` from DB, resolves via `fallbackParserId` chain; `SandboxRunner` preferred (legacy `new Function` fallback only)
- `src/engines/stream-align.ts` — `StreamAlignmentEngine` (`computeParserHash`, version resolution)
- `src/engines/provider-registrar.ts` — 2-pass `fallbackParserId` wiring at seed time

**Seed parsers (`seeds/parsers/harvested/`):**
| Parser | Provider | Format |
|--------|----------|--------|
| `claude-streaming-sse` | Claude | SSE `content_block_delta` |
| `chatgpt-openai-delta` | ChatGPT | `choices[].delta.content` + patches + parts |
| `gemini-batchexecute` | Gemini | XSSI `decodeEnvelope` + `parseStreamChunk` |
| `google-ai-studio` | Gemini | `candidates[].content.parts[].text` |
| `generic-format-agnostic` | generic | SSE/JSON/array best-effort |
| `system-raw-text` | system | Last-resort raw text (never throws) |

**Fallback chain:** `provider/001` → `generic/001` → `system/001`. Wired by `seeds/parsers/harvest.seed.ts` via 2-pass upsert (`ProviderStore.upsertParser` + `setParserFallback`).

**Provider manifests (`seeds/providers/*.json`):** Each provider declares `fallback` (parser name of the next tier). `ProviderRegistrar` reads this during registration and builds the `fallbackParserId` chain.

**Inline `logic_code` contract:**
```
function(module, exports) {
  exports.default = {
    name, version, providerId,
    parse(rawBody) -> ContentBlock[],
    detectCompletion(rawBody) -> boolean,
    getConfidence(rawBody) -> number
  }
}
```
`ContentBlock` shape: `{type:'text',text}`, `{type:'reasoning',text}`, `{type:'tool-call',...}`, `{type:'file',url,mediaType}`, `{type:'meta',key,value}`.

**Boot snapshot (`CapabilitySnapshot`):** Loaded once at boot from `CapabilityBinding` rows for registered providers. `ChromeGovernor.executeSnapshotProgram` iterates `recipe.steps[]` (multi-step) via `browserHarness.runAction`.

**Storage contracts:**
- `ParserStore` — `getParserByProviderAndVersion`, `getParserById`, `getActiveParser`, `getParser`, `getGenericParser`, `getSystemFallbackParser`, `upsertParser`, `listParsers`, `getParserByFile`, `getParserByHash`
- `ParserExecutionLogStore` — `logExecution`, `getRecentByProvider`, `getLowConfidenceEntries`, `getStatsByProvider`
- `ContentUnitStore` — `upsertContentUnits`, `getByMessageId`, `getByType`, `getByConversationId`, `getStats`
- `ProviderStore` — `upsertParser`, `listParsers`
- `CapabilityStore` — `loadSnapshot` (active bindings for registered providers)

**Tests:** `tests/unit/engines/harvested-parser.test.ts` (format correctness), `tests/unit/engines/stream-parser.test.ts` (fallback chain), `tests/unit/engines/capability-snapshot.test.ts` (boot snapshot).

### Harness Executor (DB-Driven Protocol)

The harness executor (`src/engines/harness/harness-executor-engine.ts`) uses `StreamParserEngine.parse()` — NOT `captureAndStore()` — to parse provider responses through the full parser chain with fallback support. Block metadata (`parserName`, `confidence`, `wireFormat`) is persisted as `blockMeta` JSON.

### One Entry Point (v10 Invariant)

Every operation is a `UnifiedCapability`. CLI and frontend are thin NL shells that
call `POST /api/interpret` → `POST /api/capabilities/:id/execute`.

- **New capability?** Register in `registerDefaultCapabilities` / a `*caps.ts` module.
- **New NL phrase?** Add a pattern to `catalog.ts` bound to a `capabilityId`.
- **Never:** hand-write CLI commands, hand-write UI actions, or open a second transport.

#### Adding a Capability

Use Unit 24.1 (registry contract), Unit 24.3 (CLI generation), and Unit 25.1 (catalog binding):

1. Create a capability in `src/engines/*caps.ts` using `makeCapability` or `registerSessionCaps` pattern
2. Register it with `surfaces: ['cli', 'ui', 'api']` to enable all transports
3. Add NL patterns to `src/engines/nlcl/catalog.ts` linking to your capabilityId
4. Add `cliCommand`, `ui`, and `mcpToolName` for cross-surface parity

#### CLI Dispatch (how the thin-client actually routes)

`src/cli/index.ts` is **not** a second transport — it is a thin client to a running
server (default `CAP_STORE_PORT=9420`; this env runs on `9421`). Two layers feed the
in-process `CommandRegistry`:

1. **Bridged capabilities** — `syncCliFromUnified()` copies every `cli`-surface
   capability from the `UnifiedCapabilityRegistry` into `CommandRegistry` (alias-
   collision guard: warns + skips duplicates instead of silent overwrite).
2. **Builtin commands** — `registerBuiltinCommands()` registers `automate` and
   `moments`, which bypass the capability registry and talk to the API directly
   (legacy extension pattern). They are still first-class members of the command
   tree and appear in `help`.

Multi-word commands (`admin db status`) resolve via `CommandRegistry.resolve()`
(longest-prefix match), not single-token `find()`. New builtins go in
`src/cli/commands/builtins.ts` — do NOT hand-write standalone `commands/*.ts`
scripts that bypass the registry.

### Taxonomy Chain Gotchas (CRITICAL)

Lessons from building the taxonomy generation pipeline and cross-surface verification.

1. **UI slot IDs must be namespaced** — The frontend `SLOT_IDS` in `web/ui/src/ui/slots.ts` use `chat.actionBar`, `chat.composer`, `chat.sidebar` (not short names). The taxonomy pipeline's `CATEGORY_POSITIONS` table must use these exact values or `ui_position` silently fails.

2. **Capability nodes may lack `category`** — Shared capability nodes often have no `category` field. When generating `apiEndpoint.path`, derive category from `slug.split('_')[0]` — not `node.category`.

3. **`Bun.spawn` exitCode is null** — `proc.exitCode` returns `null` until `await proc.exited` resolves. Always await the promise before reading exit code.

4. **Single-segment slugs** — `capId` format is `cap:${category}:${action}`. For single-segment slugs (e.g. `help`), use `cap:help:help` — never `cap:undefined:help`.

5. **Verify after taxonomy changes** — Run `bun run devops verify-cross-surface` after any change to taxonomy pipeline, shared pool, or skeleton platforms. It checks CLI (name), API (path), MCP (tool name), UI (slot id).

## Shell Environment (CRITICAL)

**All commands MUST be PowerShell-compatible.** The default shell is PowerShell 7+.

### PS1 Script Invocation (CRITICAL — NEVER GET WRONG)

PS1 scripts use `$PSScriptRoot` to find the project root. This auto-variable is `$null`
when the script is NOT invoked as a direct file — causing ALL downstream paths to collapse.
These scripts start/stop the backend, frontend, and health monitor:

| Script | Purpose |
|--------|---------|
| `scripts/start-all.ps1` | Launch backend + frontend, fully detached |
| `scripts/start-backend.ps1` | Launch backend only |
| `scripts/start-frontend.ps1` | Launch frontend only |
| `scripts/stop-all.ps1` | Stop all services (infallible) |
| `scripts/health-check.ps1` | Continuous health monitoring |

**✅ CORRECT — always use `pwsh scripts/<name>.ps1` from repo root:**
```powershell
# From repo root (C:\0-BlackBoxProject-0\vivim-final):
pwsh scripts/start-all.ps1
pwsh scripts/start-backend.ps1
pwsh scripts/start-frontend.ps1
pwsh scripts/stop-all.ps1
```

**❌ NEVER do any of these (they silently break `$PSScriptRoot`):**
```powershell
Get-Content scripts/start-all.ps1 | pwsh -            # inline pipe → $null
pwsh -c "scripts/start-all.ps1"                       # -c string → $null
pwsh -Command ".\scripts\start-all.ps1"               # -Command → $null
& "scripts/start-all.ps1"                              # call-operator → $null
Start-Process pwsh -ArgumentList "scripts\start-all.ps1"  # nested pwsh → path broken
pwsh -File scripts/start-all.ps1                      # -File from wrong CWD → path wrong
```

### PowerShell Command Patterns
```powershell
# Navigate to project root
Set-Location "C:\0-BlackBoxProject-0\vivim-final"

# Run typecheck with output capture
bun run typecheck 2>&1 | Select-Object -First 50

# List engine files
Get-ChildItem -Path src/engines -Recurse -Filter *.ts

# Search for TODOs in codebase
Get-ChildItem -Path src -Recurse -Filter *.ts | Select-String -Pattern "TODO"
```

### PowerShell Object-Pipeline Read Bug (CRITICAL — NEVER GET WRONG)

**`Invoke-RestMethod | Select-Object -ExpandProperty <x> | Out-File` produces EMPTY
files / empty output even when the API returns data.** This has silently broken
multiple dev loops: the agent "reads" a capability list, gets nothing, and reports
a false empty state ("no capabilities", "DB read issue"). The PowerShell object
pipeline drops the deserialized JSON payload before it reaches `Out-File`/`Get-Content`.

**✅ ALWAYS read API/JSON data through a BUN SCRIPT, never the PowerShell object pipeline:**
```powershell
# WRONG — silently yields empty output (DO NOT USE):
$port = Get-Content .runtime/backend.port
Invoke-RestMethod "http://localhost:$port/api/capabilities?surface=cli" |
  Select-Object -ExpandProperty slug | Out-File -Encoding utf8 .runtime/caps.txt
Get-Content .runtime/caps.txt          # -> EMPTY, even though 93 caps exist

# CORRECT — write a .ts file and bun run it (reliable parse + write):
#   .runtime/list-caps.ts:
#     const port = (await Bun.file('.runtime/backend.port').text()).trim()
#     const r = await fetch(`http://localhost:${port}/api/capabilities?surface=cli`)
#     const j = await r.json()
#     console.log('TOTAL', (j.capabilities ?? []).length)
#     for (const c of (j.capabilities ?? [])) console.log(c.slug)
bun run .runtime/list-caps.ts
```

Similarly, never pipe `ConvertFrom-Json | Select-Object -ExpandProperty ... | Out-File`
for the same reason. If you must inspect JSON in PowerShell, pretty-print with
`ConvertTo-Json -Depth 6 | Out-File` is also unreliable — prefer bun. Rule of thumb:
**any structured data read/write goes through a bun script in `.runtime/`, not
PowerShell's `Select-Object`/`Out-File` pipeline.**

## Testing Protocol

- Run `bun test` before every commit
- Run `bun run typecheck` to catch type errors
- Run `bun run lint` to catch style issues
- Run `bun run devops audit-code [surface|standard|deep|full]` for a source-code audit (P0–P3 findings + fix instructions); `audit-code fix <id> [--apply]` applies auto-fixable ones
- Run `bun run devops verify-cross-surface` after any taxonomy chain change (verifies every capability resolves across CLI/API/MCP/UI)
- Use `bun test tests/unit/engines/[engine-name]` for targeted testing
- Integration tests should use in-memory or test database
- **ALWAYS** use PowerShell-compatible commands

## Git Conventions

- Conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`
- One logical change per commit
- Reference engine names in commits: `feat(CapabilityEngine): add selector resolution`

## MCP Servers

- **Playwright** — browser automation for E2E testing and UI validation

---

**For devops workflow, atomic task tracking, and implementation protocols:** Load the relevant skills from `.opencode/skill/`.

## Skill Management

- **Source of truth:** `.opencode/skill/` (23 project skills)
- **Sync to kilocode:** `pwsh scripts/sync-skills.ps1`
- **Global skills:** `~/.agents/skills/` (171) + `~/.claude/skills/` (94)
- **Adding new skills:** Create in `.opencode/skill/`, run sync, test
- **Audit:** `docs/audits/SKILL-DEVOPS-AUDIT-2026-07-19.md`
- **Architecture:** `docs/skill-architecture.md`

## Available Skills

### Core DevOps
- **devops** — Autonomous DevOps orchestrator (127 atomic units)
- **devops-fullstack** — LLM-driven full-stack dev loop
- **devops-db** — Database architecture & schema governance
- **devops-generators** — Taxonomy generation pipeline (4-round)
- **devops-research** — Research-first intelligence layer
- **devops-roadmap** — Research-first roadmap system
- **feature-governance** — Feature registry, lifecycle, skill mapping, health dashboard
- **agentic** — Limited-context agentic dev loop

#### DevOps Loop Commands (atomic unit pipeline)
The `devops` CLI drives the atomic-unit tracker (`docs/atomic-v3-fork-canon/01-tracker.md`):
```bash
bun run devops select                 # next implementable unit as JSON
bun run devops mark <id> <state>      # pending|in_progress|done|blocked
bun run devops mark <id> done "<msg>" # SINGLE-PASS: mark done + PROGRESS.md audit line + ONE git commit
bun run devops gate [--strict]        # quality gate, exit non-zero on fail
bun run devops parallelize --max 4 [--dry-run] [--tracker <path>]  # fan out N units to isolated subagents
bun run devops context                # durable task-state snapshot (resume after compaction)
bun run devops audit <id> "<notes>"   # append PROGRESS.md line w/ resolved sha (post-commit)
```
**Single-pass commit rule:** always use `devops mark <id> done "<msg>"` — it transitions state,
appends the PROGRESS.md audit line with the real resolved sha, and folds everything into ONE git
commit (no `[PENDING-COMMIT]` placeholder, no second commit). Engines should `import { getLogger }`
from `src/lib/logger.ts` (pino) instead of `console.*`; set `OTEL_EXPORTER_OTLP_ENDPOINT` to
forward logs via `src/engines/otel-sink.ts`.

### Implementation
- **vivim-build** — Engine implementation workflow (13-engine architecture)
- **vivim-runtime** — Agent-as-runtime dev loop
- **vivi-frontend** — Hot-swappable frontend skill

### Quality
- **vivim-testing** — Testing patterns & workflows
- **source-audit** — P0-P3 source-code audit (4 depth tiers)
- **arch-audit** — Architecture audit (cycles, layering, coupling)
- **provider-testing** — 8-phase provider onboarding
- **db-agent** — Oracle-vision database agent
- **prisma-workflow** — Prisma ORM patterns

### Debugging
- **diagnose** — Structured diagnosis loop (reproduce → fix)
- **systematic-debugging** — Bug/test failure debugging workflow

### Development Workflow
- **tdd** — Test-driven development (red-green-refactor)
- **review** — Two-axis code review (standards + spec)
- **verification-before-completion** — Pre-ship verification gate
- **handoff** — Session handoff for continuity
- **visual-explainer** — HTML diagram generation

## Memory Plugin (Compaction Survival)

Plugin `opencode-agent-memory` gives you 3 tools that survive all compactions:
- `memory_list` — list available memory blocks
- `memory_set` — store/update a memory block (full overwrite)
- `memory_replace` — update a substring within a block

**Project block** at `.opencode/memory/project.md` is injected into system prompt on every request. Use `memory_set` to store files you've read and key intel — it persists across compaction. Blocks default to 5000 char limit.

Regenerate `.opencode/memory/project.md` from real project data at any time:
```bash
bun run devops seed-memory
```
This reads package.json, Prisma schema, provider manifests, and test counts to produce an accurate snapshot. Run early in a session to maximize context survival after compaction.

## vivim-runtime — Agentic Dev Loop

Agent becomes the runtime of its own dev loop. Every command exits bounded, returns structured JSON, never hangs.

```bash
# Full loop (default 5 cycles, autonomous)
bun run devops runtime-test

# Custom
bun run devops runtime-test loop --max-cycles=3 --mitm

# Individual
bun run devops runtime-test preflight
bun run devops runtime-test discover-backend
bun run devops runtime-test test --nl "list conversations"
```

**Modes:** autonomous (full loop) | mitm (pauses after debug for agent decision)

**Agent-safety:** 15s bootstrap timeout, 5s per fetch, 2min overall cap, fast-port if server alive.

**Skill source:** `.kilo/skills/vivim-runtime/SKILL.md` (devops dir, source of truth)
**Harness copy:** `.opencode/skill/vivim-runtime/SKILL.md` (generated from source)

## Node-Layer v2 (Universal Node DB — completed)

Full documentation: `docs/node-layer-v2/`.

### What was built
- **ACU-proven fields** on `Node` model (`contentHash`, `version`, `state`, `securityLevel`, `contentType`, `authorDid`, `signature`, `acl`, `quality`, `validFrom`/`validUntil`, `parentVersion`)
- **NodeVersion** — time-travel version chain (every mutation recorded, `getNodeAtVersion`/`getNodeHistory`)
- **NodeAlias** — entity alias→canonical resolution (`registerAlias`/`resolveAlias`)
- **NodeEdge.weight** — edge weight/confidence
- **Typed data shapes** for 8 additional types: Memory (+FSRS-6), Acu, Notebook, Note, Bookmark, Artifact, Document, Email — registered as `cap-store.*` schemas
- **`captureAsNode()`** in ConversationManager — auto-captures every message as a Node with fork-linking (assistant→user via `responds_to` edge)
- **`recordMemory()`** in MemoryEngine — emits `cap-store.memory` Nodes with FSRS-6 initial state
- **`rebuildGraphFromNodes()`** — re-materializes edges from source (ADR-001)

### Key contract
Engines depend on `NodeStoreContract` (never `NodeStoreImpl` directly). Located at `src/storage/contracts/node-store.ts` — implements Store Contracts invariant.

### Fixture DB
After any Prisma schema change, rebuild test fixture:
```bash
DATABASE_URL="file:./tests/fixtures/node-store-test.db" bunx prisma db push --skip-generate --accept-data-loss
```

### Migration history
- `20260718022736_universal_node_layer` — base Node + NodeEdge
- `20260718041000_node_layer_v2` — ACU fields + NodeVersion + NodeAlias + NodeEdge.weight