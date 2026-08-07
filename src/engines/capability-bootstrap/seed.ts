// src/engines/capability-bootstrap/seed.ts
// seedLocalAgentProvider — seeds the local agent provider.
// Session 7 (2026-08-07): Extracted from capability-bootstrap.ts.

import type { LocalAgentStore } from '../../storage/contracts/local-agent-store.js'
import { LOCAL_AGENT_SLUG } from '../local-agent/local-agent-executor.js'

/**
 * The 4 verified Zen free models (opencode v1.17.15, 2026-07-19). `nemotron-3-ultra-free`
 * is intentionally excluded (>5 min cold timeout in test).
 */
export const LOCAL_AGENT_FREE_MODELS: Array<{ slug: string; displayName: string }> = [
  { slug: 'opencode/deepseek-v4-flash-free', displayName: 'DeepSeek V4 Flash (free)' },
  { slug: 'opencode/hy3-free', displayName: 'HY3 (free)' },
  { slug: 'opencode/mimo-v2.5-free', displayName: 'Mimo 2.5 (free)' },
  { slug: 'opencode/north-mini-code-free', displayName: 'North Mini Code (free)' },
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
