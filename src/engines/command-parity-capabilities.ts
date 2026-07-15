// src/engines/command-parity-capabilities.ts
// atomic-v15 / Phase 26 — register the 6 capabilities the command-surface audit
// found as dangling NL bindings (cap:help, cap:conversation:switch,
// cap:system:capabilities, cap:web:query, cap:workflow:create_newsletter,
// cap:schedule:register). Isolated from the large `defaults` array in
// capability-bootstrap.ts so the work is easy to audit and revert.

import { EngineError } from '../errors.js'
import { ulid } from '../ids.js'
import { type BootstrapServices, makeCapability } from './capability-bootstrap.js'
import type { UnifiedCapability, UnifiedCapabilityRegistry } from './unified-registry.js'

// Process-scoped stores for capabilities whose backing engine is not yet wired.
// These are the natural integration points when a workflow/schedule service lands.
interface NewsletterDef {
  id: string
  kind: 'newsletter'
  title: string
  recipients: string[]
  windowDays: number
  schedule: string
  createdAt: number
}
interface ScheduleDef {
  id: string
  cron: string
  action: string
  name: string
  createdAt: number
}

const newsletters = new Map<string, NewsletterDef>()
const schedules = new Map<string, ScheduleDef>()
const activeConversations = new Map<string, string>() // providerId -> conversationId

export function registerCommandParityCapabilities(
  registry: UnifiedCapabilityRegistry,
  services: BootstrapServices,
): void {
  const caps: UnifiedCapability[] = [
    // 26.1 ── cap:help ───────────────────────────────────────────────────────
    makeCapability(
      {
        id: 'cap:help',
        slug: 'help',
        name: 'Help',
        description: 'Show available commands and capabilities for the current surface.',
        category: 'system',
        inputSchema: { type: 'object', properties: { surface: { type: 'string' } } },
        outputSchema: { type: 'object' },
        cliCommand: { name: 'help', aliases: ['?'], examples: ['help'] },
        ui: { component: 'help-panel', position: 'sidebar', order: 0 },
        mcpToolName: 'help',
        apiEndpoint: { method: 'GET', path: '/api/help' },
        surfaces: ['cli', 'ui', 'api', 'mcp'],
      },
      async (input) => {
        const surface = input.surface ? String(input.surface) : undefined
        const all = registry.list()
        const byCategory: Record<string, unknown[]> = {}
        for (const c of all) {
          const bucket = byCategory[c.category] ?? []
          byCategory[c.category] = bucket
          bucket.push({
            id: c.id,
            name: c.name,
            cli: c.cliCommand?.name,
            aliases: c.cliCommand?.aliases ?? [],
          })
        }
        return { surface, count: all.length, categories: byCategory }
      },
    ),

    // 26.2 ── cap:conversation:switch ──────────────────────────────────────────
    makeCapability(
      {
        id: 'cap:conversation:switch',
        slug: 'conversation_switch',
        name: 'Switch Conversation',
        description: 'Switch the active conversation, by provider or by conversation id.',
        category: 'conversation',
        inputSchema: {
          type: 'object',
          properties: {
            providerId: { type: 'string' },
            sessionId: { type: 'string' },
          },
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'conversations switch',
          aliases: ['csw'],
          examples: ['conversations switch --provider=claude'],
        },
        ui: { component: 'conversation-switcher', position: 'sidebar', order: 3 },
        mcpToolName: 'conversation_switch',
        apiEndpoint: { method: 'POST', path: '/api/conversations/switch' },
        surfaces: ['cli', 'ui', 'api', 'mcp'],
      },
      async (input) => {
        const providerId = input.providerId ? String(input.providerId) : undefined
        const sessionId = input.sessionId ? String(input.sessionId) : undefined
        if (!providerId && !sessionId) {
          throw new EngineError('conversation:switch requires providerId or sessionId')
        }
        let target = sessionId ? await services.conversationStore.getConversation(sessionId) : null
        if (!target && providerId) {
          const list = await services.conversationStore.listConversations({
            providerId,
            limit: 1,
          })
          target = list[0] ?? null
        }
        if (!target) {
          const ref = sessionId ? `session ${sessionId}` : `provider ${providerId}`
          throw new EngineError(`No conversation found for ${ref}`)
        }
        activeConversations.set(target.providerId, target.id)
        return {
          switched: true,
          conversationId: target.id,
          providerId: target.providerId,
          title: target.title,
        }
      },
    ),

    // 26.3 ── cap:system:capabilities ──────────────────────────────────────────
    makeCapability(
      {
        id: 'cap:system:capabilities',
        slug: 'system_capabilities',
        name: 'List Capabilities',
        description: 'List all registered capabilities and their invocation surfaces.',
        category: 'system',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'array' },
        cliCommand: { name: 'capabilities', aliases: ['caps'], examples: ['capabilities'] },
        ui: { component: 'capability-list', position: 'admin', order: 1 },
        mcpToolName: 'list_capabilities',
        apiEndpoint: { method: 'GET', path: '/api/capabilities' },
        surfaces: ['cli', 'ui', 'api', 'mcp'],
      },
      async () =>
        registry.list().map((c) => ({
          id: c.id,
          name: c.name,
          category: c.category,
          surfaces: c.surfaces,
          cli: c.cliCommand?.name,
        })),
    ),

    // 26.4 ── cap:web:query ─────────────────────────────────────────────────────
    makeCapability(
      {
        id: 'cap:web:query',
        slug: 'web_query',
        name: 'Web Query',
        description: 'Fetch a URL over HTTP(S). GET by default; POST when a body is supplied.',
        category: 'web',
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            body: { type: 'string' },
            method: { type: 'string' },
          },
          required: ['url'],
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'web query',
          aliases: ['wq'],
          examples: ['web query https://example.com'],
        },
        ui: { component: 'web-query', position: 'tools', order: 1 },
        mcpToolName: 'web_query',
        apiEndpoint: { method: 'POST', path: '/api/web/query' },
        surfaces: ['cli', 'ui', 'api', 'mcp'],
      },
      async (input) => {
        const url = String(input.url ?? '')
        if (!/^https?:\/\//i.test(url)) {
          throw new EngineError('web:query url must be http(s)')
        }
        const method = (
          input.method ? String(input.method) : input.body ? 'POST' : 'GET'
        ).toUpperCase()
        const init: RequestInit = { method }
        if (input.body) init.body = String(input.body)
        const res = await fetch(url, init)
        const text = await res.text()
        const MAX = 50_000
        const truncated = text.length > MAX
        const headers: Record<string, string> = {}
        res.headers.forEach((v, k) => {
          headers[k] = v
        })
        return {
          status: res.status,
          headers,
          body: truncated ? text.slice(0, MAX) : text,
          truncated,
        }
      },
    ),

    // 26.5 ── cap:workflow:create_newsletter ────────────────────────────────────
    makeCapability(
      {
        id: 'cap:workflow:create_newsletter',
        slug: 'workflow_newsletter',
        name: 'Create Newsletter Workflow',
        description: 'Create a recurring newsletter workflow.',
        category: 'workflow',
        inputSchema: {
          type: 'object',
          properties: {
            recipients: { type: 'array' },
            windowDays: { type: 'number' },
            title: { type: 'string' },
            schedule: { type: 'string' },
          },
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'workflow newsletter',
          aliases: ['wnl'],
          examples: ['workflow newsletter --recipients a@b.io'],
        },
        ui: { component: 'workflow-builder', position: 'tools', order: 2 },
        mcpToolName: 'create_newsletter_workflow',
        apiEndpoint: { method: 'POST', path: '/api/workflows/newsletter' },
        surfaces: ['cli', 'ui', 'api', 'mcp'],
      },
      async (input) => {
        const id = ulid()
        const def: NewsletterDef = {
          id,
          kind: 'newsletter',
          title: input.title ? String(input.title) : 'Newsletter',
          recipients: Array.isArray(input.recipients) ? input.recipients.map((r) => String(r)) : [],
          windowDays: Number(input.windowDays ?? 7),
          schedule: input.schedule ? String(input.schedule) : '0 9 * * 1',
          createdAt: Date.now(),
        }
        newsletters.set(id, def)
        return def
      },
    ),

    // 26.6 ── cap:schedule:register ─────────────────────────────────────────────
    makeCapability(
      {
        id: 'cap:schedule:register',
        slug: 'schedule_register',
        name: 'Register Schedule',
        description: 'Register a recurring schedule that triggers a capability.',
        category: 'schedule',
        inputSchema: {
          type: 'object',
          properties: {
            cron: { type: 'string' },
            action: { type: 'string' },
            name: { type: 'string' },
          },
          required: ['cron', 'action'],
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'schedule register',
          aliases: ['sreg'],
          examples: ['schedule register "0 9 * * 1" cap:workflow:create_newsletter'],
        },
        ui: { component: 'schedule-builder', position: 'tools', order: 3 },
        mcpToolName: 'register_schedule',
        apiEndpoint: { method: 'POST', path: '/api/schedules' },
        surfaces: ['cli', 'ui', 'api', 'mcp'],
      },
      async (input) => {
        const cron = String(input.cron ?? '')
        const action = String(input.action ?? '')
        if (!cron) throw new EngineError('schedule:register requires a cron expression')
        if (!registry.get(action)) {
          throw new EngineError(`schedule:register action capability not found: ${action}`)
        }
        const id = ulid()
        const def: ScheduleDef = {
          id,
          cron,
          action,
          name: input.name ? String(input.name) : action,
          createdAt: Date.now(),
        }
        schedules.set(id, def)
        return def
      },
    ),
  ]

  for (const cap of caps) registry.register(cap)
}

// Exported for tests / future service integration.
export function listNewsletters(): NewsletterDef[] {
  return [...newsletters.values()]
}
export function listSchedules(): ScheduleDef[] {
  return [...schedules.values()]
}
export function getActiveConversation(providerId: string): string | undefined {
  return activeConversations.get(providerId)
}
