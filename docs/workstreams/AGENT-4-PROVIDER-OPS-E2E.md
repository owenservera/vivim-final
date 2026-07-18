# Agent 4 — Provider Operations & E2E Testing

**Workstream:** Provider Operations (Phase 103) + E2E Testing (Phase 107)
**Units:** 9
**Source:** `docs/roadmap/PRODUCTION-MASTER-PLAN-AUDIT.md`

---

## Context

The existing health dashboard (`health-dashboard.tsx`) and debug panel (`debug-panel.tsx`) work via polling — every 15s/10s/5s they fetch from the API. They don't receive live updates. The fleet tab shows slaves but offers no controls (restart, kill). The health dashboard doesn't show alerts, drift events, or circuit breaker state in real time.

Your mission: make provider operations live and actionable, then build the E2E test suite that proves everything works.

---

## Phase 103: Provider Operations (5 units)

### 103.1 — Health Dashboard Live Updates via WebSocket

**File:** `web/sandbox/src/features/health-dashboard.tsx`
**Depends:** — **Produces:** 103.1

**Problem:** Health dashboard polls every 15s (`setInterval(fetch, 15000)`). Provider health changes are invisible between polls.

**Fix:**
1. Add WebSocket subscription on mount:
   ```ts
   const ws = new WebSocket(`ws://${host}/ws`)
   ws.onopen = () => ws.send(JSON.stringify({ type: 'subscribe', entityType: 'provider', entityId: '*' }))
   ```
2. Listen for `provider:health_changed` events on the existing WebSocket
3. On event: update the specific provider's card in-place (no full re-render)
4. Animate the score change: smooth number transition (CSS transition or requestAnimationFrame)
5. Flash the card border green/red on status change for 2s
6. Keep the polling fallback (every 60s instead of 15s) for missed events

**Test Contract:**
- Page loads → initial data via HTTP
- `provider:health_changed` WS event → card updates without full page fetch
- Status change "healthy → degraded" → card flashes yellow

---

### 103.2 — Fleet Panel Per-Slave Controls

**File:** `web/sandbox/src/features/debug-panel.tsx`
**Depends:** — **Produces:** 103.2

**Problem:** Fleet tab shows slave list (read-only). No way to restart a crashed slave, kill a stuck one, or view its trace log.

**Fix:**
1. Add action buttons to each slave row:
   - **Restart** → `POST /api/fleet/{slaveId}/restart` (calls `governor.ensureRunning()`)
   - **Kill** → `POST /api/fleet/{slaveId}/kill` (calls `governor.kill()`)
   - **View Trace** → expands inline trace log panel (calls `GET /api/fleet/{slaveId}/trace`)
2. Backend routes: add to `conversation-router.ts` or create new fleet-specific routes:
   - `POST /api/fleet/{slaveId}/restart` → `governor.ensureRunning(slaveId)`
   - `POST /api/fleet/{slaveId}/kill` → `governor.kill(slaveId)`
   - `GET /api/fleet/{slaveId}/trace?limit=50` → `governor.getTrace(slaveId, limit)`
3. Confirmation dialog for Kill action ("This will close the browser. Continue?")
4. Disable Restart button while restart is in progress (show spinner)
5. Display slave uptime: `Date.now() - slave.createdAt` formatted as "2h 15m"

**Test Contract:**
- Click Kill → confirmation → slave removed from list
- Click Restart → spinner → slave status updates to 'running'
- Click View Trace → inline panel shows trace entries with timestamps

---

### 103.3 — Provider Health Alert Push

**File:** `src/engines/provider-health.ts`
**Depends:** — **Produces:** 103.3

**Problem:** `ProviderHealthKernel` computes health but only caches it. Status transitions (healthy→degraded, degraded→unhealthy) don't push to WebSocket proactively.

**Fix:**
1. In `ProviderHealthKernel.computeProvider()`: after computing new health, compare with cached
2. If status changed: emit `provider:health_changed` event on CapabilityEventBus
3. If status unchanged but score changed by >10: emit `provider:health_changed`
4. The existing `registerConversationForwarder` pattern in `websocket.ts` already forwards to subscribed clients — verify the event type is in the forwarder's subscription list
5. Add `provider:health_changed` to the forwarded event types if not present

**Verification:** Agent 1 test (103.1) confirms the frontend receives these events.

**Test Contract:**
- Change a provider's health status → event emitted on event bus
- Event has: `{ type: 'provider:health_changed', providerId, from, to, score }`

---

### 103.4 — Drift Detection Dashboard

**File:** `web/sandbox/src/features/health-dashboard.tsx`
**Depends:** 103.1 → **Produces:** 103.4

**Problem:** The health dashboard already shows drift counts (`h.drifts.recent / h.drifts.unresolved`) but doesn't show individual drifts or allow resolution.

**Fix:**
1. Add a "Drifts" tab or expandable section in the health dashboard
2. List unresolved drifts with: capabilityId, driftType, severity, detectedAt, description
3. Fetch from `GET /api/admin/drifts?providerId={id}` (or `oracle:scan` capability)
4. Add "Resolve" button per drift → `POST /api/admin/drifts/{id}/resolve`
5. Add "Dismiss" button per drift → marks as reviewed without DB change

**Backend routes (if not existing):**
- `GET /api/admin/drifts?providerId={id}` → from `registration-store.getUnresolvedDrifts()`
- `POST /api/admin/drifts/{id}/resolve` → from `registration-store.resolveDrift(id, 'user')`

**Test Contract:**
- Unresolved drifts appear in list
- Click Resolve → drift disappears
- Count updates in real-time

---

### 103.5 — Circuit Breaker Manual Override

**File:** `web/sandbox/src/features/debug-panel.tsx`, `src/engines/chrome-governor.ts`
**Depends:** — **Produces:** 103.5

**Problem:** Circuit breakers auto-open after N consecutive failures. No way to force-close a circuit breaker for testing or manual recovery.

**Fix:**

**Backend (chrome-governor.ts):**
1. Add method: `forceCircuitState(slaveId: string, state: 'closed' | 'open'): void`
2. Records the override in the circuit breaker state row with an `override_reason` field

**Frontend (debug-panel.tsx):**
1. In the fleet tab, next to circuit state badge, add a dropdown: "Force Close" / "Force Open" / "Auto"
2. Calls `POST /api/fleet/{slaveId}/circuit` body `{ state: 'closed' | 'open' | 'auto' }`
3. Shows "Manual Override" badge when circuit is in forced state
4. "Auto" reverts to normal circuit breaker behavior

**Backend route:** `POST /api/fleet/{slaveId}/circuit` → `governor.forceCircuitState(slaveId, state)`

**Test Contract:**
- Force open → circuit state changes to 'open' with override
- Force closed → circuit state changes to 'closed' with override
- Set to Auto → circuit resumes normal behavior (next failure/half-open transitions work)

---

## Phase 107: E2E Testing (4 units)

All tests use `bun:test` with the existing test infrastructure (`tests/e2e/`). Start the server once in `beforeAll`, tear down in `afterAll`.

### 107.1 — E2E: Full Send Pipeline

**File:** `tests/e2e/send-pipeline.test.ts` (NEW)
**Depends:** All phases → **Produces:** 107.1

**Test flow:**
1. `beforeAll`: start server on test port, seed providers, ensure at least one provider account exists
2. Test 1: Create conversation → `POST /api/conversations` → assert 201
3. Test 2: Send message → `POST /api/conversations/{id}/send` → assert `{ ok: true }` 
4. Test 3: Wait for response → poll `GET /api/conversations/{id}/messages` until assistant message appears
5. Test 4: Verify stream blocks → `GET /api/conversations/{id}/stream-blocks` → non-empty blocks array
6. Test 5: Delete conversation → `DELETE /api/conversations/{id}` → assert 200

**Note:** The send test requires a live Chrome slave with a logged-in provider account. If none is available:
- Test in "harness mode" (mock the CDP transport)
- Skip with `test.skip` and log "No live Chrome available for E2E send test"
- Or use the `SKIP_CHROME_INTEGRATION` env var pattern from `gate.ts`

**Time budget:** 30s for full pipeline.

---

### 107.2 — E2E: Provider Setup Wizard Flow

**File:** `tests/e2e/setup-wizard.test.ts` (NEW)
**Depends:** — **Produces:** 107.2

**Test flow (no Chrome needed — tests the API surface only):**
1. Test: `GET /api/setup/profiles` → returns profiles array
2. Test: `POST /api/setup/workspace` body `{ path }` → 200
3. Test: `GET /api/setup/workspace` → returns saved path
4. Test: `POST /api/setup/launch-visible` body `{ providerId, accountSlug, workspace }` → returns `{ debugPort, profileDir }`
   - This spawns Chrome. If no Chrome binary, skip.
5. Test: `POST /api/setup/verify` body `{ port, providerId }` → returns `{ loggedIn }`
6. Test: `POST /api/setup/complete` body `{ providerId, accountSlug, workspace, profileDir, debugPort }` → 200

---

### 107.3 — E2E: Canvas Layer Lifecycle

**File:** `tests/e2e/canvas-layers.test.ts` (NEW)
**Depends:** Phase 101 → **Produces:** 107.3

**Test flow (API-only — no browser for React Flow verification):**
1. Test: `GET /api/canvas/definitions` → returns definitions array
2. Test: `POST /api/canvas/layers` body `{ definitionId, layout: { x: 100, y: 200, w: 480, h: 360 } }` → returns `{ instanceId }`
3. Test: `GET /api/canvas/layers` → includes spawned instance
4. Test: `PATCH /api/canvas/layers/{instanceId}` body `{ layout: { x: 300, y: 400 } }` → 200
5. Test: Verify WebSocket event `canvas:layer:spawned` was emitted (subscribe via WS before spawn)
6. Test: `DELETE /api/canvas/layers/{instanceId}` → 200
7. Test: Verify WebSocket event `canvas:layer:dismissed` was emitted
8. Test: `GET /api/canvas/manifest` → returns manifest with oracle data

**WebSocket testing pattern:**
```ts
const ws = new WebSocket(`ws://localhost:${port}/ws`)
const events: any[] = []
ws.onmessage = (ev) => events.push(JSON.parse(ev.data))
ws.onopen = () => ws.send(JSON.stringify({ type: 'subscribe', entityType: 'canvas', entityId: '*' }))
// ... perform actions ...
await Bun.sleep(500) // wait for events
expect(events.some(e => e.type === 'canvas:layer:spawned')).toBe(true)
```

---

### 107.4 — E2E: Import/Export Roundtrip

**File:** `tests/e2e/import-export.test.ts` (NEW)
**Depends:** Phase 102 → **Produces:** 107.4

**Test flow:**
1. Test: Create a conversation with 3 messages
2. Test: `POST /api/export` body `{ format: 'json', scope: 'conversations' }` → returns JSON blob
3. Test: Parse JSON blob → verify structure: `{ version, exportedAt, conversations[], messages{} }`
4. Test: Delete the conversation
5. Test: Import the exported JSON via knowledge ingestion (if implemented by Agent 3)
   - Or: `POST /api/knowledge/ingest` with the exported JSON
6. Test: Verify the conversation + messages reappear

**If import not yet implemented:** Test only the export half (tests 1-3) and log "Import roundtrip pending Agent 3 import feature".

---

## Gate Checklist

```powershell
# Per unit
bun run typecheck                         # 0 errors
bun test tests/unit/<path>               # unit tests pass

# Final phase
bun run devops runtime-test health        # server + DB OK
bun test tests/e2e/send-pipeline.test.ts  # send pipeline works
bun test tests/e2e/setup-wizard.test.ts   # setup API works  
bun test tests/e2e/canvas-layers.test.ts  # canvas lifecycle works
bun test tests/e2e/import-export.test.ts  # import/export works

# Full suite
bun test                                   # all tests pass
```

## File Conflict Notes

**⚠️ `provider-health.ts`:** Agent 1 (106.4) also touches this file. Agent 1 adds a trust score signal in the `computeProvider()` method. Your change (103.3) adds alert push in the `start()`/`computeProvider()` lifecycle — specifically, compare old vs new status and emit `provider:health_changed`. These touch different sections. **Merge order:** Agent 1 edits first (adds trust score to scoring), Agent 4 edits second (adds event emission to compute method).

**No other shared files.** Your files: `health-dashboard.tsx`, `debug-panel.tsx`, `tests/e2e/*` — no other agent touches these.
