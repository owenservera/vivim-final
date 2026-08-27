// src/storage/impl/capability-store-impl.ts
// Prisma-backed CapabilityStore for CapabilityEngine.

import { newId } from '../../ids.js'
import type {
  CapabilityBindingMatrixRow,
  CapabilityBindingRow,
  CapabilityProgramRow,
  CapabilityStore,
  CapabilityTaxonomyRow,
  DriftEventInput,
  OutcomeInput,
  OutcomeRow,
  SelectorStrategyRow,
  SnapshotRow,
} from '../contracts/capability-store.js'
import type { CapStoreDb } from '../db.js'
import type { PrismaClient } from '../prisma.js'

interface PrismaTaxonomy {
  id: string
  name: string
  slug: string
  category: string
  description: string | null
  inputType: string
  uiComponent: string
  uiLabel: string | null
  uiIcon: string | null
  uiPosition: string
  uiOrder: number
  uiLayerDepth: number
  parentCapabilityId: string | null
  uiGroup: string
  uiPriority: string
  interactionMode: string
  uiStatesJson: string
  uiVisibilityRule: string | null
  existentialRule: string | null
  uiInputSchema: string
  mutationEffectsJson: string
  recoveryBehavior: string
  statePersistence: string
  dataFlow: string
  minPlanTier: string
  dependsOnJson: string
  concurrencySafe: number
  opClassification: string | null
  requiresUserConfirmation: number
  maxResultSize: number
  resultComponent: string
  resultLayout: string
  searchHintsJson: string
  aliasesJson: string
  availabilityJson: string
  prefetch: number
  createdAt: bigint
  updatedAt: bigint
}

interface PrismaBinding {
  id: string
  globalId: string
  providerId: string
  status: string
  bestProgramId: string | null
  currentProgramId: string | null
  promotionHistoryJson: string
  confidence: number
  createdAt: bigint
  updatedAt: bigint
}

interface PrismaProgram {
  id: string
  bindingId: string
  version: number
  name: string | null
  supersededById: string | null
  isActive: number
  configJson: string
  createdAt: bigint
  updatedAt: bigint
}

interface PrismaSelector {
  id: string
  name: string
  capabilityId: string
  providerId: string
  selectorValue: string
  priority: number
  strategyType: string
  hitCount: number
  missCount: number
  isActive: number
  lastUsedAt: bigint | null
  createdAt: bigint
  updatedAt: bigint
}

function toTaxonomyRow(r: PrismaTaxonomy): CapabilityTaxonomyRow {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    category: r.category,
    description: r.description,
    inputType: r.inputType,
    uiComponent: r.uiComponent,
    uiLabel: r.uiLabel,
    uiIcon: r.uiIcon,
    uiPosition: r.uiPosition,
    uiOrder: r.uiOrder,
    uiLayerDepth: r.uiLayerDepth,
    parentCapabilityId: r.parentCapabilityId,
    uiGroup: r.uiGroup,
    uiPriority: r.uiPriority,
    interactionMode: r.interactionMode,
    uiStatesJson: r.uiStatesJson,
    uiVisibilityRule: r.uiVisibilityRule,
    existentialRule: r.existentialRule,
    uiInputSchema: r.uiInputSchema,
    mutationEffectsJson: r.mutationEffectsJson,
    recoveryBehavior: r.recoveryBehavior,
    statePersistence: r.statePersistence,
    dataFlow: r.dataFlow,
    minPlanTier: r.minPlanTier,
    dependsOnJson: r.dependsOnJson,
    concurrencySafe: r.concurrencySafe,
    opClassification: r.opClassification,
    requiresUserConfirmation: r.requiresUserConfirmation,
    maxResultSize: r.maxResultSize,
    resultComponent: r.resultComponent,
    resultLayout: r.resultLayout,
    searchHintsJson: r.searchHintsJson,
    aliasesJson: r.aliasesJson,
    availabilityJson: r.availabilityJson,
    prefetch: r.prefetch,
    createdAt: Number(r.createdAt),
    updatedAt: Number(r.updatedAt),
  }
}

function toBindingRow(r: PrismaBinding): CapabilityBindingRow {
  return {
    id: r.id,
    globalId: r.globalId,
    providerId: r.providerId,
    status: r.status,
    bestProgramId: r.bestProgramId,
    currentProgramId: r.currentProgramId,
    promotionHistoryJson: r.promotionHistoryJson,
    confidence: r.confidence,
    createdAt: Number(r.createdAt),
    updatedAt: Number(r.updatedAt),
  }
}

function toProgramRow(r: PrismaProgram): CapabilityProgramRow {
  return {
    id: r.id,
    bindingId: r.bindingId,
    version: r.version,
    name: r.name,
    supersededById: r.supersededById,
    isActive: r.isActive,
    status: r.isActive === 1 ? 'promoted' : 'candidate',
    configJson: r.configJson,
    createdAt: Number(r.createdAt),
    updatedAt: Number(r.updatedAt),
  }
}

function toSelectorRow(r: PrismaSelector): SelectorStrategyRow {
  return {
    id: r.id,
    name: r.name as string,
    capabilityId: r.capabilityId,
    providerId: r.providerId,
    selectorValue: r.selectorValue,
    priority: r.priority,
    strategyType: r.strategyType,
    isActive: r.isActive,
    hitCount: r.hitCount,
    missCount: r.missCount,
    lastUsedAt: r.lastUsedAt ? Number(r.lastUsedAt) : null,
    createdAt: Number(r.createdAt),
    updatedAt: Number(r.updatedAt),
  }
}

export class CapabilityStoreImpl implements CapabilityStore {
  private db: PrismaClient

  constructor(db: CapStoreDb) {
    this.db = db.prisma
  }

  private get p() {
    return this.db
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
        bindingId: outcome.bindingId ?? null,
        providerId: outcome.providerId,
        programId: outcome.programId ?? null,
        selectorStrategyId: outcome.selectorStrategyId ?? null,
        ok: outcome.ok,
        error: outcome.error ?? null,
        durationMs: outcome.durationMs ?? null,
        confidence: outcome.confidence ?? null,
        selectorUsed: outcome.selectorUsed ?? null,
        selectorHit: outcome.selectorHit ?? null,
        ts: now,
      },
    })
    return {
      id,
      capabilityId: outcome.capabilityId,
      bindingId: outcome.bindingId ?? null,
      providerId: outcome.providerId,
      programId: outcome.programId ?? null,
      selectorStrategyId: outcome.selectorStrategyId ?? null,
      ok: outcome.ok,
      error: outcome.error ?? null,
      durationMs: outcome.durationMs ?? null,
      confidence: outcome.confidence ?? null,
      selectorUsed: outcome.selectorUsed ?? null,
      selectorHit: outcome.selectorHit ?? null,
      ts: now,
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
        ...(patch.bestProgramId !== undefined ? { bestProgramId: patch.bestProgramId } : {}),
        ...(patch.currentProgramId !== undefined
          ? { currentProgramId: patch.currentProgramId }
          : {}),
        ...(patch.confidence !== undefined ? { confidence: patch.confidence } : {}),
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

  async loadSnapshot(providerIds: string[]): Promise<SnapshotRow[]> {
    if (providerIds.length === 0) return []
    const bindings = (await this.p.capabilityBinding.findMany({
      where: { providerId: { in: providerIds }, status: 'active' },
      include: { capability: true, programs: true },
    })) as Array<{
      globalId: string
      providerId: string
      status: string
      confidence: number
      bestProgramId: string | null
      currentProgramId: string | null
      capability: {
        id: string
        slug: string
        category: string
        uiComponent: string
        uiPosition: string
        uiInputSchema: string
      }
      programs: Array<{ id: string; configJson: string }>
    }>

    const rows: SnapshotRow[] = []
    for (const b of bindings) {
      const programId = b.bestProgramId ?? b.currentProgramId ?? null
      const program = programId ? (b.programs.find((p) => p.id === programId) ?? null) : null
      rows.push({
        globalId: b.globalId,
        slug: b.capability.slug,
        providerId: b.providerId,
        category: b.capability.category,
        status: b.status,
        confidence: b.confidence,
        programId,
        configJson: program?.configJson ?? null,
        uiComponent: b.capability.uiComponent,
        uiPosition: b.capability.uiPosition,
        uiInputSchema: b.capability.uiInputSchema,
      })
    }
    return rows
  }

  async listBindings(providers?: string[]): Promise<CapabilityBindingMatrixRow[]> {
    const where = providers?.length ? { providerId: { in: providers } } : {}
    const rows = await this.p.capabilityBinding.findMany({
      where,
      select: {
        id: true,
        globalId: true,
        providerId: true,
        status: true,
        confidence: true,
        capability: { select: { slug: true } },
        selectorHealthHistories: {
          select: { selector: { select: { selectorValue: true } } },
          take: 1,
          orderBy: { snapshotTs: 'desc' },
        },
      },
    })
    return rows.map(
      (r: {
        id: string
        globalId: string
        providerId: string
        status: string
        confidence: number
        capability: { slug: string }
        selectorHealthHistories: { selector: { selectorValue: string } }[]
      }) => ({
        id: r.id,
        globalId: r.globalId,
        providerId: r.providerId,
        status: r.status,
        confidence: r.confidence,
        capabilitySlug: r.capability.slug,
        selector: r.selectorHealthHistories[0]?.selector.selectorValue ?? '',
      }),
    )
  }

  async recordDrift(input: DriftEventInput): Promise<void> {
    await this.p.driftEvent.create({
      data: {
        id: input.id,
        providerId: input.providerId,
        capabilitySlug: input.capabilitySlug,
        selector: input.selector,
        status: input.status,
        detectedAt: Date.now(),
      },
    })
  }
}
