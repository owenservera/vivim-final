export interface TraceSpan {
  id: string
  traceId: string
  parentId: string | null
  name: string
  startTime: number
  endTime?: number
  duration?: number
  status: 'ok' | 'error' | 'timeout'
  error?: string
  attrs: Record<string, unknown>
  engineId?: string
}

export interface CausalNode {
  id: string
  traceId: string
  parentId: string | null
  kind: 'selector' | 'parser' | 'result' | 'action' | 'error' | 'decision'
  engineId: string
  description: string
  input: unknown
  output: unknown
  duration?: number
  timestamp: number
}

export interface SystemTopology {
  engines: EngineDescriptor[]
  stores: StoreDescriptor[]
  capabilities: CapabilityDescriptor[]
  routes: RouteDescriptor[]
  timestamp: number
}

export interface EngineDescriptor {
  id: string
  kind: 'engine' | 'store' | 'capability' | 'route' | 'surface'
  layer?: string
  dependencies: string[]
  status: 'registered' | 'wired' | 'running' | 'error' | 'stopped'
  config: Record<string, unknown>
  health?: HealthState
  metadata: Record<string, unknown>
  registeredAt: number
  updatedAt: number
}

export interface HealthState {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown'
  score?: number
  lastCheck: number
  details?: Record<string, unknown>
}

export interface StoreDescriptor {
  id: string
  kind: 'store'
  layer?: string
  dependencies: string[]
  status: 'registered' | 'wired' | 'running' | 'error' | 'stopped'
  config: Record<string, unknown>
  metadata: Record<string, unknown>
  registeredAt: number
  updatedAt: number
}

export interface CapabilityDescriptor {
  id: string
  kind: 'capability'
  layer?: string
  dependencies: string[]
  status: 'registered' | 'wired' | 'running' | 'error' | 'stopped'
  config: Record<string, unknown>
  metadata: Record<string, unknown>
  registeredAt: number
  updatedAt: number
}

export interface RouteDescriptor {
  id: string
  kind: 'route'
  layer?: string
  dependencies: string[]
  status: 'registered' | 'wired' | 'running' | 'error' | 'stopped'
  config: Record<string, unknown>
  metadata: Record<string, unknown>
  registeredAt: number
  updatedAt: number
}

export interface SystemEvent {
  id: number
  kind: string
  engineId: string | null
  data: unknown
  createdAt: number
}

export interface KernelStore {
  batchInsertSpans(spans: Omit<TraceSpan, 'id'>[]): Promise<void>
  querySpans(traceId: string): Promise<TraceSpan[]>
  queryRecentSpans(limit: number): Promise<TraceSpan[]>
  querySpansByEngine(engineId: string, limit: number): Promise<TraceSpan[]>

  insertProvenanceNode(node: Omit<CausalNode, 'id' | 'timestamp'>): Promise<string>
  queryProvenanceByTrace(traceId: string): Promise<CausalNode[]>
  queryProvenanceByEngine(engineId: string, limit: number): Promise<CausalNode[]>
  queryProvenanceByKind(kind: string, limit: number): Promise<CausalNode[]>

  saveTopology(snapshot: SystemTopology): Promise<void>
  getLastTopology(): Promise<SystemTopology | null>

  upsertEngine(desc: EngineDescriptor): Promise<void>
  upsertStore(desc: StoreDescriptor): Promise<void>
  upsertCapability(desc: CapabilityDescriptor): Promise<void>
  getEngine(id: string): Promise<EngineDescriptor | null>
  listEngines(filter?: { layer?: string; kind?: string; status?: string }): Promise<EngineDescriptor[]>

  insertEvent(kind: string, engineId: string | null, data: unknown): Promise<void>
  queryRecentEvents(limit: number): Promise<SystemEvent[]>
}
