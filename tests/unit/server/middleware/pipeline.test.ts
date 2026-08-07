// tests/unit/server/middleware/pipeline.test.ts
// Tests for the composable middleware pipeline.

import { describe, expect, it } from 'bun:test'
import { AppError } from '../../../../src/server/errors.js'
import { createCorsMiddleware } from '../../../../src/server/middleware/built-in/cors.js'
import { createErrorHandlerMiddleware } from '../../../../src/server/middleware/built-in/error-handler.js'
import { createRateLimiterMiddleware } from '../../../../src/server/middleware/built-in/rate-limiter.js'
import { createRequestLoggerMiddleware } from '../../../../src/server/middleware/built-in/request-logger.js'
import {
  createTracePropagationMiddleware,
  generateTraceId,
} from '../../../../src/server/middleware/built-in/trace-propagation.js'
import { MiddlewarePipeline } from '../../../../src/server/middleware/pipeline.js'
import type { MiddlewareContext } from '../../../../src/server/middleware/types.js'

function makeRequest(
  path = '/api/test',
  method = 'GET',
  headers?: Record<string, string>,
): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers,
  })
}

function jsonResponse(res: Response): Promise<unknown> {
  return res.json()
}

describe('MiddlewarePipeline', () => {
  // ── Basic execution ──────────────────────────────────────────────────────

  describe('basic middleware execution order', () => {
    it('executes middlewares in priority order (lower first)', async () => {
      const order: number[] = []

      const pipeline = new MiddlewarePipeline()
      pipeline.use({
        name: 'second',
        factory: () => async (_ctx, next) => {
          order.push(20)
          await next()
          order.push(21)
        },
        priority: 20,
      })
      pipeline.use({
        name: 'first',
        factory: () => async (_ctx, next) => {
          order.push(10)
          await next()
          order.push(11)
        },
        priority: 10,
      })

      await pipeline.execute(makeRequest(), async () => {
        order.push(999)
        return new Response('ok')
      })

      // Lower priority runs first. Handler is the final step in the chain.
      // first(10) pre → second(20) pre → handler → second(20) post → first(10) post
      expect(order).toEqual([10, 20, 999, 21, 11])
    })

    it('calls the final handler when no middleware short-circuits', async () => {
      const pipeline = new MiddlewarePipeline()
      const res = await pipeline.execute(makeRequest(), async () => {
        return new Response(JSON.stringify({ called: true }), {
          headers: { 'Content-Type': 'application/json' },
        })
      })

      const body = (await jsonResponse(res)) as { called: boolean }
      expect(body.called).toBe(true)
    })

    it('passes correct context properties to the handler', async () => {
      const pipeline = new MiddlewarePipeline()
      let capturedCtx: MiddlewareContext | undefined

      await pipeline.execute(makeRequest('/api/foo?bar=1', 'POST'), async (ctx) => {
        capturedCtx = ctx
        return new Response('ok')
      })

      expect(capturedCtx).toBeDefined()
      expect(capturedCtx?.method).toBe('POST')
      expect(capturedCtx?.pathname).toBe('/api/foo')
      expect(capturedCtx?.url.search).toBe('?bar=1')
      expect(capturedCtx?.receivedAt).toBeGreaterThan(0)
      expect(capturedCtx?.state).toBeInstanceOf(Map)
    })
  })

  // ── Short-circuit ────────────────────────────────────────────────────────

  describe('short-circuit (handled = true)', () => {
    it('returns the short-circuit response and skips the handler', async () => {
      const pipeline = new MiddlewarePipeline()
      let handlerCalled = false

      pipeline.use({
        name: 'short-circuit',
        factory: () => async (ctx) => {
          ctx.handled = true
          ctx.response = new Response(JSON.stringify({ intercepted: true }), {
            headers: { 'Content-Type': 'application/json' },
          })
        },
        priority: 0,
      })

      const res = await pipeline.execute(makeRequest(), async () => {
        handlerCalled = true
        return new Response('should not reach')
      })

      expect(handlerCalled).toBe(false)
      const body = (await jsonResponse(res)) as { intercepted: boolean }
      expect(body.intercepted).toBe(true)
    })

    it('middleware after short-circuit does not run (no next() called)', async () => {
      const order: string[] = []

      const pipeline = new MiddlewarePipeline()
      pipeline.use({
        name: 'before',
        factory: () => async (_ctx, next) => {
          order.push('a-pre')
          await next()
          order.push('a-post')
        },
        priority: 10,
      })
      pipeline.use({
        name: 'short',
        factory: () => async (ctx) => {
          order.push('b-pre')
          ctx.handled = true
          ctx.response = new Response('shorted')
          order.push('b-post')
        },
        priority: 20,
      })
      pipeline.use({
        name: 'after',
        factory: () => async (_ctx, next) => {
          order.push('c-pre')
          await next()
          order.push('c-post')
        },
        priority: 30,
      })

      await pipeline.execute(makeRequest(), async () => {
        order.push('handler')
        return new Response('handler')
      })

      // a-pre runs, a calls next() → b runs. b short-circuits without calling next().
      // b returns → a-post runs. c and handler never run.
      expect(order).toEqual(['a-pre', 'b-pre', 'b-post', 'a-post'])
    })
  })

  // ── Error propagation ────────────────────────────────────────────────────

  describe('error propagation', () => {
    it('thrown error in middleware propagates and is caught by pipeline', async () => {
      const pipeline = new MiddlewarePipeline()

      pipeline.use({
        name: 'error-thrower',
        factory: () => async () => {
          throw new Error('boom')
        },
        priority: 10,
      })

      const res = await pipeline.execute(makeRequest(), async () => {
        return new Response('ok')
      })

      expect(res.status).toBe(500)
      const body = (await jsonResponse(res)) as { error: string; code: string }
      expect(body.code).toBe('InternalError')
    })

    it('thrown error in handler is caught by pipeline', async () => {
      const pipeline = new MiddlewarePipeline()

      const res = await pipeline.execute(makeRequest(), async () => {
        throw new Error('handler error')
      })

      expect(res.status).toBe(500)
    })

    it('error-handler middleware (low priority = wraps all) converts errors to proper responses', async () => {
      const pipeline = new MiddlewarePipeline()

      // Error handler must have LOW priority to wrap everything.
      // In this pipeline, lower priority = runs first, so priority 0 is outermost.
      pipeline.use({
        name: 'error-handler',
        factory: createErrorHandlerMiddleware,
        priority: 0,
      })
      pipeline.use({
        name: 'thrower',
        factory: () => async () => {
          throw new AppError('not found', 'NotFound', 404)
        },
        priority: 10,
      })

      const res = await pipeline.execute(makeRequest(), async () => {
        return new Response('ok')
      })

      expect(res.status).toBe(404)
      const body = (await jsonResponse(res)) as { error: string; code: string }
      expect(body.code).toBe('NotFound')
    })
  })

  // ── Path-specific middleware ──────────────────────────────────────────────

  describe('path-specific middleware', () => {
    it('runs path-specific middleware only for matching paths', async () => {
      const hitPaths: string[] = []

      const pipeline = new MiddlewarePipeline()
      pipeline.useForPath('/api/admin/**', {
        name: 'admin-check',
        factory: () => async (ctx) => {
          hitPaths.push(ctx.pathname)
        },
        priority: 10,
      })

      // Matching paths
      await pipeline.execute(makeRequest('/api/admin/users'), async () => new Response('ok'))
      await pipeline.execute(
        makeRequest('/api/admin/settings/tokens'),
        async () => new Response('ok'),
      )

      // Non-matching path
      await pipeline.execute(makeRequest('/api/public/info'), async () => new Response('ok'))

      expect(hitPaths).toEqual(['/api/admin/users', '/api/admin/settings/tokens'])
    })

    it('path-specific middleware is sorted by priority with global', async () => {
      const order: string[] = []

      const pipeline = new MiddlewarePipeline()
      pipeline.use({
        name: 'global-a',
        factory: () => async (_ctx, next) => {
          order.push('global-20-pre')
          await next()
          order.push('global-20-post')
        },
        priority: 20,
      })
      pipeline.useForPath('/api/test', {
        name: 'path-a',
        factory: () => async (_ctx, next) => {
          order.push('path-5-pre')
          await next()
          order.push('path-5-post')
        },
        priority: 5,
      })
      pipeline.use({
        name: 'global-b',
        factory: () => async (_ctx, next) => {
          order.push('global-10-pre')
          await next()
          order.push('global-10-post')
        },
        priority: 10,
      })

      await pipeline.execute(makeRequest('/api/test'), async () => {
        order.push('handler')
        return new Response('ok')
      })

      // Sorted: path-5, global-10, global-20, handler, then unwind
      expect(order).toEqual([
        'path-5-pre',
        'global-10-pre',
        'global-20-pre',
        'handler',
        'global-20-post',
        'global-10-post',
        'path-5-post',
      ])
    })
  })

  // ── Middleware removal ────────────────────────────────────────────────────

  describe('middleware removal', () => {
    it('removes a global middleware by name', async () => {
      let called = false

      const pipeline = new MiddlewarePipeline()
      pipeline.use({
        name: 'removable',
        factory: () => async () => {
          called = true
        },
        priority: 10,
      })

      pipeline.remove('removable')
      await pipeline.execute(makeRequest(), async () => new Response('ok'))

      expect(called).toBe(false)
    })

    it('removes a path-specific middleware by name', async () => {
      let called = false

      const pipeline = new MiddlewarePipeline()
      pipeline.useForPath('/api/test', {
        name: 'path-removable',
        factory: () => async () => {
          called = true
        },
        priority: 10,
      })

      pipeline.remove('path-removable')
      await pipeline.execute(makeRequest('/api/test'), async () => new Response('ok'))

      expect(called).toBe(false)
    })

    it('removing a non-existent name is a no-op', () => {
      const pipeline = new MiddlewarePipeline()
      expect(() => pipeline.remove('does-not-exist')).not.toThrow()
    })
  })

  // ── Enabled / disabled ────────────────────────────────────────────────────

  describe('enabled / disabled middleware', () => {
    it('skips middleware with enabled=false', async () => {
      let called = false

      const pipeline = new MiddlewarePipeline()
      pipeline.use({
        name: 'disabled',
        factory: () => async () => {
          called = true
        },
        priority: 10,
        enabled: false,
      })

      await pipeline.execute(makeRequest(), async () => new Response('ok'))
      expect(called).toBe(false)
    })
  })

  // ── State sharing ────────────────────────────────────────────────────────

  describe('state sharing', () => {
    it('middleware can set state and downstream middleware can read it', async () => {
      const pipeline = new MiddlewarePipeline()
      let readValue: unknown

      pipeline.use({
        name: 'setter',
        factory: () => async (ctx, next) => {
          ctx.state.set('key', 'value')
          await next()
        },
        priority: 10,
      })
      pipeline.use({
        name: 'getter',
        factory: () => async (ctx, next) => {
          readValue = ctx.state.get('key')
          await next()
        },
        priority: 20,
      })

      await pipeline.execute(makeRequest(), async () => new Response('ok'))
      expect(readValue).toBe('value')
    })
  })

  // ── loadConfig ────────────────────────────────────────────────────────────

  describe('loadConfig', () => {
    it('loads global and path-specific middleware from config', async () => {
      const hits: string[] = []

      const pipeline = new MiddlewarePipeline()
      pipeline.loadConfig({
        global: [
          {
            name: 'global-mw',
            factory: () => async (_ctx, next) => {
              hits.push('global')
              await next()
            },
            priority: 10,
          },
        ],
        pathSpecific: [
          {
            pattern: '/api/special/*',
            middleware: [
              {
                name: 'special-mw',
                factory: () => async (_ctx, next) => {
                  hits.push('special')
                  await next()
                },
                priority: 15,
              },
            ],
          },
        ],
      })

      await pipeline.execute(makeRequest('/api/special/hello'), async () => new Response('ok'))
      expect(hits).toContain('global')
      expect(hits).toContain('special')

      hits.length = 0
      await pipeline.execute(makeRequest('/api/other'), async () => new Response('ok'))
      expect(hits).toContain('global')
      expect(hits).not.toContain('special')
    })
  })

  // ── Built-in: trace propagation ───────────────────────────────────────────

  describe('built-in: trace-propagation', () => {
    it('generates a trace ID when header is missing', async () => {
      const pipeline = new MiddlewarePipeline()
      let capturedTraceId = ''

      pipeline.use({
        name: 'trace',
        factory: createTracePropagationMiddleware,
        priority: 0,
      })

      await pipeline.execute(makeRequest(), async (ctx) => {
        capturedTraceId = ctx.traceId
        return new Response('ok')
      })

      expect(capturedTraceId).toBeTruthy()
      expect(capturedTraceId.length).toBe(24) // 12 bytes = 24 hex chars
    })

    it('uses X-Trace-Id from request header when present', async () => {
      const pipeline = new MiddlewarePipeline()
      let capturedTraceId = ''

      pipeline.use({
        name: 'trace',
        factory: createTracePropagationMiddleware,
        priority: 0,
      })

      await pipeline.execute(
        makeRequest('/api/test', 'GET', { 'X-Trace-Id': 'my-custom-id-123' }),
        async (ctx) => {
          capturedTraceId = ctx.traceId
          return new Response('ok')
        },
      )

      expect(capturedTraceId).toBe('my-custom-id-123')
    })

    it('adds X-Trace-Id to short-circuited responses', async () => {
      const pipeline = new MiddlewarePipeline()

      pipeline.use({
        name: 'trace',
        factory: createTracePropagationMiddleware,
        priority: 0,
      })
      pipeline.use({
        name: 'short',
        factory: () => async (ctx) => {
          ctx.handled = true
          ctx.response = new Response('traced')
        },
        priority: 10,
      })

      const res = await pipeline.execute(makeRequest(), async () => new Response('ok'))
      expect(res.headers.get('X-Trace-Id')).toBeTruthy()
    })

    it('generateTraceId produces 24-char hex strings', () => {
      for (let i = 0; i < 20; i++) {
        const id = generateTraceId()
        expect(id).toMatch(/^[0-9a-f]{24}$/)
      }
    })
  })

  // ── Built-in: CORS ────────────────────────────────────────────────────────

  describe('built-in: CORS', () => {
    it('handles OPTIONS preflight with 204', async () => {
      const pipeline = new MiddlewarePipeline()

      pipeline.use({
        name: 'cors',
        factory: () => createCorsMiddleware(),
        priority: 10,
      })

      const res = await pipeline.execute(makeRequest('/api/test', 'OPTIONS'), async () => {
        return new Response('should not reach')
      })

      expect(res.status).toBe(204)
      expect(res.headers.get('Access-Control-Allow-Methods')).toBeTruthy()
      expect(res.headers.get('Access-Control-Max-Age')).toBe('86400')
    })

    it('adds CORS headers to normal responses via post-processing', async () => {
      const pipeline = new MiddlewarePipeline()

      // CORS runs first (lowest priority) so its post-processing can wrap the response
      pipeline.use({
        name: 'cors',
        factory: () => createCorsMiddleware(),
        priority: 10,
      })

      const res = await pipeline.execute(makeRequest(), async () => {
        return new Response('ok')
      })

      // CORS post-processing adds headers to ctx.response (set by the handler)
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
      expect(res.headers.get('Access-Control-Expose-Headers')).toBeTruthy()
    })

    it('with allowed origins, mirrors matching origin', async () => {
      const pipeline = new MiddlewarePipeline()

      pipeline.use({
        name: 'cors',
        factory: () =>
          createCorsMiddleware(['https://app.example.com', 'https://admin.example.com']),
        priority: 10,
      })

      const res = await pipeline.execute(
        makeRequest('/api/test', 'GET', { Origin: 'https://app.example.com' }),
        async () => new Response('ok'),
      )

      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.com')
      expect(res.headers.get('Vary')).toBe('Origin')
    })

    it('with allowed origins, blocks non-matching origin', async () => {
      const pipeline = new MiddlewarePipeline()

      pipeline.use({
        name: 'cors',
        factory: () => createCorsMiddleware(['https://app.example.com']),
        priority: 10,
      })

      const res = await pipeline.execute(
        makeRequest('/api/test', 'GET', { Origin: 'https://evil.com' }),
        async () => new Response('ok'),
      )

      expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull()
    })
  })

  // ── Built-in: request logger ──────────────────────────────────────────────

  describe('built-in: request-logger', () => {
    it('does not throw when logging a request', async () => {
      const pipeline = new MiddlewarePipeline()

      pipeline.use({
        name: 'logger',
        factory: () => createRequestLoggerMiddleware(),
        priority: 50,
      })

      const res = await pipeline.execute(makeRequest(), async () => new Response('ok'))
      expect(res.status).toBe(200)
    })

    it('skips excluded paths', async () => {
      const pipeline = new MiddlewarePipeline()
      pipeline.use({
        name: 'logger',
        factory: () => createRequestLoggerMiddleware({ excludePaths: ['/health'] }),
        priority: 50,
      })

      // Should not throw even for excluded paths
      const res = await pipeline.execute(makeRequest('/health'), async () => new Response('ok'))
      expect(res.status).toBe(200)
    })
  })

  // ── Built-in: rate limiter ────────────────────────────────────────────────

  describe('built-in: rate-limiter', () => {
    it('allows requests under the limit', async () => {
      const pipeline = new MiddlewarePipeline()
      const key = 'test-key-fixed'

      pipeline.use({
        name: 'rate-limit',
        factory: () =>
          createRateLimiterMiddleware({
            maxRequests: 3,
            windowMs: 60_000,
            keyExtractor: () => key,
          }),
        priority: 10,
      })

      for (let i = 0; i < 3; i++) {
        const res = await pipeline.execute(makeRequest(), async () => new Response('ok'))
        expect(res.status).toBe(200)
        // Rate limit headers are set by post-processing after next()
        expect(res.headers.get('X-RateLimit-Remaining')).toBeTruthy()
      }
    })

    it('blocks requests over the limit with 429', async () => {
      const pipeline = new MiddlewarePipeline()
      const key = 'test-key-overflow'

      pipeline.use({
        name: 'rate-limit',
        factory: () =>
          createRateLimiterMiddleware({
            maxRequests: 2,
            windowMs: 60_000,
            keyExtractor: () => key,
          }),
        priority: 10,
      })

      // First 2 succeed
      await pipeline.execute(makeRequest(), async () => new Response('ok'))
      await pipeline.execute(makeRequest(), async () => new Response('ok'))

      // 3rd should be rate limited
      const res = await pipeline.execute(makeRequest(), async () => new Response('ok'))
      expect(res.status).toBe(429)
      expect(res.headers.get('Retry-After')).toBeTruthy()
    })
  })

  // ── Built-in: error handler ───────────────────────────────────────────────

  describe('built-in: error-handler', () => {
    it('catches AppError and returns correct status', async () => {
      const pipeline = new MiddlewarePipeline()

      // Error handler wraps everything — lowest priority = runs first
      pipeline.use({
        name: 'error-handler',
        factory: createErrorHandlerMiddleware,
        priority: 0,
      })
      pipeline.use({
        name: 'thrower',
        factory: () => async () => {
          throw new AppError('conflict!', 'Conflict', 409, { field: 'name' })
        },
        priority: 10,
      })

      const res = await pipeline.execute(makeRequest(), async () => new Response('ok'))
      expect(res.status).toBe(409)
      const body = (await jsonResponse(res)) as {
        error: string
        code: string
        details?: { field: string }
      }
      expect(body.code).toBe('Conflict')
      expect(body.details?.field).toBe('name')
    })

    it('catches plain Error and returns 500', async () => {
      const pipeline = new MiddlewarePipeline()

      pipeline.use({
        name: 'error-handler',
        factory: createErrorHandlerMiddleware,
        priority: 0,
      })
      pipeline.use({
        name: 'thrower',
        factory: () => async () => {
          throw new Error('plain error')
        },
        priority: 10,
      })

      const res = await pipeline.execute(makeRequest(), async () => new Response('ok'))
      expect(res.status).toBe(500)
      const body = (await jsonResponse(res)) as { error: string; code: string }
      expect(body.code).toBe('InternalError')
    })

    it('includes X-Trace-Id on error responses', async () => {
      const pipeline = new MiddlewarePipeline()

      pipeline.use({
        name: 'trace',
        factory: createTracePropagationMiddleware,
        priority: -10,
      })
      pipeline.use({
        name: 'error-handler',
        factory: createErrorHandlerMiddleware,
        priority: 0,
      })
      pipeline.use({
        name: 'thrower',
        factory: () => async () => {
          throw new Error('oops')
        },
        priority: 10,
      })

      const res = await pipeline.execute(makeRequest(), async () => new Response('ok'))
      expect(res.headers.get('X-Trace-Id')).toBeTruthy()
    })
  })

  // ── createContext ─────────────────────────────────────────────────────────

  describe('createContext', () => {
    it('creates a valid context from a request', () => {
      const pipeline = new MiddlewarePipeline()
      const req = makeRequest('/hello/world?a=1&b=2', 'PUT')
      const ctx = pipeline.createContext(req)

      expect(ctx.request).toBe(req)
      expect(ctx.pathname).toBe('/hello/world')
      expect(ctx.method).toBe('PUT')
      expect(ctx.url.search).toBe('?a=1&b=2')
      expect(ctx.handled).toBe(false)
      expect(ctx.state).toBeInstanceOf(Map)
      expect(ctx.receivedAt).toBeGreaterThan(0)
    })
  })
})
