import { getEngineBag } from '@/lib/canvas-engine-bootstrap'
/**
 * POST /api/onboarding/complete-tour
 *
 * Called by OnboardingTour.tsx when the user finishes the tour.
 * Persists the tour completion + step timings to the OnboardingStore.
 */
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

export const dynamic = 'force-static'

const SCHEMA = z.object({
  userId: z.string(),
  totalDurationMs: z.number().min(0),
  stepTimings: z.record(z.string(), z.number()),
})

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown
    const parsed = SCHEMA.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 })
    }

    const bag = getEngineBag()
    const state = await bag.onboardingStore.completeTour(parsed.data.userId, {
      totalDurationMs: parsed.data.totalDurationMs,
      stepTimings: Object.fromEntries(
        Object.entries(parsed.data.stepTimings).map(([k, v]) => [k, v] as [string, number]),
      ),
    })

    // Fire analytics event (best-effort, fire-and-forget)
    try {
      await fetch('/api/onboarding/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'tour_completed',
          userId: parsed.data.userId,
          totalDurationMs: parsed.data.totalDurationMs,
          stepTimings: parsed.data.stepTimings,
          timestamp: Date.now(),
        }),
      })
    } catch {
  // [audit] log the error with context here
      // Non-fatal — analytics are best-effort
    }

    return NextResponse.json({ ok: true, state })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
