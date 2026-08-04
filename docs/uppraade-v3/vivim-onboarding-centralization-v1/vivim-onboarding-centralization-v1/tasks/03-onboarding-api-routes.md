# Task 03 — Add missing `/api/onboarding/analytics` + `/api/onboarding/complete-tour` routes

**Phase**: A (Make it compile)
**Depends on**: Task 01 (needs `TourAnalyticsEvent` type)
**Effort**: 30 min
**Files touched**:
- `frontend/src/app/api/onboarding/analytics/route.ts` (new)
- `frontend/src/app/api/onboarding/complete-tour/route.ts` (new)

## Context

Two endpoints are called by the frontend but don't exist:

1. **`/api/onboarding/analytics`** — called by `features/onboarding/useAnalytics.ts` (line 54) and `features/help-system/useHelpAnalytics.ts` (line 73). Both fire-and-forget POST. All analytics events silently 404.

2. **`/api/onboarding/complete-tour`** — called by `OnboardingTour.tsx` line 121 on tour completion with step timings. Only `/api/onboarding/complete` (single-step) exists. Tour completion analytics are dropped.

## Goal

Create the 2 missing route files. They persist analytics events and tour completion data so the data isn't lost.

## Spec

### Route 1: `/api/onboarding/analytics`

**File**: `frontend/src/app/api/onboarding/analytics/route.ts`
**Method**: POST
**Request body**: a `TourAnalyticsEvent` (union type from `shared/onboarding.ts`):

```ts
{
  type: 'tour_started' | 'step_viewed' | 'step_completed' | 'step_action_clicked' | 'tour_completed' | 'tour_dismissed';
  userId: string;
  stepId?: string;
  durationMs?: number;
  totalDurationMs?: number;
  stepTimings?: Record<string, number>;
  timestamp: number;
}
```

**Behavior**:
1. Validate the body has a `type` from the union and a `userId` string. If invalid, return 400.
2. Append the event to an in-memory ring buffer (last 10,000 events) keyed by nothing — global buffer. (Or by `userId` if you want per-user queries later.)
3. Log the event via the existing logger (pino) at `info` level with structured fields.
4. Return `{ ok: true }`.

**Persistence note**: for v1, in-memory is fine. The analytics are for product insight, not for billing. If the server restarts and we lose 30 minutes of tour analytics, that's acceptable. Future pack can add a `TourAnalyticsEvent` Prisma model if needed.

**Template**: see `templates/onboarding-analytics-route.ts.template`.

### Route 2: `/api/onboarding/complete-tour`

**File**: `frontend/src/app/api/onboarding/complete-tour/route.ts`
**Method**: POST
**Request body**:

```ts
{
  userId: string;
  totalDurationMs: number;
  stepTimings: Record<string, number>;  // stepId -> ms spent on that step
}
```

**Behavior**:
1. Validate `userId` is a string; `totalDurationMs` is a number ≥ 0; `stepTimings` is an object.
2. Call `bag.onboardingStore.completeTour(userId, { totalDurationMs, stepTimings })` — this is a new method on `OnboardingStore` (add it to the contract).
3. Fire a `tour_completed` analytics event via the same in-memory buffer (or just log it).
4. Return `{ ok: true, state }` where `state` is the updated `OnboardingState`.

### Contract change: add `completeTour` to `OnboardingStore`

In `frontend/src/storage/contracts/onboarding-store.ts`, add:

```ts
export interface OnboardingStore {
  get(userId: string): Promise<OnboardingState | null>;
  completeStep(userId: string, stepId: string): Promise<OnboardingState>;
  completeTour(userId: string, meta: { totalDurationMs: number; stepTimings: Record<string, number> }): Promise<OnboardingState>;
  dismiss(userId: string): Promise<OnboardingState>;
  reset(userId: string): Promise<OnboardingState>;
}
```

Update `MemoryOnboardingStore` to implement `completeTour` — it should set `dismissed = false`, mark all steps in `stepTimings` as completed (if not already), set `lastCompletedAt = Date.now()`, and return the state. The `stepTimings` themselves can be stored as a JSON field on `OnboardingState` (add `tourTimings?: Record<string, number>` to the type — update `shared/onboarding.ts`).

### Follow-on: update `MemoryOnboardingStore` and future `PrismaOnboardingStore`

- `MemoryOnboardingStore.completeTour`: as above. Also store `tourTimings` on the state object.
- `PrismaOnboardingStore.completeTour` (Task 09): same logic, persisted to `UserOnboarding.tourTimings` JSON column.

## Acceptance criteria

- [ ] `frontend/src/app/api/onboarding/analytics/route.ts` exists and accepts POST.
- [ ] `frontend/src/app/api/onboarding/complete-tour/route.ts` exists and accepts POST.
- [ ] `OnboardingStore` contract has `completeTour` method.
- [ ] `MemoryOnboardingStore` implements `completeTour`.
- [ ] `OnboardingState` type has optional `tourTimings?: Record<string, number>` field.
- [ ] `curl -X POST http://localhost:3000/api/onboarding/analytics -H 'Content-Type: application/json' -d '{"type":"tour_started","userId":"user:demo","timestamp":'$(date +%s)'}'` returns `{ ok: true }` and 200.
- [ ] `curl -X POST http://localhost:3000/api/onboarding/complete-tour -H 'Content-Type: application/json' -d '{"userId":"user:demo","totalDurationMs":45000,"stepTimings":{"welcome":5000,"sidebar":10000}}'` returns `{ ok: true, state: {...} }` with `lastCompletedAt` set.
- [ ] Server logs show the analytics event at info level.

## Verification

```bash
cd /home/z/my-project/vivim-final/frontend
bun run lint
bun run dev

# In another terminal:
curl -s -X POST http://localhost:3000/api/onboarding/analytics \
  -H 'Content-Type: application/json' \
  -d '{"type":"tour_started","userId":"user:demo","timestamp":'$(date +%s)'000'}' | jq

curl -s -X POST http://localhost:3000/api/onboarding/complete-tour \
  -H 'Content-Type: application/json' \
  -d '{"userId":"user:demo","totalDurationMs":45000,"stepTimings":{"welcome":5000,"sidebar":10000}}' | jq

curl -s "http://localhost:3000/api/onboarding/state?userId=user:demo" | jq
# Should show completedSteps includes 'welcome' and 'sidebar', lastCompletedAt is set
```

## Notes

- Don't add authentication to these routes for v1 — the existing `/api/onboarding/*` routes don't have auth either. Adding auth here would create an inconsistency.
- The in-memory ring buffer doesn't need to be exported or queryable for v1. If product wants to query analytics later, add a `GET /api/onboarding/analytics` route that returns aggregated stats.
- The `timestamp` field in the analytics event is client-provided (ms since epoch). Don't trust it for ordering — use server receipt time for any future aggregation.
