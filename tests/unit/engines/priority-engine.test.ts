// tests/unit/engines/priority-engine.test.ts
// Unit tests for PriorityEngine — risk-based test prioritization.

import { beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { KnowledgeStore } from '../../../devops/llm-testing/knowledge-store.js'
import { PriorityEngine } from '../../../devops/llm-testing/priority-engine.js'

const TEST_DIR = join(process.cwd(), '.runtime', 'llm-testing', 'priority-engine-test')

describe('PriorityEngine', () => {
  let knowledge: KnowledgeStore
  let engine: PriorityEngine

  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true })
    mkdirSync(TEST_DIR, { recursive: true })
    knowledge = new KnowledgeStore(TEST_DIR)
    engine = new PriorityEngine(knowledge)
  })

  it('should compute priorities from errors', () => {
    knowledge.upsertPattern({
      surface: 'ui',
      capability: 'conversation_send',
      pattern: 'Send message test',
      confidence: 0.5,
      lastVerified: new Date().toISOString(),
      tags: ['ui', 'send'],
    })

    knowledge.upsertError({
      surface: 'ui',
      capability: 'conversation_send',
      error: 'Composer not found',
      rootCause: 'Page not loaded',
      fix: 'Wait',
      lastSeen: new Date().toISOString(),
      resolved: false,
    })

    const queue = engine.computePriorities()
    expect(queue.length).toBeGreaterThan(0)
    const entry = queue.find((e) => e.capability === 'conversation_send')
    expect(entry).toBeDefined()
  })

  it('should return empty queue when no errors and high coverage', () => {
    for (const surface of ['cli', 'ui', 'api', 'mcp', 'workflow', 'provider']) {
      knowledge.updateCoverage(surface as any, {
        totalCapabilities: 10,
        testedCapabilities: 10,
        coverage: 1.0,
        lastFullRun: new Date().toISOString(),
        gaps: [],
      })
    }

    const queue = engine.computePriorities()
    expect(queue.length).toBe(0)
  })

  it('should prioritize high-error capabilities', () => {
    knowledge.upsertPattern({
      surface: 'ui',
      capability: 'oracle_query',
      pattern: 'Oracle query test',
      confidence: 0.5,
      lastVerified: new Date().toISOString(),
      tags: ['ui', 'oracle'],
    })

    for (let i = 0; i < 5; i++) {
      knowledge.upsertError({
        surface: 'ui',
        capability: 'oracle_query',
        error: 'Timeout',
        rootCause: 'Slow query',
        fix: 'Optimize',
        lastSeen: new Date().toISOString(),
        resolved: false,
      })
    }

    const queue = engine.computePriorities()
    const oracleEntry = queue.find((e) => e.capability === 'oracle_query')
    expect(oracleEntry).toBeDefined()
    expect(oracleEntry?.riskScore).toBeGreaterThan(0.5)
  })

  it('should return next test', () => {
    knowledge.upsertPattern({
      surface: 'cli',
      capability: 'help',
      pattern: 'Help command',
      confidence: 0.5,
      lastVerified: new Date().toISOString(),
      tags: ['cli'],
    })

    knowledge.upsertError({
      surface: 'cli',
      capability: 'help',
      error: 'Not found',
      rootCause: 'Missing command',
      fix: 'Register command',
      lastSeen: new Date().toISOString(),
      resolved: false,
    })

    engine.computePriorities()
    const next = engine.getNextTest()
    expect(next).toBeDefined()
  })

  it('should return null when no next test', () => {
    const next = engine.getNextTest()
    expect(next).toBeNull()
  })
})
