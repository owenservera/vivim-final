// src/engines/transfer-accelerator.ts
// TransferAccelerator — cross-provider pattern transfer with learning feedback

import type { EpisodicMemory, MemoryEngine } from './memory-engine.js'

// ── Types ───────────────────────────────────────────────────────────────

export interface TransferCandidate {
  id: string
  sourceProviderId: string
  targetProviderId: string
  patternType: string
  description: string
  confidence: number
  estimatedSuccessRate: number
}

export interface TransferAttemptResult {
  candidateId: string
  success: boolean
  actualSuccessRate: number
  lessonsLearned: string[]
}

export interface BatchTransferResult {
  candidatesFound: number
  attempted: number
  succeeded: number
  failed: number
  results: TransferAttemptResult[]
}

// ── Store Contracts ─────────────────────────────────────────────────────

export interface ProviderCapabilityStore {
  getProviders(): Promise<{ id: string; capabilities: string[] }[]>
  getProviderCapabilities(providerId: string): Promise<string[]>
}

// ── Engine ──────────────────────────────────────────────────────────────

let idCounter = 0
function newId(): string {
  return `xfer_${Date.now()}_${++idCounter}`
}

export class TransferAccelerator {
  constructor(
    private readonly memory: MemoryEngine,
    private readonly providerStore: ProviderCapabilityStore,
  ) {}

  async findTransferCandidates(): Promise<TransferCandidate[]> {
    const providers = await this.providerStore.getProviders()
    const candidates: TransferCandidate[] = []

    for (const source of providers) {
      const episodes = await this.memory.recallEpisodes({
        providerId: source.id,
        successOnly: true,
        limit: 100,
      })

      const actionSuccessRates = this.computeActionSuccessRates(episodes)

      for (const target of providers) {
        if (target.id === source.id) continue

        for (const [action, successRate] of actionSuccessRates) {
          if (successRate < 0.7) continue

          const targetEpisodes = await this.memory.recallEpisodes({
            providerId: target.id,
            action,
            limit: 10,
          })

          if (targetEpisodes.length > 5) continue

          candidates.push({
            id: newId(),
            sourceProviderId: source.id,
            targetProviderId: target.id,
            patternType: 'action_transfer',
            description: `Transfer successful pattern "${action}" from ${source.id} to ${target.id}`,
            confidence: successRate,
            estimatedSuccessRate: successRate * 0.8,
          })
        }
      }
    }

    return candidates
  }

  async attemptTransfer(candidateId: string): Promise<TransferAttemptResult> {
    const candidates = await this.findTransferCandidates()
    const candidate = candidates.find((c) => c.id === candidateId)

    if (!candidate) {
      return {
        candidateId,
        success: false,
        actualSuccessRate: 0,
        lessonsLearned: ['Candidate not found'],
      }
    }

    const sourceEpisodes = await this.memory.recallEpisodes({
      providerId: candidate.sourceProviderId,
      action: candidate.patternType,
      successOnly: true,
      limit: 5,
    })

    const success = sourceEpisodes.length > 0
    const actualSuccessRate = success ? candidate.estimatedSuccessRate * 0.9 : 0

    if (success) {
      await this.memory.assertFact({
        subject: `transfer:${candidate.targetProviderId}`,
        predicate: 'learned_from',
        object: {
          source: candidate.sourceProviderId,
          pattern: candidate.patternType,
        },
        confidence: actualSuccessRate,
        source: 'transfer_accelerator',
      })
    }

    return {
      candidateId,
      success,
      actualSuccessRate,
      lessonsLearned: success
        ? [`Pattern transferred successfully from ${candidate.sourceProviderId}`]
        : ['Transfer failed — target provider may need different approach'],
    }
  }

  async batchTransfer(_opts?: { shapeId?: string }): Promise<BatchTransferResult> {
    const candidates = await this.findTransferCandidates()
    const results: TransferAttemptResult[] = []

    for (const candidate of candidates) {
      const result = await this.attemptTransfer(candidate.id)
      results.push(result)
    }

    return {
      candidatesFound: candidates.length,
      attempted: results.length,
      succeeded: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    }
  }

  private computeActionSuccessRates(episodes: EpisodicMemory[]): Map<string, number> {
    const actionCounts = new Map<string, { success: number; total: number }>()

    for (const ep of episodes) {
      const existing = actionCounts.get(ep.action) ?? { success: 0, total: 0 }
      existing.success++
      existing.total++
      actionCounts.set(ep.action, existing)
    }

    const rates = new Map<string, number>()
    for (const [action, counts] of actionCounts) {
      rates.set(action, counts.success / counts.total)
    }
    return rates
  }
}
