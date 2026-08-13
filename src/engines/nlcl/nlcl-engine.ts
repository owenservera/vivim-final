// src/engines/nlcl/nlcl-engine.ts
// NLCLEngine — main orchestrator for the Natural Language Command Layer.
// Takes raw natural language → resolves intent → routes to executor → returns result.
// Handles composite commands (multi-step: "go to cnn and summarize the news").
// Pluggable IntentResolver: deterministic by default, local LLM swappable.

import { newId } from '../../ids.js'
import { safeJsonParse } from '../../lib/safe-json.js'
import type { ConversationStore } from '../../storage/contracts/conversation-store.js'
import type { CapStoreDb } from '../../storage/db.js'
import type { ActionPlan, GroundedReference } from '../action-plan.js'
import { ActionPlanBridge } from '../action-plan-bridge.js'
import type { ChromeGovernor } from '../chrome-governor.js'
import type { ConversationManager } from '../conversation-manager.js'
import type { ExecutionKernel } from '../execution-kernel.js'
import { OpenCodeExecutor } from '../opencode/opencode-executor.js'
import { PlanValidationGate } from '../plan-validation-gate.js'
import type { EmbeddingProvider } from '../semantic-search.js'
import type { UnifiedCapabilityRegistry } from '../unified-registry.js'
import { getDefaultCommandPatterns } from './catalog.js'
import { CommandPatternRegistry } from './command-registry.js'
import { detectCompositeSplit } from './composite-splitter.js'
import { type ConfirmationStore, InMemoryConfirmationStore } from './confirmation-store.js'
import {
  computeDialogueSessionKey,
  type DialogueSessionStore,
  InMemoryDialogueSessionStore,
  resumePendingTurn,
} from './dialogue-session-store.js'
import type { DynamicEntityLinker } from './dynamic-entity-linker.js'
import {
  AppExecutor,
  BrowserExecutor,
  CapabilityExecutor,
  ConversationExecutor,
  EmailExecutor,
  FileExecutor,
  GenericBrowserExecutor,
  ProviderLLMExecutor,
  SystemExecutor,
  WorkflowExecutor,
} from './executors/index.js'
import { HelpResolver } from './help-resolver.js'
import {
  createResolver,
  type LocalLLMAdapter,
  type ProviderLLMAdapter,
  unresolvedIntent,
} from './intent-resolver.js'
import { type CompositeIntent, IntentRouter } from './intent-router.js'
import { NLCommandParser } from './nl-parser.js'
import {
  extractParameters,
  extractParametersWithLinker,
  validateInput,
} from './parameter-extraction.js'
import { Prerouter } from './prerouter.js'
import { createResponseInterpreter, type ResponseInterpreter } from './response-interpreter.js'
import type {
  CommandExecutor,
  CommandPattern,
  CommandResult,
  IntentResolver,
  NLCContext,
  NLCLEngineConfig,
  ParsedIntent,
} from './types.js'
import { classificationAtLeast, DEFAULT_NLCL_CONFIG } from './types.js'

export interface NLCLEngineDeps {
  governor?: ChromeGovernor
  automationOrchestrator?: import('../automation/orchestrator.js').AutomationOrchestrator
  conversationManager?: ConversationManager
  conversationStore?: ConversationStore
  registry?: UnifiedCapabilityRegistry
  db?: CapStoreDb
  config?: Partial<NLCLEngineConfig>
  localLLM?: LocalLLMAdapter
  providerLLM?: ProviderLLMAdapter
  opencodeClient?: import('../opencode/opencode-client.js').OpenCodeClient
  opencodeIngest?: import('../opencode/opencode-ingest.js').OpenCodeIngest
  /**
   * Confirmation store — if omitted, an in-memory HMAC-signed store is used.
   * Pass a NullConfirmationStore in tests to auto-approve. See confirmation-store.ts.
   */
  confirmationStore?: ConfirmationStore
  /**
   * Dialogue session store — Tier 3 unit 15.5. If omitted, an in-memory store
   * with 30-min sliding TTL is used. Pass a NullDialogueSessionStore in tests
   * to isolate per-turn behavior.
   */
  dialogueSessionStore?: DialogueSessionStore
  /**
   * Dynamic entity linker — Tier 4 unit 16.5. If provided, parameter
   * extraction will resolve entity references (workspace names, conversation
   * titles, etc.) to IDs INSIDE the extraction step (audit ❌-12).
   */
  entityLinker?: DynamicEntityLinker
  /**
   * Phase 7 of ROADMAP-REPROGRAMMABLE-CANVAS.md — LLM harness escalator.
   * If provided, the engine routes inputs starting with `/agent ` (or with
   * confidence below the escalation threshold) to this callback instead of
   * the unresolved path. The callback is expected to produce a
   * SurfaceMutationPlan; the engine wraps it into a CommandResult for the
   * existing /api/nlcl/interpret response surface.
   */
  llmHarnessEscalator?: (
    input: string,
    ctx: NLCContext,
  ) => Promise<{
    ok: boolean
    plan?: unknown
    confirmationToken?: string
    error?: string
  }>
  /**
   * Embedding provider — booted in the knowledge phase. Passed through to
   * SemanticResolver, HelpResolver, and LLMSlaveResolver so they use the
   * same real neural embeddings (HF 768-d) instead of the MiniLM hash fallback.
   */
  embeddingProvider?: EmbeddingProvider
  /**
   * NLI classifier resolver — tiny local expert #2 for intent classification.
   * If provided, sits between SemanticResolver and the LLM fallback as a
   * cheap pre-filter (layer 3.5). See nlcl/classifier-resolver.ts.
   */
  classifierResolver?: IntentResolver
  /**
   * Response interpreter — enriches command result text by extracting
   * meaningful text from structured output, applying confidence hedging,
   * and adding dialogue continuity hints. If omitted, a default interpreter
   * is created.
   */
  responseInterpreter?: ResponseInterpreter
}

// Tier 3 unit 15.10 — COMPOSITE_SPLITTERS table removed.
// Replaced by src/engines/nlcl/composite-splitter.ts (clause-aware, depth-capped at 2,
// binary splits only — closes audit finding ❌-11).

export class NLCLEngine {
  private registry: CommandPatternRegistry
  private router: IntentRouter
  private resolver: IntentResolver
  private parser: NLCommandParser
  private config: NLCLEngineConfig
  private deps: NLCLEngineDeps
  private confirmationStore: ConfirmationStore
  private dialogueSessionStore: DialogueSessionStore
  private prerouter: Prerouter
  private entityLinker: DynamicEntityLinker | null
  private helpResolver: HelpResolver
  private responseInterpreter: ResponseInterpreter
  /** Phase 2 — converts ParsedIntent → ActionPlan for plan-carrying results. */
  private actionPlanBridge: ActionPlanBridge
  /** Phase 2 — pre-execution validation gate for ActionPlans. */
  private planValidationGate: PlanValidationGate
  /** P0 ExecutionKernel — hardened execution lifecycle, wired at boot when enabled. */
  private capabilityExecutor?: CapabilityExecutor
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
    this.confirmationStore = deps.confirmationStore ?? new InMemoryConfirmationStore()
    this.dialogueSessionStore = deps.dialogueSessionStore ?? new InMemoryDialogueSessionStore()
    this.entityLinker = deps.entityLinker ?? null
    this.responseInterpreter = deps.responseInterpreter ?? createResponseInterpreter()
    this.actionPlanBridge = new ActionPlanBridge()
    this.planValidationGate = new PlanValidationGate()
    this.registry = new CommandPatternRegistry()
    this.router = new IntentRouter(deps.registry)
    this.parser = new NLCommandParser(this.registry)
    this.prerouter = new Prerouter(this.registry)
    this.helpResolver = new HelpResolver(this.registry, {
      embeddingProvider: deps.embeddingProvider,
    })

    this.resolver = createResolver(this.config.resolver, this.registry, {
      localLLM: deps.localLLM,
      providerLLM: deps.providerLLM,
      embeddingProvider: deps.embeddingProvider,
      classifierResolver: deps.classifierResolver,
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

    // ── Phase 7 — LLM harness escalation for explicit `/agent ...` requests ──
    // If the user explicitly types `/agent <request>`, bypass the deterministic
    // resolver and route directly to the LLM harness agent. The agent produces
    // a SurfaceMutationPlan; we wrap it in a CommandResult so the existing
    // /api/nlcl/interpret response surface carries it.
    if (this.deps.llmHarnessEscalator) {
      const agentMatch = rawInput.match(/^\/agent\s+(.+)$/i)
      if (agentMatch) {
        const escalatorInput = agentMatch[1]?.trim()
        try {
          const escalation = await this.deps.llmHarnessEscalator(escalatorInput!, ctx)
          if (escalation.ok) {
            this.audit(rawInput, 'llm-harness', true, Date.now() - start)
            return {
              ok: true,
              intent: 'llm-harness',
              latencyMs: Date.now() - start,
              traceId: newId(),
              classification: 'system',
              // Pack the plan + confirmation token into `output`. The frontend
              // (Composer + AgentPlanCard) unpacks this shape via coerceToPlan.
              output: {
                kind: 'mutation-plan',
                plan: escalation.plan,
                confirmationToken: escalation.confirmationToken,
              },
            } as CommandResult
          }
          this.audit(rawInput, 'llm-harness', false, Date.now() - start)
          return {
            ok: false,
            intent: 'llm-harness',
            error: escalation.error ?? 'LLM harness escalation failed',
            latencyMs: Date.now() - start,
            traceId: newId(),
            classification: 'system',
          }
        } catch (err) {
          this.audit(rawInput, 'llm-harness', false, Date.now() - start)
          return {
            ok: false,
            intent: 'llm-harness',
            error: err instanceof Error ? err.message : String(err),
            latencyMs: Date.now() - start,
            traceId: newId(),
            classification: 'system',
          }
        }
      }
    }

    // Tier 3 unit 15.5 — resume pending turn from dialogue session.
    // This MUST happen BEFORE composite detection and resolver, because
    // "yes" / "ok" / short clarification answers are not standalone commands
    // and would otherwise be routed to 'unresolved'.
    const sessionKey = computeDialogueSessionKey(ctx)
    const session = this.dialogueSessionStore.get(sessionKey)
    const pending = resumePendingTurn(rawInput, session)
    if (pending) {
      if (pending.kind === 'confirm') {
        // User confirmed the pending action — consume the token and execute.
        const confirmed = this.confirmationStore.consume(pending.token)
        if (!confirmed) {
          // Token expired or already consumed — fall through to normal flow.
          this.dialogueSessionStore.update(sessionKey, {
            pendingConfirmationToken: null,
          })
        } else {
          // Re-derive the pattern and execute bypassing the confirmation gate.
          const patterns = this.listCommands()
          const pattern = patterns.find(
            (p) => p.capabilityId === confirmed.capabilityId || p.intent === confirmed.capabilityId,
          )
          if (pattern) {
            let confirmedCtx: NLCContext
            try {
              confirmedCtx = safeJsonParse<NLCContext>(confirmed.contextJson, ctx)
              confirmedCtx = { ...confirmedCtx, ...ctx }
            } catch {
              confirmedCtx = ctx
            }
            const result = await this.router.route(
              {
                patternId: pattern.id,
                intent: pattern.intent,
                input: confirmed.input as Record<string, unknown>,
                confidence: 1.0,
                rawInput: '<confirmed-via-dialogue>',
                matchedPattern: pattern.examples[0] ?? pattern.intent,
                alternatives: [],
                resolvedAt: Date.now(),
                capabilityId: confirmed.capabilityId,
                classification: pattern.classification,
                // The human confirmation gate already minted/verified the token; tell the kernel this plan is engine-authorized.
                confirmationSatisfied: true,
              },
              confirmedCtx,
            )
            this.dialogueSessionStore.update(sessionKey, {
              pendingConfirmationToken: null,
              turnCount: (session?.turnCount ?? 0) + 1,
              lastIntent: pattern.intent,
              lastSubject: deriveLastSubject(confirmed.input as Record<string, unknown>),
            })
            this.audit(rawInput, 'dialogue-confirm', result.ok, Date.now() - start)
            return result
          }
          // Pattern no longer registered — fall through.
          this.dialogueSessionStore.update(sessionKey, {
            pendingConfirmationToken: null,
          })
        }
      } else if (pending.kind === 'clarify') {
        // User provided a value for a pending clarification — augment the input
        // with the previous intent's context and re-resolve.
        const augmentedInput = `${session?.lastIntent ?? ''} ${pending.value}`.trim()
        const clarifyCtx: NLCContext = {
          ...ctx,
          metadata: {
            ...ctx.metadata,
            __dialogueClarification: pending.value,
            __dialogueLastIntent: session?.lastIntent,
          },
        }
        // Try resolving the augmented input first.
        const intent = await this.resolver.resolve(augmentedInput, clarifyCtx)
        if (intent && intent.confidence >= this.config.resolver.minConfidence) {
          this.dialogueSessionStore.update(sessionKey, {
            pendingClarification: null,
            turnCount: (session?.turnCount ?? 0) + 1,
          })
          const result = await this.routeWithConfirmation(intent, clarifyCtx, start)
          this.audit(rawInput, intent.intent, result.ok, Date.now() - start)
          return result
        }
        // Fall through — clarification didn't yield a valid intent; let the
        // normal flow produce a fresh clarification or unresolved error.
        this.dialogueSessionStore.update(sessionKey, {
          pendingClarification: null,
        })
      }
    }

    const composite = this.detectComposite(rawInput, ctx)
    if (composite) {
      const result = await this.executeComposite(composite, ctx)
      // Persist dialogue state for composite commands.
      if (result.ok) {
        this.dialogueSessionStore.update(sessionKey, {
          lastIntent: 'composite',
          lastSubject: deriveLastSubjectFromResult(result),
          turnCount: (session?.turnCount ?? 0) + 1,
        })
      }
      this.audit(rawInput, 'composite', result.ok, Date.now() - start)
      return result
    }

    // Tier 3 unit 15.11 — Prerouter fast path.
    // Try local-only commands (help, clear, reset, etc.) BEFORE the full
    // 5-layer resolver. Saves the cost of fuzzy/semantic/LLM retrieval for
    // trivially-local commands. Replaces the planned-but-never-implemented
    // LOCAL_INTENTS regex table from the upgrade design doc.
    const prerouterMatch = this.prerouter.match(rawInput, ctx)
    if (prerouterMatch) {
      const result = await this.routeWithConfirmation(prerouterMatch.intent, ctx, start)
      if (result.ok) {
        this.dialogueSessionStore.update(sessionKey, {
          pendingConfirmationToken: null,
          pendingClarification: null,
          lastIntent: prerouterMatch.intent.intent,
          lastProviderId: ctx.providerId ?? null,
          lastSubject: deriveLastSubject(prerouterMatch.intent.input),
          turnCount: (session?.turnCount ?? 0) + 1,
        })
      }
      this.audit(rawInput, prerouterMatch.intent.intent, result.ok, Date.now() - start)
      return result
    }

    // Tier 4 unit 16.9 — HelpResolver (embedder-based question detection).
    // Catches paraphrases like "show me how to delete a conversation" that
    // the regex-based literal help pattern would miss (audit ❌-14).
    const helpIntent = await this.helpResolver.resolve(rawInput, ctx)
    if (helpIntent) {
      const result = await this.routeWithConfirmation(helpIntent, ctx, start)
      this.dialogueSessionStore.update(sessionKey, {
        pendingConfirmationToken: null,
        pendingClarification: null,
        lastIntent: helpIntent.intent,
        lastProviderId: ctx.providerId ?? null,
        lastSubject: null,
        turnCount: (session?.turnCount ?? 0) + 1,
      })
      this.audit(rawInput, helpIntent.intent, result.ok, Date.now() - start)
      return result
    }

    const intent = await this.resolver.resolve(rawInput, ctx)

    if (!intent || intent.confidence < this.config.resolver.minConfidence) {
      if (this.config.enableAIFallback) {
        const aiIntent = await this.tryAIFallback(rawInput, ctx)
        if (aiIntent) {
          const result = await this.routeWithConfirmation(aiIntent, ctx, start)
          // Persist dialogue state on AI-fallback success.
          if (result.ok) {
            this.dialogueSessionStore.update(sessionKey, {
              lastIntent: aiIntent.intent,
              lastProviderId: ctx.providerId ?? null,
              turnCount: (session?.turnCount ?? 0) + 1,
              pendingClarification: result.clarification ?? null,
            })
          }
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
    // Tier 3 unit 15.5 — persist dialogue state after successful resolution.
    // Tracks lastSubject (for pronoun resolution), pending confirmation tokens
    // (for "yes"/"ok" follow-ups), and pending clarifications.
    if (result.requiresConfirmation && result.confirmation?.token) {
      this.dialogueSessionStore.update(sessionKey, {
        pendingConfirmationToken: result.confirmation.token,
        lastIntent: intent.intent,
        lastProviderId: ctx.providerId ?? null,
        lastSubject: deriveLastSubject(intent.input),
        turnCount: (session?.turnCount ?? 0) + 1,
      })
    } else if (result.clarification) {
      this.dialogueSessionStore.update(sessionKey, {
        pendingClarification: result.clarification,
        lastIntent: intent.intent,
        lastProviderId: ctx.providerId ?? null,
        lastSubject: deriveLastSubject(intent.input),
        turnCount: (session?.turnCount ?? 0) + 1,
      })
    } else if (result.ok) {
      this.dialogueSessionStore.update(sessionKey, {
        pendingConfirmationToken: null,
        pendingClarification: null,
        lastIntent: intent.intent,
        lastProviderId: ctx.providerId ?? null,
        lastSubject: deriveLastSubject(intent.input),
        turnCount: (session?.turnCount ?? 0) + 1,
      })
    }
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
      // Extract and validate parameters against schema.
      // Tier 4 unit 16.5 — use async extractParametersWithLinker when a
      // DynamicEntityLinker is registered (audit ❌-12: runs INSIDE param-extract).
      const extraction =
        this.entityLinker != null
          ? await extractParametersWithLinker(
              intent.rawInput,
              pattern.inputSchema,
              ctx,
              this.entityLinker,
            )
          : extractParameters(intent.rawInput, pattern.inputSchema, ctx)
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

    // Audit finding A.6 fix — write lastSubject to ctx.metadata so resolvePronouns()
    // (context-binder.ts:64) has a real value to read on the next turn. Without this
    // write site, lastSubject is permanently undefined and pronoun resolution is dead code.
    if (pattern?.capabilityId) {
      const derived = deriveLastSubject(intent.input)
      if (derived) {
        ctx.metadata = { ...ctx.metadata, lastSubject: derived }
      }
    }

    // Phase 2 — Produce ActionPlan from the resolved intent (before execution).
    // The plan is SUPPLEMENTARY: execution of the resolved intent is the answer.
    // Plan production is defensive — if it fails for any reason (unknown
    // capability, missing catalog entry, validation error), we still execute
    // the command. Per the upgrade-pack directive: assume we were "not smart
    // enough" to fully classify the plan, but the resolved intent stands.
    let actionPlan: ActionPlan | undefined
    let groundedRefs: GroundedReference[] = []
    try {
      const planResult = this.actionPlanBridge.intentToPlan(intent, ctx)
      actionPlan = planResult.plan ?? undefined
      groundedRefs = planResult.groundedRefs
      // Validation is observability-only — it must never block execution.
      if (actionPlan) {
        this.planValidationGate.validate(actionPlan)
      }
    } catch {
      // Plan production is best-effort; swallow and continue with execution.
      actionPlan = undefined
      groundedRefs = []
    }

    // Check for confirmation requirement (25.6)
    // Audit finding A.1 fix — mint a REAL confirmation via ConfirmationStore (HMAC-signed,
    // 5-min sliding TTL, one-shot consume, audit-logged). The previous code minted an
    // orphan newId() token that no route could ever consume.
    if (pattern && (pattern.requiresConfirmation || this.isDestructive(pattern.classification))) {
      const pending = this.confirmationStore.create({
        capabilityId: pattern.capabilityId ?? intent.intent,
        input: intent.input ?? {},
        contextJson: JSON.stringify(ctx),
        classification: pattern.classification,
      })
      return {
        ok: true,
        intent: intent.intent,
        latencyMs: 0,
        traceId: newId(),
        classification: pattern.classification,
        requiresConfirmation: true,
        confirmation: {
          token: pending.token,
          prompt: `Confirm: ${pattern.description}`,
        },
        capabilityId: pattern.capabilityId,
        actionPlan,
        groundedRefs,
      }
    }

    const routeResult = await this.router.route(intent, ctx)

    // Phase 2 — Attach plan + grounded refs to the route result.
    routeResult.actionPlan = actionPlan
    routeResult.groundedRefs = groundedRefs

    return routeResult
  }

  private isDestructive(classification: string): boolean {
    return classificationAtLeast(classification as 'destructive', 'destructive')
  }

  /** Expose the confirmation store so the /api/nlcl/confirm route can consume tokens. */
  getConfirmationStore(): ConfirmationStore {
    return this.confirmationStore
  }

  /** Expose the dialogue session store (Tier 3 unit 15.5) for inspection/reset. */
  getDialogueSessionStore(): DialogueSessionStore {
    return this.dialogueSessionStore
  }

  /** Expose the prerouter (Tier 3 unit 15.11) for live-fetch of local commands. */
  getPrerouter(): Prerouter {
    return this.prerouter
  }

  /** Expose the help resolver (Tier 4 unit 16.9) for diagnostics. */
  getHelpResolver(): HelpResolver {
    return this.helpResolver
  }

  /**
   * Register a dynamic entity linker (Tier 4 unit 16.5). Once registered,
   * parameter extraction will resolve entity references (workspace names,
   * conversation titles, etc.) to IDs INSIDE the extraction step.
   */
  setEntityLinker(linker: DynamicEntityLinker | null): void {
    this.entityLinker = linker
  }

  /** Get the currently registered entity linker (if any). */
  getEntityLinker(): DynamicEntityLinker | null {
    return this.entityLinker
  }

  /** Reset the dialogue session for the given context (e.g. on /api/nlcl/reset). */
  resetDialogueSession(ctx: NLCContext): void {
    const sessionKey = computeDialogueSessionKey(ctx)
    this.dialogueSessionStore.clear(sessionKey)
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
    const {
      governor,
      automationOrchestrator,
      conversationManager,
      conversationStore,
      registry,
      db,
    } = this.deps

    const fileExec = new FileExecutor()
    const browserExec = new BrowserExecutor(governor, conversationManager)
    const llmExec = new ProviderLLMExecutor(conversationManager, conversationStore)
    const systemExec = new SystemExecutor(db, governor, registry)
    const convExec = new ConversationExecutor(conversationManager)
    const capExec = new CapabilityExecutor(registry, this.responseInterpreter)
    this.capabilityExecutor = capExec
    const emailExec = new EmailExecutor()
    const appExec = new AppExecutor()
    const workflowExec = new WorkflowExecutor(registry)
    const autoExec = new GenericBrowserExecutor(governor, automationOrchestrator)

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
      autoExec,
    ]

    if (this.deps.opencodeClient && this.deps.opencodeIngest) {
      executors.push(
        new OpenCodeExecutor({
          client: this.deps.opencodeClient,
          ingest: this.deps.opencodeIngest,
        }),
      )
    }
    for (const exec of executors) {
      this.router.registerExecutor(exec)
    }
  }

  /**
   * Wire the P0 ExecutionKernel into NLCL. The router handles intents whose
   * capabilityId resolves to a registered capability; the CapabilityExecutor is
   * the backstop for `capability:`-prefixed intents. Called once at boot when
   * VIVIM_EXECUTION_KERNEL is enabled.
   */
  setExecutionKernel(kernel: ExecutionKernel): void {
    this.router.setKernel(kernel)
    this.capabilityExecutor?.setKernel(kernel)
  }

  private detectComposite(rawInput: string, ctx?: NLCContext): CompositeIntent | null {
    // Tier 3 unit 15.10 — use the new clause-aware splitter (audit ❌-11).
    // The old regex-based splitter produced arbitrary N-way splits with no
    // depth cap, causing false positives and exponential parse blowup.
    const parseCtx: NLCContext = ctx ?? ({ surface: 'frontend' } as NLCContext)
    const split = detectCompositeSplit(rawInput, this.parser, parseCtx)
    if (!split) return null
    const steps: ParsedIntent[] = [split.steps[0], split.steps[1]]
    const joinStrategy = this.inferJoinStrategy(steps)
    return { steps, joinStrategy }
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
    // Phase 2 — Produce a multi-step ActionPlan for composite intents.
    // Defensive: plan is supplementary; never block composite execution.
    let actionPlan: ActionPlan | undefined
    let groundedRefs: GroundedReference[] = []
    try {
      const planResult = this.actionPlanBridge.intentsToPlan(composite.steps, ctx)
      actionPlan = planResult.plan ?? undefined
      groundedRefs = planResult.groundedRefs
    } catch {
      actionPlan = undefined
      groundedRefs = []
    }
    let result: CommandResult
    if (composite.joinStrategy === 'pipeline') {
      result = await this.executePipeline(composite.steps, ctx)
    } else {
      result = await this.router.routeComposite(composite, ctx)
    }
    // Attach plan + grounded refs to the composite result.
    result.actionPlan = actionPlan ?? undefined
    result.groundedRefs = groundedRefs
    return result
  }

  private async executePipeline(steps: ParsedIntent[], ctx: NLCContext): Promise<CommandResult> {
    const start = Date.now()
    const traceId = newId()
    const results: CommandResult[] = []
    let pipelineData: unknown

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      if (!step) continue
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

/**
 * Audit finding A.6 fix — derive a `lastSubject` value from the resolved intent's
 * parameters so that `resolvePronouns()` (context-binder.ts:64) has a real value
 * to read on the next turn. Picks the first entity-typed parameter (id-like string,
 * or any string field whose name ends in `Id` / `Name` / `Title` / `Subject`).
 *
 * Heuristic, intentionally simple — the real fix is unit 15.5's DialogueSessionStore
 * which will track the full pending turn, not just lastSubject.
 */
function deriveLastSubject(input: Record<string, unknown> | undefined): string | null {
  if (!input) return null
  // Prefer fields that look like entity references.
  const preferredKeys = [
    'conversationId',
    'workspaceId',
    'providerId',
    'slaveId',
    'taskId',
    'agentId',
  ]
  for (const key of preferredKeys) {
    const v = input[key]
    if (typeof v === 'string' && v.length > 0) return v
  }
  // Fall back to any *Id / *Name / *Title / *Subject field.
  for (const [key, v] of Object.entries(input)) {
    if (typeof v !== 'string' || v.length === 0) continue
    if (/(Id|Name|Title|Subject)$/i.test(key)) return v
  }
  return null
}

/**
 * Derive lastSubject from a CommandResult — used for composite commands where
 * we don't have a single intent.input. Picks the first id-like string from the
 * result's output (if it's an object) or the result's text content (if string).
 */
function deriveLastSubjectFromResult(result: CommandResult): string | null {
  if (result.output && typeof result.output === 'object') {
    const derived = deriveLastSubject(result.output as Record<string, unknown>)
    if (derived) return derived
  }
  if (
    result.text &&
    typeof result.text === 'string' &&
    result.text.length > 0 &&
    result.text.length < 200
  ) {
    return result.text
  }
  return null
}
