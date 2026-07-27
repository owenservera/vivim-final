// src/reprogrammability/dsl/parser.ts
// Phase 3 of ROADMAP-REPROGRAMMABLE-CANVAS.md — The Mutation DSL.
//
// Parses two syntaxes into SurfaceMutation:
//   1. JSON — the canonical form (already covered by SurfaceMutationSchema).
//   2. Slash shorthand — a compact, human-friendly form for the Composer.
//
// Shorthand grammar (regex-driven; intentionally limited):
//   /hide panel:conversations
//   /show panel:conversations
//   /restyle panel:conversations background=black
//   /rebind card:doc:abc capability=cap:send-message
//   /move panel:conversations to right
//   /rename panel:conversations "My Panel"
//
// The shorthand maps to exactly ONE of the 8 mutation ops. For anything
// more complex, the user writes JSON (or asks the LLM harness, Phase 7).
//
// CONTRACT_VERSION: 1

import { z } from 'zod'
import { SurfaceMutationSchema, type SurfaceMutation } from '../mutation-schema.js'

export class DslParseError extends Error {
  readonly input: string
  readonly position?: number
  constructor(input: string, message: string, position?: number) {
    super(`DSL parse error: ${message}${position !== undefined ? ` at position ${position}` : ''}\n  input: ${input.slice(0, 200)}`)
    this.name = 'DslParseError'
    this.input = input
    this.position = position
  }
}

/**
 * Parse a single mutation from either JSON or slash shorthand.
 *
 * - If input starts with `{`, parse as JSON.
 * - If input starts with `/`, `@`, `#`, `!`, `~`, `$`, `?`, parse as shorthand.
 * - Otherwise, throw DslParseError.
 *
 * Returns a validated SurfaceMutation.
 */
export function parseMutation(input: string): SurfaceMutation {
  const trimmed = input.trim()
  if (!trimmed) throw new DslParseError(input, 'empty input')

  // JSON path.
  if (trimmed.startsWith('{')) {
    let obj: unknown
    try {
      obj = JSON.parse(trimmed)
    } catch (err) {
      throw new DslParseError(
        input,
        `JSON parse failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
    const parsed = SurfaceMutationSchema.safeParse(obj)
    if (!parsed.success) {
      throw new DslParseError(
        input,
        `schema validation failed: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
      )
    }
    return parsed.data
  }

  // Shorthand path.
  if (/^[/@#!~$?]/.test(trimmed)) {
    return parseShorthand(trimmed)
  }

  throw new DslParseError(
    input,
    'input must start with `{` (JSON) or one of `/ @ # ! ~ $ ?` (shorthand)',
  )
}

/**
 * Parse a list of mutations (JSON array, one per line, or mixed).
 */
export function parseMutationList(input: string): SurfaceMutation[] {
  const trimmed = input.trim()
  if (!trimmed) return []

  // JSON array.
  if (trimmed.startsWith('[')) {
    let arr: unknown
    try {
      arr = JSON.parse(trimmed)
    } catch (err) {
      throw new DslParseError(
        input,
        `JSON array parse failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
    if (!Array.isArray(arr)) {
      throw new DslParseError(input, 'JSON input was not an array')
    }
    return arr.map((item, i) => {
      try {
        const parsed = SurfaceMutationSchema.safeParse(item)
        if (!parsed.success) {
          throw new DslParseError(
            input,
            `item ${i} schema validation failed: ${parsed.error.issues.map((x) => x.message).join('; ')}`,
          )
        }
        return parsed.data
      } catch (e) {
        if (e instanceof DslParseError) throw e
        throw new DslParseError(input, `item ${i} failed: ${String(e)}`, i)
      }
    })
  }

  // One-per-line.
  const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean)
  return lines.map((line, i) => {
    try {
      return parseMutation(line)
    } catch (e) {
      if (e instanceof DslParseError) {
        throw new DslParseError(input, `line ${i + 1}: ${e.message}`, i)
      }
      throw new DslParseError(input, `line ${i + 1} failed: ${String(e)}`, i)
    }
  })
}

// ── Shorthand parser ─────────────────────────────────────────────────────

/**
 * Parse a single shorthand line.
 *
 * Recognized commands (case-insensitive):
 *   /hide <target>                              → set_property {visible:false}
 *   /show <target>                              → set_property {visible:true}
 *   /rename <target> "<name>"                   → set_property {title:"<name>"}
 *   /move <target> to <slot|dock>               → set_slot OR set_property
 *   /restyle <target> <key>=<value>...          → restyle {<key>:<value>...}
 *   /rebind <target> capability=<capId>         → rebind {capabilityId:<capId>}
 *   /unbind <target> capability=<capId>         → rebind {capabilityId:<capId>, action:'unbind'}
 *   /replace <target> <json>                    → replace <json>
 *   /remove <target>                            → remove
 *   /reorder <target> <id1>,<id2>,...           → reorder [<id1>,<id2>,...]
 *
 * Provenance defaults to 'nlcl' (since shorthand is the NLCL-friendly form).
 * Override by appending ` as manual` or ` as system` etc.
 */
export function parseShorthand(line: string): SurfaceMutation {
  const trimmed = line.trim()
  // Strip the leading prefix character.
  const prefix = trimmed[0]
  if (!prefix || !/[/@#!~$?]/.test(prefix)) {
    throw new DslParseError(line, 'shorthand must start with a prefix character')
  }
  const rest = trimmed.slice(1).trim()

  // Split off provenance override if present: `... as manual`.
  const asMatch = rest.match(/\s+as\s+(manual|nlcl|prefix|plugin|llm-harness|system)$/)
  let body = rest
  let provenance: SurfaceMutation['provenance'] = 'nlcl'
  if (asMatch) {
    provenance = asMatch[1] as SurfaceMutation['provenance']
    body = rest.slice(0, asMatch.index).trim()
  }

  // Split into command + args on first whitespace.
  const spaceIdx = body.search(/\s/)
  const cmd = spaceIdx < 0 ? body : body.slice(0, spaceIdx).toLowerCase()
  const args = spaceIdx < 0 ? '' : body.slice(spaceIdx + 1).trim()

  switch (cmd) {
    case 'hide': {
      const target = args.trim()
      if (!target) throw new DslParseError(line, '/hide requires a target')
      return {
        op: 'set_property',
        target,
        provenance,
        payload: { path: 'visible', value: false },
      }
    }
    case 'show': {
      const target = args.trim()
      if (!target) throw new DslParseError(line, '/show requires a target')
      return {
        op: 'set_property',
        target,
        provenance,
        payload: { path: 'visible', value: true },
      }
    }
    case 'rename': {
      const m = args.match(/^(\S+)\s+"([^"]*)"/)
      if (!m) throw new DslParseError(line, '/rename requires: <target> "new name"')
      return {
        op: 'set_property',
        target: m[1]!,
        provenance,
        payload: { path: 'title', value: m[2] },
      }
    }
    case 'move': {
      // /move <target> to <slot-or-dock>
      // Allow dots and colons in destination (e.g. chat.thread, panel:left).
      const m = args.match(/^(\S+)\s+to\s+([\w.:-]+)$/)
      if (!m) throw new DslParseError(line, '/move requires: <target> to <slot>')
      const target = m[1]!
      const dest = m[2]!
      // If dest is a dock edge, set_property; otherwise set_slot.
      if (['left', 'right', 'top', 'bottom', 'floating'].includes(dest)) {
        return {
          op: 'set_property',
          target,
          provenance,
          payload: { path: 'dock', value: dest },
        }
      }
      return {
        op: 'set_slot',
        target,
        provenance,
        payload: { slotId: dest },
      }
    }
    case 'restyle': {
      // /restyle <target> key1=value1 key2=value2
      const parts = args.split(/\s+/).filter(Boolean)
      if (parts.length < 2) {
        throw new DslParseError(line, '/restyle requires: <target> key=value [key=value...]')
      }
      const target = parts[0]!
      const style: Record<string, unknown> = {}
      for (let i = 1; i < parts.length; i++) {
        const kv = parts[i]!.split('=')
        if (kv.length !== 2) {
          throw new DslParseError(line, `invalid key=value: ${parts[i]}`)
        }
        const [k, v] = kv
        // Try to parse the value as JSON; fall back to string.
        let parsed: unknown = v
        try {
          parsed = JSON.parse(v!)
        } catch {
          parsed = v
        }
        style[k!] = parsed
      }
      return {
        op: 'restyle',
        target,
        provenance,
        payload: style,
      }
    }
    case 'rebind': {
      // /rebind <target> capability=<capId> [slot=<slot>]
      const parts = args.split(/\s+/).filter(Boolean)
      if (parts.length < 2) {
        throw new DslParseError(line, '/rebind requires: <target> capability=<capId>')
      }
      const target = parts[0]!
      let capabilityId: string | undefined
      let slot: string | undefined
      for (let i = 1; i < parts.length; i++) {
        const kv = parts[i]!.split('=')
        if (kv.length !== 2) {
          throw new DslParseError(line, `invalid key=value: ${parts[i]}`)
        }
        if (kv[0] === 'capability') capabilityId = kv[1]
        else if (kv[0] === 'slot') slot = kv[1]
        else throw new DslParseError(line, `unknown rebind key: ${kv[0]}`)
      }
      if (!capabilityId) {
        throw new DslParseError(line, '/rebind requires capability=<capId>')
      }
      return {
        op: 'rebind',
        target,
        provenance,
        payload: { capabilityId, slot, action: 'bind' },
      }
    }
    case 'unbind': {
      // /unbind <target> capability=<capId>
      const parts = args.split(/\s+/).filter(Boolean)
      if (parts.length < 2) {
        throw new DslParseError(line, '/unbind requires: <target> capability=<capId>')
      }
      const target = parts[0]!
      let capabilityId: string | undefined
      for (let i = 1; i < parts.length; i++) {
        const kv = parts[i]!.split('=')
        if (kv[0] === 'capability') capabilityId = kv[1]
      }
      if (!capabilityId) {
        throw new DslParseError(line, '/unbind requires capability=<capId>')
      }
      return {
        op: 'rebind',
        target,
        provenance,
        payload: { capabilityId, action: 'unbind' },
      }
    }
    case 'replace': {
      // /replace <target> <json>
      const spaceIdx = args.search(/\s/)
      if (spaceIdx < 0) {
        throw new DslParseError(line, '/replace requires: <target> <json>')
      }
      const target = args.slice(0, spaceIdx).trim()
      const jsonStr = args.slice(spaceIdx + 1).trim()
      let payload: unknown
      try {
        payload = JSON.parse(jsonStr)
      } catch (err) {
        throw new DslParseError(
          line,
          `/replace JSON parse failed: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
      return {
        op: 'replace',
        target,
        provenance,
        payload,
      }
    }
    case 'remove': {
      const target = args.trim()
      if (!target) throw new DslParseError(line, '/remove requires a target')
      return {
        op: 'remove',
        target,
        provenance,
      }
    }
    case 'reorder': {
      // /reorder <target> id1,id2,id3
      const m = args.match(/^(\S+)\s+(.+)$/)
      if (!m) throw new DslParseError(line, '/reorder requires: <target> id1,id2,...')
      const target = m[1]!
      const ids = m[2]!.split(',').map((s) => s.trim()).filter(Boolean)
      if (ids.length === 0) {
        throw new DslParseError(line, '/reorder requires at least one id')
      }
      return {
        op: 'reorder',
        target,
        provenance,
        payload: ids,
      }
    }
    default:
      throw new DslParseError(
        line,
        `unknown shorthand command: ${cmd}. Valid: hide, show, rename, move, restyle, rebind, unbind, replace, remove, reorder`,
      )
  }
}

// Re-export for convenience.
export { SurfaceMutationSchema }
export type { SurfaceMutation }
