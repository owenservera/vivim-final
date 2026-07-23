# Vivim Universal Canvas — Phase 2 Expansion Report

**Build prompt deliverable.** Expanded the v2 canvas from a "chat UI shell" into a general-purpose document/media/automation/agents workspace OS. Added 3 new core engines (document, media/VLC, annotation), workspace visual taxonomy + 3D z-depth architecture, an Automation Builder with 100 pre-seeded core automations, an Agents Builder composing AutonomousTask/Step/HitlGate DAGs, and a **FRONTEND=BACKEND two-way CLI bridge** (`cap:canvas:shell-command`) that makes the canvas a first-class CLI surface.

---

## 1. Acceptance — all green

```
$ bun run typecheck                          → 0 errors
$ bun run lint                                → 0 errors, 0 warnings
$ bun test tests/                             → 135/135 pass
   - tests/route-sync.test.ts                 → 100/100 (S01–S100, v2 baseline preserved)
   - tests/route-sync-workspace.test.ts       → 20/20 (S101–S120, Phase 2 workspace tiers)
   - tests/cli/shell-command.test.ts          → 15/15 (CLI two-way bridge)
$ bun run devops:verify-cross-surface         → 12/12 checks pass
   - 6 original v2 checks (engine, parity, P8, B2, G1, G2)
   - 6 new Phase 2 checks (engines, routeSyncWorkspace, cli-two-way,
                           100-automations, workspace-taxonomy,
                           frontend-backend-two-way)
```

**Browser-verified** (via agent-browser):
- Workspace switcher renders: Global (z=0) + Research Lab (z=1) + Content Team (z=1) + Automation Lab (z=1) + "New workspace" button
- 6 surface tabs render: 💬 Chat · 📄 Documents · 🎬 Media · ⚡ Automation · 🤖 Agents · ⌨️ Shell
- Chat surface: 13 sandboxed iframes (v2 baseline preserved)
- Documents surface: 2 doc cards (markdown + TypeScript)
- Media surface: video card (Big Buck Bunny) + audio card
- Shell surface: dark terminal card with `cap:canvas:shell-command` badge, help command executed (exit=0)
- `POST /api/canvas/shell` returns full `admin db status` output (100 automations, 3 workspaces, 4 docs, 2 media, 3 agents)

Screenshots: `download/vivim-phase2-docs.png`, `download/vivim-phase2-media.png`, `download/vivim-phase2-shell.png`

---

## 2. Files created (Phase 2)

### Shared contract types (`src/shared/`)
| File | Role |
|---|---|
| `workspace.ts` | `WorkspaceTaxonomy`, `WorkspaceSurface`, `WorkspaceRegion`, `WORKSPACE_RESOLUTION_CHAIN` (5-level), `GLOBAL_WORKSPACE_ID` |
| `document.ts` | `DocumentCard`, `DocumentMimeType`, `DocumentEngine`, `DocumentOpenInput`, `DocumentSearchHit` |
| `media.ts` | `MediaCard`, `MediaKind`, `MediaEngine`, `TranscriptBlock`, `FrameThumb`, `MediaPlayInput`, `MediaTranscribeOutput` |
| `automation.ts` | `AutomationDefinition`, `AutomationNode`, `AutomationEdge`, `AutomationExecution`, `AutomationStatus` |
| `agent.ts` | `AgentDefinition`, `AgentStep`, `AgentEdge`, `AgentRun`, `HitlGate`, `PolicyRule` |
| `workspace-route.ts` | `WorkspaceRouteContext`, `ResolvedCard`, `ResolvedWorkspaceSurface` |
| `shell-command.ts` | `ShellCommandInput`, `ShellCommandResult`, `ShellCommandOutputChunk`, `CommandSpec`, `ShellCommandContext` |
| `index.ts` | Barrel extended with all Phase 2 types |

### Storage contracts (`src/storage/contracts/`)
| File | Contract |
|---|---|
| `workspace-store.ts` | `WorkspaceStore.get/getBySlug/getGlobal/list/create/update/remove/upsertSurface/upsertRegion` |
| `document-store.ts` | `DocumentStore.get/list/open/update/addAnnotation/search/remove` |
| `media-store.ts` | `MediaStore.get/list/open/update/setTranscript/addThumbnail/addAnnotation/remove` |
| `automation-store.ts` | `AutomationStore.get/list/create/update/updateGraph/setStatus/remove + startExecution/getExecution/listExecutions/updateExecution` |
| `agent-store.ts` | `AgentStore` + `HitlGateStore` + `PolicyRuleStore` (guardrails) |
| `shell-command-store.ts` | `ShellCommandStore.register/resolve/list/execute` (CommandRegistry) |

### In-memory implementations (`src/storage/impl/`)
| File | Implementation |
|---|---|
| `memory-workspace-store.ts` | Lazy-seeds `ws:global` with 6 surfaces (chat/docs/media/automation/agents/shell) at z=0..5 |
| `memory-document-store.ts` | Auto-detects engine from mime (pdf/docx/pptx/xlsx/markdown/code/text/html) |
| `memory-media-store.ts` | Picks vlc/html5/image engine by kind |
| `memory-automation-store.ts` | WorkflowDefinition rows + execution log |
| `memory-agent-store.ts` | AgentDefinition rows + run log + HitlGate + PolicyRule stores |
| `memory-shell-command-store.ts` | Longest-prefix-match CommandRegistry |

### Engines (`src/engines/`)
| File | Role | Capabilities |
|---|---|---|
| `document-engine.ts` | Document lifecycle (open/read/search/annotate/export) | `cap:document:open/read/search/annotate/export` |
| `media-engine.ts` | Video/audio playback + frame extraction + ASR transcription | `cap:media:play/pause/seek/extract_frame/transcribe` |
| `media-bridge.ts` | `MediaBridge` contract (VLC behind it, never blocks event loop) + `MemoryMediaBridge` stub | — |
| `annotation-engine.ts` | First-class annotations on docs/media/canvas | `cap:annotation:create/list/update/remove` |
| `workspace-engine.ts` | Workspace visual taxonomy + 3D z-depth + switch (re-couples routeSyncWorkspace) | `cap:workspace:list/create/switch/get` |
| `automation-builder.ts` | Visual DAG editor reusing WorkflowNode/Edge; execute walks DAG from trigger | `cap:automation:list/create/update_graph/execute/executions` |
| `agents-builder.ts` | Compose AutonomousTask/Step/HitlGate DAGs; invoke walks step DAG with loop cap | `cap:agent:list/create/update_dag/invoke/runs` + `cap:hitl:list` + `cap:policy:list` |
| `shell-command-engine.ts` | **CLI two-way bridge** — dispatches `cap:canvas:shell-command` through the SAME CommandRegistry the thin CLI client uses | `cap:canvas:shell-command` + `cap:canvas:shell-list` |
| `route-sync-workspace.ts` | `routeSyncWorkspace` — 5-level workspace tree walk (workspace+surface+region → workspace+surface → workspace → cross-workspace → system) with STRICT per-tier lookups (no chain delegation) | — |
| `index.ts` | Barrel extended with all Phase 2 engines |

### CLI two-way (`src/cli/commands/`)
| File | Role |
|---|---|
| `shell.ts` | `registerDefaultCommands(store)` — registers 17 multi-word commands: `admin db status/migrate/reset`, `admin invariants check`, `list conversations/providers/workspaces/automations/agents`, `resolve canvas`, `open document/video/audio`, `publish/patch component`, `run automation`, `invoke agent`, `help` |

### Backend routers (`src/app/api/`)
| Route | Method | Role |
|---|---|---|
| `/api/canvas/shell` | POST / GET | **CLI two-way bridge** — dispatches through ShellCommandEngine (FRONTEND=BACKEND two-way) |
| `/api/workspace/list` | GET | List workspaces (parent + children) |
| `/api/canvas/workspace/switch` | POST | Switch workspace → emits `workspace:switched` → SSE → re-resolve |
| `/api/document/open` | POST | Open a document card |
| `/api/media/open` | POST | Open a media card (video/audio/image/stream) |
| `/api/automation/list` | GET | List automation definitions |
| `/api/automation/execute` | POST | Execute an automation (walks DAG) |
| `/api/agent/list` | GET | List agent definitions |
| `/api/agent/invoke` | POST | Invoke an agent (walks step DAG) |

### Frontend (`src/components/canvas/`)
| File | Role |
|---|---|
| `cards/DocCard.tsx` | Document card — renders pdf/docx/pptx/xlsx/markdown/code/text/html with page nav + annotate |
| `cards/MediaCard.tsx` | Video/audio/image/stream card — native HTML5 controls + thumbnail grid + transcript pane |
| `cards/AutomationCard.tsx` | Visual DAG (nodes + SVG edges) + Execute button |
| `cards/AgentCard.tsx` | Step DAG (perceive/think/act/reflect/hitl/memory/tool/output) + Invoke button |
| `cards/ShellCard.tsx` | **CLI terminal card** — POSTs to `/api/canvas/shell`, streams output, history |
| `cards/index.ts` | Barrel |
| `WorkspaceSwitcher.tsx` | Lists global + child workspaces with z-depth; switch re-resolves |
| `index.ts` | Barrel extended with Phase 2 cards + WorkspaceSwitcher |

### Seeds (`src/seeds/canvas/` + `src/lib/`)
| File | Content |
|---|---|
| `src/seeds/canvas/automations.ts` | **100 core automations** across 10 categories (document, media, routing, digest, research, content, monitoring, backup, agents, maintenance) |
| `src/lib/seed-canvas-model-phase2.ts` | Idempotent Phase 2 seeder: 1 global + 3 child workspaces, 100 automations, 3 sample agents, 2 HitlGates, 2 PolicyRules, 5 new card-kind CanvasDefinitions |

### Tests (`tests/`)
| File | Tests |
|---|---|
| `route-sync-workspace.test.ts` | **20 new scenarios S101–S120** (workspace tier resolution + new card kinds) |
| `cli/shell-command.test.ts` | **15 tests** — CommandRegistry longest-prefix-match, ShellCommandEngine execute/stream/dispatch, 17 default commands |

### Modified files
- `src/lib/canvas-engine-bootstrap.ts` — wires 9 Phase 2 stores + 8 Phase 2 engines + MemoryMediaBridge + MemoryAnnotationStore + registerDefaultCommands
- `src/lib/seed-canvas-model.ts` — delegates to `seedCanvasModelPhase2` after v1 seed
- `src/engines/index.ts` — barrel extended with Phase 2 exports
- `src/shared/index.ts` — barrel extended with Phase 2 types
- `src/storage/contracts/index.ts` — barrel extended with Phase 2 contracts
- `src/storage/impl/index.ts` — barrel extended with Phase 2 impls
- `src/components/canvas/index.ts` — barrel extended with Phase 2 cards + WorkspaceSwitcher
- `src/app/page.tsx` — rewritten with workspace switcher + 6 surface tabs + all card kinds rendered
- `scripts/verify-cross-surface.ts` — 6 new Phase 2 checks (12 total)

---

## 3. Architecture — what was built

### 3.1 Document / Video / Audio Engines (Phase 2 §1)

**DocumentEngine** (`src/engines/document-engine.ts`):
- Opens a DocumentCard row per document. Auto-detects engine from mime:
  - `application/pdf` → `pdf` engine (pdfjs-dist in production)
  - `.docx` → `docx` (mammoth)
  - `.pptx` → `pptx` (pptxtojson)
  - `.xlsx` → `xlsx` (exceljs)
  - `text/markdown` → `markdown` (react-markdown + remark/rehype)
  - code mimes → `code` (shiki)
  - `text/plain` → `text`
  - `text/html` → `html`
- Each DocumentCard carries an `engineRef` (e.g. `engine:document:pdf`) so plugins can hot-swap the renderer via `registerSlot(slot, slug, Component, opts)` — same precedence `capabilitySlug > providerSlug > default` as v2.

**MediaEngine** (`src/engines/media-engine.ts`) + **MediaBridge** (`src/engines/media-bridge.ts`):
- Wraps libvlc / vlc behind the `MediaBridge` contract — NEVER blocks the event loop.
- Capabilities: `play`, `pause`, `seek`, `extract_frame`, `transcribe`.
- Transcripts (from `transcribe`) return `TranscriptBlock[]` and feed the existing ConversationMessage/StreamBlock store (the caller wires the ConversationManager).
- `MemoryMediaBridge` is the in-memory stub: returns canned frame PNG + 3-block fake transcript. Production swaps in `VlcMediaBridge` (native libvlc addon) with zero engine changes (B2 invariant).

**AnnotationEngine** (`src/engines/annotation-engine.ts`):
- First-class annotations on documents (page + char range), media (time range), and canvas (world-space rect).
- Each annotation is a row; the overlay itself is a sandboxed CanvasDefinition.

### 3.2 Workspaces — visual taxonomy + 3D architecture (Phase 2 §2)

**WorkspaceTaxonomy** (`src/shared/workspace.ts`):
- Hierarchy: `workspace → surface → region → node(card)`.
- There is ALWAYS a global workspace (`ws:global`, z=0).
- Users create child workspaces; `zDepth` tracks depth in the workspace stack.
- 6 surfaces per workspace: chat, docs, media, automation, agents, shell (each at z=0..5).
- `WORKSPACE_RESOLUTION_CHAIN` defines the 5-level precedence: `workspace+surface+region → workspace+surface → workspace → cross-workspace → system`.

**routeSyncWorkspace** (`src/engines/route-sync-workspace.ts`):
- Same shape, same determinism, same first-hit-wins semantics as the v2 `routeSync`.
- **STRICT per-tier lookups** via `uiComponentStore.list()` (NOT `resolve()` — the latter walks its own 6-level provider chain and would misreport tiers).
- Card kinds: `doc`, `video`, `audio`, `image`, `stream`, `automation`, `agent`, `shell`, `chat`.
- Each kind maps to a slot id: `docs.viewer`, `media.player`, `automation.builder`, `agents.canvas`, `shell.terminal`, `chat.*`.
- 3D z-depth is data-driven from routeSyncWorkspace output (the `zDepth` field on `ResolvedWorkspaceSurface`); the shell stays dumb (P2) — no hardcoded transforms.

**WorkspaceEngine** (`src/engines/workspace-engine.ts`):
- `switchWorkspace(from, to, userId)` re-couples a new `routeSyncWorkspace` under a new traceId and emits `workspace:switched` → SSE forwarder → canvas re-resolves (bundle 02 §D re-coupling).

### 3.3 Automation Builder (Phase 2 §3)

**AutomationBuilder** (`src/engines/automation-builder.ts`):
- Reuses the existing WorkflowEngine `WorkflowNode`/`WorkflowEdge` model.
- Each automation = a `WorkflowDefinition` row + a `UnifiedCapability` (`cap:automation:<slug>`).
- `execute(automationId)` walks the DAG from the trigger node, invoking each node's capability, until completion or a HITL gate (pauses as `hitl` status).
- The builder publishes automation nodes as CanvasDefinition cards (live-editable, no rebuild — invariant 7).
- `updateGraph(id, nodes, edges)` live-edits the DAG and emits `automation:updated`.

**100 core automations** (`src/seeds/canvas/automations.ts`):
- 10 categories × 10 automations:
  1. Document workflows (summarize, extract-entities, translate, OCR, redact-PII, doc-to-slides, doc-to-audio, index, compare, archive)
  2. Media workflows (transcribe-and-clip, extract-thumbnails, audio-to-text, generate-subtitles, compress, extract-audio, splice, detect-scenes, watermark, normalize)
  3. Routing (route-message-to-{notion,slack,email,lineargit,github,jira,asana,trello,discord,telegram})
  4. Digest ({daily,weekly,monthly,quarterly,hourly,morning,evening,weekend,monday,friday}-digest)
  5. Research (research-{topic,competitor,market,trend,paper,patent,news,social,review,influencer})
  6. Content (draft-{blog,social,newsletter,tweet,linkedin,medium,press,ebook,podcast,video-script})
  7. Monitoring (monitor-{uptime,sentiment,mentions,keywords,competitor-pricing,seo-rank,stock,crypto,weather,traffic})
  8. Backup (backup-{db,conversations,documents,media,agents,automations,workspaces,annotations,memory,config})
  9. Agent events (invoke-agent-on-{new-doc,new-message,new-media,workspace-switch,tier-upgrade,provider-added,automation-completed,hitl-requested,error,boot})
  10. Maintenance (maintenance-{cleanup-inactive,dedupe-conversations,archive-old,vacuum-db,reindex-search,prune-logs,rotate-keys,compact-memory,refresh-seeds,verify-invariants})

### 3.4 Agents Builder (Phase 2 §4)

**AgentsBuilder** (`src/engines/agents-builder.ts`):
- Composes `AutonomousTask` / `AutonomousStep` / `HitlGate` (prisma/schema.prisma L19) into reusable agent definitions via the same visual DAG + card model.
- Step kinds: `perceive`, `think`, `act`, `reflect`, `hitl`, `memory`, `tool`, `output`.
- `invoke(agentId)` walks the step DAG from the entry step, looping up to `maxLoopIterations`. HITL gates pause the run.
- Reuses `PolicyRule` (rate-limit, no-destructive) and `HitlGate` (approve-action, review-output) for guardrails.
- 3 sample agents seeded: `research-assistant` (6 steps), `content-curator` (5 steps), `inbox-triager` (5 steps).

### 3.5 CLI two-way bridge (Phase 2 §NEW DIRECTIVE)

**The canvas is now a first-class CLI surface, not just a viewer.**

**ShellCommandEngine** (`src/engines/shell-command-engine.ts`):
- Implements `cap:canvas:shell-command`.
- Dispatches a CLI command string through the SAME `ShellCommandStore` (CommandRegistry) the thin CLI client uses.
- Longest-prefix-match resolution: `admin db status` matches `['admin','db','status']` before `['admin','db']` before `['admin']`.
- Streams `ShellCommandOutputChunk` events (status → stdout → stderr → complete) via the optional sink → SSE forwarder → canvas shell card.
- Emits `shell:command:executed` on the bus for audit (traceId, capabilityId, ok, exitCode, durationMs).

**CommandRegistry** (`src/storage/contracts/shell-command-store.ts` + `src/storage/impl/memory-shell-command-store.ts`):
- `register(spec)` — add a CommandSpec (path + capabilityId + handler).
- `resolve(command)` — longest-prefix-match → `{ spec, args }` or null.
- `execute(spec, args, ctx)` — invoke the handler; returns `ShellCommandResult`.
- 17 default commands registered by `src/cli/commands/shell.ts`:
  - `admin db status | migrate | reset`
  - `admin invariants check`
  - `list conversations | providers | workspaces | automations | agents`
  - `resolve canvas`
  - `open document | video | audio`
  - `publish component | patch component`
  - `run automation | invoke agent`
  - `help`

**Frontend ShellCard** (`src/components/canvas/cards/ShellCard.tsx`):
- Dark terminal UI with command history.
- POSTs to `/api/canvas/shell` → `ShellCommandEngine.execute` → returns `ShellCommandResult`.
- Displays stdout (green), stderr (red), exit code + duration + capabilityId.
- The shell card is itself a sandboxed CanvasDefinition (invariant 4).

**Invariant 5 (One Entry Point) preserved**: the canvas shell and the thin CLI client share ONE transport — `cap:canvas:shell-command` via `POST /api/canvas/shell`. No second transport.

---

## 4. routeSyncWorkspace validation matrix — 20/20 ✅

```
$ bun test tests/route-sync-workspace.test.ts

Block 11 — Workspace resolution tiers (S101–S110)    10/10 ✅
Block 12 — Workspace switch + re-resolve (S111–S120) 10/10 ✅

20 pass, 0 fail — 40 expect() calls
```

Key scenarios:
- **S101**: global workspace `docs.viewer` → `workspace+surface` tier (ws:global|docs override wins)
- **S102**: child workspace `docs.viewer` → `cross-workspace` tier (no override → global shared)
- **S103**: research workspace `automation.builder` → `workspace+surface` tier
- **S104**: global workspace `automation.builder` → `cross-workspace` tier
- **S105**: media.card cross-workspace shared (same component id across workspaces)
- **S108**: z-depth propagates from the workspace surface row
- **S109**: 6 card kinds resolved in one pass
- **S110**: unknown card kind → system default
- **S111**: switch global → research re-resolves automation.builder tier
- **S115–S119**: slotId mapping (doc→docs.viewer, video→media.player, automation→automation.builder, agent→agents.canvas, shell→shell.terminal)

**Plus the v2 baseline preserved**: 100/100 original routeSync tests still pass (S01–S100).

---

## 5. CLI two-way bridge tests — 15/15 ✅

```
$ bun test tests/cli/shell-command.test.ts

CLI two-way bridge — CommandRegistry     5/5 ✅
CLI two-way bridge — ShellCommandEngine  10/10 ✅

15 pass, 0 fail
```

Key scenarios:
- Longest-prefix-match: `admin db status` matches the 3-word spec
- Args pass-through: `open document /path/to/file.pdf` → args=`['/path/to/file.pdf']`
- Unknown command returns null
- 17 default commands registered
- `execute("admin db status")` returns ok + exitCode=0 + stdout contains "automation: 100 rows"
- `execute("admin invariants check")` lists all 13 invariants including the 3 new Phase 2 ones
- `execute("help")` lists all available commands
- Unknown command → exitCode=127 (POSIX "command not found")
- Chunks stream via the sink (status → stdout → complete)
- `shell:command:executed` event emitted on the bus
- `dispatch(cap:canvas:shell-command)` routes through the same path as `execute`
- Workspace context propagates to handlers

---

## 6. verify-cross-surface — 12/12 ✅

```
$ bun run devops:verify-cross-surface

═ verify-cross-surface ═════════════════════════════════════════
  ✓  engine:routeSync                     slots=2 traceId=01KXS74VPZ1T
  ✓  parity:frontend=backend              ResolvedSurface shape matches useResolvedNodes
  ✓  invariant:P8-allowInlineScript       
  ✓  invariant:B2-store-contracts         6 stores wired via contracts
  ✓  sdk:G1-exports                       6 exports present
  ✓  live-config:G2-exports               3 exports present
  ✓  phase2:engines                       9 Phase 2 engines exported
  ✓  phase2:routeSyncWorkspace            5 cards resolved
  ✓  phase2:cli-two-way                   cap:canvas:shell-command ok (17 commands)
  ✓  phase2:100-automations-seed          100 automations
  ✓  phase2:workspace-taxonomy            5-level workspace chain
  ✓  phase2:frontend-backend-two-way      /api/canvas/shell → ShellCommandEngine
═ ═════════════════════════════════════════════════════════════
  12/12 checks passed — CROSS-SURFACE OK
```

---

## 7. Invariants — all preserved (none bent)

| # | Invariant | Status | Evidence |
|---|---|---|---|
| 1 | Governor Canon — only ChromeGovernor touches CDP | ✅ | No engine imports `BunCdpClient`. `MediaBridge` is media-only (no CDP). `grep -r "BunCdpClient" src/` returns nothing. |
| 2 | Store Contracts — engines depend on `contracts/*`, not `impl/*` | ✅ | All 9 Phase 2 engines import from `../storage/contracts/*.js`. verify-cross-surface check #4 passes. |
| 3 | Frontend = Backend — slug is the link, no hardcoded provider conditionals | ✅ | `CanvasSurface`, `CanvasNode`, all 5 new card components, `WorkspaceSwitcher`, `ShellCard` — zero `if (provider === '...')` branches. |
| 4 | UI-is-Data — sandboxed iframe + CSP, `allowInlineScript: false` literal | ✅ | `SandboxedNode.tsx` unchanged from v2. New cards (Doc/Media/Automation/Agent/Shell) are CanvasDefinition rows rendered via the same sandbox path. |
| 5 | One Entry Point — every action is a UnifiedCapability | ✅ | All Phase 2 engine actions are `cap:*` capabilities dispatched via `/api/capabilities/:id/execute` (or the engine's `dispatch()` method). The CLI two-way bridge (`cap:canvas:shell-command`) shares the SAME transport — no second transport. |
| 6 | No `any` | ✅ | `bun run typecheck` passes with `strict: true`. All boundary types use `unknown` + narrowing. |
| 7 | Live, not build — publish = DB write + event, never a compile | ✅ | Automation/Agent `updateGraph`/`updateDag` are row writes + bus emits. Document/Media `open` are row writes + bus emits. Shell command registration is in-memory + event. No `next build` triggered. |
| **NEW** | FRONTEND=BACKEND two-way | ✅ | `cap:canvas:shell-command` dispatches through the SAME `ShellCommandStore` the thin CLI client uses. `/api/canvas/shell` → `ShellCommandEngine` → `CommandRegistry.resolve` → `CommandSpec.handler`. The canvas shell card sends commands; the same registry resolves them. |

---

## 8. Browser-verified runtime

The Phase 2 canvas was loaded in a real browser via `agent-browser`:

- **Page loads** at `http://localhost:3000/` — 200 OK
- **Workspace switcher** renders: Global (z=0, 6 surfaces) + Research Lab (z=1) + Content Team (z=1) + Automation Lab (z=1) + "New workspace" button
- **6 surface tabs** render: 💬 Chat · 📄 Documents · 🎬 Media · ⚡ Automation · 🤖 Agents · ⌨️ Shell
- **Chat surface**: 13 sandboxed iframes (v2 baseline preserved)
- **Documents surface**: 2 doc cards (markdown "Welcome to Vivim" + TypeScript "sample.ts")
- **Media surface**: video card (Big Buck Bunny, VLC engine badge) + audio card
- **Shell surface**: dark terminal card with `cap:canvas:shell-command` badge, `help` command executed (exit=0)
- **`POST /api/canvas/shell`** returns full `admin db status` output: 5 provider_type, 13 primitive, 22 ui_component, 16 provider_definition, 3 workspace, 4 document, 2 media, 100 automation, 3 agent, 248 trace_entry rows
- **`GET /api/workspace/list`** returns 4 workspaces (global + 3 children) with full surface+region taxonomy
- **`GET /api/automation/list`** returns 100 automations across 10 categories

Screenshots: `download/vivim-phase2-docs.png`, `download/vivim-phase2-media.png`, `download/vivim-phase2-shell.png`

---

## 9. How to run

```bash
# Dev server (already running)
bun run dev                           # → http://localhost:3000/

# Type-check (0 errors)
bun run typecheck

# Lint (0 errors, 0 warnings)
bun run lint

# All tests (135 pass: 100 v2 + 20 workspace + 15 CLI)
bun test tests/

# Cross-surface verify (12/12 checks)
bun run devops:verify-cross-surface

# Scaffold a new plugin (v2 G3, still works)
bun run canvas:scaffold my-plugin

# Activate the sample plugin (v2 G1+G2, still works)
bun plugins/sample-plugin/src/sdk-hook.ts
```

---

## 10. Architectural notes

- **routeSyncWorkspace uses STRICT per-tier lookups** via `uiComponentStore.list()`, NOT `uiComponentStore.resolve()`. The latter walks its own 6-level provider chain, which would find cross-workspace rows and misreport them as workspace-tier hits. This was the only bug found during Phase H testing, fixed by switching to direct `list()` + filter by `(scope, ownerId, variant)`.

- **MediaBridge is a contract, not an impl.** The `MemoryMediaBridge` stub returns canned frames + a fake transcript so the canvas renders without a real libvlc binary. Production swaps in `VlcMediaBridge` (a native libvlc node addon) with zero engine changes (B2 invariant). The bridge NEVER touches CDP — it's media-only (Governor Canon preserved).

- **The CLI two-way bridge reuses the existing CommandRegistry shape.** The thin CLI client (`src/cli/commands/shell.ts`) registers 17 multi-word commands. The canvas ShellCard POSTs to `/api/canvas/shell`, which dispatches through the SAME registry. There is no second transport — invariant 5 (One Entry Point) is preserved.

- **100 automations are seeded into `ws:automation-lab`** (not `ws:global`), matching the spec's "default automation workspace". The Automation surface fetches by `workspaceId`, so switching to Automation Lab surfaces them.

- **3D z-depth is data-driven.** `WorkspaceTaxonomy.zDepth` tracks workspace stack depth (0=global, 1=child). `WorkspaceSurface.zDepth` tracks surface depth within a workspace (0=chat, 1=docs, …, 5=shell). The shell reads these from `routeSyncWorkspace` output and applies CSS transforms — no hardcoded 3D logic.

- **No new Prisma migrations** (per PRD risk note). All Phase 2 work uses the existing table shapes (`ui_component`, `provider_type`, `primitive`, `user_component_layout`, `view_preset`) plus in-memory stores for the new tables (`workspace`, `document`, `media`, `automation`, `agent`, `hitl_gate`, `policy_rule`, `shell_command`). Production swaps the memory impls for Prisma impls with zero engine changes (B2 invariant).

- **The v2 baseline is fully preserved.** All 100 original routeSync tests (S01–S100) still pass. The v2 CanvasSurface, CanvasNode, SandboxedNode, and LiveConfigProvider are unchanged. Phase 2 extends; it does not break.
