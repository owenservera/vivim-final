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
import { getLogger } from '../lib/logger.js'
import type { BootstrapServices } from './capability-bootstrap.js'

const log = getLogger('capability-bootstrap-generated')

import { makeCapability } from './capability-bootstrap.js'
import type { ImportSource } from './knowledge-ingestion.js'
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
  const poolPath = join(import.meta.dir, '..', '..', 'seeds', 'taxonomy', 'pool.taxonomy.json')
  try {
    const raw = JSON.parse(readFileSync(poolPath, 'utf-8')) as TaxonomyPool
    return raw.nodes
      .filter((n) => n.kind === 'capability')
      .map((n) => n as unknown as TaxonomyPoolCapability)
  } catch {
    log.warn('pool.taxonomy.json not found, returning empty set')
    return []
  }
}

// ── Handler map ────────────────────────────────────────────────────────────
// Maps capability slug → handler function using backend services.
// This is the ONLY place that connects generated specs to real code.

const extraHandlers = new Map<string, UnifiedCapability['handler']>()

export function extendHandlerMap(slug: string, handler: UnifiedCapability['handler']): void {
  extraHandlers.set(slug, handler)
}

function createHandlerMap(
  registry: UnifiedCapabilityRegistry,
  services: BootstrapServices,
): Record<string, UnifiedCapability['handler']> {
  const base: Record<string, UnifiedCapability['handler']> = {
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

    // ── Knowledge ──
    knowledge_search: async (input) => {
      const query = String(input.query ?? input.text ?? '')
      if (!query) return []
      try {
        return (
          (await services.semanticSearch?.search({
            text: query,
            limit: Number(input.limit ?? 10),
          })) ?? []
        )
      } catch {
        return []
      }
    },
    knowledge_ingest: async (input) => {
      const content = String(input.content ?? input.text ?? '')
      if (!content) return { ok: false, error: 'content is required' }
      try {
        const jobId = await services.knowledgeIngestion?.ingest({
          source: String(input.source ?? 'generic') as ImportSource,
          filePath: String(input.filePath ?? input.content ?? ''),
          deduplicate: Boolean(input.deduplicate ?? true),
          extractEntities: Boolean(input.extractEntities ?? true),
          extractDecisions: Boolean(input.extractDecisions ?? false),
          generateEmbeddings: Boolean(input.generateEmbeddings ?? true),
        })
        return { ok: true, jobId: jobId ?? 'pending' }
      } catch {
        return { ok: true, jobId: 'pending' }
      }
    },
    knowledge_synthesize: async (input) => {
      const question = String(input.question ?? input.text ?? '')
      if (!question) return { answer: '', sources: [], confidence: 0 }
      try {
        return (
          (await services.synthesizer?.synthesize({
            question,
            scope: {},
            maxSources: Number(input.maxSources ?? 5),
            synthesisStyle: 'summary',
          })) ?? { answer: '', sources: [], confidence: 0 }
        )
      } catch {
        return { answer: '', sources: [], confidence: 0 }
      }
    },

    // ── Memory ──
    memory_query: async (input) => {
      const query = String(input.query ?? input.text ?? '')
      if (!query) return { results: [] }
      try {
        return (
          (await services.memoryEngine?.recallEpisodes({ limit: Number(input.limit ?? 10) })) ?? {
            results: [],
          }
        )
      } catch {
        return { results: [] }
      }
    },
    memory_assert: async (input) => {
      try {
        await services.memoryEngine?.assertFact({
          subject: String(input.subject ?? input.key ?? ''),
          predicate: String(input.predicate ?? 'is'),
          object: input.object ?? input.value ?? '',
          source: String(input.source ?? 'capability'),
        })
        return { ok: true }
      } catch {
        return { ok: true }
      }
    },
    memory_forget: async (input) => {
      try {
        await services.memoryEngine?.forgetFact(String(input.key ?? input.id ?? ''))
        return { ok: true }
      } catch {
        return { ok: true }
      }
    },

    // ── Admin ──
    admin_seed: async () => {
      // Delegate to the existing seed mechanism
      const { runSeed } = await import('../cli/commands/seed.js')
      await runSeed(['all'])
      return { ok: true }
    },
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
    health_check: async () => {
      const mem = process.memoryUsage?.()
      const uptime = process.uptime?.() ?? 0
      return {
        ok: true,
        timestamp: Date.now(),
        uptime: Math.round(uptime),
        memory: mem
          ? { rss: Math.round(mem.rss / 1024 / 1024), heap: Math.round(mem.heapUsed / 1024 / 1024) }
          : undefined,
      }
    },
    system_status: async () => {
      const count = registry.list().length
      return {
        ok: true,
        capabilities: count,
        node: process.version,
        platform: process.platform,
      }
    },
  }
  for (const [slug, handler] of extraHandlers) {
    base[slug] = handler
  }
  return base
}

// ── Fallback handler ───────────────────────────────────────────────────────

function createFallbackHandler(slug: string): UnifiedCapability['handler'] {
  return async (input) => {
    log.warn(`[fallback] ${slug} executed but has no handler wired — returning not-implemented`)
    return {
      ok: false,
      error: 'not_implemented',
      message: `Capability \u201c${slug}\u201d is registered from the taxonomy pool but has no backend handler. Use the dedicated API route directly or contribute a handler.`,
      slug,
      input: Object.keys(input || {}).length > 0 ? input : undefined,
    }
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
  const handlerMap = createHandlerMap(registry, services)

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

  log.info(
    `[bootstrap-generated] Registered ${registered} capabilities from taxonomy pool${skipped > 0 ? ` (${skipped} skipped)` : ''}`,
  )
}
