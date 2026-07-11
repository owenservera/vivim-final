# Promoted Capabilities — Real Execution Verified

This ledger tracks capabilities that have been validated with real Chrome execution in the sandbox system.

## Format

- Date of verification
- Capability slug
- Action ID that drove it
- Human path verified
- Agent path verified
- Latency metrics
- Notes/best practices discovered

## Entries

| Date | Capability | Action ID | Human Path | Agent Path | Latency (ms) | Notes |
|------|------------|-----------|------------|------------|--------------|-------|
| - | - | - | - | - | - | - |

---

## Milestone Tracking

- **Milestone 1 (Executor Integration)** — Tests: `tests/integration/executor/`
- **Milestone 2 (Capability Execution)** — Tests: `tests/integration/capabilities/`
- **Milestone 3 (Sandbox Real Mode)** — Tests: `tests/integration/sandbox/`
- **Milestone 4 (Full Loop Verification)** — Tests: `tests/e2e/sandbox-full-loop.test.ts`