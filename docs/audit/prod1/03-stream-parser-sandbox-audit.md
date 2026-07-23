# Comprehensive Audit Scan: Area 3 — Stream Parser Engine & Sandbox Isolation
**Target Subsystem:** StreamParserEngine, StreamAlignmentEngine, SandboxRunner, Harvested Parsers, ContentUnitStore
**Audit Scope:** Implied Architectural Intent vs. Actual Code Implementation
**Location:** `src/engines/stream-parser.ts`, `src/engines/stream-align.ts`, `src/engines/sandbox-runner.ts`, `seeds/parsers/harvested/`

---

## 1. Executive Summary & Implied Intent
The Stream Parser subsystem processes raw, real-time responses (SSE streams, batch RPC payloads, custom JSON envelopes) from external providers (ChatGPT, Claude, Gemini, DeepSeek, Qwen, Grok) into structured `ContentBlock[]`.
- **Implied Intent (Invariant 5 & Sandbox Hardening):**
  1. **DB-Only Parser Logic:** Parsers MUST be loaded dynamically from DB (`parser_logic_code` with `logic_type=inline`). File-based parsers are strictly rejected unless explicitly flagged for dev.
  2. **Sandbox Execution:** All dynamic parser evaluation MUST run inside `SandboxRunner` using isolated VM environments (`node:vm`) with memory and execution timeouts.
  3. **Fallback Chains:** Deterministic 3-tier fallback resolution: `provider/specific` → `generic/001` → `system/001` (raw text passthrough).

---

## 2. Actual Code Scan Findings

### 🔴 Finding 3.1: Legacy `new Function` Fallbacks Present in Core Parsing Paths
- **Violation:** Sandbox isolation requirement and Invariant 5.
- **Actual Code Evidence:**
  - `src/engines/stream-parser.ts#L491`: Uses `const factory = new Function('module', 'exports', code)` as a fallback when sandbox evaluation is unavailable or bypassed.
  - `src/engines/workflow-compiler.ts#L101`: Uses `new Function('vars', ...)` for expression evaluation.
  - `src/engines/workflow-engine.ts#L509`: Uses `new Function(...)` for workflow logic execution.
- **Impact:** Insecure code execution in the main Bun runtime process if raw parser code or workflow script contains malicious or non-sanitized logic.

### 🟡 Finding 3.2: Custom Batchexecute Parser Structure (Gemini)
- **Actual Code Evidence:**
  - `seeds/parsers/harvested/gemini-batchexecute.ts`: Parses Google's custom RPC envelope `)]}'` XSSI preamble and nested array structures.
  - While functional, array index offsets (e.g. `arr[0][2]`) are susceptible to upstream UI updates.
- **Impact:** High sensitivity to frontend DOM changes by Google; requires automatic confidence monitoring and repair triggers via `harness-repair-engine`.

### 🟢 Finding 3.3: 3-Tier Fallback Chain Integrity
- **Actual Code Evidence:**
  - `StreamParserEngine` correctly navigates `fallbackParserId` links from `ParserStore`.
  - Generic format-agnostic parser (`seeds/parsers/harvested/generic-format-agnostic.ts`) and system fallback (`system-raw-text.ts`) reliably prevent stream parsing panics.

---

## 3. Future Agent Verification & Audit Execution Plan

Future auditing agents must execute the following automated scan steps:

```bash
# Step 1: Run format correctness unit tests on all harvested parser scripts
bun test tests/unit/engines/harvested-parser.test.ts

# Step 2: Test live/fixture wire-format parsing against real payloads
bun test tests/e2e/provider-stream-validate.test.ts

# Step 3: Verify stream parser fallback chain execution
bun test tests/unit/engines/stream-parser.test.ts
```

---

## 4. Remediation & Convergence Checklist
- [ ] Eliminate `new Function` in `src/engines/stream-parser.ts#L491` by delegating unconditionally to `SandboxRunner`.
- [ ] Refactor `workflow-compiler.ts` and `workflow-engine.ts` expression evaluators to use `safe-eval.ts` or `SandboxRunner`.
- [ ] Add execution telemetry monitoring in `ParserExecutionLogStore` for low-confidence parse events (<0.50).
