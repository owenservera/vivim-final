// tests/unit/engines/pattern-analyzer.test.ts
// Unit tests for PatternAnalyzer — pattern extraction and confidence updates.

import { beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { KnowledgeStore } from '../../../devops/llm-testing/knowledge-store.js'
import { PatternAnalyzer } from '../../../devops/llm-testing/pattern-analyzer.js'
import type { TestResult } from '../../../devops/llm-testing/types.js'

const TEST_DIR = join(process.cwd(), '.runtime', 'llm-testing', 'pattern-analyzer-test')

describe('PatternAnalyzer', () => {
  let knowledge: KnowledgeStore
  let analyzer: PatternAnalyzer

  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true })
    mkdirSync(TEST_DIR, { recursive: true })
    knowledge = new KnowledgeStore(TEST_DIR)
    analyzer = new PatternAnalyzer(knowledge)
  })

  it('should create new pattern from passing test', () => {
    const results: TestResult[] = [
      {
        id: 'T001',
        surface: 'cli',
        capability: 'conversation_list',
        action: 'List conversations',
        expected: 'Returns array',
        actual: 'Returns array of 5 conversations',
        status: 'pass',
        durationMs: 150,
        timestamp: new Date().toISOString(),
      },
    ]

    const delta = analyzer.analyze(results)
    expect(delta.newPatterns.length).toBe(1)
    expect(delta.newPatterns[0].confidence).toBe(0.8)
    expect(delta.newPatterns[0].surface).toBe('cli')
  })

  it('should create new pattern from failing test', () => {
    const results: TestResult[] = [
      {
        id: 'T001',
        surface: 'ui',
        capability: 'conversation_send',
        action: 'Send message',
        expected: 'Response streams',
        actual: 'Composer not found',
        status: 'fail',
        durationMs: 5000,
        timestamp: new Date().toISOString(),
        error: 'Composer not found',
        fix: 'Wait for page load',
      },
    ]

    const delta = analyzer.analyze(results)
    expect(delta.newPatterns.length).toBe(1)
    expect(delta.newPatterns[0].confidence).toBe(0.3)
    expect(delta.newPatterns[0].failures.length).toBe(1)
  })

  it('should update confidence on pass', () => {
    const results: TestResult[] = [
      {
        id: 'T001',
        surface: 'cli',
        capability: 'conversation_list',
        action: 'List',
        expected: 'Array',
        actual: 'Array',
        status: 'pass',
        durationMs: 100,
        timestamp: new Date().toISOString(),
      },
    ]

    const delta1 = analyzer.analyze(results)
    knowledge.mergeDelta(delta1)

    const results2: TestResult[] = [
      {
        id: 'T002',
        surface: 'cli',
        capability: 'conversation_list',
        action: 'List',
        expected: 'Array',
        actual: 'Array',
        status: 'pass',
        durationMs: 100,
        timestamp: new Date().toISOString(),
      },
    ]

    const delta2 = analyzer.analyze(results2)
    expect(delta2.updatedPatterns.length).toBe(1)
    expect(delta2.updatedPatterns[0].confidence).toBeGreaterThan(0.8)
  })

  it('should decrease confidence on fail', () => {
    const results: TestResult[] = [
      {
        id: 'T001',
        surface: 'cli',
        capability: 'conversation_list',
        action: 'List',
        expected: 'Array',
        actual: 'Array',
        status: 'pass',
        durationMs: 100,
        timestamp: new Date().toISOString(),
      },
    ]

    const delta1 = analyzer.analyze(results)
    knowledge.mergeDelta(delta1)

    const results2: TestResult[] = [
      {
        id: 'T002',
        surface: 'cli',
        capability: 'conversation_list',
        action: 'List',
        expected: 'Array',
        actual: 'Error',
        status: 'fail',
        durationMs: 100,
        timestamp: new Date().toISOString(),
        error: 'Timeout',
      },
    ]

    const delta2 = analyzer.analyze(results2)
    expect(delta2.updatedPatterns.length).toBe(1)
    expect(delta2.updatedPatterns[0].confidence).toBeLessThan(0.8)
  })

  it('should skip results with status skip', () => {
    const results: TestResult[] = [
      {
        id: 'T001',
        surface: 'provider',
        capability: 'conversation_send',
        action: 'Send',
        expected: 'Response',
        actual: 'Rate limited',
        status: 'skip',
        durationMs: 0,
        timestamp: new Date().toISOString(),
      },
    ]

    const delta = analyzer.analyze(results)
    expect(delta.newPatterns.length).toBe(0)
  })

  it('should create error entries from failing tests', () => {
    const results: TestResult[] = [
      {
        id: 'T001',
        surface: 'ui',
        capability: 'conversation_send',
        action: 'Send',
        expected: 'Response',
        actual: 'Composer not found',
        status: 'fail',
        durationMs: 5000,
        timestamp: new Date().toISOString(),
        error: 'Composer not found',
        fix: 'Wait for page load',
      },
    ]

    const delta = analyzer.analyze(results)
    expect(delta.newErrors.length).toBe(1)
    expect(delta.newErrors[0].error).toBe('Composer not found')
    expect(delta.newErrors[0].fix).toBe('Wait for page load')
  })
})
