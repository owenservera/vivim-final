// tests/unit/engines/provider-registrar.test.ts
// Unit tests for ProviderRegistrar — uses mock ProviderStore.

import { beforeEach, describe, expect, it } from 'bun:test'
import { resolve } from 'node:path'
import {
  ProviderRegistrar,
  type ProviderRegistrarEventBus,
} from '../../../src/engines/provider-registrar.js'
import type { ProviderManifest } from '../../../src/schema/provider-manifest.js'
import type { ProviderDefinitionRow } from '../../../src/schema/types.js'
import type { ProviderStore } from '../../../src/storage/contracts/provider-store.js'

// ── Mock Store ──────────────────────────────────────────────────────────────────

function createMockStore(): ProviderStore & {
  calls: string[]
  defs: Map<string, ProviderDefinitionRow>
} {
  const calls: string[] = []
  const defs = new Map<string, ProviderDefinitionRow>()

  return {
    calls,
    defs,
    async upsertDefinition(def) {
      calls.push(`upsertDef:${def.slug}`)
      defs.set(def.id, def)
    },
    async upsertEndpoint(ep) {
      calls.push(`upsertEp:${ep.label}`)
    },
    async upsertParser(p) {
      calls.push(`upsertParser:${p.parser_name}`)
    },
    async upsertCapability(c) {
      calls.push(`upsertCap:${c.global_capability_id}`)
    },
    async upsertConfig(c) {
      calls.push(`upsertCfg:${c.config_key}`)
    },
    async upsertModel(m) {
      calls.push(`upsertModel:${m.model_slug}`)
    },
    async deleteProviderEndpoints() {
      calls.push('deleteEndpoints')
    },
    async deleteProviderParsers() {
      calls.push('deleteParsers')
    },
    async deleteProviderCapabilities() {
      calls.push('deleteCaps')
    },
    async deleteProviderConfigs() {
      calls.push('deleteConfigs')
    },
    async deleteProviderModels() {
      calls.push('deleteModels')
    },
    async getDefinition(id) {
      return defs.get(id) ?? null
    },
    async getDefinitionBySlug(slug) {
      for (const def of defs.values()) {
        if (def.slug === slug) return def
      }
      return null
    },
    async listDefinitions() {
      return [...defs.values()]
    },
  }
}

function createMockEventBus(): ProviderRegistrarEventBus & { events: unknown[] } {
  const events: unknown[] = []
  return {
    events,
    emit(event) {
      events.push(event)
    },
  }
}

const CLAUDE_MANIFEST: ProviderManifest = {
  provider: {
    slug: 'claude',
    display_name: 'Claude',
    description: 'Test provider',
    category: 'ai',
    provider_type: 'llm',
    website_url: 'https://claude.ai',
    auth_type: 'browser',
    has_multi_account: true,
    profile_strategy: 'per_account',
    capabilities: ['send_message', 'select_model'],
  },
  endpoints: [
    {
      label: 'Chat',
      url: 'https://claude.ai/chat',
      endpoint_type: 'chat',
      is_default: true,
      composer_type: 'prosemirror' as const,
      send_method: 'both' as const,
      content_editable: true,
    },
  ],
  parsers: [
    {
      name: 'Claude SSE Parser',
      file: 'claude/001.ts',
      version: 1,
      is_active: true,
      logic_type: 'file' as const,
    },
  ],
  models: [
    {
      slug: 'claude-sonnet-4',
      display_name: 'Sonnet 4',
      is_default: true,
      context_window: 200000,
      supports_streaming: false,
      supports_vision: false,
      supports_thinking: false,
      supports_tools: false,
    },
  ],
  capabilities_config: [{ global_capability_id: 'send_message' }],
  config: [{ key: 'base_url', value: 'https://claude.ai', type: 'string', is_secret: false }],
}

// ── Tests ───────────────────────────────────────────────────────────────────────

describe('ProviderRegistrar', () => {
  let store: ReturnType<typeof createMockStore>
  let eventBus: ReturnType<typeof createMockEventBus>
  let registrar: ProviderRegistrar

  const testSeedsDir = resolve(import.meta.dir, '../../../seeds/providers')

  beforeEach(() => {
    store = createMockStore()
    eventBus = createMockEventBus()
    registrar = new ProviderRegistrar(store, undefined, eventBus, testSeedsDir)
  })

  it('register() creates a new provider with all table types', async () => {
    const result = await registrar.register(CLAUDE_MANIFEST)

    expect(result.slug).toBe('claude')
    expect(result.status).toBe('created')
    expect(result.providerId).toBeTruthy()
    expect(result.tablesAffected).toContain('provider_definition')
    expect(result.tablesAffected).toContain('provider_endpoint')
    expect(result.tablesAffected).toContain('provider_parser')
    expect(result.tablesAffected).toContain('provider_model')
    expect(result.tablesAffected).toContain('provider_config')
    expect(result.rowsAdded).toBeGreaterThan(0)
  })

  it('register() updates an existing provider', async () => {
    await registrar.register(CLAUDE_MANIFEST)
    const result = await registrar.register(CLAUDE_MANIFEST)

    expect(result.status).toBe('updated')
    expect(result.slug).toBe('claude')
  })

  it('register() emits provider:seeded event', async () => {
    await registrar.register(CLAUDE_MANIFEST)

    const seededEvents = eventBus.events.filter(
      (e: unknown) =>
        typeof e === 'object' &&
        e !== null &&
        'type' in e &&
        (e as { type: string }).type === 'provider:seeded',
    )
    expect(seededEvents.length).toBe(1)
    const firstEvent = seededEvents[0] as Record<string, unknown>
    expect(firstEvent.capabilities).toBe(1)
  })

  it('register() deletes old child rows before upserting', async () => {
    await registrar.register(CLAUDE_MANIFEST)

    expect(store.calls).toContain('deleteEndpoints')
    expect(store.calls).toContain('deleteParsers')
    expect(store.calls).toContain('deleteCaps')
    expect(store.calls).toContain('deleteConfigs')
    expect(store.calls).toContain('deleteModels')
  })

  it('seedAll() scans seeds directory and returns SeedAllResult', async () => {
    const result = await registrar.seedAll()

    expect(result.seeded.length).toBeGreaterThan(0)
    expect(result.errors.length).toBe(0)

    const slugs = result.seeded.map((r) => r.slug)
    expect(slugs).toContain('claude')
    expect(slugs).toContain('chatgpt')
    expect(slugs).toContain('gemini')
    expect(slugs).toContain('deepseek')
    expect(slugs).toContain('studio-ai')
    expect(slugs).toContain('z-ai')
    expect(slugs).toContain('qwen')
  })

  it('seedAll() registers 8 providers', async () => {
    const result = await registrar.seedAll()
    expect(result.seeded.length).toBe(8)
  })

  it('seedProvider() seeds a single provider by slug', async () => {
    const result = await registrar.seedProvider('claude')

    expect(result.slug).toBe('claude')
    expect(result.status).toBe('created')
  })

  it('seedProvider() throws on missing file', async () => {
    await expect(registrar.seedProvider('nonexistent')).rejects.toThrow()
  })

  it('verifySeeds() detects valid manifests', async () => {
    const result = await registrar.verifySeeds()

    expect(result.valid).toBe(true)
    expect(result.providers.length).toBeGreaterThan(0)
    expect(result.providers.every((p) => p.status === 'ok')).toBe(true)
  })

  it('reloadFromSeeds() re-seeds all without duplicates', async () => {
    await registrar.seedAll()
    const result = await registrar.reloadFromSeeds()

    expect(result.seeded.length).toBe(8)
    // All should be 'updated' since they already exist
    expect(result.seeded.every((r) => r.status === 'updated')).toBe(true)
  })

  it('seedAll() handles empty seeds directory', async () => {
    const emptyRegistrar = new ProviderRegistrar(store, undefined, eventBus, '/tmp/nonexistent-dir')
    const result = await emptyRegistrar.seedAll()

    expect(result.seeded.length).toBe(0)
    expect(result.errors.length).toBeGreaterThan(0)
  })
})
