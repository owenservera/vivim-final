# Audit: Install Flow

Reference extract from the full audit. See `01-AUDIT.md` for the complete findings.

## Dev install flow

README says: `bun install` → `prisma:generate` → `seed` → `dev`.

**What actually happens**:
1. `bun install` (root) — installs root deps. No `postinstall`. Frontend deps NOT installed (must `cd frontend && bun install`).
2. `bun run prisma:generate` — generates Prisma client. **Does NOT apply schema to DB.**
3. `bun run seed` — boots full server, calls `db.prisma.providerDefinition.count()` → **throws P2021 on fresh DB** (no tables).
4. Snapshot auto-restore exists (`src/server/index.ts:577-619`) but is unreachable: count() throws before restore runs; restore copies to `prisma/dev.db` but Prisma reads from `config.dbPath` — **path mismatch**.
5. `bun run dev` — spawns backend on 9420 + frontend on 3000. User opens `http://localhost:3000` (NOT 9420 as README says).

**Missing step**: `bun x prisma db push` between `prisma:generate` and `seed`.

## Production installer flow (Windows, NSIS path — README-recommended)

`scripts/tauri/build-installer.ps1`:
1. `compile-sidecar.ts` — Bun build → compile → UPX (~44 MB). Copies `prisma/cap-store.db` to `src-tauri/data/app.db` *if it exists* — **it doesn't**. Copies provider/parsers seeds.
2. `next build` — Next.js standalone build.
3. `makensis installer.nsi` — produces `vivim-desktop-setup.exe`.

**`installer.nsi`**:
- Install dir: `$LOCALAPPDATA\Vivim` (per-user, no admin).
- Provider-checkbox page (ChatGPT/Claude/Gemini pre-checked).
- Writes: `vivim-server.exe`, `launch.bat`, `frontend\*.*`, `config\providers.json`.
- Shortcuts: Start Menu + Desktop → `launch.bat`.

**`launch.bat`**:
```bat
start "Vivim Backend" /B "%BACKEND_EXE%" serve --port %PORT%"
timeout /t 3 /nobreak >nul
start "" "http://localhost:%PORT%"
:keep_alive
timeout /t 5 /nobreak >nul
tasklist /fi "IMAGENAME eq vivim-server.exe" | find /i "vivim-server" >nul
if %errorlevel% equ 0 goto keep_alive
```

## Tauri-CLI install path (alternative, more robust, undocumented)

`scripts/tauri/build.ps1` → `cargo tauri build` → MSI + NSIS.
- Rust supervisor (`src-tauri/src/lib.rs`) spawns sidecar on port 9421.
- Parses stdout for `listening on http://127.0.0.1:<port>`, emits `backend-ready` event.
- Auto-restart: 5 attempts, exp backoff (1/2/4/8/16s).
- Webview loads `frontendDist: "../frontend/out"`.
- Frontend detects Tauri env, uses port from `backend-ready` event.

## Critical install gaps

1. **Dev install missing schema-apply step.** README says `bun install` → `prisma:generate` → `seed` → `dev`. Missing `bun x prisma db push` between generate and seed. On fresh clone, `seed` throws P2021.

2. **Snapshot auto-restore unreachable on fresh DB.** `count()` throws P2021 before restore runs. Even if it didn't, restore copies to `prisma/dev.db` but Prisma reads from `config.dbPath` — path mismatch.

3. **NSIS `launch.bat` doesn't set `FRONTEND_DIR`.** Backend's static-file-serving code only serves frontend if `process.env.FRONTEND_DIR` is set. Browser opens `:9420` → 404. **User sees nothing after install.**

4. **Sidecar has no migration mechanism.** `compile-sidecar.ts` copies `prisma/cap-store.db` *if it exists* — repo doesn't ship it. No Prisma migrations embedded. Fresh NSIS install → empty SQLite → `count()` throws P2021.

## High install issues

5. **README env var docs wrong.** Documents `DATABASE_URL`, `OPENAI_API_KEY`, etc. `.env.example` exposes `CAP_STORE_*` and omits `DATABASE_URL`/`FRONTEND_DIR`/API keys.

6. **`frontend/next.config.mjs` has hardcoded Windows path.** `turbopack.root: "C:\\0-BlackBoxProject-0\\vivim-final\\frontend"`. Breaks on non-Windows.

7. **Two parallel build paths diverge.** `build.ps1` (Tauri-CLI, port 9421, Rust supervisor, webview) vs `build-installer.ps1` (custom NSIS, port 9420, `launch.bat`, browser). README points at NSIS (broken). Tauri path more robust but undocumented.

8. **`migrate` CLI command misleading.** Just boots server, doesn't run migrations.

9. **`prisma/views.sql` never applied.** Comment claims `ensureViews()` at boot — no such function exists.

10. **`migrations/001_baseline.sql` orphaned.** Second parallel migration system. Should be deleted.

## Medium install issues

11. **`launch.bat` keep-alive detaches backend.** `start /B` leaves `vivim-server.exe` orphan when cmd window closes. Use `start /WAIT` or foreground.

12. **`scripts/dev.ts` Windows-only.** `netstat -ano` + `taskkill /F /T`.

13. **`scripts/dev.ts` doesn't seed.** Just spawns backend. No explicit seed step.

14. **`frontend/db/custom.db` dead weight.** 24 KB stale POC DB. Flagged PROLIFERATION/HIGH-risk.

15. **`scripts/ensure-accounts.ts` has empty `KNOWN_ACCOUNTS`.** Even when `CAP_STORE_ENSURE_ACCOUNTS=true`, no-op. No caller in `src/`.

16. **Tauri updater pubkey placeholder.** `REPLACE_WITH_TAURI_SIGNING_PUBKEY`, endpoint `https://updates.vivim.app/latest.json` (probably not registered).

17. **`tauri.conf.json` vs `installer.nsi` install scope disagreement.** Tauri says `perMachine`, NSIS uses `RequestExecutionLevel user` + `$LOCALAPPDATA`.

18. **CORS default includes `http://localhost:5175`** (Vite) but frontend runs on 3000 (Next.js). `.env.example` only lists 5175 — users get CORS errors.

## Low install issues

19. One-shot debug/codemod scripts should be archived: `_debug-launch.ts`, `_record_node_migration.ts`, `_record_node_layer_v2.ts`, `_verify_node_tables.ts`, `fix-b7-errors.ts`, `fix-b7-imports.ts`.

20. `prisma/migrations.bak/` — 4 archived migrations, should be deleted.

## Ports and process boundaries

| Port | Process | Purpose |
|---|---|---|
| `9420` | Backend (dev or NSIS prod) | REST API + WebSocket |
| `9421` | Backend (Tauri sidecar default) | same |
| `9420..9620` | Backend fallback range | If 9420 busy |
| `9421..9430` | Sidecar fallback range | `findAvailablePort(PORT, 10)` |
| `3000` | Next.js dev server | Frontend dev |
| `5175` | (legacy Vite, in CORS default) | Dead |
| `9222..9250` | Chrome slaves (CDP) | Per-provider debug ports |

**Process boundaries (dev)**: `bun run scripts/dev.ts` (parent) → spawns backend child + frontend child. Parent writes `.runtime/backend.port`. SIGINT kills both.

**Process boundaries (NSIS prod)**: `launch.bat` (cmd.exe) → `start /B vivim-server.exe` (detached) → browser. `launch.bat` polls `tasklist` every 5s. Closing cmd window leaves `vivim-server.exe` orphan.

**Process boundaries (Tauri prod)**: Tauri shell (`vivim-desktop.exe`) → spawns sidecar via `tauri-plugin-shell`. Rust supervisor monitors stdout, emits `backend-ready`, auto-restarts (5 attempts). Closing Tauri window terminates sidecar.
