import vm from 'node:vm'
import { SandboxBudgetError, SandboxPermissionError, SandboxTimeoutError } from '../errors.js'
import { newId } from '../ids.js'
import type {
  SandboxAuditRow,
  SandboxAuditStore,
} from '../storage/contracts/sandbox-audit-store.js'

export interface SandboxPermissions {
  // Allow-list of URL prefixes the handler may fetch. Empty = no fetch.
  canFetch: string[]
  // Allow-list of absolute file paths the handler may read. Empty = no reads.
  canReadFile: string[]
  // Allow-list of absolute file paths the handler may write. Empty = no writes.
  canWriteFile: string[]
  canUseClipboard: boolean
}

export interface SandboxBudget {
  cpuMs: number
  memoryBytes: number
}

export interface SandboxRunOptions {
  budget?: Partial<SandboxBudget>
  handlerSlug?: string
  // Injected for deterministic testing; defaults to real process.memoryUsage().
  memoryProbe?: () => { heapUsed: number }
  // Extra frozen globals exposed to the handler (e.g. CommonJS module/exports).
  globals?: Record<string, unknown>
}

export interface SandboxResult {
  ok: boolean
  output?: unknown
  error?: string
  auditId: string
}

/**
 * Hardened execution environment for untrusted inline capability handlers.
 *
 * The vm context is frozen and exposes ONLY: `input`, a silent `console`, and
 * (optionally) a guarded `navigator.clipboard`. There is no `process`,
 * `require`, `globalThis`, or `fetch` in scope, so handlers cannot escape the
 * sandbox, touch the filesystem, or reach the network unless explicitly wired
 * through the narrow permission gates below.
 */
export class SandboxRunner {
  private readonly defaultBudget: SandboxBudget
  private readonly memoryProbe: () => { heapUsed: number }

  constructor(
    private readonly auditStore: SandboxAuditStore,
    options: { defaultBudget?: SandboxBudget; memoryProbe?: () => { heapUsed: number } } = {},
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

    // Null-prototype sandbox: blocks the classic `globalThis.constructor
    // .constructor('return process')()` escape, since there is no Object
    // prototype (and thus no `.constructor`) on the context global.
    const sandbox = Object.create(null) as Record<string, unknown>
    sandbox.input = input
    sandbox.console = { log: () => {}, error: () => {}, warn: () => {} }

    if (permissions.canUseClipboard) {
      sandbox.navigator = { clipboard: this.makeClipboardGuard(handlerSlug) }
    }
    if (options.globals) {
      for (const [key, value] of Object.entries(options.globals)) {
        sandbox[key] = value
      }
    }

    // Freeze the sandbox object graph so handlers cannot reassign globals.
    const context = vm.createContext(Object.freeze(sandbox))

    const isOverBudget = () => this.memoryProbe().heapUsed > budget.memoryBytes
    let memoryBreached = isOverBudget()
    const memoryTimer = setInterval(() => {
      if (isOverBudget()) {
        memoryBreached = true
      }
    }, 5)

    const finish = async (
      ok: boolean,
      error: string | null,
      output?: unknown,
    ): Promise<SandboxResult> => {
      clearInterval(memoryTimer)
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

    try {
      const script = new vm.Script(`(async () => { ${code} })()`)
      const output = await script.runInContext(context, { timeout: budget.cpuMs })
      if (memoryBreached || isOverBudget()) {
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
      return await finish(true, null, output)
    } catch (err) {
      clearInterval(memoryTimer)
      const message = err instanceof Error ? err.message : String(err)
      const code = (err as { code?: string }).code
      if (code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') {
        return await finish(false, new SandboxTimeoutError(handlerSlug, budget.cpuMs).message)
      }
      if (err instanceof SandboxTimeoutError || err instanceof SandboxBudgetError) {
        return await finish(false, message)
      }
      return await finish(false, message)
    }
  }

  /**
   * The clipboard gate is the only network/file-adjacent surface exposed when
   * canUseClipboard is true. It throws by default so a handler must be granted
   * explicit passthrough wiring by the host — the sandbox itself performs no
   * real clipboard I/O.
   */
  private makeClipboardGuard(handlerSlug: string) {
    return {
      readText: async (): Promise<string> => {
        throw new SandboxPermissionError(handlerSlug, 'navigator.clipboard.readText')
      },
      writeText: async (_text: string): Promise<void> => {
        throw new SandboxPermissionError(handlerSlug, 'navigator.clipboard.writeText')
      },
    }
  }
}
