# 01 — DISCOVERY PROTOCOL
### Exhaustive repo inventory before any doc is written

Do not skip files because they look boilerplate. A capability hidden in a config file (a feature flag, an under-used Tauri permission, a commented-out route) is still a capability worth surfacing, at minimum as an open question.

## A. Project skeleton
- Read root `package.json` fully: scripts, dependencies, devDependencies, engines, workspaces/monorepo config.
- Read `tsconfig.json` (and any per-package variants) for path aliases, strictness flags, target.
- Identify package manager (lockfile type) and monorepo tool if any (Turborepo, Nx, pnpm workspaces).
- Read `.env.example` / `.env*` (do not read secret values if real `.env` files with live secrets exist — read only keys/structure).

## B. Next.js surface
- Determine router type: `app/` (App Router) or `pages/`.
- Enumerate every page/route file, every `layout.tsx`, every `route.ts`/`route.js` handler, every `middleware.ts`.
- For each API route: HTTP methods exported, request/response shapes (from TS types/zod/yup schemas if present), auth checks, which DB calls it makes.
- Note rendering mode per route (SSR/SSG/ISR/client component) — relevant to architecture diagram.
- Enumerate `next.config.js/ts` — rewrites, redirects, headers, experimental flags, image domains.
- Enumerate shared UI primitives / design system location.
- Enumerate state management (Zustand/Redux/Context/React Query/SWR) and where global state lives.

## C. Tauri / Rust shell
- Read `src-tauri/tauri.conf.json`: app identifier, window config, **allowlist/capabilities/permissions** (critical for I/O and security docs), bundle targets, updater config, CSP.
- Read `src-tauri/Cargo.toml`: crates used (note anything implying capability — `tauri-plugin-sql`, `tauri-plugin-fs`, `tauri-plugin-shell`, `tauri-plugin-updater`, `reqwest`, `notify`, etc.).
- Enumerate every `#[tauri::command]` function: name, args, return type, whether `async`, which Rust module it lives in, and what it touches (filesystem, DB, network, OS APIs).
- Find the `invoke_handler` registration list in `main.rs`/`lib.rs` — cross-check against the command enumeration above; flag any command defined but not registered (dead code) or registered but not found (drift).
- Enumerate Tauri plugins initialized in `.setup()` / builder chain.
- Enumerate every `invoke('...')` call site in the TS/frontend code — this is the other half of the IPC contract. Match each to its Rust command. Flag any mismatch.
- Note event emission/listening (`emit`, `listen`, `once`) — these are async data-flow edges, not just request/response.
- Note window/webview architecture: single window, multi-window, system tray, splashscreen.

## D. SQLite / data layer
- Locate the schema source of truth: raw `.sql` files, a migrations folder, an ORM schema (Prisma/Drizzle/Kysely), or inline `CREATE TABLE` strings in Rust or TS.
- Enumerate every table: columns (name, type, nullable, default), primary keys, foreign keys, unique constraints, indexes, triggers, views.
- Determine where SQLite lives at runtime (app data dir via Tauri path API, bundled seed DB, in-memory for tests) and how the connection is opened (`tauri-plugin-sql`, `rusqlite` in Rust, `better-sqlite3`/`sql.js` in Node/Electron-style, etc.).
- Trace migration mechanism: versioning scheme, how migrations run on app upgrade, rollback story if any.
- Identify any raw SQL string-built dynamically (relevant later for a security note, not to be skipped).

## E. CLI surface
- `package.json` `bin` field and any `scripts` meant to be run standalone (seed scripts, codegen, release scripts).
- Any custom CLI built with `commander`/`yargs`/`clap` (Rust side) — enumerate subcommands, flags, defaults, exit codes.
- Tauri CLI usage itself (`tauri dev`, `tauri build`, custom `tauri.conf.json` scripts) if the project exposes wrapper scripts around it.

## F. I/O surface
- Every environment variable read anywhere (`process.env.*`, Rust `std::env::var`).
- Every filesystem path read/written outside the SQLite DB file (logs, cache, exported files, imported files, config files, user-selected files via dialog).
- Every outbound network call (fetch/axios/reqwest) — destination, auth method, retry/error handling.
- Every OS-level integration: notifications, tray, global shortcuts, deep links, auto-updater, clipboard, drag-and-drop.
- Permission/capability declarations in `tauri.conf.json` capabilities files (Tauri v2) — these double as an authoritative I/O capability list.

## G. Build, test, and deployment
- Build scripts, CI config (`.github/workflows/*` or equivalent), release/signing/notarization setup.
- Test frameworks present (unit, integration, e2e — Playwright/WebdriverIO for Tauri) and what they cover.
- Bundle targets (`msi`, `dmg`, `deb`, `appimage`) and platform-specific code paths (`#[cfg(target_os = ...)]`, `if (process.platform === ...)`).

## H. Cross-cutting concerns
- Auth/session handling, if any (local-only app vs. cloud-synced).
- Logging/telemetry — what's collected, where it goes, opt-out mechanism.
- Error handling/reporting conventions (error boundaries, Rust `Result` propagation to frontend, toast/notification patterns).
- Internationalization, accessibility affordances, theming.
- Feature flags — where defined, how toggled, current on/off state.

## I. Build the internal inventory artifact

Before moving to Phase B, materialize your findings as a working scratch file (not part of final output, or place it in `docs/OPEN-QUESTIONS.md` if genuinely unresolved) covering:
1. A flat list of every IPC command with its registration status.
2. A flat list of every API route.
3. A flat list of every SQLite table.
4. A flat list of every CLI entry point.
5. A flat list of every env var and fs path.
6. A list of anything you could not resolve with high confidence — carry these into `OPEN-QUESTIONS.md` verbatim.

This inventory is the ground truth every later template pulls from. When a template and the inventory disagree, the inventory (i.e., the code) wins.
