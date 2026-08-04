/** POST /api/onboarding/dismiss */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getEngineBag } from '@/lib/canvas-engine-bootstrap';

const SCHEMA = z.object({ userId: z.string() });

export async function POST(req: Request) {
  const body = (await req.json()) as unknown;
  const parsed = SCHEMA.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
  const bag = getEngineBag();
  const state = await bag.onboardingStore.dismiss(parsed.data.userId);
  return NextResponse.json({ ok: true, state });
}
