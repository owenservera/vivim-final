// tests/unit/engines/api-provider-seeds.test.ts
// Unit 5.3 — Validate API provider JSON manifests

import { describe, expect, it } from 'bun:test'
import { z } from 'zod'
import { ProviderManifestSchema } from '../../../src/schema/provider-manifest.js'

const providers = ['openai-api', 'anthropic-api', 'openrouter']

describe('API Provider seeds validate', () => {
  for (const p of providers) {
    it(`${p}.json validates against ProviderManifestSchema`, async () => {
      const manifest = await import(`../../../seeds/providers/${p}.json`, {
        with: { type: 'json' },
      })
      const result = ProviderManifestSchema.safeParse(manifest)
      expect(result.success).toBe(true)
      if (!result.success) {
        console.error((z as any).prettifyError?.(result.error) ?? result.error)
      }
    })
  }
})
