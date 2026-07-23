# Production UX Audit: Area 15 — Multi-Provider Session Switching & Account Relogin UX
**Target Subsystem:** Provider Drawer, Profile Allocator Status UI, Relogin Flow Manager
**Audit Scope:** Multi-Provider Switching, Session Expiry Detection, Guided Relogin UX
**Location:** `frontend/src/components/`, `src/executor/profile-allocator.ts`, `src/server/`

---

## 1. Executive Summary & User Experience Goal
The Multi-Provider UX allows users to switch seamlessly between `gemini`, `chatgpt`, and `claude` accounts, view live account health status badges, and execute guided session relogin when browser cookies expire.
- **Target User Experience:**
  1. **Provider Switching Drawer:** One-click provider switching in the Vivim frontend with active status badges for Gemini, ChatGPT, and Claude.
  2. **Three-State Account Status Indicators:**
     - 🟢 **Logged In:** Profile cookies present (`chrome-profiles/<provider>/<account>/Default/Network/Cookies`) and validated.
     - 🟡 **Session Expired:** Cookie present but web surface redirected to login page (`isAuthenticated() === false`).
     - 🔴 **No Profile:** Profile directory missing or unallocated.
  3. **Guided Relogin Flow:** When session expires, the UI presents a clear alert button ("Relogin Session"). Clicking it launches a headful Chrome window via `ChromeGovernor`, allowing the user to complete login while Vivim monitors authentication recovery.

---

## 2. Actual Code & UX Scan Findings

### 🟢 Finding 15.1: Profile Disk State as Source of Truth
- **Actual Code Evidence:**
  - `ProfileAllocator.isAuthenticated()` correctly checks disk cookie files in `chrome-profiles/<provider>/<account>` rather than relying on stale DB table rows (enforcing Invariant 6).

### 🟡 Finding 15.2: Relogin Prompt Modal Ergonomics
- **UX Issue:** When a provider session expires during active conversation streaming, the backend returns an authentication error.
- **Actual Frontend Behavior:** The UI must display a non-disruptive banner offering a "Re-authenticate <Provider>" action without clearing existing conversation history.

---

## 3. Automated UX Verification & E2E Testing Protocol

Future auditing agents must run the following verification steps:

```bash
# Step 1: Query provider fleet health across Gemini, ChatGPT, and Claude
bun run devops runtime-test status --provider=gemini
bun run devops runtime-test status --provider=chatgpt
bun run devops runtime-test status --provider=claude

# Step 2: Check profile disk allocation and cookie existence
bun run devops runtime-test setup --provider=gemini --account=gemini_owservera@gmail.com
```

---

## 4. Remediation & Convergence Checklist
- [ ] Add real-time account status badges in the `frontend/` sidebar for all 3 MVP providers (`gemini`, `chatgpt`, `claude`).
- [ ] Implement seamless conversation history preserve/resume upon completing guided relogin.
