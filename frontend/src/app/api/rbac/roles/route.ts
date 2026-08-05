import { getEngineBag } from '@/lib/canvas-engine-bootstrap'
/** GET /api/rbac/roles */
import { NextResponse } from 'next/server'

export async function GET() {
  const bag = getEngineBag()
  return NextResponse.json({ ok: true, roles: bag.rbacEngine.listRoles() })
}
