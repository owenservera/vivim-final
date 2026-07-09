// tests/unit/engines/capability-resolution.test.ts
// Unit 4.3 — CapabilityResolutionEngine: 3-layer override chain, grouping,
// plan-tier gating, existential rules, dependency satisfaction, search.

import { describe, expect, it, mock } from 'bun:test'
import { CapabilityResolutionEngine } from '../../../src/engines/capability-resolution.js'
import type {
  CapabilityResolutionStore,
  RawResolutionRow,
} from '../../../src/storage/contracts/capability-resolution-store.js'

function makeRow(overrides: Partial<RawResolutionRow> = {}): RawResolutionRow {
  return {
    id: 'cap_1',
    slug: 'send_message',
    name: 'Send Message',
    category: 'messaging',
    ui_component: 'action_button',
    ui_label: 'Send',
    ui_icon: 'send',
    ui_position: 'composer',
    ui_order: 0,
    ui_group: 'default',
    ui_layer_depth: 0,
    parent_capability_id: null,
    ui_priority: 'primary',
    interaction_mode: 'single_click',
    ui_states_json: '["idle","loading"]',
    ui_visibility_rule: null,
    existential_rule: null,
    ui_input_schema: '{}',
    mutation_effects_json: '{}',
    recovery_behavior: 'retry_manual',
    state_persistence: 'none',
    data_flow: 'user_to_provider',
    min_plan_tier: 'free',
    depends_on_json: '[]',
    concurrency_safe: 0,
    op_classification: null,
    requires_user_confirmation: 0,
    max_result_size: 100000,
    result_component: 'text_block',
    result_layout: 'inline',
    search_hints_json: '[]',
    aliases_json: '[]',
    availability_json: '{}',
    prefetch: 0,
    component_from: 'global',
    label_from: 'global',
    icon_from: 'global',
    position_from: 'global',
    order_from: 'global',
    group_from: 'global',
    priority_from: 'global',
    interaction_from: 'global',
    states_from: 'global',
    visibility_from: 'global',
    existential_from: 'global',
    input_schema_from: 'global',
    mutation_from: 'global',
    recovery_from: 'global',
    persistence_from: 'global',
    data_flow_from: 'global',
    plan_tier_from: 'global',
    depends_from: 'global',
    binding_status: 'stable',
    binding_confidence: 0.95,
    tier_max_models: null,
    tier_max_file_size: null,
    tier_config_json: null,
    tier_max_options: null,
    ...overrides,
  }
}

function mockStore(
  rows: RawResolutionRow[],
  opts?: { activeBindings?: string[]; searchRows?: RawResolutionRow[] },
): CapabilityResolutionStore {
  return {
    resolveCapabilities: mock(async () => rows),
    getActiveBindings: mock(async () => opts?.activeBindings ?? []),
    searchCapabilities: mock(async () => opts?.searchRows ?? rows),
  }
}

describe('CapabilityResolutionEngine', () => {
  it('resolve() returns capabilities grouped by ui_position', async () => {
    const rows = [
      makeRow({ id: 'c1', ui_position: 'composer' }),
      makeRow({ id: 'c2', slug: 'export', ui_position: 'header' }),
      makeRow({ id: 'c3', slug: 'copy', ui_position: 'message' }),
    ]
    const engine = new CapabilityResolutionEngine(mockStore(rows))
    const result = await engine.resolve('claude', 'free')
    expect(result.composer).toHaveLength(1)
    expect(result.header).toHaveLength(1)
    expect(result.message).toHaveLength(1)
    expect(result.total).toBe(3)
    expect(result.resolvedAt).toBeGreaterThan(0)
  })

  it('sorts within a group by ui_group then ui_order', async () => {
    const rows = [
      makeRow({ id: 'a', slug: 'a', ui_group: 'b', ui_order: 0 }),
      makeRow({ id: 'b', slug: 'b', ui_group: 'a', ui_order: 5 }),
      makeRow({ id: 'c', slug: 'c', ui_group: 'a', ui_order: 1 }),
    ]
    const engine = new CapabilityResolutionEngine(mockStore(rows))
    const result = await engine.resolve('claude', 'free')
    expect(result.composer.map((c) => c.id)).toEqual(['c', 'b', 'a'])
  })

  it('tracks override sources per field (provider > tier > global)', async () => {
    const rows = [
      makeRow({
        component_from: 'provider',
        label_from: 'tier',
        icon_from: 'global',
      }),
    ]
    const engine = new CapabilityResolutionEngine(mockStore(rows))
    const result = await engine.resolve('claude', 'free')
    const cap = result.composer[0]
    expect(cap?.overrideSources.uiComponent).toBe('provider')
    expect(cap?.overrideSources.uiLabel).toBe('tier')
    expect(cap?.overrideSources.uiIcon).toBe('global')
  })

  it('plan tier gating excludes pro-gated capabilities for free tier', async () => {
    const rows = [
      makeRow({ id: 'free_cap', slug: 'free_cap', min_plan_tier: 'free' }),
      makeRow({ id: 'pro_cap', slug: 'pro_cap', min_plan_tier: 'pro' }),
    ]
    const engine = new CapabilityResolutionEngine(mockStore(rows))
    const free = await engine.resolve('claude', 'free')
    expect(free.total).toBe(1)
    expect(free.composer[0]?.id).toBe('free_cap')

    const pro = await engine.resolve('claude', 'pro')
    expect(pro.total).toBe(2)
  })

  it('existential rule filters capabilities not relevant to current context', async () => {
    const rows = [
      makeRow({ id: 'always', slug: 'always', existential_rule: null }),
      makeRow({ id: 'needs_conv', slug: 'needs_conv', existential_rule: 'hasConversation' }),
    ]
    const engine = new CapabilityResolutionEngine(mockStore(rows))

    const withoutConv = await engine.resolve('claude', 'free', {
      conversationContext: { hasConversation: false },
    })
    expect(withoutConv.total).toBe(1)
    expect(withoutConv.composer[0]?.id).toBe('always')

    const withConv = await engine.resolve('claude', 'free', {
      conversationContext: { hasConversation: true },
    })
    expect(withConv.total).toBe(2)
  })

  it('dependency satisfaction excludes capabilities whose deps have no active binding', async () => {
    const rows = [
      makeRow({ id: 'base', slug: 'base', depends_on_json: '[]' }),
      makeRow({ id: 'dependent', slug: 'dependent', depends_on_json: '["base"]' }),
      makeRow({ id: 'orphan', slug: 'orphan', depends_on_json: '["missing"]' }),
    ]
    const engine = new CapabilityResolutionEngine(mockStore(rows, { activeBindings: ['base'] }))
    const result = await engine.resolve('claude', 'free')
    const ids = result.composer.map((c) => c.id)
    expect(ids).toContain('base')
    expect(ids).toContain('dependent')
    expect(ids).not.toContain('orphan')
  })

  it('respects explicit activeBindings passed via options', async () => {
    const rows = [makeRow({ id: 'dependent', slug: 'dependent', depends_on_json: '["base"]' })]
    const store = mockStore(rows, { activeBindings: [] })
    const engine = new CapabilityResolutionEngine(store)
    const result = await engine.resolve('claude', 'free', { activeBindings: ['base'] })
    expect(result.total).toBe(1)
    expect(store.getActiveBindings).not.toHaveBeenCalled()
  })

  it('search() returns capabilities matching name / hints / aliases', async () => {
    const searchRows = [
      makeRow({ id: 'model', slug: 'select_model', name: 'Select Model' }),
      makeRow({
        id: 'hinted',
        slug: 'switcher',
        name: 'Switcher',
        search_hints_json: '["model","llm"]',
      }),
      makeRow({ id: 'other', slug: 'export', name: 'Export' }),
    ]
    const engine = new CapabilityResolutionEngine(mockStore([], { searchRows }))
    const result = await engine.search('claude', 'free', 'model')
    const ids = result.composer.map((c) => c.id)
    expect(ids).toContain('model')
    expect(ids).toContain('hinted')
    expect(ids).not.toContain('other')
    expect(result.total).toBe(2)
  })

  it('parses vCode fields and tier overrides from raw rows', async () => {
    const rows = [
      makeRow({
        concurrency_safe: 1,
        requires_user_confirmation: 1,
        prefetch: 1,
        op_classification: 'read',
        availability_json: '{"requiresLogin":true}',
        aliases_json: '["send"]',
        tier_max_models: 3,
        tier_config_json: '{"beta":true}',
      }),
    ]
    const engine = new CapabilityResolutionEngine(mockStore(rows))
    const cap = (await engine.resolve('claude', 'free')).composer[0]
    expect(cap?.concurrencySafe).toBe(true)
    expect(cap?.requiresUserConfirmation).toBe(true)
    expect(cap?.prefetch).toBe(true)
    expect(cap?.opClassification).toBe('read')
    expect(cap?.availability.requiresLogin).toBe(true)
    expect(cap?.aliases).toEqual(['send'])
    expect(cap?.tierOverrides.maxModels).toBe(3)
    expect(cap?.tierOverrides.customConfig).toEqual({ beta: true })
  })
})
