// ── Message Types ───────────────────────────────────────────────────────────

export type ActorMsg =
  | { t: 'EnsureRunning' }
  | { t: 'Evaluate'; expr: string; k: (r: unknown) => void }
  | { t: 'CdpMethod'; method: string; params?: Record<string, unknown>; k: (r: unknown) => void }
  | { t: 'Screenshot'; format?: 'png' | 'jpeg'; k: (r: string) => void }
  | { t: 'HealthProbe'; k: (ok: boolean) => void }
  | { t: 'Shutdown' }
  | { t: 'Crash'; cause: FailureClass }
  | { t: 'Recover'; strategy: RecoveryStrategy }

// ── Failure Classification ──────────────────────────────────────────────────

export type FailureClass =
  | 'OOM'
  | 'RendererCrash'
  | 'BrowserCrash'
  | 'NavigationTimeout'
  | 'ProviderTimeout'
  | 'AuthFailure'
  | 'ProfileCorruption'
  | 'CdpDisconnect'
  | 'GpuFailure'
  | 'Unknown'

export type RecoveryStrategy =
  | 'kill_and_respawn'
  | 'renavigate_only'
  | 'ensure_running'
  | 'reload_clear_cookies'
  | 'reload_reinject_antidetection'
  | 'visible_relaunch'
  | 'reallocate_profile'
  | 'force_reconnect'
  | 'kill_disable_gpu'
  | 'circuit_breaker'

// ── Helper to check message type ────────────────────────────────────────────

export function isLifecycleMsg(msg: ActorMsg): boolean {
  return (
    msg.t === 'EnsureRunning' || msg.t === 'Shutdown' || msg.t === 'Crash' || msg.t === 'Recover'
  )
}

export function isCommandMsg(msg: ActorMsg): boolean {
  return (
    msg.t === 'Evaluate' ||
    msg.t === 'CdpMethod' ||
    msg.t === 'Screenshot' ||
    msg.t === 'HealthProbe'
  )
}
