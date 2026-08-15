// src/storage/db.ts
// Typed wrapper over dual PrismaClients.
// The CapStoreDb class provides typed access to all tables
// using Prisma ORM with the same public API shape.

import { newId } from '../ids.js'
import { getLogger } from '../lib/logger.js'
import {
  closePrisma,
  type FullPrismaClient,
  getSystemPrisma,
  getUserPrisma,
  type SystemPrismaClient,
  type UserPrismaClient,
} from './prisma.js'

const log = getLogger('db')

export class CapStoreDb {
  /** System-side client (providers, capabilities, routing, telemetry, health, config, etc.) */
  public readonly systemPrisma: SystemPrismaClient
  /** User-side client (conversations, nodes, memory, sessions, etc.) */
  public readonly userPrisma: UserPrismaClient
  /** Backward-compat shim — full @prisma/client. Deprecated, use systemPrisma/userPrisma. */
  public readonly prisma: FullPrismaClient

  constructor(_path?: string) {
    // _path kept for backward compat but ignored — Prisma uses DATABASE_URL
    this.systemPrisma = getSystemPrisma()
    this.userPrisma = getUserPrisma()
    // Cast systemPrisma to FullPrismaClient for backward compat — system models are a subset
    this.prisma = this.systemPrisma as unknown as FullPrismaClient
  }

  async close(): Promise<void> {
    await closePrisma()
  }

  // ── L1: Provider CRUD ──────────────────────────────────────────────────

  async getProvider(id: string) {
    return this.systemPrisma.providerDefinition.findUnique({ where: { id } })
  }

  async getProviderBySlug(slug: string) {
    return this.systemPrisma.providerDefinition.findUnique({ where: { slug } })
  }

  async listProviders(opts?: { isActive?: boolean }) {
    return this.systemPrisma.providerDefinition.findMany({
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
    protocolStatus?: string
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
    return this.systemPrisma.providerDefinition.upsert({
      where: { id: def.id },
      create: {
        id: def.id,
        slug: def.slug,
        displayName: def.displayName,
        description: def.description ?? null,
        category: def.category ?? 'ai',
        providerType: def.providerType ?? 'llm',
        isActive: def.isActive ?? 1,
        protocolStatus: def.protocolStatus ?? 'Active',
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
        protocolStatus: def.protocolStatus ?? 'Active',
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
    return this.systemPrisma.providerAccount.findUnique({ where: { id } })
  }

  async getAccountsByProvider(providerId: string) {
    return this.systemPrisma.providerAccount.findMany({
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
    return this.systemPrisma.providerAccount.upsert({
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
    return this.systemPrisma.capabilityTaxonomy.findUnique({ where: { id } })
  }

  async getCapabilityBySlug(slug: string) {
    return this.systemPrisma.capabilityTaxonomy.findUnique({ where: { slug } })
  }

  async getBinding(globalId: string, providerId: string) {
    return this.systemPrisma.capabilityBinding.findUnique({
      where: { globalId_providerId: { globalId, providerId } },
    })
  }

  async getSelectors(capabilityId: string, providerId: string) {
    return this.systemPrisma.selectorStrategy.findMany({
      where: { capabilityId, providerId, isActive: 1 },
      orderBy: { priority: 'asc' },
    })
  }

  // ── L4: Conversation CRUD ──────────────────────────────────────────────

  async getConversation(id: string) {
    return this.userPrisma.conversation.findUnique({ where: { id } })
  }

  async listConversations(opts?: { providerId?: string; limit?: number }) {
    return this.userPrisma.conversation.findMany({
      where: opts?.providerId ? { providerId: opts.providerId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: opts?.limit ?? 50,
    })
  }

  async createConversation(input: {
    id: string
    providerSessionId: string
    providerId: string
    title?: string
  }) {
    const now = Date.now()
    return this.userPrisma.conversation.create({
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

  /**
   * Idempotently ensure a valid ProviderSession exists for (providerId, accountId),
   * creating the prerequisite VivimSession + default ProviderAccount when missing.
   * Conversations require a real providerSessionId FK (schema cascade), so callers
   * MUST obtain the session id from here rather than inventing a literal string.
   */
  async ensureProviderSession(input: {
    providerId: string
    accountId?: string
  }): Promise<{ id: string }> {
    const providerId = input.providerId
    const accountId = input.accountId ?? `${providerId}_default`
    const now = Date.now()

    const existing = await this.userPrisma.providerSession.findFirst({
      where: { providerId, accountId },
      select: { id: true },
    })
    if (existing) return { id: existing.id }

    // Upsert provider in system DB (bootstrap)
    await this.systemPrisma.providerDefinition
      .upsert({
        where: { id: providerId },
        create: {
          id: providerId,
          slug: providerId,
          displayName: providerId,
          createdAt: now,
          updatedAt: now,
        },
        update: { updatedAt: now },
      })
      .catch((err) => {
        log.warn({ err, providerId }, 'Provider upsert failed during bootstrap')
      })

    const vivimSession = await this.userPrisma.vivimSession.create({
      data: { id: newId(), state: 'idle', contextJson: '{}', createdAt: now, updatedAt: now },
    })

    await this.systemPrisma.providerAccount.upsert({
      where: { id: accountId },
      create: {
        id: accountId,
        providerId,
        email: `${accountId}@local`,
        planTier: 'free',
        isDefault: 1,
        isKind: 0,
        loginState: 'unknown',
        loginAttempts: 0,
        providerStateJson: '{}',
        createdAt: now,
        updatedAt: now,
      },
      update: { updatedAt: now },
    })

    const session = await this.userPrisma.providerSession.create({
      data: {
        id: newId(),
        vivimSessionId: vivimSession.id,
        providerId,
        accountId,
        state: 'idle',
        contextJson: '{}',
        createdAt: now,
        updatedAt: now,
      },
    })
    return { id: session.id }
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
    return this.userPrisma.conversationMessage.create({
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
    return this.userPrisma.conversationMessage.findMany({
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
    return this.systemPrisma.outcome.create({
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
    return this.systemPrisma.traceEntry.create({
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
    return this.systemPrisma.configEntry.findMany({
      where: { engineId },
    })
  }

  async setConfig(engineId: string, configJson: string) {
    const existing = await this.systemPrisma.configEntry.findFirst({ where: { engineId } })
    const now = Date.now()
    if (existing) {
      return this.systemPrisma.configEntry.update({
        where: { id: existing.id },
        data: { configJson },
      })
    }
    return this.systemPrisma.configEntry.create({
      data: {
        id: `cfg_${engineId}_${Date.now()}`,
        engineId,
        configJson,
        scopeType: 'global',
        scopeId: undefined,
        createdAt: BigInt(now),
        updatedAt: BigInt(now),
      },
    })
  }

  async getConfigValue(engineId: string, _key: string) {
    const entry = await this.systemPrisma.configEntry.findFirst({
      where: { engineId },
    })
    return entry?.configJson ?? null
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

async function applyPragmas(
  prisma: SystemPrismaClient | UserPrismaClient,
  pragmas: DbPragmaPolicy,
): Promise<void> {
  await prisma.$queryRawUnsafe(`PRAGMA journal_mode = ${pragmas.journalMode}`)
  await prisma.$queryRawUnsafe(`PRAGMA synchronous = ${pragmas.synchronous}`)
  await prisma.$queryRawUnsafe(`PRAGMA cache_size = ${pragmas.cacheSize}`)
  await prisma.$queryRawUnsafe(`PRAGMA temp_store = ${pragmas.tempStore}`)
  await prisma.$queryRawUnsafe(`PRAGMA mmap_size = ${pragmas.mmapSize}`)
  await prisma.$queryRawUnsafe(`PRAGMA busy_timeout = ${pragmas.busyTimeoutMs}`)
  await prisma.$queryRawUnsafe(`PRAGMA wal_autocheckpoint = ${pragmas.walAutocheckpoint}`)
  await prisma.$queryRawUnsafe(`PRAGMA foreign_keys = ${pragmas.foreignKeys ? 'ON' : 'OFF'}`)
}

export async function configurePrisma(
  db: CapStoreDb,
  policy?: Partial<DbPragmaPolicy>,
): Promise<void> {
  const pragmas = { ...DEFAULT_PRAGMAS, ...policy }

  // Apply to both clients
  await applyPragmas(db.systemPrisma, pragmas)
  await applyPragmas(db.userPrisma, pragmas)

  const journalMode =
    await db.systemPrisma.$queryRawUnsafe<{ journal_mode: string }[]>('PRAGMA journal_mode')
  log.info(`[db] pragmas configured — journal_mode=${journalMode[0]?.journal_mode}`)
}

export async function closeDb(): Promise<void> {
  if (_db) {
    await _db.close()
    _db = null
  }
}
