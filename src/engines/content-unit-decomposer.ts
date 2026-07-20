// src/engines/content-unit-decomposer.ts
// Decomposes ContentBlock[] into ContentUnit rows for fine-grained storage.
// Each block type maps to a unitType + content + mimeType.
// Enables: per-block queries, quality scoring, content unit retrieval.

import type { ContentBlock } from '../schema/streaming.js'

export interface ContentUnitRow {
  id: string
  messageId: string
  conversationId: string
  unitType: string
  content: string
  mimeType: string | null
  metadataJson: string
  sequenceIndex: number
  qualityScore: number | null
  createdAt: number
}

/** Map ContentPart.type → ContentUnit.unitType + mimeType. */
function blockToUnit(
  block: ContentBlock,
  index: number,
  conversationId: string,
  messageId: string,
  idGenerator: () => string,
): ContentUnitRow {
  const now = Date.now()
  const base = {
    id: idGenerator(),
    messageId,
    conversationId,
    sequenceIndex: index,
    metadataJson: '{}',
    qualityScore: null,
    createdAt: now,
  }

  switch (block.type) {
    case 'text':
      return {
        ...base,
        unitType: 'text',
        content: typeof block.text === 'string' ? block.text : JSON.stringify(block.text),
        mimeType: 'text/plain',
      }
    case 'reasoning':
      return {
        ...base,
        unitType: 'reasoning',
        content: typeof block.text === 'string' ? block.text : JSON.stringify(block.text),
        mimeType: 'text/plain',
        metadataJson: JSON.stringify({ signature: block.signature, state: block.state }),
      }
    case 'code':
      return {
        ...base,
        unitType: 'code',
        content: block.text,
        mimeType: block.language ? `text/x-${block.language}` : 'text/plain',
        metadataJson: JSON.stringify({ language: block.language }),
      }
    case 'file':
      return {
        ...base,
        unitType: 'file',
        content: block.url,
        mimeType: block.mediaType,
        metadataJson: JSON.stringify({ filename: block.filename, hasData: !!block.data }),
      }
    case 'tool-call':
      return {
        ...base,
        unitType: 'tool-call',
        content: JSON.stringify({ toolName: block.toolName, input: block.input }),
        mimeType: 'application/json',
        metadataJson: JSON.stringify({
          toolCallId: block.toolCallId,
          state: block.state,
          approvalId: block.approvalId,
        }),
      }
    case 'tool-result':
      return {
        ...base,
        unitType: 'tool-result',
        content: JSON.stringify(block.output ?? ''),
        mimeType: 'application/json',
        metadataJson: JSON.stringify({
          toolCallId: block.toolCallId,
          isError: block.isError,
        }),
      }
    case 'source':
      return {
        ...base,
        unitType: 'source',
        content: block.title ?? block.url ?? '',
        mimeType: block.mediaType ?? 'text/html',
        metadataJson: JSON.stringify({ sourceId: block.sourceId, url: block.url }),
      }
    case 'error':
      return {
        ...base,
        unitType: 'error',
        content: block.message,
        mimeType: 'text/plain',
        metadataJson: JSON.stringify({ code: block.code }),
      }
    case 'meta':
      return {
        ...base,
        unitType: 'meta',
        content: JSON.stringify({ key: block.key, value: block.value }),
        mimeType: 'application/json',
      }
    case 'custom':
      return {
        ...base,
        unitType: `custom:${block.kind}`,
        content: JSON.stringify(block.data),
        mimeType: 'application/json',
        metadataJson: JSON.stringify({ kind: block.kind, state: block.state }),
      }
    case 'step-start':
      return {
        ...base,
        unitType: 'step-start',
        content: '',
        mimeType: null,
      }
    default:
      return {
        ...base,
        unitType: 'unknown',
        content: JSON.stringify(block),
        mimeType: 'application/json',
      }
  }
}

/**
 * Decompose ContentBlock[] into ContentUnitRow[] for per-block storage.
 * Each block becomes a separate row with typed content and metadata.
 */
export function decomposeToContentUnits(
  blocks: ContentBlock[],
  conversationId: string,
  messageId: string,
  idGenerator: () => string = () => `cu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
): ContentUnitRow[] {
  return blocks.map((block, i) => blockToUnit(block, i, conversationId, messageId, idGenerator))
}
