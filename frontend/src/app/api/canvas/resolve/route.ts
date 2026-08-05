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
  const body = (await req.json()) as unknown
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
