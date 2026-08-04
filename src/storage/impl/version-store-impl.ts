// src/storage/impl/version-store-impl.ts
// VersionStoreImpl — Prisma-backed VersionStore (05-merged-lifecycles.md §2).

import type {
  ProgramMetricInput,
  ProgramMetricRow,
  StatusLogInput,
  StatusLogRow,
  TaxonomyVersionInput,
  TaxonomyVersionRow,
  VersionStore,
} from '../contracts/version-store.js'
import type { CapStoreDb } from '../db.js'

// Loosely-typed Prisma handle. The generated client types are verbose and add
// no safety at the call site, so we keep the public API typed but the internal
// Prisma access loosely typed via a permissive structural alias.
type PrismaLoose = Record<string, unknown>
// ── Prisma row shapes ────────────────────────────────────────────────────────

interface PrismaTaxonomyVersion {
  id: string
  capabilityId: string
  version: number
  snapshotJson: string
  changeSummary: string | null
  changedFieldsJson: string
  actor: string
  createdAt: number
}

interface PrismaStatusLog {
  id: string
  bindingId: string
  fromStatus: string | null
  toStatus: string
  fromProgramId: string | null
  toProgramId: string | null
  trigger: string
  confidenceAtTransition: number | null
  successRateAtTransition: number | null
  reason: string | null
  actor: string
  metadataJson: string
  ts: number
}

interface PrismaProgramMetric {
  id: string
  bindingId: string
  programId: string
  programVersion: number
  totalExecutions: number
  successCount: number
  failCount: number
  avgLatencyMs: number
  p50LatencyMs: number
  p95LatencyMs: number
  p99LatencyMs: number
  lastExecutedAt: number | null
  firstExecutedAt: number | null
  window1hTotal: number
  window1hSuccess: number
  window24hTotal: number
  window24hSuccess: number
  window7dTotal: number
  window7dSuccess: number
  createdAt: number
  updatedAt: number
}

// ── Mappers ──────────────────────────────────────────────────────────────────

function toTaxonomyRow(r: PrismaTaxonomyVersion): TaxonomyVersionRow {
  return {
    id: r.id,
    capabilityId: r.capabilityId,
    version: r.version,
    snapshotJson: r.snapshotJson,
    changeSummary: r.changeSummary,
    changedFieldsJson: r.changedFieldsJson,
    actor: r.actor,
    createdAt: r.createdAt,
  }
}

function toStatusRow(r: PrismaStatusLog): StatusLogRow {
  return {
    id: r.id,
    bindingId: r.bindingId,
    fromStatus: r.fromStatus,
    toStatus: r.toStatus,
    fromProgramId: r.fromProgramId,
    toProgramId: r.toProgramId,
    trigger: r.trigger,
    confidenceAtTransition: r.confidenceAtTransition,
    successRateAtTransition: r.successRateAtTransition,
    reason: r.reason,
    actor: r.actor,
    metadataJson: r.metadataJson,
    ts: r.ts,
  }
}

function toMetricRow(r: PrismaProgramMetric): ProgramMetricRow {
  return {
    id: r.id,
    bindingId: r.bindingId,
    programId: r.programId,
    programVersion: r.programVersion,
    totalExecutions: r.totalExecutions,
    successCount: r.successCount,
    failCount: r.failCount,
    avgLatencyMs: r.avgLatencyMs,
    p50LatencyMs: r.p50LatencyMs,
    p95LatencyMs: r.p95LatencyMs,
    p99LatencyMs: r.p99LatencyMs,
    lastExecutedAt: r.lastExecutedAt,
    firstExecutedAt: r.firstExecutedAt,
    window1hTotal: r.window1hTotal,
    window1hSuccess: r.window1hSuccess,
    window24hTotal: r.window24hTotal,
    window24hSuccess: r.window24hSuccess,
    window7dTotal: r.window7dTotal,
    window7dSuccess: r.window7dSuccess,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

// ── Impl ─────────────────────────────────────────────────────────────────────

export class VersionStoreImpl implements VersionStore {
  // Prisma client is generated/verbose; typed access gives no safety benefit at
  // the call site, so we keep it loosely typed while the public API stays typed.
  private db: PrismaLoose

  constructor(db: CapStoreDb) {
    this.db = db.loose 
  }

  // Contained escape hatch: the generated Prisma client types are verbose and
  // add no safety at the call site. Typed through `any` here only.
  private get p() {
    return this.db.prisma
  }

  // ── Taxonomy versions ───────────────────────────────────────────────────────

  async createTaxonomyVersion(input: TaxonomyVersionInput): Promise<TaxonomyVersionRow> {
    const r = await this.p.capabilityTaxonomyVersion.create({
      data: {
        id: input.id,
        capabilityId: input.capabilityId,
        version: input.version,
        snapshotJson: input.snapshotJson,
        changeSummary: input.changeSummary ?? null,
        changedFieldsJson: input.changedFieldsJson ?? '[]',
        actor: input.actor ?? 'system',
        createdAt: Date.now(),
      },
    })
    return toTaxonomyRow(r as unknown as PrismaTaxonomyVersion)
  }

  async getTaxonomyVersion(
    capabilityId: string,
    version: number,
  ): Promise<TaxonomyVersionRow | null> {
    const r = await this.p.capabilityTaxonomyVersion.findUnique({
      where: { capabilityId_version: { capabilityId, version } },
    })
    return r ? toTaxonomyRow(r as unknown as PrismaTaxonomyVersion) : null
  }

  async getLatestTaxonomyVersion(capabilityId: string): Promise<TaxonomyVersionRow | null> {
    const r = await this.p.capabilityTaxonomyVersion.findFirst({
      where: { capabilityId },
      orderBy: { version: 'desc' },
    })
    return r ? toTaxonomyRow(r as unknown as PrismaTaxonomyVersion) : null
  }

  async getTaxonomyVersionHistory(
    capabilityId: string,
    limit?: number,
  ): Promise<TaxonomyVersionRow[]> {
    const rows = await this.p.capabilityTaxonomyVersion.findMany({
      where: { capabilityId },
      orderBy: { version: 'desc' },
      take: limit ?? 100,
    })
    return rows.map((r: PrismaTaxonomyVersion) => toTaxonomyRow(r))
  }

  async pruneOldVersions(capabilityId: string, maxVersions: number): Promise<number> {
    const all = await this.p.capabilityTaxonomyVersion.findMany({
      where: { capabilityId },
      orderBy: { version: 'desc' },
      select: { version: true },
    })
    if (all.length <= maxVersions) return 0
    const keep = new Set(all.slice(0, maxVersions).map((r: { version: number }) => r.version))
    const toDelete = all
      .filter((r: { version: number }) => !keep.has(r.version))
      .map((r: { version: number }) => r.version)
    const result = await this.p.capabilityTaxonomyVersion.deleteMany({
      where: { capabilityId, version: { in: toDelete } },
    })
    return result.count
  }

  // ── Status logs ─────────────────────────────────────────────────────────────

  async createStatusLog(input: StatusLogInput): Promise<StatusLogRow> {
    const r = await this.p.bindingStatusLog.create({
      data: {
        id: input.id,
        bindingId: input.bindingId,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        fromProgramId: input.fromProgramId ?? null,
        toProgramId: input.toProgramId ?? null,
        trigger: input.trigger,
        confidenceAtTransition: input.confidenceAtTransition ?? null,
        successRateAtTransition: input.successRateAtTransition ?? null,
        reason: input.reason ?? null,
        actor: input.actor ?? 'system',
        metadataJson: input.metadataJson ?? '{}',
        ts: input.ts,
      },
    })
    return toStatusRow(r as unknown as PrismaStatusLog)
  }

  async getStatusHistory(
    bindingId: string,
    opts?: { limit?: number; since?: number },
  ): Promise<StatusLogRow[]> {
    const rows = await this.p.bindingStatusLog.findMany({
      where: {
        bindingId,
        ...(opts?.since !== undefined ? { ts: { gte: opts.since } } : {}),
      },
      orderBy: { ts: 'desc' },
      take: opts?.limit ?? 100,
    })
    return rows.map((r: PrismaStatusLog) => toStatusRow(r))
  }

  async getLastStatusChange(bindingId: string): Promise<StatusLogRow | null> {
    const r = await this.p.bindingStatusLog.findFirst({
      where: { bindingId },
      orderBy: { ts: 'desc' },
    })
    return r ? toStatusRow(r as unknown as PrismaStatusLog) : null
  }

  // ── Program metrics ─────────────────────────────────────────────────────────

  async upsertProgramMetric(input: ProgramMetricInput): Promise<ProgramMetricRow> {
    const now = Date.now()
    const r = await this.p.programVersionMetric.upsert({
      where: {
        bindingId_programId_programVersion: {
          bindingId: input.bindingId,
          programId: input.programId,
          programVersion: input.programVersion,
        },
      },
      create: {
        id: input.id,
        bindingId: input.bindingId,
        programId: input.programId,
        programVersion: input.programVersion,
        totalExecutions: input.totalExecutions ?? 0,
        successCount: input.successCount ?? 0,
        failCount: input.failCount ?? 0,
        avgLatencyMs: input.avgLatencyMs ?? 0,
        p50LatencyMs: input.p50LatencyMs ?? 0,
        p95LatencyMs: input.p95LatencyMs ?? 0,
        p99LatencyMs: input.p99LatencyMs ?? 0,
        lastExecutedAt: input.lastExecutedAt ?? null,
        firstExecutedAt: input.firstExecutedAt ?? now,
        window1hTotal: input.window1hTotal ?? 0,
        window1hSuccess: input.window1hSuccess ?? 0,
        window24hTotal: input.window24hTotal ?? 0,
        window24hSuccess: input.window24hSuccess ?? 0,
        window7dTotal: input.window7dTotal ?? 0,
        window7dSuccess: input.window7dSuccess ?? 0,
        createdAt: now,
        updatedAt: now,
      },
      update: {
        totalExecutions: input.totalExecutions ?? 0,
        successCount: input.successCount ?? 0,
        failCount: input.failCount ?? 0,
        avgLatencyMs: input.avgLatencyMs ?? 0,
        p50LatencyMs: input.p50LatencyMs ?? 0,
        p95LatencyMs: input.p95LatencyMs ?? 0,
        p99LatencyMs: input.p99LatencyMs ?? 0,
        lastExecutedAt: input.lastExecutedAt ?? null,
        window1hTotal: input.window1hTotal ?? 0,
        window1hSuccess: input.window1hSuccess ?? 0,
        window24hTotal: input.window24hTotal ?? 0,
        window24hSuccess: input.window24hSuccess ?? 0,
        window7dTotal: input.window7dTotal ?? 0,
        window7dSuccess: input.window7dSuccess ?? 0,
        updatedAt: now,
      },
    })
    return toMetricRow(r as unknown as PrismaProgramMetric)
  }

  async getProgramMetrics(bindingId: string, programId?: string): Promise<ProgramMetricRow[]> {
    const rows = await this.p.programVersionMetric.findMany({
      where: { bindingId, ...(programId ? { programId } : {}) },
      orderBy: { programVersion: 'desc' },
    })
    return rows.map((r: PrismaProgramMetric) => toMetricRow(r))
  }

  async getProgramMetric(
    bindingId: string,
    programId: string,
    version: number,
  ): Promise<ProgramMetricRow | null> {
    const r = await this.p.programVersionMetric.findUnique({
      where: {
        bindingId_programId_programVersion: { bindingId, programId, programVersion: version },
      },
    })
    return r ? toMetricRow(r as unknown as PrismaProgramMetric) : null
  }
}
