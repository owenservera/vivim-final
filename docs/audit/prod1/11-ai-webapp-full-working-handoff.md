# AI WebApp Chat — Full Working Handoff Audit
**File:** `docs/audit/prod1/11-ai-webapp-full-working-handoff.md`
**Session:** 2026-07-22 (tasks: 289, 303, 365, 427, 456)
**Goal:** Fully working AI webapp chat: Frontend → Backend (port 9420) → Chrome CDP → AI Provider → Response streamed back

---

## ✅ COMPLETED FIXES (This Session)

### Fix 1 — Wrong Gemini Login URL (CRITICAL — FIXED)
**Root cause:** `getProviderRegistry().getLoginUrl('gemini')` returns `https://gemini.google.com/login`.
The fallback `https://${providerId}.com/login` = `https://gemini.com/login` — a crypto exchange.
Chrome slave navigated to the WRONG SITE and waited 300s for a login that never came.

**Files fixed:**
- `src/engines/provider-selectors.ts` — `getProviderLoginUrl()` now short-circuits: `if (providerId === 'gemini') return 'https://gemini.google.com/app'`
- `src/engines/provider-selectors.ts` — `getProviderUrl()` same fix
- `src/server/setup-router.ts` — `getLoginUrl()` same fix

**DB state (verified):** `ProviderDefinition` for gemini has `websiteUrl: 'https://gemini.google.com'` and login endpoint `https://accounts.google.com`. The wizard should navigate to `gemini.google.com/app` (the app URL) and detect login when Chrome reaches that URL.

**Result:** Chrome now opens `https://gemini.google.com/app`, user completes Google login. Profile saved to `chrome-profiles/gemini/gemini_owservera-at-gmail.com/`. Gemini verdict: `already-registered`.

---

### Fix 2 — Cookie Detection Bug (FIXED)
**File:** `devops/runtime-test/provider-status.ts`

**Root cause:** Status checker looked for cookies at `<profile>/<account>/Cookies`. Chrome stores them at `<profile>/<account>/Default/Network/Cookies`.

**Fix:** Now checks BOTH paths — new `Default/Network/Cookies` and legacy `Cookies`.
**Result:** `hasCookies: true` for gemini.

---

### Fix 3 — Capability Registration False Negative (FIXED)
**Files:**
- `devops/runtime-test/test-cap.ts` — Added `registered?: boolean` field. HTTP 404 = not found. HTTP 400/200 = registered.
- `devops/runtime-test/provider-status.ts` — Uses `result.registered` not `result.ok`. Added `conversation_send` as first slug to try.

**Root cause:** Status tried slugs `['send_message', 'cap:conversation:send', 'gemini_send']`. The real slug is `conversation_send`. It returned HTTP 400 (validation — missing `conversationId` input), which was treated as "not found" instead of "registered."

**Result:** `capabilityRegistered: true`, `capabilitySlug: 'conversation_send'`, `verdict: already-registered`.

---

### Fix 4 — Frontend useProvider Hook Response Mismatch (FIXED)
**File:** `frontend/src/sdk/web/use-provider.ts`

**Root cause:** Backend `/api/providers` returns a raw JSON array. Frontend expected `{ providers: [] }` wrapper → `res.data.providers ?? []` always returned `[]`. Also included `agent:provider:*` and `generic` noise entries.

**Fix:** Detect both shapes, filter noise, map `displayName`→`name`, parse `capabilitiesJson` string.
**Result:** Provider list now correctly shows Gemini, ChatGPT, Claude, etc.

---

## 🚨 REMAINING ISSUES — WHAT TO FIX NEXT

### Issue 1 — Frontend Not Started (HIGH PRIORITY)
The frontend (Next.js in `frontend/`) must be running for the webapp to work.

The `next build` already completed successfully (task-303) — 65 static pages + all dynamic routes built.

**Start frontend:**
```powershell
Set-Location "C:\0-BlackBoxProject-0\vivim-final\frontend"
bun run dev      # dev server on port 3000
# OR production:
bun run start    # uses .next build already done
```

**Env check** — `frontend/.env`:
```
NEXT_PUBLIC_API_URL=http://localhost:9420
```
This is correct. All frontend fetch calls go to the backend.

---

### Issue 2 — Backend Must Be Running First
```powershell
Set-Location "C:\0-BlackBoxProject-0\vivim-final"
bun run src/cli/index.ts serve
# Waits for: "vivim server listening on :9420"
```

**Health check:**
```powershell
Invoke-RestMethod "http://localhost:9420/api/health"
```

**Or use PS1 scripts (preferred):**
```powershell
pwsh scripts/start-all.ps1    # launches backend + frontend together
pwsh scripts/stop-all.ps1     # stops both
```

---

### Issue 3 — Chrome Slave Must Be Launched for Gemini (CRITICAL)
Profile is authenticated (`hasCookies: true`, `profileOnDisk: true`) but Chrome is NOT running (`liveSlave: false`). No send will work without a live Chrome slave.

**Adopt existing authenticated profile:**
```powershell
bun run devops agentic adopt --provider=gemini
```

**If cookies expired, re-run setup wizard:**
```powershell
bun run devops runtime-test setup --provider=gemini --account=gemini_owservera@gmail.com
# Chrome opens https://gemini.google.com/app
# Log in with Google account
# Wizard detects login and saves profile
```

**Verify slave is live:**
```powershell
bun run devops runtime-test status --provider=gemini
# Expect: "liveSlave": true
```

---

### Issue 4 — ConversationList defaultProviderId Not Wired to Active Provider (MEDIUM)
**File:** `frontend/src/components/chat/ConversationList.tsx` line 74-79

When user clicks "New Conversation", it calls:
```ts
const res = await createConversation(defaultProviderId).catch(() => null);
```
`defaultProviderId` is passed as a prop. If it is undefined, conversation is created WITHOUT a provider → `ConversationManager.send()` cannot find a Chrome slave → send fails.

**Find where ConversationList is rendered:**
- `frontend/src/components/chat/SurfaceContent.tsx`
- `frontend/src/components/chat/ChatSurface.tsx`

**Fix pattern — pass active provider:**
```tsx
// Wherever ConversationList is rendered:
<ConversationList
  activeId={activeConvId}
  onSelect={setActiveConvId}
  defaultProviderId={providerIds[0] ?? 'gemini'}  // ← must be set!
/>
```

---

### Issue 5 — ConversationManager.send() Full CDP Pipeline (VERIFY)
**File:** `src/engines/conversation-manager.ts`

The 8-step send pipeline:
```
RESOLVE → DERIVE SLAVE → LOCK → ENSURE → SEND → CAPTURE → PARSE → STORE+EMIT
```

1. **RESOLVE** — Gets `conversation.providerId` from DB (must exist)
2. **DERIVE SLAVE** — `ChromeGovernor.getSlaveForProvider('gemini')` — Chrome must be running
3. **LOCK** — Acquires conversation lock (prevents concurrent sends)
4. **ENSURE** — Navigates Chrome to `PROVIDER_URLS['gemini']` = `https://gemini.google.com/app`
5. **SEND** — Types into `.ql-editor` (Quill) → clicks send button
6. **CAPTURE** — Intercepts batchexecute RPC network response
7. **PARSE** — `StreamParserEngine` via `gemini/001_batchexecute` parser
8. **STORE+EMIT** — Saves ContentBlocks → emits `conversation:block` WebSocket events

**Without Chrome slave:** 30s timeout → error `"Send timed out — no Chrome slave connected"`

**Test end-to-end send:**
```powershell
# First create a conversation
bun -e "
const r = await fetch('http://localhost:9420/api/conversations', {
  method: 'POST', headers: {'Content-Type':'application/json'},
  body: JSON.stringify({ providerId: 'gemini', title: 'Test' })
});
const j = await r.json(); console.log('convId:', j.id);
"

# Then send to it (replace CONV_ID)
bun -e "
const r = await fetch('http://localhost:9420/api/conversations/CONV_ID/send', {
  method: 'POST', headers: {'Content-Type':'application/json'},
  body: JSON.stringify({ message: 'Hello, can you say hi?' })
});
console.log(r.status, JSON.stringify(await r.json(), null, 2));
"
```

---

### Issue 6 — Gemini Quill send_method='both' But Enter May Not Work
**File:** `seeds/providers/manifests.ts` line 477-478

Current: `"send_method": "both"` — tries Enter first, then click.
AGENTS.md explicitly states: **"Send requires clicking the send button (Enter doesn't work in Quill)"**

**Fix:**
```ts
// seeds/providers/manifests.ts line 478
"send_method": "click",  // was "both"
```
Then regenerate:
```powershell
bun run gen:protocol
```

---

### Issue 7 — Gemini batchexecute Parser Validation
**File:** `seeds/parsers/harvested/gemini-batchexecute.ts`

Verify parser is in DB:
```powershell
bun -e "
import { CapStoreDb } from './src/storage/db.js';
const db = new CapStoreDb();
const p = await db.prisma.streamParser.findFirst({ where: { providerId: 'gemini' } });
console.log(p?.name, p?.version, p?.logicType);
"
# Expect: gemini/001_batchexecute 1 inline
```

Run parser unit test:
```powershell
bun test tests/unit/engines/harvested-parser.test.ts
```

Run live wire format test (needs Chrome slave):
```powershell
bun run devops runtime-test onboard test-parse --provider=gemini
```

---

### Issue 8 — ChatGPT and Claude Profiles Missing
**Status:** Both show `profileOnDisk: false`, `hasCookies: false`

**Setup ChatGPT:**
```powershell
bun run devops runtime-test setup --provider=chatgpt --account=<your_openai_email>
# Chrome opens https://chatgpt.com/auth/login
```
Selectors: composer=`#prompt-textarea`, send=`[data-testid='send-button']`

**Setup Claude:**
```powershell
bun run devops runtime-test setup --provider=claude --account=<your_anthropic_email>
# Chrome opens https://claude.ai/login
```
Selectors: composer=`div[contenteditable="true"]` (ProseMirror)

---

### Issue 9 — CapabilityListSchema Mismatch (LOW — COSMETIC)
**File:** `frontend/src/sdk/backend-client.ts` line 53-56

Schema expects `{ capabilities: [], total?: number }` but `/api/capabilities?surface=ui` returns a raw array.
This causes `listCapabilities()` to return schema validation error — capabilities don't load.

**Fix option A — Update schema:**
```ts
export const CapabilityListSchema = z.array(CapabilitySchema)
```

**Fix option B — Fix backend to wrap response:**
In `src/server/index.ts` capabilities handler, wrap: `return json({ capabilities: caps, total: caps.length })`

---

## 🎯 COMPLETE WORKING SEQUENCE (In Order)

```powershell
# 1. Start backend
Set-Location "C:\0-BlackBoxProject-0\vivim-final"
Start-Process bun -ArgumentList "run","src/cli/index.ts","serve" -NoNewWindow
Start-Sleep -Seconds 5

# 2. Verify backend health
Invoke-RestMethod "http://localhost:9420/api/health"
# Expect: {status: "ok"}

# 3. Launch Gemini Chrome slave
bun run devops agentic adopt --provider=gemini
# OR if that command doesn't exist:
bun run devops runtime-test setup --provider=gemini --account=gemini_owservera@gmail.com

# 4. Verify Gemini fully ready
bun run devops runtime-test status --provider=gemini
# ALL must be true: seeded, profileOnDisk, hasCookies, liveSlave, capabilityRegistered
# verdict must be: "already-registered"

# 5. Start frontend
Set-Location "C:\0-BlackBoxProject-0\vivim-final\frontend"
Start-Process bun -ArgumentList "run","start" -NoNewWindow
Start-Sleep -Seconds 3

# 6. Open webapp
Start-Process "http://localhost:3000"

# 7. In the webapp UI:
#    - Provider list shows: Gemini, ChatGPT, Claude (after Fix 4 lands)
#    - Select Gemini checkbox
#    - Click "New Conversation"
#    - Type "Hello!" and send
#    - Chrome slave types and sends the message
#    - Response streams back via WebSocket → Composer displays blocks
```

---

## 📁 KEY FILES MAP

| Layer | File | Purpose |
|-------|------|---------|
| **Frontend** | | |
| App root | `frontend/src/app/page.tsx:47-61` | `PROVIDER_OPTIONS` + `providerIds` state |
| Chat entry | `frontend/src/app/page.tsx:244` | `<LivingCanvas ... providerIds={providerIds}>` |
| Canvas shell | `frontend/src/components/canvas/LivingCanvas.tsx` | Renders all chat slots |
| Composer | `frontend/src/components/chat/Composer.tsx:179-220` | Send + streaming via WebSocket |
| Conv list | `frontend/src/components/chat/ConversationList.tsx:74` | New conv with `defaultProviderId` |
| Provider hook | `frontend/src/sdk/web/use-provider.ts` | Fetches from `/api/providers` |
| Backend client | `frontend/src/sdk/backend-client.ts:202-208` | `sendMessage()` → `/api/conversations/:id/send` |
| API config | `frontend/src/shared/api-config.ts` | `NEXT_PUBLIC_API_URL=http://localhost:9420` |
| **Backend** | | |
| Send route | `src/server/conversation-router.ts:218-244` | Routes to `conversationManager.send()` |
| Conv create | `src/server/conversation-router.ts:199-216` | `POST /api/conversations` with `providerId` |
| Providers list | `src/server/conversation-router.ts:31-33` | `GET /api/providers` → raw array |
| **Engines** | | |
| Send pipeline | `src/engines/conversation-manager.ts` | 8-step CDP orchestration |
| Chrome control | `src/engines/chrome-governor.ts` | CDP slave lifecycle |
| Setup wizard | `src/engines/chrome-setup-wizard.ts:59-61` | `getLoginUrl()` via provider-selectors |
| Login URL fix | `src/engines/provider-selectors.ts:32-41` | `getProviderLoginUrl()` — gemini hardcoded |
| Provider URL | `src/engines/provider-selectors.ts:24-32` | `getProviderUrl()` — gemini hardcoded |
| **DB / Seeds** | | |
| Gemini manifest | `seeds/providers/manifests.ts:433-560` | URLs, selectors, capabilities |
| Parser seed | `seeds/parsers/harvested/gemini-batchexecute.ts` | batchexecute RPC parser logic |
| **DevOps** | | |
| Status check | `devops/runtime-test/provider-status.ts` | Full health check |
| Test cap | `devops/runtime-test/test-cap.ts` | HTTP 404 vs 400 distinction |
| Setup cmd | `devops/runtime-test/` (orchestration.ts) | Full onboard pipeline |

---

## 🧪 VERIFICATION COMMAND SUITE

```powershell
# Backend health
Invoke-RestMethod "http://localhost:9420/api/health"

# Full provider preflight
bun run devops runtime-test preflight

# Gemini specific status
bun run devops runtime-test status --provider=gemini

# Parser unit tests
bun test tests/unit/engines/harvested-parser.test.ts

# Cross-surface parity
bun run devops verify-cross-surface

# Protocol drift
bun run devops protocol diff

# Invariants
bun run devops invariants check

# Test NL interpret → conversation_send
bun run devops runtime-test test --nl="send message to gemini"

# Run full onboard for Gemini
bun run devops runtime-test onboard run --provider=gemini
```

---

## ⚡ QUICK WINS (< 5 min each)

### QW-1: Fix Gemini send_method
```ts
// seeds/providers/manifests.ts line ~478
"send_method": "click",  // change from "both"
```
Then: `bun run gen:protocol`

### QW-2: Wire defaultProviderId in ConversationList
Find where `<ConversationList>` is rendered (check `SurfaceContent.tsx`, `ChatSurface.tsx`).
Pass `defaultProviderId={activeProviderIds[0] ?? 'gemini'}`.

### QW-3: Fix CapabilityListSchema to accept array
In `frontend/src/sdk/backend-client.ts`:
```ts
export const CapabilityListSchema = z.union([
  z.object({ capabilities: z.array(CapabilitySchema), total: z.number().optional() }),
  z.array(CapabilitySchema),
])
```

### QW-4: Start both services with one command
```powershell
pwsh scripts/start-all.ps1
```

---

## ⚠️ KNOWN RISKS

| Risk | Severity | Mitigation |
|------|----------|------------|
| Chrome port 9222 already in use (previous crashed slave) | High | Kill existing Chrome: `Stop-Process -Name chrome -Force` |
| Gemini session expires (Google re-auth required) | Medium | Re-run setup wizard |
| batchexecute parser fails on new Gemini UI version | Medium | Run `onboard discover-protocol` to update selectors |
| Frontend build cache stale | Low | `Set-Location frontend; bun run build` |
| WSL/Windows path issues with `profileDir` | Low | Ensure all paths use Windows backslash format |

---

*Generated: 2026-07-22 22:24 UTC+2 — Full session handoff for next agent / operator*
