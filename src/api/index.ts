// src/api/index.ts
// API client barrel — single import for all API clients.
// Both frontend and CLI import from here.

// Re-export shared types so consumers don't need to know about shared/
export type {
  CompleteRequest,
  CompleteResponse,
  HealthResponse,
  LaunchVisibleRequest,
  LaunchVisibleResponse,
  ProfileEntry,
  ProfilesResponse,
  Source,
  VerifyRequest,
  VerifyResponse,
  WorkspaceGetResponse,
} from 'shared/api-types.ts'
export type { SetupClient, SetupClientOptions } from './setup-client.js'
export { createSetupClient } from './setup-client.js'
