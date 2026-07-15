// devops/audit-arch/passes/commands.ts
// `commands` pass: audits the SINGLE COMMAND LAYER.
//
// Per the v10 invariant, every operation is a UnifiedCapability. The backend
// (Kernel) defines each capability once; CLI, UI, MCP and API are thin NL shells
// derived from its surface bindings (cliCommand / ui / mcpToolName / apiEndpoint
// / surfaces). Natural-language reachability is added by an NL catalog pattern
// whose `capabilityId` points at the capability.
//
// This pass statically extracts:
//   - capabilities   from src/engines/capability-bootstrap.ts (makeCapability)
//   - NL patterns    from src/engines/nlcl/catalog.ts (pattern + capabilityId)
//   - frontend acts  from web/ui/src/actions (ActionRegistry.register)
// and emits findings that surface POTENTIAL NEW COMMANDS and CENTRAL COMMANDS
// needed, plus real inconsistencies (dangling / duplicate bindings).
//
// This pass does not use the module graph — it inspects the command surface
// directly. Graph is accepted (and ignored) to match the PassDef signature.

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { type Finding, buildFinding } from '../findings.ts'
import type { ModuleGraph } from '../graph.ts'
import type { Scope } from '../priority.ts'

const ROOT = join(import.meta.dir, '..', '..', '..')
const CAP_FILE = join(ROOT, 'src', 'engines', 'capability-bootstrap.ts')
const CATALOG_FILE = join(ROOT, 'src', 'engines', 'nlcl', 'catalog.ts')
const ACTIONS_DIR = join(ROOT, 'web', 'ui', 'src', 'actions')

// Surfaces that have an explicit binding field on a capability.
const BINDING_SURFACES = ['cli', 'ui', 'mcp', 'api'] as const
type BindingSurface = (typeof BINDING_SURFACES)[number]

// Default surfaces when a capability omits the field (mirrors ALL_SURFACES in
// capability-bootstrap.ts — note 'workflow' has no corresponding binding field
// and is intentionally skipped by the binding-consistency check).
const DEFAULT_SURFACES = ['cli', 'ui', 'workflow', 'mcp', 'api']

interface Capability {
  id: string
  slug?: string
  cliCommandName?: string
  uiComponent?: string
  mcpToolName?: string
  hasApi: boolean
  surfaces: string[]
  file: string
}

// ── generic brace/paren scanner (string-literal aware) ──────────────────────
function findClosing(text: string, openIdx: number, open: string, close: string): number {
  let depth = 0
  let i = openIdx
  const len = text.length
  while (i < len) {
    const c = text[i]
    if (c === "'" || c === '"' || c === '`') {
      const q = c
      i++
      while (i < len) {
        if (text[i] === '\\') {
          i += 2
          continue
        }
        if (text[i] === q) {
          i++
          break
        }
        i++
      }
      continue
    }
    if (c === '/' && text[i + 1] === '/') {
      while (i < len && text[i] !== '\n') i++
      continue
    }
    if (c === open) depth++
    else if (c === close) {
      depth--
      if (depth === 0) return i
    }
    i++
  }
  return -1
}

function callsNamed(text: string, fn: string): string[] {
  const out: string[] = []
  const re = new RegExp(fn + '\\s*\\(', 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const openIdx = m.index + m[0].length - 1
    const closeIdx = findClosing(text, openIdx, '(', ')')
    if (closeIdx < 0) continue
    out.push(text.slice(m.index, closeIdx + 1))
  }
  return out
}

function firstQuoted(text: string): string | undefined {
  const m = text.match(/['"]([^'"]+)['"]/)
  return m ? m[1] : undefined
}

// field: "id: 'foo'" → 'foo'. Boundary avoids providerId/apiEndpoint.
function quotedAfter(text: string, key: string): string | undefined {
  const m = text.match(new RegExp('(?:^|[{,\\s])' + key + ':\\s*[\'"]([^\'"]+)[\'"]'))
  return m ? m[1] : undefined
}

// block: "ui: { component: 'x', … }" → inner text between the braces.
function blockInner(text: string, key: string): string | undefined {
  const m = text.match(new RegExp(key + ':\\s*\\{([\\s\\S]*?)\\}'))
  return m ? m[1] : undefined
}

function surfacesOf(text: string): string[] {
  const m = text.match(/(?:^|[{,\s])surfaces:\s*\[([^\]]*)\]/)
  if (!m) return [...DEFAULT_SURFACES]
  const capture = m[1]
  if (!capture) return [...DEFAULT_SURFACES]
  const items = capture.match(/['"]([^'"]+)['"]/g)
  return items ? items.map((s) => s.replace(/['"]/g, '')) : [...DEFAULT_SURFACES]
}

// ── extractors ───────────────────────────────────────────────────────────────
function walkTs(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name)
    if (e.isDirectory()) out.push(...walkTs(full))
    else if (e.name.endsWith('.ts')) out.push(full)
  }
  return out
}

// Capabilities are defined in many files (capability-bootstrap.ts via
// makeCapability, *caps.ts via makeMutationCap, …). Every UnifiedCapability
// carries `id: 'cap:…'`, so we scan all of src for that marker and brace-match
// the enclosing object to read its surface bindings.
function extractCapabilities(): Capability[] {
  const caps: Capability[] = []
  const srcDir = join(ROOT, 'src')
  if (!existsSync(srcDir)) return caps
  for (const file of walkTs(srcDir)) {
    const src = readFileSync(file, 'utf8')
    const re = /(?:^|[{,\s])id:\s*['"](cap:[^'"]+)['"]/g
    let m: RegExpExecArray | null
    while ((m = re.exec(src))) {
      const capId = m[1]
      const braceIdx = src.lastIndexOf('{', m.index)
      if (braceIdx < 0) continue
      const closeIdx = findClosing(src, braceIdx, '{', '}')
      if (closeIdx < 0) continue
      const obj = src.slice(braceIdx, closeIdx + 1)
      const id = quotedAfter(obj, 'id')
      if (!id || id !== capId) continue // brace was a nested object, skip
      const cliBlock = blockInner(obj, 'cliCommand')
      // A capability is bound on the UI surface either via the canonical `ui`
      // block or via the canvas-specific `uiAction` alias (which carries the
      // same component/position/order). Both are valid UI bindings.
      const uiBlock = blockInner(obj, 'ui') ?? blockInner(obj, 'uiAction')
      const apiBlock = blockInner(obj, 'apiEndpoint')
      caps.push({
        id,
        slug: quotedAfter(obj, 'slug'),
        cliCommandName: cliBlock ? quotedAfter(cliBlock, 'name') : undefined,
        uiComponent: uiBlock ? quotedAfter(uiBlock, 'component') : undefined,
        mcpToolName: quotedAfter(obj, 'mcpToolName'),
        hasApi: !!apiBlock,
        surfaces: surfacesOf(obj),
        file,
      })
    }
  }
  return caps
}

function extractCatalogBindings(src: string): Array<{ patternId: string; capabilityId?: string }> {
  const out: Array<{ patternId: string; capabilityId?: string }> = []
  for (const call of callsNamed(src, 'pattern')) {
    const patternId = firstQuoted(call)
    if (!patternId) continue
    out.push({ patternId, capabilityId: quotedAfter(call, 'capabilityId') })
  }
  return out
}

// The action id is the FIRST argument of ActionRegistry.register. If it is a
// variable/template literal (not a string literal), skip it — otherwise a
// string literal inside the action body (e.g. method: 'POST') would be mistaken
// for the id.
function firstArgLiteral(call: string): string | undefined {
  const p = call.indexOf('(')
  if (p < 0) return undefined
  let depth = 0
  let arg = ''
  for (let i = p + 1; i < call.length; i++) {
    const c = call[i]
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') {
      if (depth === 0) break
      depth--
    } else if (c === ',' && depth === 0) break
    arg += c
  }
  const mm = arg.trim().match(/^['"]([^'"]+)['"]$/)
  return mm ? mm[1] : undefined
}

function extractFrontendActions(): string[] {
  if (!existsSync(ACTIONS_DIR)) return []
  const actions: string[] = []
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name)
      if (e.isDirectory()) walk(full)
      else if (e.name.endsWith('.ts')) {
        const txt = readFileSync(full, 'utf8')
        for (const call of callsNamed(txt, 'ActionRegistry.register')) {
          const id = firstArgLiteral(call)
          if (id) actions.push(id)
        }
      }
    }
  }
  walk(ACTIONS_DIR)
  return actions
}

// ── pass entry ───────────────────────────────────────────────────────────────
export async function checkCommands(
  _graph: ModuleGraph,
  _scope: Scope = 'standard',
): Promise<Finding[]> {
  const out: Finding[] = []
  const caps = extractCapabilities()
  const catalog = existsSync(CATALOG_FILE)
    ? extractCatalogBindings(readFileSync(CATALOG_FILE, 'utf8'))
    : []
  const boundCapabilityIds = new Set(catalog.map((c) => c.capabilityId).filter(Boolean) as string[])
  const capIds = new Set(caps.map((c) => c.id))

  // 1. Duplicate capability id (data error) → P1
  const seenIds = new Map<string, number>()
  for (const c of caps) seenIds.set(c.id, (seenIds.get(c.id) ?? 0) + 1)
  for (const [id, count] of seenIds) {
    if (count > 1) {
      out.push(
        buildFinding({
          priority: 'P1',
          dimension: 'commands',
          title: `Duplicate capability id: ${id}`,
          description: `makeCapability defines "${id}" ${count} times. Capability ids must be unique within the single command layer.`,
          file: CAP_FILE,
          line: 0,
          evidence: `id: '${id}' repeated ${count}× in capability-bootstrap.ts`,
          impact:
            'Registry collision — the later definition shadows earlier ones; commands silently resolve to the wrong handler.',
          fixSummary: 'Make each capability id unique (namespaced by category).',
          fixSteps: [
            'Find the duplicate makeCapability blocks.',
            'Rename one id to a distinct, namespaced value.',
            'Re-run the catalog binding check.',
          ],
          effort: 'S',
          autoFixable: false,
        }),
      )
    }
  }

  // 2. Dangling catalog binding → P1
  for (const p of catalog) {
    if (p.capabilityId && !capIds.has(p.capabilityId)) {
      out.push(
        buildFinding({
          priority: 'P1',
          dimension: 'commands',
          title: `Dangling command: catalog binds "${p.patternId}" → missing "${p.capabilityId}"`,
          description: `An NL catalog pattern references capabilityId "${p.capabilityId}" that is not defined by any makeCapability call.`,
          file: CATALOG_FILE,
          line: 0,
          evidence: `pattern('${p.patternId}', …, { capabilityId: '${p.capabilityId}' }) — capability not found in capability-bootstrap.ts`,
          impact:
            'Natural-language invocation resolves to a non-existent capability; the command never executes.',
          fixSummary:
            'Point the catalog pattern at a real capability id, or register the missing capability.',
          fixSteps: [
            'Open the catalog pattern.',
            'Correct capabilityId to a defined id, or add the capability in capability-bootstrap.ts.',
          ],
          effort: 'S',
          autoFixable: false,
        }),
      )
    }
  }

  // 3. Surface declared but binding missing → P2 (candidate command on that surface)
  for (const c of caps) {
    for (const s of c.surfaces) {
      if (!BINDING_SURFACES.includes(s as BindingSurface)) continue
      const missing =
        (s === 'cli' && !c.cliCommandName) ||
        (s === 'ui' && !c.uiComponent) ||
        (s === 'mcp' && !c.mcpToolName) ||
        (s === 'api' && !c.hasApi)
      if (missing) {
        out.push(
          buildFinding({
            priority: 'P2',
            dimension: 'commands',
            title: `Surface "${s}" declared but not bound — ${c.id}`,
            description: `Capability "${c.id}" lists "${s}" in its surfaces but provides no ${surfaceBindingField(s)}. The command is unreachable on that surface.`,
            file: c.file,
            line: 0,
            evidence: `surfaces includes '${s}' — missing ${surfaceBindingField(s)}`,
            impact: `A central command is needed: ${c.id} is advertised on "${s}" but no client entry point exists.`,
            fixSummary: `Add the ${surfaceBindingField(s)} binding (or drop "${s}" from surfaces).`,
            fixSteps: [
              `Add ${surfaceBindingField(s)} to the "${c.id}" capability.`,
              'Re-run the commands pass to confirm parity.',
            ],
            effort: 'S',
            autoFixable: false,
          }),
        )
      }
    }
  }

  // 4. Potential new command: capability has no NL catalog pattern → P2
  //    A capability is command-surface-complete if it is bound on ANY surface
  //    (cli / ui / mcp / api); natural-language reachability is an OPTIONAL
  //    extra, not a hard requirement. Only flag capabilities that are bound on
  //    NO interactive surface at all — those are genuinely unreachable.
  for (const c of caps) {
    const hasAnyBinding = !!(c.cliCommandName || c.uiComponent || c.mcpToolName || c.hasApi)
    if (!boundCapabilityIds.has(c.id) && !hasAnyBinding) {
      out.push(
        buildFinding({
          priority: 'P2',
          dimension: 'commands',
          title: `Potential new command — no surface binding: ${c.id}`,
          description: `Capability "${c.id}" has no NL catalog pattern and is not bound on any interactive surface (cli/ui/mcp/api), so it cannot be reached by any client.`,
          file: c.file,
          line: 0,
          evidence: `capabilityId '${c.id}' absent from catalog.ts AND no cliCommand/ui/mcpToolName/apiEndpoint`,
          impact:
            'The capability is unreachable from every client surface; a command entry point is missing.',
          fixSummary:
            'Add at least one surface binding (cliCommand/ui/mcpToolName/apiEndpoint) or an NL catalog pattern.',
          fixSteps: [
            'Open src/engines/nlcl/catalog.ts or the capability definition.',
            `Bind "${c.id}" on a surface or add pattern(..., { capabilityId: '${c.id}' }).`,
            'Re-run the commands pass.',
          ],
          effort: 'S',
          autoFixable: false,
        }),
      )
    }
  }

  // 5. Central command candidate: same cliCommand name from multiple capabilities → P2
  const byCli = new Map<string, string[]>()
  for (const c of caps) {
    if (!c.cliCommandName) continue
    const list = byCli.get(c.cliCommandName) ?? []
    list.push(c.id)
    byCli.set(c.cliCommandName, list)
  }
  for (const [name, ids] of byCli) {
    if (ids.length > 1) {
      out.push(
        buildFinding({
          priority: 'P2',
          dimension: 'commands',
          title: `Central command candidate — cliCommand "${name}" defined by ${ids.length} capabilities`,
          description: `The CLI command "${name}" is declared by multiple capabilities (${ids.join(', ')}). These should be consolidated into one central command that dispatches by argument.`,
          file: CAP_FILE,
          line: 0,
          evidence: `cliCommand.name '${name}' → ${ids.join(', ')}`,
          impact:
            'Command-surface fragmentation — the same verb maps to several handlers, confusing the single command layer.',
          fixSummary: 'Consolidate into one capability/cliCommand that dispatches by sub-argument.',
          fixSteps: [
            'Pick or create a single canonical capability for the verb.',
            'Re-point the other capabilities to delegate.',
            'Update the catalog + frontend to the canonical id.',
          ],
          effort: 'M',
          autoFixable: false,
        }),
      )
    }
  }

  // 6. Frontend action without backing capability → P3 (light)
  const actions = extractFrontendActions()
  if (actions.length > 0) {
    const matchable = new Set<string>()
    for (const c of caps) {
      matchable.add(c.id)
      if (c.slug) matchable.add(c.slug)
      if (c.uiComponent) matchable.add(c.uiComponent)
    }
    for (const a of actions) {
      if (!matchable.has(a)) {
        out.push(
          buildFinding({
            priority: 'P3',
            dimension: 'commands',
            title: `Frontend action with no backing capability: ${a}`,
            description: `ActionRegistry registers "${a}" but no capability id/slug/ui.component matches it.`,
            file: ACTIONS_DIR,
            line: 0,
            evidence: `ActionRegistry.register('${a}', …) — not matched by any capability`,
            impact: 'Frontend action may be orphaned or is wired to a capability id that drifted.',
            fixSummary: 'Bind the action to a capability id/slug or remove it.',
            fixSteps: [
              'Confirm the capability exists.',
              'Align the action id with the capability binding.',
            ],
            effort: 'S',
            autoFixable: false,
          }),
        )
      }
    }
  }

  return out
}

function surfaceBindingField(s: string): string {
  switch (s) {
    case 'cli':
      return 'cliCommand'
    case 'ui':
      return 'ui'
    case 'mcp':
      return 'mcpToolName'
    case 'api':
      return 'apiEndpoint'
    default:
      return s
  }
}
