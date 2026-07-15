// src/engines/provider-mux.ts
// ProviderMuxEngine — fan-out, round-robin, priority, cost-optimized, and learned multi-provider routing

import { EngineError } from '../errors.js'
import { newId } from '../ids.js'
import type { Router } from '../router/router.js'
import type { ChannelStore } from '../storage/contracts/channel-store.js'
import type { CapabilityEventBus } from './capability-event-bus.js'
import type { ChromeGovernor } from './chrome-governor.js'
import type { NormalizedMessage } from './messaging-archetypes.js'

// ── Store contract ─────────────────────────────────────────────────────────

export interface MuxSessionInput {
  id: string
  message: string
  conversationId: string | null
  strategy: string
  status: string
  synthesizedResponse: string | null
  bestProviderId: string | null
  totalCostCents: number
  totalLatencyMs: number
  startedAt: number
  completedAt: number | null
}

export interface MuxSessionRow extends MuxSessionInput {}

export interface MuxResponseInput {
  id: string
  muxSessionId: string
  providerId: string
  accountId: string | null
  ok: number
  response: string
  latencyMs: number
  costCents: number
  error: string | null
  ts: number
}

export interface MuxResponseRow extends MuxResponseInput {}

export interface RoutingPreferenceInput {
  id: string
  capabilityId: string
  providerId: string
  score: number
  sampleCount: number
  updatedAt: number
}

export interface RoutingPreferenceRow extends RoutingPreferenceInput {}

export interface MuxStore {
  createMuxSession(session: MuxSessionInput): Promise<void>
  updateMuxSession(id: string, patch: Record<string, unknown>): Promise<void>
  getMuxSession(id: string): Promise<MuxSessionRow | null>
  createMuxResponse(response: MuxResponseInput): Promise<void>
  getMuxResponses(sessionId: string): Promise<MuxResponseRow[]>
  createRoutingPreference(input: RoutingPreferenceInput): Promise<void>
  updateRoutingPreference(
    id: string,
    patch: { score?: number; sampleCount?: number; updatedAt?: number },
  ): Promise<void>
  getRoutingPreferences(capabilityId?: string): Promise<RoutingPreferenceRow[]>
}

// ── Public types ────────────────────────────────────────────────────────────

export type MuxStrategy = 'fan_out' | 'round_robin' | 'priority' | 'cost_optimized' | 'learned'

export interface MuxRequest {
  message: string
  conversationId?: string
  capabilityId?: string
  strategy: MuxStrategy
  targetProviderIds?: string[]
  maxProviders: number
  synthesisEnabled: boolean
  costBudgetCents?: number
  timeoutMs: number
}

export interface MuxResponse {
  muxSessionId: string
  providerResponses: Array<{
    providerId: string
    accountId: string | null
    ok: boolean
    response: string
    latencyMs: number
    costCents: number
    error?: string
  }>
  synthesizedResponse: string | null
  bestProviderId: string | null
  totalCostCents: number
  totalLatencyMs: number
  strategyUsed: MuxStrategy
}

export interface MuxDispatcher {
  dispatchToProvider(
    providerId: string,
    message: string,
    conversationId?: string,
  ): Promise<{
    ok: boolean
    response: string
    latencyMs: number
    costCents: number
    error?: string
  }>
}

// ── ProviderMuxEngine ───────────────────────────────────────────────────────

export class ProviderMuxEngine {
  constructor(
    private store: MuxStore,
    private dispatcher: MuxDispatcher,
    private router: Router,
    private eventBus: CapabilityEventBus,
    private channelStore?: ChannelStore,
    private governor?: ChromeGovernor,
  ) {}

  // Phase 27.6: Subscribe a channel to route messages to a conversation
  async subscribeChannel(channelId: string, targetConversationId: string): Promise<void> {
    // Channel subscriptions would be tracked in the MuxStore or a dedicated table
    this.eventBus.emit({
      type: 'channel:subscription',
      channelId,
      conversationId: targetConversationId,
      active: true,
    } as unknown as never)
  }

  // Phase 27.6: Unsubscribe a channel
  async unsubscribeChannel(channelId: string): Promise<void> {
    this.eventBus.emit({
      type: 'channel:subscription',
      channelId,
      active: false,
    } as unknown as never)
  }

  // Phase 27.6: Process inbound channel message
  async processChannelMessage(
    channelId: string,
    message: NormalizedMessage,
    targetConversationId: string,
  ): Promise<void> {
    this.eventBus.emit({
      type: 'channel:message',
      channelId,
      conversationId: targetConversationId,
      message,
    } as unknown as never)
  }

  async mux(request: MuxRequest): Promise<MuxResponse> {
    const providerIds = request.targetProviderIds ?? (await this.resolveProviderIds(request))

    switch (request.strategy) {
      case 'fan_out':
        return this.fanOut(request.message, providerIds, request)
      case 'round_robin':
        return this.roundRobin(request.message, providerIds, request)
      case 'priority':
        return this.priorityDispatch(request.message, providerIds, request)
      case 'cost_optimized':
        return this.costOptimized(request.message, providerIds, request)
      case 'learned':
        return this.learnedDispatch(request.message, request.capabilityId, providerIds, request)
      default:
        return this.fanOut(request.message, providerIds, request)
    }
  }

  async fanOut(
    message: string,
    providerIds: string[],
    requestOrTimeout: MuxRequest | number,
  ): Promise<MuxResponse> {
    const timeoutMs =
      typeof requestOrTimeout === 'number' ? requestOrTimeout : requestOrTimeout.timeoutMs
    const request: MuxRequest =
      typeof requestOrTimeout === 'object'
        ? requestOrTimeout
        : {
            message,
            timeoutMs,
            synthesisEnabled: true,
            maxProviders: providerIds.length,
            strategy: 'fan_out' as MuxStrategy,
            conversationId: undefined,
          }

    const sessionId = await this.createSession(message, null, 'fan_out')
    const limited = providerIds.slice(0, request.maxProviders ?? providerIds.length)
    const results = await Promise.all(
      limited.map((pid) =>
        this.dispatchWithTimeout(pid, message, sessionId, timeoutMs, request.conversationId),
      ),
    )

    return this.buildResponse(sessionId, limited, results, 'fan_out', request.synthesisEnabled)
  }

  async autoRoute(message: string, capabilityId?: string): Promise<MuxResponse> {
    const prefs = await this.store.getRoutingPreferences(capabilityId)
    const sorted = prefs.sort((a, b) => b.score - a.score)
    const providerIds = sorted.map((p) => p.providerId)

    if (providerIds.length === 0) {
      throw new EngineError(
        `No routing preferences found${capabilityId ? ` for capability ${capabilityId}` : ''}`,
      )
    }

    const sessionId = await this.createSession(message, capabilityId ?? null, 'learned')
    const selected = providerIds.slice(0, 3)
    const results = await Promise.all(
      selected.map((pid) => this.dispatchWithTimeout(pid, message, sessionId, 30000)),
    )

    return this.buildResponse(sessionId, selected, results, 'learned', true)
  }

  async synthesize(responses: Array<{ providerId: string; response: string }>): Promise<string> {
    if (responses.length === 0) return ''
    if (responses.length === 1) return responses[0]?.response ?? ''
    const parts = responses.map((r) => `[${r.providerId}]: ${r.response}`)
    return parts.join('\n\n---\n\n')
  }

  async recordOutcome(muxSessionId: string, bestProviderId: string): Promise<void> {
    const session = await this.store.getMuxSession(muxSessionId)
    if (!session) return

    await this.store.updateMuxSession(muxSessionId, {
      bestProviderId,
      status: 'completed',
      completedAt: Date.now(),
    })

    const responses = await this.store.getMuxResponses(muxSessionId)
    for (const resp of responses) {
      const isBest = resp.providerId === bestProviderId
      const prefs = await this.store.getRoutingPreferences()
      const pref = prefs.find((p) => p.providerId === resp.providerId)
      if (pref) {
        const newScore = isBest ? Math.min(pref.score + 0.1, 1.0) : Math.max(pref.score - 0.05, 0)
        await this.store.updateRoutingPreference(pref.id, {
          score: newScore,
          sampleCount: pref.sampleCount + 1,
          updatedAt: Date.now(),
        })
      }
    }

    this.eventBus.emit({
      type: 'capability:executed',
      capabilityId: session.conversationId ?? 'unknown',
      providerId: bestProviderId,
      traceId: muxSessionId,
      ok: true,
      latencyMs: 0,
    })
  }

  async getRoutingScore(capabilityId: string, providerId: string): Promise<number> {
    const prefs = await this.store.getRoutingPreferences(capabilityId)
    const match = prefs.find((p) => p.providerId === providerId)
    return match?.score ?? 0.5
  }

  // Unit 34.5: ordered fallback providers for mid-task failover. Returns all
  // known providers except the failed one, sorted by routing score (best first).
  async fallbacksFor(providerId: string): Promise<string[]> {
    const prefs = await this.store.getRoutingPreferences()
    return prefs
      .filter((p) => p.providerId !== providerId)
      .sort((a, b) => b.score - a.score)
      .map((p) => p.providerId)
  }

  // ── Private ────────────────────────────────────────────────────────────

  private async resolveProviderIds(request: MuxRequest): Promise<string[]> {
    if (request.capabilityId) {
      const prefs = await this.store.getRoutingPreferences(request.capabilityId)
      if (prefs.length > 0) {
        return prefs.sort((a, b) => b.score - a.score).map((p) => p.providerId)
      }
    }
    return []
  }

  private async roundRobin(
    message: string,
    providerIds: string[],
    request: MuxRequest,
  ): Promise<MuxResponse> {
    const sessionId = await this.createSession(message, null, 'round_robin')
    const results: MuxDispatchResult[] = []

    for (const pid of providerIds.slice(0, request.maxProviders)) {
      const result = await this.dispatchWithTimeout(
        pid,
        message,
        sessionId,
        request.timeoutMs,
        request.conversationId,
      )
      results.push(result)
    }

    return this.buildResponse(
      sessionId,
      providerIds,
      results,
      'round_robin',
      request.synthesisEnabled,
    )
  }

  private async priorityDispatch(
    message: string,
    providerIds: string[],
    request: MuxRequest,
  ): Promise<MuxResponse> {
    const sessionId = await this.createSession(message, null, 'priority')
    const results: MuxDispatchResult[] = []
    let lastFailed: MuxDispatchResult | null = null

    for (const pid of providerIds.slice(0, request.maxProviders)) {
      const result = await this.dispatchWithTimeout(
        pid,
        message,
        sessionId,
        request.timeoutMs,
        request.conversationId,
      )
      if (result.ok) {
        results.push(result)
        break
      }
      lastFailed = result
    }

    // If all failed, include last failed for error visibility
    if (results.length === 0 && lastFailed) {
      results.push(lastFailed)
    }

    return this.buildResponse(sessionId, providerIds, results, 'priority', request.synthesisEnabled)
  }

  private async costOptimized(
    message: string,
    providerIds: string[],
    request: MuxRequest,
  ): Promise<MuxResponse> {
    const sessionId = await this.createSession(message, null, 'cost_optimized')
    let accruedCost = 0
    const results: MuxDispatchResult[] = []

    for (const pid of providerIds.slice(0, request.maxProviders)) {
      if (request.costBudgetCents !== undefined && accruedCost >= request.costBudgetCents) break
      const result = await this.dispatchWithTimeout(
        pid,
        message,
        sessionId,
        request.timeoutMs,
        request.conversationId,
      )
      results.push(result)
      accruedCost += result.costCents
    }

    return this.buildResponse(
      sessionId,
      providerIds,
      results,
      'cost_optimized',
      request.synthesisEnabled,
    )
  }

  private async learnedDispatch(
    message: string,
    _capabilityId: string | undefined,
    providerIds: string[],
    request: MuxRequest,
  ): Promise<MuxResponse> {
    const sessionId = await this.createSession(message, _capabilityId ?? null, 'learned')
    const results: MuxDispatchResult[] = []

    for (const pid of providerIds.slice(0, request.maxProviders)) {
      const result = await this.dispatchWithTimeout(
        pid,
        message,
        sessionId,
        request.timeoutMs,
        request.conversationId,
      )
      results.push(result)
    }

    return this.buildResponse(sessionId, providerIds, results, 'learned', request.synthesisEnabled)
  }

  private async dispatchWithTimeout(
    providerId: string,
    message: string,
    sessionId: string,
    timeoutMs: number,
    conversationId?: string,
  ): Promise<MuxDispatchResult> {
    const start = Date.now()
    try {
      const result = await Promise.race([
        this.dispatcher.dispatchToProvider(providerId, message, conversationId),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new EngineError(`timeout after ${timeoutMs}ms`)), timeoutMs),
        ),
      ])

      const latencyMs = Date.now() - start
      await this.store.createMuxResponse({
        id: newId(),
        muxSessionId: sessionId,
        providerId,
        accountId: null,
        ok: result.ok ? 1 : 0,
        response: result.response,
        latencyMs,
        costCents: result.costCents,
        error: result.error ?? null,
        ts: Date.now(),
      })

      return { ...result, providerId, latencyMs }
    } catch (err: unknown) {
      const latencyMs = Date.now() - start
      const errorMsg = err instanceof Error ? err.message : String(err)
      await this.store.createMuxResponse({
        id: newId(),
        muxSessionId: sessionId,
        providerId,
        accountId: null,
        ok: 0,
        response: '',
        latencyMs,
        costCents: 0,
        error: errorMsg,
        ts: Date.now(),
      })
      return { providerId, ok: false, response: '', latencyMs, costCents: 0, error: errorMsg }
    }
  }

  private async createSession(
    message: string,
    conversationId: string | null,
    strategy: string,
  ): Promise<string> {
    const id = newId()
    await this.store.createMuxSession({
      id,
      message,
      conversationId,
      strategy,
      status: 'in_progress',
      synthesizedResponse: null,
      bestProviderId: null,
      totalCostCents: 0,
      totalLatencyMs: 0,
      startedAt: Date.now(),
      completedAt: null,
    })
    return id
  }

  private async buildResponse(
    sessionId: string,
    _providerIds: string[],
    results: MuxDispatchResult[],
    strategy: MuxStrategy,
    synthesisEnabled: boolean,
  ): Promise<MuxResponse> {
    const providerResponses = results

    const totalCostCents = providerResponses.reduce((s, r) => s + r.costCents, 0)
    const totalLatencyMs = providerResponses.reduce((s, r) => s + r.latencyMs, 0)

    let synthesizedResponse: string | null = null
    if (synthesisEnabled && providerResponses.length > 0) {
      const okResponses = providerResponses.filter((r) => r.ok)
      if (okResponses.length > 0) {
        synthesizedResponse = await this.synthesize(
          okResponses.map((r) => ({ providerId: r.providerId, response: r.response })),
        )
      }
    }

    const best =
      providerResponses.filter((r) => r.ok).sort((a, b) => a.latencyMs - b.latencyMs)[0] ?? null

    await this.store.updateMuxSession(sessionId, {
      status: synthesizedResponse !== null ? 'completed' : 'partial',
      synthesizedResponse,
      bestProviderId: best?.providerId ?? null,
      totalCostCents,
      totalLatencyMs,
      completedAt: Date.now(),
    })

    return {
      muxSessionId: sessionId,
      providerResponses: providerResponses.map((r) => ({
        providerId: r.providerId,
        accountId: null,
        ok: r.ok,
        response: r.response,
        latencyMs: r.latencyMs,
        costCents: r.costCents,
        error: r.error,
      })),
      synthesizedResponse,
      bestProviderId: best?.providerId ?? null,
      totalCostCents,
      totalLatencyMs,
      strategyUsed: strategy,
    }
  }
}

interface MuxDispatchResult {
  providerId: string
  accountId?: string | null
  ok: boolean
  response: string
  latencyMs: number
  costCents: number
  error?: string
}
