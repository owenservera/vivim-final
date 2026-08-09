// tests/unit/ai/convergence-c1-c4.test.ts
// Tests for Round 3 convergence: C1 wrappers, C2 store-backed policy,
// C3 tool orchestrator, C4 plugin manager + event bridge.

import { describe, expect, it, mock } from 'bun:test'
import type {
  ProviderManifest,
  ToolCallContent,
  ToolDefinition,
} from '../../../src/ai/core/types.js'
import { EventRecordBridge } from '../../../src/ai/events/event-record-bridge.js'
import { InMemoryEventBus } from '../../../src/ai/events/in-memory-bus.js'
import { createRequestId, modelId, providerId } from '../../../src/ai/index.js'
import { TrustedPluginManager } from '../../../src/ai/plugins/plugin-manager-impl.js'
import {
  StoreBackedPolicyEnforcer,
  StoreBackedPolicyEvaluator,
} from '../../../src/ai/policy/store-backed-policy.js'
import {
  ApiProviderAdapterWrapper,
  LocalModelAdapterWrapper,
} from '../../../src/ai/protocol/legacy-adapter-wrappers.js'
import {
  DefaultApprovalManager,
  InMemoryToolAuditLog,
  PermissiveToolAuthorizer,
  ToolOrchestrator,
  createToolOrchestrator,
} from '../../../src/ai/tools/tool-orchestrator-impl.js'

// Mock PrismaClient for C2 tests
function mockPrismaWithRules(
  rules: Array<{
    id: string
    name: string
    condition: string
    classification: string
    requiresApproval: number
    isActive: number
    scope: string
  }>,
) {
  return {
    policyRule: {
      findMany: mock(async () => rules),
    },
  } as never
}

describe('C1 — Legacy adapter wrappers', () => {
  it('LocalModelAdapterWrapper implements IProviderAdapter', async () => {
    const mockAdapter = {
      ping: mock(async () => ({ ok: true, latencyMs: 5 })),
      listModels: mock(async () => ['llama3', 'codellama']),
      generateStream: async function* () {
        yield 'Hello '
        yield 'world'
      },
    } as never

    const wrapper = new LocalModelAdapterWrapper(
      mockAdapter,
      providerId('ollama-test'),
      'Ollama Test',
    )
    expect(wrapper.providerId).toBe(
      'opencode-serve'.length > 0 ? providerId('ollama-test') : providerId('ollama-test'),
    )
    expect(wrapper.manifest.kind).toBe('local')
    expect(wrapper.manifest.capabilities.chat?.supported).toBe(true)

    await wrapper.initialize({ transport: 'http', baseUrl: 'http://localhost:11434' })
    const health = await wrapper.health()
    expect(health.status).toBe('healthy')

    const models = await wrapper.listModels()
    expect(models.length).toBe(2)
    expect(models[0]?.name).toBe('llama3')
  })

  it('ApiProviderAdapterWrapper implements IProviderAdapter', async () => {
    const mockAdapter = {
      send: mock(async (_msg: string, _model: string, onToken: (t: string) => void) => {
        onToken('Hello ')
        onToken('from API')
        return 'Hello from API'
      }),
    } as never

    const wrapper = new ApiProviderAdapterWrapper(
      mockAdapter,
      providerId('openai-api'),
      'OpenAI API',
    )
    expect(wrapper.manifest.kind).toBe('remote')
    expect(wrapper.manifest.capabilities.chat?.supported).toBe(true)

    await wrapper.initialize({ transport: 'http', baseUrl: 'https://api.openai.com' })
    const models = await wrapper.listModels()
    expect(models.length).toBe(1)
  })
})

describe('C2 — Store-backed policy', () => {
  it('evaluator returns candidates with scores', async () => {
    const prisma = mockPrismaWithRules([])
    const evaluator = new StoreBackedPolicyEvaluator(prisma)
    const candidates = [
      {
        provider: {
          id: providerId('test'),
          pluginId: 'p' as never,
          name: 'Test',
          version: '1',
          protocolVersion: '1.1',
          kind: 'local' as const,
          trust: 'official' as const,
          capabilities: {} as never,
        },
        model: {
          id: modelId('test:m'),
          providerId: providerId('test'),
          name: 'M',
          modalities: { input: ['text'], output: ['text'] },
          capabilities: {} as never,
        },
      },
    ]
    const result = await evaluator.scoreCandidates(
      { requestId: createRequestId(), messages: [] },
      candidates,
    )
    expect(result.length).toBe(1)
    expect(result[0]?.score).toBeGreaterThan(0)
  })

  it('enforcer denies network egress by default', async () => {
    const prisma = mockPrismaWithRules([])
    const enforcer = new StoreBackedPolicyEnforcer(prisma)
    const decision = await enforcer.enforceNetworkPolicy({}, 'https://api.openai.com')
    expect(decision.allowed).toBe(false)
    expect(decision.code).toBe('POLICY_DENIED')
  })

  it('enforcer allows localhost under localhost policy', async () => {
    const prisma = mockPrismaWithRules([])
    const enforcer = new StoreBackedPolicyEnforcer(prisma)
    const decision = await enforcer.enforceNetworkPolicy(
      { network: 'localhost' },
      'http://127.0.0.1:11434',
    )
    expect(decision.allowed).toBe(true)
  })

  it('enforcer denies tool execution when disabled', async () => {
    const prisma = mockPrismaWithRules([])
    const enforcer = new StoreBackedPolicyEnforcer(prisma)
    const tool: ToolDefinition = { name: 'bash', inputSchema: {} }
    const decision = await enforcer.enforceToolPolicy({ allowToolExecution: false }, tool)
    expect(decision.allowed).toBe(false)
  })

  it('enforcer denies prompt logging by default', async () => {
    const prisma = mockPrismaWithRules([])
    const enforcer = new StoreBackedPolicyEnforcer(prisma)
    const decision = await enforcer.enforceTelemetryPolicy({}, 'prompt')
    expect(decision.allowed).toBe(false)
  })
})

describe('C3 — Tool orchestrator', () => {
  it('executes allowed tools via the 4-stage pipeline', async () => {
    const callToolFn = mock(async (name: string, _args: Record<string, unknown>) => {
      return { result: `executed ${name}` }
    })
    const orchestrator = createToolOrchestrator(callToolFn)

    const tool: ToolDefinition = { name: 'search', inputSchema: {} }
    const call: ToolCallContent = {
      type: 'tool-call',
      id: 'tc-1' as never,
      name: 'search',
      arguments: { query: 'test' },
    }

    const result = await orchestrator.handle(tool, call, { agentInitiated: false })
    expect(result).toEqual({ result: 'executed search' })
    expect(callToolFn).toHaveBeenCalledTimes(1)
  })

  it('denies tool execution when authorizer denies', async () => {
    const callToolFn = mock(async () => 'should not be called')
    const orchestrator = new ToolOrchestrator({
      executor: { execute: async () => callToolFn('x', {}) },
      authorizer: {
        authorize: async () => ({ allowed: false, reason: 'denied by test' }),
      },
    })

    const tool: ToolDefinition = { name: 'bash', inputSchema: {} }
    const call: ToolCallContent = {
      type: 'tool-call',
      id: 'tc-1' as never,
      name: 'bash',
      arguments: {},
    }

    await expect(orchestrator.handle(tool, call, { agentInitiated: false })).rejects.toThrow(
      /denied/,
    )
    expect(callToolFn).not.toHaveBeenCalled()
  })

  it('records every execution in the audit log', async () => {
    const auditLog = new InMemoryToolAuditLog()
    const orchestrator = new ToolOrchestrator({
      executor: { execute: async () => 'ok' },
      auditLog,
    })

    const tool: ToolDefinition = { name: 'read_file', inputSchema: {} }
    const call: ToolCallContent = {
      type: 'tool-call',
      id: 'tc-1' as never,
      name: 'read_file',
      arguments: { path: '/tmp/test' },
    }

    await orchestrator.handle(tool, call, { agentInitiated: false })

    const entries = await auditLog.query({})
    expect(entries.length).toBe(1)
  })

  it('PermissiveToolAuthorizer allows everything', async () => {
    const authorizer = new PermissiveToolAuthorizer()
    const tool: ToolDefinition = { name: 'anything', inputSchema: {} }
    const call: ToolCallContent = {
      type: 'tool-call',
      id: 'x' as never,
      name: 'anything',
      arguments: {},
    }
    const decision = await authorizer.authorize(tool, call, { agentInitiated: false })
    expect(decision.allowed).toBe(true)
  })

  it('DefaultApprovalManager returns automatic for known-safe tools', async () => {
    const manager = new DefaultApprovalManager()
    const mode = await manager.getMode('llm', { agentInitiated: false })
    expect(mode).toBe('automatic')
  })
})

describe('C4 — Plugin manager + event bridge', () => {
  it('TrustedPluginManager computes manifest hash', () => {
    const manifest: ProviderManifest = {
      id: providerId('test'),
      pluginId: 'p' as never,
      name: 'Test',
      version: '1.0.0',
      protocolVersion: '1.1',
      kind: 'local',
      trust: 'official',
      capabilities: { chat: { supported: true } } as never,
    }
    const hash = TrustedPluginManager.computeManifestHash(manifest)
    expect(hash).toBeString()
    expect(hash.length).toBe(64) // SHA-256 hex
  })

  it('EventRecordBridge forwards events from AI bus to capability bus', async () => {
    const aiBus = new InMemoryEventBus()
    const capBus = {
      emit: mock((_event: unknown) => {}),
    } as never

    const bridge = new EventRecordBridge(aiBus, capBus)
    bridge.start()

    // Publish an execution event
    aiBus.publish({
      type: 'execution.state-changed',
      executionId: 'exec-1' as never,
      from: 'queued' as never,
      to: 'routing' as never,
      at: new Date().toISOString(),
    } as never)

    // Give the bridge a moment to consume
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(capBus.emit).toHaveBeenCalledTimes(1)
    bridge.stop()
  })
})
