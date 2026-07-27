// src/engines/selector-refiner.ts
// SelectorRefiner — LLM-driven selector healing when ProtocolDiscoveryEngine
// probes yield low-confidence composers/buttons. Takes a page snapshot and
// probe results, returns suggested CSS selectors with rationale.

import { EngineError } from '../errors.js'
import type { LlmClient } from './format-classifier.js'

// ── Types ──────────────────────────────────────────────────────────────────

export interface SelectorRefinement {
  composer: string
  sendButton: string
  responseContainer: string
  rationale: string
}

// ── Prompt ─────────────────────────────────────────────────────────────────

const REFINE_PROMPT = `You are analyzing a web page to find UI selectors for an LLM chat interface.
Given the page URL, HTML snapshot, and existing probe results, suggest the best CSS selectors for:
1. The message composer (where the user types)
2. The send button (to submit the message)
3. The response container (where the assistant's response appears)

Page URL: {url}

Existing probe results:
Composers found: {composers}
Buttons found: {buttons}

HTML snapshot (first 8000 chars):
{snapshot}

Answer with JSON only (no markdown):
{
  "composer": "best CSS selector for the message input",
  "sendButton": "best CSS selector for the send button",
  "responseContainer": "best CSS selector for the response display area",
  "rationale": "why you chose these selectors"
}

Rules:
- Prefer selectors that are stable across page reloads (id, data-testid, aria-label)
- Avoid selectors that depend on dynamic classes (random hashes, BEM modifiers)
- If the composer is a contenteditable div, prefer [contenteditable="true"] or its parent
- If no clear response container, use the last message element or a known wrapper
- Be specific but not fragile`

// ── SelectorRefiner ────────────────────────────────────────────────────────

export class SelectorRefiner {
  constructor(private llmClient: LlmClient) {}

  /**
   * Refine selectors using LLM analysis of the page snapshot and probe results.
   */
  async refine(
    url: string,
    pageSnapshot: string,
    probeResults: { composers: unknown[]; buttons: unknown[] },
  ): Promise<SelectorRefinement> {
    if (!pageSnapshot || pageSnapshot.trim().length === 0) {
      throw new EngineError('SelectorRefinerError', 'Cannot refine selectors without page snapshot')
    }

    const snapshot = pageSnapshot.slice(0, 8000)
    const composers = JSON.stringify(probeResults.composers, null, 2)
    const buttons = JSON.stringify(probeResults.buttons, null, 2)

    const prompt = REFINE_PROMPT
      .replace('{url}', url)
      .replace('{composers}', composers)
      .replace('{buttons}', buttons)
      .replace('{snapshot}', snapshot)

    const response = await this.llmClient.complete(prompt)
    return this.parseRefinementResponse(response)
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private parseRefinementResponse(response: string): SelectorRefinement {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/) ?? response.match(/(\{[\s\S]*\})/)
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : response.trim()

    try {
      const parsed = JSON.parse(jsonStr)

      const composer = typeof parsed.composer === 'string' ? parsed.composer : ''
      const sendButton = typeof parsed.sendButton === 'string' ? parsed.sendButton : ''
      const responseContainer = typeof parsed.responseContainer === 'string' ? parsed.responseContainer : ''
      const rationale = typeof parsed.rationale === 'string' ? parsed.rationale : 'No rationale provided'

      if (!composer || !sendButton) {
        throw new EngineError('SelectorRefinerError', 'LLM response missing required selectors (composer, sendButton)')
      }

      return { composer, sendButton, responseContainer, rationale }
    } catch (err) {
      if (err instanceof EngineError) throw err
      throw new EngineError('SelectorRefinerError', `Failed to parse LLM response as JSON: ${response.slice(0, 200)}`)
    }
  }
}
