// src/engines/capability-bootstrap.ts
// Registers the default capabilities every vivim instance ships with.
// Called once from createServerWithEngines after the UnifiedCapabilityRegistry is built.

import type { ConversationStore } from '../storage/contracts/conversation-store.js'
import type { CapStoreDb } from '../storage/db.js'
import type { ChromeGovernor } from './chrome-governor.js'
import type { ConversationManager } from './conversation-manager.js'
import type { CrossConversationSynthesizer } from './cross-conversation-synthesis.js'
import type { KnowledgeIngestionEngine } from './knowledge-ingestion.js'
import type { MemoryEngine } from './memory-engine.js'
import type { SemanticSearchEngine } from './semantic-search.js'
import type {
  CapabilitySurface,
  UnifiedCapability,
  UnifiedCapabilityRegistry,
} from './unified-registry.js'
import { DiscoverySessionRunner } from './discovery-session-runner.js'
import { typeMessage, submitMessage, type ComposerType } from './composer-typing.js'
import { buildLocalDiscoveryStack, createPageEvalCapturer } from '../cli/discovery-stack.js'
import type { NLCLEngine } from './nlcl/nlcl-engine.js'
import type { NLCContext } from './nlcl/types.js'

export interface BootstrapServices {
  db: CapStoreDb
  conversationStore: ConversationStore
  governor: ChromeGovernor
  conversationManager: ConversationManager
  memoryEngine?: MemoryEngine
  semanticSearch?: SemanticSearchEngine
  knowledgeIngestion?: KnowledgeIngestionEngine
  synthesizer?: CrossConversationSynthesizer
}

const ALL_SURFACES: CapabilitySurface[] = ['cli', 'ui', 'workflow', 'mcp', 'api']

function makeCapability(
  partial: Omit<
    UnifiedCapability,
    'isAsync' | 'requiresConfirmation' | 'tags' | 'surfaces' | 'handler'
  > & {
    surfaces?: CapabilitySurface[]
  },
  handler: UnifiedCapability['handler'],
): UnifiedCapability {
  return {
    ...partial,
    surfaces: partial.surfaces ?? ALL_SURFACES,
    handler,
    isAsync: true,
    requiresConfirmation: false,
    tags: [],
  }
}

/**
 * Register the default capabilities every vivim instance has.
 * Handlers are Option-A closures over `services`; stubs here return safe defaults
 * and are fleshed out by later phases. Called once after the registry is constructed.
 */
export function registerDefaultCapabilities(
  registry: UnifiedCapabilityRegistry,
  services: BootstrapServices,
): void {
  const defaults: UnifiedCapability[] = [
    // ── Conversation ──────────────────────────────────────────────
    makeCapability(
      {
        id: 'cap:conversation:list',
        slug: 'conversation_list',
        name: 'List Conversations',
        description: 'List conversations, optionally filtered by provider.',
        category: 'conversation',
        inputSchema: { type: 'object', properties: { providerId: { type: 'string' } } },
        outputSchema: { type: 'array' },
        cliCommand: {
          name: 'conversations list',
          aliases: ['cls'],
          examples: ['conversations list --provider=claude'],
        },
        ui: { component: 'conversation-list', position: 'sidebar', order: 1 },
        mcpToolName: 'conversation_list',
        apiEndpoint: { method: 'GET', path: '/api/conversations' },
      },
      async (input) => {
        const providerId = input.providerId ? String(input.providerId) : undefined
        return services.conversationStore.listConversations({ providerId, limit: 100 })
      },
    ),
    makeCapability(
      {
        id: 'cap:conversation:create',
        slug: 'conversation_create',
        name: 'Create Conversation',
        description: 'Create a new conversation for a provider.',
        category: 'conversation',
        inputSchema: {
          type: 'object',
          properties: { providerId: { type: 'string' }, title: { type: 'string' } },
          required: ['providerId'],
        },
        outputSchema: { type: 'object', properties: { id: { type: 'string' } } },
        cliCommand: {
          name: 'conversations create',
          aliases: ['cc'],
          examples: ['conversations create claude'],
        },
        ui: { component: 'action-button', position: 'sidebar', order: 2 },
        mcpToolName: 'conversation_create',
        apiEndpoint: { method: 'POST', path: '/api/conversations' },
      },
      async (input) => {
        const conv = await services.conversationStore.createConversation({
          providerId: String(input.providerId ?? ''),
          title: input.title ? String(input.title) : undefined,
        })
        return { id: conv.id }
      },
    ),
    makeCapability(
      {
        id: 'cap:conversation:send',
        slug: 'conversation_send',
        name: 'Send Message',
        description: 'Send a user message to a conversation and return the assistant response.',
        category: 'conversation',
        inputSchema: {
          type: 'object',
          properties: { conversationId: { type: 'string' }, message: { type: 'string' } },
          required: ['conversationId', 'message'],
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'conversations send',
          aliases: ['cs'],
          examples: ['cs <id> --message "hello"'],
        },
        ui: { component: 'composer', position: 'composer', order: 1 },
        mcpToolName: 'conversation_send',
        apiEndpoint: { method: 'POST', path: '/api/conversations/{id}/send' },
      },
      async (input) => {
        const result = await services.conversationManager.send(
          String(input.conversationId ?? ''),
          String(input.message ?? ''),
        )
        return { ok: result.ok, text: result.text ?? null, error: result.error ?? null }
      },
    ),
    makeCapability(
      {
        id: 'cap:conversation:delete',
        slug: 'conversation_delete',
        name: 'Delete Conversation',
        description: 'Delete a conversation by id.',
        category: 'conversation',
        inputSchema: {
          type: 'object',
          properties: { conversationId: { type: 'string' } },
          required: ['conversationId'],
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'conversations delete',
          aliases: ['cd'],
          examples: ['conversations delete <id>'],
        },
        ui: { component: 'action-button', position: 'sidebar', order: 3 },
        mcpToolName: 'conversation_delete',
        apiEndpoint: { method: 'DELETE', path: '/api/conversations/{id}' },
      },
      async (input) => {
        await services.db.prisma.conversation.delete({ where: { id: String(input.conversationId ?? '') } })
        return { ok: true }
      },
    ),
    makeCapability(
      {
        id: 'cap:knowledge:search',
        slug: 'knowledge_search',
        name: 'Knowledge Search',
        description: 'Semantic search across conversations, facts, and entities.',
        category: 'knowledge',
        inputSchema: { type: 'object', properties: { q: { type: 'string' } }, required: ['q'] },
        outputSchema: { type: 'array' },
        cliCommand: {
          name: 'knowledge search',
          aliases: ['ksearch'],
          examples: ['knowledge search "pricing"'],
        },
        ui: { component: 'knowledge-search', position: 'sidebar', order: 9 },
        mcpToolName: 'knowledge_search',
        apiEndpoint: { method: 'GET', path: '/api/knowledge/search' },
      },
      async () => [],
    ),
    makeCapability(
      {
        id: 'cap:knowledge:ingest',
        slug: 'knowledge_ingest',
        name: 'Ingest Export',
        description: 'Import an external conversation export (ChatGPT/Claude/Gemini JSON).',
        category: 'knowledge',
        inputSchema: {
          type: 'object',
          properties: { source: { type: 'string' }, filePath: { type: 'string' } },
          required: ['source', 'filePath'],
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'knowledge ingest',
          aliases: ['kingest'],
          examples: ['knowledge ingest chatgpt /tmp/export.json'],
        },
        ui: { component: 'action-button', position: 'sidebar', order: 10 },
        mcpToolName: 'knowledge_ingest',
        apiEndpoint: { method: 'POST', path: '/api/knowledge/ingest' },
      },
      async () => ({ jobId: 'pending' }),
    ),
    makeCapability(
      {
        id: 'cap:knowledge:synthesize',
        slug: 'knowledge_synthesize',
        name: 'Synthesize Answer',
        description: 'Synthesize an answer across multiple past conversations.',
        category: 'knowledge',
        inputSchema: {
          type: 'object',
          properties: { question: { type: 'string' } },
          required: ['question'],
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'knowledge synthesize',
          aliases: ['ksynth'],
          examples: ['knowledge synthesize "what did we decide?"'],
        },
        ui: { component: 'action-button', position: 'sidebar', order: 11 },
        mcpToolName: 'knowledge_synthesize',
        apiEndpoint: { method: 'POST', path: '/api/knowledge/synthesize' },
      },
      async () => ({ answer: '', sources: [], confidence: 0 }),
    ),

    // ── Memory ─────────────────────────────────────────────────
    makeCapability(
      {
        id: 'cap:memory:query',
        slug: 'memory_query',
        name: 'Query Memory',
        description: 'Query episodic/semantic/procedural memory.',
        category: 'memory',
        inputSchema: {
          type: 'object',
          properties: { query: { type: 'string' } },
          required: ['query'],
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'memory query',
          aliases: ['mq'],
          examples: ['memory query "last deploy"'],
        },
        ui: { component: 'action-button', position: 'sidebar', order: 12 },
        mcpToolName: 'memory_query',
        apiEndpoint: { method: 'GET', path: '/api/memory/query' },
      },
      async () => ({ results: [] }),
    ),
    makeCapability(
      {
        id: 'cap:memory:assert',
        slug: 'memory_assert',
        name: 'Assert Fact',
        description: 'Assert a semantic fact into memory.',
        category: 'memory',
        inputSchema: {
          type: 'object',
          properties: { fact: { type: 'string' } },
          required: ['fact'],
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'memory assert',
          aliases: ['massert'],
          examples: ['memory assert "deploy on fridays"'],
        },
        ui: { component: 'action-button', position: 'sidebar', order: 13 },
        mcpToolName: 'memory_assert',
        apiEndpoint: { method: 'POST', path: '/api/memory/assert' },
      },
      async () => ({ ok: true }),
    ),
    makeCapability(
      {
        id: 'cap:memory:forget',
        slug: 'memory_forget',
        name: 'Forget Fact',
        description: 'Remove a previously asserted semantic fact from memory.',
        category: 'memory',
        inputSchema: {
          type: 'object',
          properties: { factId: { type: 'string' } },
          required: ['factId'],
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'memory forget',
          aliases: ['mforget'],
          examples: ['memory forget <factId>'],
        },
        ui: { component: 'action-button', position: 'sidebar', order: 14 },
        mcpToolName: 'memory_forget',
        apiEndpoint: { method: 'DELETE', path: '/api/memory/{id}' },
      },
      async () => ({ ok: true }),
    ),

    // ── Admin ──────────────────────────────────────────────────
    makeCapability(
      {
        id: 'cap:admin:seed',
        slug: 'admin_seed',
        name: 'Seed Providers',
        description: 'Re-seed provider manifests from seeds/.',
        category: 'admin',
        inputSchema: { type: 'object' },
        outputSchema: { type: 'object' },
        cliCommand: { name: 'admin seed', aliases: ['aseed'], examples: ['admin seed'] },
        ui: { component: 'action-button', position: 'admin', order: 1 },
        mcpToolName: 'admin_seed',
        apiEndpoint: { method: 'POST', path: '/api/admin/seed' },
      },
      async () => ({ ok: true }),
    ),
    makeCapability(
      {
        id: 'cap:admin:config_get',
        slug: 'config_get',
        name: 'Get Config',
        description: 'Get configuration for an engine.',
        category: 'admin',
        inputSchema: { type: 'object', properties: { engine: { type: 'string' } } },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'admin config get',
          aliases: ['acget'],
          examples: ['admin config get governor'],
        },
        ui: { component: 'action-button', position: 'admin', order: 2 },
        mcpToolName: 'config_get',
        apiEndpoint: { method: 'GET', path: '/api/admin/config/{engine}' },
      },
      async (input) => {
        const engine = String(input.engine ?? '')
        const config = await services.db.getConfig(engine)
        return { engine, config: config ?? {} }
      },
    ),
    makeCapability(
      {
        id: 'cap:admin:config_set',
        slug: 'config_set',
        name: 'Set Config',
        description: 'Update configuration for an engine.',
        category: 'admin',
        inputSchema: {
          type: 'object',
          properties: { engine: { type: 'string' }, patch: { type: 'object' } },
          required: ['engine', 'patch'],
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'admin config set',
          aliases: ['acset'],
          examples: ['admin config set governor --patch {...}'],
        },
        ui: { component: 'action-button', position: 'admin', order: 3 },
        mcpToolName: 'config_set',
        apiEndpoint: { method: 'POST', path: '/api/admin/config/{engine}' },
      },
      async (input) => {
        const engine = String(input.engine ?? '')
        const patch = (input.patch ?? {}) as Record<string, unknown>
        await services.db.prisma.configEntry.upsert({
          where: { engineId: engine },
          create: { engineId: engine, configJson: patch as object },
          update: { configJson: patch as object },
        })
        return { ok: true, engine, config: patch }
      },
    ),
    makeCapability(
      {
        id: 'cap:system:health',
        slug: 'system_health',
        name: 'System Health',
        description: 'Return liveness + readiness.',
        category: 'system',
        inputSchema: { type: 'object' },
        outputSchema: { type: 'object' },
        cliCommand: { name: 'system health', aliases: ['shealth'], examples: ['system health'] },
        ui: { component: 'system-health', position: 'admin', order: 4 },
        mcpToolName: 'system_health',
        apiEndpoint: { method: 'GET', path: '/api/health' },
      },
      async () => ({ status: 'ok', ts: Date.now() }),
    ),
    makeCapability(
      {
        id: 'cap:system:version',
        slug: 'system_version',
        name: 'System Version',
        description: 'Return the running vivim version.',
        category: 'system',
        inputSchema: { type: 'object' },
        outputSchema: { type: 'object' },
        cliCommand: { name: 'system version', aliases: ['sver'], examples: ['system version'] },
        ui: { component: 'system-version', position: 'admin', order: 5 },
        mcpToolName: 'system_version',
        apiEndpoint: { method: 'GET', path: '/api/version' },
      },
      async () => ({ version: '1.0.0' }),
    ),

    // ── Health (24.4) ───────────────────────────────────────────
    makeCapability(
      {
        id: 'cap:provider:health_get',
        slug: 'provider_health_get',
        name: 'Get Provider Health',
        description: 'Return fleet health snapshot for all running slaves.',
        category: 'provider',
        inputSchema: { type: 'object' },
        outputSchema: { type: 'array' },
        cliCommand: { name: 'health', aliases: ['h'], examples: ['health'] },
        ui: { component: 'system-health', position: 'admin', order: 6 },
        mcpToolName: 'provider_health_get',
        apiEndpoint: { method: 'GET', path: '/api/telemetry/health' },
      },
      async () => {
        const health = await services.governor.getAllHealth()
        return Array.from(health.entries()).map(([slaveId, h]) => ({ slaveId, ...h }))
      },
    ),

    // ── Config history (24.4) ───────────────────────────────────
    makeCapability(
      {
        id: 'cap:admin:config_history',
        slug: 'config_history',
        name: 'Config History',
        description: 'Show config change history for an engine.',
        category: 'admin',
        inputSchema: { type: 'object', properties: { engine: { type: 'string' } }, required: ['engine'] },
        outputSchema: { type: 'array' },
        cliCommand: { name: 'config history', aliases: ['chist'], examples: ['config history governor'] },
        ui: { component: 'action-button', position: 'admin', order: 4 },
        mcpToolName: 'config_history',
        apiEndpoint: { method: 'GET', path: '/api/admin/config/{engine}/history' },
      },
      async (input) => {
        const engine = String(input.engine ?? '')
        const entry = await services.db.prisma.configEntry.findUnique({ where: { engineId: engine } })
        return entry ? [{ engineId: engine, configJson: entry.configJson }] : []
      },
    ),

    // ── Admin audit (24.4) ──────────────────────────────────────
    makeCapability(
      {
        id: 'cap:admin:audit',
        slug: 'admin_audit',
        name: 'Audit Provider',
        description: 'Run a drift/audit check against a provider (kernel oracle).',
        category: 'admin',
        inputSchema: { type: 'object', properties: { providerId: { type: 'string' } }, required: ['providerId'] },
        outputSchema: { type: 'object' },
        cliCommand: { name: 'admin audit', aliases: ['aaud'], examples: ['admin audit claude'] },
        ui: { component: 'action-button', position: 'admin', order: 5 },
        mcpToolName: 'admin_audit',
        apiEndpoint: { method: 'GET', path: '/api/admin/audit/{providerId}' },
      },
      async (input) => {
        return { providerId: String(input.providerId), note: 'audit requires kernel oracle — run via /api/capabilities/oracle_* once kernel caps are wired' }
      },
    ),

    // ── Admin drift (24.4) ──────────────────────────────────────
    makeCapability(
      {
        id: 'cap:admin:drift',
        slug: 'admin_drift',
        name: 'Config Drift',
        description: 'Report config drift across the system (kernel oracle).',
        category: 'admin',
        inputSchema: { type: 'object', properties: { providerId: { type: 'string' } } },
        outputSchema: { type: 'object' },
        cliCommand: { name: 'admin drift', aliases: ['adri'], examples: ['admin drift'] },
        ui: { component: 'action-button', position: 'admin', order: 6 },
        mcpToolName: 'admin_drift',
        apiEndpoint: { method: 'GET', path: '/api/admin/drift' },
      },
      async (input) => {
        const providerId = input.providerId ? String(input.providerId) : undefined
        return { providerId, note: 'drift requires kernel oracle — run via /api/capabilities/oracle_* once kernel caps are wired' }
      },
    ),

    // ── Telemetry (24.4) ────────────────────────────────────────
    makeCapability(
      {
        id: 'cap:telemetry:summary',
        slug: 'telemetry_summary',
        name: 'Telemetry Summary',
        description: 'Aggregate telemetry summary for a provider over a date range.',
        category: 'telemetry',
        inputSchema: {
          type: 'object',
          properties: { providerId: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' } },
          required: ['providerId', 'from', 'to'],
        },
        outputSchema: { type: 'object' },
        cliCommand: { name: 'telemetry summary', aliases: ['tsum'], examples: ['telemetry summary claude --from 2024-01-01 --to 2024-01-31'] },
        ui: { component: 'action-button', position: 'admin', order: 7 },
        mcpToolName: 'telemetry_summary',
        apiEndpoint: { method: 'GET', path: '/api/telemetry/{providerId}/summary' },
      },
      async (input) => {
        return { providerId: String(input.providerId), from: String(input.from), to: String(input.to), note: 'telemetry aggregation pending — wire TelemetryEngine store' }
      },
    ),
    makeCapability(
      {
        id: 'cap:telemetry:compare',
        slug: 'telemetry_compare',
        name: 'Telemetry Compare',
        description: 'Compare telemetry across two date ranges.',
        category: 'telemetry',
        inputSchema: {
          type: 'object',
          properties: { from: { type: 'string' }, to: { type: 'string' } },
          required: ['from', 'to'],
        },
        outputSchema: { type: 'object' },
        cliCommand: { name: 'telemetry compare', aliases: ['tcmp'], examples: ['telemetry compare --from 2024-01-01 --to 2024-01-31'] },
        ui: { component: 'action-button', position: 'admin', order: 8 },
        mcpToolName: 'telemetry_compare',
        apiEndpoint: { method: 'GET', path: '/api/telemetry/compare' },
      },
      async (input) => {
        return { from: String(input.from), to: String(input.to), note: 'telemetry aggregation pending — wire TelemetryEngine store' }
      },
    ),
  ]

  for (const cap of defaults) {
    registry.register(cap)
  }
}

/**
 * Unit 24.7 — register NLCL itself as a capability so the universal execute
 * route can drive natural-language resolution. Called from createServerWithEngines
 * after the NLCLEngine is constructed (it closes over `nlclEngine`).
 */
export function registerNlInterpretCapability(
  registry: UnifiedCapabilityRegistry,
  nlclEngine: NLCLEngine,
): void {
  const handler: UnifiedCapability['handler'] = async (input, capCtx) => {
    const text = String(input.text ?? '')
    const extra = input.ctx && typeof input.ctx === 'object' ? (input.ctx as Record<string, unknown>) : {}
    const nlCtx: NLCContext = {
      surface: 'api',
      providerId: (extra.providerId as string | undefined) ?? capCtx.providerId,
      accountId: extra.accountId as string | undefined,
      conversationId: (extra.conversationId as string | undefined) ?? capCtx.conversationId,
      slaveId: (extra.slaveId as string | undefined) ?? capCtx.slaveId,
      userId: (extra.userId as string | undefined) ?? capCtx.userId,
      metadata: { ...(extra.metadata as Record<string, unknown>), ...capCtx.metadata },
    }
    return nlclEngine.interpret(text, nlCtx)
  }

  registry.register(
    makeCapability(
      {
        id: 'cap:nlcl:interpret',
        slug: 'nl_interpret',
        name: 'Interpret Natural Language',
        description: 'Resolve natural language to a capability chain (self-referential NL parsing).',
        category: 'nlcl',
        inputSchema: {
          type: 'object',
          properties: { text: { type: 'string' }, ctx: { type: 'object' } },
          required: ['text'],
        },
        outputSchema: { type: 'object' },
        cliCommand: { name: 'nl', aliases: ['interpret'], examples: ['nl "list providers"'] },
        ui: { component: 'composer', position: 'composer', order: 0 },
        mcpToolName: 'nl_interpret',
        apiEndpoint: { method: 'POST', path: '/api/interpret' },
      },
      handler,
    ),
  )
}

/**
 * Unit 24.5 — fold kernel/oracle CLI commands into capabilities.
 * Called from createServerWithEngines after bootstrapKernel + kernel.start()
 * (when `kernel.context().oracle` is non-null).
 */
export function registerKernelCapabilities(
  registry: UnifiedCapabilityRegistry,
  kernel: import('./kernel/kernel-context.js').Kernel,
): void {
  const ctx = kernel.context()
  const oracle = ctx.oracle

  const readSurfaces: import('./unified-registry.js').CapabilitySurface[] = ['cli', 'ui', 'api']
  const writeSurfaces: import('./unified-registry.js').CapabilitySurface[] = ['cli', 'api']

  registry.register(
    makeCapability(
      {
        id: 'cap:oracle:query',
        slug: 'oracle_query',
        name: 'Oracle Query',
        description: 'Query the kernel oracle (health, topology, capability, config, all).',
        category: 'kernel',
        inputSchema: {
          type: 'object',
          properties: {
            op: { type: 'string', enum: ['health', 'topology', 'capability', 'config', 'all'] },
            filter: { type: 'object' },
            limit: { type: 'number' },
          },
        },
        outputSchema: { type: 'object' },
        cliCommand: { name: 'kernel oracle query', aliases: ['koq'], examples: ['kernel oracle query --op health'] },
        ui: { component: 'action-button', position: 'admin', order: 9 },
        mcpToolName: 'oracle_query',
        apiEndpoint: { method: 'POST', path: '/api/oracle/query' },
        surfaces: readSurfaces,
      },
      async (input) => {
        if (!oracle) return { error: 'Oracle not available' }
        return oracle.query.query({
          type: (String(input.op ?? 'all') as never),
          filter: input.filter as Record<string, unknown> | undefined,
          limit: input.limit as number | undefined,
        })
      },
    ),
  )

  registry.register(
    makeCapability(
      {
        id: 'cap:oracle:heal',
        slug: 'oracle_heal',
        name: 'Oracle Heal',
        description: 'Trigger oracle self-healing for an issue.',
        category: 'kernel',
        inputSchema: { type: 'object', properties: { issueId: { type: 'string' } }, required: ['issueId'] },
        outputSchema: { type: 'object' },
        cliCommand: { name: 'kernel oracle heal', aliases: ['koh'], examples: ['kernel oracle heal --issueId issue:123'] },
        ui: { component: 'action-button', position: 'admin', order: 10 },
        mcpToolName: 'oracle_heal',
        apiEndpoint: { method: 'POST', path: '/api/oracle/heal' },
        surfaces: writeSurfaces,
      },
      async (input) => {
        if (!oracle) return { error: 'Actuator not available' }
        return oracle.actuator.heal(String(input.issueId ?? ''))
      },
    ),
  )

  registry.register(
    makeCapability(
      {
        id: 'cap:oracle:scan',
        slug: 'oracle_scan',
        name: 'Oracle Scan',
        description: 'Scan the system for issues.',
        category: 'kernel',
        inputSchema: { type: 'object' },
        outputSchema: { type: 'array' },
        cliCommand: { name: 'kernel oracle scan', aliases: ['kos'], examples: ['kernel oracle scan'] },
        ui: { component: 'action-button', position: 'admin', order: 11 },
        mcpToolName: 'oracle_scan',
        apiEndpoint: { method: 'POST', path: '/api/oracle/scan' },
        surfaces: readSurfaces,
      },
      async () => {
        if (!oracle) return { error: 'Diagnostic not available' }
        return oracle.diagnostic.scan()
      },
    ),
  )

  registry.register(
    makeCapability(
      {
        id: 'cap:oracle:events',
        slug: 'oracle_events',
        name: 'Oracle Events',
        description: 'Get recent oracle events.',
        category: 'kernel',
        inputSchema: { type: 'object', properties: { tail: { type: 'number' } } },
        outputSchema: { type: 'array' },
        cliCommand: { name: 'kernel oracle events', aliases: ['koe'], examples: ['kernel oracle events --tail 10'] },
        ui: { component: 'action-button', position: 'admin', order: 12 },
        mcpToolName: 'oracle_events',
        apiEndpoint: { method: 'POST', path: '/api/oracle/events' },
        surfaces: readSurfaces,
      },
      async (input) => {
        if (!oracle) return { error: 'Events not available' }
        return oracle.events.getRecentEvents(Number(input.tail ?? 50))
      },
    ),
  )

  registry.register(
    makeCapability(
      {
        id: 'cap:oracle:visibility',
        slug: 'oracle_visibility',
        name: 'Oracle Visibility',
        description: 'Get oracle visibility snapshot.',
        category: 'kernel',
        inputSchema: { type: 'object' },
        outputSchema: { type: 'object' },
        cliCommand: { name: 'kernel oracle visibility', aliases: ['kov'], examples: ['kernel oracle visibility'] },
        ui: { component: 'action-button', position: 'admin', order: 13 },
        mcpToolName: 'oracle_visibility',
        apiEndpoint: { method: 'POST', path: '/api/oracle/visibility' },
        surfaces: readSurfaces,
      },
      async () => {
        if (!oracle) return { error: 'Query not available' }
        return oracle.query.query({ type: 'all' as never })
      },
    ),
  )

  registry.register(
    makeCapability(
      {
        id: 'cap:oracle:manifest',
        slug: 'oracle_manifest',
        name: 'Oracle Manifest',
        description: 'Get canvas manifest from oracle.',
        category: 'kernel',
        inputSchema: { type: 'object' },
        outputSchema: { type: 'object' },
        cliCommand: { name: 'kernel oracle manifest', aliases: ['kom'], examples: ['kernel oracle manifest'] },
        ui: { component: 'action-button', position: 'admin', order: 14 },
        mcpToolName: 'oracle_manifest',
        apiEndpoint: { method: 'POST', path: '/api/oracle/manifest' },
        surfaces: readSurfaces,
      },
      async () => ({ manifest: ctx.registry.describe() }),
    ),
  )
}

/**
 * Unit 24.6 — fold discovery CLI commands into capabilities so the frontend can
 * drive discovery too. Handlers build the local discovery stack server-side via
 * buildLocalDiscoveryStack (which uses getDb() internally).
 */
export function registerDiscoveryCapabilities(registry: UnifiedCapabilityRegistry): void {
  const readSurfaces: CapabilitySurface[] = ['cli', 'ui', 'api']
  const devSurfaces: CapabilitySurface[] = ['cli', 'api']

  registry.register(
    makeCapability(
      {
        id: 'cap:discovery:run',
        slug: 'discovery_run',
        name: 'Discovery Run',
        description: 'Run a logged-in provider discovery session end-to-end.',
        category: 'discovery',
        inputSchema: {
          type: 'object',
          properties: {
            providerId: { type: 'string' },
            accountId: { type: 'string' },
            url: { type: 'string' },
            profileDir: { type: 'string' },
            probeMessage: { type: 'string' },
            composerSelector: { type: 'string' },
            composerType: { type: 'string' },
            sendSelector: { type: 'string' },
            timeoutMs: { type: 'number' },
          },
          required: ['providerId', 'url'],
        },
        outputSchema: { type: 'object' },
        cliCommand: { name: 'discovery run', aliases: ['drun'], examples: ['discovery run claude --url https://claude.ai'] },
        ui: { component: 'action-button', position: 'admin', order: 15 },
        mcpToolName: 'discovery_run',
        apiEndpoint: { method: 'POST', path: '/api/discovery/run' },
        surfaces: readSurfaces,
      },
      async (input) => {
        const stack = await buildLocalDiscoveryStack({ profileBaseDir: undefined })
        const runner = new DiscoverySessionRunner({
          governor: stack.governor,
          discovery: stack.discovery,
          streamParser: stack.streamParser,
          align: stack.align,
          captureStream: stack.captureStream,
        })
        const { session, alignment } = await runner.runSession({
          providerId: String(input.providerId),
          accountId: input.accountId ? String(input.accountId) : 'default',
          url: String(input.url),
          profileDir: input.profileDir ? String(input.profileDir) : undefined,
          probeMessage: input.probeMessage ? String(input.probeMessage) : undefined,
          composerSelector: input.composerSelector ? String(input.composerSelector) : undefined,
          composerType: (input.composerType as ComposerType | undefined) ?? 'textarea',
          sendSelector: input.sendSelector ? String(input.sendSelector) : undefined,
          timeoutMs: input.timeoutMs ? Number(input.timeoutMs) : 20_000,
        })
        return {
          sessionId: session.id,
          url: session.url,
          shapeId: session.shapeId,
          confidence: session.confidence,
          detectedCapabilities: session.detectedCapabilities,
          alignment: {
            inferredFormat: alignment.inferredFormat,
            parserName: alignment.parserName,
            confidence: alignment.confidence,
            ok: alignment.ok,
          },
          manifestDraft: session.manifestDraft,
        }
      },
    ),
  )

  registry.register(
    makeCapability(
      {
        id: 'cap:discovery:interact',
        slug: 'discovery_interact',
        name: 'Discovery Interact',
        description: 'Interact with a provider in a discovery session.',
        category: 'discovery',
        inputSchema: {
          type: 'object',
          properties: {
            providerId: { type: 'string' },
            accountId: { type: 'string' },
            url: { type: 'string' },
            message: { type: 'string' },
            profileDir: { type: 'string' },
            composer: { type: 'string' },
            send: { type: 'string' },
            timeoutMs: { type: 'number' },
          },
          required: ['providerId'],
        },
        outputSchema: { type: 'object' },
        cliCommand: { name: 'discovery interact', aliases: ['dint'], examples: ['discovery interact chatgpt --message "hello"'] },
        ui: { component: 'action-button', position: 'admin', order: 16 },
        mcpToolName: 'discovery_interact',
        apiEndpoint: { method: 'POST', path: '/api/discovery/interact' },
        surfaces: readSurfaces,
      },
      async (input) => {
        const slug = String(input.providerId)
        const message = input.message ? String(input.message) : 'Hello'
        const url = input.url ? String(input.url) : `https://${slug}.ai`
        const stack = await buildLocalDiscoveryStack()
        const slave = await stack.governor.ensureRunningForAccount(slug, input.accountId ? String(input.accountId) : 'default', {
          profileDir: input.profileDir ? String(input.profileDir) : undefined,
        })
        const capturer = createPageEvalCapturer(stack.governor)
        const session = await stack.discovery.createSession(url, { providerNameHint: slug })
        await stack.governor.cdp.send(slave.slaveId, 'Page.navigate', { url })
        const composer = input.composer ? String(input.composer) : 'textarea, [role="textbox"], [contenteditable]'
        const timeoutMs = Number(input.timeoutMs ?? 20_000)
        await capturer.arm(slave.slaveId, { urlPattern: new URL(url).hostname, timeoutMs })
        await typeMessage(stack.governor.cdp, slave.slaveId, composer, message, 'textarea')
        await submitMessage(stack.governor.cdp, slave.slaveId, input.send ? String(input.send) : undefined)
        const bodies = await capturer.collect(slave.slaveId, { urlPattern: new URL(url).hostname, timeoutMs })
        return { sessionId: session.id, capturedSamples: bodies.length, raw: bodies }
      },
    ),
  )

  registry.register(
    makeCapability(
      {
        id: 'cap:discovery:align',
        slug: 'discovery_align',
        name: 'Discovery Align',
        description: 'Align captured stream bodies against the DB parser.',
        category: 'discovery',
        inputSchema: {
          type: 'object',
          properties: { provider: { type: 'string' }, slug: { type: 'string' }, file: { type: 'string' }, format: { type: 'string' } },
          required: ['provider', 'file'],
        },
        outputSchema: { type: 'object' },
        cliCommand: { name: 'discovery align', aliases: ['dali'], examples: ['discovery align claude --file captured.txt'] },
        ui: { component: 'action-button', position: 'admin', order: 17 },
        mcpToolName: 'discovery_align',
        apiEndpoint: { method: 'POST', path: '/api/discovery/align' },
        surfaces: devSurfaces,
      },
      async (input) => {
        const slug = String(input.provider ?? input.slug ?? '')
        const text = await Bun.file(String(input.file)).text()
        const bodies = text.split(/\n\n+/).map((b) => b.trim()).filter(Boolean)
        const stack = await buildLocalDiscoveryStack()
        const configured = input.format ? (String(input.format) as never) : null
        return stack.align.alignCaptured(bodies, slug, configured)
      },
    ),
  )

  registry.register(
    makeCapability(
      {
        id: 'cap:discovery:list',
        slug: 'discovery_list',
        name: 'Discovery List',
        description: 'List discovery sessions.',
        category: 'discovery',
        inputSchema: { type: 'object', properties: { limit: { type: 'number' } } },
        outputSchema: { type: 'array' },
        cliCommand: { name: 'discovery list', aliases: ['dls'], examples: ['discovery list'] },
        ui: { component: 'action-button', position: 'admin', order: 18 },
        mcpToolName: 'discovery_list',
        apiEndpoint: { method: 'POST', path: '/api/discovery/list' },
        surfaces: readSurfaces,
      },
      async (input) => {
        const stack = await buildLocalDiscoveryStack()
        const sessions = await stack.discovery.listSessions({ limit: Number(input.limit ?? 50) })
        return sessions.map((s) => ({ id: s.id, url: s.url, status: s.status, shapeId: s.shapeId, confidence: s.confidence }))
      },
    ),
  )

  registry.register(
    makeCapability(
      {
        id: 'cap:discovery:show',
        slug: 'discovery_show',
        name: 'Discovery Show',
        description: 'Show a discovery session.',
        category: 'discovery',
        inputSchema: { type: 'object', properties: { sessionId: { type: 'string' } }, required: ['sessionId'] },
        outputSchema: { type: 'object' },
        cliCommand: { name: 'discovery show', aliases: ['dsh'], examples: ['discovery show <id>'] },
        ui: { component: 'action-button', position: 'admin', order: 19 },
        mcpToolName: 'discovery_show',
        apiEndpoint: { method: 'POST', path: '/api/discovery/show' },
        surfaces: readSurfaces,
      },
      async (input) => {
        const stack = await buildLocalDiscoveryStack()
        return stack.discovery.getSession(String(input.sessionId ?? '')) ?? { error: 'not found' }
      },
    ),
  )

  registry.register(
    makeCapability(
      {
        id: 'cap:discovery:manifest',
        slug: 'discovery_manifest',
        name: 'Discovery Manifest',
        description: 'Show the manifest draft for a discovery session.',
        category: 'discovery',
        inputSchema: { type: 'object', properties: { sessionId: { type: 'string' } }, required: ['sessionId'] },
        outputSchema: { type: 'object' },
        cliCommand: { name: 'discovery manifest', aliases: ['dman'], examples: ['discovery manifest <id>'] },
        ui: { component: 'action-button', position: 'admin', order: 20 },
        mcpToolName: 'discovery_manifest',
        apiEndpoint: { method: 'POST', path: '/api/discovery/manifest' },
        surfaces: readSurfaces,
      },
      async (input) => {
        const stack = await buildLocalDiscoveryStack()
        const session = await stack.discovery.getSession(String(input.sessionId ?? ''))
        return session?.manifestDraft ?? { error: 'no manifest draft' }
      },
    ),
  )
}
