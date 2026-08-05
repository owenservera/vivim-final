// shared/canvas-types.ts
// Shared canvas types for both backend (Bun) and frontend (Vite).
// Mirrors the subset of src/canvas/types.ts needed by the browser layer.

export type PrimitiveKind =
  | 'workspace'
  | 'projects'
  | 'knowledge'
  | 'agents'
  | 'providers'
  | 'conversations'

export type LayerCategory =
  | 'system'
  | 'chat'
  | 'automation'
  | 'agents'
  | 'projects'
  | 'knowledge'
  | 'designer'
  | 'plugin'

export type LayerAuthor = 'system' | 'user' | 'agent'
export type LayerStatus = 'draft' | 'published' | 'deprecated'
export type InstanceStatus = 'mounting' | 'live' | 'dismissed' | 'error'

export interface SandboxPolicy {
  csp: string
  allowNetwork: boolean
  allowCapabilities: string[]
  budgetMs: number
  allowInlineScript: false
}

export interface CanvasLayout {
  x: number
  y: number
  z: number
  w: number
  h: number
  minimized?: boolean
  detailZoom?: number
}

export interface LayerBinding {
  regionId: string
  role: string
  selector: string
  primitive?: PrimitiveKind
  capabilitySlug?: string
  direction: 'read' | 'write' | 'bidirectional'
}

export interface CanvasDefinition {
  id: string
  slug: string
  name: string
  description: string
  category: LayerCategory
  version: number
  html: string
  css: string
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

/** The dumb shell surface the canvas mounts layers into. */
export interface LayerHost {
  mount(instanceId: string, def: CanvasDefinition): Promise<{ hostNodeId: string }>
  unmount(instanceId: string): Promise<void>
  isMounted(instanceId: string): boolean
}

// ── Layer management (P3) ─────────────────────────────────────────────────

export interface CanvasLayer {
  id: string
  name: string
  category: string
  z: number
  visible: boolean
  locked: boolean
  backgroundColor?: string
  defaultComponents: string[]
  layout: { x: number; y: number; z: number; w: number; h: number }
  createdAt: number
  updatedAt: number
}

// ── Sandbox audit event ──────────────────────────────────────────────────

export interface SandboxAuditEvent {
  type: 'csp_violation' | 'capability_denied' | 'crash' | 'watchdog_timeout'
  instanceId: string
  message?: string
  timestamp: number
}
