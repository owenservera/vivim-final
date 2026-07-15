// src/storage/impl/capability-store-impl.ts
// Prisma-backed CapabilityStore for CapabilityEngine.

import { newId } from '../../ids.js'
import type {
  CapabilityBindingRow,
  CapabilityProgramRow,
  CapabilityStore,
  CapabilityTaxonomyRow,
  OutcomeInput,
  OutcomeRow,
  SelectorStrategyRow,
} from '../contracts/capability-store.js'
import type { CapStoreDb } from '../db.js'

type PrismaLoose = Record<string, unknown>

interface PrismaTaxonomy {
  id: string
  slug: string
  name: string
  description: string | null
  kind: string
  createdAt: number
  updatedAt: number
}

interface PrismaBinding {
  id: string
  globalId: string
  providerId: string
  selectorStrategyId: string | null
  status: string
  healthScore: number
  lastSuccessAt: number | null
  lastFailureAt: number | null
  createdAt: number
  updatedAt: number
}

interface PrismaProgram {
  id: string
  bindingId: string
  version: number
  status: string
  configJson: string
  createdAt: number
  updatedAt: number
}

interface PrismaSelector {
  id: string
  name?: string
  capabilityId: string
  providerId: string
  selector: string
  priority: number
  strategyType: string
  hitCount: number
  missCount: number
  isActive: number
  lastUsedAt?: number | null
  createdAt: number
  updatedAt: number
}

function toTaxonomyRow(r: PrismaTaxonomy): CapabilityTaxonomyRow {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    kind: r.kind,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

function toBindingRow(r: PrismaBinding): CapabilityBindingRow {
  return {
    id: r.id,
    capabilityId: r.globalId,
    providerId: r.providerId,
    selectorStrategyId: r.selectorStrategyId,
    status: r.status,
    healthScore: r.healthScore,
    lastSuccessAt: r.lastSuccessAt,
    lastFailureAt: r.lastFailureAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

function toProgramRow(r: PrismaProgram): CapabilityProgramRow {
  return {
    id: r.id,
    bindingId: r.bindingId,
    version: r.version,
    status: r.status,
    configJson: r.configJson,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

function toSelectorRow(r: PrismaSelector): SelectorStrategyRow {
  return {
    id: r.id,
    name: r.name as string,
    capabilityId: r.capabilityId,
    providerId: r.providerId,
    selectorValue: r.selector,
    priority: r.priority,
    strategyType: r.strategyType as SelectorStrategyRow['strategyType'],
    isActive: Boolean(r.isActive),
    hitCount: r.hitCount,
    missCount: r.missCount,
    lastUsedAt: (r.lastUsedAt as number | null) ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

export class CapabilityStoreImpl implements CapabilityStore {
  private db: PrismaLoose

  constructor(db: CapStoreDb) {
    this.db = db as unknown as PrismaLoose
  }

  // biome-ignore lint/suspicious/noExplicitAny: Prisma escape hatch
  // biome-ignore lint/style/noNonNullAssertion: Array access within bounds
  private get p(): any {
    return this.db.prisma
  }

  async getCapability(id: string): Promise<CapabilityTaxonomyRow | null> {
    const r = await this.p.capabilityTaxonomy.findUnique({ where: { id } })
    return r ? toTaxonomyRow(r as PrismaTaxonomy) : null
  }

  async getCapabilityBySlug(slug: string): Promise<CapabilityTaxonomyRow | null> {
    const r = await this.p.capabilityTaxonomy.findUnique({ where: { slug } })
    return r ? toTaxonomyRow(r as PrismaTaxonomy) : null
  }

  async getBinding(capabilityId: string, providerId: string): Promise<CapabilityBindingRow | null> {
    const r = await this.p.capabilityBinding.findFirst({
      where: { globalId: capabilityId, providerId },
    })
    return r ? toBindingRow(r as PrismaBinding) : null
  }

  async getProgram(bindingId: string): Promise<CapabilityProgramRow | null> {
    const r = await this.p.capabilityProgram.findFirst({
      where: { bindingId },
      orderBy: { version: 'desc' },
    })
    return r ? toProgramRow(r as PrismaProgram) : null
  }

  async getPrograms(bindingId: string): Promise<CapabilityProgramRow[]> {
    const rows = await this.p.capabilityProgram.findMany({
      where: { bindingId },
      orderBy: { version: 'desc' },
    })
    return (rows as PrismaProgram[]).map(toProgramRow)
  }

  async getBestProgramByCapability(
    capabilitySlug: string,
    providerId: string,
  ): Promise<CapabilityProgramRow | null> {
    // The canonical binding key is (globalId=capabilitySlug, providerId). Resolve
    // that binding, then return its highest-version program (cap-store bestProgram).
    const binding = (await this.p.capabilityBinding.findFirst({
      where: { globalId: capabilitySlug, providerId },
    })) as PrismaBinding | null
    if (!binding) return null
    const r = await this.p.capabilityProgram.findFirst({
      where: { bindingId: binding.id },
      orderBy: { version: 'desc' },
    })
    return r ? toProgramRow(r as PrismaProgram) : null
  }

  async getSelectors(capabilityId: string, providerId: string): Promise<SelectorStrategyRow[]> {
    const rows = await this.p.selectorStrategy.findMany({
      where: { capabilityId, providerId, isActive: 1 },
      orderBy: { priority: 'asc' },
    })
    return (rows as PrismaSelector[]).map(toSelectorRow)
  }

  async createOutcome(outcome: OutcomeInput): Promise<OutcomeRow> {
    const id = newId()
    const now = Date.now()
    await this.p.outcome.create({
      data: {
        id,
        capabilityId: outcome.capabilityId,
        providerId: outcome.providerId,
        ok: outcome.ok ? 1 : 0,
        durationMs: outcome.latencyMs,
        error: outcome.error ?? null,
        selectorStrategyId: null,
        selectorUsed: null,
        selectorHit: null,
        ts: now,
      },
    })
    return {
      id,
      capabilityId: outcome.capabilityId,
      bindingId: outcome.bindingId ?? null,
      providerId: outcome.providerId,
      accountId: outcome.accountId,
      ok: outcome.ok,
      latencyMs: outcome.latencyMs,
      error: outcome.error ?? null,
      outputJson: outcome.outputJson ?? '',
      traceId: outcome.traceId,
      createdAt: now,
    }
  }

  async updateBindingHealth(
    bindingId: string,
    patch: Partial<CapabilityBindingRow>,
  ): Promise<void> {
    const now = Date.now()
    await this.p.capabilityBinding.update({
      where: { id: bindingId },
      data: {
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.healthScore !== undefined ? { healthScore: patch.healthScore } : {}),
        ...(patch.lastSuccessAt !== undefined ? { lastSuccessAt: patch.lastSuccessAt } : {}),
        ...(patch.lastFailureAt !== undefined ? { lastFailureAt: patch.lastFailureAt } : {}),
        updatedAt: now,
      },
    })
  }

  async updateSelectorHealth(selectorId: string, hit: boolean): Promise<void> {
    const now = Date.now()
    if (hit) {
      await this.p.selectorStrategy.update({
        where: { id: selectorId },
        data: { hitCount: { increment: 1 }, updatedAt: now },
      })
    } else {
      await this.p.selectorStrategy.update({
        where: { id: selectorId },
        data: { missCount: { increment: 1 }, updatedAt: now },
      })
    }
  }
}
