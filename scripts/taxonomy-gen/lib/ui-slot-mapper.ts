// scripts/taxonomy-gen/lib/ui-slot-mapper.ts
// Round 3: Maps capability nodes to UI slot metadata.
// Computes ui_component, ui_position, ui_order, interaction_mode, etc.
// from capability kind + category using default tables.

import type { CapabilityNode, TaxonomyNode } from './taxonomy-model.ts'

export interface UIMapping {
  ui_component: string
  ui_label: string
  ui_icon: string
  ui_position: string
  ui_order: number
  ui_group: string
  ui_layer_depth: number
  ui_priority: string
  interaction_mode: string
  ui_states_json: string
  ui_visibility_rule: string | null
  ui_input_schema: string
  result_component: string
  result_layout: string
}

// ── Default component by capability kind ──────────────────────────────────

const KIND_DEFAULTS: Record<string, { component: string; mode: string; result: string; layout: string }> = {
  action:     { component: 'action-button',     mode: 'button',     result: 'text',      layout: 'single' },
  query:      { component: 'result-card',        mode: 'card',       result: 'card',      layout: 'grid' },
  state:      { component: 'status-indicator',   mode: 'indicator',  result: 'indicator', layout: 'inline' },
  config:     { component: 'settings-panel',     mode: 'panel',      result: 'form',      layout: 'single' },
  navigation: { component: 'nav-item',           mode: 'link',       result: 'text',      layout: 'single' },
}

// ── Default position by category ─────────────────────────────────────────
// Position values MUST be real SLOT_IDs from web/ui/src/ui/slots.ts
// (namespaced `chat.*`). This is the FRONTEND=BACKEND invariant: the taxonomy
// pipeline may not invent slot ids the frontend registry does not expose.

const CATEGORY_POSITIONS: Record<string, { position: string; group: string; baseOrder: number }> = {
  conversation:      { position: 'chat.composer',   group: 'chat',      baseOrder: 1 },
  chrome:            { position: 'chat.actionBar',  group: 'chrome',    baseOrder: 100 },
  memory:            { position: 'chat.sidebar',    group: 'memory',    baseOrder: 200 },
  knowledge:         { position: 'chat.thread',     group: 'knowledge', baseOrder: 50 },
  telemetry:         { position: 'chat.header',     group: 'telemetry', baseOrder: 10 },
  workflow:          { position: 'chat.actionBar',  group: 'workflow',  baseOrder: 100 },
  kernel:            { position: 'chat.header',     group: 'system',    baseOrder: 10 },
  provider:          { position: 'chat.sidebar',    group: 'provider',  baseOrder: 200 },
  canvas:            { position: 'chat.thread',     group: 'canvas',    baseOrder: 50 },
  mcp:               { position: 'chat.header',     group: 'mcp',       baseOrder: 10 },
  browser:           { position: 'chat.actionBar',  group: 'browser',   baseOrder: 100 },
  data:              { position: 'chat.thread',     group: 'data',      baseOrder: 50 },
  // ── 10x expansion categories ──
  ecommerce:         { position: 'chat.actionBar',  group: 'ecommerce', baseOrder: 100 },
  finance:           { position: 'chat.actionBar',  group: 'finance',   baseOrder: 100 },
  education:         { position: 'chat.thread',     group: 'education', baseOrder: 50 },
  healthcare:        { position: 'chat.thread',     group: 'healthcare', baseOrder: 50 },
  gaming:            { position: 'chat.actionBar',  group: 'gaming',    baseOrder: 100 },
  media:             { position: 'chat.thread',     group: 'media',     baseOrder: 50 },
  travel:            { position: 'chat.actionBar',  group: 'travel',    baseOrder: 100 },
  cloud_devops:      { position: 'chat.actionBar',  group: 'devops',    baseOrder: 100 },
  design:            { position: 'chat.thread',     group: 'design',    baseOrder: 50 },
  crm:               { position: 'chat.actionBar',  group: 'crm',       baseOrder: 100 },
  analytics:         { position: 'chat.thread',     group: 'analytics', baseOrder: 50 },
  docs_wiki:         { position: 'chat.thread',     group: 'docs',      baseOrder: 50 },
  email:             { position: 'chat.thread',     group: 'email',     baseOrder: 50 },
  calendar:          { position: 'chat.actionBar',  group: 'calendar',  baseOrder: 100 },
  ai_chatbot:        { position: 'chat.composer',   group: 'ai',        baseOrder: 1 },
  social_feed:       { position: 'chat.thread',     group: 'social',    baseOrder: 50 },
  social_messaging:  { position: 'chat.composer',   group: 'social',    baseOrder: 1 },
  ai_tooling:        { position: 'chat.thread',     group: 'ai_tool',   baseOrder: 50 },
  agentic_agent:     { position: 'chat.composer',   group: 'agent',     baseOrder: 1 },
  productivity:      { position: 'chat.thread',     group: 'productivity', baseOrder: 50 },
  browser_automation:{ position: 'chat.actionBar',  group: 'automation', baseOrder: 100 },
  dating:            { position: 'chat.thread',     group: 'dating',    baseOrder: 50 },
  forum:             { position: 'chat.thread',     group: 'forum',     baseOrder: 50 },
  ide:               { position: 'chat.thread',     group: 'ide',       baseOrder: 50 },
}

// ── Order offset by kind ─────────────────────────────────────────────────

const KIND_ORDER_OFFSET: Record<string, number> = {
  action: 0,
  query: 5,
  state: 10,
  config: 15,
  navigation: 20,
}

/**
 * Map a capability node to UI slot metadata.
 * Returns null if the node is not a capability.
 */
export function mapCapabilityToUI(node: TaxonomyNode): UIMapping | null {
  if (node.kind !== 'capability') return null

  const kindDefaults = KIND_DEFAULTS[node.capabilityKind] ?? KIND_DEFAULTS.action
  const catPos = CATEGORY_POSITIONS[node.category] ?? {
    position: 'chat.actionBar',
    group: node.category,
    baseOrder: 100,
  }
  const kindOffset = KIND_ORDER_OFFSET[node.capabilityKind] ?? 0

  const ui_component = node.ui_component ?? kindDefaults.component
  const ui_position = node.ui_position ?? catPos.position
  const ui_order = node.ui_order ?? catPos.baseOrder + kindOffset
  const ui_group = node.ui_group ?? catPos.group
  const interaction_mode = node.interaction_mode ?? kindDefaults.mode

  const ui_visibility_rule = computeVisibilityRule(node)
  const ui_states_json = JSON.stringify(computeStates(node))

  return {
    ui_component,
    ui_label: node.ui_label ?? node.label,
    ui_icon: node.ui_icon ?? '',
    ui_position,
    ui_order,
    ui_group,
    ui_layer_depth: node.ui_layer_depth ?? 0,
    ui_priority: node.ui_priority ?? 'normal',
    interaction_mode,
    ui_states_json,
    ui_visibility_rule,
    ui_input_schema: node.ui_input_schema ?? '{}',
    result_component: node.result_component ?? kindDefaults.result,
    result_layout: node.result_layout ?? kindDefaults.layout,
  }
}

/**
 * Compute visibility rule from platform bindings.
 * Returns null if no special visibility is needed.
 */
function computeVisibilityRule(node: CapabilityNode): string | null {
  const bindings = node.platformBindings ?? []
  if (bindings.length === 0) return null

  const scopes = bindings
    .map(b => b.authScope)
    .filter((s): s is string => s !== null && s !== undefined)

  if (scopes.length > 0) {
    return `auth:${scopes.join(',')}`
  }

  return null
}

/**
 * Compute state machine from capability kind.
 */
function computeStates(node: CapabilityNode): Record<string, string[]> {
  const states: Record<string, string[]> = {
    idle: ['idle'],
    loading: ['loading'],
    success: ['success'],
    error: ['error'],
  }

  if (node.capabilityKind === 'action') {
    states.confirming = ['confirming']
    states.pending = ['pending']
  }

  return states
}

/**
 * Apply UI mapping to a capability node (mutates in place).
 */
export function applyUIMapping(node: TaxonomyNode, mapping: UIMapping): void {
  if (node.kind !== 'capability') return

  node.ui_component = mapping.ui_component
  node.ui_label = mapping.ui_label
  node.ui_icon = mapping.ui_icon
  node.ui_position = mapping.ui_position
  node.ui_order = mapping.ui_order
  node.ui_group = mapping.ui_group
  node.ui_layer_depth = mapping.ui_layer_depth
  node.ui_priority = mapping.ui_priority
  node.interaction_mode = mapping.interaction_mode
  node.ui_states_json = mapping.ui_states_json
  node.ui_visibility_rule = mapping.ui_visibility_rule
  node.ui_input_schema = mapping.ui_input_schema
  node.result_component = mapping.result_component
  node.result_layout = mapping.result_layout
}

/**
 * Run Round 3 UI mapping on all capability nodes in a document.
 * Returns the number of nodes mapped.
 */
export function runUIMapping(nodes: TaxonomyNode[]): number {
  let mapped = 0
  for (const node of nodes) {
    if (node.kind !== 'capability') continue
    const mapping = mapCapabilityToUI(node)
    if (mapping) {
      applyUIMapping(node, mapping)
      mapped++
    }
  }
  return mapped
}
