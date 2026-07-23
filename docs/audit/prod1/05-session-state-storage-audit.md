# Comprehensive Audit Scan: Area 5 — Session State Machine, Stream Block Store & Storage Contracts
**Target Subsystem:** ConversationManager, StreamBlockStore, Storage Contracts, Prisma Storage Layer, ULID Engine
**Audit Scope:** Implied Architectural Intent vs. Actual Code Implementation
**Location:** `src/engines/conversation-manager.ts`, `src/engines/stream-block-store.ts`, `src/storage/contracts/`, `src/storage/impl/`, `prisma/schema.prisma`

---

## 1. Executive Summary & Implied Intent
The Session & State system manages conversations, message stream parsing lifecycle, structured message content block storage, and transactional safety across Prisma SQLite storage.
- **Implied Intent (Invariants 2 & 10 — Store Contracts & Triple-Layer State):**
  1. **Strict Store Contracts:** Engines MUST depend strictly on abstract interface contracts under `src/storage/contracts/*.ts`, NEVER importing concrete Prisma implementations from `src/storage/impl/*.ts`.
  2. **Triple-Layer State Consistency:** Profile state (disk cookies), DB state (`Account`, `Session` rows), and Runtime memory state (`ChromeGovernor` slaves) must remain synchronized. Disk profile is canonical.
  3. **ULID Identity Standards:** All generated IDs (`conversationId`, `messageId`, `blockId`) must use monotonic, lexicographically sortable ULID strings from `src/ids.ts`.

---

## 2. Actual Code Scan Findings

### 🟢 Finding 5.1: Strict Store Contract Separation Verified
- **Validation:** Automated static grep scan confirmed **ZERO direct imports** of `src/storage/impl/` across all 13 core engines in `src/engines/`.
- **Actual Code Evidence:**
  - `ConversationManager` injects `ConversationStore`, `MessageStore`, `ContentUnitStore` contract interfaces via constructor options.

### 🟡 Finding 5.2: Stream Block Persistence & Interruption Recovery
- **Actual Code Evidence:**
  - `StreamBlockStore` (`src/engines/stream-block-store.ts`) buffers partial text chunks and flushes content units upon stream completion.
  - If a browser connection crashes mid-stream before `flush()`, uncommitted transient stream blocks in memory may be dropped without creating a partial message checkpoint.
- **Impact:** Interrupted streaming responses can leave empty message stubs in DB without error metadata.

### 🟢 Finding 5.3: ULID Identifier Invariant
- **Actual Code Evidence:**
  - `src/ids.ts` uses standard ULID generation (`ulid()`) for all entities across Prisma models and engine events.

---

## 3. Future Agent Verification & Audit Execution Plan

Future auditing agents must execute the following automated scan steps:

```bash
# Step 1: Run store contract import isolation check across all engines
bun run devops invariants check

# Step 2: Run conversation & message unit tests
bun test tests/unit/engines/conversation-manager.test.ts

# Step 3: Verify database health and migration status
bun run devops runtime-test health
```

---

## 4. Remediation & Convergence Checklist
- [ ] Implement incremental periodic flushing in `StreamBlockStore` (e.g. every 500ms or 50 tokens) to ensure partial responses persist across unexpected crashes.
- [ ] Add an orphaned message block cleanup task in `ConversationManager.recoverOrphanedSessions()`.
- [ ] Expand integration test coverage for streaming disconnects in `tests/integration/stream-interruption.test.ts`.
