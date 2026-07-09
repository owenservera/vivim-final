# Unit 2.3: ConfigManager

**Phase:** 2 | **File:** `src/engines/config-manager.ts`
**Depends:** 1.4 CapStoreDb | **Produces:** Unified re-programability framework
**Source:** `02-merged-architecture.md` §Cross-Cutting, `05-merged-lifecycles.md`

## Purpose
Single authority for all engine configuration. Every lifecycle engine registers its config schema (Zod) with the ConfigManager. Configs are persisted in `config_entry`, changes audited in `config_audit`. Hot-reload: engines poll or subscribe to `config:changed` events.

## Interface
```typescript
interface ConfigManager {
  registerSchema(engineId: string, schema: ZodSchema, defaults: object): void;
  getConfig<T>(engineId: string, scope?: ConfigScope): T;
  updateConfig<T>(engineId: string, patch: Partial<T>, actor: string, scope?: ConfigScope): Promise<T>;
  getConfigHistory(engineId: string, limit?: number): Promise<ConfigAuditEntry[]>;
  reloadConfig(engineId: string): Promise<T>;
}

type ConfigScope = {
  scopeType: 'global' | 'provider' | 'account' | 'engine';
  scopeId?: string | null;
};
```

## Config Scopes
| Scope | ScopeId | Example |
|-------|---------|---------|
| `global` | null | Applies to all providers |
| `provider` | provider_id | Per-provider config override |
| `account` | account_id | Per-account config override |
| `engine` | engine_id | Engine-level global config |

## Config Lifecycle
```
registerSchema(engineId, schema, defaults)
  ├─ Schema validated via Zod
  ├─ Defaults stored as baseline
  └─ Engine calls getConfig(engineId) at construction

updateConfig(engineId, patch, actor, scope)
  ├─ Load current config
  ├─ Deep-merge patch
  ├─ Validate merged config against schema
  ├─ Write to config_entry (upsert)
  ├─ Write config_audit row (from/to/actor/ts)
  ├─ Emit config:changed event on CapabilityEventBus
  └─ Engines subscribed to config:changed pick up new config on next cycle

reloadConfig(engineId)
  ├─ Force-reload from config_entry (bypass cache)
  └─ Return raw config JSON
```

## Persistence Tables
- `config_entry` — one row per (engineId, scopeType, scopeId) tuple
- `config_audit` — every change logged with from/to/actor/ts

## Tests
- [ ] `registerSchema()` validates schema + stores defaults
- [ ] `getConfig()` returns defaults when no persisted config exists
- [ ] `updateConfig()` merges patch, validates, persists, and emits event
- [ ] `getConfigHistory()` returns audit trail ordered by timestamp
- [ ] Hot-reload: engine calls `reloadConfig()` and gets updated config without restart
- [ ] Per-provider scope: different configs for different providers
- [ ] Config rollback via audit trail (read previous fromJson, apply)

## Gate
- `bunx tsc --noEmit` passes
- All tests pass
- ConfigManager used by all lifecycle engines (RegistrationAuditor, VersionManager, TelemetryAggregator)
