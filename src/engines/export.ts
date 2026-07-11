// src/engines/export.ts
// ExportEngine — JSON/CSV export of all VIVIM data for portability.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { CapStoreDb } from '../storage/db.js'

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

export interface ExportResult {
  filePath: string
  format: ExportFormat
  scope: ExportScope
  tablesExported: string[]
  totalRows: number
  fileSizeBytes: number
  durationMs: number
  encrypted: boolean
}

const SCOPE_TABLES: Record<ExportScope, string[]> = {
  full: [
    'conversation',
    'message',
    'entity',
    'entityMention',
    'decisionRecord',
    'patternExtract',
    'topic',
    'project',
    'conversationTopic',
    'importJob',
    'memoryEmbedding',
    'provider',
    'config',
    'streamBlock',
  ],
  conversations: ['conversation', 'message'],
  memory: [
    'entity',
    'entityMention',
    'decisionRecord',
    'patternExtract',
    'topic',
    'project',
    'conversationTopic',
    'memoryEmbedding',
  ],
  providers: ['provider'],
  config: ['config'],
}

function toCsvRows(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const firstRow = rows[0]
  const headers = firstRow ? Object.keys(firstRow) : []
  const lines = [headers.join(',')]
  for (const row of rows) {
    const values = headers.map((h) => {
      const v = row[h]
      if (v === null || v === undefined) return ''
      if (typeof v === 'string') return `"${v.replace(/"/g, '""')}"`
      return String(v)
    })
    lines.push(values.join(','))
  }
  return lines.join('\n')
}

export class ExportEngine {
  constructor(private db: CapStoreDb) {}

  async export(options: ExportOptions): Promise<ExportResult> {
    const start = Date.now()
    const tables = SCOPE_TABLES[options.scope] ?? SCOPE_TABLES.full
    const allData: Record<string, unknown[]> = {}
    let totalRows = 0

    const prisma = this.db.prisma as any
    for (const table of tables) {
      try {
        const rows = await prisma[table].findMany({
          take: 100_000,
          orderBy: { createdAt: 'asc' } as any,
        })
        allData[table] = rows
        totalRows += rows.length
      } catch {
        // Table may not exist in this schema version
        allData[table] = []
      }
    }

    // Write output
    mkdirSync(dirname(options.outputPath), { recursive: true })

    if (options.format === 'json') {
      const json = JSON.stringify(allData, null, 2)
      writeFileSync(options.outputPath, json, 'utf-8')
    } else {
      // CSV — one file per table (write to directory)
      const dir = options.outputPath.replace(/\.[^.]+$/, '')
      mkdirSync(dir, { recursive: true })
      for (const [table, rows] of Object.entries(allData)) {
        const csv = toCsvRows(rows as Record<string, unknown>[])
        writeFileSync(`${dir}/${table}.csv`, csv, 'utf-8')
      }
      // Write a manifest
      writeFileSync(
        `${dir}/_manifest.json`,
        JSON.stringify({ tables: Object.keys(allData), totalRows }, null, 2),
      )
    }

    const stats = { size: 0 }
    try {
      const { statSync } = await import('node:fs')
      if (options.format === 'json') {
        stats.size = statSync(options.outputPath).size
      } else {
        const dir = options.outputPath.replace(/\.[^.]+$/, '')
        const { readdirSync } = await import('node:fs')
        for (const f of readdirSync(dir)) {
          stats.size += statSync(`${dir}/${f}`).size
        }
      }
    } catch {
      /* ignore stat errors */
    }

    return {
      filePath: options.outputPath,
      format: options.format,
      scope: options.scope,
      tablesExported: tables.filter((t) => (allData[t]?.length ?? 0) > 0),
      totalRows,
      fileSizeBytes: stats.size,
      durationMs: Date.now() - start,
      encrypted: false,
    }
  }

  async importFromJson(
    filePath: string,
  ): Promise<{ tablesImported: string[]; rowsImported: number }> {
    const { readFileSync } = await import('node:fs')
    const raw = readFileSync(filePath, 'utf-8')
    const data = JSON.parse(raw) as Record<string, unknown[]>
    const prisma = this.db.prisma as any

    let rowsImported = 0
    const tablesImported: string[] = []

    for (const [table, rows] of Object.entries(data)) {
      if (!Array.isArray(rows) || rows.length === 0) continue
      try {
        for (const row of rows) {
          await prisma[table].upsert({
            where: { id: (row as any).id },
            create: row,
            update: row,
          })
          rowsImported++
        }
        tablesImported.push(table)
      } catch {
        /* skip table on error */
      }
    }

    return { tablesImported, rowsImported }
  }
}
