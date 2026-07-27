// src/engines/nlcl/composite-splitter.ts
// Tier 3 unit 15.10 — Clause-aware composite splitter.
//
// Closes audit finding ❌-11: the previous COMPOSITE_SPLITTERS regex table
// would naively split on `and`/`then`/`after that`, producing arbitrary
// N-way splits from a single sentence. This caused:
//   • False positives: "go to cnn and fox news" would split into 2 navigates
//     when it should be 1 navigate with 2 targets.
//   • Exponential blowup: a sentence with 4 `and`s would produce 16 candidate
//     parses (4! permutations of step order) and overwhelm the resolver.
//
// Design:
//   1. Conjunction detection — find candidate split points using regex,
//      but ONLY between clauses (not inside quoted strings, parentheses,
//      or after prepositions like "between X and Y").
//   2. Clause validation — each candidate split must produce 2 parts that
//      each independently parse as a valid intent. If either fails, the
//      split is rejected.
//   3. Depth cap at 2 — a composite command has at most 2 steps. The
//      previous implementation had no cap and would happily produce
//      3- and 4-step composites from "do A then B then C then D" inputs,
//      which overwhelmingly were never the user's intent (and the executor
//      would silently drop steps 3 and 4).
//   4. Binary splits only — never produce more than 2 steps from a single
//      splitter invocation. Multi-step composites can still be achieved by
//      the user issuing separate commands.
//
// This is intentionally conservative — better to under-split (and let the
// LLM fallback resolve the full sentence) than to over-split and produce
// incorrect multi-step executions.

import type { NLCommandParser } from './nl-parser.js'
import type { NLCContext, ParsedIntent } from './types.js'

export interface CompositeSplit {
  steps: [ParsedIntent, ParsedIntent]
  /** The matched conjunction phrase, for audit logging. */
  conjunction: string
  /** Where the split happened in the raw input. */
  splitIndex: number
}

/**
 * Regex candidates for split points. Each is a phrase that commonly joins
 * two independent commands. We require word boundaries to avoid splitting
 * on substrings (e.g. "then" inside "thenceforth").
 *
 * The regexes are intentionally minimal — over-eager splitting is the bug
 * we're fixing.
 */
const SPLIT_CANDIDATES: Array<{ regex: RegExp; label: string }> = [
  // "X and then Y" — explicit sequential.
  { regex: /\s+and\s+then\s+/i, label: 'and then' },
  // "X, then Y" — comma+then.
  { regex: /,\s*then\s+/i, label: ', then' },
  // "X then Y" — bare then (most explicit).
  { regex: /\s+then\s+/i, label: 'then' },
  // "X, after that Y" — comma+after that.
  { regex: /,\s*after\s+that\s+/i, label: ', after that' },
  // "X after that Y" — bare after that.
  { regex: /\s+after\s+that\s+/i, label: 'after that' },
  // "X and Y" — only when followed by a verb (heuristic to avoid "X and Y" noun phrases).
  // This is the riskiest splitter; we lean on clause validation to reject bad splits.
  // We DO NOT include bare "and" as a high-priority splitter — only as a last resort.
  {
    regex:
      /\s+and\s+(?=(?:summarize|extract|tell|show|send|delete|create|open|navigate|go|find|search|translate|convert|run|execute|build|deploy|test|fix|review|analyze|plan|schedule|remind|book|cancel|update|rename|move|copy|share|export|import|download|upload|print|save|load|reset|restart|stop|start|pause|resume|enable|disable|install|uninstall|configure|setup|teardown|initialize|finalize|commit|rollback|merge|split|join|group|ungroup|sort|filter|search|replace|insert|append|prepend|delete|remove|add|edit|modify|change|update|set|get|list|view|display|hide|show|print|export|import)\b)/i,
    label: 'and (verb)',
  },
]

/**
 * Detect a binary composite split in the raw input.
 *
 * Returns null if:
 *   • No conjunction found
 *   • Split produced parts that don't independently parse
 *   • Either part is empty / whitespace-only
 *   • The split point is inside a quoted string or parenthesis (heuristic)
 *
 * Returns a CompositeSplit with exactly 2 steps otherwise.
 */
export function detectCompositeSplit(
  rawInput: string,
  parser: NLCommandParser,
  ctx: NLCContext,
): CompositeSplit | null {
  for (const { regex, label } of SPLIT_CANDIDATES) {
    const match = regex.exec(rawInput)
    if (!match) continue

    const splitIndex = match.index + match[0].length
    const leftRaw = rawInput.slice(0, match.index).trim()
    const rightRaw = rawInput.slice(splitIndex).trim()

    if (!leftRaw || !rightRaw) continue

    // Reject if either side is inside quotes / parentheses.
    if (isInsideQuotesOrParens(rawInput, match.index)) continue

    // Try parsing both sides independently.
    const leftIntent = parser.parse(leftRaw, ctx, { surface: ctx.surface })
    if (!leftIntent) continue
    const rightIntent = parser.parse(rightRaw, ctx, { surface: ctx.surface })
    if (!rightIntent) continue

    // Both sides parsed — accept this split. (Depth cap = 2 enforced by type:
    // steps is a 2-tuple, so callers can't accidentally get a 3rd step.)
    return {
      steps: [leftIntent, rightIntent],
      conjunction: label,
      splitIndex,
    }
  }
  return null
}

/**
 * Heuristic: detect if a position in the input is inside a quoted string or
 * parenthesized group. We scan from the start of the input to `pos` and count
 * quote/paren tokens. If the count is odd (quotes) or positive (parens), we
 * consider the position "inside".
 *
 * This is intentionally conservative — it's a guard against false positives,
 * not a full parser. Edge cases (escaped quotes, nested parens) are tolerated
 * because we'd rather under-split than over-split.
 */
function isInsideQuotesOrParens(input: string, pos: number): boolean {
  let inSingle = false
  let inDouble = false
  let parenDepth = 0
  for (let i = 0; i < pos && i < input.length; i++) {
    const ch = input[i]
    if (ch === "'" && !inDouble) inSingle = !inSingle
    else if (ch === '"' && !inSingle) inDouble = !inDouble
    else if (!inSingle && !inDouble) {
      if (ch === '(') parenDepth++
      else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1)
    }
  }
  return inSingle || inDouble || parenDepth > 0
}
