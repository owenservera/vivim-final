// src/server/validate.ts
// Shared request-body validation helper.
//
// Session 3 (2026-08-07): created to close the untrusted-input validation gap.
// Before this, ~15 routers used `(await req.json()) as { ... }` — no schema
// validation, no malformed-JSON handling, no uniform error response. This
// helper wraps the standard pattern: try parse JSON → zod safeParse → return
// either typed data or a canonical 400 error Response.
//
// Usage:
//   const parsed = await parseRequestBody(req, MySchema)
//   if (!parsed.success) return parsed.response
//   const data = parsed.data  // typed as z.infer<typeof MySchema>
//

import type { z } from 'zod'
import { errorResponse } from './response.js'

export type ParseResult<T> = { success: true; data: T } | { success: false; response: Response }

/**
 * Parse and validate a request body against a zod schema.
 *
 * - If the request body is not valid JSON, returns a 400 `ValidationError`.
 * - If the body fails schema validation, returns a 400 `ValidationError` with
 *   the zod issues in `details`.
 * - Otherwise returns `{ success: true, data }` with the typed payload.
 *
 * The caller is expected to do:
 *   const parsed = await parseRequestBody(req, schema)
 *   if (!parsed.success) return parsed.response
 */
export async function parseRequestBody<T>(
  req: Request,
  schema: z.ZodType<T>,
): Promise<ParseResult<T>> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return {
      success: false,
      response: errorResponse('Invalid JSON body', 'ValidationError', 400),
    }
  }

  const result = schema.safeParse(raw)
  if (!result.success) {
    return {
      success: false,
      response: errorResponse(
        'Request body failed validation',
        'ValidationError',
        400,
        result.error.issues,
      ),
    }
  }

  return { success: true, data: result.data }
}
