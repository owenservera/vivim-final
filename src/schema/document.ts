// src/schema/document.ts
// Document, code, knowledge, and webpage node types.

import { z } from 'zod'

// ── DocumentNode (cap-store.document) ──────────────────────────────────────
// Rich text documents: imported PDFs, Word, Google Docs, markdown files.

export interface DocumentData {
  title: string
  body: string
  bodyType: 'markdown' | 'html' | 'plain'
  sourceUrl?: string
  sourceFormat?: string
  pageCount?: number
  author?: string
  language?: string
  tags?: string[]
  toc?: Array<{ level: number; title: string; anchor?: string }>
}

export const DocumentDataSchema = z.object({
  title: z.string(),
  body: z.string(),
  bodyType: z.enum(['markdown', 'html', 'plain']),
  sourceUrl: z.string().optional(),
  sourceFormat: z.string().optional(),
  pageCount: z.number().int().positive().optional(),
  author: z.string().optional(),
  language: z.string().optional(),
  tags: z.array(z.string()).optional(),
  toc: z
    .array(
      z.object({
        level: z.number().int().min(1).max(6),
        title: z.string(),
        anchor: z.string().optional(),
      }),
    )
    .optional(),
})

// ── CodeNode (cap-store.code) ─────────────────────────────────────────────
// Code snippets, files, repos.

export interface CodeData {
  filename?: string
  language?: string
  code: string
  repoUrl?: string
  filePath?: string
  commitSha?: string
  diff?: string
  license?: string
  dependencies?: string[]
}

export const CodeDataSchema = z.object({
  filename: z.string().optional(),
  language: z.string().optional(),
  code: z.string(),
  repoUrl: z.string().optional(),
  filePath: z.string().optional(),
  commitSha: z.string().optional(),
  diff: z.string().optional(),
  license: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
})

// ── KnowledgeNode (cap-store.knowledge) ───────────────────────────────────
// Notes, concepts, flashcards, wiki entries.

export interface KnowledgeData {
  title: string
  body: string
  bodyType: 'markdown' | 'plain'
  summary?: string
  tags?: string[]
  references?: Array<{ title: string; url?: string; nodeId?: string }>
  flashcards?: Array<{ front: string; back: string }>
  confidence?: number
}

export const KnowledgeDataSchema = z.object({
  title: z.string(),
  body: z.string(),
  bodyType: z.enum(['markdown', 'plain']),
  summary: z.string().optional(),
  tags: z.array(z.string()).optional(),
  references: z
    .array(
      z.object({
        title: z.string(),
        url: z.string().optional(),
        nodeId: z.string().optional(),
      }),
    )
    .optional(),
  flashcards: z
    .array(
      z.object({
        front: z.string(),
        back: z.string(),
      }),
    )
    .optional(),
  confidence: z.number().min(0).max(1).optional(),
})

// ── WebpageNode (cap-store.webpage) ────────────────────────────────────────
// Captured/imported web pages (bookmarks, clippings, full-page archives).

export interface WebpageData {
  url: string
  title: string
  content: string
  contentFormat: 'markdown' | 'html'
  description?: string
  author?: string
  publishedAt?: number
  siteName?: string
  favicon?: string
  screenshotUrl?: string
  archivedAt: number
  tags?: string[]
}

export const WebpageDataSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  content: z.string(),
  contentFormat: z.enum(['markdown', 'html']),
  description: z.string().optional(),
  author: z.string().optional(),
  publishedAt: z.number().optional(),
  siteName: z.string().optional(),
  favicon: z.string().optional(),
  screenshotUrl: z.string().optional(),
  archivedAt: z.number(),
  tags: z.array(z.string()).optional(),
})

// ── Node schemas for registration ─────────────────────────────────────────

export const documentNodeSchema = {
  type: 'cap-store.document' as const,
  version: 1,
  schema: DocumentDataSchema,
  indexContent: (data: DocumentData) => `${data.title}\n${data.body}`,
  embeddingText: (data: DocumentData) => `${data.title}\n${data.body}`,
}

export const codeNodeSchema = {
  type: 'cap-store.code' as const,
  version: 1,
  schema: CodeDataSchema,
  indexContent: (data: CodeData) => data.code,
  embeddingText: (data: CodeData) => data.code,
}

export const knowledgeNodeSchema = {
  type: 'cap-store.knowledge' as const,
  version: 1,
  schema: KnowledgeDataSchema,
  indexContent: (data: KnowledgeData) =>
    `${data.title}\n${data.body}\n${data.tags?.join(' ') ?? ''}`,
  embeddingText: (data: KnowledgeData) => `${data.title}\n${data.summary ?? data.body}`,
}

export const webpageNodeSchema = {
  type: 'cap-store.webpage' as const,
  version: 1,
  schema: WebpageDataSchema,
  indexContent: (data: WebpageData) => `${data.title}\n${data.content}`,
  embeddingText: (data: WebpageData) =>
    `${data.title}\n${data.description ?? data.content.slice(0, 1000)}`,
}
