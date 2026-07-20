// src/engines/opencode/types.ts
// Shared types + risk-tier mapping for the OpenCode `serve` integration (feature 027).
// Event grammar matches opencode v1.17.15 `--format json` (reuse parseOpencodeJson).

import type { ContentBlock } from '../../schema/streaming.js'

/** Raw SSE/NDJSON event frame from `opencode serve` (`GET /event`). */
export interface OpencodeEvent {
  type?: string
  subtype?: string
  sessionID?: string
  id?: string
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
