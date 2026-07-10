// src/engines/manifest-inference.ts
// ManifestInferenceEngine — transform discovery results → valid ProviderManifest JSON

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

    if (!session.manifestDraft) {
      throw new Error(`No manifest draft for session ${session.id}`)
    }

    const draft = session.manifestDraft
    const manifest = this.draftToManifest(draft, session)

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

    return {
      manifest,
      confidence: session.confidence,
      warnings,
      requiredEdits,
    }
  }

  async applyEdits(manifest: ProviderManifest, edits: ManifestEdits): Promise<ProviderManifest> {
    const result = { ...manifest }

    if (edits.slug) result.slug = edits.slug
    if (edits.displayName) result.displayName = edits.displayName
    if (edits.description) result.description = edits.description
    if (edits.capabilities) result.capabilities = [...edits.capabilities]

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

  private draftToManifest(
    draft: ProviderManifestDraft,
    session: DiscoverySession,
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
        archetype: session.shape?.parserExpectations.parserArchetype ?? 'generic',
        fallbackStrategy: session.shape?.parserExpectations.fallbackStrategy ?? 'raw',
      },
      discovery: {
        urlPatterns: session.shape?.discoveryHints.urlPatterns ?? [],
        domIndicators: session.shape?.discoveryHints.domIndicators ?? [],
        interactiveElements: session.shape?.discoveryHints.interactiveElementPatterns ?? [],
      },
    }
  }
}
