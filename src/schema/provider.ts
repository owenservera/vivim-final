// src/schema/provider.ts
// Provider knowledge graph domain types — definitions, endpoints, accounts, parsers.

import type { PlanTier } from './core.js'

export interface ProviderDefinition {
  id: string
  slug: string
  displayName: string
  description: string | null
  category: string
  providerType: string
  isActive: boolean
  authType: string
  hasMultiAccount: boolean
  profileStrategy: string
  fleetConfigJson: string
  capabilitiesJson: string
  modelsJson: string
  createdAt: number
  updatedAt: number
}

export type ProviderTransport = 'browser' | 'api' | 'hybrid'

export interface ProviderEndpoint {
  id: string
  providerId: string
  url: string
  label: string
  endpointType: 'landing' | 'chat' | 'login' | 'api' | 'auth'
  isDefault: boolean
  selectorJson: string
}

export interface ProviderAccount {
  id: string
  providerId: string
  email: string
  planTier: PlanTier
  isDefault: boolean
  loginState: string
  isKind?: boolean
  loginAttempts?: number
  lastLoginAt?: number | null
  providerStateJson?: string
  debugPort?: number | null
  profileDir?: string | null
  chromeSlaveId?: string | null
}

export interface ProviderParser {
  id: string
  providerId: string
  parserName: string
  parserType: string
  isActive: boolean
  fallbackParserId: string | null
  parserHash?: string | null
  parserFilePath?: string | null
}
