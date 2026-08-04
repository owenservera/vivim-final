# Acceptance Checklist

Run through this checklist end-to-end after completing all 13 tasks. Each item maps to one or more tasks.

## Phase A — Make it compile

- [ ] `frontend/src/shared/onboarding.ts` exists and exports `OnboardingState`, `OnboardingStep`, `ONBOARDING_STEPS`, `TourAnalyticsEvent` (Task 01)
- [ ] `ONBOARDING_STEPS` has exactly 5 entries, each with a unique `id` (Task 01)
- [ ] `frontend/src/app/api/onboarding/analytics/route.ts` exists and accepts POST (Task 03)
- [ ] `frontend/src/app/api/onboarding/complete-tour/route.ts` exists and accepts POST (Task 03)
- [ ] `OnboardingStore` contract has `completeTour` method (Task 03)
- [ ] `MemoryOnboardingStore` implements `completeTour` (Task 03)
- [ ] `bun run lint` (from `frontend/`) passes with no new errors
- [ ] `bun run dev` boots without "module not found" errors for `../../shared/onboarding`
- [ ] `OnboardingTour` renders (manually trigger via `POST /api/onboarding/reset`)

## Phase B — Make first-run work in dev

- [ ] All 6 route files exist under `frontend/src/app/api/setup/` (Task 02)
- [ ] `curl http://localhost:3000/api/setup/profiles` returns `{ ok: true, profiles: [...] }` (Task 02)
- [ ] `curl -X POST .../api/setup/launch-visible -d '{"providerId":"chatgpt",...}'` launches Chrome and returns a debugPort (Task 02)
- [ ] `curl -X POST .../api/setup/verify -d '{"port":...,"providerId":"chatgpt"}'` returns login state (Task 02)
- [ ] `curl -X POST .../api/setup/kill -d '{"port":...}'` kills the Chrome process (Task 02)
- [ ] GuidedLanding first-run walkthrough works end-to-end in browser (Task 02)
- [ ] `page.tsx` has `guidedComplete` state; `<OnboardingTour>` only renders when `guidedComplete === true` (Task 11)
- [ ] On first run, only GuidedLanding renders — no simultaneous OnboardingTour (Task 11)
- [ ] After GuidedLanding completes, OnboardingTour starts (Task 11)
- [ ] Returning users (`needsSetup === false`) see OnboardingTour immediately (Task 11)
- [ ] Clicking a tour step's action button triggers the NLCL command via `/api/interpret` (Task 12)
- [ ] Console shows `[onboarding action] <command> <result>` on click (Task 12)
- [ ] `prisma/schema.prisma` has the `UserOnboarding` model (Task 09)
- [ ] `prisma/migrations/0003_user_onboarding/migration.sql` exists and applies cleanly (Task 09)
- [ ] `frontend/src/storage/impl/prisma-onboarding-store.ts` exists and implements `OnboardingStore` (Task 09)
- [ ] `canvas-engine-bootstrap.ts` uses `PrismaOnboardingStore` (Task 09)
- [ ] **Tour state survives server restart**: complete a step, restart `bun run dev`, GET state — completedSteps persists (Task 09)
- [ ] `MemoryOnboardingStore` still exists and is exported (for tests) (Task 09)

## Phase C — Make install work

- [ ] `scripts/tauri/launch.bat` sets `FRONTEND_DIR=%INSTDIR%frontend` (Task 04)
- [ ] `scripts/tauri/launch.bat` runs `vivim-server.exe` in the foreground (no `start /B`) (Task 10)
- [ ] `scripts/tauri/launch.bat` opens browser after ~3s delay (Task 04)
- [ ] Closing the cmd window kills `vivim-server.exe` (Task 10)
- [ ] `scripts/tauri/compile-sidecar.ts` copies `seeds/seed-snapshot.db` to `src-tauri/data/seed-snapshot.db` (Task 05)
- [ ] `src/desktop/sidecar-entry.ts` has a `bootstrapDb()` function that runs before `createServerWithEngines()` (Task 05)
- [ ] `bootstrapDb()` copies the embedded snapshot to `config.dbPath` when DB is missing or < 100 KB (Task 05)
- [ ] `scripts/tauri/installer.nsi` includes `data/seed-snapshot.db` in the install output (Task 05)
- [ ] `src/server/index.ts` wraps the `count()` call in try/catch (Task 06)
- [ ] P2021 errors trigger the snapshot restore (Task 06)
- [ ] Restore target is `config.dbPath`, not `prisma/dev.db` (Task 06)
- [ ] After restore, Prisma is re-initialized (Task 06)
- [ ] Fresh DB (delete SQLite file, `bun run dev`) boots and populates from snapshot (Task 06)
- [ ] `frontend/next.config.mjs` has no `turbopack.root` line (Task 07)
- [ ] `grep -r "BlackBoxProject" frontend/` returns no matches (Task 07)
- [ ] `bun run dev` boots on a non-Windows machine (Task 07)
- [ ] `.env.example` lists every env var `src/config.ts` reads (Task 08)
- [ ] `.env.example` includes `DATABASE_URL`, `FRONTEND_DIR`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` (Task 08)
- [ ] README install section includes `cd frontend && bun install` (Task 08)
- [ ] README install section includes `bun x prisma db push` between `prisma:generate` and `seed` (Task 08)
- [ ] README says to open `http://localhost:3000`, not `:9420` (Task 08)
- [ ] No env var documented in README is missing from `.env.example` (Task 08)

## Phase D — Cleanup

- [ ] `frontend/src/features/onboard-flow.tsx` is deleted (Task 13)
- [ ] `checkNeedsSetup` is defined in `guided-landing.tsx` or `lib/setup.ts`, not re-exported (Task 13)
- [ ] No file in `frontend/src/` imports from `onboard-flow` (Task 13)
- [ ] `frontend/db/custom.db` is deleted (Task 13)
- [ ] No file references `custom.db` (Task 13)
- [ ] `migrations/001_baseline.sql` is deleted (Task 13)
- [ ] No file references `001_baseline` (Task 13)
- [ ] `scripts/_archive/` exists with the 6 one-shot scripts + README.md (Task 13)
- [ ] `bun run lint` passes (Task 13)
- [ ] `bun run dev` boots (Task 13)
- [ ] `bun run build` succeeds (Task 13)

## End-to-end smoke test (after all phases)

### Dev path
```bash
# On a clean checkout
git clone https://github.com/owenservera/vivim-final.git /tmp/vivim-test
cd /tmp/vivim-test
bun install
cd frontend && bun install && cd ..
cp .env.example .env
bun run prisma:generate
bun x prisma db push
bun run seed
bun run dev
# Open http://localhost:3000
# Complete first-run: pick ChatGPT, log in, land in conversation
# Verify OnboardingTour starts after GuidedLanding completes
# Click "New conversation" action button — verify it creates a new conversation
# Restart server (Ctrl+C, bun run dev again)
# Refresh page — tour state persists (doesn't replay completed steps)
```

### NSIS install path (Windows, requires build environment)
```powershell
# Build installer
pwsh scripts/tauri/build-installer.ps1
# Verify seed-snapshot.db was copied
Test-Path src-tauri\data\seed-snapshot.db
# Run installer (vivim-desktop-setup.exe) on a clean Windows VM
# Double-click desktop icon
# Verify:
#   - cmd window opens
#   - After ~3s, browser opens to http://localhost:9420
#   - Browser shows Vivim app (NOT a 404)
#   - Vivim loads, GuidedLanding appears
#   - Complete first-run end-to-end
# Close the cmd window
# Verify vivim-server.exe is gone from Task Manager
```

### Fresh DB restore test
```bash
# Linux
rm -f ~/.local/share/vivim/cap-store/cap-store.sqlite*
bun run dev
# Verify logs show "✓ Restored DB from snapshot: ... → ..."
# Verify http://localhost:3000/api/providers returns 12+ providers
# (not a 500 error from P2021)
```
