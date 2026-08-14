// src/engines/selector-healer.ts
// SelectorHealer — LLM-powered selector repair when a selector misses
// Also exports: failure classification for automated failure analysis

import { catchDebug } from '../lib/catch-logger.js'
import { safeJsonParse } from '../lib/safe-json.js'
import { SelectorCache } from './selector-cache.js'
import type {
  AccessibilityNode,
  ScreenshotRegion,
  SemanticGroundingEngine,
  SemanticSelector,
} from './semantic-grounding.js'
import type { McpClientAdapter } from './workflow-engine.js'

// ── Types ───────────────────────────────────────────────────────────────

export type HealStrategy =
  | 'aria_relaxed'
  | 'text_match'
  | 'dom_structure'
  | 'llm_proposal'
  | 'visual_match'

export interface HealResult {
  healed: SemanticSelector
  strategy: HealStrategy
  confidence: number
  originalSelector: SemanticSelector
}

export interface SelectorHealerConfig {
  maxRelaxNameDistance: number
  llmModel: string
}

// ── Engine ──────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: SelectorHealerConfig = {
  maxRelaxNameDistance: 3,
  llmModel: 'gpt-4o-mini',
}

/**
 * Minimal contract for persisting selector heals. Accepts ProviderStore so
 * healed selectors are written as capability overrides (type 'selector_healed')
 * and survive app restarts.
 */
export interface SelectorHealerStore {
  overrideCapability(input: {
    providerId: string
    capabilityId: string
    overrideType: string
    overrideJson: string
  }): Promise<void>
}

export class SelectorHealer {
  private history = new Map<string, HealResult[]>()
  private cache = new SelectorCache()

  constructor(
    private readonly grounding: SemanticGroundingEngine,
    private readonly mcpClient?: McpClientAdapter,
    private readonly config: SelectorHealerConfig = DEFAULT_CONFIG,
    private readonly store?: SelectorHealerStore,
  ) {}

  async heal(params: {
    slaveId: string
    failedSelector: SemanticSelector
    capabilityId: string
    providerId: string
    context?: string
  }): Promise<HealResult | null> {
    const { slaveId, failedSelector, capabilityId, providerId, context } = params
    const historyKey = `${providerId}:${capabilityId}`

    // Check cache first
    const cached = this.cache.get(providerId, capabilityId)
    if (cached) {
      return {
        healed: cached.selector as unknown as SemanticSelector,
        strategy: 'aria_relaxed',
        confidence: 0.9,
        originalSelector: failedSelector,
      }
    }

    const result =
      (await this.tryAriaRelaxed(slaveId, failedSelector)) ??
      (await this.tryTextMatch(slaveId, failedSelector)) ??
      (await this.tryDomStructure(slaveId, failedSelector)) ??
      (await this.tryLlmProposal(slaveId, failedSelector, context)) ??
      (await this.tryVisualMatch(slaveId, failedSelector))

    if (result) {
      const prev = this.history.get(historyKey) ?? []
      prev.push(result)
      this.history.set(historyKey, prev.slice(-100))
      // Cache successful heal
      this.cache.record(providerId, capabilityId, JSON.stringify(result.healed))

      // Persist to DB so the healed selector survives app restarts.
      // Stored as a 'selector_healed' capability override — the next execution
      // reads it from the provider_capability table before trying discovery.
      if (this.store) {
        void this.store
          .overrideCapability({
            providerId,
            capabilityId,
            overrideType: 'selector_healed',
            overrideJson: JSON.stringify(result.healed),
          })
          .catch(() => {}) // non-fatal — persistence failure must not break healing
        // [audit] log the error with context here
      }
    }

    return result
  }

  getHistory(providerId: string, capabilityId: string): HealResult[] {
    return this.history.get(`${providerId}:${capabilityId}`) ?? []
  }

  // ── Strategy 1: ARIA relaxed ────────────────────────────────────────────

  private async tryAriaRelaxed(
    slaveId: string,
    selector: SemanticSelector,
  ): Promise<HealResult | null> {
    if (selector.type !== 'aria') return null

    const tree = await this.grounding.getAccessibilityTree(slaveId)
    if (!tree) return null

    const relaxed: Extract<SemanticSelector, { type: 'aria' }> = {
      type: 'aria',
      role: selector.role,
    }

    const result = await this.grounding.resolve(slaveId, relaxed)
    if (!result) return null

    return {
      healed: relaxed,
      strategy: 'aria_relaxed',
      confidence: result.confidence * 0.9,
      originalSelector: selector,
    }
  }

  // ── Strategy 2: Text match ─────────────────────────────────────────────

  private async tryTextMatch(
    slaveId: string,
    selector: SemanticSelector,
  ): Promise<HealResult | null> {
    const searchText = this.extractSearchText(selector)
    if (!searchText) return null

    const textSelector: Extract<SemanticSelector, { type: 'text' }> = {
      type: 'text',
      text: searchText,
    }

    const result = await this.grounding.resolve(slaveId, textSelector)
    if (!result) return null

    return {
      healed: textSelector,
      strategy: 'text_match',
      confidence: result.confidence * 0.85,
      originalSelector: selector,
    }
  }

  private extractSearchText(selector: SemanticSelector): string | null {
    if (selector.type === 'aria') return selector.name ?? null
    if (selector.type === 'text') return selector.text
    if (selector.type === 'css') {
      const match = selector.selector.match(/\[text[~|^$*]?=["']([^"']+)["']\]/)
      return match?.[1] ?? null
    }
    return null
  }

  // ── Strategy 3: DOM structure analysis ─────────────────────────────────

  private async tryDomStructure(
    slaveId: string,
    selector: SemanticSelector,
  ): Promise<HealResult | null> {
    if (selector.type !== 'css') return null

    const tree = await this.grounding.getAccessibilityTree(slaveId)
    if (!tree) return null

    const roleFromSelector = this.extractRoleFromCss(selector.selector)
    if (!roleFromSelector) return null

    const match = this.findByRoleAndPosition(tree, roleFromSelector, 0)
    if (!match) return null

    const healed: Extract<SemanticSelector, { type: 'aria' }> = {
      type: 'aria',
      role: match.role,
      name: match.name,
    }

    return {
      healed,
      strategy: 'dom_structure',
      confidence: 0.75,
      originalSelector: selector,
    }
  }

  private extractRoleFromCss(css: string): string | null {
    const tagMatch = css.match(/^(\w+)/)
    const tag = tagMatch?.[1]?.toLowerCase()
    if (!tag) return null
    const tagToRole: Record<string, string> = {
      button: 'button',
      a: 'link',
      input: 'textbox',
      textarea: 'textbox',
      select: 'combobox',
      img: 'img',
      h1: 'heading',
      h2: 'heading',
      h3: 'heading',
      nav: 'navigation',
      main: 'main',
      header: 'banner',
      footer: 'contentinfo',
    }
    return tagToRole[tag] ?? null
  }

  private findByRoleAndPosition(
    node: AccessibilityNode,
    role: string,
    position: number,
  ): AccessibilityNode | null {
    if (node.role === role) {
      if (position === 0) return node
      return this.findByRoleAndPosition_inSubtree(node, role, position)
    }
    for (const child of node.children) {
      const found = this.findByRoleAndPosition(child, role, position)
      if (found) return found
    }
    return null
  }

  private findByRoleAndPosition_inSubtree(
    node: AccessibilityNode,
    role: string,
    position: number,
  ): AccessibilityNode | null {
    let count = 0
    const dfs = (n: AccessibilityNode): AccessibilityNode | null => {
      if (n.role === role) {
        if (count === position) return n
        count++
      }
      for (const child of n.children) {
        const found = dfs(child)
        if (found) return found
      }
      return null
    }
    return dfs(node)
  }

  // ── Strategy 4: LLM proposal ──────────────────────────────────────────

  private async tryLlmProposal(
    slaveId: string,
    selector: SemanticSelector,
    context?: string,
  ): Promise<HealResult | null> {
    if (!this.mcpClient) return null

    const tree = await this.grounding.getAccessibilityTree(slaveId)
    if (!tree) return null

    const treeSnippet = this.treeToSnippet(tree, 3)
    const prompt = `A CSS selector failed to match any element on the page.
Failed selector: ${JSON.stringify(selector)}
${context ? `Context: ${context}\n` : ''}
Accessibility tree (truncated):
${treeSnippet}

Suggest a replacement SemanticSelector (JSON) that would match the intended element.
Return only JSON: { "type": "aria"|"text"|"css", ... }`

    try {
      // C3: Route through tool orchestrator when available.
      const { callToolViaOrchestrator } = await import('../engines/tool-orchestrator-facade.js')
      const response = (await callToolViaOrchestrator(this.mcpClient, 'llm_complete', {
        prompt,
        model: this.config.llmModel,
      })) as { text?: string } | string

      const text = typeof response === 'string' ? response : (response?.text ?? '')
      const parsed = safeJsonParse<SemanticSelector>(text, {} as SemanticSelector)
      if (parsed)
        return {
          healed: parsed,
          confidence: 0.7,
          strategy: 'llm_proposal',
          originalSelector: selector,
        }
    } catch (e) {
      catchDebug(e, 'engines:selector-healer:303')
    }
    return null
  }

  // ── Strategy 5: Visual match ───────────────────────────────────────────

  private async tryVisualMatch(
    slaveId: string,
    selector: SemanticSelector,
  ): Promise<HealResult | null> {
    const region = this.estimateRegion(selector)
    if (!region) return null

    const result = await this.grounding.resolveByVisual(slaveId, region, `heal: ${selector.type}`)
    if (!result) return null

    const healed: Extract<SemanticSelector, { type: 'css' }> = {
      type: 'css',
      selector: `[data-healed="${result.backendNodeId}"]`,
    }

    return {
      healed,
      strategy: 'visual_match',
      confidence: result.confidence * 0.6,
      originalSelector: selector,
    }
  }

  private estimateRegion(selector: SemanticSelector): ScreenshotRegion | null {
    if (selector.type === 'visual') return selector.screenshotRegion
    return { x: 0, y: 0, width: 800, height: 600 }
  }

  // Render a compact, truncated one-line-per-node view of the a11y tree for
  // the LLM proposal prompt.
  private treeToSnippet(root: AccessibilityNode, depth: number): string {
    const lines: string[] = []
    const walk = (node: AccessibilityNode, level: number): void => {
      const pad = '  '.repeat(level)
      lines.push(`${pad}${node.role}${node.name ? ` "${node.name}"` : ''}`)
      if (level < depth) {
        for (const child of node.children) walk(child, level + 1)
      }
    }
    walk(root, 0)
    return lines.slice(0, 200).join('\n')
  }
}

// ── Failure Classification (harvested from edge-pwa self-healing) ──────────
//
/** The kind of selector failure detected. */
export type FailureType =
  | 'selector_not_found'
  | 'element_changed'
  | 'dom_restructured'
  | 'timing_issue'
  | 'wrong_capability'
  | 'unknown'

/** Result of classifying a failure. */
export interface FailureClassification {
  failureType: FailureType
  confidence: number
  signals: string[]
  suggestedStrategies: HealStrategy[]
}

/** Pattern-matching rules keyed by failure type. */
const FAILURE_PATTERNS: Record<FailureType, Array<{ pattern: RegExp; weight: number }>> = {
  selector_not_found: [
    { pattern: /no-match/i, weight: 0.8 },
    { pattern: /element not found/i, weight: 0.7 },
    { pattern: /selector.*not found/i, weight: 0.9 },
    { pattern: /cannot find element/i, weight: 0.7 },
  ],
  element_changed: [
    { pattern: /element.*changed/i, weight: 0.6 },
    { pattern: /stale element/i, weight: 0.7 },
    { pattern: /element.*detached/i, weight: 0.6 },
    { pattern: /element.*modified/i, weight: 0.5 },
  ],
  dom_restructured: [
    { pattern: /dom.*changed/i, weight: 0.5 },
    { pattern: /layout.*changed/i, weight: 0.4 },
    { pattern: /structure.*changed/i, weight: 0.5 },
    { pattern: /page.*reloaded/i, weight: 0.6 },
  ],
  timing_issue: [
    { pattern: /timeout/i, weight: 0.7 },
    { pattern: /timed out/i, weight: 0.8 },
    { pattern: /slow.*response/i, weight: 0.5 },
    { pattern: /animation.*not.*complete/i, weight: 0.4 },
  ],
  wrong_capability: [
    { pattern: /wrong.*element/i, weight: 0.6 },
    { pattern: /unexpected.*element/i, weight: 0.5 },
    { pattern: /multiple.*matches/i, weight: 0.7 },
    { pattern: /ambiguous.*selector/i, weight: 0.6 },
  ],
  unknown: [],
}

/** Map failure type to suggested healing strategies. */
const STRATEGY_SUGGESTIONS: Record<FailureType, HealStrategy[]> = {
  selector_not_found: ['text_match', 'aria_relaxed', 'dom_structure'],
  element_changed: ['aria_relaxed', 'text_match'],
  dom_restructured: ['dom_structure', 'text_match'],
  timing_issue: ['aria_relaxed', 'text_match'],
  wrong_capability: ['aria_relaxed', 'text_match', 'dom_structure'],
  unknown: ['aria_relaxed', 'text_match', 'dom_structure'],
}

/**
 * Classify a selector failure based on error message and context.
 *
 * Uses regex pattern matching against the error reason to determine
 * the most likely failure type and suggest healing strategies.
 *
 * @param reason   The error message or failure description.
 * @param selector The selector string that failed.
 * @returns A classification with failure type, confidence, and suggested strategies.
 */
export function classifyFailure(reason: string, selector: string): FailureClassification {
  const scores: Record<FailureType, number> = {
    selector_not_found: 0,
    element_changed: 0,
    dom_restructured: 0,
    timing_issue: 0,
    wrong_capability: 0,
    unknown: 0,
  }

  for (const [failureType, patterns] of Object.entries(FAILURE_PATTERNS)) {
    for (const { pattern, weight } of patterns) {
      if (pattern.test(reason)) {
        scores[failureType as FailureType] += weight
      }
    }
  }

  const sorted = Object.entries(scores)
    .map(([type, score]) => ({ type: type as FailureType, score }))
    .sort((a, b) => b.score - a.score)

  const primary = sorted[0]
  const failureType = primary?.type ?? 'unknown'
  const totalScore = sorted.reduce((sum, s) => sum + s.score, 0)
  const confidence = totalScore > 0 ? Math.min((primary?.score ?? 0) / totalScore, 1) : 0.5

  // Boost strategy suggestions based on the actual selector
  let strategies = STRATEGY_SUGGESTIONS[failureType] ?? []
  if (selector.includes('[role=')) strategies.unshift('aria_relaxed')
  if (selector.includes('[aria-label=')) strategies.unshift('aria_relaxed')
  if (selector.includes('text~')) strategies.unshift('text_match')
  strategies = [...new Set(strategies)]

  return {
    failureType,
    confidence,
    signals: [reason, selector],
    suggestedStrategies: strategies,
  }
}

/**
 * Compute a healing priority score (0-1) for a failure classification.
 * Higher = more important to heal immediately.
 */
export function healingPriority(classification: FailureClassification): number {
  const base: Record<FailureType, number> = {
    selector_not_found: 1.0,
    element_changed: 0.8,
    dom_restructured: 0.7,
    timing_issue: 0.5,
    wrong_capability: 0.6,
    unknown: 0.3,
  }
  return base[classification.failureType] * classification.confidence
}
