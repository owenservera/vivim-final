// src/engines/knowledge-envelope.ts
// Phase 0/4 — Canonical knowledge envelope with content hashing.
// Every incoming artifact (conversation, file, email, browser capture)
// is normalized into this envelope before indexing.

import { createHash } from 'node:crypto'
import { z } from 'zod'

export const KnowledgeEnvelopeSchema = z.object({
  sourceType: z.string().min(1),
  sourceId: z.string().min(1),
  sourceAccount: z.string().optional(),
  externalId: z.string().optional(),
  version: z.number().int().nonnegative().default(1),
  title: z.string().optional(),
  content: z.string(),
  contentType: z.string().default('text/plain'),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
  author: z.string().optional(),
  participants: z.array(z.string()).default([]),
  metadata: z.record(z.string(), z.unknown()).default({}),
})

export type KnowledgeEnvelope = z.infer<typeof KnowledgeEnvelopeSchema>

export interface VersionedKnowledgeEnvelope extends KnowledgeEnvelope {
  contentHash: string
}

/**
 * Normalize a knowledge envelope: trim content, compute content hash.
 * The hash is used for incremental indexing — unchanged content is never re-embedded.
 */
export function normalizeKnowledge(input: KnowledgeEnvelope): VersionedKnowledgeEnvelope {
  const parsed = KnowledgeEnvelopeSchema.parse(input)
  const normalized = parsed.content.replace(/\r\n/g, '\n').trim()
  const contentHash = createHash('sha256')
    .update(`${parsed.sourceType}\n${parsed.sourceId}\n${parsed.version}\n${normalized}`)
    .digest('hex')

  return { ...parsed, content: normalized, contentHash }
}
