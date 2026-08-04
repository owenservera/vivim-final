# 01 — Audit Findings (Reference)

This is the full audit of the onboarding and install flow in vivim-final as of commit `e9f7417`. The task specs in `tasks/` reference these findings by number.

---

## Part 1 — Onboarding Flow Audit

### A. Three things called "onboarding"

| # | Name | Layer | Concern | Status |
|---|------|-------|---------|--------|
| A | **GuidedLanding** (chat-as-landing-page) | Frontend UI + missing `/api/setup/*` | User-facing first-run: pick AI provider → launch Chrome → log in → create conversation | UI complete, **backend routes missing** |
| B | **OnboardingTour** (spotlight walkthrough) | Frontend UI + `/api/onboarding/*` | User-facing feature tour: animated spotlight over canvas elements | UI complete, **shared types module missing**, several endpoints missing |
| C | **devops/onboard-*** | Backend CLI/devops | Provider auto-onboarding: autonomous agent reverse-engineers a provider's Chrome protocol | Fully implemented, separate concern |

Both A and B auto-mount on `page.tsx` at the same time. The devops layer (C) has nothing to do with user-facing onboarding despite sharing the name.

### B. End-to-end first-run journey (intended)

**Entry**: `/` (root) → `frontend/src/app/page.tsx` → `Home()` wraps `CanvasApp` in `LiveConfigProvider` (workspace `ws:global`, user `user:demo`) + `SessionStateProvider`.

**First-run gate**: `CanvasApp` calls `checkNeedsSetup()` on mount (line 99). This is re-exported from `features/guided-landing.tsx` → `features/onboard-flow.tsx`. `checkNeedsSetup()` GETs `/api/setup/profiles` and returns `true` if the profile list is empty (or if the call throws — defaults to first-run).

**If `needsSetup === true`**:
1. `setGuidedOpen(true)` opens `<GuidedLanding mode="onboarding">` overlay (z-index 2000, full-screen).
2. Agent types "Hey — I'm Vivim. I'll be your canvas." (typewriter effect, 60 cps).
3. After first message finishes typing, agent types a second message with **inline provider chips**: ChatGPT, Claude, Gemini, DeepSeek, Grok, Qwen (from `PROVIDERS` constant in `guided-landing.tsx`).
4. State machine transitions: `booting → awaiting_provider_pick`.
5. User clicks a chip OR types a provider name (`detectProvider()` matches id, name, or loose containment).
6. State → `launching_chrome`. Agent types "Opening {Provider} in a Chrome window…". After typing finishes, calls `POST /api/setup/launch-visible` with `{providerId, accountSlug: 'default', workspace: 'chrome-profiles'}`.
7. On success, state → `awaiting_login`. Polls `POST /api/setup/verify` every 3s (max 100 attempts / 5 min) with `{port: debugPort, providerId}`.
8. When `loggedIn === true`, state → `completing`. Calls:
   - `POST /api/setup/complete` (register account in DB with profileDir + debugPort)
   - `POST /api/setup/kill` (kill Chrome process, keep profile on disk)
   - `POST /api/conversations` with `{providerId}` to create a first conversation
9. State → `done`. Fade-out animation (0.6s delay + 0.6s transition). After 2.2s, calls `onComplete(conv.id, provider.id)`.
10. `page.tsx` `onComplete` handler: closes GuidedLanding, sets `needsSetup=false`, calls `refreshConversations()` + `refreshProviders()`.

**If `needsSetup === false`**: GuidedLanding stays closed. `<OnboardingTour userId="user:demo">` (also mounted on `page.tsx` line 314) independently fetches `GET /api/onboarding/state?userId=user:demo`. If state is `null` OR `dismissed=false` AND has uncompleted steps → tour starts at first uncompleted step.

**Re-entry points**: Cmd+Shift+H toggles GuidedLanding in `assistant` mode. MainMenu / CommandPalette "Open Assistant" → same. `POST /api/onboarding/reset` re-triggers OnboardingTour.

### C. State machines

**GuidedLanding** (not persisted):
```ts
type LandingState =
  | 'booting'
  | 'awaiting_provider_pick'
  | 'launching_chrome'
  | 'awaiting_login'
  | 'completing'
  | 'done'
  | 'error';
```

**OnboardingTour** (persisted in `MemoryOnboardingStore`):
```ts
type TourPhase = 'idle' | 'entering' | 'visible' | 'exiting' | 'completed' | 'dismissed';
interface OnboardingState {
  userId: string;
  completedSteps: string[];
  dismissed: boolean;
  lastShownAt?: number;
  createdAt: number;
  updatedAt: number;
}
```

**Devops Onboard Ledger** (persisted to `.runtime/onboard-ledger.json`):
```ts
type OnboardPhase = 'discover' | 'infer' | 'test-selectors' | 'test-parse'
                  | 'test-cap' | 'test-frontend' | 'verify' | 'converge';
type PhaseStatus = 'pending' | 'running' | 'done' | 'failed';
```

**ProviderOnboardingSession.status** (in Prisma):
`attached | fingerprinted | taxonomy_resolved | discovered | synthesized | promoted | registered | failed`

### D. Persistence map

| What | Where | Survives restart? |
|---|---|---|
| GuidedLanding state | React `useState` only | ❌ (re-derived via `checkNeedsSetup()`) |
| OnboardingTour step completion | `MemoryOnboardingStore` (Map in Node process) | ❌ |
| OnboardingTour analytics (client) | `localStorage['vivim-tour-analytics']` (last 100) | ✅ per-browser |
| OnboardingTour analytics (server) | `/api/onboarding/analytics` — **doesn't exist** | ❌ |
| Devops onboard phase progress | `.runtime/onboard-ledger.json` | ✅ |
| Provider onboarding session | SQLite `provider_onboarding_session` | ✅ |

### E. Critical onboarding gaps

1. **`frontend/src/shared/onboarding.ts` does NOT exist.** Six files import from `../../shared/onboarding`:
   - `storage/contracts/onboarding-store.ts` (imports `OnboardingState`)
   - `storage/impl/memory-onboarding-store.ts` (imports `OnboardingState`)
   - `components/canvas/OnboardingTour.tsx` (imports `ONBOARDING_STEPS`, `OnboardingStep`)
   - `features/onboarding/StepRenderer.tsx` (imports `OnboardingStep`)
   - `features/onboarding/useKeyboardNavigation.ts` (imports `OnboardingStep`)
   - `features/onboarding/useAnalytics.ts` (imports `TourAnalyticsEvent`)

2. **`/api/setup/*` routes don't exist.** Six endpoints are called by `guided-landing.tsx`, `onboard-flow.tsx`, and `WorkspaceSettings.tsx`:
   - `GET /api/setup/profiles`
   - `POST /api/setup/launch-visible`
   - `POST /api/setup/verify`
   - `POST /api/setup/complete`
   - `POST /api/setup/kill`
   - `GET/POST /api/setup/workspace`

3. **`/api/onboarding/analytics` doesn't exist.** Both `features/onboarding/useAnalytics.ts` and `features/help-system/useHelpAnalytics.ts` fire-and-forget POST to it.

4. **`/api/onboarding/complete-tour` doesn't exist.** `OnboardingTour.tsx` line 121 calls it on tour completion with step timings.

### F. Moderate onboarding issues

5. **Two competing onboarding systems mounted simultaneously on `page.tsx`.**
6. **`OnboardFlow` (`features/onboard-flow.tsx`) is dead code.** 292 lines, not mounted.
7. **`MemoryOnboardingStore` is the only impl** — no Prisma backing. `canvas-engine-bootstrap.ts` comment says "Production swaps the memory impls for Prisma impls" but no `PrismaOnboardingStore` exists.
8. **No `UserOnboarding` table in Prisma.**
9. **`shell.ts` `onboarding` CLI command is a stub.**
10. **`OnboardingTour` is always mounted** with `userId="user:demo"` hardcoded.

### G. Minor onboarding issues

11. **`detectProvider` in `guided-landing.tsx`** is exported as `_detectProvider` (line 975) — underscore prefix suggests test-only.
12. **`OnboardingTour.onAction` prop** is `() => {}` (no-op) in `page.tsx` line 314.
13. **`MemoryOnboardingStore.completeStep`** sets `lastShownAt` (line 31) — semantically odd; should set `lastCompletedAt`.
14. **`useAnalytics` localStorage key** is `vivim-tour-analytics` — not namespaced per user.

---

## Part 2 — Install & Setup Flow Audit

### A. Dev install flow (intended, per README)

`git clone` → `bun install` → `bun run prisma:generate` → `bun run seed` → `bun run dev`.

**What actually happens**:
1. `git clone` — no `prisma/dev.db` checked in (only `seeds/seed-snapshot.db`, 4.3 MB, golden template). No `.env` file — only `.env.example` (which does **not** set `DATABASE_URL`).
2. `bun install` (root) — installs root deps. No `postinstall` hook. Frontend deps are **not installed** by this step. The frontend has its own `package.json` + `bun.lock` and you must `cd frontend && bun install` separately (not mentioned in README).
3. `bun run prisma:generate` = `bun x prisma generate`. Reads `/prisma/schema.prisma` (canonical schema, 88 KB, ~54 tables). Generates typed `@prisma/client`. **Does NOT touch the database** — no schema is applied to SQLite.
4. `bun run seed` = `bun run src/cli/index.ts seed all` → `runSeed(['all'])` → `createServerWithEngines(9420)`. This actually **boots the full server** (not just a seed step). Side effects:
   - `getDb()` → `getPrisma()` → constructs `PrismaClient` with `datasources.db.url = file:${config.dbPath}`.
   - `config.dbPath` defaults to `~/.local/share/vivim/cap-store/cap-store.sqlite` (Linux) or `%LOCALAPPDATA%\vivim\cap-store\cap-store.sqlite` (Windows). The directory is created.
   - SQLite creates an **empty** DB file (no tables) on first connection.
   - Boot calls `await db.prisma.providerDefinition.count()` to decide `needsSeed` — **on a fresh DB this throws P2021 ("no such table: provider_definition")** because no migration was ever applied.
   - Snapshot auto-restore logic exists (`src/server/index.ts:582-615`) but is unreachable on a truly fresh DB, because the `count()` check that gates it throws before the snapshot restore can run. Even if it did run, it copies to `prisma/dev.db` (relative to cwd), while Prisma is reading from `~/.local/share/vivim/cap-store/cap-store.sqlite` — **mismatched paths**.
   - **Workaround users must discover on their own:** run `bun x prisma db push` (or `bun x prisma migrate deploy`) *before* `bun run seed`. This is the missing step in the README.
5. `bun run dev` = `bun run scripts/dev.ts`. Reads `BACKEND_PORT = process.env.CAP_STORE_PORT || 9420`, `FRONTEND_PORT = process.env.FRONTEND_PORT || 3000`. Creates `.runtime/` dir, writes `.runtime/backend.port` (port handshake file). Kills any stale process on 9420 and 3000 (Windows-only). Spawns backend as `bun src/cli/index.ts serve` from repo root. Spawns frontend as `bun run dev` (from `frontend/` dir) = `next dev -p 3000`. Prints `Backend: http://localhost:9420`, `Frontend: http://localhost:3000`.
   - **User opens browser at `http://localhost:3000`** (NOT 9420 — README is wrong on this point). The Next.js frontend has its own `/api/*` server routes that proxy to `http://localhost:${process.env.CAP_STORE_PORT || '9420'}`.

### B. Production installer flow (Windows, NSIS path — README-recommended)

**Build steps** (`scripts/tauri/build-installer.ps1`):
1. **Compile sidecar** (`scripts/tauri/compile-sidecar.ts`):
   - Entry: `src/desktop/sidecar-entry.ts`.
   - Step 0 — Copy data: `prisma/cap-store.db` → `src-tauri/data/app.db` (only if source exists; **it does not exist in the repo**, so this is skipped). Copies `seeds/providers/*.json` → `src-tauri/data/seeds/providers/`, and `seeds/parsers/harvested/*.ts` → `src-tauri/data/seeds/parsers/`.
   - Step 1 — Bundle: `Bun.build({ entrypoints: [sidecar-entry.ts], target: 'bun', minify, define: { 'process.env.NODE_ENV': '"production"' } })`.
   - Step 2 — Compile: `bun build --compile --production --minify --windows-hide-console --windows-icon=... --outfile=src-tauri/binaries/vivim-server-<host-triple>.exe`. Output ~97 MB.
   - Step 3 — UPX compress: reduces to ~45 MB.
2. **Build frontend**: `cd frontend && bun run build` (Next.js standalone build → `frontend/.next/`, `frontend/out/`).
3. **Copy frontend static files**: `frontend/out/` → `scripts/tauri/frontend/` (temporary staging).
4. **Build NSIS installer**: `C:\Program Files (x86)\NSIS\makensis.exe scripts/tauri/installer.nsi`. Output: `scripts/tauri/vivim-desktop-setup.exe` (~44 MB).
5. Cleanup: deletes `scripts/tauri/frontend/`.

**`installer.nsi`** — what the installer does on the user's machine:
- Install dir: `$LOCALAPPDATA\Vivim` (per-user, no admin needed; `RequestExecutionLevel user`).
- Pages: Welcome → License → **Custom Provider Selection** (checkboxes for ChatGPT, Claude, Gemini, DeepSeek, Qwen, Grok, OpenRouter, OpenAI API, Anthropic API; ChatGPT/Claude/Gemini pre-checked) → Directory → Install → Finish.
- Install section writes: `$INSTDIR\vivim-server.exe`, `$INSTDIR\launch.bat`, `$INSTDIR\frontend\*.*`, `$INSTDIR\config\providers.json` (generated from checkbox state).
- Shortcuts: Start Menu `Vivim\Vivim Desktop.lnk` → `launch.bat`; Desktop `Vivim Desktop.lnk` → `launch.bat`.
- ARP registration: `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\Vivim`.

**`launch.bat`** — desktop launcher:
```bat
set "INSTDIR=%~dp0"
set "BACKEND_EXE=%INSTDIR%vivim-server.exe"
set "PORT=9420"
set NODE_ENV=production
start "Vivim Backend" /B "%BACKEND_EXE%" serve --port %PORT%
timeout /t 3 /nobreak >nul
start "" "http://localhost:%PORT%"
:keep_alive
timeout /t 5 /nobreak >nul
tasklist /fi "IMAGENAME eq vivim-server.exe" | find /i "vivim-server" >nul
if %errorlevel% equ 0 goto keep_alive
```

### C. First-launch flow (intended)

1. User double-clicks the desktop icon → `launch.bat` (cmd.exe).
2. `launch.bat` starts `vivim-server.exe serve --port 9420` (detached via `start /B`).
3. Waits 3s, opens default browser to `http://localhost:9420`.
4. Polls every 5s for `vivim-server.exe` process; exits when the sidecar dies.

**Sidecar (`src/desktop/sidecar-entry.ts`)**:
1. `resolveDbUrl()` → `file:%LOCALAPPDATA%\vivim\cap-store\cap-store.sqlite` (creates the directory if missing).
2. `process.env.NODE_ENV = 'production'`.
3. `findAvailablePort(9420, 10)` → probes 9420..9429.
4. `createServerWithEngines(port)` → `Bun.serve` on `127.0.0.1:<port>`.

**Process tree (NSIS production)**:
```
Vivim Desktop.lnk
  └─ launch.bat (cmd.exe)
       └─ vivim-server.exe  (Bun-compiled sidecar)
            └─ src/desktop/sidecar-entry.ts main()
                 ├─ resolveDbUrl()
                 ├─ findAvailablePort(9420, 10)
                 └─ createServerWithEngines(port) → Bun.serve
                      ├─ Snapshot restore (broken)
                      ├─ Seed providers / parsers / automation / taxonomy / harness
                      ├─ ProviderRegistrar.initialize()
                      ├─ ChromeGovernor.boot() → seedAccounts()
                      └─ Bun.serve({ fetch, websocket, port })
       └─ Browser opens http://localhost:9420 (after 3 s delay)
```

### D. Critical install gaps

1. **Dev install flow is missing the schema-apply step.** README says `bun install` → `bun run prisma:generate` → `bun run seed` → `bun run dev`. But `prisma:generate` only generates the TypeScript client; it does **not** create DB tables. On a fresh clone, `bun run seed` calls `createServerWithEngines` which calls `db.prisma.providerDefinition.count()` — this throws `P2021 "no such table: provider_definition"` because the schema was never applied. **Fix:** add `bun x prisma db push` between `prisma:generate` and `seed` in the README. Or auto-run it in a `postinstall` hook.

2. **Snapshot auto-restore is unreachable on a fresh DB.** `src/server/index.ts:577-619` checks `(await db.prisma.providerDefinition.count()) === 0` to decide whether to restore `seeds/seed-snapshot.db`. On a fresh DB with no tables, `count()` throws P2021 before the restore can run. Even if it didn't throw, the restore copies to `prisma/dev.db` (relative to cwd), but Prisma reads from `config.dbPath` = `~/.local/share/vivim/cap-store/cap-store.sqlite` (Linux) / `%LOCALAPPDATA%\vivim\cap-store\cap-store.sqlite` (Win) by default — **the paths don't match**, so the restore would be a silent no-op. **Fix:** (a) wrap the count in try/catch and treat thrown as "needs seed"; (b) restore to `config.dbPath`, not `prisma/dev.db`; (c) document that `DATABASE_URL=file:./prisma/dev.db` is required for the snapshot path to work.

3. **NSIS-installed `launch.bat` doesn't set `FRONTEND_DIR`.** The backend's static-file-serving code (`src/server/index.ts:430-448` and `:1890-1908`) only serves frontend files if `process.env.FRONTEND_DIR` is set. `launch.bat` sets `NODE_ENV=production` but not `FRONTEND_DIR`. So when the browser opens `http://localhost:9420`, the backend falls through to `conversationRouter` which 404s on `/`. **The user sees nothing useful after install.** **Fix:** add `set FRONTEND_DIR=%INSTDIR%frontend` to `launch.bat` before the `start` command. Or have `sidecar-entry.ts` default `FRONTEND_DIR` to `<exe-dir>/frontend`.

4. **Sidecar has no migration mechanism.** `compile-sidecar.ts` copies `prisma/cap-store.db` to `src-tauri/data/app.db` *if it exists* — but the repo doesn't ship `prisma/cap-store.db`. The sidecar exe doesn't embed Prisma migrations. So on a fresh NSIS install, the sidecar creates an empty SQLite DB at `%LOCALAPPDATA%\vivim\cap-store\cap-store.sqlite` and then crashes on the same `count()` P2021 error as dev. **Fix:** either embed `seeds/seed-snapshot.db` in the sidecar and copy it to the DB path on first boot (with the path mismatch fixed), or embed `prisma/migrations/` and run `prisma migrate deploy` programmatically.

### E. High install issues

5. **README env var documentation is wrong.** README documents `DATABASE_URL`, `PORT`, `NODE_ENV`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `FRONTEND_DIR`. The actual `.env.example` exposes `CAP_STORE_PORT`, `CAP_STORE_HOST`, `CAP_STORE_DB_PATH`, etc. — and **omits** `DATABASE_URL`, `FRONTEND_DIR`, and all API key vars.

6. **`frontend/next.config.mjs` has a hardcoded Windows path.** `turbopack.root: "C:\\0-BlackBoxProject-0\\vivim-final\\frontend"`. This breaks Turbopack on any other machine or non-Windows OS.

7. **Two parallel build paths diverge.** `build.ps1` (Tauri-CLI, produces MSI+NSIS via Tauri's bundler, uses Tauri's webview + Rust supervisor) vs `build-installer.ps1` (custom NSIS, produces `vivim-desktop-setup.exe`, uses `launch.bat` + browser). The two paths have **different runtime semantics**: Tauri path uses port 9421 + Rust supervisor + webview; NSIS path uses port 9420 + `launch.bat` + system browser. README points users at `build-installer.ps1` (the broken one — see gap #3). The Tauri path appears more robust but isn't the documented one.

8. **`migrate` CLI command is misleading.** `src/cli/commands/migrate.ts` just calls `createServerWithEngines(port)` and prints "Database migrated" — it doesn't actually run any migration.

9. **`prisma/views.sql` is never applied.** Comment claims "Applied idempotently at boot by ensureViews()" but no `ensureViews` function exists in `src/`. Views must be created manually via `bunx prisma db execute --file prisma/views.sql`.

10. **`migrations/001_baseline.sql` is orphaned.** Acknowledged in audits as a second, parallel migration system that should be deleted and absorbed into Prisma migrations. Still present in repo.

### F. Medium install issues

11. **`launch.bat`'s keep-alive loop won't kill the backend when the cmd window is closed.** `start /B` detaches the sidecar; closing the cmd window kills `launch.bat` but leaves `vivim-server.exe` running as an orphan. The user has no obvious way to stop the backend short of Task Manager. **Fix:** use `start /WAIT` or `"%BACKEND_EXE%" serve --port %PORT%` (foreground) so closing the window kills the child.

12. **`scripts/dev.ts` is Windows-only.** `findPidOnPort` and `killOnPort` use `netstat -ano` and `taskkill /F /T` — both Windows commands. On Linux/macOS, `bun run dev` will fail to kill stale processes (but the rest works).

13. **`scripts/dev.ts` doesn't seed.** It just spawns the backend. If the DB is empty, the backend's auto-seed path runs (or fails per gap #1). No explicit seed step in the dev loop.

14. **`frontend/db/custom.db` is dead weight.** 24 KB stale POC DB flagged as PROLIFERATION/HIGH-risk by the repo's own `report-db-inventory.ts`. Should be deleted.

15. **`scripts/ensure-accounts.ts` has an empty `KNOWN_ACCOUNTS` array.** Even when `CAP_STORE_ENSURE_ACCOUNTS=true`, it does nothing. And no caller in `src/` imports `runEnsureAccounts` — the script is purely standalone. Either wire it into boot or delete it.

16. **Tauri updater pubkey is a placeholder.** `tauri.conf.json` has `pubkey: "REPLACE_WITH_TAURI_SIGNING_PUBKEY"` and `endpoints: ["https://updates.vivim.app/latest.json"]` (domain probably not registered). Auto-update will silently fail.

17. **`tauri.conf.json` declares `bundle.windows.nsis.installMode: "perMachine"` but `installer.nsi` uses `RequestExecutionLevel user`** and installs to `$LOCALAPPDATA\Vivim`. The two configs disagree on install scope.

18. **CORS default includes `http://localhost:5175` (Vite default) but frontend runs on 3000 (Next.js).** `CAP_STORE_CORS_ORIGIN` default in `config.ts` is `http://localhost:3000,http://localhost:5175` — the 5175 entry is dead. The `.env.example` only lists 5175 (not 3000), so users copying it as-is will get CORS errors from the Next.js frontend on 3000.

### G. Low install issues

19. **One-shot debug/codemod scripts** (`scripts/_debug-launch.ts`, `scripts/_record_node_migration.ts`, `scripts/_record_node_layer_v2.ts`, `scripts/_verify_node_tables.ts`, `scripts/fix-b7-errors.ts`, `scripts/fix-b7-imports.ts`) should be archived or deleted.

20. **`prisma/migrations.bak/`** contains 4 archived migrations — should be deleted or moved out of the repo.

---

## Part 3 — Persistence map (combined)

| What | Where | Survives restart? |
|---|---|---|
| GuidedLanding state | React `useState` only | ❌ (re-derived via `checkNeedsSetup()`) |
| OnboardingTour step completion | `MemoryOnboardingStore` (Map in Node process) | ❌ |
| OnboardingTour analytics (client) | `localStorage['vivim-tour-analytics']` (last 100) | ✅ per-browser |
| OnboardingTour analytics (server) | `/api/onboarding/analytics` — **doesn't exist** | ❌ |
| Devops onboard phase progress | `.runtime/onboard-ledger.json` | ✅ |
| Provider onboarding session | SQLite `provider_onboarding_session` | ✅ |
| SQLite DB (dev) | `~/.local/share/vivim/cap-store/cap-store.sqlite` (Linux) / `%LOCALAPPDATA%\vivim\cap-store\cap-store.sqlite` (Win) | ✅ |
| SQLite DB (NSIS prod) | Same as dev (forced by `sidecar-entry.ts`) | ✅ |
| Embedded seed snapshot | `seeds/seed-snapshot.db` (4.3 MB) — currently NOT embedded in sidecar | n/a |
| Chrome slave profiles | `~/.local/share/vivim/cap-store/chrome-profiles/<provider>/<account>` | ✅ |
| Onboard ledger | `.runtime/onboard-ledger.json` | ✅ |
| Backend port handshake | `.runtime/backend.port` | ephemeral |

---

## Part 4 — File inventory (key files)

### Frontend — UI
| Path | Role |
|------|------|
| `frontend/src/app/page.tsx` | Mounts both GuidedLanding + OnboardingTour; calls `checkNeedsSetup()` on mount |
| `frontend/src/features/guided-landing.tsx` (979 lines) | Primary first-run surface. Chat-as-landing-page. State machine. |
| `frontend/src/features/onboard-flow.tsx` (292 lines) | Legacy 3-step card wizard. Dead code. |
| `frontend/src/components/canvas/OnboardingTour.tsx` (277 lines) | Spotlight tour overlay. |
| `frontend/src/features/onboarding/SpotlightOverlay.tsx` | Animated spotlight. |
| `frontend/src/features/onboarding/StepRenderer.tsx` | Renders tour step content. |
| `frontend/src/features/onboarding/useKeyboardNavigation.ts` | Keyboard hook. |
| `frontend/src/features/onboarding/useAnalytics.ts` | Tour analytics tracker. |
| `frontend/src/features/onboarding/index.ts` | Barrel. |
| `frontend/src/components/canvas/Brand.tsx` | SVG provider logos. |
| `frontend/src/components/canvas/register-all.ts` | Registers `OnboardingTour` as `overlay.onboarding`. |

### Frontend — API Routes (existing)
| Path | Method |
|------|--------|
| `frontend/src/app/api/onboarding/state/route.ts` | GET |
| `frontend/src/app/api/onboarding/complete/route.ts` | POST |
| `frontend/src/app/api/onboarding/dismiss/route.ts` | POST |
| `frontend/src/app/api/onboarding/reset/route.ts` | POST |

### Frontend — Storage
| Path | Role |
|------|------|
| `frontend/src/storage/contracts/onboarding-store.ts` (17 lines) | `OnboardingStore` interface. |
| `frontend/src/storage/impl/memory-onboarding-store.ts` (67 lines) | `MemoryOnboardingStore` — in-memory Map. ONLY impl. |
| `frontend/src/lib/canvas-engine-bootstrap.ts` (378 lines) | Builds singleton `CanvasEngineBag`. Instantiates `MemoryOnboardingStore` at line 256. |

### Backend — setup-router.ts (existing, already implements the logic)
`src/server/setup-router.ts` exposes:
- `GET /api/setup/workspace` — returns stored workspace hint.
- `POST /api/setup/workspace` — sets workspace hint.
- `POST /api/setup/launch-visible` — spawns visible Chrome at provider's login URL with profile dir.
- `POST /api/setup/verify` — checks login state via CDP (cookie-based detection per provider).
- `POST /api/setup/complete` — finalizes DB row (`upsertAccount` with `loginState='authenticated'`, `profileDir`, `debugPort`).
- `POST /api/setup/restore` — scans workspace dir for existing profiles, recreates DB rows.
- `GET /api/setup/profiles` — lists existing profiles on disk.
- `POST /api/setup/kill` — kills Chrome process by port (must be added if missing).

These handlers exist on the backend but are NOT exposed as Next.js `/api/setup/*` route handlers. The fix is to add Next.js route files that proxy to these handlers (or call them directly if they're importable).

### Backend — server boot
| Path | Role |
|------|------|
| `src/server/index.ts` | `createServer(port)` + `createServerWithEngines(port)`. Snapshot restore at lines 577-619 (broken). |
| `src/storage/db.ts` | `CapStoreDb` class, `getDb()`/`setDb()` singleton. |
| `src/storage/prisma.ts` | `getPrisma()` singleton, resolves `DATABASE_URL`. |
| `src/config.ts` | Centralized env config, `defaultDataDir()`, port handshake. |
| `src/desktop/sidecar-entry.ts` | Compiled sidecar entry. |
| `src/engines/provider-registrar.ts` | `seedAll()` iterates `PROVIDER_MANIFESTS`. |
| `src/engines/chrome-governor.ts` | `boot()` → `seedAccounts()`. |
| `src/engines/chrome-setup-wizard.ts` | Programmatic setup wizard (launch visible, poll URL, save account). |

### Devops (separate concern, untouched by this pack)
| Path | Role |
|------|------|
| `devops/onboard-provider.ts` | Agent entry point for autonomous provider onboarding. |
| `devops/onboard-controller.ts` | Phase dispatcher (8 phases). |
| `devops/onboard-ledger.ts` | Resumable ledger persisted to `.runtime/onboard-ledger.json`. |
| `devops/onboard-verify.ts` | 12-check verification suite for an onboarded provider. |

### Prisma
| Path | Finding |
|------|---------|
| `prisma/schema.prisma` (root, canonical) | Has `ProviderOnboardingSession` (line 3077) + 5 related models. **No `UserOnboarding` table exists.** |
| `frontend/prisma/schema.prisma` | Boilerplate only — `User` + `Post`. Comment says "canonical application schema is at ../prisma/schema.prisma". |

### Scripts
| Path | Role |
|------|------|
| `scripts/dev.ts` | Dev launcher. Windows-only. |
| `scripts/stop.ts` | Kills processes on 9420 + 3000. |
| `scripts/setup-slaves.ts` | Interactive Chrome slave login bootstrap. |
| `scripts/seed-snapshot.ts` | Captures `prisma/dev.db` → `seeds/seed-snapshot.db`. |
| `scripts/restore-db.ts` | Restores `prisma/dev.db` from snapshot or latest backup. |
| `scripts/backup-db.ts` | Timestamped backup of `prisma/dev.db`. |
| `scripts/tauri/build-installer.ps1` | NSIS installer build (README path). |
| `scripts/tauri/build.ps1` | Tauri-CLI build (undocumented). |
| `scripts/tauri/compile-sidecar.ts` | Bun build → compile → UPX. |
| `scripts/tauri/prepare-frontend.ts` | Builds Next.js, copies `.next/static` → `out/_next/static`. |
| `scripts/tauri/installer.nsi` | NSIS installer script. |
| `scripts/tauri/launch.bat` | Desktop launcher. |

### Tauri
| Path | Role |
|------|------|
| `src-tauri/tauri.conf.json` | Tauri v2 config. |
| `src-tauri/src/main.rs` | Entry: calls `vivim_desktop_lib::run()`. |
| `src-tauri/src/lib.rs` | Sidecar supervisor: spawns `vivim-server serve --host 127.0.0.1 --port 9421`. |

### Config
| Path | Role |
|------|------|
| `.env.example` (root) | Actual env vars (mismatched with README). |
| `package.json` (root) | Root scripts. |
| `frontend/package.json` | Frontend scripts. |
| `frontend/next.config.mjs` | Next.js config (hardcoded Windows path). |
| `opencode.json` | OpenCode config. |
