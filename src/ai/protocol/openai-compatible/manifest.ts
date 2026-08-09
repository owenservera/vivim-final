/**
 * VIVIM AI Gateway — OpenAI-Compatible Manifest Schema
 * @module ai/protocol/openai-compatible/manifest
 *
 * The manifest is a JSON document (or TypeScript object for built-in providers)
 * that fully describes how to talk to one OpenAI-compatible provider.
 * It is the "plugin definition."
 */

import type {
  AICapability,
  CapabilityMap,
  ModelId,
  ProviderId,
  ProviderKind,
  ProviderTrust,
} from '../../core/types.js'

export type AuthMethod =
  | { readonly kind: 'none' }
  | { readonly kind: 'bearer'; readonly tokenEnvVar: string }
  | { readonly kind: 'custom-header'; readonly headerName: string; readonly valueEnvVar: string }
  | { readonly kind: 'basic'; readonly usernameEnvVar: string; readonly passwordEnvVar: string }

export interface ModelManifestEntry {
  readonly modelId: ModelId
  readonly displayName: string
  /** What to send in the "model" field of the OpenAI ChatCompletionRequest. */
  readonly openAIModelName: string
  readonly contextWindow: number
  readonly capabilities: readonly AICapability[]
  readonly pricing?: { readonly inputPer1M: number; readonly outputPer1M: number }
  readonly isDefault?: boolean
  readonly requestPatches?: Readonly<Record<string, unknown>>
}

export interface OpenAICompatibleManifest {
  readonly providerId: ProviderId
  readonly displayName: string
  readonly baseURL: string
  readonly auth: AuthMethod
  readonly defaultHeaders?: Readonly<Record<string, string>>
  readonly transport: 'http' | 'unix-socket'
  readonly providerKind: ProviderKind
  readonly trust: ProviderTrust
  readonly models: readonly ModelManifestEntry[]
  readonly capabilities: readonly AICapability[]
  readonly extensions?: {
    readonly supportsStreaming?: boolean
    readonly supportsFunctionCalling?: boolean
    readonly supportsVision?: boolean
    readonly supportsJsonSchema?: boolean
    readonly supportsEmbeddings?: boolean
    readonly requestPatches?: Readonly<Record<string, unknown>>
    readonly responsePatches?: Readonly<Record<string, unknown>>
  }
  readonly lifecycle?: {
    readonly supervisorKind: 'opencode-serve' | 'ollama' | 'llamacpp' | 'lm-studio' | 'none'
    readonly startCommand?: readonly string[]
    readonly readinessProbe?: { readonly path: string; readonly expectStatus: number }
    readonly port?: number
    readonly envVars?: Readonly<Record<string, string>>
  }
  readonly integrity?: {
    readonly manifestHash: string
    readonly signature?: string
    readonly certifiedAt?: string
  }
}

/**
 * Validate a manifest object. Returns the manifest on success, throws on failure.
 */
export function validateManifest(raw: unknown): OpenAICompatibleManifest {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Manifest must be an object')
  }
  const m = raw as Record<string, unknown>
  if (typeof m.providerId !== 'string') throw new Error('Manifest must have providerId: string')
  if (typeof m.displayName !== 'string') throw new Error('Manifest must have displayName: string')
  if (typeof m.baseURL !== 'string') throw new Error('Manifest must have baseURL: string')
  if (typeof m.auth !== 'object' || m.auth === null)
    throw new Error('Manifest must have auth: object')
  if (!Array.isArray(m.models)) throw new Error('Manifest must have models: array')
  if (!Array.isArray(m.capabilities)) throw new Error('Manifest must have capabilities: array')
  return m as unknown as OpenAICompatibleManifest
}

/**
 * Load a manifest from a JSON file path (at runtime).
 */
export async function loadManifestFromFile(path: string): Promise<OpenAICompatibleManifest> {
  const file = Bun.file(path)
  const text = await file.text()
  const json = JSON.parse(text)
  return validateManifest(json)
}

/**
 * Convert a model manifest entry to a CapabilityMap.
 */
export function modelEntryToCapabilityMap(entry: ModelManifestEntry): CapabilityMap {
  const map: Partial<
    Record<AICapability, { supported: true; level?: 'basic' | 'advanced' | 'strict' }>
  > = {}
  for (const cap of entry.capabilities) {
    map[cap] = { supported: true, level: 'basic' }
  }
  return map as CapabilityMap
}
