// src/engines/browser-automation/selector-healer.ts
// SelectorHealer — repair broken element resolution via rule-based fallback then
// optional LLM proposal. Persists working strategies via the store contract.
// All DOM access via SemanticGroundingEngine (Governor Canon intact).

import { EngineError } from '../../errors.js'
import type { ChromeGovernor } from '../chrome-governor.js'
import type { SemanticGroundingEngine } from './semantic-grounding.js'
import type { SelectorHealStore } from '../../storage/contracts/selector-heal-store.js'
import type { ResolvedElement, SemanticSelector } from './types.js'

/**
 * Heals a failed SemanticSelector resolution.
 * 1. Try persisted strategy for the same targetKey.
 * 2. Rule-based alternatives (role+name, nearest-text, sibling index).
 * 3. If still failing and an LLM proposer is supplied, ask it for a candidate.
 */
export class SelectorHealer {
  constructor(
    private governor: ChromeGovernor,
    private grounding: SemanticGroundingEngine,
    private store: SelectorHealStore,
  ) {}

  async heal(
    slaveId: string,
    original: SemanticSelector,
    targetKey: string,
    llmPropose?: (ctx: { url: string; description: string; dom: string }) => Promise<string | null>,
  ): Promise<ResolvedElement> {
    // 1. Persisted strategy
    const existing = await this.store.getStrategy(targetKey)
    if (existing) {
      try {
        const r = await this.grounding.resolveBySelector(slaveId, existing.selectorFormat)
        await this.store.recordUse(targetKey)
        return { ...r, healed: true }
      } catch {
        // stale — fall through
      }
    }

    // 2. Rule-based alternative generation
    const alternates = this.ruleBasedAlternates(original)
    for (const alt of alternates) {
      try {
        const r = await this.grounding.resolve(slaveId, alt)
        await this.store.upsertStrategy({
          targetKey,
          selectorFormat: r.selector,
          mode: r.mode,
          semanticData: { original, healedFrom: 'rule-based' },
        })
        return { ...r, healed: true }
      } catch {
        // try next
      }
    }

    // 3. LLM proposal
    if (llmPropose) {
      const dom = await this.governor.evaluate(
        slaveId,
        'document.body.innerText.slice(0,4000)',
      ).catch(() => '')
      const url = (await this.governor.evaluate(slaveId, 'location.href').catch(() => '')) as string
      const candidate = await llmPropose({
        url,
        description: JSON.stringify(original),
        dom: typeof dom === 'string' ? dom : String(dom),
      })
      if (candidate) {
        try {
          const r = await this.grounding.resolveBySelector(slaveId, candidate)
          await this.store.upsertStrategy({
            targetKey,
            selectorFormat: candidate,
            mode: 'healed',
            semanticData: { original, healedFrom: 'llm' },
          })
          await this.store.bumpHealCount(targetKey)
          return { ...r, healed: true }
        } catch {
          // candidate invalid
        }
      }
    }

    await this.store.bumpHealCount(targetKey)
    throw new EngineError(`SelectorHealer: could not resolve ${targetKey}`)
  }

  /** Generate rule-based fallback selectors from a failed SemanticSelector. */
  private ruleBasedAlternates(sel: SemanticSelector): SemanticSelector[] {
    const out: SemanticSelector[] = []
    if (sel.aria?.name) out.push({ css: `[aria-label*="${sel.aria.name}"]` })
    if (sel.text) out.push({ css: `button:contains("${sel.text}")` })
    if (sel.role) out.push({ css: `[role="${sel.role}"]` })
    if (sel.placeholder) out.push({ css: `input[placeholder*="${sel.placeholder}"]` })
    if (sel.testid) out.push({ css: `[data-testid="${sel.testid}"]` })
    // generic button fallback
    out.push({ css: 'button, input[type="submit"], a' })
    return out
  }
}
