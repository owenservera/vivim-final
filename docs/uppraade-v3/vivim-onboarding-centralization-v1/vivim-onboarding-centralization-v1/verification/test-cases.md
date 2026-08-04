# Test Cases

Concrete test cases for the onboarding + install centralization. Each case has: setup, action, expected result.

---

## TC-01: OnboardingTour renders after `shared/onboarding.ts` is created

**Setup**: fresh clone, Phase A complete.
**Action**:
```bash
cd frontend && bun run dev
curl -s -X POST http://localhost:3000/api/onboarding/reset \
  -H 'Content-Type: application/json' -d '{"userId":"user:demo"}'
# Open http://localhost:3000 in browser
```
**Expected**:
- No console errors about `../../shared/onboarding`
- OnboardingTour overlay renders with spotlight on the welcome step
- "Skip tour" and "Read the docs" buttons visible
- Progress dots show 5 steps

---

## TC-02: `/api/onboarding/analytics` accepts and stores events

**Setup**: Phase A complete, dev server running.
**Action**:
```bash
curl -s -X POST http://localhost:3000/api/onboarding/analytics \
  -H 'Content-Type: application/json' \
  -d '{"type":"tour_started","userId":"user:demo","timestamp":'$(date +%s)'000}'
echo
curl -s "http://localhost:3000/api/onboarding/analytics?limit=10&userId=user:demo" | jq
```
**Expected**:
- First call returns `{ ok: true }` with 200
- Second call returns `{ ok: true, events: [{ type: 'tour_started', ... }], total: 1 }`
- Server log shows a structured JSON line with `msg: 'onboarding-analytics'`

---

## TC-03: `/api/onboarding/complete-tour` persists state

**Setup**: Phase A complete.
**Action**:
```bash
curl -s -X POST http://localhost:3000/api/onboarding/complete-tour \
  -H 'Content-Type: application/json' \
  -d '{"userId":"user:demo","totalDurationMs":45000,"stepTimings":{"welcome":5000,"sidebar":10000,"presence":8000,"command-palette":12000,"assistant":10000}}' | jq

curl -s "http://localhost:3000/api/onboarding/state?userId=user:demo" | jq
```
**Expected**:
- First call returns `{ ok: true, state: { ..., completedSteps: ['welcome','sidebar','presence','command-palette','assistant'], lastCompletedAt: <number>, tourTimings: {...} } }`
- Second call returns the same state (persisted)
- `lastCompletedAt` is set (not null)

---

## TC-04: `/api/setup/*` routes proxy to setup-router

**Setup**: Phase B complete (Task 02).
**Action**:
```bash
# List profiles (should be empty on fresh DB)
curl -s http://localhost:3000/api/setup/profiles | jq

# Launch visible Chrome for ChatGPT
RESP=$(curl -s -X POST http://localhost:3000/api/setup/launch-visible \
  -H 'Content-Type: application/json' \
  -d '{"providerId":"chatgpt","accountSlug":"default","workspace":"chrome-profiles"}')
echo "$RESP" | jq
DEBUG_PORT=$(echo "$RESP" | jq -r '.debugPort')

# Verify login state (should be loggedIn: false initially)
curl -s -X POST http://localhost:3000/api/setup/verify \
  -H 'Content-Type: application/json' \
  -d "{\"port\":$DEBUG_PORT,\"providerId\":\"chatgpt\"}" | jq

# Kill Chrome
curl -s -X POST http://localhost:3000/api/setup/kill \
  -H 'Content-Type: application/json' \
  -d "{\"port\":$DEBUG_PORT}" | jq
```
**Expected**:
- `GET /api/setup/profiles` returns `{ ok: true, profiles: [] }` (or list of existing profiles)
- `POST /api/setup/launch-visible` returns `{ ok: true, debugPort: <port>, pid: <pid> }` and visibly launches Chrome at chatgpt.com
- `POST /api/setup/verify` returns `{ ok: true, loggedIn: false, url: 'https://chatgpt.com/...', cookieCount: <n> }`
- `POST /api/setup/kill` returns `{ ok: true }` and the Chrome process is gone (verify with `ps aux | grep chrome`)

---

## TC-05: GuidedLanding ↔ OnboardingTour coordination

**Setup**: Phase B complete (Task 11). Fresh DB (delete `~/.local/share/vivim/cap-store/cap-store.sqlite*`).
**Action**:
```bash
rm -f ~/.local/share/vivim/cap-store/cap-store.sqlite*
bun x prisma db push
bun run dev
# Open http://localhost:3000
```
**Expected**:
- GuidedLanding opens (chat-as-landing-page, z=2000)
- OnboardingTour does NOT render (verify by inspecting DOM — no `[data-onboarding-tour]` element)
- Complete first-run: pick ChatGPT, log in, click complete
- GuidedLanding fades out
- OnboardingTour starts (spotlight on welcome step)
- No two overlays visible at any time

---

## TC-06: Returning user sees OnboardingTour immediately

**Setup**: Phase B complete. DB has at least one provider account (from TC-05).
**Action**:
```bash
# Reset tour state to simulate "not yet toured"
curl -s -X POST http://localhost:3000/api/onboarding/reset \
  -H 'Content-Type: application/json' -d '{"userId":"user:demo"}'
# Refresh http://localhost:3000
```
**Expected**:
- GuidedLanding does NOT auto-open (needsSetup is false because profiles exist)
- OnboardingTour starts immediately on page load

---

## TC-07: Tour state survives server restart (PrismaOnboardingStore)

**Setup**: Phase B complete (Task 09).
**Action**:
```bash
# Complete a step
curl -s -X POST http://localhost:3000/api/onboarding/complete \
  -H 'Content-Type: application/json' \
  -d '{"userId":"user:demo","stepId":"welcome"}' | jq '.state.completedSteps'
# Should show ["welcome"]

# Restart server (Ctrl+C, then bun run dev again)

# Verify state persisted
curl -s "http://localhost:3000/api/onboarding/state?userId=user:demo" | jq '.state.completedSteps'
# Should still show ["welcome"]
```
**Expected**:
- After restart, `completedSteps` still contains `"welcome"`
- `lastCompletedAt` is set and is a recent timestamp

---

## TC-08: OnboardingTour action button dispatches NLCL command

**Setup**: Phase B complete (Task 12). Tour is active.
**Action**:
- Open browser devtools console
- In the OnboardingTour, advance to step 2 ("sidebar")
- Click the "New conversation" action button
**Expected**:
- Console logs `[onboarding action] conversation new { ok: true, ... }`
- A new conversation is created in the sidebar
- Tour advances to step 3 ("presence")

---

## TC-09: `launch.bat` sets FRONTEND_DIR and runs sidecar in foreground

**Setup**: Phase C complete (Tasks 04, 10). Windows VM with NSIS-installed app.
**Action**:
- Double-click "Vivim Desktop" desktop shortcut
- Wait for browser to open
- Close the cmd window
- Open Task Manager
**Expected**:
- cmd window opens, prints install dir / port / frontend dir
- After ~3s, browser opens to `http://localhost:9420`
- Browser shows the Vivim app (not a 404)
- After closing cmd window: `vivim-server.exe` is NOT in Task Manager (killed cleanly)

---

## TC-10: Sidecar bootstraps DB from embedded snapshot

**Setup**: Phase C complete (Tasks 05, 06). Fresh Windows VM (no existing DB).
**Action**:
- Delete `%LOCALAPPDATA%\vivim\cap-store\cap-store.sqlite` if it exists
- Double-click desktop icon
- Check the cmd window output
- Check DB file size: `dir "%LOCALAPPDATA%\vivim\cap-store\cap-store.sqlite"`
**Expected**:
- cmd window shows `✓ Bootstrapped DB from snapshot: ... → ...`
- DB file is ~4 MB (matches `seeds/seed-snapshot.db` size)
- Browser shows Vivim app with providers loaded (not an error page)

---

## TC-11: Snapshot restore handles P2021

**Setup**: Phase C complete (Task 06). Dev mode.
**Action**:
```bash
# Create an empty DB file (simulates Prisma creating the file but no schema applied)
touch ~/.local/share/vivim/cap-store/cap-store.sqlite
bun run dev
```
**Expected**:
- Server logs `DB schema not applied (P2021) — will attempt snapshot restore`
- Server logs `✓ Restored DB from snapshot: ... → ...`
- Server boots successfully
- `curl http://localhost:3000/api/providers` returns 12+ providers

---

## TC-12: `next.config.mjs` has no hardcoded path

**Setup**: Phase C complete (Task 07).
**Action**:
```bash
grep -rn "BlackBoxProject" frontend/
grep -n "turbopack" frontend/next.config.mjs
bun run dev  # from frontend/
bun run build  # from frontend/
```
**Expected**:
- `grep` returns no matches
- `bun run dev` boots without path errors on Linux/macOS
- `bun run build` succeeds

---

## TC-13: `.env.example` matches code

**Setup**: Phase C complete (Task 08).
**Action**:
```bash
grep -oE 'process\.env\.[A-Z_]+' src/config.ts | sort -u > /tmp/code-vars.txt
grep -oE '^[A-Z_]+=' .env.example | sed 's/=//' | sort -u > /tmp/env-vars.txt
diff /tmp/code-vars.txt /tmp/env-vars.txt
```
**Expected**:
- No diff (every env var read by `src/config.ts` is in `.env.example`)
- Or, if there are extra vars in `.env.example`, they're documented as "optional" or "future"

---

## TC-14: README install steps work on fresh clone

**Setup**: Phase C complete (Task 08). Clean checkout in `/tmp/vivim-fresh`.
**Action**:
```bash
git clone https://github.com/owenservera/vivim-final.git /tmp/vivim-fresh
cd /tmp/vivim-fresh
# Follow README exactly:
bun install
cd frontend && bun install && cd ..
cp .env.example .env
bun run prisma:generate
bun x prisma db push
bun run seed
bun run dev
# Open http://localhost:3000
```
**Expected**:
- Every step succeeds without errors
- `bun run seed` does NOT throw P2021
- Browser opens to Vivim app at `:3000`
- App is interactive (can click around, no console errors)

---

## TC-15: Dead code is gone

**Setup**: Phase D complete (Task 13).
**Action**:
```bash
test ! -f frontend/src/features/onboard-flow.tsx && echo "✓ onboard-flow.tsx deleted" || echo "✗ STILL EXISTS"
test ! -f frontend/db/custom.db && echo "✓ custom.db deleted" || echo "✗ STILL EXISTS"
test ! -f migrations/001_baseline.sql && echo "✓ 001_baseline.sql deleted" || echo "✗ STILL EXISTS"
! grep -rn "from.*onboard-flow" frontend/src/ && echo "✓ no onboard-flow imports" || echo "✗ DANGLING IMPORT"
! grep -rn "custom.db" frontend/ src/ scripts/ && echo "✓ no custom.db refs" || echo "✗ DANGLING REF"
ls scripts/_archive/
bun run lint
bun run dev  # smoke test
```
**Expected**:
- All "deleted" checks pass
- All "no dangling" checks pass
- `scripts/_archive/` contains the 6 archived scripts + README.md
- `bun run lint` passes
- `bun run dev` boots

---

## TC-16: Full end-to-end on fresh Windows VM

**Setup**: All phases complete. Clean Windows VM (no Vivim installed).
**Action**:
1. Download `vivim-desktop-setup.exe` from GitHub Releases
2. Run installer, accept defaults (ChatGPT/Claude/Gemini pre-checked)
3. Double-click "Vivim Desktop" desktop shortcut
4. Complete first-run: pick ChatGPT, log in to chatgpt.com in the visible Chrome window
5. Wait for Vivim to confirm login and create first conversation
6. Send a test message
7. Close the cmd window
8. Re-open Vivim from desktop shortcut
9. Verify the previous conversation is still there

**Expected**:
- Step 3: cmd window opens, browser opens after ~3s, Vivim app loads (no 404)
- Step 4: GuidedLanding walks through provider pick → Chrome launch → login → complete
- Step 5: GuidedLanding closes, OnboardingTour starts
- Step 6: message sends and a response streams back
- Step 7: cmd window closes, `vivim-server.exe` exits cleanly
- Step 8: app re-launches, DB still has the conversation from step 6
- Step 9: conversation history is intact
