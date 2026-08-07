// src/server/middleware/pipeline.ts
// Composable middleware pipeline for request processing.
//
// The pipeline executes an ordered chain of middleware around a core request
// handler. Each middleware can inspect/modify the context, short-circuit the
// chain (by setting ctx.handled = true), or propagate errors.
//
// The handler is integrated as the final step in the chain. After the handler
// produces a response, ctx.handled is set to true so post-processing middleware
// (code after await next()) can inspect and modify ctx.response.
//
// Usage:
//   const pipeline = new MiddlewarePipeline()
//   pipeline.use({ name: 'trace', factory: () => traceMiddleware(), priority: 10 })
//   const response = await pipeline.execute(request, (ctx) => json({ ok: true }))

import { getLogger } from '@/lib/logger.js'
import { catchDebug } from '../../lib/catch-logger.js'
import type {
  Middleware,
  MiddlewareContext,
  MiddlewareDescriptor,
  PipelineConfig,
} from './types.js'

const log = getLogger('middleware-pipeline')

interface ResolvedMiddleware {
  name: string
  fn: Middleware
  priority: number
  tags?: string[]
  enabled?: boolean
}

interface PathMiddlewareEntry {
  pattern: RegExp
  entries: ResolvedMiddleware[]
}

/** Characters that need escaping in regex (minus * and ? which are glob wildcards) */
const REGEX_META = new Set(['.', '$', '^', '{', '}', '(', ')', '|', '[', ']', '\\'])

/** Convert a glob-like pattern to a RegExp for path matching */
function globToRegex(pattern: string): RegExp {
  let escaped = ''
  for (const ch of pattern) {
    if (ch === '*' || ch === '?') {
      escaped += ch
    } else if (REGEX_META.has(ch)) {
      escaped += `\\${ch}`
    } else {
      escaped += ch
    }
  }
  // Replace glob wildcards: ** = anything (cross-segment), * = single segment
  const GLOBSTAR = '\u0000GS\u0000'
  const regexStr = escaped
    .replace(/\*\*/g, GLOBSTAR)
    .replace(/\*/g, '[^/]*')
    .replace(GLOBSTAR, '.*')
    .replace(/\?/g, '[^/]')
  return new RegExp(`^(?:${regexStr})$`)
}

export class MiddlewarePipeline {
  private readonly globalMiddleware: ResolvedMiddleware[] = []
  private readonly pathMiddleware: PathMiddlewareEntry[] = []
  private _sorted = true

  /** Add a global middleware to the pipeline */
  use(descriptor: MiddlewareDescriptor): void {
    this.globalMiddleware.push({
      name: descriptor.name,
      fn: descriptor.factory(),
      priority: descriptor.priority,
      tags: descriptor.tags,
      enabled: descriptor.enabled ?? true,
    })
    this._sorted = false
    log.debug(
      { middleware: descriptor.name, priority: descriptor.priority },
      'registered global middleware',
    )
  }

  /** Add a path-specific middleware */
  useForPath(pattern: string, descriptor: MiddlewareDescriptor): void {
    const regex = globToRegex(pattern)
    const entry = this.pathMiddleware.find(
      (p) => p.pattern.source === regex.source && p.pattern.flags === regex.flags,
    )
    const resolved: ResolvedMiddleware = {
      name: descriptor.name,
      fn: descriptor.factory(),
      priority: descriptor.priority,
      tags: descriptor.tags,
      enabled: descriptor.enabled ?? true,
    }
    if (entry) {
      entry.entries.push(resolved)
    } else {
      this.pathMiddleware.push({ pattern: regex, entries: [resolved] })
    }
    log.debug(
      { middleware: descriptor.name, pattern, priority: descriptor.priority },
      'registered path-specific middleware',
    )
  }

  /** Remove a middleware by name (from both global and path-specific) */
  remove(name: string): void {
    for (let i = this.globalMiddleware.length - 1; i >= 0; i--) {
      if (this.globalMiddleware[i]?.name === name) {
        this.globalMiddleware.splice(i, 1)
        log.debug({ middleware: name }, 'removed global middleware')
      }
    }
    for (const pm of this.pathMiddleware) {
      for (let i = pm.entries.length - 1; i >= 0; i--) {
        if (pm.entries[i]?.name === name) {
          pm.entries.splice(i, 1)
          log.debug({ middleware: name }, 'removed path-specific middleware')
        }
      }
    }
    for (let i = this.pathMiddleware.length - 1; i >= 0; i--) {
      if (this.pathMiddleware[i]?.entries.length === 0) {
        this.pathMiddleware.splice(i, 1)
      }
    }
  }

  /** Load middleware from a PipelineConfig */
  loadConfig(config: PipelineConfig): void {
    for (const descriptor of config.global) {
      this.use(descriptor)
    }
    if (config.pathSpecific) {
      for (const { pattern, middleware } of config.pathSpecific) {
        for (const descriptor of middleware) {
          this.useForPath(pattern, descriptor)
        }
      }
    }
  }

  /** Execute the pipeline for a request */
  async execute(
    request: Request,
    handler: (ctx: MiddlewareContext) => Promise<Response>,
  ): Promise<Response> {
    const ctx = this.createContext(request)
    const chain = this.getChainForPath(ctx.pathname)

    log.debug(
      {
        traceId: ctx.traceId,
        method: ctx.method,
        pathname: ctx.pathname,
        chainLength: chain.length,
      },
      'executing pipeline',
    )

    try {
      await this.runChain(chain, ctx, handler)

      if (ctx.handled && ctx.response) {
        return ctx.response
      }

      if (ctx.error) {
        throw ctx.error
      }

      // Should not reach here if handler ran inside the chain
      return await handler(ctx)
    } catch (err) {
      catchDebug(err, 'server:middleware:pipeline:178')
      ctx.error = err instanceof Error ? err : new Error(String(err))

      // If error-handler middleware caught the error and set a response, use it
      if (ctx.handled && ctx.response) {
        return ctx.response
      }

      log.error({ traceId: ctx.traceId, error: ctx.error.message }, 'unhandled error in pipeline')
      return new Response(
        JSON.stringify({ error: 'Internal Server Error', code: 'InternalError' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }
  }

  /** Create a middleware context from a request */
  createContext(request: Request): MiddlewareContext {
    const url = new URL(request.url)
    return {
      request,
      url,
      pathname: url.pathname,
      method: request.method,
      traceId: '',
      receivedAt: Date.now(),
      state: new Map(),
      handled: false,
    }
  }

  /** Run the middleware chain with the handler as the final step */
  private async runChain(
    chain: ResolvedMiddleware[],
    ctx: MiddlewareContext,
    handler: (ctx: MiddlewareContext) => Promise<Response>,
  ): Promise<void> {
    let index = 0
    let handlerCalled = false

    const runNext = async (): Promise<void> => {
      while (index < chain.length) {
        const current = chain[index]!
        index++
        if (current.enabled === false) {
          continue
        }
        await current.fn(ctx, runNext)
        return
      }
      // End of middleware chain — run the handler
      if (!ctx.handled && !handlerCalled) {
        handlerCalled = true
        const response = await handler(ctx)
        ctx.response = response
        // Mark as handled so post-processing middleware can modify the response
        ctx.handled = true
      }
    }

    await runNext()
  }

  /** Get the execution chain for a specific path (global + matching path-specific) */
  private getChainForPath(pathname: string): ResolvedMiddleware[] {
    const chain: ResolvedMiddleware[] = [...this.globalMiddleware]

    for (const pm of this.pathMiddleware) {
      if (pm.pattern.test(pathname)) {
        chain.push(...pm.entries)
      }
    }

    if (!this._sorted) {
      this.globalMiddleware.sort((a, b) => a.priority - b.priority)
      for (const pm of this.pathMiddleware) {
        pm.entries.sort((a, b) => a.priority - b.priority)
      }
      this._sorted = true
    }
    chain.sort((a, b) => a.priority - b.priority)

    return chain
  }
}
