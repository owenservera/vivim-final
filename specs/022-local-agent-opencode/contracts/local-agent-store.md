# Contract: LocalAgentStore

**Feature**: `022-local-agent-opencode` | **Phase**: 1 (contracts)

The engine-facing storage contract for the `local-agent` provider. Engines depend on this
interface (Store Contracts invariant) — never on a Prisma impl directly.

## Interface

```typescript
// src/storage/contracts/local-agent-store.ts

export interface LocalAgentModelRow {
  slug: string
  displayName: string
  isDefault: boolean
}

export interface LocalAgentProviderRow {
  slug: string
  displayName: string
  authType: 'none'
  models: LocalAgentModelRow[]
}

export interface LocalAgentConfig {
  binary: string
  timeoutMs: number
  allowedModels: string[]
  defaultModel: string
}

export interface LocalAgentStore {
  /** Load the seeded `local-agent` provider (slug `opencode`) + its models. */
  getAgentProvider(slug: string): Promise<LocalAgentProviderRow | null>

  /** Runtime config (binary, timeout, allow-list). */
  getAgentConfig(slug: string): Promise<LocalAgentConfig | null>

  /** Upsert provider + model rows from the seed manifest (idempotent). */
  upsertAgentProvider(row: LocalAgentProviderRow, config: LocalAgentConfig): Promise<void>

  /** True if `model` is in the verified allow-list for `slug`. */
  isModelAllowed(slug: string, model: string): Promise<boolean>
}
```

## Rules

- `getAgentProvider` returns `null` if the provider is not seeded (caller throws `EngineError`).
- `isModelAllowed` is the single gate used by `LocalAgentProviderExecutor` before `Bun.spawn`.
- `upsertAgentProvider` is called once at boot from `seeds/providers/local-agent.ts`.

## Out of scope (v1)

- No `serve`/`acp` session store — only one-shot `run`.
- No conversation persistence of agent turns in v1 (capture path deferred).
