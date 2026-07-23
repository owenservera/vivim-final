/** POST /api/rbac/check */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getEngineBag } from '@/lib/canvas-engine-bootstrap';

const SCHEMA = z.object({
  workspaceId: z.string(),
  userId: z.string(),
  capabilityId: z.string(),
});

export async function POST(req: Request) {
  const body = (await req.json()) as unknown;
  const parsed = SCHEMA.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
  const bag = getEngineBag();
  const check = await bag.rbacEngine.check(parsed.data.workspaceId, parsed.data.userId, parsed.data.capabilityId);
  return NextResponse.json({ ok: true, check });
}
