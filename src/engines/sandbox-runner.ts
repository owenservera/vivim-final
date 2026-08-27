import type { SandboxAuditStore } from '../storage/contracts/sandbox-audit-store.js'

// ── Interfaces (canonical — all impls import from here) ──────────────────
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

// ── Selector ──────────────────────────────────────────────────────────────
// VIVIM_SANDBOX_MODE: 'quickjs' (default) | 'vm' (rollback)
// QuickJS: WASM-based true isolation, no shared heap, no native addon risk.
// node:vm: V8 context in host isolate, kept only for one-line rollback and
// requires explicit opt-in via VIVIM_UNSAFE_VM=1 (hazard H9 — denylist fail-open).
const mode = process.env.VIVIM_SANDBOX_MODE ?? 'quickjs'

if (mode === 'vm' && process.env.VIVIM_UNSAFE_VM !== '1') {
  throw new Error(
    'Sandbox mode "vm" requires VIVIM_UNSAFE_VM=1 — use default "quickjs" for true isolation. ' +
      'The vm fallback is retained only for rollback and is weaker (shared V8 heap, denylist-dependent).',
  )
}

const mod =
  mode === 'vm'
    ? await import('./sandbox-runner-vm.js')
    : await import('./sandbox-runner-quickjs.js')

export const SandboxRunner: new (
  auditStore: SandboxAuditStore,
  options?: {
    defaultBudget?: SandboxBudget
    memoryProbe?: () => { heapUsed: number }
  },
) => {
  run(
    code: string,
    input: Record<string, unknown>,
    permissions: SandboxPermissions,
    options?: SandboxRunOptions,
  ): Promise<SandboxResult>
} = mod.SandboxRunner
