// src/mcp/browser-mcp.ts
// Standalone stdio MCP server exposing vivim's browser-automation stack.
//
// Protocol: line-delimited JSON-RPC 2.0 over stdin/stdout (MCP stdio transport,
// hand-rolled to match the repo's no-new-dependencies rule). stdout carries ONLY
// protocol bytes; all logging goes to stderr via pino (getLogger).
//
// Lifecycle: initialize → tools/list → tools/call loop. The stack assembles
// lazily on the first tool-bearing request (no Chrome spawn until the first
// tools/call, which calls ensureGenericBrowser through BrowserSession).

import { createInterface } from 'node:readline'
import { getLogger } from '../lib/logger.js'
import { BrowserSession, buildBrowserStack } from './browser-session.js'
import type { BrowserStack } from './browser-session.js'
import { buildConvenienceTools, buildTools } from './browser-tools.js'
import type { McpTool } from './types.js'

const log = getLogger('browser-mcp')

// ── Protocol handler ─────────────────────────────────────────────────────────

export interface JsonRpcHandlerDeps {
  /** Static tool list, or a lazily-resolved getter (used for deferred boot). */
  tools: McpTool[] | (() => McpTool[])
  /** Called on `shutdown` (kill Chrome + session). */
  onShutdown?: () => Promise<void>
  /** Per-call timeout in ms (default 30s). */
  callTimeoutMs?: number
  /** Optional async readiness gate awaited before tools/list and tools/call. */
  ensureReady?: () => Promise<void>
}

/**
 * Create a JSON-RPC handler for one input line. Returns the response line to
 * write (or null for notifications / requests without an id). Pure — no I/O —
 * so the protocol is unit-testable with a stubbed tool surface.
 */
export function createJsonRpcHandler(deps: JsonRpcHandlerDeps) {
  const callTimeoutMs = deps.callTimeoutMs ?? 30_000
  const getTools = () => (typeof deps.tools === 'function' ? deps.tools() : deps.tools)

  return async function handleMessage(line: string): Promise<string | null> {
    let msg: unknown
    try {
      msg = JSON.parse(line)
    } catch {
      return jsonrpcError(null, -32700, 'Parse error')
    }

    if (typeof msg !== 'object' || msg === null)
      return jsonrpcError(null, -32600, 'Invalid Request')
    const req = msg as {
      jsonrpc?: string
      id?: number | string | null
      method?: string
      params?: unknown
    }
    if (req.jsonrpc !== '2.0' || typeof req.method !== 'string') {
      return jsonrpcError(req.id ?? null, -32600, 'Invalid Request')
    }

    const id = req.id ?? null

    switch (req.method) {
      case 'initialize':
        return jsonrpcSuccess(id, {
          protocolVersion: '2025-03-26',
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'vivim-browser', version: '1.0.0' },
        })

      case 'ping':
        return jsonrpcSuccess(id, {})

      case 'tools/list':
        await deps.ensureReady?.()
        return jsonrpcSuccess(id, {
          tools: getTools().map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
        })

      case 'tools/call': {
        await deps.ensureReady?.()
        const params = (req.params ?? {}) as { name?: unknown; arguments?: Record<string, unknown> }
        const name = typeof params.name === 'string' ? params.name : ''
        const tool = getTools().find((t) => t.name === name)
        if (!tool) {
          return jsonrpcSuccess(id, {
            content: [{ type: 'text', text: `Unknown tool: ${name}` }],
            isError: true,
          })
        }
        try {
          const result = await withTimeout(tool.handler(params.arguments ?? {}), callTimeoutMs)
          return jsonrpcSuccess(id, result)
        } catch (err) {
          const text = err instanceof Error ? err.message : String(err)
          return jsonrpcSuccess(id, { content: [{ type: 'text', text }], isError: true })
        }
      }

      case 'shutdown':
        await deps.onShutdown?.()
        return jsonrpcSuccess(id, null)

      case 'exit':
      case 'notifications/initialized':
      case 'notifications/cancelled':
      case 'notifications/roots/list_changed':
        // Notifications / exit have no response.
        return null

      default:
        return jsonrpcError(id, -32601, `Method not found: ${req.method}`)
    }
  }
}

// ── Entry point ──────────────────────────────────────────────────────────────

/** Combine Layer 1 (registry) + Layer 2 (convenience) tools into the surface. */
export function assembleTools(stack: BrowserStack, session: BrowserSession): McpTool[] {
  const ctx = {
    getSlaveId: () => session.getSlaveId(),
    registry: stack.registry,
    governor: stack.governor,
    session: {
      status: () => session.status(),
      quit: () => session.quit(),
    },
  }
  return [...buildTools(stack.registry, ctx), ...buildConvenienceTools(ctx)]
}

async function run() {
  let stack: BrowserStack | null = null
  let session: BrowserSession | null = null
  let bootPromise: Promise<void> | null = null

  // Lazy boot: assemble the stack exactly once, on the first tools/list or
  // tools/call. No Chrome spawns until the first tools/call (session.getSlaveId).
  const ensureReady = (): Promise<void> => {
    if (bootPromise) return bootPromise
    bootPromise = (async () => {
      log.info('booting browser-automation stack')
      const booted = await buildBrowserStack()
      stack = booted
      session = new BrowserSession(booted)
      log.info('stack ready')
    })()
    return bootPromise
  }

  const handle = createJsonRpcHandler({
    tools: () => (stack && session ? assembleTools(stack, session) : []),
    ensureReady,
    onShutdown: async () => {
      if (session) await session.quit()
      log.info('shutdown complete')
    },
  })

  const rl = createInterface({ input: process.stdin, crlfDelay: Number.POSITIVE_INFINITY })

  // Track in-flight handlers so `close` (stdin EOF) doesn't exit while a boot
  // or a tools/call is still resolving — otherwise responses get dropped.
  const inflight = new Set<Promise<void>>()
  const done = async (p: Promise<void>) => {
    inflight.add(p)
    try {
      await p
    } finally {
      inflight.delete(p)
    }
  }
  const drain = async () => {
    for (;;) {
      const current = [...inflight]
      if (current.length === 0) break
      await Promise.allSettled(current)
    }
  }

  rl.on('line', async (line) => {
    if (line.trim() === '') return

    const isExitLine = (() => {
      try {
        const parsed = JSON.parse(line)
        return parsed?.method === 'exit'
      } catch {
        return false
      }
    })()

    const p = (async () => {
      try {
        const response = await handle(line)
        if (response !== null) {
          process.stdout.write(`${response}\n`)
        }
      } catch (err) {
        log.error({ err: (err as Error).message }, 'unhandled handler error')
        process.stdout.write(
          `${jsonrpcError(null, -32603, (err as Error).message ?? 'Internal error')}\n`,
        )
      }
    })()
    await done(p)

    // `exit` is a notification: after this handler settles, tear down Chrome
    // and actually terminate (stdin stays open otherwise). Runs OUTSIDE the
    // inflight set so drain() doesn't wait on itself.
    if (isExitLine) {
      if (session) await session.quit().catch(() => {})
      log.info('exit notification received — terminating')
      process.exit(0)
    }
  })

  rl.on('close', async () => {
    await drain()
    if (session) await session.quit().catch(() => {})
    process.exit(0)
  })

  process.on('SIGINT', async () => {
    if (session) await session.quit().catch(() => {})
    process.exit(0)
  })
  process.on('SIGTERM', async () => {
    if (session) await session.quit().catch(() => {})
    process.exit(0)
  })
}

if (import.meta.main) {
  run().catch((err) => {
    log.error({ err: (err as Error).message }, 'fatal')
    process.exit(1)
  })
}

// ── JSON-RPC helpers ─────────────────────────────────────────────────────────

function jsonrpcSuccess(id: number | string | null, result: unknown): string {
  return JSON.stringify({ jsonrpc: '2.0', id, result })
}

function jsonrpcError(id: number | string | null, code: number, message: string): string {
  return JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } })
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`call timed out after ${ms}ms`)), ms)
    promise.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      },
    )
  })
}
