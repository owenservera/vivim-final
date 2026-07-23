# Comprehensive Audit Scan: Area 2 — Unified Capability Kernel & Parity Mandate
**Target Subsystem:** Unified Capability Registry, Natural Language Command Layer (NLCL), CLI Bridge, API Router, MCP Server Adapter
**Audit Scope:** Implied Architectural Intent vs. Actual Code Implementation
**Location:** `src/engines/capability-*.ts`, `src/engines/nlcl/`, `src/server/index.ts`, `src/cli/index.ts`, `src/engines/mcp-server-adapter.ts`

---

## 1. Executive Summary & Implied Intent
The Unified Capability Architecture establishes a single, universal execution contract for all system behaviors across CLI, HTTP API, MCP tools, and React UI components.
- **Implied Intent (v10 Invariant & Parity Mandate):**
  1. **One Entry Point:** Every feature must be exposed as a `UnifiedCapability` (`cap:<category>:<action>`).
  2. **Cross-Surface Parity:** Every capability declares standard surface availability (`['cli', 'ui', 'api', 'mcp']`). The CLI, API, MCP, and UI must never invent parallel non-capability handlers.
  3. **Natural Language Grounding:** Intent resolution (`NLCL`) routes user natural language queries into exact `capabilityId` executions via `POST /api/interpret` and `POST /api/capabilities/:id/execute`.

---

## 2. Actual Code Scan Findings

### 🔴 Finding 2.1: CLI Builtin Commands Bypass Capability Registry
- **Violation:** Invariant ("Every operation is a UnifiedCapability. CLI and UI are thin NL shells").
- **Actual Code Evidence:**
  - `src/cli/commands/builtins.ts`: Contains custom builtin commands (e.g. `automate`, `moments`) registered directly in the CLI `CommandRegistry` rather than wrapping standard `UnifiedCapability` instances.
- **Impact:** CLI feature set drifts from API and MCP interfaces, creating surface parity failures (`llm_test_parity`).

### 🟡 Finding 2.2: NLCL Phrase Catalog Coverage Gaps
- **Actual Code Evidence:**
  - `src/engines/nlcl/catalog.ts`: Contains static pattern matchers. While multi-word intent resolution works well for seeded capabilities, dynamic runtime capabilities registered at boot missing patterns fall back to fuzzy distance matchers with lower confidence scores.
- **Impact:** Lower resolution precision for newly added extensions or custom workflow macros.

### 🟢 Finding 2.3: Bridge & Parity Test Enforcement
- **Actual Code Evidence:**
  - `syncCliFromUnified()` (`src/cli/index.ts`) effectively bridges all capabilities registered in `UnifiedCapabilityRegistry` to CLI commands with collision detection.
  - `cap:llm_test:parity` (`src/engines/llm-test-capabilities.ts`) automates surface coverage assertions.

---

## 3. Future Agent Verification & Audit Execution Plan

Future auditing agents must execute the following automated scan steps:

```bash
# Step 1: Run cross-surface parity verification audit
bun run devops verify-cross-surface

# Step 2: Run LLM-as-Human cross-surface parity check via API endpoint
curl -X POST http://localhost:9420/api/capabilities/cap:llm_test:parity/execute -H "Content-Type: application/json" -d "{}"

# Step 3: Verify NL Intent Router resolution for core capability phrases
bun run devops runtime-test test --nl="send message to gemini"
```

---

## 4. Remediation & Convergence Checklist
- [ ] Migrate `automate` and `moments` CLI commands into standard `UnifiedCapability` declarations in `src/engines/`.
- [ ] Ensure all capabilities specify `surfaces: ['cli', 'ui', 'api', 'mcp']` in `registerDefaultCapabilities()`.
- [ ] Add strict validation step in `bun run devops verify-cross-surface` to throw on any unbridged builtin CLI commands.
