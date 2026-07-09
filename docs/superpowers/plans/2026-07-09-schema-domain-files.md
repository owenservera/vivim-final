# Schema Domain Files Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create 14 missing domain schema files under `src/schema/` matching the module layout in `02-merged-architecture.md`, and update the barrel re-export.

**Architecture:** Each file defines TypeScript types/interfaces for a specific domain area (capability system, Chrome, provider, routing, session, SOTA learning/transfer, automation, health, telemetry, versioning, config, harness). Types are derived from the Row types in `src/schema/types.ts` but at a higher abstraction level. The barrel `src/schema/index.ts` re-exports all files.

**Tech Stack:** TypeScript (type-only, no runtime code), Bun typecheck for validation.

## Global Constraints

- All files follow existing `src/schema/` pattern: `//` JSDoc header, named exports, no default exports
- Use `type` import syntax: `import type { Foo } from './bar.js'`
- Use `.js` extension in imports (Bun ESM requirement)
- No Zod schemas in domain files — those go in `src/schema/validators.ts` (unit 5.12)
- Each file must pass `bun run typecheck` with zero errors

---

### Task 1: Create `core.ts` (capability system domain types)

**Files:**
- Create: `src/schema/core.ts`
- Test: `tests/unit/schema/schema-domain-types.test.ts`

**Interfaces:**
- Produces: `CapabilityTaxonomy`, `Binding`, `BindingStatus`, `Program`, `PlanTier`, `Outcome`, `SelectorStrategy`

- [ ] **Step 1: Create the shared test file with core imports**

```typescript
// tests/unit/schema/schema-domain-types.test.ts
import { describe, it, expect } from 'bun:test';
import type { CapabilityTaxonomy, Binding, BindingStatus, Program, PlanTier, Outcome, SelectorStrategy } from '../../src/schema/core.js';

describe('schema/core', () => {
  it('defines CapabilityTaxonomy with all fields', () => {
    const t: CapabilityTaxonomy = {
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      name: 'Send Message',
      slug: 'send-message',
      category: 'messaging',
      description: 'Send a chat message to the provider',
      parentId: null,
      inputType: 'text',
      uiComponent: 'chat-input',
      uiLabel: 'Send',
      uiIcon: 'send',
      uiPosition: 'primary',
      uiOrder: 1,
      uiGroup: 'messaging',
      uiPriority: 'high',
      interactionMode: 'direct',
      uiStatesJson: '{}',
      uiVisibilityRule: null,
      existentialRule: null,
      uiInputSchema: '{}',
      mutationEffectsJson: '{}',
      recoveryBehavior: 'retry',
      statePersistence: 'none',
      dataFlow: 'request-response',
      minPlanTier: 'free',
      dependsOnJson: '[]',
      concurrencySafe: true,
      opClassification: null,
      requiresUserConfirmation: false,
      maxResultSize: 4096,
      resultComponent: 'text-result',
      resultLayout: 'inline',
      searchHintsJson: '{}',
      aliasesJson: '{}',
      availabilityJson: '{}',
      prefetch: false,
    };
    expect(t.slug).toBe('send-message');
  });

  it('defines Binding with all statuses', () => {
    const statuses: BindingStatus[] = ['broken', 'flaky', 'prospect', 'retired', 'stable', 'test-1', 'test-2'];
    const b: Binding = { id: 'b1', globalId: 'cap1', providerId: 'prov1', status: 'stable', bestProgramId: null, confidence: 0.95 };
    expect(statuses).toContain(b.status);
  });

  it('defines PlanTier as union type', () => {
    const tiers: PlanTier[] = ['free', 'pro', 'max', 'enterprise'];
    expect(tiers).toContain('free');
  });

  it('defines Program with versioning', () => {
    const p: Program = { id: 'pg1', bindingId: 'b1', version: 1, name: null, supersededBy: null, isActive: true, configJson: '{}' };
    expect(p.version).toBe(1);
  });

  it('defines Outcome', () => {
    const o: Outcome = { id: 'o1', capabilityId: 'cap1', bindingId: null, providerId: 'prov1', programId: null, selectorStrategyId: null, ok: true, error: null, durationMs: 150, confidence: null, selectorUsed: null, selectorHit: null, ts: Date.now() };
    expect(o.ok).toBe(true);
  });

  it('defines SelectorStrategy', () => {
    const s: SelectorStrategy = { id: 's1', name: 'main-input', capabilityId: 'cap1', providerId: 'prov1', strategyType: 'css', selectorValue: '#chat-input', priority: 1, isActive: true, hitCount: 10, missCount: 1, lastUsedAt: null };
    expect(s.selectorValue).toBe('#chat-input');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/unit/schema/schema-domain-types.test.ts 2>&1`
Expected: FAIL — "Cannot find module '../../src/schema/core.js'"

- [ ] **Step 3: Create `src/schema/core.ts`**

```typescript
// src/schema/core.ts
// Capability system domain types — taxonomy, binding, program, outcome, selectors.

export type PlanTier = 'free' | 'pro' | 'max' | 'enterprise';

export type BindingStatus = 'broken' | 'flaky' | 'prospect' | 'retired' | 'stable' | 'test-1' | 'test-2';

export interface CapabilityTaxonomy {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string | null;
  parentId: string | null;
  inputType: string;
  uiComponent: string;
  uiLabel: string | null;
  uiIcon: string | null;
  uiPosition: string;
  uiOrder: number;
  uiGroup: string;
  uiPriority: string;
  interactionMode: string;
  uiStatesJson: string;
  uiVisibilityRule: string | null;
  existentialRule: string | null;
  uiInputSchema: string;
  mutationEffectsJson: string;
  recoveryBehavior: string;
  statePersistence: string;
  dataFlow: string;
  minPlanTier: PlanTier;
  dependsOnJson: string;
  concurrencySafe: boolean;
  opClassification: string | null;
  requiresUserConfirmation: boolean;
  maxResultSize: number;
  resultComponent: string;
  resultLayout: string;
  searchHintsJson: string;
  aliasesJson: string;
  availabilityJson: string;
  prefetch: boolean;
}

export interface Binding {
  id: string;
  globalId: string;
  providerId: string;
  status: BindingStatus;
  bestProgramId: string | null;
  currentProgramId: string | null;
  promotionHistoryJson: string;
  confidence: number;
}

export interface Program {
  id: string;
  bindingId: string;
  version: number;
  name: string | null;
  supersededBy: string | null;
  isActive: boolean;
  configJson: string;
}

export interface Outcome {
  id: string;
  capabilityId: string;
  bindingId: string | null;
  providerId: string;
  programId: string | null;
  selectorStrategyId: string | null;
  ok: boolean;
  error: string | null;
  durationMs: number | null;
  confidence: number | null;
  selectorUsed: string | null;
  selectorHit: boolean | null;
  ts: number;
}

export interface SelectorStrategy {
  id: string;
  name: string;
  capabilityId: string;
  providerId: string;
  strategyType: 'css' | 'xpath' | 'text' | 'aria' | 'data' | 'regex' | 'composite';
  selectorValue: string;
  priority: number;
  isActive: boolean;
  hitCount: number;
  missCount: number;
  lastUsedAt: number | null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/unit/schema/schema-domain-types.test.ts 2>&1`
Expected: PASS — all 6 tests pass

- [ ] **Step 5: Commit**

Run: `git add src/schema/core.ts tests/unit/schema/schema-domain-types.test.ts && git commit -m "feat(schema): add core.ts with capability system domain types"`

---

### Task 2: Create `chrome.ts` + `provider.ts`

**Files:**
- Create: `src/schema/chrome.ts`
- Create: `src/schema/provider.ts`
- Modify: `tests/unit/schema/schema-domain-types.test.ts`

**Interfaces:**
- Consumes: `PlanTier` from `core.ts` (for provider.ts)
- Produces: `ChromeSlave`, `SlaveStatus`, `SuperState`, `LaunchOptions`, `CDPCommand`, `CDPResult`, `ProviderDefinition`, `ProviderEndpoint`, `ProviderAccount`, `ProviderTransport`, `ProviderParser`

- [ ] **Step 1: Add chrome + provider tests to test file**

Append to `tests/unit/schema/schema-domain-types.test.ts`:

```typescript
import type { ChromeSlave, SlaveStatus, SuperState, LaunchOptions, CDPCommand, CDPResult } from '../../src/schema/chrome.js';
import type { ProviderDefinition, ProviderEndpoint, ProviderAccount, ProviderTransport, ProviderParser } from '../../src/schema/provider.js';

describe('schema/chrome', () => {
  it('defines SlaveStatus as union', () => {
    const statuses: SlaveStatus[] = ['launching', 'ready', 'busy', 'stale', 'dead'];
    expect(statuses).toContain('ready');
  });

  it('defines SuperState as union', () => {
    const states: SuperState[] = ['active', 'sleep', 'error', 'recovering'];
    expect(states).toContain('active');
  });

  it('defines ChromeSlave with all fields', () => {
    const s: ChromeSlave = { id: 's1', providerId: 'prov1', accountId: 'a1', status: 'ready', port: 9222, profileDir: '/tmp/chrome/prov1', pid: 12345, launchOptions: { headless: true, userDataDir: '/tmp/chrome/prov1', args: [], timeoutMs: 30000, debugPort: 9222 } };
    expect(s.port).toBe(9222);
  });
});

describe('schema/provider', () => {
  it('defines ProviderDefinition', () => {
    const p: ProviderDefinition = { id: 'p1', slug: 'claude', displayName: 'Claude', description: null, category: 'ai', providerType: 'llm', isActive: true, authType: 'browser', hasMultiAccount: false, profileStrategy: 'per_account', fleetConfigJson: '{}', capabilitiesJson: '{}', modelsJson: '[]', createdAt: Date.now(), updatedAt: Date.now() };
    expect(p.slug).toBe('claude');
  });

  it('defines ProviderEndpoint with endpoint types', () => {
    const e: ProviderEndpoint = { id: 'e1', providerId: 'p1', url: 'https://claude.ai', label: 'Landing', endpointType: 'landing', isDefault: true, selectorJson: '{}' };
    expect(e.endpointType).toBe('landing');
  });

  it('defines ProviderAccount with PlanTier', () => {
    const a: ProviderAccount = { id: 'a1', providerId: 'p1', email: 'user@example.com', planTier: 'pro', isDefault: true, loginState: 'logged_in' };
    expect(a.planTier).toBe('pro');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/unit/schema/schema-domain-types.test.ts 2>&1`
Expected: FAIL — "Cannot find module '../../src/schema/chrome.js'" and/or "Cannot find module '../../src/schema/provider.js'"

- [ ] **Step 3: Create `src/schema/chrome.ts`**

```typescript
// src/schema/chrome.ts
// Chrome browser slave types — used by ChromeGovernor and LifecycleManager.

export type SlaveStatus = 'launching' | 'ready' | 'busy' | 'stale' | 'dead';

export type SuperState = 'active' | 'sleep' | 'error' | 'recovering';

export interface LaunchOptions {
  headless: boolean;
  userDataDir: string;
  args: string[];
  timeoutMs: number;
  debugPort: number;
}

export interface ChromeSlave {
  id: string;
  providerId: string;
  accountId: string;
  status: SlaveStatus;
  port: number;
  profileDir: string;
  pid: number | null;
  launchOptions: LaunchOptions;
}

export interface CDPCommand {
  method: string;
  params: Record<string, unknown>;
  sessionId?: string;
}

export interface CDPResult {
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
}
```

- [ ] **Step 4: Create `src/schema/provider.ts`**

```typescript
// src/schema/provider.ts
// Provider knowledge graph domain types — definitions, endpoints, accounts, parsers.

import type { PlanTier } from './core.js';

export interface ProviderDefinition {
  id: string;
  slug: string;
  displayName: string;
  description: string | null;
  category: string;
  providerType: string;
  isActive: boolean;
  authType: string;
  hasMultiAccount: boolean;
  profileStrategy: string;
  fleetConfigJson: string;
  capabilitiesJson: string;
  modelsJson: string;
  createdAt: number;
  updatedAt: number;
}

export type ProviderTransport = 'browser' | 'api' | 'hybrid';

export interface ProviderEndpoint {
  id: string;
  providerId: string;
  url: string;
  label: string;
  endpointType: 'landing' | 'chat' | 'login' | 'api' | 'auth';
  isDefault: boolean;
  selectorJson: string;
}

export interface ProviderAccount {
  id: string;
  providerId: string;
  email: string;
  planTier: PlanTier;
  isDefault: boolean;
  loginState: string;
  isKind?: boolean;
  loginAttempts?: number;
  lastLoginAt?: number | null;
  providerStateJson?: string;
  debugPort?: number | null;
  profileDir?: string | null;
  chromeSlaveId?: string | null;
}

export interface ProviderParser {
  id: string;
  providerId: string;
  parserName: string;
  parserType: string;
  isActive: boolean;
  fallbackParserId: string | null;
  parserHash?: string | null;
  parserFilePath?: string | null;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test tests/unit/schema/schema-domain-types.test.ts 2>&1`
Expected: PASS — all ~13 tests pass

- [ ] **Step 6: Commit**

Run: `git add src/schema/chrome.ts src/schema/provider.ts tests/unit/schema/schema-domain-types.test.ts && git commit -m "feat(schema): add chrome.ts + provider.ts domain types"`

---

### Task 3: Create `session.ts` + `routing.ts`

**Files:**
- Create: `src/schema/session.ts`
- Create: `src/schema/routing.ts`
- Modify: `tests/unit/schema/schema-domain-types.test.ts`

- [ ] **Step 1: Add session + routing tests**

Append to test file:

```typescript
import type { VivimSession, SessionState, ProviderSession, ProfileSession, Conversation, ConversationMessage } from '../../src/schema/session.js';
import type { RouteSpec, RouteRequest, RouteTarget, RouteEvent } from '../../src/schema/routing.js';

describe('schema/session', () => {
  it('defines SessionState as union', () => {
    const states: SessionState[] = ['active', 'idle', 'suspended', 'closed'];
    expect(states).toContain('active');
  });

  it('defines VivimSession', () => {
    const s: VivimSession = { id: 'vs1', state: 'active', contextJson: '{}', createdAt: Date.now(), updatedAt: Date.now() };
    expect(s.state).toBe('active');
  });

  it('defines Conversation with message count', () => {
    const c: Conversation = { id: 'c1', providerSessionId: 'ps1', providerId: 'prov1', title: null, state: 'active', messageCount: 5, lastMessageAt: null, contextJson: '{}', createdAt: Date.now(), updatedAt: Date.now() };
    expect(c.messageCount).toBe(5);
  });

  it('defines ConversationMessage with roles', () => {
    const m: ConversationMessage = { id: 'm1', conversationId: 'c1', role: 'user', content: 'hello', blocksJson: '[]', blockCount: 1, parentMessageId: null, sequenceIndex: 0, latencyMs: null, tokenCount: null, model: null, metadataJson: '{}', createdAt: Date.now() };
    expect(m.role).toBe('user');
  });
});

describe('schema/routing', () => {
  it('defines RouteSpec', () => {
    const r: RouteSpec = { id: 'rs1', name: 'llm-chat', criteria: '{}', targetProviderIds: ['prov1', 'prov2'], strategy: 'latency', isActive: true };
    expect(r.name).toBe('llm-chat');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/unit/schema/schema-domain-types.test.ts 2>&1`
Expected: FAIL — file not found

- [ ] **Step 3: Create `src/schema/session.ts`**

```typescript
// src/schema/session.ts
// Session and conversation domain types.

export type SessionState = 'active' | 'idle' | 'suspended' | 'closed';

export interface VivimSession {
  id: string;
  state: SessionState;
  contextJson: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProviderSession {
  id: string;
  vivimSessionId: string;
  providerId: string;
  accountId: string;
  state: string;
  contextJson: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProfileSession {
  id: string;
  providerSessionId: string;
  profileDir: string;
  chromeSlaveId: string | null;
  state: string;
  port: number | null;
  createdAt: number;
  updatedAt: number;
}

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface Conversation {
  id: string;
  providerSessionId: string;
  providerId: string;
  title: string | null;
  state: string;
  messageCount: number;
  lastMessageAt: number | null;
  contextJson: string;
  createdAt: number;
  updatedAt: number;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string | null;
  blocksJson: string;
  blockCount: number;
  parentMessageId: string | null;
  sequenceIndex: number;
  latencyMs: number | null;
  tokenCount: number | null;
  model: string | null;
  metadataJson: string;
  createdAt: number;
}
```

- [ ] **Step 4: Create `src/schema/routing.ts`**

```typescript
// src/schema/routing.ts
// Multi-provider routing types — used by Router subsystem.

export interface RouteSpec {
  id: string;
  name: string;
  criteria: string;
  targetProviderIds: string[];
  strategy: string;
  isActive: boolean;
}

export interface RouteRequest {
  id: string;
  specId: string;
  capabilityId: string;
  context: string;
  matchedAt: number | null;
}

export interface RouteTarget {
  id: string;
  specId: string;
  providerId: string;
  priority: number;
  weight: number;
  isActive: boolean;
}

export type RouteEventType = 'matched' | 'dispatched' | 'succeeded' | 'failed' | 'timeout';

export interface RouteEvent {
  id: string;
  requestId: string;
  targetId: string;
  eventType: RouteEventType;
  ts: number;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test tests/unit/schema/schema-domain-types.test.ts 2>&1`
Expected: PASS

- [ ] **Step 6: Commit**

Run: `git add src/schema/session.ts src/schema/routing.ts tests/unit/schema/schema-domain-types.test.ts && git commit -m "feat(schema): add session.ts + routing.ts domain types"`

---

### Task 4: Create `config.ts` + `versioning.ts`

**Files:**
- Create: `src/schema/config.ts`
- Create: `src/schema/versioning.ts`
- Modify: `tests/unit/schema/schema-domain-types.test.ts`

- [ ] **Step 1: Add config + versioning tests**

```typescript
import type { ConfigEntry, ConfigAuditEntry } from '../../src/schema/config.js';
import type { VersionConfig, PromotionRule, DegradationRule, ProviderManifestVersion } from '../../src/schema/versioning.js';

describe('schema/config', () => {
  it('defines ConfigEntry with config types', () => {
    const c: ConfigEntry = { id: 'c1', engineId: 'governor', configKey: 'timeout_ms', configValue: '30000', configType: 'number', isRuntime: true };
    expect(c.configKey).toBe('timeout_ms');
  });
});

describe('schema/versioning', () => {
  it('defines VersionConfig', () => {
    const v: VersionConfig = { id: 'v1', engineId: 'governor', currentVersion: 3, minVersion: 1, compatMapJson: '{"2":"1","3":"2"}' };
    expect(v.currentVersion).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/unit/schema/schema-domain-types.test.ts 2>&1`
Expected: FAIL

- [ ] **Step 3: Create `src/schema/config.ts`**

```typescript
// src/schema/config.ts
// Configuration domain types — used by ConfigManager.

export interface ConfigEntry {
  id: string;
  engineId: string;
  configKey: string;
  configValue: string;
  configType: string;
  isRuntime: boolean;
}

export interface ConfigAuditEntry {
  id: string;
  engineId: string;
  configKey: string | null;
  fromValue: string | null;
  toValue: string;
  actor: string;
  ts: number;
}

export interface ConfigSchema {
  engineId: string;
  zodSchema: string;
  defaults: string;
  isRuntime?: boolean;
}
```

- [ ] **Step 4: Create `src/schema/versioning.ts`**

```typescript
// src/schema/versioning.ts
// Version management types — used by VersionManager and RegistrationAuditor.

export interface VersionConfig {
  id: string;
  engineId: string;
  currentVersion: number;
  minVersion: number;
  compatMapJson: string;
}

export interface PromotionRule {
  id: string;
  name: string;
  criteria: string;
  fromStatus: string;
  toStatus: string;
  autoPromote: boolean;
  isActive: boolean;
}

export interface DegradationRule {
  id: string;
  name: string;
  threshold: number;
  action: string;
  cooldownMs: number;
  isActive: boolean;
}

export interface ProviderManifestVersion {
  id: string;
  providerId: string;
  version: number;
  hash: string;
  contentJson: string;
  changeSummary: string | null;
  actor: string;
  createdAt: number;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test tests/unit/schema/schema-domain-types.test.ts 2>&1`
Expected: PASS

- [ ] **Step 6: Commit**

Run: `git add src/schema/config.ts src/schema/versioning.ts tests/unit/schema/schema-domain-types.test.ts && git commit -m "feat(schema): add config.ts + versioning.ts domain types"`

---

### Task 5: Create `health.ts` + `telemetry.ts` + `automation.ts`

**Files:**
- Create: `src/schema/health.ts`
- Create: `src/schema/telemetry.ts`
- Create: `src/schema/automation.ts`
- Modify: `tests/unit/schema/schema-domain-types.test.ts`

- [ ] **Step 1: Add health + telemetry + automation tests**

```typescript
import type { ProviderHealthReport, HealthSignal, HealthHistory } from '../../src/schema/health.js';
import type { TelemetryPipelineConfig, TelemetrySchedule, TelemetryRetention } from '../../src/schema/telemetry.js';
import type { AutomationSchedule, AutomationRun, AlertCondition, AlertEvent, DiscoveryObjective } from '../../src/schema/automation.js';

describe('schema/health', () => {
  it('defines ProviderHealthReport', () => {
    const h: ProviderHealthReport = { id: 'h1', providerId: 'prov1', overallStatus: 'healthy', overallScore: 0.95, signalsJson: '{}', ts: Date.now() };
    expect(h.overallStatus).toBe('healthy');
  });
});

describe('schema/telemetry', () => {
  it('defines TelemetryPipelineConfig', () => {
    const t: TelemetryPipelineConfig = { id: 't1', name: 'health-aggregation', engineId: 'health-kernel', schedule: '*/5 * * * *', retention: '30d', isActive: true };
    expect(t.name).toBe('health-aggregation');
  });
});

describe('schema/automation', () => {
  it('defines AlertCondition with severity', () => {
    const a: AlertCondition = { id: 'a1', name: 'high-latency', metric: 'p95_latency_ms', operator: '>', threshold: 5000, severity: 'warning', isActive: true };
    expect(a.severity).toBe('warning');
  });

  it('defines AutomationSchedule', () => {
    const s: AutomationSchedule = { id: 's1', name: 'nightly-cache-clear', trigger: 'cron', action: 'clear_cache', isActive: true, lastRunAt: null };
    expect(s.trigger).toBe('cron');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/unit/schema/schema-domain-types.test.ts 2>&1`
Expected: FAIL

- [ ] **Step 3: Create `src/schema/health.ts`**

```typescript
// src/schema/health.ts
// Health monitoring domain types — used by ProviderHealthKernel.

export interface ProviderHealthReport {
  id: string;
  providerId: string;
  overallStatus: string;
  overallScore: number;
  signalsJson: string;
  ts: number;
}

export interface HealthSignal {
  id: string;
  reportId: string;
  name: string;
  score: number;
  weight: number;
  detailJson: string;
}

export interface HealthHistory {
  id: string;
  providerId: string;
  overallStatus: string;
  overallScore: number;
  signalsJson: string;
  ts: number;
}
```

- [ ] **Step 4: Create `src/schema/telemetry.ts`**

```typescript
// src/schema/telemetry.ts
// Telemetry configuration types — used by TelemetryAggregator.

export interface TelemetryPipelineConfig {
  id: string;
  name: string;
  engineId: string;
  schedule: string;
  retention: string;
  isActive: boolean;
}

export interface TelemetrySchedule {
  id: string;
  pipelineId: string;
  interval: string;
  lastRunAt: number | null;
  nextRunAt: number | null;
}

export interface TelemetryRetention {
  id: string;
  pipelineId: string;
  maxAgeDays: number;
  maxRecords: number;
  currentCount: number;
}
```

- [ ] **Step 5: Create `src/schema/automation.ts`**

```typescript
// src/schema/automation.ts
// Automation and alerting domain types — used by Automation scheduler and Alerting subsystem.

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface AlertCondition {
  id: string;
  name: string;
  metric: string;
  operator: string;
  threshold: number;
  severity: AlertSeverity;
  isActive: boolean;
}

export interface AlertEvent {
  id: string;
  conditionId: string;
  actualValue: number;
  triggeredAt: number;
  resolvedAt: number | null;
}

export interface AutomationSchedule {
  id: string;
  name: string;
  trigger: string;
  action: string;
  isActive: boolean;
  lastRunAt: number | null;
  cron?: string;
}

export interface AutomationRun {
  id: string;
  scheduleId: string;
  status: string;
  resultJson: string;
  startedAt: number;
  completedAt: number | null;
}

export interface DiscoveryObjective {
  id: string;
  name: string;
  targetProviderId: string;
  focus: string;
  status: string;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `bun test tests/unit/schema/schema-domain-types.test.ts 2>&1`
Expected: PASS

- [ ] **Step 7: Commit**

Run: `git add src/schema/health.ts src/schema/telemetry.ts src/schema/automation.ts tests/unit/schema/schema-domain-types.test.ts && git commit -m "feat(schema): add health.ts telemetry.ts automation.ts domain types"`

---

### Task 6: Create SOTA domain types (`learning.ts` + `transfer.ts` + `harness.ts`)

**Files:**
- Create: `src/schema/learning.ts`
- Create: `src/schema/transfer.ts`
- Create: `src/schema/harness.ts`
- Modify: `tests/unit/schema/schema-domain-types.test.ts`

- [ ] **Step 1: Add learning + transfer + harness tests**

```typescript
import type { LearningEvent, Rule, BindingEvent } from '../../src/schema/learning.js';
import type { TransferPattern, TransferCandidate, TransferAttempt } from '../../src/schema/transfer.js';
import type { HarnessDAG, HarnessNode, HarnessModule, HarnessTelemetry, HarnessCheckpoint } from '../../src/schema/harness.js';

describe('schema/learning', () => {
  it('defines LearningEvent', () => {
    const e: LearningEvent = { id: 'le1', providerId: 'prov1', capabilityId: 'cap1', eventType: 'success', contextJson: '{}', outcome: 'positive', ts: Date.now() };
    expect(e.eventType).toBe('success');
  });
});

describe('schema/transfer', () => {
  it('defines TransferPattern', () => {
    const p: TransferPattern = { id: 'tp1', sourceProviderId: 'prov1', targetProviderId: 'prov2', capabilityId: 'cap1', mappingJson: '{}', confidence: 0.7 };
    expect(p.confidence).toBe(0.7);
  });
});

describe('schema/harness', () => {
  it('defines HarnessNode with retry policy', () => {
    const node: HarnessNode = { id: 'n1', moduleName: 'composer.module', input: {}, dependsOn: [], retryPolicy: { maxRetries: 3, backoffMs: 1000 }, timeoutMs: 30000 };
    expect(node.moduleName).toBe('composer.module');
  });

  it('defines HarnessDAG', () => {
    const dag: HarnessDAG = { id: 'dag1', name: 'send-message', nodes: [], edges: [], timeoutMs: 60000 };
    expect(dag.timeoutMs).toBe(60000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/unit/schema/schema-domain-types.test.ts 2>&1`
Expected: FAIL

- [ ] **Step 3: Create `src/schema/learning.ts`**

```typescript
// src/schema/learning.ts
// SOTA learning domain types — used by MemoryEngine and Session learning.

export interface LearningEvent {
  id: string;
  providerId: string;
  capabilityId: string;
  eventType: string;
  contextJson: string;
  outcome: string;
  ts: number;
}

export interface Rule {
  id: string;
  name: string;
  condition: string;
  action: string;
  confidence: number;
  source: string;
  isActive: boolean;
}

export interface BindingEvent {
  id: string;
  bindingId: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string;
  reason: string | null;
  ts: number;
}
```

- [ ] **Step 4: Create `src/schema/transfer.ts`**

```typescript
// src/schema/transfer.ts
// SOTA transfer learning types — used by TransferAccelerator.

export interface TransferPattern {
  id: string;
  sourceProviderId: string;
  targetProviderId: string;
  capabilityId: string;
  mappingJson: string;
  confidence: number;
}

export interface TransferCandidate {
  id: string;
  patternId: string;
  bindingId: string;
  projectedConfidence: number;
  appliedAt: number | null;
}

export interface TransferAttempt {
  id: string;
  candidateId: string;
  ok: boolean;
  durationMs: number;
  error: string | null;
  ts: number;
}
```

- [ ] **Step 5: Create `src/schema/harness.ts`**

```typescript
// src/schema/harness.ts
// Harness runtime types — used by HarnessRuntime and WorkflowEngine.

export interface HarnessNode {
  id: string;
  moduleName: string;
  input: Record<string, unknown>;
  dependsOn: string[];
  retryPolicy: { maxRetries: number; backoffMs: number };
  timeoutMs: number;
}

export interface HarnessDAG {
  id: string;
  name: string;
  nodes: HarnessNode[];
  edges: { from: string; to: string }[];
  timeoutMs: number;
}

export interface HarnessModule {
  id: string;
  name: string;
  execute(input: Record<string, unknown>, ctx: Record<string, unknown>): Promise<{ ok: boolean; data?: unknown; error?: string }>;
}

export interface HarnessTelemetry {
  dagId: string;
  nodeId: string;
  eventType: string;
  durationMs: number;
  ok: boolean;
  error?: string;
}

export interface HarnessCheckpoint {
  id: string;
  dagId: string;
  executedNodes: string[];
  stateJson: string;
  pageState?: { url: string; title: string };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `bun test tests/unit/schema/schema-domain-types.test.ts 2>&1`
Expected: PASS

- [ ] **Step 7: Commit**

Run: `git add src/schema/learning.ts src/schema/transfer.ts src/schema/harness.ts tests/unit/schema/schema-domain-types.test.ts && git commit -m "feat(schema): add learning.ts transfer.ts harness.ts domain types"`

---

### Task 7: Update barrel re-export + fix 4.31 reference

**Files:**
- Modify: `src/schema/index.ts`
- Modify: `docs/atomic/phase-4-engines/31-shared-types.md`

- [ ] **Step 1: Verify current barrel is empty except types + streaming**

Read: `src/schema/index.ts` — currently exports from `./types.js` and `./streaming.js`

- [ ] **Step 2: Update `src/schema/index.ts` to re-export all 15 schema files**

```typescript
// src/schema/index.ts
// Barrel re-exports — all domain types + row types + streaming types.

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

- [ ] **Step 3: Update atomic 4.31 to reflect that barrel is `index.ts` not `types.ts`**

In `docs/atomic/phase-4-engines/31-shared-types.md`, change the test items to reference `index.ts`:

```
- [ ] `src/schema/index.ts` exists and re-exports all 14 domain schema files + types + streaming
- [ ] `import { CapabilityEvent } from '@/schema/index.js'` resolves
```

- [ ] **Step 4: Run typecheck to verify barrel works**

Run: `bun run typecheck 2>&1 | Select-Object -First 30`
Expected: Zero type errors — all 15 re-exports resolve

- [ ] **Step 5: Run tests to verify everything still passes**

Run: `bun test tests/unit/schema/schema-domain-types.test.ts 2>&1`
Expected: PASS — all tests

- [ ] **Step 6: Commit**

Run: `git add src/schema/index.ts docs/atomic/phase-4-engines/31-shared-types.md && git commit -m "feat(schema): update barrel re-export + fix 4.31 reference"`
