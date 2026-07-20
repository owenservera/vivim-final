# Data Model: Local-Agent OpenCode Provider (Phase 1)

**Feature**: `022-local-agent-opencode` | **Date**: 2026-07-19

Entities extend existing Prisma models (`Provider`, `Model`) plus new in-code types. No new
DB tables are introduced in v1 — the `provider_type` column distinguishes `local-agent` from
CDP `llm`.

## Entities

### LocalAgentProvider (DB: `Provider` row)
| Field | Type | Notes |
|-------|------|-------|
| slug | string | `'opencode'` |
| display_name | string | `'OpenCode Agent'` |
| provider_type | enum | **`'local-agent'`** (new value; CDP uses `'llm'`) |
| auth_type | enum | `'none'` (Zen free — no key) |
| category | enum | `'agent'` |
| has_multi_account | bool | `false` |
| profile_strategy | enum | `'none'` |

### LocalAgentModel (DB: `Model` row, 4 rows)
| Field | Type | Notes |
|-------|------|-------|
| slug | string | e.g. `'opencode/deepseek-v4-flash-free'` |
| display_name | string | `'DeepSeek V4 Flash (Zen free)'` |
| is_default | bool | true only for `deepseek-v4-flash-free` |
| provider_slug | FK | → `opencode` |

### LocalAgentConfig (in-code / config entry)
| Field | Type | Default | Notes |
|-------|------|---------|-------|
| binary | string | `'opencode'` | CLI binary on PATH |
| timeoutMs | number | `120_000` | hard kill cap (observed cold 37–54s) |
| allowedModels | string[] | the 4 free slugs | allow-list; reject others |
| defaultModel | string | `opencode/deepseek-v4-flash-free` | used when `model` omitted |

### AgentRunInput (Zod: `src/schema/local-agent.ts`)
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| prompt | string | yes | passed to `opencode run` |
| model | string | no | must be in `allowedModels` |
| agent | string | no | optional OpenCode agent id |
| dir | string | no | `--dir` cwd |
| maxSteps | number | no | `--steps` |
| timeoutMs | number | no | overrides config |

### ContentBlock (output, `src/schema/streaming.ts`)
Canonical `ContentPart` union. Executor emits: `text`, `step-start`, `error`.

## State / Validation

- **Allow-list gate**: `model` must be in `allowedModels` → else `EngineError` before spawn.
- **Timeout**: subprocess killed at `timeoutMs`; result becomes `error` block + `capability:failed`.
- **Exit != 0**: captured stderr → `error` block, `capability:failed`.
- **cost**: always `0` for Zen free (recorded in `meta` block for telemetry).

## Relationships

```
LocalAgentProvider (1) ── (N) LocalAgentModel
cap:agent:run ── resolves ──> LocalAgentProviderExecutor
LocalAgentProviderExecutor ── reads ──> LocalAgentStore (config + allow-list)
LocalAgentProviderExecutor ── emits ──> CapabilityEventBus
LocalAgentProviderExecutor ── produces ──> ContentBlock[] (→ StreamParserEngine / captureAsNode)
```
