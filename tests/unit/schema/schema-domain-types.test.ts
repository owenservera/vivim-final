import { describe, expect, it } from 'bun:test'
import type {
  AlertCondition,
  AlertSeverity,
  AutomationSchedule,
} from '../../../src/schema/automation.js'
import type { ChromeSlave, SlaveStatus, SuperState } from '../../../src/schema/chrome.js'
import type { ConfigEntry } from '../../../src/schema/config.js'
import type {
  Binding,
  BindingStatus,
  CapabilityTaxonomy,
  Outcome,
  PlanTier,
  Program,
  SelectorStrategy,
} from '../../../src/schema/core.js'
import type { HarnessDAG, HarnessNode } from '../../../src/schema/harness.js'
import type { ProviderHealthReport } from '../../../src/schema/health.js'
import type { LearningEvent } from '../../../src/schema/learning.js'
import type {
  ProviderAccount,
  ProviderDefinition,
  ProviderEndpoint,
} from '../../../src/schema/provider.js'
import type { RouteEventType, RouteSpec } from '../../../src/schema/routing.js'
import type {
  Conversation,
  ConversationMessage,
  MessageRole,
  SessionState,
  VivimSession,
} from '../../../src/schema/session.js'
import type { TelemetryPipelineConfig } from '../../../src/schema/telemetry.js'
import type { TransferPattern } from '../../../src/schema/transfer.js'
import type { ProviderManifestVersion, VersionConfig } from '../../../src/schema/versioning.js'

describe('schema/core', () => {
  it('defines CapabilityTaxonomy with all fields', () => {
    const t: CapabilityTaxonomy = {
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      name: 'Send Message',
      slug: 'send-message',
      category: 'messaging',
      description: 'Send a chat message to the provider',
      parentId: null,
      inputType: 'text',
      uiComponent: 'chat-input',
      uiLabel: 'Send',
      uiIcon: 'send',
      uiPosition: 'primary',
      uiOrder: 1,
      uiGroup: 'messaging',
      uiPriority: 'high',
      interactionMode: 'direct',
      uiStatesJson: '{}',
      uiVisibilityRule: null,
      existentialRule: null,
      uiInputSchema: '{}',
      mutationEffectsJson: '{}',
      recoveryBehavior: 'retry',
      statePersistence: 'none',
      dataFlow: 'request-response',
      minPlanTier: 'free',
      dependsOnJson: '[]',
      concurrencySafe: true,
      opClassification: null,
      requiresUserConfirmation: false,
      maxResultSize: 4096,
      resultComponent: 'text-result',
      resultLayout: 'inline',
      searchHintsJson: '{}',
      aliasesJson: '{}',
      availabilityJson: '{}',
      prefetch: false,
    }
    expect(t.slug).toBe('send-message')
  })

  it('defines Binding with all statuses', () => {
    const statuses: BindingStatus[] = [
      'broken',
      'flaky',
      'prospect',
      'retired',
      'stable',
      'test-1',
      'test-2',
    ]
    const b: Binding = {
      id: 'b1',
      globalId: 'cap1',
      providerId: 'prov1',
      status: 'stable',
      bestProgramId: null,
      currentProgramId: null,
      promotionHistoryJson: '{}',
      confidence: 0.95,
    }
    expect(statuses).toContain(b.status)
  })

  it('defines PlanTier as union type', () => {
    const tiers: PlanTier[] = ['free', 'pro', 'max', 'enterprise']
    expect(tiers).toContain('free')
  })

  it('defines Program with versioning', () => {
    const p: Program = {
      id: 'pg1',
      bindingId: 'b1',
      version: 1,
      name: null,
      supersededBy: null,
      isActive: true,
      configJson: '{}',
    }
    expect(p.version).toBe(1)
  })

  it('defines Outcome', () => {
    const o: Outcome = {
      id: 'o1',
      capabilityId: 'cap1',
      bindingId: null,
      providerId: 'prov1',
      programId: null,
      selectorStrategyId: null,
      ok: true,
      error: null,
      durationMs: 150,
      confidence: null,
      selectorUsed: null,
      selectorHit: null,
      ts: Date.now(),
    }
    expect(o.ok).toBe(true)
  })

  it('defines SelectorStrategy', () => {
    const s: SelectorStrategy = {
      id: 's1',
      name: 'main-input',
      capabilityId: 'cap1',
      providerId: 'prov1',
      strategyType: 'css',
      selectorValue: '#chat-input',
      priority: 1,
      isActive: true,
      hitCount: 10,
      missCount: 1,
      lastUsedAt: null,
    }
    expect(s.selectorValue).toBe('#chat-input')
  })
})

describe('schema/chrome', () => {
  it('defines SlaveStatus as canonical lifecycle union', () => {
    const statuses: SlaveStatus[] = [
      'stopped',
      'starting',
      'running',
      'unhealthy',
      'restarting',
      'error',
      'circuit_open',
    ]
    expect(statuses).toContain('running')
  })

  it('defines SuperState as canonical fleet super-state union', () => {
    const states: SuperState[] = ['idle', 'active', 'degraded', 'terminal']
    expect(states).toContain('active')
  })

  it('defines ChromeSlave with all fields', () => {
    const s: ChromeSlave = {
      id: 's1',
      providerId: 'prov1',
      accountId: 'a1',
      status: 'running',
      superState: 'active',
      port: 9222,
      profileDir: '/tmp/chrome/prov1',
      pid: 12345,
      launchOptions: {
        headless: true,
        userDataDir: '/tmp/chrome/prov1',
        args: [],
        timeoutMs: 30000,
        debugPort: 9222,
      },
    }
    expect(s.port).toBe(9222)
  })
})

describe('schema/provider', () => {
  it('defines ProviderDefinition', () => {
    const p: ProviderDefinition = {
      id: 'p1',
      slug: 'claude',
      displayName: 'Claude',
      description: null,
      category: 'ai',
      providerType: 'llm',
      isActive: true,
      authType: 'browser',
      hasMultiAccount: false,
      profileStrategy: 'per_account',
      fleetConfigJson: '{}',
      capabilitiesJson: '{}',
      modelsJson: '[]',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    expect(p.slug).toBe('claude')
  })

  it('defines ProviderEndpoint with endpoint types', () => {
    const e: ProviderEndpoint = {
      id: 'e1',
      providerId: 'p1',
      url: 'https://claude.ai',
      label: 'Landing',
      endpointType: 'landing',
      isDefault: true,
      selectorJson: '{}',
    }
    expect(e.endpointType).toBe('landing')
  })

  it('defines ProviderAccount with PlanTier', () => {
    const a: ProviderAccount = {
      id: 'a1',
      providerId: 'p1',
      email: 'user@example.com',
      planTier: 'pro',
      isDefault: true,
      loginState: 'logged_in',
    }
    expect(a.planTier).toBe('pro')
  })
})

describe('schema/session', () => {
  it('defines SessionState as union', () => {
    const states: SessionState[] = ['active', 'idle', 'suspended', 'closed']
    expect(states).toContain('active')
  })

  it('defines VivimSession', () => {
    const s: VivimSession = {
      id: 'vs1',
      state: 'active',
      contextJson: '{}',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    expect(s.state).toBe('active')
  })

  it('defines Conversation with message count', () => {
    const c: Conversation = {
      id: 'c1',
      providerSessionId: 'ps1',
      providerId: 'prov1',
      title: null,
      state: 'active',
      messageCount: 5,
      lastMessageAt: null,
      contextJson: '{}',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    expect(c.messageCount).toBe(5)
  })

  it('defines MessageRole as union', () => {
    const roles: MessageRole[] = ['user', 'assistant', 'system', 'tool']
    expect(roles).toContain('assistant')
  })

  it('defines ConversationMessage with roles', () => {
    const m: ConversationMessage = {
      id: 'm1',
      conversationId: 'c1',
      role: 'user',
      content: 'hello',
      blocksJson: '[]',
      blockCount: 1,
      parentMessageId: null,
      sequenceIndex: 0,
      latencyMs: null,
      tokenCount: null,
      model: null,
      metadataJson: '{}',
      createdAt: Date.now(),
    }
    expect(m.role).toBe('user')
  })
})

describe('schema/routing', () => {
  it('defines RouteSpec', () => {
    const r: RouteSpec = {
      id: 'rs1',
      name: 'llm-chat',
      criteria: '{}',
      targetProviderIds: ['prov1', 'prov2'],
      strategy: 'latency',
      isActive: true,
    }
    expect(r.name).toBe('llm-chat')
  })

  it('defines RouteEventType', () => {
    const types: RouteEventType[] = ['matched', 'dispatched', 'succeeded', 'failed', 'timeout']
    expect(types).toContain('succeeded')
  })
})

describe('schema/config', () => {
  it('defines ConfigEntry with config types', () => {
    const c: ConfigEntry = {
      id: 'c1',
      engineId: 'governor',
      configKey: 'timeout_ms',
      configValue: '30000',
      configType: 'number',
      isRuntime: true,
    }
    expect(c.configKey).toBe('timeout_ms')
  })
})

describe('schema/versioning', () => {
  it('defines VersionConfig', () => {
    const v: VersionConfig = {
      id: 'v1',
      engineId: 'governor',
      currentVersion: 3,
      minVersion: 1,
      compatMapJson: '{"2":"1","3":"2"}',
    }
    expect(v.currentVersion).toBe(3)
  })

  it('defines ProviderManifestVersion', () => {
    const v: ProviderManifestVersion = {
      id: 'pm1',
      providerId: 'prov1',
      version: 2,
      hash: 'abc123',
      contentJson: '{}',
      changeSummary: 'Added streaming',
      actor: 'seed',
      createdAt: Date.now(),
    }
    expect(v.version).toBe(2)
  })
})

describe('schema/health', () => {
  it('defines ProviderHealthReport', () => {
    const h: ProviderHealthReport = {
      id: 'h1',
      providerId: 'prov1',
      overallStatus: 'healthy',
      overallScore: 0.95,
      signalsJson: '{}',
      ts: Date.now(),
    }
    expect(h.overallStatus).toBe('healthy')
  })
})

describe('schema/telemetry', () => {
  it('defines TelemetryPipelineConfig', () => {
    const t: TelemetryPipelineConfig = {
      id: 't1',
      name: 'health-aggregation',
      engineId: 'health-kernel',
      schedule: '*/5 * * * *',
      retention: '30d',
      isActive: true,
    }
    expect(t.name).toBe('health-aggregation')
  })
})

describe('schema/automation', () => {
  it('defines AlertSeverity', () => {
    const severities: AlertSeverity[] = ['critical', 'warning', 'info']
    expect(severities).toContain('critical')
  })

  it('defines AlertCondition', () => {
    const a: AlertCondition = {
      id: 'a1',
      name: 'high-latency',
      metric: 'p95_latency_ms',
      operator: '>',
      threshold: 5000,
      severity: 'warning',
      isActive: true,
    }
    expect(a.severity).toBe('warning')
  })

  it('defines AutomationSchedule', () => {
    const s: AutomationSchedule = {
      id: 's1',
      name: 'nightly-cache-clear',
      trigger: 'cron',
      action: 'clear_cache',
      isActive: true,
      lastRunAt: null,
    }
    expect(s.trigger).toBe('cron')
  })
})

describe('schema/learning', () => {
  it('defines LearningEvent', () => {
    const e: LearningEvent = {
      id: 'le1',
      providerId: 'prov1',
      capabilityId: 'cap1',
      eventType: 'success',
      contextJson: '{}',
      outcome: 'positive',
      ts: Date.now(),
    }
    expect(e.eventType).toBe('success')
  })
})

describe('schema/transfer', () => {
  it('defines TransferPattern', () => {
    const p: TransferPattern = {
      id: 'tp1',
      sourceProviderId: 'prov1',
      targetProviderId: 'prov2',
      capabilityId: 'cap1',
      mappingJson: '{}',
      confidence: 0.7,
    }
    expect(p.confidence).toBe(0.7)
  })
})

describe('schema/harness', () => {
  it('defines HarnessNode with retry policy', () => {
    const node: HarnessNode = {
      id: 'n1',
      moduleName: 'composer.module',
      input: {},
      dependsOn: [],
      retryPolicy: { maxRetries: 3, backoffMs: 1000 },
      timeoutMs: 30000,
    }
    expect(node.moduleName).toBe('composer.module')
  })

  it('defines HarnessDAG', () => {
    const dag: HarnessDAG = {
      id: 'dag1',
      name: 'send-message',
      nodes: [],
      edges: [],
      timeoutMs: 60000,
    }
    expect(dag.timeoutMs).toBe(60000)
  })
})
