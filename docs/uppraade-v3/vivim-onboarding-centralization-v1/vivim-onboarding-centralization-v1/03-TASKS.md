# 03 — Task List (Ordered)

13 tasks, grouped into 4 phases. Each task is independently shippable, but the phases produce verifiable milestones.

## Phase A — Make it compile

| # | Task | Files touched | Depends on | Effort |
|---|------|---------------|------------|--------|
| 01 | Create `shared/onboarding.ts` types module | `frontend/src/shared/onboarding.ts` (new) | — | 30 min |
| 03 | Add missing `/api/onboarding/analytics` + `/api/onboarding/complete-tour` routes | `frontend/src/app/api/onboarding/analytics/route.ts` (new), `frontend/src/app/api/onboarding/complete-tour/route.ts` (new) | 01 | 30 min |

**Milestone**: `bun run dev` boots without type errors. OnboardingTour renders. Analytics events land somewhere.

## Phase B — Make first-run work in dev

| # | Task | Files touched | Depends on | Effort |
|---|------|---------------|------------|--------|
| 02 | Wire `/api/setup/*` Next.js routes to existing `setup-router.ts` | 6 new files under `frontend/src/app/api/setup/` | — | 1–2 hr |
| 11 | Coordinate GuidedLanding ↔ OnboardingTour in `page.tsx` | `frontend/src/app/page.tsx` | 01 | 30 min |
| 12 | Wire `OnboardingTour.onAction` to `/api/interpret` | `frontend/src/app/page.tsx` | 11 | 15 min |
| 09 | Add `PrismaOnboardingStore` + `UserOnboarding` model | `prisma/schema.prisma`, `prisma/migrations/0003_user_onboarding/`, `frontend/src/storage/impl/prisma-onboarding-store.ts` (new), `frontend/src/storage/impl/index.ts`, `frontend/src/lib/canvas-engine-bootstrap.ts` | 01 | 1–2 hr |

**Milestone**: a fresh-clone user can `bun install && cd frontend && bun install && cd .. && bun run prisma:generate && bun x prisma db push && bun run dev`, open `:3000`, see GuidedLanding, pick a provider, log in to Chrome, and land in a working conversation. Tour state survives server restart.

## Phase C — Make install work

| # | Task | Files touched | Depends on | Effort |
|---|------|---------------|------------|--------|
| 04 | Set `FRONTEND_DIR` in `launch.bat` | `scripts/tauri/launch.bat` | — | 5 min |
| 10 | Use `start /WAIT` in `launch.bat` for clean shutdown | `scripts/tauri/launch.bat` | — | 5 min |
| 05 | Embed `seed-snapshot.db` in sidecar; copy on first boot | `scripts/tauri/compile-sidecar.ts`, `src/desktop/sidecar-entry.ts` | — | 1–2 hr |
| 06 | Fix snapshot-restore in `src/server/index.ts` (try/catch + path) | `src/server/index.ts` | 05 | 30 min |
| 07 | Remove hardcoded Windows path from `next.config.mjs` | `frontend/next.config.mjs` | — | 5 min |
| 08 | Sync `.env.example` + README install docs | `.env.example`, `README.md` | — | 30 min |

**Milestone**: the NSIS installer produces a working app. Tauri path stays working. Env docs match code.

## Phase D — Cleanup

| # | Task | Files touched | Depends on | Effort |
|---|------|---------------|------------|--------|
| 13 | Delete dead code + orphaned artifacts | `frontend/src/features/onboard-flow.tsx`, `frontend/db/custom.db`, `migrations/001_baseline.sql`, `frontend/src/features/guided-landing.tsx` (relocate `checkNeedsSetup` first) | 02, 11 | 30 min |

**Milestone**: repo lighter, no dead code.

---

## Dependency graph

```
01 ─┬─> 03
    ├─> 11 ─> 12
    └─> 09

02 (independent)
04 (independent)
05 ─> 06
07 (independent)
08 (independent)
10 (independent)

13 ── depends on 02 (relocate checkNeedsSetup) and 11 (GuidedLanding confirmed canonical)
```

## Suggested PR strategy

- **PR 1 (Phase A)**: tasks 01, 03. Small, safe, unblocks everything else.
- **PR 2 (Phase B minus 09)**: tasks 02, 11, 12. The "first-run works in dev" PR.
- **PR 3 (Phase B 09)**: task 09. The "tour state survives restart" PR. Separate because it touches Prisma schema.
- **PR 4 (Phase C)**: tasks 04, 05, 06, 07, 08, 10. The "install works" PR. Bundle together because they're all install-path fixes.
- **PR 5 (Phase D)**: task 13. The "cleanup" PR. Last because it depends on the others being merged.

## Verification per phase

- **After Phase A**: `bun run lint` passes; `bun run dev` boots; visit `/` and confirm OnboardingTour renders without console errors.
- **After Phase B**: full first-run walkthrough — pick ChatGPT, launch Chrome, log in, land in conversation; refresh page; OnboardingTour doesn't replay (state persisted).
- **After Phase C**: build NSIS installer on Windows, install on a clean VM, double-click desktop icon, see the app, complete first-run.
- **After Phase D**: `git diff --stat main..HEAD` shows the deletions; `bun run dev` still boots.
