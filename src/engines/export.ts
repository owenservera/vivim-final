// src/engines/export.ts
// ExportEngine — JSON/CSV export of all VIVIM data for portability.
// Supports encrypted export, import from JSON, and selective scope filtering.
// Depends on EncryptionEngine for encrypted export.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { EngineError } from '../errors.js'
import { newId } from '../ids.js'
import { catchDebug } from '../lib/catch-logger.js'
import type { CapStoreDb } from '../storage/db.js'
import type { EncryptionEngine } from './encryption.js'

// ── Types ───────────────────────────────────────────────────────────────

export type ExportFormat = 'json' | 'csv'
export type ExportScope = 'full' | 'conversations' | 'memory' | 'providers' | 'config'

export interface ExportOptions {
  format: ExportFormat
  scope: ExportScope
  outputPath: string
  includeEmbeddings: boolean
  encryptWithPassphrase?: string
  dateFrom?: number
  dateTo?: number
}

export interface ExportManifest {
  version: string
  exportedAt: number
  scope: ExportScope
  format: ExportFormat
  encrypted: boolean
  recordCounts: Record<string, number>
}

export interface ExportStore {
  listConversations(opts?: { dateFrom?: number; dateTo?: number }): Promise<
    Array<{ id: string; state: string; title?: string | null }>
  >
  listMessages(
    conversationId: string,
  ): Promise<Array<{ id: string; role: string; content: string; ts: number }>>
  listMemory(): Promise<Array<{ id: string; key: string; value: string; namespace: string }>>
  listProviders(): Promise<Array<{ id: string; slug: string; displayName: string }>>
  listConfig(): Promise<Array<{ id: string; engineId: string; configJson: string }>>
}

// ── Engine ──────────────────────────────────────────────────────────────

// ── Import Data Types ────────────────────────────────────────────────────

interface ImportData {
  conversations?: Array<Record<string, unknown>>
  messages?: Record<string, Array<Record<string, unknown>>>
  memory?: Array<Record<string, unknown>>
  providers?: Array<Record<string, unknown>>
  config?: Array<Record<string, unknown>>
  entities?: Array<Record<string, unknown>>
  decisions?: Array<Record<string, unknown>>
  patterns?: Array<Record<string, unknown>>
  topics?: Array<Record<string, unknown>>
  projects?: Array<Record<string, unknown>>
  preferences?: Array<Record<string, unknown>>
  embeddings?: Array<Record<string, unknown>>
}

// ── Table import order (respecting foreign key constraints) ───────────────

const IMPORT_ORDER: Array<keyof ImportData> = [
  'providers',
  'config',
  'topics',
  'projects',
  'entities',
  'conversations',
  'messages',
  'decisions',
  'patterns',
  'preferences',
  'embeddings',
  'memory',
]

const BATCH_SIZE = 100

// ── Engine ──────────────────────────────────────────────────────────────

export class ExportEngine {
  constructor(
    private store: ExportStore,
    private encryption?: EncryptionEngine,
    private db?: CapStoreDb,
  ) {}

  async export(opts: ExportOptions): Promise<ExportManifest> {
    const manifest: ExportManifest = {
      version: '1.0',
      exportedAt: Date.now(),
      scope: opts.scope,
      format: opts.format,
      encrypted: Boolean(opts.encryptWithPassphrase),
      recordCounts: {},
    }

    const data: Record<string, unknown> = {}

    if (opts.scope === 'full' || opts.scope === 'conversations') {
      const convos = await this.store.listConversations({
        dateFrom: opts.dateFrom,
        dateTo: opts.dateTo,
      })
      const allMessages: Record<string, unknown[]> = {}
      for (const c of convos) {
        allMessages[c.id] = await this.store.listMessages(c.id)
      }
      data.conversations = convos
      data.messages = allMessages
      manifest.recordCounts.conversations = convos.length
    }

    if (opts.scope === 'full' || opts.scope === 'memory') {
      const memory = await this.store.listMemory()
      data.memory = memory
      manifest.recordCounts.memory = memory.length
    }

    if (opts.scope === 'full' || opts.scope === 'providers') {
      const providers = await this.store.listProviders()
      data.providers = providers
      manifest.recordCounts.providers = providers.length
    }

    if (opts.scope === 'full' || opts.scope === 'config') {
      const config = await this.store.listConfig()
      data.config = config
      manifest.recordCounts.config = config.length
    }

    let output = opts.format === 'json' ? this.toJson(data, manifest) : this.toCsv(data, manifest)

    if (opts.encryptWithPassphrase) {
      if (!this.encryption) throw new EngineError('EncryptionEngine required for encrypted export')
      this.encryption.lock()
      await this.encryption.unlock(opts.encryptWithPassphrase)
      const encrypted = this.encryption.encrypt(output)
      output = JSON.stringify({ manifest, encrypted })
      this.encryption.lock()
    }

    mkdirSync(dirname(opts.outputPath), { recursive: true })
    writeFileSync(opts.outputPath, output, 'utf8')

    return manifest
  }

  async importJson(jsonPath: string): Promise<{ imported: Record<string, number> }> {
    const raw = readFileSync(jsonPath, 'utf8')
    let data: Record<string, unknown>

    try {
      const parsed = JSON.parse(raw)
      if (parsed.encrypted && this.encryption) {
        this.encryption.lock()
        // For import, we don't know the passphrase — caller must unlock first
        const decrypted = this.encryption.decrypt(parsed.encrypted)
        data = JSON.parse(decrypted)
      } else {
        data = parsed
      }
    } catch {
      throw new EngineError(`Failed to parse import file: ${jsonPath}`)
    }

    if (this.db) {
      return importDataToDb(this.db, data as ImportData)
    }

    // Fallback: count-only import (no DB writes)
    const imported: Record<string, number> = {}
    if (data.conversations && Array.isArray(data.conversations)) {
      imported.conversations = data.conversations.length
    }
    if (data.messages && typeof data.messages === 'object') {
      const msgs = data.messages as Record<string, unknown[]>
      imported.messages = Object.values(msgs).reduce((sum, arr) => sum + arr.length, 0)
    }
    if (data.memory && Array.isArray(data.memory)) {
      imported.memory = data.memory.length
    }
    if (data.providers && Array.isArray(data.providers)) {
      imported.providers = data.providers.length
    }
    if (data.config && Array.isArray(data.config)) {
      imported.config = data.config.length
    }
    return { imported }
  }

  private toJson(data: Record<string, unknown>, manifest: ExportManifest): string {
    return JSON.stringify({ manifest, ...data }, null, 2)
  }

  private toCsv(data: Record<string, unknown>, _manifest: ExportManifest): string {
    const rows: string[] = []

    // Conversations
    if (data.conversations && Array.isArray(data.conversations)) {
      rows.push('type,id,state,title')
      for (const c of data.conversations) {
        const rec = c as Record<string, unknown>
        rows.push(`conversation,${rec.id},${rec.state},${String(rec.title ?? '')}`)
      }
    }

    // Memory
    if (data.memory && Array.isArray(data.memory)) {
      rows.push('type,id,key,value,namespace')
      for (const m of data.memory) {
        const rec = m as Record<string, unknown>
        rows.push(`memory,${rec.id},${rec.key},${rec.value},${rec.namespace}`)
      }
    }

    // Providers
    if (data.providers && Array.isArray(data.providers)) {
      rows.push('type,id,slug,displayName')
      for (const p of data.providers) {
        const rec = p as Record<string, unknown>
        rows.push(`provider,${rec.id},${rec.slug},${rec.displayName}`)
      }
    }

    return rows.join('\n')
  }
}

// ── DB Import Implementation ──────────────────────────────────────────────

/**
 * Imports parsed JSON data into the database using Prisma batch inserts.
 * Respects foreign key constraints via ordered table processing.
 */
export async function importDataToDb(
  db: CapStoreDb,
  data: ImportData,
): Promise<{ imported: Record<string, number> }> {
  const imported: Record<string, number> = {}

  try {
    await db.prisma.$transaction(async (tx) => {
      for (const tableName of IMPORT_ORDER) {
        const tableData = data[tableName]
        if (!tableData) continue

        if (tableName === 'messages') {
          const msgMap = data.messages as Record<string, Array<Record<string, unknown>>>
          let totalMsgs = 0
          for (const messages of Object.values(msgMap)) {
            for (let i = 0; i < messages.length; i += BATCH_SIZE) {
              const batch = messages.slice(i, i + BATCH_SIZE)
              for (const msg of batch) {
                try {
                  await tx.conversationMessage.create({
                    data: normalizeMessageRow(msg) as never,
                  })
                  totalMsgs++
                } catch {
                  catchDebug(_err, 'engines:export:268')
                  // Skip invalid messages
                }
              }
            }
          }
          imported.messages = totalMsgs
        } else if (Array.isArray(tableData)) {
          let count = 0
          for (let i = 0; i < tableData.length; i += BATCH_SIZE) {
            const batch = tableData.slice(i, i + BATCH_SIZE)
            for (const row of batch) {
              try {
                await importRow(tx, tableName, row)
                count++
              } catch {
                catchDebug(_err, 'engines:export:283')
                // Skip duplicate or invalid rows
              }
            }
          }
          imported[tableName] = count
        }
      }
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    imported._error = msg as unknown as number
  }

  return { imported }
}

// ── Row importers per table ───────────────────────────────────────────────

async function importRow(
  tx: Record<string, unknown>,
  tableName: string,
  row: Record<string, unknown>,
): Promise<void> {
  const prisma = tx as {
    providerDefinition: { create: (args: { data: Record<string, unknown> }) => Promise<unknown> }
    configEntry: { create: (args: { data: Record<string, unknown> }) => Promise<unknown> }
    topic: { create: (args: { data: Record<string, unknown> }) => Promise<unknown> }
    project: { create: (args: { data: Record<string, unknown> }) => Promise<unknown> }
    entity: { create: (args: { data: Record<string, unknown> }) => Promise<unknown> }
    conversation: { create: (args: { data: Record<string, unknown> }) => Promise<unknown> }
    decisionRecord: { create: (args: { data: Record<string, unknown> }) => Promise<unknown> }
    patternExtract: { create: (args: { data: Record<string, unknown> }) => Promise<unknown> }
    userPreference: { create: (args: { data: Record<string, unknown> }) => Promise<unknown> }
    memoryEmbedding: { create: (args: { data: Record<string, unknown> }) => Promise<unknown> }
  }

  const now = Date.now()

  switch (tableName) {
    case 'providers': {
      await prisma.providerDefinition.create({
        data: {
          id: (row.id as string) ?? newId(),
          slug: (row.slug as string) ?? `imported_${now}`,
          displayName: (row.displayName as string) ?? 'Imported Provider',
          description: (row.description as string) ?? null,
          category: (row.category as string) ?? 'ai',
          providerType: (row.providerType as string) ?? 'llm',
          isActive: (row.isActive as number) ?? 1,
          websiteUrl: (row.websiteUrl as string) ?? null,
          documentationUrl: (row.documentationUrl as string) ?? null,
          authType: (row.authType as string) ?? 'browser',
          hasMultiAccount: (row.hasMultiAccount as number) ?? 0,
          profileStrategy: (row.profileStrategy as string) ?? 'per_account',
          fleetConfigJson: (row.fleetConfigJson as string) ?? '{}',
          capabilitiesJson: (row.capabilitiesJson as string) ?? '{}',
          modelsJson: (row.modelsJson as string) ?? '[]',
          createdAt: Number(row.createdAt ?? now),
          updatedAt: now,
        },
      })
      break
    }

    case 'config': {
      await prisma.configEntry.create({
        data: {
          id: (row.id as string) ?? `cfg_import_${newId()}`,
          engineId: (row.engineId as string) ?? 'imported',
          configJson: (row.configJson as string) ?? '{}',
          scopeType: (row.scopeType as string) ?? 'global',
          scopeId: (row.scopeId as string) ?? undefined,
          createdAt: BigInt(Number(row.createdAt ?? now)),
          updatedAt: BigInt(Number(row.updatedAt ?? now)),
        },
      })
      break
    }

    case 'topics': {
      await prisma.topic.create({
        data: {
          id: (row.id as string) ?? newId(),
          name: (row.name as string) ?? 'Imported Topic',
          description: (row.description as string) ?? null,
          color: (row.color as string) ?? null,
          conversationCount: (row.conversationCount as number) ?? 0,
          createdAt: Number(row.createdAt ?? now),
          updatedAt: Number(row.updatedAt ?? now),
        },
      })
      break
    }

    case 'projects': {
      await prisma.project.create({
        data: {
          id: (row.id as string) ?? newId(),
          name: (row.name as string) ?? 'Imported Project',
          description: (row.description as string) ?? null,
          status: (row.status as string) ?? 'active',
          conversationCount: (row.conversationCount as number) ?? 0,
          createdAt: Number(row.createdAt ?? now),
          updatedAt: Number(row.updatedAt ?? now),
        },
      })
      break
    }

    case 'entities': {
      await prisma.entity.create({
        data: {
          id: (row.id as string) ?? newId(),
          name: (row.name as string) ?? 'Imported Entity',
          type: (row.type as string) ?? 'unknown',
          description: (row.description as string) ?? null,
          confidence: (row.confidence as number) ?? 0.5,
          mentionCount: (row.mentionCount as number) ?? 0,
          firstSeenAt: Number(row.firstSeenAt ?? now),
          lastSeenAt: Number(row.lastSeenAt ?? now),
          createdAt: Number(row.createdAt ?? now),
          updatedAt: Number(row.updatedAt ?? now),
        },
      })
      break
    }

    case 'conversations': {
      await prisma.conversation.create({
        data: {
          id: (row.id as string) ?? newId(),
          providerSessionId: (row.providerSessionId as string) ?? `imported_${now}`,
          providerId: (row.providerId as string) ?? 'imported',
          title: (row.title as string) ?? null,
          state: (row.state as string) ?? 'active',
          contextJson: (row.contextJson as string) ?? '{}',
          createdAt: Number(row.createdAt ?? now),
          updatedAt: Number(row.updatedAt ?? now),
        },
      })
      break
    }

    case 'decisions': {
      await prisma.decisionRecord.create({
        data: {
          id: (row.id as string) ?? newId(),
          conversationId: (row.conversationId as string) ?? 'imported',
          messageId: (row.messageId as string) ?? 'imported',
          decisionText: (row.decisionText as string) ?? '',
          rationale: (row.rationale as string) ?? null,
          alternativesJson: (row.alternativesJson as string) ?? '[]',
          confidence: (row.confidence as number) ?? 0.5,
          ts: Number(row.ts ?? now),
        },
      })
      break
    }

    case 'patterns': {
      await prisma.patternExtract.create({
        data: {
          id: (row.id as string) ?? newId(),
          name: (row.name as string) ?? 'Imported Pattern',
          description: (row.description as string) ?? '',
          patternType: (row.patternType as string) ?? 'unknown',
          occurrences: (row.occurrences as number) ?? 1,
          confidence: (row.confidence as number) ?? 0.5,
          firstSeenAt: Number(row.firstSeenAt ?? now),
          lastSeenAt: Number(row.lastSeenAt ?? now),
          createdAt: Number(row.createdAt ?? now),
          updatedAt: Number(row.updatedAt ?? now),
        },
      })
      break
    }

    case 'preferences': {
      await prisma.userPreference.create({
        data: {
          id: (row.id as string) ?? newId(),
          userId: (row.userId as string) ?? 'default',
          key: (row.key as string) ?? 'imported',
          value: (row.value as string) ?? '',
          learnedAt: Number(row.learnedAt ?? now),
          confidence: (row.confidence as number) ?? 0.5,
        },
      })
      break
    }

    case 'embeddings': {
      await prisma.memoryEmbedding.create({
        data: {
          id: (row.id as string) ?? newId(),
          entityType: (row.entityType as string) ?? 'unknown',
          entityId: (row.entityId as string) ?? newId(),
          embedding: (row.embedding as string) ?? '[]',
          model: (row.model as string) ?? 'imported',
          dimensions: (row.dimensions as number) ?? 0,
          contentHash: (row.contentHash as string) ?? '',
          createdAt: Number(row.createdAt ?? now),
        },
      })
      break
    }

    case 'memory': {
      const namespace = (row.namespace as string) ?? 'general'
      if (namespace === 'preference' || namespace === 'user') {
        await prisma.userPreference.create({
          data: {
            id: (row.id as string) ?? newId(),
            userId: 'default',
            key: (row.key as string) ?? 'imported',
            value: (row.value as string) ?? '',
            learnedAt: now,
            confidence: 0.5,
          },
        })
      }
      break
    }

    default:
      break
  }
}

// ── Message row normalizer ─────────────────────────────────────────────────

function normalizeMessageRow(msg: Record<string, unknown>): Record<string, unknown> {
  const now = Date.now()
  return {
    id: (msg.id as string) ?? newId(),
    conversationId: (msg.conversationId as string) ?? 'imported',
    role: (msg.role as string) ?? 'user',
    content: (msg.content as string) ?? '',
    blocksJson: (msg.blocksJson as string) ?? '[]',
    blockCount: (msg.blockCount as number) ?? 0,
    sequenceIndex: (msg.sequenceIndex as number) ?? 0,
    parentMessageId: (msg.parentMessageId as string) ?? null,
    latencyMs: (msg.latencyMs as number) ?? null,
    tokenCount: (msg.tokenCount as number) ?? null,
    model: (msg.model as string) ?? null,
    metadataJson: (msg.metadataJson as string) ?? '{}',
    createdAt: Number(msg.createdAt ?? now),
  }
}
