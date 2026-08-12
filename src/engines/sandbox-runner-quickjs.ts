import { getQuickJS, shouldInterruptAfterDeadline } from 'quickjs-emscripten'
import type { QuickJSContext, QuickJSHandle, QuickJSRuntime } from 'quickjs-emscripten-core'
import { SandboxBudgetError, SandboxTimeoutError } from '../errors.js'
import { newId } from '../ids.js'
import type {
  SandboxAuditRow,
  SandboxAuditStore,
} from '../storage/contracts/sandbox-audit-store.js'
import type {
  SandboxBudget,
  SandboxPermissions,
  SandboxResult,
  SandboxRunOptions,
} from './sandbox-runner.js'

// Lazy singleton for the QuickJS WASM module
let _modPromise: ReturnType<typeof getQuickJS> | null = null
function getMod() {
  if (!_modPromise) _modPromise = getQuickJS()
  return _modPromise
}

// Context registry: keeps QJS contexts alive for parser function calls
interface CtxEntry {
  ctx: QuickJSContext
  runtime: QuickJSRuntime
  lastUsed: number
}
const ctxRegistry = new Map<string, CtxEntry>()
const MAX_CTX = 100

function evictOldest() {
  if (ctxRegistry.size === 0) return
  let oldestKey = ''
  let oldestTime = Infinity
  for (const [key, entry] of ctxRegistry) {
    if (entry.lastUsed < oldestTime) {
      oldestTime = entry.lastUsed
      oldestKey = key
    }
  }
  if (oldestKey) {
    const entry = ctxRegistry.get(oldestKey)
    disposePair(entry?.ctx ?? null, entry?.runtime ?? null)
    ctxRegistry.delete(oldestKey)
  }
}

/**
 * Dispose a QuickJS context then its runtime safely. Order matters:
 * runtime.dispose() frees the runtime pointer but does NOT free its contexts
 * (they live in the runtime's contextMap) — so ctx.dispose() must run first or
 * JS_FreeRuntime asserts on a non-empty gc_obj_list. Each step is guarded:
 * after an interrupt/abort the WASM runtime may already be torn down, and a
 * failed cleanup must not mask the run result already being decided.
 */
function disposePair(ctx: QuickJSContext | null, runtime: QuickJSRuntime | null) {
  if (ctx) {
    try {
      ctx.dispose()
    } catch {
      // Swallow cleanup errors; the WASM runtime may already be torn down.
    }
  }
  if (runtime) {
    try {
      runtime.dispose()
    } catch {
      // Swallow cleanup errors; the WASM runtime may already be torn down.
    }
  }
}

/**
 * QuickJS WASM sandbox backend — true process-level isolation via WASM.
 *
 * Identical public API to the node:vm impl. Swap via VIVIM_SANDBOX_MODE env.
 *
 * The QuickJS runtime is a separate WASM instance: no shared heap with the host,
 * no access to process/require/globalThis, hard memory limit per execution.
 * Parser function calls are bridged back to the host via a context registry
 * keyed by handlerSlug, with LRU eviction at MAX_CTX entries.
 */
export class SandboxRunner {
  private readonly defaultBudget: SandboxBudget
  private readonly memoryProbe: () => { heapUsed: number }

  constructor(
    private readonly auditStore: SandboxAuditStore,
    options: {
      defaultBudget?: SandboxBudget
      memoryProbe?: () => { heapUsed: number }
    } = {},
  ) {
    this.defaultBudget = options.defaultBudget ?? {
      cpuMs: 1000,
      memoryBytes: 64 * 1024 * 1024,
    }
    this.memoryProbe = options.memoryProbe ?? (() => process.memoryUsage())
  }

  async run(
    code: string,
    input: Record<string, unknown>,
    permissions: SandboxPermissions,
    options: SandboxRunOptions = {},
  ): Promise<SandboxResult> {
    const budget = { ...this.defaultBudget, ...options.budget }
    const handlerSlug = options.handlerSlug ?? (input.handlerSlug as string) ?? 'inline'
    const auditId = newId()

    const finish = async (
      ok: boolean,
      error: string | null,
      output?: unknown,
    ): Promise<SandboxResult> => {
      const row: SandboxAuditRow = {
        id: auditId,
        handlerSlug,
        ok,
        error,
        permissions,
        ts: Date.now(),
      }
      await this.auditStore.create(row)
      return { ok, error: error ?? undefined, output, auditId }
    }

    let runtime: QuickJSRuntime | null = null
    let ctx: QuickJSContext | null = null

    try {
      const mod = await getMod()
      runtime = mod.newRuntime()
      // Floor the WASM heap limit: a sub-minimum budget (e.g. 1 byte from a
      // test) instantly aborts the shared module with "Out of bounds memory
      // access" and corrupts subsequent runs. The host-side memoryProbe check
      // below is the authoritative memory-budget enforcement.
      runtime.setMemoryLimit(Math.max(budget.memoryBytes, 64 * 1024))
      runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + budget.cpuMs))
      ctx = runtime.newContext()

      // Inject silent console (no host I/O leakage)
      ctx
        .evalCode('console = { log: function(){}, error: function(){}, warn: function(){} };')
        .unwrap()
        .dispose()

      // Inject input as deep JSON copy (no live refs)
      ctx
        .evalCode(`input = ${JSON.stringify(input)};`)
        .unwrap()
        .dispose()

      // Clipboard guard: throws by default, exposed only when canUseClipboard
      if (permissions.canUseClipboard) {
        ctx
          .evalCode(`
          navigator = {
            clipboard: {
              readText: function() { throw new Error('SandboxPermissionError: navigator.clipboard.readText'); },
              writeText: function() { throw new Error('SandboxPermissionError: navigator.clipboard.writeText'); }
            }
          };
        `)
          .unwrap()
          .dispose()
      }

      // Create module/exports inside QJS for LOGIC_CODE pattern
      const hostModule = options.globals?.module as Record<string, unknown> | undefined
      if (hostModule) {
        ctx.evalCode('module = { exports: {} }; exports = module.exports;').unwrap().dispose()
      }

      // Inject other globals as deep JSON copies (skip module/exports)
      if (options.globals) {
        for (const [key, value] of Object.entries(options.globals)) {
          if (key === 'module' || key === 'exports') continue
          try {
            ctx
              .evalCode(`${key} = ${JSON.stringify(value)};`)
              .unwrap()
              .dispose()
          } catch {
            // Skip non-JSON-serializable values (same behavior as vm impl)
          }
        }
      }

      // ── Execute ───────────────────────────────────────────────────────────
      const wrappedCode = `(async () => { ${code} })()`
      const evalResult = ctx.evalCode(wrappedCode)
      const promiseHandle = evalResult.unwrap()
      // executePendingJobs returns a result whose value/error handle must be
      // disposed; ignoring it leaks a ref into the context and JS_FreeContext
      // asserts on a non-zero ref_count.
      runtime.executePendingJobs().dispose()
      const state = ctx.getPromiseState(promiseHandle)

      // The async IIFE wrapper turns thrown errors and interrupts into a
      // REJECTED promise — read the rejection reason and treat as a run failure.
      if (state.type === 'rejected') {
        const errorMessage = this.readErrorMessage(ctx, state.error)
        state.error.dispose()
        promiseHandle.dispose()
        disposePair(ctx, runtime)
        ctx = null
        runtime = null
        const message = errorMessage.includes('interrupted')
          ? new SandboxTimeoutError(handlerSlug, budget.cpuMs).message
          : errorMessage
        return await finish(false, message)
      }

      // Dump fulfilled value BEFORE disposing (state.value is a live handle)
      let fulfilledValue: unknown
      if (state.type === 'fulfilled') {
        fulfilledValue = ctx.dump(state.value)
        state.value.dispose()
      }
      promiseHandle.dispose()

      // ── Post-run memory check (test parity: injected memoryProbe) ─────────
      if (this.memoryProbe().heapUsed > budget.memoryBytes) {
        disposePair(ctx, runtime)
        ctx = null
        runtime = null
        return await finish(
          false,
          new SandboxBudgetError(
            handlerSlug,
            'memory',
            this.memoryProbe().heapUsed,
            budget.memoryBytes,
          ).message,
        )
      }

      // ── Read back module.exports (LOGIC_CODE readback) ────────────────────
      let output: unknown
      if (hostModule) {
        const moduleHandle = ctx.evalCode('module').unwrap()
        const exportsHandle = ctx.getProp(moduleHandle, 'exports')
        const transcribed = this.transcribeValue(ctx, exportsHandle, handlerSlug)
        hostModule.exports = transcribed
        exportsHandle.dispose()
        moduleHandle.dispose()

        // Store context in registry for future parser function calls
        const existing = ctxRegistry.get(handlerSlug)
        if (existing) {
          disposePair(existing.ctx, existing.runtime)
        } else if (ctxRegistry.size >= MAX_CTX) {
          evictOldest()
        }
        ctxRegistry.set(handlerSlug, { ctx, runtime, lastUsed: Date.now() })
        runtime = null
        ctx = null

        output = transcribed
      } else {
        output = fulfilledValue
      }

      disposePair(ctx, runtime)
      return await finish(true, null, output)
    } catch (err) {
      disposePair(ctx, runtime)
      const message = err instanceof Error ? err.message : String(err)

      // Map QuickJS interrupt to SandboxTimeoutError
      if (message.includes('interrupted')) {
        return await finish(false, new SandboxTimeoutError(handlerSlug, budget.cpuMs).message)
      }

      return await finish(false, message)
    }
  }

  /**
   * Read the message string off a QJS error handle (rejection reason).
   * Falls back to the dumped value if the handle has no `message` prop.
   */
  private readErrorMessage(ctx: QuickJSContext, errorHandle: QuickJSHandle): string {
    try {
      if (ctx.typeof(errorHandle) === 'object') {
        const msgHandle = ctx.getProp(errorHandle, 'message')
        if (ctx.typeof(msgHandle) === 'string') {
          const msg = ctx.getString(msgHandle)
          msgHandle.dispose()
          return msg
        }
        msgHandle.dispose()
      }
      const dumped = ctx.dump(errorHandle)
      if (typeof dumped === 'string') return dumped
      return dumped && typeof dumped === 'object' && 'message' in dumped
        ? String((dumped as { message: unknown }).message)
        : 'Sandbox handler rejected'
    } catch {
      return 'Sandbox handler rejected'
    }
  }

  /**
   * Recursively transcribe a QJS handle into a host value.
   * Functions become host closures over the kept-alive context.
   * Objects are recursively transcribed. Primitives are dumped.
   */
  private transcribeValue(ctx: QuickJSContext, handle: QuickJSHandle, slug: string): unknown {
    const typeof_ = ctx.typeof(handle)

    if (typeof_ === 'function') {
      return this.wrapFunction(slug, handle)
    }

    if (typeof_ === 'undefined') {
      return undefined
    }

    if (typeof_ === 'object') {
      const result: Record<string, unknown> = {}
      const names = ctx.getOwnPropertyNames(handle, { strings: true }).unwrap()
      try {
        for (const nameHandle of names) {
          const name = ctx.getString(nameHandle)
          const propHandle = ctx.getProp(handle, nameHandle)
          const propTypeof = ctx.typeof(propHandle)

          if (propTypeof === 'function') {
            result[name] = this.wrapFunction(slug, propHandle)
          } else if (propTypeof === 'undefined') {
            result[name] = undefined
          } else if (propTypeof === 'object') {
            // Recursing preserves nested functions (ctx.dump JSON-serializes
            // and silently drops function members, e.g. exports.default.parse).
            result[name] = this.transcribeValue(ctx, propHandle, slug)
            propHandle.dispose()
          } else {
            result[name] = ctx.dump(propHandle)
            propHandle.dispose()
          }
        }
      } finally {
        names.dispose()
      }
      return result
    }

    // Primitives (string, number, boolean, null)
    return ctx.dump(handle)
  }

  /**
   * Create a host-callable closure that invokes a QJS function handle.
   * The closure looks up the context from the registry each call, so it's
   * safe if the context is evicted (throws clear error).
   */
  private wrapFunction(slug: string, fnHandle: QuickJSHandle): (...args: unknown[]) => unknown {
    return (...args: unknown[]) => {
      const entry = ctxRegistry.get(slug)
      if (!entry) throw new Error('Sandbox context evicted')
      const ctx = entry.ctx
      entry.lastUsed = Date.now()

      const argInfos = args.map((a) => this.toHandle(ctx, a))
      try {
        const result = ctx.callFunction(fnHandle, ctx.undefined, ...argInfos.map((a) => a.handle))
        const valueHandle = result.unwrap()
        const out = ctx.dump(valueHandle)
        valueHandle.dispose()
        return out
      } finally {
        for (const info of argInfos) info.dispose()
      }
    }
  }

  /**
   * Convert a host value to a QJS handle with proper lifecycle tracking.
   * Returns the handle and a dispose function (call in finally block).
   */
  private toHandle(
    ctx: QuickJSContext,
    value: unknown,
  ): { handle: QuickJSHandle; dispose: () => void } {
    if (value === undefined) {
      return { handle: ctx.undefined, dispose: () => {} }
    }
    if (value === null) {
      const h = ctx.evalCode('null').unwrap()
      return { handle: h, dispose: () => h.dispose() }
    }
    if (typeof value === 'string') {
      const h = ctx.newString(value)
      return { handle: h, dispose: () => h.dispose() }
    }
    if (typeof value === 'number') {
      const h = ctx.newNumber(value)
      return { handle: h, dispose: () => h.dispose() }
    }
    if (typeof value === 'boolean') {
      const h = ctx.evalCode(value ? 'true' : 'false').unwrap()
      return { handle: h, dispose: () => h.dispose() }
    }
    // Objects/arrays: deep-copy via JSON parse inside QJS
    const h = ctx.evalCode(`(${JSON.stringify(value)})`).unwrap()
    return { handle: h, dispose: () => h.dispose() }
  }
}
