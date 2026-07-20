// src/engines/image-gen-bridge.ts
// Unit 26.2 — Image generation bridge for canvas mutations.
// Turns a text query into an image the canvas can use as background/layer asset.
// Tries local model first (offline), falls back to provider LLM.

import { EngineError } from '../errors.js'
import { getLogger } from '../lib/logger.js'

const log = getLogger('image-gen-bridge')

export interface LocalModelAdapter {
  generateImage?: (prompt: string) => Promise<Uint8Array>
}

export interface ProviderLLMAdapterBridge {
  callTool?: (name: string, args: Record<string, unknown>) => Promise<Record<string, unknown>>
}

export interface ImageGenDeps {
  localModel?: LocalModelAdapter
  providerLLM?: ProviderLLMAdapterBridge
}

export async function generateImage(
  query: string,
  deps: ImageGenDeps,
): Promise<{ dataUrl: string; source: 'local' | 'provider' }> {
  // Try local model first (sovereign/offline)
  if (deps.localModel?.generateImage) {
    try {
      const bytes = await deps.localModel.generateImage(query)
      const base64 = Buffer.from(bytes).toString('base64')
      return {
        dataUrl: `data:image/png;base64,${base64}`,
        source: 'local',
      }
    } catch (err) {
      // Fall through to provider
      log.warn({ err }, '[image-gen] local model failed, trying provider')
    }
  }

  // Try provider LLM with image-generation tool
  if (deps.providerLLM?.callTool) {
    try {
      const result = await deps.providerLLM.callTool('image_generate', { query })
      const dataUrl = result.dataUrl as string | undefined
      if (dataUrl) {
        return { dataUrl, source: 'provider' }
      }
    } catch (err) {
      log.warn({ err }, '[image-gen] provider fallback failed')
    }
  }

  throw new EngineError(
    'No image generation backend available (configure localModel or providerLLM)',
  )
}

export class ImageGenBridge {
  constructor(private deps: ImageGenDeps) {}

  async generateImage(query: string): Promise<{ dataUrl: string; source: string }> {
    return generateImage(query, this.deps)
  }
}
