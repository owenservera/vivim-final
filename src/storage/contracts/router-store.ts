// src/storage/contracts/router-store.ts
// Contract: CRUD + query for Route (multi-provider dispatch) rows.

import type {
  RouteEventRow,
  RouteRequestRow,
  RouteSpecRow,
  RouteTargetRow,
} from '../../schema/types.js'

export interface RouterStore {
  listSpecs(opts?: {
    providerId?: string
    capabilityId?: string
    activeOnly?: boolean
  }): Promise<RouteSpecRow[]>
  getSpec(id: string): Promise<RouteSpecRow | null>
  createSpec(input: RouteSpecRow): Promise<RouteSpecRow>
  updateSpec(id: string, patch: Partial<RouteSpecRow>): Promise<void>
  deleteSpec(id: string): Promise<void>
  listTargets(specId: string): Promise<RouteTargetRow[]>
  createTarget(input: RouteTargetRow): Promise<RouteTargetRow>
  updateTarget(id: string, patch: Partial<RouteTargetRow>): Promise<void>
  createRequest(input: RouteRequestRow): Promise<RouteRequestRow>
  updateRequest(id: string, patch: Partial<RouteRequestRow>): Promise<void>
  createEvent(input: RouteEventRow): Promise<RouteEventRow>
  listRequests(
    specId: string,
    opts?: { limit?: number; offset?: number },
  ): Promise<RouteRequestRow[]>
  listEvents(requestId: string): Promise<RouteEventRow[]>
}
