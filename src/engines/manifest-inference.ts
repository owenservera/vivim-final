// src/engines/manifest-inference.ts
// ManifestInferenceEngine — Phase 22.6: Enhanced with per-field confidence scoring

import { EngineError } from '../errors.js'
import type {
  DiscoverySession,
  ManifestEdits,
  ProviderManifestDraft,
} from './provider-discovery.js'

export interface ProviderManifest {
  slug: string
  displayName: string
  description: string
  version: string
  baseUrl: string
  shapeId: string
  capabilities: string[]
  endpoints: { type: string; path: string; method?: string }[]
  parser: {
    format: string
    archetype: string
    fallbackStrategy: string
  }
  discovery?: {
    urlPatterns: string[]
    domIndicators: { selector: string; text?: string }[]
    interactiveElements: { selector: string; action: string; priority: number }[]
  }
}

export interface InferredManifest {
  manifest: ProviderManifest
  confidence: number
  fieldConfidence: Record<string, number>
  needsReview: string[]
  llmInferred: string[]
  warnings: string[]
  requiredEdits: string[]
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export class ManifestInferenceEngine {
  async infer(session: DiscoverySession): Promise<InferredManifest> {
    const warnings: string[] = []
    const requiredEdits: string[] = []
    const fieldConfidence: Record<string, number> = {}
    const llmInferred: string[] = []
    const needsReview: string[] = []

    if (!session.manifestDraft) {
      throw new EngineError(`No manifest draft for session ${session.id}`)
    }

    const draft = session.manifestDraft
    const manifest = this.draftToManifest(draft, session)

    const baseConfidence = session.confidence

    // Slug: high confidence if from URL
    fieldConfidence.slug = baseConfidence > 0.7 ? 0.9 : 0.5

    // DisplayName: from shape name (medium) or LLM (high)
    fieldConfidence.displayName = session.shapeId ? 0.7 : 0.4
    if (!session.shapeId) llmInferred.push('displayName')

    // Capabilities: from DOM evidence
    fieldConfidence.capabilities = baseConfidence

    // Parser format: from network observation
    fieldConfidence.parserFormat = session.parserFormat ? 0.8 : 0.3

    // Identify fields needing review
    for (const [field, conf] of Object.entries(fieldConfidence)) {
      if (conf < 0.7) needsReview.push(field)
    }

    if (manifest.slug === 'unknown') {
      requiredEdits.push('slug')
      warnings.push('Provider slug could not be inferred; manual edit required')
    }

    if (manifest.capabilities.length === 0) {
      warnings.push('No capabilities detected; review DOM indicators')
    }

    if (session.confidence < 0.6) {
      warnings.push(
        `Low shape detection confidence (${(session.confidence * 100).toFixed(0)}%); verify shape classification`,
      )
    }

    const generatedWarnings = this.generateWarnings(session, fieldConfidence)
    warnings.push(...generatedWarnings)

    return {
      manifest,
      confidence: session.confidence,
      fieldConfidence,
      needsReview,
      llmInferred,
      warnings: [...new Set(warnings)],
      requiredEdits,
    }
  }

  async applyEdits(manifest: ProviderManifest, edits: ManifestEdits): Promise<ProviderManifest> {
    const result = { ...manifest }

    if (edits.slug) result.slug = edits.slug
    if (edits.displayName) result.displayName = edits.displayName
    if (edits.description) result.description = edits.description
    if (edits.capabilities) result.capabilities = [...edits.capabilities]
    if (edits.endpoints) result.endpoints = edits.endpoints.map((e) => ({ ...e }))

    return result
  }

  async validate(manifest: ProviderManifest): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []

    if (!manifest.slug || manifest.slug.length < 2) {
      errors.push('slug is required and must be at least 2 characters')
    }
    if (!/^[a-z0-9-]+$/.test(manifest.slug)) {
      errors.push('slug must contain only lowercase alphanumeric characters and hyphens')
    }
    if (!manifest.displayName || manifest.displayName.length < 1) {
      errors.push('displayName is required')
    }
    if (!manifest.baseUrl) {
      errors.push('baseUrl is required')
    }
    try {
      new URL(manifest.baseUrl)
    } catch {
      errors.push('baseUrl must be a valid URL')
    }
    if (manifest.capabilities.length === 0) {
      warnings.push('No capabilities defined')
    }
    if (manifest.endpoints.length === 0) {
      warnings.push('No endpoints defined')
    }
    if (!manifest.parser?.format) {
      errors.push('parser.format is required')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  private generateWarnings(
    session: DiscoverySession,
    _fieldConfidence: Record<string, number>,
  ): string[] {
    const warnings: string[] = []
    if (session.confidence < 0.5) {
      warnings.push('Low overall discovery confidence — verify all fields')
    }
    if (!session.manifestDraft?.capabilities.length) {
      warnings.push('No capabilities detected — manual review required')
    }
    return warnings
  }

  private draftToManifest(
    draft: ProviderManifestDraft,
    _session: DiscoverySession,
  ): ProviderManifest {
    return {
      slug: draft.slug,
      displayName: draft.displayName,
      description: draft.description,
      version: '1.0.0',
      baseUrl: draft.baseUrl,
      shapeId: draft.shapeId,
      capabilities: draft.capabilities,
      endpoints: draft.endpoints,
      parser: {
        format: draft.parserFormat,
        archetype: 'generic',
        fallbackStrategy: 'raw',
      },
      discovery: {
        urlPatterns: [],
        domIndicators: [],
        interactiveElements: [],
      },
    }
  }
}
