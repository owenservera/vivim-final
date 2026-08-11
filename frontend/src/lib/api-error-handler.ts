import { classify } from '@/lib/errorClassifier'
/** Next.js API route error wrapper — catches thrown errors and returns JSON */
import { type NextRequest, NextResponse } from 'next/server'

type RouteHandler = (
  req: NextRequest,
  ctx?: { params?: Record<string, string> },
) => Promise<Response | NextResponse> | Response | NextResponse

export function apiHandler(handler: RouteHandler): RouteHandler {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx)
    } catch (err) {
      const classified = classify(err)
      const status =
        classified.type === 'auth'
          ? 401
          : classified.type === 'validation'
            ? 400
            : classified.type === 'network'
              ? 502
              : 500

      if (process.env.NODE_ENV !== 'production') {
        console.error(`[APIError] ${req.nextUrl?.pathname ?? 'unknown'} → ${status}`, err)
      }

      return NextResponse.json(
        { ok: false, error: classified.title, message: classified.message, type: classified.type },
        { status },
      )
    }
  }
}
