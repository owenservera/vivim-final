// src/desktop/next-shim.ts
// Minimal `next/server` compatibility layer for the compiled Bun sidecar.
//
// The 80 App Router handlers in frontend/src/app/api/**/route.ts only use a
// small surface of Next's runtime: `NextResponse.json(...)`, plain `Request`,
// and — in three dynamic-segment routes — `{ params }`. This shim maps that
// surface onto the Web-standard Response/Request so the same files compile and
// run unchanged under `bun build --compile` (aliased in compile-sidecar.ts).
//
// It is ONLY used in the sidecar bundle; the Next dev server / `next build`
// keep resolving the real package via frontend/node_modules.

/**
 * NextResponse — Response subclass with Next.js's static `.json` helper.
 * RequestInit semantics match the Web `Response` constructor (status, headers).
 */
export class NextResponse extends Response {
  constructor(body?: BodyInit | null, init?: ResponseInit) {
    super(body, init)
  }

  static json(body: unknown, init?: ResponseInit): NextResponse {
    const res = new NextResponse(typeof body === 'string' ? body : JSON.stringify(body), init)
    if (!res.headers.has('content-type')) {
      res.headers.set('content-type', 'application/json')
    }
    return res
  }
}

/**
 * NextRequest — a Request subclass that exposes `nextUrl`.
 * App Router handlers type params as `{ params: Promise<{ id: string }> }`;
 * the mount dispatcher passes `{ params: Promise.resolve({ ... }) }` and a
 * plain `Request` satisfies this type (only the excluded proxy handlers used
 * `NextRequest`, and they are not ported).
 */
export class NextRequest extends Request {
  get nextUrl(): URL {
    return new URL(this.url)
  }
}