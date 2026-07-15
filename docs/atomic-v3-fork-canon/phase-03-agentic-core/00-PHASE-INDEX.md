# Phase 3: Agentic Core

**Source:** v3 Phase 2 (`docs/atomic-v3/phase-02-agentic-core/`)
**Units:** 15 | **Done:** 5 (3.11-3.15) | **Exists:** 6 (3.1-3.10) | **Pending:** 4 (3.13 pending)
**Dependencies:** Phase 2 (KernelRegistry for registration calls)

> **Note:** IntentDecomposer/CapabilityComposer/LiveCapabilityRegistry were not implemented as named classes. Their functionality was absorbed into the NLCL resolver stack (`src/engines/nlcl/intent-resolver.ts`, `unified-registry.ts`). `SandboxRunner` standalone class not implemented.

## Units

| Fork ID | v3 ID | Name | Status | File |
|---------|-------|------|--------|------|
| 3.1 | 2.1 | IntentDecomposer template strategy | `[~]` | `docs/atomic-v3/phase-02-agentic-core/2.1-intent-templates.md` |
| 3.2 | 2.2 | IntentDecomposer LLM strategy | `[~]` | `docs/atomic-v3/phase-02-agentic-core/2.2-intent-llm.md` |
| 3.3 | 2.3 | IntentDecomposer clarification flow | `[~]` | `docs/atomic-v3/phase-02-agentic-core/2.3-intent-clarify.md` |
| 3.4 | 2.4 | CapabilityComposer DAG definition + execution | `[~]` | `docs/atomic-v3/phase-02-agentic-core/2.4-composer-dag.md` |
| 3.5 | 2.5 | CapabilityComposer recursive composition + versioning | `[~]` | `docs/atomic-v3/phase-02-agentic-core/2.5-composer-recursive.md` |
| 3.6 | 2.6 | CapabilityComposer surface export | `[~]` | `docs/atomic-v3/phase-02-agentic-core/2.6-composer-surfaces.md` |
| 3.7 | 2.7 | LiveCapabilityRegistry storage + load | `[~]` | `docs/atomic-v3/phase-02-agentic-core/2.7-live-cap-store.md` |
| 3.8 | 2.8 | LiveCapabilityRegistry inline handler sandbox | `[~]` | `docs/atomic-v3/phase-02-agentic-core/2.8-live-cap-sandbox.md` |
| 3.9 | 2.9 | LiveCapabilityRegistry MCP handler | `[~]` | `docs/atomic-v3/phase-02-agentic-core/2.9-live-cap-mcp.md` |
| 3.10 | 2.10 | LiveCapabilityRegistry HTTP handler | `[~]` | `docs/atomic-v3/phase-02-agentic-core/2.10-live-cap-http.md` |
| 3.11 | 2.11 | AgenticConversationLoop cycle engine | `[x]` | `docs/atomic-v3/phase-02-agentic-core/2.11-agentic-loop.md` |
| 3.12 | 2.12 | AgenticConversationLoop integration w/ ConversationManager | `[x]` | `docs/atomic-v3/phase-02-agentic-core/2.12-loop-integration.md` |
| 3.13 | 2.13 | SandboxRunner hardened execution | `[ ]` | `docs/atomic-v3/phase-02-agentic-core/2.13-sandbox-runner.md` |
| 3.14 | 2.14 | ProvenanceGraph node/edge storage | `[x]` | `docs/atomic-v3/phase-02-agentic-core/2.14-provenance-storage.md` |
| 3.15 | 2.15 | ProvenanceGraph query API | `[x]` | `docs/atomic-v3/phase-02-agentic-core/2.15-provenance-query.md` |
