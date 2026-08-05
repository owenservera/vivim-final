/**
 * shared/workspace.ts
 * --------------------------------------------------------------------
 * Workspace visual taxonomy types (Phase 2 §2).
 *
 * Hierarchy: workspace → surface → region → node(card).
 * - A workspace is a "room" in 3D z-depth space.
 * - A surface is a 2D plane inside a workspace (chat / docs / automation / agents).
 * - A region is a named slot inside a surface (chat.composer, docs.viewer).
 * - A node is a rendered card on the canvas.
 *
 * There is ALWAYS a global workspace (`ws:global`). Users can create child
 * workspaces; switching re-couples routeSync under a new traceId.
 */

export type WorkspaceKind =
  | 'global'
  | 'standard'
  | 'automation'
  | 'agents'
  | 'docs'
  | 'media'
  | 'custom'

export interface WorkspaceSurface {
  id: string
  workspaceId: string
  slug: string
  displayName: string
  kind: 'chat' | 'docs' | 'media' | 'automation' | 'agents' | 'shell' | 'custom'
  zDepth: number // 3D z-axis: workspace stack depth
  layout: { x: number; y: number; z: number; w: number; h: number }
}

export interface WorkspaceRegion {
  id: string
  surfaceId: string
  slotId: string // matches SLOT_IDS (chat.*, docs.*, media.*, automation.*, agents.*, shell.*)
  required: boolean
  minInstances: number
  maxInstances: number
  accepts: string[] // accepted card kinds
}

export interface WorkspaceTaxonomy {
  id: string
  slug: string
  displayName: string
  kind: WorkspaceKind
  parentId: string | null // null = global
  zDepth: number // depth in the workspace stack (0 = global, 1 = first child, …)
  surfaces: WorkspaceSurface[]
  regions: WorkspaceRegion[]
  ownerId: string
  isDefault: boolean
  version: number
  createdAt: number
  updatedAt: number
}

/** Resolve precedence for workspace-scoped UI: workspace → surface → region → node. */
export const WORKSPACE_RESOLUTION_CHAIN = [
  'workspace+surface+region', // most specific: per-workspace, per-surface, per-region override
  'workspace+surface', // per-workspace, per-surface
  'workspace', // per-workspace
  'cross-workspace', // shared across all workspaces
  'system', // built-in default
] as const

export type WorkspaceResolutionTier = (typeof WORKSPACE_RESOLUTION_CHAIN)[number]

/** Seed defaults: 1 global workspace + N example children. */
export const GLOBAL_WORKSPACE_ID = 'ws:global'

export interface WorkspaceSwitchEvent {
  type: 'workspace:switched'
  traceId: string
  fromWorkspaceId: string | null
  toWorkspaceId: string
  userId: string
}
