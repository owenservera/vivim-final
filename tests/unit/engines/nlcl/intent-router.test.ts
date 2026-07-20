// tests/unit/engines/nlcl/intent-router.test.ts
import { describe, expect, it, mock } from 'bun:test'
import { IntentRouter } from '../../../../src/engines/nlcl/intent-router.js'
import type {
  CommandExecutor,
  CommandResult,
  NLCContext,
  ParsedIntent,
} from '../../../../src/engines/nlcl/types.js'

const ctx: NLCContext = {
  surface: 'cli',
  metadata: {},
}

function intent(partial: Partial<ParsedIntent> & { intent: string }): ParsedIntent {
  return {
    patternId: partial.intent,
    input: {},
    confidence: 1,
    rawInput: partial.intent,
    matchedPattern: partial.intent,
    alternatives: [],
    resolvedAt: Date.now(),
    ...partial,
  }
}

function okExecutor(id: string, out: unknown = 'done'): CommandExecutor {
  return {
    id: id as CommandExecutor['id'],
    execute: mock(
      async (_i: ParsedIntent, _c: NLCContext): Promise<CommandResult> => ({
        ok: true,
        intent: _i.intent,
        output: out,
        latencyMs: 0,
        traceId: 't',
        classification: 'system',
      }),
    ),
  }
}

describe('IntentRouter — executor routing', () => {
  it('registers and routes an intent to its executor', async () => {
    const r = new IntentRouter()
    const ex = okExecutor('conversation', 'sent')
    r.registerExecutor(ex)
    r.registerPatternIntent('send_message', 'conversation')

    const res = await r.route(intent({ intent: 'send_message' }), ctx)
    expect(res.ok).toBe(true)
    expect(res.output).toBe('sent')
  })

  it('throws when registering a duplicate executor', () => {
    const r = new IntentRouter()
    r.registerExecutor(okExecutor('conversation'))
    expect(() => r.registerExecutor(okExecutor('conversation'))).toThrow()
  })

  it('returns error when no pattern registered for the intent', async () => {
    const r = new IntentRouter()
    r.registerExecutor(okExecutor('conversation'))
    const res = await r.route(intent({ intent: 'unknown_thing' }), ctx)
    expect(res.ok).toBe(false)
    expect(res.error).toContain('No executor for intent')
  })

  it('returns error when executor referenced by pattern is not registered', async () => {
    const r = new IntentRouter()
    r.registerPatternIntent('send_message', 'conversation')
    const res = await r.route(intent({ intent: 'send_message' }), ctx)
    expect(res.ok).toBe(false)
    expect(res.error).toContain('not registered')
  })

  it('lists registered executors', () => {
    const r = new IntentRouter()
    r.registerExecutor(okExecutor('conversation'))
    r.registerExecutor(okExecutor('system'))
    expect(r.listExecutors().sort()).toEqual(['conversation', 'system'])
  })
})

describe('IntentRouter — unresolved handling', () => {
  it('returns a friendly error for unresolved intents', async () => {
    const r = new IntentRouter()
    const res = await r.route(intent({ intent: 'unresolved', rawInput: 'blah blah' }), ctx)
    expect(res.ok).toBe(false)
    expect(res.intent).toBe('unresolved')
    expect(res.followUp).toContain('help')
  })
})

describe('IntentRouter — registry routing', () => {
  it('routes via registry when capabilityId present', async () => {
    const execute = mock(async () => ({ result: 'from-registry' }))
    const registry = { execute } as unknown as import(
      '../../../../src/engines/unified-registry.js',
    ).UnifiedCapabilityRegistry
    const r = new IntentRouter(registry)
    const res = await r.route(
      intent({ intent: 'send_message', capabilityId: 'cap:message:send' }),
      ctx,
    )
    expect(res.ok).toBe(true)
    expect(res.capabilityId).toBe('cap:message:send')
    expect(execute).toHaveBeenCalled()
  })

  it('surfaces registry execution errors', async () => {
    const execute = mock(async () => {
      throw new Error('boom')
    })
    const registry = { execute } as unknown as import(
      '../../../../src/engines/unified-registry.js',
    ).UnifiedCapabilityRegistry
    const r = new IntentRouter(registry)
    const res = await r.route(
      intent({ intent: 'send_message', capabilityId: 'cap:message:send' }),
      ctx,
    )
    expect(res.ok).toBe(false)
    expect(res.error).toBe('boom')
  })
})

describe('IntentRouter — composite (pipeline)', () => {
  it('propagates prior step output into the next step (pipeline)', async () => {
    const r = new IntentRouter()
    const ex = {
      id: 'conversation' as const,
      execute: mock(async (i: ParsedIntent) => ({
        ok: true,
        intent: i.intent,
        output: `out:${i.input?.content ?? ''}`,
        latencyMs: 0,
        traceId: 't',
        classification: 'system' as const,
      })),
    }
    r.registerExecutor(ex)
    r.registerPatternIntent('step', 'conversation')

    const composite = {
      steps: [intent({ intent: 'step', input: { content: 'first' } }), intent({ intent: 'step' })],
      joinStrategy: 'pipeline' as const,
    }
    const res = await r.routeComposite(composite, ctx)
    expect(res.ok).toBe(true)
    const results = (res.output as { results: CommandResult[] }).results
    // second step received first step's output via content (pipeline propagation)
    expect(results[1]?.output).toBe('out:out:first')
  })

  it('aborts sequential composite on first failing step', async () => {
    const r = new IntentRouter()
    const failEx = {
      id: 'system' as const,
      execute: mock(async () => ({
        ok: false,
        intent: 'step',
        error: 'kaboom',
        latencyMs: 0,
        traceId: 't',
        classification: 'system' as const,
      })),
    }
    r.registerExecutor(failEx)
    r.registerPatternIntent('step', 'system')

    const composite = {
      steps: [intent({ intent: 'step' }), intent({ intent: 'step' })],
      joinStrategy: 'sequential' as const,
    }
    const res = await r.routeComposite(composite, ctx)
    expect(res.ok).toBe(false)
    expect(res.error).toContain('Step 1 failed')
  })
})
