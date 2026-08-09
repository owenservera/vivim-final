// src/engines/capability-bootstrap/seed.ts
// seedLocalAgentProvider — seeds the local agent provider.
// Session 7 (2026-08-07): Extracted from capability-bootstrap.ts.

import type { LocalAgentStore } from '../../storage/contracts/local-agent-store.js'
import { LOCAL_AGENT_SLUG } from '../local-agent/local-agent-executor.js'

/**
 * The 4 free opencode models — sourced from the manifest (seeds/providers/manifests.ts:999-1033)
 * which is the single source of truth (the protocol generator reads it). These must match
 * the manifest's `models[]` exactly so `isModelAllowed` accepts what the protocol declares.
 */
export const LOCAL_AGENT_FREE_MODELS: Array<{ slug: string; displayName: string }> = [
  { slug: 'opencode/qwen3.5-3b-free', displayName: 'Qwen 3.5 3B (free)' },
  { slug: 'opencode/glm4.5-air-free', displayName: 'GLM 4.5 Air (free)' },
  { slug: 'opencode/deepseek-v3.2-free', displayName: 'DeepSeek V3.2 (free)' },
  { slug: 'opencode/grok4-fast-free', displayName: 'Grok 4 Fast (free)' },
]

export async function seedLocalAgentProvider(store: LocalAgentStore): Promise<void> {
  const models = LOCAL_AGENT_FREE_MODELS.map((m, i) => ({
    slug: m.slug,
    displayName: m.displayName,
    isDefault: i === 0,
  }))
  await store.upsertAgentProvider(
    {
      slug: LOCAL_AGENT_SLUG,
      displayName: 'OpenCode Local Agent',
      authType: 'none',
      models,
    },
    {
      binary: 'opencode',
      timeoutMs: 180_000,
      allowedModels: models.map((m) => m.slug),
      defaultModel: models[0]?.slug ?? '',
    },
  )
}
