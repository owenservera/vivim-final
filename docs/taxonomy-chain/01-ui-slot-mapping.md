# Round 3: UI Slot Mapping — Detailed Spec

**Purpose:** For every capability node produced by Round 2, compute and attach the UI metadata that the `CapabilityResolutionStore` needs to resolve frontend slots.

---

## 1. Input / Output

**Input:**
- `pool.taxonomy.json` — all capability nodes from Round 2
- `web/ui/src/ui/slots.ts` — canonical slot catalog (SLOT_IDS)
- `web/ui/src/ui/defaults/types.ts` — prop contracts per slot

**Output:**
- Each capability node gains UI fields:
  ```
  ui_component, ui_label, ui_icon, ui_position, ui_order,
  ui_group, ui_layer_depth, ui_priority, interaction_mode,
  ui_states_json, ui_visibility_rule, ui_input_schema,
  result_component, result_layout
  ```

---

## 2. Mapping Rules

### 2.1 Default Component by Capability Kind

| capabilityKind | Default `ui_component` | Default `interaction_mode` |
|---------------|----------------------|---------------------------|
| `action` | `action-button` | `button` |
| `query` | `result-card` | `card` |
| `state` | `status-indicator` | `indicator` |
| `config` | `settings-panel` | `panel` |
| `navigation` | `nav-item` | `link` |

### 2.2 Default Position by Category

| category | Default `ui_position` | Default `ui_group` |
|----------|---------------------|-------------------|
| `conversation` | `composer` | `chat` |
| `chrome` | `actionBar` | `chrome` |
| `memory` | `sidebar` | `memory` |
| `knowledge` | `thread` | `knowledge` |
| `telemetry` | `header` | `telemetry` |
| `workflow` | `actionBar` | `workflow` |
| `kernel` | `header` | `system` |
| `provider` | `sidebar` | `provider` |
| `canvas` | `thread` | `canvas` |
| `mcp` | `header` | `mcp` |

### 2.3 Order Computation

```
ui_order = base_order + category_offset + kind_offset

base_order:
  header:   10
  sidebar:  200
  composer: 1
  actionBar: 100
  thread:   50

category_offset:
  conversation: 0
  chrome: 10
  memory: 20
  knowledge: 30
  telemetry: 40
  workflow: 50

kind_offset:
  action: 0
  query: 5
  state: 10
  config: 15
  navigation: 20
```

### 2.4 Result Component Mapping

| capabilityKind | `result_component` | `result_layout` |
|---------------|-------------------|----------------|
| `action` | `text` | `single` |
| `query` | `card` | `grid` |
| `state` | `indicator` | `inline` |
| `config` | `form` | `single` |
| `navigation` | `text` | `single` |

### 2.5 Visibility Rules

```typescript
function computeVisibilityRule(node: CapabilityNode): string | null {
  // Providers that don't support this capability hide it
  if (node.platformBindings?.length === 0) return null

  // Capabilities requiring specific auth scopes
  const authScopes = node.platformBindings?.map(b => b.authScope).filter(Boolean)
  if (authScopes?.length) {
    return `auth:${authScopes.join(',')}`
  }

  return null
}
```

### 2.6 State Machine (ui_states_json)

```typescript
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
```

---

## 3. Implementation: `ui-slot-mapper.ts`

```typescript
// scripts/taxonomy-gen/lib/ui-slot-mapper.ts
// Round 3: Maps capability nodes to UI slot metadata.

import type { CapabilityNode, TaxonomyNode } from './taxonomy-model.ts'

interface UIMapping {
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

const KIND_DEFAULTS: Record<string, { component: string; mode: string; result: string; layout: string }> = {
  action:     { component: 'action-button',     mode: 'button',   result: 'text',   layout: 'single' },
  query:      { component: 'result-card',        mode: 'card',     result: 'card',   layout: 'grid' },
  state:      { component: 'status-indicator',   mode: 'indicator', result: 'indicator', layout: 'inline' },
  config:     { component: 'settings-panel',     mode: 'panel',    result: 'form',   layout: 'single' },
  navigation: { component: 'nav-item',           mode: 'link',     result: 'text',   layout: 'single' },
}

const CATEGORY_POSITIONS: Record<string, { position: string; group: string; baseOrder: number }> = {
  conversation: { position: 'composer',  group: 'chat',      baseOrder: 1 },
  chrome:       { position: 'actionBar', group: 'chrome',    baseOrder: 100 },
  memory:       { position: 'sidebar',   group: 'memory',    baseOrder: 200 },
  knowledge:    { position: 'thread',    group: 'knowledge', baseOrder: 50 },
  telemetry:    { position: 'header',    group: 'telemetry', baseOrder: 10 },
  workflow:     { position: 'actionBar', group: 'workflow',  baseOrder: 100 },
  kernel:       { position: 'header',    group: 'system',    baseOrder: 10 },
  provider:     { position: 'sidebar',   group: 'provider',  baseOrder: 200 },
  canvas:       { position: 'thread',    group: 'canvas',    baseOrder: 50 },
  mcp:          { position: 'header',    group: 'mcp',       baseOrder: 10 },
}

const KIND_ORDER_OFFSET: Record<string, number> = {
  action: 0,
  query: 5,
  state: 10,
  config: 15,
  navigation: 20,
}

export function mapCapabilityToUI(node: TaxonomyNode): UIMapping | null {
  if (node.kind !== 'capability') return null

  const kindDefaults = KIND_DEFAULTS[node.capabilityKind] ?? KIND_DEFAULTS.action
  const catPos = CATEGORY_POSITIONS[node.category] ?? {
    position: 'actionBar',
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
    ui_label: node.name,
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

function computeVisibilityRule(node: CapabilityNode): string | null {
  const bindings = node.platformBindings ?? []
  if (bindings.length === 0) return null
  const scopes = bindings.map(b => b.authScope).filter(Boolean)
  if (scopes.length > 0) return `auth:${scopes.join(',')}`
  return null
}

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
```

---

## 4. Verification

After Round 3 completes:
1. Every capability node has `ui_component` set (no null)
2. Every capability node has `ui_position` matching a slot in `SLOT_IDS`
3. `ui_order` values are unique per `ui_position` (no collisions)
4. `ui_states_json` is valid JSON with required state keys
5. No capability has `ui_visibility_rule` that references a non-existent auth scope
