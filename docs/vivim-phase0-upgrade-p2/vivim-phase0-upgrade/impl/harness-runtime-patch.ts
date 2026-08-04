// impl/harness-runtime-patch.ts
// Patches for evaluateCondition() and precondition node in HarnessRuntime.
//
// In src/engines/harness-runtime.ts:
//   - evaluateCondition() (lines 268-271) is a stub that only checks selector_exists
//   - precondition node (lines 190-193) ignores preconditions and always proceeds
//
// These patches implement:
//   - evaluateCondition() for 7 condition types
//   - precondition node that evaluates the condition and either proceeds or skips

import type { HarnessCondition, HarnessContext, HarnessNode, Element } from '../src/engines/harness-runtime.js'

// ── Patch 1: evaluateCondition() ──────────────────────────────────────────
//
// BEFORE (lines 268-271 in harness-runtime.ts):
//
//   private async evaluateCondition(cond: HarnessCondition, _ctx: HarnessContext): Promise<boolean> {
//     // Stub: real implementation in Phase 9
//     return cond.type === 'selector_exists'
//   }
//
// AFTER:
//
//   private async evaluateCondition(cond: HarnessCondition, ctx: HarnessContext): Promise<boolean> {
//     return evaluateConditionImpl(cond, ctx)
//   }
//
// Also update the HarnessCondition type to include the new condition types:
//
//   export interface HarnessCondition {
//     type:
//       | 'selector_exists'
//       | 'element_visible'
//       | 'element_contains_text'
//       | 'page_url_matches'
//       | 'page_title_contains'
//       | 'element_count_gt'
//       | 'element_has_class'
//       | 'url_matches'       // legacy alias
//       | 'text_contains'     // legacy alias
//       | 'variable'
//     value: string
//     selector?: string       // CSS selector for element-based conditions
//     expectedCount?: number  // for element_count_gt
//     className?: string      // for element_has_class
//   }

export async function evaluateConditionImpl(
  cond: HarnessCondition,
  ctx: HarnessContext,
): Promise<boolean> {
  switch (cond.type) {
    // ── Selector existence ────────────────────────────────────────────────
    case 'selector_exists': {
      const el = await ctx.query(cond.value)
      return el !== null
    }

    // ── Element visibility ────────────────────────────────────────────────
    case 'element_visible': {
      const el = await ctx.query(cond.value)
      if (!el) return false
      // An element is visible if it has a bounding box with positive dimensions
      if (el.boundingBox) {
        return el.boundingBox.width > 0 && el.boundingBox.height > 0
      }
      // If no bounding box info, assume visible if the element exists
      return true
    }

    // ── Element contains text ─────────────────────────────────────────────
    case 'element_contains_text': {
      const condExt = cond as HarnessCondition & { selector?: string }
      const selector = condExt.selector ?? cond.value
      const el = await ctx.query(selector)
      if (!el) return false
      const textToFind = condExt.selector ? cond.value : cond.value
      return el.text.toLowerCase().includes(textToFind.toLowerCase())
    }

    // ── Page URL matches ──────────────────────────────────────────────────
    case 'page_url_matches':
    case 'url_matches': {
      const state = await ctx.getPageState()
      const url = state.url
      // Support both exact match and regex patterns
      try {
        const regex = new RegExp(cond.value)
        return regex.test(url)
      } catch {
        // Not a valid regex — try exact/contains match
        return url.includes(cond.value)
      }
    }

    // ── Page title contains ───────────────────────────────────────────────
    case 'page_title_contains': {
      const state = await ctx.getPageState()
      return state.title.toLowerCase().includes(cond.value.toLowerCase())
    }

    // ── Element count greater than ────────────────────────────────────────
    case 'element_count_gt': {
      const condExt = cond as HarnessCondition & {
        selector?: string
        expectedCount?: number
      }
      const selector = condExt.selector ?? cond.value
      const elements = await ctx.queryAll(selector)
      const threshold = condExt.expectedCount ?? parseInt(cond.value, 10)
      return elements.length > threshold
    }

    // ── Element has class ─────────────────────────────────────────────────
    case 'element_has_class': {
      const condExt = cond as HarnessCondition & {
        selector?: string
        className?: string
      }
      const selector = condExt.selector ?? cond.value
      const el = await ctx.query(selector)
      if (!el) return false
      const className = condExt.className ?? cond.value
      const classAttr = el.attributes['class'] ?? ''
      return classAttr.split(/\s+/).includes(className)
    }

    // ── Variable (legacy) ─────────────────────────────────────────────────
    case 'variable': {
      // Variable conditions evaluate the value as a boolean expression
      // For now, treat non-empty string as truthy
      return cond.value.trim().length > 0 && cond.value.trim() !== 'false'
    }

    // ── Text contains (legacy alias) ──────────────────────────────────────
    case 'text_contains': {
      const state = await ctx.getPageState()
      // Check if the page URL or title contains the text
      const pageText = state.title
      return pageText.toLowerCase().includes(cond.value.toLowerCase())
    }

    default: {
      // Unknown condition type — fail open (return false)
      return false
    }
  }
}

// ── Patch 2: precondition node ────────────────────────────────────────────
//
// BEFORE (lines 190-193 in harness-runtime.ts):
//
//   case 'precondition': {
//     // For now, preconditions are ignored — full implementation in Phase 9
//     return this.executeNode(node.step, ctx, 1, 1)
//   }
//
// AFTER:
//
//   case 'precondition': {
//     const allMet = await this.evaluatePreconditions(node.checks, ctx)
//     if (!allMet) {
//       // Skip the child step — preconditions not met
//       ctx.emitTelemetry({
//         type: 'selector_miss',
//         moduleId: 'precondition',
//         data: { checks: node.checks, result: 'skipped' },
//         ts: Date.now(),
//       })
//       return { outputs: {}, stepsCompleted: 0 }
//     }
//     return this.executeNode(node.step, ctx, 1, 1)
//   }

/**
 * Evaluates a set of precondition checks.
 * Each check string is a condition expression in one of these formats:
 *   - "selector_exists:css-selector"
 *   - "element_visible:css-selector"
 *   - "page_url_matches:pattern"
 *   - "page_title_contains:text"
 *   - "element_contains_text:selector:text"
 *   - "element_count_gt:selector:count"
 *   - "element_has_class:selector:className"
 *
 * All checks must pass for the precondition to be satisfied.
 */
export async function evaluatePreconditions(
  checks: string[],
  ctx: HarnessContext,
): Promise<boolean> {
  for (const check of checks) {
    const colonIndex = check.indexOf(':')
    if (colonIndex === -1) {
      // Malformed check — fail
      return false
    }

    const type = check.slice(0, colonIndex)
    const value = check.slice(colonIndex + 1)

    // Parse compound conditions (e.g. element_contains_text:selector:text)
    let cond: HarnessCondition

    switch (type) {
      case 'selector_exists':
        cond = { type: 'selector_exists', value }
        break
      case 'element_visible':
        cond = { type: 'element_visible', value }
        break
      case 'page_url_matches':
        cond = { type: 'page_url_matches', value }
        break
      case 'page_title_contains':
        cond = { type: 'page_title_contains', value }
        break
      case 'element_contains_text': {
        // Format: selector:text
        const secondColon = value.indexOf(':')
        if (secondColon === -1) {
          cond = { type: 'element_contains_text', value }
        } else {
          cond = {
            type: 'element_contains_text',
            value: value.slice(secondColon + 1),
            selector: value.slice(0, secondColon),
          } as HarnessCondition & { selector: string }
        }
        break
      }
      case 'element_count_gt': {
        const secondColon = value.indexOf(':')
        if (secondColon === -1) {
          cond = { type: 'element_count_gt', value }
        } else {
          cond = {
            type: 'element_count_gt',
            value,
            selector: value.slice(0, secondColon),
            expectedCount: parseInt(value.slice(secondColon + 1), 10),
          } as HarnessCondition & { selector: string; expectedCount: number }
        }
        break
      }
      case 'element_has_class': {
        const secondColon = value.indexOf(':')
        if (secondColon === -1) {
          cond = { type: 'element_has_class', value }
        } else {
          cond = {
            type: 'element_has_class',
            value,
            selector: value.slice(0, secondColon),
            className: value.slice(secondColon + 1),
          } as HarnessCondition & { selector: string; className: string }
        }
        break
      }
      default:
        // Unknown check type — fail
        return false
    }

    const result = await evaluateConditionImpl(cond, ctx)
    if (!result) {
      return false
    }
  }

  return true
}

// ── Extended HarnessCondition type ─────────────────────────────────────────
//
// To support the new condition types, update the HarnessCondition interface
// in src/engines/harness-runtime.ts:
//
// export interface HarnessCondition {
//   type:
//     | 'selector_exists'
//     | 'element_visible'
//     | 'element_contains_text'
//     | 'page_url_matches'
//     | 'page_title_contains'
//     | 'element_count_gt'
//     | 'element_has_class'
//     | 'url_matches'       // legacy alias for page_url_matches
//     | 'text_contains'     // legacy alias
//     | 'variable'
//   value: string
//   /** CSS selector for element-based conditions */
//   selector?: string
//   /** Expected count for element_count_gt */
//   expectedCount?: number
//   /** Class name for element_has_class */
//   className?: string
// }
