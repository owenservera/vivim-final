# Unit 4.23: Router subsystem (multi-provider dispatch)

**Phase:** 4 | **File:** `src/router/` (dispatch, correlator, executor, tracker)
**Depends:** 3.6 ConversationManager, 3.7 CapabilityEventBus, 4.3 CapabilityResolutionEngine | **Produces:** Multi-provider dispatch router
**Source:** `01-merged-epic.md` (survivor: `src/router/`), `03-merged-schema.md` §L12 (`route_spec`, `route_request`, `route_target`, `route_event`)

## Purpose
Ported survivor component. A multi-provider dispatch router. A `route_spec` binds a `(provider, capability)` pair to one or more `route_target`s (each a `provider_id`/`account_id` with a `priority`). When `route()` is called, the router creates a `route_request`, selects the highest-priority active target, dispatches the request through the injected `RouteDispatcher` (which delegates to ConversationManager for the chosen provider/account), and records `route_event`s for each lifecycle transition. The correlator/tracker halves keep request↔event lineage.

This is a v1 cross-cutting engine (L12 Transfer & Routing). It is the consumer side that decides *where* a capability send is routed when multiple providers/accounts can satisfy it.

## Interface
```typescript
interface RouteInput {
  capabilityId: string;
  providerId: string;          // the spec's owning provider (capability owner)
  conversationId?: string;
  payload: unknown;            // forwarded to the chosen target's ConversationManager.send
}

interface RouteResult {
  requestId: string;
  targetProviderId: string;
  targetAccountId: string | null;
  ok: boolean;
  error?: string;
}

interface RouteDispatcher {
  dispatch(target: RouteTargetRow, input: RouteInput): Promise<{ ok: boolean; error?: string }>;
}

class Router {
  constructor(
    private store: RouterStore,
    private dispatcher: RouteDispatcher,
    private eventBus: CapabilityEventBus,
  ) {}

  async route(input: RouteInput): Promise<RouteResult>;
  async defineSpec(input: Omit<RouteSpecRow, 'id' | 'createdAt' | 'updatedAt'>): Promise<RouteSpecRow>;
  async addTarget(specId: string, input: Omit<RouteTargetRow, 'id' | 'createdAt'>): Promise<RouteTargetRow>;
  async listRequests(specId: string, opts?: { limit?: number }): Promise<RouteRequestRow[]>;
  async getEvents(requestId: string): Promise<RouteEventRow[]>;
}
```

## Store Contract
```typescript
interface RouterStore {
  listSpecs(opts?: { providerId?: string; capabilityId?: string; activeOnly?: boolean }): Promise<RouteSpecRow[]>;
  getSpec(id: string): Promise<RouteSpecRow | null>;
  createSpec(input: RouteSpecRow): Promise<RouteSpecRow>;
  updateSpec(id: string, patch: Partial<RouteSpecRow>): Promise<void>;
  deleteSpec(id: string): Promise<void>;
  listTargets(specId: string): Promise<RouteTargetRow[]>;
  createTarget(input: RouteTargetRow): Promise<RouteTargetRow>;
  updateTarget(id: string, patch: Partial<RouteTargetRow>): Promise<void>;
  createRequest(input: RouteRequestRow): Promise<RouteRequestRow>;
  updateRequest(id: string, patch: Partial<RouteRequestRow>): Promise<void>;
  createEvent(input: RouteEventRow): Promise<RouteEventRow>;
}
```

## Tests
- [ ] `route()` selects the highest-priority active `route_target`
- [ ] `route()` writes a `route_request` then a `route_event` per lifecycle step
- [ ] `route()` returns `ok: false` and records an error event when the dispatcher fails
- [ ] Inactive spec / inactive target is skipped during selection
- [ ] `defineSpec()` + `addTarget()` round-trip through `RouterStore`
- [ ] `getEvents()` returns events ordered by `ts` for a request

## Gate
- `bunx tsc --noEmit` passes
- All tests pass with mocked `RouterStore` + `RouteDispatcher` + `CapabilityEventBus`
- Selection logic is deterministic by `priority` then insertion order
