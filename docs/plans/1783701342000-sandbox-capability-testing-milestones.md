# PRD — Chrome-Faithful Testing Milestones

## Problem Statement

The vivim-final system currently has disconnected testing layers. Unit tests use mocks that don't validate real Chrome behavior. E2E tests mock the Governor, so they never exercise actual CDP commands. The sandbox frontend has UI components but execution is stubbed out. This creates a gap where code can pass all tests yet fail in real deployment because no testing layer validates the full path: human click → ActionRegistry dispatch → WebSocket command → Chrome spawn → CDP execution → result capture.

As a developer working on the capability-driven chat system, I need tests that run against real Chrome processes to validate that capabilities actually work in production. Without this, we cannot trust the system's core promise: agent-driven UI actions.

## Solution

Create a tiered testing milestone system that forces real Chrome execution at key delivery points:

1. **Executor Integration Tier** — FleetSupervisor can spawn/kill/talk to real Chrome
2. **Capability Execution Tier** — Capabilities execute via real CDP in browser context  
3. **Sandbox Real Mode Tier** — Frontend sandbox drives real backend with Chrome
4. **Full Loop Tier** — End-to-end verification that agents can perform every human action

Each tier is gated and must pass before proceeding. Tests gracefully skip when Chrome unavailable (local dev) but fail in CI.

## User Stories

1. As a developer, I want integration tests that spawn real Chrome, so that I can verify process lifecycle works before merging
2. As a developer, I want to test FleetSupervisor.spawn() actually launches Chrome, so that I can trust the boot sequence
3. As a developer, I want healthCheck() against real Chrome, so that I can verify CDP connectivity
4. As a developer, I want to kill and verify cleanup, so that Chrome zombies don't accumulate
5. As a QA engineer, I want capability execution tested in real browser, so that selectors work on live DOM
6. As a QA engineer, I want multiple provider capabilities tested, so that cross-provider compatibility is validated
7. As a frontend developer, I want sandbox UI to drive real backend, so that the action dispatch path is verified
8. As an agent user, I want to send agent:command via WebSocket, so that agents can trigger capabilities
9. As an agent user, I want agent:discover to list available actions, so that I can see what capabilities exist
10. As a product owner, I want B8 invariant enforced on sandbox features, so that no action exists that only humans can perform
11. As a CI system, I want tests to skip gracefully when Chrome missing, so that builds don't fail in minimal environments
12. As a CI system, I want tests to fail when Chrome present but execution breaks, so that regressions are caught
13. As a release manager, I want latency budgets enforced, so that capability execution meets performance targets
14. As a developer, I want the gate command to have --include-integration flag, so that I can opt into real testing
15. As a developer, I want the gate to report integration test metrics, so that I can track performance over time

## Implementation Decisions

- **Two-tier test structure**: `tests/unit/` for mocked/unit tests, `tests/integration/` for real Chrome tests
- **Integration tests use mock HTTP server**: A lightweight Bun server mimics Chrome DevTools endpoints for deterministic testing without real browser
- **Sandbox real mode uses Playwright**: Spins up the sandbox dev server and drives actions through the same path as humans
- **FleetSupervisor tests real spawn/kill**: Direct process management tests that verify actual Chrome launches
- **ActionRegistry dispatch is the single path**: Both UI click handlers and agent:command messages go through the same dispatch() function
- **Latency metrics collected**: Each real execution captures timing data for performance tracking
- **Graceful skip mechanism**: Tests check `CHROME_PATH` or `SKIP_INTEGRATION` env var, skip with warning if unavailable
- **Milestone gating**: `tests/integration/executor/` unlocks after executor porting complete, `tests/integration/capabilities/` unlocks after ConversationDriver, etc.
- **PROMOTED.md as evidence ledger**: Successful real capability executions recorded with their action IDs for audit trail

## Testing Decisions

- Good tests verify external behavior (spawn → Chrome running → kill → Chrome stopped), not internal state
- Modules to test with real Chrome: FleetSupervisor, ConversationDriver, SlaveWrite, CapabilityEngine
- Prior art: `tests/unit/executor/cdp-client.test.ts` uses Bun WebSocket server, `tests/e2e/` uses mock Governor
- Unit tests continue using mocks; integration tests use real-process mock (fake Chrome script that serves CDP endpoints)
- Each milestone has an "integration milestone" section in its atomic spec listing required real tests

## Out of Scope

- Testing with actual provider accounts (Claude.ai, ChatGPT, etc.) — uses local mock pages only
- Visual regression testing — covered by existing E2E screenshot tests
- Cross-platform Chrome binary testing — assumes Chromium works where Chrome works
- Concurrent multi-instance stress testing — sequential lifecycle tests sufficient for validation

## Further Notes

The key insight is distinguishing "mock CDP" (useful for unit tests) from "real Chrome process" (required for integration). The mock server at `tests/integration/helpers/chrome-mock.ts` provides deterministic CDP responses without needing a real browser binary for basic unit testing, while the FleetSupervisor integration tests validate the process lifecycle against actual Chrome.