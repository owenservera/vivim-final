// src/storage/impl/program-store-impl.ts
// Unit 22.2 - Prisma-backed ProgramStore implementation.
// Wraps CapabilityProgram / CapabilityBinding rows via the ProgramStore contract.

import type { CapStoreDb } from '../db.js'
import type { CapabilityProgramRow } from '../contracts/capability-store.js'
import type { ProgramStore, ProgramUpsert } from '../contracts/program-store.js'

const PROGRAM_STATUS = ['draft', 'candidate', 'promoted', 'failed'] as const

export class ProgramStoreImpl implements ProgramStore {
  constructor(private readonly db: CapStoreDb) {}

  private static toRow(p: {
    id: string
    bindingId: string
    version: number
    name: string | null
    supersededById: string | null
    isActive: number
    configJson: string
    createdAt: bigint
    updatedAt: bigint
  }): CapabilityProgramRow {
    return {
      id: p.id,
      bindingId: p.bindingId,
      version: p.version,
      status: p.isActive === 1 ? 'promoted' : 'candidate',
      configJson: p.configJson,
      createdAt: Number(p.createdAt),
      updatedAt: Number(p.updatedAt),
    }
  }

  async upsertProgram(input: ProgramUpsert): Promise<CapabilityProgramRow> {
    const id = input.bindingId ? `prog:${input.bindingId}:${input.version}` : `prog:${Date.now()}:${input.version}`
    const now = BigInt(Date.now())
    const row = await this.db.prisma.capabilityProgram.upsert({
      where: { id },
      create: {
        id,
        bindingId: input.bindingId,
        version: input.version,
        name: null,
        supersededById: null,
        isActive: input.status === 'promoted' ? 1 : 0,
        configJson: JSON.stringify(input.recipe),
        createdAt: now,
        updatedAt: now,
      },
      update: {
        version: input.version,
        isActive: input.status === 'promoted' ? 1 : 0,
        configJson: JSON.stringify(input.recipe),
        updatedAt: now,
      },
    })
    return ProgramStoreImpl.toRow(row)
  }

  async getProgramById(programId: string): Promise<CapabilityProgramRow | null> {
    const p = await this.db.prisma.capabilityProgram.findUnique({ where: { id: programId } })
    return p ? ProgramStoreImpl.toRow(p) : null
  }

  async getPrograms(bindingId: string): Promise<CapabilityProgramRow[]> {
    const rows = await this.db.prisma.capabilityProgram.findMany({
      where: { bindingId },
      orderBy: { version: 'desc' },
    })
    return rows.map(ProgramStoreImpl.toRow)
  }

  async getBestProgram(bindingId: string): Promise<CapabilityProgramRow | null> {
    const binding = await this.db.prisma.capabilityBinding.findFirst({
      where: { id: bindingId },
      select: { bestProgramId: true },
    })
    if (!binding?.bestProgramId) return null
    return this.getProgramById(binding.bestProgramId)
  }

  async setBestProgram(bindingId: string, programId: string): Promise<void> {
    await this.db.prisma.capabilityBinding.update({
      where: { id: bindingId },
      data: { bestProgramId: programId },
    })
  }

  async getBestProgramByCapability(
    capabilitySlug: string,
    providerId: string,
  ): Promise<CapabilityProgramRow | null> {
    const binding = await this.db.prisma.capabilityBinding.findFirst({
      where: {
        providerId,
        capability: { slug: capabilitySlug },
      },
      select: { bestProgramId: true, programs: { take: 1, select: { id: true } } },
    })
    const programId = binding?.bestProgramId ?? binding?.programs[0]?.id ?? null
    if (!programId) return null
    return this.getProgramById(programId)
  }
}
