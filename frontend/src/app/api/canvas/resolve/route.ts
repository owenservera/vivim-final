/**
 * app/api/canvas/resolve/route.ts (G5.1)
 * --------------------------------------------------------------------
 * POST /api/canvas/resolve — synchronous routeSync.
 * Body: { workspaceId, userId, providerIds, accounts, slotIds, variant }
 * Returns: ResolvedSurface (bundle 02 §B.2 synchronous return).
 *
 * Side effect (DECOUPLED): emits `canvas:surface:resolved` on the bus
 * → SSE forwarder → other browser tabs. The return value is NOT
 * blocked by the emit (Governor Canon, bundle 02 §G.1).
 */

import { routeSync } from '@/engines/route-sync'
import { getEngineBag, isSeeded, markSeeded, newTraceId } from '@/lib/canvas-engine-bootstrap'
import { seedCanvasModel } from '@/lib/seed-canvas-model'
import type { AccountContext, RouteContext } from '@/shared/route-context'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const REQUEST_SCHEMA = z.object({
  workspaceId: z.string(),
  userId: z.string(),
  providerIds: z.array(z.string()),
  accounts: z.array(
    z.object({
      accountId: z.string(),
      providerId: z.string(),
      planTier: z.enum(['anonymous', 'free', 'trial', 'pro', 'enterprise']),
    }),
  ),
  slotIds: z.array(z.string()),
  variant: z.string().optional(),
})

export async function POST(req: Request) {
  // Harden against empty/malformed bodies. During the resolve-feedback-loop
  // storm, aborted/cancelled fetch streams reached this handler with no body,
  // producing a 500 + `SyntaxError: Unexpected end of JSON input` at req.json().
  // A clean 400 (instead of an uncaught throw) keeps the dev overlay quiet and
  // lets the client's transient-retry handle it.
  let rawBody = '';
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ ok: false, error: 'Unable to read request body' }, { status: 400 });
  }
  if (!rawBody.trim()) {
    return NextResponse.json({ ok: false, error: 'Empty request body' }, { status: 400 });
  }
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = REQUEST_SCHEMA.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 })
  }

  const bag = getEngineBag()
  if (!isSeeded()) {
    await seedCanvasModel(bag)
    markSeeded()
  }

  const ctx: RouteContext = {
    traceId: newTraceId(),
    workspaceId: parsed.data.workspaceId,
    userId: parsed.data.userId,
    providerIds: parsed.data.providerIds,
    accounts: parsed.data.accounts as AccountContext[],
    slotIds: parsed.data.slotIds,
    variant: parsed.data.variant,
  }

  const surface = await routeSync(ctx, bag.routeSyncDeps)
  return NextResponse.json(surface)
}
