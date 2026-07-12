// src/engines/stealth/stealth-profile-store.ts
// Unit 11.3 — Stealth profile store: per-provider profile config from DB.

import type { CapStoreDb } from '../../storage/db.js'

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

export class StealthProfileStore {
  constructor(private db: CapStoreDb) {}

  async getLaunchProfile(id: string): Promise<LaunchProfileRow | null> {
    return this.db.prisma.stealthLaunchProfile.findUnique({ where: { id } }) as any
  }

  async getAllLaunchProfiles(): Promise<LaunchProfileRow[]> {
    return this.db.prisma.stealthLaunchProfile.findMany() as any
  }

  async upsertLaunchProfile(id: string, data: Partial<LaunchProfileRow>): Promise<void> {
    await this.db.prisma.stealthLaunchProfile.upsert({
      where: { id },
      create: { id, mode: data.mode ?? 'cdp_stealth', ...data },
      update: data,
    })
  }

  async getModuleProfile(id: string): Promise<ModuleProfileRow | null> {
    return this.db.prisma.stealthModuleProfile.findUnique({ where: { id } }) as any
  }

  async getAllModuleProfiles(): Promise<ModuleProfileRow[]> {
    return this.db.prisma.stealthModuleProfile.findMany() as any
  }

  async upsertModuleProfile(id: string, data: Partial<ModuleProfileRow>): Promise<void> {
    await this.db.prisma.stealthModuleProfile.upsert({
      where: { id },
      create: { id, name: data.name ?? id, ...data },
      update: data,
    })
  }

  async getPolicy(): Promise<StealthPolicyRow | null> {
    return this.db.prisma.stealthPolicy.findUnique({ where: { id: 'default' } }) as any
  }

  async upsertPolicy(data: Partial<StealthPolicyRow>): Promise<void> {
    await this.db.prisma.stealthPolicy.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...data },
      update: data,
    })
  }
}
