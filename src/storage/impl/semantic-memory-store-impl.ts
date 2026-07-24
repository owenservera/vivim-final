// src/storage/impl/semantic-memory-store-impl.ts
// SemanticMemoryStoreImpl — Prisma-backed semantic memory store

import type { SemanticMemory, SemanticMemoryStore } from '../../engines/memory-engine.js'
import type { CapStoreDb } from '../db.js'

type PrismaLoose = Record<string, unknown>

export class SemanticMemoryStoreImpl implements SemanticMemoryStore {
  private db: PrismaLoose

  constructor(db: CapStoreDb) {
    this.db = db as unknown as PrismaLoose
  }

  private get p(): any {
    return this.db.prisma
  }

  async save(fact: SemanticMemory): Promise<void> {
    await this.p.semanticMemory.upsert({
      where: { id: fact.id },
      create: {
        id: fact.id,
        subject: fact.subject,
        predicate: fact.predicate,
        objectJson: JSON.stringify(fact.object),
        confidence: fact.confidence,
        source: fact.source,
        timestamp: fact.timestamp,
        expiresAt: fact.expiresAt ?? null,
        createdAt: Date.now(),
      },
      update: {},
    })
  }

  async findBySubject(subject: string, predicate?: string): Promise<SemanticMemory[]> {
    const where: PrismaLoose = { subject }
    if (predicate) where.predicate = predicate

    const rows = await this.p.semanticMemory.findMany({
      where,
      orderBy: { timestamp: 'desc' },
    })

    return (rows as PrismaLoose[]).map((r) => ({
      id: r.id as string,
      subject: r.subject as string,
      predicate: r.predicate as string,
      object: JSON.parse((r.object_json as string) ?? '{}') as unknown,
      confidence: r.confidence as number,
      source: r.source as string,
      timestamp: r.timestamp as number,
      expiresAt: (r.expires_at as number) ?? undefined,
    }))
  }

  async delete(id: string): Promise<void> {
    await this.p.semanticMemory.delete({ where: { id } })
  }

  async findAll(): Promise<SemanticMemory[]> {
    const rows = await this.p.semanticMemory.findMany({
      orderBy: { timestamp: 'desc' },
    })

    return (rows as PrismaLoose[]).map((r) => ({
      id: r.id as string,
      subject: r.subject as string,
      predicate: r.predicate as string,
      object: JSON.parse((r.object_json as string) ?? '{}') as unknown,
      confidence: r.confidence as number,
      source: r.source as string,
      timestamp: r.timestamp as number,
      expiresAt: (r.expires_at as number) ?? undefined,
    }))
  }

  async updateConfidence(id: string, confidence: number): Promise<void> {
    await this.p.semanticMemory.update({
      where: { id },
      data: { confidence },
    })
  }

  async update(
    id: string,
    patch: Partial<Pick<SemanticMemory, 'subject' | 'predicate' | 'object' | 'confidence'>>,
  ): Promise<void> {
    const data: PrismaLoose = {}
    if (patch.subject !== undefined) data.subject = patch.subject
    if (patch.predicate !== undefined) data.predicate = patch.predicate
    if (patch.object !== undefined) data.objectJson = JSON.stringify(patch.object)
    if (patch.confidence !== undefined) data.confidence = patch.confidence
    await this.p.semanticMemory.update({ where: { id }, data })
  }

  async findById(id: string): Promise<SemanticMemory | null> {
    const row = await this.p.semanticMemory.findUnique({ where: { id } })
    if (!row) return null
    return {
      id: row.id as string,
      subject: row.subject as string,
      predicate: row.predicate as string,
      object: JSON.parse((row.object_json as string) ?? '{}') as unknown,
      confidence: row.confidence as number,
      source: row.source as string,
      timestamp: row.timestamp as number,
      expiresAt: (row.expires_at as number) ?? undefined,
    }
  }
}
