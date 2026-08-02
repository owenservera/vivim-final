# Vivim Final — Full Upgrade Path Assessment

**Date:** 2026-08-02  
**Status:** IN PROGRESS  
**Scope:** 3 upgrade packages → unified integration roadmap  
**Last Updated:** After Phase 1 schema parity patch (all 10 cross-cutting models match source SQL)

---

## 1. Upgrade Package Inventory

### Package 1: vivim-phase0-upgrade-p2 (Memory Intelligence)
**Location:** `docs/vivim-phase0-upgrade-p2/vivim-phase0-upgrade/`  
**Scope:** Memory system completion — entity extraction, decision tracking, pattern mining, topic management  
**Priority:** P1 (foundation for intelligence features)  

| Component | Status | Evidence |
|-----------|--------|----------|
| Schema (10 models) | ✅ DONE | Entity, EntityMention, DecisionRecord, PatternExtract, Topic, Project, ConversationTopic, UserPreference, ImportJob, MemoryEmbedding — all in `prisma/schema.prisma` |
| memory-store.ts | ✅ EXISTS | `src/storage/impl/memory-intelligence-store-impl.ts` — field names match schema |
| knowledge-router.ts | ✅ EXISTS | `src/server/knowledge-router.ts` — 19 endpoints defined |
| semantic-search.ts | ✅ EXISTS | `src/engines/semantic-search.ts` + `src/storage/contracts/semantic-search-store.ts` |
| memory-engine.ts | ✅ EXISTS | `src/engines/memory-engine.ts` + 4 sub-engines in `src/engines/memory/` |
| Engine patches (5) | ❌ NOT APPLIED | Source: `impl/memory-engine-patch.ts`, `impl/context-assembly-patch.ts`, `impl/semantic-search-patch.ts`, `impl/export-engine-patch.ts`, `impl/harness-runtime-patch.ts` — these patch stub methods to do real DB reads/writes |
| Seed data | ❌ NOT RUN | Source: `impl/memory-intelligence-seed.ts` — 5 entities, 3 topics, 2 projects, 5 preferences |
| Knowledge API routes wired to server | ✅ DONE | `src/server/index.ts:51` imports `createKnowledgeRouter`, line 322 mounts `/api/knowledge/*` |

**What's missing:** The 5 engine patches (source files in `impl/`) have NOT been merged into the actual engine files. The seed data hasn't been run. Knowledge router IS wired to server.

---

### Package 2: vivim-upgrade-files-p1 (Next Tranche — 5 WebApps)
**Location:** `docs/vivim-upgrade-files-p1/`  
**Scope:** Schema expansion for Discord, Slack, WhatsApp, Reddit, Notion  
**Priority:** P2 (platform expansion)  

| Component | Status | Evidence |
|-----------|--------|----------|
| Cross-cutting models (10) | ✅ DONE | EntityContainer, EntityContainerMembership, ContentItem, Notification, Contact, ContactIdentity, SyncState, MediaAttachment, ProviderCapabilityTaxonomy — all patched to match source SQL exactly |
| Engine stubs (6) | ✅ DONE | `entity-container-engine.ts`, `content-item-engine.ts`, `notification-engine.ts`, `contact-engine.ts`, `sync-engine.ts`, `media-engine.ts` — types match schema |
| **Store implementations (6)** | ✅ DONE | `src/storage/impl/{entity-container,content-item,notification,contact,sync,media}-store-impl.ts` — Prisma-backed, all route methods implemented |
| Server routes (6) | ✅ DONE | `src/server/routes/{containers,content,notifications,contacts,sync,media}.ts` — field names match schema |
| Provider seeds (5) | ✅ DONE | `seeds/providers/{discord,slack,whatsapp,reddit,notion}.json` |
| Capability taxonomy seeds (50) | ✅ DONE | `seeds/capabilities/taxonomy-{discord,slack,whatsapp,reddit,notion}.ts` — 10 per provider, rewrites match new schema |
| Seed script | ✅ DONE | `seeds/capabilities/seed-taxonomy.ts` — upsert on `providerId_platformCategory_interactionPattern` |
| FTS5 virtual table | ✅ DONE | `prisma/views_003.sql` — `content_item_fts` + sync triggers |
| Views (5) | ⚠️ IN views_003.sql | SQL written, but Prisma doesn't manage views — need manual SQL execution |
| WebApp-specific tables (11) | ❌ NOT DONE | discord_voice_state, discord_member_meta, slack_channel_meta, slack_thread_meta, whatsapp_encryption_meta, whatsapp_contact_meta, reddit_subreddit_meta, reddit_post_meta, notion_block_meta, notion_database_meta, notion_page_meta |
| DB pushed to dev.db | ✅ DONE | `prisma db push --force-reset` applied |
| DB pushed to test fixture | ✅ DONE | `tests/fixtures/node-store-test.db` reset and synced |

**What's missing:** Phase 1 is now COMPLETE. Remaining work is Phase 0A engine patches and Phase 0B tunnel/P2P integration.

---

### Package 3: vivim-tunnel-p2p-p3 (Tunnel + P2P)
**Location:** `docs/vivim-tunnel-p2p-p3/`  
**Scope:** Public web presence + peer-to-peer networking  
**Priority:** P3 (networking layer)  

| Component | Status | Evidence |
|-----------|--------|----------|
| Shared types | ✅ DONE | `src/lib/tunnel-shared/types.ts` — 364 lines, all protocol types + config types + TunnelMetrics |
| Shared constants | ✅ DONE | `src/lib/tunnel-shared/constants.ts` |
| Shared errors | ✅ DONE | `src/lib/tunnel-shared/errors.ts` |
| Shared logger | ✅ DONE | `src/lib/tunnel-shared/logger.ts` |
| Shared barrel | ✅ DONE | `src/lib/tunnel-shared/index.ts` |
| TunnelMetrics (ours vs source) | ⚠️ DIFFERENT | Ours: `{connected, subdomain, reconnectCount, requestsHandled, bytesIn, bytesOut, latencyMs, uptimeSeconds}`. Source client types: `{totalRequests, totalResponses, totalBytesIn, totalBytesOut, averageLatencyMs, reconnectCount, uptimeSeconds, lastPingLatencyMs}`. Neither is wrong, but they diverge. |
| Tunnel client (6 files) | ❌ NOT INTEGRATED | Source: `docs/vivim-tunnel-p2p-p3/src/tunnel-client/` — connection-manager, frame-protocol, heartbeat, reconnection, request-handler, types. NOT copied to `src/engines/` or `src/lib/` |
| P2P node (5 files) | ❌ NOT INTEGRATED | Source: `docs/vivim-tunnel-p2p-p3/src/p2p-node/` — node-manager, file-sync, crdt-sync, types |
| Local server (1 file) | ❌ NOT INTEGRATED | Source: `docs/vivim-tunnel-p2p-p3/src/local-server/index.ts` |
| Orchestrator (4 files) | ❌ NOT INTEGRATED | Source: `docs/vivim-tunnel-p2p-p3/src/orchestrator/` — service-manager, health-monitor, config, index |
| Config files | ❌ NOT INTEGRATED | `config/default.toml`, `config/development.toml` |
| Tests (4 files) | ❌ NOT INTEGRATED | Source: `docs/vivim-tunnel-p2p-p3/tests/` |
| npm dependencies | ❌ NOT ADDED | `@libp2p/*` packages not in package.json |
| Server routes for tunnel | ❌ NOT CREATED | No `/api/tunnel/*` or `/api/p2p/*` endpoints |

**What's missing:** All 16 source files from the tunnel/P2P package need to be copied into the main codebase, imports adapted to `@/*` aliases, dependencies added, and server routes created.

---

## 2. Current State Summary

### What's DONE across all 3 packages:

**Phase 0A (Memory Intelligence):**
- ✅ 10 schema models exist
- ✅ memory-store, knowledge-router, semantic-search files exist
- ✅ memory-engine + 4 sub-engines exist
- ❌ 5 engine patches NOT applied (stub methods still return `[]`/`null`)
- ❌ Knowledge router NOT wired to HTTP server
- ❌ Seed data NOT run

**Phase 0B (Tunnel + P2P):**
- ✅ Shared types/constants/errors/logger in `src/lib/tunnel-shared/`
- ❌ 16 source files NOT copied to main codebase
- ❌ Dependencies NOT added
- ❌ Server routes NOT created
- ❌ CLI commands NOT created

**Phase 1 (Next Tranche):**
- ✅ 10 cross-cutting Prisma models (parity with source SQL)
- ✅ 11 WebApp-specific Prisma models (Discord, Slack, WhatsApp, Reddit, Notion)
- ✅ 6 engine stubs (correct types)
- ✅ 6 Prisma-backed store implementations (all route methods covered)
- ✅ 6 server routes (correct field names)
- ✅ 6 stores wired into ServerContext (both minimal + full bootstrap)
- ✅ 5 provider seeds
- ✅ 50 taxonomy seeds (correct schema)
- ✅ FTS5 virtual table + sync triggers
- ✅ Both DBs pushed (19 tables total)
- ✅ 5 views executed (v_all_containers, v_all_content, v_unread_notifications, v_all_contacts, v_sync_status)
- ✅ FTS5 virtual table + 3 sync triggers created

---

## 3. Next Steps (Grounded in Actual Code)

### Step 1: Wire Phase 1 routes into server bootstrap
**Why:** The 6 route files exist (`src/server/routes/{containers,content,notifications,contacts,sync,media}.ts`) and are now wired into the server with Prisma-backed store implementations. ✅ DONE.

**Status:** COMPLETE. 6 stores created, wired into `ServerContext` in both `createServer` and `createServerWithEngines`.

---

### Step 2: Add 11 WebApp-specific extension tables to Prisma schema
**Why:** The source SQL (`001_baseline.sql`) defines these 11 tables for provider-specific metadata. They're referenced by the cross-cutting models but don't exist in our schema yet.

**Tables to add:**
```
DiscordVoiceState, DiscordMemberMeta
SlackChannelMeta, SlackThreadMeta
WhatsAppEncryptionMeta, WhatsAppContactMeta
RedditSubredditMeta, RedditPostMeta
NotionBlockMeta, NotionDatabaseMeta, NotionPageMeta
```

**Source:** `docs/vivim-upgrade-files-p1/download/vivim-next-tranche-db-upgrade-plan.md` lines 1200-1959

**Action:**
1. Read source SQL for each table's CREATE TABLE statement
2. Add Prisma models matching field names exactly
3. Run `prisma generate` + `prisma db push`

**Status:** ✅ DONE. All 11 tables already exist in Prisma schema and are synced to DB.

---

### Step 3: Apply Phase 0A engine patches
**Why:** 5 source patch files exist in `docs/vivim-phase0-upgrade-p2/impl/` that replace stub methods with real DB queries. These haven't been merged.

**Files to patch:**
- `memory-engine-patch.ts` → merge into `src/engines/memory-engine.ts`
- `context-assembly-patch.ts` → merge into context assembly logic
- `semantic-search-patch.ts` → merge into `src/engines/semantic-search.ts`
- `export-engine-patch.ts` → merge into export engine
- `harness-runtime-patch.ts` → merge into harness runtime

**Action:**
1. Read each source patch file
2. Merge the real DB logic into the target engine files
3. Wire knowledge router to server: import `knowledge-router.ts` in `src/server/index.ts`

---

### Step 4: Integrate tunnel/P2P source files
**Why:** 16 files in `docs/vivim-tunnel-p2p-p3/src/` need to be copied and adapted.

**Files to copy:**
```
src/tunnel-client/ → src/lib/tunnel-client/  (6 files)
src/p2p-node/ → src/lib/p2p-node/  (5 files)
src/local-server/ → src/lib/local-server/  (1 file)
src/orchestrator/ → src/lib/tunnel-orchestrator/  (4 files)
```

**Adaptations needed:**
- Change `import from "../shared/types.js"` → `import from "../tunnel-shared/types.js"`
- Add `@libp2p/*` dependencies to package.json
- Create server routes: `/api/tunnel/*`, `/api/p2p/*`

---

### Step 5: Execute views + run seeds
**Why:** 5 views in `views_003.sql` need manual SQL execution. 50 taxonomy seeds need re-running with new schema. Phase 0A seed data needs to be run.

**Action:**
1. Execute `views_003.sql` against dev.db
2. Run `bun run seeds/capabilities/seed-taxonomy.ts`
3. Create and run Phase 0A seed (entities, topics, projects)

**Status:** ✅ views_003.sql executed. Taxonomy seeds already run (50 entries). Phase 0A seed pending.

---

### Step 6: Typecheck + verify
**Why:** Ensure no regressions across all changes.

**Action:**
1. `bun run typecheck` — should have 0 new errors
2. `bun run lint` — should pass
3. `bun test` — existing tests should pass
4. Start server and verify all 12 new routes respond

---

## 4. Dependency Graph

```
Step 1 (Wire routes + store impls) ← can start now
  │
  ├──► Step 2 (Add 11 extension tables) ← independent, can parallel
  │
  ├──► Step 3 (Apply Phase 0A patches) ← independent, can parallel
  │
  └──► Step 4 (Integrate tunnel/P2P) ← independent, can parallel
        │
        └──► Step 5 (Execute views + seeds) ← after Step 2
              │
              └──► Step 6 (Typecheck + verify) ← final gate
```

---

## 5. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Prisma view execution requires raw SQL (not managed by Prisma) | Low | Use `bunx prisma db execute` or direct SQLite CLI |
| Engine patches may conflict with existing engine logic | Medium | Feature flag `memoryV2: true` to gate new behavior |
| libp2p v3 API breaking changes from source code's v2 assumptions | Medium | Already noted in AGENTS.md — `connectionEncrypters`, `peerIdFromString()`, `chunk.slice()` |
| WebApp-specific tables may have foreign keys to tables not yet created | Low | Add tables in dependency order; all are additive |
| Server bootstrap may have null assignment errors for new stores | Low | Use `as never` cast pattern (already established) |

---

*Assessment updated 2026-08-02 after Phase 1 schema parity patch.*
