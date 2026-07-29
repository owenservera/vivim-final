// devops/runtime-test/migrate.ts
// Unit 1.2 — Non-interactive Prisma migration wrapper.
//
// AGENT-SAFE: spawns `prisma migrate dev --name <x>` (non-interactive because the name
// is supplied) under a hard spawn timeout. This eliminates the #1 lockup: a bare
// `prisma migrate dev` blocks on the "Name your migration" stdin prompt and hangs the
// autonomous agent indefinitely.

import { spawn } from 'node:child_process'

export interface MigrateResult {
  ok: boolean
  output: string
  error?: string
  timedOut?: boolean
}

/**
 * Run a named Prisma migration. Always passes `--name` so no stdin prompt appears.
 * Kills the child if it exceeds `timeoutMs` (default 120s) so the agent never blocks.
 */
export function runMigrate(name: string, timeoutMs = 120_000): Promise<MigrateResult> {
  return new Promise((resolve) => {
    const args = ['prisma', 'migrate', 'dev', '--name', name]
    let out = ''
    let done = false
    const child = spawn('bun', ['x', ...args], { stdio: ['ignore', 'pipe', 'pipe'] })

    const finish = (r: MigrateResult) => {
      if (done) return
      done = true
      resolve(r)
    }

    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      finish({ ok: false, output: out, error: `timed out after ${timeoutMs}ms`, timedOut: true })
    }, timeoutMs)

    child.stdout?.on('data', (d) => (out += d.toString()))
    child.stderr?.on('data', (d) => (out += d.toString()))
    child.on('error', (err) => finish({ ok: false, output: out, error: String(err) }))
    child.on('close', (code) => {
      clearTimeout(timer)
      finish({
        ok: code === 0,
        output: out.slice(-2000),
        error: code === 0 ? undefined : `exit ${code}`,
      })
    })
  })
}
