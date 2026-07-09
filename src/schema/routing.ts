// src/schema/routing.ts
// Multi-provider routing types — used by Router subsystem.

export type RouteEventType = 'matched' | 'dispatched' | 'succeeded' | 'failed' | 'timeout'

export interface RouteSpec {
  id: string
  name: string
  criteria: string
  targetProviderIds: string[]
  strategy: string
  isActive: boolean
}

export interface RouteRequest {
  id: string
  specId: string
  capabilityId: string
  context: string
  matchedAt: number | null
}

export interface RouteTarget {
  id: string
  specId: string
  providerId: string
  priority: number
  weight: number
  isActive: boolean
}

export interface RouteEvent {
  id: string
  requestId: string
  targetId: string
  eventType: RouteEventType
  ts: number
}
