# Provider Onboarding Specification: [PROVIDER NAME]

**Feature Branch**: `[provider-onboarding-###-slug]`

**Created**: [DATE]

**Status**: Draft

**Input**: User description: "$ARGUMENTS" (e.g. "onboard chatgpt.com with full frontend capability")

## Goal

Onboard a new webapp provider so its streaming protocol, selectors, parser contract,
and frontend capabilities resolve end-to-end through the cap-store pipeline.

## Onboarding Mode Sequence (static phase map)

The DevOps onboarding controller decomposes the goal deterministically into:

1. **discover** — `ProtocolDiscoveryEngine` detects framework + composer/send-button selectors (CDP).
2. **infer** — `StreamingResponseAnalyzer` infers transport + delta schema + `logic_code`; compose `ManifestInferenceEngine`.
3. **test-selectors** — gate every seed selector against a live DOM (confidence ≥ 0.8).
4. **test-parse** — gate the inferred parser against captured traffic (confidence ≥ 0.7).
5. **test-cap** — execute the capability by slug via `/api/capabilities/:id/execute`.
6. **test-frontend** — mount canvas layer + invoke capability + assert DOM updated.
7. **verify** — `verify-cross-surface` (CLI/API/MCP/UI all resolve).
8. **converge** — `unifiedConverge` + unified gate; append convergence tasks on failure.

## User Scenarios & Testing

### User Story 1 - Provider discovered + selectors validated (Priority: P1)

**Independent Test**: `bun run devops runtime-test onboard discover --provider=<slug> --url=<url>` then `onboard test-selectors` returns all-pass.

**Acceptance Scenarios**:
1. **Given** a live provider page, **When** `discover` runs, **Then** composer + send-button selectors are returned with confidence.
2. **Given** a seed manifest, **When** `test-selectors` runs, **Then** every selector resolves in the DOM or the gate halts + logs a convergence task.

### User Story 2 - Parser contract verified (Priority: P1)

**Independent Test**: `bun run devops runtime-test onboard test-parse --provider=<slug>` parses captured stream blocks above threshold.

### User Story 3 - Full onboarding run (Priority: P2)

**Independent Test**: `bun run devops runtime-test onboard run --goal="onboard <url>" [--from=<phase>] [--resume]` completes all phases; ledger persists progress.

## Requirements

- **FR-001**: System MUST run each onboarding phase as a standalone mode AND as a sequence step.
- **FR-002**: System MUST persist phase state in a resumable ledger (`.runtime/onboard-ledger.json`).
- **FR-003**: System MUST halt + append a convergence task when a confidence gate fails (selector <0.8 / parser <0.7).
- **FR-004**: System MUST log every onboarding activity (LLM cmds, selectors, parse results) via `automationLog`.
- **FR-005**: System MUST NOT import `BunCdpClient` directly in new testers — use Governor/ProtocolDiscoveryEngine contract.

## Success Criteria

- **SC-001**: `onboard run` completes green: cross-surface resolves + converge gate passes.
- **SC-002**: A failed phase resumes via `--resume` without redoing completed phases.
- **SC-003**: Post-mortem: `queryActivity({ action: 'onboard.*' })` returns the full activity trace.

## Assumptions

- A live Chrome instance is available for discover/test-selectors/test-frontend.
- Captured stream traffic (`.runtime/capture-<provider>.txt`) exists for parser inference.
