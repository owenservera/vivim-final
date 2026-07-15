# Governor & Storage Layer — ChromeGovernor, MirrorEngine, DB Contracts

---
### schema/chrome.ts
---

`	ypescript
// src/schema/chrome.ts
// Chrome browser slave types — used by ChromeGovernor and LifecycleManager.

export type SlaveStatus = 'launching' | 'ready' | 'busy' | 'stale' | 'dead'

export type SuperState = 'active' | 'sleep' | 'error' | 'recovering'

export interface LaunchOptions {
  headless: boolean
  userDataDir: string
  args: string[]
  timeoutMs: number
  debugPort: number
}

export interface ChromeSlave {
  id: string
  providerId: string
  accountId: string
  status: SlaveStatus
  port: number
  profileDir: string
  pid: number | null
  launchOptions: LaunchOptions
}

export interface CDPCommand {
  method: string
  params: Record<string, unknown>
  sessionId?: string
}

export interface CDPResult {
  result?: Record<string, unknown>
  error?: { code: number; message: string }
}

`$([char]10)
---
### storage/contracts/governor-store.ts
---

`	ypescript
// src/storage/contracts/governor-store.ts
// GovernorStore — data access contract for ChromeGovernor.

// ── Row types ──────────────────────────────────────────────────────────────

export interface ProviderAccountRow {
  id: string
  providerId: string
  accountSlug: string
  displayName: string
  planTier: string
  apiKeyRef: string | null
  isActive: number
  profileDir: string | null
  debugPort: number | null
  createdAt: number
  updatedAt: number
}

export interface FleetEventRow {
  id: string
  slaveId: string
  providerId: string
  eventType: string
  detailJson: string | null
  ts: number
}

export interface CircuitBreakerStateRow {
  id: string
  slaveId: string
  state: string
  failureCount: number
  lastFailureAt: number | null
  lastSuccessAt: number | null
  openedAt: number | null
}

export interface HealthTickRow {
  id: string
  slaveId: string
  providerId: string
  status: string
  responseMs: number | null
  error: string | null
  ts: number
}

export interface TraceEntryRow {
  id: string
  slaveId: string
  conversationId: string | null
  method: string
  paramsJson: string | null
  resultJson: string | null
  durationMs: number | null
  error: string | null
  ts: number
}

// ── Input types ────────────────────────────────────────────────────────────

export interface FleetEventInput {
  slaveId: string
  providerId: string
  eventType: string
  detailJson?: string | null
  ts?: number
}

export interface TraceEntryInput {
  slaveId: string
  conversationId?: string | null
  method: string
  paramsJson?: string | null
  resultJson?: string | null
  durationMs?: number | null
  error?: string | null
}

// ── Contract ───────────────────────────────────────────────────────────────

export interface GovernorStore {
  getAccount(accountId: string): Promise<ProviderAccountRow | null>
  getAccountsByProvider(providerId: string): Promise<ProviderAccountRow[]>
  upsertAccount(account: ProviderAccountRow): Promise<void>
  deleteAccount(accountId: string): Promise<void>
  createFleetEvent(event: FleetEventInput): Promise<FleetEventRow>
  getFleetEvents(slaveId: string, limit?: number): Promise<FleetEventRow[]>
  getCircuitState(slaveId: string): Promise<CircuitBreakerStateRow | null>
  upsertCircuitState(state: CircuitBreakerStateRow): Promise<void>
  createHealthTick(tick: Omit<HealthTickRow, 'id'>): Promise<HealthTickRow>
  createTraceEntry(entry: TraceEntryInput): Promise<TraceEntryRow>
  getTrace(slaveId: string, limit?: number): Promise<TraceEntryRow[]>
}

`$([char]10)
---
### storage/contracts/fleet-supervisor.ts
---

`	ypescript
// src/storage/contracts/fleet-supervisor.ts
// FleetSupervisor contract — for dependency injection in unit tests.

export interface FleetSupervisor {
  spawn(
    providerSlug: string,
    accountId: string,
    opts?: Partial<{ extraArgs: string[]; debugPort?: number; visible?: boolean }>,
  ): Promise<{
    id: string
    providerSlug: string
    accountId: string
    debugPort: number
    profileDir: string
    status: 'starting' | 'running' | 'stopping' | 'stopped' | 'crashed' | 'error'
    pid: number | null
    consecutiveFailures: number
    lastHealthCheck: number
    createdAt: number
  }>
  kill(instanceId: string): Promise<void>
  killAll(): Promise<void>
  ensureRunning(instanceId: string): Promise<{
    id: string
    providerSlug: string
    accountId: string
    debugPort: number
    profileDir: string
    status: 'starting' | 'running' | 'stopping' | 'stopped' | 'crashed' | 'error'
    pid: number | null
    consecutiveFailures: number
    lastHealthCheck: number
    createdAt: number
  }>
  getInstance(instanceId: string): {
    id: string
    providerSlug: string
    accountId: string
    debugPort: number
    profileDir: string
    status: 'starting' | 'running' | 'stopping' | 'stopped' | 'crashed' | 'error'
    pid: number | null
    consecutiveFailures: number
    lastHealthCheck: number
    createdAt: number
  } | null
  getAllInstances(): {
    id: string
    providerSlug: string
    accountId: string
    debugPort: number
    profileDir: string
    status: 'starting' | 'running' | 'stopping' | 'stopped' | 'crashed' | 'error'
    pid: number | null
    consecutiveFailures: number
    lastHealthCheck: number
    createdAt: number
  }[]
  getInstancesByProvider(providerSlug: string): {
    id: string
    providerSlug: string
    accountId: string
    debugPort: number
    profileDir: string
    status: 'starting' | 'running' | 'stopping' | 'stopped' | 'crashed' | 'error'
    pid: number | null
    consecutiveFailures: number
    lastHealthCheck: number
    createdAt: number
  }[]
  healthCheck(instanceId: string): Promise<{
    ok: boolean
    latencyMs: number
    status: 'starting' | 'running' | 'stopping' | 'stopped' | 'crashed' | 'error'
    error?: string
  }>
  healthCheckAll(): Promise<
    Map<
      string,
      {
        ok: boolean
        latencyMs: number
        status: 'starting' | 'running' | 'stopping' | 'stopped' | 'crashed' | 'error'
        error?: string
      }
    >
  >
  getCircuitState(instanceId: string): 'closed' | 'half_open' | 'open'
  startHealthProbe(intervalMs?: number): void
  stopHealthProbe(): void
}

`$([char]10)
---
### storage/impl/governor-store-impl.ts
---

`	ypescript
// src/storage/impl/governor-store-impl.ts
// GovernorStoreImpl — Prisma-backed GovernorStore (04-merged-engines.md §1).
// Bridges the contract row types to the actual Prisma column names.

import { newId } from '../../ids.js'
import type {
  CircuitBreakerStateRow,
  FleetEventInput,
  FleetEventRow,
  GovernorStore,
  HealthTickRow,
  ProviderAccountRow,
  TraceEntryInput,
  TraceEntryRow,
} from '../contracts/governor-store.js'
import type { CapStoreDb } from '../db.js'

// ── Prisma row shapes (subset used) ─────────────────────────────────────────

interface PrismaAccount {
  id: string
  providerId: string
  email: string
  planTier: string
  profileDir: string | null
  debugPort: number | null
  createdAt: number
  updatedAt: number
}

interface PrismaFleetEvent {
  id: string
  slaveId: string
  providerId: string | null
  eventType: string
  eventDataJson: string
  ts: number
}

interface PrismaCircuit {
  id: string
  slaveId: string
  state: string
  failCount: number
  lastFailAt: number | null
  lastSuccessAt: number | null
  openedAt: number | null
}

interface PrismaHealthTick {
  id: string
  slaveId: string | null
  providerId: string
  status: string
  responseMs: number | null
  error: string | null
  ts: number
}

interface PrismaTrace {
  id: string
  slaveId: string | null
  conversationId: string | null
  method: string
  cdpParamsJson: string | null
  cdpResultJson: string | null
  durationMs: number | null
  error: string | null
  ts: number
}

// ── Mappers ──────────────────────────────────────────────────────────────

function toAccountRow(r: PrismaAccount): ProviderAccountRow {
  return {
    id: r.id,
    providerId: r.providerId,
    accountSlug: r.email,
    displayName: r.email,
    planTier: r.planTier,
    apiKeyRef: null,
    isActive: 1,
    profileDir: r.profileDir ?? null,
    debugPort: r.debugPort ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

function toFleetRow(r: PrismaFleetEvent): FleetEventRow {
  return {
    id: r.id,
    slaveId: r.slaveId,
    providerId: r.providerId ?? '',
    eventType: r.eventType,
    detailJson: r.eventDataJson,
    ts: r.ts,
  }
}

function toCircuitRow(r: PrismaCircuit): CircuitBreakerStateRow {
  return {
    id: r.id,
    slaveId: r.slaveId,
    state: r.state,
    failureCount: r.failCount,
    lastFailureAt: r.lastFailAt,
    lastSuccessAt: r.lastSuccessAt,
    openedAt: r.openedAt,
  }
}

function toHealthTickRow(r: PrismaHealthTick): HealthTickRow {
  return {
    id: r.id,
    slaveId: r.slaveId ?? '',
    providerId: r.providerId,
    status: r.status,
    responseMs: r.responseMs,
    error: r.error,
    ts: r.ts,
  }
}

function toTraceRow(r: PrismaTrace): TraceEntryRow {
  return {
    id: r.id,
    slaveId: r.slaveId ?? '',
    conversationId: r.conversationId,
    method: r.method,
    paramsJson: r.cdpParamsJson,
    resultJson: r.cdpResultJson,
    durationMs: r.durationMs,
    error: r.error,
    ts: r.ts,
  }
}

// ── GovernorStoreImpl ──────────────────────────────────────────────────────

export class GovernorStoreImpl implements GovernorStore {
  constructor(private db: CapStoreDb) {}

  async getAccount(accountId: string): Promise<ProviderAccountRow | null> {
    const row = await this.db.prisma.providerAccount.findUnique({ where: { id: accountId } })
    return row ? toAccountRow(row as unknown as PrismaAccount) : null
  }

  async getAccountsByProvider(providerId: string): Promise<ProviderAccountRow[]> {
    const rows = await this.db.prisma.providerAccount.findMany({ where: { providerId } })
    return rows.map((r) => toAccountRow(r as unknown as PrismaAccount))
  }

  async upsertAccount(account: ProviderAccountRow): Promise<void> {
    const now = Date.now()
    await this.db.prisma.providerAccount.upsert({
      where: { id: account.id },
      create: {
        id: account.id,
        providerId: account.providerId,
        email: account.accountSlug,
        planTier: account.planTier,
        providerStateJson: '{}',
        createdAt: account.createdAt || now,
        updatedAt: now,
      },
      update: {
        email: account.accountSlug,
        planTier: account.planTier,
        updatedAt: now,
      },
    })
  }

  async deleteAccount(accountId: string): Promise<void> {
    await this.db.prisma.providerAccount.delete({ where: { id: accountId } })
  }

  async createFleetEvent(event: FleetEventInput): Promise<FleetEventRow> {
    const row = await this.db.prisma.fleetEvent.create({
      data: {
        id: newId(),
        slaveId: event.slaveId,
        providerId: event.providerId,
        eventType: event.eventType,
        eventDataJson: event.detailJson ?? '{}',
        ts: event.ts ?? Date.now(),
      },
    })
    return toFleetRow(row as unknown as PrismaFleetEvent)
  }

  async getFleetEvents(slaveId: string, limit?: number): Promise<FleetEventRow[]> {
    const rows = await this.db.prisma.fleetEvent.findMany({
      where: { slaveId },
      orderBy: [{ ts: 'desc' }, { id: 'desc' }],
      take: limit ?? 100,
    })
    return rows.map((r) => toFleetRow(r as unknown as PrismaFleetEvent))
  }

  async getCircuitState(slaveId: string): Promise<CircuitBreakerStateRow | null> {
    const row = await this.db.prisma.circuitBreakerState.findUnique({ where: { slaveId } })
    return row ? toCircuitRow(row as unknown as PrismaCircuit) : null
  }

  async upsertCircuitState(state: CircuitBreakerStateRow): Promise<void> {
    const now = Date.now()
    await this.db.prisma.circuitBreakerState.upsert({
      where: { slaveId: state.slaveId },
      create: {
        id: state.id,
        slaveId: state.slaveId,
        state: state.state,
        failCount: state.failureCount,
        lastFailAt: state.lastFailureAt,
        lastSuccessAt: state.lastSuccessAt,
        openedAt: state.openedAt,
        createdAt: now,
        updatedAt: now,
      },
      update: {
        state: state.state,
        failCount: state.failureCount,
        lastFailAt: state.lastFailureAt,
        lastSuccessAt: state.lastSuccessAt,
        openedAt: state.openedAt,
        updatedAt: now,
      },
    })
  }

  async createHealthTick(tick: Omit<HealthTickRow, 'id'>): Promise<HealthTickRow> {
    const row = await this.db.prisma.healthTick.create({
      data: {
        id: newId(),
        providerId: tick.providerId,
        slaveId: tick.slaveId,
        status: tick.status,
        responseMs: tick.responseMs,
        error: tick.error,
        ts: tick.ts,
      },
    })
    return toHealthTickRow(row as unknown as PrismaHealthTick)
  }

  async createTraceEntry(entry: TraceEntryInput): Promise<TraceEntryRow> {
    const row = await this.db.prisma.traceEntry.create({
      data: {
        id: newId(),
        engine: 'governor',
        method: entry.method,
        conversationId: entry.conversationId ?? null,
        slaveId: entry.slaveId ?? null,
        cdpParamsJson: entry.paramsJson ?? null,
        cdpResultJson: entry.resultJson ?? null,
        durationMs: entry.durationMs ?? 0,
        ok: entry.error ? 0 : 1,
        error: entry.error ?? null,
        ts: Date.now(),
      },
    })
    return toTraceRow(row as unknown as PrismaTrace)
  }

  async getTrace(slaveId: string, limit?: number): Promise<TraceEntryRow[]> {
    const rows = await this.db.prisma.traceEntry.findMany({
      where: slaveId === '*' ? {} : { slaveId },
      orderBy: [{ ts: 'desc' }, { id: 'desc' }],
      take: limit ?? 100,
    })
    return rows.map((r) => toTraceRow(r as unknown as PrismaTrace))
  }
}

`$([char]10)
---
### storage/db.ts
---

`	ypescript
// src/storage/db.ts
// Typed wrapper over PrismaClient.
// The CapStoreDb class provides typed access to all tables
// using Prisma ORM with the same public API shape.

import { newId } from '../ids.js'
import { config } from '../config.js'
import { type PrismaClient, closePrisma, getPrisma } from './prisma.js'

export class CapStoreDb {
  public readonly prisma: PrismaClient

  constructor(_path?: string) {
    // _path kept for backward compat but ignored — Prisma uses DATABASE_URL
    this.prisma = getPrisma()
  }

  async close(): Promise<void> {
    await closePrisma()
  }

  // ── Migration helper ───────────────────────────────────────────────────

  async applyMigration(filename: string, sql: string): Promise<void> {
    const checksum = await Bun.CryptoHasher.hash('sha256', sql, 'hex')
    await this.prisma.$executeRawUnsafe(sql)
    await this.prisma.migrationLog.create({
      data: {
        id: newId(),
        filename,
        checksum,
        appliedAt: Date.now(),
      },
    })
  }

  async hasMigration(filename: string): Promise<boolean> {
    const row = await this.prisma.migrationLog.findFirst({
      where: { filename },
      select: { id: true },
    })
    return row !== null
  }

  // ── L1: Provider CRUD ──────────────────────────────────────────────────

  async getProvider(id: string) {
    return this.prisma.providerDefinition.findUnique({ where: { id } })
  }

  async getProviderBySlug(slug: string) {
    return this.prisma.providerDefinition.findUnique({ where: { slug } })
  }

  async listProviders(opts?: { isActive?: boolean }) {
    return this.prisma.providerDefinition.findMany({
      where: opts?.isActive !== undefined ? { isActive: opts.isActive ? 1 : 0 } : undefined,
      orderBy: { displayName: 'asc' },
    })
  }

  async upsertProvider(def: {
    id: string
    slug: string
    displayName: string
    description?: string | null
    category?: string
    providerType?: string
    isActive?: number
    websiteUrl?: string | null
    documentationUrl?: string | null
    authType?: string
    hasMultiAccount?: number
    profileStrategy?: string
    fleetConfigJson?: string
    capabilitiesJson?: string
    modelsJson?: string
    createdAt?: number
  }) {
    const now = Date.now()
    return this.prisma.providerDefinition.upsert({
      where: { id: def.id },
      create: {
        id: def.id,
        slug: def.slug,
        displayName: def.displayName,
        description: def.description ?? null,
        category: def.category ?? 'ai',
        providerType: def.providerType ?? 'llm',
        isActive: def.isActive ?? 1,
        websiteUrl: def.websiteUrl ?? null,
        documentationUrl: def.documentationUrl ?? null,
        authType: def.authType ?? 'browser',
        hasMultiAccount: def.hasMultiAccount ?? 0,
        profileStrategy: def.profileStrategy ?? 'per_account',
        fleetConfigJson: def.fleetConfigJson ?? '{}',
        capabilitiesJson: def.capabilitiesJson ?? '{}',
        modelsJson: def.modelsJson ?? '[]',
        createdAt: def.createdAt ?? now,
        updatedAt: now,
      },
      update: {
        slug: def.slug,
        displayName: def.displayName,
        description: def.description ?? null,
        category: def.category ?? 'ai',
        providerType: def.providerType ?? 'llm',
        isActive: def.isActive ?? 1,
        websiteUrl: def.websiteUrl ?? null,
        documentationUrl: def.documentationUrl ?? null,
        authType: def.authType ?? 'browser',
        hasMultiAccount: def.hasMultiAccount ?? 0,
        profileStrategy: def.profileStrategy ?? 'per_account',
        fleetConfigJson: def.fleetConfigJson ?? '{}',
        capabilitiesJson: def.capabilitiesJson ?? '{}',
        modelsJson: def.modelsJson ?? '[]',
        updatedAt: now,
      },
    })
  }

  // Account
  async getAccount(id: string) {
    return this.prisma.providerAccount.findUnique({ where: { id } })
  }

  async getAccountsByProvider(providerId: string) {
    return this.prisma.providerAccount.findMany({
      where: { providerId },
      orderBy: { isDefault: 'desc' },
    })
  }

  async upsertAccount(account: {
    id: string
    providerId: string
    email: string
    planTier?: string
    isDefault?: number
    isKind?: number
    loginState?: string
    loginAttempts?: number
    lastLoginAt?: number | null
    providerStateJson?: string
    debugPort?: number | null
    profileDir?: string | null
    chromeSlaveId?: string | null
    createdAt?: number
  }) {
    const now = Date.now()
    return this.prisma.providerAccount.upsert({
      where: { id: account.id },
      create: {
        id: account.id,
        providerId: account.providerId,
        email: account.email,
        planTier: account.planTier ?? 'free',
        isDefault: account.isDefault ?? 0,
        isKind: account.isKind ?? 0,
        loginState: account.loginState ?? 'unknown',
        loginAttempts: account.loginAttempts ?? 0,
        lastLoginAt: account.lastLoginAt ?? null,
        providerStateJson: account.providerStateJson ?? '{}',
        debugPort: account.debugPort ?? null,
        profileDir: account.profileDir ?? null,
        chromeSlaveId: account.chromeSlaveId ?? null,
        createdAt: account.createdAt ?? now,
        updatedAt: now,
      },
      update: {
        email: account.email,
        planTier: account.planTier ?? 'free',
        loginState: account.loginState ?? 'unknown',
        debugPort: account.debugPort ?? null,
        chromeSlaveId: account.chromeSlaveId ?? null,
        updatedAt: now,
      },
    })
  }

  // ── L3: Capability CRUD ────────────────────────────────────────────────

  async getCapability(id: string) {
    return this.prisma.capabilityTaxonomy.findUnique({ where: { id } })
  }

  async getCapabilityBySlug(slug: string) {
    return this.prisma.capabilityTaxonomy.findUnique({ where: { slug } })
  }

  async getBinding(globalId: string, providerId: string) {
    return this.prisma.capabilityBinding.findUnique({
      where: { globalId_providerId: { globalId, providerId } },
    })
  }

  async getSelectors(capabilityId: string, providerId: string) {
    return this.prisma.selectorStrategy.findMany({
      where: { capabilityId, providerId, isActive: 1 },
      orderBy: { priority: 'asc' },
    })
  }

  // ── L4: Conversation CRUD ──────────────────────────────────────────────

  async listConversations(opts: { limit?: number }) {
    return this.prisma.conversation.findMany({
      take: opts.limit ?? 50,
      orderBy: { createdAt: 'desc' },
    })
  }

  async getConversation(id: string) {
    return this.prisma.conversation.findUnique({ where: { id } })
  }

  async createConversation(input: {
    id: string
    providerSessionId: string
    providerId: string
    title?: string
  }) {
    const now = Date.now()
    return this.prisma.conversation.create({
      data: {
        id: input.id,
        providerSessionId: input.providerSessionId,
        providerId: input.providerId,
        title: input.title ?? null,
        state: 'active',
        contextJson: '{}',
        createdAt: now,
        updatedAt: now,
      },
    })
  }

  async createMessage(input: {
    id: string
    conversationId: string
    role: string
    content: string
    blocksJson?: string
    latencyMs?: number
    metadata?: Record<string, unknown>
  }) {
    const now = Date.now()
    return this.prisma.conversationMessage.create({
      data: {
        id: input.id,
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
        blocksJson: input.blocksJson ?? '[]',
        blockCount: 0,
        sequenceIndex: 0,
        latencyMs: input.latencyMs ?? null,
        metadataJson: JSON.stringify(input.metadata ?? {}),
        createdAt: now,
      },
    })
  }

  async getMessages(conversationId: string, opts?: { limit?: number; before?: string }) {
    return this.prisma.conversationMessage.findMany({
      where: {
        conversationId,
        ...(opts?.before ? { id: { lt: opts.before } } : {}),
      },
      orderBy: { sequenceIndex: 'asc' },
      take: opts?.limit ?? 100,
    })
  }

  // ── L3: Outcome recording ──────────────────────────────────────────────

  async createOutcome(input: {
    id: string
    capabilityId: string
    providerId: string
    ok: number
    error?: string
    durationMs?: number
    selectorStrategyId?: string
    selectorUsed?: string
    selectorHit?: number
  }) {
    return this.prisma.outcome.create({
      data: {
        id: input.id,
        capabilityId: input.capabilityId,
        providerId: input.providerId,
        ok: input.ok,
        error: input.error ?? null,
        durationMs: input.durationMs ?? null,
        selectorStrategyId: input.selectorStrategyId ?? null,
        selectorUsed: input.selectorUsed ?? null,
        selectorHit: input.selectorHit ?? null,
        ts: Date.now(),
      },
    })
  }

  // ── L2: Trace ──────────────────────────────────────────────────────────

  async createTraceEntry(input: {
    id: string
    engine: string
    method: string
    conversationId?: string
    providerId?: string
    slaveId?: string
    cdpMethod?: string
    cdpParams?: Record<string, unknown>
    cdpResult?: unknown
    durationMs: number
    ok: boolean
    error?: string
  }) {
    return this.prisma.traceEntry.create({
      data: {
        id: input.id,
        engine: input.engine,
        method: input.method,
        conversationId: input.conversationId ?? null,
        providerId: input.providerId ?? null,
        slaveId: input.slaveId ?? null,
        cdpMethod: input.cdpMethod ?? null,
        cdpParamsJson: input.cdpParams ? JSON.stringify(input.cdpParams) : null,
        cdpResultJson: input.cdpResult ? JSON.stringify(input.cdpResult) : null,
        durationMs: input.durationMs,
        ok: input.ok ? 1 : 0,
        error: input.error ?? null,
        ts: Date.now(),
      },
    })
  }

  // ── L8: Config ─────────────────────────────────────────────────────────

  async getConfig(engineId: string) {
    return this.prisma.configEntry.findMany({
      where: { engineId },
    })
  }

  async getConfigValue(engineId: string, _key: string) {
    // ConfigEntry doesn't have a config_key field — it uses engineId + scopeType + scopeId
    // This method is kept for backward compat but may need adjustment
    const entry = await this.prisma.configEntry.findFirst({
      where: { engineId },
    })
    return entry?.configJson ?? null
  }

  async setConfig(engineId: string, json: string) {
    const existing = await this.prisma.configEntry.findFirst({
      where: { engineId },
    })
    const now = Date.now()
    if (existing) {
      return this.prisma.configEntry.update({
        where: { id: existing.id },
        data: { configJson: json, updatedAt: now },
      })
    }
    return this.prisma.configEntry.create({
      data: {
        id: newId(),
        engineId,
        scopeType: 'engine',
        scopeId: null,
        configJson: json,
        createdAt: now,
        updatedAt: now,
      },
    })
  }

  // ── Setup: Workspace + Profile ──────────────────────────────────────────

  async getWorkspaceHint(): Promise<string | null> {
    const { SlaveSetupStoreImpl } = await import('../storage/impl/slave-setup-store-impl.js')
    const store = new SlaveSetupStoreImpl(this)
    return store.getWorkspaceHint()
  }

  async setWorkspaceHint(path: string): Promise<void> {
    const { SlaveSetupStoreImpl } = await import('../storage/impl/slave-setup-store-impl.js')
    const store = new SlaveSetupStoreImpl(this)
    return store.setWorkspaceHint(path)
  }

  async listAccounts(): Promise<
    Array<{
      providerId: string
      accountSlug: string
      loginState: string
      profileDir: string | null
      debugPort: number | null
    }>
  > {
    const { SlaveSetupStoreImpl } = await import('../storage/impl/slave-setup-store-impl.js')
    const store = new SlaveSetupStoreImpl(this)
    return store.listAccounts()
  }
}

// Singleton instance
let _db: CapStoreDb | null = null

export function getDb(): CapStoreDb {
  if (!_db) {
    _db = new CapStoreDb()
  }
  return _db
}

export function setDb(db: CapStoreDb): void {
  _db = db
}

// ── SQLite pragma tuning (WAL mode) ───────────────────────────────────────

export interface DbPragmaPolicy {
  journalMode: 'DELETE' | 'WAL' | 'TRUNCATE' | 'MEMORY'
  synchronous: 'OFF' | 'NORMAL' | 'FULL' | 'EXTRA'
  cacheSize: number
  tempStore: 'DEFAULT' | 'FILE' | 'MEMORY'
  mmapSize: number
  busyTimeoutMs: number
  walAutocheckpoint: number
  foreignKeys: boolean
}

const DEFAULT_PRAGMAS: DbPragmaPolicy = {
  journalMode: 'WAL',
  synchronous: 'NORMAL',
  cacheSize: -64000,
  tempStore: 'MEMORY',
  mmapSize: 268435456,
  busyTimeoutMs: 5000,
  walAutocheckpoint: 1000,
  foreignKeys: true,
}

export async function configurePrisma(
  db: CapStoreDb,
  policy?: Partial<DbPragmaPolicy>,
): Promise<void> {
  // DISC-2: a whole-file-encrypted SQLite database (Unit 36.1, config.storage.encryptDb)
  // cannot run in WAL mode — WAL keeps a separate -wal/-shm sidecar that the envelope
  // encryption layer does not manage. Fall back to the default rollback journal so the
  // encrypted DB still supports safe concurrent access + crash recovery.
  const encryptDb = config.storage.encryptDb
  const effectiveJournal = encryptDb
    ? 'DELETE'
    : (policy?.journalMode ?? DEFAULT_PRAGMAS.journalMode)
  const pragmas = { ...DEFAULT_PRAGMAS, ...policy, journalMode: effectiveJournal }

  // PRAGMA name=value statements return a row in SQLite, so $executeRawUnsafe
  // (which forbids returning results) throws. Use $queryRawUnsafe for all of them.
  //
  // journal_mode is the ONLY critical pragma: the runtime-OS supervisor (2.1)
  // cannot hot-restart the backend unless WAL is correctly engaged. Throw on fail.
  try {
    await db.prisma.$queryRawUnsafe(`PRAGMA journal_mode = ${pragmas.journalMode}`)
  } catch (err) {
    throw new Error(
      `[db] CRITICAL: failed to set journal_mode=${pragmas.journalMode}: ${String(err)}`,
    )
  }

  // All other pragmas are non-fatal: log a warning and continue so the backend
  // still boots on exotic SQLite builds / drivers.
  const nonFatal: Array<{ name: string; sql: string }> = [
    { name: 'synchronous', sql: `PRAGMA synchronous = ${pragmas.synchronous}` },
    { name: 'cache_size', sql: `PRAGMA cache_size = ${pragmas.cacheSize}` },
    { name: 'temp_store', sql: `PRAGMA temp_store = ${pragmas.tempStore}` },
    { name: 'mmap_size', sql: `PRAGMA mmap_size = ${pragmas.mmapSize}` },
    { name: 'busy_timeout', sql: `PRAGMA busy_timeout = ${pragmas.busyTimeoutMs}` },
  ]
  if (!encryptDb) {
    // wal_autocheckpoint only applies in WAL mode.
    nonFatal.push({
      name: 'wal_autocheckpoint',
      sql: `PRAGMA wal_autocheckpoint = ${pragmas.walAutocheckpoint}`,
    })
  }
  nonFatal.push({
    name: 'foreign_keys',
    sql: `PRAGMA foreign_keys = ${pragmas.foreignKeys ? 'ON' : 'OFF'}`,
  })

  for (const { name, sql } of nonFatal) {
    try {
      await db.prisma.$queryRawUnsafe(sql)
    } catch (err) {
      console.warn(`[db] pragma ${name} not applied (non-fatal): ${String(err)}`)
    }
  }

  const journalMode =
    await db.prisma.$queryRawUnsafe<{ journal_mode: string }[]>('PRAGMA journal_mode')
  console.log(
    `[db] pragmas configured — journal_mode=${journalMode[0]?.journal_mode}${encryptDb ? ' (encryptDb: WAL disabled)' : ''}`,
  )
}

export async function closeDb(): Promise<void> {
  if (_db) {
    await _db.close()
    _db = null
  }
}

`$([char]10)
---
### engines/chrome-governor.ts
---

`	ypescript
// src/engines/chrome-governor.ts
// ChromeGovernor — single I/O authority for all Chrome interaction.
// Manages ChromeSlave lifecycle, CDP proxy, trace logging, and health monitoring.

import { join } from 'node:path'
import { EngineError } from '../errors.js'
import { FleetSupervisor } from '../executor/fleet-supervisor.js'
import type { FleetSupervisor as FleetSupervisorContract } from '../storage/contracts/fleet-supervisor.js'
import type {
  GovernorStore,
  TraceEntryInput,
  TraceEntryRow,
} from '../storage/contracts/governor-store.js'
import { submitMessage, typeMessage } from './composer-typing.js'

// ── Types ──────────────────────────────────────────────────────────────────

export type SlaveStatus = 'starting' | 'running' | 'stopping' | 'stopped' | 'error' | 'crashed'
export type SuperState = 'idle' | 'sending' | 'capturing' | 'parsing' | 'authenticating' | 'error'
export type CircuitState = 'closed' | 'half_open' | 'open'

export interface FleetConfig {
  chromePath?: string
  profileBaseDir?: string
  portRange: [number, number]
  healthProbeIntervalMs: number
  healthProbeTimeoutMs: number
  autoRestart: boolean
  maxRestarts: number
  circuitBreakerThreshold: number
  circuitBreakerResetMs: number
}

export interface LaunchOptions {
  visible?: boolean
  profileDir?: string
  debugPort?: number
  extraArgs?: string[]
}

export interface ChromeSlave {
  slaveId: string
  providerId: string
  accountId: string
  debugPort: number
  profileDir: string
  status: SlaveStatus
  superState: SuperState
  pid: number | null
  consecutiveFailures: number
  circuitState: CircuitState
  lastHealthCheck: number
}

export interface CaptureResult {
  body: string
  url?: string
  headers?: Record<string, string>
  status?: number
  durationMs?: number
  capturedAt?: number
}

export interface PageState {
  url: string
  title: string
  readyState: string
}

export interface HarnessResult {
  success: boolean
  stepsCompleted: number
  error?: string
}

export interface HarnessDAG {
  nodes: HarnessNode[]
  edges: HarnessEdge[]
}

export interface HarnessNode {
  type: 'action' | 'sequence' | 'branch' | 'parallel' | 'retry' | 'precondition' | 'step'
  action?: string
  selector?: string
  params?: Record<string, unknown>
  moduleId?: string
  input?: Record<string, unknown>
  outputKey?: string
}

export interface HarnessEdge {
  from: number
  to: number
}

export interface SlaveHealth {
  slaveId: string
  status: SlaveStatus
  circuitState: CircuitState
  consecutiveFailures: number
  lastHealthCheck: number
  uptimeMs: number
}

// ── Event bus ──────────────────────────────────────────────────────────────

export interface GovernorEventBus {
  emit(event: string, data: unknown): void
}

// ── Async mutex (simplified) ──────────────────────────────────────────────

export class AsyncMutex {
  private locked = false
  private queue: Array<() => void> = []

  async acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true
      return
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve)
    })
  }

  release(): void {
    const next = this.queue.shift()
    if (next) {
      next()
    } else {
      this.locked = false
    }
  }
}

// ── CDP Transport (injected dependency) ────────────────────────────────────

export interface CDPTransport {
  send(slaveId: string, method: string, params?: Record<string, unknown>): Promise<unknown>
  capture(slaveId: string, pattern: RegExp, timeoutMs?: number): Promise<CaptureResult>
  // captureStream is optional on the transport contract — the governor itself
  // never invokes it (streaming is driven via StreamingProtocol). Only the real
  // CdpTransportImpl provides it; tests/mocks may omit it.
  captureStream?(
    slaveId: string,
    pattern: RegExp,
    timeoutMs?: number,
  ): Promise<{ body: string; chunks: string[] }>
  getPageState(slaveId: string): Promise<PageState>
  captureScreenshot(slaveId: string, format?: 'png' | 'jpeg'): Promise<string>
}

// ── CDP Proxy (3.3) ───────────────────────────────────────────────────────

export class CDPProxy {
  constructor(
    private slaves: Map<string, ChromeSlave>,
    private mutexes: Map<string, AsyncMutex>,
    private transport?: CDPTransport,
    private eventBus?: GovernorEventBus,
  ) {}

  async send(slaveId: string, method: string, params?: Record<string, unknown>): Promise<unknown> {
    const slave = this.slaves.get(slaveId)
    if (!slave) throw new EngineError(`Slave not found: ${slaveId}`)
    if (slave.circuitState === 'open')
      throw new EngineError(`Circuit breaker open for slave: ${slaveId}`)

    const mutex = this.getMutex(slaveId)
    await mutex.acquire()
    try {
      const start = Date.now()
      const result = await this.transport?.send(slaveId, method, params)
      this.eventBus?.emit('cdp:executed', {
        slaveId,
        method,
        durationMs: Date.now() - start,
      })
      return result
    } finally {
      mutex.release()
    }
  }

  async capture(slaveId: string, pattern: RegExp, timeoutMs?: number): Promise<CaptureResult> {
    const slave = this.slaves.get(slaveId)
    if (!slave) throw new EngineError(`Slave not found: ${slaveId}`)

    const mutex = this.getMutex(slaveId)
    await mutex.acquire()
    try {
      const result = await this.transport?.capture(slaveId, pattern, timeoutMs)
      if (!result) throw new EngineError('CDP transport not configured')
      return result
    } finally {
      mutex.release()
    }
  }

  async executeHarnessPlan(slaveId: string, dag: HarnessDAG): Promise<HarnessResult> {
    const slave = this.slaves.get(slaveId)
    if (!slave) throw new EngineError(`Slave not found: ${slaveId}`)
    if (slave.circuitState === 'open')
      throw new EngineError(`Circuit breaker open for slave: ${slaveId}`)
    if (!this.transport) throw new EngineError('CDP transport not configured')

    const mutex = this.getMutex(slaveId)
    await mutex.acquire()
    try {
      // Topological walk over node edges; fall back to declaration order.
      const order = this.orderNodes(dag)
      let stepsCompleted = 0

      for (const idx of order) {
        const node = dag.nodes[idx]
        if (!node) continue

        const action = node.action ?? node.moduleId ?? node.type
        const params = { ...(node.params ?? {}), ...(node.input ?? {}) }

        switch (action) {
          case 'type_text': {
            const selector = typeof params.selector === 'string' ? params.selector : 'textarea'
            const text = typeof params.text === 'string' ? params.text : ''
            const composerType = (
              typeof params.composerType === 'string' ? params.composerType : 'textarea'
            ) as 'textarea' | 'contenteditable' | 'quill' | 'codemirror'
            await typeMessage(this.transport, slaveId, selector, text, composerType)
            stepsCompleted++
            break
          }
          case 'submit': {
            const sendSelector =
              typeof params.sendSelector === 'string' ? params.sendSelector : undefined
            const key = typeof params.key === 'string' ? params.key : 'Enter'
            await submitMessage(this.transport, slaveId, sendSelector, key)
            stepsCompleted++
            break
          }
          default:
            // Unknown action — skip but count as attempted
            stepsCompleted++
        }

        this.eventBus?.emit('harness:step', { slaveId, action, step: stepsCompleted })
      }

      return { success: true, stepsCompleted }
    } catch (err) {
      return {
        success: false,
        stepsCompleted: 0,
        error: err instanceof Error ? err.message : String(err),
      }
    } finally {
      mutex.release()
    }
  }

  /** Returns node indices in dependency order (edges) or declaration order. */
  private orderNodes(dag: HarnessDAG): number[] {
    if (!dag.edges.length) return dag.nodes.map((_, i) => i)
    const indeg = new Array(dag.nodes.length).fill(0)
    const adj = new Map<number, number[]>()
    for (const e of dag.edges) {
      indeg[e.to] = (indeg[e.to] ?? 0) + 1
      const list = adj.get(e.from) ?? []
      list.push(e.to)
      adj.set(e.from, list)
    }
    const queue: number[] = []
    for (let i = 0; i < indeg.length; i++) if (indeg[i] === 0) queue.push(i)
    const out: number[] = []
    while (queue.length) {
      const n = queue.shift()!
      out.push(n)
      for (const m of adj.get(n) ?? []) {
        indeg[m]--
        if (indeg[m] === 0) queue.push(m)
      }
    }
    return out.length === dag.nodes.length ? out : dag.nodes.map((_, i) => i)
  }

  async getPageState(slaveId: string): Promise<PageState> {
    const slave = this.slaves.get(slaveId)
    if (!slave) throw new EngineError(`Slave not found: ${slaveId}`)
    if (!this.transport) return { url: '', title: '', readyState: 'unavailable' }
    return this.transport.getPageState(slaveId)
  }

  async captureScreenshot(slaveId: string, format?: 'png' | 'jpeg'): Promise<string> {
    const slave = this.slaves.get(slaveId)
    if (!slave) throw new EngineError(`Slave not found: ${slaveId}`)
    if (!this.transport) throw new EngineError('CDP transport not configured')
    return this.transport.captureScreenshot(slaveId, format)
  }

  private getMutex(slaveId: string): AsyncMutex {
    let mutex = this.mutexes.get(slaveId)
    if (!mutex) {
      mutex = new AsyncMutex()
      this.mutexes.set(slaveId, mutex)
    }
    return mutex
  }
}

// ── TraceLog (3.4) ───────────────────────────────────────────────────────

export class TraceLog {
  constructor(private store: GovernorStore) {}

  async record(entry: TraceEntryInput): Promise<TraceEntryRow> {
    return this.store.createTraceEntry(entry)
  }

  async getTrace(slaveId: string, limit?: number): Promise<TraceEntryRow[]> {
    return this.store.getTrace(slaveId, limit)
  }

  async getConversationTrace(conversationId: string): Promise<TraceEntryRow[]> {
    // Store only supports getTrace by slaveId; scan is acceptable for v1
    // Full implementation would add a conversationId index in Phase 6
    const all = await this.store.getTrace('*', 1000)
    return all.filter((e) => e.conversationId === conversationId)
  }
}

// ── CircuitBreaker (3.4) ────────────────────────────────────────────────

export interface CircuitBreaker {
  state: CircuitState
  failureCount: number
  lastFailureAt: number | null
  lastSuccessAt: number | null
  openedAt: number | null
}

export function createCircuitBreaker(): CircuitBreaker {
  return {
    state: 'closed',
    failureCount: 0,
    lastFailureAt: null,
    lastSuccessAt: null,
    openedAt: null,
  }
}

export function circuitRecordSuccess(cb: CircuitBreaker, threshold: number, resetMs: number): void {
  const now = Date.now()
  cb.lastSuccessAt = now
  cb.failureCount = 0
  if (cb.state === 'half_open') {
    cb.state = 'closed'
    cb.openedAt = null
  }
  void threshold
  void resetMs
}

export function circuitRecordFailure(
  cb: CircuitBreaker,
  threshold: number,
  _resetMs: number,
): CircuitState {
  const now = Date.now()
  cb.failureCount++
  cb.lastFailureAt = now

  if (cb.state === 'half_open') {
    cb.state = 'open'
    cb.openedAt = now
    return 'open'
  }

  if (cb.failureCount >= threshold) {
    cb.state = 'open'
    cb.openedAt = now
    return 'open'
  }

  return cb.state
}

export function circuitTryAcquire(cb: CircuitBreaker, resetMs: number): boolean {
  if (cb.state === 'closed') return true
  if (cb.state === 'half_open') return true
  // open → check if reset window has elapsed
  if (cb.openedAt && Date.now() - cb.openedAt >= resetMs) {
    cb.state = 'half_open'
    return true
  }
  return false
}

// ── HealthMonitor (3.4) ─────────────────────────────────────────────────

export class HealthMonitor {
  private timerHandle: ReturnType<typeof setInterval> | null = null

  constructor(
    private store: GovernorStore,
    private slaves: Map<string, ChromeSlave>,
    private circuitBreakers: Map<string, CircuitBreaker>,
    private cdpProxy: CDPProxy,
    private config: FleetConfig,
    private eventBus?: GovernorEventBus,
  ) {}

  start(intervalMs?: number): void {
    this.stop()
    const interval = intervalMs ?? this.config.healthProbeIntervalMs
    this.timerHandle = setInterval(() => {
      void this.probeAll()
    }, interval)
  }

  stop(): void {
    if (this.timerHandle !== null) {
      clearInterval(this.timerHandle)
      this.timerHandle = null
    }
  }

  async probe(slaveId: string): Promise<boolean> {
    const slave = this.slaves.get(slaveId)
    if (!slave) return false

    try {
      await this.cdpProxy.send(slaveId, 'Browser.getVersion')
      const prevStatus = slave.status
      slave.status = 'running'
      slave.lastHealthCheck = Date.now()
      slave.consecutiveFailures = 0

      const cb = this.getOrCreateCircuit(slaveId)
      circuitRecordSuccess(
        cb,
        this.config.circuitBreakerThreshold,
        this.config.circuitBreakerResetMs,
      )
      await this.store.upsertCircuitState({
        id: `cb_${slaveId}`,
        slaveId,
        state: cb.state,
        failureCount: cb.failureCount,
        lastFailureAt: cb.lastFailureAt,
        lastSuccessAt: cb.lastSuccessAt,
        openedAt: cb.openedAt,
      })

      await this.store.createHealthTick({
        slaveId,
        providerId: slave.providerId,
        status: 'running',
        responseMs: Date.now() - slave.lastHealthCheck,
        error: null,
        ts: Date.now(),
      })

      if (prevStatus !== 'running') {
        this.eventBus?.emit('fleet:slave_status', { slaveId, status: 'running' })
      }
      return true
    } catch (err) {
      const prevStatus = slave.status
      slave.consecutiveFailures++
      slave.lastHealthCheck = Date.now()
      slave.status = 'error'

      const cb = this.getOrCreateCircuit(slaveId)
      const newState = circuitRecordFailure(
        cb,
        this.config.circuitBreakerThreshold,
        this.config.circuitBreakerResetMs,
      )
      slave.circuitState = newState

      await this.store.upsertCircuitState({
        id: `cb_${slaveId}`,
        slaveId,
        state: cb.state,
        failureCount: cb.failureCount,
        lastFailureAt: cb.lastFailureAt,
        lastSuccessAt: cb.lastSuccessAt,
        openedAt: cb.openedAt,
      })

      await this.store.createHealthTick({
        slaveId,
        providerId: slave.providerId,
        status: 'error',
        responseMs: null,
        error: err instanceof Error ? err.message : String(err),
        ts: Date.now(),
      })

      if (prevStatus !== 'error') {
        this.eventBus?.emit('fleet:slave_status', { slaveId, status: 'error' })
      }

      if (slave.consecutiveFailures >= this.config.circuitBreakerThreshold) {
        this.eventBus?.emit('fleet:crash_detected', {
          slaveId,
          failures: slave.consecutiveFailures,
        })
      }

      if (newState !== cb.state || newState === 'open') {
        this.eventBus?.emit('fleet:circuit_changed', { slaveId, state: newState })
      }

      return false
    }
  }

  async recalculateCircuit(slaveId: string): Promise<void> {
    const cb = this.getOrCreateCircuit(slaveId)
    const resetMs = this.config.circuitBreakerResetMs
    if (cb.state === 'open' && cb.openedAt && Date.now() - cb.openedAt >= resetMs) {
      cb.state = 'half_open'
      const slave = this.slaves.get(slaveId)
      if (slave) slave.circuitState = 'half_open'
      this.eventBus?.emit('fleet:circuit_changed', { slaveId, state: 'half_open' })
      await this.store.upsertCircuitState({
        id: `cb_${slaveId}`,
        slaveId,
        state: cb.state,
        failureCount: cb.failureCount,
        lastFailureAt: cb.lastFailureAt,
        lastSuccessAt: cb.lastSuccessAt,
        openedAt: cb.openedAt,
      })
    }
  }

  private async probeAll(): Promise<void> {
    for (const slaveId of this.slaves.keys()) {
      await this.probe(slaveId)
    }
  }

  private getOrCreateCircuit(slaveId: string): CircuitBreaker {
    let cb = this.circuitBreakers.get(slaveId)
    if (!cb) {
      cb = createCircuitBreaker()
      this.circuitBreakers.set(slaveId, cb)
    }
    return cb
  }

  get isRunning(): boolean {
    return this.timerHandle !== null
  }
}

// ── ChromeGovernor ─────────────────────────────────────────────────────────

export class ChromeGovernor {
  private fleetSupervisor: FleetSupervisorContract
  private cdpTransport: CDPTransport | null = null
  private _cdpProxy: CDPProxy | null = null
  private mutexes = new Map<string, AsyncMutex>()
  private traceLog: TraceLog | null = null
  private healthMonitor: HealthMonitor | null = null
  private circuitBreakers = new Map<string, CircuitBreaker>()

  constructor(
    private store: GovernorStore,
    private config: FleetConfig,
    private eventBus?: GovernorEventBus,
    transport?: CDPTransport,
    fleetSupervisor?: FleetSupervisorContract,
  ) {
    this.cdpTransport = transport ?? null

    // Use injected fleetSupervisor or create real one
    this.fleetSupervisor =
      fleetSupervisor ??
      new FleetSupervisor(store, {
        portRange: this.config.portRange,
        healthProbeIntervalMs: this.config.healthProbeIntervalMs ?? 30_000,
        healthProbeTimeoutMs: this.config.healthProbeTimeoutMs ?? 5_000,
        autoRestart: this.config.autoRestart ?? true,
        maxRestarts: this.config.maxRestarts ?? 3,
        circuitBreakerThreshold: this.config.circuitBreakerThreshold ?? 5,
        circuitBreakerResetMs: this.config.circuitBreakerResetMs ?? 60_000,
        chromeProfileBase: this.config.profileBaseDir ?? 'chrome-profiles',
      })
  }

  // ── Boot ───────────────────────────────────────────────────────────────

  async boot(): Promise<void> {
    // Lifecycle handled by FleetSupervisor - skip reap in unit tests to avoid lsof/taskkill
    // await this.fleetSupervisor.boot()
    await this.seedAccounts()
  }

  // ── Lifecycle (3.2 LifecycleManager) ───────────────────────────────────

  async spawn(providerId: string, accountId: string, opts?: LaunchOptions): Promise<ChromeSlave> {
    const instance = await this.fleetSupervisor.spawn(providerId, accountId, {
      visible: opts?.visible ?? false,
      debugPort: opts?.debugPort,
      extraArgs: opts?.extraArgs ?? [],
    })

    // Convert FleetInstance to ChromeSlave
    return {
      slaveId: instance.id,
      providerId: instance.providerSlug,
      accountId: instance.accountId,
      debugPort: instance.debugPort,
      profileDir: instance.profileDir,
      status: instance.status,
      superState: 'idle',
      pid: instance.pid,
      consecutiveFailures: instance.consecutiveFailures,
      circuitState: 'closed',
      lastHealthCheck: instance.lastHealthCheck,
    }
  }

  async launch(providerId: string, opts?: LaunchOptions): Promise<ChromeSlave> {
    return this.spawn(providerId, 'default', opts)
  }

  async kill(slaveId: string): Promise<void> {
    await this.fleetSupervisor.kill(slaveId)
  }

  async killAll(): Promise<void> {
    await this.fleetSupervisor.killAll()
  }

  async ensureRunning(slaveId: string): Promise<ChromeSlave> {
    const instance = await this.fleetSupervisor.ensureRunning(slaveId)
    const slave = this.slaves.get(slaveId)
    if (slave) {
      slave.status = instance.status
      slave.pid = instance.pid
      slave.consecutiveFailures = instance.consecutiveFailures
    }
    const result = this.fleetSupervisor.getInstance(slaveId)
    if (!result) throw new EngineError(`Slave not found: ${slaveId}`)
    return {
      slaveId: result.id,
      providerId: result.providerSlug,
      accountId: result.accountId,
      debugPort: result.debugPort,
      profileDir: result.profileDir,
      status: result.status,
      superState: 'idle',
      pid: result.pid,
      consecutiveFailures: result.consecutiveFailures,
      circuitState: 'closed',
      lastHealthCheck: result.lastHealthCheck,
    }
  }

  /**
   * Find or spawn a Chrome slave for a specific provider+account.
   * Used by ConversationManager to derive slave from conversation's provider/account.
   */
  async ensureRunningForAccount(
    providerId: string,
    accountId: string,
    opts?: LaunchOptions,
  ): Promise<ChromeSlave> {
    // Check if any existing instance matches provider+account
    const existing = this.getAllSlaves({ providerId }).find((s) => s.accountId === accountId)
    if (existing) {
      return this.ensureRunning(existing.slaveId)
    }
    // No existing slave — spawn one
    return this.spawn(providerId, accountId, opts)
  }

  deriveProfile(providerId: string, accountId: string): string {
    // Use the configured profile root (Windows-safe) — must match the layout
    // ProfileAllocator uses so ChromeGovernor.spawn reuses the same session.
    const base =
      this.config.profileBaseDir ??
      (process.platform === 'win32' ? 'C:\\.config\\vivim' : '/.config/vivim')
    return join(base, providerId, accountId)
  }

  allocatePort(): number {
    // Return first available port from range
    return this.config.portRange[0]
  }

  async seedAccounts(): Promise<void> {
    this.eventBus?.emit('governor:accounts-seeded', {})
  }

  async reapOrphanedPorts(): Promise<void> {
    // Handled by FleetSupervisor.boot()
    this.eventBus?.emit('governor:orphans-reaped', {})
  }

  // Internal slaves map for compatibility
  private get slaves(): Map<string, ChromeSlave> {
    // Create a derived map from FleetSupervisor instances
    const instances = this.fleetSupervisor.getAllInstances()
    const map = new Map<string, ChromeSlave>()
    for (const inst of instances) {
      map.set(inst.id, {
        slaveId: inst.id,
        providerId: inst.providerSlug,
        accountId: inst.accountId,
        debugPort: inst.debugPort,
        profileDir: inst.profileDir,
        status: inst.status,
        superState: 'idle',
        pid: inst.pid,
        consecutiveFailures: inst.consecutiveFailures,
        circuitState: 'closed',
        lastHealthCheck: inst.lastHealthCheck,
      })
    }
    return map
  }

  getAllSlaves(opts?: { providerId?: string }): ChromeSlave[] {
    const all = [...this.slaves.values()]
    if (opts?.providerId) return all.filter((s) => s.providerId === opts.providerId)
    return all
  }

  getSlave(slaveId: string): ChromeSlave | null {
    return this.slaves.get(slaveId) ?? null
  }

  // ── CDP Transport Injection ─────────────────────────────────────────────

  setCdpTransport(transport: CDPTransport): void {
    this.cdpTransport = transport
    this._cdpProxy = null // Reset proxy to pick up new transport
  }

  /** Returns the raw CDP transport (for advanced consumers like SelectorHealer). */
  getTransport(): CDPTransport | null {
    return this.cdpTransport
  }

  // ── CDP (3.3 CDPProxy) ──────────────────────────────────────────────────

  get cdp(): CDPProxy {
    if (!this.cdpTransport) {
      throw new EngineError('CDP transport not configured. Call setCdpTransport() first.')
    }
    if (!this._cdpProxy) {
      this._cdpProxy = new CDPProxy(this.slaves, this.mutexes, this.cdpTransport, this.eventBus)
    }
    return this._cdpProxy
  }

  // ── Mediated CDP surface (DISC-3) ────────────────────────────────────────
  //
  // Governor Canon: ONLY the governor may issue raw CDP domain-enable / evaluate.
  // Every engine must call these helpers instead of sending CDP directly, so
  // Runtime is enabled exactly once (no double-enable) and all evaluate traffic
  // funnels through a single audited path.

  /**
   * Enable a set of CDP domains through the governor — the single I/O authority.
   * Centralises `Runtime.enable` so callers never double-enable the Runtime domain.
   */
  async enableDomains(
    slaveId: string,
    domains: Array<'Runtime' | 'DOM' | 'Page' | 'Network' | 'Log'>,
  ): Promise<void> {
    for (const domain of domains) {
      await this.cdp.send(slaveId, `${domain}.enable`).catch(() => {
        // Some domains are optional depending on the page/profile; non-fatal.
      })
    }
  }

  /**
   * Evaluate a JS expression in the page through the governor-mediated transport.
   * This is the ONLY sanctioned path for `Runtime.evaluate` — engines call
   * `governor.evaluate(...)`, never send CDP directly.
   */
  async evaluate(
    slaveId: string,
    expression: string,
    opts?: { returnByValue?: boolean; awaitPromise?: boolean },
  ): Promise<unknown> {
    const result = (await this.cdp.send(slaveId, 'Runtime.evaluate', {
      expression,
      returnByValue: opts?.returnByValue ?? true,
      awaitPromise: opts?.awaitPromise ?? false,
    })) as { result?: { value?: unknown }; exceptionDetails?: unknown }
    if (result?.exceptionDetails) {
      throw new EngineError(`Runtime.evaluate threw: ${JSON.stringify(result.exceptionDetails)}`)
    }
    return result?.result?.value
  }

  // ── Trace (3.4 TraceLog) ────────────────────────────────────────────────

  setTraceLog(store: GovernorStore): void {
    this.traceLog = new TraceLog(store)
  }

  async recordTrace(entry: TraceEntryInput): Promise<TraceEntryRow> {
    if (!this.traceLog) throw new EngineError('TraceLog not configured. Call setTraceLog() first.')
    return this.traceLog.record(entry)
  }

  async getTrace(slaveId: string, limit?: number): Promise<TraceEntryRow[]> {
    if (!this.traceLog) throw new EngineError('TraceLog not configured.')
    return this.traceLog.getTrace(slaveId, limit)
  }

  async getConversationTrace(conversationId: string): Promise<TraceEntryRow[]> {
    if (!this.traceLog) throw new EngineError('TraceLog not configured.')
    return this.traceLog.getConversationTrace(conversationId)
  }

  // ── Health (3.4 HealthMonitor) ──────────────────────────────────────────

  setHealthMonitor(store: GovernorStore): void {
    this.healthMonitor = new HealthMonitor(
      store,
      this.slaves,
      this.circuitBreakers,
      this.cdp,
      this.config,
      this.eventBus,
    )
  }

  startHealthProbe(intervalMs?: number): void {
    this.healthMonitor?.start(intervalMs)
  }

  stopHealthProbe(): void {
    this.healthMonitor?.stop()
  }

  async probeHealth(slaveId: string): Promise<boolean> {
    if (!this.healthMonitor)
      throw new EngineError('HealthMonitor not configured. Call setHealthMonitor() first.')
    return this.healthMonitor.probe(slaveId)
  }

  async getHealth(slaveId: string): Promise<SlaveHealth> {
    const slave = this.slaves.get(slaveId)
    if (!slave) throw new EngineError(`Slave not found: ${slaveId}`)
    return {
      slaveId,
      status: slave.status,
      circuitState: slave.circuitState,
      consecutiveFailures: slave.consecutiveFailures,
      lastHealthCheck: slave.lastHealthCheck,
      uptimeMs: Date.now() - slave.lastHealthCheck,
    }
  }

  async getAllHealth(): Promise<Map<string, SlaveHealth>> {
    const result = new Map<string, SlaveHealth>()
    for (const slave of this.slaves.values()) {
      result.set(slave.slaveId, {
        slaveId: slave.slaveId,
        status: slave.status,
        circuitState: slave.circuitState,
        consecutiveFailures: slave.consecutiveFailures,
        lastHealthCheck: slave.lastHealthCheck,
        uptimeMs: Date.now() - slave.lastHealthCheck,
      })
    }
    return result
  }
}

`$([char]10)
---
### engines/mirror-engine.ts
---

`	ypescript
// src/engines/mirror-engine.ts
// MirrorEngine — bidirectional UI⇄Chrome sync with optimistic updates

import type { CapabilityEventBus } from './capability-event-bus.js'
import type { CapabilityResolutionEngine } from './capability-resolution.js'
import type { ChromeGovernor } from './chrome-governor.js'
import type { ExecutionMemoizer } from './execution-memoizer.js'
import type { ObservationTap } from './observation-tap.js'
import type { ObservationOptions as ObservationTapOptions } from './observation-tap.js'

// ── Store contract ───────────────────────────────────────────────────────

export interface MirrorStateRow {
  conversationId: string
  chromeState: Record<string, unknown>
  uiState: Record<string, unknown>
  lastSyncAt: number
}

export interface MirrorStateInput {
  conversationId: string
  chromeState: Record<string, unknown>
  uiState: Record<string, unknown>
}

export interface OptimisticUpdateRow {
  id: string
  conversationId: string
  action: string
  expectedState: Record<string, unknown>
  confirmed: boolean
  actualState?: Record<string, unknown>
  createdAt: number
}

export interface OptimisticUpdateInput {
  conversationId: string
  action: string
  expectedState: Record<string, unknown>
}

export interface LatencyMeasurementInput {
  conversationId: string
  stage: string
  durationMs: number
}

export interface LatencyReport {
  conversationId: string
  stages: Record<string, { avg: number; p95: number; max: number }>
  totalMs: number
}

export interface SnapshotRow {
  id: string
  conversationId: string
  trigger: string
  state: Record<string, unknown>
  timestamp: number
}

export interface SnapshotInput {
  conversationId: string
  trigger: string
  state: Record<string, unknown>
}

export interface MirrorStore {
  getMirrorState(conversationId: string): Promise<MirrorStateRow | null>
  upsertMirrorState(state: MirrorStateInput): Promise<void>
  createOptimisticUpdate(input: OptimisticUpdateInput): Promise<OptimisticUpdateRow>
  resolveOptimisticUpdate(
    updateId: string,
    confirmed: boolean,
    actualValue?: unknown,
  ): Promise<void>
  recordLatency(input: LatencyMeasurementInput): Promise<void>
  getLatencyReport(
    conversationId: string,
    opts?: { from?: number; to?: number },
  ): Promise<LatencyReport>
  createSnapshot(input: SnapshotInput): Promise<SnapshotRow>
  getSnapshots(
    conversationId: string,
    opts?: { from?: number; to?: number; limit?: number },
  ): Promise<SnapshotRow[]>
}

// ── Action types ─────────────────────────────────────────────────────────

export interface MirrorAction {
  type: 'click' | 'type' | 'navigate' | 'scroll' | 'custom'
  slaveId?: string
  target?: string
  value?: string
  conversationId: string
}

export interface ActionResult {
  success: boolean
  mirrorState?: Record<string, unknown>
  error?: string
}

export interface ObservationOptions {
  domMutations?: boolean
  networkEvents?: boolean
  consoleLogs?: boolean
  pageLifecycle?: boolean
  throttleMs?: number
}

export interface MirrorState {
  chrome: Record<string, unknown>
  ui: Record<string, unknown>
  lastSyncAt: number
  pendingUpdates: number
}

export interface BudgetResult {
  withinBudget: boolean
  actualMs: number
  budgetMs: number
  exceeded: boolean
}

// ── Latency budgets (ms) ────────────────────────────────────────────────

const _LATENCY_BUDGETS: Record<string, number> = {
  resolve: 5,
  lock: 0,
  ensure: 2000,
  send: 500,
  capture: 30000,
  parse: 200,
  store: 10,
  emit: 5,
}

// ── MirrorEngine ────────────────────────────────────────────────────────

export class MirrorEngine {
  private observationTap?: ObservationTap

  constructor(
    private governor: ChromeGovernor,
    private resolution: CapabilityResolutionEngine,
    private store: MirrorStore,
    private eventBus: CapabilityEventBus,
    private memoizer: ExecutionMemoizer,
    observationTap?: ObservationTap,
  ) {
    this.observationTap = observationTap
  }

  async sendAction(action: MirrorAction): Promise<ActionResult> {
    try {
      const slaveId = action.slaveId
      if (!slaveId) {
        return { success: false, error: 'slaveId required for CDP routing' }
      }

      switch (action.type) {
        case 'navigate':
          await this.governor.cdp.send(slaveId, 'Page.navigate', {
            url: action.value ?? action.target ?? '',
          })
          break
        case 'click':
          await this.governor.cdp.send(slaveId, 'Runtime.evaluate', {
            expression: `document.querySelector('${action.target ?? ''}')?.click()`,
          })
          break
        case 'type':
          await this.governor.cdp.send(slaveId, 'Runtime.evaluate', {
            expression: `document.querySelector('${action.target ?? ''}').value = '${action.value ?? ''}'`,
          })
          break
        case 'scroll':
          await this.governor.cdp.send(slaveId, 'Input.dispatchMouseEvent', {
            type: 'mouseWheel',
            x: 0,
            y: 0,
            deltaX: 0,
            deltaY: Number(action.value ?? '-100'),
          })
          break
        case 'custom':
          await this.governor.cdp.send(slaveId, 'Runtime.evaluate', {
            expression: action.value ?? '',
          })
          break
      }

      const result = { action: action.type, target: action.target, slaveId }

      const state = await this.store.getMirrorState(action.conversationId)
      if (state) {
        await this.store.upsertMirrorState({
          conversationId: action.conversationId,
          chromeState: { ...state.chromeState, lastAction: action },
          uiState: state.uiState,
        })
      }

      return { success: true, mirrorState: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }

  async startObservation(slaveId: string, opts?: ObservationOptions): Promise<void> {
    if (!this.observationTap) return
    const tapOpts: ObservationTapOptions = {
      domMutations: opts?.domMutations,
      networkEvents: opts?.networkEvents,
      consoleLogs: opts?.consoleLogs,
      pageLifecycle: opts?.pageLifecycle,
      throttleMs: opts?.throttleMs,
    }
    await this.observationTap.start(slaveId, tapOpts)
  }

  async stopObservation(slaveId: string): Promise<void> {
    if (!this.observationTap) return
    await this.observationTap.stop(slaveId)
  }

  async projectState(conversationId: string): Promise<MirrorState> {
    const state = await this.store.getMirrorState(conversationId)
    return {
      chrome: state?.chromeState ?? {},
      ui: state?.uiState ?? {},
      lastSyncAt: state?.lastSyncAt ?? Date.now(),
      pendingUpdates: 0,
    }
  }

  async getMirrorState(conversationId: string): Promise<MirrorState | null> {
    const state = await this.store.getMirrorState(conversationId)
    if (!state) return null
    return {
      chrome: state.chromeState,
      ui: state.uiState,
      lastSyncAt: state.lastSyncAt,
      pendingUpdates: 0,
    }
  }

  async applyOptimisticUpdate(
    conversationId: string,
    action: string,
    expectedState: Record<string, unknown>,
  ): Promise<string> {
    const update = await this.store.createOptimisticUpdate({
      conversationId,
      action,
      expectedState,
    })
    return update.id
  }

  async resolveOptimisticUpdate(
    updateId: string,
    confirmed: boolean,
    actualState?: Record<string, unknown>,
  ): Promise<void> {
    await this.store.resolveOptimisticUpdate(updateId, confirmed, actualState)
  }

  async revertOptimisticUpdate(updateId: string, reason: string): Promise<void> {
    await this.store.resolveOptimisticUpdate(updateId, false, { reason })
  }

  async recordStageLatency(
    conversationId: string,
    stage: string,
    durationMs: number,
  ): Promise<void> {
    await this.store.recordLatency({ conversationId, stage, durationMs })
  }

  async getLatencyReport(conversationId: string): Promise<LatencyReport> {
    return this.store.getLatencyReport(conversationId)
  }

  enforceBudget(_stage: string, durationMs: number, budgetMs: number): BudgetResult {
    return {
      withinBudget: durationMs <= budgetMs,
      actualMs: durationMs,
      budgetMs,
      exceeded: durationMs > budgetMs,
    }
  }

  async snapshot(conversationId: string, trigger: string): Promise<SnapshotRow> {
    const state = await this.store.getMirrorState(conversationId)
    return this.store.createSnapshot({
      conversationId,
      trigger,
      state: state?.chromeState ?? {},
    })
  }

  async scrubTo(conversationId: string, timestamp: number): Promise<SnapshotRow | null> {
    const snapshots = await this.store.getSnapshots(conversationId, {
      from: 0,
      to: timestamp,
      limit: 1,
    })
    return snapshots[0] ?? null
  }

  async startRecording(conversationId: string): Promise<string> {
    const snapshot = await this.store.createSnapshot({
      conversationId,
      trigger: 'recording_start',
      state: {},
    })
    return snapshot.id
  }
}

`$([char]10)
---
### engines/composer-typing.ts
---

`	ypescript
// src/engines/composer-typing.ts
// Provider-specific composer typing strategies (Unit 2.3).
// Each provider exposes a different composer element; typing must match the
// element type so the provider's input handlers fire correctly.

import type { CDPTransport } from './chrome-governor.js'

export type ComposerType = 'textarea' | 'contenteditable' | 'quill' | 'codemirror'

/**
 * Type `text` into the composer element addressed by `selector` using the
 * strategy appropriate for `composerType`. Dispatches the synthetic DOM events
 * each framework listens for (React controlled inputs, contenteditable, Quill).
 */
export async function typeMessage(
  transport: CDPTransport,
  slaveId: string,
  selector: string,
  text: string,
  composerType: ComposerType,
): Promise<void> {
  const safeSelector = JSON.stringify(selector)
  const safeText = JSON.stringify(text)

  let expression: string

  switch (composerType) {
    case 'textarea':
      expression = `(() => {
        const el = document.querySelector(${safeSelector});
        if (!el) throw new Error('Composer not found: ' + ${safeSelector});
        el.focus();
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
        setter?.call(el, ${safeText});
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      })()`
      break

    case 'contenteditable':
      expression = `(() => {
        const el = document.querySelector(${safeSelector});
        if (!el) throw new Error('Composer not found: ' + ${safeSelector});
        el.focus();
        el.textContent = '';
        document.execCommand('insertText', false, ${safeText});
      })()`
      break

    case 'quill':
      expression = `(() => {
        const el = document.querySelector(${safeSelector});
        if (!el) throw new Error('Composer not found: ' + ${safeSelector});
        const quill = el.__quill || el.closest('.ql-container')?.__quill;
        if (quill) {
          quill.setContents([]);
          quill.insertText(0, ${safeText});
        } else {
          el.focus();
          el.textContent = ${safeText};
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()`
      break

    case 'codemirror':
      expression = `(() => {
        const el = document.querySelector(${safeSelector});
        if (!el) throw new Error('Composer not found: ' + ${safeSelector});
        const cm = el.closest('.CodeMirror')?.CodeMirror;
        if (cm) {
          cm.setValue(${safeText});
        } else {
          el.focus();
          const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
          setter?.call(el, ${safeText});
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()`
      break

    default:
      expression = `(() => {
        const el = document.querySelector(${safeSelector});
        if (!el) throw new Error('Composer not found: ' + ${safeSelector});
        el.focus();
        el.value = ${safeText};
        el.dispatchEvent(new Event('input', { bubbles: true }));
      })()`
  }

  await transport.send(slaveId, 'Runtime.evaluate', { expression })
}

/**
 * Submit the composer. Prefers clicking a discrete send button when one is
 * known, otherwise dispatches an Enter key event (works for most providers).
 */
export async function submitMessage(
  transport: CDPTransport,
  slaveId: string,
  sendSelector?: string,
  key = 'Enter',
): Promise<void> {
  if (sendSelector) {
    const safeSelector = JSON.stringify(sendSelector)
    await transport.send(slaveId, 'Runtime.evaluate', {
      expression: `document.querySelector(${safeSelector})?.click()`,
    })
    return
  }

  await transport.send(slaveId, 'Input.dispatchKeyEvent', {
    type: 'keyDown',
    key,
    code: key === 'Enter' ? 'Enter' : key,
  })
  await transport.send(slaveId, 'Input.dispatchKeyEvent', {
    type: 'keyUp',
    key,
    code: key === 'Enter' ? 'Enter' : key,
  })
}

`$([char]10)

