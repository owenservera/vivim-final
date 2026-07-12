// web/ui/src/actions/catalog.ts
// Unit 6.1 — Full typed action catalog with Zod schemas.
// Import this file at boot to register all actions.

import { z } from 'zod'
import { ActionRegistry } from './registry.js'

// ── Conversation Actions ──────────────────────────────────────────

ActionRegistry.register('conversation.create', {
  description: 'Create a new conversation',
  params: z.object({
    providerId: z.string(),
    title: z.string().optional(),
  }),
  run: async (params) => {
    const resp = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    return resp.json()
  },
})

ActionRegistry.register('conversation.send', {
  description: 'Send a message in a conversation',
  params: z.object({
    conversationId: z.string(),
    message: z.string().min(1),
  }),
  run: async (params) => {
    const resp = await fetch(`/api/conversations/${params.conversationId}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: params.message }),
    })
    return resp.json()
  },
})

ActionRegistry.register('conversation.list', {
  description: 'List all conversations',
  params: z.object({
    limit: z.number().optional(),
  }),
  run: async (params) => {
    const qs = params.limit ? `?limit=${params.limit}` : ''
    const resp = await fetch(`/api/conversations${qs}`)
    return resp.json()
  },
})

ActionRegistry.register('conversation.messages', {
  description: 'Get messages for a conversation',
  params: z.object({
    conversationId: z.string(),
    limit: z.number().optional(),
  }),
  run: async (params) => {
    const qs = params.limit ? `?limit=${params.limit}` : ''
    const resp = await fetch(`/api/conversations/${params.conversationId}/messages${qs}`)
    return resp.json()
  },
})

// ── Provider Actions ──────────────────────────────────────────────

ActionRegistry.register('provider.list', {
  description: 'List all providers',
  params: z.object({}),
  run: async () => {
    const resp = await fetch('/api/providers')
    return resp.json()
  },
})

ActionRegistry.register('provider.capabilities', {
  description: 'Get resolved capabilities for a provider',
  params: z.object({
    providerId: z.string(),
    planTier: z.enum(['free', 'pro', 'max', 'enterprise']).optional(),
  }),
  run: async (params) => {
    const qs = params.planTier ? `?planTier=${params.planTier}` : ''
    const resp = await fetch(`/api/providers/${params.providerId}/capabilities${qs}`)
    return resp.json()
  },
})

// ── Capability Actions ────────────────────────────────────────────

ActionRegistry.register('capability.execute', {
  description: 'Execute a capability by slug',
  params: z.object({
    conversationId: z.string(),
    slug: z.string(),
  }),
  run: async (params) => {
    const resp = await fetch(
      `/api/conversations/${params.conversationId}/capabilities/${params.slug}/execute`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      },
    )
    return resp.json()
  },
})

// ── Setup Actions ─────────────────────────────────────────────────

ActionRegistry.register('setup.workspace.get', {
  description: 'Get workspace path',
  params: z.object({}),
  run: async () => {
    const resp = await fetch('/api/setup/workspace')
    return resp.json()
  },
})

ActionRegistry.register('setup.workspace.set', {
  description: 'Set workspace path',
  params: z.object({ path: z.string() }),
  run: async (params) => {
    const resp = await fetch('/api/setup/workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    return resp.json()
  },
})

ActionRegistry.register('setup.launch', {
  description: 'Launch visible Chrome for login',
  params: z.object({
    providerId: z.string(),
    accountSlug: z.string(),
    workspace: z.string(),
    port: z.number().optional(),
  }),
  run: async (params) => {
    const resp = await fetch('/api/setup/launch-visible', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    return resp.json()
  },
})

ActionRegistry.register('setup.verify', {
  description: 'Verify login state',
  params: z.object({
    port: z.number(),
    providerId: z.string().optional(),
  }),
  run: async (params) => {
    const resp = await fetch('/api/setup/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    return resp.json()
  },
})

ActionRegistry.register('setup.complete', {
  description: 'Complete provider setup',
  params: z.object({
    providerId: z.string(),
    accountSlug: z.string(),
    workspace: z.string(),
    profileDir: z.string(),
    debugPort: z.number(),
  }),
  run: async (params) => {
    const resp = await fetch('/api/setup/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    return resp.json()
  },
})

ActionRegistry.register('setup.profiles', {
  description: 'List provider profiles',
  params: z.object({}),
  run: async () => {
    const resp = await fetch('/api/setup/profiles')
    return resp.json()
  },
})

// ── Fleet Actions ─────────────────────────────────────────────────

ActionRegistry.register('fleet.status', {
  description: 'Get fleet status',
  params: z.object({}),
  run: async () => {
    const resp = await fetch('/api/fleet/status')
    return resp.json()
  },
})

ActionRegistry.register('fleet.start', {
  description: 'Start a fleet slave',
  params: z.object({
    providerId: z.string(),
    accountId: z.string(),
  }),
  run: async (params) => {
    const resp = await fetch('/api/fleet/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    return resp.json()
  },
})

// ── Health Actions ────────────────────────────────────────────────

ActionRegistry.register('health.providers', {
  description: 'Get provider health',
  params: z.object({}),
  run: async () => {
    const resp = await fetch('/api/health/providers')
    return resp.json()
  },
})

// ── Config Actions ────────────────────────────────────────────────

ActionRegistry.register('config.governor.get', {
  description: 'Get governor config',
  params: z.object({}),
  run: async () => {
    const resp = await fetch('/api/config/governor')
    return resp.json()
  },
})

ActionRegistry.register('config.governor.set', {
  description: 'Update governor config',
  params: z.object({
    fleetConfig: z
      .object({
        portRange: z.tuple([z.number(), z.number()]).optional(),
        healthProbeIntervalMs: z.number().optional(),
        autoRestart: z.boolean().optional(),
        maxRestarts: z.number().optional(),
        circuitBreakerThreshold: z.number().optional(),
        circuitBreakerResetMs: z.number().optional(),
      })
      .optional(),
    chromeConfig: z
      .object({
        path: z.string().optional(),
        extraArgs: z.array(z.string()).optional(),
        disableGpu: z.boolean().optional(),
      })
      .optional(),
  }),
  run: async (params) => {
    const resp = await fetch('/api/config/governor', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    return resp.json()
  },
})
