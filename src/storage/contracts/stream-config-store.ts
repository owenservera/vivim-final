// src/storage/contracts/stream-config-store.ts
// StreamConfigStore — persistence contract for provider stream configuration.

export interface ProviderStreamConfigRow {
  id: string
  providerId: string
  streamTransport: string // 'sse' | 'batchexecute' | 'websocket' | 'sse-patch'
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

export interface StreamConfigStore {
  getConfig(providerId: string, transport: string): Promise<ProviderStreamConfigRow | null>
  getActiveConfig(providerId: string): Promise<ProviderStreamConfigRow | null>
  upsertConfig(config: ProviderStreamConfigRow): Promise<void>
  listConfigs(providerId: string): Promise<ProviderStreamConfigRow[]>
  supersedeConfig(id: string, supersededById: string): Promise<void>
}
