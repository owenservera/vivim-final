# Architecture Risk Register — Phase 0

## Critical Risks

### R1: B1 Invariant Violation
- **Impact**: Architecture corruption
- **Likelihood**: Medium
- **Mitigation**: Lint rule banning `CDPTransport` imports outside `chrome-governor.ts`
- **Detection**: Static analysis in CI
- **Phase**: 2 (enforcement)

### R2: State Leakage Between Slaves
- **Impact**: Data cross-contamination
- **Likelihood**: Low
- **Mitigation**: Ownership manifesto + actor isolation
- **Detection**: Integration tests with parallel slaves
- **Phase**: 3

### R3: Profile Corruption
- **Impact**: Authentication loss
- **Likelihood**: Medium
- **Mitigation**: Reject profile swapping; pinned pools only
- **Detection**: Cookie file verification
- **Phase**: 4

## High Risks

### R4: DOM Race Conditions
- **Impact**: UI automation failures
- **Likelihood**: High (current)
- **Mitigation**: Resource-class scheduler with exclusive queues
- **Detection**: Trace timeline analysis
- **Phase**: 5

### R5: Single-Machine Limitation
- **Impact**: Cannot scale beyond one server
- **Likelihood**: Certain (architectural)
- **Mitigation**: Distributed worker architecture
- **Detection**: Load testing at capacity
- **Phase**: 10

### R6: Recovery Strategy Uniformity
- **Impact**: Suboptimal crash recovery
- **Likelihood**: High (current)
- **Mitigation**: Failure-class-specific recovery
- **Detection**: Fault injection tests
- **Phase**: 9

## Medium Risks

### R7: Feature Flag Accumulation
- **Impact**: Technical debt
- **Likelihood**: Certain (during refactor)
- **Mitigation**: Phase 12 legacy removal
- **Detection**: Flag count tracking
- **Phase**: 12

### R8: Observability Gap
- **Impact**: Cannot measure phase improvements
- **Likelihood**: Low (Phase 1 addresses)
- **Mitigation**: Phase 1 observability foundation
- **Detection**: KPI measurement
- **Phase**: 1

### R9: Event Ordering
- **Impact**: State reconstruction errors
- **Likelihood**: Low
- **Mitigation**: Timestamp-ordered event bus
- **Detection**: Replay tests
- **Phase**: 7-8
