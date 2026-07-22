// src/engines/memory-export.ts
// MemoryExportEngine — portable memory export/import (JSON + markdown)
// Depends on MemoryEngine for data access.

import type {
  EpisodicMemory,
  MemoryEngine,
  ProceduralRule,
  SemanticMemory,
} from './memory-engine.js'

// ── Types ───────────────────────────────────────────────────────────────

export type MemoryExportFormat = 'json' | 'markdown'

export interface MemoryExport {
  version: 1
  encrypted: false
  exportedAt: number
  facts: SemanticMemory[]
  episodes: EpisodicMemory[]
  rules: ProceduralRule[]
}

export interface MemoryImportResult {
  merged: number
  skipped: number
}

// ── Engine ──────────────────────────────────────────────────────────────

export class MemoryExportEngine {
  constructor(private memory: MemoryEngine) {}

  async export(format: MemoryExportFormat): Promise<string> {
    const data: MemoryExport = {
      version: 1,
      encrypted: false,
      exportedAt: Date.now(),
      facts: await this.memory.getAllFacts(),
      episodes: await this.memory.getAllEpisodes(),
      rules: await this.memory.getAllRules(),
    }

    return format === 'json' ? JSON.stringify(data, null, 2) : toMarkdown(data)
  }

  async import(json: string): Promise<MemoryImportResult> {
    const data = JSON.parse(json) as MemoryExport
    let merged = 0
    let skipped = 0

    // Import facts (merge by content, prefer higher confidence)
    for (const f of data.facts) {
      const existing = await this.memory.findFactByContent(f.subject, f.predicate, f.object)
      if (existing && existing.confidence >= f.confidence) {
        skipped++
        continue
      }
      await this.memory.assertFact({
        subject: f.subject,
        predicate: f.predicate,
        object: f.object,
        confidence: f.confidence,
        source: 'import',
      })
      merged++
    }

    // Import episodes (append, dedupe by action+timestamp)
    for (const e of data.episodes) {
      await this.memory.recordEpisode({
        providerId: e.providerId,
        capabilityId: e.capabilityId,
        slaveId: e.slaveId,
        action: e.action,
        input: e.input,
        output: e.output,
        success: e.success,
        durationMs: e.durationMs,
        tags: e.tags,
      })
      merged++
    }

    // Import rules (merge by name, prefer higher confidence)
    for (const r of data.rules) {
      await this.memory.assertProcedureRule({
        name: r.name,
        condition: r.condition,
        action: r.action,
        confidence: r.confidence,
      })
      merged++
    }

    return { merged, skipped }
  }
}

// ── Markdown formatter ──────────────────────────────────────────────────

function toMarkdown(data: MemoryExport): string {
  const lines: string[] = []

  lines.push(`# Memory Export`)
  lines.push(``)
  lines.push(`Exported at: ${new Date(data.exportedAt).toISOString()}`)
  lines.push(`Encrypted: ${data.encrypted}`)
  lines.push(``)

  // Facts
  lines.push(`## Facts (${data.facts.length})`)
  lines.push(``)
  for (const f of data.facts) {
    lines.push(`- **${f.subject}** ${f.predicate} \`${JSON.stringify(f.object)}\` (confidence: ${f.confidence.toFixed(2)})`)
  }
  lines.push(``)

  // Episodes
  lines.push(`## Episodes (${data.episodes.length})`)
  lines.push(``)
  for (const e of data.episodes) {
    const status = e.success ? '✓' : '✗'
    lines.push(`- ${status} ${e.action} (${e.providerId}) — ${new Date(e.timestamp).toISOString()}`)
  }
  lines.push(``)

  // Rules
  lines.push(`## Rules (${data.rules.length})`)
  lines.push(``)
  for (const r of data.rules) {
    lines.push(`- **${r.name}**: IF ${r.condition} THEN ${r.action} (confidence: ${r.confidence.toFixed(2)})`)
  }
  lines.push(``)

  return lines.join('\n')
}
