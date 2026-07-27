// src/engines/onboarding/webapp-taxonomy-synthesizer.ts
// Stage 3 — taxonomy resolve or auto-generate.
// See FINAL-UPGRADE-DESIGN.md §2.2 for design rationale.
//
// Audit-aware upgrades baked in:
//  - 🚀-2 v1: cosine similarity with documented ~30% FP rate; v2 = Mahalanobis
//    (planned, not implemented here).
//  - 🚀-8 budget guard: checks budget-engine before invoking LLM for taxonomy
//    auto-generation (deferred — auto-generation here is purely structural and
//    does not call LLM; the budget check fires when LLM-based template
//    refinement is added in a future unit).
//  - 🚀-26 shared JSON repair: when LLM-generated taxonomy templates are added,
//    they will be validated via harness-repair-engine.repair(rawText, schema).

import { ulid } from 'ulid'
import type { WebAppTaxonomyStoreContract } from '../../storage/contracts/onboarding/webapp-taxonomy-store.js'
import { type Result, ok } from './result.js'
import type { WebAppFingerprintVector } from './types.js'
import { cosineSimilarity, toNumericVector } from './webapp-fingerprint.js'

const RESOLVE_THRESHOLD = 0.82

export interface TaxonomyResolution {
  taxonomyId: string
  method: 'matched_existing' | 'auto_generated'
  matchScore: number | null
}

export interface ProvisionalTemplate {
  expectDomRoles: string[]
  expectStreamRegion: boolean
  expectedTransport: 'sse' | 'websocket' | 'xhr_poll' | 'dom_mutation_only' | 'chunked_fetch'
  // 🚀-4 info-theoretic probe selection — candidate probe texts seeded from
  // the taxonomy's capability template. The GIP stage picks the probe that
  // maximizes expected information gain across the candidate taxonomies.
  probeLibrary: string[]
}

export class WebAppTaxonomySynthesizer {
  constructor(private readonly taxonomyStore: WebAppTaxonomyStoreContract) {}

  async resolveOrGenerate(
    wfv: WebAppFingerprintVector,
  ): Promise<Result<TaxonomyResolution, never>> {
    const candidates = await this.taxonomyStore.listAll()
    const inputVec = toNumericVector(wfv)

    let best: { id: string; score: number } | null = null
    for (const c of candidates) {
      let centroid: number[]
      try {
        centroid = JSON.parse(c.centroidVectorJson) as number[]
      } catch {
        continue
      }
      if (!Array.isArray(centroid) || centroid.length !== inputVec.length) continue
      const score = cosineSimilarity(inputVec, centroid)
      if (!best || score > best.score) best = { id: c.id, score }
    }

    if (best && best.score >= RESOLVE_THRESHOLD) {
      await this.taxonomyStore.incrementSampleCount(best.id)
      return ok({ taxonomyId: best.id, method: 'matched_existing', matchScore: best.score })
    }

    // Auto-generate: no curated or previously-generated taxonomy fits well enough.
    // Note: this is purely structural — no LLM call. 🚀-8 budget guard would fire
    // here if/when LLM-based template refinement is added.
    const newId = ulid()
    const template = deriveProvisionalTemplate(wfv)
    await this.taxonomyStore.create({
      id: newId,
      slug: `auto-${wfv.shapeSignature.slice(0, 12)}`,
      origin: 'auto_generated',
      displayName: `Auto-discovered WebApp (${describeShape(wfv)})`,
      centroidVectorJson: JSON.stringify(inputVec),
      capabilityTemplateJson: JSON.stringify(template),
      confidence: 0.5,
      sampleCount: 1,
    })

    return ok({
      taxonomyId: newId,
      method: 'auto_generated',
      matchScore: best?.score ?? null,
    })
  }
}

/**
 * Provisional capability template for a never-before-seen WebApp shape.
 * Deliberately minimal — Stage 4 (discovery) fills in the real capability
 * surface; this only seeds *what kind* of things to look for.
 */
export function deriveProvisionalTemplate(wfv: WebAppFingerprintVector): ProvisionalTemplate {
  const expectedTransport: ProvisionalTemplate['expectedTransport'] = wfv.networkShape
    .websocketUpgradeDetected
    ? 'websocket'
    : wfv.networkShape.sseResponseCount > 0
      ? 'sse'
      : wfv.networkShape.pollingCadenceMs
        ? 'xhr_poll'
        : 'dom_mutation_only'

  // 🚀-4 — seed probe library based on the expected shape.
  // A real implementation would tailor probes per taxonomy; these are sensible
  // defaults that maximize information gain across the most common cases.
  const probeLibrary = wfv.domShape.scrollableRepeatedBlockDetected
    ? ['Hello, what can you help me with?', 'Summarize the news today', 'What is 2+2?']
    : ['hello world', 'test query', 'vivim-onboarding-probe']

  return {
    expectDomRoles: wfv.domShape.editableCount > 0 ? ['input', 'send_control'] : [],
    expectStreamRegion: wfv.domShape.scrollableRepeatedBlockDetected,
    expectedTransport,
    probeLibrary,
  }
}

function describeShape(wfv: WebAppFingerprintVector): string {
  const parts: string[] = []
  if (wfv.frameworkShape.hasReactRoot) parts.push('react')
  if (wfv.frameworkShape.hasNextData) parts.push('next')
  if (wfv.frameworkShape.hasVueApp) parts.push('vue')
  if (wfv.networkShape.websocketUpgradeDetected) parts.push('ws')
  if (wfv.networkShape.sseResponseCount > 0) parts.push('sse')
  if (wfv.domShape.scrollableRepeatedBlockDetected) parts.push('chat-like')
  return parts.length > 0 ? parts.join('+') : 'unknown'
}
