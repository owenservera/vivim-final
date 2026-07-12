// src/engines/unified-registry.ts
// UnifiedCapabilityRegistry — single registry where every capability is defined once
// and automatically exported to CLI, UI, workflow, MCP, and API surfaces.

import { EngineError } from '../errors.js'

// ── Types ───────────────────────────────────────────────────────────────

export type CapabilitySurface = 'cli' | 'ui' | 'workflow' | 'mcp' | 'api'

export interface CapabilityContext {
  conversationId?: string
  providerId?: string
  slaveId?: string
  userId?: string
  metadata: Record<string, unknown>
}

export interface UnifiedCapability {
  id: string
  slug: string
  name: string
  description: string
  category: string
  surfaces: CapabilitySurface[]
  inputSchema: Record<string, unknown>
  outputSchema: Record<string, unknown>
  handler: (input: Record<string, unknown>, ctx: CapabilityContext) => Promise<unknown>
  cliCommand?: { name: string; aliases: string[]; examples: string[] }
  ui?: {
    component: string
    position: string
    group?: string
    order: number
    icon?: string
    shortcut?: string
    requiresConfirmation?: boolean
  }
  uiAction?: { component: string; position: string; order: number }
  workflowNodeType?: string
  mcpToolName?: string
  apiEndpoint?: { method: string; path: string }
  isAsync: boolean
  requiresConfirmation: boolean
  tags: string[]
}

// ── Validation helpers ────────────────────────────────────────────────────

function validateCapability(cap: UnifiedCapability): void {
  if (!cap.id || !cap.slug || !cap.name) {
    throw new EngineError('Capability must have id, slug, and name')
  }
  if (typeof cap.handler !== 'function') {
    throw new EngineError(`Capability ${cap.id} must have a handler function`)
  }
  if (cap.surfaces.includes('cli') && !cap.cliCommand) {
    throw new EngineError(`Capability ${cap.id} exposed to CLI must have cliCommand`)
  }
  if (cap.surfaces.includes('mcp') && !cap.mcpToolName) {
    throw new EngineError(`Capability ${cap.id} exposed to MCP must have mcpToolName`)
  }
  if (cap.surfaces.includes('api') && !cap.apiEndpoint) {
    throw new EngineError(`Capability ${cap.id} exposed to API must have apiEndpoint`)
  }
  if (cap.surfaces.includes('ui') && !cap.ui && !cap.uiAction) {
    throw new EngineError(`Capability ${cap.id} exposed to UI must have ui or uiAction block`)
  }
}

// ── UnifiedCapabilityRegistry ─────────────────────────────────────────────

export class UnifiedCapabilityRegistry {
  private capabilities = new Map<string, UnifiedCapability>()
  private slugIndex = new Map<string, UnifiedCapability>()

  register(capability: UnifiedCapability): void {
    validateCapability(capability)
    if (this.capabilities.has(capability.id)) {
      throw new EngineError(`Capability ${capability.id} already registered`)
    }
    if (this.slugIndex.has(capability.slug)) {
      throw new EngineError(`Slug ${capability.slug} already registered`)
    }
    this.capabilities.set(capability.id, capability)
    this.slugIndex.set(capability.slug, capability)
  }

  unregister(id: string): void {
    const cap = this.capabilities.get(id)
    if (!cap) throw new EngineError(`Capability ${id} not found`)
    this.capabilities.delete(id)
    this.slugIndex.delete(cap.slug)
  }

  get(id: string): UnifiedCapability | null {
    return this.capabilities.get(id) ?? null
  }

  getBySlug(slug: string): UnifiedCapability | null {
    return this.slugIndex.get(slug) ?? null
  }

  list(filter?: {
    surface?: CapabilitySurface
    category?: string
    tag?: string
  }): UnifiedCapability[] {
    let result = Array.from(this.capabilities.values())
    if (filter?.surface) {
      result = result.filter((c) => c.surfaces.includes(filter.surface!))
    }
    if (filter?.category) {
      result = result.filter((c) => c.category === filter.category)
    }
    if (filter?.tag) {
      result = result.filter((c) => c.tags.includes(filter.tag!))
    }
    return result
  }

  async execute(
    id: string,
    input: Record<string, unknown>,
    ctx: CapabilityContext,
  ): Promise<unknown> {
    const cap = this.capabilities.get(id)
    if (!cap) throw new EngineError(`Capability ${id} not found`)

    // Basic input validation against inputSchema
    const required = (cap.inputSchema.required as string[]) ?? []
    for (const key of required) {
      if (!(key in input)) {
        throw new EngineError(`Missing required input: ${key}`)
      }
    }

    return cap.handler(input, ctx)
  }

  exportForCli(): Array<{
    name: string
    aliases: string[]
    description: string
    schema: Record<string, unknown>
  }> {
    return this.list({ surface: 'cli' }).map((cap) => ({
      name: cap.cliCommand?.name ?? cap.slug,
      aliases: cap.cliCommand?.aliases ?? [],
      description: cap.description,
      schema: cap.inputSchema,
    }))
  }

  exportForMcp(): Array<{
    name: string
    description: string
    inputSchema: Record<string, unknown>
  }> {
    return this.list({ surface: 'mcp' }).map((cap) => ({
      name: cap.mcpToolName ?? cap.slug,
      description: cap.description,
      inputSchema: cap.inputSchema,
    }))
  }

  exportForUi(): Array<{
    id: string
    slug: string
    name: string
    ui: NonNullable<UnifiedCapability['ui']>
    inputSchema: Record<string, unknown>
    apiEndpoint?: { method: string; path: string }
    requiresConfirmation: boolean
  }> {
    return this.list({ surface: 'ui' }).map((cap) => ({
      id: cap.id,
      slug: cap.slug,
      name: cap.name,
      ui: cap.ui!,
      inputSchema: cap.inputSchema,
      apiEndpoint: cap.apiEndpoint,
      requiresConfirmation: cap.requiresConfirmation,
    }))
  }
}
