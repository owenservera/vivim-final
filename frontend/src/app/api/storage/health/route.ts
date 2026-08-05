/**
 * app/api/storage/health/route.ts
 * --------------------------------------------------------------------
 * GET /api/storage/health — returns a JSON report of storage layer status.
 */

import { probeStorage } from '@/storage/health/probe'
import { getStorageProvider } from '@/storage/provider'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const provider = getStorageProvider()
    const report = await probeStorage(provider)
    return NextResponse.json(report)
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
