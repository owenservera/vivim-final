// tests/unit/engines/knowledge-store.test.ts
// Unit tests for KnowledgeStore — JSON flat-file persistence.

import { beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { KnowledgeStore } from '../../../devops/llm-testing/knowledge-store.js'

const TEST_DIR = join(process.cwd(), '.runtime', 'llm-testing', 'knowledge-test')

describe('KnowledgeStore', () => {
  let store: KnowledgeStore

  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true })
    mkdirSync(TEST_DIR, { recursive: true })
    store = new KnowledgeStore(TEST_DIR)
  })

  it('should bootstrap with default data', () => {
    const gemini = store.getProviderKnowledge('gemini')
    expect(gemini).toBeDefined()
    expect(gemini?.enterKeyBroken).toBe(true)
    expect(gemini?.sendMethod).toBe('click-send-button')
  })

  it('should upsert and retrieve patterns', () => {
    const id = store.upsertPattern({
      surface: 'cli',
      capability: 'conversation_list',
      pattern: 'CLI list returns array',
      confidence: 0.8,
      lastVerified: new Date().toISOString(),
      tags: ['cli', 'list'],
    })

    expect(id).toBe('P001')

    const patterns = store.getPatterns()
    expect(patterns.length).toBe(1)

    const p = store.getPatternById(id)
    expect(p).toBeDefined()
    expect(p?.capability).toBe('conversation_list')
  })

  it('should update existing pattern', () => {
    const id = store.upsertPattern({
      surface: 'cli',
      capability: 'conversation_list',
      pattern: 'CLI list returns array',
      confidence: 0.8,
      lastVerified: new Date().toISOString(),
      tags: ['cli'],
    })

    store.upsertPattern({
      id,
      surface: 'cli',
      capability: 'conversation_list',
      pattern: 'Updated pattern',
      confidence: 0.9,
      lastVerified: new Date().toISOString(),
      tags: ['cli', 'updated'],
    })

    const p = store.getPatternById(id)
    expect(p?.confidence).toBe(0.9)
    expect(p?.tags).toContain('updated')
  })

  it('should upsert and retrieve errors', () => {
    const id = store.upsertError({
      surface: 'ui',
      capability: 'conversation_send',
      error: 'Composer not found',
      rootCause: 'Page not loaded',
      fix: 'Wait for page load',
      lastSeen: new Date().toISOString(),
      resolved: false,
    })

    expect(id).toBe('E001')

    const errors = store.getErrors()
    expect(errors.length).toBe(1)
  })

  it('should increment error occurrences', () => {
    const id = store.upsertError({
      surface: 'ui',
      capability: 'conversation_send',
      error: 'Composer not found',
      rootCause: 'Page not loaded',
      fix: 'Wait',
      lastSeen: new Date().toISOString(),
      resolved: false,
    })

    store.upsertError({
      id,
      surface: 'ui',
      capability: 'conversation_send',
      error: 'Composer not found',
      rootCause: 'Page not loaded',
      fix: 'Wait',
      lastSeen: new Date().toISOString(),
      resolved: false,
    })

    const errors = store.getErrors()
    const e = errors.find((x) => x.id === id)
    expect(e?.occurrences).toBe(2)
  })

  it('should update provider knowledge', () => {
    store.updateProviderKnowledge('gemini', {
      successRate: 0.85,
      lastTested: new Date().toISOString(),
    })

    const pk = store.getProviderKnowledge('gemini')
    expect(pk?.successRate).toBe(0.85)
  })

  it('should update surface coverage', () => {
    store.updateCoverage('cli', {
      totalCapabilities: 40,
      testedCapabilities: 35,
      coverage: 0.875,
      lastFullRun: new Date().toISOString(),
    })

    const c = store.getSurfaceCoverage('cli')
    expect(c?.coverage).toBe(0.875)
  })

  it('should set and get priorities', () => {
    store.setPriorities([
      {
        surface: 'ui',
        capability: 'oracle_query',
        reason: 'never tested',
        riskScore: 0.8,
        coverageGap: 1.0,
      },
    ])

    const q = store.getPriorities()
    expect(q.length).toBe(1)
    expect(q[0].capability).toBe('oracle_query')
  })

  it('should merge delta', () => {
    store.mergeDelta({
      newPatterns: [
        {
          id: 'P100',
          surface: 'mcp',
          capability: 'mcp_tool',
          pattern: 'MCP tool works',
          confidence: 0.8,
          lastVerified: new Date().toISOString(),
          failures: [],
          tags: ['mcp'],
        },
      ],
      updatedPatterns: [],
      newErrors: [],
      updatedErrors: [],
    })

    const p = store.getPatternById('P100')
    expect(p).toBeDefined()
  })
})
