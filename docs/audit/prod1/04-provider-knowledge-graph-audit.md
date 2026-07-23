# Comprehensive Audit Scan: Area 4 — Provider Knowledge Graph & Protocol Data Layer
**Target Subsystem:** ProviderRegistrar, ProviderHealthKernel, Protocol Discovery, Seed Pipeline, Generated Protocol Layer
**Audit Scope:** Implied Architectural Intent vs. Actual Code Implementation
**Location:** `src/engines/provider-registrar.ts`, `src/engines/provider-health.ts`, `src/__generated__/provider-protocol.ts`, `seeds/providers/`

---

## 1. Executive Summary & Implied Intent
The Provider Knowledge Graph seeds, resolves, and tracks operational metadata for the 6 core AI providers (`chatgpt`, `claude`, `gemini`, `deepseek`, `qwen`, `grok`) and generic framework aliases.
- **Implied Intent (Single Source of Truth & Protocol Pipeline):**
  1. **Database as Source of Truth:** Live DB tables (`Provider`, `Parser`, `StreamConfig`, `CapabilityBinding`) contain authoritative provider capabilities and CDP DOM selector paths.
  2. **Compiled Static Protocol Layer:** `src/__generated__/provider-protocol.ts` is compiled from DB via `bun run gen:protocol` for low-latency startup, with dev clone promotion via `bun run devops protocol dev/diff/promote/prod`.
  3. **8-Phase Onboarding Pipeline:** Every provider must achieve convergence through the pipeline (`discover` → `infer` → `test-selectors` → `test-parse` → `test-cap` → `test-frontend` → `verify` → `converge`).

---

## 2. Actual Code Scan Findings

### 🔴 Finding 4.1: Provider Capability Seed Discrepancies
- **Actual Code Evidence:**
  - `chatgpt`, `claude`, and `gemini` are fully seeded with inline DB parsers and capabilities (`send_message`, `select_model`).
  - `deepseek`, `qwen`, and `grok` are registered in seeds (`seeds/providers/*.json`) but lack custom inline stream parser rows (`parser_logic_code` rows in DB), relying entirely on the `generic/001` or `system/001` fallback parser.
- **Impact:** Provider streaming metrics and specialized token block decomposition (e.g. reasoning blocks for DeepSeek R1 or Grok think blocks) default to raw text blocks.

### 🟡 Finding 4.2: Static Code Fallback Drift Risk
- **Actual Code Evidence:**
  - `src/engines/provider-selectors.ts` contains hardcoded fallback lists for DOM composers and send buttons.
  - If dynamic DB updates alter selectors without running `bun run gen:protocol`, static fallbacks in `provider-selectors.ts` drift from DB state.

### 🟢 Finding 4.3: Protocol Dev/Prod Promotion Tooling
- **Actual Code Evidence:**
  - `bun run devops protocol diff` and `bun run devops protocol promote --provider=<slug>` work smoothly to diff runtime modifications and promote updates back to DB & generated source files.

---

## 3. Future Agent Verification & Audit Execution Plan

Future auditing agents must execute the following automated scan steps:

```bash
# Step 1: Run comprehensive provider status deep dive
bun run devops runtime-test status --provider=gemini
bun run devops runtime-test status --provider=chatgpt
bun run devops runtime-test status --provider=claude

# Step 2: Perform provider protocol drift comparison
bun run devops protocol diff

# Step 3: Run full preflight verification on provider fleet
bun run devops runtime-test preflight
```

---

## 4. Remediation & Convergence Checklist
- [ ] Implement explicit inline DB parsers for `deepseek`, `qwen`, and `grok` in `seeds/parsers/harvested/`.
- [ ] Enforce automated protocol regeneration check in CI/git hooks (`lefthook.yml`) to ensure `src/__generated__/provider-protocol.ts` matches DB seed state.
- [ ] Run full 8-phase onboarding convergence for `deepseek` and `grok`.
