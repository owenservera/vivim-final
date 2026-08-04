/** GET /api/rbac/roles */
import { NextResponse } from 'next/server';
import { getEngineBag } from '@/lib/canvas-engine-bootstrap';

export async function GET() {
  const bag = getEngineBag();
  return NextResponse.json({ ok: true, roles: bag.rbacEngine.listRoles() });
}
