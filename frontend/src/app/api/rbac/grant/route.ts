import { getEngineBag } from '@/lib/canvas-engine-bootstrap'
/** POST /api/rbac/grant */
import { NextResponse } from 'next/server'
import { z } from 'zod'

const SCHEMA = z.object({
  workspaceId: z.string(),
  userId: z.string(),
  role: z.enum(['viewer', 'member', 'editor', 'admin']),
  grantedBy: z.string().default('user:demo'),
})

export async function POST(req: Request) {
  const body = (await req.json()) as unknown
  const parsed = SCHEMA.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 })
  const bag = getEngineBag()
  const m = await bag.rbacEngine.grantRole(parsed.data)
  return NextResponse.json({ ok: true, membership: m })
}
