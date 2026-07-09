# Unit 4.2: CapabilityEngine

**Phase:** 4 | **File:** `src/engines/capability.ts`
**Depends:** 3.1 ChromeGovernor | **Produces:** Capability execution via CDP
**Source:** `04-merged-engines.md` §4

## Purpose
Execute capabilities by sending CDP commands through the Governor. Handles login detection, message sending, and model selection. All CDP access is through `governor.cdp`.

## Interface
```typescript
class CapabilityEngine {
  constructor(
    private governor: ChromeGovernor,
    private store: CapabilityStore,
    private eventBus?: CapabilityEventBus,
  ) {}

  async execute(
    capabilitySlug: string,
    providerId: string,
    accountId: string,
    input?: Record<string, unknown>,
  ): Promise<CapabilityExecutionResult>;

  async detectLogin(providerId: string, accountId: string): Promise<LoginDetectionResult>;
  async sendMessage(providerId: string, accountId: string, message: string): Promise<SendResult>;
}

interface CapabilityExecutionResult {
  ok: boolean;
  capabilityId: string;
  output?: Record<string, unknown>;
  traceId: string;
  latencyMs: number;
  error?: string;
  recoveryAttempted?: boolean;
  recoveryStrategies?: RecoveryStrategyResult[];
}

interface LoginDetectionResult {
  isLoggedIn: boolean;
  confidence: number;
  pageUrl?: string;
  indicators: LoginIndicator[];
}

type RecoveryStrategy = {
  type: 'retry_selector' | 'retry_with_fallback' | 'navigate_home' | 'restart_chrome' | 'mark_broken';
  config?: Record<string, unknown>;
};
```

## Store Contract
```typescript
interface CapabilityStore {
  getCapability(id: string): Promise<CapabilityTaxonomyRow | null>;
  getCapabilityBySlug(slug: string): Promise<CapabilityTaxonomyRow | null>;
  getBinding(capabilityId: string, providerId: string): Promise<CapabilityBindingRow | null>;
  getProgram(bindingId: string): Promise<CapabilityProgramRow | null>;
  getPrograms(bindingId: string): Promise<CapabilityProgramRow[]>;
  getSelectors(capabilityId: string, providerId: string): Promise<SelectorStrategyRow[]>;
  createOutcome(outcome: OutcomeInput): Promise<OutcomeRow>;
  updateBindingHealth(bindingId: string, patch: Partial<CapabilityBindingRow>): Promise<void>;
  updateSelectorHealth(selectorId: string, hit: boolean): Promise<void>;
}
```

## Recovery Strategy Execution
```
execute(capabilitySlug, providerId, accountId, input)
  ├─ Try primary selector
  ├─ If miss → try recovery_strategies in order:
  │   1. retry_selector: re-query DOM, retry same selector
  │   2. retry_with_fallback: use fallback selector from config
  │   3. navigate_home: navigate to landing page, retry from start
  │   4. restart_chrome: kill + relaunch slave, retry
  │   5. mark_broken: update binding status to 'broken'
  └─ Emit capability:executed or capability:failed event
```

## Tests
- [ ] `execute('send_message', ...)` sends message via Governor CDP
- [ ] `detectLogin()` detects logged-in state via DOM indicators
- [ ] Recovery strategy: retry_selector works on first miss
- [ ] Recovery strategy: navigate_home redirects and retries
- [ ] Recovery strategy: mark_broken updates binding status
- [ ] Outcome recorded in outcome table after each execution
- [ ] Selector health updated (hit/miss counts)

## Gate
- `bunx tsc --noEmit` passes
- All tests pass with mocked Governor
