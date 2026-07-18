# Quickstart: Production Hardening & Sovereign Trust

**Feature**: 001-production-hardening  
**Date**: 2025-07-17  

## Prerequisites

- Bun runtime (`bun --version`)
- PowerShell 7+ (`pwsh --version`)
- Project dependencies installed (`bun install`)
- Test database seeded (`bun run db:setup`)

## Validation Scenarios

### 1. Verify Invariant Baseline

```powershell
# Run invariant check — must return 0 Category B violations
bun run devops invariants check --category B
```

**Expected**: Exit code 0, no B1 or B7 violations.

---

### 2. Verify P0 Audit Baseline

```powershell
# Run source-code audit at standard depth
bun run devops audit-code standard
```

**Expected**: 0 P0 findings.

---

### 3. Test ConsentEngine

```powershell
# Run consent engine unit tests
bun test tests/unit/engines/consent-engine.test.ts
```

**Expected scenarios**:
- `check()` denies `financial` when threshold is `write`
- `grant()` + `check()` allows previously-denied operation
- `revoke()` + `check()` denies after revocation
- `isAllowed('read')` returns true with default config

---

### 4. Test TrustScoreEngine

```powershell
# Run trust score engine unit tests
bun test tests/unit/engines/trust-score.test.ts
```

**Expected scenarios**:
- Perfect provider (all successes) → score ≥ 90
- Failing provider (all failures) → score ≤ 20
- Mixed provider → score between 30-70
- Missing data provider → score ~50 (default fallback)

---

### 5. Verify Consent Gate Wiring

```powershell
# Test that write-classified capabilities are gated
bun test tests/unit/engines/capability-bootstrap.test.ts
```

**Expected**:
- Capabilities with classification `write|destructive|financial` reject when consent denies
- Capabilities with classification `read` proceed without consent check

---

### 6. Verify Trust Score in Health Kernel

```powershell
# Test that ProviderHealthKernel includes trust score signal
bun test tests/unit/engines/provider-health.test.ts
```

**Expected**:
- Health report includes `trust_score` signal at 10% weight
- When TrustScoreEngine unavailable, trust_score defaults to 50
- Status thresholds: ≥80 healthy, ≥50 degraded, <50 unhealthy

---

### 7. HITL Gate UI Smoke Test

```powershell
# Start server and test HITL gate UI (no browser)
bun test tests/e2e/smoke.test.ts
```

**Expected**: All endpoint assertions pass (/health, /readyz, /api/capabilities, etc.)

---

### 8. Cross-Surface Verification

```powershell
# Verify all capabilities resolve across CLI/API/MCP/UI
bun run devops verify-cross-surface
```

**Expected**: Exit code 0, all capabilities resolve.

---

### 9. Full Test Suite

```powershell
# Run all tests
bun test

# Run typecheck
bun run typecheck

# Run lint
bun run lint
```

**Expected**: All pass, 0 type errors, 0 lint warnings, ≥80% engine coverage.

---

### 10. CHANGELOG Verification

```powershell
# Check CHANGELOG Phase 31 entries
Select-String -Path CHANGELOG.md -Pattern "Phase 31|ConsentEngine|TrustScoreEngine" -Context 0,2
```

**Expected**: CHANGELOG Phase 31 reflects actual state: ConsentEngine ✅, TrustScoreEngine ✅, DataResidencyEngine ❌, RightToBeForgottenEngine ❌, AuditTrailEngine ✅, BreachNotificationEngine ❌.
