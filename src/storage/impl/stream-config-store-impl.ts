// src/storage/impl/stream-config-store-impl.ts
// Prisma-backed StreamConfigStore for provider stream configuration.

import type {
  ProviderStreamConfigRow,
  StreamConfigStore,
} from '../contracts/stream-config-store.js'
import type { CapStoreDb } from '../db.js'

type PrismaLoose = any

interface PrismaStreamConfigRow {
  id: string
  providerId: string
  streamTransport: string
  streamTerminalJson: string
  sseFormat: string | null
  deltaPathJson: string | null
  contentType: string | null
  completionDetectorsJson: string
  harnessJs: string | null
  isActive: number
  version: number
  supersededById: string | null
  createdAt: number
  updatedAt: number
}

function toStreamConfigRow(r: PrismaStreamConfigRow): ProviderStreamConfigRow {
  return {
    id: r.id,
    providerId: r.providerId,
    streamTransport: r.streamTransport,
    streamTerminalJson: r.streamTerminalJson,
    sseFormat: r.sseFormat,
    deltaPathJson: r.deltaPathJson,
    contentType: r.contentType,
    completionDetectorsJson: r.completionDetectorsJson,
    harnessJs: r.harnessJs,
    isActive: r.isActive,
    version: r.version,
    supersededById: r.supersededById,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

export class StreamConfigStoreImpl implements StreamConfigStore {
  private db: PrismaLoose

  constructor(db: CapStoreDb) {
    this.db = db.loose
  }

  private get p() {
    return this.db.prisma
  }

  async getConfig(providerId: string, transport: string): Promise<ProviderStreamConfigRow | null> {
    const r = await this.p.providerStreamConfig.findFirst({
      where: { providerId, streamTransport: transport, isActive: 1 },
      orderBy: { version: 'desc' },
    })
    return r ? toStreamConfigRow(r as PrismaStreamConfigRow) : null
  }

  async getActiveConfig(providerId: string): Promise<ProviderStreamConfigRow | null> {
    const r = await this.p.providerStreamConfig.findFirst({
      where: { providerId, isActive: 1 },
      orderBy: { version: 'desc' },
    })
    return r ? toStreamConfigRow(r as PrismaStreamConfigRow) : null
  }

  async upsertConfig(config: ProviderStreamConfigRow): Promise<void> {
    const now = Date.now()
    await this.p.providerStreamConfig.upsert({
      where: {
        providerId_streamTransport_version: {
          providerId: config.providerId,
          streamTransport: config.streamTransport,
          version: config.version,
        },
      },
      create: {
        id: config.id,
        providerId: config.providerId,
        streamTransport: config.streamTransport,
        streamTerminalJson: config.streamTerminalJson,
        sseFormat: config.sseFormat,
        deltaPathJson: config.deltaPathJson,
        contentType: config.contentType,
        completionDetectorsJson: config.completionDetectorsJson,
        harnessJs: config.harnessJs,
        isActive: config.isActive,
        version: config.version,
        supersededById: config.supersededById,
        createdAt: config.createdAt || now,
        updatedAt: now,
      },
      update: {
        streamTerminalJson: config.streamTerminalJson,
        sseFormat: config.sseFormat,
        deltaPathJson: config.deltaPathJson,
        contentType: config.contentType,
        completionDetectorsJson: config.completionDetectorsJson,
        harnessJs: config.harnessJs,
        isActive: config.isActive,
        supersededById: config.supersededById,
        updatedAt: now,
      },
    })
  }

  async listConfigs(providerId: string): Promise<ProviderStreamConfigRow[]> {
    const rows = await this.p.providerStreamConfig.findMany({
      where: { providerId },
      orderBy: { version: 'desc' },
    })
    return (rows as PrismaStreamConfigRow[]).map(toStreamConfigRow)
  }

  async supersedeConfig(id: string, supersededById: string): Promise<void> {
    const now = Date.now()
    await this.p.providerStreamConfig.update({
      where: { id },
      data: {
        isActive: 0,
        supersededById,
        updatedAt: now,
      },
    })
  }
}
