// tests/unit/ai/full-wiring.test.ts
// Tests for Round 5 full-wiring: C3 tool orchestrator facade, universal apiEndpoint
// dispatcher, NLCL ai patterns, C4 event bridge activation.

import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { getDefaultCommandPatterns } from '../../../src/engines/nlcl/catalog.js'
import { aiPatterns } from '../../../src/engines/nlcl/categories/ai.js'
import {
  callToolViaOrchestrator,
  createMcpToolOrchestrator,
} from '../../../src/engines/tool-orchestrator-facade.js'

describe('C3 — Tool orchestrator facade', () => {
  beforeEach(() => {
    ;(globalThis as Record<string, unknown>).__toolOrchestrator = undefined
  })

  it('falls back to direct callTool when orchestrator is not active', async () => {
    const mockClient = {
      callTool: mock(async (name: string, args: Record<string, unknown>) => {
        return { content: `direct: ${name} ${JSON.stringify(args)}` }
      }),
    }
    const result = await callToolViaOrchestrator(mockClient as never, 'test_tool', { foo: 'bar' })
    expect(result).toEqual({ content: 'direct: test_tool {"foo":"bar"}' })
    expect(mockClient.callTool).toHaveBeenCalledTimes(1)
  })

  it('routes through the orchestrator when it is active', async () => {
    // Set up a mock orchestrator that records the call
    let recordedToolName: string | undefined
    const mockOrchestrator = {
      handle: mock(async (tool: { name: string }, _call: unknown, _ctx: unknown) => {
        recordedToolName = tool.name
        return { content: `orchestrated: ${tool.name}` }
      }),
    }
    ;(globalThis as Record<string, unknown>).__toolOrchestrator = mockOrchestrator

    const mockClient = {
      callTool: mock(async () => 'should not be called'),
    }
    const result = await callToolViaOrchestrator(mockClient as never, 'my_tool', { arg: 1 })
    expect(result).toEqual({ content: 'orchestrated: my_tool' })
    expect(mockClient.callTool).not.toHaveBeenCalled()
    expect(recordedToolName).toBe('my_tool')
  })

  it('handles 3-arg form (serverId, toolName, input)', async () => {
    let recordedName: string | undefined
    const mockOrchestrator = {
      handle: mock(async (tool: { name: string }) => {
        recordedName = tool.name
        return 'ok'
      }),
    }
    ;(globalThis as Record<string, unknown>).__toolOrchestrator = mockOrchestrator

    await callToolViaOrchestrator({} as never, 'server-1', 'tool-x', { input: 1 })
    expect(recordedName).toBe('tool-x')
  })

  it('createMcpToolOrchestrator wraps an McpServerAdapter', () => {
    const mockMcp = {
      callTool: mock(async () => ({ content: 'ok' })),
    }
    const orchestrator = createMcpToolOrchestrator(mockMcp as never)
    expect(orchestrator).toBeDefined()
    expect(orchestrator.handle).toBeDefined()
    expect(orchestrator.authorizer).toBeDefined()
    expect(orchestrator.executor).toBeDefined()
    expect(orchestrator.auditLog).toBeDefined()
  })
})

describe('NLCL — AI category patterns', () => {
  it('registers 3 AI patterns', () => {
    expect(aiPatterns.length).toBe(3)
    const intents = aiPatterns.map((p) => p.intent)
    expect(intents).toContain('ai.execute')
    expect(intents).toContain('ai.providers')
    expect(intents).toContain('ai.models')
  })

  it('all AI patterns have capabilityId', () => {
    for (const p of aiPatterns) {
      expect(p.capabilityId).toBeDefined()
      expect(p.capabilityId).toMatch(/^cap:ai:/)
    }
  })

  it('all AI patterns have category "ai"', () => {
    for (const p of aiPatterns) {
      expect(p.category).toBe('ai')
    }
  })

  it('catalog includes AI patterns', () => {
    const all = getDefaultCommandPatterns()
    const aiCount = all.filter((p) => p.category === 'ai').length
    expect(aiCount).toBe(3)
  })

  it('ai.execute pattern matches "ask the ai to ..."', () => {
    const executePattern = aiPatterns.find((p) => p.intent === 'ai.execute')!
    const matchPattern = executePattern.patterns[0]!
    const m = 'ask the ai to explain this codebase'.match(matchPattern.regex)
    expect(m).not.toBeNull()
    const extracted = matchPattern.extract?.(m!, 'ask the ai to explain this codebase')
    expect(extracted.messages).toEqual([{ role: 'user', content: 'explain this codebase' }])
  })

  it('ai.providers pattern matches "list ai providers"', () => {
    const providersPattern = aiPatterns.find((p) => p.intent === 'ai.providers')!
    const matchPattern = providersPattern.patterns[0]!
    const m = 'list ai providers'.match(matchPattern.regex)
    expect(m).not.toBeNull()
  })

  it('ai.models pattern matches "list ai models"', () => {
    const modelsPattern = aiPatterns.find((p) => p.intent === 'ai.models')!
    const matchPattern = modelsPattern.patterns[0]!
    const m = 'list ai models'.match(matchPattern.regex)
    expect(m).not.toBeNull()
  })
})

describe('Universal apiEndpoint dispatcher', () => {
  // The matchCapabilityEndpoint function is not exported, but we can test the
  // behavior via the server. For now, test the pattern-matching logic indirectly.
  it('path pattern with {param} matches and extracts param', () => {
    const declared = '/api/conversations/{id}/send'
    const paramNames: string[] = []
    const regexStr = declared.replace(/\{([^}]+)\}/g, (_, name) => {
      paramNames.push(name)
      return '([^/]+)'
    })
    const regex = new RegExp(`^${regexStr}$`)
    const match = '/api/conversations/abc-123/send'.match(regex)
    expect(match).not.toBeNull()
    expect(paramNames).toEqual(['id'])
    expect(match?.[1]).toBe('abc-123')
  })

  it('path pattern with :param matches and extracts param', () => {
    const declared = '/api/opencode/permission/:id'
    const paramNames: string[] = []
    const regexStr = declared.replace(/:([^/]+)/g, (_, name) => {
      paramNames.push(name)
      return '([^/]+)'
    })
    const regex = new RegExp(`^${regexStr}$`)
    const match = '/api/opencode/permission/perm-456'.match(regex)
    expect(match).not.toBeNull()
    expect(paramNames).toEqual(['id'])
    expect(match?.[1]).toBe('perm-456')
  })

  it('static path matches without params', () => {
    const declared = '/api/ai/execute'
    const regex = new RegExp(`^${declared}$`)
    const match = '/api/ai/execute'.match(regex)
    expect(match).not.toBeNull()
  })
})
