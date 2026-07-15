// scripts/taxonomy-gen/lib/cross-surface-binder.ts
// Round 4: Generates cross-surface bindings from capability slug.
// Produces CLI command, API endpoint, MCP tool name, UI action,
// workflow node type, and surfaces array — all from the single slug.

import type { CapabilityNode, TaxonomyNode, CapabilitySurface } from './taxonomy-model.ts'

export interface CrossSurfaceBindings {
  capId: string
  surfaces: CapabilitySurface[]
  cliCommand: { name: string; aliases: string[]; examples: string[] }
  apiEndpoint: { method: string; path: string }
  mcpToolName: string
  uiAction?: { component: string; position: string; order: number }
  workflowNodeType?: string
  isAsync: boolean
  requiresConfirmation: boolean
}

/**
 * Generate cross-surface bindings from a capability node's slug.
 * Returns null if the node is not a capability.
 */
export function bindCrossSurface(node: TaxonomyNode): CrossSurfaceBindings | null {
  if (node.kind !== 'capability') return null

  const capId = generateCapId(node)
  const cliCommand = generateCLICommand(node)
  const apiEndpoint = generateAPIEndpoint(node)
  const mcpToolName = generateMCPToolName(node)
  const uiAction = generateUIAction(node)
  const workflowNodeType = generateWorkflowNodeType(node)
  const surfaces = determineSurfaces(node, mcpToolName, workflowNodeType)

  return {
    capId,
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

/**
 * Generate capability ID in "cap:category:action" format.
 * slug: "conversation_send" → id: "cap:conversation:send"
 */
function generateCapId(node: CapabilityNode): string {
  const parts = node.slug.split('_')
  if (parts.length < 2) {
    // Single-segment slug (e.g. "help"): treat the slug itself as both
    // category and action so the id is still well-formed and slug-derived.
    return `cap:${node.slug}:${node.slug}`
  }
  const category = parts[0]
  const action = parts.slice(1).join('_')
  return `cap:${category}:${action}`
}

/**
 * Generate CLI command from slug.
 * slug: "conversation_send" → { name: "conversation send", aliases: ["cs"] }
 */
function generateCLICommand(node: CapabilityNode): { name: string; aliases: string[]; examples: string[] } {
  const parts = node.slug.split('_')
  const name = parts.join(' ')
  const aliases = [parts.map(p => p[0]).join('')]
  const examples = [`${aliases[0]} <args>`]
  return { name, aliases, examples }
}

/**
 * Generate API endpoint from category + slug.
 * Derives the category from the slug's first segment (consistent with capId),
 * so a missing `category` field never produces an `/api/undefined/...` path.
 */
function generateAPIEndpoint(node: CapabilityNode): { method: string; path: string } {
  const method = node.capabilityKind === 'query' ? 'GET'
    : node.capabilityKind === 'config' ? 'PUT'
    : node.capabilityKind === 'navigation' ? 'GET'
    : 'POST'

  const category = node.category && node.category.length > 0
    ? node.category
    : node.slug.split('_')[0]

  const path = `/api/${category}/${node.slug}`
  return { method, path }
}

/**
 * MCP tool name is the slug itself.
 */
function generateMCPToolName(node: CapabilityNode): string {
  return node.slug
}

/**
 * Generate UI action for action-kind capabilities.
 */
function generateUIAction(node: CapabilityNode): { component: string; position: string; order: number } | undefined {
  if (node.capabilityKind !== 'action') return undefined
  return {
    component: node.ui_component ?? 'action-button',
    position: node.ui_position ?? 'chat.sidebar',
    order: node.ui_order ?? 100,
  }
}

/**
 * Generate workflow node type from capability kind.
 */
function generateWorkflowNodeType(node: CapabilityNode): string | undefined {
  if (node.capabilityKind === 'action') return 'action'
  if (node.capabilityKind === 'query') return 'query'
  if (node.capabilityKind === 'config') return 'config'
  if (node.capabilityKind === 'navigation') return 'navigation'
  return undefined
}

/**
 * Determine which surfaces this capability is exposed to.
 */
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

/**
 * Apply cross-surface bindings to a capability node (mutates in place).
 */
export function applyCrossSurfaceBindings(node: TaxonomyNode, bindings: CrossSurfaceBindings): void {
  if (node.kind !== 'capability') return

  node.capId = bindings.capId
  node.surfaces = bindings.surfaces
  node.cliCommand = bindings.cliCommand
  node.apiEndpoint = bindings.apiEndpoint
  node.mcpToolName = bindings.mcpToolName
  node.uiAction = bindings.uiAction
  node.workflowNodeType = bindings.workflowNodeType
  node.isAsync = bindings.isAsync
  node.requiresConfirmation = bindings.requiresConfirmation
}

/**
 * Run Round 4 cross-surface binding on all capability nodes.
 * Returns the number of nodes bound.
 */
export function runCrossSurfaceBinding(nodes: TaxonomyNode[]): number {
  let bound = 0
  for (const node of nodes) {
    if (node.kind !== 'capability') continue
    const bindings = bindCrossSurface(node)
    if (bindings) {
      applyCrossSurfaceBindings(node, bindings)
      bound++
    }
  }
  return bound
}
