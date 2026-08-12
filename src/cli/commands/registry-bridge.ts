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
      case 'array': {
        // Support typed arrays when items schema is available
        const items = (def as { items?: { type: string } }).items
        let itemZod = z.string()
        if (items?.type === 'number' || items?.type === 'integer') itemZod = z.number()
        else if (items?.type === 'boolean') itemZod = z.boolean()
        else if (items?.type === 'object') itemZod = z.record(z.any())
        zod = z.array(itemZod)
        break
      }
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
  const seen = new Set<string>()
  let skipped = 0
  for (const cap of caps) {
    const cli = cap.cliCommand
    if (!cli) continue
    const names = [cli.name, ...(cli.aliases ?? [])]
    for (const name of names) {
      if (seen.has(name)) {
        // [audit] removed: console.warn(
          `[cli-bridge] alias collision: "${name}" already registered (skipping ${cap.slug})`,
        )
        skipped++
        continue
      }
      seen.add(name)
      const cmd: CliCommand = {
        name,
        description: cap.description,
        subsystem:
          cap.category === 'conversation'
            ? 'cap-store'
            : cap.category === 'admin'
              ? 'backend'
              : cap.category === 'system'
                ? 'backend'
                : cap.category === 'user'
                  ? 'backend'
                  : cap.category === 'canvas'
                    ? 'extension'
                    : cap.category === 'discovery'
                      ? 'extension'
                      : 'cap-store',
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
  if (skipped > 0) {
    // [audit] removed: console.warn(`[cli-bridge] ${skipped} aliases skipped due to collisions`)
  }
}

/** Fetch cli-surface capabilities from a running server (thin-shell introspection). */
export async function fetchCliCapabilities(remote: string): Promise<CliCapability[]> {
  const res = await fetch(`${remote}/api/capabilities?surface=cli`)
  if (!res.ok) throw new Error(`failed to fetch capabilities: ${res.status}`)
  const data = (await res.json()) as { capabilities?: CliCapability[] } | CliCapability[]
  return Array.isArray(data) ? data : (data.capabilities ?? [])
}

/** Match a command token list to a capability by cliCommand.name or alias. */
export function matchCapability(
  caps: CliCapability[],
  tokens: string[],
): { cap: CliCapability; rest: string[] } | undefined {
  // Try matching full token depth (no longer capped at 4)
  for (let i = Math.min(tokens.length, 8); i >= 1; i--) {
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
const META_FLAGS = new Set(['json', 'remote', 'auth', 'help', 'version', 'verbose', 'quiet'])
export function stripMeta(flags: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(flags)) {
    if (META_FLAGS.has(k)) continue
    out[k] = v
  }
  return out
}

/**
 * Execute a capability on a remote server via POST /api/capabilities/:id/execute.
 * Positional args are mapped to input schema automatically.
 */
// In-memory cache for remote capability introspection (avoids re-fetching on every invocation)
let _remoteCapsCache: { remote: string; caps: CliCapability[]; ts: number } | null = null
const REMOTE_CAPS_TTL = 30_000 // 30 seconds

export async function executeRemote(
  remote: string,
  capId: string,
  args: string[],
  flags: Record<string, string>,
): Promise<unknown> {
  const cleanFlags = stripMeta(flags)
  // Use cached capabilities if fresh
  let caps: CliCapability[]
  if (
    _remoteCapsCache &&
    _remoteCapsCache.remote === remote &&
    Date.now() - _remoteCapsCache.ts < REMOTE_CAPS_TTL
  ) {
    caps = _remoteCapsCache.caps
  } else {
    caps = await fetchCliCapabilities(remote)
    _remoteCapsCache = { remote, caps, ts: Date.now() }
  }
  const found = caps.find((c) => c.id === capId)
  // Support --json-input for nested payloads
  const jsonInput = flags['json-input']
  let input: Record<string, unknown>
  if (jsonInput) {
    try {
      input = JSON.parse(jsonInput) as Record<string, unknown>
    } catch {
      input = found
        ? argvToInput(args, cleanFlags, found.inputSchema)
        : { _rawArgs: args, ...cleanFlags }
    }
  } else {
    input = found
      ? argvToInput(args, cleanFlags, found.inputSchema)
      : { _rawArgs: args, ...cleanFlags }
  }
  const res = await fetch(`${remote}/api/capabilities/${capId}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Source': 'cli' },
    body: JSON.stringify({ input }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`remote execute failed (${res.status}): ${err}`)
  }
  const data = (await res.json()) as { output: unknown }
  return data.output
}

function coerce(type: string | undefined, val: string): unknown {
  if (type === 'number' || type === 'integer') {
    const n = Number(val)
    return Number.isNaN(n) ? val : n
  }
  if (type === 'boolean') {
    // Only explicit 'true'/'1' are true. Empty string and 'false'/'0' are false.
    return val === 'true' || val === '1'
  }
  // Support --json-input for nested object/array payloads
  if ((type === 'object' || type === 'array') && val.startsWith('{')) {
    try {
      return JSON.parse(val)
    } catch {
      return val
    }
  }
  return val
}
