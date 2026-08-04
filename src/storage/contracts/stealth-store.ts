// src/storage/contracts/stealth-store.ts
// 11.3 — StealthProfile store contract: per-provider launch + module profiles
// and the global stealth policy. Persisted in DB, queryable by engines.

export type LaunchMode = 'cdp_minimal' | 'cdp_stealth' | 'attach' | 'extension' | 'hidden'

export interface LaunchProfileRow {
  id: string
  mode: string
  chromeArgsJson: string
  stealthProfileId: string | null
  attachPort: number | null
  extensionId: string | null
  windowSizeJson: string
  extraArgsJson: string
  createdAt: number
  updatedAt: number
}

export interface ModuleProfileRow {
  id: string
  name: string
  modulesJson: string
  createdAt: number
  updatedAt: number
}

export interface StealthPolicyRow {
  id: string
  defaultLaunchProfileId: string | null
  defaultModuleProfileId: string | null
  providerOverridesJson: string
}

export interface StealthPolicy {
  defaultProfileId: string | null
  providerOverrides: Record<string, string>
}

export interface StealthProfileStore {
  // Launch profiles
  getLaunchProfile(id: string): Promise<LaunchProfileRow | null>
  getAllLaunchProfiles(): Promise<LaunchProfileRow[]>
  upsertLaunchProfile(id: string, data: Partial<LaunchProfileRow>): Promise<void>
  deleteLaunchProfile(id: string): Promise<void>

  // Module profiles
  getModuleProfile(id: string): Promise<ModuleProfileRow | null>
  getAllModuleProfiles(): Promise<ModuleProfileRow[]>
  upsertModuleProfile(id: string, data: Partial<ModuleProfileRow>): Promise<void>
  deleteModuleProfile(id: string): Promise<void>

  // Policy
  getPolicy(): Promise<StealthPolicyRow | null>
  upsertPolicy(data: Partial<StealthPolicyRow>): Promise<void>
}
