// src/engines/nlcl/nlcl-engine.ts
// NLCLEngine — main orchestrator for the Natural Language Command Layer.
// Takes raw natural language → resolves intent → routes to executor → returns result.
// Handles composite commands (multi-step: "go to cnn and summarize the news").
// Pluggable IntentResolver: deterministic by default, local LLM swappable.

import { newId } from '../../ids.js'
import type { ConversationStore } from '../../storage/contracts/conversation-store.js'
import type { CapStoreDb } from '../../storage/db.js'
import type { ChromeGovernor } from '../chrome-governor.js'
import type { ConversationManager } from '../conversation-manager.js'
import type { UnifiedCapabilityRegistry } from '../unified-registry.js'
import { getDefaultCommandPatterns } from './catalog.js'
import { CommandPatternRegistry } from './command-registry.js'
import {
  AppExecutor,
  BrowserExecutor,
  CapabilityExecutor,
  ConversationExecutor,
  EmailExecutor,
  FileExecutor,
  ProviderLLMExecutor,
  SystemExecutor,
  WorkflowExecutor,
} from './executors/index.js'
import {
  type LocalLLMAdapter,
  type ProviderLLMAdapter,
  createResolver,
  unresolvedIntent,
} from './intent-resolver.js'
import { type CompositeIntent, IntentRouter } from './intent-router.js'
import { NLCommandParser } from './nl-parser.js'
import { extractParameters, validateInput } from './parameter-extraction.js'
import type {
  CommandExecutor,
  CommandPattern,
  CommandResult,
  IntentResolver,
  NLCContext,
  NLCLEngineConfig,
  ParsedIntent,
} from './types.js'
import { DEFAULT_NLCL_CONFIG, classificationAtLeast } from './types.js'

export interface NLCLEngineDeps {
  governor?: ChromeGovernor
  conversationManager?: ConversationManager
  conversationStore?: ConversationStore
  registry?: UnifiedCapabilityRegistry
  db?: CapStoreDb
  config?: Partial<NLCLEngineConfig>
  localLLM?: LocalLLMAdapter
  providerLLM?: ProviderLLMAdapter
}

const COMPOSITE_SPLITTERS = [
  /\s+and\s+(?:then\s+)?/i,
  /\s+then\s+/i,
  /\s+after\s+(?:that|which)\s+/i,
  /,\s+(?:then|after)\s+/i,
]

export class NLCLEngine {
  private registry: CommandPatternRegistry
  private router: IntentRouter
  private resolver: IntentResolver
  private parser: NLCommandParser
  private config: NLCLEngineConfig
  private deps: NLCLEngineDeps
  private auditLog: Array<{
    ts: number
    input: string
    intent: string
    ok: boolean
    latencyMs: number
  }> = []

  constructor(deps: NLCLEngineDeps = {}) {
    this.deps = deps
    this.config = { ...DEFAULT_NLCL_CONFIG, ...deps.config }
    this.registry = new CommandPatternRegistry()
    this.router = new IntentRouter(deps.registry)
    this.parser = new NLCommandParser(this.registry)

    this.resolver = createResolver(this.config.resolver, this.registry, {
      localLLM: deps.localLLM,
      providerLLM: deps.providerLLM,
    })

    this.registerDefaultPatterns()
    this.registerExecutors()
  }

  // ── Public API ──────────────────────────────────────────────────────────

  async interpret(rawInput: string, ctx: NLCContext): Promise<CommandResult> {
    const start = Date.now()

    if (!rawInput.trim()) {
      return {
        ok: false,
        intent: 'empty',
        error: 'Empty input',
        latencyMs: 0,
        traceId: newId(),
        classification: 'system',
      }
    }

    const composite = this.detectComposite(rawInput)
    if (composite) {
      const result = await this.executeComposite(composite, ctx)
      this.audit(rawInput, 'composite', result.ok, Date.now() - start)
      return result
    }

    const intent = await this.resolver.resolve(rawInput, ctx)

    if (!intent || intent.confidence < this.config.resolver.minConfidence) {
      if (this.config.enableAIFallback) {
        const aiIntent = await this.tryAIFallback(rawInput, ctx)
        if (aiIntent) {
          const result = await this.routeWithConfirmation(aiIntent, ctx, start)
          this.audit(rawInput, aiIntent.intent, result.ok, Date.now() - start)
          return result
        }
      }

      const unresolved = unresolvedIntent(rawInput)
      const result = await this.router.route(unresolved, ctx)
      this.audit(rawInput, 'unresolved', false, Date.now() - start)
      return result
    }

    const result = await this.routeWithConfirmation(intent, ctx, start)
    this.audit(rawInput, intent.intent, result.ok, Date.now() - start)
    return result
  }

  /**
   * Routes intent with parameter extraction and confirmation flow.
   */
  private async routeWithConfirmation(
    intent: ParsedIntent,
    ctx: NLCContext,
    _start: number,
  ): Promise<CommandResult> {
    // Get the pattern to check capabilityId and schema
    const pattern = this.registry.getPattern(intent.patternId)
    if (pattern?.capabilityId) {
      // Extract and validate parameters against schema
      const extraction = extractParameters(intent.rawInput, pattern.inputSchema, ctx)
      if (extraction.missing.length > 0) {
        return {
          ok: false,
          intent: intent.intent,
          error: `Missing parameters: ${extraction.missing.join(', ')}`,
          text: `What ${extraction.missing.join(', ')}?`,
          latencyMs: 0,
          traceId: newId(),
          classification: pattern.classification,
          clarification: {
            prompt: `Missing: ${extraction.missing.join(', ')}`,
            missing: extraction.missing,
          },
          capabilityId: pattern.capabilityId,
        }
      }

      // Validate extracted input
      const validation = validateInput(extraction.input, pattern.inputSchema)
      if (!validation.ok) {
        return {
          ok: false,
          intent: intent.intent,
          error: validation.errors.join('; '),
          latencyMs: 0,
          traceId: newId(),
          classification: pattern.classification,
          clarification: {
            prompt: `Invalid parameters: ${validation.errors.join('; ')}`,
          },
          capabilityId: pattern.capabilityId,
        }
      }
    }

    // Check for confirmation requirement (25.6)
    if (pattern && (pattern.requiresConfirmation || this.isDestructive(pattern.classification))) {
      const token = newId()
      return {
        ok: true,
        intent: intent.intent,
        latencyMs: 0,
        traceId: newId(),
        classification: pattern.classification,
        requiresConfirmation: true,
        confirmation: {
          token,
          prompt: `Confirm: ${pattern.description}`,
        },
        capabilityId: pattern.capabilityId,
      }
    }

    return this.router.route(intent, ctx)
  }

  private isDestructive(classification: string): boolean {
    return classificationAtLeast(classification as any, 'destructive')
  }

  // ── Introspection ───────────────────────────────────────────────────────

  getRegistry(): CommandPatternRegistry {
    return this.registry
  }

  getRouter(): IntentRouter {
    return this.router
  }

  getResolver(): IntentResolver {
    return this.resolver
  }

  listCommands(filter?: { category?: string; surface?: string }): CommandPattern[] {
    return this.registry.list(filter as never)
  }

  getHelp(): { categories: Record<string, string[]>; totalCommands: number } {
    const byCategory = this.registry.listByCategory()
    const categories: Record<string, string[]> = {}
    for (const [cat, patterns] of Object.entries(byCategory)) {
      categories[cat] = patterns.map((p) => `${p.examples[0] ?? p.intent} — ${p.description}`)
    }
    return { categories, totalCommands: this.registry.size() }
  }

  getAuditLog(
    limit = 50,
  ): Array<{ ts: number; input: string; intent: string; ok: boolean; latencyMs: number }> {
    return this.auditLog.slice(-limit)
  }

  // ── Pluggability ────────────────────────────────────────────────────────

  registerPattern(pattern: CommandPattern): void {
    this.registry.register(pattern)
    this.router.registerPatternIntent(pattern.intent, pattern.executor)
  }

  registerExecutor(executor: CommandExecutor): void {
    this.router.registerExecutor(executor)
  }

  setResolver(resolver: IntentResolver): void {
    this.resolver = resolver
  }

  // ── Internal ────────────────────────────────────────────────────────────

  private registerDefaultPatterns(): void {
    const patterns = getDefaultCommandPatterns()
    for (const p of patterns) {
      this.registry.register(p)
      this.router.registerPatternIntent(p.intent, p.executor)
    }
  }

  private registerExecutors(): void {
    const { governor, conversationManager, conversationStore, registry, db } = this.deps

    const fileExec = new FileExecutor()
    const browserExec = new BrowserExecutor(governor, conversationManager)
    const llmExec = new ProviderLLMExecutor(conversationManager, conversationStore)
    const systemExec = new SystemExecutor(db, governor, registry)
    const convExec = new ConversationExecutor(conversationManager)
    const capExec = new CapabilityExecutor(registry)
    const emailExec = new EmailExecutor()
    const appExec = new AppExecutor()
    const workflowExec = new WorkflowExecutor(registry)

    const executors: CommandExecutor[] = [
      fileExec,
      browserExec,
      llmExec,
      systemExec,
      convExec,
      capExec,
      emailExec,
      appExec,
      workflowExec,
    ]
    for (const exec of executors) {
      this.router.registerExecutor(exec)
    }
  }

  private detectComposite(rawInput: string): CompositeIntent | null {
    for (const splitter of COMPOSITE_SPLITTERS) {
      const parts = rawInput.split(splitter)
      if (parts.length >= 2) {
        const steps: ParsedIntent[] = []
        for (const part of parts) {
          const trimmed = part.trim()
          if (!trimmed) continue
          const intent = this.parser.parse(trimmed, { surface: 'frontend' } as NLCContext, {
            surface: 'frontend',
          })
          if (intent) {
            steps.push(intent)
          } else {
            return null
          }
        }
        if (steps.length >= 2) {
          const joinStrategy = this.inferJoinStrategy(steps)
          return { steps, joinStrategy }
        }
      }
    }
    return null
  }

  private inferJoinStrategy(steps: ParsedIntent[]): 'sequential' | 'pipeline' | 'parallel' {
    const hasSummarize = steps.some(
      (s) => s.intent.includes('summarize') || s.intent.includes('extract'),
    )
    const hasNavigate = steps.some(
      (s) => s.intent.includes('navigate') || s.intent.includes('browser'),
    )
    if (hasNavigate && hasSummarize) return 'pipeline'
    return 'sequential'
  }

  private async executeComposite(
    composite: CompositeIntent,
    ctx: NLCContext,
  ): Promise<CommandResult> {
    if (composite.joinStrategy === 'pipeline') {
      return this.executePipeline(composite.steps, ctx)
    }
    return this.router.routeComposite(composite, ctx)
  }

  private async executePipeline(steps: ParsedIntent[], ctx: NLCContext): Promise<CommandResult> {
    const start = Date.now()
    const traceId = newId()
    const results: CommandResult[] = []
    let pipelineData: unknown = undefined

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]!
      const stepCtx = { ...ctx }

      if (pipelineData && i > 0) {
        const content =
          typeof pipelineData === 'string'
            ? pipelineData
            : ((pipelineData as { text?: string })?.text ?? JSON.stringify(pipelineData))
        step.input = { ...step.input, content }
      }

      const result = await this.router.route(step, stepCtx)
      results.push(result)

      if (!result.ok) {
        return {
          ok: false,
          intent: 'composite',
          error: `Step ${i + 1} failed: ${result.error}`,
          output: { results, failedAt: i + 1 },
          latencyMs: Date.now() - start,
          traceId,
          classification: 'system',
        }
      }

      pipelineData = result.output
    }

    const lastResult = results[results.length - 1]
    return {
      ok: true,
      intent: 'composite',
      output: { results, finalOutput: lastResult?.output },
      text: lastResult?.text ?? 'Done',
      latencyMs: Date.now() - start,
      traceId,
      classification: lastResult?.classification ?? 'communication',
    }
  }

  private async tryAIFallback(rawInput: string, ctx: NLCContext): Promise<ParsedIntent | null> {
    if (
      this.resolver.name === 'hybrid' ||
      this.resolver.name === 'layered' ||
      this.resolver.name === 'local-llm' ||
      this.resolver.name === 'provider-llm'
    ) {
      return null
    }

    if (this.deps.providerLLM) {
      const providerResolver = createResolver(
        { type: 'provider-llm', fallbackToDeterministic: false, minConfidence: 0.5 },
        this.registry,
        { providerLLM: this.deps.providerLLM },
      )
      return providerResolver.resolve(rawInput, ctx)
    }

    if (this.deps.localLLM) {
      const llmResolver = createResolver(
        { type: 'local-llm', fallbackToDeterministic: false, minConfidence: 0.5 },
        this.registry,
        { localLLM: this.deps.localLLM },
      )
      return llmResolver.resolve(rawInput, ctx)
    }

    return null
  }

  private audit(input: string, intent: string, ok: boolean, latencyMs: number): void {
    if (!this.config.auditLog) return
    this.auditLog.push({ ts: Date.now(), input, intent, ok, latencyMs })
    if (this.auditLog.length > 1000) {
      this.auditLog = this.auditLog.slice(-500)
    }
  }
}
