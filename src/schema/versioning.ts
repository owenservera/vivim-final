// src/schema/versioning.ts
// Version management types — used by VersionManager and RegistrationAuditor.

export interface VersionConfig {
  id: string
  engineId: string
  currentVersion: number
  minVersion: number
  compatMapJson: string
}

export interface PromotionRule {
  id: string
  name: string
  criteria: string
  fromStatus: string
  toStatus: string
  autoPromote: boolean
  isActive: boolean
}

export interface DegradationRule {
  id: string
  name: string
  threshold: number
  action: string
  cooldownMs: number
  isActive: boolean
}

export interface ProviderManifestVersion {
  id: string
  providerId: string
  version: number
  hash: string
  contentJson: string
  changeSummary: string | null
  actor: string
  createdAt: number
}
