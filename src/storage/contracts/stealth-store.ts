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
}

export interface ModuleProfileRow {
  id: string
  name: string
  modulesJson: string
}

export interface StealthPolicy {
  defaultProfileId: string | null
  providerOverrides: Record<string, string>
}

export interface StealthProfileStore {
  // Launch profiles
  getAllLaunchProfiles(): Promise<LaunchProfileRow[]>
  getLaunchProfile(id: string): Promise<LaunchProfileRow | null>
  upsertLaunchProfile(profile: LaunchProfileRow): Promise<void>
  deleteLaunchProfile(id: string): Promise<void>

  // Module profiles
  getAllModuleProfiles(): Promise<ModuleProfileRow[]>
  getModuleProfile(id: string): Promise<ModuleProfileRow | null>
  upsertModuleProfile(profile: ModuleProfileRow): Promise<void>
  deleteModuleProfile(id: string): Promise<void>

  // Policy
  getPolicy(): Promise<StealthPolicy | null>
  setPolicy(policy: StealthPolicy): Promise<void>
}
