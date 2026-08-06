// src/engines/session-lifecycle-manager.ts
// Centralized session lifecycle management.
// Handles creation, recovery, heartbeat, state persistence, and teardown.
// This engine consolidates session logic previously scattered across
// session-caps.ts, chrome-governor.ts, and conversation-manager.ts.

import { deriveId } from '../executor/ids.js'
import { EngineError } from '../errors.js'
import { getLogger } from '../lib/logger.js'
import type { CapabilityEventBus } from './capability-event-bus.js'
import { SessionStatePersistence } from './session-state-persistence.js'

// ── Types ──────────────────────────────────────────────────────────────────

/** Session states */
export type SessionState =
  | 'creating' // Session is being initialized
  | 'active' // Session is active and healthy
  | 'idle' // Session has been idle beyond threshold
  | 'suspended' // Session is suspended (resource conservation)
  | 'recovering' // Session is being recovered after failure
  | 'terminated' // Session has been terminated

/** Session type discriminator */
export type SessionType = 'provider' | 'conversation' | 'autonomous' | 'workflow'

/** Session configuration */
export interface SessionConfig {
  /** Type of session */
  type: SessionType
  /** Provider/account/conversation this session belongs to */
  entityId: string
  /** Provider slug (for provider sessions) */
  providerSlug?: string
  /** Maximum idle time before suspension (ms) */
  idleTimeoutMs?: number
  /** Heartbeat interval (ms) */
  heartbeatIntervalMs?: number
  /** Maximum number of recovery attempts */
  maxRecoveryAttempts?: number
  /** Custom metadata */
  metadata?: Record<string, unknown>
}

/** Session state record (persisted) */
export interface SessionRecord {
  /** Unique session ID */
  sessionId: string
  /** Session type */
  type: SessionType
  /** Associated entity ID */
  entityId: string
  /** Current state */
  state: SessionState
  /** Creation timestamp */
  createdAt: number
  /** Last activity timestamp */
  lastActiveAt: number
  /** Last heartbeat timestamp */
  lastHeartbeatAt: number
  /** Number of recovery attempts */
  recoveryAttempts: number
  /** Custom metadata */
  metadata: Record<string, unknown>
  /** State data (serialized) */
  stateData?: Record<string, unknown>
}

/** Session events emitted to the event bus */
export interface SessionEvents {
  'session:created': { sessionId: string; type: SessionType; entityId: string }
  'session:state_changed': { sessionId: string; from: SessionState; to: SessionState }
  'session:heartbeat': { sessionId: string; latencyMs: number }
  'session:idle': { sessionId: string; idleDurationMs: number }
  'session:recovered': { sessionId: string; attempts: number }
  'session:terminated': { sessionId: string; reason: string }
  'session:failed': { sessionId: string; error: string }
}

/** Options for the session lifecycle manager */
export interface SessionLifecycleOptions {
  /** Default idle timeout (ms) — default 30 minutes */
  defaultIdleTimeoutMs?: number
  /** Default heartbeat interval (ms) — default 30 seconds */
  defaultHeartbeatIntervalMs?: number
  /** Maximum concurrent sessions */
  maxConcurrentSessions?: number
  /** How often to scan for idle sessions (ms) — default 60 seconds */
  idleScanIntervalMs?: number
}

/** Recovery strategy */
export type RecoveryStrategy = 'reconnect' | 'recreate' | 'fail'

/** Hook for session lifecycle events */
export interface SessionLifecycleHooks {
  onCreate?: (session: SessionRecord) => Promise<void>
  onStateChange?: (session: SessionRecord, from: SessionState, to: SessionState) => Promise<void>
  onHeartbeat?: (session: SessionRecord) => Promise<void>
  onTerminate?: (session: SessionRecord) => Promise<void>
  onRecover?: (session: SessionRecord, strategy: RecoveryStrategy) => Promise<boolean>
}

// ── Valid state transitions ───────────────────────────────────────────────

const VALID_TRANSITIONS: Record<SessionState, readonly SessionState[]> = {
  creating: ['active', 'terminated'],
  active: ['idle', 'suspended', 'recovering', 'terminated'],
  idle: ['active', 'suspended', 'recovering', 'terminated'],
  suspended: ['active', 'recovering', 'terminated'],
  recovering: ['active', 'idle', 'suspended', 'terminated'],
  terminated: [],
}

// ── All session types and states (for stats) ───────────────────────────────

const _ALL_SESSION_TYPES: readonly SessionType[] = [
  'provider',
  'conversation',
  'autonomous',
  'workflow',
]
const _ALL_SESSION_STATES: readonly SessionState[] = [
  'creating',
  'active',
  'idle',
  'suspended',
  'recovering',
  'terminated',
]

// ── SessionLifecycleManager ────────────────────────────────────────────────

export class SessionLifecycleManager {
  private readonly sessions = new Map<string, SessionRecord>()
  private readonly heartbeatTimers = new Map<string, ReturnType<typeof setInterval>>()
  private readonly persistence: SessionStatePersistence
  private readonly hooks: SessionLifecycleHooks
  private readonly options: Required<SessionLifecycleOptions>
  private idleScanTimer?: ReturnType<typeof setInterval>
  private readonly log = getLogger('session-lifecycle-manager')

  constructor(
    private readonly eventBus: CapabilityEventBus,
    hooks?: SessionLifecycleHooks,
    options?: SessionLifecycleOptions,
    persistenceDir?: string,
  ) {
    this.hooks = hooks ?? {}
    this.persistence = new SessionStatePersistence(persistenceDir)
    this.options = {
      defaultIdleTimeoutMs: options?.defaultIdleTimeoutMs ?? 30 * 60 * 1000, // 30 min
      defaultHeartbeatIntervalMs: options?.defaultHeartbeatIntervalMs ?? 30 * 1000, // 30s
      maxConcurrentSessions: options?.maxConcurrentSessions ?? Number.POSITIVE_INFINITY,
      idleScanIntervalMs: options?.idleScanIntervalMs ?? 60 * 1000, // 60s
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /** Create a new session */
  async createSession(config: SessionConfig): Promise<SessionRecord> {
    const now = Date.now()

    // Check concurrency limit
    const activeCount = this.countActiveSessions()
    if (activeCount >= this.options.maxConcurrentSessions) {
      throw new EngineError(`Max concurrent sessions reached (${this.options.maxConcurrentSessions})`)
    }

    const sessionId = deriveId('sess')

    const record: SessionRecord = {
      sessionId,
      type: config.type,
      entityId: config.entityId,
      state: 'creating',
      createdAt: now,
      lastActiveAt: now,
      lastHeartbeatAt: now,
      recoveryAttempts: 0,
      metadata: { ...config.metadata, providerSlug: config.providerSlug },
      stateData: {
        idleTimeoutMs: config.idleTimeoutMs ?? this.options.defaultIdleTimeoutMs,
        heartbeatIntervalMs: config.heartbeatIntervalMs ?? this.options.defaultHeartbeatIntervalMs,
        maxRecoveryAttempts: config.maxRecoveryAttempts ?? 3,
      },
    }

    this.sessions.set(sessionId, record)
    await this.persistSession(record)

    // Fire onCreate hook
    try {
      await this.hooks.onCreate?.(record)
    } catch (err) {
      this.log.warn({ err, sessionId }, 'onCreate hook failed')
    }

    // Transition to active
    await this.transitionState(sessionId, 'active')

    // Emit event
    this.eventBus.emit({
      type: 'session:created',
      sessionId,
      sessionType: record.type,
      entityId: record.entityId,
    } as unknown as Parameters<CapabilityEventBus['emit']>[0])

    // Start heartbeat
    this.startHeartbeat(sessionId)

    this.log.info({ sessionId, type: config.type, entityId: config.entityId }, 'session created')

    // Return a fresh copy of the record (after state transition)
    return this.getSession(sessionId)!
  }

  /** Get a session by ID */
  getSession(sessionId: string): SessionRecord | undefined {
    const record = this.sessions.get(sessionId)
    if (!record) return undefined
    // Return a defensive copy
    return {
      ...record,
      metadata: { ...record.metadata },
      stateData: record.stateData ? { ...record.stateData } : undefined,
    }
  }

  /** Get all sessions, optionally filtered by type or state */
  getSessions(filter?: {
    type?: SessionType
    state?: SessionState
    entityId?: string
  }): SessionRecord[] {
    let results = [...this.sessions.values()]

    if (filter?.type) {
      results = results.filter((s) => s.type === filter.type)
    }
    if (filter?.state) {
      results = results.filter((s) => s.state === filter.state)
    }
    if (filter?.entityId) {
      results = results.filter((s) => s.entityId === filter.entityId)
    }

    return results.map((s) => ({
      ...s,
      metadata: { ...s.metadata },
      stateData: s.stateData ? { ...s.stateData } : undefined,
    }))
  }

  /** Record a heartbeat for a session */
  async heartbeat(sessionId: string, latencyMs = 0): Promise<void> {
    const record = this.sessions.get(sessionId)
    if (!record) {
      this.log.warn({ sessionId }, 'heartbeat for unknown session')
      return
    }

    const now = Date.now()
    record.lastHeartbeatAt = now
    record.lastActiveAt = now

    // If session was idle/suspended, reactivate on heartbeat
    if (record.state === 'idle' || record.state === 'suspended') {
      await this.transitionState(sessionId, 'active')
    }

    // Fire hook
    try {
      await this.hooks.onHeartbeat?.(record)
    } catch (err) {
      this.log.warn({ err, sessionId }, 'onHeartbeat hook failed')
    }

    // Emit event
    this.eventBus.emit({
      type: 'session:heartbeat',
      sessionId,
      latencyMs,
    } as unknown as Parameters<CapabilityEventBus['emit']>[0])

    await this.persistSession(record)
  }

  /** Transition a session to a new state */
  async transitionState(sessionId: string, targetState: SessionState): Promise<void> {
    const record = this.sessions.get(sessionId)
    if (!record) {
      throw new EngineError(`Session not found: ${sessionId}`)
    }

    const fromState = record.state

    // Validate transition
    if (!VALID_TRANSITIONS[fromState]?.includes(targetState)) {
      throw new EngineError(
        `Invalid state transition: ${fromState} -> ${targetState} for session ${sessionId}`,
      )
    }

    record.state = targetState
    record.lastActiveAt = Date.now()

    // Manage heartbeat timers based on state
    if (targetState === 'terminated' || targetState === 'suspended') {
      this.stopHeartbeat(sessionId)
    } else if (fromState === 'suspended' && targetState === 'active') {
      this.startHeartbeat(sessionId)
    }

    // Persist state change
    await this.persistSession(record)

    // Fire hook
    try {
      await this.hooks.onStateChange?.(record, fromState, targetState)
    } catch (err) {
      this.log.warn({ err, sessionId }, 'onStateChange hook failed')
    }

    // Emit event
    this.eventBus.emit({
      type: 'session:state_changed',
      sessionId,
      from: fromState,
      to: targetState,
    } as unknown as Parameters<CapabilityEventBus['emit']>[0])

    this.log.debug({ sessionId, from: fromState, to: targetState }, 'session state changed')
  }

  /** Attempt to recover a failed/idle session */
  async recoverSession(sessionId: string): Promise<boolean> {
    const record = this.sessions.get(sessionId)
    if (!record) {
      this.log.warn({ sessionId }, 'recoverSession: session not found')
      return false
    }

    const maxAttempts = (record.stateData?.maxRecoveryAttempts as number) ?? 3
    if (record.recoveryAttempts >= maxAttempts) {
      this.log.warn(
        { sessionId, attempts: record.recoveryAttempts },
        'max recovery attempts reached',
      )
      await this.terminateSession(sessionId, 'max recovery attempts exceeded')
      return false
    }

    record.recoveryAttempts++

    const strategy = this.determineRecoveryStrategy(record)

    // Transition to recovering
    if (record.state !== 'recovering') {
      await this.transitionState(sessionId, 'recovering')
    }

    // Fire recovery hook
    let hookResult = false
    try {
      hookResult = (await this.hooks.onRecover?.(record, strategy)) ?? false
    } catch (err) {
      this.log.warn({ err, sessionId, strategy }, 'onRecover hook failed')
    }

    if (!hookResult && strategy === 'fail') {
      // No hook and strategy is fail — terminate
      this.log.error({ sessionId }, 'recovery failed (strategy: fail)')
      this.eventBus.emit({
        type: 'session:failed',
        sessionId,
        error: `recovery failed with strategy: ${strategy}`,
      } as unknown as Parameters<CapabilityEventBus['emit']>[0])
      await this.terminateSession(sessionId, 'recovery failed')
      return false
    }

    // Recovery succeeded (hook returned true, or strategy isn't 'fail')
    await this.transitionState(sessionId, 'active')

    this.eventBus.emit({
      type: 'session:recovered',
      sessionId,
      attempts: record.recoveryAttempts,
    } as unknown as Parameters<CapabilityEventBus['emit']>[0])

    this.log.info({ sessionId, attempts: record.recoveryAttempts }, 'session recovered')

    // Restart heartbeat after recovery
    this.startHeartbeat(sessionId)
    await this.persistSession(record)

    return true
  }

  /** Terminate a session (graceful shutdown) */
  async terminateSession(sessionId: string, reason = 'explicit'): Promise<void> {
    const record = this.sessions.get(sessionId)
    if (!record) {
      this.log.warn({ sessionId }, 'terminateSession: session not found')
      return
    }

    if (record.state === 'terminated') {
      return // already terminated
    }

    // Stop heartbeat
    this.stopHeartbeat(sessionId)

    // Fire hook
    try {
      await this.hooks.onTerminate?.(record)
    } catch (err) {
      this.log.warn({ err, sessionId }, 'onTerminate hook failed')
    }

    // Transition to terminated
    record.state = 'terminated'
    record.lastActiveAt = Date.now()
    await this.persistSession(record)

    // Emit event
    this.eventBus.emit({
      type: 'session:terminated',
      sessionId,
      reason,
    } as unknown as Parameters<CapabilityEventBus['emit']>[0])

    // Remove from active map (keep in persistence for audit)
    this.sessions.delete(sessionId)
    this.persistence.delete(sessionId)

    this.log.info({ sessionId, reason }, 'session terminated')
  }

  /** Terminate all sessions of a given type or entity. Returns count terminated. */
  async terminateAll(filter?: { type?: SessionType; entityId?: string }): Promise<number> {
    const sessions = this.getSessions(filter)
    let count = 0

    for (const session of sessions) {
      await this.terminateSession(session.sessionId)
      count++
    }

    return count
  }

  /** Start the idle session scanner */
  startIdleScanner(): void {
    if (this.idleScanTimer) return

    this.idleScanTimer = setInterval(() => {
      this.scanIdleSessions().catch((err) => {
        this.log.warn({ err }, 'idle scan failed')
      })
    }, this.options.idleScanIntervalMs)

    // Allow process exit without waiting
    if (
      this.idleScanTimer &&
      typeof this.idleScanTimer === 'object' &&
      'unref' in this.idleScanTimer
    ) {
      ;(this.idleScanTimer as unknown as { unref(): void }).unref()
    }

    this.log.debug({ intervalMs: this.options.idleScanIntervalMs }, 'idle scanner started')
  }

  /** Stop the idle session scanner */
  stopIdleScanner(): void {
    if (this.idleScanTimer) {
      clearInterval(this.idleScanTimer)
      this.idleScanTimer = undefined
      this.log.debug('idle scanner stopped')
    }
  }

  /** Get session statistics */
  getStats(): {
    total: number
    byType: Record<SessionType, number>
    byState: Record<SessionState, number>
  } {
    const byType: Record<SessionType, number> = {
      provider: 0,
      conversation: 0,
      autonomous: 0,
      workflow: 0,
    }
    const byState: Record<SessionState, number> = {
      creating: 0,
      active: 0,
      idle: 0,
      suspended: 0,
      recovering: 0,
      terminated: 0,
    }

    for (const session of this.sessions.values()) {
      byType[session.type]++
      byState[session.state]++
    }

    return {
      total: this.sessions.size,
      byType,
      byState,
    }
  }

  /** Cleanup all resources */
  async destroy(): Promise<void> {
    this.stopIdleScanner()

    // Terminate all active sessions
    const activeSessions = [...this.sessions.values()].filter((s) => s.state !== 'terminated')

    for (const session of activeSessions) {
      try {
        await this.terminateSession(session.sessionId, 'manager destroyed')
      } catch {
        // best-effort
      }
    }

    // Stop all heartbeat timers
    for (const sessionId of this.heartbeatTimers.keys()) {
      this.stopHeartbeat(sessionId)
    }

    this.persistence.destroy()
    this.sessions.clear()
    this.heartbeatTimers.clear()

    this.log.info('session lifecycle manager destroyed')
  }

  // ── Private ──────────────────────────────────────────────────────────────

  /** Persist session state (called on state transitions) */
  private async persistSession(session: SessionRecord): Promise<void> {
    this.persistence.save(session)
  }

  /** Start heartbeat timer for a session */
  private startHeartbeat(sessionId: string): void {
    // Don't start if already running
    if (this.heartbeatTimers.has(sessionId)) return

    const record = this.sessions.get(sessionId)
    if (!record) return

    const intervalMs =
      (record.stateData?.heartbeatIntervalMs as number) ?? this.options.defaultHeartbeatIntervalMs

    const timer = setInterval(() => {
      this.heartbeat(sessionId).catch((err) => {
        this.log.warn({ err, sessionId }, 'heartbeat tick failed')
      })
    }, intervalMs)

    // Allow process exit
    if (typeof timer === 'object' && 'unref' in timer) {
      ;(timer as unknown as { unref(): void }).unref()
    }

    this.heartbeatTimers.set(sessionId, timer)
  }

  /** Stop heartbeat timer */
  private stopHeartbeat(sessionId: string): void {
    const timer = this.heartbeatTimers.get(sessionId)
    if (timer) {
      clearInterval(timer)
      this.heartbeatTimers.delete(sessionId)
    }
  }

  /** Determine recovery strategy based on session state */
  private determineRecoveryStrategy(session: SessionRecord): RecoveryStrategy {
    const attempts = session.recoveryAttempts

    // First attempt: try reconnect
    if (attempts === 1) {
      return 'reconnect'
    }

    // Subsequent attempts: try recreate
    return 'recreate'
  }

  /** Scan for idle sessions and transition them */
  private async scanIdleSessions(): Promise<void> {
    const now = Date.now()

    for (const session of this.sessions.values()) {
      if (session.state === 'terminated') continue
      if (session.state === 'idle' || session.state === 'suspended') continue

      const idleTimeoutMs =
        (session.stateData?.idleTimeoutMs as number) ?? this.options.defaultIdleTimeoutMs
      const idleDuration = now - session.lastActiveAt

      if (idleDuration >= idleTimeoutMs) {
        const targetState: SessionState = idleDuration >= idleTimeoutMs * 1.5 ? 'suspended' : 'idle'

        try {
          await this.transitionState(session.sessionId, targetState)

          this.eventBus.emit({
            type: 'session:idle',
            sessionId: session.sessionId,
            idleDurationMs: idleDuration,
          } as unknown as Parameters<CapabilityEventBus['emit']>[0])

          this.log.info(
            { sessionId: session.sessionId, idleDurationMs: idleDuration, newState: targetState },
            'session became idle',
          )
        } catch (err) {
          this.log.warn({ err, sessionId: session.sessionId }, 'idle transition failed')
        }
      }
    }
  }

  /** Count non-terminated sessions (for concurrency check) */
  private countActiveSessions(): number {
    let count = 0
    for (const session of this.sessions.values()) {
      if (session.state !== 'terminated') count++
    }
    return count
  }
}
