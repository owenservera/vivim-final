import { getEngineBag } from '@/lib/canvas-engine-bootstrap'
/** POST /api/onboarding/complete */
import { NextResponse } from 'next/server'
import { z } from 'zod'

const SCHEMA = z.object({ userId: z.string(), stepId: z.string() })

export async function POST(req: Request) {
  const body = (await req.json()) as unknown
  const parsed = SCHEMA.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 })
  const bag = getEngineBag()
  const state = await bag.onboardingStore.completeStep(parsed.data.userId, parsed.data.stepId)
  return NextResponse.json({ ok: true, state })
}
