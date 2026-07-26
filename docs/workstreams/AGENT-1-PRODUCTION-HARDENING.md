# Agent 1 — Production Hardening & Sovereign Trust

**Workstream:** Production Hardening (Phase 100) + Sovereign Trust (Phase 106)
**Units:** 12
**Source:** `docs/roadmap/PRODUCTION-MASTER-PLAN-AUDIT.md`

---

## Context

The codebase has 16 invariant categories enforced by `bun run devops invariants check`. Category B violations are hard blocks at the gate. Currently:

- **B1 violation:** `cdp-capability-registrar.ts` imports `BunCdpClient` directly (Governor Canon)
- **B7 violations:** 8 engine files use raw `new Error()` instead of custom error classes from `src/errors.ts`
- **Phase 31 engines** listed in CHANGELOG as "done" but don't exist: `ConsentEngine`, `TrustScoreEngine`, `RightToBeForgottenEngine`, `BreachNotificationEngine`

Your mission: fix all P0 violations, build the actual sovereign trust engines for real, and prove the system works with a smoke test harness.

---

## Phase 100: Production Hardening (7 units)

### 100.1 — Fix B1 Governor Canon Violation

**File:** `src/engines/cdp-capability-registrar.ts`
**Depends:** — **Produces:** 100.1

**Problem:** This file imports `BunCdpClient` directly. Only `ChromeGovernor` is allowed to touch CDP.

**Fix:**
1. Read `cdp-capability-registrar.ts` to understand what it does with `BunCdpClient`
2. If it discovers CDP methods: refactor to use the existing `ChromeGovernor.cdp` proxy (the `CDPTransport` interface already wraps `BunCdpClient`)
3. If it's purely declarative (listing CDP protocol methods without connecting): mark as exempt in invariants.ts (like `cdp-discovery.ts` and `protocol-discovery.ts` which are already exempt)
4. Run `bun run devops invariants check --category B` after fix — must return 0 B1 violations

**Test Contract:** Unit test verifying the file no longer imports `BunCdpClient` (grep-based test). If exempt, test that the exemption is documented.

---

### 100.2 — Fix B7 Raw Error Violations

**Files:** 8 engine files (identified by invariants audit)
**Depends:** — **Produces:** 100.2

**Problem:** Raw `new Error()` calls in engines. Per AGENTS.md: "Use custom error classes from `src/errors.ts`"

**Fix:**
1. Run `bun run devops invariants check --category B` to get the current B7 file list
2. For each file, replace `throw new Error(...)` with the appropriate class from `src/errors.ts`:
   - `new Error('...not found')` → `new NotFoundError(...)`
   - `new Error('...invalid...')` → `new ValidationError(...)`
   - `new Error('...engine...')` → `new EngineError(...)`
   - `new Error('...already exists')` → `new ConflictError(...)`
3. Import the custom error class in the file
4. Run `bun test tests/unit/engines/<name>.test.ts` for each changed file

**Test Contract:** Run invariants check after all fixes — B7 violations must go to 0.

---

### 100.3 — Fix P0 Source-Audit Findings

**Files:** Various (identified by audit)
**Depends:** — **Produces:** 100.3

**Problem:** `bun run devops audit-code standard` returns P0 findings.

**Fix:**
1. Run the audit: `bun run devops audit-code standard`
2. For each P0 finding: apply the fix instructions in the report
3. For auto-fixable findings: `bun run devops audit-code fix <id> --apply`
4. Re-run audit until P0 count = 0

**Test Contract:** `bun run devops audit-code standard` → 0 P0 findings.

---

### 100.4 — Wire Consent Gate to Capability Execution

**File:** `src/engines/capability-bootstrap.ts`
**Depends:** — **Produces:** 100.4

**Problem:** The autonomous execution engine has a `consentCheck` callback but individual capabilities don't gate on consent.

**Fix:**
1. Identify capabilities with `classification: 'write' | 'destructive' | 'financial' | 'communication'` in `capability-bootstrap.ts`
2. For each: wrap the handler with a consent check. Pattern:
   ```ts
   async (input) => {
     // consent gate: skip for read ops, check for write ops
     return services.governor.someMethod(...)
   }
   ```
3. The existing `ConsentViolationError` class in `src/errors.ts` can be thrown when consent is denied

**Test Contract:** Unit test: capability with `classification: 'write'` rejects when consent check returns false. Capability with `classification: 'read'` proceeds normally.

---

### 100.5 — Frontend Smoke Test Harness

**File:** `tests/e2e/smoke.test.ts` (NEW)
**Depends:** — **Produces:** 100.5

**Problem:** No automated test that verifies all frontend views render without errors.

**Fix:**
1. Create a smoke test that:
   a. Starts the server (use the existing test DB pattern from `tests/integration/`)
   b. Fetches the sandbox HTML (`GET /`) and asserts 200
   c. Fetches capability list (`GET /api/capabilities?surface=ui`) and asserts non-empty
   d. Fetches health (`GET /health`) and asserts status: ok
   e. Fetches readiness (`GET /readyz`) and asserts status: ready
2. Does NOT require a browser — pure HTTP assertions

**Test Contract:** `bun test tests/e2e/smoke.test.ts` → all assertions pass.

---

### 100.6 — Cross-Surface Parity Verification

**File:** No new file — runs existing tool
**Depends:** 100.1, 100.2 → **Produces:** 100.6

**Problem:** The plan claims 50 capabilities. Must verify every one resolves across CLI, API, MCP, and UI.

**Fix:**
1. Run `bun run devops verify-cross-surface`
2. If any capability fails: trace the failure through the taxonomy chain
3. Common failures and fixes:
   - Missing `cliCommand.name` → add it to the capability definition
   - Missing `mcpToolName` → add it
   - Missing `apiEndpoint.path` → add it
   - UI slot ID mismatch → check `SLOT_IDS` in `frontend/src/ui/slots.ts`
4. Re-run until all 50 resolve

**Gate:** `bun run devops verify-cross-surface` → exit code 0.

---

### 100.7 — Correct CHANGELOG Phase 31 Entries

**File:** `CHANGELOG.md`
**Depends:** — **Produces:** 100.7

**Problem:** CHANGELOG claims Phase 31 (Sovereign Operating Trust) implemented 6 engines. Only `consentCheck` callback exists in autonomous-execution.ts. The other 5 engines have zero files.

**Fix:**
1. Edit the CHANGELOG Phase 31 section:
   - Mark `ConsentEngine` as `⚠️ PARTIAL — consent check callback exists in autonomous-execution.ts; full engine pending Phase 106`
   - Mark `DataResidencyEngine` as `❌ NOT IMPLEMENTED`
   - Mark `AuditTrailEngine` as `✅ EXISTS — src/engines/audit-trail.ts`
   - Mark `RightToBeForgottenEngine` as `❌ NOT IMPLEMENTED`
   - Mark `TrustScoreEngine` as `❌ NOT IMPLEMENTED — pending Phase 106`
   - Mark `BreachNotificationEngine` as `❌ NOT IMPLEMENTED`
2. Add a note: "Corrected via audit 2026-07-17"

---

## Phase 106: Sovereign Trust (5 units)

### 106.1 — Build ConsentEngine

**File:** `src/engines/consent-engine.ts` (NEW)
**Depends:** 100.4 → **Produces:** 106.1

**Build:**
1. Create `src/engines/consent-engine.ts`
2. Define interface:
   ```ts
   export interface ConsentConfig {
     defaultDeny: boolean
     allowedDomains: string[]
     requireApprovalAbove: 'read' | 'write' | 'navigate' | 'destructive' | 'financial'
   }
   export class ConsentEngine {
     constructor(private config: ConsentConfig) {}
     async check(operation: { classification: string; target: string }): Promise<boolean>
     async grant(operation: { classification: string; target: string }, duration: number): Promise<void>
     async revoke(target: string): Promise<void>
     isAllowed(classification: string): boolean
   }
   ```
3. Implement `check()`: if classification exceeds `requireApprovalAbove`, return false unless previously granted
4. Implement `grant()`: store consent in memory (and later DB-backed via ConsentStore contract)
5. Implement `isAllowed()`: check classification against threshold

**Store Contract:** `src/storage/contracts/consent-store.ts` (NEW)
**Store Impl:** `src/storage/impl/consent-store-impl.ts` (NEW) — in-memory for now, Prisma-backed later

**Test Contract:**
- `check()` denies `financial` when threshold is `write`
- `grant()` + `check()` allows previously-denied operation
- `revoke()` + `check()` denies after revocation
- `isAllowed('read')` returns true with default config

---

### 106.2 — Build TrustScoreEngine

**File:** `src/engines/trust-score.ts` (NEW)
**Depends:** — **Produces:** 106.2

**Build:**
1. Create `src/engines/trust-score.ts`
2. Define interface:
   ```ts
   export interface TrustFactor {
     name: string
     weight: number
     value: number  // 0-100
   }
   export class TrustScoreEngine {
     async computeProviderScore(providerId: string): Promise<number> // 0-100
     async computeOperationScore(providerId: string, capabilityId: string): Promise<number>
     async recordOutcome(providerId: string, capabilityId: string, ok: boolean, latencyMs: number): Promise<void>
     async getFactors(providerId: string): Promise<TrustFactor[]>
   }
   ```
3. Scoring model (from design doc §33.5):
   - Success rate (40%): `successCount / (successCount + failCount)`
   - Latency performance (20%): below p95 budget = full, over = degraded
   - Selector health (15%): `hitCount / (hitCount + missCount)`
   - Circuit state (10%): closed = 100, half_open = 50, open = 0
   - Auth freshness (10%): last login within 24h = 100
   - Manual reviews (5%): no unresolved drifts = 100

**Store Contract:** `src/storage/contracts/trust-store.ts` (NEW)
**Store Impl:** Use existing `outcome` table for success/fail counts. Use existing `selector_strategy` table for hit/miss counts.

**Test Contract:**
- Perfect provider (all successes, low latency) → score ≥ 90
- Failing provider (all failures) → score ≤ 20
- Mixed provider → score between 30-70

---

### 106.3 — Wire Consent Gate to All Classified Capabilities

**File:** `src/engines/capability-bootstrap.ts`
**Depends:** 106.1 → **Produces:** 106.3

**Build:**
1. Instantiate `ConsentEngine` with default config in `registerDefaultCapabilities`
2. Wrap every capability with `classification: 'write' | 'destructive' | 'financial'` with consent check:
   ```ts
   async (input) => {
     const allowed = await consentEngine.check({ classification: 'write', target: 'provider' })
     if (!allowed) throw new ConsentViolationError('provider', 'User consent required')
     return originalHandler(input)
   }
   ```
3. Capabilities to gate: `conversation:send`, `conversation:delete`, `memory:assert`, `user:delete_profile`, `admin:seed`, `admin:db_reset`, `discovery:run`, `oracle:heal`

**Test Contract:** Each gated capability rejects when consent denies, succeeds when consent grants.

---

### 106.4 — Wire Trust Scoring to ProviderHealthKernel

**File:** `src/engines/provider-health.ts`
**Depends:** 106.2 → **Produces:** 106.4

**Build:**
1. Add `TrustScoreEngine` as optional dependency to `ProviderHealthKernelOptions`
2. Add trust score as an 8th signal in the weighting model:
   - Existing: parser confidence (30), empty streams (20), selector hit rate (20), Chrome liveness (10), session expiry (5), circuit breaker (10), drift 24h (5)
   - NEW: trust score (10%) — reduce parser confidence to 25%, empty streams to 15% to keep 100% total
3. In `computeProvider()`: fetch trust score from trust engine, compute contribution
4. Emit `provider:trust_changed` event on significant trust score transitions (>10 point delta)

**Test Contract:** Health score includes trust factor. Changing trust score changes health score proportionally.

---

### 106.5 — HITL Gate UI

**File:** `web/sandbox/src/features/hitl-gate.tsx` (NEW)
**Depends:** — **Produces:** 106.5

**Build:**
1. Create a modal component that renders when `hitlGate` has `status: 'pending'`
2. Props: `gate: { prompt, options[], gateType, expiresAt }`
3. Shows: prompt text, option buttons (or input field for `question`/`input` gate types)
4. On user action: calls `POST /api/autonomous/gates/{id}/resolve` with the chosen response
5. Auto-expires: shows countdown if `expiresAt` is set
6. Register a WebSocket listener for `autonomous:gate_created` events to show the modal

**API contract (existing):**
- `GET /api/autonomous/gates/pending` → returns pending gates
- `POST /api/autonomous/gates/{id}/resolve` body `{ response: string }` → resolves gate

**Test Contract:**
- Renders prompt text
- Clicking an option calls resolve API
- Expired gate shows "expired" state

---

## Gate Checklist

Run before marking each unit done:

```powershell
# Per unit
bun run typecheck              # 0 errors in touched files
bun test tests/unit/<path>     # tests pass
bun run lint                   # 0 new warnings

# Per phase
bun run devops invariants check --category B  # 0 block violations
bun run devops audit-code standard             # 0 P0

# Final
bun test                        # all tests pass
bun run devops verify-cross-surface  # all caps resolve
```

## File Conflict Notes

**⚠️ `capability-bootstrap.ts`:** Agent 3 also touches this file. Add consent wrapping to individual capabilities' handlers. Do NOT move or reorder the array entries. Agent 3 adds new entries at the bottom. Merge order: Agent 3 first (adds caps), then Agent 1 (wraps handlers).

**⚠️ `provider-health.ts`:** Agent 4 also touches this file. Agent 1 adds trust score signal in the `computeProvider()` method. Agent 4 adds alert push in the `start()`/`stop()` lifecycle. These touch different methods — standard diff merge works.
