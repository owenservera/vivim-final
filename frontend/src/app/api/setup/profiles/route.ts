/** GET /api/setup/profiles — list existing Chrome profiles on disk. Proxies to backend. */
import { NextResponse } from 'next/server'

export const dynamic = 'force-static'

export async function GET() {
  try {
    const port = process.env.CAP_STORE_PORT ?? '9420'
    const res = await fetch(`http://localhost:${port}/api/setup/profiles`, {
      signal: AbortSignal.timeout(5000),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Backend unreachable'
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }
}
