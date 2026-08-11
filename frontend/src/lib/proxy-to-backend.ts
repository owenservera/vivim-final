/**
 * lib/proxy-to-backend.ts
 * ----------------------------------------------------------------
 * Shared helper for Next.js API routes that need to proxy requests
 * to the Vivim backend server. Works in standalone mode (where the
 * backend runs on a separate port) and in Tauri mode (where the
 * bridge handles routing).
 */

import { classify } from '@/lib/errorClassifier'
import { type NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:9420'

export async function proxyToBackend(req: NextRequest, path?: string): Promise<NextResponse> {
  const url = new URL(req.url)
  const target = `${BACKEND_URL}${path ?? url.pathname}${url.search}`

  try {
    const headers = new Headers(req.headers)
    // Remove host header to avoid confusion
    headers.delete('host')

    const resp = await fetch(target, {
      method: req.method,
      headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
      // @ts-expect-error Node 18+ supports duplex
      duplex: req.method !== 'GET' && req.method !== 'HEAD' ? 'half' : undefined,
    })

    const contentType = resp.headers.get('content-type') ?? ''
    const body = contentType.includes('application/json') ? await resp.json() : await resp.text()

    return NextResponse.json(body, {
      status: resp.status,
      headers:
        resp.status === 204
          ? {}
          : {
              'Content-Type': contentType || 'application/json',
            },
    })
  } catch (err) {
    const classified = classify(err)
    return NextResponse.json(
      { ok: false, error: classified.title, message: classified.message, type: classified.type },
      { status: 502 },
    )
  }
}
