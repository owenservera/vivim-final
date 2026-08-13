# part-1-architecture-and-dependencies.md

> vivim-final context pack — architecture spec (read first), project instructions, exact dependency manifests, runtime config, error hierarchy, domain types

## context-pack/CODE_SPEC.md

# CODE_SPEC — vivim-final (context-pack edition)

Spec for an AI to regenerate or extend this codebase. Compiled from the live
sources in this pack; if a file in this pack disagrees with this spec, the
file wins.

## 1. Stack

| Layer    | Tech | Evidence |
|----------|------|----------|
| Runtime  | Bun (Windows host) | `package.json` |
| Language | TypeScript strict, ESNext, `.js` import extensions (Bun ESM), `@/*` → `./src/*` | AGENTS.md |
| ORM      | Prisma v6.5, SQLite via `bunx prisma db push` (DDL only, no `_prisma_migrations`) | AGENTS.md |
| API      | Native Bun HTTP server on port 9420 (dev env: 9421), WebSocket `/ws` | AGENTS.md |
| Frontend | Next.js 16 App Router + React 19 + Tailwind 4, port 3000 | `frontend/package.json` |
| Desktop  | Tauri v2, NSIS installer, Rust sidecar (bun-compiled exe, UPX L3) | `src-tauri/Cargo.toml` |
| Testing  | Bun test runner (`bun test`), Biome lint, tsup build | `package.json` |

## 2. Data model (prisma/schema.prisma)

Full schema in the pack (162 KB). Shape highlights:

- **Provider graph (L0-L1):** `Provider`, `ProviderType`, `ProviderEndpoint`, `ProviderModel`, `Parser`, `ParserFallback`, `ParserExecutionLog`, `StreamConfig`.
- **Capability system (L2-L3):** `Capability`, `CapabilityBinding`, `CapabilityRecipe`, `CapabilityProgram`, `CapabilitySnapshot`, `UnifiedCapability`, `HarnessCommand`, `RepairSession`.
- **Session/state (L4):** `Conversation`, `Message`, `ContentBlock`, `ContentUnit`, `StreamBlock`, `StreamChunk`, `Node`, `NodeVersion`, `NodeAlias`, `NodeEdge` (knowledge graph).
- **Knowledge:** `Memory`, `KnowledgeItem`, `Entity`, `EntityFact`, `Decision`, `ContextAssembly`.
- **Fleet/desktop:** `ChromeSlave`, `Account`, `FleetConfig`, `Profile`, `GovernorEvent`.
- **Cross-cutting:** `ConfigItem`, `EventLog`, `Telemetry`, `RegistrationAudit`, `SchemaMeta`, `VersionInfo`, `Workspace`.

Conventions: ULID ids (`src/ids.ts`), `@updatedAt` timestamps, JSON columns via
Prisma `Json` type, `logic_code` inline parser bodies as TEXT.

## 3. Runtime layers (13 engines)

```
L0-L1  Provider Knowledge Graph  ProviderRegistrar, ProviderHealthKernel
L2-L3  Capability System         CapabilityResolutionEngine, CapabilityEngine
L4     Session & State           ConversationManager, StreamBlockStore
Chrome ChromeGovernor            CDP proxy, lifecycle, trace, health
X-Cut  CapabilityEventBus, ConfigManager, StreamParserEngine
Life   RegistrationAuditor, VersionManager, TelemetryAggregator
```

One entry point: every operation is a `UnifiedCapability`. CLI + frontend are
thin NL shells. New capability → register in a `*caps.ts` module with
`surfaces: ['cli','ui','api']`, add NL patterns to `catalog.ts`, add
`cliCommand`/`ui`/`mcpToolName` for cross-surface parity.

## 4. Stream parser contract (DB-driven)

Parsers never live in engine code. They are DB rows
(`Parser.logic_code`, `logic_type=inline`) executed via `SandboxRunner`
(legacy `new Function` fallback). Boot wiring: `StreamParserEngine` loads the
active parser for a provider, resolves the `fallbackParserId` chain
(`provider/001` → `generic/001` → `system/001`), and parses raw wire bytes
into `ContentBlock[]`.

Inline `logic_code` module contract (see `chatgpt-openai-delta.ts`):

```js
// function(module, exports) { ... }
module.exports.default = {
  name: '<provider>/001_<format>', version: 1, providerId: '<slug>',
  parse(rawBody)        -> ContentBlock[] | {type:'text',text} | ...
  detectCompletion(rawBody) -> boolean
  getConfidence(rawBody)    -> number (0..1)
}
```

`ContentBlock` variants: `{type:'text',text}` | `{type:'reasoning',text}` |
`{type:'tool-call',toolCallId,toolName,input}` |
`{type:'file',url,mediaType,filename}` | `{type:'meta',key,value}`.

7 harvested parsers in the pack (one per provider/wire format):
`claude-streaming-sse`, `chatgpt-openai-delta`, `gemini-batchexecute`,
`google-ai-studio`, `deepseek-reasoning-sse`, `generic-format-agnostic`,
`system-raw-text`. Each declares confidence + completion detection;
`ChatGPT` handles OpenAI `choices[].delta.content`, `o:'patch'` / `o:'add'`
parts, `[DONE]`, tool calls, images (`asset_pointer`).

`StreamAlignmentEngine` (`stream-align.ts`) computes parser hashes for
version resolution; `ProviderRegistrar` does a 2-pass
`fallbackParserId` wiring at seed time from `seeds/providers/manifests.ts`.

## 5. Embedding / vector search stack

`SemanticSearchEngine` (`src/engines/semantic-search.ts`):

```
interface EmbeddingProvider {
  name: string; dimensions: number
  embed(text: string): Promise<number[]>
  embedBatch(texts: string[]): Promise<number[][]>
}
interface SearchQuery { text: string; limit?: number; entityType?: string;
                        minScore?: number; useHybrid?: boolean }
interface SearchResult { type: 'conversation'|'message'|'fact'|'entity'|'decision';
                         id: string; score: number; snippet?: string }
class SemanticSearchEngine {
  index(text, entityType, entityId): Promise<void>
  indexBatch(items): Promise<...>
  search(query): Promise<SearchResult[]>
  searchHybrid(query): Promise<SearchResult[]>   // sparse + dense fused
  reindexAll(): Promise<{indexed, skipped, errors}>
  getStats(): Promise<{totalEmbeddings}>
}
```

Providers (all implement `EmbeddingProvider`):
- `OllamaEmbeddingProvider` — `nomic-embed-text` (768-d), `POST /api/embeddings`, 120 s abort timeout, graceful fail.
- `MiniLMEmbeddingProvider` (`embedding-minilm.ts`) — real non-zero dense vectors with cosine structure, no external service.
- `HuggingFaceEmbeddingProvider` (`embedding-hf.ts`).
- `EmbeddingClassifier` (`embedding-classifier.ts`) — classify text by cosine similarity to category anchor embeddings.

Hybrid retrieval (`nlcl/semantic-resolver.ts`): sparse TF-IDF cosine
(high precision) + dense MiniLM cosine (high recall); sparse threshold 0.60+
gates contribution, dense lower. Pure-TS TF-IDF + cosine in `nlcl/tfidf.ts`
(zero deps).

## 6. Store contracts (src/storage/contracts/)

Engines depend on these contracts, never `impl/*`. 56 contracts, notable:
`NodeStoreContract`, `ParserStore`, `ParserExecutionLogStore`,
`ContentUnitStore`, `ProviderStore`, `CapabilityStore` (`loadSnapshot`),
`GovernorStore`, `ConversationStore`, `MemoryStore`, `SemanticSearchStore`,
`KernelStore`. Parser/execution logging flows are fully contracted.

## 7. Key behaviors / gotchas

- **CDP:** only `ChromeGovernor`; `BunCdpClient` is private. Gemini = Quill
  `div.ql-editor[contenteditable="true"]` + send-button click (Enter broken),
  custom batchexecute RPC (not SSE). ChatGPT = `#prompt-textarea`, `[DONE]`.
  Claude = ProseMirror `div[contenteditable]`, Anthropic SSE
  `content_block_delta`.
- **Profiles:** `chrome-profiles/<slug>/<account>/` is canonical; cookies file
  = auth truth; `ProfileAllocator` singleton per (provider, account).
- **No `tsc` mid-task** (pre-existing errors in `tests/` owned elsewhere);
  verify at human request only.
- **PowerShell trap:** never read JSON through `Invoke-RestMethod |
  Select-Object -ExpandProperty x | Out-File` — empty output; read via bun script.
- **Bun.spawn:** `proc.exitCode` is `null` until `await proc.exited`.
- **Smoke tests:** wrap fetches in `AbortController` + timeout (send endpoints
  block on unattached CDP browser).

## AGENTS.md

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

Design docs are in `docs/` (fresh set: `docs/README.md` map, `docs/architecture/`,
`docs/runbooks/`, `docs/decisions/`). The old `docs/merged-design-v2/` set is
archived in `.archive/`.

## Binary Size Optimization (CRITICAL)

### Bun Runtime Baseline
- **Bun runtime on Windows:** ~94 MB (irreducible via bundling alone)
- **Our app code:** ~3 MB on top of runtime
- **Total uncompressed:** ~97 MB
- **WASM engines:** NOT embedded by `bun build --compile` (loaded at runtime via `process.dlopen()`)
- **Prisma WASM:** Uses native library mode (`LibraryEngine`), not WASM base64

### UPX Compression (Implemented)
- **Tool:** UPX v5.2.0 (`winget install UPX.UPX`)
- **Optimal settings:** Level 3 with `--no-lzma` for speed/ratio balance
- **Results:**
  - Level 1: 46.4 MB (47.81% ratio, 13.5 seconds)
  - Level 3: 45.6 MB (46.94% ratio, 24.8 seconds) ← **Production default**
  - Level 5: 35.5 MB (36.58% ratio, 68.8 seconds)
- **All compressed binaries verified working** (`--version` returns `1.3.14`)

### Build Pipeline
```bash
# Full desktop build (sidecar + frontend static export + cargo tauri NSIS installer)
pwsh scripts/tauri/build.ps1

# Sidecar-only build (bun compile + UPX level 3 compression)
pwsh scripts/tauri/build-sidecar.ps1

# Manual UPX compression (if needed)
upx -3 --no-lzma src-tauri/binaries/vivim-server-x86_64-pc-windows-msvc.exe
```

### Future Optimizations
- **Bun v1.4.0 (Rust rewrite):** ~20% binary size reduction (76 MB vs 94 MB) — available in canary
- **bkg (Bun Packager):** LZ4 compression with custom runtime decompression
- **NSIS installer:** LZMA compression for installer packaging

## Desktop Build Testing (CRITICAL)

> **When working on Tauri builds, NSIS installers, or desktop packaging — use the devops/desktop toolkit first.** The `devops/desktop/` toolkit (driven by `bun run devops desktop-loop <action>`) provides a 15-action CLI with hash-gated rebuild detection, a 5-gate orchestrator (Build → Install → Launch+Render → Capture → Report), and structured diagnostics.
>
> **Quick start:** `bun run devops desktop-loop run --version <x.y.z>` runs the full 5-gate pipeline end-to-end. For individual checks, use granular actions (`status`, `build`, `install`, `kill`, `launch`, `test smoke`, etc.). All artifacts are stored in `dist/debug/<version>/cycle-N/`.
>
> **Core workflow:** The toolkit wraps the raw Tauri build scripts (`scripts/tauri/build.ps1`, `build-sidecar.ps1`) with verification, process management, port-owner checks, screenshot capture, and structured reporting. It does NOT replace the build scripts — it orchestrates them and validates the *installed* binary.
>
> **Hash-gated rebuilds:** `build.ts` fingerprints source directories (`src/`, `src-tauri/src/`, `frontend/src/`) using sorted mtime+size SHA-256 hashes, version-scoped per stage (`sidecar`, `tauri-rust`, `tauri-frontend`). Unchanged stages skip rebuilds. Cache lives in `dist/build-hashes.json`.
>
> **Test batteries:** `test smoke` (process → readyz → window → screenshot → probe) is the fastest CI gate. `test boot` kills+relaunches fresh. `test http` probes `/readyz`, `/health`, `/api/openapi.json`. `test window` checks window + screenshot. `test process` checks window info. `test all` runs everything.
>
> **Version management:** `scripts/tauri/version.ts` is the single source of truth — reads/writes `tauri.conf.json` + `Cargo.toml` + derives exe metadata at compile time. Always pass `--version` to scope state correctly.

### Desktop DevOps CLI

Full 15-action toolkit at `devops/desktop/` driven by `bun run devops desktop-loop <action>`.

| Action | What It Does | Key Flags |
|--------|-------------|-----------|
| `status` | Check installed exe, processes, port owner, registry key | `--version` |
| `build` | Hash-gated check: sidecar/tauri/frontend changed → skip if unchanged | `--version` (required) |
| `install` | Kill stale → uninstall prior → install NSIS silently (`/S`) | `--version` (required) |
| `uninstall` | Kill stale → uninstall via NSIS QuietUninstallString | |
| `kill` | Kill vivim-desktop.exe + vivim-server.exe | |
| `launch` | Start installed exe → poll /readyz with owner PID verification → wait for window | `--port`, `--timeout`, `--wait-window` |
| `readyz` | Poll /readyz, verify owner PID matches launched process | `--port`, `--timeout` |
| `probe` | HTTP probe a specific path (default `/readyz`) | `--expect`, `--contains`, `--method`, `--body` |
| `screenshot` | Focus window → capture full-screen → assert non-blank via ImageMagick | `--out`, `--focus`, `--verify` |
| `window` | Get window title/handle/responding for vivim-desktop + vivim-server | |
| `process` | Port owner PID + window info for both processes | |
| `logs` | Tail vivim-server.log + vivim-supervisor.log from `%LOCALAPPDATA%\vivim\` | `--tail` |
| `test <battery>` | Run test batteries: smoke, boot, http, window, process, all | battery (positional) |
| `report` | Generate markdown report from last gate cycle | `--version` |
| `reset` | Clear ledger + runtime state | |

### Gate Orchestrator (`run` action)

`bun run devops desktop-loop run --version <x.y.z>` runs a 5-gate pipeline:

```
G1 Build → G2 Install → G3 Launch+Render → G4 Capture (on fail) → G5 Report
```

- **G1 Build:** Hash-gated sidecar + tauri rebuilds. Fingerprints `src/`, `src-tauri/src/`, `frontend/src/` by sorted mtime+size; version-scoped cache at `dist/build-hashes.json`. Skips stages with no changes.
- **G2 Install:** Kill stale processes → uninstall prior via NSIS QuietUninstallString → install with `installer /S`.
- **G3 Launch+Render:** Launch installed exe → poll `/readyz` with owner-PID verification (kills stale servers) → screenshot → `assertNonBlank` via ImageMagick.
- **G4 Capture:** On failure, copy `vivim-server.log` + `vivim-supervisor.log` from `%LOCALAPPDATA%\vivim\` into cycle dir.
- **G5 Report:** Write `report.json` + `report.md` to cycle dir; on success, stage installer to `dist/debug/<version>/`.

**Artifacts:** All cycle outputs go to `dist/debug/<version>/cycle-N/` (`.log` files, screenshots, `report.json`, `report.md`, copied logs).

### Key Files

| File | Purpose |
|------|---------|
| `devops/desktop/index.ts` | CLI entry + 5-gate orchestrator (`runDesktopLoop`). Gates: G1 Build → G2 Install → G3 Launch+Render → G4 Capture (on fail) → G5 Report. |
| `devops/desktop/cli.ts` | Arg parsing (`parseArgs`), action dispatch (`dispatchAction`), per-invocation log tee (`teeConsoleToLog`). All actions return `ActionResult`. |
| `devops/desktop/actions.ts` | 15 action handlers: `status`, `build`, `install`, `uninstall`, `kill`, `launch`, `readyz`, `probe`, `screenshot`, `window`, `process`, `logs`, `test` (batteries: smoke, boot, http, window, process, all), `report`, `reset`. |
| `devops/desktop/spawn.ts` | Streaming output capture (`spawnStreaming`), process management (`killVivimProcesses`, `launchInstalled`), NSIS install/uninstall helpers (`installNsis`, `uninstallNsis`, `getUninstallRegistryKey`). |
| `devops/desktop/verify.ts` | Pure decision logic (`parseNetstat`, `assessReady`, `checkNonBlank`) + PowerShell wrappers (`ownerPidForPort`, `scanPortForPid`, `pollReady`, `windowInfo`, `focusWindow`, `captureScreenshot`, `assertNonBlank`). |
| `devops/desktop/build.ts` | Hash-gated rebuilds (`needsBuild`, `markBuilt`, `dirFingerprint`). Fingerprint = sorted mtime+size SHA-256 over source files. Cache at `dist/build-hashes.json`, version-scoped per stage. |
| `devops/desktop/state.ts` | Ledger (cycle history at `dist/loop-state.json`) + runtime (per-install state at `dist/desktop-runtime.json`). `DesktopRuntime` stores port/PID/readyMs as defaults for granular actions. |
| `scripts/tauri/version.ts` | Single source of truth for desktop version — reads/writes `tauri.conf.json` + `Cargo.toml`. `ensureDesktopVersion(v)` bumps stored copies. `nsisPathFor(v)` derives installer path. |
| `scripts/tauri/compile-sidecar.ts` | Sidecar compilation with UPX compression (Level 3, `--no-lzma`). |
| `scripts/tauri/prepare-frontend.ts` | Next.js build + `out/` generation for Tauri (patches `next.config.mjs` to `output: 'export'`, builds, restores). |

### Tauri V2 Build Config (Post-Upgrade)

The Tauri V2 upgrade removed `tauri-plugin-updater` and WIX/MSi targets entirely.
The current `src-tauri/tauri.conf.json` uses:
- `"targets": ["nsis"]` (NSIS only, no WIX)
- `"createUpdaterArtifacts": false` (no updater artifacts)
- `"plugins": { "shell": { "open": true } }` (no updater plugin)
- `"visible": false` in the window config (window shows on `backend-ready` event)
- CSP includes `'unsafe-eval'` and `'unsafe-inline'` for static JS

### Debugging App Crashes

1. **Run from command line** to capture stderr:
   ```powershell
   & "$env:LOCALAPPDATA\vivim\vivim-desktop.exe" 2>&1
   ```
2. **Check logs** at `%LOCALAPPDATA%\vivim\`:
   - `vivim-supervisor.log` — sidecar spawn/restart events
   - `vivim-server.log` — server boot/port/errors
3. **Use desktop-loop actions** for structured diagnostics:
   ```bash
   bun run devops desktop-loop status     # installed state
   bun run devops desktop-loop logs       # tail app logs
   bun run devops desktop-loop screenshot  # capture window
   bun run devops desktop-loop test smoke  # full smoke battery
   ```

### Desktop Debug Gotchas

#### PowerShell Object-Pipeline Read Bug (CRITICAL)
**`Invoke-RestMethod | Select-Object -ExpandProperty <x> | Out-File` produces EMPTY files / empty output even when the API returns data.** The PowerShell object pipeline drops the deserialized JSON payload before it reaches `Out-File`/`Get-Content`.

**ALWAYS read API/JSON data through a BUN SCRIPT, never through the PowerShell object pipeline:**
```bash
# WRONG — silently yields empty output:
Invoke-RestMethod "http://localhost:$port/api/capabilities?surface=cli" |
  Select-Object -ExpandProperty slug | Out-File -Encoding utf8 file.txt
# CORRECT — write a .ts file and bun run it:
bun run .runtime/list-data.ts   # reads fetch, writes .txt via fs
```

#### `Bun.spawn` exitCode is null
`proc.exitCode` returns `null` until `await proc.exited` resolves. Always await the promise before reading exit code.

#### Smoke tests must have client-side timeouts
Endpoints like `/api/conversations/:id/send` block forever waiting for a CDP browser that isn't attached. Always wrap `fetch` calls with `AbortController` + timeout so the test completes.

### Desktop Dev Workflow Quick Reference

| Task | Command |
|------|---------|
| Full clean build + install + test | `bun run devops desktop-loop run --version <x.y.z>` |
| Check if rebuild needed (no rebuild) | `bun run devops desktop-loop build --version <x.y.z>` |
| Install latest installer silently | `bun run devops desktop-loop install --version <x.y.z>` |
| Launch + verify readyz | `bun run devops desktop-loop launch --version <x.y.z>` |
| Full smoke test (process+window+render) | `bun run devops desktop-loop test smoke` |
| Kill all vivim processes | `bun run devops desktop-loop kill` |
| Tail server+supervisor logs | `bun run devops desktop-loop logs --tail 100` |
| Capture + verify non-blank screenshot | `bun run devops desktop-loop screenshot --verify` |

## Provider System (KNOW THIS FIRST)

### What Providers Exist

The system supports **16 registered providers** (`chatgpt`, `claude`, `deepseek`,
`facebook`, `gemini`, `generic`, `grok`, `mistral`, `opencode`, `qwen`, `slack`,
`studio-ai`, `system`, `telegram`, `whatsapp`, `z-ai`). Of these, **6 are
UI-facing chat providers**: `chatgpt`, `claude`, `gemini`, `deepseek`, `qwen`,
`grok`; the rest are framework/API aliases (`generic`, `system`, `facebook`,
`slack`, `telegram`, `whatsapp`, `studio-ai`, `z-ai`, `opencode`, `mistral`).
Each is seeded from `seeds/providers/manifests.ts` (manifest with endpoints,
parsers, models, capabilities).

### Provider File Layout

| File | Purpose |
|------|---------|
| `seeds/providers/manifests.ts` | Provider manifest definitions (selectors, endpoints, parsers, models) |
| `seeds/parsers/harvested/<slug>-*.ts` | Stream parser `LOGIC_CODE` (inline, DB-driven) |
| `seeds/adapters/<slug>.ts` | Import adapter for external data portability |
| `src/engines/provider-selectors.ts` | CDP selector fallback lists (composer, send button, URL patterns) |
| `src/engines/conversation-manager.ts` | Provider-specific capture patterns + response parsing |

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
| chatgpt | `seeded + registered` | `chatgpt/001_openai_delta` (inline) + generic fallback | `send_message` | parser uses API format; wire uses chat UI format — needs real-world validation |
| deepseek | `seeded + registered` | `deepseek/001_reasoning_sse` (inline) | `send_message` | none (reasoning-channel SSE parser seeded) |
| qwen | `seeded` | none configured | `send_message` | no parser row yet |
| grok | `seeded` | none configured | `send_message` | no parser row yet |

> The 16-provider protocol also includes `facebook`, `mistral`, `opencode`,
> `studio-ai`, `z-ai` etc. See `src/__generated__/provider-protocol.ts` for the full list.

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
- The profile dir is the source of truth for "is this provider authenticated" (`ProfileAllocator.isAuthenticated` checks `Default/Network/Cookies` or `Profile N/Network/Cookies`), not the `Account` DB row.

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
- **Schema changes applied via `bunx prisma db push`** (DDL only — no `_prisma_migrations`; `prisma migrate diff` is authoritative, target is zero drift)
- **Data migrations** (column-value reshaping, backfills) go through the SchemaMeta-backed `MigrationRunner` (`src/storage/migration/`) — wired into boot at `bootstrapSeedsPhase` via `applyPendingMigrations()`. Register new steps in `migrations-registry.ts`. Do NOT add a second migration mechanism.
- Seeds in `seeds/` directory
- Use transactions for multi-table writes
- Never bypass Prisma for raw SQL unless performance-critical
- After any Prisma schema change, rebuild the test fixture: `DATABASE_URL="file:C:/0-BlackBoxProject-0/vivim-final/tests/fixtures/node-store-test.db" bunx prisma db push --skip-generate --accept-data-loss` (use an ABSOLUTE `file:` path — relative ones resolve against `prisma/schema.prisma` and would write to `prisma/tests/fixtures/`)

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

### File Organization (Frontend)
```
frontend/
  src/
    app/          # Next.js App Router (layout, page, api/)
    canvas/       # Canvas live-config
    cli/          # Frontend CLI tools (canvas-scaffold)
    components/   # React components (canvas/, chat/, memory/, ui/)
    engines/      # Frontend engines (canvas, workspace, plugin, rbac, presence, etc.)
    features/     # Feature modules (onboarding, provider-setup-wizard)
    hooks/        # React hooks
    registry/     # CapabilityRegistry
    sdk/          # Frontend SDK
    storage/      # Storage contracts + memory impls
    ui/           # Slot system (slots.ts, registry.ts, context.tsx, defaults/)
    actions/      # ActionRegistry + auto-populate
    api/          # API client
    types/        # TypeScript types
  plugins/        # Plugin system (sample-plugin, demo-plugin)
  tests/          # Frontend tests (unit, integration, e2e)
  prisma/         # Frontend Prisma schema
```

## When Implementing Engines

1. Understand the current architecture from `docs/architecture/OVERVIEW.md` (mental model) and `docs/architecture/ENGINES.md` (each engine, its job, its code path).
2. Define TypeScript interface first (match spec exactly)
3. Define Store Contract (what the engine needs from storage)
4. Implement with proper error handling
5. Write unit tests with mocked store contract
6. Write integration tests for engine-to-engine interactions

## Invariants (Boundary Conditions)

**Full document:** the invariants below are the canonical boundary conditions (the
old `docs/roadmap/INVARIANTS.md` doc was archived with the 2026-08-06 cleanup).

Non-negotiable constraints enforced by `bun run devops invariants check`.

### Critical Boundaries (Never Violate)

1. **Governor Canon:** Only `ChromeGovernor` touches CDP. No engine imports `BunCdpClient`.
2. **Store Contracts:** Engines depend on `src/storage/contracts/*.ts`, never `src/storage/impl/*.ts`.
3. **Research-First:** No implementation without research report classification.
4. **Phase Gates:** Phase N requires phase N-1 complete.
5. **DB-Only Parser Logic:** `StreamParserEngine` loads parser logic **only** from DB (`parser_logic_code` with `logic_type=inline`). File-based parsers are rejected unless `allowFileLogic` is explicitly enabled. All seeded parsers live in `seeds/parsers/harvested/*.ts` as `LOGIC_CODE` strings and are upserted into DB via `seeds/parsers/harvest.seed.ts`.
6. **Chrome Slave Profile = Source of Truth:** Cookie files in profile directory determine "logged in" state — NOT DB loginState row. `isAuthenticated()` checks cookie files.
7. **One Profile Per (Provider, Account):** ProfileAllocator enforces singleton — no duplicate profiles for same provider+account combination.
8. **Lazy Startup:** Chrome slaves auto-launch when first needed, keep alive until `stop` command. No always-on requirement for dev loop.
9. **No Runaway Creation:** FleetSupervisor limits (maxConcurrent, queue, timeout) + ProfileAllocator singleton + spawn guard prevent duplicate Chrome instances.
10. **Triple-Layer State:** Profile + DB + runtime must stay consistent. Profile dir is canonical, DB and runtime are derived from profile state.
11. **Relogin Ready:** Agent detects session expiry via `isAuthenticated()`, suggests relogin to user, user confirms, system executes relogin flow.

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
| `deepseek-reasoning-sse` | DeepSeek | SSE `delta.content` with reasoning-channel separation |
| `generic-format-agnostic` | generic | SSE/JSON/array best-effort |
| `system-raw-text` | system | Last-resort raw text (never throws) |

**Fallback chain:** `provider/001` → `generic/001` → `system/001`. Wired by `seeds/parsers/harvest.seed.ts` via 2-pass upsert (`ProviderStore.upsertParser` + `setParserFallback`).

**Provider manifests (`seeds/providers/manifests.ts`):** Each provider declares `fallback` (parser name of the next tier). `ProviderRegistrar` reads this during registration and builds the `fallbackParserId` chain.

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

#### LLM-as-Human Testing (Spec 032)

The LLM-as-Human production test suite is itself a `UnifiedCapability` set (no second
transport). Source of truth is `devops/llm-testing/capabilities.ts`, which registers
`cap:llm_test:{run,report,status,patterns,providers,parity}` (surfaces: cli/api/mcp) and is
wired into `src/server/index.ts` bootstrap (registration in `devops/llm-testing/capabilities.ts`). The orchestrator lives in
`devops/llm-testing/`; adapters for cli/ui/api/mcp/workflow/provider all derive their
test cases from the live `UnifiedCapabilityRegistry` (never hardcoded). NL phrases
(`run llm tests`, `check parity`) bind in `src/engines/nlcl/catalog.ts` to the
`cap:llm_test:*` ids. `llm_test_parity` asserts the frontend=backend=cli=api=mcp mandate.


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

1. **UI slot IDs must be namespaced** — The frontend `SLOT_IDS` in `frontend/src/ui/slots.ts` use `chat.actionBar`, `chat.composer`, `chat.sidebar` (not short names). The taxonomy pipeline's `CATEGORY_POSITIONS` table must use these exact values or `ui_position` silently fails.

2. **Capability nodes may lack `category`** — Shared capability nodes often have no `category` field. When generating `apiEndpoint.path`, derive category from `slug.split('_')[0]` — not `node.category`.

3. **`Bun.spawn` exitCode is null** — `proc.exitCode` returns `null` until `await proc.exited` resolves. Always await the promise before reading exit code.

4. **Single-segment slugs** — `capId` format is `cap:${category}:${action}`. For single-segment slugs (e.g. `help`), use `cap:help:help` — never `cap:undefined:help`.

5. **Verify after taxonomy changes** — Run `bun run devops verify-cross-surface` after any change to taxonomy pipeline, shared pool, or skeleton platforms. It checks CLI (name), API (path), MCP (tool name), UI (slot id).

## Shell Environment (CRITICAL)

**All commands MUST be PowerShell-compatible.** The default shell is PowerShell 7+.

### Dev Server Startup (`scripts/dev.ts` + `scripts/stop.ts`)

The old PowerShell startup scripts (`scripts/start-all.ps1`, `scripts/stop-all.ps1`, etc.)
have been replaced by pure TypeScript scripts:

| Command | Purpose |
|---------|---------|
| `bun run dev` | Start backend + frontend in one foreground process (Ctrl+C to stop) |
| `bun run stop` | Kill any orphaned processes on ports 9420/3000, clean `.runtime/` |
| `bun run dev:backend` | Start backend only (standalone) |
| `bun run dev:frontend` | Start frontend only (standalone) |

**Usage:**
```bash
# Start both services (blocking — Ctrl+C to stop)
bun run dev

# Or start individually in separate terminals:
bun run dev:backend   # terminal 1
bun run dev:frontend  # terminal 2

# Cleanup orphaned processes:
bun run stop
```

**Key behaviors:**
- `bun run dev` kills stale processes on ports 9420/3000 before starting
- Output is prefixed with `[backend]` / `[frontend]` labels
- Ctrl+C shuts down both services gracefully
- `bun run stop` is a port-scanner (no PID files needed), kills any process on the known ports and cleans `.runtime/`

**Smoke tests must have client-side timeouts.** Endpoints like `/api/conversations/:id/send`
block forever waiting for a CDP browser that isn't attached. Always wrap `fetch` calls with
`AbortController` + timeout so the test completes.

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

### Maintenance Testing (Phase 3 Upgrade)

After upgrading from vivim-page source files, run the full maintenance test suite:

```bash
# All ledger-client tests (chain verifier, client, manifest applier)
bun test tests/unit/lib/ledger-client/

# All tunnel-client tests (frame protocol, connection, heartbeat, reconnection, request handler)
bun test tests/unit/lib/tunnel-client/

# All orchestrator tests (service manager, health monitor, config)
bun test tests/unit/lib/orchestrator/

# All shared/tunnel tests (constants, errors)
bun test tests/unit/lib/tunnel-shared/

# P2P and local server tests
bun test tests/unit/lib/p2p-node/ tests/unit/lib/local-server/

# Integration tests (sync pipeline, crypto verification)
bun test tests/integration/lib/

# Full gate (all new tests)
bun test tests/unit/lib/ledger-client/ tests/unit/lib/tunnel-client/ tests/unit/lib/orchestrator/ tests/unit/lib/tunnel-shared/ tests/unit/lib/p2p-node/ tests/unit/lib/local-server/ tests/integration/lib/
```

**Coverage targets:**
- ledger-client/*: 100% of public functions
- tunnel-client/*: 100% of public functions
- orchestrator/*: 100% of public functions
- tunnel-shared/*: Constants + error hierarchy
- Integration: Full pipeline (signup → sync → verify → apply → mint)

## Git Conventions

- Conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`
- One logical change per commit
- Reference engine names in commits: `feat(CapabilityEngine): add selector resolution`

## MCP Servers

- **Playwright** — browser automation for E2E testing and UI validation

---

**For devops workflow, atomic task tracking, and implementation protocols:** Load the relevant skills from `.opencode/skill/`.

## Skill Management

- **Source of truth:** `.opencode/skill/` (30 project skills; `desktop-build-testing` and `production-build` exist locally but are gitignored)
- **Sync to kilocode:** `pwsh scripts/sync-skills.ps1`
- **Global skills:** `~/.agents/skills/` (171) + `~/.claude/skills/` (94)
- **Adding new skills:** Create in `.opencode/skill/`, run sync, test
- **Audit:** archived at `.archive/docs-stale-2026-08-06/audits/SKILL-DEVOPS-AUDIT-2026-07-19.md`
- **Architecture:** archived at `.archive/docs-stale-2026-08-06/skill-architecture.md`

## Available Skills

### Core DevOps
- **devops** — Autonomous DevOps orchestrator (127 atomic units)
- **devops-fullstack** — LLM-driven full-stack dev loop
- **devops-db** — Database architecture & schema governance
- **devops-generators** — Taxonomy generation pipeline (4-round)
- **devops-research** — Research-first intelligence layer
- **devops-roadmap** — Research-first roadmap system
- **devops-toolkit** — Surface regeneration + cross-surface parity (regen/verify/diff)
- **feature-governance** — Feature registry, lifecycle, skill mapping, health dashboard
- **convergence-auditor** — Spec/code/arch convergence audit & drift detection
- **agentic** — Limited-context agentic dev loop

#### DevOps Loop Commands (atomic unit pipeline)
The `devops` CLI drives the atomic-unit tracker (archived with the docs cleanup;
restore/point to a fresh tracker under `docs/` if needed):
```bash
bun run devops select                 # next implementable unit as JSON
bun run devops mark <id> <state>      # pending|in_progress|done|blocked
bun run devops mark <id> done "<msg>" # SINGLE-PASS: mark done + PROGRESS.md audit line + ONE git commit
bun run devops gate [--strict]        # quality gate, exit non-zero on fail
bun run devops parallelize --max 4 [--dry-run] [--tracker <path>]  # fan out N units to isolated subagents
bun run devops context                # durable task-state snapshot (resume after compaction)
bun run devops audit <id> "<notes>"   # append PROGRESS.md line w/ resolved sha (post-commit)
bun run devops code-index <index|search|stats|watch|mcp|clear> [--all] [--no-embed] [--no-watch]  # local offline code indexing
```
**Single-pass commit rule:** always use `devops mark <id> done "<msg>"` — it transitions state,
appends the PROGRESS.md audit line with the real resolved sha, and folds everything into ONE git
commit (no `[PENDING-COMMIT]` placeholder, no second commit). Engines should `import { getLogger }`
from `src/lib/logger.ts` (pino) instead of `console.*`; set `OTEL_EXPORTER_OTLP_ENDPOINT` to
forward logs via `src/engines/otel-sink.ts`.

### Implementation
- **vivim-build** — Engine implementation workflow (13-engine architecture)
- **vivim-runtime** — Agent-as-runtime dev loop

### Quality
- **vivim-testing** — Testing patterns & workflows
- **source-audit** — P0-P3 source-code audit (4 depth tiers)
- **arch-audit** — Architecture audit (cycles, layering, coupling)
- **provider-testing** — 8-phase provider onboarding
- **db-agent** — Oracle-vision database agent
- **prisma-workflow** — Prisma ORM patterns
- **provider-onboard-explorer** — Agent-as-explorer provider onboarding (APOP-AX)

### Frontend & UX
- **frontend-ux-refinement** — Iterative frontend UX refinement + cross-surface wiring
- **llm-provider-frontend-testing** — LLM-as-Human exploratory frontend testing per provider
- **vivi-frontend** — Hot-swappable frontend UI slots (see Implementation below)

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

## Local Code Indexing (devops `code-index`)

Locally-indexed, offline code retrieval for agents. **Prefer `code-index search` over
grep+read for code discovery** — it returns ranked `path:line` chunks within a token budget
instead of forcing full-file reads (cuts the ~60–70% exploration tax). Native
(`devops/code-index.ts`, Bun `Bun.sqlite` FTS5), zero runtime deps, fully offline. See
`docs/decisions/README.md` (ADR index — ADR-017 archived, re-record if still load-bearing) and the A5 research brief
(archived: `.archive/docs-stale-2026-08-06/research/briefs/local-code-indexing-llm-brief.md`).

```bash
bun run devops code-index index           # index code-only roots (src, devops, frontend, scripts, seeds, prisma); watch by default
bun run devops code-index index --all     # index the whole repo
bun run devops code-index index --no-watch # one-shot, no file watcher
bun run devops code-index search "StreamParserEngine fallback"
bun run devops code-index stats
bun run devops code-index mcp              # stdio MCP: code_index_search + code_index_stats
```

- **Scope:** code-only roots by default; `--all` for the whole repo. `harvest/` dumps and
  `.html` are excluded to avoid OOM.
- **Retrieval:** lexical FTS5/BM25 by default; semantic opt-in via a pluggable HTTP embedder
  (`nomic-embed-text` at `localhost:11434/v1` by default). Falls back to lexical if no local
  model is reachable (one-time warning). Override with `CODE_INDEX_EMBEDDER_URL` /
  `CODE_INDEX_EMBEDDER_MODEL`. Semantic + lexical are fused with RRF(k=60).
- **Store:** `.runtime/code-index.sqlite` (`chunks`, `chunks_fts` FTS5 external-content, `files`
  hash table, `meta`). Incremental by content hash; watch mode keeps it fresh in-session.
- **Surfaces:** CLI for sub-agents (they can't call MCP directly) + stdio MCP for the
  top-level agent. This is the recommended replacement for `grep`/`Read` during exploration.

## Frontend

**Location:** `frontend/` (NOT `web/ui/` — that dir is empty)
- **Framework:** Next.js 16 + React 19 + Tailwind 4
- **Package:** `vivim-frontend` v0.2.0
- **Entry:** `frontend/src/app/` (Next.js App Router)
- **Engines:** `frontend/src/engines/` (canvas, workspace, plugin, rbac, presence, etc.)
- **UI slots:** `frontend/src/ui/slots.ts`, `frontend/src/ui/registry.ts`, `frontend/src/ui/defaults/`
- **Canvas:** `frontend/src/canvas/`, `frontend/src/features/`
- **Storage contracts:** `frontend/src/storage/contracts/` (memory impls in `storage/impl/`)
- **CLI:** `frontend/src/cli/` (canvas-scaffold, etc.)
- **Plugins:** `frontend/plugins/` (sample-plugin, demo-plugin)
- **Commands:** `cd frontend && bun run dev` (port 3000), `bun run build`, `bun run typecheck`, `bun run test`

## Frontend Convergence (Sandbox Harvest — completed)

All sandbox behavioral concepts have been collapsed into the main UI (`frontend/`).
The empty `web/sandbox/` dir remains (stale file lock from bun watcher, harmless).

### Architecture Rules
- **Design system:** CSS variables (`var(--bg)`, `var(--text)`, `var(--border)`, `var(--accent)`) with inline styles — NOT Tailwind.
- **FRONTEND = BACKEND:** capability `slug` is the single link; no `if (slug === 'x')` conditionals.
- **Backend:** `http://localhost:9420`, WebSocket `ws://localhost:9420/ws`.

### Harvested Components (10 total)

| Tier | Component | File | Surface |
|------|-----------|------|---------|
| 1 — Chat UX | RAF-batched WS streaming + block rendering | `Composer.tsx`, `MessageBlock.tsx` | `chat` |
| 1 — Chat UX | Latency breakdown bar chart | `LatencyBreakdown.tsx` | `chat` |
| 1 — Chat UX | Provider badges/colors | `ConversationList.tsx` | sidebar |
| 2 — Capability | Searchable capability grid | `CapabilityCatalog.tsx` | `capabilities` |
| 3 — Dev Tools | WS event firehose + NL inject + latency monitor | `DevConsole.tsx` | overlay |
| 4 — Admin | Provider health cards | `HealthDashboard.tsx` | `health` |
| 4 — Admin | Account CRUD modal | `ProviderManager.tsx` | modal |
| 4 — Admin | Fleet/chrome config modal | `WorkspaceSettings.tsx` | modal |

**Barrel exports:** `components/canvas/index.ts` exports all 7 new components + 2 types.

### Keyboard Shortcuts
| Shortcut | Action | Component |
|----------|--------|-----------|
| `Ctrl+K` / `⌘K` | Command Palette | `CommandPalette.tsx` |
| `Ctrl+\`` / `⌘\`` | Dev Console toggle | `DevConsole.tsx` (wired in `page.tsx`) |
| `Ctrl+Tab` / `⌘+Tab` | Cycle surface tabs | `SurfaceTabs.tsx` |
| `Ctrl+Shift+Tab` / `⌘+Shift+Tab` | Cycle surface tabs (reverse) | `SurfaceTabs.tsx` |

### UX Patterns
- **Conversation search** — text filter with memoized list (`ConversationList.tsx`)
- **Execution toast** — 2s auto-dismiss green/red toast on capability execute (`CapabilityCatalog.tsx`)
- **Error states** — all components catch HTTP + network errors with red message
- **Empty states** — "No X yet" / "No X match your filter" for all lists
- **Auto-refresh** — HealthDashboard refreshes every 15s
- **WS streaming** — RAF-batched (60fps flush) via `pendingBlocksRef` + `requestAnimationFrame`

### TypeScript
- All new/modified files pass `tsc --noEmit`. The only error is pre-existing `LoginPanel.tsx:37` (`Property 'token' does not exist`).

### Next Steps for Professional Frontend
1. **Virtual scrolling** for large conversation/message lists (react-window or similar)
2. **Theme system** — light/dark/auto + 6 accent colors + font scale (already seeded as `#4` in `page.tsx` Phase 3)
3. **Onboarding tour** (already seeded as `#5` in `page.tsx`)
4. **Responsive layout** — mobile breakpoints for sidebar/overlay/surfaces
5. **CSS transitions** — smooth surface tab transitions, modal open/close, toast animations
6. **Accessibility** — aria labels, focus trapping in modals, keyboard navigation for all surfaces
7. **Loading skeletons** — placeholder UI during data fetches (not just text "Loading…")
8. **Error recovery** — retry buttons on failed API calls
9. **Undo/redo** for destructive actions (delete conversation, capability execute)
10. **Moment (time-relative)** formatting in conversation list timestamps

## Node-Layer v2 (Universal Node DB — completed)

Full documentation: `docs/architecture/DATA.md` (Node model section — the old
`docs/node-layer-v2/` was archived with the 2026-08-06 cleanup).

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
After any Prisma schema change, rebuild the canonical test fixture (tracked in git at
`tests/fixtures/node-store-test.db`). Use an ABSOLUTE `file:` path — Prisma resolves
relative ones against `prisma/schema.prisma`, which would silently create a duplicate
at `prisma/tests/fixtures/` (DB proliferation; flagged by `scripts/db-reports/report-db-inventory.ts`):
```bash
DATABASE_URL="file:C:/0-BlackBoxProject-0/vivim-final/tests/fixtures/node-store-test.db" bunx prisma db push --skip-generate --accept-data-loss
```

### Migration history
- `20260718022736_universal_node_layer` — base Node + NodeEdge
- `20260718041000_node_layer_v2` — ACU fields + NodeVersion + NodeAlias + NodeEdge.weight

## package.json

```json
{
  "name": "vivim-final",
  "version": "1.0.0",
  "description": "cap-store v1 Knowledge Graph Rebuild — local-first AI conversation platform",
  "type": "module",
  "main": "src/index.ts",
  "bin": {
    "vivim": "src/cli/index.ts"
  },
  "scripts": {
    "dev": "bun run scripts/dev.ts",
    "stop": "bun run scripts/stop.ts",
    "dev:backend": "bun run src/cli/index.ts serve",
    "dev:frontend": "bun run --cwd frontend dev",
    "serve": "bun run src/cli/index.ts serve",
    "build": "tsup src/index.ts --format esm --no-dts",
    "migrate": "bun run src/cli/index.ts migrate --source all",
    "test": "bun test --exclude 'docs/**'",
    "test:unit": "bun test tests/unit --exclude 'docs/**'",
    "test:integration": "bun test tests/integration --exclude 'docs/**'",
    "test:e2e": "bun test tests/e2e --exclude 'docs/**'",
    "test:arch": "bun test tests/arch --exclude 'docs/**'",
    "test:fast": "bun test tests/unit tests/arch --exclude 'docs/**'",
    "typecheck": "bun x tsc --noEmit",
    "seed": "bun run src/cli/index.ts seed all",
    "lint": "biome check src/ tests/ seeds/",
    "format": "biome check --write src/ tests/ seeds/",
    "prisma:migrate:dev": "bun x prisma migrate dev",
    "prisma:migrate:prod": "bun x prisma migrate deploy",
    "prisma:generate": "bun x prisma generate",
    "prisma:studio": "bun x prisma studio",
    "prisma:push": "bun x prisma db push",
    "bench": "bun run bench/index.ts",
    "docs:openapi": "bun run scripts/openapi-gen.ts",
    "docs:manual": "bun run scripts/manual-gen.ts",
    "devops": "bun run devops/index.ts",
    "providers:smoke": "bun run scripts/provider-harness.ts",
    "taxonomy:generate": "bun run scripts/taxonomy-gen/run.ts",
    "taxonomy-gen": "bun run scripts/taxonomy-gen/run.ts",
    "taxonomy:openclaw": "bun run scripts/taxonomy-gen/run.ts openclaw-harvest",
    "generate-skills": "bun run scripts/generate-skills.ts",
    "devops:toolkit": "bun run devops/index.ts toolkit",
    "gen:protocol": "bun run src/engines/provider-protocol-generator.ts",
    "web:dev": "bun run --cwd frontend dev",
    "web:build": "bun run --cwd frontend build",
    "frontend:dev": "bun run --cwd frontend dev",
    "frontend:build": "bun run --cwd frontend build",
    "frontend:build:tauri": "bun run --cwd frontend build:tauri",
    "frontend:typecheck": "bun run --cwd frontend typecheck",
    "tauri:dev": "cargo tauri dev",
    "tauri:build": "cargo tauri build",
    "seed:snapshot": "bun run scripts/seed-snapshot.ts",
    "db:backup": "bun run scripts/backup-db.ts",
    "db:restore": "bun run scripts/restore-db.ts",
    "ci": "bun run scripts/ci.ts",
    "ci:fix": "bun run scripts/ci.ts --fix",
    "coverage": "bun test --coverage tests/unit/ --exclude 'docs/**'"
  },
  "prisma": {
    "seed": "bun run src/cli/index.ts seed all"
  },
  "_tauri_note": "Tauri V2 scaffolding added 2026-08-10. Run 'bun run tauri:dev' for dev, 'bun run tauri:build' for production installers. See src-tauri/ for Rust shell.",
  "dependencies": {
    "@ai-sdk/openai-compatible": "^3.0.30",
    "@huggingface/transformers": "^4.2.0",
    "@libp2p/autonat": "^3.0.26",
    "@libp2p/bootstrap": "^12.0.29",
    "@libp2p/circuit-relay-v2": "^4.2.11",
    "@libp2p/identify": "^4.1.12",
    "@libp2p/kad-dht": "^16.4.2",
    "@libp2p/mdns": "^12.0.29",
    "@libp2p/noise": "^1.0.1",
    "@libp2p/tcp": "^11.0.26",
    "@libp2p/websockets": "^10.1.19",
    "@libp2p/yamux": "^8.0.1",
    "@noble/ed25519": "^3.1.0",
    "@noble/hashes": "^2.3.0",
    "@prisma/client": "^6.19.3",
    "alasql": "^4.17.3",
    "cozo-node": "^0.7.6",
    "isolated-vm": "^7.0.1",
    "libp2p": "^3.3.8",
    "mdast-util-from-markdown": "^2.0.3",
    "mdast-util-gfm": "^3.1.0",
    "micromark": "^4.0.2",
    "micromark-extension-gfm": "^3.0.0",
    "pino": "^10.3.1",
    "quickjs-emscripten": "^0.32.0",
    "ulid": "^3.0.2",
    "ulidx": "^2.4.1",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@biomejs/biome": "^2.5.8",
    "@types/bun": "^1.3.14",
    "lefthook": "^2.1.10",
    "pino-pretty": "^13.1.3",
    "prisma": "^6.19.3",
    "rollup-plugin-dts": "^6.5.1",
    "tsup": "^8.5.1",
    "typescript": "^7.0.2",
    "typescript-language-server": "^5.3.0"
  },
  "trustedDependencies": [
    "@biomejs/biome",
    "@prisma/client",
    "@prisma/engines",
    "cozo-node",
    "esbuild",
    "isolated-vm",
    "lefthook",
    "prisma"
  ],
  "engines": {
    "bun": ">=1.3.14",
    "node": ">=20"
  }
}
```

## frontend/package.json

```json
{
  "name": "vivim-frontend",
  "version": "0.2.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "build:tauri": "TAURI_STATIC_EXPORT=1 next build",
    "tauri": "tauri",
    "start": "NODE_ENV=production bun .next/standalone/server.js 2>&1 | tee server.log",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "bun test tests/unit/ tests/route-sync*.test.ts tests/cli/ tests/integration/",
    "test:routes": "bun test tests/route-sync.test.ts",
    "test:e2e": "bunx playwright test tests/e2e/",
    "test:all": "bun test tests/",
    "db:push": "prisma db push",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:reset": "prisma migrate reset",
    "storage:inspect": "bun src/cli/commands/storage-inspect.ts",
    "devops:verify-cross-surface": "bun scripts/verify-cross-surface.ts"
  },
  "dependencies": {
    "@prisma/client": "^6.19.3",
    "@radix-ui/react-accordion": "^1.2.20",
    "@radix-ui/react-alert-dialog": "^1.1.23",
    "@radix-ui/react-aspect-ratio": "^1.1.15",
    "@radix-ui/react-avatar": "^1.2.6",
    "@radix-ui/react-checkbox": "^1.3.11",
    "@radix-ui/react-collapsible": "^1.1.20",
    "@radix-ui/react-context-menu": "^2.3.7",
    "@radix-ui/react-dialog": "^1.1.23",
    "@radix-ui/react-dropdown-menu": "^2.1.24",
    "@radix-ui/react-hover-card": "^1.1.23",
    "@radix-ui/react-label": "^2.1.15",
    "@radix-ui/react-menubar": "^1.1.24",
    "@radix-ui/react-navigation-menu": "^1.2.22",
    "@radix-ui/react-popover": "^1.1.23",
    "@radix-ui/react-progress": "^1.1.16",
    "@radix-ui/react-radio-group": "^1.4.7",
    "@radix-ui/react-scroll-area": "^1.2.18",
    "@radix-ui/react-select": "^2.3.7",
    "@radix-ui/react-separator": "^1.1.15",
    "@radix-ui/react-slider": "^1.4.7",
    "@radix-ui/react-slot": "^1.3.3",
    "@radix-ui/react-switch": "^1.3.7",
    "@radix-ui/react-tabs": "^1.1.21",
    "@radix-ui/react-toast": "^1.2.23",
    "@radix-ui/react-toggle": "^1.1.18",
    "@radix-ui/react-toggle-group": "^1.1.19",
    "@radix-ui/react-tooltip": "^1.2.16",
    "@tanstack/react-query": "^5.101.4",
    "@tanstack/react-virtual": "^3.14.9",
    "@tauri-apps/api": "^2.11.1",
    "@tauri-apps/plugin-dialog": "^2.7.2",
    "@tauri-apps/plugin-fs": "^2.5.1",
    "@tauri-apps/plugin-http": "^2.5.9",
    "@tauri-apps/plugin-shell": "^2.3.5",
    "@types/dompurify": "^3.2.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "cmdk": "^1.1.1",
    "date-fns": "^4.4.0",
    "dompurify": "^3.4.13",
    "embla-carousel-react": "^8.6.0",
    "html-to-image": "^1.11.13",
    "input-otp": "^1.4.2",
    "jspdf": "^4.2.1",
    "katex": "^0.16",
    "lucide-react": "^1.31.0",
    "mermaid": "^11",
    "next": "^16.3.0",
    "next-themes": "^0.4.6",
    "prisma": "^6.19.3",
    "react": "^19.2.8",
    "react-day-picker": "^10.0.1",
    "react-dom": "^19.2.8",
    "react-hook-form": "^7.85.0",
    "react-markdown": "^9",
    "react-resizable-panels": "^4.12.2",
    "recharts": "^3.10.1",
    "remark-gfm": "^4",
    "sharp": "^0.35.3",
    "sonner": "^2.0.8",
    "tailwind-merge": "^3.6.0",
    "tailwindcss-animate": "^1.0.7",
    "ulid": "^3.0.2",
    "vaul": "^1.1.2",
    "y-websocket": "^3.1.0",
    "yjs": "^13.6.32",
    "zod": "^4.4.3",
    "zustand": "^5.0.14"
  },
  "devDependencies": {
    "@playwright/test": "^1.62.1",
    "@tailwindcss/postcss": "^4.3.3",
    "@testing-library/jest-dom": "^7.0.1",
    "@testing-library/react": "^16.3.2",
    "@testing-library/user-event": "^14.6.3",
    "@types/react": "^19.2.18",
    "@types/react-dom": "^19.2.4",
    "bun-types": "^1.3.14",
    "eslint": "^10.8.1",
    "eslint-config-next": "^16.3.0",
    "happy-dom": "^20.11.2",
    "playwright": "^1.62.1",
    "tailwindcss": "^4.3.3",
    "tw-animate-css": "^1.4.0",
    "typescript": "^7.0.2"
  },
  "packageManager": "bun@1.3.14"
}
```

## src-tauri/Cargo.toml

```toml
[package]
name = "vivim-desktop"
version = "1.0.0"
edition = "2021"
description = "Vivim Universal Canvas — Tauri V2 Desktop Shell"

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = ["devtools"] }
tauri-plugin-shell = "2"
tauri-plugin-dialog = "2"
tauri-plugin-fs = "2"
tauri-plugin-http = "2"
tauri-plugin-process = "2"
tauri-plugin-window-state = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }

[profile.release]
strip = true
codegen-units = 1
lto = true
opt-level = "s"
panic = "abort"
```

## src/config.ts

```ts
// src/config.ts
// Centralized configuration — reads from environment variables.
// All engines read config through this module; no scattered process.env reads.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { catchDebug } from './lib/catch-logger.js'
import { safeJsonParse } from './lib/safe-json.js'

// ── Platform detection ──────────────────────────────────────────────────────

const isWin = process.platform === 'win32'

// ── Runtime port handshake ───────────────────────────────────────────────────
//
// The dev loop keeps one server alive across many agent turns. When the default
// port (9420) is held by a Windows zombie socket (a dead PID still LISTENING),
// the launcher falls back to the next free port and records it in
// `.runtime/backend.port`. Every client must resolve the port the same way so
// the loop never hard-binds to a dead port. Precedence: CAP_STORE_PORT env →
// `.runtime/backend.port` → 9420.

export function getServerPort(): number {
  const env = process.env.CAP_STORE_PORT
  if (env && /^\d+$/.test(env.trim())) return Number.parseInt(env.trim(), 10)
  try {
    const p = join(process.cwd(), '.runtime', 'backend.port')
    if (existsSync(p)) {
      const v = readFileSync(p, 'utf8').trim()
      if (/^\d+$/.test(v)) return Number.parseInt(v, 10)
    }
  } catch (e) {
    catchDebug(e, 'config: port file read failed, using default')
  }
  return 9420
}

export function writeServerPortFile(port: number): void {
  try {
    const dir = join(process.cwd(), '.runtime')
    if (!existsSync(dir)) return
    writeFileSync(join(dir, 'backend.port'), String(port), 'utf8')
  } catch (e) {
    catchDebug(e, 'config: port file write failed (non-fatal)')
  }
}

function defaultDataDir(): string {
  let dir: string
  if (isWin) {
    const local = process.env.LOCALAPPDATA ?? process.env.APPDATA ?? ''
    dir = local ? `${local}\\vivim\\cap-store` : '.'
  } else {
    const home = process.env.HOME ?? process.env.XDG_DATA_HOME ?? ''
    if (home.includes('.local')) dir = `${home}/share/vivim/cap-store`
    else dir = home ? `${home}/.local/share/vivim/cap-store` : '.'
  }
  // Ensure the data directory exists (safe on repeated calls).
  try {
    if (dir !== '.') mkdirSync(dir, { recursive: true })
  } catch (e) {
    catchDebug(e, 'config: runtime dir creation failed')
  }
  return dir
}

// ── Runtime tunables registry (devops-toolkit configurable layer) ──────────
//
// `tunables` is the runtime-reconfigurable layer: any value here can be
// overridden at runtime via `bun run devops toolkit config set <key> <value>`
// and persisted to `.runtime/config.tunables.json`, then hot-read by the
// running server. This is the "configurability" axis of the devops toolkit.

export interface TunableMeta {
  key: string
  type: 'string' | 'number' | 'boolean' | 'string[]'
  default: unknown
  description: string
}

// Tunable defaults reference the static config values below via lazy getters.
// We use a placeholder approach: defaults are resolved at first access after
// config is constructed, not at schema definition time.
const _TUNABLE_DEFAULTS: Record<string, unknown> = {}

export const TUNABLE_SCHEMA: TunableMeta[] = [
  {
    key: 'server.port',
    type: 'number',
    default: 9420,
    description: 'HTTP port for the cap-store server',
  },
  {
    key: 'server.host',
    type: 'string',
    default: '127.0.0.1',
    description: 'Bind host for the cap-store server',
  },
  {
    key: 'server.corsOrigin',
    type: 'string[]',
    default: ['http://localhost:3000', 'http://localhost:5175'],
    description: 'Allowed CORS origins (comma-separated)',
  },
  {
    key: 'log.level',
    type: 'string',
    default: 'info',
    description: 'Logging verbosity (debug|info|warn|error)',
  },
  {
    key: 'fleet.autoStart',
    type: 'boolean',
    default: false,
    description: 'Auto-launch Chrome slave fleet on boot',
  },
  {
    key: 'fleet.portStart',
    type: 'number',
    default: 9222,
    description: 'First port in CDP fleet range',
  },
  {
    key: 'fleet.portEnd',
    type: 'number',
    default: 9250,
    description: 'Last port in CDP fleet range',
  },
  {
    key: 'health.probeIntervalMs',
    type: 'number',
    default: 30000,
    description: 'Health probe cadence',
  },
  {
    key: 'surfaces.cliAliases',
    type: 'boolean',
    default: true,
    description: 'Auto-derive CLI aliases from slug',
  },
  {
    key: 'surfaces.enforceParity',
    type: 'boolean',
    default: true,
    description: 'Fail boot if a capability is out of cross-surface parity',
  },
  // ── Storage tunables (runtime-mutable via setStoragePaths) ───────────────
  {
    key: 'storage.dataDir',
    type: 'string',
    default: defaultDataDir(),
    description: 'Data directory for DB, profiles, cache, and logs',
  },
  {
    key: 'storage.dbPath',
    type: 'string',
    default: `${defaultDataDir()}/cap-store.sqlite`,
    description: 'Absolute path to the SQLite database file',
  },
  {
    key: 'storage.retainOldDays',
    type: 'number',
    default: 7,
    description: 'Days to keep archived old location after relocation',
  },
]

const TUNABLE_FILE = join(process.cwd(), '.runtime', 'config.tunables.json')

function loadTunables(): Record<string, unknown> {
  try {
    if (existsSync(TUNABLE_FILE)) {
      const raw =
        safeJsonParse<Record<string, unknown>>(readFileSync(TUNABLE_FILE, 'utf-8'), {}) ?? {}
      return raw
    }
  } catch (e) {
    catchDebug(e, 'config: tunable file parse failed, using defaults')
  }
  return {}
}

const tunableOverrides = loadTunables()

function coerce(meta: TunableMeta, value: unknown): unknown {
  switch (meta.type) {
    case 'number':
      return typeof value === 'number' ? value : Number(value)
    case 'boolean':
      return value === true || value === 'true'
    case 'string[]':
      return Array.isArray(value) ? value : String(value).split(',')
    default:
      return String(value)
  }
}

/** Resolve a tunable's effective value (override > default). */
export function getTunable(key: string): unknown {
  const meta = TUNABLE_SCHEMA.find((t) => t.key === key)
  if (!meta) throw new Error(`Unknown tunable: ${key}`)
  if (key in tunableOverrides) return coerce(meta, tunableOverrides[key])
  return meta.default
}

/** Set + persist a tunable to .runtime/config.tunables.json. */
export function setTunable(key: string, value: unknown): void {
  const meta = TUNABLE_SCHEMA.find((t) => t.key === key)
  if (!meta) throw new Error(`Unknown tunable: ${key}`)
  const next = { ...tunableOverrides, [key]: value }
  try {
    if (!existsSync(join(process.cwd(), '.runtime'))) {
      // best-effort; callers ensure .runtime exists
    }
    writeFileSync(TUNABLE_FILE, JSON.stringify(next, null, 2), 'utf-8')
  } catch (e) {
    catchDebug(e, 'config: tunable persist failed')
    throw new Error(`Failed to persist tunable ${key} (cannot write ${TUNABLE_FILE})`)
  }
  tunableOverrides[key] = value
}

/** Snapshot all tunable effective values (for `devops toolkit config list`). */
export function listTunables(): { key: string; value: unknown; source: 'override' | 'default' }[] {
  return TUNABLE_SCHEMA.map((t) => ({
    key: t.key,
    value: t.key in tunableOverrides ? coerce(t, tunableOverrides[t.key]) : t.default,
    source: t.key in tunableOverrides ? 'override' : 'default',
  }))
}

// ── Runtime-mutable storage paths ───────────────────────────────────────────
//
// These resolve from tunable overrides first, then env, then the platform
// default. The migration engine calls setStoragePaths() to update them
// atomically during Phase 4 (SWITCH).

function resolveDataDir(): string {
  const tunableKey = 'storage.dataDir'
  if (tunableKey in tunableOverrides) {
    return String(tunableOverrides[tunableKey])
  }
  return process.env.CAP_STORE_DATA_DIR ?? defaultDataDir()
}

function resolveDbPath(): string {
  const tunableKey = 'storage.dbPath'
  if (tunableKey in tunableOverrides) {
    return String(tunableOverrides[tunableKey])
  }
  return process.env.CAP_STORE_DB_PATH ?? `${resolveDataDir()}/cap-store.sqlite`
}

/** Parse an env var as a positive integer, falling back to `fallback` if unset or invalid. */
function envInt(name: string, fallback: number): number {
  const raw = process.env[name]
  if (raw == null || raw === '') return fallback
  const n = Number.parseInt(raw, 10)
  if (Number.isNaN(n) || n < 0) {
    getLogger('config').warn({ env: name, raw }, `Invalid integer, using fallback ${fallback}`)
    return fallback
  }
  return n
}

// ── Config values ───────────────────────────────────────────────────────────

export const config = {
  // Server
  host: process.env.CAP_STORE_HOST ?? '127.0.0.1',
  port: envInt('CAP_STORE_PORT', 9420),

  // Data — runtime-mutable via setStoragePaths()
  dataDir: resolveDataDir(),
  dbPath: resolveDbPath(),

  // Auth
  authToken: process.env.CAP_STORE_AUTH_TOKEN ?? null,

  // CORS
  corsOrigin: (
    process.env.CAP_STORE_CORS_ORIGIN ?? 'http://localhost:3000,http://localhost:5175'
  ).split(','),

  // Logging
  logLevel: (process.env.CAP_STORE_LOG_LEVEL ?? 'info') as 'debug' | 'info' | 'warn' | 'error',

  // Fleet
  autoStartFleet: process.env.CAP_STORE_AUTO_START_FLEET === 'true',
  chromePath: process.env.CAP_STORE_CHROME_PATH ?? null,
  // Chrome profile root — single source of truth for where slave profiles live.
  // Defaults to <dataDir>/chrome-profiles so profiles survive across runs.
  profileBaseDir:
    process.env.CAP_STORE_PROFILE_DIR ??
    (isWin ? `${resolveDataDir()}\\chrome-profiles` : `${resolveDataDir()}/chrome-profiles`),
  fleetPortRangeStart: envInt('CAP_STORE_FLEET_PORT_START', 9222),
  fleetPortRangeEnd: envInt('CAP_STORE_FLEET_PORT_END', 9250),

  // Health
  healthProbeIntervalMs: envInt('CAP_STORE_HEALTH_PROBE_MS', 30000),

  // Circuit breaker
  circuitBreakerThreshold: envInt('CAP_STORE_CIRCUIT_THRESHOLD', 5),
  circuitBreakerResetMs: envInt('CAP_STORE_CIRCUIT_RESET_MS', 30000),

  // HPE retention
  hpeRetentionDays: envInt('CAP_STORE_HPE_RETENTION_DAYS', 30),

  // Storage hardening (Unit 36.1)
  storage: {
    encryptDb: process.env.CAP_STORE_ENCRYPT_DB === 'true',
  },

  // OpenTelemetry (centralized so engines don't read process.env directly — B5)
  otel: {
    endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? null,
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'vivim-final',
  },

  // Protocol source (dev/ prod)
  providerProtocolSource: process.env.PROVIDER_PROTOCOL_SOURCE ?? 'prod',

  // OpenCode server
  opencodeServeEnabled: process.env.OPENCODE_SERVE_ENABLED === '1',
  opencodeServePort: envInt('OPENCODE_SERVE_PORT', 0) || undefined,
  opencodeServerPassword: process.env.OPENCODE_SERVER_PASSWORD ?? '',
  opencodeServerUsername: process.env.OPENCODE_SERVER_USERNAME ?? 'opencode',

  // OpenCode model sync (daily free-model refresh; off via '0')
  opencodeModelSyncEnabled: process.env.OPENCODE_MODEL_SYNC_ENABLED !== '0',
  opencodeModelSyncIntervalHours: envInt('OPENCODE_MODEL_SYNC_INTERVAL_HOURS', 24) || 24,
  opencodeModelSyncRefresh: process.env.OPENCODE_MODEL_SYNC_REFRESH === '1',

  // AI Gateway (src/ai/) — canonical AI execution layer.
  // When disabled, cap:ai:execute returns { ok: false, error: 'AI Gateway not enabled' }.
  // When enabled, the gateway boots with in-memory stores + simulator + (optionally) OpenCode adapter.
  aiGatewayEnabled: process.env.AI_GATEWAY_ENABLED === '1',

  // P0 ExecutionKernel — hardened, observable NLCL execution lifecycle (alpha-gated, OFF by default).
  // When enabled, NLCL capability execution routes through ExecutionKernel: P0PolicyEngine tier-blocking
  // (default-deny for destructive/communication/financial/security-sensitive) -> execute -> verify -> journal.
  // The kernel is wired into NLCL only at boot when this flag is '1'; otherwise NLCL executes directly via the
  // registry (today's behavior). Per-tier allows relax the policy for trusted callers; maxRiskTier caps tier breadth.
  executionKernel: {
    enabled: process.env.VIVIM_EXECUTION_KERNEL === '1',
    allowDestructive: process.env.VIVIM_EXECUTION_KERNEL_ALLOW_DESTRUCTIVE === '1',
    allowFinancial: process.env.VIVIM_EXECUTION_KERNEL_ALLOW_FINANCIAL === '1',
    allowCommunication: process.env.VIVIM_EXECUTION_KERNEL_ALLOW_COMMUNICATION === '1',
    allowSecuritySensitive: process.env.VIVIM_EXECUTION_KERNEL_ALLOW_SECURITY === '1',
    maxRiskTier: envInt('VIVIM_EXECUTION_KERNEL_MAX_RISK_TIER', 3),
  },

  // MCP
  mcpPort: envInt('MCP_PORT', 0) || undefined,

  // Tunnel + P2P
  tunnel: {
    enabled: process.env.VIVIM_TUNNEL_ENABLED !== 'false',
    serverUrl: process.env.VIVIM_TUNNEL_URL ?? 'wss://tunnel.vivim.live/connect',
    subdomain: process.env.VIVIM_SUBDOMAIN ?? '',
    authToken: process.env.VIVIM_TUNNEL_TOKEN ?? null,
    heartbeatIntervalMs: envInt('VIVIM_TUNNEL_HEARTBEAT_MS', 30000),
    heartbeatTimeoutMs: envInt('VIVIM_TUNNEL_HEARTBEAT_TIMEOUT_MS', 10000),
    reconnectInitialDelayMs: envInt('VIVIM_TUNNEL_RECONNECT_INITIAL_MS', 1000),
    reconnectMaxDelayMs: envInt('VIVIM_TUNNEL_RECONNECT_MAX_MS', 30000),
    reconnectJitterFactor: Number.parseFloat(process.env.VIVIM_TUNNEL_RECONNECT_JITTER ?? '0.3'),
    maxConcurrentRequests: envInt('VIVIM_TUNNEL_MAX_REQUESTS', 50),
    requestTimeoutMs: envInt('VIVIM_TUNNEL_REQUEST_TIMEOUT_MS', 60000),
  },
  p2p: {
    enabled: process.env.VIVIM_P2P_ENABLED !== 'false',
    bootstrapNodes: (process.env.VIVIM_P2P_BOOTSTRAP ?? '').split(',').filter(Boolean),
    mdnsEnabled: process.env.VIVIM_P2P_MDNS !== 'false',
    mdnsInterval: envInt('VIVIM_P2P_MDNS_INTERVAL_MS', 300000),
    dhtEnabled: process.env.VIVIM_P2P_DHT !== 'false',
    relayEnabled: process.env.VIVIM_P2P_RELAY !== 'false',
    maxPeers: envInt('VIVIM_P2P_MAX_PEERS', 50),
    maxConcurrentTransfers: envInt('VIVIM_P2P_MAX_TRANSFERS', 5),
    maxFileSize: envInt('VIVIM_P2P_MAX_FILE_SIZE', 104857600),
    identityPath: process.env.VIVIM_P2P_IDENTITY_PATH ?? '',
  },
  localServer: {
    enabled: process.env.VIVIM_LOCAL_SERVER_ENABLED !== 'false',
    host: process.env.VIVIM_LOCAL_SERVER_HOST ?? '127.0.0.1',
    port: envInt('VIVIM_LOCAL_SERVER_PORT', 8080),
    corsEnabled: process.env.VIVIM_LOCAL_SERVER_CORS !== 'false',
    corsOrigins: (process.env.VIVIM_LOCAL_SERVER_CORS_ORIGINS ?? 'http://localhost:3000').split(
      ',',
    ),
    rateLimitPerMinute: envInt('VIVIM_LOCAL_SERVER_RATE_LIMIT', 60),
    maxRequestBodyBytes: envInt('VIVIM_LOCAL_SERVER_MAX_BODY', 10485760),
    staticDir: process.env.VIVIM_LOCAL_SERVER_STATIC_DIR ?? './workspace-ui',
  },
  orchestrator: {
    healthCheckIntervalMs: envInt('VIVIM_ORCHESTRATOR_HEALTH_MS', 30000),
    restartDelayMs: envInt('VIVIM_ORCHESTRATOR_RESTART_DELAY_MS', 5000),
    maxRestartAttempts: envInt('VIVIM_ORCHESTRATOR_MAX_RESTARTS', 3),
    statusReportIntervalMs: envInt('VIVIM_ORCHESTRATOR_STATUS_MS', 60000),
  },

  // CLI / moments
  vivimApiUrl: process.env.VIVIM_API_URL ?? null,
  vivimWorkspace: process.env.VIVIM_WORKSPACE ?? null,

  // Debug
  debug: process.env.DEBUG === 'true',
} as const

// ── Ensure data directories exist on startup ──────────────────────────────
// Intentional side effect: creates dataDir and profileBaseDir at import time
// so engines don't crash on first boot in the Tauri sidecar or fresh install.
// This runs once per process and is safe for tests (idempotent mkdirSync).
try {
  mkdirSync(config.dataDir, { recursive: true })
  mkdirSync(config.profileBaseDir, { recursive: true })
} catch (e) {
  catchDebug(e, 'config: dataDir/profileBaseDir creation failed')
}

/**
 * Resolve OTEL sink configuration through the centralized config layer.
 * Returns null endpoint when OTEL_EXPORTER_OTLP_ENDPOINT is unset (no-op mode).
 */
export function getOtelConfig(): { endpoint: string | null; serviceName: string } {
  return { endpoint: config.otel.endpoint, serviceName: config.otel.serviceName }
}

/**
 * HMAC secret for NLCL confirmation tokens.
 * Dev fallback is intentionally insecure — production deployments MUST set the env var.
 * Engines must read this through the config authority, never `process.env` directly (B5).
 */
export function getConfirmationSecret(): string {
  const secret = process.env.VIVIM_CONFIRMATION_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'VIVIM_CONFIRMATION_SECRET must be set in production. ' +
          'Generate one with: openssl rand -hex 32',
      )
    }
    return 'dev-insecure-do-not-use-in-prod'
  }
  return secret
}

/**
 * Effective user home directory (engines must read it here, never `process.env`
 * directly so B5 config-authority stays satisfied).
 */
export function getHomeDir(): string {
  return homedir() || process.env.USERPROFILE || process.env.HOME || '.'
}

// ── Storage path mutation (used by migration engine Phase 4) ────────────────
//
// Updates config.dataDir + config.dbPath in-memory AND persists to tunables.
// Also writes to config_entry DB row via the caller (migration engine).
// The PrismaClient must be closed and reconnected by the caller after this.

/** Internal mutable reference — config.dataDir/dbPath are const, so we shadow via getter. */
let _mutableDataDir: string | null = null
let _mutableDbPath: string | null = null

/** Get the current effective dataDir (may differ from config.dataDir after setStoragePaths). */
export function getDataDir(): string {
  return _mutableDataDir ?? config.dataDir
}

/** Get the current effective dbPath (may differ from config.dbPath after setStoragePaths). */
export function getDbPath(): string {
  return _mutableDbPath ?? config.dbPath
}

/**
 * Atomically update the in-memory storage paths and persist to tunables.
 * Does NOT reconnect Prisma — the caller (migration engine) must call
 * closePrisma() before this and let getPrisma() create a fresh client after.
 */
export function setStoragePaths(dataDir: string, dbPath: string): void {
  _mutableDataDir = dataDir
  _mutableDbPath = dbPath
  setTunable('storage.dataDir', dataDir)
  setTunable('storage.dbPath', dbPath)
}

/**
 * Override the effective Prisma DATABASE_URL (used by the storage relocation
 * engine to repoint Prisma at a moved database). Centralized here so engines
 * never touch process.env directly (invariant B5).
 */
export function setDatabaseUrl(url: string): void {
  process.env.DATABASE_URL = url
}

export function isAuthenticated(): boolean {
  return config.authToken !== null
}

export function checkAuth(req: Request): boolean {
  if (!config.authToken) return true
  const header = req.headers.get('authorization')
  if (!header) return false
  const [scheme, token] = header.split(' ')
  return scheme === 'Bearer' && token === config.authToken
}
```

## src/ids.ts

```ts
// src/ids.ts
// ID derivation — all IDs generated with monotonic sortable ULIDs.

import { ulid } from 'ulid'

export { ulid }

export function newId(): string {
  return ulid()
}

export function deriveSlaveId(providerId: string, accountId: string): string {
  return `slave:${providerId}:${accountId}`
}

export function deriveCapabilityId(providerId: string, slug: string): string {
  return `cap:${providerId}:${slug}`
}

export function deriveBindingId(globalCapId: string, providerId: string): string {
  return `bind:${globalCapId}:${providerId}`
}

export function deriveProgramId(bindingId: string, version: number): string {
  return `prog:${bindingId}:v${version}`
}

export function deriveSelectorId(capabilityId: string, providerId: string, name: string): string {
  return `sel:${capabilityId}:${providerId}:${name}`
}

// ── Content hashing (integrity + dedup) ───────────────────────────────────
// Stable SHA-256 of canonicalized content. Mirrors OG AtomicChatUnit.contentHash.
// Used by the universal Node layer for dedup and tamper-evidence.

export function hashContent(content: string): string {
  // Lazy import to avoid a hard node:crypto dep in edge/browser contexts;
  // Bun and Node both provide it. Fallback to a lightweight hash if unavailable.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crypto = require('node:crypto')
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex')
  } catch {
    // FNV-1a is NOT collision-resistant. Use only for dedup keys, NOT for integrity.
    let h = 0x811c9dc5
    for (let i = 0; i < content.length; i++) {
      h ^= content.charCodeAt(i)
      h = Math.imul(h, 0x01000193)
    }
    return `fnv1a:${(h >>> 0).toString(16)}`
  }
}
```

## src/errors.ts

```ts
// src/errors.ts
// Typed error hierarchy for the entire system.

export class CapStoreError extends Error {
  public readonly code: string
  public readonly details?: unknown

  constructor(code: string, message: string, details?: unknown, options?: ErrorOptions) {
    super(message, options)
    this.name = 'CapStoreError'
    this.code = code
    this.details = details
  }

  toJSON() {
    return { error: this.message, code: this.code, details: this.details }
  }
}

export class ValidationError extends CapStoreError {
  constructor(message: string, details?: unknown) {
    super('ValidationError', message, details)
  }
}

export class NotFoundError extends CapStoreError {
  constructor(message: string) {
    super('NotFoundError', message)
  }
}

export class ConflictError extends CapStoreError {
  constructor(message: string) {
    super('ConflictError', message)
  }
}

export class AuthRequired extends CapStoreError {
  constructor(message: string) {
    super('AuthRequired', message)
  }
}

// Governor-specific errors
export class SlaveNotRunningError extends CapStoreError {
  constructor(slaveId: string) {
    super('SlaveNotRunningError', `Slave ${slaveId} is not running`)
  }
}

// Memory-orchestrator errors (spec 024 - Hermes memory harvest)
export class MemoryError extends CapStoreError {
  constructor(message: string, details?: unknown) {
    super('MemoryError', message, details)
  }
}

export class MemoryBackendLimitError extends MemoryError {
  constructor(existing: string, rejected: string) {
    super(
      `Rejected memory backend '${rejected}' — external backend '${existing}' is already registered. Only one external memory backend is allowed at a time.`,
      { existing, rejected },
    )
  }
}

export class MemoryWardenQuotaError extends MemoryError {
  constructor(agentId: string, used: number, limit: number) {
    super(`Agent ${agentId} memory write quota breached (${used}/${limit}).`, {
      agentId,
      used,
      limit,
    })
  }
}

export class SlaveBusyError extends CapStoreError {
  constructor(slaveId: string) {
    super('SlaveBusyError', `Slave ${slaveId} is busy`)
  }
}

export class CdpTimeoutError extends CapStoreError {
  constructor(method: string) {
    super('CdpTimeoutError', `CDP command ${method} timed out`)
  }
}

export class CircuitOpenError extends CapStoreError {
  constructor(slaveId: string) {
    super('CircuitOpenError', `Circuit breaker open for slave ${slaveId}`)
  }
}

// Updater errors
export class UpdateError extends CapStoreError {
  constructor(message: string, details?: unknown) {
    super('UpdateError', message, details)
  }
}

export class CdpConnectionError extends CapStoreError {
  constructor(message: string) {
    super('CdpConnectionError', message)
  }
}

export class ChromeGovernorError extends CapStoreError {
  constructor(message: string, details?: unknown) {
    super('ChromeGovernorError', message, details)
  }
}

export class ChromeNotFoundError extends CapStoreError {
  constructor() {
    super('ChromeNotFoundError', 'Chrome binary not found')
  }
}

export class PortOccupiedError extends CapStoreError {
  constructor(range: string) {
    super('PortOccupiedError', `All ports in range ${range} occupied`)
  }
}

export class EngineError extends CapStoreError {
  constructor(message: string, details?: unknown) {
    super('EngineError', message, details)
  }
}

// OpenCode `serve` supervisor/client errors (feature 027).
export class OpenCodeServeError extends CapStoreError {
  // biome-ignore lint/complexity/noUselessConstructor: required to pass parameters to CapStoreError
  constructor(code: string, message: string, details?: unknown) {
    super(code, message, details)
  }
}

export class OpenCodePermissionDeniedError extends CapStoreError {
  constructor(tool: string, tier: number) {
    super(
      'OPENCODE_PERMISSION_DENIED',
      `OpenCode permission denied for '${tool}' (risk tier ${tier} > 3)`,
      { tool, tier },
    )
  }
}

// ── Agentic / Intent ─────────────────────────────────────────
export class IntentDecompositionError extends CapStoreError {
  constructor(message: string, details?: unknown) {
    super('IntentDecompositionError', message, details)
  }
}

export class CapabilityNotFoundError extends CapStoreError {
  constructor(slug: string) {
    super('CapabilityNotFoundError', `Capability not found: ${slug}`)
  }
}

export class CapabilityCompositionError extends CapStoreError {
  constructor(message: string, details?: unknown) {
    super('CapabilityCompositionError', message, details)
  }
}

// ── Canvas ────────────────────────────────────────────────────
export class CanvasSpawnError extends CapStoreError {
  constructor(message: string) {
    super('CanvasSpawnError', message)
  }
}

export class CanvasMutationError extends CapStoreError {
  constructor(message: string) {
    super('CanvasMutationError', message)
  }
}

// ── Sandbox ──────────────────────────────────────────────────
export class SandboxTimeoutError extends CapStoreError {
  constructor(handlerSlug: string, budgetMs: number) {
    super('SandboxTimeoutError', `Handler ${handlerSlug} exceeded ${budgetMs}ms budget`)
  }
}

export class SandboxBudgetError extends CapStoreError {
  constructor(handlerSlug: string, kind: 'cpu' | 'memory', used: number, budget: number) {
    super('SandboxBudgetError', `${handlerSlug} ${kind} ${used} > ${budget}`)
  }
}

export class SandboxPermissionError extends CapStoreError {
  constructor(handlerSlug: string, denied: string) {
    super('SandboxPermissionError', `${handlerSlug} denied: ${denied}`)
  }
}

// ── Sovereign / Sync ─────────────────────────────────────────
export class ConsentViolationError extends CapStoreError {
  constructor(host: string) {
    super('ConsentViolationError', `Outbound call to ${host} denied (no user consent)`)
  }
}

export class SyncConflictError extends CapStoreError {
  constructor(table: string, recordId: string) {
    super('SyncConflictError', `Conflict on ${table}:${recordId}`)
  }
}

// ── HITL ─────────────────────────────────────────────────────
export class HitlGateExpiredError extends CapStoreError {
  constructor(gateId: string) {
    super('HitlGateExpiredError', `Gate ${gateId} expired without resolution`)
  }
}

export class HitlGateDeniedError extends CapStoreError {
  constructor(gateId: string, by: string) {
    super('HitlGateDeniedError', `Gate ${gateId} denied by ${by}`)
  }
}

// ── Budget ───────────────────────────────────────────────────
export class BudgetExceededError extends CapStoreError {
  constructor(budget: string, used: unknown, limit: unknown) {
    super('BudgetExceededError', `${budget} ${used} > ${limit}`)
  }
}

// ── Harness Command Registry / Repair Engine (017-harness-command-registry) ──
export class HarnessRepairError extends CapStoreError {
  constructor(message: string, details?: unknown) {
    super('HarnessRepairError', message, details)
  }
}

export class HarnessCommandNotFoundError extends CapStoreError {
  constructor(commandId: string, version?: string) {
    const v = version ? ` v${version}` : ''
    super('HarnessCommandNotFoundError', `Harness command not found: ${commandId}${v}`)
  }
}

export class HarnessRetryExhaustedError extends CapStoreError {
  public readonly attempts: number
  public readonly lastError?: string

  constructor(attempts: number, lastError?: string) {
    super('HarnessRetryExhaustedError', `Retry exhausted after ${attempts} attempt(s)`, {
      attempts,
      lastError,
    })
    this.attempts = attempts
    this.lastError = lastError
  }
}

// ── Command Language ─────────────────────────────────────────────
export class CommandLanguageError extends CapStoreError {
  // biome-ignore lint/complexity/noUselessConstructor: required to pass parameters to CapStoreError
  constructor(code: string, message: string, details?: unknown) {
    super(code, message, details)
  }
}

export class UnknownPrefixError extends CommandLanguageError {
  constructor(prefix: string) {
    super('UNKNOWN_PREFIX', `Unknown prefix character: ${prefix}`)
  }
}

export class UnknownCommandError extends CommandLanguageError {
  constructor(command: string) {
    super('UNKNOWN_COMMAND', `Unknown command: ${command}`)
  }
}

export class MissingArgsError extends CommandLanguageError {
  constructor(command: string, missing: string[]) {
    super('MISSING_ARGS', `Missing required args for ${command}: ${missing.join(', ')}`, {
      command,
      missing,
    })
  }
}

export class InvalidArgError extends CommandLanguageError {
  constructor(command: string, arg: string, reason: string) {
    super('INVALID_ARG', `Invalid arg '${arg}' for ${command}: ${reason}`, { command, arg, reason })
  }
}

export class UnknownProviderError extends CommandLanguageError {
  constructor(provider: string) {
    super('UNKNOWN_PROVIDER', `Unknown provider: ${provider}`)
  }
}

export class ContextNotFoundError extends CommandLanguageError {
  constructor(ref: string) {
    super('CONTEXT_NOT_FOUND', `Context not found for reference: ${ref}`)
  }
}

export class NlpMatchError extends CommandLanguageError {
  constructor(message: string, details?: unknown) {
    super('NLP_MATCH_ERROR', message, details)
  }
}

export class LowConfidenceError extends NlpMatchError {
  constructor(input: string, confidence: number, threshold: number) {
    super(`Low confidence match for "${input}": ${confidence.toFixed(2)} < ${threshold}`, {
      input,
      confidence,
      threshold,
    })
  }
}

export class ComboAmbiguousError extends CommandLanguageError {
  constructor(input: string, candidates: string[]) {
    super('COMBO_AMBIGUOUS', `Ambiguous combo in "${input}": ${candidates.join(' vs ')}`, {
      input,
      candidates,
    })
  }
}

// ── SendResilience ────────────────────────────────────────────────

export type RecoveryKind =
  | 'chrome_crash'
  | 'cdp_down'
  | 'session_expired'
  | 'circuit_open'
  | 'unknown'
  | 'relogin'

export class SendResilienceError extends CapStoreError {
  public readonly recoveryKind: RecoveryKind
  public readonly retryAfterMs?: number
  public readonly autoReconnectAttempted: boolean

  constructor(
    message: string,
    meta: {
      recoveryKind: RecoveryKind
      providerId: string
      slaveId: string
      retryAfterMs?: number
      autoReconnectAttempted: boolean
      defaultMessage: string
    },
  ) {
    super('SendResilienceError', message, meta)
    this.recoveryKind = meta.recoveryKind
    this.retryAfterMs = meta.retryAfterMs
    this.autoReconnectAttempted = meta.autoReconnectAttempted
  }
}
```

## src/domain/types.ts

```ts
// src/domain/types.ts
// Core domain types for the Chrome slave platform.
// Phase 2: Domain Layer isolates business logic from runtime mechanics.

import type { SlaveLifecycle } from '../executor/slave-states.js'

// ── Core Domain Entities ────────────────────────────────────────────────────

/**
 * Unique identifier for a Chrome slave instance.
 */
export type SlaveId = string & { __brand: 'SlaveId' }

/**
 * Unique identifier for a provider (e.g., 'chatgpt', 'claude', 'gemini').
 */
export type ProviderId = string & { __brand: 'ProviderId' }

/**
 * Unique identifier for an account within a provider.
 */
export type AccountId = string & { __brand: 'AccountId' }

/**
 * Unique identifier for a pool lease.
 */
export type LeaseId = string & { __brand: 'LeaseId' }

/**
 * Unique identifier for a conversation.
 */
export type ConversationId = string & { __brand: 'ConversationId' }

// ── Domain Models ───────────────────────────────────────────────────────────

/**
 * Represents a Chrome slave instance in the domain.
 */
export interface Slave {
  id: SlaveId
  providerId: ProviderId
  accountId: AccountId
  debugPort: number
  profileDir: string
  status: SlaveLifecycle
  pid: number | null
  consecutiveFailures: number
  lastHealthCheck: number
  createdAt: number
}

/**
 * Represents a lease on a Chrome slave from the pool.
 */
export interface Lease {
  id: LeaseId
  slaveId: SlaveId
  providerId: ProviderId
  accountId: AccountId
  acquiredAt: number
  expiresAt: number
  healthy: boolean
}

/**
 * Represents a provider configuration in the domain.
 */
export interface Provider {
  id: ProviderId
  name: string
  urls: {
    login: string
    app: string
    loggedInPattern: RegExp
  }
  selectors: {
    composer: string[]
    sendButton: string[]
    fallback: 'heuristic'
  }
  composerType: 'textarea' | 'contenteditable' | 'quill' | 'codemirror'
}

/**
 * Represents a capability registered for a provider.
 */
export interface Capability {
  id: string
  providerId: ProviderId
  action: string
  surfaces: string[]
}

// ── Value Objects ───────────────────────────────────────────────────────────

/**
 * Represents a browser endpoint (local or remote).
 * Phase 2: Remote-Readiness — no assumption of localhost.
 */
export interface BrowserEndpoint {
  type: 'local' | 'remote' | 'container'
  host: string
  port: number
  path?: string
}

/**
 * Represents resource requirements for a CDP command.
 */
export interface ResourceRequirements {
  resourceClass: 'DOM' | 'Input' | 'Runtime' | 'Network' | 'Screenshot' | 'Target'
  exclusive: boolean
  timeoutMs: number
}

// ── Factory Functions ───────────────────────────────────────────────────────

export function createSlaveId(id: string): SlaveId {
  return id as SlaveId
}

export function createProviderId(id: string): ProviderId {
  return id as ProviderId
}

export function createAccountId(id: string): AccountId {
  return id as AccountId
}

export function createLeaseId(id: string): LeaseId {
  return id as LeaseId
}

export function createConversationId(id: string): ConversationId {
  return id as ConversationId
}
```

## src/domain/index.ts

```ts
// src/domain/index.ts
// Barrel exports for Domain Layer.
// Phase 2: Domain Layer isolates business logic from runtime mechanics.

export type {
  SlaveId,
  ProviderId,
  AccountId,
  LeaseId,
  ConversationId,
  Slave,
  Lease,
  Provider,
  Capability,
  BrowserEndpoint,
  ResourceRequirements,
} from './types.js'

export {
  createSlaveId,
  createProviderId,
  createAccountId,
  createLeaseId,
  createConversationId,
} from './types.js'

export { SlaveStateStore } from './slave-state-store.js'
```
