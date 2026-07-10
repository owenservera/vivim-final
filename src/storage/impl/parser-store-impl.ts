// src/storage/impl/parser-store-impl.ts
// Prisma-backed ParserStore for StreamParserEngine.

import type { ParserStore, ProviderParserRow } from '../contracts/parser-store.js'
import type { CapStoreDb } from '../db.js'

type PrismaLoose = Record<string, unknown>

interface PrismaParserRow {
  id: string
  providerId: string
  name: string
  version: number
  filePath: string
  hash: string
  isActive: number
  createdAt: number
  updatedAt: number
}

function toParserRow(r: PrismaParserRow): ProviderParserRow {
  return {
    id: r.id,
    providerId: r.providerId,
    name: r.name,
    version: r.version,
    filePath: r.filePath,
    hash: r.hash,
    isActive: r.isActive,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

export class ParserStoreImpl implements ParserStore {
  private db: PrismaLoose

  constructor(db: CapStoreDb) {
    this.db = db as unknown as PrismaLoose
  }

  // biome-ignore lint/suspicious/noExplicitAny: Prisma escape hatch
  private get p(): any {
    return this.db.prisma
  }

  async getParser(providerId: string): Promise<ProviderParserRow | null> {
    const r = await this.p.providerParser.findFirst({
      where: { providerId },
      orderBy: { version: 'desc' },
    })
    return r ? toParserRow(r as PrismaParserRow) : null
  }

  async getActiveParser(providerId: string): Promise<ProviderParserRow | null> {
    const r = await this.p.providerParser.findFirst({
      where: { providerId, isActive: 1 },
    })
    return r ? toParserRow(r as PrismaParserRow) : null
  }

  async upsertParser(parser: ProviderParserRow): Promise<void> {
    const now = Date.now()
    await this.p.providerParser.upsert({
      where: { id: parser.id },
      create: {
        id: parser.id,
        providerId: parser.providerId,
        name: parser.name,
        version: parser.version,
        filePath: parser.filePath,
        hash: parser.hash,
        isActive: parser.isActive,
        createdAt: parser.createdAt || now,
        updatedAt: now,
      },
      update: {
        name: parser.name,
        version: parser.version,
        filePath: parser.filePath,
        hash: parser.hash,
        isActive: parser.isActive,
        updatedAt: now,
      },
    })
  }

  async listParsers(providerId: string): Promise<ProviderParserRow[]> {
    const rows = await this.p.providerParser.findMany({
      where: { providerId },
      orderBy: { version: 'desc' },
    })
    return (rows as PrismaParserRow[]).map(toParserRow)
  }

  async getParserByFile(filePath: string): Promise<ProviderParserRow | null> {
    const r = await this.p.providerParser.findFirst({
      where: { filePath },
    })
    return r ? toParserRow(r as PrismaParserRow) : null
  }
}
