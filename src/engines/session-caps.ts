// src/engines/session-caps.ts
// Phase 29.1 — Session Lifecycle Capabilities

import type { CapabilityContext, UnifiedCapability } from './unified-registry.js'

export interface SessionDeps {
  governor?: {
    ensureRunning: (providerId: string) => Promise<{ slaveId: string }>
    getSlave: (providerId: string) => Promise<{ slaveId: string } | null>
    cdp: { send: (slaveId: string, method: string, params: unknown) => Promise<unknown> }
  }
  conversation?: {
    create: (opts?: { providerId?: string }) => Promise<{ id: string }>
    getActive: () => Promise<{ id: string } | null>
    switchTo: (id: string) => Promise<void>
  }
  sessionStore?: {
    create: (session: {
      id: string
      providerId: string
      slaveId: string
      conversationId: string
    }) => Promise<void>
    get: (
      id: string,
    ) => Promise<{ id: string; providerId: string; slaveId: string; conversationId: string } | null>
    list: () => Promise<Array<{ id: string; providerId: string }>>
    delete: (id: string) => Promise<void>
  }
}

function makeSessionCap(
  partial: Omit<
    UnifiedCapability,
    'surfaces' | 'isAsync' | 'requiresConfirmation' | 'tags' | 'handler'
  > & { requiresConfirmation?: boolean },
  handler: UnifiedCapability['handler'],
): UnifiedCapability {
  return {
    ...partial,
    surfaces: ['cli', 'ui', 'api', 'mcp', 'workflow'],
    handler,
    isAsync: true,
    requiresConfirmation: partial.requiresConfirmation ?? false,
    tags: ['session', 'interactive'],
  }
}

export function registerSessionCaps(
  registry: { register: (cap: UnifiedCapability) => void },
  deps: SessionDeps,
): void {
  // cap:session:load
  registry.register(
    makeSessionCap(
      {
        id: 'cap:session:load',
        slug: 'session_load',
        name: 'Load Session',
        description: 'Load a provider session and attach to conversation.',
        category: 'session',
        inputSchema: {
          type: 'object',
          properties: {
            providerId: { type: 'string' },
            accountId: { type: 'string' },
          },
          required: ['providerId'],
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'session load',
          aliases: ['sload'],
          examples: ['session load --providerId chatgpt'],
        },
        ui: { component: 'action-button', position: 'composer', order: 40 },
        mcpToolName: 'session_load',
        apiEndpoint: { method: 'POST', path: '/api/session/load' },
      },
      async (input: Record<string, unknown>, _ctx: CapabilityContext) => {
        const { providerId } = input as { providerId: string; accountId?: string }

        if (!deps.governor) {
          return { ok: false, error: 'No governor available' }
        }

        const slave = await deps.governor.ensureRunning(providerId)
        let conversationId = ''

        if (deps.conversation) {
          const conv = await deps.conversation.create({ providerId })
          conversationId = conv.id
          if (deps.sessionStore) {
            await deps.sessionStore.create({
              id: `sess:${providerId}:${Date.now()}`,
              providerId,
              slaveId: slave.slaveId,
              conversationId,
            })
          }
        }

        return { ok: true, sessionId: `sess:${providerId}`, conversationId, slaveId: slave.slaveId }
      },
    ),
  )

  // cap:session:start
  registry.register(
    makeSessionCap(
      {
        id: 'cap:session:start',
        slug: 'session_start',
        name: 'Start Session',
        description: 'Start an interactive session with a provider.',
        category: 'session',
        inputSchema: {
          type: 'object',
          properties: {
            providerId: { type: 'string' },
            conversationId: { type: 'string' },
          },
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'session start',
          aliases: ['sstart'],
          examples: ['session start --providerId chatgpt'],
        },
        ui: { component: 'action-button', position: 'composer', order: 41 },
        mcpToolName: 'session_start',
        apiEndpoint: { method: 'POST', path: '/api/session/start' },
      },
      async (input: Record<string, unknown>, _ctx: CapabilityContext) => {
        const { providerId, conversationId } = input as {
          providerId: string
          conversationId?: string
        }

        if (!deps.governor) {
          return { ok: false, error: 'No governor available' }
        }

        const slave = await deps.governor.ensureRunning(providerId)
        return { ok: true, sessionId: `sess:${providerId}`, conversationId, slaveId: slave.slaveId }
      },
    ),
  )

  // cap:session:list
  registry.register(
    makeSessionCap(
      {
        id: 'cap:session:list',
        slug: 'session_list',
        name: 'List Sessions',
        description: 'List active sessions.',
        category: 'session',
        inputSchema: { type: 'object' },
        outputSchema: { type: 'object' },
        cliCommand: { name: 'session list', aliases: ['slist'], examples: ['session list'] },
        ui: { component: 'action-button', position: 'composer', order: 42 },
        mcpToolName: 'session_list',
        apiEndpoint: { method: 'GET', path: '/api/session' },
      },
      async () => {
        if (!deps.sessionStore) {
          return { ok: true, sessions: [] }
        }
        const sessions = await deps.sessionStore.list()
        return { ok: true, sessions }
      },
    ),
  )
}
