# Phase 0 — Product Requirements Document (PRD)

> **Status:** APPROVED | **Date:** 2026-08-02
> **Author:** Vivim Architecture Team | **Version:** 1.0
> **Precedes:** Phase 1 (Mux & Autonomous), Phase 2 (Sovereign & Sync)

---

## 1. Product Overview

Phase 0 is the **surgical gap-close** operation for the Vivim codebase — a precision upgrade that transforms the system from "mostly implemented with stubs" to "fully production-ready for knowledge and memory intelligence." The Vivim platform already contains 27 engine files spanning 11,182 lines of real, working code. Twenty-one of those engines are fully complete. The remaining six contain stub methods that emit events but never persist data, return empty arrays when real data exists, or skip critical logic paths. Phase 0 closes these gaps.

### Why Phase 0 Matters

The Vivim platform's core value proposition is **conversational memory intelligence** — the ability to extract, store, recall, and synthesize knowledge across conversations. Without the 10 new Prisma models, the system has no structured way to represent entities, decisions, patterns, topics, or projects. The MemoryEngine's `recordEntity()`, `recordDecision()`, `recordPattern()`, `getTopics()`, `getProjects()`, and `assignTopic()` methods all emit events into the void, writing nothing to the database. The ContextAssembly engine's `recall()` function returns an empty `conversation_history` layer, meaning the system cannot leverage past conversations when assembling context for new prompts. The SemanticSearch engine's `searchHybrid()` simply delegates to `search()` and `reindexAll()` is a no-op. The ExportEngine's `importJson()` counts records but never writes them back to the database.

These are not minor inconveniences. They are **existential gaps** that prevent the system from fulfilling its primary purpose. A conversational AI that cannot remember entities, track decisions, organize topics, or search across its own memory is fundamentally incomplete. Phase 0 is the bridge from "demo-able" to "deployable."

### What Phase 0 Delivers

Phase 0 delivers 10 implementation units across 4 execution waves, adding 10 new database models, 12 new REST API endpoints, 6 completed engine methods, and full seed data. It is designed to be non-breaking (no existing API signatures change), future-proof (schema and store contracts anticipate all P2/P3 models), and verifiable (each unit has a test contract). The total estimated effort is 3–4 days for a single developer.

### Strategic Positioning

Phase 0 is the **last gate before feature velocity**. Once the memory intelligence tables, store methods, and knowledge API are in place, Phase 1 (mux, autonomous, context) and Phase 2 (sovereign sync, airgap, workspace) can be built on a solid foundation. Every day Phase 0 is delayed is a day the entire roadmap is blocked. This is why Phase 0 is defined as the minimum viable upgrade — it includes nothing that is not essential, and excludes nothing that is.

---

## 2. User Stories

### US-1: Entity Memory Persistence
**As a** knowledge worker, **I want to** have the system automatically recognize and remember entities (people, organizations, technologies) mentioned across my conversations **so that** I can build a persistent knowledge graph without manual data entry.

**Acceptance Criteria:**
- When an entity is mentioned in a conversation, the system creates or updates an `Entity` record with the entity name, type, and confidence score.
- Subsequent mentions of the same entity increment the `mentionCount` field.
- Entities are queryable via `GET /api/knowledge/entities?type=X` with type filtering.
- Entity mentions are linked to specific conversations and messages via `EntityMention` records with snippet context.
- Deleted entities are soft-deleted (`isDeleted = 1`) and excluded from default queries.

---

### US-2: Decision Tracking
**As a** project manager, **I want to** have every decision made during conversations automatically recorded with its rationale and alternatives **so that** I can trace back why a particular path was chosen and revisit alternatives if circumstances change.

**Acceptance Criteria:**
- When a decision is detected in a conversation, the system creates a `DecisionRecord` with `decisionText`, `rationale`, and `alternativesJson`.
- Decisions are linked to the originating conversation via `conversationId`.
- The `isReversed` flag can be set when a decision is superseded.
- Decisions are queryable via `GET /api/knowledge/decisions?conversationId=X`.
- Reversed decisions remain in the database with their flag set, preserving the full audit trail.

---

### US-3: Topic Organization
**As a** researcher, **I want to** organize my conversations into topics with automatic topic assignment and manual topic creation **so that** I can quickly find all conversations related to a specific subject area without reading every conversation.

**Acceptance Criteria:**
- The system supports automatic topic assignment via `ConversationTopic` records with `assignmentType = 'auto'`.
- Users can create topics manually via `POST /api/knowledge/topics` with name, description, and color.
- Users can update topics via `PUT /api/knowledge/topics/:id`.
- Users can delete topics via `DELETE /api/knowledge/topics/:id` (soft delete).
- `GET /api/knowledge/topics` returns all non-deleted topics with their conversation counts.
- Auto-generated topics are flagged with `isAutoGenerated = true` and can be distinguished from manual ones.

---

### US-4: Semantic Search Across Memory
**As a** power user, **I want to** search across all my stored knowledge — entities, decisions, patterns, topics, and conversations — using natural language queries **so that** I can find relevant information even when I don't remember the exact keywords or conversation it came from.

**Acceptance Criteria:**
- `GET /api/knowledge/search?q=X` returns results from all memory types ranked by relevance.
- Hybrid search combines keyword matching (SQL LIKE/FTS5) with semantic vector similarity.
- `MemoryEmbedding` records store pre-computed vectors for each entity type.
- `SemanticSearch.reindexAll()` rebuilds the vector index from scratch when data changes significantly.
- `SemanticSearch.searchHybrid()` merges keyword and vector results with configurable weights.
- Search results include the source type, entity ID, and relevance score.

---

### US-5: Cross-Conversation Synthesis
**As a** analyst, **I want to** synthesize knowledge across multiple conversations to identify patterns, common themes, and evolving decisions **so that** I can see the big picture that emerges from dozens of individual conversations.

**Acceptance Criteria:**
- `POST /api/knowledge/synthesize` accepts a query and returns a synthesized summary drawing from multiple conversations.
- The synthesis engine references entities, decisions, patterns, and topics across conversations.
- The response includes source references (conversation IDs, entity IDs) so the user can verify the synthesis.
- The synthesis respects the `isDeleted` flag on all referenced records, excluding soft-deleted items.
- Synthesis results are cached for 5 minutes to avoid redundant computation for identical queries.

---

### US-6: Import Provider Exports
**As a** user migrating from another AI tool, **I want to** upload my conversation history from other providers (ChatGPT, Claude, etc.) and have it ingested into Vivim's knowledge system **so that** I don't lose my accumulated knowledge when switching platforms.

**Acceptance Criteria:**
- `POST /api/knowledge/ingest` accepts a provider export file and begins an asynchronous import job.
- The import job creates an `ImportJob` record with status tracking (`pending`, `processing`, `completed`, `failed`).
- `GET /api/knowledge/jobs` lists all import jobs with their current status.
- `GET /api/knowledge/jobs/:id` returns detailed status including `totalConversations`, `importedCount`, `duplicatesSkipped`, and `errorsCount`.
- Duplicate conversations are detected and skipped without error.
- The `resultJson` field captures detailed per-conversation import results for debugging.

---

### US-7: Knowledge Export
**As a** data-conscious user, **I want to** export all my stored knowledge as a structured JSON file **so that** I have a portable backup of my knowledge graph that I can use in other tools or restore after a system reset.

**Acceptance Criteria:**
- `GET /api/knowledge/export` returns all knowledge data (entities, decisions, patterns, topics, projects, preferences) as a single JSON document.
- The export format is the same format accepted by `POST /api/knowledge/ingest`, enabling round-trip import/export.
- Soft-deleted records are excluded from the export by default.
- The export includes all `EntityMention` and `ConversationTopic` junction records.
- The export operation completes within 30 seconds for a dataset of up to 10,000 entities.

---

### US-8: Project-Based Memory Organization
**As a** consultant working across multiple clients, **I want to** organize my conversations and knowledge into projects with distinct boundaries **so that** knowledge from one client engagement doesn't leak into another and I can focus on one project context at a time.

**Acceptance Criteria:**
- The `Project` model stores project name, description, and color for visual identification.
- `getProjects()` returns all non-deleted projects from the database.
- Projects can be used as a filter scope in search and synthesis queries (future Phase 1+).
- The system supports project-level soft delete via `isDeleted`.
- Seed data includes at least one project to validate the feature end-to-end.

---

## 3. Functional Requirements

### FR-1: Schema — Memory Intelligence Tables (Unit 0.1)
The system shall add 10 new Prisma models to the existing schema: `Entity`, `EntityMention`, `DecisionRecord`, `PatternExtract`, `Topic`, `Project`, `ConversationTopic`, `UserPreference`, `ImportJob`, and `MemoryEmbedding`. All models shall use the `@@map("memory_*")` prefix pattern for table namespacing, `BigInt` for timestamp fields, `Int @default(0)` for `isDeleted` soft-delete flags, and `newId()` from `ids.ts` for primary key generation. No existing models shall be altered. The schema migration shall be additive-only and reversible.

### FR-2: Store — Memory Intelligence (Unit 0.2)
The system shall implement store methods for all 10 new models following the existing store pattern in the codebase. Each store method shall return `Promise<T>` to maintain async compatibility for future PostgreSQL migration. Store methods shall include: `createEntity`, `getEntityById`, `listEntities`, `updateEntity`, `softDeleteEntity`, `createEntityMention`, `listEntityMentions`, `createDecisionRecord`, `listDecisionRecords`, `reverseDecision`, `createPatternExtract`, `listPatternExtracts`, `createTopic`, `getTopicById`, `listTopics`, `updateTopic`, `softDeleteTopic`, `createProject`, `listProjects`, `softDeleteProject`, `createConversationTopic`, `listConversationTopics`, `createUserPreference`, `getUserPreference`, `listUserPreferences`, `upsertUserPreference`, `createImportJob`, `updateImportJob`, `listImportJobs`, `createMemoryEmbedding`, `listMemoryEmbeddings`, and `deleteMemoryEmbedding`. All list methods shall support pagination via `offset` and `limit` parameters.

### FR-3: MemoryEngine — Complete 10-Type (Unit 0.3)
The system shall complete the 6 stub methods in `MemoryEngine`: `recordEntity()` shall persist an `Entity` record and an `EntityMention` record, then emit the existing event; `recordDecision()` shall persist a `DecisionRecord` and emit the existing event; `recordPattern()` shall persist a `PatternExtract` and emit the existing event; `getTopics()` shall query the `Topic` and `ConversationTopic` tables and return populated results; `getProjects()` shall query the `Project` table and return populated results; `assignTopic()` shall persist a `ConversationTopic` record and emit the existing event. A feature flag `memoryV2: true` in the configuration shall gate the new behavior, allowing callers that depend on the current `[]` returns to migrate incrementally.

### FR-4: ContextAssembly — Complete RECALL (Unit 0.4)
The system shall wire the `recall()` method's `conversation_history` layer to a real conversation store query. When `recall()` is invoked, it shall query the `Conversation` and `ConversationMessage` tables for the current user's recent conversations, assemble them into the context layer format, and return a populated `conversation_history` layer. The query shall be limited to the most recent 50 conversations and 500 messages to maintain performance. The `recall()` method shall respect the existing layer assembly contract and not change the return type signature.

### FR-5: SemanticSearch — Complete (Unit 0.5)
The system shall implement `reindexAll()` to rebuild the vector index from scratch. The method shall process all `Entity`, `DecisionRecord`, `PatternExtract`, and `Topic` records in batches of 100, generate embeddings for each record's text content, store the results as `MemoryEmbedding` records, and provide a progress callback. The system shall implement `searchHybrid()` to combine keyword search (SQL LIKE for small datasets, FTS5 virtual table for datasets > 1000 records) with semantic vector similarity search. The hybrid search shall support configurable weights (default: 0.4 keyword, 0.6 semantic) and return merged, deduplicated results ranked by combined score.

### FR-6: HarnessRuntime — Complete Preconditions (Unit 0.6)
The system shall implement `evaluateCondition()` for all condition types: `equals`, `not_equals`, `contains`, `greater_than`, `less_than`, `exists`, and `regex_match`. The `precondition` node type shall evaluate its condition and either proceed to the next node or halt execution with a `PRECONDITION_FAILED` status. The implementation shall support nested context references using dot notation (e.g., `context.user.preferences.theme`) and handle missing context gracefully by evaluating `exists` as `false` and all other conditions as `undefined` (which triggers a warning log but does not halt the workflow).

### FR-7: ExportEngine — Complete Import (Unit 0.7)
The system shall wire `importJson()` to write rows back to the database. The method shall parse the JSON input, validate the schema against the expected format, create an `ImportJob` record, process each conversation/entity/decision record, detect duplicates by comparing against existing records (using `name` + `type` for entities, `decisionText` + `conversationId` for decisions), skip duplicates with a counter increment, and update the `ImportJob` record with final counts. The method shall use SQLite WAL mode and optimistic locking to handle concurrent writes. On error, the method shall update `ImportJob.status = 'failed'` and store the error details in `resultJson`.

### FR-8: Server Routes — Knowledge API (Unit 0.8)
The system shall add 12 REST API endpoints under the `/api/knowledge/` prefix. All endpoints shall use the existing Express route registration pattern, validate request parameters with the existing validation middleware, and return responses in the standard `{ success: boolean, data?: T, error?: string }` format. The endpoints are: `POST /api/knowledge/ingest`, `GET /api/knowledge/jobs`, `GET /api/knowledge/jobs/:id`, `GET /api/knowledge/search`, `POST /api/knowledge/synthesize`, `GET /api/knowledge/export`, `GET /api/knowledge/entities`, `GET /api/knowledge/decisions`, `GET /api/knowledge/topics`, `POST /api/knowledge/topics`, `PUT /api/knowledge/topics/:id`, and `DELETE /api/knowledge/topics/:id`. Authentication shall use the existing session middleware.

### FR-9: Seed Data — Memory Intelligence (Unit 0.9)
The system shall include seed data for the 10 new models to validate end-to-end functionality. The seed data shall include: at least 3 entities (one person, one organization, one technology), at least 2 topics (one auto-generated, one manual), at least 1 project, at least 2 user preferences, at least 1 decision record, at least 1 pattern extract, entity mentions linking entities to conversations, and conversation-topic assignments. The seed script shall be idempotent — running it multiple times shall not create duplicate records.

### FR-10: Migration Script (Unit 0.10)
The system shall generate and test a Prisma migration for all 10 new models. The migration shall be additive-only (no changes to existing tables), reversible (with a down-migration that drops the new tables), and validated against the existing SQLite database. The migration script shall include a pre-flight check that verifies the current schema version matches the expected baseline, and a post-flight check that verifies all 10 new tables exist and have the correct column definitions. The migration shall be tested in a CI environment before merging.

---

## 4. Non-Functional Requirements

### Performance

**NFR-P1: API Response Time.** All knowledge API endpoints shall respond within 200ms for datasets up to 10,000 entities, 5,000 decisions, and 1,000 topics. The `GET /api/knowledge/search` endpoint shall respond within 500ms for datasets up to 10,000 entities with vector search enabled. The `POST /api/knowledge/synthesize` endpoint shall respond within 2 seconds for synthesis across up to 100 conversations.

**NFR-P2: Database Query Performance.** All list queries shall use indexed columns for filtering and sorting. The `Entity` table shall have composite indexes on `(type, isDeleted)` and `(name, isDeleted)`. The `MemoryEmbedding` table shall have an index on `(entityType, entityId, isDeleted)` for fast lookup. The `EntityMention` table shall have indexes on `(entityId, isDeleted)` and `(conversationId, isDeleted)`. All queries with pagination shall use `LIMIT/OFFSET` and never load full tables into memory.

**NFR-P3: Ingestion Throughput.** The `POST /api/knowledge/ingest` endpoint shall process at least 100 conversations per minute on a standard development machine (4-core CPU, 8GB RAM). The import job shall process records in batches of 50 to balance throughput and memory usage. The `reindexAll()` method shall process at least 500 records per minute for embedding generation.

**NFR-P4: Memory Footprint.** The MemoryEngine's completed methods shall not increase the process memory footprint by more than 50MB under normal operation. The `searchHybrid()` method shall use streaming for large result sets and never load more than 1000 candidate records into memory at once.

### Security

**NFR-S1: Input Validation.** All knowledge API endpoints shall validate request parameters using the existing validation middleware. String inputs shall be sanitized to prevent SQL injection (Prisma parameterized queries provide baseline protection). File uploads for `POST /api/knowledge/ingest` shall be limited to 50MB and validated for JSON structure before processing.

**NFR-S2: Soft Delete Enforcement.** All queries shall exclude soft-deleted records (`isDeleted = 1`) by default. A `showDeleted=true` query parameter shall be available for admin-level access only, requiring the `admin` role in the session. Deleted records shall be permanently purged after 30 days via a scheduled cleanup job (Phase 1+).

**NFR-S3: Embedding Vector Security.** The `MemoryEmbedding.vector` field shall be stored as a base64-encoded string, enabling future encryption by the `EncryptionEngine` without schema changes. Vector data shall not be included in API responses by default — only the `entityType` and `entityId` fields shall be returned in search results.

### Reliability

**NFR-R1: Transactional Integrity.** The `recordEntity()` method shall create both the `Entity` and `EntityMention` records within a single Prisma transaction. If either write fails, neither shall be committed. The `importJson()` method shall create the `ImportJob` record before processing begins and update it within a transaction after each batch completes.

**NFR-R2: Graceful Degradation.** If the `MemoryEmbedding` table is unavailable (e.g., embedding service is down), the `searchHybrid()` method shall fall back to keyword-only search and log a warning. If the `recall()` method encounters a database error, it shall return an empty `conversation_history` layer with a warning log rather than crashing the context assembly pipeline.

**NFR-R3: Idempotent Operations.** All write operations shall be idempotent where possible. `recordEntity()` shall upsert based on `name + type` — if an entity with the same name and type already exists, it shall increment `mentionCount` rather than create a duplicate. `importJson()` shall detect and skip duplicate conversations. `createConversationTopic()` shall check for existing assignments before creating a new one.

### Compatibility

**NFR-C1: SQLite Compatibility.** All new models and queries shall be compatible with SQLite 3.39+ (the minimum version supported by the existing codebase). The `vector` column in `MemoryEmbedding` shall use `String` type rather than a native vector type, since SQLite does not support vector columns natively. Vector similarity search shall be implemented in application code using cosine similarity on decoded Float32Arrays.

**NFR-C2: Prisma Version Compatibility.** All new models shall be compatible with the existing Prisma version in the project. No Prisma version upgrades shall be required. The migration shall use the existing `prisma migrate` workflow.

**NFR-C3: No Breaking Changes.** No existing API signatures, engine method signatures, or event bus event formats shall change. All new behavior shall be additive. The `memoryV2` feature flag shall default to `false` in production, allowing existing callers to migrate incrementally. When `memoryV2` is `false`, the 6 stub methods shall continue to behave exactly as they do today (returning `[]` or emitting events only).

---

## 5. API Specification

### 5.1 POST /api/knowledge/ingest
Upload and ingest a provider export file.

**Request:**
```json
{
  "source": "chatgpt" | "claude" | "gemini" | "vivim",
  "data": {
    "conversations": [
      {
        "title": "string",
        "createdAt": "number (epoch millis)",
        "messages": [
          {
            "role": "user" | "assistant" | "system",
            "content": "string",
            "createdAt": "number (epoch millis)"
          }
        ]
      }
    ]
  },
  "options": {
    "skipDuplicates": true,
    "extractEntities": true,
    "autoAssignTopics": true
  }
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "jobId": "01HXYZ123ABC",
    "status": "pending",
    "message": "Import job created. Use GET /api/knowledge/jobs/:id to track progress."
  }
}
```

**Error Responses:**
- `400 Bad Request` — Invalid source, missing data field, or malformed JSON structure
- `413 Payload Too Large` — Export file exceeds 50MB limit
- `429 Too Many Requests` — An import job is already in progress for this user

---

### 5.2 GET /api/knowledge/jobs
List all import jobs for the current user.

**Request Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string | No | Filter by status: `pending`, `processing`, `completed`, `failed` |
| `offset` | number | No | Pagination offset (default: 0) |
| `limit` | number | No | Pagination limit (default: 20, max: 100) |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "jobs": [
      {
        "id": "01HXYZ123ABC",
        "source": "chatgpt",
        "status": "completed",
        "totalConversations": 150,
        "importedCount": 142,
        "duplicatesSkipped": 8,
        "errorsCount": 0,
        "createdAt": 1722576000000,
        "updatedAt": 1722576030000
      }
    ],
    "total": 3,
    "offset": 0,
    "limit": 20
  }
}
```

---

### 5.3 GET /api/knowledge/jobs/:id
Get the status of a specific import job.

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | The import job ID |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "01HXYZ123ABC",
    "source": "chatgpt",
    "filePath": "/imports/chatgpt-2024-08-01.json",
    "status": "completed",
    "totalConversations": 150,
    "importedCount": 142,
    "duplicatesSkipped": 8,
    "errorsCount": 0,
    "resultJson": "{\"perConversation\":[{\"title\":\"...\",\"status\":\"imported\"}]}",
    "createdAt": 1722576000000,
    "updatedAt": 1722576030000
  }
}
```

**Error Responses:**
- `404 Not Found` — Job ID does not exist or belongs to another user

---

### 5.4 GET /api/knowledge/search
Semantic search across all memory types.

**Request Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query (minimum 2 characters) |
| `types` | string | No | Comma-separated entity types to search: `entity`, `decision`, `pattern`, `topic` |
| `limit` | number | No | Maximum results (default: 10, max: 50) |
| `mode` | string | No | Search mode: `hybrid` (default), `keyword`, `semantic` |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "type": "entity",
        "id": "01HXYZ456DEF",
        "name": "Kubernetes",
        "snippet": "We discussed migrating to Kubernetes for container orchestration...",
        "score": 0.92,
        "source": "semantic"
      },
      {
        "type": "decision",
        "id": "01HXYZ789GHI",
        "decisionText": "Use PostgreSQL for production",
        "snippet": "Given the ACID requirements...",
        "score": 0.85,
        "source": "keyword"
      }
    ],
    "totalResults": 15,
    "query": "container orchestration",
    "mode": "hybrid"
  }
}
```

**Error Responses:**
- `400 Bad Request` — Query parameter `q` is missing or too short
- `503 Service Unavailable` — Embedding service is down and `mode=semantic` was requested

---

### 5.5 POST /api/knowledge/synthesize
Cross-conversation synthesis.

**Request:**
```json
{
  "query": "What decisions have we made about the database architecture?",
  "scope": {
    "topicIds": ["01HTOPIC001"],
    "projectIds": ["01HPROJ001"],
    "dateRange": {
      "from": 1720000000000,
      "to": 1722576000000
    }
  },
  "options": {
    "maxSources": 10,
    "includeRationale": true
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "synthesis": "Based on 5 conversations, the team has consistently chosen PostgreSQL for production workloads due to ACID compliance and JSON support. The decision was first made on 2024-06-15 and reaffirmed on 2024-07-22. An alternative path using MongoDB was considered but rejected due to consistency requirements.",
    "sources": [
      {
        "type": "decision",
        "id": "01HXYZ789GHI",
        "conversationId": "01HCONV001",
        "relevance": 0.95
      }
    ],
    "metadata": {
      "conversationsSearched": 12,
      "sourcesUsed": 5,
      "processingTimeMs": 1340
    }
  }
}
```

**Error Responses:**
- `400 Bad Request` — Query is missing or scope parameters are invalid
- `404 Not Found` — Specified topic or project IDs do not exist

---

### 5.6 GET /api/knowledge/export
Export all knowledge as JSON.

**Request Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `format` | string | No | Export format: `full` (default), `entities`, `decisions` |
| `includeDeleted` | boolean | No | Include soft-deleted records (default: false, admin only) |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "version": "1.0",
    "exportedAt": 1722576000000,
    "entities": [
      {
        "id": "01HXYZ456DEF",
        "name": "Kubernetes",
        "type": "technology",
        "description": "Container orchestration platform",
        "confidence": 0.95,
        "mentionCount": 12
      }
    ],
    "decisions": [],
    "patterns": [],
    "topics": [],
    "projects": [],
    "preferences": [],
    "mentions": [],
    "conversationTopics": []
  }
}
```

---

### 5.7 GET /api/knowledge/entities
List entities, optionally filtered by type.

**Request Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | string | No | Filter by entity type: `person`, `organization`, `technology`, `concept` |
| `q` | string | No | Search entities by name (substring match) |
| `offset` | number | No | Pagination offset (default: 0) |
| `limit` | number | No | Pagination limit (default: 20, max: 100) |
| `sortBy` | string | No | Sort field: `mentionCount` (default), `name`, `createdAt` |
| `sortOrder` | string | No | Sort order: `desc` (default), `asc` |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "entities": [
      {
        "id": "01HXYZ456DEF",
        "name": "Kubernetes",
        "type": "technology",
        "description": "Container orchestration platform",
        "confidence": 0.95,
        "mentionCount": 12,
        "createdAt": 1722576000000,
        "updatedAt": 1722576100000
      }
    ],
    "total": 47,
    "offset": 0,
    "limit": 20
  }
}
```

---

### 5.8 GET /api/knowledge/decisions
List decisions, optionally filtered by conversation.

**Request Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `conversationId` | string | No | Filter to decisions in a specific conversation |
| `isReversed` | boolean | No | Filter to reversed decisions (default: include all) |
| `offset` | number | No | Pagination offset (default: 0) |
| `limit` | number | No | Pagination limit (default: 20, max: 100) |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "decisions": [
      {
        "id": "01HXYZ789GHI",
        "conversationId": "01HCONV001",
        "decisionText": "Use PostgreSQL for production",
        "rationale": "ACID compliance and JSON support are required",
        "alternativesJson": "[\"MongoDB\",\"MySQL\",\"CockroachDB\"]",
        "isReversed": false,
        "createdAt": 1722576000000,
        "updatedAt": 1722576000000
      }
    ],
    "total": 23,
    "offset": 0,
    "limit": 20
  }
}
```

---

### 5.9 GET /api/knowledge/topics
List all topics.

**Request Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `isAutoGenerated` | boolean | No | Filter to auto-generated or manual topics |
| `offset` | number | No | Pagination offset (default: 0) |
| `limit` | number | No | Pagination limit (default: 20, max: 100) |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "topics": [
      {
        "id": "01HTOPIC001",
        "name": "Database Architecture",
        "description": "Discussions about database selection and design",
        "color": "#3B82F6",
        "isAutoGenerated": false,
        "conversationCount": 5,
        "createdAt": 1722576000000,
        "updatedAt": 1722576100000
      }
    ],
    "total": 8,
    "offset": 0,
    "limit": 20
  }
}
```

---

### 5.10 POST /api/knowledge/topics
Create a new topic.

**Request:**
```json
{
  "name": "Database Architecture",
  "description": "Discussions about database selection and design",
  "color": "#3B82F6"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "01HTOPIC001",
    "name": "Database Architecture",
    "description": "Discussions about database selection and design",
    "color": "#3B82F6",
    "isAutoGenerated": false,
    "createdAt": 1722576000000,
    "updatedAt": 1722576000000
  }
}
```

**Error Responses:**
- `400 Bad Request` — Name is missing or exceeds 200 characters
- `409 Conflict` — A topic with the same name already exists

---

### 5.11 PUT /api/knowledge/topics/:id
Update an existing topic.

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | The topic ID |

**Request:**
```json
{
  "name": "Database Architecture & Scaling",
  "description": "Updated to include scaling discussions",
  "color": "#10B981"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "01HTOPIC001",
    "name": "Database Architecture & Scaling",
    "description": "Updated to include scaling discussions",
    "color": "#10B981",
    "isAutoGenerated": false,
    "createdAt": 1722576000000,
    "updatedAt": 1722576200000
  }
}
```

**Error Responses:**
- `400 Bad Request` — No fields provided for update
- `404 Not Found` — Topic ID does not exist or is soft-deleted
- `409 Conflict` — Updated name conflicts with an existing topic

---

### 5.12 DELETE /api/knowledge/topics/:id
Soft-delete a topic.

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | The topic ID |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "01HTOPIC001",
    "message": "Topic soft-deleted. Use showDeleted=true to view."
  }
}
```

**Error Responses:**
- `404 Not Found` — Topic ID does not exist or is already soft-deleted

---

## 6. Data Model

### 6.1 Entity
```prisma
model Entity {
  id           String   @id
  name         String
  type         String   // "person" | "organization" | "technology" | "concept"
  description  String   @default("")
  confidence   Float    @default(0.0)
  mentionCount Int      @default(0)
  isDeleted    Int      @default(0)
  createdAt    BigInt
  updatedAt    BigInt

  mentions     EntityMention[]

  @@unique([name, type, isDeleted])
  @@index([type, isDeleted])
  @@index([name, isDeleted])
  @@index([mentionCount])
  @@map("memory_entity")
}
```

**Field Definitions:**
- `id` — ULID primary key generated via `newId()` from `ids.ts`
- `name` — The canonical name of the entity (e.g., "Kubernetes", "Alice Johnson")
- `type` — The entity classification, one of: `person`, `organization`, `technology`, `concept`
- `description` — Auto-generated or manually edited description of the entity
- `confidence` — Float between 0.0 and 1.0 representing the system's confidence in the entity extraction
- `mentionCount` — Denormalized counter of how many times this entity has been mentioned across conversations
- `isDeleted` — Soft delete flag (0 = active, 1 = deleted)
- `createdAt` — Epoch milliseconds timestamp of creation
- `updatedAt` — Epoch milliseconds timestamp of last update

**Relationships:** One-to-many with `EntityMention` (an entity can have many mentions across conversations).

---

### 6.2 EntityMention
```prisma
model EntityMention {
  id             String   @id
  entityId       String
  conversationId String
  messageId      String
  snippet        String   // The text snippet containing the entity mention
  contextType    String   @default("reference") // "reference" | "definition" | "negation"
  isDeleted      Int      @default(0)
  createdAt      BigInt

  entity         Entity   @relation(fields: [entityId], references: [id])

  @@index([entityId, isDeleted])
  @@index([conversationId, isDeleted])
  @@index([messageId])
  @@map("memory_entity_mention")
}
```

**Field Definitions:**
- `id` — ULID primary key
- `entityId` — Foreign key to the `Entity` being mentioned
- `conversationId` — The conversation where the mention occurred
- `messageId` — The specific message within the conversation
- `snippet` — A short text excerpt (up to 500 characters) containing the entity mention in context
- `contextType` — How the entity was referenced: `reference` (casual mention), `definition` (entity is being defined), `negation` (entity mentioned in a negative context)
- `isDeleted` — Soft delete flag
- `createdAt` — Epoch milliseconds timestamp

**Relationships:** Many-to-one with `Entity` (each mention belongs to one entity).

---

### 6.3 DecisionRecord
```prisma
model DecisionRecord {
  id             String   @id
  conversationId String
  decisionText   String
  rationale      String
  alternativesJson String @default("[]")
  isReversed     Int      @default(0)
  isDeleted      Int      @default(0)
  createdAt      BigInt
  updatedAt      BigInt

  @@index([conversationId, isDeleted])
  @@index([isReversed, isDeleted])
  @@index([createdAt])
  @@map("memory_decision_record")
}
```

**Field Definitions:**
- `id` — ULID primary key
- `conversationId` — The conversation where the decision was made
- `decisionText` — The decision statement (e.g., "Use PostgreSQL for production")
- `rationale` — The reasoning behind the decision
- `alternativesJson` — JSON array of alternative options that were considered but not chosen
- `isReversed` — Flag indicating whether this decision has been superseded or reversed (0 = active, 1 = reversed)
- `isDeleted` — Soft delete flag
- `createdAt` — Epoch milliseconds timestamp of when the decision was recorded
- `updatedAt` — Epoch milliseconds timestamp of when the record was last updated (e.g., when reversed)

---

### 6.4 PatternExtract
```prisma
model PatternExtract {
  id          String   @id
  name        String
  patternType String   // "behavioral" | "temporal" | "structural" | "preference"
  description String
  occurrences Int      @default(1)
  confidence  Float    @default(0.0)
  isDeleted   Int      @default(0)
  createdAt   BigInt
  updatedAt   BigInt

  @@unique([name, patternType, isDeleted])
  @@index([patternType, isDeleted])
  @@index([occurrences])
  @@map("memory_pattern_extract")
}
```

**Field Definitions:**
- `id` — ULID primary key
- `name` — A human-readable name for the pattern (e.g., "Prefers morning meetings")
- `patternType` — The classification of the pattern: `behavioral` (recurring actions), `temporal` (time-based patterns), `structural` (organizational patterns), `preference` (user preferences)
- `description` — Detailed description of the pattern and its significance
- `occurrences` — Number of times this pattern has been observed across conversations
- `confidence` — Float between 0.0 and 1.0 representing confidence in the pattern
- `isDeleted` — Soft delete flag
- `createdAt` — Epoch milliseconds timestamp
- `updatedAt` — Epoch milliseconds timestamp

---

### 6.5 Topic
```prisma
model Topic {
  id              String   @id
  name            String
  description     String   @default("")
  color           String   @default("#6B7280")
  isAutoGenerated Int      @default(0)
  isDeleted       Int      @default(0)
  createdAt       BigInt
  updatedAt       BigInt

  conversationTopics ConversationTopic[]

  @@unique([name, isDeleted])
  @@index([isAutoGenerated, isDeleted])
  @@map("memory_topic")
}
```

**Field Definitions:**
- `id` — ULID primary key
- `name` — The topic name (e.g., "Database Architecture", "API Design")
- `description` — A description of what the topic covers
- `color` — A hex color code for visual identification in the UI (default: gray)
- `isAutoGenerated` — Flag indicating whether the topic was auto-generated by the system (0 = manual, 1 = auto)
- `isDeleted` — Soft delete flag
- `createdAt` — Epoch milliseconds timestamp
- `updatedAt` — Epoch milliseconds timestamp

**Relationships:** One-to-many with `ConversationTopic` (a topic can be assigned to many conversations).

---

### 6.6 Project
```prisma
model Project {
  id          String   @id
  name        String
  description String   @default("")
  color       String   @default("#6B7280")
  isDeleted   Int      @default(0)
  createdAt   BigInt
  updatedAt   BigInt

  @@unique([name, isDeleted])
  @@map("memory_project")
}
```

**Field Definitions:**
- `id` — ULID primary key
- `name` — The project name (e.g., "Client A Migration", "Internal Tooling")
- `description` — A description of the project scope and objectives
- `color` — A hex color code for visual identification
- `isDeleted` — Soft delete flag
- `createdAt` — Epoch milliseconds timestamp
- `updatedAt` — Epoch milliseconds timestamp

---

### 6.7 ConversationTopic
```prisma
model ConversationTopic {
  id             String   @id
  conversationId String
  topicId        String
  assignmentType String   @default("auto") // "auto" | "manual"
  isDeleted      Int      @default(0)
  createdAt      BigInt

  topic          Topic    @relation(fields: [topicId], references: [id])

  @@unique([conversationId, topicId, isDeleted])
  @@index([conversationId, isDeleted])
  @@index([topicId, isDeleted])
  @@map("memory_conversation_topic")
}
```

**Field Definitions:**
- `id` — ULID primary key
- `conversationId` — The conversation being tagged
- `topicId` — Foreign key to the `Topic` being assigned
- `assignmentType` — How the topic was assigned: `auto` (system-detected) or `manual` (user-assigned)
- `isDeleted` — Soft delete flag
- `createdAt` — Epoch milliseconds timestamp

**Relationships:** Many-to-one with `Topic` (each assignment belongs to one topic). This is a junction table enabling many-to-many between conversations and topics.

---

### 6.8 UserPreference
```prisma
model UserPreference {
  id         String   @id
  userId     String
  key        String
  value      String
  source     String   @default("inferred") // "inferred" | "explicit" | "system"
  confidence Float    @default(0.5)
  isDeleted  Int      @default(0)
  createdAt  BigInt
  updatedAt  BigInt

  @@unique([userId, key, isDeleted])
  @@index([userId, isDeleted])
  @@index([key, isDeleted])
  @@map("memory_user_preference")
}
```

**Field Definitions:**
- `id` — ULID primary key
- `userId` — The user this preference belongs to
- `key` — The preference key (e.g., "response_format", "detail_level", "preferred_language")
- `value` — The preference value (stored as string, can be parsed as JSON for complex values)
- `source` — How the preference was established: `inferred` (detected from behavior), `explicit` (directly stated by user), `system` (default system setting)
- `confidence` — Float between 0.0 and 1.0 representing confidence in the preference accuracy
- `isDeleted` — Soft delete flag
- `createdAt` — Epoch milliseconds timestamp
- `updatedAt` — Epoch milliseconds timestamp

---

### 6.9 ImportJob
```prisma
model ImportJob {
  id                String   @id
  source            String   // "chatgpt" | "claude" | "gemini" | "vivim"
  filePath          String   @default("")
  status            String   @default("pending") // "pending" | "processing" | "completed" | "failed"
  totalConversations Int     @default(0)
  importedCount     Int      @default(0)
  duplicatesSkipped Int      @default(0)
  errorsCount       Int      @default(0)
  resultJson        String   @default("{}")
  isDeleted         Int      @default(0)
  createdAt         BigInt
  updatedAt         BigInt

  @@index([status, isDeleted])
  @@index([createdAt])
  @@map("memory_import_job")
}
```

**Field Definitions:**
- `id` — ULID primary key
- `source` — The provider the data was imported from
- `filePath` — The local file path of the uploaded export (for audit/debugging)
- `status` — The current status of the import job: `pending`, `processing`, `completed`, or `failed`
- `totalConversations` — Total number of conversations in the export file
- `importedCount` — Number of conversations successfully imported
- `duplicatesSkipped` — Number of conversations skipped as duplicates
- `errorsCount` — Number of conversations that failed to import
- `resultJson` — JSON string containing per-conversation results for debugging
- `isDeleted` — Soft delete flag
- `createdAt` — Epoch milliseconds timestamp
- `updatedAt` — Epoch milliseconds timestamp

---

### 6.10 MemoryEmbedding
```prisma
model MemoryEmbedding {
  id         String   @id
  entityType String   // "entity" | "decision" | "pattern" | "topic"
  entityId   String
  vector     String   // Base64-encoded Float32Array
  model      String   @default("text-embedding-3-small")
  dimensions Int      @default(1536)
  isDeleted  Int      @default(0)
  createdAt  BigInt

  @@unique([entityType, entityId, isDeleted])
  @@index([entityType, isDeleted])
  @@map("memory_embedding")
}
```

**Field Definitions:**
- `id` — ULID primary key
- `entityType` — The type of entity this embedding represents: `entity`, `decision`, `pattern`, or `topic`
- `entityId` — The ID of the entity this embedding is for (polymorphic reference)
- `vector` — The embedding vector stored as a base64-encoded Float32Array string (enables future encryption by EncryptionEngine)
- `model` — The embedding model used to generate the vector (default: OpenAI text-embedding-3-small)
- `dimensions` — The number of dimensions in the vector (default: 1536)
- `isDeleted` — Soft delete flag
- `createdAt` — Epoch milliseconds timestamp

**Design Notes:** The `vector` field is stored as a base64-encoded string rather than a native vector type because SQLite does not support vector columns. Vector similarity search is implemented in application code by decoding the base64 string to a Float32Array and computing cosine similarity. This design also allows the `EncryptionEngine` to encrypt the vector field transparently in Phase 2 without schema changes.

---

## 7. Error Handling

### 7.1 Error Code System

All Phase 0 errors use a structured error code system with the format `KN-{domain}-{sequence}`:

| Error Code | Domain | HTTP Status | Description | User-Facing Message |
|-----------|--------|-------------|-------------|-------------------|
| KN-ING-001 | Ingestion | 400 | Invalid export format | "The uploaded file is not a valid {source} export. Please check the format and try again." |
| KN-ING-002 | Ingestion | 413 | Export file too large | "The export file exceeds the 50MB limit. Please split it into smaller files." |
| KN-ING-003 | Ingestion | 429 | Import already in progress | "An import is already running. Please wait for it to complete before starting another." |
| KN-ING-004 | Ingestion | 500 | Import processing failure | "The import failed unexpectedly. Your data has not been modified. Please try again." |
| KN-SRC-001 | Search | 400 | Query too short | "Please enter at least 2 characters to search." |
| KN-SRC-002 | Search | 503 | Embedding service unavailable | "Semantic search is temporarily unavailable. Showing keyword results only." |
| KN-SRC-003 | Search | 500 | Search index corruption | "The search index needs to be rebuilt. Please contact support." |
| KN-ENT-001 | Entity | 400 | Invalid entity type | "'{type}' is not a valid entity type. Use: person, organization, technology, concept." |
| KN-ENT-002 | Entity | 409 | Duplicate entity | "An entity named '{name}' of type '{type}' already exists." |
| KN-DEC-001 | Decision | 404 | Decision not found | "The specified decision record does not exist." |
| KN-TOP-001 | Topic | 400 | Topic name required | "Topic name is required and must be between 1 and 200 characters." |
| KN-TOP-002 | Topic | 409 | Duplicate topic name | "A topic named '{name}' already exists." |
| KN-TOP-003 | Topic | 404 | Topic not found | "The specified topic does not exist or has been deleted." |
| KN-EXP-001 | Export | 500 | Export generation failure | "Could not generate the export. Please try again." |
| KN-SYN-001 | Synthesis | 400 | Invalid scope parameters | "The specified scope contains invalid topic or project IDs." |
| KN-DB-001 | Database | 500 | Database write failure | "Could not save your data. Please try again." |
| KN-DB-002 | Database | 500 | Database read failure | "Could not retrieve data. Please try again." |

### 7.2 Recovery Strategies

**Transient Database Errors (KN-DB-001, KN-DB-002):**
- Retry up to 3 times with exponential backoff (100ms, 500ms, 2500ms)
- If all retries fail, return the error to the client with a `Retry-After: 5` header
- Log the full error with stack trace for debugging
- The `ImportJob` record shall be updated with `status = 'failed'` and `resultJson` containing the error details

**Import Processing Failures (KN-ING-004):**
- The `ImportJob` record shall be updated with `status = 'failed'` and partial results preserved in `resultJson`
- Successfully imported conversations before the failure point shall be retained (no rollback)
- The `errorsCount` and `importedCount` fields shall reflect the partial state
- The user can re-run the import after fixing the issue; the duplicate detection will skip already-imported conversations

**Search Service Degradation (KN-SRC-002):**
- If the embedding service is unavailable, `searchHybrid()` shall fall back to keyword-only search
- The response shall include a `warnings` field: `["Semantic search is unavailable. Showing keyword results only."]`
- The `searchHybrid()` method shall log a warning with the embedding service error details
- If `mode=semantic` is explicitly requested and the service is down, return 503 with KN-SRC-002

**Concurrency Conflicts:**
- `recordEntity()` uses an upsert pattern (INSERT ON CONFLICT UPDATE) for `name + type` uniqueness, so concurrent mentions of the same entity will increment `mentionCount` correctly
- `importJson()` uses SQLite WAL mode and processes records in batches with intermediate commits, so concurrent writes from other conversations are not blocked
- `createConversationTopic()` checks for existing assignments before creating; if a concurrent request creates the same assignment, the unique constraint `(conversationId, topicId, isDeleted)` will reject the duplicate, and the method shall return the existing record instead of throwing an error

### 7.3 Error Response Format

All error responses follow a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "KN-ENT-002",
    "message": "An entity named 'Kubernetes' of type 'technology' already exists.",
    "details": {
      "field": "name",
      "value": "Kubernetes",
      "constraint": "unique(name, type, isDeleted)"
    },
    "retryable": false,
    "documentationUrl": "https://docs.vivim.dev/errors/KN-ENT-002"
  }
}
```

---

## 8. Migration Strategy

### 8.1 Pre-Migration Checklist

Before executing the migration, the following conditions must be verified:

1. **Database backup:** A complete SQLite database backup exists at `{dataDir}/vivim-backup-{timestamp}.db`
2. **Schema baseline:** The current schema version matches the expected baseline (verified via `SchemaMeta` table)
3. **Disk space:** At least 100MB of free disk space is available for the migration and new indexes
4. **No active imports:** No `ImportJob` records with `status = 'processing'` exist
5. **Feature flag:** The `memoryV2` feature flag is set to `false` (new behavior is not yet active)

### 8.2 Step-by-Step Migration Plan

**Step 1: Generate the Migration**
```bash
npx prisma migrate dev --name phase0_memory_intelligence --create-only
```
This generates the migration SQL file without applying it. The file is reviewed by a developer to ensure it is additive-only (no ALTER TABLE on existing tables, no DROP TABLE statements).

**Step 2: Review Migration SQL**
The generated SQL shall be manually reviewed to confirm:
- All 10 new tables are created with the `memory_` prefix
- All indexes are created as specified in the data model
- All unique constraints are present
- No existing tables are modified
- The down-migration drops only the 10 new tables

**Step 3: Test Migration on Development Database**
```bash
npx prisma migrate dev --name phase0_memory_intelligence
```
Run the migration against a development copy of the production database. Verify that:
- All 10 new tables exist with the correct column definitions
- All indexes are created
- All existing data is intact
- The `SchemaMeta` table is updated with the new migration version

**Step 4: Run Seed Data**
```bash
npx tsx src/seed/memory-intelligence.ts
```
Execute the seed script to populate the 10 new tables with test data. Verify that:
- At least 3 entities are created
- At least 2 topics are created
- At least 1 project is created
- The seed script is idempotent (running it again does not create duplicates)

**Step 5: Run Integration Tests**
```bash
npx vitest run --grep "Phase 0"
```
Execute all Phase 0 integration tests against the migrated database. Verify that all tests pass.

**Step 6: Apply Migration to Production**
```bash
npx prisma migrate deploy
```
Apply the migration to the production database. This is a non-destructive operation since it only adds new tables.

**Step 7: Enable Feature Flag**
```json
{ "memoryV2": true }
```
Set the `memoryV2` feature flag to `true` in the production configuration. This activates the new behavior for the 6 completed MemoryEngine methods.

**Step 8: Verify Production**
- Confirm that `GET /api/knowledge/entities` returns the seed entities
- Confirm that `GET /api/knowledge/topics` returns the seed topics
- Confirm that `GET /api/knowledge/search?q=test` returns results
- Confirm that all existing API endpoints still function correctly (no regressions)

### 8.3 Rollback Procedures

**If the migration fails during Step 6:**
1. The Prisma migration will automatically roll back the failed migration
2. Verify that the database is in the pre-migration state
3. Investigate the failure cause, fix the migration SQL, and retry from Step 2

**If issues are discovered after Step 7 (feature flag enabled):**
1. Set `memoryV2: false` to immediately disable the new behavior
2. The 6 MemoryEngine methods will revert to their stub behavior (returning `[]` or emitting events only)
3. The new database tables and data remain intact but are not accessed
4. Investigate and fix the issue, then re-enable the feature flag

**If a full rollback is required (remove all Phase 0 changes):**
1. Set `memoryV2: false`
2. Revert the code deployment to the pre-Phase-0 version
3. The 10 new tables remain in the database but are unused
4. Optionally, run the down-migration to drop the new tables:
   ```bash
   npx prisma migrate resolve --rolled-back phase0_memory_intelligence
   ```
5. **Important:** Do not drop the new tables if any production data has been written to them. Instead, leave them in place and address the data migration in a follow-up.

**Data Preservation During Rollback:**
- Any data written to the 10 new tables during the period when `memoryV2` was enabled shall be preserved
- The `ImportJob` records shall be retained for audit purposes
- If the rollback is due to data corruption, the backup from Step 1 can be restored, but this will lose all data written after the backup was taken

---

## 9. Testing Strategy

### 9.1 Unit Tests

Unit tests cover the internal logic of each engine method and store function in isolation. All external dependencies (database, embedding service, event bus) are mocked.

**MemoryEngine Tests (6 stub methods):**
| Test Case | Method | Description | Expected Behavior |
|-----------|--------|-------------|-------------------|
| UT-ME-001 | `recordEntity()` | New entity | Creates `Entity` + `EntityMention`, emits event |
| UT-ME-002 | `recordEntity()` | Existing entity | Increments `mentionCount`, creates new `EntityMention`, emits event |
| UT-ME-003 | `recordEntity()` | Feature flag off | Emits event only, no DB writes |
| UT-ME-004 | `recordDecision()` | Valid decision | Creates `DecisionRecord`, emits event |
| UT-ME-005 | `recordDecision()` | Feature flag off | Emits event only, no DB writes |
| UT-ME-006 | `recordPattern()` | New pattern | Creates `PatternExtract`, emits event |
| UT-ME-007 | `recordPattern()` | Existing pattern | Increments `occurrences`, emits event |
| UT-ME-008 | `getTopics()` | With data | Returns array of topics from DB |
| UT-ME-009 | `getTopics()` | Feature flag off | Returns `[]` |
| UT-ME-010 | `getProjects()` | With data | Returns array of projects from DB |
| UT-ME-011 | `assignTopic()` | Valid assignment | Creates `ConversationTopic`, emits event |
| UT-ME-012 | `assignTopic()` | Duplicate assignment | Returns existing record, no error |

**SemanticSearch Tests:**
| Test Case | Method | Description | Expected Behavior |
|-----------|--------|-------------|-------------------|
| UT-SS-001 | `reindexAll()` | Full reindex | Processes all records in batches, creates `MemoryEmbedding` records |
| UT-SS-002 | `reindexAll()` | Progress callback | Calls progress callback with batch number |
| UT-SS-003 | `searchHybrid()` | Hybrid mode | Returns merged keyword + semantic results |
| UT-SS-004 | `searchHybrid()` | Embedding service down | Falls back to keyword search with warning |

**HarnessRuntime Tests:**
| Test Case | Method | Description | Expected Behavior |
|-----------|--------|-------------|-------------------|
| UT-HR-001 | `evaluateCondition()` | `equals` | Returns true when values match |
| UT-HR-002 | `evaluateCondition()` | `contains` | Returns true when substring found |
| UT-HR-003 | `evaluateCondition()` | `regex_match` | Returns true when pattern matches |
| UT-HR-004 | `evaluateCondition()` | Missing context | Returns `undefined`, logs warning |
| UT-HR-005 | `precondition` node | Condition met | Proceeds to next node |
| UT-HR-006 | `precondition` node | Condition not met | Halts with `PRECONDITION_FAILED` |

**ExportEngine Tests:**
| Test Case | Method | Description | Expected Behavior |
|-----------|--------|-------------|-------------------|
| UT-EE-001 | `importJson()` | Valid import | Creates `ImportJob`, writes rows, updates counts |
| UT-EE-002 | `importJson()` | Duplicate detection | Skips duplicates, increments `duplicatesSkipped` |
| UT-EE-003 | `importJson()` | Invalid JSON | Sets `status = 'failed'`, stores error in `resultJson` |

**Store Layer Tests:**
| Test Case | Method | Description | Expected Behavior |
|-----------|--------|-------------|-------------------|
| UT-ST-001 | `createEntity` | Valid entity | Returns created entity with generated ID |
| UT-ST-002 | `listEntities` | With type filter | Returns only entities of specified type |
| UT-ST-003 | `listEntities` | Pagination | Returns correct page with total count |
| UT-ST-004 | `softDeleteEntity` | Existing entity | Sets `isDeleted = 1`, excludes from list queries |
| UT-ST-005 | `createTopic` | Valid topic | Returns created topic |
| UT-ST-006 | `createTopic` | Duplicate name | Throws unique constraint error |
| UT-ST-007 | `upsertUserPreference` | New preference | Creates new record |
| UT-ST-008 | `upsertUserPreference` | Existing preference | Updates value and confidence |

### 9.2 Integration Tests

Integration tests verify the interaction between multiple components using a real (test) database.

| Test ID | Description | Components | Verification |
|---------|-------------|------------|--------------|
| IT-001 | Entity creation and retrieval flow | MemoryEngine → Store → DB | Entity is persisted and retrievable via `getTopics()` |
| IT-002 | Decision recording and reversal | MemoryEngine → Store → DB | Decision is created, then reversed via `isReversed` flag |
| IT-003 | Topic assignment flow | MemoryEngine → Store → DB | Topic is assigned to conversation and retrievable |
| IT-004 | Full import pipeline | Knowledge API → ExportEngine → Store → DB | Import job completes with correct counts |
| IT-005 | Search with real embeddings | SemanticSearch → Store → MemoryEmbedding | Hybrid search returns ranked results |
| IT-006 | ContextAssembly recall | ContextAssembly → ConversationStore | `conversation_history` layer is populated |
| IT-007 | Knowledge API CRUD cycle | Knowledge API → Store → DB | Create, read, update, delete all work end-to-end |
| IT-008 | Export and re-import round-trip | Export → Import → DB | Exported data can be re-imported without loss |
| IT-009 | Feature flag toggle | MemoryEngine with flag on/off | Behavior changes correctly based on flag |
| IT-010 | Concurrent import writes | Two imports running simultaneously | No data corruption, WAL mode handles concurrency |

### 9.3 End-to-End (E2E) Tests

E2E tests verify the complete user journey from HTTP request to database response.

| Test ID | Description | Steps | Expected Result |
|---------|-------------|-------|-----------------|
| E2E-001 | Full knowledge lifecycle | 1. Create topic via API 2. Ingest conversations 3. Search for entity 4. Verify entity in results | Topic exists, conversations imported, entity found in search |
| E2E-002 | Import and verify | 1. Upload ChatGPT export 2. Poll job status 3. Verify completed 4. Query imported entities | Job completes, entities are queryable |
| E2E-003 | Synthesis across conversations | 1. Have 5+ conversations with decisions 2. Request synthesis 3. Verify synthesis references multiple sources | Synthesis includes references from multiple conversations |
| E2E-004 | Export and verify | 1. Create entities, decisions, topics 2. Export knowledge 3. Verify JSON structure | Export contains all created data in correct format |
| E2E-005 | Topic CRUD operations | 1. Create topic 2. List topics 3. Update topic 4. Delete topic 5. Verify deleted | All operations succeed, deleted topic is excluded |
| E2E-006 | Search degradation | 1. Disable embedding service 2. Perform hybrid search 3. Verify keyword fallback | Search returns keyword results with degradation warning |

### 9.4 Test Infrastructure

- **Test runner:** Vitest (existing in the project)
- **Database:** In-memory SQLite for unit tests, file-based SQLite for integration tests
- **Test data:** Each test creates its own data and cleans up after itself (no shared state)
- **CI integration:** All Phase 0 tests run in CI on every pull request
- **Coverage target:** 80% line coverage for all new code, 100% coverage for the 6 completed MemoryEngine methods
- **Performance benchmarks:** Key operations (search, import, recall) are benchmarked in CI to catch regressions

---

## 10. Release Criteria

Phase 0 is considered complete and ready for release when all of the following criteria are met:

### 10.1 Functional Completeness

| Criterion | ID | Verification Method | Pass Condition |
|-----------|----|--------------------|----------------|
| All 10 Prisma models exist and migration applies cleanly | RC-FC-01 | `prisma migrate status` | Migration status: "up to date" |
| All 6 MemoryEngine stub methods read/write to real DB | RC-FC-02 | Unit tests UT-ME-001 through UT-ME-012 | All 12 tests pass |
| ContextAssembly RECALL returns populated `conversation_history` layer | RC-FC-03 | Integration test IT-006 | Layer is non-empty with real conversation data |
| SemanticSearch `reindexAll()` processes records | RC-FC-04 | Unit test UT-SS-001 | `MemoryEmbedding` records are created |
| SemanticSearch `searchHybrid()` returns merged results | RC-FC-05 | Unit test UT-SS-003 | Results include both keyword and semantic matches |
| HarnessRuntime `evaluateCondition()` handles all condition types | RC-FC-06 | Unit tests UT-HR-001 through UT-HR-004 | All condition types return correct results |
| ExportEngine `importJson()` writes rows to DB | RC-FC-07 | Unit test UT-EE-001 | Import job completes with correct counts |
| 12 knowledge API endpoints return correct responses | RC-FC-08 | Integration test IT-007 | All 12 endpoints return 2xx with correct data |
| Seed data populates at least 3 entities, 2 topics, 1 project | RC-FC-09 | Seed script verification | Counts match minimums |
| All existing tests still pass | RC-FC-10 | Full test suite run | 0 test failures, 0 test errors |

### 10.2 Performance Benchmarks

| Criterion | ID | Verification Method | Pass Condition |
|-----------|----|--------------------|----------------|
| `GET /api/knowledge/entities` response time | RC-PF-01 | Benchmark with 10,000 entities | P95 < 200ms |
| `GET /api/knowledge/search` response time | RC-PF-02 | Benchmark with 10,000 entities | P95 < 500ms |
| `POST /api/knowledge/synthesize` response time | RC-PF-03 | Benchmark with 100 conversations | P95 < 2000ms |
| `POST /api/knowledge/ingest` throughput | RC-PF-04 | Benchmark with 100 conversations | >= 100 conversations/minute |
| `reindexAll()` throughput | RC-PF-05 | Benchmark with 5,000 records | >= 500 records/minute |
| Memory footprint increase | RC-PF-06 | Process memory monitoring | < 50MB increase under normal load |

### 10.3 Quality Gates

| Criterion | ID | Verification Method | Pass Condition |
|-----------|----|--------------------|----------------|
| Test coverage for new code | RC-QG-01 | Vitest coverage report | >= 80% line coverage |
| Test coverage for MemoryEngine methods | RC-QG-02 | Vitest coverage report | 100% line coverage |
| Zero regression in existing tests | RC-QG-03 | Full test suite run | 0 failures |
| No TypeScript compilation errors | RC-QG-04 | `tsc --noEmit` | Exit code 0 |
| No linting errors in new code | RC-QG-05 | ESLint on new files | 0 errors, 0 warnings |
| All API endpoints have request validation | RC-QG-06 | Code review + test | 100% of endpoints validate inputs |

### 10.4 Operational Readiness

| Criterion | ID | Verification Method | Pass Condition |
|-----------|----|--------------------|----------------|
| Migration rollback tested | RC-OR-01 | Manual test | Down-migration drops all 10 new tables cleanly |
| Feature flag tested | RC-OR-02 | Integration test IT-009 | `memoryV2: false` disables new behavior, `true` enables it |
| Error responses follow standard format | RC-OR-03 | API test | All error responses include `code`, `message`, `retryable` |
| Log messages are structured and actionable | RC-OR-04 | Code review | All log entries include context (entity ID, job ID, etc.) |
| Documentation updated | RC-OR-05 | Review | API docs, schema docs, and migration guide are updated |

### 10.5 Sign-Off

Phase 0 release requires sign-off from:

1. **Engineering Lead** — Confirms all functional and quality criteria are met
2. **QA Lead** — Confirms all test plans have been executed and pass
3. **Product Owner** — Confirms the user stories are satisfied and the feature is production-ready

Once all criteria are met and sign-offs are obtained, the `memoryV2` feature flag shall be set to `true` in production, and Phase 0 is declared complete.

---

## Appendix A: Dependency Graph

```
0.1 (Schema) ─────────────────────────────────────┐
  │                                                │
  ├→ 0.2 (Store) ─┬→ 0.3 (MemoryEngine) ─→ 0.8 (Knowledge API)
  │               ├→ 0.4 (ContextAssembly)         │
  │               └→ 0.5 (SemanticSearch) ─────────┘
  │
  ├→ 0.7 (ExportEngine Import)
  ├→ 0.9 (Seed Data)
  └→ 0.10 (Migration Script)

0.6 (HarnessRuntime) — independent, can run in parallel
```

**Execution Waves:**
```
Wave A (parallel): 0.1, 0.6
Wave B (parallel): 0.2, 0.9, 0.10
Wave C (parallel): 0.3, 0.4, 0.5, 0.7
Wave D: 0.8
```

**Estimated Effort:** 3–4 days for a single developer.

## Appendix B: Feature Flag Configuration

```json
{
  "memoryV2": {
    "description": "Enable Phase 0 memory intelligence features",
    "default": false,
    "affects": [
      "MemoryEngine.recordEntity()",
      "MemoryEngine.recordDecision()",
      "MemoryEngine.recordPattern()",
      "MemoryEngine.getTopics()",
      "MemoryEngine.getProjects()",
      "MemoryEngine.assignTopic()"
    ],
    "rollback": "Set to false to disable all Phase 0 MemoryEngine behavior"
  }
}
```

## Appendix C: Glossary

| Term | Definition |
|------|-----------|
| **Entity** | A named thing (person, organization, technology, concept) extracted from conversations |
| **EntityMention** | A specific occurrence of an entity in a conversation, with context |
| **DecisionRecord** | A formal decision extracted from a conversation, with rationale and alternatives |
| **PatternExtract** | A recurring pattern detected across conversations (behavioral, temporal, structural, preference) |
| **Topic** | A named category for organizing conversations |
| **Project** | A named container for organizing knowledge by client or initiative |
| **ConversationTopic** | A junction record linking a conversation to a topic |
| **UserPreference** | A preference inferred from or explicitly stated by a user |
| **ImportJob** | An asynchronous job tracking the progress of a provider export import |
| **MemoryEmbedding** | A vector embedding stored for semantic search |
| **Hybrid Search** | A search strategy combining keyword matching and semantic vector similarity |
| **Soft Delete** | Marking a record as deleted (`isDeleted = 1`) without removing it from the database |
| **Feature Flag** | A configuration toggle that enables or disables a feature without code deployment |
| **ULID** | Universally Unique Lexicographically Sortable Identifier, used for all primary keys |
