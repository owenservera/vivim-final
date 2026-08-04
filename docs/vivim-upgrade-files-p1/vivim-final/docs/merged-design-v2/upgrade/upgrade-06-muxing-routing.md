# 06 — Muxing & Routing: Multi-Provider Multiplexer, Round-Robin, Failover

> **Status:** PROPOSED | **Date:** 2026-07-11
> **Objective:** 2 (The Invisible Router)

---

## Current State Analysis

The existing `Router` class (`src/router/router.ts`, 207 lines) provides:
- Priority-based dispatch through `RouteSpec` → `RouteTarget` → `RouteRequest` → `RouteEvent`
- Sequential fallback: try target 1, if fail try target 2, etc.
- Event recording: matched, dispatched, succeeded, failed

**Limitations:**
1. Single-provider-at-a-time — no parallel fan-out
2. No response synthesis (can't merge answers from multiple providers)
3. No automatic failover detection (waits for explicit failure)
4. No cost tracking or optimization
5. No learned routing preferences
6. `listRequests` and `getEvents` are stubs returning `[]`

---

## Upgrade Design

### ProviderMuxEngine

The `ProviderMuxEngine` wraps the existing `Router` and adds multi-provider intelligence on top. The `Router` remains the low-level dispatch mechanism; the MuxEngine is the high-level routing brain.

```typescript
// Full execution flow for mux():

async mux(request: MuxRequest): Promise<MuxResponse> {
  // 1. Determine target providers
  const targets = request.targetProviderIds
    ?? await this.autoSelectProviders(request.message, request.capabilityId)

  if (targets.length === 0) {
    throw new EngineError('No providers available for routing')
  }

  // 2. Create session record
  const sessionId = newId()
  await this.store.createMuxSession({
    id: sessionId,
    message: request.message,
    conversationId: request.conversationId ?? null,
    strategy: request.strategy,
    status: 'dispatching',
    synthesizedResponse: null,
    bestProviderId: null,
    totalCostCents: 0,
    totalLatencyMs: 0,
    startedAt: Date.now(),
    completedAt: null,
  })

  // 3. Dispatch based on strategy
  let responses: MuxResponseRow[] = []
  switch (request.strategy) {
    case 'fan_out':
      responses = await this.fanOutImpl(sessionId, request, targets)
      break
    case 'round_robin':
      responses = await this.roundRobinImpl(sessionId, request, targets)
      break
    case 'priority':
      responses = await this.priorityImpl(sessionId, request, targets)
      break
    case 'cost_optimized':
      responses = await this.costOptimizedImpl(sessionId, request, targets)
      break
    case 'learned':
      targets = await this.reorderLearned(targets, request.capabilityId)
      responses = await this.priorityImpl(sessionId, request, targets)
      break
  }

  // 4. Synthesize if enabled
  let synthesized = null
  let bestProviderId = null
  if (request.synthesisEnabled && responses.filter(r => r.ok).length > 1) {
    synthesized = await this.synthesize(
      responses.filter(r => r.ok).map(r => ({ providerId: r.providerId, response: r.response }))
    )
  }

  // 5. Pick best response (if no synthesis)
  if (!synthesized) {
    const successful = responses.filter(r => r.ok)
    if (successful.length > 0) {
      bestProviderId = this.pickBest(successful)
    }
  }

  // 6. Update session
  const totalCost = responses.reduce((s, r) => s + r.costCents, 0)
  const maxLatency = Math.max(...responses.map(r => r.latencyMs))
  await this.store.updateMuxSession(sessionId, {
    status: 'complete',
    synthesizedResponse: synthesized,
    bestProviderId,
    totalCostCents: totalCost,
    totalLatencyMs: maxLatency,
    completedAt: Date.now(),
  })

  // 7. Learn from outcome
  if (bestProviderId) {
    await this.recordOutcome(sessionId, bestProviderId)
  }

  // 8. Emit event
  this.eventBus.emit({
    type: 'mux:complete',
    muxSessionId: sessionId,
    providerCount: responses.length,
    bestProviderId,
    totalCostCents: totalCost,
  } as never)

  return {
    muxSessionId: sessionId,
    providerResponses: responses.map(r => ({
      providerId: r.providerId,
      accountId: r.accountId,
      ok: r.ok === 1,
      response: r.response,
      latencyMs: r.latencyMs,
      costCents: r.costCents,
      error: r.error ?? undefined,
    })),
    synthesizedResponse: synthesized,
    bestProviderId,
    totalCostCents: totalCost,
    totalLatencyMs: maxLatency,
    strategyUsed: request.strategy,
  }
}
```

### Strategy Implementations

#### Fan-Out (Parallel Dispatch)

```typescript
private async fanOutImpl(
  sessionId: string,
  request: MuxRequest,
  targets: string[],
): Promise<MuxResponseRow[]> {
  const promises = targets.map(providerId =>
    this.dispatchWithTimeout(
      sessionId,
      providerId,
      request.message,
      request.conversationId,
      request.timeoutMs,
      request.costBudgetCents,
    ).catch(err => ({
      providerId,
      ok: false,
      response: '',
      latencyMs: 0,
      costCents: 0,
      error: err instanceof Error ? err.message : String(err),
    }))
  )

  const results = await Promise.allSettled(promises)
  const rows: MuxResponseRow[] = []

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    const providerId = targets[i]!
    const value = result.status === 'fulfilled' ? result.value : {
      providerId,
      ok: false,
      response: '',
      latencyMs: 0,
      costCents: 0,
      error: result.reason instanceof Error ? result.reason.message : String(result.reason),
    }

    const row = await this.store.createMuxResponse({
      id: newId(),
      muxSessionId: sessionId,
      providerId,
      accountId: null,
      ok: value.ok ? 1 : 0,
      response: value.response,
      latencyMs: value.latencyMs,
      costCents: value.costCents,
      error: value.error ?? null,
      ts: Date.now(),
    })
    rows.push(row)
  }

  return rows
}
```

#### Round-Robin Deep Research

```typescript
private async roundRobinImpl(
  sessionId: string,
  request: MuxRequest,
  targets: string[],
): Promise<MuxResponseRow[]> {
  const rows: MuxResponseRow[] = []

  // Round 1: Send same message to all providers sequentially
  for (const providerId of targets) {
    const result = await this.dispatchWithTimeout(
      sessionId, providerId, request.message,
      request.conversationId, request.timeoutMs, request.costBudgetCents,
    ).catch(err => ({
      providerId, ok: false, response: '', latencyMs: 0, costCents: 0,
      error: err instanceof Error ? err.message : String(err),
    }))

    const row = await this.store.createMuxResponse({
      id: newId(), muxSessionId: sessionId, providerId,
      accountId: null, ok: result.ok ? 1 : 0, response: result.response,
      latencyMs: result.latencyMs, costCents: result.costCents,
      error: result.error ?? null, ts: Date.now(),
    })
    rows.push(row)
  }

  // Round 2 (optional): Ask each provider to refine based on others' answers
  if (rows.filter(r => r.ok).length >= 2) {
    const combined = rows.filter(r => r.ok).map(r => `${r.providerId}: ${r.response}`).join('\n\n')
    const refinementPrompt = `Other AI assistants provided these answers:\n\n${combined}\n\nProvide a refined, comprehensive answer that incorporates the best insights:`

    for (const providerId of targets.slice(0, 1)) {
      // Only ask the "best" provider to refine
      const result = await this.dispatchWithTimeout(
        sessionId, providerId, refinementPrompt,
        request.conversationId, request.timeoutMs, request.costBudgetCents,
      ).catch(() => null)

      if (result?.ok) {
        await this.store.createMuxResponse({
          id: newId(), muxSessionId: sessionId, providerId: `${providerId}_refined`,
          accountId: null, ok: 1, response: result.response,
          latencyMs: result.latencyMs, costCents: result.costCents,
          error: null, ts: Date.now(),
        })
      }
    }
  }

  return rows
}
```

#### Cost-Optimized

```typescript
private async costOptimizedImpl(
  sessionId: string,
  request: MuxRequest,
  targets: string[],
): Promise<MuxResponseRow[]> {
  // Sort providers by estimated cost (cheapest first)
  const priced = await Promise.all(
    targets.map(async providerId => ({
      providerId,
      estimatedCostCents: await this.estimateCost(providerId, request.message),
    }))
  )
  priced.sort((a, b) => a.estimatedCostCents - b.estimatedCostCents)

  // Try cheapest first, stop on success within budget
  let remainingBudget = request.costBudgetCents ?? Number.MAX_SAFE_INTEGER
  const rows: MuxResponseRow[] = []

  for (const { providerId } of priced) {
    if (remainingBudget <= 0) break

    const result = await this.dispatchWithTimeout(
      sessionId, providerId, request.message,
      request.conversationId, request.timeoutMs, remainingBudget,
    ).catch(err => ({
      providerId, ok: false, response: '', latencyMs: 0, costCents: 0,
      error: err instanceof Error ? err.message : String(err),
    }))

    const row = await this.store.createMuxResponse({
      id: newId(), muxSessionId: sessionId, providerId,
      accountId: null, ok: result.ok ? 1 : 0, response: result.response,
      latencyMs: result.latencyMs, costCents: result.costCents,
      error: result.error ?? null, ts: Date.now(),
    })
    rows.push(row)
    remainingBudget -= result.costCents

    if (result.ok) break // Success — stop trying more expensive providers
  }

  return rows
}
```

### Response Synthesis

```typescript
async synthesize(
  responses: Array<{ providerId: string; response: string }>,
): Promise<string> {
  if (responses.length === 0) return ''
  if (responses.length === 1) return responses[0]!.response

  // For synthesis, use the cheapest available provider
  const synthesisPrompt = `Multiple AI assistants provided these answers to the same question.
Synthesize the best parts into a single comprehensive answer.

${responses.map(r => `### ${r.providerId}\n${r.response}`).join('\n\n---\n\n')}

### Synthesized Answer:`

  // Try local model first (free), then cheapest cloud provider
  try {
    if (airGapEngine.getStatus().localModelAvailable) {
      const result = await airGapEngine.routeToLocalModel(synthesisPrompt)
      if (result.ok) return result.response
    }
  } catch {
    // Fall through to cloud
  }

  // Use cheapest provider for synthesis
  const cheapest = await this.getCheapestProvider()
  if (cheapest) {
    const result = await this.dispatcher.dispatchToProvider(
      cheapest, synthesisPrompt, undefined,
    )
    if (result.ok) return result.response
  }

  // Fallback: return best individual response
  return this.pickBestResponse(responses)
}
```

### Learned Routing

```typescript
async recordOutcome(muxSessionId: string, bestProviderId: string): Promise<void> {
  const session = await this.store.getMuxSession(muxSessionId)
  if (!session) return

  const responses = await this.store.getMuxResponses(muxSessionId)
  const successful = responses.filter(r => r.ok === 1)

  for (const resp of successful) {
    const isBest = resp.providerId === bestProviderId
    const existing = await this.store.getRoutingPreferences()
      .then(prefs => prefs.find(p => p.providerId === resp.providerId))

    if (existing) {
      const newScore = existing.score + (isBest ? 0.1 : -0.05)
      await this.store.updateRoutingPreference(existing.id, {
        score: Math.max(0, Math.min(1, newScore)),
        sampleCount: existing.sampleCount + 1,
        updatedAt: Date.now(),
      })
    } else {
      await this.store.createRoutingPreference({
        id: newId(),
        capabilityId: session.capabilityId ?? 'general',
        providerId: resp.providerId,
        score: isBest ? 0.6 : 0.4,
        sampleCount: 1,
        updatedAt: Date.now(),
      })
    }
  }
}

async getRoutingScore(capabilityId: string, providerId: string): Promise<number> {
  const prefs = await this.store.getRoutingPreferences(capabilityId)
  const pref = prefs.find(p => p.providerId === providerId)
  return pref?.score ?? 0.5 // Default: neutral
}

private async reorderLearned(
  targets: string[],
  capabilityId?: string,
): Promise<string[]> {
  if (!capabilityId) return targets

  const scored = await Promise.all(
    targets.map(async providerId => ({
      providerId,
      score: await this.getRoutingScore(capabilityId, providerId),
    }))
  )

  return scored
    .sort((a, b) => b.score - a.score)
    .map(s => s.providerId)
}
```

### Cost Estimation

```typescript
private async estimateCost(providerId: string, message: string): Promise<number> {
  // Get provider model pricing
  const model = await this.getProviderModel(providerId)
  if (!model) return 1 // Default: 1 cent

  const inputTokens = Math.ceil(message.length / 4) // Rough estimate
  const outputTokens = model.maxOutputTokens ?? 1000

  const inputCost = (inputTokens / 1_000_000) * (model.pricingInputPer1m ?? 0)
  const outputCost = (outputTokens / 1_000_000) * (model.pricingOutputPer1m ?? 0)

  return Math.ceil((inputCost + outputCost) * 100) // Convert to cents
}
```

### Automatic Failover

The fan-out strategy inherently provides failover (if one provider fails, others succeed). For sequential strategies, failover is built into the loop:

```typescript
private async dispatchWithTimeout(
  sessionId: string,
  providerId: string,
  message: string,
  conversationId?: string,
  timeoutMs = 30_000,
  budgetCents?: number,
): Promise<{
  providerId: string
  ok: boolean
  response: string
  latencyMs: number
  costCents: number
  error?: string
}> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const result = await this.dispatcher.dispatchToProvider(
      providerId, message, conversationId,
    )
    clearTimeout(timeout)
    return {
      providerId,
      ok: result.ok,
      response: result.response,
      latencyMs: result.latencyMs,
      costCents: result.costCents,
      error: result.error,
    }
  } catch (err) {
    clearTimeout(timeout)
    return {
      providerId,
      ok: false,
      response: '',
      latencyMs: timeoutMs,
      costCents: 0,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
```

---

## Integration with Existing Router

The `ProviderMuxEngine` uses `Router` for actual dispatch but adds intelligence on top:

```typescript
// MuxDispatcher implements the dispatch interface using Router
class RouterMuxDispatcher implements MuxDispatcher {
  constructor(private router: Router) {}

  async dispatchToProvider(
    providerId: string,
    message: string,
    conversationId?: string,
  ): Promise<{ ok: boolean; response: string; latencyMs: number; costCents: number; error?: string }> {
    const result = await this.router.route({
      capabilityId: 'send_message',
      providerId,
      conversationId,
      payload: message,
    })

    return {
      ok: result.ok,
      response: result.ok ? 'routed' : '',
      latencyMs: 0,
      costCents: 0,
      error: result.error,
    }
  }
}
```

---

## Server API Endpoints

| Method | Path | Body | Purpose |
|--------|------|------|---------|
| POST | `/api/route/auto` | `{ message, conversationId? }` | Auto-route to best provider |
| POST | `/api/route/mux` | `{ message, strategy, targetProviderIds? }` | Multi-provider mux |
| POST | `/api/route/fanout` | `{ message, providerIds }` | Fan-out to specific providers |
| GET | `/api/route/cost-report` | `?from=&to=` | Cost report per provider |
| GET | `/api/route/preferences` | — | List learned routing preferences |
| PUT | `/api/route/preferences/:id` | `{ score }` | Manually adjust preference |

---

## CLI Commands

```bash
vivim route auto "How do I center a div in CSS?"
vivim route mux "Explain quantum computing" --strategy fan_out --providers claude,chatgpt,gemini
vivim route cost-report --month 2026-07
vivim route preferences list
vivim route preferences set claude score=0.9
```
