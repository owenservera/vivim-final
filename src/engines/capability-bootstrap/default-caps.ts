import type { OpenCodeClient } from '../opencode/opencode-client.js'
import type { OpenCodeIngest } from '../opencode/opencode-ingest.js'
import type { OpenCodeSupervisor } from '../opencode/opencode-supervisor.js'
import type { UnifiedCapability } from '../unified-registry.js'
import { type BootstrapServices, makeCapability } from './types.js'

function getOpenCodeServe():
  | { client: OpenCodeClient; ingest: OpenCodeIngest; supervisor: OpenCodeSupervisor }
  | undefined {
  return (globalThis as Record<string, unknown>).__opencodeServe as
    | { client: OpenCodeClient; ingest: OpenCodeIngest; supervisor: OpenCodeSupervisor }
    | undefined
}

function getAiGateway(): import('../../ai/gateway/gateway.js').IVIVIMGateway | undefined {
  return (globalThis as Record<string, unknown>).__aiGateway as
    | import('../../ai/gateway/gateway.js').IVIVIMGateway
    | undefined
}

export function buildConversationCaps(services: BootstrapServices): UnifiedCapability[] {
  return [
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
          providerSessionId: String(input.providerId ?? ''),
          providerId: String(input.providerId ?? ''),
          title: input.title ? String(input.title) : null,
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
        const id = String(input.conversationId ?? '')
        if (!id) return { ok: false, error: 'conversationId is required' }
        try {
          await services.db.prisma.conversation.delete({ where: { id } })
          return { ok: true }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          if (
            msg.includes('No record was found') ||
            msg.includes('Record to delete does not exist')
          ) {
            return { ok: false, error: 'Conversation not found' }
          }
          throw err
        }
      },
    ),
  ]
}

export function buildKnowledgeCaps(_services: BootstrapServices): UnifiedCapability[] {
  return [
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
  ]
}

export function buildMemoryCaps(services: BootstrapServices): UnifiedCapability[] {
  return [
    makeCapability(
      {
        id: 'cap:memory:query',
        slug: 'memory_query',
        name: 'Query Memory',
        description: 'Semantic query over episodic/semantic/procedural memory.',
        category: 'memory',
        inputSchema: {
          type: 'object',
          properties: { query: { type: 'string' }, k: { type: 'number' } },
          required: ['query'],
        },
        outputSchema: { type: 'array' },
        cliCommand: {
          name: 'memory query',
          aliases: ['mq'],
          examples: ['memory query "last deploy"'],
        },
        ui: { component: 'action-button', position: 'sidebar', order: 12 },
        mcpToolName: 'memory_query',
        apiEndpoint: { method: 'GET', path: '/api/memory/query' },
      },
      async (input) => {
        if (!services.semanticSearch) return { results: [], error: 'Semantic search not available' }
        const hits = await services.semanticSearch.search({
          text: String(input.query),
          limit: Number(input.k ?? 8),
        })
        return { results: hits }
      },
    ),
    makeCapability(
      {
        id: 'cap:memory:assert',
        slug: 'memory_assert',
        name: 'Assert Fact',
        description: 'Assert a subject-predicate-object fact immediately.',
        category: 'memory',
        inputSchema: {
          type: 'object',
          properties: {
            subject: { type: 'string' },
            predicate: { type: 'string' },
            object: { type: 'string' },
            confidence: { type: 'number' },
          },
          required: ['subject', 'predicate', 'object'],
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'memory assert',
          aliases: ['massert'],
          examples: ['memory assert "deploy on fridays"'],
        },
        ui: { component: 'action-button', position: 'sidebar', order: 13 },
        mcpToolName: 'memory_assert',
        apiEndpoint: { method: 'POST', path: '/api/memory/facts' },
      },
      async (input) => {
        if (!services.memoryEngine) return { ok: false, error: 'Memory engine not available' }
        await services.memoryEngine.assertFact({
          subject: String(input.subject),
          predicate: String(input.predicate),
          object: String(input.object),
          confidence: Number(input.confidence ?? 0.6),
          source: 'agent',
        })
        return { ok: true }
      },
    ),
    makeCapability(
      {
        id: 'cap:memory:remember',
        slug: 'memory_remember',
        name: 'Remember Episode',
        description: 'Record an episodic memory.',
        category: 'memory',
        inputSchema: {
          type: 'object',
          properties: { content: { type: 'string' }, topic: { type: 'string' } },
          required: ['content'],
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'memory remember',
          aliases: ['mremember'],
          examples: ['memory remember "deployed v2.1 to prod"'],
        },
        ui: { component: 'action-button', position: 'sidebar', order: 15 },
        mcpToolName: 'memory_remember',
        apiEndpoint: { method: 'POST', path: '/api/memory/episodes' },
      },
      async (input) => {
        if (!services.memoryEngine) return { ok: false, error: 'Memory engine not available' }
        const id = await services.memoryEngine.recordMemory({
          content: String(input.content),
          memoryType: 'episodic',
          category: (input.topic as string) ?? 'general',
          tags: input.topic ? [String(input.topic)] : [],
        })
        return { ok: true, id }
      },
    ),
    makeCapability(
      {
        id: 'cap:memory:forget',
        slug: 'memory_forget',
        name: 'Forget Fact',
        description: 'Deprecate a fact by id (not hard delete).',
        category: 'memory',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'memory forget',
          aliases: ['mforget'],
          examples: ['memory forget <factId>'],
        },
        ui: { component: 'action-button', position: 'sidebar', order: 14 },
        mcpToolName: 'memory_forget',
        apiEndpoint: { method: 'DELETE', path: '/api/memory/facts/{id}' },
      },
      async (input) => {
        if (!services.memoryEngine) return { ok: false, error: 'Memory engine not available' }
        await services.memoryEngine.forgetFact(String(input.id))
        return { ok: true }
      },
    ),
  ]
}

export function buildAdminCaps(services: BootstrapServices): UnifiedCapability[] {
  return [
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
          where: {
            engineId_scopeType_scopeId: { engineId: engine, scopeType: 'engine', scopeId: '' },
          },
          create: {
            id: `cfg:${engine}`,
            engineId: engine,
            scopeType: 'engine',
            scopeId: '',
            configJson: JSON.stringify(patch),
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
          update: { configJson: JSON.stringify(patch) },
        })
        return { ok: true, engine, config: patch }
      },
    ),
    makeCapability(
      {
        id: 'cap:admin:config_history',
        slug: 'config_history',
        name: 'Config History',
        description: 'Show config change history for an engine.',
        category: 'admin',
        inputSchema: {
          type: 'object',
          properties: { engine: { type: 'string' } },
          required: ['engine'],
        },
        outputSchema: { type: 'array' },
        cliCommand: {
          name: 'config history',
          aliases: ['chist'],
          examples: ['config history governor'],
        },
        ui: { component: 'action-button', position: 'admin', order: 4 },
        mcpToolName: 'config_history',
        apiEndpoint: { method: 'GET', path: '/api/admin/config/{engine}/history' },
      },
      async (input) => {
        const engine = String(input.engine ?? '')
        const entry = await services.db.prisma.configEntry.findUnique({
          where: {
            engineId_scopeType_scopeId: { engineId: engine, scopeType: 'engine', scopeId: '' },
          },
        })
        return entry ? [{ engineId: engine, configJson: entry.configJson }] : []
      },
    ),
    makeCapability(
      {
        id: 'cap:admin:audit',
        slug: 'admin_audit',
        name: 'Audit Provider',
        description: 'Run a drift/audit check against a provider (kernel oracle).',
        category: 'admin',
        inputSchema: {
          type: 'object',
          properties: { providerId: { type: 'string' } },
          required: ['providerId'],
        },
        outputSchema: { type: 'object' },
        cliCommand: { name: 'admin audit', aliases: ['aaud'], examples: ['admin audit claude'] },
        ui: { component: 'action-button', position: 'admin', order: 5 },
        mcpToolName: 'admin_audit',
        apiEndpoint: { method: 'GET', path: '/api/admin/audit/{providerId}' },
      },
      async (input) => {
        return {
          providerId: String(input.providerId),
          note: 'audit requires kernel oracle — run via /api/capabilities/oracle_* once kernel caps are wired',
        }
      },
    ),
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
        return {
          providerId,
          note: 'drift requires kernel oracle — run via /api/capabilities/oracle_* once kernel caps are wired',
        }
      },
    ),
  ]
}

export function buildSystemCaps(_services: BootstrapServices): UnifiedCapability[] {
  return [
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
  ]
}

export function buildProviderHealthCaps(services: BootstrapServices): UnifiedCapability[] {
  return [
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
        return Array.from(health.entries()).map(([slaveId, h]) => ({ ...h, slaveId }))
      },
    ),
  ]
}

export function buildTelemetryCaps(_services: BootstrapServices): UnifiedCapability[] {
  return [
    makeCapability(
      {
        id: 'cap:telemetry:summary',
        slug: 'telemetry_summary',
        name: 'Telemetry Summary',
        description: 'Aggregate telemetry summary for a provider over a date range.',
        category: 'telemetry',
        inputSchema: {
          type: 'object',
          properties: {
            providerId: { type: 'string' },
            from: { type: 'string' },
            to: { type: 'string' },
          },
          required: ['providerId', 'from', 'to'],
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'telemetry summary',
          aliases: ['tsum'],
          examples: ['telemetry summary claude --from 2024-01-01 --to 2024-01-31'],
        },
        ui: { component: 'action-button', position: 'admin', order: 7 },
        mcpToolName: 'telemetry_summary',
        apiEndpoint: { method: 'GET', path: '/api/telemetry/{providerId}/summary' },
      },
      async (input) => {
        return {
          providerId: String(input.providerId),
          from: String(input.from),
          to: String(input.to),
          note: 'telemetry aggregation pending — wire TelemetryEngine store',
        }
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
        cliCommand: {
          name: 'telemetry compare',
          aliases: ['tcmp'],
          examples: ['telemetry compare --from 2024-01-01 --to 2024-01-31'],
        },
        ui: { component: 'action-button', position: 'admin', order: 8 },
        mcpToolName: 'telemetry_compare',
        apiEndpoint: { method: 'GET', path: '/api/telemetry/compare' },
      },
      async (input) => {
        return {
          from: String(input.from),
          to: String(input.to),
          note: 'telemetry aggregation pending — wire TelemetryEngine store',
        }
      },
    ),
  ]
}

export function buildAgentCaps(services: BootstrapServices): UnifiedCapability[] {
  if (!services.localAgentExecutor) return []
  return [
    makeCapability(
      {
        id: 'cap:agent:run',
        slug: 'agent_run',
        name: 'Run Local Agent Task',
        description:
          'Run a one-shot agentic task via the opencode CLI with a verified free model. No API key required.',
        category: 'agent',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: { type: 'string' },
            model: { type: 'string' },
            sessionId: { type: 'string' },
            cwd: { type: 'string' },
          },
          required: ['prompt'],
        },
        outputSchema: { type: 'object', properties: { blocks: { type: 'array' } } },
        cliCommand: {
          name: 'agent run',
          aliases: ['ar'],
          examples: ['agent run "summarize this repo" --model opencode/deepseek-v4-flash-free'],
        },
        ui: { component: 'text_input', position: 'composer', order: 1 },
        mcpToolName: 'agent_run',
        apiEndpoint: { method: 'POST', path: '/api/agent/run' },
      },
      async (input) => {
        if (typeof input.prompt !== 'string' || input.prompt.trim().length === 0) {
          return { ok: false, error: 'prompt is required' }
        }
        const result = await services.localAgentExecutor?.run({
          prompt: String(input.prompt),
          model: input.model ? String(input.model) : undefined,
          sessionId: input.sessionId ? String(input.sessionId) : undefined,
          cwd: input.cwd ? String(input.cwd) : undefined,
        })
        if (!result) {
          return { ok: false, error: 'local agent executor returned no result' }
        }
        return {
          ok: result.exitCode === 0 && !result.timedOut && !result.permissionDenied,
          error: result.permissionDenied ? 'OPENCODE_PERMISSION_DENIED' : undefined,
          blocks: result.blocks,
          model: result.model,
          sessionId: result.sessionId,
          cost: result.cost,
          tokens: result.tokens,
          timedOut: result.timedOut,
          permissionDenied: result.permissionDenied,
        }
      },
    ),
  ]
}

export function buildOpenCodeServeCaps(_services: BootstrapServices): UnifiedCapability[] {
  const getServe = getOpenCodeServe
  return [
    makeCapability(
      {
        id: 'cap:opencode:send',
        slug: 'opencode_send',
        name: 'Send to OpenCode',
        description: 'Send a prompt to a live opencode serve session and return the response.',
        category: 'agent',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: { type: 'string' },
            sessionId: { type: 'string' },
            model: { type: 'string' },
          },
          required: ['prompt'],
        },
        outputSchema: { type: 'object', properties: { blocks: { type: 'array' } } },
        cliCommand: {
          name: 'opencode send',
          aliases: ['os'],
          examples: ['opencode send "refactor the auth module"'],
        },
        ui: { component: 'text_input', position: 'composer', order: 2 },
        mcpToolName: 'opencode_send',
        apiEndpoint: { method: 'POST', path: '/api/opencode/send' },
      },
      async (input) => {
        const serve = getServe()
        if (!serve)
          return { ok: false, error: 'OpenCode serve not enabled (OPENCODE_SERVE_ENABLED=1)' }
        if (typeof input.prompt !== 'string' || input.prompt.trim().length === 0) {
          return { ok: false, error: 'prompt is required' }
        }
        const { client, ingest } = serve

        let sessionId = input.sessionId ? String(input.sessionId) : undefined
        if (!sessionId) {
          const { sessionId: newId } = await client.createSession({
            model: input.model ? String(input.model) : undefined,
          })
          sessionId = newId
        }

        await ingest.start(sessionId, { model: input.model ? String(input.model) : undefined })
        await client.sendPrompt(sessionId, String(input.prompt))

        const denials = ingest.getDenialsForSession(sessionId)
        if (denials.length > 0) {
          ingest.clearDenialsForSession(sessionId)
          return {
            ok: false,
            sessionId,
            permissionDenied: true,
            error: 'OPENCODE_PERMISSION_DENIED',
            denials,
            text: `Permission denied for ${denials.length} tool call(s): ${denials.map((d) => d.tool).join(', ')}`,
          }
        }

        return {
          ok: true,
          sessionId,
          text: `Prompt sent to session ${sessionId}`,
        }
      },
    ),
    makeCapability(
      {
        id: 'cap:opencode:session.create',
        slug: 'opencode_session_create',
        name: 'Create OpenCode Session',
        description: 'Create a new persistent opencode serve session.',
        category: 'agent',
        inputSchema: {
          type: 'object',
          properties: { model: { type: 'string' }, cwd: { type: 'string' } },
        },
        outputSchema: { type: 'object', properties: { sessionId: { type: 'string' } } },
        cliCommand: {
          name: 'opencode session create',
          aliases: ['osc'],
          examples: ['opencode session create --model opencode/deepseek-v4-flash-free'],
        },
        ui: { component: 'action-button', position: 'sidebar', order: 4 },
        mcpToolName: 'opencode_session_create',
        apiEndpoint: { method: 'POST', path: '/api/opencode/session' },
      },
      async (input) => {
        const serve = getServe()
        if (!serve) return { ok: false, error: 'OpenCode serve not enabled' }
        const { sessionId } = await serve.client.createSession({
          model: input.model ? String(input.model) : undefined,
          cwd: input.cwd ? String(input.cwd) : undefined,
        })
        return { ok: true, sessionId }
      },
    ),
    makeCapability(
      {
        id: 'cap:opencode:session.list',
        slug: 'opencode_session_list',
        name: 'List OpenCode Sessions',
        description: 'List active opencode serve sessions.',
        category: 'agent',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object', properties: { sessions: { type: 'array' } } },
        cliCommand: {
          name: 'opencode session list',
          aliases: ['osl'],
          examples: ['opencode session list'],
        },
        ui: { component: 'action-button', position: 'sidebar', order: 5 },
        mcpToolName: 'opencode_session_list',
        apiEndpoint: { method: 'GET', path: '/api/opencode/sessions' },
      },
      async () => {
        const serve = getServe()
        if (!serve) return { ok: false, error: 'OpenCode serve not enabled' }
        const sessions = await serve.client.listSessions()
        return { ok: true, sessions, count: sessions.length }
      },
    ),
    makeCapability(
      {
        id: 'cap:opencode:instances',
        slug: 'opencode_instances',
        name: 'List OpenCode Serve Instances',
        description:
          "Register + live classification of every opencode process: which are vivim-managed serve instances vs the user's interactive sessions. Consult this before touching any opencode process.",
        category: 'agent',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object', properties: { managed: { type: 'array' } } },
        cliCommand: {
          name: 'opencode instances',
          aliases: ['oi'],
          examples: ['opencode instances'],
        },
        ui: { component: 'action-button', position: 'sidebar', order: 5 },
        mcpToolName: 'opencode_instances',
        apiEndpoint: { method: 'GET', path: '/api/opencode/instances' },
      },
      async () => {
        const serve = getServe()
        if (!serve?.supervisor) return { ok: false, error: 'OpenCode serve not enabled' }
        const registry = serve.supervisor.getRegistry()
        const classified = registry.classifyLive()
        return {
          ok: true,
          managed: classified.filter((p) => p.managed),
          external: classified.filter((p) => !p.managed),
          current: {
            instanceId: serve.supervisor.getInstanceId(),
            pid: serve.supervisor.getPid(),
            port: serve.supervisor.getPort(),
            running: serve.supervisor.isRunning(),
          },
          ledgerCount: registry.readLedger().length,
        }
      },
    ),
    makeCapability(
      {
        id: 'cap:opencode:permission.respond',
        slug: 'opencode_permission_respond',
        name: 'Respond to OpenCode Permission',
        description: 'Respond to a pending permission request from opencode.',
        category: 'agent',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string' },
            permissionId: { type: 'string' },
            decision: { type: 'string', enum: ['allow', 'deny', 'allow_always'] },
          },
          required: ['sessionId', 'permissionId', 'decision'],
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'opencode permission',
          aliases: ['op'],
          examples: ['opencode permission --session abc --permission def --decision deny'],
        },
        ui: { component: 'action-button', position: 'sidebar', order: 6 },
        mcpToolName: 'opencode_permission_respond',
        apiEndpoint: { method: 'POST', path: '/api/opencode/permission/:id' },
      },
      async (input) => {
        const serve = getServe()
        if (!serve) return { ok: false, error: 'OpenCode serve not enabled' }
        const sessionId = String(input.sessionId)
        const permissionId = String(input.permissionId)
        const decision = String(input.decision) as 'allow' | 'deny' | 'allow_always'
        await serve.client.respondPermission(sessionId, permissionId, decision)
        return { ok: true, sessionId, permissionId, decision }
      },
    ),
  ]
}

export function buildOpenCodeModelSyncCaps(services: BootstrapServices): UnifiedCapability[] {
  const modelStore = services.localAgentStore
  const modelSync = services.opencodeModelSync
  if (!modelStore) return []
  return [
    makeCapability(
      {
        id: 'cap:opencode:models',
        slug: 'opencode_models',
        name: 'List OpenCode Models',
        description:
          'List the verified free opencode models available to the local agent, including the current default and last sync time.',
        category: 'agent',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object', properties: { models: { type: 'array' } } },
        cliCommand: {
          name: 'opencode models',
          aliases: ['om'],
          examples: ['opencode models'],
        },
        ui: { component: 'model-list', position: 'sidebar', order: 7 },
        mcpToolName: 'opencode_models',
        apiEndpoint: { method: 'GET', path: '/api/opencode/models' },
      },
      async () => {
        const provider = await modelStore.getAgentProvider('opencode')
        if (!provider) return { ok: false, error: 'local-agent provider not seeded' }
        const syncState = await modelStore.getAgentModelSyncState('opencode')
        return {
          ok: true,
          models: provider.models.map((m) => ({
            slug: m.slug,
            displayName: m.displayName,
            isDefault: m.isDefault,
            contextWindow: m.contextWindow ?? null,
            maxOutputTokens: m.maxOutputTokens ?? null,
          })),
          defaultModel: provider.models.find((m) => m.isDefault)?.slug ?? null,
          lastSyncedAt: syncState.lastSyncedAt,
        }
      },
    ),
    makeCapability(
      {
        id: 'cap:opencode:model.sync',
        slug: 'opencode_model_sync',
        name: 'Sync OpenCode Models',
        description:
          'Re-pull the latest free opencode model list from the CLI (and models.dev) and update the allow-list in the database.',
        category: 'agent',
        inputSchema: {
          type: 'object',
          properties: { refresh: { type: 'boolean' } },
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'opencode models sync',
          aliases: ['oms'],
          examples: ['opencode models sync', 'opencode models sync --refresh'],
        },
        ui: { component: 'action-button', position: 'sidebar', order: 8 },
        mcpToolName: 'opencode_model_sync',
        apiEndpoint: { method: 'POST', path: '/api/opencode/models/sync' },
        requiresConfirmation: true,
      },
      async (input) => {
        if (!modelSync) return { ok: false, error: 'model sync engine not available' }
        const summary = await modelSync.sync({
          refresh: input.refresh === true,
        })
        return { ok: true, ...summary }
      },
    ),
    makeCapability(
      {
        id: 'cap:opencode:model.set_default',
        slug: 'opencode_model_set_default',
        name: 'Set Default OpenCode Model',
        description: 'Select which verified opencode model the local agent uses by default.',
        category: 'agent',
        inputSchema: {
          type: 'object',
          properties: { model: { type: 'string' } },
          required: ['model'],
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'opencode model set-default',
          aliases: ['omd'],
          examples: ['opencode model set-default opencode/deepseek-v4-flash-free'],
        },
        ui: { component: 'action-button', position: 'sidebar', order: 9 },
        mcpToolName: 'opencode_model_set_default',
        apiEndpoint: { method: 'POST', path: '/api/opencode/model/default' },
        requiresConfirmation: true,
      },
      async (input) => {
        const model = input.model ? String(input.model) : ''
        if (!model) return { ok: false, error: 'model is required' }
        if (!(await modelStore.isModelAllowed('opencode', model))) {
          return { ok: false, error: `model '${model}' is not in the allow-list` }
        }
        await modelStore.setAgentDefaultModel('opencode', model)
        return { ok: true, defaultModel: model }
      },
    ),
  ]
}

export function buildStorageCaps(services: BootstrapServices): UnifiedCapability[] {
  const relocationEngine = services.relocationEngine
  return [
    makeCapability(
      {
        id: 'cap:storage:status',
        slug: 'storage_status',
        name: 'Storage Status',
        description:
          'Show current data storage location, disk usage breakdown, and archived locations.',
        category: 'storage',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'storage status',
          aliases: ['ss'],
          examples: ['storage status'],
        },
        ui: { component: 'storage-status', position: 'settings', order: 1 },
        mcpToolName: 'storage_status',
        apiEndpoint: { method: 'GET', path: '/api/storage/status' },
      },
      async () => {
        if (!relocationEngine) return { error: 'Storage engine not available' }
        return relocationEngine.getStorageStatus()
      },
    ),
    makeCapability(
      {
        id: 'cap:storage:relocate',
        slug: 'storage_relocate',
        name: 'Relocate Data',
        description: 'Move all data to a new storage location with zero-downtime migration.',
        category: 'storage',
        inputSchema: {
          type: 'object',
          properties: {
            targetDir: { type: 'string', description: 'Absolute path to the new data directory' },
          },
          required: ['targetDir'],
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'storage move',
          aliases: ['sm'],
          examples: ['storage move --to "D:\\MyData\\vivim"'],
        },
        ui: { component: 'storage-relocate', position: 'settings', order: 2 },
        mcpToolName: 'storage_relocate',
        apiEndpoint: { method: 'POST', path: '/api/storage/move' },
        requiresConfirmation: true,
      },
      async (input) => {
        if (!relocationEngine) return { error: 'Storage engine not available' }
        const targetDir = String(input.targetDir ?? '')
        if (!targetDir) return { error: 'targetDir is required' }
        return relocationEngine.relocate(targetDir)
      },
    ),
    makeCapability(
      {
        id: 'cap:storage:rollback',
        slug: 'storage_rollback',
        name: 'Rollback Storage',
        description: 'Revert to the previous data storage location.',
        category: 'storage',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'storage rollback',
          aliases: ['sr'],
          examples: ['storage rollback'],
        },
        ui: { component: 'storage-rollback', position: 'settings', order: 3 },
        mcpToolName: 'storage_rollback',
        apiEndpoint: { method: 'POST', path: '/api/storage/rollback' },
        requiresConfirmation: true,
      },
      async () => {
        if (!relocationEngine) return { error: 'Storage engine not available' }
        return relocationEngine.rollback()
      },
    ),
    makeCapability(
      {
        id: 'cap:storage:cleanup',
        slug: 'storage_cleanup',
        name: 'Cleanup Old Data',
        description: 'Delete expired archived data from previous storage locations.',
        category: 'storage',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'storage cleanup',
          aliases: ['sc'],
          examples: ['storage cleanup'],
        },
        ui: { component: 'storage-cleanup', position: 'settings', order: 4 },
        mcpToolName: 'storage_cleanup',
        apiEndpoint: { method: 'POST', path: '/api/storage/cleanup' },
        requiresConfirmation: true,
      },
      async () => {
        if (!relocationEngine) return { error: 'Storage engine not available' }
        const cleaned = await relocationEngine.cleanupExpiredArchives()
        return { cleaned, count: cleaned.length }
      },
    ),
    makeCapability(
      {
        id: 'cap:storage:progress',
        slug: 'storage_progress',
        name: 'Migration Progress',
        description: 'Check the progress of an in-flight storage migration.',
        category: 'storage',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'storage progress',
          aliases: ['sp'],
          examples: ['storage progress'],
        },
        ui: { component: 'storage-progress', position: 'settings', order: 5 },
        mcpToolName: 'storage_progress',
        apiEndpoint: { method: 'GET', path: '/api/storage/progress' },
      },
      async () => {
        if (!relocationEngine) return { error: 'Storage engine not available' }
        return relocationEngine.getStatus()
      },
    ),
  ]
}

export function buildAiGatewayCaps(_services: BootstrapServices): UnifiedCapability[] {
  const getGateway = getAiGateway
  return [
    makeCapability(
      {
        id: 'cap:ai:execute',
        slug: 'ai_execute',
        name: 'AI Execute',
        description:
          'Execute an AI request through the AI Gateway (src/ai/). Streams AIEvents. Supports local LLM providers (OpenCode, Ollama, llama.cpp) and OpenAI-compatible cloud APIs.',
        category: 'ai',
        inputSchema: {
          type: 'object',
          properties: {
            messages: {
              type: 'array',
              description: 'Array of { role, content } messages.',
              items: { type: 'object' },
            },
            providerId: {
              type: 'string',
              description:
                'Provider ID (e.g. "simulator", "opencode-serve", "ollama-v1"). If omitted, the router picks.',
            },
            modelId: {
              type: 'string',
              description: 'Model ID. If omitted, the router picks.',
            },
            task: {
              type: 'string',
              description: 'Optional task descriptor name.',
            },
            temperature: { type: 'number' },
            maxOutputTokens: { type: 'integer' },
          },
          required: ['messages'],
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'ai execute',
          aliases: ['ai'],
          examples: [
            'ai execute --messages="[{role:user,content:Hello}]"',
            'ai execute --provider=simulator --messages="..."',
          ],
        },
        ui: { component: 'ai-execute', position: 'composer', order: 10 },
        mcpToolName: 'ai_execute',
        apiEndpoint: { method: 'POST', path: '/api/ai/execute' },
      },
      async (input) => {
        const gateway = getGateway()
        if (!gateway) {
          return { ok: false, error: 'AI Gateway not enabled (set AI_GATEWAY_ENABLED=1)' }
        }

        const { createRequestId } = await import('../../ai/index.js')
        const aiRequest = {
          requestId: createRequestId(),
          messages: Array.isArray(input.messages)
            ? (
                input.messages as Array<{
                  role: string
                  content: string | Array<{ type: string; text?: string }>
                }>
              ).map((m) => ({
                role: m.role as 'user' | 'system' | 'assistant',
                content:
                  typeof m.content === 'string'
                    ? [{ type: 'text' as const, text: m.content }]
                    : (m.content as Array<{ type: 'text'; text: string }>),
              }))
            : [],
          model:
            input.providerId || input.modelId
              ? {
                  providerId: input.providerId as never,
                  modelId: input.modelId as never,
                }
              : undefined,
          task: input.task ? { name: String(input.task) } : undefined,
          generation:
            input.temperature || input.maxOutputTokens
              ? {
                  temperature: input.temperature ? Number(input.temperature) : undefined,
                  maxOutputTokens: input.maxOutputTokens
                    ? Number(input.maxOutputTokens)
                    : undefined,
                }
              : undefined,
        }

        const blocks: Array<{ type: string; text?: string; toolCall?: unknown }> = []
        let totalText = ''
        let usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number } | undefined

        try {
          for await (const event of gateway.execute(aiRequest)) {
            if (event.type === 'output.text.delta') {
              totalText += event.text
              blocks.push({ type: 'text', text: event.text })
            } else if (event.type === 'tool.call.completed') {
              blocks.push({
                type: 'tool-call',
                toolCall: { name: (event as { name?: string }).name, arguments: event.arguments },
              })
            } else if (event.type === 'usage.updated') {
              usage = event.usage
            } else if (event.type === 'response.failed') {
              return { ok: false, error: event.error.message, code: event.error.code, blocks }
            }
          }
          return { ok: true, text: totalText, blocks, usage }
        } catch (err) {
          return { ok: false, error: String(err), blocks }
        }
      },
    ),
    makeCapability(
      {
        id: 'cap:ai:providers',
        slug: 'ai_providers',
        name: 'AI Providers',
        description: 'List AI providers registered in the AI Gateway.',
        category: 'ai',
        inputSchema: { type: 'object', properties: { kind: { type: 'string' } } },
        outputSchema: { type: 'array' },
        cliCommand: { name: 'ai providers', aliases: ['aip'], examples: ['ai providers'] },
        ui: { component: 'ai-providers', position: 'sidebar', order: 11 },
        mcpToolName: 'ai_providers',
        apiEndpoint: { method: 'GET', path: '/api/ai/providers' },
      },
      async (input) => {
        const gateway = getGateway()
        if (!gateway) return { ok: false, error: 'AI Gateway not enabled' }
        const filter = input.kind
          ? { kind: input.kind as 'local' | 'remote' | 'hybrid' | 'embedded' }
          : undefined
        const providers = await gateway.listProviders(filter)
        return {
          ok: true,
          providers: providers.map((p) => ({
            id: p.id,
            name: p.name,
            kind: p.kind,
            trust: p.trust,
          })),
        }
      },
    ),
    makeCapability(
      {
        id: 'cap:ai:models',
        slug: 'ai_models',
        name: 'AI Models',
        description:
          'List AI models registered in the AI Gateway, optionally filtered by provider.',
        category: 'ai',
        inputSchema: { type: 'object', properties: { providerId: { type: 'string' } } },
        outputSchema: { type: 'array' },
        cliCommand: {
          name: 'ai models',
          aliases: ['aim'],
          examples: ['ai models', 'ai models --provider=simulator'],
        },
        ui: { component: 'ai-models', position: 'sidebar', order: 12 },
        mcpToolName: 'ai_models',
        apiEndpoint: { method: 'GET', path: '/api/ai/models' },
      },
      async (input) => {
        const gateway = getGateway()
        if (!gateway) return { ok: false, error: 'AI Gateway not enabled' }
        const filter = input.providerId ? { providerId: input.providerId as never } : undefined
        const models = await gateway.listModels(filter)
        return {
          ok: true,
          models: models.map((m) => ({
            id: m.id,
            providerId: m.providerId,
            name: m.name,
            contextWindow: m.contextWindow,
          })),
        }
      },
    ),
  ]
}
