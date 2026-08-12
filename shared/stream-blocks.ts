// shared/stream-blocks.ts
// Shared stream block types for frontend rendering (PRD-C6).
//
// Canonical render-contract re-export. Frontend code should import
// ContentPart (and, only for legacy-row migration, migrateLegacyBlock)
// from here rather than reaching into @backend/schema/streaming directly —
// this file is the one place that boundary is declared.

export type { ContentBlock, ContentPart } from '@/schema/streaming.js'
export {
  migrateLegacyBlock,
  migrateLegacyParts,
  isLegacyBlock,
  extractText,
  blockKindOf,
  isStreaming,
} from '@/schema/streaming.js'
export type { LegacyBlock } from '@/schema/streaming.js'
