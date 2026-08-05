import { getEngineBag } from '@/lib/canvas-engine-bootstrap'
/** POST /api/rbac/revoke */
import { NextResponse } from 'next/server'
import { z } from 'zod'

const SCHEMA = z.object({ workspaceId: z.string(), userId: z.string() })

export async function POST(req: Request) {
  const body = (await req.json()) as unknown
  const parsed = SCHEMA.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 })
  const bag = getEngineBag()
  const ok = await bag.rbacEngine.revokeMembership(parsed.data.workspaceId, parsed.data.userId)
  return NextResponse.json({ ok })
}
