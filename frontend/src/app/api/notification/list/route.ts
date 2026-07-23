/** GET /api/notification/list?userId=... */
import { NextResponse } from 'next/server';
import { getEngineBag } from '@/lib/canvas-engine-bootstrap';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId') ?? 'user:demo';
  const kind = url.searchParams.get('kind') ?? undefined;
  const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
  const bag = getEngineBag();
  const notifications = await bag.notificationEngine.list(userId, {
    kind: kind as never,
    unreadOnly,
    limit: 100,
  });
  return NextResponse.json({ ok: true, notifications });
}
