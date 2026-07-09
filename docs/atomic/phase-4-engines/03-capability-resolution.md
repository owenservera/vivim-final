# Unit 4.3: CapabilityResolutionEngine

**Phase:** 4 | **File:** `src/engines/capability-resolution.ts`
**Depends:** 1.4 CapStoreDb | **Produces:** Resolved UI contracts for capabilities
**Source:** `04-merged-engines.md` §6

## Purpose
Resolve capability UI contracts for a given provider and plan tier. Applies the 3-layer override chain: global defaults → plan tier overrides → provider overrides. Read-only SQL engine — no writes.

## Interface
```typescript
type PlanTier = 'free' | 'pro' | 'max' | 'enterprise';

class CapabilityResolutionEngine {
  constructor(private store: CapabilityResolutionStore) {}

  async resolve(
    providerId: string,
    planTier: PlanTier,
    opts?: CapabilityResolutionOptions,
  ): Promise<ResolvedCapabilities>;

  async search(
    providerId: string,
    planTier: PlanTier,
    query: string,
  ): Promise<ResolvedCapabilities>;
}

interface ResolvedCapabilities {
  composer: ResolvedCapability[];
  header: ResolvedCapability[];
  message: ResolvedCapability[];
  sidebar: ResolvedCapability[];
  inline: ResolvedCapability[];
  total: number;
  resolvedAt: number;
}

interface ResolvedCapability {
  id: string;
  slug: string;
  name: string;
  category: string;
  // UI contract (21 fields + 10 vCode)
  uiComponent: string;
  uiLabel: string;
  uiIcon: string;
  uiPosition: string;
  uiOrder: number;
  uiGroup: string;
  uiLayerDepth: number;
  parentCapabilityId: string | null;
  uiPriority: string;
  interactionMode: string;
  uiStates: string[];
  uiVisibilityRule: string | null;
  existentialRule: string | null;
  uiInputSchema: Record<string, unknown>;
  mutationEffects: Record<string, unknown>;
  recoveryBehavior: string;
  statePersistence: string;
  dataFlow: string;
  minPlanTier: PlanTier;
  dependsOn: string[];
  // vCode fields
  concurrencySafe: boolean;
  opClassification: string | null;
  requiresUserConfirmation: boolean;
  maxResultSize: number;
  resultComponent: string;
  resultLayout: string;
  searchHints: string[];
  aliases: string[];
  availability: AvailabilityGating;
  prefetch: boolean;
  // Override sources
  overrideSources: Record<string, 'global' | 'tier' | 'provider'>;
  // Binding context
  bindingStatus: string;
  bindingConfidence: number;
  // Plan tier overrides
  tierOverrides: { maxModels?: number; maxFileSize?: number; maxOptions?: number; customConfig?: Record<string, unknown> };
}
```

## 3-Layer Override Chain
```
Global default (capability_taxonomy)
  → Plan tier override (capability_tier)
    → Provider override (provider_capability)

COALESCE(pc.override, ctr.override, ct.default) AS final_value
CASE WHEN pc.override IS NOT NULL THEN 'provider'
     WHEN ctr.override IS NOT NULL THEN 'tier'
     ELSE 'global' END AS override_source
```

## Resolution SQL
Full COALESCE/CASE query in `04-merged-engines.md` §6 (~70 lines). Joins capability_taxonomy, capability_binding, capability_tier, provider_capability. GROUP BY ui_position.

## Filtering Logic (post-SQL)
1. Plan tier gating — exclude if min_plan_tier exceeds account's plan tier
2. Existential rule evaluation — exclude if existential_rule not satisfied
3. Dependency satisfaction — exclude if depends_on capabilities have no active binding
4. Search filtering — match against search_hints_json and name

## Store Contract
```typescript
interface CapabilityResolutionStore {
  resolveCapabilities(providerId: string, planTier: string): Promise<RawResolutionRow[]>;
  getActiveBindings(providerId: string): Promise<string[]>;
  searchCapabilities(providerId: string, planTier: string, query: string): Promise<RawResolutionRow[]>;
}
```

## Tests
- [ ] `resolve('claude', 'free')` returns capabilities grouped by position
- [ ] Provider overrides take precedence over tier overrides over global defaults
- [ ] Plan tier gating excludes pro-gated capabilities for free tier
- [ ] Existential rule filters capabilities not relevant to current context
- [ ] `search('claude', 'free', 'model')` returns model-related capabilities
- [ ] Override sources tracked correctly per field

## Gate
- `bunx tsc --noEmit` passes
- All tests pass with seeded test data
- Resolution completes in <5ms (used in ConversationManager step 1)
