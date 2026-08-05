/** GET /api/notification/stats?userId=... */
import { NextResponse } from 'next/server';
import { getEngineBag } from '@/lib/canvas-engine-bootstrap';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId') ?? 'user:demo';
  const bag = getEngineBag();
  const stats = await bag.notificationEngine.stats(userId);
  return NextResponse.json({ ok: true, stats });
}
