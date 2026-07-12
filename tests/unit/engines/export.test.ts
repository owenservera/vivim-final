// tests/unit/engines/export.test.ts
// ExportEngine — JSON/CSV export and import tests

import { beforeEach, describe, expect, test } from 'bun:test'
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { ExportEngine, type ExportStore } from '../../../src/engines/export.js'

const tmpDir = join(import.meta.dir, '.tmp-export-test')

function createMockStore(): ExportStore {
  return {
    async listConversations() {
      return [
        { id: 'conv-1', state: 'active', title: 'Test Chat' },
        { id: 'conv-2', state: 'archived', title: 'Old Chat' },
      ]
    },
    async listMessages(conversationId) {
      if (conversationId === 'conv-1') {
        return [
          { id: 'msg-1', role: 'user', content: 'Hello', ts: 1000 },
          { id: 'msg-2', role: 'assistant', content: 'Hi there', ts: 2000 },
        ]
      }
      return []
    },
    async listMemory() {
      return [{ id: 'mem-1', key: 'user.name', value: 'Alice', namespace: 'default' }]
    },
    async listProviders() {
      return [{ id: 'prov-1', slug: 'openai', displayName: 'OpenAI' }]
    },
    async listConfig() {
      return [{ id: 'cfg-1', engineId: 'test', configJson: '{"key":"val"}' }]
    },
  }
}

describe('ExportEngine', () => {
  beforeEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
    mkdirSync(tmpDir, { recursive: true })
  })

  test('export full scope as JSON', async () => {
    const engine = new ExportEngine(createMockStore())
    const outputPath = join(tmpDir, 'full.json')
    const manifest = await engine.export({
      format: 'json',
      scope: 'full',
      outputPath,
      includeEmbeddings: false,
    })
    expect(manifest.version).toBe('1.0')
    expect(manifest.scope).toBe('full')
    expect(manifest.encrypted).toBe(false)
    expect(manifest.recordCounts.conversations).toBe(2)
    expect(manifest.recordCounts.memory).toBe(1)
    expect(manifest.recordCounts.providers).toBe(1)
    expect(manifest.recordCounts.config).toBe(1)
    const content = readFileSync(outputPath, 'utf8')
    const parsed = JSON.parse(content)
    expect(parsed.conversations).toHaveLength(2)
    expect(parsed.memory).toHaveLength(1)
  })

  test('export conversations scope only', async () => {
    const engine = new ExportEngine(createMockStore())
    const outputPath = join(tmpDir, 'convos.json')
    const manifest = await engine.export({
      format: 'json',
      scope: 'conversations',
      outputPath,
      includeEmbeddings: false,
    })
    expect(manifest.recordCounts.conversations).toBe(2)
    expect(manifest.recordCounts.memory).toBeUndefined()
    const content = readFileSync(outputPath, 'utf8')
    const parsed = JSON.parse(content)
    expect(parsed.conversations).toHaveLength(2)
    expect(parsed.memory).toBeUndefined()
  })

  test('export as CSV', async () => {
    const engine = new ExportEngine(createMockStore())
    const outputPath = join(tmpDir, 'export.csv')
    await engine.export({
      format: 'csv',
      scope: 'providers',
      outputPath,
      includeEmbeddings: false,
    })
    const content = readFileSync(outputPath, 'utf8')
    expect(content).toContain('type,id,slug,displayName')
    expect(content).toContain('provider,prov-1,openai,OpenAI')
  })

  test('importJson returns record counts', async () => {
    const engine = new ExportEngine(createMockStore())
    const outputPath = join(tmpDir, 'import-test.json')
    await engine.export({
      format: 'json',
      scope: 'full',
      outputPath,
      includeEmbeddings: false,
    })
    const importEngine = new ExportEngine(createMockStore())
    const result = await importEngine.importJson(outputPath)
    expect(result.imported.conversations).toBe(2)
    expect(result.imported.memory).toBe(1)
  })
})
