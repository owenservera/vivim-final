// devops/desktop/cli.ts
// Arg parsing, action dispatch, and per-invocation log tee.
// Every action returns ActionResult with {action, ok, detail, data, artifacts}.

import { mkdirSync, appendFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DIST } from './state.js'

// ── Types ──────────────────────────────────────────────────────────────────

export interface ActionResult {
  action: string
  ok: boolean
  detail: string
  data: Record<string, unknown>
  artifacts: string[]
}

export interface CliArgs {
  action: string
  positionals: string[]
  flags: Map<string, string>
}

export type ActionHandler = (args: CliArgs) => Promise<ActionResult>

// ── Arg Parsing ────────────────────────────────────────────────────────────

export function parseArgs(argv: string[]): CliArgs {
  const flags = new Map<string, string>()
  const positionals: string[] = []
  let action = ''
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const eq = key.indexOf('=')
      if (eq >= 0) {
        flags.set(key.slice(0, eq), key.slice(eq + 1))
      } else {
        const next = argv[i + 1]
        if (next !== undefined && !next.startsWith('--')) {
          flags.set(key, next)
          i++
        } else {
          flags.set(key, 'true')
        }
      }
    } else if (!action) {
      action = a
    } else {
      positionals.push(a)
    }
  }
  return { action, positionals, flags }
}

export function flag(args: CliArgs, key: string, fallback = ''): string {
  return args.flags.get(key) ?? fallback
}

export function flagInt(args: CliArgs, key: string, fallback: number): number {
  const v = args.flags.get(key)
  return v !== undefined ? Number(v) || fallback : fallback
}

export function flagBool(args: CliArgs, key: string, fallback = false): boolean {
  const v = args.flags.get(key)
  if (v === undefined) return fallback
  return v === 'true' || v === '1' || v === ''
}

// ── Per-Invocation Log Tee ─────────────────────────────────────────────────

export function teeConsoleToLog(logPath: string): void {
  mkdirSync(join(logPath, '..'), { recursive: true })
  writeFileSync(logPath, '', 'utf8')
  const origOut = process.stdout.write.bind(process.stdout)
  const origErr = process.stderr.write.bind(process.stderr)
  process.stdout.write = ((chunk: string | Uint8Array, ...rest: unknown[]) => {
    if (typeof chunk === 'string') appendFileSync(logPath, chunk, 'utf8')
    return origOut(chunk as string, ...(rest as Parameters<typeof origOut>))
  }) as unknown as typeof process.stdout.write
  process.stderr.write = ((chunk: string | Uint8Array, ...rest: unknown[]) => {
    if (typeof chunk === 'string') appendFileSync(logPath, chunk, 'utf8')
    return origErr(chunk as string, ...(rest as Parameters<typeof origErr>))
  }) as unknown as typeof process.stderr.write
}

// ── Output Formatting ──────────────────────────────────────────────────────

export function printResult(result: ActionResult, args: CliArgs): void {
  const compact = {
    action: result.action,
    ok: result.ok,
    detail: result.detail,
    data: result.data,
    artifacts: result.artifacts,
  }
  const jsonStr = JSON.stringify(compact, null, 2)

  if (flagBool(args, 'json')) {
    // [audit] removed: console.log(jsonStr)
    return
  }

  const outPath = flag(args, 'out')
  if (outPath) {
    writeFileSync(outPath, jsonStr, 'utf8')
    // [audit] removed: console.log(humanReadable(compact))
    return
  }

  // Human-readable default
  // [audit] removed: console.log(humanReadable(compact))
}

function humanReadable(data: Record<string, unknown>, indent = ''): string {
  const lines: string[] = []
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue
    if (Array.isArray(value)) {
      if (value.length === 0) continue
      if (value.length <= 5 && value.every((v) => typeof v === 'string')) {
        lines.push(`${indent}${key}: ${value.join(', ')}`)
      } else if (typeof value[0] === 'object' && value[0] !== null) {
        lines.push(`${indent}${key}:`)
        for (const item of value) {
          lines.push(humanReadable(item as Record<string, unknown>, indent + '  '))
        }
      } else {
        lines.push(`${indent}${key}: [${value.length} items]`)
      }
    } else if (typeof value === 'object') {
      lines.push(`${indent}${key}:`)
      lines.push(humanReadable(value as Record<string, unknown>, indent + '  '))
    } else {
      lines.push(`${indent}${key}: ${value}`)
    }
  }
  return lines.join('\n')
}

// ── Action Registry ────────────────────────────────────────────────────────

const actions = new Map<string, ActionHandler>()

export function registerAction(name: string, handler: ActionHandler): void {
  actions.set(name, handler)
}

export async function dispatchAction(args: CliArgs): Promise<ActionResult> {
  const handler = actions.get(args.action)
  if (!handler) {
    return {
      action: args.action,
      ok: false,
      detail: `unknown action: ${args.action}`,
      data: { available: [...actions.keys()] },
      artifacts: [],
    }
  }
  return handler(args)
}

export function listActions(): string[] {
  return [...actions.keys()]
}
