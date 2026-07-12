// src/engines/knowledge-ingestion.ts
// KnowledgeIngestionEngine — import external conversation exports into local DB.

import { existsSync, readFileSync } from 'node:fs'
import { CapStoreError } from '../errors.js'
import { newId } from '../ids.js'
import type { ConversationStore } from '../storage/contracts/conversation-store.js'
import type { KnowledgeIngestionStore } from '../storage/contracts/knowledge-ingestion-store.js'
import type { StreamBlockStoreContract } from '../storage/contracts/stream-block-store.js'
import type { CapabilityEventBus } from './capability-event-bus.js'
import type { KnowledgeExtractor } from './knowledge-extractor.js'

export type ImportSource = 'chatgpt' | 'claude' | 'gemini' | 'deepseek' | 'generic' | 'manual'

export interface ImportConfig {
  source: ImportSource
  filePath: string
  providerId?: string
  deduplicate: boolean
  extractEntities: boolean
  extractDecisions: boolean
  generateEmbeddings: boolean
}

export interface ImportResult {
  jobId: string
  source: ImportSource
  conversationsImported: number
  messagesImported: number
  entitiesExtracted: number
  decisionsExtracted: number
  duplicatesSkipped: number
  errors: Array<{ conversationId: string; error: string }>
  durationMs: number
}

export class KnowledgeIngestionEngine {
  constructor(
    private store: KnowledgeIngestionStore,
    private conversationStore: ConversationStore,
    private blockStore: StreamBlockStoreContract,
    private extractor: KnowledgeExtractor,
    private eventBus: CapabilityEventBus,
  ) {}

  async ingest(config: ImportConfig): Promise<ImportResult> {
    const start = Date.now()
    const jobId = newId()

    await this.store.createImportJob({
      id: jobId,
      source: config.source,
      filePath: config.filePath,
      status: 'pending',
      configJson: JSON.stringify(config),
      startedAt: start,
    })

    let conversationsImported = 0
    let messagesImported = 0
    let duplicatesSkipped = 0
    const errors: Array<{ conversationId: string; error: string }> = []

    let parsed: Array<{
      externalId: string
      title?: string
      messages: Array<{ role: string; content: string; index: number }>
    }>
    try {
      parsed = this.parseFile(config.filePath, config.source)
    } catch (err) {
      await this.store.updateImportJob(jobId, {
        status: 'failed',
        error: String(err),
        completedAt: Date.now(),
      })
      throw err
    }

    await this.store.updateImportJob(jobId, { status: 'importing' })

    let entitiesExtracted = 0
    let decisionsExtracted = 0

    // Track imported conversation IDs for extraction.
    const importedConversationIds: Array<{
      externalId: string
      conversationId: string
    }> = []

    for (const conv of parsed) {
      try {
        const existingId = await this.store.findExistingConversation(config.source, conv.externalId)
        let conversationId: string

        if (existingId && config.deduplicate) {
          duplicatesSkipped++
          continue
        }

        if (existingId) {
          conversationId = existingId
        } else {
          const created = await this.conversationStore.createConversation({
            providerSessionId: conv.externalId,
            providerId: config.providerId ?? config.source,
            title: conv.title ?? null,
            state: 'imported',
          })
          conversationId = created.id
        }

        for (const msg of conv.messages) {
          await this.conversationStore.createMessage({
            conversationId,
            role: msg.role,
            content: msg.content,
            blocksJson: JSON.stringify([]),
            blockCount: 0,
            sequenceIndex: msg.index,
          })
          messagesImported++
        }

        conversationsImported++
        importedConversationIds.push({ externalId: conv.externalId, conversationId })
      } catch (err) {
        errors.push({ conversationId: conv.externalId, error: String(err) })
      }
    }

    if (config.extractEntities || config.extractDecisions) {
      // Collect the messages we just imported, grouped by conversation.
      const conversationMessages: Array<{
        id: string
        messages: Array<{ id: string; role: string; content: string }>
      }> = []

      for (const { conversationId } of importedConversationIds) {
        try {
          const msgs = await this.conversationStore.getMessages(conversationId, { limit: 1000 })
          conversationMessages.push({
            id: conversationId,
            messages: msgs.map((m) => ({ id: m.id, role: m.role, content: m.content ?? '' })),
          })
        } catch (err) {
          errors.push({ conversationId, error: `extract-prep: ${String(err)}` })
        }
      }

      try {
        const extractResult = await this.extractor.batchExtract(conversationMessages)
        entitiesExtracted = extractResult.totalExtracted
        decisionsExtracted = (extractResult.byType as Record<string, number>)?.decision ?? 0
      } catch (err) {
        errors.push({ conversationId: '(extraction)', error: String(err) })
      }
    }

    const end = Date.now()

    await this.store.updateImportJob(jobId, {
      status: 'complete',
      resultJson: JSON.stringify({
        conversationsImported,
        messagesImported,
        entitiesExtracted,
        decisionsExtracted,
        duplicatesSkipped,
        errors,
      }),
      completedAt: end,
    })

    this.eventBus.emit({
      type: 'knowledge:imported',
      jobId,
      source: config.source,
      conversationsImported,
      messagesImported,
      durationMs: end - start,
    })

    return {
      jobId,
      source: config.source,
      conversationsImported,
      messagesImported,
      entitiesExtracted,
      decisionsExtracted,
      duplicatesSkipped,
      errors,
      durationMs: end - start,
    }
  }

  async ingestFile(filePath: string, source: ImportSource): Promise<ImportResult> {
    return this.ingest({
      source,
      filePath,
      deduplicate: true,
      extractEntities: false,
      extractDecisions: false,
      generateEmbeddings: false,
    })
  }

  async getJobStatus(
    jobId: string,
  ): Promise<{ jobId: string; phase: string; current: number; total: number } | null> {
    const job = await this.store.getImportJob(jobId)
    if (!job) return null
    return { jobId: job.id, phase: job.status, current: 0, total: 0 }
  }

  async listJobs(opts?: { limit?: number }): Promise<
    Array<{ id: string; source: string; status: string; startedAt: number }>
  > {
    const jobs = await this.store.listImportJobs(opts)
    return jobs.map((j) => ({
      id: j.id,
      source: j.source,
      status: j.status,
      startedAt: j.startedAt,
    }))
  }

  async cancelJob(jobId: string): Promise<void> {
    await this.store.updateImportJob(jobId, { status: 'cancelled' })
  }

  private parseFile(
    filePath: string,
    source: ImportSource,
  ): Array<{
    externalId: string
    title?: string
    messages: Array<{ role: string; content: string; index: number }>
  }> {
    if (!existsSync(filePath)) {
      throw new CapStoreError('FileNotFoundError', `File not found: ${filePath}`)
    }

    const raw = readFileSync(filePath, 'utf-8')
    let json: unknown
    try {
      json = JSON.parse(raw)
    } catch {
      throw new CapStoreError('ParseError', `Invalid JSON in ${filePath}`)
    }

    return this.normalizeParsed(source, json)
  }

  private normalizeParsed(
    source: ImportSource,
    data: unknown,
  ): Array<{
    externalId: string
    title?: string
    messages: Array<{ role: string; content: string; index: number }>
  }> {
    if (source === 'chatgpt') {
      const arr = data as Array<Record<string, unknown>>
      return arr.map((conv: Record<string, unknown>) => ({
        externalId: String(conv.id ?? conv.conversation_id ?? ''),
        title: conv.title as string | undefined,
        messages: (
          (conv.messages ?? conv.message_list ?? []) as Array<Record<string, unknown>>
        ).map((m: Record<string, unknown>, i: number) => ({
          role: String(m.role ?? m.author ?? 'user'),
          content: String(m.content ?? m.text ?? ''),
          index: i,
        })),
      }))
    }

    if (source === 'claude') {
      const root = data as Record<string, unknown>
      const conversations = (root.conversations ?? root.accounts ?? []) as Array<
        Record<string, unknown>
      >
      return conversations.map((conv: Record<string, unknown>) => ({
        externalId: String(conv.uuid ?? conv.id ?? ''),
        title: (conv.name ?? conv.title) as string | undefined,
        messages: (
          (conv.chat_messages ?? conv.messages ?? []) as Array<Record<string, unknown>>
        ).map((m: Record<string, unknown>, i: number) => ({
          role: String(m.sender ?? m.role ?? 'user'),
          content: String(m.text ?? m.content ?? m.message ?? ''),
          index: i,
        })),
      }))
    }

    if (source === 'gemini') {
      const arr = Array.isArray(data) ? data : []
      return arr.map((conv: Record<string, unknown>) => ({
        externalId: String(conv.conversationId ?? conv.id ?? ''),
        title: conv.title as string | undefined,
        messages: ((conv.messages ?? []) as Array<Record<string, unknown>>).map(
          (m: Record<string, unknown>, i: number) => ({
            role: String(m.author ?? m.role ?? 'user'),
            content: String(m.content ?? m.text ?? ''),
            index: i,
          }),
        ),
      }))
    }

    if (source === 'generic' || source === 'manual') {
      const arr = Array.isArray(data) ? data : [data]
      return arr.map((conv: Record<string, unknown>) => ({
        externalId: String(conv.id ?? conv.externalId ?? ''),
        title: conv.title as string | undefined,
        messages: ((conv.messages ?? []) as Array<Record<string, unknown>>).map(
          (m: Record<string, unknown>, i: number) => ({
            role: String(m.role ?? 'user'),
            content: String(m.content ?? ''),
            index: i,
          }),
        ),
      }))
    }

    throw new CapStoreError('ParseError', `Unsupported import source: ${source}`)
  }
}
