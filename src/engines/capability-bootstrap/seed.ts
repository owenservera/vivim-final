// src/engines/capability-bootstrap/seed.ts
// seedLocalAgentProvider — seeds the local agent provider.
// Session 7 (2026-08-07): Extracted from capability-bootstrap.ts.

import type { LocalAgentStore } from '../../storage/contracts/local-agent-store.js'
import { LOCAL_AGENT_SLUG } from '../local-agent/local-agent-executor.js'

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
