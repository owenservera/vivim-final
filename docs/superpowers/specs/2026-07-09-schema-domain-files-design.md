# Schema Domain Files — Design Spec

**Date:** 2026-07-09
**Status:** Approved (via brainstorming)
**Audience:** Implementation

## Summary

Create 14 missing domain schema files under `src/schema/` to match the module layout specified in `02-merged-architecture.md`. These define TypeScript domain types (not raw DB row types) that engines import. The existing `src/schema/types.ts` (Row interfaces) and `src/schema/streaming.ts` (ContentBlock types) stay as-is. `src/schema/index.ts` becomes the barrel re-export for all domain files + streaming + types.

## Existing Layout (unchanged)

```
src/schema/types.ts        ← Row interfaces for all 54 tables (487 lines, keep)
src/schema/streaming.ts    ← ContentBlock union type (keep)
src/schema/index.ts        ← Current barrel (will be expanded)
src/schema/validators.ts   ← Zod schemas (covered by unit 5.12)
```

## Files to Create (14)

### 1. `src/schema/core.ts`
Capability system domain types.
```typescript
- CapabilityTaxonomy (id, name, slug, category, description, parentId, ui fields, state fields)
- Binding (id, globalId, providerId, status: BindingStatus, bestProgramId, confidence)
- BindingStatus enum ('broken' | 'flaky' | 'prospect' | 'retired' | 'stable' | 'test-1' | 'test-2')
- Program (id, bindingId, version, name, supersededBy, isActive, configJson)
- PlanTier type ('free' | 'pro' | 'max' | 'enterprise')
- Outcome (id, capabilityId, bindingId, providerId, ok, error, durationMs, confidence, ts)
- SelectorStrategy (id, name, capabilityId, providerId, strategyType, selectorValue, priority, isActive)
```

### 2. `src/schema/chrome.ts`
Chrome browser slave types.
```typescript
- ChromeSlave (id, providerId, accountId, status: SlaveStatus, port, profileDir, pid, launchOptions)
- SlaveStatus enum ('launching' | 'ready' | 'busy' | 'stale' | 'dead')
- SuperState enum ('active' | 'sleep' | 'error' | 'recovering')
- LaunchOptions (headless, userDataDir, args, timeoutMs, debugPort)
- CDPCommand (method, params, sessionId?)
- CDPResult (result, error?)
```

### 3. `src/schema/provider.ts`
Provider knowledge graph types.
```typescript
- ProviderDefinition (id, slug, displayName, description, category, providerType, isActive, authType)
- ProviderEndpoint (id, providerId, url, label, endpointType, isDefault, selectorJson)
- ProviderAccount (id, providerId, email, planTier: PlanTier, isDefault, loginState)
- ProviderTransport type
- ProviderParser (id, providerId, parserName, parserType, isActive, fallbackParserId)
```

### 4. `src/schema/routing.ts`
Multi-provider routing types.
```typescript
- RouteSpec (id, name, criteria, targetProviderIds, strategy, isActive)
- RouteRequest (id, specId, capabilityId, context, matchedAt)
- RouteTarget (id, specId, providerId, priority, weight, isActive)
- RouteEvent (id, requestId, targetId, eventType, ts)
```

### 5. `src/schema/session.ts`
Session and conversation domain types.
```typescript
- VivimSession (id, state: SessionState, contextJson, createdAt)
- SessionState enum ('active' | 'idle' | 'suspended' | 'closed')
- ProviderSession (id, vivimSessionId, providerId, accountId, state, contextJson)
- ProfileSession (id, providerSessionId, profileDir, chromeSlaveId, state, port)
- Conversation (id, providerSessionId, providerId, title, state, messageCount, lastMessageAt)
- ConversationMessage (id, conversationId, role, content, blocksJson, blockCount, latencyMs, model)
```

### 6. `src/schema/learning.ts`
SOTA learning types.
```typescript
- LearningEvent (id, providerId, capabilityId, eventType, contextJson, outcome, ts)
- Rule (id, name, condition, action, confidence, source, isActive)
- BindingEvent (id, bindingId, eventType, fromStatus, toStatus, reason, ts)
```

### 7. `src/schema/transfer.ts`
SOTA transfer learning types.
```typescript
- TransferPattern (id, sourceProviderId, targetProviderId, capabilityId, mappingJson, confidence)
- TransferCandidate (id, patternId, bindingId, projectedConfidence, appliedAt?)
- TransferAttempt (id, candidateId, ok, durationMs, error?, ts)
```

### 8. `src/schema/automation.ts`
Automation and alerting types.
```typescript
- AutomationSchedule (id, name, trigger, action, isActive, lastRunAt, cron?)
- AutomationRun (id, scheduleId, status, resultJson, startedAt, completedAt?)
- AlertCondition (id, name, metric, operator, threshold, severity, isActive)
- AlertEvent (id, conditionId, actualValue, triggeredAt, resolvedAt?)
- DiscoveryObjective (id, name, targetProviderId, focus, status)
```

### 9. `src/schema/health.ts`
Health monitoring types.
```typescript
- ProviderHealthReport (id, providerId, overallStatus, overallScore, signalsJson, ts)
- HealthSignal (id, reportId, name, score, weight, detailJson)
- HealthHistory (id, providerId, overallStatus, overallScore, signalsJson, ts)
```

### 10. `src/schema/telemetry.ts`
Telemetry configuration types.
```typescript
- TelemetryPipelineConfig (id, name, engineId, schedule, retention, isActive)
- TelemetrySchedule (id, pipelineId, interval, lastRunAt, nextRunAt)
- TelemetryRetention (id, pipelineId, maxAgeDays, maxRecords, currentCount)
```

### 11. `src/schema/versioning.ts`
Version management types.
```typescript
- VersionConfig (id, engineId, currentVersion, minVersion, compatMapJson)
- PromotionRule (id, name, criteria, fromStatus, toStatus, autoPromote, isActive)
- DegradationRule (id, name, threshold, action, cooldownMs, isActive)
- ProviderManifestVersion (id, providerId, version, hash, contentJson, changeSummary, actor, createdAt)
```

### 12. `src/schema/config.ts`
Configuration types.
```typescript
- ConfigEntry (id, engineId, configKey, configValue, configType, isRuntime)
- ConfigAuditEntry (id, engineId, configKey, fromValue, toValue, actor, ts)
- ConfigSchema (engineId, zodSchema, defaults?, isRuntime?)
```

### 13. `src/schema/harness.ts`
Harness runtime types.
```typescript
- HarnessDAG (id, name, nodes: HarnessNode[], edges, timeoutMs)
- HarnessNode (id, moduleName, input, dependsOn, retryPolicy, timeoutMs)
- HarnessModule (id, name, execute(input, ctx): Promise<HarnessModuleResult>)
- HarnessTelemetry (dagId, nodeId, eventType, durationMs, ok, error?)
- HarnessCheckpoint (id, dagId, executedNodes, stateJson, pageState?)
```

### 14. `src/schema/streaming.ts`
Already exists — no changes.

### Barrel Update: `src/schema/index.ts`
Replace current barrel with exports from all 14 domain files + `types.ts` + `streaming.ts`:
```typescript
export * from './core.js';
export * from './chrome.js';
export * from './provider.js';
export * from './routing.js';
export * from './session.js';
export * from './learning.js';
export * from './transfer.js';
export * from './automation.js';
export * from './health.js';
export * from './telemetry.js';
export * from './versioning.js';
export * from './config.js';
export * from './harness.js';
export * from './streaming.js';
export * from './types.js';
```

## Dependencies

- **Phase 1** — Prisma schema + Row types in `types.ts` must exist (the domain types reference the Row types column structure)
- **No engine dependency** — domain types are leaf definitions, no engine imports needed to create them

## Integration Notes

- Unit 4.31 (`shared-types.md`) assumed `types.ts` would be the barrel. The actual barrel is `index.ts`. Atomic 4.31's test case "src/schema/types.ts exists and is a valid TypeScript module" should read "src/schema/index.ts exists and re-exports all domain types." Update in 4.31 implementation.
- `validators.ts` (unit 5.12) uses Zod to validate API input — it imports from these domain types. The domain files should NOT contain Zod schemas (those go in validators.ts).
