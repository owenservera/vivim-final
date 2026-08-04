/**
 * POST /api/onboarding/analytics
 *
 * Accepts fire-and-forget analytics events from the OnboardingTour and
 * the help system. Persists to an in-memory ring buffer (last 10,000 events)
 * and logs at info level.
 */
import { NextRequest, NextResponse } from 'next/server';
import type { TourAnalyticsEvent } from '@/shared/onboarding';

export const dynamic = "force-static";

const BUFFER_MAX = 10_000;
const buffer: TourAnalyticsEvent[] = [];

function pushEvent(event: TourAnalyticsEvent): void {
  buffer.push(event);
  if (buffer.length > BUFFER_MAX) {
    buffer.shift();
  }
  console.log(JSON.stringify({
    level: 'info',
    msg: 'onboarding-analytics',
    event,
  }));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body || typeof body.type !== 'string' || typeof body.userId !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Invalid event: missing type or userId' },
        { status: 400 },
      );
    }

    const validTypes = new Set([
      'tour_started',
      'step_viewed',
      'step_completed',
      'step_action_clicked',
      'tour_completed',
      'tour_dismissed',
    ]);

    if (!validTypes.has(body.type)) {
      return NextResponse.json(
        { ok: false, error: `Invalid event type: ${body.type}` },
        { status: 400 },
      );
    }

    const event = body as TourAnalyticsEvent;
    pushEvent(event);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit') ?? 100);
  const userId = url.searchParams.get('userId');

  let events = buffer.slice(-Math.min(limit, BUFFER_MAX));
  if (userId) {
    events = events.filter((e) => e.userId === userId);
  }

  return NextResponse.json({ ok: true, events, total: buffer.length });
}

