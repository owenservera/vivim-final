// src/storage/impl/health-store-impl.ts
// HealthStoreImpl — Prisma-backed HealthStore (04-merged-engines.md §8).

import type { ProviderHealthReport } from '../../schema/health.js'
import type { HealthHistoryRow } from '../../schema/types.js'
import type { CircuitBreakerStateRow } from '../contracts/governor-store.js'
import type { DriftEvent, HealthStore } from '../contracts/health-store.js'
import type { CapStoreDb } from '../db.js'

// ── Prisma row shapes (subset used) ─────────────────────────────────────────

interface PrismaCircuit {
  id: string
  slaveId: string
  state: string
  failCount: number
  lastFailAt: number | null
  lastSuccessAt: number | null
  openedAt: number | null
}

interface PrismaDrift {
  id: string
  providerId: string
  capabilityId: string | null
  bindingId: string | null
  driftType: string
  severity: string
  description: string | null
  resolved: number
  detectedAt: number
  resolvedAt: number | null
}

interface PrismaProviderHealth {
  id: string
  providerId: string
  overallStatus: string
  overallScore: number
  signalsJson: string
  lastCheckAt: number | null
  updatedAt: number
}

interface PrismaHealthHistory {
  id: string
  providerId: string
  runtimeState: string
  selectorHitRateAvg: number | null
  snapshotTs: number
}

// ── Mappers ──────────────────────────────────────────────────────────────

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

function toDrift(r: PrismaDrift): DriftEvent {
  return {
    id: r.id,
    providerId: r.providerId,
    capabilityId: r.capabilityId,
    bindingId: r.bindingId,
    driftType: r.driftType,
    severity: r.severity,
    description: r.description,
    resolved: r.resolved,
    detectedAt: r.detectedAt,
    resolvedAt: r.resolvedAt,
  }
}

function toReport(r: PrismaProviderHealth): ProviderHealthReport {
  return {
    id: r.id,
    providerId: r.providerId,
    overallStatus: r.overallStatus,
    overallScore: r.overallScore,
    signalsJson: r.signalsJson,
    ts: r.lastCheckAt ?? r.updatedAt,
  }
}

function toHistoryRow(r: PrismaHealthHistory): HealthHistoryRow {
  return {
    id: r.id,
    provider_id: r.providerId,
    overall_status: r.runtimeState,
    overall_score: r.selectorHitRateAvg ?? 0,
    signals_json: '{}',
    ts: r.snapshotTs,
  }
}

// ── HealthStoreImpl ────────────────────────────────────────────────────────

export class HealthStoreImpl implements HealthStore {
  constructor(private db: CapStoreDb) {}

  async getCircuitStates(providerId: string): Promise<CircuitBreakerStateRow[]> {
    // circuit_breaker_state is keyed by slaveId; slaveIds encode their provider.
    const rows = await this.db.prisma.circuitBreakerState.findMany({})
    return rows
      .map((r) => r as unknown as PrismaCircuit)
      .filter((r) => r.slaveId.includes(providerId))
      .map(toCircuitRow)
  }

  async getRecentDrifts(providerId: string, windowMs: number): Promise<DriftEvent[]> {
    const cutoff = Date.now() - windowMs
    const rows = await this.db.prisma.driftEvent.findMany({
      where: { providerId, detectedAt: { gte: cutoff } },
      orderBy: { detectedAt: 'desc' },
    })
    return rows.map((r) => toDrift(r as unknown as PrismaDrift))
  }

  async upsertProviderHealth(report: ProviderHealthReport): Promise<void> {
    const now = Date.now()
    await this.db.prisma.providerHealth.upsert({
      where: { providerId: report.providerId },
      create: {
        id: report.id,
        providerId: report.providerId,
        overallStatus: report.overallStatus,
        overallScore: report.overallScore,
        signalsJson: report.signalsJson,
        lastCheckAt: report.ts,
        createdAt: now,
        updatedAt: now,
      },
      update: {
        overallStatus: report.overallStatus,
        overallScore: report.overallScore,
        signalsJson: report.signalsJson,
        lastCheckAt: report.ts,
        updatedAt: now,
      },
    })
  }

  async getProviderHealth(providerId: string): Promise<ProviderHealthReport | null> {
    const row = await this.db.prisma.providerHealth.findUnique({ where: { providerId } })
    return row ? toReport(row as unknown as PrismaProviderHealth) : null
  }

  async getHealthHistory(providerId: string, limit?: number): Promise<HealthHistoryRow[]> {
    const rows = await this.db.prisma.providerHealthHistory.findMany({
      where: { providerId },
      orderBy: { snapshotTs: 'desc' },
      take: limit ?? 100,
    })
    return rows.map((r) => toHistoryRow(r as unknown as PrismaHealthHistory))
  }

  async getActiveProviders(): Promise<string[]> {
    const rows = await this.db.prisma.providerHealth.findMany({
      where: { overallStatus: { not: 'unknown' } },
    })
    return rows.map((r) => (r as unknown as PrismaProviderHealth).providerId)
  }
}
