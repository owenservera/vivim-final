// tests/unit/engines/export-engine.test.ts
// Tests for ExportEngine — JSON/CSV export of all VIVIM data

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { ExportEngine } from '../../../src/engines/export.js'

const TEST_DIR = join(import.meta.dir, '__test_export__')

function makeDb(tables: Record<string, unknown[]> = {}) {
  const prisma: Record<string, any> = {}
  for (const [name, rows] of Object.entries(tables)) {
    prisma[name] = { findMany: () => Promise.resolve(rows) }
  }
  return { prisma } as any
}

describe('ExportEngine', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  it('full export includes all tables', async () => {
    const db = makeDb({
      conversation: [{ id: 'c1', title: 'Test' }],
      message: [{ id: 'm1', content: 'Hello' }],
      entity: [{ id: 'e1', name: 'Alice' }],
    })
    const engine = new ExportEngine(db)
    const result = await engine.export({
      format: 'json',
      scope: 'full',
      outputPath: join(TEST_DIR, 'full.json'),
      includeEmbeddings: false,
    })
    expect(result.format).toBe('json')
    expect(result.scope).toBe('full')
    expect(result.totalRows).toBe(3)
    expect(result.tablesExported).toContain('conversation')
    expect(result.tablesExported).toContain('message')
    expect(result.tablesExported).toContain('entity')
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
    expect(result.encrypted).toBe(false)
    expect(existsSync(join(TEST_DIR, 'full.json'))).toBe(true)
  })

  it('conversations-only export correct', async () => {
    const db = makeDb({
      conversation: [{ id: 'c1' }],
      message: [{ id: 'm1' }],
      entity: [{ id: 'e1' }],
    })
    const engine = new ExportEngine(db)
    const result = await engine.export({
      format: 'json',
      scope: 'conversations',
      outputPath: join(TEST_DIR, 'conv.json'),
      includeEmbeddings: false,
    })
    expect(result.tablesExported).toContain('conversation')
    expect(result.tablesExported).toContain('message')
    expect(result.totalRows).toBe(2)
  })

  it('json is valid and re-importable', async () => {
    const data = { conversation: [{ id: 'c1', title: 'Test' }] }
    const db = makeDb(data)
    const engine = new ExportEngine(db)
    const path = join(TEST_DIR, 'valid.json')
    await engine.export({
      format: 'json',
      scope: 'conversations',
      outputPath: path,
      includeEmbeddings: false,
    })
    const raw = readFileSync(path, 'utf-8')
    const parsed = JSON.parse(raw)
    expect(parsed.conversation).toBeDefined()
    expect(parsed.conversation[0].id).toBe('c1')
  })

  it('csv has correct headers', async () => {
    const db = makeDb({ conversation: [{ id: 'c1', title: 'Test', providerId: 'p1' }] })
    const engine = new ExportEngine(db)
    await engine.export({
      format: 'csv',
      scope: 'conversations',
      outputPath: join(TEST_DIR, 'out.csv'),
      includeEmbeddings: false,
    })
    const csvPath = join(TEST_DIR, 'out', 'conversation.csv')
    expect(existsSync(csvPath)).toBe(true)
    const csv = readFileSync(csvPath, 'utf-8')
    const headers = csv.split('\n')[0]
    expect(headers).toContain('id')
    expect(headers).toContain('title')
  })

  it('large export works', async () => {
    const bigRows = Array.from({ length: 1000 }, (_, i) => ({ id: `row-${i}`, data: `value-${i}` }))
    const db = makeDb({ conversation: bigRows })
    const engine = new ExportEngine(db)
    const result = await engine.export({
      format: 'json',
      scope: 'conversations',
      outputPath: join(TEST_DIR, 'big.json'),
      includeEmbeddings: false,
    })
    expect(result.totalRows).toBe(1000)
    expect(result.fileSizeBytes).toBeGreaterThan(0)
  })
})
