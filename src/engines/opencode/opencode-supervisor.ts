// src/engines/opencode/opencode-supervisor.ts
// OpenCodeSupervisor — supervises a local `opencode serve` subprocess (feature 027).
//
// Governor Canon: this process is NOT CDP/ChromeGovernor. Zero CDP imports.
// Security: binds 127.0.0.1 only; requires OPENCODE_SERVER_PASSWORD; never uses
// --mdns / --cors * (those flip hostname to 0.0.0.0).
// Local-first: OFF by default (OPENCODE_SERVE_ENABLED=1 to start).

import { config } from '../../config.js'
import { OpenCodeServeError } from '../../errors.js'
import { createInstanceRegistry, OpenCodeInstanceRegistry } from './opencode-instance-registry.js'

const HOSTNAME = '127.0.0.1'
const MAX_RESTARTS = 5
// `opencode serve` can take ~20s+ on Windows (cold model/provider boot).
// 90s gives a comfortable margin; a single respawn retry covers flaky first boots.
const READINESS_TIMEOUT_MS = 90_000
const RESTART_BASE_MS = 500

export interface OpenCodeSupervisorOptions {
  enabled?: boolean
  port?: number
  password?: string
  username?: string
  binary?: string
  cwd?: string
  /** Override for tests (mock server URL). */
  healthUrl?: string
  /** Extra args inserted after the binary (tests use a launcher script). */
  extraArgs?: string[]
  /** Injectable registry (tests). Defaults to the real durable registry. */
  registry?: OpenCodeInstanceRegistry
}

export interface OpenCodeSupervisorHandle {
  start(): Promise<{ port: number }>
  stop(): Promise<void>
  isRunning(): boolean
  getPort(): number | null
  on(event: 'ready' | 'exit' | 'error', cb: (info: unknown) => void): void
}

function basicAuthHeader(user: string, pass: string): string {
  const raw = `${user}:${pass}`
  const b64 = typeof btoa === 'function' ? btoa(raw) : Buffer.from(raw).toString('base64')
  return `Basic ${b64}`
}

export class OpenCodeSupervisor implements OpenCodeSupervisorHandle {
  private proc: ReturnType<typeof Bun.spawn> | null = null
  private port: number | null = null
  private running = false
  private restarts = 0
  private listeners: Record<string, Array<(info: unknown) => void>> = {}
  /** Stable ULID for the currently-supervised instance (one per supervisor). */
  private instanceId: string | null = null
  private readonly registry: OpenCodeInstanceRegistry
  private readonly opts: Required<
    Pick<OpenCodeSupervisorOptions, 'binary' | 'username' | 'password' | 'cwd'>
  > &
    OpenCodeSupervisorOptions

  constructor(opts: OpenCodeSupervisorOptions = {}) {
    this.opts = {
      binary: opts.binary ?? 'opencode',
      username: opts.username ?? 'opencode',
      password: opts.password ?? config.opencodeServerPassword,
      cwd: opts.cwd ?? process.cwd(),
      enabled: opts.enabled ?? config.opencodeServeEnabled,
      port: opts.port && opts.port > 0 ? opts.port : (config.opencodeServePort ?? 0),
      healthUrl: opts.healthUrl,
    }
    this.registry = opts.registry ?? createInstanceRegistry()
  }

  /** Expose the registry so the serve handle can surface instance identity. */
  getRegistry(): OpenCodeInstanceRegistry {
    return this.registry
  }

  /** The instance ULID of the currently-supervised serve process (null until start). */
  getInstanceId(): string | null {
    return this.instanceId
  }

  /** The spawned child PID (null until start). */
  getPid(): number | null {
    return this.proc?.pid ?? null
  }

  on(event: 'ready' | 'exit' | 'error', cb: (info: unknown) => void): void {
    const listeners = this.listeners[event] ?? []
    listeners.push(cb)
    this.listeners[event] = listeners
  }

  private emit(event: string, info: unknown): void {
    for (const cb of this.listeners[event] ?? []) cb(info)
  }

  isRunning(): boolean {
    return this.running && this.proc !== null
  }

  getPort(): number | null {
    return this.port
  }

  /**
   * Pick a free loopback port when none is configured.
   * Uses Bun.serve on port 0 (OS-assigned) + immediate stop to discover a free
   * loopback port. Bun.listen is a raw TCP socket API (requires a `socket`
   * handler, not `fetch`), so it's the wrong tool here.
   */
  private async resolvePort(): Promise<number> {
    if (this.opts.port && this.opts.port > 0) return this.opts.port
    const server = Bun.serve({ hostname: HOSTNAME, port: 0, fetch: () => new Response('ok') })
    const p = server.port ?? 0
    server.stop(true)
    if (p <= 0)
      throw new OpenCodeServeError(
        'OPENCODE_SERVE_NO_PORT',
        'failed to reserve a free loopback port',
      )
    return p
  }

  async start(): Promise<{ port: number }> {
    if (!this.opts.enabled) {
      throw new OpenCodeServeError(
        'OPENCODE_SERVE_DISABLED',
        'OpenCode serve is disabled (set OPENCODE_SERVE_ENABLED=1)',
      )
    }
    if (!this.opts.password) {
      throw new OpenCodeServeError(
        'OPENCODE_SERVE_NO_PASSWORD',
        'OPENCODE_SERVER_PASSWORD is required to serve OpenCode',
      )
    }
    const port = await this.resolvePort()
    this.port = port
    // First spawn attempt.
    this.spawnOnce()
    try {
      await this.waitForReady()
      this.registry.recordReady(this.instanceId ?? '', this.proc?.pid, this.port)
    } catch (firstErr) {
      // Flaky first boot — kill and respawn once before giving up.
      this.registry.recordError(this.instanceId ?? '', 'first readiness attempt failed', this.proc?.pid, this.port)
      if (this.proc) {
        this.proc.kill()
        this.proc = null
      }
      this.spawnOnce()
      await this.waitForReady()
      this.registry.recordReady(this.instanceId ?? '', this.proc?.pid, this.port)
    }
    this.running = true
    this.emit('ready', { port })
    return { port }
  }

  private spawnOnce(): void {
    const args = [
      ...(this.opts.extraArgs ?? []),
      'serve',
      '--port',
      String(this.port),
      '--hostname',
      HOSTNAME,
    ]
    this.proc = Bun.spawn([this.opts.binary, ...args], {
      cwd: this.opts.cwd,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        OPENCODE_SERVER_PASSWORD: this.opts.password,
        OPENCODE_SERVER_USERNAME: this.opts.username,
      },
    })
    // Register this instance in the durable ledger BEFORE anything else can
    // misidentify it. `this.proc.pid` is the child we spawned.
    this.instanceId = this.registry.recordSpawn({
      pid: this.proc.pid,
      port: this.port ?? 0,
      parentPid: process.pid,
      binary: this.opts.binary,
      cwd: this.opts.cwd,
    })
    // Drain both stdout and stderr in background — on Windows the pipe buffer
    // fills and blocks the child process if nobody reads it. We read and discard.
    for (const stream of [this.proc.stdout, this.proc.stderr]) {
      if (stream && typeof stream !== 'number') {
        const reader = stream.getReader()
        const drain = async (): Promise<void> => {
          try {
            for (;;) {
              const { done } = await reader.read()
              if (done) break
            }
          } catch {
            /* stream closed */
          }
        }
        void drain()
      }
    }
    this.proc.exited.then((code) => this.onChildExit(code)).catch(() => {})
  }

  private onChildExit(code: number): void {
    this.running = false
    this.registry.recordExit(this.instanceId ?? '', code, this.proc?.pid, this.port ?? undefined)
    this.emit('exit', { code })
    if (code !== 0 && this.restarts < MAX_RESTARTS) {
      this.restarts += 1
      const backoff = RESTART_BASE_MS * 2 ** (this.restarts - 1)
      setTimeout(() => {
        if (this.opts.enabled) {
          try {
            this.spawnOnce()
            this.waitForReady()
              .then(() => {
                this.running = true
                this.registry.recordReady(this.instanceId ?? '', this.proc?.pid, this.port)
                this.emit('ready', { port: this.port })
              })
              .catch((e) => {
                this.registry.recordError(this.instanceId ?? '', String(e), this.proc?.pid, this.port ?? undefined)
                this.emit('error', e)
              })
          } catch (e) {
            this.emit('error', e)
          }
        }
      }, backoff)
    }
  }

  private healthBase(): string {
    if (this.opts.healthUrl) return this.opts.healthUrl
    return `http://${HOSTNAME}:${this.port}`
  }

  private async waitForReady(): Promise<void> {
    const auth = basicAuthHeader(this.opts.username, this.opts.password)
    const deadline = Date.now() + READINESS_TIMEOUT_MS
    const url = `${this.healthBase()}/doc`
    while (Date.now() < deadline) {
      try {
        const res = await fetch(url, {
          headers: { Authorization: auth },
          signal: AbortSignal.timeout(3_000),
        })
        if (res.ok) return
      } catch {
        // server not up yet — retry
      }
      await new Promise((r) => setTimeout(r, 250))
    }
    throw new OpenCodeServeError(
      'OPENCODE_SERVE_NOT_READY',
      `opencode serve not ready within ${READINESS_TIMEOUT_MS}ms`,
    )
  }

  async stop(): Promise<void> {
    this.running = false
    this.opts.enabled = false
    if (this.proc) {
      this.registry.recordStop(this.instanceId ?? '', this.proc.pid, this.port ?? undefined)
      this.proc.kill()
      this.proc = null
    }
    this.port = null
  }
}
