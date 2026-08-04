# Phase 0 — Test Contracts

> Vivim Memory & Intelligence Layer
> Version: 1.0.0 | Date: 2026-03-04

This document defines the test contracts for each of the 10 Phase 0 units. Every unit specifies test cases, expected behavior, edge cases, and error scenarios. Tests must pass before Phase 0 is considered complete.

---

## Table of Contents

1. [Entity](#1-entity)
2. [EntityMention](#2-entitymention)
3. [DecisionRecord](#3-decisionrecord)
4. [PatternExtract](#4-patternextract)
5. [Topic](#5-topic)
6. [Project](#6-project)
7. [ConversationTopic](#7-conversationtopic)
8. [UserPreference](#8-userpreference)
9. [ImportJob](#9-importjob)
10. [MemoryEmbedding](#10-memoryembedding)

---

## 1. Entity

### Unit Name
`Entity` — Knowledge-graph nodes (person, technology, project, concept, organization)

### Test Cases

| # | Test Case | Input | Expected Behavior |
|---|-----------|-------|-------------------|
| 1 | Create entity with valid data | `{ name: "Alice", type: "person", description: "Senior engineer" }` | Entity is persisted with `id` (ULID), `confidence=1.0`, `mentionCount=0`, `isDeleted=0`, `createdAt` and `updatedAt` populated |
| 2 | Reject duplicate name+type | Create two entities with `{ name: "Alice", type: "person" }` | Second insert raises unique constraint violation on `(name, type)` |
| 3 | Allow same name, different type | `{ name: "Python", type: "technology" }` and `{ name: "Python", type: "concept" }` | Both entities are created successfully |
| 4 | Default confidence value | Create entity without specifying `confidence` | `confidence` defaults to `1.0` |
| 5 | Default mentionCount | Create entity without specifying `mentionCount` | `mentionCount` defaults to `0` |
| 6 | Soft delete entity | Set `isDeleted=1` on existing entity | Entity is marked as deleted but remains in DB; queries with `isDeleted=0` filter exclude it |
| 7 | Query by type | Filter entities where `type="technology"` | Returns only technology entities, uses `memory_entity_type_idx` |
| 8 | Query by name prefix | Search entities where `name` starts with "Ali" | Returns matching entities, uses `memory_entity_name_idx` |
| 9 | Update entity fields | Change `description` and `confidence` | `updatedAt` is refreshed, fields are updated |
| 10 | Hard delete cascades | Delete entity row | All related `EntityMention` and `MemoryEmbedding` rows are cascade-deleted |

### Edge Cases

- **Empty name**: Inserting with `name=""` should succeed at DB level but be rejected by application validation (minimum length 1)
- **Long name**: Names exceeding 500 characters should be truncated or rejected by application validation
- **Invalid type**: Values outside the enum (person, technology, project, concept, organization) should be rejected at application level
- **Confidence boundary**: `confidence=0.0` and `confidence=1.0` are both valid; values outside [0.0, 1.0] should be rejected
- **Negative mentionCount**: Application should reject `mentionCount < 0`

### Error Scenarios

- **Null name**: NOT NULL constraint violation on `name` column
- **Null type**: NOT NULL constraint violation on `type` column
- **Null createdAt/updatedAt**: NOT NULL constraint violation — timestamps must be provided
- **Duplicate (name, type) on upsert**: If using `createMany` or batch inserts, duplicates should be caught and reported per-row
- **Foreign key cascade timing**: Cascading deletes to EntityMention/MemoryEmbedding must complete atomically within the same transaction

---

## 2. EntityMention

### Unit Name
`EntityMention` — Tracks where an entity is referenced in conversations

### Test Cases

| # | Test Case | Input | Expected Behavior |
|---|-----------|-------|-------------------|
| 1 | Create mention with valid data | `{ entityId, conversationId, messageId, snippet: "mentioned Alice" }` | Mention is persisted with `contextType="reference"`, `isDeleted=0`, `createdAt` populated |
| 2 | Default contextType | Create mention without specifying `contextType` | `contextType` defaults to `"reference"` |
| 3 | Nullable snippet | Create mention with `snippet=null` | Row is created successfully; `snippet` is NULL |
| 4 | Cascade delete on entity removal | Delete the parent Entity | All EntityMention rows for that entity are cascade-deleted |
| 5 | Query by entityId | Filter mentions by `entityId` | Returns all mentions for that entity, uses `memory_entity_mention_entity_id_idx` |
| 6 | Query by conversationId | Filter mentions by `conversationId` | Returns all mentions in that conversation, uses `memory_entity_mention_conversation_id_idx` |
| 7 | Query by messageId | Filter mentions by `messageId` | Returns mentions for that message, uses `memory_entity_mention_message_id_idx` |
| 8 | Multiple mentions per entity | Create 5 mentions for same entity | All 5 rows exist; `entity.mentionCount` should be updated by application logic |
| 9 | Soft delete mention | Set `isDeleted=1` on mention | Mention is excluded from default queries but remains in DB |
| 10 | Create mention with non-existent entityId | `entityId` pointing to non-existent entity | Foreign key constraint violation raised |

### Edge Cases

- **Same entity in same message multiple times**: Multiple EntityMention rows with identical `(entityId, messageId)` are allowed (no unique constraint)
- **Very long snippet**: Snippets exceeding 2000 characters should be truncated at application level
- **Null conversationId/messageId**: NOT NULL constraints — these fields are required
- **contextType values**: Application should validate against known values (e.g., "reference", "decision", "action_item")

### Error Scenarios

- **Null entityId**: NOT NULL constraint violation
- **Null conversationId**: NOT NULL constraint violation
- **Null messageId**: NOT NULL constraint violation
- **Invalid entityId (FK)**: Foreign key constraint violation — `entity_id` must reference an existing `memory_entity.id`
- **Orphaned mentions after entity deletion**: Should not happen due to CASCADE; if CASCADE fails, the transaction rolls back

---

## 3. DecisionRecord

### Unit Name
`DecisionRecord` — Captures decisions made during conversations

### Test Cases

| # | Test Case | Input | Expected Behavior |
|---|-----------|-------|-------------------|
| 1 | Create decision with valid data | `{ conversationId, decisionText: "Use PostgreSQL", rationale: "Team expertise" }` | Record is persisted with `alternativesJson="[]"`, `isReversed=0`, `isDeleted=0`, timestamps populated |
| 2 | Default alternativesJson | Create without specifying `alternativesJson` | Defaults to `"[]"` |
| 3 | Default isReversed | Create without specifying `isReversed` | Defaults to `0` |
| 4 | Create with alternatives | `{ ..., alternativesJson: '["MongoDB", "MySQL"]' }` | `alternativesJson` is stored as-is; application must validate JSON format |
| 5 | Reverse a decision | Set `isReversed=1` on existing record | `updatedAt` is refreshed; `isReversed` is updated |
| 6 | Query by conversationId | Filter by `conversationId` | Returns all decisions for that conversation, uses index |
| 7 | Soft delete decision | Set `isDeleted=1` | Record excluded from default queries |
| 8 | Null rationale | Create with `rationale=null` | Row created successfully; `rationale` is nullable |
| 9 | Update decision text | Change `decisionText` | `updatedAt` is refreshed; text is updated |
| 10 | Multiple decisions per conversation | Create 3 decisions for same conversationId | All 3 rows exist independently |

### Edge Cases

- **Empty decisionText**: `decisionText=""` should be rejected at application level (minimum length 1)
- **Malformed alternativesJson**: Application should validate that `alternativesJson` is valid JSON; DB stores it as plain TEXT
- **Very long decisionText**: Application should enforce a maximum length (e.g., 5000 characters)
- **Reversing already reversed decision**: Setting `isReversed=1` on an already-reversed record should be idempotent

### Error Scenarios

- **Null decisionText**: NOT NULL constraint violation
- **Null conversationId**: NOT NULL constraint violation
- **Null createdAt/updatedAt**: NOT NULL constraint violation
- **Invalid alternativesJson**: Not a DB error (TEXT column), but application should validate before insert

---

## 4. PatternExtract

### Unit Name
`PatternExtract` — Extracted recurring patterns across conversations

### Test Cases

| # | Test Case | Input | Expected Behavior |
|---|-----------|-------|-------------------|
| 1 | Create pattern with valid data | `{ name: "API-first design", patternType: "architectural", description: "..." }` | Pattern is persisted with `occurrences=1`, `confidence=0.5`, timestamps populated |
| 2 | Reject duplicate name+patternType | Create two patterns with `{ name: "API-first", patternType: "architectural" }` | Second insert raises unique constraint violation on `(name, patternType)` |
| 3 | Allow same name, different type | `{ name: "API-first", patternType: "behavioral" }` vs `{ name: "API-first", patternType: "architectural" }` | Both created successfully |
| 4 | Default occurrences | Create without specifying `occurrences` | Defaults to `1` |
| 5 | Default confidence | Create without specifying `confidence` | Defaults to `0.5` |
| 6 | Increment occurrences | Update `occurrences` from 1 to 5 | `updatedAt` is refreshed; `occurrences` is updated |
| 7 | Query by patternType | Filter by `patternType="architectural"` | Returns matching patterns, uses index |
| 8 | Soft delete pattern | Set `isDeleted=1` | Pattern excluded from default queries |
| 9 | Update confidence | Change `confidence` from 0.5 to 0.85 | `updatedAt` is refreshed; `confidence` is updated |
| 10 | Null description | Create with `description=null` | Row created successfully; `description` is nullable |

### Edge Cases

- **Zero occurrences**: `occurrences=0` should be allowed at DB level but flagged at application level (a pattern with 0 occurrences is logically invalid)
- **Confidence boundary**: `confidence=0.0` and `confidence=1.0` are both valid; values outside [0.0, 1.0] should be rejected
- **Very long name**: Application should enforce maximum length (e.g., 255 characters)
- **Empty patternType**: Application should reject empty `patternType` strings

### Error Scenarios

- **Null name**: NOT NULL constraint violation
- **Null patternType**: NOT NULL constraint violation
- **Null createdAt/updatedAt**: NOT NULL constraint violation
- **Duplicate (name, patternType) on batch insert**: Should be caught and reported per-row

---

## 5. Topic

### Unit Name
`Topic` — Auto-generated or manually curated conversation topics

### Test Cases

| # | Test Case | Input | Expected Behavior |
|---|-----------|-------|-------------------|
| 1 | Create topic with valid data | `{ name: "Machine Learning", description: "ML discussions", color: "#ff5733" }` | Topic is persisted with `isAutoGenerated=0`, `isDeleted=0`, timestamps populated |
| 2 | Default color | Create without specifying `color` | Defaults to `"#6366f1"` |
| 3 | Default isAutoGenerated | Create without specifying `isAutoGenerated` | Defaults to `0` (manual) |
| 4 | Auto-generated topic | Set `isAutoGenerated=1` | Topic is flagged as auto-generated; application may apply different rules |
| 5 | Query by name | Filter by `name` | Returns matching topics, uses index |
| 6 | Soft delete topic | Set `isDeleted=1` | Topic excluded from default queries; related ConversationTopic rows remain (application should filter) |
| 7 | Update topic | Change `description` and `color` | `updatedAt` is refreshed; fields are updated |
| 8 | Null description | Create with `description=null` | Row created successfully |
| 9 | Duplicate topic name | Create two topics with same name | Both are allowed (no unique constraint on name alone) |
| 10 | Cascade delete to ConversationTopic | Delete topic row | All related ConversationTopic rows are cascade-deleted |

### Edge Cases

- **Invalid color format**: Application should validate hex color format (e.g., `#RRGGBB`); DB stores as TEXT
- **Empty name**: Application should reject empty topic names
- **Very long name**: Application should enforce maximum length (e.g., 255 characters)
- **Mixed auto/manual topics with same name**: Both are allowed; application should handle disambiguation

### Error Scenarios

- **Null name**: NOT NULL constraint violation
- **Null createdAt/updatedAt**: NOT NULL constraint violation
- **Cascade delete impact**: Deleting a topic removes all ConversationTopic links; application must warn users

---

## 6. Project

### Unit Name
`Project` — Project-level grouping and tracking

### Test Cases

| # | Test Case | Input | Expected Behavior |
|---|-----------|-------|-------------------|
| 1 | Create project with valid data | `{ name: "Vivim", description: "AI memory layer", color: "#10b981" }` | Project is persisted with `isDeleted=0`, timestamps populated |
| 2 | Default color | Create without specifying `color` | Defaults to `"#8b5cf6"` |
| 3 | Query by name | Filter by `name` | Returns matching projects, uses index |
| 4 | Soft delete project | Set `isDeleted=1` | Project excluded from default queries |
| 5 | Update project | Change `description` and `color` | `updatedAt` is refreshed; fields are updated |
| 6 | Null description | Create with `description=null` | Row created successfully |
| 7 | Duplicate project name | Create two projects with same name | Both are allowed (no unique constraint on name) |
| 8 | Restore soft-deleted project | Set `isDeleted=0` on previously deleted project | Project is visible again in default queries |
| 9 | List all active projects | Query where `isDeleted=0` | Returns only non-deleted projects |
| 10 | Create project with minimal data | `{ name: "Minimal" }` | Project created with `description=null`, `color="#8b5cf6"`, `isDeleted=0` |

### Edge Cases

- **Empty name**: Application should reject empty project names
- **Invalid color format**: Application should validate hex color format
- **Very long description**: Application should enforce maximum length (e.g., 5000 characters)
- **Soft-deleted project with same name as new**: Application should either restore the old project or warn about the name collision

### Error Scenarios

- **Null name**: NOT NULL constraint violation
- **Null createdAt/updatedAt**: NOT NULL constraint violation
- **Concurrent creation of same name**: Two simultaneous inserts with same name both succeed (no unique constraint); application should handle deduplication

---

## 7. ConversationTopic

### Unit Name
`ConversationTopic` — Junction table linking conversations to topics

### Test Cases

| # | Test Case | Input | Expected Behavior |
|---|-----------|-------|-------------------|
| 1 | Create link with valid data | `{ conversationId, topicId, assignmentType: "manual" }` | Link is persisted with `isDeleted=0`, `createdAt` populated |
| 2 | Default assignmentType | Create without specifying `assignmentType` | Defaults to `"auto"` |
| 3 | Reject duplicate conversationId+topicId | Create two links with same `(conversationId, topicId)` | Second insert raises unique constraint violation |
| 4 | Allow same conversation, different topics | Link same conversationId to two different topicIds | Both links created successfully |
| 5 | Allow same topic, different conversations | Link same topicId to two different conversationIds | Both links created successfully |
| 6 | Cascade delete on topic removal | Delete the parent Topic | All ConversationTopic rows for that topic are cascade-deleted |
| 7 | Query by topicId | Filter by `topicId` | Returns all conversations linked to that topic, uses index |
| 8 | Soft delete link | Set `isDeleted=1` | Link excluded from default queries |
| 9 | Create with non-existent topicId | `topicId` pointing to non-existent topic | Foreign key constraint violation raised |
| 10 | Multiple assignment types | Create links with `"auto"` and `"manual"` for same conversation | Both links exist independently (different topicIds) |

### Edge Cases

- **assignmentType values**: Application should validate against known values (e.g., "auto", "manual", "suggested")
- **Orphaned conversationId**: No FK constraint on `conversationId` — application must ensure conversation exists
- **Re-linking after soft delete**: If a link was soft-deleted and user wants to re-link, application should either restore the old row or allow creation of a new one
- **Bulk topic assignment**: Assigning 10+ topics to a single conversation should be performant

### Error Scenarios

- **Null conversationId**: NOT NULL constraint violation
- **Null topicId**: NOT NULL constraint violation
- **Null createdAt**: NOT NULL constraint violation
- **Invalid topicId (FK)**: Foreign key constraint violation — `topic_id` must reference an existing `memory_topic.id`
- **Duplicate (conversationId, topicId) on batch insert**: Should be caught and reported

---

## 8. UserPreference

### Unit Name
`UserPreference` — Learned or explicit user preferences

### Test Cases

| # | Test Case | Input | Expected Behavior |
|---|-----------|-------|-------------------|
| 1 | Create preference with valid data | `{ userId: "user-123", key: "theme", value: "dark", source: "explicit" }` | Preference is persisted with `confidence=1.0`, `isDeleted=0`, timestamps populated |
| 2 | Default userId | Create without specifying `userId` | Defaults to `"default"` |
| 3 | Default source | Create without specifying `source` | Defaults to `"learned"` |
| 4 | Default confidence | Create without specifying `confidence` | Defaults to `1.0` |
| 5 | Reject duplicate userId+key | Create two preferences with `{ userId: "user-123", key: "theme" }` | Second insert raises unique constraint violation on `(userId, key)` |
| 6 | Allow same key, different user | `{ userId: "user-1", key: "theme" }` and `{ userId: "user-2", key: "theme" }` | Both created successfully |
| 7 | Query by userId | Filter by `userId` | Returns all preferences for that user, uses index |
| 8 | Soft delete preference | Set `isDeleted=1` | Preference excluded from default queries |
| 9 | Update preference value | Change `value` from "dark" to "light" | `updatedAt` is refreshed; `value` is updated |
| 10 | Upsert behavior | Insert or update preference for `(userId, key)` | If exists, update; if not, create. Application should implement upsert logic |

### Edge Cases

- **Empty value**: `value=""` should be allowed (e.g., unsetting a preference)
- **Confidence boundary**: `confidence=0.0` and `confidence=1.0` are both valid; values outside [0.0, 1.0] should be rejected
- **source values**: Application should validate against known values (e.g., "learned", "explicit", "inferred")
- **Very long value**: Application should enforce maximum length (e.g., 10000 characters for JSON values)
- **Default user preferences**: System-level preferences with `userId="default"` should be treated as fallbacks

### Error Scenarios

- **Null key**: NOT NULL constraint violation
- **Null value**: NOT NULL constraint violation
- **Null createdAt/updatedAt**: NOT NULL constraint violation
- **Duplicate (userId, key) on batch insert**: Should be caught and reported per-row
- **Invalid userId format**: Application should validate userId format (e.g., non-empty, valid characters)

---

## 9. ImportJob

### Unit Name
`ImportJob` — Tracks bulk import operations with progress and error info

### Test Cases

| # | Test Case | Input | Expected Behavior |
|---|-----------|-------|-------------------|
| 1 | Create job with valid data | `{ source: "chatgpt", filePath: "/data/export.json" }` | Job is persisted with `status="pending"`, all counters at 0, `resultJson="{}"`, timestamps populated |
| 2 | Default status | Create without specifying `status` | Defaults to `"pending"` |
| 3 | Default counters | Create without specifying any counters | `totalConversations=0`, `importedCount=0`, `duplicatesSkipped=0`, `errorsCount=0` |
| 4 | Default resultJson | Create without specifying `resultJson` | Defaults to `"{}"` |
| 5 | Update status to "processing" | Change `status` from "pending" to "processing" | `updatedAt` is refreshed; `status` is updated |
| 6 | Update status to "completed" | Change `status` to "completed" with final counters | `updatedAt` is refreshed; all counters and status are updated |
| 7 | Update status to "failed" | Change `status` to "failed" with `errorsCount > 0` | `updatedAt` is refreshed; `resultJson` contains error details |
| 8 | Query by status | Filter by `status="pending"` | Returns pending jobs, uses index |
| 9 | Null filePath | Create with `filePath=null` | Row created successfully (filePath is nullable) |
| 10 | Soft delete job | Set `isDeleted=1` | Job excluded from default queries |

### Edge Cases

- **Invalid status transitions**: Application should enforce state machine (pending → processing → completed/failed)
- **Negative counters**: Application should reject negative values for `importedCount`, `duplicatesSkipped`, `errorsCount`, `totalConversations`
- **Counters exceeding total**: `importedCount + duplicatesSkipped + errorsCount` should not exceed `totalConversations`
- **Malformed resultJson**: Application should validate JSON format before storing
- **Very long filePath**: Application should enforce maximum length (e.g., 1024 characters)
- **Concurrent job processing**: Two processes should not be able to update the same job simultaneously; application should use optimistic locking

### Error Scenarios

- **Null source**: NOT NULL constraint violation
- **Null createdAt/updatedAt**: NOT NULL constraint violation
- **Status transition from "completed" to "pending"**: Application should reject backwards state transitions
- **Counter overflow**: Extremely large values should be handled by application (BIGINT range is sufficient)
- **Duplicate job creation**: Application should prevent creating duplicate jobs for the same `(source, filePath)` combination

---

## 10. MemoryEmbedding

### Unit Name
`MemoryEmbedding` — Vector embeddings for semantic search over entities

### Test Cases

| # | Test Case | Input | Expected Behavior |
|---|-----------|-------|-------------------|
| 1 | Create embedding with valid data | `{ entityType: "entity", entityId, vector: "[0.1, 0.2, ...]", model: "text-embedding-3-small" }` | Embedding is persisted with `dimensions=1536`, `isDeleted=0`, `createdAt` populated |
| 2 | Default model | Create without specifying `model` | Defaults to `"text-embedding-3-small"` |
| 3 | Default dimensions | Create without specifying `dimensions` | Defaults to `1536` |
| 4 | Reject duplicate entityType+entityId+model | Create two embeddings with same `(entityType, entityId, model)` | Second insert raises unique constraint violation |
| 5 | Allow same entity, different models | Create embeddings for same entity with different models | Both created successfully |
| 6 | Cascade delete on entity removal | Delete the parent Entity | All MemoryEmbedding rows for that entity are cascade-deleted |
| 7 | Query by entityType | Filter by `entityType` | Returns matching embeddings, uses index |
| 8 | Query by entityId | Filter by `entityId` | Returns matching embeddings, uses index |
| 9 | Soft delete embedding | Set `isDeleted=1` | Embedding excluded from default queries |
| 10 | Create with non-existent entityId | `entityId` pointing to non-existent entity | Foreign key constraint violation raised |

### Edge Cases

- **Very long vector string**: Embedding vectors of 1536+ dimensions produce large strings; application should validate length before insert
- **Invalid vector format**: Application should validate that `vector` is a valid JSON array of floats
- **dimensions mismatch**: If `dimensions` does not match the actual vector length, application should reject or flag
- **entityType values**: Application should validate against known entity types (e.g., "entity", "decision", "pattern")
- **Multiple embeddings per entity**: Different models for the same entity are allowed; application should handle retrieval priority
- **Empty vector string**: Application should reject `vector=""` — must contain at least one dimension

### Error Scenarios

- **Null entityType**: NOT NULL constraint violation
- **Null entityId**: NOT NULL constraint violation
- **Null vector**: NOT NULL constraint violation
- **Null createdAt**: NOT NULL constraint violation
- **Invalid entityId (FK)**: Foreign key constraint violation — `entity_id` must reference an existing `memory_entity.id`
- **Duplicate (entityType, entityId, model) on batch insert**: Should be caught and reported per-row
- **Cascade delete impact**: Deleting an entity removes all its embeddings; application must ensure this is intentional

---

## Cross-Cutting Test Contracts

### Transaction Integrity

| # | Test Case | Expected Behavior |
|---|-----------|-------------------|
| 1 | Create entity + mention in single transaction | Both succeed or both roll back |
| 2 | Create entity + embedding in single transaction | Both succeed or both roll back |
| 3 | Create topic + conversation topic in single transaction | Both succeed or both roll back |
| 4 | Partial failure in batch insert | Successful rows are committed; failed rows are reported with error details |

### Soft Delete Consistency

| # | Test Case | Expected Behavior |
|---|-----------|-------------------|
| 1 | All default queries filter by `isDeleted=0` | Soft-deleted rows never appear in default query results |
| 2 | Soft delete does not cascade to children | Soft-deleting an entity does NOT soft-delete its mentions or embeddings |
| 3 | Hard delete does cascade to children | Hard-deleting an entity DOES cascade-delete its mentions and embeddings |
| 4 | Restore soft-deleted record | Setting `isDeleted=0` restores visibility in default queries |

### ULID Generation

| # | Test Case | Expected Behavior |
|---|-----------|-------------------|
| 1 | ULID format validation | All IDs match the ULID format: 26 characters, Crockford's Base32 |
| 2 | ULID uniqueness | 10,000 concurrent inserts produce 10,000 unique IDs |
| 3 | ULID time-ordering | IDs generated later have higher sort order than IDs generated earlier |

### Timestamp Handling

| # | Test Case | Expected Behavior |
|---|-----------|-------------------|
| 1 | BigInt epoch millis | All timestamps are stored as BIGINT (epoch millis) |
| 2 | createdAt immutable | `createdAt` is set on insert and never updated |
| 3 | updatedAt auto-refresh | `updatedAt` is refreshed on every update operation |
| 4 | Timestamp precision | Timestamps preserve millisecond precision |
