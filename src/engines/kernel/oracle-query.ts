// src/engines/kernel/oracle-query.ts
// OracleQueryEngine — the oracle's "brain". Structured queries about system state.
// Takes a question about the system and returns an answer with confidence + suggestions.

import type { KernelRegistry } from './kernel-registry.js'
import type { KernelTracer } from './kernel-tracer.js'
import type { KernelProvenance, ProvenanceChain } from './kernel-provenance.js'
import type { ConfigManager } from '../config-manager.js'
import type {
  EngineDescriptor,
  HealthState,
  CapabilityDescriptor,
} from '../../storage/contracts/kernel-store.js'
import type { DiagnosticIssue } from './oracle-diagnostic.js'

export type SystemQueryType =
  | 'topology'
  | 'health'
  | 'trace'
  | 'provenance'
  | 'config'
  | 'capability'
  | 'all'

export interface SystemQuery {
  type: SystemQueryType
  filter?: Record<string, unknown>
  limit?: number
}

export interface QueryResult {
  query: SystemQuery
  answer: unknown
  confidence: number
  suggestions: string[]
  timestamp: number
}

export interface TopologyDescription {
  totalEngines: number
  totalStores: number
  totalCapabilities: number
  layers: Record<string, { engines: string[]; status: string }>
  dependencyGraph: Record<string, string[]>
  healthSummary: { healthy: number; degraded: number; unhealthy: number; unknown: number }
}

export interface HealthSnapshot {
  aggregateScore: number
  engines: Array<{ id: string; status: string; score?: number; lastCheck: number }>
  issues: DiagnosticIssue[]
  timestamp: number
}

export interface Explanation {
  target: string
  description: string
  causalChain: ProvenanceChain
  relatedTraces: string[]
  suggestions: string[]
}

export interface CapabilitySummary {
  total: number
  byLayer: Record<string, number>
  capabilities: Array<{ id: string; layer?: string; status: string; surfaces?: string[] }>
}

export class OracleQueryEngine {
  constructor(
    private readonly registry: KernelRegistry,
    private readonly tracer: KernelTracer,
    private readonly provenance: KernelProvenance,
    private readonly config: ConfigManager,
  ) {}

  async query(q: SystemQuery): Promise<QueryResult> {
    const base = { query: q, timestamp: Date.now() }
    switch (q.type) {
      case 'topology': {
        const answer = await this.describe()
        return { ...base, answer, confidence: 1.0, suggestions: [] }
      }
      case 'health': {
        const answer = await this.health()
        return { ...base, answer, confidence: 0.95, suggestions: [] }
      }
      case 'trace': {
        const traceId = String(q.filter?.traceId ?? '')
        const answer = this.tracer.getTrace(traceId)
        return {
          ...base,
          answer,
          confidence: 1.0,
          suggestions: answer.length === 0 ? ['No spans found for this traceId'] : [],
        }
      }
      case 'provenance': {
        const traceId = String(q.filter?.traceId ?? '')
        const answer = this.provenance.getChain(traceId)
        return {
          ...base,
          answer,
          confidence: 1.0,
          suggestions: answer.nodes.length === 0 ? ['No causal nodes for this traceId'] : [],
        }
      }
      case 'config': {
        const engineId = String(q.filter?.engineId ?? '')
        const answer = this.readConfig(engineId)
        return {
          ...base,
          answer,
          confidence: 1.0,
          suggestions: answer ? [] : [`No config for engine ${engineId}`],
        }
      }
      case 'capability': {
        const answer = await this.capabilitySummary()
        return { ...base, answer, confidence: 0.9, suggestions: [] }
      }
      case 'all': {
        const answer = {
          topology: await this.describe(),
          health: await this.health(),
          capabilities: await this.capabilitySummary(),
        }
        return { ...base, answer, confidence: 0.9, suggestions: [] }
      }
      default:
        return { ...base, answer: null, confidence: 0.0, suggestions: ['Unknown query type'] }
    }
  }

  async describe(): Promise<TopologyDescription> {
    const topology = this.registry.describe()
    const layers: Record<string, { engines: string[]; status: string }> = {}
    const dependencyGraph: Record<string, string[]> = {}
    const healthSummary = { healthy: 0, degraded: 0, unhealthy: 0, unknown: 0 }

    for (const engine of topology.engines) {
      const layer = engine.layer ?? 'uncategorized'
      if (!layers[layer]) layers[layer] = { engines: [], status: 'none' }
      layers[layer].engines.push(engine.id)
      const worst = layerStatus(layers[layer].status, engine.status)
      layers[layer].status = worst
      dependencyGraph[engine.id] = engine.dependencies
      const status = engine.health?.status ?? 'unknown'
      if (status === 'healthy') healthSummary.healthy++
      else if (status === 'degraded') healthSummary.degraded++
      else if (status === 'unhealthy') healthSummary.unhealthy++
      else healthSummary.unknown++
    }

    return {
      totalEngines: topology.engines.length,
      totalStores: topology.stores.length,
      totalCapabilities: topology.capabilities.length,
      layers,
      dependencyGraph,
      healthSummary,
    }
  }

  async health(): Promise<HealthSnapshot> {
    const engines = this.registry.listEngines()
    const snapshotEngines: HealthSnapshot['engines'] = []
    const issues: DiagnosticIssue[] = []
    let scoreSum = 0
    let scoreCount = 0

    for (const engine of engines) {
      const health: HealthState = engine.health ?? {
        status: 'unknown',
        lastCheck: engine.updatedAt,
      }
      snapshotEngines.push({
        id: engine.id,
        status: health.status,
        score: health.score,
        lastCheck: health.lastCheck,
      })
      if (typeof health.score === 'number') {
        scoreSum += health.score
        scoreCount++
      }
      if (health.status === 'unhealthy') {
        issues.push({
          id: `health:${engine.id}:unhealthy`,
          severity: 'critical',
          category: 'health-degraded',
          engineId: engine.id,
          description: `Engine ${engine.id} is unhealthy`,
          evidence: [JSON.stringify(health.details ?? {})],
          suggestedFix: 'Investigate engine logs and restart if stalled',
          autoFixable: true,
          detectedAt: Date.now(),
        })
      } else if (health.status === 'degraded') {
        issues.push({
          id: `health:${engine.id}:degraded`,
          severity: 'warning',
          category: 'health-degraded',
          engineId: engine.id,
          description: `Engine ${engine.id} is degraded`,
          evidence: [JSON.stringify(health.details ?? {})],
          suggestedFix: 'Reset circuit breaker or reconfigure engine',
          autoFixable: true,
          detectedAt: Date.now(),
        })
      }
    }

    return {
      aggregateScore: scoreCount === 0 ? 0 : Math.round(scoreSum / scoreCount),
      engines: snapshotEngines,
      issues,
      timestamp: Date.now(),
    }
  }

  async explain(target: string): Promise<Explanation> {
    const chain: ProvenanceChain = this.provenance.getChain(target)
    const relatedTraces = [...new Set(chain.nodes.map((n) => n.traceId))]
    const suggestions = this.generateSuggestions(chain)
    const description = this.describeChain(chain)
    return { target, description, causalChain: chain, relatedTraces, suggestions }
  }

  async capabilitySummary(): Promise<CapabilitySummary> {
    const capabilities: CapabilityDescriptor[] = this.registry.describe().capabilities
    const byLayer: Record<string, number> = {}
    const list: CapabilitySummary['capabilities'] = []
    for (const cap of capabilities) {
      const layer = cap.layer ?? 'uncategorized'
      byLayer[layer] = (byLayer[layer] ?? 0) + 1
      list.push({
        id: cap.id,
        layer: cap.layer,
        status: cap.status,
        surfaces: (cap.metadata?.surfaces as string[] | undefined),
      })
    }
    return { total: capabilities.length, byLayer, capabilities: list }
  }

  private readConfig(engineId: string): Record<string, unknown> | null {
    const desc = this.registry.getEngine(engineId)
    if (desc) return desc.config
    try {
      return this.config.getConfig(engineId)
    } catch {
      return null
    }
  }

  private generateSuggestions(chain: ProvenanceChain): string[] {
    const suggestions: string[] = []
    const errorNode = chain.nodes.find((n) => n.kind === 'error')
    if (errorNode) {
      suggestions.push(`Error originated in ${errorNode.engineId}: ${errorNode.description}`)
      suggestions.push('Use oracle heal to restart or reconfigure the failing engine')
    }
    if (chain.totalDuration && chain.totalDuration > 10_000) {
      suggestions.push('Causal chain exceeded 10s — investigate slow selector/parser stage')
    }
    if (chain.nodes.length === 0) {
      suggestions.push('No causal nodes recorded — enable provenance capture for this path')
    }
    return suggestions
  }

  private describeChain(chain: ProvenanceChain): string {
    if (chain.nodes.length === 0) return `No provenance recorded for ${chain.traceId}`
    const steps = chain.nodes.map((n) => `${n.kind}@${n.engineId}: ${n.description}`).join(' → ')
    return `Chain (${chain.nodes.length} nodes, ${chain.totalDuration ?? 0}ms): ${steps}`
  }
}

function layerStatus(current: string, engineStatus: EngineDescriptor['status']): string {
  const rank: Record<string, number> = { error: 4, stopped: 3, registered: 2, wired: 1, running: 0, none: 0 }
  return rank[engineStatus] > (rank[current] ?? 0) ? engineStatus : current
}
