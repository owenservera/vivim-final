// src/engines/harness-repair-engine.ts
// Harness I/O Repair Engine (017-harness-command-registry, US2 / FR-006, FR-008).
//
// Browser-free, LLM-output-tolerant repair. The pasted design proposed a
// `z.ZodType.prototype.repair` monkey-patch; we instead carry repair metadata in
// a SIDE-TABLE (src/schema/repair-metadata.ts) keyed by the Zod type — no
// prototype mutation, no global state, works under multiple schema instances.
//
// Key defect fixed: the pasted design repaired unbalanced quotes with a blind
// `'` -> `"` substitution that corrupts legitimate apostrophes ("O'Brien").
// We only balance quotes when the count is ODD, and never touch interior
// apostrophes.

import type { z } from 'zod'
import { HarnessRepairError } from '../errors.js'
import { newId } from '../ids.js'
import { getRepairMetadata } from '../schema/repair-metadata.js'
import type {
  HarnessRepairStore,
  RepairSessionRow,
} from '../storage/contracts/harness-repair-store.js'

export interface RepairResult {
  ok: boolean
  data?: unknown
  repairs: string[]
  errors: string[]
}

export interface RepairInput {
  content: string
  schema: z.ZodType
  conversationId?: string
  commandId?: string
}

export class HarnessRepairEngine {
  constructor(private store: HarnessRepairStore) {}

  /** Repair a JSON/string blob produced by an LLM against a Zod schema. */
  async repair(input: RepairInput): Promise<RepairResult> {
    const { content, schema, conversationId, commandId } = input
    const repairs: string[] = []
    const errors: string[] = []
    let working = content

    try {
      // Pass 1: structural string repair (quote balancing, trailing commas).
      working = this.repairStringShape(working, repairs)

      // Pass 2: parse and validate/coerce against the schema.
      const parsed = this.parseAndCoerce(working, schema, repairs, errors)

      const session = this.buildSession({
        conversationId,
        commandId,
        originalContent: content,
        repairedContent: working,
        strategy: 'schema-aware',
        success: parsed !== undefined,
        errors,
        repairs,
      })
      await this.store.saveRepairSession(session)

      if (parsed === undefined) {
        return { ok: false, repairs, errors }
      }
      return { ok: true, data: parsed, repairs, errors }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push(message)
      const session = this.buildSession({
        conversationId,
        commandId,
        originalContent: content,
        repairedContent: working,
        strategy: 'schema-aware',
        success: false,
        errors,
        repairs,
      })
      await this.store.saveRepairSession(session)
      throw new HarnessRepairError(`Repair failed: ${message}`, {
        cause: err,
        repairs,
        errors,
      })
    }
  }

  /**
   * Balance quotes ONLY when unbalanced. Defect fix: never rewrite interior
   * apostrophes. We detect odd quote counts per line and wrap bare values,
   * but preserve legitimate single-quote apostrophes inside string content.
   */
  private repairStringShape(raw: string, repairs: string[]): string {
    let out = raw
    // Strip a leading/trailing code-fence if present.
    const fenced = out.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
    if (fenced) {
      out = fenced[1] ?? ''
      repairs.push('stripped_code_fence')
    }
    // Remove trailing commas before } or ].
    const noTrailing = out.replace(/,(\s*[}\]])/g, '$1')
    if (noTrailing !== out) repairs.push('removed_trailing_comma')
    out = noTrailing
    return out
  }

  private parseAndCoerce(
    raw: string,
    schema: z.ZodType,
    repairs: string[],
    errors: string[],
  ): unknown {
    let value: unknown
    try {
      value = JSON.parse(raw)
    } catch {
      // The target is a bare string (e.g. repairString()): the LLM returned a
      // plain value, not JSON. Return it verbatim — NEVER rewrite interior
      // apostrophes (defect fix: blind `'`->`"` corrupts "O'Brien").
      if (this.isStringSchema(schema)) {
        const trimmed = raw.trim()
        if (trimmed) {
          repairs.push('accepted_plain_string')
          return trimmed
        }
      }
      // Try to recover unbalanced quotes only if quote count is odd.
      const balanced = this.balanceQuotes(raw)
      if (balanced !== raw) repairs.push('balanced_quotes')
      try {
        value = JSON.parse(balanced)
      } catch (e) {
        errors.push(`JSON parse failed: ${e instanceof Error ? e.message : String(e)}`)
        return undefined
      }
    }
    // Coerce/validate against the schema, applying side-table metadata.
    return this.coerce(value, schema, repairs, errors)
  }

  private isStringSchema(schema: z.ZodType): boolean {
    let s: unknown = schema
    // Unwrap ZodDefault / ZodEffects to find the underlying type.
    while (s && typeof s === 'object' && '_def' in (s as object)) {
      const def = (s as { _def?: { typeName?: string; innerType?: unknown; schema?: unknown } })
        ._def
      if (def?.typeName === 'ZodString') return true
      s = def?.innerType ?? def?.schema
    }
    return false
  }

  /** Balance double-quotes when odd; preserve interior apostrophes. */
  private balanceQuotes(raw: string): string {
    const doubleCount = (raw.match(/"/g) ?? []).length
    if (doubleCount % 2 === 0) return raw
    // Wrap the whole payload in quotes only if it looks like a bare token.
    const trimmed = raw.trim()
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return `"${raw.replace(/"/g, '').trim()}"`
    }
    return raw
  }

  private coerce(value: unknown, schema: z.ZodType, repairs: string[], errors: string[]): unknown {
    const meta = getRepairMetadata(schema)
    if (value === undefined || value === null) {
      if (meta?.defaultValue !== undefined) {
        repairs.push(`applied_default:${meta.description ?? schema.constructor.name}`)
        return meta.defaultValue
      }
    }
    const result = schema.safeParse(value)
    if (result.success) return result.data
    errors.push(`schema: ${result.error.issues.map((i) => i.message).join('; ')}`)

    // Alias-based recovery:
    // (a) Top-level schema with aliases: try the alternate key on the value.
    if (meta?.aliases?.length && value && typeof value === 'object') {
      const obj = value as Record<string, unknown>
      for (const alias of meta.aliases) {
        if (alias in obj) {
          repairs.push(`alias_used:${alias}`)
          return this.coerce(obj[alias], schema, repairs, errors)
        }
      }
    }
    // (b) Object schema with child fields carrying alias metadata: remap the
    // raw object's keys to the canonical field names, then re-validate.
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const remapped = this.remapAliases(value as Record<string, unknown>, schema, repairs)
      if (remapped) {
        const retry = schema.safeParse(remapped)
        if (retry.success) return retry.data
      }
    }
    return undefined
  }

  /**
   * For an object schema, scan each field's repair metadata for aliases and
   * copy the aliased key's value onto the canonical key in a shallow clone.
   * Returns the clone if any remap happened, else null.
   */
  private remapAliases(
    obj: Record<string, unknown>,
    schema: z.ZodType,
    repairs: string[],
  ): Record<string, unknown> | null {
    let shape: Record<string, z.ZodType> | undefined
    let s: unknown = schema
    while (s && typeof s === 'object' && '_def' in (s as object)) {
      const def = (
        s as {
          _def?: {
            typeName?: string
            shape?: Record<string, z.ZodType> | (() => Record<string, z.ZodType>)
            innerType?: unknown
            schema?: unknown
          }
        }
      )._def
      if (def?.typeName === 'ZodObject' && def.shape) {
        shape =
          typeof def.shape === 'function'
            ? (def.shape as () => Record<string, z.ZodType>)()
            : def.shape
        break
      }
      s = def?.innerType ?? def?.schema
    }
    if (!shape) return null
    let changed = false
    const out = { ...obj }
    for (const [key, fieldSchema] of Object.entries(shape)) {
      const fmeta = getRepairMetadata(fieldSchema)
      if (!fmeta?.aliases?.length) continue
      for (const alias of fmeta.aliases) {
        if (alias in obj && !(key in obj)) {
          out[key] = obj[alias]
          repairs.push(`alias_used:${alias}`)
          changed = true
        }
      }
    }
    return changed ? out : null
  }

  private buildSession(args: {
    conversationId?: string
    commandId?: string
    originalContent: string
    repairedContent: string
    strategy: string
    success: boolean
    errors: string[]
    repairs: string[]
  }): RepairSessionRow {
    return {
      id: newId(),
      conversationId: args.conversationId ?? null,
      commandId: args.commandId ?? null,
      originalContent: args.originalContent,
      repairedContent: args.repairedContent,
      strategy: args.strategy,
      success: args.success,
      errorsJson: JSON.stringify(args.errors),
      repairsJson: JSON.stringify(args.repairs),
      createdAt: Date.now(),
    }
  }
}
