# Implementation Algorithms - ACU, DCB, and Storage Systems

**Project:** vivim-final Algorithm Implementation  
**Version:** 1.0  
**Date:** 2026-08-13  
**Purpose:** Exact algorithms for ACU extraction, DCB deduplication, FSRS-6 scheduling, and storage optimization

---

## 1. ACU Extraction Algorithm

### 1.1 Overview
Extract Atomic Chat Units (ACUs) from message blocks with rich metadata for content management.

### 1.2 Algorithm: ACU Extraction from Message Blocks

```typescript
// src/engines/acu-extractor.ts

interface ACUExtractionConfig {
  minBlockSize: number; // Minimum characters for ACU
  maxBlockSize: number; // Maximum characters for ACU
  preserveFormatting: boolean;
  extractCodeBlocks: boolean;
  extractToolCalls: boolean;
}

class ACUExtractor {
  constructor(private config: ACUExtractionConfig) {}

  /**
   * Extract ACUs from message blocks
   * Input: Parsed message blocks from StreamParserEngine
   * Output: Array of ACUs with metadata
   */
  async extractFromBlocks(
    blocks: ContentBlock[],
    conversationId: string,
    messageId: string
  ): Promise<ACU[]> {
    const acus: ACU[] = [];
    let acuIndex = 0;

    for (const block of blocks) {
      const acu = await this.extractACUFromBlock(block, acuIndex++, conversationId, messageId);
      if (acu) {
        acus.push(acu);
      }
    }

    return acus;
  }

  /**
   * Extract single ACU from block
   */
  private async extractACUFromBlock(
    block: ContentBlock,
    index: number,
    conversationId: string,
    messageId: string
  ): Promise<ACU | null> {
    const content = this.extractBlockContent(block);
    
    // Skip blocks below minimum size
    if (content.length < this.config.minBlockSize) {
      return null;
    }

    // Skip blocks above maximum size (split them)
    if (content.length > this.config.maxBlockSize) {
      return this.splitLargeBlock(block, index, conversationId, messageId);
    }

    // Determine ACU type based on block type
    const acuType = this.mapBlockTypeToACUType(block.type);

    // Extract metadata from block
    const metadata = await this.extractBlockMetadata(block);

    return {
      id: generateACUId(conversationId, messageId, index),
      type: acuType,
      content,
      metadata,
      source: {
        conversationId,
        messageId,
        blockIndex: index,
        blockType: block.type
      },
      createdAt: Date.now()
    };
  }

  /**
   * Extract text content from block
   */
  private extractBlockContent(block: ContentBlock): string {
    switch (block.type) {
      case 'text':
      case 'reasoning':
        return typeof block.text === 'string' ? block.text : '';
      case 'code':
        return block.text || '';
      case 'tool-call':
        return JSON.stringify(block);
      case 'tool-result':
        return JSON.stringify(block);
      case 'file':
        return `[File: ${block.url}]`;
      case 'source':
        return `[Source: ${block.title || block.url}]`;
      case 'error':
        return `[Error: ${block.message}]`;
      case 'meta':
        return `[Meta: ${block.key} = ${block.value}]`;
      default:
        return '';
    }
  }

  /**
   * Map block type to ACU type
   */
  private mapBlockTypeToACUType(blockType: string): ACUType {
    const mapping: Record<string, ACUType> = {
      'text': 'narrative',
      'reasoning': 'reasoning',
      'code': 'code',
      'tool-call': 'action',
      'tool-result': 'result',
      'file': 'reference',
      'source': 'reference',
      'error': 'error',
      'meta': 'metadata'
    };
    return mapping[blockType] || 'unknown';
  }

  /**
   * Extract metadata from block
   */
  private async extractBlockMetadata(block: ContentBlock): Promise<ACUMetadata> {
    const metadata: ACUMetadata = {
      tags: [],
      collectionIds: [],
      isPinned: false,
      isArchived: false,
      readStatus: 'unread',
      priority: 'normal'
    };

    // Auto-tag based on block type
    metadata.tags.push(block.type);

    // Auto-tag code blocks with language
    if (block.type === 'code' && block.language) {
      metadata.tags.push(`lang:${block.language}`);
    }

    // Auto-tag tool calls
    if (block.type === 'tool-call' && block.toolName) {
      metadata.tags.push(`tool:${block.toolName}`);
    }

    // Set priority for important blocks
    if (block.type === 'error') {
      metadata.priority = 'high';
    }

    return metadata;
  }

  /**
   * Split large blocks into multiple ACUs
   */
  private async splitLargeBlock(
    block: ContentBlock,
    startIndex: number,
    conversationId: string,
    messageId: string
  ): Promise<ACU> {
    const content = this.extractBlockContent(block);
    const chunks = this.splitContent(content, this.config.maxBlockSize);
    
    // Return first chunk as representative ACU
    return {
      id: generateACUId(conversationId, messageId, startIndex),
      type: this.mapBlockTypeToACUType(block.type),
      content: chunks[0],
      metadata: {
        tags: [block.type, 'split'],
        collectionIds: [],
        isPinned: false,
        isArchived: false,
        readStatus: 'unread',
        priority: 'normal',
        customFields: {
          totalChunks: chunks.length.toString(),
          chunkIndex: '0'
        }
      },
      source: {
        conversationId,
        messageId,
        blockIndex: startIndex,
        blockType: block.type
      },
      createdAt: Date.now()
    };
  }

  /**
   * Split content into chunks
   */
  private splitContent(content: string, maxSize: number): string[] {
    const chunks: string[] = [];
    let currentIndex = 0;

    while (currentIndex < content.length) {
      const endIndex = Math.min(currentIndex + maxSize, content.length);
      chunks.push(content.slice(currentIndex, endIndex));
      currentIndex = endIndex;
    }

    return chunks;
  }
}
```

### 1.3 Algorithm: ACU Reassembly

```typescript
/**
 * Reassemble ACUs into message content
 * Input: Array of ACUs with metadata
 * Output: Formatted message content
 */
function reassembleACUs(acus: ACU[]): string {
  // Sort ACUs by original block index
  const sorted = [...acus].sort((a, b) => 
    a.source.blockIndex - b.source.blockIndex
  );

  const parts: string[] = [];

  for (const acu of sorted) {
    const formatted = formatACUContent(acu);
    parts.push(formatted);
  }

  return parts.join('\n\n');
}

function formatACUContent(acu: ACU): string {
  switch (acu.type) {
    case 'code':
      return `\`\`\`${acu.metadata.customFields?.language || ''}\n${acu.content}\n\`\`\``;
    case 'reasoning':
      return `<thinking>\n${acu.content}\n</thinking>`;
    case 'action':
      return `<action>${acu.content}</action>`;
    case 'result':
      return `<result>${acu.content}</result>`;
    case 'error':
      return `<error>${acu.content}</error>`;
    default:
      return acu.content;
  }
}
```

---

## 2. DCB Deduplication Algorithm

### 2.1 Overview
Prevent duplicate messages using SHA256 identity hashing with two modes: provider ID and role+content.

### 2.2 Algorithm: Message Identity Hashing

```typescript
// src/engines/dcb-deduplicator.ts

interface MessageIdentityInput {
  provider: string;
  account: string;
  convId: string;
  role?: string;
  content?: string;
  providerMessageId?: string;
}

class DCBDeduplicator {
  /**
   * Generate SHA256 identity hash for message
   * Two modes: provider_id (if available) or role+content
   */
  generateIdentityHash(input: MessageIdentityInput): string {
    const { provider, account, convId, role, content, providerMessageId } = input;
    
    let identityString: string;
    
    if (providerMessageId && providerMessageId.length > 0) {
      // Provider ID mode: use provider's native message ID
      identityString = `${provider}\0${account}\0${convId}\0${providerMessageId}`;
    } else {
      // Role+Content mode: use role and content
      identityString = `${provider}\0${account}\0${convId}\0${role}\0${content}`;
    }
    
    return this.sha256(identityString);
  }

  /**
   * SHA256 hash implementation
   */
  private sha256(input: string): string {
    // Use Web Crypto API or Node crypto
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      // Browser/Bun environment
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } else {
      // Node.js environment
      const crypto = require('crypto');
      return crypto.createHash('sha256').update(input).digest('hex');
    }
  }

  /**
   * Check if message is duplicate
   */
  async isDuplicate(
    identityHash: string,
    storage: ConversationStore
  ): Promise<boolean> {
    const existing = await storage.findMessageByIdentityHash(identityHash);
    return existing !== null;
  }

  /**
   * Upsert message with deduplication
   */
  async upsertMessage(
    input: MessageInput,
    identity: MessageIdentityInput,
    storage: ConversationStore
  ): Promise<ConversationMessageRow> {
    const identityHash = this.generateIdentityHash(identity);
    
    // Check for existing message
    const existing = await storage.findMessageByIdentityHash(identityHash);
    
    if (existing) {
      // Merge metadata from new message
      const mergedMetadata = this.mergeMetadata(
        JSON.parse(existing.metadataJson || '{}'),
        input.metadataJson ? JSON.parse(input.metadataJson) : {}
      );
      
      // Update existing message
      await storage.updateMessage(existing.id, {
        metadataJson: JSON.stringify(mergedMetadata)
      });
      
      // Update deduplication status
      await storage.updateDeduplicationStatus(existing.id, 'merged');
      
      return existing;
    }
    
    // Create new message with identity hash
    const newMessage = await storage.createMessage({
      ...input,
      identityHash,
      identitySource: identity.providerMessageId ? 'provider_id' : 'role_content',
      providerMessageId: identity.providerMessageId,
      deduplicationStatus: 'unique',
      deduplicationCheckedAt: Date.now()
    });
    
    return newMessage;
  }

  /**
   * Merge metadata from duplicate messages
   */
  private mergeMetadata(
    existing: Record<string, unknown>,
    incoming: Record<string, unknown>
  ): Record<string, unknown> {
    return {
      ...existing,
      ...incoming,
      _merged: true,
      _mergeCount: (existing._mergeCount as number || 0) + 1,
      _lastMergedAt: Date.now()
    };
  }
}
```

### 2.3 Algorithm: Source Merging

```typescript
/**
 * Merge content from duplicate messages
 * Preserves the best version based on quality metrics
 */
class SourceMerger {
  /**
   * Merge duplicate messages
   */
  async mergeDuplicates(
    duplicates: ConversationMessageRow[]
  ): Promise<ConversationMessageRow> {
    // Sort by quality metrics (block count, timestamp, etc.)
    const sorted = this.sortByQuality(duplicates);
    
    // Use highest quality message as base
    const base = sorted[0];
    
    // Merge metadata from all duplicates
    const mergedMetadata = this.mergeAllMetadata(duplicates);
    
    // Merge blocks if they differ
    const mergedBlocks = this.mergeBlocks(duplicates);
    
    return {
      ...base,
      blocksJson: JSON.stringify(mergedBlocks),
      metadataJson: JSON.stringify(mergedMetadata),
      deduplicationStatus: 'merged'
    };
  }

  /**
   * Sort messages by quality
   */
  private sortByQuality(messages: ConversationMessageRow[]): ConversationMessageRow[] {
    return [...messages].sort((a, b) => {
      // Prefer messages with more blocks (richer content)
      const blockDiff = b.blockCount - a.blockCount;
      if (blockDiff !== 0) return blockDiff;
      
      // Prefer more recent messages
      const timeDiff = b.createdAt - a.createdAt;
      if (timeDiff !== 0) return timeDiff;
      
      // Prefer messages with latency data (more complete)
      const latencyDiff = (b.latencyMs ?? -1) - (a.latencyMs ?? -1);
      return latencyDiff;
    });
  }

  /**
   * Merge metadata from all duplicates
   */
  private mergeAllMetadata(messages: ConversationMessageRow[]): Record<string, unknown> {
    const merged: Record<string, unknown> = {
      _sourceCount: messages.length,
      _mergedAt: Date.now()
    };
    
    for (const message of messages) {
      const metadata = JSON.parse(message.metadataJson || '{}');
      Object.assign(merged, metadata);
    }
    
    return merged;
  }

  /**
   * Merge blocks from duplicates
   */
  private mergeBlocks(messages: ConversationMessageRow[]): ContentBlock[] {
    const allBlocks = messages.flatMap(m => 
      JSON.parse(m.blocksJson || '[]')
    );
    
    // Deduplicate blocks by content
    const uniqueBlocks = this.deduplicateBlocks(allBlocks);
    
    return uniqueBlocks;
  }

  /**
   * Deduplicate blocks by content hash
   */
  private deduplicateBlocks(blocks: ContentBlock[]): ContentBlock[] {
    const seen = new Set<string>();
    const unique: ContentBlock[] = [];
    
    for (const block of blocks) {
      const hash = this.hashBlock(block);
      if (!seen.has(hash)) {
        seen.add(hash);
        unique.push(block);
      }
    }
    
    return unique;
  }

  /**
   * Hash block for deduplication
   */
  private hashBlock(block: ContentBlock): string {
    return JSON.stringify({
      type: block.type,
      text: block.text,
      language: block.language,
      toolName: block.toolName
    });
  }
}
```

---

## 3. FSRS-6 Spaced Repetition Algorithm

### 3.1 Overview
Implement FSRS-6 spaced repetition algorithm for optimal memory review scheduling with 4 states: New, Learning, Review, Relearning.

### 3.2 Algorithm: FSRS-6 Core

```typescript
// src/engines/fsrs6-scheduler.ts

interface FSRS6State {
  stability: number;     // Memory stability (0-10)
  difficulty: number;    // Memory difficulty (0-10)
  dueDate: number;      // Next review timestamp
  lastReview: number | null;
  reviewCount: number;  // Number of reviews
  fsrsState: 'New' | 'Learning' | 'Review' | 'Relearning';
}

interface FSRS6Config {
  requestRetention: number;  // Target retention (0.7-0.9)
  maximumInterval: number;  // Maximum review interval (days)
  w: number[];              // FSRS-6 weights [17 parameters]
}

class FSRS6Scheduler {
  private config: FSRS6Config = {
    requestRetention: 0.9,
    maximumInterval: 36500, // 100 years
    w: [
      0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61
    ]
  };

  /**
   * Calculate next review parameters based on rating
   * Rating: 0 (again), 1 (hard), 2 (good), 3 (easy)
   */
  calculateNextReview(
    state: FSRS6State,
    rating: number,
    now: number = Date.now()
  ): FSRS6State {
    const { stability, difficulty, fsrsState, reviewCount } = state;
    
    let newStability = stability;
    let newDifficulty = difficulty;
    let newInterval = 1;
    let newState = fsrsState;

    switch (fsrsState) {
      case 'New':
        // Initial learning phase
        newStability = this.initialStability(rating);
        newDifficulty = this.initialDifficulty(rating);
        newState = rating < 2 ? 'Learning' : 'Review';
        newInterval = this.calculateInterval(newStability, newDifficulty);
        break;

      case 'Learning':
        // Learning phase with short intervals
        if (rating === 0) {
          // Failed - stay in learning
          newInterval = 1; // Review again in 1 minute
        } else if (rating === 1) {
          // Hard - stay in learning
          newInterval = 10; // Review in 10 minutes
        } else {
          // Good/Easy - move to review
          newState = 'Review';
          newInterval = this.calculateInterval(newStability, newDifficulty);
        }
        newStability = this.updateStability(stability, rating);
        newDifficulty = this.updateDifficulty(difficulty, rating);
        break;

      case 'Review':
        // Regular review phase
        if (rating === 0) {
          // Failed - go to relearning
          newState = 'Relearning';
          newInterval = 1; // Review again in 1 minute
        } else {
          // Successful - continue review
          newStability = this.updateStability(stability, rating);
          newDifficulty = this.updateDifficulty(difficulty, rating);
          newInterval = this.calculateInterval(newStability, newDifficulty);
        }
        break;

      case 'Relearning':
        // Relearning after failure
        if (rating === 0) {
          // Still failing - stay in relearning
          newInterval = 1;
        } else {
          // Successful - move to review
          newState = 'Review';
          newInterval = this.calculateInterval(newStability, newDifficulty);
        }
        newStability = this.updateStability(stability, rating);
        newDifficulty = this.updateDifficulty(difficulty, rating);
        break;
    }

    // Calculate due date
    const dueDate = now + (newInterval * 24 * 60 * 60 * 1000); // Convert days to ms

    return {
      stability: newStability,
      difficulty: newDifficulty,
      dueDate,
      lastReview: now,
      reviewCount: reviewCount + 1,
      fsrsState: newState
    };
  }

  /**
   * Calculate initial stability based on rating
   */
  private initialStability(rating: number): number {
    const w = this.config.w;
    return w[4] + w[5] * rating;
  }

  /**
   * Calculate initial difficulty based on rating
   */
  private initialDifficulty(rating: number): number {
    const w = this.config.w;
    return w[6] - Math.exp(w[7] * (rating - 1)) + 1;
  }

  /**
   * Update stability based on rating
   */
  private updateStability(stability: number, rating: number): number {
    const w = this.config.w;
    const difficultyPenalty = w[8] * (1 - rating);
    const difficultyBonus = w[9] * (rating - 1);
    const newStability = stability * (1 + difficultyPenalty) * (1 + difficultyBonus);
    return Math.max(0.1, newStability); // Minimum stability
  }

  /**
   * Update difficulty based on rating
   */
  private updateDifficulty(difficulty: number, rating: number): number {
    const w = this.config.w;
    const newDifficulty = difficulty - w[10] * (rating - 3);
    return Math.max(1, Math.min(10, newDifficulty)); // Clamp to 1-10
  }

  /**
   * Calculate review interval based on stability and difficulty
   */
  private calculateInterval(stability: number, difficulty: number): number {
    const w = this.config.w;
    const newInterval = stability * (w[11] * Math.exp(w[12] * (11 - difficulty)));
    return Math.min(this.config.maximumInterval, Math.max(1, newInterval));
  }

  /**
   * Get due memories for review
   */
  async getDueMemories(
    nodeStore: NodeStoreContract,
    limit: number = 50
  ): Promise<Node[]> {
    const now = Date.now();
    
    const memories = await nodeStore.queryNodes({
      type: 'cap-store.memory',
      state: 'active',
      where: {
        'data.dueDate': { lte: now }
      },
      orderBy: { 'data.dueDate': 'asc' },
      limit
    });
    
    return memories;
  }

  /**
   * Process memory review
   */
  async processReview(
    memoryId: string,
    rating: number,
    nodeStore: NodeStoreContract
  ): Promise<void> {
    const memory = await nodeStore.getNode(memoryId);
    if (!memory || memory.type !== 'cap-store.memory') {
      throw new Error('Memory not found');
    }

    const currentState = memory.data as FSRS6State;
    const newState = this.calculateNextReview(currentState, rating);

    await nodeStore.updateNode(memoryId, {
      data: { ...memory.data, ...newState }
    });
  }
}
```

### 3.3 Algorithm: Daily Review Scheduler

```typescript
/**
 * Daily review scheduler for FSRS-6
 * Runs daily to schedule review batches
 */
class DailyReviewScheduler {
  constructor(
    private fsrs: FSRS6Scheduler,
    private nodeStore: NodeStoreContract,
    private eventBus: CapabilityEventBus
  ) {}

  /**
   * Schedule daily review batch
   */
  async scheduleDailyReview(): Promise<{
    totalDue: number;
    scheduled: number;
    skipped: number;
  }> {
    const dueMemories = await this.fsrs.getDueMemories(this.nodeStore, 100);
    
    let scheduled = 0;
    let skipped = 0;

    for (const memory of dueMemories) {
      const state = memory.data as FSRS6State;
      
      // Skip pinned memories (they don't follow FSRS-6)
      if (memory.data.isPinned) {
        skipped++;
        continue;
      }

      // Emit review event
      this.eventBus.emit({
        type: 'memory:review_due',
        data: {
          memoryId: memory.id,
          dueDate: state.dueDate,
          fsrsState: state.fsrsState,
          difficulty: state.difficulty
        }
      });

      scheduled++;
    }

    return {
      totalDue: dueMemories.length,
      scheduled,
      skipped
    };
  }

  /**
   * Calculate optimal daily review load
   */
  calculateOptimalDailyLoad(): number {
    // Based on FSRS-6 research, optimal daily load is 20-50 reviews
    // Adjust based on user performance and time available
    return 30; // Default: 30 reviews per day
  }
}
```

---

## 4. TTL Sweep Algorithm

### 4.1 Overview
Automatically expire ephemeral data based on TTL fields for storage optimization.

### 4.2 Algorithm: TTL Sweep

```typescript
// src/engines/ttl-sweeper.ts

interface TTLSweepConfig {
  batchSize: number;
  maxAge: number; // Maximum age in milliseconds
  dryRun: boolean;
}

class TTLSweeper {
  constructor(
    private storage: CapStoreDb,
    private config: TTLSweepConfig
  ) {}

  /**
   * Run TTL sweep to expire old data
   */
  async sweep(): Promise<{
    messagesExpired: number;
    tracesExpired: number;
    nodesExpired: number;
    totalSizeFreed: number;
  }> {
    const now = Date.now();
    const results = {
      messagesExpired: 0,
      tracesExpired: 0,
      nodesExpired: 0,
      totalSizeFreed: 0
    };

    // Expire conversation messages
    const messages = await this.storage.prisma.conversationMessage.findMany({
      where: {
        expiresAt: { lte: now },
        isEphemeral: 1
      },
      take: this.config.batchSize
    });

    for (const message of messages) {
      if (!this.config.dryRun) {
        await this.storage.prisma.conversationMessage.delete({
          where: { id: message.id }
        });
      }
      results.messagesExpired++;
      results.totalSizeFreed += this.estimateMessageSize(message);
    }

    // Expire trace entries
    const traces = await this.storage.prisma.traceEntry.findMany({
      where: {
        expiresAt: { lte: now }
      },
      take: this.config.batchSize
    });

    for (const trace of traces) {
      if (!this.config.dryRun) {
        await this.storage.prisma.traceEntry.delete({
          where: { id: trace.id }
        });
      }
      results.tracesExpired++;
      results.totalSizeFreed += this.estimateTraceSize(trace);
    }

    // Expire ephemeral nodes
    const nodes = await this.storage.prisma.node.findMany({
      where: {
        expiresAt: { lte: now },
        isEphemeral: 1
      },
      take: this.config.batchSize
    });

    for (const node of nodes) {
      if (!this.config.dryRun) {
        await this.storage.prisma.node.delete({
          where: { id: node.id }
        });
      }
      results.nodesExpired++;
      results.totalSizeFreed += this.estimateNodeSize(node);
    }

    return results;
  }

  /**
   * Estimate message size in bytes
   */
  private estimateMessageSize(message: any): number {
    return JSON.stringify(message).length * 2; // Rough estimate (UTF-16)
  }

  /**
   * Estimate trace size in bytes
   */
  private estimateTraceSize(trace: any): number {
    return JSON.stringify(trace).length * 2;
  }

  /**
   * Estimate node size in bytes
   */
  private estimateNodeSize(node: any): number {
    return JSON.stringify(node).length * 2;
  }

  /**
   * Set TTL for a message
   */
  async setMessageTTL(
    messageId: string,
    ttlSeconds: number
  ): Promise<void> {
    const expiresAt = Date.now() + (ttlSeconds * 1000);
    
    await this.storage.prisma.conversationMessage.update({
      where: { id: messageId },
      data: {
        ttlSeconds,
        expiresAt,
        isEphemeral: 1
      }
    });
  }

  /**
   * Set TTL for a trace entry
   */
  async setTraceTTL(
    traceId: string,
    ttlSeconds: number
  ): Promise<void> {
    const expiresAt = Date.now() + (ttlSeconds * 1000);
    
    await this.storage.prisma.traceEntry.update({
      where: { id: traceId },
      data: {
        ttlSeconds,
        expiresAt
      }
    });
  }
}
```

---

## 5. Database Compaction Algorithm

### 5.1 Overview
Optimize database size through SQLite VACUUM and WAL checkpoint operations.

### 5.2 Algorithm: SQLite Compaction

```typescript
// src/engines/db-compactor.ts

interface CompactionConfig {
  minFreePages: number;
  minSizeReduction: number; // Minimum bytes to reclaim
  forceCompaction: boolean;
}

class DatabaseCompactor {
  constructor(
    private db: CapStoreDb,
    private config: CompactionConfig
  ) {}

  /**
   * Run database compaction
   */
  async compact(): Promise<{
    beforeSize: number;
    afterSize: number;
    sizeReduction: number;
    freePagesReclaimed: number;
    duration: number;
  }> {
    const startTime = Date.now();
    
    // Get current database statistics
    const beforeStats = await this.getDatabaseStats();
    
    // Check if compaction is needed
    if (!this.config.forceCompaction && beforeStats.freePages < this.config.minFreePages) {
      return {
        beforeSize: beforeStats.size,
        afterSize: beforeStats.size,
        sizeReduction: 0,
        freePagesReclaimed: 0,
        duration: Date.now() - startTime
      };
    }

    // Run WAL checkpoint to flush changes
    await this.checkpointWAL();

    // Run VACUUM to reclaim space
    await this.runVacuum();

    // Get post-compaction statistics
    const afterStats = await this.getDatabaseStats();
    
    const sizeReduction = beforeStats.size - afterStats.size;
    
    // Update compaction metadata
    await this.updateCompactionMetadata(sizeReduction, beforeStats.freePages);

    return {
      beforeSize: beforeStats.size,
      afterSize: afterStats.size,
      sizeReduction,
      freePagesReclaimed: beforeStats.freePages,
      duration: Date.now() - startTime
    };
  }

  /**
   * Get database statistics
   */
  private async getDatabaseStats(): Promise<{
    size: number;
    freePages: number;
    pageSize: number;
  }> {
    const stats = await this.db.prisma.$queryRaw`
      SELECT 
        page_count * page_size as size,
        freelist_count as free_pages,
        page_size
      FROM pragma_page_count(), pragma_page_size(), pragma_freelist_count()
    `;
    
    const row = stats[0] as any;
    return {
      size: row.size || 0,
      freePages: row.free_pages || 0,
      pageSize: row.page_size || 4096
    };
  }

  /**
   * Checkpoint WAL to flush changes
   */
  private async checkpointWAL(): Promise<void> {
    await this.db.prisma.$executeRaw`PRAGMA wal_checkpoint(TRUNCATE)`;
  }

  /**
   * Run VACUUM to reclaim space
   */
  private async runVacuum(): Promise<void> {
    await this.db.prisma.$executeRaw`VACUUM`;
  }

  /**
   * Update compaction metadata
   */
  private async updateCompactionMetadata(
    sizeReduction: number,
    freePagesReclaimed: number
  ): Promise<void> {
    const now = Date.now();
    
    await this.db.prisma.schemaMeta.upsert({
      where: { key_value: { key: 'last_compaction', value: 'metadata' } },
      create: {
        key: 'last_compaction',
        value: 'metadata',
        lastCompactionAt: now,
        compactionCount: 1,
        databaseSizeBytes: sizeReduction,
        freePages: freePagesReclaimed
      },
      update: {
        lastCompactionAt: now,
        compactionCount: { increment: 1 },
        databaseSizeBytes: sizeReduction,
        freePages: freePagesReclaimed
      }
    });
  }

  /**
   * Schedule automatic compaction
   */
  async scheduleAutoCompaction(intervalMs: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    // Run compaction weekly by default
    setInterval(async () => {
      try {
        const result = await this.compact();
        console.log('Auto-compaction completed:', result);
      } catch (error) {
        console.error('Auto-compaction failed:', error);
      }
    }, intervalMs);
  }
}
```

---

## 6. Relevance Decay Algorithm

### 6.1 Overview
Implement time-based relevance decay with 30-day half-life for memory prioritization.

### 6.2 Algorithm: Relevance Decay

```typescript
// src/engines/relevance-decay.ts

interface DecayConfig {
  halfLifeDays: number;
  minRelevance: number;
  maxRelevance: number;
}

class RelevanceDecay {
  constructor(private config: DecayConfig = {
    halfLifeDays: 30,
    minRelevance: 0.1,
    maxRelevance: 1.0
  }) {}

  /**
   * Calculate decayed relevance based on age
   */
  calculateDecayedRelevance(
    initialRelevance: number,
    createdAt: number,
    now: number = Date.now()
  ): number {
    const ageDays = (now - createdAt) / (24 * 60 * 60 * 1000);
    const decayFactor = Math.pow(0.5, ageDays / this.config.halfLifeDays);
    
    const decayedRelevance = initialRelevance * decayFactor;
    
    return Math.max(
      this.config.minRelevance,
      Math.min(this.config.maxRelevance, decayedRelevance)
    );
  }

  /**
   * Apply relevance decay to memories
   */
  async applyDecayToMemories(
    nodeStore: NodeStoreContract
  ): Promise<{
    updated: number;
    averageRelevance: number;
  }> {
    const now = Date.now();
    const memories = await nodeStore.queryNodes({
      type: 'cap-store.memory',
      state: 'active'
    });

    let totalRelevance = 0;
    let updated = 0;

    for (const memory of memories) {
      const data = memory.data as any;
      const initialRelevance = data.relevance || 0.5;
      const createdAt = data.occurredAt || memory.createdAt;
      
      const decayedRelevance = this.calculateDecayedRelevance(
        initialRelevance,
        createdAt,
        now
      );

      // Only update if relevance changed significantly
      if (Math.abs(decayedRelevance - initialRelevance) > 0.01) {
        await nodeStore.updateNode(memory.id, {
          data: { ...data, relevance: decayedRelevance }
        });
        updated++;
      }

      totalRelevance += decayedRelevance;
    }

    return {
      updated,
      averageRelevance: memories.length > 0 ? totalRelevance / memories.length : 0
    };
  }

  /**
   * Get memories sorted by relevance
   */
  async getMemoriesByRelevance(
    nodeStore: NodeStoreContract,
    limit: number = 50
  ): Promise<Node[]> {
    const memories = await nodeStore.queryNodes({
      type: 'cap-store.memory',
      state: 'active',
      orderBy: { 'data.relevance': 'desc' },
      limit
    });

    // Apply decay on-the-fly for accurate sorting
    const now = Date.now();
    const withDecay = memories.map(memory => {
      const data = memory.data as any;
      const createdAt = data.occurredAt || memory.createdAt;
      const decayedRelevance = this.calculateDecayedRelevance(
        data.relevance || 0.5,
        createdAt,
        now
      );
      return { ...memory, _decayedRelevance: decayedRelevance };
    });

    return withDecay.sort((a, b) => 
      (b._decayedRelevance as number) - (a._decayedRelevance as number)
    );
  }
}
```

---

## 7. Memory Consolidation Algorithm

### 7.1 Overview
Bridge episodic ACUs to eternal semantic memories through background consolidation.

### 7.2 Algorithm: Episodic to Semantic Consolidation

```typescript
// src/engines/memory-consolidator.ts

interface ConsolidationConfig {
  minEpisodes: number;
  confidenceThreshold: number;
  maxAge: number; // Maximum age in milliseconds
}

class MemoryConsolidator {
  constructor(
    private memoryEngine: MemoryEngine,
    private config: ConsolidationConfig = {
      minEpisodes: 3,
      confidenceThreshold: 0.7,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    }
  ) {}

  /**
   * Consolidate episodic memories into semantic memories
   */
  async consolidate(): Promise<{
    episodesProcessed: number;
    semanticMemoriesCreated: number;
    patternsFound: number;
  }> {
    const results = {
      episodesProcessed: 0,
      semanticMemoriesCreated: 0,
      patternsFound: 0
    };

    // Get recent episodic memories
    const since = Date.now() - this.config.maxAge;
    const episodes = await this.memoryEngine.recallEpisodes({
      since,
      limit: 1000
    });

    results.episodesProcessed = episodes.length;

    // Group episodes by pattern
    const patterns = this.findPatterns(episodes);
    results.patternsFound = patterns.length;

    // Create semantic memories from high-confidence patterns
    for (const pattern of patterns) {
      if (pattern.confidence >= this.config.confidenceThreshold) {
        await this.createSemanticMemory(pattern);
        results.semanticMemoriesCreated++;
      }
    }

    return results;
  }

  /**
   * Find patterns in episodic memories
   */
  private findPatterns(episodes: EpisodicMemory[]): Pattern[] {
    const patternMap = new Map<string, {
      episodes: EpisodicMemory[];
      count: number;
      successRate: number;
    }>();

    // Group by action + provider pattern
    for (const episode of episodes) {
      const key = `${episode.providerId}:${episode.action}`;
      const existing = patternMap.get(key);

      if (existing) {
        existing.episodes.push(episode);
        existing.count++;
        existing.successRate = existing.episodes.filter(e => e.success).length / existing.count;
      } else {
        patternMap.set(key, {
          episodes: [episode],
          count: 1,
          successRate: episode.success ? 1 : 0
        });
      }
    }

    // Convert to patterns
    const patterns: Pattern[] = [];
    for (const [key, data] of patternMap) {
      if (data.count >= this.config.minEpisodes) {
        const [providerId, action] = key.split(':');
        patterns.push({
          providerId,
          action,
          episodes: data.episodes,
          count: data.count,
          confidence: data.successRate,
          commonInputs: this.extractCommonInputs(data.episodes),
          commonOutputs: this.extractCommonOutputs(data.episodes)
        });
      }
    }

    return patterns.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Extract common inputs from episodes
   */
  private extractCommonInputs(episodes: EpisodicMemory[]): Record<string, unknown> {
    const common: Record<string, unknown> = {};
    
    if (episodes.length === 0) return common;

    // Find fields that are consistent across episodes
    const firstInput = episodes[0].input;
    
    for (const key in firstInput) {
      const values = episodes.map(e => e.input[key]);
      const isConsistent = values.every(v => JSON.stringify(v) === JSON.stringify(values[0]));
      
      if (isConsistent) {
        common[key] = values[0];
      }
    }

    return common;
  }

  /**
   * Extract common outputs from episodes
   */
  private extractCommonOutputs(episodes: EpisodicMemory[]): Record<string, unknown> {
    const common: Record<string, unknown> = {};
    
    if (episodes.length === 0) return common;

    const firstOutput = episodes[0].output;
    
    for (const key in firstOutput) {
      const values = episodes.map(e => e.output[key]);
      const isConsistent = values.every(v => JSON.stringify(v) === JSON.stringify(values[0]));
      
      if (isConsistent) {
        common[key] = values[0];
      }
    }

    return common;
  }

  /**
   * Create semantic memory from pattern
   */
  private async createSemanticMemory(pattern: Pattern): Promise<void> {
    const subject = `${pattern.providerId}_${pattern.action}`;
    const predicate = 'can_execute';
    const object = {
      successRate: pattern.confidence,
      sampleCount: pattern.count,
      commonInputs: pattern.commonInputs,
      commonOutputs: pattern.commonOutputs
    };

    await this.memoryEngine.assertFact({
      subject,
      predicate,
      object,
      confidence: pattern.confidence,
      source: 'memory_consolidation'
    });
  }
}

interface Pattern {
  providerId: string;
  action: string;
  episodes: EpisodicMemory[];
  count: number;
  confidence: number;
  commonInputs: Record<string, unknown>;
  commonOutputs: Record<string, unknown>;
}
```

---

This implementation guide provides exact, copy-pasteable algorithms for all core systems: ACU extraction, DCB deduplication, FSRS-6 scheduling, TTL sweep, database compaction, relevance decay, and memory consolidation. Each algorithm is designed to integrate seamlessly with the existing vivim-final architecture.
