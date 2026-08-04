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
  parserLogicType: string
  parserFilePath: string | null
  parserLogicCode: string | null
  parserHash: string | null
  sampleBody: string | null
  isActive: number
  fallbackParserId: string | null
  createdAt: number
  updatedAt: number
}

// Semver helpers (mirrors harness-command-registry). Parser versions are stored
// as a single integer, normalized to `X.0.0` for comparison so `@latest` and
// `providerId@N` resolve with numeric ordering, not lexicographic strings.
function parseSemver(v: string): [number, number, number] {
  const m = v.match(/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/)
  if (!m) return [0, 0, 0]
  return [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)]
}

function cmpSemver(a: string, b: string): number {
  const pa = parseSemver(a)
  const pb = parseSemver(b)
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return (pa[i] ?? 0) - (pb[i] ?? 0)
  }
  return 0
}

function toParserRow(r: PrismaParserRow): ProviderParserRow {
  return {
    id: r.id,
    providerId: r.providerId,
    name: r.name,
    version: r.version,
    logicType: r.parserLogicType,
    filePath: r.parserFilePath,
    logicCode: r.parserLogicCode,
    hash: r.parserHash ?? '',
    sampleBody: r.sampleBody ?? null,
    isActive: r.isActive,
    fallbackParserId: r.fallbackParserId,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

export class ParserStoreImpl implements ParserStore {
  private db: PrismaLoose

  constructor(db: CapStoreDb) {
    this.db = db.loose 
  }

  private get p() {
    return this.db.prisma
  }

  async getParser(providerId: string): Promise<ProviderParserRow | null> {
    const r = await this.p.providerParser.findFirst({
      where: { providerId },
      orderBy: { parserVersion: 'desc' },
    })
    return r ? toParserRow(r as PrismaParserRow) : null
  }

  async getActiveParser(providerId: string): Promise<ProviderParserRow | null> {
    const r = await this.p.providerParser.findFirst({
      where: { providerId, isActive: 1 },
    })
    return r ? toParserRow(r as PrismaParserRow) : null
  }

  async getParserByProviderAndVersion(
    providerId: string,
    version?: string,
  ): Promise<ProviderParserRow | null> {
    const rows = (await this.p.providerParser.findMany({
      where: { providerId },
      orderBy: { parserVersion: 'desc' },
    })) as PrismaParserRow[]

    if (rows.length === 0) return null

    // @latest (or omitted) → highest version that is active; fall back to the
    // highest version overall so resolution still works for inactive rows.
    if (!version || version === 'latest') {
      const active = rows.find((r) => r.isActive === 1)
      const chosen = active ?? rows[0]
      if (!chosen) return null
      return toParserRow(chosen)
    }

    const target = parseSemver(version)
    // Highest version <= target (semver-aware, not lexicographic).
    const candidates = rows
      .filter((r) => cmpSemver(`${r.version}.0.0`, `${target[0]}.0.0`) >= 0)
      .sort((a, b) => cmpSemver(`${b.version}.0.0`, `${a.version}.0.0`))
    const chosen = candidates[0] ?? rows[0]
    if (!chosen) return null
    return toParserRow(chosen)
  }

  async getParserById(id: string): Promise<ProviderParserRow | null> {
    const r = await this.p.providerParser.findFirst({ where: { id } })
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
        parserLogicType: parser.logicType,
        parserFilePath: parser.filePath,
        parserLogicCode: parser.logicCode,
        parserHash: parser.hash,
        sampleBody: parser.sampleBody,
        isActive: parser.isActive,
        fallbackParserId: parser.fallbackParserId,
        createdAt: parser.createdAt || now,
        updatedAt: now,
      },
      update: {
        name: parser.name,
        version: parser.version,
        parserLogicType: parser.logicType,
        parserFilePath: parser.filePath,
        parserLogicCode: parser.logicCode,
        parserHash: parser.hash,
        sampleBody: parser.sampleBody,
        isActive: parser.isActive,
        fallbackParserId: parser.fallbackParserId,
        updatedAt: now,
      },
    })
  }

  async listParsers(providerId: string): Promise<ProviderParserRow[]> {
    const rows = await this.p.providerParser.findMany({
      where: { providerId },
      orderBy: { parserVersion: 'desc' },
    })
    return (rows as PrismaParserRow[]).map(toParserRow)
  }

  async getParserByFile(filePath: string): Promise<ProviderParserRow | null> {
    const r = await this.p.providerParser.findFirst({
      where: { parserFilePath: filePath },
    })
    return r ? toParserRow(r as PrismaParserRow) : null
  }

  async getParserByHash(hash: string): Promise<ProviderParserRow | null> {
    const r = await this.p.providerParser.findFirst({
      where: { parserHash: hash },
    })
    return r ? toParserRow(r as PrismaParserRow) : null
  }

  async getGenericParser(): Promise<ProviderParserRow | null> {
    const r = await this.p.providerParser.findFirst({
      where: { providerId: 'generic', isActive: 1 },
    })
    return r ? toParserRow(r as PrismaParserRow) : null
  }

  async getSystemFallbackParser(): Promise<ProviderParserRow | null> {
    const r = await this.p.providerParser.findFirst({
      where: { providerId: 'system', isActive: 1 },
    })
    return r ? toParserRow(r as PrismaParserRow) : null
  }
}
