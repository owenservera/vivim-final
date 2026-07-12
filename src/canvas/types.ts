// src/canvas/types.ts
// vivim-canvas — core domain types.
//
// The frontend is *data*, not *code* (P1). A `CanvasDefinition` is a row
// made of HTML, CSS, optional sandboxed JS, a binding spec, and a layout on
// an infinite plane. Layers are swappable on demand (P3), sandboxed (P8),
// composed from a closed set of core primitives (P6), and described by a living
// manifest (P9). The oracle home canvas sees all (P4); every op is a
// capability (P5); the Governor Canon holds — canvas never touches CDP.

// ── Closed core primitive set (P6) ──────────────────────────────────────
// Primitives are the vocabulary; layers are the sentences. This set is closed:
// new capability comes from new *compositions*, not new *frameworks*.
export type PrimitiveKind =
  | 'workspace'
  | 'projects'
  | 'knowledge'
  | 'agents'
  | 'providers'
  | 'conversations'

export const PRIMITIVE_KINDS: readonly PrimitiveKind[] = [
  'workspace',
  'projects',
  'knowledge',
  'agents',
  'providers',
  'conversations',
] as const

// ── Layer taxonomy (illustrative seed; grows at runtime via designer) ─────────
export type LayerCategory =
  | 'system'
  | 'chat'
  | 'automation'
  | 'agents'
  | 'projects'
  | 'knowledge'
  | 'designer'
  | 'plugin'

export const LAYER_CATEGORIES: readonly LayerCategory[] = [
  'system',
  'chat',
  'automation',
  'agents',
  'projects',
  'knowledge',
  'designer',
  'plugin',
] as const

export type LayerAuthor = 'system' | 'user' | 'agent'
export type LayerStatus = 'draft' | 'published' | 'deprecated'

// ── Sandbox policy (P8) ───────────────────────────────────────────────────
// Inline scripts are NEVER allowed — rejected at definition time AND render time.
export interface SandboxPolicy {
  csp: string
  allowNetwork: boolean
  // capability slugs whitelisted for this layer (empty = none)
  allowCapabilities: string[]
  // execution time budget in ms for the layer's sandboxed JS
  budgetMs: number
  // always false — expressed for clarity; enforced structurally
  allowInlineScript: false
}

// ── Binding spec: wires a DOM region to a primitive/capability I/O (P5/P6) ─
export interface LayerBinding {
  // region id within the layer's HTML (the mount target / a11y node)
  regionId: string
  // semantic role used for agent grounding + self-healing selectors (SOTA-05)
  role: string
  // CSS/accessibility selector locating the region in the live DOM
  selector: string
  // which core primitive this region reads/writes (mutually exclusive w/ capability)
  primitive?: PrimitiveKind
  // which capability slug this region drives (P5)
  capabilitySlug?: string
  direction: 'read' | 'write' | 'bidirectional'
}

// ── Infinite-plane layout (P3) ─────────────────────────────────────────────
export interface CanvasLayout {
  // absolute infinite-plane coordinates (never all-loaded, described always)
  x: number
  y: number
  z: number
  w: number
  h: number
  minimized?: boolean
  // semantic-zoom threshold: below this scale, render as map dot
  detailZoom?: number
}

// ── The definition: a row in the DB (P1) ────────────────────────────────
export interface CanvasDefinition {
  id: string
  slug: string
  name: string
  description: string
  category: LayerCategory
  version: number
  html: string
  css: string
  // sandboxed JS URL — never inline; loaded into an iframe (P8)
  scriptUrl?: string
  bindings: LayerBinding[]
  layout: CanvasLayout
  author: LayerAuthor
  sandbox: SandboxPolicy
  status: LayerStatus
  tags: string[]
  createdAt: number
  updatedAt: number
}

// Input type for the API boundary (domain types, not JSON strings)
export type CanvasDefinitionInput = Omit<CanvasDefinition, 'id' | 'version' | 'createdAt' | 'updatedAt'> & {
  id?: string
}

// ── Layer instance: runtime spawn (P3) ────────────────────────────────────
export type InstanceStatus = 'mounting' | 'live' | 'dismissed' | 'error'

export interface LayerInstance {
  instanceId: string
  definitionId: string
  slug: string
  category: LayerCategory
  status: InstanceStatus
  hostNodeId: string
  bindingsActive: string[]
  spawnedBy: LayerAuthor
  mountedAt: number
  dismissedAt?: number
}

// ── Living manifest (P9) ───────────────────────────────────────────────────
export interface RegionSpec {
  regionId: string
  role: string
  selector: string
  boundPrimitive?: PrimitiveKind
  boundCapability?: string
  readScope: 'oracle' | 'scoped'
}

export interface ManifestEntry {
  definitionId: string
  slug: string
  category: LayerCategory
  regions: RegionSpec[]
}

export interface OracleVisibility {
  providers: number
  engines: number
  openLayers: number
  projects: number
  knowledgeNodes: number
  agents: number
  health: Record<string, string>
}

export interface CanvasManifest {
  version: number
  generatedAt: number
  definitions: ManifestEntry[]
  oracle: OracleVisibility
}

// ── Sandbox bridge message protocol (P8) ─────────────────────────────────
// Host ⇄ sandboxed iframe over postMessage. The layer NEVER reaches into the
// host DOM and NEVER opens its own outbound channel.
export type BridgeMessage =
  | { type: 'bridge:ready'; instanceId: string }
  | {
      type: 'bridge:capability:request'
      instanceId: string
      requestId: string
      capability: string
      input: Record<string, unknown>
    }
  | {
      type: 'bridge:capability:response'
      instanceId: string
      requestId: string
      ok: boolean
      output?: unknown
      error?: string
    }
  | {
      type: 'bridge:observe:request'
      instanceId: string
      requestId: string
      primitive: PrimitiveKind
      query: Record<string, unknown>
    }
  | {
      type: 'bridge:observe:response'
      instanceId: string
      requestId: string
      ok: boolean
      data?: unknown
      error?: string
    }
  | {
      type: 'bridge:state:push'
      instanceId: string
      regionId: string
      state: unknown
    }
  | {
      type: 'bridge:state:apply'
      instanceId: string
      regionId: string
      state: unknown
    }
  | { type: 'bridge:error'; instanceId: string; error: string }

// ── Capability executor contract (P5) ─────────────────────────────────────
// Canvas engines NEVER import BunCdpClient / ChromeGovernor. All mutation flows
// through capabilities executed via this contract — single authority, Governed.
export interface CapabilityExecutor {
  execute(
    slug: string,
    input: Record<string, unknown>,
    ctx: { userId?: string; metadata: Record<string, unknown> },
  ): Promise<unknown>
}

// ── Primitive read contract (P6) ───────────────────────────────────────────
export interface PrimitiveReader {
  read(
    kind: PrimitiveKind,
    query: Record<string, unknown>,
  ): Promise<unknown>
}

// ── Oracle read provider (P4) ─────────────────────────────────────────────
export interface OracleReadProvider {
  visibility(): Promise<OracleVisibility>
}
