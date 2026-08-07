// src/engines/harness-protocol-engine.ts
// HarnessProtocolEngine — bidirectional LLM↔harness bridge
// Subsystems: PromptAugmenter, ResponseExtractor, ActionRouter

import { catchDebug } from '../lib/catch-logger.js'
import type { HarnessNode } from '../schema/harness.js'
import type { CapabilityEventBus } from './capability-event-bus.js'

// ── Types ───────────────────────────────────────────────────────────────

export type HarnessAction =
  | {
      type: 'capability_action'
      capabilitySlug: string
      providerId: string
      input: Record<string, unknown>
      confidence: number
    }
  | { type: 'dag_step'; step: HarnessNode; slaveId: string }
  | { type: 'agentic_goal'; goal: string; slaveId: string }
  | { type: 'workflow_call'; workflowId: string; input: Record<string, unknown> }
  | {
      type: 'observation_request'
      what: ('dom' | 'network' | 'console' | 'screenshot')[]
      slaveId: string
    }
  | { type: 'data_transform'; expression: string; outputVariable: string }

export interface PromptContext {
  availableCapabilities?: Array<{ slug: string; name: string; description: string }>
  currentPageState?: Record<string, unknown>
  validSelectors?: string[]
  dagStepTypes?: string[]
  recentActions?: HarnessAction[]
  executionOutcomes?: Array<{ action: HarnessAction; success: boolean; output?: unknown }>
}

export interface ExtractedResponse {
  contentBlocks: Array<{ kind: string; content: string }>
  actions: HarnessAction[]
}

export interface HarnessProtocolConfig {
  extractionTimeoutMs: number
  llmRepairEnabled: boolean
  autoApproveReadOps: boolean
  autoApproveWriteOps: boolean
  requireApprovalDestructive: boolean
  maxFeedbackActions: number
}

// ── PromptAugmenter ─────────────────────────────────────────────────────

export class PromptAugmenter {
  augmentPrompt(basePrompt: string, ctx: PromptContext): string {
    const sections: string[] = [basePrompt]

    if (ctx.availableCapabilities && ctx.availableCapabilities.length > 0) {
      sections.push('\n## Available Capabilities')
      for (const cap of ctx.availableCapabilities) {
        sections.push(`- ${cap.slug}: ${cap.description}`)
      }
    }

    if (ctx.currentPageState) {
      sections.push('\n## Current Page State')
      sections.push(JSON.stringify(ctx.currentPageState, null, 2))
    }

    if (ctx.validSelectors && ctx.validSelectors.length > 0) {
      sections.push('\n## Valid Selectors')
      sections.push(ctx.validSelectors.join(', '))
    }

    if (ctx.dagStepTypes && ctx.dagStepTypes.length > 0) {
      sections.push('\n## DAG Step Types')
      sections.push(ctx.dagStepTypes.join(', '))
    }

    if (ctx.recentActions && ctx.recentActions.length > 0) {
      sections.push('\n## Recent Actions')
      for (const action of ctx.recentActions.slice(-5)) {
        sections.push(`- ${action.type}`)
      }
    }

    return sections.join('\n')
  }
}

// ── ResponseExtractor ───────────────────────────────────────────────────

export type ExtractionStrategy =
  | 'schema_guided'
  | 'json_block'
  | 'structure_detect'
  | 'llm_repair'
  | 'plain_text'

export class ResponseExtractor {
  private strategies: ExtractionStrategy[] = [
    'schema_guided',
    'json_block',
    'structure_detect',
    'llm_repair',
    'plain_text',
  ]

  async extract(rawResponse: string, config: HarnessProtocolConfig): Promise<ExtractedResponse> {
    for (const strategy of this.strategies) {
      if (strategy === 'llm_repair' && !config.llmRepairEnabled) continue

      const result = this.applyStrategy(strategy, rawResponse)
      if (result) return result
    }

    return {
      contentBlocks: [{ kind: 'text', content: rawResponse }],
      actions: [],
    }
  }

  private applyStrategy(strategy: ExtractionStrategy, raw: string): ExtractedResponse | null {
    switch (strategy) {
      case 'json_block':
        return this.extractJsonBlock(raw)
      case 'structure_detect':
        return this.extractStructured(raw)
      default:
        return null
    }
  }

  private extractJsonBlock(raw: string): ExtractedResponse | null {
    const jsonMatch = raw.match(/```json\n([\s\S]*?)\n```/)
    if (!jsonMatch) return null

    try {
      const jsonContent = jsonMatch[1]
      if (!jsonContent) return null
      const parsed = JSON.parse(jsonContent) as Record<string, unknown>
      const actions: HarnessAction[] = []

      if (Array.isArray(parsed.actions)) {
        for (const a of parsed.actions) {
          if (a && typeof a === 'object' && 'type' in a) {
            actions.push(a as HarnessAction)
          }
        }
      }

      return {
        contentBlocks: [{ kind: 'text', content: JSON.stringify(parsed) }],
        actions,
      }
    } catch {
      return null
    }
  }

  private extractStructured(raw: string): ExtractedResponse | null {
    const actionMatch = raw.match(/\[ACTION\](.*?)\[\/ACTION\]/gs)
    if (!actionMatch) return null

    const actions: HarnessAction[] = []
    for (const match of actionMatch) {
      const content = match.replace(/\[\/?ACTION\]/g, '').trim()
      try {
        const parsed = JSON.parse(content) as Record<string, unknown>
        if (parsed && typeof parsed === 'object' && 'type' in parsed) {
          actions.push(parsed as HarnessAction)
        }
      } catch (err) {
        catchDebug(err, 'engines:harness-protocol-engine:172')
        // skip unparseable
      }
    }

    return actions.length > 0
      ? {
          contentBlocks: [{ kind: 'text', content: raw }],
          actions,
        }
      : null
  }
}

// ── ActionRouter ────────────────────────────────────────────────────────

export type ActionTarget =
  | { type: 'capability'; capabilitySlug: string }
  | { type: 'dag_step'; step: HarnessNode }
  | { type: 'agentic'; goal: string }
  | { type: 'workflow'; workflowId: string }
  | { type: 'observation'; what: string[] }
  | { type: 'transform'; expression: string }

export class ActionRouter {
  private pendingApprovals = new Map<string, HarnessAction>()

  route(action: HarnessAction, config: HarnessProtocolConfig): ActionTarget | null {
    switch (action.type) {
      case 'capability_action':
        if (!config.autoApproveWriteOps && this.isWriteAction(action)) {
          this.pendingApprovals.set(action.capabilitySlug, action)
          return null
        }
        return { type: 'capability', capabilitySlug: action.capabilitySlug }

      case 'dag_step':
        return { type: 'dag_step', step: action.step }

      case 'agentic_goal':
        return { type: 'agentic', goal: action.goal }

      case 'workflow_call':
        return { type: 'workflow', workflowId: action.workflowId }

      case 'observation_request':
        return { type: 'observation', what: action.what }

      case 'data_transform':
        return { type: 'transform', expression: action.expression }

      default:
        return null
    }
  }

  approve(actionId: string): HarnessAction | null {
    const action = this.pendingApprovals.get(actionId)
    if (action) {
      this.pendingApprovals.delete(actionId)
    }
    return action ?? null
  }

  deny(actionId: string): boolean {
    return this.pendingApprovals.delete(actionId)
  }

  private isWriteAction(action: HarnessAction): boolean {
    if (action.type !== 'capability_action') return false
    const readPatterns = ['get', 'list', 'read', 'query', 'fetch']
    return !readPatterns.some((p) => action.capabilitySlug.includes(p))
  }
}

// ── Main Engine ─────────────────────────────────────────────────────────

export class HarnessProtocolEngine {
  readonly promptAugmenter: PromptAugmenter
  readonly responseExtractor: ResponseExtractor
  readonly actionRouter: ActionRouter

  private feedbackHistory: Array<{ action: HarnessAction; success: boolean; output?: unknown }> = []

  constructor(
    private readonly config: HarnessProtocolConfig,
    private readonly eventBus?: CapabilityEventBus,
  ) {
    this.promptAugmenter = new PromptAugmenter()
    this.responseExtractor = new ResponseExtractor()
    this.actionRouter = new ActionRouter()
  }

  augmentPrompt(basePrompt: string, ctx: PromptContext): string {
    return this.promptAugmenter.augmentPrompt(basePrompt, {
      ...ctx,
      executionOutcomes: this.feedbackHistory.slice(-this.config.maxFeedbackActions),
    })
  }

  async extractResponse(rawResponse: string): Promise<ExtractedResponse> {
    return this.responseExtractor.extract(rawResponse, this.config)
  }

  routeAction(action: HarnessAction): ActionTarget | null {
    return this.actionRouter.route(action, this.config)
  }

  recordOutcome(action: HarnessAction, success: boolean, output?: unknown): void {
    this.feedbackHistory.push({ action, success, output })
    if (this.feedbackHistory.length > this.config.maxFeedbackActions * 2) {
      this.feedbackHistory = this.feedbackHistory.slice(-this.config.maxFeedbackActions)
    }

    this.eventBus?.emit({
      type: 'hpe:outcome_recorded',
      data: { actionType: action.type, success },
    })
  }

  getFeedbackContext(): PromptContext {
    return {
      executionOutcomes: this.feedbackHistory.slice(-this.config.maxFeedbackActions),
    }
  }

  getConfig(): HarnessProtocolConfig {
    return { ...this.config }
  }
}
