// src/engines/export.ts
// ExportEngine — JSON/CSV export of all VIVIM data for portability.
// Supports encrypted export, import from JSON, and selective scope filtering.
// Depends on EncryptionEngine for encrypted export.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { EngineError } from '../errors.js'
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

export class ExportEngine {
  constructor(
    private store: ExportStore,
    private encryption?: EncryptionEngine,
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
