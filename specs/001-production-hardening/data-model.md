# Data Model: Production Hardening & Sovereign Trust

**Feature**: 001-production-hardening  
**Date**: 2025-07-17  

## Entity Definitions

### ConsentRecord

Represents a time-bounded consent grant for a specific operation classification.

| Field | Type | Description |
|-------|------|-------------|
| target | string | The entity the consent applies to (e.g. capability ID, provider ID) |
| classification | string | Operation classifier: `read`, `write`, `navigate`, `destructive`, `financial`, `communication` |
| grantedAt | number | Unix timestamp (ms) when consent was granted |
| expiresAt | number | Unix timestamp (ms) when consent expires |

**Source**: `src/engines/consent-engine.ts:16-21` (`ConsentGrant` interface)  
**Storage**: In-memory `Map<string, ConsentGrant>` with optional `ConsentStore` for persistence  
**State transitions**: `none → granted → expired` (auto-expiry based on timestamp comparison)

### TrustFactor

A single weighted signal contributing to the overall trust score.

| Field | Type | Description |
|-------|------|-------------|
| name | string | Factor name (e.g. "success_rate", "latency") |
| weight | number | Weight in the composite score (total = 100) |
| value | number | Raw value (0-100) |
| contribution | number | `(value / 100) * weight` — weighted contribution |
| detail | string | Human-readable explanation of the value |

**Source**: `src/engines/trust-score.ts:13-18` (`TrustFactor` interface)  
**Weights** (from `trust-score.ts:37-44`):
| Factor | Weight |
|--------|--------|
| successRate | 40% |
| latency | 20% |
| selectorHealth | 15% |
| circuitState | 10% |
| authFreshness | 10% |
| driftStatus | 5% |

### TrustReport

Complete trust assessment for a provider.

| Field | Type | Description |
|-------|------|-------------|
| providerId | string | Provider identifier |
| overallScore | number | Weighted composite score (0-100) |
| factors | TrustFactor[] | Individual factor breakdown |
| computedAt | number | Unix timestamp (ms) |

**Source**: `src/engines/trust-score.ts:20-25` (`TrustReport` interface)

### ProviderHealth

Health aggregation from 8 signals (7 original + trust score).

| Field | Type | Description |
|-------|------|-------------|
| status | `healthy\|degraded\|unhealthy\|unknown` | Derived from score thresholds |
| score | number | Weighted composite (0-100) |
| signals | ProviderSignal[] | Individual signal breakdown |
| updatedAt | number | Unix timestamp (ms) |
| parsers | { confidenceAvg, emptyStreamRatio1h } | Parser health group |
| capabilities | { selectorHitRate, prospectCount } | Capability health group |
| fleet | { running, stopped, error } | Chrome slave fleet group |
| circuitBreakers | { open, total } | Circuit breaker group |
| drifts | { recent, unresolved } | Registration drift group |

**Source**: `src/engines/provider-health.ts:30-49` (`ProviderHealth` interface)  
**Thresholds**: ≥80 healthy, ≥50 degraded, <50 unhealthy, no data = unknown

### ProviderSignal

A single signal in the health scoring model.

| Field | Type | Description |
|-------|------|-------------|
| signal | string | Signal name |
| weight | number | Weight in composite (total = 100) |
| value | number | Raw value (0-100) |
| contribution | number | Weighted contribution |
| detail | string | Human-readable explanation |

**Source**: `src/engines/provider-health.ts:22-29` (`ProviderSignal` interface)  
**Signal weights** (from `provider-health.ts:52-61`):
| Signal | Weight |
|--------|--------|
| parserConfidence | 25% |
| emptyStreams1h | 15% |
| selectorHitRate | 20% |
| chromeLiveness | 10% |
| sessionExpiry | 5% |
| circuitBreaker | 10% |
| drift24h | 5% |
| trustScore | 10% |

### HITLGate

Human-in-the-loop gate for autonomous execution consent.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Gate identifier |
| prompt | string | Question/request to display |
| options | string[] | Available choices |
| gateType | `confirm\|question\|input` | Gate interaction type |
| expiresAt | number | Unix timestamp (ms), optional |
| status | `pending\|resolved\|expired` | Current state |

**Source**: Spec-defined; UI at `web/sandbox/src/features/hitl-gate.tsx`  
**API**: `GET /api/autonomous/gates/pending`, `POST /api/autonomous/gates/{id}/resolve`

## Database Tables (Existing, Read-Only for This Feature)

TrustScoreEngine reads from existing Prisma tables:

| Table | Used For |
|-------|----------|
| `outcome` | Success/fail counts for `successRate` factor |
| `selector_strategy` | Hit/miss counts for `selectorHealth` factor |
| `circuit_breaker_state` | Open/half-open/closed for `circuitState` factor |
| `provider_account` | Last login timestamp for `authFreshness` factor |
| `manifest_drift` | Unresolved drift count for `driftStatus` factor |

No new DB tables are required for this feature.
