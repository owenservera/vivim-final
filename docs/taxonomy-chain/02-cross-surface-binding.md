# Round 4: Cross-Surface Binding — Detailed Spec

**Purpose:** For every capability node, generate the complete `UnifiedCapability` spec including CLI command, API endpoint, MCP tool name, UI action, and workflow node type — all derived from the single `slug`.

---

## 1. Input / Output

**Input:**
- `pool.taxonomy.json` — all capability nodes (with Round 3 UI data attached)
- Existing `makeCapability` pattern from `capability-bootstrap.ts`

**Output:**
- Each capability node gains cross-surface fields:
  ```
  id, cliCommand, apiEndpoint, mcpToolName, uiAction,
  workflowNodeType, surfaces, isAsync, requiresConfirmation
  ```

---

## 2. Generation Rules

### 2.1 Capability ID

```typescript
function generateId(node: CapabilityNode): string {
  // slug: "conversation_send" → id: "cap:conversation:send"
  const parts = node.slug.split('_')
  return `cap:${parts.slice(0, -1).join(':')}:${parts[parts.length - 1]}`
}
```

### 2.2 CLI Command

```typescript
function generateCLICommand(node: CapabilityNode): { name: string; aliases: string[]; examples: string[] } {
  const parts = node.slug.split('_')
  const name = parts.join(' ')                    // "conversation send"
  const aliases = [parts.map(p => p[0]).join('')] // ["cs"]
  const examples = [`${aliases[0]} <args>`]
  return { name, aliases, examples }
}
```

### 2.3 API Endpoint

```typescript
function generateAPIEndpoint(node: CapabilityNode): { method: string; path: string } {
  const kind = node.capabilityKind
  const category = node.category
  const action = node.slug.split('_').slice(1).join('_')

  const method = kind === 'query' ? 'GET'
    : kind === 'config' ? 'PUT'
    : kind === 'navigation' ? 'GET'
    : 'POST'

  const path = `/api/${category}/${action}`
  return { method, path }
}
```

### 2.4 MCP Tool Name

```typescript
function generateMCPToolName(node: CapabilityNode): string {
  return node.slug  // "conversation_send"
}
```

### 2.5 UI Action

```typescript
function generateUIAction(node: CapabilityNode): { component: string; position: string; order: number } | undefined {
  if (node.capabilityKind !== 'action') return undefined
  return {
    component: node.ui_component ?? 'action-button',
    position: node.ui_position ?? 'sidebar',
    order: node.ui_order ?? 100,
  }
}
```

### 2.6 Workflow Node Type

```typescript
function generateWorkflowNodeType(node: CapabilityNode): string | undefined {
  if (node.capabilityKind === 'action') return 'action'
  if (node.capabilityKind === 'query') return 'query'
  if (node.capabilityKind === 'config') return 'config'
  if (node.capabilityKind === 'navigation') return 'navigation'
  return undefined
}
```

### 2.7 Surfaces Determination

```typescript
function determineSurfaces(node: CapabilityNode): CapabilitySurface[] {
  const surfaces: CapabilitySurface[] = ['cli', 'ui', 'api']  // always present

  if (node.mcpToolName) surfaces.push('mcp')
  if (node.workflowNodeType) surfaces.push('workflow')

  return surfaces
}
```

---

## 3. Implementation: `cross-surface-binder.ts`

```typescript
// scripts/taxonomy-gen/lib/cross-surface-binder.ts
// Round 4: Generates cross-surface bindings from capability slug.

import type { CapabilityNode, TaxonomyNode } from './taxonomy-model.ts'
import type { CapabilitySurface } from '../../../src/engines/unified-registry.ts'

interface CrossSurfaceBindings {
  id: string
  surfaces: CapabilitySurface[]
  cliCommand: { name: string; aliases: string[]; examples: string[] }
  apiEndpoint: { method: string; path: string }
  mcpToolName: string
  uiAction?: { component: string; position: string; order: number }
  workflowNodeType?: string
  isAsync: boolean
  requiresConfirmation: boolean
}

export function bindCrossSurface(node: TaxonomyNode): CrossSurfaceBindings | null {
  if (node.kind !== 'capability') return null

  const id = generateId(node)
  const cliCommand = generateCLICommand(node)
  const apiEndpoint = generateAPIEndpoint(node)
  const mcpToolName = generateMCPToolName(node)
  const uiAction = generateUIAction(node)
  const workflowNodeType = generateWorkflowNodeType(node)
  const surfaces = determineSurfaces(node, mcpToolName, workflowNodeType)

  return {
    id,
    surfaces,
    cliCommand,
    apiEndpoint,
    mcpToolName,
    uiAction,
    workflowNodeType,
    isAsync: true,
    requiresConfirmation: node.requiresConfirmation ?? false,
  }
}

function generateId(node: CapabilityNode): string {
  const parts = node.slug.split('_')
  return `cap:${parts.slice(0, -1).join(':')}:${parts[parts.length - 1]}`
}

function generateCLICommand(node: CapabilityNode): { name: string; aliases: string[]; examples: string[] } {
  const parts = node.slug.split('_')
  const name = parts.join(' ')
  const aliases = [parts.map(p => p[0]).join('')]
  const examples = [`${aliases[0]} <args>`]
  return { name, aliases, examples }
}

function generateAPIEndpoint(node: CapabilityNode): { method: string; path: string } {
  const method = node.capabilityKind === 'query' ? 'GET'
    : node.capabilityKind === 'config' ? 'PUT'
    : node.capabilityKind === 'navigation' ? 'GET'
    : 'POST'

  const action = node.slug.split('_').slice(1).join('_')
  const path = `/api/${node.category}/${action}`
  return { method, path }
}

function generateMCPToolName(node: CapabilityNode): string {
  return node.slug
}

function generateUIAction(node: CapabilityNode): { component: string; position: string; order: number } | undefined {
  if (node.capabilityKind !== 'action') return undefined
  return {
    component: node.ui_component ?? 'action-button',
    position: node.ui_position ?? 'sidebar',
    order: node.ui_order ?? 100,
  }
}

function generateWorkflowNodeType(node: CapabilityNode): string | undefined {
  if (node.capabilityKind === 'action') return 'action'
  if (node.capabilityKind === 'query') return 'query'
  if (node.capabilityKind === 'config') return 'config'
  if (node.capabilityKind === 'navigation') return 'navigation'
  return undefined
}

function determineSurfaces(
  node: CapabilityNode,
  mcpToolName: string,
  workflowNodeType: string | undefined,
): CapabilitySurface[] {
  const surfaces: CapabilitySurface[] = ['cli', 'ui', 'api']
  if (mcpToolName) surfaces.push('mcp')
  if (workflowNodeType) surfaces.push('workflow')
  return surfaces
}
```

---

## 4. Integration with makeCapability

After Round 4, the pool contains complete `UnifiedCapability` specs. The generated bootstrap:

```typescript
// src/engines/capability-bootstrap-generated.ts
import { pool } from '../../seeds/taxonomy/pool.taxonomy.json'
import { makeCapability } from './capability-bootstrap.js'
import type { BootstrapServices } from './capability-bootstrap.js'
import type { UnifiedCapabilityRegistry, UnifiedCapability } from './unified-registry.ts'

export function registerGeneratedCapabilities(
  registry: UnifiedCapabilityRegistry,
  services: BootstrapServices,
): void {
  const caps = pool.nodes.filter(n => n.kind === 'capability')

  for (const node of caps) {
    const partial: Omit<UnifiedCapability, 'handler'> = {
      id: node.id,
      slug: node.slug,
      name: node.name,
      description: node.description,
      category: node.category,
      surfaces: node.surfaces,
      inputSchema: node.inputSchema ?? { type: 'object', properties: {} },
      outputSchema: node.outputSchema ?? { type: 'object' },
      cliCommand: node.cliCommand,
      ui: node.ui,
      uiAction: node.uiAction,
      mcpToolName: node.mcpToolName,
      apiEndpoint: node.apiEndpoint,
      workflowNodeType: node.workflowNodeType,
      isAsync: node.isAsync,
      requiresConfirmation: node.requiresConfirmation,
      tags: node.tags ?? [],
    }

    const handler = resolveHandler(node, services)
    registry.register(makeCapability(partial, handler))
  }
}

function resolveHandler(
  node: TaxonomyNode,
  services: BootstrapServices,
): UnifiedCapability['handler'] {
  // Map capability slug to the appropriate service method
  // This is the "last mile" that connects generated specs to real code
  const handlerMap: Record<string, (input: Record<string, unknown>) => Promise<unknown>> = {
    conversation_list: (input) => services.conversationStore.listConversations({
      providerId: input.providerId ? String(input.providerId) : undefined,
      limit: 100,
    }),
    conversation_create: (input) => services.conversationStore.createConversation({
      providerSessionId: String(input.providerId ?? ''),
      providerId: String(input.providerId ?? ''),
      title: input.title ? String(input.title) : null,
    }).then(c => ({ id: c.id })),
    conversation_send: (input) => services.conversationManager.send(
      String(input.conversationId ?? ''),
      String(input.message ?? ''),
    ).then(r => ({ ok: r.ok, text: r.text ?? null, error: r.error ?? null })),
    // ... more handlers
  }

  return handlerMap[node.slug] ?? (() => {
    throw new Error(`No handler registered for capability: ${node.slug}`)
  })
}
```

---

## 5. Verification

After Round 4 completes:
1. Every capability node has a valid `id` (format: `cap:<category>:<action>`)
2. Every capability node has `surfaces` array with at least `['cli', 'ui', 'api']`
3. Every capability node has `cliCommand` with non-empty `name`
4. Every capability node has `apiEndpoint` with valid HTTP method and path
5. Every capability node has `mcpToolName` matching its slug
6. No duplicate IDs across all capability nodes
7. No duplicate slugs across all capability nodes
8. All API paths follow `/api/<category>/<action>` convention
