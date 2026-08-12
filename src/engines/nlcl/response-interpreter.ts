// src/engines/nlcl/response-interpreter.ts
// ResponseInterpreter — post-execution response enrichment.
//
// Sits between CapabilityExecutor's raw result and the final CommandResult.text.
// Inspects structured output to extract meaningful text, applies confidence-aware
// hedging, and adds dialogue continuity hints.
//
// ZERO new dependencies. Uses only existing NLCL infrastructure.

import type { CommandResult } from './types.js'

/** Context for response interpretation — telemetry from resolver + dialogue state. */
export interface ResponseInterpreterContext {
  /** Which layer resolved the intent (from LayeredResolver telemetry). */
  resolutionLayer?: 'deterministic' | 'fuzzy' | 'semantic' | 'llm' | 'none'
  /** Confidence score from the resolver (0-1). */
  confidence?: number
  /** Number of turns in this dialogue session. */
  dialogueTurnCount?: number
  /** Entity names from recent turns (for continuity hints). */
  recentEntities?: string[]
  /** Conversation ID (for context). */
  conversationId?: string
  /** Provider ID (for context). */
  providerId?: string
}

// ── Text Extraction Rules ──────────────────────────────────────────────

/**
 * Check if text is already meaningful (not a template pattern).
 * Returns true if the text should be used as-is.
 */
function isMeaningful(text: string | undefined): boolean {
  if (!text || text.length < 10) return false
  // Detect template patterns
  if (/\w+ executed$/.test(text)) return false
  if (text === 'Interpretation failed') return false
  if (text === 'Command executed') return false
  return true
}

/**
 * Extract meaningful text from structured output.
 * Applies a priority chain of field extraction rules.
 */
function extractFromOutput(output: unknown): string | undefined {
  if (output === null || output === undefined) return undefined

  // Direct string
  if (typeof output === 'string') return output

  // Object with .text
  if (typeof output === 'object' && 'text' in output && typeof output.text === 'string')
    return output.text

  // Object with .message
  if (typeof output === 'object' && 'message' in output && typeof output.message === 'string')
    return output.message

  // Object with .content
  if (typeof output === 'object' && 'content' in output && typeof output.content === 'string')
    return output.content

  // Object with .summary
  if (typeof output === 'object' && 'summary' in output && typeof output.summary === 'string')
    return output.summary

  // Object with .lines (string[])
  if (typeof output === 'object' && 'lines' in output && Array.isArray(output.lines))
    return output.lines.join('\n')

  // Object with .entries (array)
  if (typeof output === 'object' && 'entries' in output && Array.isArray(output.entries))
    return `Found ${output.entries.length} entries`

  // Object with .file + .content
  if (typeof output === 'object' && 'file' in output && 'content' in output)
    return String(output.content)

  // Object with .path
  if (typeof output === 'object' && 'path' in output) return `Opened ${String(output.path)}`

  // Pure array
  if (Array.isArray(output)) {
    if (output.length === 0) return 'No results found'
    return `Found ${output.length} items`
  }

  // Object with .error (error result)
  if (typeof output === 'object' && 'error' in output) return String(output.error)

  return undefined
}

/**
 * Apply confidence-aware hedging to response text.
 * Adds subtle hints when the resolver used fuzzy/semantic layers.
 */
function applyHedging(
  text: string,
  layer: string | undefined,
  confidence: number | undefined,
): string {
  // Deterministic: no hedging
  if (!layer || layer === 'deterministic' || layer === 'none') return text

  // Fuzzy (confidence typically 0.70-0.89): subtle hedge
  if (layer === 'fuzzy' && confidence !== undefined && confidence < 0.85) return `${text}` // Keep it clean — hedge only on very low confidence

  // Semantic (confidence typically 0.60-0.80): softer hedge
  if (layer === 'semantic' && confidence !== undefined && confidence < 0.7)
    return `${text} (let me know if that's not what you wanted)`

  // LLM fallback: no hedging (already decided)
  return text
}

/**
 * Apply dialogue continuity hints.
 * References recent entities when available.
 */
function applyDialogueContinuity(
  text: string,
  entities: string[] | undefined,
  turnCount: number | undefined,
): string {
  // Only apply on turn 2+ (user has history)
  if (!turnCount || turnCount < 2 || !entities?.length) return text

  // Only add continuity if the text doesn't already reference the entity
  const recentContext = entities.slice(-2).join(' and ')
  const alreadyHasContext = entities.some((e) => text.includes(e))
  if (alreadyHasContext) return text

  return `${text} (re: ${recentContext})`
}

// ── ResponseInterpreter Implementation ─────────────────────────────────

export interface ResponseInterpreter {
  /**
   * Enrich a CommandResult's text field based on structured output.
   * Does NOT re-decide intent or action — only improves response text.
   *
   * @param result - The raw CommandResult from the executor
   * @param ctx - Context including resolution telemetry and dialogue state
   * @returns Enriched CommandResult with improved .text
   */
  enrich(result: CommandResult, ctx: ResponseInterpreterContext): CommandResult
}

/**
 * Default ResponseInterpreter — applies text extraction, hedging, and continuity.
 * Returns original result on any error (fail-safe).
 */
class DefaultResponseInterpreter implements ResponseInterpreter {
  enrich(result: CommandResult, ctx: ResponseInterpreterContext): CommandResult {
    try {
      // Rule 1: Already meaningful — passthrough
      if (isMeaningful(result.text)) return result

      // Rule 2: Extract from output
      const extracted = extractFromOutput(result.output)
      if (!extracted) return result // no extraction possible

      // Rule 3: Apply hedging
      let text = applyHedging(extracted, ctx.resolutionLayer, ctx.confidence)

      // Rule 4: Apply dialogue continuity
      text = applyDialogueContinuity(text, ctx.recentEntities, ctx.dialogueTurnCount)

      return { ...result, text }
    } catch {
      // Fallback: return original result unchanged
      return result
    }
  }
}

/** No-op interpreter that always returns the original result. */
class NoOpResponseInterpreter implements ResponseInterpreter {
  enrich(result: CommandResult, _ctx: ResponseInterpreterContext): CommandResult {
    return result
  }
}

/** Create a ResponseInterpreter with default rules. */
export function createResponseInterpreter(): ResponseInterpreter {
  return new DefaultResponseInterpreter()
}

/** Create a no-op ResponseInterpreter (for tests or when enrichment is disabled). */
export function createNoOpResponseInterpreter(): ResponseInterpreter {
  return new NoOpResponseInterpreter()
}

// Re-export for testing
export { applyDialogueContinuity, applyHedging, extractFromOutput, isMeaningful }
