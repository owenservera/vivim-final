// src/engines/reference-grounding.ts
// Phase 2 — Reference Grounding Engine.
// Resolves entity references ("that report", "John", "the file I just made")
// from natural language against the live context fabric.
// Produces GroundedReference[] for the ActionPlan.

import type { GroundedReference } from './action-plan.js'
import type { NLCContext } from './nlcl/types.js'

// ── Reference Pattern ────────────────────────────────────────────────────

export interface ReferencePattern {
  /** Regex that matches the reference in user text. */
  pattern: RegExp
  /** Extract the reference value from the match. */
  extract: (match: RegExpMatchArray, ctx: NLCContext) => GroundedReference | null
}

// ── Built-in patterns ────────────────────────────────────────────────────

const BUILTIN_PATTERNS: ReferencePattern[] = [
  // Pronouns — resolved from dialogue context
  {
    pattern: /\b(that|this|it)\b/gi,
    extract: (_match, ctx) => {
      const lastSubject = ctx.metadata?.lastSubject as string | undefined
      if (!lastSubject) return null
      return {
        raw: _match[0],
        resolvedType: 'entity',
        resolvedValue: lastSubject,
        confidence: 0.7,
        source: 'dialogue',
      }
    },
  },
  // "the report / the file / the document" — search recent context
  {
    pattern: /\b(the\s+(?:report|file|document|email|message|conversation|project|note))\b/gi,
    extract: (match, ctx) => {
      const subject = ctx.metadata?.lastSubject as string | undefined
      return {
        raw: match[0],
        resolvedType: 'entity',
        resolvedValue: subject ?? match[1],
        confidence: subject ? 0.8 : 0.5,
        source: subject ? 'dialogue' : 'context',
      }
    },
  },
  // "yesterday" / "last week" — temporal references
  {
    pattern: /\b(yesterday|today|last\s+(?:week|month|year)|tomorrow)\b/gi,
    extract: (match) => {
      const now = Date.now()
      const day = 86_400_000
      let resolved: string
      switch (match[0].toLowerCase()) {
        case 'yesterday':
          resolved = new Date(now - day).toISOString().slice(0, 10)
          break
        case 'today':
          resolved = new Date(now).toISOString().slice(0, 10)
          break
        case 'tomorrow':
          resolved = new Date(now + day).toISOString().slice(0, 10)
          break
        default:
          resolved = match[0]
      }
      return {
        raw: match[0],
        resolvedType: 'entity',
        resolvedValue: resolved,
        confidence: 0.9,
        source: 'explicit',
      }
    },
  },
  // "open tab" / "current page" — browser context
  {
    pattern: /\b(?:the\s+)?(?:open\s+tab|current\s+page|this\s+page|active\s+tab)\b/gi,
    extract: (match, ctx) => {
      const slaveId = ctx.slaveId
      return {
        raw: match[0],
        resolvedType: 'browser_element',
        resolvedValue: slaveId ? `browser:${slaveId}` : 'browser:current',
        confidence: slaveId ? 0.9 : 0.6,
        source: 'context',
      }
    },
  },
]

// ── ReferenceGroundingEngine ─────────────────────────────────────────────

export class ReferenceGroundingEngine {
  private patterns: ReferencePattern[]

  constructor(extraPatterns?: ReferencePattern[]) {
    this.patterns = [...BUILTIN_PATTERNS, ...(extraPatterns ?? [])]
  }

  /**
   * Extract all grounded references from a natural language input.
   * Returns references in order of appearance, deduplicated.
   */
  ground(rawInput: string, ctx: NLCContext): GroundedReference[] {
    const refs: GroundedReference[] = []
    const seen = new Set<string>()

    for (const { pattern, extract } of this.patterns) {
      // Reset regex state
      pattern.lastIndex = 0
      let match: RegExpMatchArray | null
      while ((match = pattern.exec(rawInput)) !== null) {
        const ref = extract(match, ctx)
        if (ref && !seen.has(ref.raw.toLowerCase())) {
          seen.add(ref.raw.toLowerCase())
          refs.push(ref)
        }
      }
    }

    return refs
  }

  /**
   * Resolve a specific reference string against the context.
   * Used by the ActionPlanCompiler to resolve `dependsOn` references.
   */
  resolveReference(
    ref: string,
    ctx: NLCContext,
    existingRefs: GroundedReference[],
  ): GroundedReference | null {
    // Check existing refs first
    const existing = existingRefs.find(
      (r) => r.raw.toLowerCase() === ref.toLowerCase(),
    )
    if (existing) return existing

    // Try grounding the reference as a fresh input
    const grounded = this.ground(ref, ctx)
    return grounded[0] ?? null
  }
}
