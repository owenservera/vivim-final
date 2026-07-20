// devops/toolkit/surface-parity.ts
//
// Single source of truth for the FRONTEND = BACKEND = SDK = CLI = API parity model.
//
// Every capability in vivim-final is defined ONCE and projected onto four
// runtime surfaces (cli, api, sdk, ui) plus two derived surfaces (mcp, workflow).
// A capability is "in parity" when its slug binds to a coherent set of surface
// specs with no undefined/empty fields, and the projection rules below hold.
//
// This module is the canonical projection engine. `scripts/verify-cross-surface.ts`
// is the read-only gate; this module additionally *regenerates* the projections
// so the toolkit can re-derive every surface from one config.

export type SurfaceName = 'cli' | 'api' | 'sdk' | 'ui' | 'mcp' | 'workflow'

export const CORE_SURFACES: SurfaceName[] = ['cli', 'api', 'sdk', 'ui']

export interface SurfaceProjector {
  name: SurfaceName
  project(node: CapabilityNode): SurfaceSpec
  /** Returns the field this surface projects into on the node. */
  field: keyof CapabilityNode
}

export interface SurfaceSpec {
  defined: boolean
  spec: Record<string, unknown>
  issues: string[]
}

export interface CapabilityNode {
  slug: string
  capId?: string
  name?: string
  description?: string
  category?: string
  capabilityKind?: 'action' | 'query' | 'config' | 'navigation'
  surfaces?: SurfaceName[]
  cliCommand?: { name: string; aliases: string[]; examples: string[] }
  apiEndpoint?: { method: string; path: string }
  mcpToolName?: string
  ui?: {
    component: string
    position: string
    group?: string
    order: number
    icon?: string
    shortcut?: string
  }
  uiAction?: { component: string; position: string; order: number }
  ui_component?: string
  ui_position?: string
  ui_order?: number
  sdk?: { methodName: string; async: boolean }
  workflowNodeType?: string
  inputSchema?: Record<string, unknown>
  outputSchema?: Record<string, unknown>
  isAsync?: boolean
  requiresConfirmation?: boolean
}

// ── Projection rules (the parity contract) ───────────────────────────────

function projectCli(node: CapabilityNode): SurfaceSpec {
  const parts = node.slug.split('_')
  const name = parts.join(' ')
  const aliases = [parts.map((p) => p[0] ?? '').join('')]
  const issues: string[] = []
  const defined = Array.isArray(node.surfaces) && node.surfaces.includes('cli')
  if (defined && (!node.cliCommand?.name || node.cliCommand.name.trim() === ''))
    issues.push('cli surface declared but cliCommand.name empty')
  return {
    defined,
    spec: { name, aliases, examples: [`${aliases[0]} <args>`] },
    issues,
  }
}

function projectApi(node: CapabilityNode): SurfaceSpec {
  const kind = node.capabilityKind
  const category = node.category ?? node.slug.split('_')[0]
  const action = node.slug.split('_').slice(1).join('_')
  const method =
    kind === 'query' ? 'GET' : kind === 'config' ? 'PUT' : kind === 'navigation' ? 'GET' : 'POST'
  const path = `/api/${category}/${action}`
  const issues: string[] = []
  const defined = Array.isArray(node.surfaces) && node.surfaces.includes('api')
  if (defined) {
    if (!path.startsWith('/api/')) issues.push('api path must start with /api/')
    if (path.includes('undefined') || path.includes('null'))
      issues.push('api path contains undefined/null token')
  }
  return { defined, spec: { method, path }, issues }
}

function projectSdk(node: CapabilityNode): SurfaceSpec {
  // SDK surface = a typed method on the generated client. Derived from slug.
  const methodName = node.slug
    .split('_')
    .map((p, i) => (i === 0 ? p : p[0]?.toUpperCase() + p.slice(1)))
    .join('')
  const issues: string[] = []
  const defined = Array.isArray(node.surfaces) && node.surfaces.includes('sdk')
  return { defined, spec: { methodName, async: node.isAsync ?? true }, issues }
}

function projectUi(node: CapabilityNode): SurfaceSpec {
  const issues: string[] = []
  const defined = Array.isArray(node.surfaces) && node.surfaces.includes('ui')
  const component = node.ui_component ?? node.ui?.component ?? 'action-button'
  const position = node.ui_position ?? node.ui?.position ?? 'sidebar'
  const order = node.ui_order ?? node.ui?.order ?? 100
  if (defined) {
    if (!component || component.trim() === '')
      issues.push('ui surface declared but component empty')
    if (!position || position.trim() === '') issues.push('ui surface declared but position empty')
  }
  return { defined, spec: { component, position, order }, issues }
}

export const PROJECTORS: Record<SurfaceName, SurfaceProjector> = {
  cli: { name: 'cli', field: 'cliCommand', project: projectCli },
  api: { name: 'api', field: 'apiEndpoint', project: projectApi },
  sdk: { name: 'sdk', field: 'sdk', project: projectSdk },
  ui: { name: 'ui', field: 'ui', project: projectUi },
  mcp: {
    name: 'mcp',
    field: 'mcpToolName',
    project: (node) => ({
      defined: Array.isArray(node.surfaces) && node.surfaces.includes('mcp'),
      spec: { toolName: node.slug },
      issues: [],
    }),
  },
  workflow: {
    name: 'workflow',
    field: 'workflowNodeType',
    project: (node) => {
      const t = node.capabilityKind
      return {
        defined: Array.isArray(node.surfaces) && node.surfaces.includes('workflow'),
        spec: { nodeType: t },
        issues: [],
      }
    },
  },
}

/** Re-derive a surface spec for a node using the canonical projection rule. */
export function projectSurface(node: CapabilityNode, surface: SurfaceName): SurfaceSpec {
  return PROJECTORS[surface].project(node)
}

/** Verify one node across all declared surfaces. Returns issues (empty = in parity). */
export function verifyParity(node: CapabilityNode): { inParity: boolean; issues: string[] } {
  const issues: string[] = []
  for (const surface of CORE_SURFACES) {
    const spec = projectSurface(node, surface)
    if (spec.defined && !spec.issues.every((i) => i === '')) {
      for (const i of spec.issues) if (i) issues.push(`[${surface}] ${i}`)
    }
  }
  // MCP + workflow are projections of slug/kind — always derivable.
  return { inParity: issues.length === 0, issues }
}

/** Full parity report across a node set. */
export function parityReport(nodes: CapabilityNode[]) {
  const perSurface: Record<string, { required: number; ok: number }> = {}
  for (const s of [...CORE_SURFACES, 'mcp', 'workflow']) perSurface[s] = { required: 0, ok: 0 }

  let passed = 0
  const findings: { slug: string; capId?: string; issues: string[] }[] = []
  for (const node of nodes) {
    const { inParity, issues } = verifyParity(node)
    if (inParity) passed++
    else findings.push({ slug: node.slug, capId: node.capId, issues })
    for (const surface of Object.keys(perSurface)) {
      if (node.surfaces?.includes(surface as SurfaceName)) {
        perSurface[surface].required++
        if (inParity || !issues.some((i) => i.startsWith(`[${surface}]`))) perSurface[surface].ok++
      }
    }
  }
  return {
    total: nodes.length,
    passed,
    failed: nodes.length - passed,
    bySurface: perSurface,
    findings,
  }
}
