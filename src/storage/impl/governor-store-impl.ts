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
        ts: Date.now(),
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
