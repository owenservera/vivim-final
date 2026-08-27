// src/engines/harness-command-registry.ts
// Harness Command Registry (017-harness-command-registry, US2).
//
// Resolves a `commandId@version` (or `commandId@latest`) to a stored
// HarnessCommand descriptor, validates invocation params against the stored
// Zod-compatible JSON schema, and produces the HarnessDAG node for execution.
//
// Defect fixed: version resolution uses SEMVER ordering, not lexicographic
// string sort (which would rank "1.10.0" < "1.9.0").

import { z } from 'zod'
import { HarnessCommandNotFoundError } from '../errors.js'
import type { GovernorStore, HarnessCommandRow } from '../storage/contracts/governor-store.js'

export interface ResolvedCommand {
  commandId: string
  version: string
  kind: string
  adaptorRef: string
  description: string
  paramsSchema: z.ZodTypeAny
  /** Raw JSON-schema (from paramsSchemaJson) used for required-field checks. */
  rawSchema?: Record<string, unknown>
}

function parseSemver(v: string): [number, number, number] {
  const m = v.match(/^v?(\d+)\.(\d+)\.(\d+)/)
  if (!m) return [0, 0, 0]
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

function cmpSemver(a: string, b: string): number {
  const pa = parseSemver(a)
  const pb = parseSemver(b)
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return (pa[i] ?? 0) - (pb[i] ?? 0)
  }
  return 0
}

/** Passthrough schema used when no caller-supplied Zod schema is wired. */
const PLACEHOLDER_SCHEMA: z.ZodTypeAny = z.object({}).passthrough()

function makeZodError(message: string): z.ZodError {
  return new z.ZodError([
    {
      code: z.ZodIssueCode.custom,
      message,
      path: [],
    },
  ])
}

export class HarnessCommandRegistry {
  constructor(private store: GovernorStore) {}

  /** Resolve a commandId, optionally with @version or @latest. */
  async resolve(spec: string): Promise<ResolvedCommand> {
    const parts = spec.split('@')
    const commandId = parts[0] ?? ''
    const rawVersion = parts[1]
    if (!commandId) throw new HarnessCommandNotFoundError(`Empty command spec: ${spec}`)

    if (!rawVersion || rawVersion === 'latest') {
      const all = await this.store.listHarnessCommands(commandId)
      if (!all.length) throw new HarnessCommandNotFoundError(commandId)
      const latest = all.reduce((a, b) => (cmpSemver(a.version, b.version) >= 0 ? a : b))
      return this.toResolved(latest)
    }

    const row = await this.store.getHarnessCommand(commandId, rawVersion)
    if (!row) throw new HarnessCommandNotFoundError(spec)
    return this.toResolved(row)
  }

  /** Validate params against the resolved command's stored schema. */
  validateParams(
    cmd: ResolvedCommand,
    params: unknown,
  ): { success: boolean; data?: unknown; error?: z.ZodError } {
    // If a real Zod schema is wired (e.g. by the caller), use it directly.
    if (cmd.paramsSchema !== PLACEHOLDER_SCHEMA) {
      return cmd.paramsSchema.safeParse(params)
    }
    // Otherwise apply a lightweight required-field check from the raw JSON schema.
    const required = Array.isArray(cmd.rawSchema?.required)
      ? (cmd.rawSchema?.required as string[])
      : []
    if (!params || typeof params !== 'object') {
      return { success: false, error: makeZodError('params must be an object') }
    }
    const obj = params as Record<string, unknown>
    const missing = required.filter((k) => !(k in obj))
    if (missing.length) {
      return { success: false, error: makeZodError(`missing required: ${missing.join(', ')}`) }
    }
    return { success: true, data: obj }
  }

  /** Build a HarnessNode for execution by ChromeGovernor.executeHarnessPlan. */
  toHarnessNode(
    cmd: ResolvedCommand,
    params: Record<string, unknown>,
  ): { type: string; moduleId: string; params: Record<string, unknown> } {
    return {
      type: cmd.kind === 'action' ? 'action' : cmd.kind,
      moduleId: cmd.commandId,
      params,
    }
  }

  private toResolved(row: HarnessCommandRow): ResolvedCommand {
    let rawSchema: Record<string, unknown> | undefined
    try {
      const json = JSON.parse(row.paramsSchemaJson)
      if (json && typeof json === 'object') rawSchema = json as Record<string, unknown>
    } catch {
      rawSchema = undefined
    }
    return {
      commandId: row.commandId,
      version: row.version,
      kind: row.kind,
      adaptorRef: row.adaptorRef,
      description: row.description,
      paramsSchema: PLACEHOLDER_SCHEMA,
      rawSchema,
    }
  }
}
