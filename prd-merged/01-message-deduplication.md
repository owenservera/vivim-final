# PRD: Message Identity Deduplication (M1)

**Product:** vivim-final Message System  
**Source:** intelligence-pack-acu-dcb-storage + COMPLETE UPGRADE PACKAGE  
**Version:** 1.0  
**Status:** Draft  
**Date:** 2026-08-13  
**Phase:** 1 (Foundation)

---

## Executive Summary

This PRD details the implementation of message identity deduplication for vivim-final. This enhancement prevents duplicate messages across sync/import operations by using SHA256-based identity hashing. This is the highest-value, lowest-effort capability in the enhancement set.

**Key Deliverables:**
- SHA256-based message identity hashing
- Upsert logic for message deduplication
- Schema additions for identity tracking
- Integration with existing conversation manager

**Estimated Effort:** 1 week  
**Risk Level:** Low (additive changes, well-defined algorithm)

---

## Background

### Current State

vivim-final message system has:
- `ConversationMessage` model with basic fields (line 632 in schema)
- No `providerMessageId` or `identityHash` fields
- No deduplication system for conversation messages
- Content hashing exists in `src/ids.ts` but not applied to messages
- Deduplication exists only in operational alerts (`src/alerting/dedup.ts`)

### Problem Statement

The current message system lacks:
1. **Message Identity:** No way to identify duplicate messages across sync/import
2. **Idempotency:** Re-sending the same message creates duplicates
3. **Cross-Provider Dedup:** No way to link the same message seen on different providers

### Solution Overview

Implement SHA256-based message identity hashing to create an intelligent deduplication system that:
- Prevents duplicate messages via identity hashing
- Supports two identity modes (provider ID mode and role+content mode)
- Upserts messages instead of creating duplicates
- Links duplicate messages across providers

---

## Requirements

### Functional Requirements

#### FR-1: Message Identity Hashing

**FR-1.1:** Implement SHA256-based message identity:
```
identity = SHA256(provider + "\0" + account + "\0" + conv_id + "\0" + [provider_msg_id OR (role + "\0" + content)])
```

**FR-1.2:** Support two identity modes:
- **Provider ID mode:** Use `providerMsgId` if available and non-empty
- **Role+Content mode:** Use role and content if `providerMsgId` unavailable

**FR-1.3:** Identity components:
- provider (string)
- account (string)  
- convId (string)
- role (string) - for role+content mode
- content (string) - for role+content mode
- providerMsgId (optional string) - for provider ID mode

**FR-1.4:** Identity stability:
- Same inputs must produce same identity hash
- Different inputs must produce different identity hashes
- Identity must be deterministic across runs

#### FR-2: Schema Additions

**FR-2.1:** Add fields to `ConversationMessage` model:
```prisma
model ConversationMessage {
  // ... existing fields ...
  
  providerMessageId String? @map("provider_message_id")
  identityHash String? @unique @map("identity_hash")
  
  @@index([identityHash], map: "idx_cm_identity")
  @@map("conversation_message")
}
```

**FR-2.2:** Index identityHash for performance
**FR-2.3:** Make identityHash unique to prevent duplicates at database level

#### FR-3: Upsert Logic

**FR-3.1:** Implement upsert logic with three outcomes:
- **Inserted:** No existing message with same identity
- **Merged:** Existing message found, sources merged (future extension)
- **Unchanged:** Existing message found, no changes needed

**FR-3.2:** On message creation:
1. Compute identity hash using `src/ids.ts` SHA-256
2. Check if message with same identity exists
3. If exists, return existing message (no duplicate)
4. If not exists, create new message with identity hash

**FR-3.3:** Store provider message ID when available from CDP capture

#### FR-4: Integration with Conversation Manager

**FR-4.1:** Integrate identity hashing into `conversation-manager.ts` message creation
**FR-4.2:** Apply identity hashing at write time (both streaming and non-streaming paths)
**FR-4.3:** Maintain backward compatibility with existing message creation

### Non-Functional Requirements

#### NFR-1: Performance

**NFR-1.1:** Identity hashing latency < 1ms per message
**NFR-1.2:** Upsert operation < 10ms per message
**NFR-1.3:** Identity check query < 5ms

#### NFR-2: Accuracy

**NFR-2.1:** Identity hashing must be collision-free
**NFR-2.2:** Upsert must correctly identify duplicates
**NFR-2.3:** Provider message ID must be captured correctly from CDP

#### NFR-3: Reliability

**NFR-3.1:** Identity hashing must handle missing fields gracefully
**NFR-3.2:** Upsert must handle concurrent operations
**NFR-3.3:** System must work without provider message ID (fallback to role+content)

#### NFR-4: Compatibility

**NFR-4.1:** All changes must be backward compatible
**NFR-4.2:** Existing message creation must continue to work
**NFR-4.3:** API changes must be additive

---

## Technical Design

### Data Model Changes

#### Schema Addition

```prisma
// prisma/schema.prisma

model ConversationMessage {
  id                    String   @id @default(cuid())
  conversationId        String   @map("conversation_id")
  role                  String
  content               String
  // ... existing fields ...
  
  // NEW: Message identity for deduplication
  providerMessageId     String?  @map("provider_message_id")
  identityHash          String?  @unique @map("identity_hash")
  
  @@index([conversationId], map: "idx_cm_conv")
  @@index([identityHash], map: "idx_cm_identity")
  @@map("conversation_message")
}
```

### Algorithm Implementation

#### Message Identity Hashing

```typescript
// src/engines/message-identity.ts

import { createHash } from 'crypto';
import type { ConversationMessageInput } from '../storage/contracts/conversation-store.js';

export interface MessageIdentityInput {
  provider: string;
  account: string;
  convId: string;
  role: string;
  content: string;
  providerMsgId?: string;
}

export class MessageIdentity {
  /**
   * Generate SHA256-based message identity
   * identity = SHA256(provider + "\0" + account + "\0" + conv_id + "\0" + [provider_msg_id OR (role + "\0" + content)])
   */
  static generate(input: MessageIdentityInput): string {
    const hash = createHash('sha256');
    
    hash.update(input.provider);
    hash.update('\0');
    hash.update(input.account);
    hash.update('\0');
    hash.update(input.convId);
    hash.update('\0');
    
    if (input.providerMsgId && input.providerMsgId.length > 0) {
      // Provider ID mode
      hash.update('id\0');
      hash.update(input.providerMsgId);
    } else {
      // Role+Content mode
      hash.update('rc\0');
      hash.update(input.role);
      hash.update('\0');
      hash.update(input.content);
    }
    
    return hash.digest('hex');
  }
  
  /**
   * Extract identity input from conversation message input
   */
  static fromMessageInput(
    input: ConversationMessageInput,
    provider: string,
    account: string
  ): MessageIdentityInput {
    return {
      provider,
      account,
      convId: input.conversationId,
      role: input.role,
      content: input.content,
      providerMsgId: input.providerMessageId,
    };
  }
}
```

#### Conversation Manager Integration

```typescript
// src/engines/conversation-manager.ts

import { MessageIdentity } from './message-identity.js';

export class ConversationManager {
  // ... existing code ...
  
  /**
   * Create message with deduplication
   */
  async createMessage(
    input: ConversationMessageInput,
    provider: string,
    account: string
  ): Promise<ConversationMessage> {
    // Generate identity hash
    const identityInput = MessageIdentity.fromMessageInput(input, provider, account);
    const identityHash = MessageIdentity.generate(identityInput);
    
    // Check if message with same identity exists
    const existing = await this.conversationStore.getByIdentityHash(identityHash);
    
    if (existing) {
      // Message already exists, return existing (no duplicate)
      return existing;
    }
    
    // Create new message with identity hash
    const messageInput = {
      ...input,
      providerMessageId: identityInput.providerMsgId,
      identityHash,
    };
    
    return await this.conversationStore.create(messageInput);
  }
}
```

#### Store Contract Extension

```typescript
// src/storage/contracts/conversation-store.ts

export interface ConversationStore {
  // ... existing methods ...
  
  /**
   * Get message by identity hash
   */
  getByIdentityHash(identityHash: string): Promise<ConversationMessage | null>;
  
  /**
   * Create message with identity hash
   */
  createWithIdentity(input: ConversationMessageInput & {
    providerMessageId?: string;
    identityHash: string;
  }): Promise<ConversationMessage>;
}
```

### API Design

No new API endpoints required. Deduplication happens transparently at the engine level.

---

## Implementation Plan

### Phase 1.1: Schema Changes (Day 1)

**Tasks:**
1. Add `providerMessageId` and `identityHash` fields to `ConversationMessage` model
2. Add index on `identityHash`
3. Run `bunx prisma db push --skip-generate`
4. Rebuild fixture database if needed

**Deliverables:**
- Updated Prisma schema
- Database migration applied
- Fixture database updated

**Success Criteria:**
- Schema changes applied successfully
- No breaking changes to existing data
- Index created for performance

### Phase 1.2: Identity Hashing Implementation (Day 2-3)

**Tasks:**
1. Create `src/engines/message-identity.ts`
2. Implement `MessageIdentity.generate()` method
3. Implement `MessageIdentity.fromMessageInput()` method
4. Add unit tests for identity hashing

**Deliverables:**
- Message identity hashing module
- Unit tests passing
- Collision-free hashing verified

**Success Criteria:**
- Identity hashing produces deterministic results
- Both modes (provider ID and role+content) work correctly
- Unit tests pass

### Phase 1.3: Conversation Manager Integration (Day 4-5)

**Tasks:**
1. Extend `ConversationStore` contract with `getByIdentityHash()` method
2. Implement `getByIdentityHash()` in store implementation
3. Integrate identity hashing into `conversation-manager.ts`
4. Update both streaming and non-streaming message creation paths
5. Add integration tests

**Deliverables:**
- Extended store contract
- Updated conversation manager
- Integration tests passing

**Success Criteria:**
- Duplicate messages are prevented
- Existing message creation continues to work
- Integration tests pass

### Phase 1.4: Testing and Validation (Day 5)

**Tasks:**
1. Run full test suite
2. Test with real provider data (chatgpt, claude, gemini)
3. Verify identity hashing works without provider message ID
4. Performance testing (hashing latency, upsert latency)
5. Regression testing

**Deliverables:**
- Test results
- Performance metrics
- Validation report

**Success Criteria:**
- All tests pass
- Performance targets met
- No regressions detected

---

## Risk Mitigation

### Technical Risks

**Risk 1: Identity Hash Collisions**
- **Likelihood:** Very Low (SHA256 is collision-resistant)
- **Impact:** High (false duplicates)
- **Mitigation:**
  - Use SHA256 (cryptographically secure)
  - Add unique constraint at database level
  - Monitor for collisions in production

**Risk 2: Performance Degradation**
- **Likelihood:** Low
- **Impact:** Medium
- **Mitigation:**
  - Index identityHash for fast lookups
  - Cache identity hashes for recent messages
  - Performance testing before rollout

**Risk 3: Missing Provider Message ID**
- **Likelihood:** Medium
- **Impact:** Low (fallback to role+content mode)
- **Mitigation:**
  - Implement role+content fallback
  - Test both modes extensively
  - Document fallback behavior

### Integration Risks

**Risk 1: Breaking Existing Message Creation**
- **Likelihood:** Low
- **Impact:** High
- **Mitigation:**
  - All changes are additive
  - Maintain backward compatibility
  - Comprehensive regression testing

**Risk 2: CDP Provider Message ID Capture**
- **Likelihood:** Medium
- **Impact:** Medium
- **Mitigation:**
  - Verify CDP capture extracts provider message ID
  - Test with each provider (chatgpt, claude, gemini)
  - Fallback to role+content if unavailable

---

## Success Metrics

### Quantitative Metrics

- **Deduplication Rate:** % of messages prevented as duplicates
- **Identity Hashing Latency:** < 1ms per message (target)
- **Upsert Latency:** < 10ms per message (target)
- **Collision Rate:** 0 collisions (target)

### Qualitative Metrics

- **Idempotency:** Re-sending same message does not create duplicates
- **Cross-Provider Linking:** Same message on different providers identified as duplicate
- **User Experience:** No visible performance degradation

---

## Rollout Plan

### Deployment Steps

1. Deploy schema changes to development environment
2. Run integration tests with synthetic data
3. Deploy to staging with production data backup
4. Monitor performance metrics for 1 week
5. Gradual rollout to production (10% → 50% → 100%)

### Rollback Plan

- Schema changes are additive (safe to rollback)
- Feature flag can disable deduplication if needed
- Database backup before deployment

---

## References

- `AGENTS.md` - Project instructions and conventions
- `src/ids.ts` - Existing content hashing utilities
- `intelligence-pack-acu-dcb-storage/PRD_STORAGE_ENHANCEMENT.md` - Source deduplication PRD
- `context-pack-md/# VIVIM-FINAL — COMPLETE UPGRADE PACKAGE.md` - Upgrade package storage section
