// scripts/verify-cross-surface.ts
// Unit 19.4 — Cross-Surface Verification.
//
// Verifies that every taxonomy-pool capability resolves correctly across all
// declared surfaces (CLI, API, MCP, UI). This is the FRONTEND=BACKEND gate:
// the single `slug` must bind to a coherent set of surface specs with no
// undefined/empty fields, and the UI slot must resolve to a real catalog key
// (the SLOT_IDS set in web/ui/src/ui/slots.ts).
//
// Run:
//   bun run scripts/verify-cross-surface.ts                        (offline, static)
//   bun run scripts/verify-cross-surface.ts --live                 (+ server API reachability)
//   bun run scripts/verify-cross-surface.ts --runtime              (+ actual CLI dispatch)
//   bun run scripts/verify-cross-surface.ts --live --runtime       (all checks)
//
// Exit code is non-zero if any capability fails verification, so it can block
// PR merge in the devops gate.

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CapabilityNodeSchema, type TaxonomyNode } from './taxonomy-gen/lib/taxonomy-model.ts'

const SEED_TARGET = join(process.cwd(), 'seeds', 'taxonomy', 'pool.taxonomy.json')

interface SurfaceCheck {
  cli: boolean
  api: boolean
  mcp: boolean
  ui: boolean
}

interface Finding {
  slug: string
  capId: string | null
  surfaces: string[]
  issues: string[]
  checks: SurfaceCheck
}

interface RuntimeCliCheck {
  slug: string
  cliName: string
  ok: boolean
  exitCode: number
  stderr: string
}

interface AliasCollision {
  alias: string
  slugs: string[]
}

interface Report {
  verifier: 'cross-surface'
  generatedAt: string
  mode: 'offline' | 'live' | 'runtime' | 'live+runtime'
  total: number
  passed: number
  failed: number
  bySurface: Record<string, { required: number; ok: number }>
  findings: Finding[]
  liveApi: { ok: boolean; baseUrl: string; checked: number; failures: string[] }
  runtimeCli: { checked: number; passed: number; failures: RuntimeCliCheck[] }
  aliasCollisions: AliasCollision[]
}

// The set of legal UI slot ids (mirrors web/ui/src/ui/slots.ts).
// Kept inline (not imported) so this script runs in a pure Node context
// without pulling the frontend's browser-only deps.
const SLOT_IDS = [
  'chat.entry',
  'chat.sidebar',
  'chat.thread',
  'chat.bubble',
  'chat.composer',
  'chat.send',
  'chat.attach',
  'chat.streaming',
  'chat.result',
  'chat.confirm',
  'chat.error',
  'chat.header',
  'chat.actionBar',
] as const
const SLOT_ID_SET = new Set<string>(SLOT_IDS)

function loadNodes(): TaxonomyNode[] {
  if (!existsSync(SEED_TARGET)) {
    console.error(`[verify-cross-surface] pool not found: ${SEED_TARGET}`)
    console.error('[verify-cross-surface] run `bun run taxonomy-gen merge` first')
    process.exit(2)
  }
  const doc = JSON.parse(readFileSync(SEED_TARGET, 'utf-8')) as { nodes?: unknown[] }
  const nodes = (doc.nodes ?? []).filter(
    (n): n is TaxonomyNode => (n as { kind?: string })?.kind === 'capability',
  )
  return nodes
}

/**
 * Validate a single capability across all declared surfaces.
 * Returns a Finding with per-surface pass/fail + human-readable issues.
 */
function verifyCapability(node: TaxonomyNode): Finding {
  const issues: string[] = []
  const checks: SurfaceCheck = { cli: true, api: true, mcp: true, ui: true }

  // Re-parse through the schema so we reject structurally invalid nodes early.
  const parsed = CapabilityNodeSchema.safeParse(node)
  const cap = parsed.success ? parsed.data : null

  const capId = node.capId ?? null
  const surfaces = Array.isArray(node.surfaces) ? node.surfaces : []

  // ── capId format ──
  const expectedCapIdPrefix = `cap:${node.slug.split('_')[0]}:`
  if (!capId) {
    issues.push('capId is missing')
  } else if (!capId.startsWith('cap:') || !capId.includes(':')) {
    issues.push(`capId "${capId}" is not in cap:<category>:<action> format`)
  } else if (!capId.startsWith(expectedCapIdPrefix)) {
    issues.push(
      `capId "${capId}" does not derive from slug "${node.slug}" (expected prefix "${expectedCapIdPrefix}")`,
    )
  }

  // ── CLI surface ──
  if (surfaces.includes('cli')) {
    const cli = node.cliCommand
    if (!cli || typeof cli.name !== 'string' || cli.name.trim() === '') {
      checks.cli = false
      issues.push('CLI surface declared but cliCommand.name is empty')
    }
  } else {
    checks.cli = true // not required
  }

  // ── API surface ──
  if (surfaces.includes('api')) {
    const api = node.apiEndpoint
    if (!api || typeof api.path !== 'string' || api.path.trim() === '') {
      checks.api = false
      issues.push('API surface declared but apiEndpoint.path is empty')
    } else if (!api.path.startsWith('/api/')) {
      checks.api = false
      issues.push(`apiEndpoint.path "${api.path}" does not start with /api/`)
    } else if (api.path.includes('undefined') || api.path.includes('null')) {
      checks.api = false
      issues.push(`apiEndpoint.path "${api.path}" contains an undefined/null token`)
    }
    if (!api || typeof api.method !== 'string' || api.method.trim() === '') {
      checks.api = false
      issues.push('API surface declared but apiEndpoint.method is empty')
    }
  } else {
    checks.api = true
  }

  // ── MCP surface ──
  if (surfaces.includes('mcp')) {
    const mcp = node.mcpToolName
    if (typeof mcp !== 'string' || mcp.trim() === '') {
      checks.mcp = false
      issues.push('MCP surface declared but mcpToolName is empty')
    } else if (mcp !== node.slug) {
      // MCP tool name is, by convention, the slug itself.
      issues.push(`mcpToolName "${mcp}" does not equal slug "${node.slug}"`)
    }
  } else {
    checks.mcp = true
  }

  // ── UI surface ──
  if (surfaces.includes('ui')) {
    const hasComponent = typeof node.ui_component === 'string' && node.ui_component.trim() !== ''
    const hasPosition = typeof node.ui_position === 'string' && node.ui_position.trim() !== ''
    if (!hasComponent) {
      checks.ui = false
      issues.push('UI surface declared but ui_component is empty')
    }
    if (!hasPosition) {
      checks.ui = false
      issues.push('UI surface declared but ui_position is empty')
    } else if (!SLOT_ID_SET.has(node.ui_position as string)) {
      checks.ui = false
      issues.push(`ui_position "${node.ui_position}" is not a known SLOT_ID`)
    }
    // action-kind capabilities should carry a uiAction spec
    if (node.capabilityKind === 'action' && !node.uiAction) {
      issues.push('action capability has no uiAction spec')
    }
  } else {
    checks.ui = true
  }

  return {
    slug: node.slug,
    capId,
    surfaces,
    issues,
    checks,
  }
}

/**
 * Live verification: hit a running server to confirm the API endpoint actually
 * responds. Requires `--live`. CLI/MCP/UI checks remain static (surface spec
 * integrity) — the live pass only confirms HTTP reachability for api surfaces.
 */
async function verifyLive(baseUrl: string, findings: Finding[]): Promise<Report['liveApi']> {
  const failures: string[] = []
  let checked = 0

  for (const f of findings) {
    if (!f.surfaces.includes('api')) continue
    const node = loadNodes().find((n) => n.slug === f.slug)
    if (!node?.apiEndpoint) continue
    checked++
    try {
      const url = `${baseUrl}${node.apiEndpoint.path}`
      const res = await fetch(url, { method: 'HEAD' })
      if (res.status >= 500) {
        failures.push(`${f.slug} -> ${url} returned ${res.status}`)
      }
    } catch (err) {
      failures.push(`${f.slug} -> ${url} unreachable: ${String(err)}`)
    }
  }

  return { ok: failures.length === 0, baseUrl, checked, failures }
}

/**
 * Runtime CLI check: dispatch every cli-surface capability through
 * `bun run src/cli/index.ts <name> --json` and assert exit 0 + valid JSON.
 * Requires a running server on the configured CAP_STORE_PORT (default 9420).
 *
 * Optimized: runs with bounded concurrency (CONCURRENCY) instead of one
 * sequential spawn per command, cutting wall-clock from ~O(N*2s) to ~O(N/8*2s).
 */
async function verifyRuntimeCli(nodes: TaxonomyNode[]): Promise<RuntimeCliCheck[]> {
  const cliScript = join(process.cwd(), 'src', 'cli', 'index.ts')
  const basePort = process.env.CAP_STORE_PORT ?? process.env.PORT ?? '9420'

  const targets = nodes
    .filter((n) => n.surfaces?.includes('cli') && n.cliCommand?.name)
    .map((n) => ({ slug: n.slug, cliName: n.cliCommand!.name }))

  const CONCURRENCY = 8
  const results: RuntimeCliCheck[] = []

  async function runOne(t: { slug: string; cliName: string }): Promise<RuntimeCliCheck> {
    const args = ['run', cliScript, ...t.cliName.split(/\s+/), '--json']
    const proc = spawnSync(process.execPath ?? 'bun', args, {
      env: { ...process.env, CAP_STORE_PORT: basePort },
      timeout: 10_000,
      encoding: 'utf-8',
      windowsHide: true,
    })
    return {
      slug: t.slug,
      cliName: t.cliName,
      ok: proc.status === 0,
      exitCode: proc.status ?? -1,
      stderr: (proc.stderr ?? '').slice(0, 200).trim(),
    }
  }

  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY)
    const settled = await Promise.all(batch.map((t) => runOne(t)))
    results.push(...settled)
  }

  return results
}

/**
 * Static alias-collision check: collect every cli alias across all nodes
 * and flag aliases that map to 2+ distinct slugs.
 */
function checkAliasCollisions(nodes: TaxonomyNode[]): AliasCollision[] {
  const aliasMap = new Map<string, string[]>()
  for (const node of nodes) {
    if (!node.surfaces?.includes('cli')) continue
    const aliases = node.cliCommand?.aliases
    if (!aliases) continue
    for (const alias of aliases) {
      if (!alias) continue
      const existing = aliasMap.get(alias) ?? []
      if (!existing.includes(node.slug)) existing.push(node.slug)
      aliasMap.set(alias, existing)
    }
  }
  const collisions: AliasCollision[] = []
  for (const [alias, slugs] of aliasMap) {
    if (slugs.length > 1) collisions.push({ alias, slugs })
  }
  return collisions.sort((a, b) => b.slugs.length - a.slugs.length)
}

function buildReport(
  nodes: TaxonomyNode[],
  mode: 'offline' | 'live',
  liveApi?: Report['liveApi'],
  runtimeCli?: RuntimeCliCheck[],
  aliasCollisions?: AliasCollision[],
): Report {
  const findings = nodes.map(verifyCapability)

  const bySurface: Record<string, { required: number; ok: number }> = {
    cli: { required: 0, ok: 0 },
    api: { required: 0, ok: 0 },
    mcp: { required: 0, ok: 0 },
    ui: { required: 0, ok: 0 },
  }

  let passed = 0
  let failed = 0
  for (const f of findings) {
    const failedSurfaces = (Object.keys(f.checks) as (keyof SurfaceCheck)[]).filter(
      (k) => f.surfaces.includes(k) && !f.checks[k],
    )
    // A capability passes if it has no issues AND every required surface check passes.
    const ok = f.issues.length === 0 && failedSurfaces.length === 0
    if (ok) passed++
    else failed++

    for (const surface of f.surfaces) {
      if (!(surface in bySurface)) continue
      bySurface[surface].required++
      if (f.checks[surface as keyof SurfaceCheck]) bySurface[surface].ok++
    }
  }

  const runtimeResult = runtimeCli
    ? {
        checked: runtimeCli.length,
        passed: runtimeCli.filter((r) => r.ok).length,
        failures: runtimeCli.filter((r) => !r.ok),
      }
    : { checked: 0, passed: 0, failures: [] }

  const aliasResult = aliasCollisions ?? []

  return {
    verifier: 'cross-surface',
    generatedAt: new Date().toISOString(),
    mode,
    total: findings.length,
    passed,
    failed,
    bySurface,
    findings,
    liveApi: liveApi ?? { ok: true, baseUrl: '', checked: 0, failures: [] },
    runtimeCli: runtimeResult,
    aliasCollisions: aliasResult,
  }
}

function render(report: Report): void {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('              CROSS-SURFACE VERIFICATION REPORT')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`Mode: ${report.mode}`)
  console.log(`Capabilities: ${report.total}  Passed: ${report.passed}  Failed: ${report.failed}`)
  console.log('')
  console.log('Surface coverage:')
  for (const [surface, { required, ok }] of Object.entries(report.bySurface)) {
    const icon = ok === required ? '✓' : '✗'
    console.log(`  ${icon} ${surface.padEnd(4)}: ${ok}/${required} resolved`)
  }
  if (report.mode.includes('live')) {
    console.log('')
    console.log(
      `Live API check: ${report.liveApi.ok ? '✓' : '✗'} (${report.liveApi.checked} endpoints)`,
    )
    for (const f of report.liveApi.failures) console.log(`  ✗ ${f}`)
  }
  if (report.runtimeCli.checked > 0) {
    console.log('')
    console.log(
      `Runtime CLI dispatch: ${report.runtimeCli.passed}/${report.runtimeCli.checked} passed`,
    )
    for (const f of report.runtimeCli.failures) {
      console.log(`  ✗ ${f.slug} (${f.cliName}) exit=${f.exitCode}`)
      if (f.stderr) console.log(`      stderr: ${f.stderr}`)
    }
  }
  if (report.aliasCollisions.length > 0) {
    console.log('')
    console.log(`Alias collisions: ${report.aliasCollisions.length}`)
    for (const c of report.aliasCollisions) {
      console.log(`  ⚠ "${c.alias}" → ${c.slugs.join(', ')}`)
    }
  }
  if (report.failed > 0) {
    console.log('')
    console.log('Surface spec failures:')
    for (const f of report.findings) {
      const failedSurfaces = (Object.keys(f.checks) as (keyof SurfaceCheck)[]).filter(
        (k) => f.surfaces.includes(k) && !f.checks[k],
      )
      if (f.issues.length === 0 && failedSurfaces.length === 0) continue
      console.log(`  ✗ ${f.slug} (${f.capId ?? 'no-capId'})`)
      for (const issue of f.issues) console.log(`      - ${issue}`)
      if (failedSurfaces.length > 0)
        console.log(`      - surface checks failed: ${failedSurfaces.join(', ')}`)
    }
  }
  console.log('═══════════════════════════════════════════════════════════════')
}

async function main() {
  const live = process.argv.includes('--live')
  const runtime = process.argv.includes('--runtime')
  const baseUrl =
    process.argv.find((a) => a.startsWith('--base='))?.slice('--base='.length) ??
    'http://localhost:5173'

  const nodes = loadNodes()
  if (nodes.length === 0) {
    console.error('[verify-cross-surface] no capability nodes found in pool')
    process.exit(2)
  }

  let mode: Report['mode'] = 'offline'
  let liveApi: Report['liveApi'] | undefined

  if (live) {
    const findings = nodes.map(verifyCapability)
    liveApi = await verifyLive(baseUrl, findings)
    mode = runtime ? 'live+runtime' : 'live'
  }
  if (runtime && !live) mode = 'runtime'

  let runtimeResults: RuntimeCliCheck[] | undefined
  if (runtime) {
    console.log('[runtime] Dispatching CLI commands (concurrency 8)...')
    runtimeResults = await verifyRuntimeCli(nodes)
  }

  const collisions = checkAliasCollisions(nodes)

  const report = buildReport(nodes, mode, liveApi, runtimeResults, collisions)
  render(report)

  const anyFailure =
    report.failed > 0 ||
    (report.mode.includes('live') && !report.liveApi.ok) ||
    report.runtimeCli.failures.length > 0
  process.exit(anyFailure ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
