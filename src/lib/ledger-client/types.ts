/**
 * Ledger Client — Types
 *
 * Type definitions for the cloud ↔ desktop ledger sync system.
 * Matches the API shapes from vivim-page/upload/API_SPEC.md.
 */

// ─── Configuration ──────────────────────────────────────────────

export interface LedgerClientConfig {
  /** Base URL of the ledger-service (e.g., "https://ledger.vivim.live") */
  baseUrl: string
  /** User's bearer token (from signup, stored locally) */
  userToken: string | null
  /** User's assigned subdomain (from signup, stored locally) */
  subdomain: string | null
  /** User ID (from signup, stored locally) */
  userId: string | null
  /** Ed25519 public key for chain verification (pinned in binary) */
  publicKeyHex: string
  /** Polling interval for incremental sync (ms) */
  syncIntervalMs: number
}

// ─── Signup ─────────────────────────────────────────────────────

export interface LedgerSignupRequest {
  email: string
}

export interface LedgerSignupResponse {
  userId: string
  token: string
  subdomain: string
  entitledProviderCount: number
}

// ─── Tunnel Token ───────────────────────────────────────────────

export interface LedgerTunnelTokenResponse {
  /** HS256 JWT for tunnel-gateway authentication */
  token: string
  /** Assigned subdomain (e.g., "user-a1b2c3") */
  subdomain: string
  /** Public URL where this subdomain lives (e.g., "https://user-a1b2c3.vivim.live/") */
  publicUrl: string
  /** WSS URL for tunnel-gateway connect (e.g., "wss://tunnel.vivim.live/connect") */
  connectUrl: string
  /** JWT lifetime in seconds */
  expiresIn: number
}

// ─── Ledger Sync ────────────────────────────────────────────────

export interface LedgerSyncResponse {
  entries: LedgerEntry[]
  hasMore: boolean
  newSyncCursor: string | null
}

export interface LedgerEntry {
  id: string
  providerId: string
  manifestFile: string
  version: number
  hash: string
  prevHash: string | null
  signature: string
  status: 'proposed' | 'verified' | 'deprecated' | 'challenged'
  contentJson: string
  changeSummary: string | null
  actor: string
  contributorId: string | null
  /** Epoch milliseconds */
  createdAt: number
}

// ─── Health ─────────────────────────────────────────────────────

export interface LedgerHealthResponse {
  chainLength: number
  lastHash: string | null
  publicKey: string
}

// ─── Providers ──────────────────────────────────────────────────

export interface LedgerProviderEntry {
  id: string
  slug: string
  name: string
  createdAt: string
  updatedAt: string
  manifestCount: number
  latestVersion: number | null
  latestHash: string | null
}

export interface LedgerProvidersResponse {
  providers: LedgerProviderEntry[]
}

// ─── Client State ───────────────────────────────────────────────

export type LedgerClientState = 'uninitialized' | 'signup-pending' | 'syncing' | 'synced' | 'error'

// ─── Manifest Content Shapes ────────────────────────────────────

/**
 * The contentJson field of a LedgerEntry contains one of these shapes.
 * The type field determines which local DB table to upsert.
 */
export type ManifestContent =
  | ProviderDefinitionContent
  | ProviderEndpointContent
  | ProviderParserContent
  | ProviderCapabilityContent
  | CapabilityBindingContent
  | CapabilityTaxonomyContent

export interface ProviderDefinitionContent {
  type: 'provider_definition'
  id: string
  slug: string
  name: string
  description?: string
  homepage?: string
  category?: string
}

export interface ProviderEndpointContent {
  type: 'provider_endpoint'
  id: string
  providerId: string
  endpointType: string
  url: string
  method: string
  headersJson?: string
}

export interface ProviderParserContent {
  type: 'provider_parser'
  id: string
  providerId: string
  parserName: string
  parserVersion: number
  logicCode: string
  logicType: string
  fallbackParserId?: string
}

export interface ProviderCapabilityContent {
  type: 'provider_capability'
  id: string
  providerId: string
  capabilitySlug: string
  capabilityType: string
  authScope: string
  description: string
}

export interface CapabilityBindingContent {
  type: 'capability_binding'
  id: string
  providerId: string
  capabilityId: string
  bindingConfig: string
}

export interface CapabilityTaxonomyContent {
  type: 'capability_taxonomy'
  id: string
  providerId: string
  platformCategory: string
  interactionPattern: string
  messageTypesJson: string
  capabilitiesJson: string
  constraintsJson: string
  authRequirementsJson: string
  discoveryHintsJson: string
  nlpEntityTypesJson: string
  nlpIntentPatternsJson: string
  entityHierarchyJson: string
  syncCapabilitiesJson: string
}
