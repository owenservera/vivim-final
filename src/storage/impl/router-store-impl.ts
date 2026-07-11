// src/storage/impl/router-store-impl.ts
// Prisma-backed RouterStore for multi-provider dispatch routing.

import type {
  RouteEventRow,
  RouteRequestRow,
  RouteSpecRow,
  RouteTargetRow,
} from '../../schema/types.js'
import type { RouterStore } from '../contracts/router-store.js'
import type { CapStoreDb } from '../db.js'

export class RouterStoreImpl implements RouterStore {
  constructor(private db: CapStoreDb) {}

  async listSpecs(opts?: {
    providerId?: string
    capabilityId?: string
    activeOnly?: boolean
  }): Promise<RouteSpecRow[]> {
    const rows = await this.db.prisma.routeSpec.findMany({
      where: {
        ...(opts?.providerId ? { providerId: opts.providerId } : {}),
        ...(opts?.capabilityId ? { capabilityId: opts.capabilityId } : {}),
        ...(opts?.activeOnly ? { isActive: 1 } : {}),
      },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      provider_id: r.providerId,
      capability_id: r.capabilityId,
      is_active: r.isActive,
      config_json: r.configJson,
      created_at: r.createdAt,
      updated_at: r.updatedAt,
    }))
  }

  async getSpec(id: string): Promise<RouteSpecRow | null> {
    const r = await this.db.prisma.routeSpec.findUnique({ where: { id } })
    if (!r) return null
    return {
      id: r.id,
      name: r.name,
      provider_id: r.providerId,
      capability_id: r.capabilityId,
      is_active: r.isActive,
      config_json: r.configJson,
      created_at: r.createdAt,
      updated_at: r.updatedAt,
    }
  }

  async createSpec(input: RouteSpecRow): Promise<RouteSpecRow> {
    await this.db.prisma.routeSpec.create({
      data: {
        id: input.id,
        name: input.name,
        providerId: input.provider_id,
        capabilityId: input.capability_id,
        isActive: input.is_active,
        configJson: input.config_json,
        createdAt: input.created_at,
        updatedAt: input.updated_at,
      },
    })
    return input
  }

  async updateSpec(id: string, patch: Partial<RouteSpecRow>): Promise<void> {
    await this.db.prisma.routeSpec.update({
      where: { id },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.provider_id !== undefined ? { providerId: patch.provider_id } : {}),
        ...(patch.capability_id !== undefined ? { capabilityId: patch.capability_id } : {}),
        ...(patch.is_active !== undefined ? { isActive: patch.is_active } : {}),
        ...(patch.config_json !== undefined ? { configJson: patch.config_json } : {}),
        updatedAt: Date.now(),
      },
    })
  }

  async deleteSpec(id: string): Promise<void> {
    await this.db.prisma.routeSpec.delete({ where: { id } })
  }

  async listTargets(specId: string): Promise<RouteTargetRow[]> {
    const rows = await this.db.prisma.routeTarget.findMany({
      where: { routeSpecId: specId },
      orderBy: { priority: 'asc' },
    })
    return rows.map((r) => ({
      id: r.id,
      route_spec_id: r.routeSpecId,
      provider_id: r.providerId,
      account_id: r.accountId,
      priority: r.priority,
      is_active: r.isActive,
      created_at: r.createdAt,
    }))
  }

  async createTarget(input: RouteTargetRow): Promise<RouteTargetRow> {
    await this.db.prisma.routeTarget.create({
      data: {
        id: input.id,
        routeSpecId: input.route_spec_id,
        providerId: input.provider_id,
        accountId: input.account_id,
        priority: input.priority,
        isActive: input.is_active,
        createdAt: input.created_at,
      },
    })
    return input
  }

  async updateTarget(id: string, patch: Partial<RouteTargetRow>): Promise<void> {
    await this.db.prisma.routeTarget.update({
      where: { id },
      data: {
        ...(patch.provider_id !== undefined ? { providerId: patch.provider_id } : {}),
        ...(patch.account_id !== undefined ? { accountId: patch.account_id } : {}),
        ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
        ...(patch.is_active !== undefined ? { isActive: patch.is_active } : {}),
      },
    })
  }

  async createRequest(input: RouteRequestRow): Promise<RouteRequestRow> {
    await this.db.prisma.routeRequest.create({
      data: {
        id: input.id,
        routeSpecId: input.route_spec_id,
        conversationId: input.conversation_id,
        status: input.status,
        resultJson: input.result_json,
        ts: input.ts,
      },
    })
    return input
  }

  async updateRequest(id: string, patch: Partial<RouteRequestRow>): Promise<void> {
    await this.db.prisma.routeRequest.update({
      where: { id },
      data: {
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.result_json !== undefined ? { resultJson: patch.result_json } : {}),
      },
    })
  }

  async createEvent(input: RouteEventRow): Promise<RouteEventRow> {
    await this.db.prisma.routeEvent.create({
      data: {
        id: input.id,
        routeRequestId: input.route_request_id,
        eventType: input.event_type,
        eventDataJson: input.event_data_json,
        ts: input.ts,
      },
    })
    return input
  }

  async listRequests(
    specId: string,
    opts?: { limit?: number; offset?: number },
  ): Promise<RouteRequestRow[]> {
    const rows = await this.db.prisma.routeRequest.findMany({
      where: { routeSpecId: specId },
      orderBy: { ts: 'desc' },
      take: opts?.limit ?? 50,
      skip: opts?.offset ?? 0,
    })
    return rows.map((r) => ({
      id: r.id,
      route_spec_id: r.routeSpecId,
      conversation_id: r.conversationId,
      status: r.status,
      result_json: r.resultJson,
      ts: r.ts,
    }))
  }

  async listEvents(requestId: string): Promise<RouteEventRow[]> {
    const rows = await this.db.prisma.routeEvent.findMany({
      where: { routeRequestId: requestId },
      orderBy: { ts: 'asc' },
    })
    return rows.map((r) => ({
      id: r.id,
      route_request_id: r.routeRequestId,
      event_type: r.eventType,
      event_data_json: r.eventDataJson,
      ts: r.ts,
    }))
  }
}
