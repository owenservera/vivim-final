// src/engines/capability-bootstrap-generated.ts
// AUTO-GENERATED from taxonomy pool — do not edit manually.
// This file replaces the hand-written capability-bootstrap.ts by reading
// the unified taxonomy pool (seeds/taxonomy/pool.taxonomy.json) and
// registering every capability with its cross-surface bindings.
//
// The handler map at the bottom is the "last mile" that connects generated
// specs to real backend service calls.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { BootstrapServices } from './capability-bootstrap.js'
import { makeCapability } from './capability-bootstrap.js'
import type { UnifiedCapability, UnifiedCapabilityRegistry } from './unified-registry.js'

// ── Taxonomy pool type ────────────────────────────────────────────────────

interface TaxonomyPoolCapability {
  id: string
  slug: string
  label: string
  description: string
  category: string
  capabilityKind: string
  surfaces: string[]
  inputSchema: Record<string, unknown> | null
  outputSchema: Record<string, unknown> | null
  cliCommand: { name: string; aliases: string[]; examples: string[] } | null
  apiEndpoint: { method: string; path: string } | null
  mcpToolName: string | null
  uiAction: { component: string; position: string; order: number } | null
  workflowNodeType: string | null
  isAsync: boolean
  requiresConfirmation: boolean
  ui_component: string | null
  ui_position: string | null
  ui_order: number | null
  ui_group: string | null
}

interface TaxonomyPool {
  nodes: Array<{ kind: string; slug: string; [key: string]: unknown }>
}

// ── Load pool ─────────────────────────────────────────────────────────────

function loadPool(): TaxonomyPoolCapability[] {
  const poolPath = join(
    import.meta.dir,
    '..',
    '..',
    '..',
    'seeds',
    'taxonomy',
    'pool.taxonomy.json',
  )
  try {
    const raw = JSON.parse(readFileSync(poolPath, 'utf-8')) as TaxonomyPool
    return raw.nodes
      .filter((n) => n.kind === 'capability')
      .map((n) => n as unknown as TaxonomyPoolCapability)
  } catch {
    console.warn('[bootstrap-generated] pool.taxonomy.json not found, returning empty set')
    return []
  }
}

// ── Handler map ────────────────────────────────────────────────────────────
// Maps capability slug → handler function using backend services.
// This is the ONLY place that connects generated specs to real code.

function createHandlerMap(
  services: BootstrapServices,
): Record<string, UnifiedCapability['handler']> {
  return {
    // ── Conversation ──
    conversation_list: async (input) =>
      services.conversationStore.listConversations({
        providerId: input.providerId ? String(input.providerId) : undefined,
        limit: 100,
      }),

    conversation_create: async (input) => {
      const conv = await services.conversationStore.createConversation({
        providerSessionId: String(input.providerId ?? ''),
        providerId: String(input.providerId ?? ''),
        title: input.title ? String(input.title) : null,
      })
      return { id: conv.id }
    },

    conversation_send: async (input) => {
      const result = await services.conversationManager.send(
        String(input.conversationId ?? ''),
        String(input.message ?? ''),
      )
      return { ok: result.ok, text: result.text ?? null, error: result.error ?? null }
    },

    conversation_delete: async (input) => {
      await services.db.prisma.conversation.delete({
        where: { id: String(input.conversationId ?? '') },
      })
      return { ok: true }
    },

    // ── Knowledge ──
    knowledge_search: async () => [],
    knowledge_ingest: async () => ({ jobId: 'pending' }),
    knowledge_synthesize: async () => ({ answer: '', sources: [], confidence: 0 }),

    // ── Memory ──
    memory_query: async () => ({ results: [] }),
    memory_assert: async () => ({ ok: true }),
    memory_forget: async () => ({ ok: true }),

    // ── Admin ──
    admin_seed: async () => ({ ok: true }),
    config_get: async (input) => {
      const engine = String(input.engine ?? '')
      const config = await services.db.getConfig(engine)
      return { engine, config: config ?? {} }
    },
    config_set: async (input) => {
      const engine = String(input.engine ?? '')
      const patch = JSON.stringify(input.patch ?? {})
      await services.db.setConfig(engine, patch)
      return { ok: true }
    },

    // ── Health ──
    health_check: async () => ({ ok: true, timestamp: Date.now() }),
    system_status: async () => ({ ok: true }),
  }
}

// ── Fallback handler ───────────────────────────────────────────────────────

function createFallbackHandler(slug: string): UnifiedCapability['handler'] {
  return async () => {
    throw new Error(`No handler registered for capability: ${slug}`)
  }
}

// ── Registration ───────────────────────────────────────────────────────────

/**
 * Register all capabilities from the taxonomy pool.
 * This is the generated replacement for registerDefaultCapabilities.
 */
export function registerGeneratedCapabilities(
  registry: UnifiedCapabilityRegistry,
  services: BootstrapServices,
): void {
  const pool = loadPool()
  const handlerMap = createHandlerMap(services)

  let registered = 0
  let skipped = 0

  for (const node of pool) {
    const handler = handlerMap[node.slug] ?? createFallbackHandler(node.slug)

    const ui = node.ui_component
      ? {
          component: node.ui_component,
          position: node.ui_position ?? 'sidebar',
          group: node.ui_group ?? undefined,
          order: node.ui_order ?? 100,
        }
      : undefined

    const partial: Omit<UnifiedCapability, 'handler'> = {
      id: node.id,
      slug: node.slug,
      name: node.label,
      description: node.description,
      category: node.category,
      surfaces: node.surfaces as UnifiedCapability['surfaces'],
      inputSchema: node.inputSchema ?? { type: 'object', properties: {} },
      outputSchema: node.outputSchema ?? { type: 'object' },
      cliCommand: node.cliCommand ?? undefined,
      ui,
      uiAction: node.uiAction ?? undefined,
      mcpToolName: node.mcpToolName ?? undefined,
      apiEndpoint: node.apiEndpoint ?? undefined,
      workflowNodeType: node.workflowNodeType ?? undefined,
      isAsync: node.isAsync,
      requiresConfirmation: node.requiresConfirmation,
      tags: [],
    }

    try {
      registry.register(makeCapability(partial, handler))
      registered++
    } catch (_err) {
      // Some capabilities may have duplicate slugs from different sources
      // Skip silently in generated mode
      skipped++
    }
  }

    console.log(`[bootstrap-generated] Registered ${registered} capabilities from taxonomy pool${skipped > 0 ? ` (${skipped} skipped)` : ''}`)
}
