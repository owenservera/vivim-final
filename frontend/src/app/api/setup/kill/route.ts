/** POST /api/setup/kill — kill a Chrome process by port. Proxies to backend. */
import { type NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-static'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const port = process.env.CAP_STORE_PORT ?? '9420'
    const res = await fetch(`http://localhost:${port}/api/setup/kill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Backend unreachable'
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }
}
