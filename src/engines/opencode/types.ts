// src/engines/opencode/types.ts
// Shared types + risk-tier mapping for the OpenCode `serve` integration (feature 027).
// Event grammar: opencode v1.18.4 namespaced events (`message.part.delta`, `session.idle`)
// wrap fields in `properties`; v1.17.15 flat `part.*` fields are kept for backward compat.

import type { ContentBlock } from '../../schema/streaming.js'

/**
 * Raw SSE event frame from `opencode serve` (`GET /event`).
 * v1.18.4 frames: `{ id, type, properties: { sessionID, messageID?, partID?, field?, delta?, ... } }`
 */
export interface OpencodeEvent {
  id?: string
  type?: string
  /** v1.18.4 payload wrapper. */
  properties?: {
    sessionID?: string
    messageID?: string
    partID?: string
    /** For `message.part.delta`: which part field is streaming. */
    field?: string
    /** For `message.part.delta`: the text chunk (concatenate to rebuild text). */
    delta?: string
    /** For `session.status`: the session run state. */
    status?: { type?: string; error?: unknown }
    /** For `permission.asked`: the `^per` permission request ID + permission name. */
    id?: string
    permission?: string
    [key: string]: unknown
  }
  // v1.17.15 flat fields (kept for backward compat / tests)
  subtype?: string
  sessionID?: string
  permissionID?: string
  toolName?: string
  filePath?: string
  /** RFC-6902 JSON Patch ops for a file edit. */
  patch?: unknown[]
  error?: { name?: string; data?: { message?: string; ref?: string } } | string
  part?: {
    type?: string
    text?: string
    tool?: string
    callID?: string
    state?: { status?: string; input?: unknown; output?: string }
    reason?: string
    tokens?: {
      total?: number
      input?: number
      output?: number
      reasoning?: number
      cache?: { read?: number; write?: number }
    }
    cost?: number
    sessionID?: string
  }
}

/**
 * v1.18.4 text streaming arrives as repeated `message.part.delta` frames with
 * `properties.field === 'text'`. Returns the chunk, or undefined for other events.
 */
export function textDeltaFromEvent(ev: OpencodeEvent): string | undefined {
  if (ev.type === 'message.part.delta' && ev.properties?.field === 'text') {
    const d = ev.properties.delta
    if (typeof d === 'string' && d) return d
  }
  return undefined
}

/** True when the event marks the session run as finished (v1.18.4 `session.idle`). */
export function isSessionDone(ev: OpencodeEvent): boolean {
  if (ev.type === 'session.idle') return true
  if (ev.type === 'session.status' && ev.properties?.status?.type === 'idle') return true
  if (ev.type === 'step_finish' || ev.type === 'done') return true
  return false
}

export type PermissionDecision = 'allow' | 'deny' | 'allow_always'

/** Risk tier 1-5 (maps to Node.securityLevel). */
export type RiskTier = 1 | 2 | 3 | 4 | 5

/**
 * Map a tool/permission name to a risk tier (Governor, in-process).
 * Drives the auto-deny rule: tier > 3 is denied.
 */
export function riskTierForTool(tool: string | undefined): RiskTier {
  const t = (tool ?? '').toLowerCase()
  if (/(bash|exec|sh|cmd|shell|run)/.test(t)) return 4
  if (/(delete|rm|remove|truncate|format|danger)/.test(t)) return 5
  if (/(write|edit|create|patch|mkdir|move|mv|cp)/.test(t)) return 2
  if (/(read|cat|view|open|ls|glob|grep|fetch|web|http|get)/.test(t)) return 1
  return 3
}

export function autoDenyTier(tier: RiskTier): boolean {
  return tier > 3
}

export type { ContentBlock }
