// src/schema/node-data.ts
// Additional typed Node.data payloads adopted from vivim-app-og reference
// structs (AtomicChatUnit, Memory, Notebook, Note, Bookmark, Artifact).
// Each carries the OG field set so the universal Node layer is feature-parity
// with the proven reDB design.

import { z } from 'zod'

// ── Memory (mirrors OG Memory + FSRS-6 spaced repetition) ──────────────────

export type FsrsState = 'New' | 'Learning' | 'Review' | 'Relearning'

export interface MemoryData {
  content: string
  summary?: string
  memoryType: string
  category: string
  subcategory?: string
  tags: string[]
  importance: number
  relevance: number
  sourceConversationIds: string[]
  sourceMessageIds: string[]
  occurredAt?: number
  validFrom?: number
  validUntil?: number
  isPinned: boolean
  isArchived: boolean
  consolidationStatus: string
  accessCount: number
  // FSRS-6 fields (OG stability/difficulty/dueDate/fsrsState)
  stability: number
  difficulty: number
  dueDate: number
  lastReview?: number
  reviewCount: number
  fsrsState: FsrsState
}

export const MemoryDataSchema = z.object({
  content: z.string().min(1),
  summary: z.string().optional(),
  memoryType: z.string(),
  category: z.string(),
  subcategory: z.string().optional(),
  tags: z.array(z.string()).default([]),
  importance: z.number().min(0).max(1),
  relevance: z.number().min(0).max(1),
  sourceConversationIds: z.array(z.string()).default([]),
  sourceMessageIds: z.array(z.string()).default([]),
  occurredAt: z.number().optional(),
  validFrom: z.number().optional(),
  validUntil: z.number().optional(),
  isPinned: z.boolean().default(false),
  isArchived: z.boolean().default(false),
  consolidationStatus: z.string().default('unconsolidated'),
  accessCount: z.number().int().nonnegative().default(0),
  stability: z.number().nonnegative().default(1.0),
  difficulty: z.number().min(0).max(1).default(0.3),
  dueDate: z.number().default(() => Date.now()),
  lastReview: z.number().optional(),
  reviewCount: z.number().int().nonnegative().default(0),
  fsrsState: z.enum(['New', 'Learning', 'Review', 'Relearning']).default('New'),
})

// ── Atomic Chat Unit (mirrors OG AtomicChatUnit) ──────────────────────────

export interface AcuData {
  authorDid: string
  content: string
  contentHash?: string
  version: number
  language?: string
  acuType: string
  category: string
  origin: string
  conversationId?: string
  messageId?: string
  messageIndex?: number
  provider?: string
  model?: string
  sourceTimestamp?: number
  parentId?: string
  extractorVersion?: string
  parserVersion?: string
  state: string
  securityLevel: number
  isPersonal: boolean
  level: number
  contentType: string
  qualityOverall?: number
  contentRichness?: number
  structuralIntegrity?: number
  uniqueness?: number
  sharingPolicy: string
  sharingCircles: string[]
  canView: boolean
  canAnnotate: boolean
  canRemix: boolean
  canReshare: boolean
  expiresAt?: number
  tags: string[]
}

export const AcuDataSchema = z.object({
  authorDid: z.string(),
  content: z.string(),
  contentHash: z.string().optional(),
  version: z.number().int().positive(),
  language: z.string().optional(),
  acuType: z.string(),
  category: z.string(),
  origin: z.string(),
  conversationId: z.string().optional(),
  messageId: z.string().optional(),
  messageIndex: z.number().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  sourceTimestamp: z.number().optional(),
  parentId: z.string().optional(),
  extractorVersion: z.string().optional(),
  parserVersion: z.string().optional(),
  state: z.string(),
  securityLevel: z.number().int(),
  isPersonal: z.boolean(),
  level: z.number().int(),
  contentType: z.string(),
  qualityOverall: z.number().optional(),
  contentRichness: z.number().optional(),
  structuralIntegrity: z.number().optional(),
  uniqueness: z.number().optional(),
  sharingPolicy: z.string(),
  sharingCircles: z.array(z.string()),
  canView: z.boolean(),
  canAnnotate: z.boolean(),
  canRemix: z.boolean(),
  canReshare: z.boolean(),
  expiresAt: z.number().optional(),
  tags: z.array(z.string()),
})

// ── Notebook / Note (mirrors OG Notebook / Note) ──────────────────────────

export interface NotebookData {
  ownerId: string
  name: string
  description?: string
  icon?: string
  entryIds: string[]
  createdAt: number
  updatedAt: number
}

export const NotebookDataSchema = z.object({
  ownerId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  entryIds: z.array(z.string()).default([]),
  createdAt: z.number(),
  updatedAt: z.number(),
})

export interface NoteData {
  notebookId?: string
  title: string
  body: string
  attachments: string[]
  tags: string[]
  createdAt: number
  updatedAt: number
}

export const NoteDataSchema = z.object({
  notebookId: z.string().optional(),
  title: z.string(),
  body: z.string(),
  attachments: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  createdAt: z.number(),
  updatedAt: z.number(),
})

// ── Bookmark (mirrors OG Bookmark) ────────────────────────────────────────

export interface BookmarkData {
  url: string
  title: string
  description?: string
  tags: string[]
  favicon?: string
  createdAt: number
}

export const BookmarkDataSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  favicon: z.string().optional(),
  createdAt: z.number(),
})

// ── Artifact (mirrors OG ArtifactRecord) ──────────────────────────────────

export interface ArtifactData {
  artifactType: string
  title: string
  contentRef: string
  mimeType?: string
  sourceConversationId?: string
  sourceMessageId?: string
  extractedAt: number
}

export const ArtifactDataSchema = z.object({
  artifactType: z.string(),
  title: z.string(),
  contentRef: z.string(),
  mimeType: z.string().optional(),
  sourceConversationId: z.string().optional(),
  sourceMessageId: z.string().optional(),
  extractedAt: z.number(),
})

// ── Document / Email data shapes (re-declared here for parity imports) ─────
// These reuse the canonical schemas exported from their modules; we re-export
// lightweight data interfaces so node-data is the single import site.

export interface DocumentNodeData {
  title: string
  body: string
  mimeType: string
  sourceUrl?: string
  tags: string[]
}

export const DocumentNodeDataSchema = z.object({
  title: z.string(),
  body: z.string(),
  mimeType: z.string(),
  sourceUrl: z.string().optional(),
  tags: z.array(z.string()).default([]),
})

export interface EmailNodeData {
  from: string
  to: string[]
  subject: string
  body: string
  threadId?: string
  receivedAt: number
  labels: string[]
}

export const EmailNodeDataSchema = z.object({
  from: z.string(),
  to: z.array(z.string()),
  subject: z.string(),
  body: z.string(),
  threadId: z.string().optional(),
  receivedAt: z.number(),
  labels: z.array(z.string()).default([]),
})
