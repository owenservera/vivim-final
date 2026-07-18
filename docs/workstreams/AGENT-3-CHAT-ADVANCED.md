# Agent 3 — Chat Advanced Capabilities & Memory/Knowledge

**Workstream:** Chat Advanced Capabilities (Phase 102a/b) + Memory & Knowledge (Phase 105)
**Units:** 17
**Source:** `docs/roadmap/PRODUCTION-MASTER-PLAN-AUDIT.md`

---

## Context

**Critical audit finding:** 8 capabilities claimed "exists" in the original plan were only string names in provider JSON manifests, NOT registered `UnifiedCapability` entries in `capability-bootstrap.ts`. They need backend registration FIRST, then UI wiring.

The 50 capabilities actually registered are: conversation (4), knowledge (3), memory (3), user (6), admin (16), system (2), provider (1), telemetry (2), nlcl (1), oracle (6), discovery (6).

Your mission: create the 8 missing chat capabilities as proper `UnifiedCapability` entries, wire their UI, then surface memory/knowledge features that already have backend engines but no UI.

---

## Phase 102a: Backend Capability Registration (5 units)

Every capability uses the `makeCapability()` pattern. Reference `Recipe A` from AGENTS.md. Each must have: `id`, `slug`, `name`, `description`, `category`, `inputSchema`, `outputSchema`, `cliCommand`, `ui`, `mcpToolName`, `apiEndpoint`, `surfaces: ALL_SURFACES`.

### 102.1 — Register `provider:select_model` Capability

**File:** `src/engines/capability-bootstrap.ts`
**Depends:** — **Produces:** 102.1

**Design:** User clicks model selector in provider UI → CDP click on model dropdown → CDP click on target model

**Capability contract:**
```ts
makeCapability({
  id: 'cap:provider:select_model',
  slug: 'provider_select_model',
  name: 'Select Model',
  description: 'Switch the provider model (e.g. GPT-4o to GPT-4).',
  inputSchema: { type: 'object', properties: { modelName: { type: 'string' } }, required: ['modelName'] },
  outputSchema: { type: 'object' },
  cliCommand: { name: 'provider select-model', aliases: ['psm'], examples: ['provider select-model chatgpt gpt-4'] },
  ui: { component: 'model-selector', position: 'header', order: 2 },
  mcpToolName: 'provider_select_model',
  apiEndpoint: { method: 'POST', path: '/api/providers/{id}/select-model' },
}, async (input) => {
  const modelName = String(input.modelName)
  const providerId = String(input.providerId ?? 'chatgpt')
  const acct = await services.db.prisma.providerAccount.findFirst({ where: { providerId } })
  if (!acct) throw new Error('No account for provider')
  const slaveId = `slave:${providerId}:${acct.id}`
  // CDP flow: click model selector → wait for dropdown → click model
  // Use services.governor.cdp.send(slaveId, ...) for each step
  return { ok: true, modelName }
})
```

**Handler implementation:** The handler uses `ChromeGovernor.cdp` proxy to:
1. Click the model selector button (provider-specific selectors from `provider-selectors.ts`)
2. Wait 500ms for dropdown
3. Click the target model option by text match
4. Return `{ ok, modelName }`

**Test Contract:** Capability registered in registry. Handler signature accepts `{ modelName }`.

---

### 102.2 — Register `provider:upload_file` Capability

**File:** `src/engines/capability-bootstrap.ts`
**Depends:** — **Produces:** 102.2

**Design:** User drops/selects file → saved to `uploads/` → CDP interaction clicks file input, sets file path

**Capability contract:**
```ts
makeCapability({
  id: 'cap:provider:upload_file',
  slug: 'provider_upload_file',
  name: 'Upload File',
  description: 'Upload a file to the provider conversation.',
  inputSchema: { type: 'object', properties: { filePath: { type: 'string' }, filename: { type: 'string' } }, required: ['filePath'] },
  outputSchema: { type: 'object' },
  cliCommand: { name: 'provider upload-file', aliases: ['puf'], examples: ['provider upload-file chatgpt ./report.pdf'] },
  ui: { component: 'file-upload', position: 'composer', order: 4 },
  mcpToolName: 'provider_upload_file',
  apiEndpoint: { method: 'POST', path: '/api/providers/{id}/upload-file' },
}, async (input) => {
  const filePath = String(input.filePath)
  const filename = String(input.filename ?? filePath.split('/').pop() ?? 'file')
  // 1. Copy file to uploads/ directory
  // 2. CDP: click hidden file input → set file via CDP DOM.setFileInputFiles or Input.setFiles
  // 3. Wait for upload completion indicator
  return { ok: true, filename }
})
```

**Test Contract:** Capability registered. Handler signature accepts `{ filePath }`.

---

### 102.3 — Register `provider:edit_message` Capability

**File:** `src/engines/capability-bootstrap.ts`
**Depends:** — **Produces:** 102.3

**Design:** User clicks edit on a message → message text appears in composer → user edits → re-send

**Capability contract:**
```ts
makeCapability({
  id: 'cap:provider:edit_message',
  slug: 'provider_edit_message',
  name: 'Edit Message',
  description: 'Edit a previously sent message and re-submit.',
  inputSchema: { type: 'object', properties: { newText: { type: 'string' } }, required: ['newText'] },
  outputSchema: { type: 'object' },
  cliCommand: { name: 'provider edit-message', aliases: ['pedit'], examples: ['provider edit-message claude "corrected text"'] },
  ui: { component: 'action-button', position: 'message', order: 1 },
  mcpToolName: 'provider_edit_message',
  apiEndpoint: { method: 'POST', path: '/api/conversations/{id}/messages/{mid}/edit' },
}, async (input) => {
  // CDP flow: click edit button on message → clear composer → type new text → click send
  // This is effectively a re-send pipeline with the old text replaced
  return { ok: true, text: String(input.newText) }
})
```

**Test Contract:** Capability registered.

---

### 102.4 — Register `provider:regenerate` Capability

**File:** `src/engines/capability-bootstrap.ts`
**Depends:** — **Produces:** 102.4

**Design:** User clicks regenerate → CDP click on the regenerate/retry button → capture new response

---

### 102.5 — Register `provider:new_chat` Capability

**File:** `src/engines/capability-bootstrap.ts`
**Depends:** — **Produces:** 102.5

**Design:** User clicks "New Chat" → CDP navigate to provider new-chat URL → create new conversation in vivim DB

---

## Phase 102b: UI Wiring (7 units)

### 102.6 — Model Selector Dropdown

**File:** `web/sandbox/src/features/conversation-surface.tsx`
**Depends:** 102.1 → **Produces:** 102.6

Add a `<select>` dropdown in the chat header showing available models for the provider. On change: execute `provider_select_model` capability. Fetch model list from `GET /api/providers/{id}/models`.

### 102.7 — File Upload UI

**Files:** `web/sandbox/src/features/conversation-surface.tsx`, `src/server/conversation-router.ts`
**Depends:** 102.2 → **Produces:** 102.7

Add drag-drop zone below composer. On drop: save file to `uploads/`, create attachment row, execute `provider_upload_file` capability.

### 102.8 — Edit Message Button

**File:** `web/sandbox/src/features/conversation-surface.tsx`
**Depends:** 102.3 → **Produces:** 102.8

Add an edit icon on hover of user messages in the message list. On click: populate composer with message text, execute `provider_edit_message` on re-send.

### 102.9 — Regenerate Button

**File:** `web/sandbox/src/features/conversation-surface.tsx`
**Depends:** 102.4 → **Produces:** 102.9

Add a regenerate icon on hover of assistant messages. On click: execute `provider_regenerate` capability.

### 102.10 — FTS5 Search Bar

**Files:** `web/sandbox/src/features/conversation-list.tsx`, `src/server/conversation-router.ts`
**Depends:** — **Produces:** 102.10

Add search bar above conversation list. On type (debounced 300ms): search via `POST /api/conversations/search` body `{ query }`. Backend: `services.db.searchMessages(query)` already exists — wire the route.

### 102.11 — Export Conversations

**File:** `web/sandbox/src/features/workspace-settings.tsx`
**Depends:** — **Produces:** 102.11

Add "Export" button in settings. Calls `ExportEngine.export()` with format=json. Downloads file.

### 102.12 — Import Conversations

**Files:** `web/sandbox/src/features/provider-manager.tsx`, `src/server/conversation-router.ts`
**Depends:** — **Produces:** 102.12

Add "Import" section. File picker → `POST /api/knowledge/ingest` with file. Show progress. Backend: `KnowledgeIngestionEngine.ingest()` already exists.

---

## Phase 105: Memory & Knowledge (6 units)

### 105.1 — Memory Context Panel

**File:** `web/sandbox/src/features/conversation-surface.tsx`
**Depends:** — **Produces:** 105.1

Show memory context in a collapsible sidebar panel during conversation. Fetch from `memory:query` capability. Show: relevant facts, recent episodes, applicable procedural rules.

### 105.2 — Semantic Search Results UI

**File:** `web/sandbox/src/features/conversation-surface.tsx`
**Depends:** 102.10 → **Produces:** 105.2

Extend FTS5 search to also run semantic search (`knowledge:search` capability). Show results in two tabs: "Text Match" (FTS5) and "Semantic" (embeddings).

### 105.3 — Cross-Conversation Synthesis Display

**File:** `web/sandbox/src/features/conversation-surface.tsx`
**Depends:** — **Produces:** 105.3

Add "Synthesize" button that runs `knowledge:synthesize` capability. Shows cross-conversation themes, recurring entities, decision patterns. Backend: `CrossConversationSynthesizer` already exists.

### 105.4 — Knowledge Ingestion Progress UI

**File:** `web/sandbox/src/features/provider-manager.tsx`
**Depends:** — **Produces:** 105.4

Show import progress: file parsing % → conversation import % → entity extraction %. Poll `GET /api/knowledge/ingest/{jobId}` for status.

### 105.5 — Entity Extraction Cards

**File:** `web/sandbox/src/features/conversation-surface.tsx`
**Depends:** — **Produces:** 105.5

Show extracted entities (people, organizations, dates, topics) as chips/cards in a sidebar panel. Fetch from `memory:query` with `action: 'entity_extraction'`.

### 105.6 — Decision Tracking Timeline

**File:** `web/sandbox/src/features/conversation-surface.tsx`
**Depends:** — **Produces:** 105.6

Show decisions made across conversations as a timeline. Fetch from `cross-conversation-synthesis` store. Render as vertical timeline with: decision text, date, confidence, related conversations.

---

## Gate Checklist

```powershell
# Per unit
bun run typecheck                         # 0 errors
bun test tests/unit/engines/capability-bootstrap.test.ts  # verify new caps
bun run devops runtime-test test-cap --slug=provider_select_model --input='{"modelName":"gpt-4"}'

# Final
bun test                                   # all pass
bun run devops verify-cross-surface        # new caps resolve
```

## ⚠️ File Conflict: `capability-bootstrap.ts`

Agent 1 also touches this file. **Your changes go FIRST.** Add 5 new `makeCapability()` calls at the bottom of the `defaults` array inside `registerDefaultCapabilities()`, before the closing `]`. Do NOT reorder existing entries. Agent 1 wraps existing handler closures with consent gates — your new entries go below theirs.

## ⚠️ File Conflict: `conversation-surface.tsx`

This is a 554-line component. Agent 4 does NOT touch it. But adding 7 features risks making it a god component. **Extract before adding.** Refactor existing sections into sub-components first:
- `web/sandbox/src/features/chat/MessageList.tsx` — message rendering
- `web/sandbox/src/features/chat/Composer.tsx` — input + send
- `web/sandbox/src/features/chat/ModelSelector.tsx` — NEW (102.6)
- `web/sandbox/src/features/chat/FileUploader.tsx` — NEW (102.7)
