# Comprehensive Audit Scan: Area 1 — ChromeGovernor & CDP Automation Fleet
**Target Subsystem:** ChromeGovernor, FleetSupervisor, ProfileAllocator, CDP Transport, Stealth Layer
**Audit Scope:** Implied Architectural Intent vs. Actual Code Implementation
**Location:** `src/engines/chrome-governor.ts`, `src/executor/`, `src/engines/stealth/`

---

## 1. Executive Summary & Implied Intent
The Chrome Automation Fleet provides headful/headless Chrome browser control for automated AI interactions (ChatGPT, Claude, Gemini, DeepSeek, Qwen, Grok).
- **Implied Intent (Governor Canon & Invariants 1, 6, 7, 8, 9):**
  1. **Governor Canon:** Only `ChromeGovernor` touches CDP directly or orchestrates CDP clients. No outside engine or API router imports `BunCdpClient` directly.
  2. **Canonical Profile Directory:** Chrome profiles live strictly under `chrome-profiles/<providerSlug>/<accountId>` with singleton allocation per `(provider, account)`.
  3. **Fleet Limits & Spawn Guards:** Strict bounds on concurrent instances (`maxConcurrent`), queued launches, and startup timeouts.
  4. **Cookie & Session Truth:** The profile disk state (`Default/Network/Cookies`) is the single source of truth for authentication, derived strictly from `ProfileAllocator.isAuthenticated()`.

---

## 2. Actual Code Scan Findings

### 🔴 Finding 1.1: Direct CDP Imports Bypass Governor Canon
- **Violation:** Invariant 1 ("Only `ChromeGovernor` touches CDP. No engine imports `BunCdpClient`").
- **Actual Code Evidence:**
  - `src/automation/ui-automator.ts#L9`: `import { BunCdpClient } from '../executor/cdp.js'` and direct connection `new BunCdpClient(...)` on line 61.
  - `src/server/setup-router.ts#L4`: `import { BunCdpClient } from '../executor/cdp.js'` and instantiation `new BunCdpClient(wsUrl)` on line 138.
- **Impact:** Bypasses Governor session state tracking, telemetry aggregation, rate limits, and cleanup lifecycle hooks.

### 🟡 Finding 1.2: Fleet Supervisor Direct WebSocket Management
- **Actual Code Evidence:**
  - `src/executor/fleet-supervisor.ts#L395` & `#L530`: Instantiates `new BunCdpClient(...)` directly for browser navigation and tab evaluation.
- **Analysis:** While `FleetSupervisor` is part of the executor subsystem, direct raw client creation creates parallel control paths alongside `CdpTransportImpl` and `ChromeGovernor`.

### 🟢 Finding 1.3: Profile Allocation Singleton & Path Normalization
- **Actual Code Evidence:**
  - `src/executor/profile-allocator.ts` correctly enforces canonical paths (`chrome-profiles/<provider>/<account>`).
  - `.profile-meta.json` validation accurately checks `Default/Network/Cookies` or `Profile N/Network/Cookies`.

---

## 3. Future Agent Verification & Audit Execution Plan

Future auditing agents must execute the following automated scan steps:

```bash
# Step 1: Detect raw CDP imports across the codebase (excluding src/executor/cdp.ts)
bun run devops invariants check

# Step 2: Run CDP selector validation on active providers
bun run devops runtime-test onboard test-selectors --provider=gemini

# Step 3: Audit profile isolation directory structure
Get-ChildItem -Path chrome-profiles -Recurse -Depth 2
```

---

## 4. Remediation & Convergence Checklist
- [ ] Refactor `src/automation/ui-automator.ts` to use `ChromeGovernor.evaluate()` or `GovernorTransport`.
- [ ] Refactor `src/server/setup-router.ts` setup probe to route through `ChromeGovernor.getOrLaunchSlave()`.
- [ ] Add an ESLint / Biome / AST check rule forbidding `BunCdpClient` imports outside `src/executor/`.
