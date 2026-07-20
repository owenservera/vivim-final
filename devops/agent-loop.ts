// devops/agent-loop.ts
//
// Full autonomous loop: this is the missing *implementer* half that pairs with
// devops/loop.ts (the closer). Where `runLoop` only verifies + advances tracker
// state (assuming a dev-loop agent did the work), this loop *drives* the
// implementer — a headless `kilo run` worker using the funded free model
// `kilo/tencent/hy3:free` — then yields to `runLoop` for the quality gate.
//
// Why `kilo run` and not `kilo serve`/`kilo attach`:
//   - `kilo serve` binds fine (port 4096) but exposes an interactive TUI / HTTP
//     API surface with no one-shot "send message + exit" path from the bare CLI.
//   - `kilo attach <url>` is interactive-only (no --message/--model).
//   - `kilo run --auto "<msg>"` is the documented non-interactive entry point
//     (exit 0=done, 124=timeout, 1=error). It works in a CLEAN working dir.
//
// IMPORTANT (env-specific gotcha, verified 2026-07-18):
//   The repo-root `kilo.json` (non-standard `default_agent`/`references`/`command`
//     fields) causes `kilo run` to HANG with no output when launched from this
//     directory. Launching from a clean temp dir (no kilo.json) works. So the
//     worker is spawned from a temp dir with `KILO_SERVER_PASSWORD` unset, and
//     the task references the real repo via absolute path in the prompt.

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ensureBaseline } from './baseline.ts'
import { runGate } from './gate.ts'
import { markUnit } from './mark.ts'
import { selectNext } from './select.ts'

const LOOP_MODEL = 'kilo/tencent/hy3:free'
// Per-unit wall-clock budget for SILENT output. If the worker produces no new
// stdout for this long, it is wedged (e.g. the repo kilo.json hang) and gets
// force-killed. Free model is slow, but a silent 8-minute gap = stuck, not
// thinking. Override with `--timeout=<seconds>`.
const DEFAULT_WORKER_TIMEOUT_MS = 1000 * 60 * 8

export interface AgentLoopOptions {
  maxUnits?: number
  commit?: boolean
  strict?: boolean
  dryRun?: boolean
}

export interface AgentLoopOptions {
  maxUnits?: number
  commit?: boolean
  strict?: boolean
  dryRun?: boolean
  timeoutMs?: number
}

export interface AgentLoopResult {
  processed: number
  done: string[]
  blocked: string[]
  allComplete: boolean
}

function buildTaskPrompt(unit: {
  id: string
  name: string
  file?: string
}): string {
  const repo = process.cwd()
  const fileHint = unit.file ? `\nAtomic unit file: ${join(repo, unit.file)}` : ''
  return [
    `You are an autonomous coding agent working in the repository at: ${repo}`,
    `Implement atomic unit ${unit.id}: "${unit.name}".${fileHint}`,
    ``,
    `Rules:`,
    `- Read the atomic unit file (and any referenced spec/docs) before editing.`,
    `- Follow the repo's existing code conventions (TypeScript strict, @/* aliases, .js extensions, no 'any').`,
    `- Implement ONLY this unit. Do not refactor unrelated code.`,
    `- Preserve all existing code comments.`,
    `- After editing, run \`bun run lint\` from the repo root and fix any errors you introduced.`,
    `- Do not commit. Stop when the unit's implementation + lint pass is complete.`,
  ].join('\n')
}

async function runWorker(
  prompt: string,
  timeoutMs: number,
): Promise<{ code: number | null; log: string; timedOut: boolean }> {
  const workdir = await mkdtemp(join(tmpdir(), 'kilo-loop-'))
  const logPath = join(workdir, 'worker.log')
  await writeFile(logPath, '', 'utf8')
  let proc: ReturnType<typeof Bun.spawn> | null = null
  try {
    proc = Bun.spawn(['kilo', 'run', '--auto', '--model', LOOP_MODEL, prompt], {
      cwd: workdir,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        KILO_SERVER_PASSWORD: '',
        KILO_SERVER_USERNAME: '',
      },
    })

    const decoder = new TextDecoder()
    let out = ''
    let lastActivity = Date.now()
    const reader = proc.stdout.getReader()
    // Fast-fail probe: the repo-root kilo.json hang produces ZERO output and
    // never exits. If the first byte hasn't arrived within 30s, assume wedged
    // and hard-kill immediately instead of burning the full timeout window.
    const probe = setTimeout(() => {
      if (out.length === 0) {
        out += '\n[watchdog] no output within 30s — assuming wedged, hard-killing\n'
        killTree(proc)
      }
    }, 30_000)
    // Stream-read with a self-defending watchdog: if NO output arrives for
    // `timeoutMs`, the worker is wedged (e.g. the repo kilo.json hang) — kill it.
    const pump = (async () => {
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        out += decoder.decode(value, { stream: true })
        lastActivity = Date.now()
      }
    })()

    const watchdog = setInterval(() => {
      if (Date.now() - lastActivity > timeoutMs) {
        killTree(proc)
      }
    }, Math.min(5000, timeoutMs))
    // Absolute backstop: never let a unit exceed 3x the per-output window.
    const backstop = setTimeout(() => killTree(proc), timeoutMs * 3)

    const code = await proc.exited.catch(() => null)
    clearInterval(watchdog)
    clearTimeout(backstop)
    clearTimeout(probe)
    await pump
    const errOut = decoder.decode(await Bun.readableStreamToArrayBuffer(proc.stderr))

    const log = out + (errOut ? `\n---STDERR---\n${errOut}` : '')
    await writeFile(logPath, log, 'utf8')
    const timedOut = code === null
    return { code, log, timedOut }
  } catch (e) {
    killTree(proc)
    return {
      code: null,
      log: `worker spawn error: ${e instanceof Error ? e.message : String(e)}`,
      timedOut: true,
    }
  } finally {
    killTree(proc)
    await rm(workdir, { recursive: true, force: true }).catch(() => {})
  }
}

// Hard kill the kilo process (and any child it spawned). `kill -9` on the
// Bun subprocess does not always reap the grandchild `kilo` node process, so
// we also signal the process group via taskkill on Windows.
function killTree(proc: ReturnType<typeof Bun.spawn> | null): void {
  if (!proc) return
  try {
    proc.kill(9)
  } catch {
    /* already gone */
  }
  const pid = proc.pid
  if (pid && process.platform === 'win32') {
    try {
      Bun.spawnSync(['taskkill', '/F', '/T', '/PID', String(pid)], {
        stdout: 'ignore',
        stderr: 'ignore',
      })
    } catch {
      /* ignore */
    }
  }
}

export async function runAgentLoop(opts: AgentLoopOptions = {}): Promise<AgentLoopResult> {
  await ensureBaseline()

  const done: string[] = []
  const blocked: string[] = []
  let processed = 0
  const max = opts.maxUnits ?? Number.POSITIVE_INFINITY

  while (processed < max) {
    const sel = await selectNext()
    if (!sel) break

    console.log(`[agent-loop] implementing ${sel.id}: ${sel.name}`)
    await markUnit(sel.id, 'in_progress')

    if (opts.dryRun) {
      console.log(`[agent-loop] DRY RUN — would dispatch worker for ${sel.id}, skipping.`)
      await markUnit(sel.id, 'pending')
      processed++
      continue
    }

    const timeoutMs = opts.timeoutMs ?? DEFAULT_WORKER_TIMEOUT_MS
    const { code, log, timedOut } = await runWorker(buildTaskPrompt(sel), timeoutMs)
    if (code !== 0) {
      console.error(
        `[agent-loop] ${sel.id} -> WORKER ERROR (exit=${code}${timedOut ? ', TIMED OUT & HARD-KILLED at ' + Math.round(timeoutMs / 1000) + 's silent' : ''}). Last output:\n` +
          log.split('\n').slice(-20).join('\n'),
      )
      await markUnit(sel.id, 'blocked')
      blocked.push(sel.id)
      processed++
      continue
    }

    // Worker succeeded — now verify against baseline (reuse closer logic).
    // Re-select this same unit so runGate runs against current repo state.
    const gate = await runGate(opts.strict ?? false, false, 'regression')
    if (gate.pass) {
      await markUnit(sel.id, 'done')
      done.push(sel.id)
      console.log(`[agent-loop] ${sel.id} -> done  (${gate.summary})`)
    } else {
      await markUnit(sel.id, 'blocked')
      blocked.push(sel.id)
      console.error(`[agent-loop] ${sel.id} -> BLOCKED  (${gate.summary})`)
    }
    processed++
  }

  return {
    processed,
    done,
    blocked,
    allComplete: blocked.length === 0,
  }
}
