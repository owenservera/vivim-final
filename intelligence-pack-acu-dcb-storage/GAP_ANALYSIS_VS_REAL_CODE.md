# Gap Analysis: Intelligence Pack vs Real vivim-final Code

> **Method:** Every claim below was verified against the live source tree
> (`src/`, `prisma/`, `frontend/`), **not** against the pack's own docs or the
> (nested/duplicated) docs directory. References are real `file:line` anchors.
> Analyzed on 2026-08-13 against the current working tree.

**Bottom line:** This pack's *spec* is high quality, but roughly 60% of its
runtime surface already exists in vivim-final (under different names), and its
*code* was written for a generic Express + `prisma migrate dev` world that does
not match this repo's conventions. The highest-value work is **not** porting the
pack wholesale — it is implementing the ~5 genuinely missing capabilities in the
repo's own style. See the implementation order at the end.

---

## 1. Already Implemented in Real Code (do NOT re-port)

| Pack deliverable | Real code equivalent | Evidence |
|---|---|---|
| 8 DCB profiles (seed, reunion, convergence, continuum, handoff, probe, deep_research, decision_brief) with L0–L7 layers | `src/engines/dcb-profile.ts` | All 8 profiles + layer matrix live here |
| 5-stage context assembly (DETECT→RECALL→RANK→BUDGET→INJECT) | `src/engines/context-assembly.ts` | Pipeline at file top (line 2 comment); BUDGET_ALLOCATION per task type (~8000-token default) |
| Budget decay over time | `src/engines/cortex-budget.ts` | `decay` logic present |
| Recency-decay scoring | `src/engines/dcb-projector.ts` | `recencyDecay(secs)` |
| ACU-provenance fields on a universal node | `prisma/schema.prisma` `model Node` (line 767) | `contentHash`, `version`, `state`, `securityLevel`, `contentType` + `acuType`, `lineageKind`, `valueScore`, `isHighValue` |
| Node capture on every message with assistant→user forking | `src/engines/conversation-manager.ts::captureAsNode` (line 219) | Forks `responds_to` / `follows` edges, sets contentHash/version/state/acl/authorDid |
| Message → ContentUnit decomposition + persistence | `src/engines/content-unit-decomposer.ts::decomposeToContentUnits` (line 135); `prisma` `ContentUnit` (line 2647) | Called at conversation-manager.ts:593, 950 (streaming + non-streaming paths) |
| Memory-as-Node with spaced-repetition initial state | `src/engines/memory-engine.ts::recordMemory` (~line 284) | Emits `cap-store.memory` Nodes with FSRS-6 initial fields |
| Memory consolidation + decay | `src/engines/memory-engine.ts` (lines 478–514) | `decayDays: 30`, `decayFactor: 0.9` |
| Entity extraction / links / mentions | `prisma` `Entity` (2015), `EntityMention` (2034), `MessageLink` (2666), `MessageEntity` (2684) | Tables exist |
| Topic / project organization of conversations | `prisma` `Topic` (2080), `Project` (2092), `ConversationTopic` (2104); `src/engines/conversation-organizer.ts` | Present |
| Content hashing / dedup key derivation | `src/ids.ts` | SHA-256 content hash + FNV-1a |
| Storage relocation (WAL, move, backup) | `src/engines/backup-scheduler.ts`; `src/server/storage-router.ts` | Relocation engine + status/progress/move/rollback/cleanup routes |
| Memory persistence + access control | `prisma` `MemoryLink` (2704), `MemoryAccess` (2721) | Present |

**Consequence:** Do not create duplicate DCB/context-assembly/profile work. Any
new implementation must extend these existing engines.

---

## 2. Missing in Real Code (the genuine gap)

| # | Capability | Status in real code |
|---|---|---|
| M1 | **Message-level identity dedup** — no `providerMessageId` / `identityHash` on `ConversationMessage` (schema line 632). Dedup exists only in `src/alerting/dedup.ts`, `src/engines/error-tracker.ts`, `src/engines/code-audit/scoring.ts` (operational alerts, not conversation messages) | **Missing** |
| M2 | **Collections system** — no `Collection` model anywhere in the 204 models of `prisma/schema.prisma`; grep for collection across schema + server returns zero hits | **Missing** |
| M3 | **TTL / lifecycle on ConversationMessage & Node** — no `expiresAt` / `isEphemeral` / `ttlSeconds` on `ConversationMessage` (632). `expiresAt` exists only on `EpisodicMemory` (1945), a memory-curated row (2410), and `Notification` (3391) | **Missing** |
| M4 | **Compaction / vacuum engine** — only WAL pragmas at `src/storage/prisma.ts` and `src/storage/db.ts:491`. No scheduled compaction, no dead-version GC, no size-triggered vacuum | **Missing** |
| M5 | **Pin / archive / readStatus on ConversationMessage** — `isPinned` exists only on `MemoryCurated` (2317) and `ContentItem` (3344); `isArchived` only on `EntityContainer` (3285) and `SlackChannelMeta` (3592). Nothing on messages | **Missing** |
| M6 | **Update APIs for messages/nodes** — `src/server/node-router.ts` has GET/POST only; `src/server/memory-router.ts` has export/import only; `src/server/storage-router.ts` is relocation-only. No PUT/PATCH/DELETE for pin/archive/rename/delete | **Missing** |
| M7 | **Frontend pin/archive/collection UI** — grep across `frontend/src` for pin/archive/collection features returns empty | **Missing** |
| M8 | **FSRS-6 review scheduler** — initial state exists in `recordMemory()`, but no due-date review pass / next-interval computation at retrieval time | **Partial** (M3/M4 mostly apply) |

---

## 3. Convention Mismatches (pack code vs this repo — DO NOT follow the pack verbatim)

| Pack code approach | vivim-final mandate | Source |
|---|---|---|
| Raw `ALTER TABLE` SQL + `bun run prisma:migrate:dev` (DATABASE_MIGRATIONS.md) | `bunx prisma db push` (DDL only) + **SchemaMeta-backed `MigrationRunner`** for data migrations; **no second migration mechanism** (`src/storage/migration/`, registry `migrations-registry.ts`) | `AGENTS.md` (Database, Migration history) |
| Express idioms: `Router`, `app.locals`, `app.use`, middleware | Bun native HTTP on port 9420; router factories return `(req: Request) => Promise<Response>` with `url.pathname ===` matching | `src/server/*-router.ts` |
| `EnhancedMemoryEngine extends MemoryEngine` + monkey-patch `store.createMessage` (INTEGRATION_GUIDE.md) | Composition + explicit wiring in bootstrap (`src/server/bootstrap-engines.ts`, `engines-catalog.ts`, `module-registry.ts`) | `AGENTS.md` (One Entry Point, Engine impl) |
| Standalone `scripts/migrate-acu-dcb-storage.ts` | Register migration steps in `migrations-registry.ts`, applied via `applyPendingMigrations()` at boot | `AGENTS.md` |
| "One profile per provider" / dedup via message bodies | Repo already has content-hash machinery in `src/ids.ts` — reuse it | `src/ids.ts` |

---

## 4. Recommended Implementation Order (maximal value, repo-native)

Ordered by value/effort and sequenced so each step reuses existing infrastructure.
All schema changes go through `bunx prisma db push` + rebuild the fixture DB
(`DATABASE_URL="file:C:/0-BlackBoxProject-0/vivim-final/tests/fixtures/node-store-test.db" bunx prisma db push --skip-generate --accept-data-loss`).

1. **M1 — Message identity dedup** (S)
   Add `providerMessageId String?` + `identityHash String? @unique` to
   `ConversationMessage`; compute identity hash via `src/ids.ts` SHA-256 at write
   time in `conversation-manager.ts`; upsert instead of duplicate on re-send.
   Smallest, highest immediate value (idempotency).

2. **M5 + M6 — Pin / archive / readStatus + CRUD APIs** (M)
   Add `isPinned Int`, `isArchived Int`, `readStatus String` (or enum) to
   `ConversationMessage`; extend `node-router.ts` / `conversation-router.ts`
   with `PATCH /api/conversations/:id/messages/:mid` (pin/unpin, archive, mark
   read). No new engine needed — extend `ConversationStore` contract.

3. **M2 — Collections system** (M)
   New `Collection` + `CollectionItem` models (reuse `Node`/`ConversationMessage`
   linkage via `NodeEdge` or a direct FK); a `collection-engine.ts`; `GET/POST/
   PATCH/DELETE /api/collections` routes; wire into catalog/UI slots.

4. **M3 + M4 — TTL lifecycle + compaction engine** (M–L)
   Add `expiresAt BigInt?`, `isEphemeral Int`, `ttlSeconds Int?` to
   `ConversationMessage` and `Node`; a `lifecycle-engine.ts` that sweeps expired
   rows and triggers `VACUUM`-aware compaction via the storage layer
   (`src/storage/db.ts`), registered as a boot service (not a second scheduler);
   expose `POST /api/storage/compact` in `storage-router.ts`.

5. **M8 — FSRS-6 review scheduler** (M)
   Add `dueAt BigInt`/`reviewCount Int` to `Memory`-related Node metadata;
   compute next interval in `memory-engine.ts` retrieval path (not a new engine);
   surface "due memories" via `memory-router.ts` `GET /api/memory/due`.

6. **M7 — Frontend** (ties to M2/M5)
   Only after backend models/routes exist: pin/archive buttons + collections
   panel wired through capability slots per `frontend-ux-refinement`.

**Suggested scope for one pass:** M1 + M5 + M6 (dedup + pin/archive/readStatus +
APIs) are the cleanest "maximal value" slice — three capabilities, one schema
push, no new engine, fully covered by existing contracts and fixtures.
