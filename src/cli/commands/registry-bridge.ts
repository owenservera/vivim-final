// src/cli/commands/registry-bridge.ts
// Unit 24.8 — bridges the UnifiedCapabilityRegistry to the CLI CommandRegistry
// (in-process) and provides the introspection/dispatch helpers for the
// thin-shell CLI that talks to a running server over the universal route.

import { z } from 'zod'
import type {
  UnifiedCapability,
  UnifiedCapabilityRegistry,
} from '../../engines/unified-registry.js'
import type { CliCommand, CommandRegistry } from '../command-registry.js'

export interface CliCapability {
  id: string
  slug: string
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties?: Record<string, { type: string; description?: string }>
    required?: string[]
  }
  cliCommand?: { name: string; aliases?: string[]; examples?: string[] }
}

/** Build a loose Zod schema from a JSON inputSchema (satisfies CliCommand.schema). */
export function jsonSchemaToZod(schema: CliCapability['inputSchema']): z.ZodTypeAny {
  const shape: Record<string, z.ZodTypeAny> = {}
  const props = schema?.properties ?? {}
  const required = new Set(schema?.required ?? [])
  for (const [key, def] of Object.entries(props)) {
    let zod: z.ZodTypeAny = z.string()
    switch (def.type) {
      case 'number':
      case 'integer':
        zod = z.number()
        break
      case 'boolean':
        zod = z.boolean()
        break
      case 'array':
        zod = z.array(z.any())
        break
      case 'object':
        zod = z.record(z.any())
        break
      default:
        zod = z.string()
    }
    shape[key] = required.has(key) ? zod : zod.optional()
  }
  return z.object(shape)
}

/**
 * In-process bridge: register every cli-surface capability as a CLI command
 * whose handler executes the capability directly through the registry.
 * Used when the CLI runs inside the server (after connectCapabilityRegistry).
 */
export function syncCliFromUnified(
  reg: UnifiedCapabilityRegistry,
  registry: CommandRegistry,
): void {
  const caps = reg.list({ surface: 'cli' }) as UnifiedCapability[]
  for (const cap of caps) {
    const cli = cap.cliCommand
    if (!cli) continue
    const names = [cli.name, ...(cli.aliases ?? [])]
    for (const name of names) {
      const cmd: CliCommand = {
        name,
        description: cap.description,
        subsystem: 'cap-store',
        schema: jsonSchemaToZod(cap.inputSchema as CliCapability['inputSchema']),
        examples: cli.examples ?? [],
        handler: async (args: unknown) => {
          const a = (args ?? {}) as { args?: string[]; flags?: Record<string, string> }
          const input = argvToInput(
            a.args ?? [],
            stripMeta(a.flags ?? {}),
            cap.inputSchema as CliCapability['inputSchema'],
          )
          const output = await reg.execute(cap.id, input, { metadata: {} })
          return { data: output }
        },
      }
      registry.register(cmd)
    }
  }
}

/** Fetch cli-surface capabilities from a running server (thin-shell introspection). */
export async function fetchCliCapabilities(remote: string): Promise<CliCapability[]> {
  const res = await fetch(`${remote}/api/capabilities?surface=cli`)
  if (!res.ok) throw new Error(`failed to fetch capabilities: ${res.status}`)
  return (await res.json()) as CliCapability[]
}

/** Match a command token list to a capability by cliCommand.name or alias. */
export function matchCapability(
  caps: CliCapability[],
  tokens: string[],
): { cap: CliCapability; rest: string[] } | undefined {
  for (let i = Math.min(tokens.length, 4); i >= 1; i--) {
    const joined = tokens.slice(0, i).join(' ')
    const cap = caps.find(
      (c) => c.cliCommand?.name === joined || c.cliCommand?.aliases?.includes(joined),
    )
    if (cap) return { cap, rest: tokens.slice(i) }
  }
  const head = tokens[0]
  if (!head) return undefined
  const cap = caps.find((c) => c.cliCommand?.aliases?.includes(head))
  if (cap) return { cap, rest: tokens.slice(1) }
  return undefined
}

/**
 * Map positional args + --flag values onto an inputSchema.
 * Flags match property names; positional args fill required props (then the
 * remaining props) in declared order.
 */
export function argvToInput(
  args: string[],
  flags: Record<string, string>,
  schema: CliCapability['inputSchema'],
): Record<string, unknown> {
  const props = schema?.properties ?? {}
  const required = schema?.required ?? []
  const input: Record<string, unknown> = {}

  for (const [key, val] of Object.entries(flags)) {
    const def = props[key]
    if (!def) continue
    if (key in props) input[key] = coerce(def.type, val)
  }

  const positionalTargets: string[] = []
  for (const key of required) if (!(key in input)) positionalTargets.push(key)
  for (const key of Object.keys(props)) if (!(key in input)) positionalTargets.push(key)

  let ai = 0
  for (const key of positionalTargets) {
    if (ai >= args.length) break
    const def = props[key]
    if (!def) continue
    input[key] = coerce(def.type, args[ai] ?? '')
    ai++
  }
  return input
}

/** Strip CLI meta-flags so they are not mistaken for capability inputs. */
export function stripMeta(flags: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(flags)) {
    if (k === 'json' || k === 'remote' || k === 'auth') continue
    out[k] = v
  }
  return out
}

function coerce(type: string | undefined, val: string): unknown {
  if (type === 'number' || type === 'integer') {
    const n = Number(val)
    return Number.isNaN(n) ? val : n
  }
  if (type === 'boolean') return val === 'true' || val === '1' || val === ''
  return val
}
