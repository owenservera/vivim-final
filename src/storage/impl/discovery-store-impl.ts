import type {
  DiscoveryObservationRow,
  DiscoverySessionRow,
  DiscoveryStore,
} from '../contracts/discovery-store.js'
import type { CapStoreDb } from '../db.js'

export class DiscoveryStoreImpl implements DiscoveryStore {
  constructor(private db: CapStoreDb) {}

  async createSession(row: DiscoverySessionRow): Promise<void> {
    await this.db.prisma.discoverySession.create({
      data: {
        id: row.id,
        url: row.url,
        status: row.status,
        shapeId: row.shapeId,
        confidence: row.confidence,
        capabilitiesJson: row.capabilitiesJson,
        interactiveJson: row.interactiveJson,
        parserFormat: row.parserFormat,
        manifestDraftJson: row.manifestDraftJson,
        error: row.error,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    })
  }

  async updateSession(id: string, updates: Partial<DiscoverySessionRow>): Promise<void> {
    const data: Record<string, unknown> = {}
    if (updates.url !== undefined) data.url = updates.url
    if (updates.status !== undefined) data.status = updates.status
    if (updates.shapeId !== undefined) data.shapeId = updates.shapeId
    if (updates.confidence !== undefined) data.confidence = updates.confidence
    if (updates.capabilitiesJson !== undefined) data.capabilitiesJson = updates.capabilitiesJson
    if (updates.interactiveJson !== undefined) data.interactiveJson = updates.interactiveJson
    if (updates.parserFormat !== undefined) data.parserFormat = updates.parserFormat
    if (updates.manifestDraftJson !== undefined) data.manifestDraftJson = updates.manifestDraftJson
    if (updates.error !== undefined) data.error = updates.error
    if (updates.agentId !== undefined) data.agentId = updates.agentId
    data.updatedAt = Date.now()

    await this.db.prisma.discoverySession.update({ where: { id }, data })
  }

  async getSession(id: string): Promise<DiscoverySessionRow | null> {
    const row = await this.db.prisma.discoverySession.findUnique({ where: { id } })
    if (!row) return null
    return this.toSessionRow(row)
  }

  async listSessions(opts?: { status?: string; limit?: number }): Promise<DiscoverySessionRow[]> {
    const rows = await this.db.prisma.discoverySession.findMany({
      where: opts?.status ? { status: opts.status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: opts?.limit ?? 50,
    })
    return rows.map((r) => this.toSessionRow(r))
  }

  async deleteSession(id: string): Promise<void> {
    await this.db.prisma.discoverySession.delete({ where: { id } }).catch(() => {})
  }

  async createObservation(row: DiscoveryObservationRow): Promise<void> {
    // Store observations using discoveryResult table as a proxy
    await this.db.prisma.discoveryResult.create({
      data: {
        id: row.id,
        sessionId: row.sessionId,
        providerId: null,
        manifestJson: JSON.stringify({
          url: row.url,
          method: row.method,
          status: row.status,
          resourceType: row.resourceType,
          requestHeadersJson: row.requestHeadersJson,
          requestBodyJson: row.requestBodyJson,
          responseHeadersJson: row.responseHeadersJson,
          responseBodyPreview: row.responseBodyPreview,
          durationMs: row.durationMs,
        }),
        status: 'observation',
        createdAt: row.createdAt,
      },
    })
  }

  async getObservations(
    sessionId: string,
    opts?: { limit?: number },
  ): Promise<DiscoveryObservationRow[]> {
    const rows = await this.db.prisma.discoveryResult.findMany({
      where: { sessionId, status: 'observation' },
      orderBy: { createdAt: 'asc' },
      take: opts?.limit ?? 100,
    })
    return rows.map((r) => {
      const data = JSON.parse(r.manifestJson ?? '{}') as Record<string, unknown>
      return {
        id: r.id,
        sessionId: r.sessionId,
        url: (data.url as string) ?? '',
        method: (data.method as string) ?? '',
        status: (data.status as number) ?? 0,
        resourceType: (data.resourceType as string) ?? '',
        requestHeadersJson: (data.requestHeadersJson as string) ?? '{}',
        requestBodyJson: (data.requestBodyJson as string) ?? null,
        responseHeadersJson: (data.responseHeadersJson as string) ?? '{}',
        responseBodyPreview: (data.responseBodyPreview as string) ?? null,
        durationMs: (data.durationMs as number) ?? null,
        createdAt: r.createdAt,
      }
    })
  }

  async deleteObservations(sessionId: string): Promise<void> {
    await this.db.prisma.discoveryResult.deleteMany({
      where: { sessionId, status: 'observation' },
    })
  }

  private toSessionRow(row: {
    id: string
    url: string
    status: string
    shapeId: string | null
    confidence: number
    capabilitiesJson: string
    interactiveJson: string
    parserFormat: string | null
    manifestDraftJson: string | null
    error: string | null
    createdAt: number
    updatedAt: number
  }): DiscoverySessionRow {
    return {
      id: row.id,
      url: row.url,
      status: row.status,
      shapeId: row.shapeId,
      confidence: row.confidence,
      capabilitiesJson: row.capabilitiesJson,
      interactiveJson: row.interactiveJson,
      parserFormat: row.parserFormat,
      manifestDraftJson: row.manifestDraftJson,
      error: row.error,
      agentId: null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }
}
