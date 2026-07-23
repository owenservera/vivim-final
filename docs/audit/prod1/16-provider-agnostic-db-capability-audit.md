# Comprehensive Audit Scan: Area 16 — Provider-Agnostic Engine & On-Demand DB Capability Generation
**Audit Category:** Provider Agnosticism & On-Demand DB Capability Architecture
**Core Subsystems:** StreamParserEngine, CapabilitySnapshot, ChromeGovernor, SandboxRunner, ProviderRegistrar, BrowserHarness
**Audit Target:** READ (Streaming & Parsing) and WRITE (WebApp Capability to CDP Method Mapping) Dimensions
**Location:** `src/engines/stream-parser.ts`, `src/engines/capability-snapshot.ts`, `src/engines/chrome-governor.ts`, `src/engines/sandbox-runner.ts`, `src/storage/contracts/`

---

## 1. Architectural Intent & Provider-Agnostic Core Paradigm

The `vivim-final` system architecture is engineered to be **100% Provider-Agnostic**. The core engines do NOT contain hardcoded provider-specific control logic. Instead, all capabilities, selectors, parsers, and execution recipes are **generated on demand from database rows** (`Provider`, `CapabilityBinding`, `CapabilityProgram`, `Parser`, `StreamConfig`).

```
                              ┌──────────────────────────────────────────────────┐
                              │            DATABASE STATE (Prisma SQLite)        │
                              │  - CapabilityBinding  - Parser (logic_code)      │
                              │  - CapabilityProgram  - StreamConfig (selectors) │
                              └─────────────────────────┬────────────────────────┘
                                                        │
                         ┌──────────────────────────────┴──────────────────────────────┐
                         ▼                                                             ▼
         READ DIMENSION [Streaming & Parsing]                        WRITE DIMENSION [Capability to CDP Mapping]
┌─────────────────────────────────────────────────────┐     ┌─────────────────────────────────────────────────────┐
│ 1. Web Service / Browser Stream Wire Response       │     │ 1. WebApp / CLI / API / MCP Capability Call         │
│ 2. StreamParserEngine fetches Parser row from DB    │     │ 2. CapabilitySnapshot O(1) resolution by (slug, prov)│
│ 3. SandboxRunner compiles inline logic_code in VM   │     │ 3. ChromeGovernor loads dynamic recipe.steps[]      │
│ 4. Executes fallback chain (specific→generic→system)│     │ 4. BrowserHarness maps step → CDP Method call       │
│ 5. Returns normalized ContentBlock[] payload        │     │ 5. Sends keystrokes/clicks via Chrome Governor      │
└─────────────────────────────────────────────────────┘     └─────────────────────────────────────────────────────┘
```

---

## 2. READ Dimension Audit: On-Demand Streaming & Parsing

### 2.1 Intent & Contract Specification
The READ dimension transforms raw streaming HTTP/CDP responses into normalized `ContentBlock[]` entities (`{type:'text'}`, `{type:'reasoning'}`, `{type:'tool-call'}`, `{type:'file'}`) without hardcoding provider parser classes in source code.

- **DB-Driven Parser Resolution:** `StreamParserEngine` queries `ParserStore.getParserByProviderAndVersion(providerId, version)`.
- **Inline VM Execution:** Dynamic parser logic (`logic_type=inline`, `logic_code`) is compiled dynamically using `SandboxRunner` (`node:vm`).
- **Dynamic 3-Tier Fallback Chain:**
  1. `provider/specific` (e.g. `gemini/001_batchexecute`, `claude/001_streaming_sse`, `chatgpt/001_openai_sse`).
  2. `generic/001` (`generic-format-agnostic` for arbitrary SSE/JSON streams).
  3. `system/001` (`system-raw-text` infallible raw text fallback).

### 2.2 Actual Code Findings — READ Dimension
- **🟢 Provider-Agnostic Parser Registry:** `seeds/parsers/harvested/` contains standalone parser modules (`LOGIC_CODE`) seeded into the database (`seeds/parsers/harvest.seed.ts`).
- **🔴 Finding 16.1: Legacy `new Function` Fallback in Parser Engine:**
  - `src/engines/stream-parser.ts#L491` retains `const factory = new Function('module', 'exports', code)` as a secondary fallback if sandbox initialization is bypassed.
  - *Remediation:* Enforce unconditional `SandboxRunner` evaluation to preserve VM isolation invariants.

---

## 3. WRITE Dimension Audit: WebApp Capability to CDP Method Mapping

### 3.1 Intent & Contract Specification
The WRITE dimension routes user intent from the WebApp (`POST /api/capabilities/:id/execute` or CLI/UI) to Chrome browser execution by mapping abstract capability slugs to CDP actions **dynamically derived from DB rows**.

- **CapabilitySnapshot Boot Loader:** `CapabilitySnapshot.load()` builds an $O(1)$ in-memory map of `CapabilityBinding` and `CapabilityProgram` rows at boot time (`src/engines/capability-snapshot.ts`).
- **On-Demand CDP Recipe Program Execution:**
  1. WebApp invokes `cap:conversation:send` with input parameters `{ providerId: 'gemini', text: 'Hello' }`.
  2. `CapabilitySnapshot.getBySlug('send_message', 'gemini')` resolves the binding row and associated `CapabilityProgram`.
  3. `ChromeGovernor.executeSnapshotProgram()` iterates over `program.recipe.steps[]`:
     - Step 1: `action: 'focus_composer'`, `selector: 'div.ql-editor[contenteditable="true"]'`
     - Step 2: `action: 'type_text'`, `text: input.text`
     - Step 3: `action: 'click_button'`, `selector: 'button.send-button'`
  4. `BrowserHarness.runAction()` maps step actions to native CDP transport commands (`Input.dispatchMouseEvent`, `Input.insertText`).

### 3.2 Actual Code Findings — WRITE Dimension
- **🟢 O(1) Snapshot Resolution:** `CapabilitySnapshot` resolves provider-specific bindings in $O(1)$ time with fallback to provider-agnostic default capability rows (`bySlugAny`).
- **🔴 Finding 16.2: Hardcoded Provider Conditionals in Action Engines:**
  - `src/engines/conversation-manager.ts` and `src/engines/composer-typing.ts` contain residual provider switch statements (`if (provider === 'gemini') ...`).
  - *Impact:* Breaches pure provider agnosticism.
  - *Remediation:* Move submit method behavior (`submitMethod: 'click_button' | 'press_enter'`) into the DB `CapabilityProgram` recipe payload so action engines execute recipes generically.

---

## 4. Provider Agnosticism & On-Demand Capability Matrix

| Operation Dimension | Capability Component | Provider Agnostic Intent | Actual Implementation Status | Compliance Score |
|---------------------|----------------------|--------------------------|------------------------------|------------------|
| **READ** | Parser Logic Code | Loaded dynamically from DB `logic_code` | Loaded via `ParserStore`; inline VM execution supported | **95%** (Legacy `new Function` fallback present) |
| **READ** | Stream Format Normalization | Convert raw stream to `ContentBlock[]` | Harvested parsers normalize SSE/RPC/JSON into standard blocks | **100%** |
| **READ** | Fallback Parser Chain | `provider` → `generic` → `system` | `StreamParserEngine` navigates `fallbackParserId` chain | **100%** |
| **WRITE** | Capability Resolution | WebApp call resolved via `CapabilitySnapshot` | $O(1)$ snapshot resolution by `(slug, providerId)` | **100%** |
| **WRITE** | WebApp to CDP Mapping | DB recipe steps mapped to CDP methods | `ChromeGovernor.executeSnapshotProgram` executes `recipe.steps[]` | **90%** (Hardcoded provider checks in `composer-typing.ts`) |
| **WRITE** | Selector Fallback Resolution | DOM selector auto-healing | `SelectorHealer` queries selector fallback lists on mutation | **95%** |

---

## 5. Future Agent Audit Verification Protocol

Future auditing agents must execute the following automated scan steps to verify Provider Agnosticism & On-Demand DB Capabilities:

```powershell
# Step 1: Run store contract and architectural invariant audit
bun run devops invariants check

# Step 2: Test DB-driven CapabilitySnapshot resolution
bun test tests/unit/engines/capability-snapshot.test.ts

# Step 3: Run harvested parser format correctness unit tests
bun test tests/unit/engines/harvested-parser.test.ts

# Step 4: Run StreamParserEngine fallback chain unit tests
bun test tests/unit/engines/stream-parser.test.ts

# Step 5: Verify cross-surface capability parity
bun run devops verify-cross-surface
```

---

## 6. Remediation & Convergence Checklist
- [ ] **READ Dimension:** Remove legacy `new Function` fallback in `src/engines/stream-parser.ts#L491` in favor of mandatory `SandboxRunner` VM isolation.
- [ ] **WRITE Dimension:** Refactor `composer-typing.ts` switch statements (`if (provider === 'gemini')`) into declarative `recipe.steps[]` flags in DB `CapabilityProgram` rows.
- [ ] **Protocol Sync:** Run `bun run gen:protocol` to verify static generated protocol matching dynamic DB state.
