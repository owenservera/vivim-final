# 04 — Upgrade Engines: Detailed Design for Each New + Modified Engine

> **Status:** PROPOSED | **Date:** 2026-07-11

This document provides the full execution flow, error mapping, integration points, and test contract for each engine. For the TypeScript interface, see Doc 02. For the store contract, see the same.

---

## New Engines

### KnowledgeIngestionEngine

**Execution Flow:**
1. `ingest(config)` → creates ImportJob row (status=pending)
2. Reads file from `config.filePath`
3. Detects format from `config.source` (chatgpt/claude/gemini/generic)
4. Calls format-specific parser (ChatGPT/Claude/Gemini parser)
5. For each parsed conversation:
   a. Checks for duplicate via `store.findExistingConversation(source, externalId)`
   b. If duplicate and `config.deduplicate` → skip
   c. Creates `Conversation` row with `source='imported'`, `externalId`
   d. For each message → creates `ConversationMessage` + `StreamBlock`
6. If `config.extractEntities` → calls `KnowledgeExtractor.batchExtract()`
7. If `config.generateEmbeddings` → calls `SemanticSearchEngine.indexBatch()`
8. Updates ImportJob status=complete, writes result
9. Emits `knowledge:imported` event

**Error Mapping:**

| Error | When | Recovery |
|-------|------|----------|
| `FileNotFoundError` | File doesn't exist | Return error, mark job failed |
| `ParseError` | Unknown format | Fall back to generic JSON parser |
| `DuplicateError` | Already imported | Skip, increment duplicatesSkipped |
| `ExtractionError` | Extractor fails | Continue without extraction |

**Integration Points:**
- Calls: KnowledgeExtractor, SemanticSearchEngine, ConversationStore
- Called by: Server route `POST /api/knowledge/ingest`, CLI `vivim knowledge ingest`
- Emits: `knowledge:imported`, `knowledge:extraction_complete`

**Tests:**
- Ingest ChatGPT export → conversations created with correct source/externalId
- Ingest Claude export → conversations created
- Duplicate detection skips already-imported conversations
- Extraction runs after ingestion if enabled
- Import job status transitions correctly
- Error in one conversation doesn't fail the whole import
- Large file (1000+ conversations) completes within timeout

---

### KnowledgeExtractor

**Execution Flow:**
1. `extractFromMessage()` → analyze content for patterns
2. Entity extraction: regex + keyword matching for names, projects, technologies
3. Decision extraction: pattern matching for "I decided", "we should", "let's go with"
4. Fact extraction: subject-predicate-object triples from assertions
5. For each extraction:
   a. Check if entity/decision/pattern already exists
   b. If exists → update confidence + mention count
   c. If new → create row
   d. Create EntityMention link to source message
6. If `config.llmAssisted` → use LLM for complex extraction (batch mode)

**Error Mapping:**

| Error | When | Recovery |
|-------|------|----------|
| `ExtractionTimeoutError` | LLM call times out | Fall back to regex-only extraction |
| `StoreError` | DB write fails | Log, continue with next extraction |

**Tests:**
- Extract entities from coding conversation (React, TypeScript, Jest)
- Extract decision ("we decided to use PostgreSQL")
- Extract fact ("React hooks were introduced in v16.8")
- Update existing entity confidence on re-extraction
- Batch extraction processes multiple conversations
- LLM-assisted mode produces richer extractions
- Confidence threshold filters low-quality extractions

---

### SemanticSearchEngine

**Execution Flow:**
1. `index(text, type, id)` → call `embeddingProvider.embed(text)` → store embedding
2. `search(query)` → embed query text → cosine similarity against all embeddings → return top-N
3. `searchHybrid()` → combine semantic results with keyword search (SQL LIKE)
4. `reindexAll()` → iterate all conversations/messages → re-embed

**Error Mapping:**

| Error | When | Recovery |
|-------|------|----------|
| `EmbeddingProviderError` | Embedding API fails | Skip, log error, continue |
| `DimensionsMismatchError` | Embedding dims != stored | Delete old, re-index |

**Tests:**
- Index a message → search finds it with high score
- Search for similar concept returns related messages
- Hybrid search combines semantic + keyword results
- Reindex updates stale embeddings
- Empty query returns empty results
- Threshold filters low-relevance results

---

### ProviderMuxEngine

**Execution Flow:**
1. `mux(request)` → determine target providers (from request or auto-route)
2. Create MuxSession row (status=pending)
3. If strategy=fan_out → dispatch to all providers simultaneously (Promise.allSettled)
4. If strategy=round_robin → dispatch one at a time until success
5. If strategy=cost_optimized → sort by cost, dispatch cheapest first
6. For each response → create MuxResponse row
7. If `synthesisEnabled` → call `synthesize()` to merge responses
8. Update MuxSession with results
9. If learned routing → update RoutingPreference scores
10. Emit `mux:complete` event

**Error Mapping:**

| Error | When | Recovery |
|-------|------|----------|
| `AllProvidersFailedError` | All dispatches fail | Return error, suggest manual retry |
| `TimeoutError` | Provider exceeds timeoutMs | Kill, try next provider |
| `CostBudgetExceededError` | Total cost exceeds budget | Stop dispatching, return partial results |
| `SynthesisError` | LLM synthesis fails | Return best single response |

**Tests:**
- Fan-out to 3 providers → all responses captured
- Round-robin tries providers in order, stops on first success
- Failover: first provider fails, second succeeds
- Cost budget exceeded → stops dispatching
- Synthesis merges responses into coherent answer
- Routing preference updated after successful dispatch
- Timeout kills slow provider

---

### SituationDetector

**Execution Flow:**
1. `detect(input)` → analyze message + history
2. Pattern matching against task type indicators:
   - coding: code blocks, function names, error messages, file extensions
   - writing: "write", "article", "draft", "essay"
   - researching: "search", "find", "compare", "what is"
   - planning: "plan", "schedule", "organize", "roadmap"
   - debugging: "error", "bug", "crash", "stack trace"
3. Score each type by matched signal count × weight
4. Return highest-scoring type with confidence
5. Log to SituationLog

**Tests:**
- "How do I fix this TypeError?" → detects 'debugging'
- "Write a blog post about AI" → detects 'writing'
- "Compare PostgreSQL vs MySQL" → detects 'researching'
- Code-heavy conversation → detects 'coding'
- Ambiguous message → returns 'general' with low confidence
- History improves detection accuracy

---

### ContextAssemblyEngine

**Execution Flow:**
1. `assemble(conversationId, userMessage)`:
   a. DETECT → call `SituationDetector.detect(message)`
   b. RECALL → gather context from memory:
      - `memoryEngine.getAgentContext()` for recent episodes/facts/rules
      - `searchEngine.search(message)` for semantically relevant content
   c. RANK → score each context piece by relevance to detected situation
   d. BUDGET → allocate token budget across layers
   e. INJECT → format into system prompt, return AssembledContext
2. Store each layer in ContextLayerRow
3. If truncated → log which layers were cut

**Tests:**
- Coding task → code-related context prioritized
- Token budget respected (total ≤ budget)
- High-priority layers preserved when truncating
- Pre-warm creates context ahead of need
- Check pre-warm hits updates entry

---

### UnifiedCapabilityRegistry

**Execution Flow:**
1. `register(capability)` → validate schema → store in map
2. `execute(id, input, ctx)` → validate input against schema → call handler → return result
3. `exportForCli()` → return array for CLI registration
4. `exportForMcp()` → return array for MCP server
5. `exportForWorkflow()` → return array for workflow node types

**Tests:**
- Register capability → appears in list
- Execute with valid input → handler called
- Execute with invalid input → validation error
- Export for CLI → correct format
- Export for MCP → correct format
- Filter by surface → only matching capabilities
- Unregister removes from all exports

---

### AutonomousExecutionEngine

**Execution Flow:**
1. `execute(goal)`:
   a. Create AutonomousTask (status=planning)
   b. Plan: decompose goal into steps (using LLM or rule-based planner)
   c. For each step:
      - Classify action via `ExecutionPolicyEngine.classify()`
      - If requires approval → create HitlGate, pause execution
      - Execute action via `UnifiedCapabilityRegistry.execute()` or Governor CDP
      - Record result in AutonomousStep
      - If failed → check retry policy, retry or fail task
   d. Mark task complete/failed
   e. Emit `autonomous:complete` event

**Tests:**
- Simple goal (navigate + screenshot) completes without approval
- Destructive action triggers HitlGate
- resolveGate(approve) resumes execution
- resolveGate(deny) fails the step gracefully
- Max steps limit prevents infinite loops
- Cancel marks task as cancelled
- Replay re-executes from specific step

---

### ExecutionPolicyEngine

**Execution Flow:**
1. `evaluate(action, input)`:
   a. Classify action (read/write/navigate/destructive/financial)
   b. Check policy rules for matching conditions
   c. Check cooldown: has this action been called too many times in window?
   d. Return PolicyDecision (allowed, requiresApproval, reason)

**Tests:**
- Read action → allowed, no approval
- Write action → allowed, requires approval
- Destructive action → allowed, requires approval
- Cooldown exceeded → blocked
- No matching rule → default to 'write' classification

---

### EncryptionEngine

**Execution Flow:**
1. `unlock(passphrase)` → derive key via PBKDF2 → store in memory
2. `encrypt(plaintext)` → generate IV → AES-256-GCM encrypt → return {ciphertext, iv, salt, authTag}
3. `decrypt(encrypted)` → verify authTag → AES-256-GCM decrypt → return plaintext
4. `encryptField(value)` → encrypt → base64 encode for storage
5. `decryptField(value)` → base64 decode → decrypt → return plaintext

**Tests:**
- Encrypt then decrypt returns original
- Wrong passphrase fails to unlock
- Auth tag verification catches tampering
- Field-level encryption works transparently
- Change passphrase re-encrypts data

---

### ExportEngine

**Execution Flow:**
1. `export(options)`:
   a. Determine tables to export based on scope
   b. For each table → query all rows → format as JSON/CSV
   c. Write to output file
   d. If encrypted → encrypt entire output
   e. Return ExportResult with stats

**Tests:**
- Full export includes all tables
- Conversations-only export includes conversation + messages + blocks
- JSON format is valid and re-importable
- CSV format has correct headers
- Encrypted export requires passphrase to read
- Large export (100k rows) completes without OOM

---

### AirGapEngine

**Execution Flow:**
1. `enable()` → set air-gap mode, disable cloud provider access
2. `checkNetwork()` → attempt DNS resolution, return false if fails
3. `checkLocalModel()` → ping local model endpoint, return availability
4. `routeToLocalModel(message)` → POST to local model endpoint → parse response

**Tests:**
- Enable air-gap → cloud providers unavailable
- Disable air-gap → cloud providers available
- Network check returns correct status
- Local model routing works with Ollama
- Fallback to cloud when local model unavailable (if configured)

---

### SyncEngine

**Execution Flow:**
1. `pair(deviceId, name)` → generate pairing code → create SyncPeer (status=pending)
2. `confirmPair(deviceId, code)` → verify code → update peer status=paired
3. `sync()`:
   a. Get unsynced SyncLog entries
   b. Encrypt each entry with peer's public key
   c. POST to relay URL
   d. Mark entries as synced
4. Background: log all table writes to SyncLog (via Prisma extension)

**Tests:**
- Pair creates pending peer
- Confirm pair activates peer
- Sync sends unsynced entries
- Conflict resolution: last write wins
- Revoke peer prevents future sync
- Encrypted entries can't be read without private key

---

## Modified Engines (Changes Only)

### ChromeGovernor (Phase 14)

**What changed:** Replace stub CDP with real implementation.
- New private field: `private cdpTransport: CDPTransport | null`
- New method: `setCdpTransport(transport: CDPTransport): void`
- `get cdp()` returns CDPProxy backed by real transport (no stubCdp)
- `recordTrace()` calls `TraceLog.record()` instead of throwing
- `probeHealth()` calls `HealthMonitor.probe()` instead of throwing
- `startHealthProbe()` starts the HealthMonitor timer
- `stopHealthProbe()` stops the HealthMonitor timer

### ConversationManager (Phase 14)

**What changed:** Use real EventBus, wire server.
- Constructor parameter: `eventBus: CapabilityEventBus` (from `./capability-event-bus.js`, not local interface)
- Remove local `CapabilityEventBus` interface declaration (lines 83-85)
- Remove local `StreamParserEngine` re-export (use import from `./stream-parser.js`)
- Remove local `StreamBlockStore` interface (use import)
- Add `getResolvedCapabilities(providerId, planTier)` method for server route

### Router (Phase 14)

**What changed:** Implement missing methods.
- `listRequests(specId, opts)` → calls `store.listRequests(specId, opts)`
- `getEvents(requestId)` → calls `store.getEvents(requestId)`
- RouterStore gains `listRequests()` and `getEvents()` methods

### MemoryEngine (Phase 15)

**What changed:** ULID + 10-type expansion.
- Remove `let idCounter = 0` and local `newId()` function
- Add `import { newId } from '../ids.js'`
- Add methods: `recordEntity()`, `recordDecision()`, `recordPattern()`, `getTopics()`, `getProjects()`
- `recordEpisode()` uses ULID `newId()` from `../ids.js`

### HarnessRuntime (Phase 14)

**What changed:** Wire real context.
- Constructor accepts optional `governor: ChromeGovernor`
- `HarnessContext` methods call Governor CDP:
  - `query(selector)` → `governor.cdp.send(slaveId, 'DOM.querySelector', {selector})`
  - `queryAll(selector)` → `governor.cdp.send(slaveId, 'DOM.querySelectorAll', {selector})`
  - `waitFor(selector, timeout)` → poll loop calling `query()`
  - `getPageState()` → `governor.cdp.getPageState(slaveId)`
  - `intercept(pattern)` → `governor.cdp.capture(slaveId, pattern)`

### AgenticLoopEngine (Phase 19)

**What changed:** Full implementation.
- SENSE: `mirror.projectState(slaveId)` + `observation.onEvent()`
- PLAN: call registered `PlanningStrategy` implementations
- ACT: execute via `registry.execute()` or `governor.cdp.send()`
- OBSERVE: re-project state, collect events
- REFLECT: compare expected vs actual, record `memory.recordEpisode()`
- ADAPT: update rule confidence via `memory.learnFromEpisode()`

### TelemetryAggregator (Phase 14)

**What changed:** Real cron parsing.
- Replace `parseCronNextMs()` stub with real cron expression parser
- Use simple regex-based parser for standard cron format (`*/5 * * * *`)
