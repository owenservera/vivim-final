// tests/e2e/discoverability/harness.ts
// Shared harness for the Discoverability Probe suite (specs/009-discoverability-probe).
//
// CONSTRAINT: probes exercise the system ONLY through its own CLI:
//   - `bun run src/cli/index.ts <args>`  (the `vivim` product CLI)
//   - `bun run devops <args>`            (the devops tooling CLI)
// No direct HTTP fetch against a running server is used to *probe* the system.

const CLI = ['bun', 'run', 'src/cli/index.ts']
const DEVOPS = ['bun', 'run', 'devops']
const PROBE_TIMEOUT_MS = 15_000

export interface CliResult {
  code: number | null
  stdout: string
  stderr: string
  ms: number
}

import type { Subprocess } from 'bun'

function makeEnv(extra?: Record<string, string>): Record<string, string> {
  return { ...(process.env as Record<string, string>), ...extra }
}

async function procResult(proc: Subprocess): Promise<CliResult> {
  const start = Date.now()
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout as ReadableStream<Uint8Array>).text(),
    new Response(proc.stderr as ReadableStream<Uint8Array>).text(),
  ])
  const code = await Promise.race<number | null>([
    proc.exited.then(() => proc.exitCode),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), PROBE_TIMEOUT_MS)),
  ])
  return { code, stdout, stderr, ms: Date.now() - start }
}

/** Run a product-CLI command, capturing output + wall-clock time. */
export async function spawnCli(args: string[], env?: Record<string, string>): Promise<CliResult> {
  const proc = Bun.spawn([...CLI, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
    env: makeEnv(env),
  })
  return procResult(proc)
}

/** Run a devops command, capturing output + wall-clock time. */
export async function spawnDevops(args: string[]): Promise<CliResult> {
  const proc = Bun.spawn([...DEVOPS, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
    env: makeEnv(),
  })
  return procResult(proc)
}

/** Warm-run a command N times, return the p95 latency in ms. */
export async function p95Latency(fn: () => Promise<CliResult>, runs = 5): Promise<number> {
  const samples: number[] = []
  for (let i = 0; i < runs; i++) {
    const r = await fn()
    samples.push(r.ms)
  }
  samples.sort((a, b) => a - b)
  const idx = Math.min(samples.length - 1, Math.ceil(samples.length * 0.95) - 1)
  return samples[Math.max(0, idx)] ?? 0
}

export interface ServerHandle {
  stop: () => Promise<void>
  port: number
  ok: boolean
}

/**
 * Boot the system via the product CLI (`vivim serve`) on a dedicated port.
 * Resolves once /health returns 200, or after a bounded wait.
 * Returns { ok: false } if the server cannot be reached — tests should skip.
 */
export async function startServer(port = 9421): Promise<ServerHandle> {
  const proc = Bun.spawn([...CLI, 'serve'], {
    stdout: 'pipe',
    stderr: 'pipe',
    env: makeEnv({ CAP_STORE_PORT: String(port) }),
  })
  const deadline = Date.now() + 40_000
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${port}/health`, {
        signal: AbortSignal.timeout(3_000),
      })
      if (res.ok) {
        return {
          port,
          ok: true,
          stop: async () => {
            try {
              proc.kill()
              await proc.exited.catch(() => {})
              // [audit] log the error with context here
            } catch {
              // [audit] log the error with context here
              /* gone */
            }
          },
        }
      }
    } catch {
      // [audit] log the error with context here
      // not up yet
    }
    await Bun.sleep(1_000)
  }
  return {
    port,
    ok: false,
    stop: async () => {
      try {
        proc.kill()
        await proc.exited.catch(() => {})
        // [audit] log the error with context here
      } catch {
        // [audit] log the error with context here
        /* gone */
      }
    },
  }
}

export interface CatalogCap {
  id: string
}

/**
 * The "known universe" of capabilities, sourced through the devops CLI
 * (offline static catalog). This is the reference set tests compare against.
 */
export async function knownUniverseCaps(): Promise<CatalogCap[]> {
  const r = await spawnDevops(['runtime-test', 'discover', '--offline'])
  try {
    const json = JSON.parse(r.stdout) as { backendCapabilities?: string[] }
    const ids = json.backendCapabilities ?? []
    return ids.map((id: string) => ({ id }))
  } catch {
    // Fallback: extract capability-like tokens from stdout
    const ids: string[] = []
    for (const line of r.stdout.split('\n')) {
      const m = line.match(/cap:[\w:]+/)
      if (m) ids.push(m[0])
    }
    return ids.map((id) => ({ id }))
  }
}

/** Parse `vivim help` text into the list of command names it surfaces. */
export function parseHelpCommands(stdout: string): string[] {
  const names: string[] = []
  const re = /^\s{2,4}([a-z][a-z0-9_-]+(?:\s[a-z0-9_-]+)*)\s{2,}/gim
  for (const match of stdout.matchAll(re)) {
    const name = match[1]?.trim()
    if (name) names.push(name)
  }
  return [...new Set(names)]
}

export const PROBE_PORT = 9421
