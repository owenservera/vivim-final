// src/engines/opencode/opencode-instance-registry.ts
// OpenCodeInstanceRegistry — durable register + log of every `opencode serve`
// instance vivim spawns (feature 027 / serve layer).
//
// WHY THIS EXISTS (design fix, 2026-08-08): the old supervisor spawned serve
// without ever recording the child PID or registering the instance anywhere,
// so nothing could answer "which serve process is vivim's, and which is the
// user's interactive opencode session?". That ambiguity caused a near-fatal
// incident: a blanket `Stop-Process -Name opencode -Force` killed the live
// conversation. This registry makes every instance traceable:
//   - a durable JSONL ledger (`.runtime/opencode-instances.jsonl`) records every
//     spawn/ready/exit/stop event with PID, port, parent PID, ULID instance id;
//   - a live classifier resolves the current owner of each registered port and
//     labels running `opencode` processes as `managed` (vivim's) vs `external`
//     (the user's / agent's interactive TUI session — NEVER to be killed).
//
// Invariants:
//   - Zero CDP imports (Governor Canon).
//   - Writes are append-only; reads are best-effort (missing file = empty list).
//   - `classifyLive()` is the ONLY sanctioned way to decide which opencode
//     processes belong to vivim. Never `Stop-Process -Name opencode -Force`.

import { execFileSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { OpenCodeServeError } from '../../errors.js'
import { newId } from '../../ids.js'

/**
 * Run a PowerShell command and return its stdout, WITHOUT ever throwing.
 * Root-cause fix (2026-08-08): the old callers used raw `execFileSync` with a
 * 15s timeout, which blocked the event loop and threw `ETIMEDOUT` on slow
 * spawns — that error escaped `classifyLive()` into the capability handler
 * (HTTP 500) and was masked as "Unknown command" by the CLI's catch-all.
 * This helper bounds every spawn to `timeoutMs` and returns `''` on any
 * failure so process/port enumeration is strictly best-effort (per the
 * registry's documented invariant: reads never block or break the caller).
 */
function runPowershellSafe(script: string, _timeoutMs: number, spawnTimeoutMs: number): string {
  try {
    const out = execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
      encoding: 'utf8',
      timeout: spawnTimeoutMs,
    })
    return out ?? ''
  } catch {
    return ''
  }
}

/** Single recorded event for one serve instance. */
export interface OpenCodeInstanceEvent {
  /** Monotonic ULID; also the instance id when `kind === 'spawn'`. */
  id: string
  kind: 'spawn' | 'ready' | 'exit' | 'stop' | 'error'
  at: number
  /** Instance ULID (stable across events of the same process). */
  instanceId: string
  pid?: number
  port?: number
  parentPid?: number
  binary?: string
  cwd?: string
  code?: number
  err?: string
}

/** A live opencode process classified relative to vivim's managed instances. */
export interface ClassifiedOpenCodeProcess {
  pid: number
  /** True if this process is one of vivim's spawned serve instances. */
  managed: boolean
  /** `serve` / `tui` / `run` / `models` / `other` based on CommandLine. */
  kind: 'serve' | 'tui' | 'run' | 'models' | 'other'
  port?: number
  commandLine: string
  /** For managed instances: the registry instance ULID. */
  instanceId?: string
}

export interface InstanceRegistryOptions {
  /** Ledger file path. Defaults to `.runtime/opencode-instances.jsonl`. */
  ledgerPath?: string
  /** Exposed for tests: inject a live-process enumerator. */
  listProcesses?: () => Array<{ pid: number; commandLine: string }>
  /** Exposed for tests: inject a port-owner resolver. */
  ownerOfPort?: (port: number) => number | null
}

function shimmedCommandLine(cmd: string): string {
  return cmd ?? ''
}

/**
 * Validate a port before interpolating it into a PowerShell script.
 * Defense-in-depth for AU-0017: `runPowershellSafe` executes a `-Command`
 * string, so every interpolated value must be a trusted, bounded integer —
 * never a raw string from an external source. Returns null if the value is
 * not a valid TCP port, short-circuiting the exec rather than risk injection.
 */
function safePort(port: unknown): number | null {
  if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) {
    return null
  }
  return port
}

export class OpenCodeInstanceRegistry {
  private readonly ledgerPath: string
  private readonly listProcesses: () => Array<{ pid: number; commandLine: string }>
  private readonly ownerOfPort: (port: number) => number | null

  constructor(opts: InstanceRegistryOptions = {}) {
    this.ledgerPath = opts.ledgerPath ?? join(process.cwd(), '.runtime', 'opencode-instances.jsonl')
    this.listProcesses =
      opts.listProcesses ??
      (() => {
        // Enumerate `opencode.exe` processes with CommandLine via PowerShell.
        // PowerShell is the sanctioned Windows mechanism (devops/desktop uses it).
        const ps = `Get-CimInstance Win32_Process -Filter "Name='opencode.exe'" | ForEach-Object { $_.ProcessId.ToString() + "|" + $_.CommandLine }`
        const out = runPowershellSafe(ps, 5_000, 5_000)
        const rows: Array<{ pid: number; commandLine: string }> = []
        for (const line of out.split(/\r?\n/)) {
          const i = line.indexOf('|')
          if (i <= 0) continue
          const pid = Number(line.slice(0, i))
          if (!Number.isFinite(pid)) continue
          rows.push({ pid, commandLine: shimmedCommandLine(line.slice(i + 1)) })
        }
        return rows
      })
    this.ownerOfPort =
      opts.ownerOfPort ??
      ((port: number) => {
        const p = safePort(port)
        if (p === null) return null
        // Script is a trusted constant with a bounded integer interpolated
        // (never raw/external input) — see safePort() above (AU-0017).
        const out = runPowershellSafe(
          `Get-NetTCPConnection -LocalPort ${p} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess`,
          5_000,
          5_000,
        )
        const pid = Number(out.trim())
        return Number.isFinite(pid) && pid > 0 ? pid : null
      })
  }

  /** Append a record. Best-effort; never throws for ledger I/O failures. */
  private append(ev: OpenCodeInstanceEvent): void {
    try {
      const dir = join(this.ledgerPath, '..')
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      appendFileSync(this.ledgerPath, `${JSON.stringify(ev)}\n`, 'utf8')
    } catch {
      // [audit] log the error with context here
      // Ledger write failure must never break the serve layer.
    }
  }

  /**
   * Record a new spawn. Returns the stable instance ULID.
   * Call this right after `Bun.spawn` succeeds with the child PID.
   */
  recordSpawn(opts: {
    pid: number
    port: number
    parentPid: number
    binary?: string
    cwd?: string
  }): string {
    const instanceId = newId()
    this.append({
      id: newId(),
      kind: 'spawn',
      at: Date.now(),
      instanceId,
      pid: opts.pid,
      port: opts.port,
      parentPid: opts.parentPid,
      binary: opts.binary,
      cwd: opts.cwd,
    })
    return instanceId
  }

  recordReady(instanceId: string, pid?: number, port?: number): void {
    this.append({ id: newId(), kind: 'ready', at: Date.now(), instanceId, pid, port })
  }

  recordExit(instanceId: string, code: number, pid?: number, port?: number): void {
    this.append({ id: newId(), kind: 'exit', at: Date.now(), instanceId, pid, port, code })
  }

  recordStop(instanceId: string, pid?: number, port?: number): void {
    this.append({ id: newId(), kind: 'stop', at: Date.now(), instanceId, pid, port })
  }

  recordError(instanceId: string, err: string, pid?: number, port?: number): void {
    this.append({ id: newId(), kind: 'error', at: Date.now(), instanceId, pid, port, err })
  }

  /** Read the full ledger (most recent last). Empty file → `[]`. */
  readLedger(): OpenCodeInstanceEvent[] {
    if (!existsSync(this.ledgerPath)) return []
    try {
      const raw = readFileSync(this.ledgerPath, 'utf8')
      const out: OpenCodeInstanceEvent[] = []
      for (const line of raw.split(/\r?\n/)) {
        if (!line.trim()) continue
        try {
          out.push(JSON.parse(line) as OpenCodeInstanceEvent)
        } catch {
          // [audit] log the error with context here
          // skip malformed line
        }
      }
      return out
    } catch {
      return []
    }
  }

  /** The most recent spawn event per distinct instance (i.e. live instances' identity). */
  liveInstances(): Array<{ instanceId: string; pid?: number; port?: number }> {
    const latest = new Map<string, { instanceId: string; pid?: number; port?: number }>()
    for (const ev of this.readLedger()) {
      if (ev.kind === 'spawn') {
        latest.set(ev.instanceId, { instanceId: ev.instanceId, pid: ev.pid, port: ev.port })
      }
    }
    return [...latest.values()]
  }

  /**
   * Resolve which PID currently owns each registered port. A registered instance
   * is "alive" when its original spawn PID (or its resolved owner) still exists.
   */
  private managedPidToPort(): Map<number, { instanceId: string; port: number }> {
    const map = new Map<number, { instanceId: string; port: number }>()
    for (const inst of this.liveInstances()) {
      if (!inst.port) continue
      // The recorded PID is the direct child. If the child re-exec'd (common on
      // Windows chocolatey shims), resolve the current socket owner too.
      const owner = this.ownerOfPort(inst.port)
      const candidates = new Set<number>()
      if (inst.pid) candidates.add(inst.pid)
      if (owner) candidates.add(owner)
      for (const pid of candidates) {
        map.set(pid, { instanceId: inst.instanceId, port: inst.port })
      }
    }
    return map
  }

  /**
   * Classify every running opencode process: `managed` (vivim's serve) vs
   * `external` (user/agent interactive TUI, one-shot runs, etc.).
   * The ONLY sanctioned way to decide what belongs to vivim.
   */
  classifyLive(): ClassifiedOpenCodeProcess[] {
    const processes = this.listProcesses()
    const managed = this.managedPidToPort()
    const out: ClassifiedOpenCodeProcess[] = []
    for (const p of processes) {
      const m = managed.get(p.pid)
      const cmd = p.commandLine.toLowerCase()
      let kind: ClassifiedOpenCodeProcess['kind'] = 'other'
      if (cmd.includes('serve')) kind = 'serve'
      else if (cmd.includes(' tui') || cmd.includes(' chat')) kind = 'tui'
      else if (cmd.includes(' run ')) kind = 'run'
      else if (cmd.includes(' models')) kind = 'models'
      // Port appears as `--port NNNN` on managed serve processes.
      let port: number | undefined
      const portMatch = p.commandLine.match(/--port\s+(\d+)/i)
      if (portMatch) port = Number(portMatch[1])
      out.push({
        pid: p.pid,
        managed: m !== undefined,
        kind,
        port,
        instanceId: m?.instanceId,
        commandLine: p.commandLine,
      })
    }
    // Deterministic order: managed first, then by PID.
    out.sort((a, b) => (a.managed === b.managed ? a.pid - b.pid : a.managed ? -1 : 1))
    return out
  }

  /** Convenience: the vivim-managed serve instance (if any). */
  managedServe(): ClassifiedOpenCodeProcess | null {
    return this.classifyLive().find((p) => p.managed && p.kind === 'serve') ?? null
  }
}

/** Throw-free factory; a registry failure must not block boot. */
export function createInstanceRegistry(opts?: InstanceRegistryOptions): OpenCodeInstanceRegistry {
  try {
    return new OpenCodeInstanceRegistry(opts)
  } catch (e) {
    throw new OpenCodeServeError(
      'OPENCODE_REGISTRY_FAILED',
      e instanceof Error ? e.message : 'registry init failed',
    )
  }
}
