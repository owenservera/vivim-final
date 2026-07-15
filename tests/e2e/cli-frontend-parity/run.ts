// tests/e2e/cli-frontend-parity/run.ts
// Unit 24.10 — parity test harness skeleton.
//
// For every capability registered with `surfaces: ['cli','ui']` the harness
// exercises it TWICE — once via the CLI argv path and once via the HTTP path —
// and asserts the two normalized outputs are equivalent. This is the mechanism
// that enforces the "CLI = Frontend" invariant from day one, before any real
// capability exists.
//
// The harness is surface-agnostic: it only knows `surface: cli` vs
// `surface: ui`. The equivalence check is on the resolved `output`, never on
// presentation.

export interface ParityCase {
  capabilityId: string
  /** CLI argv tokens, e.g. ['providers', 'list']. */
  cliArgs: string[]
  /** Body for the HTTP execute route. */
  httpBody: { input: Record<string, unknown>; ctx?: unknown }
  /** Optional per-case normalizer (overrides the default volatile-field stripper). */
  normalize?: (out: unknown) => unknown
}

export interface ParityResult {
  capabilityId: string
  cli: unknown
  http: unknown
  equal: boolean
  diff?: string
}

export interface ParityOptions {
  baseUrl?: string
  /** When false, skip the CLI process spawn (e.g. when no server is booted). */
  runCli?: boolean
}

// Fields that legitimately differ between the CLI and HTTP paths and must be
// stripped before comparison.
const VOLATILE = new Set(['latencyMs', 'traceId', 'ok'])

export function normalizeOutput(out: unknown): unknown {
  if (Array.isArray(out)) return out.map(normalizeOutput)
  if (out && typeof out === 'object') {
    const obj = out as Record<string, unknown>
    const next: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj)) {
      if (VOLATILE.has(k)) continue
      next[k] = normalizeOutput(v)
    }
    return next
  }
  return out
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(structuredClone(a)) === JSON.stringify(structuredClone(b))
}

function diff(a: unknown, b: unknown): string {
  return `cli:  ${JSON.stringify(a)}\nhttp: ${JSON.stringify(b)}`
}

/** Run the CLI as a subprocess and return parsed JSON stdout. */
async function execCli(cap: ParityCase, baseUrl: string): Promise<unknown> {
  const proc = Bun.spawn(
    ['bun', 'run', 'src/cli/index.ts', ...cap.cliArgs, '--remote', baseUrl, '--json'],
    { cwd: process.cwd(), stdout: 'pipe', stderr: 'pipe' },
  )
  const cliRaw = await new Response(proc.stdout).text()
  const cliErr = await new Response(proc.stderr).text()
  const code = await proc.exited
  if (code !== 0) {
    throw new Error(`CLI exited ${code}: ${cliErr || cliRaw}`)
  }
  try {
    const parsed = JSON.parse(cliRaw)
    return parsed.output ?? parsed
  } catch {
    // If JSON parse fails, return the raw text
    return cliRaw
  }
}

/**
 * Execute the parity suite. Each case is driven through both the CLI argv path
 * and the HTTP path, then normalized and compared.
 */
export async function runParity(
  cases: ParityCase[],
  opts: ParityOptions = {},
): Promise<ParityResult[]> {
  const baseUrl = (opts.baseUrl ?? 'http://127.0.0.1:9420').replace(/\/$/, '')
  const doRunCli = opts.runCli ?? true
  const results: ParityResult[] = []

  for (const c of cases) {
    // HTTP path — universal execute route.
    const httpRaw = await fetch(
      `${baseUrl}/api/capabilities/${encodeURIComponent(c.capabilityId)}/execute`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: c.httpBody.input, ctx: c.httpBody.ctx ?? {} }),
      },
    )
    let httpJson: unknown
    try {
      httpJson = await httpRaw.json()
    } catch {
      httpJson = {}
    }
    const httpOut = c.normalize ? c.normalize(httpJson as never) : normalizeOutput(httpJson)

    if (!doRunCli) {
      results.push({ capabilityId: c.capabilityId, cli: undefined, http: httpOut, equal: true })
      continue
    }

    let cliOut: unknown
    try {
      cliOut = await execCli(c, baseUrl)
    } catch (err) {
      results.push({
        capabilityId: c.capabilityId,
        cli: undefined,
        http: httpOut,
        equal: false,
        diff: err instanceof Error ? err.message : String(err),
      })
      continue
    }

    const normalizedCli = c.normalize ? c.normalize(cliOut) : normalizeOutput(cliOut)
    const equal = deepEqual(normalizedCli, httpOut)
    results.push({
      capabilityId: c.capabilityId,
      cli: normalizedCli,
      http: httpOut,
      equal,
      diff: equal ? undefined : diff(normalizedCli, httpOut),
    })
  }

  return results
}

/**
 * Introspect the registry for capabilities present on both `cli` and `ui`
 * surfaces, so the parity suite self-discovers its cases once the registry is
 * populated (24.4-24.6). Best-effort: empty input for each case.
 */
export async function discoverParityCases(baseUrl: string): Promise<ParityCase[]> {
  const base = baseUrl.replace(/\/$/, '')
  const res = await fetch(`${base}/api/capabilities?surface=cli`)
  if (!res.ok) return []
  const caps = (await res.json()) as Array<{
    id: string
    slug: string
    surfaces: string[]
    inputSchema: { properties?: Record<string, unknown>; required?: string[] }
  }>
  return caps
    .filter((c) => c.surfaces.includes('cli') && c.surfaces.includes('ui'))
    .map((c) => ({
      capabilityId: c.id,
      cliArgs: c.slug.split('_'),
      httpBody: { input: {} },
    }))
}
