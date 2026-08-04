# 02 — Architectural Decisions

This doc lists every architectural choice the pack makes. If you disagree with one, raise it before implementing — do not silently diverge. Each decision includes the alternatives considered and the rationale for the pick.

---

## Decision 1 — GuidedLanding is the canonical first-run UI; OnboardingTour defers

**Choice**: GuidedLanding (`features/guided-landing.tsx`) is the first-run experience. OnboardingTour (`components/canvas/OnboardingTour.tsx`) only starts after GuidedLanding completes.

**Alternatives considered**:
- **A. Keep both, no coordination.** Status quo. Result: two overlays fight for attention on first run, user sees a chat landing *and* a spotlight tour at the same time. Bad UX.
- **B. OnboardingTour wins; GuidedLanding becomes optional.** Result: tour is feature-focused, doesn't actually get the user logged in to a provider. First-run user has no path to "I have a working conversation."
- **C. Delete OnboardingTour entirely.** Result: throw away a working spotlight tour that has value for power users who skip first-run.
- **D. Merge them into one component.** Result: a 1500-line monolith that nobody can maintain.

**Rationale for the pick**: GuidedLanding solves the actual first-run problem ("I have no provider account, I need to log in to ChatGPT/Claude/Gemini"). OnboardingTour solves a different problem ("I'm logged in but I don't know what the canvas can do"). They're sequential, not competing. GuidedLanding runs first; when it completes, OnboardingTour is allowed to start.

**Implementation**: in `page.tsx`, add a `guidedComplete` state. `<OnboardingTour>` is only mounted when `guidedComplete === true` (or when `needsSetup === false` on initial mount, for returning users). Task 11 covers this.

---

## Decision 2 — `shared/onboarding.ts` is the single source of truth for onboarding types and step definitions

**Choice**: create `frontend/src/shared/onboarding.ts` exporting `OnboardingState`, `OnboardingStep`, `ONBOARDING_STEPS`, `TourAnalyticsEvent`. All consumers import from there.

**Alternatives considered**:
- **A. Put types in `storage/contracts/onboarding-store.ts`.** Result: storage layer becomes the source of truth for UI types. Wrong direction of dependency.
- **B. Put types in `components/canvas/OnboardingTour.tsx`.** Result: UI component is the source of truth for storage types. Wrong direction of dependency.
- **C. Put types in a new `features/onboarding/types.ts`.** Result: one more place to look. Doesn't solve the "shared across features + storage" problem.

**Rationale**: types are shared across `features/onboarding/*`, `components/canvas/OnboardingTour.tsx`, `storage/contracts/*`, `storage/impl/*`. The only neutral location that doesn't create a dependency direction problem is a `shared/` directory at the feature root. This matches the existing import path the consumers already use (`../../shared/onboarding`).

**Implementation**: Task 01. The exact exports are spec'd in `tasks/01-shared-onboarding-types.md` and the `templates/shared-onboarding.ts.template` file.

---

## Decision 3 — `OnboardingStore` is the only store contract; `PrismaOnboardingStore` is the production impl

**Choice**: keep the `OnboardingStore` interface in `storage/contracts/onboarding-store.ts`. Add `PrismaOnboardingStore` in `storage/impl/prisma-onboarding-store.ts`. `canvas-engine-bootstrap.ts` swaps `MemoryOnboardingStore` for `PrismaOnboardingStore`. `MemoryOnboardingStore` stays for tests.

**Alternatives considered**:
- **A. Just use Prisma directly, drop the contract.** Result: locks the codebase to Prisma; harder to test in isolation; future storage swap (e.g. embedded SQLite via better-sqlite3) requires touching every call site.
- **B. Keep `MemoryOnboardingStore` in production, add a periodic flush to disk.** Result: still loses data on crash between flushes; adds a timer; solves nothing.
- **C. Use localStorage from the client.** Result: state is per-browser, not per-user; breaks multi-device; can't be read by the backend for feature gating.

**Rationale**: the contract pattern is already established in the codebase (`contracts/index.ts`, `impl/index.ts`). The bootstrap comment explicitly says "Production swaps the memory impls for Prisma impls (still via the same contracts)" — this pack just completes that stated intent. Adding the Prisma impl is the minimum viable centralization.

**Implementation**: Task 09. Adds a `UserOnboarding` Prisma model + migration. The `PrismaOnboardingStore` reads/writes that table. `canvas-engine-bootstrap.ts` line 256 swaps the impl.

---

## Decision 4 — `/api/setup/*` routes are Next.js handlers that proxy to the existing `setup-router.ts`

**Choice**: create 6 Next.js route files under `frontend/src/app/api/setup/` that import the corresponding handlers from `src/server/setup-router.ts` and invoke them. Each route file is ~15 lines: parse the Next.js `Request`, call the setup-router function, return a `NextResponse`.

**Alternatives considered**:
- **A. Move all setup-router logic into Next.js route files.** Result: duplicates logic; setup-router is also called by `chrome-setup-wizard.ts` (programmatic, agent-safe path) — moving breaks that.
- **B. Add a generic `/api/proxy?path=/setup/...` route.** Result: one escape hatch that bypasses TypeScript type safety; harder to audit.
- **C. Have the frontend call the backend directly on port 9420.** Result: breaks same-origin; CORS pain; Tauri webview path uses a different port.

**Rationale**: the backend already implements the logic. The frontend already calls `/api/setup/*` (same-origin). The Next.js route file is the thinnest possible bridge — it imports the handler and calls it. No duplication, no CORS, no port juggling. This is the same pattern the existing `/api/onboarding/*` routes already use.

**Implementation**: Task 02. The 6 route files are spec'd in `tasks/02-setup-api-routes.md` with a `templates/setup-api-route-handlers.ts.template` showing the pattern.

**Open question**: confirm `setup-router.ts` exports its handlers as importable functions (not just registers them on an Express-like router). If it registers them on a router object, the Next.js route will need to construct a fake `Request` and call the router. The task spec includes a sub-step to verify this.

---

## Decision 5 — `launch.bat` sets `FRONTEND_DIR` and uses `start /WAIT`

**Choice**: `launch.bat` adds `set FRONTEND_DIR=%INSTDIR%frontend` before starting the sidecar, and switches `start /B` to `start /WAIT` (or runs the sidecar in the foreground) so closing the cmd window kills the sidecar.

**Alternatives considered**:
- **A. Have `sidecar-entry.ts` default `FRONTEND_DIR` to `<exe-dir>/frontend`.** Result: works, but couples the sidecar to the install layout. Dev mode (where frontend runs on port 3000) would need to override.
- **B. Have the backend serve frontend from a known relative path always.** Result: same coupling, less explicit.
- **C. Run the frontend as a separate process and reverse-proxy.** Result: more processes, more ports, more failure modes.

**Rationale**: the install layout is `%LOCALAPPDATA%\Vivim\{vivim-server.exe, launch.bat, frontend\}`. `launch.bat` knows `%INSTDIR%` (it's `%~dp0`). Setting `FRONTEND_DIR=%INSTDIR%frontend` is the most explicit, least magical fix. Dev mode doesn't use `launch.bat`, so it's unaffected.

For the keep-alive fix: `start /WAIT` blocks the cmd window until the child exits. Closing the window sends SIGINT to the child. This is the standard pattern for "shell wrapper around a long-running process."

**Implementation**: Task 04 + Task 10. The `templates/launch.bat.template` shows the new file.

---

## Decision 6 — Sidecar embeds `seeds/seed-snapshot.db` and copies it to `config.dbPath` on first boot

**Choice**: `compile-sidecar.ts` copies `seeds/seed-snapshot.db` into `src-tauri/data/seed-snapshot.db` (in addition to the existing provider/parsers seeds). `sidecar-entry.ts` checks: if the DB file at `config.dbPath` doesn't exist OR is empty, copy the embedded snapshot to `config.dbPath` before opening Prisma.

**Alternatives considered**:
- **A. Embed `prisma/migrations/` and run `prisma migrate deploy` programmatically.** Result: requires bundling the migration files; Prisma's migrate API isn't designed for embedded use; adds ~30s to first boot.
- **B. Ship a SQL dump and execute it.** Result: schema drift between Prisma and the dump; no migration history.
- **C. Make the user run a setup step on first launch.** Result: bad UX; user double-clicks the icon and sees an error.

**Rationale**: the snapshot is already 4.3 MB and contains a fully-seeded DB (providers, parsers, taxonomy, harness commands, automation roles). Copying a file is O(milliseconds). The snapshot is regenerated by `bun run seed:snapshot` as part of the release process. This is the fastest path to "first launch works."

The fix also requires fixing `src/server/index.ts` to wrap the `count()` in try/catch and treat thrown as "needs seed" (Task 06). Without that, even with the snapshot copied, the boot order still fails.

**Implementation**: Task 05 + Task 06. `templates/launch.bat.template` and the sidecar changes are spec'd in `tasks/05-sidecar-db-bootstrap.md`.

---

## Decision 7 — `next.config.mjs` removes the hardcoded Windows path

**Choice**: delete the `turbopack.root` line. Next.js 16's Turbopack auto-detects the root.

**Alternatives considered**:
- **A. Replace with `process.cwd()`.** Result: works but unnecessary; Turbopack already does this.
- **B. Move to `next.config.ts` and use `__dirname`.** Result: Next.js 16 supports both `.mjs` and `.ts`; switching is gratuitous.

**Rationale**: the hardcoded path is a developer-machine leak (looks like `C:\0-BlackBoxProject-0\vivim-final\frontend`). Next.js doesn't need it. Delete the line.

**Implementation**: Task 07. Trivial edit.

---

## Decision 8 — `.env.example` and `README.md` are rewritten to match what the code reads

**Choice**: rewrite `.env.example` to list every env var `src/config.ts` reads, with sensible defaults and comments. Rewrite the README install section to: `bun install` → `cd frontend && bun install` → `cd ..` → `bun run prisma:generate` → `bun x prisma db push` → `bun run seed` → `bun run dev` → open `http://localhost:3000`.

**Alternatives considered**:
- **A. Leave docs as-is, fix the code to match the docs.** Result: would require renaming `CAP_STORE_*` env vars to `DATABASE_URL`/`PORT`/etc. Breaking change for anyone who has a `.env` already.
- **B. Generate `.env.example` from `src/config.ts` at build time.** Result: clever but fragile; comment text doesn't live in code.

**Rationale**: the code is the source of truth. Docs should match code, not the other way around. The README's install steps were missing `prisma db push` and the frontend port — both are factual errors that block first-run.

**Implementation**: Task 08. `templates/env.example.template` shows the new file.

---

## Decision 9 — `OnboardingTour.onAction` is wired to dispatch via `/api/interpret`

**Choice**: in `page.tsx`, the `onAction` prop passed to `<OnboardingTour>` calls `io.post('/api/interpret', { command: step.action.command })` (same pattern `HelpWidget` already uses).

**Alternatives considered**:
- **A. Leave `onAction` as a no-op.** Result: step action buttons look interactive but do nothing. Bad UX.
- **B. Dispatch via a custom event bus.** Result: adds a new mechanism when `/api/interpret` already exists for "natural language command → action."
- **C. Hard-code each step's action as a switch statement.** Result: brittle; new steps require code changes.

**Rationale**: `/api/interpret` is the existing NLCL (Natural Language Command Layer) route. Step actions are already defined as command strings in `ONBOARDING_STEPS`. Wiring them through `/api/interpret` means the existing capability dispatcher handles them — no new code path.

**Implementation**: Task 12.

---

## Decision 10 — Dead code and orphaned artifacts are deleted

**Choice**: delete `frontend/src/features/onboard-flow.tsx` (after relocating `checkNeedsSetup`), `frontend/db/custom.db`, `migrations/001_baseline.sql`. Archive (don't delete) `prisma/migrations.bak/` and the one-shot `_*.ts` scripts to a `scripts/_archive/` directory.

**Alternatives considered**:
- **A. Leave dead code in place.** Result: future engineers waste time reading code that isn't used; lint noise; bundle size.
- **B. Delete everything aggressively.** Result: lose git history reference for the one-shot codemods that may still be informative.

**Rationale**: `onboard-flow.tsx` is 292 lines of dead code that's been superseded by `guided-landing.tsx`. The `checkNeedsSetup` function it exports is the only thing still used, and that's a 5-line function that's already re-exported through `guided-landing.tsx`. `custom.db` and `001_baseline.sql` are flagged as orphaned by the repo's own audits. The one-shot scripts are codemods that have already run — keeping them in `scripts/_archive/` preserves git history without cluttering the active scripts dir.

**Implementation**: Task 13.

---

## Decision 11 — `MemoryOnboardingStore` is kept for tests; `PrismaOnboardingStore` is the prod impl

**Choice**: don't delete `MemoryOnboardingStore`. It's useful for unit tests that don't want to spin up SQLite. `canvas-engine-bootstrap.ts` swaps to `PrismaOnboardingStore`; tests can construct `MemoryOnboardingStore` directly.

**Rationale**: standard contract pattern. The contract is the source of truth; impls are swappable. Tests benefit from in-memory speed.

---

## Decision 12 — The pack is reusable; the frontend portal scans `/home/z/my-project/download/packs/`

**Choice**: the download portal (the Next.js app this pack generator also produces) scans `/home/z/my-project/download/packs/` at request time and lists every directory as a downloadable zip. To add a new pack, drop a new `pack-name-vN/` directory in there. The portal zips on demand.

**Rationale**: the user explicitly said "assume we will do this more than once." Hardcoding pack metadata in the portal defeats the purpose. Scanning the filesystem means future packs (v2, v3, different topic) are picked up automatically.

**Implementation**: the portal's `/api/packs` route reads the directory; `/api/packs/[name]/download` zips and streams.

---

## Non-decisions (explicitly out of scope)

These were considered and deliberately left for a future pack:

- **Multi-user onboarding state**. The tour is currently keyed by `userId="user:demo"`. Parameterizing this requires a session/auth system, which is a separate workstream.
- **`devops/onboard-*` consolidation**. The provider auto-onboarding pipeline is a separate concern. Don't touch it.
- **Tauri-CLI vs NSIS build path unification**. This pack fixes the NSIS path. Unifying on Tauri-CLI (and deleting the custom NSIS) is a larger decision that affects the release pipeline.
- **Chrome slave fleet scaling**. Out of scope.
- **Mobile onboarding**. Out of scope.
- **SSO / OAuth provider login**. Out of scope; the current Chrome-profile-based login is the model.
