// src/api/index.ts
// API client barrel — single import for all API clients.
// Both frontend and CLI import from here.

export { createSetupClient } from './setup-client.js'
export type { SetupClient, SetupClientOptions } from './setup-client.js'

// Re-export shared types so consumers don't need to know about shared/
export type {
  Source,
  WorkspaceGetResponse,
  LaunchVisibleRequest,
  LaunchVisibleResponse,
  VerifyRequest,
  VerifyResponse,
  CompleteRequest,
  CompleteResponse,
  ProfileEntry,
  ProfilesResponse,
  HealthResponse,
} from 'shared/api-types.ts'
