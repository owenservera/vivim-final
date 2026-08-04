// src/engines/stealth/stealth-module-engine.ts
// Unit 11.2 — StealthModuleEngine: registry + CDP injection pipeline.

import type { StructuredLogger } from '../logger.js'
import type { StealthCdpProxy } from './stealth-module.js'
import type { StealthProfileStore } from './stealth-profile-store.js'

export interface StealthModule {
  name: string
  detectionVector: string
  description: string
  priority: number
  apply(config: Record<string, unknown>, ctx: StealthContext): Promise<void>
  verify?(ctx: StealthContext): Promise<boolean>
}

export interface StealthContext {
  cdp: StealthCdpProxy
  slaveId: string
  logger?: StructuredLogger
}

export interface StealthModuleConfig {
  name: string
  enabled: boolean
  config: Record<string, unknown>
}

export interface StealthModuleProfile {
  id: string
  name: string
  modules: StealthModuleConfig[]
}

export class StealthModuleEngine {
  private modules = new Map<string, StealthModule>()
  private profiles = new Map<string, StealthModuleProfile>()
  private applied = new Map<string, Set<string>>()

  constructor(
    private store: StealthProfileStore,
    private logger?: StructuredLogger,
  ) {
    void this.loadProfiles()
  }

  private async loadProfiles(): Promise<void> {
    const rows = await this.store.getAllModuleProfiles()
    for (const row of rows) {
      const modules = JSON.parse(row.modulesJson) as StealthModuleConfig[]
      this.profiles.set(row.id, { id: row.id, name: row.name, modules })
    }
  }

  registerModule(module: StealthModule): void {
    this.modules.set(module.name, module)
  }

  getRegisteredModules(): string[] {
    return Array.from(this.modules.keys())
  }

  async applyProfile(slaveId: string, profileId: string, ctx: StealthContext): Promise<string[]> {
    const profile = this.profiles.get(profileId)
    if (!profile) {
      this.logger?.warn(`Stealth profile not found: ${profileId}`)
      return []
    }

    const applied: string[] = []
    const alreadyApplied = this.applied.get(slaveId) ?? new Set()

    // Sort by priority (lower = first)
    const sorted = [...profile.modules]
      .filter((m) => m.enabled)
      .sort((a, b) => {
        const modA = this.modules.get(a.name)
        const modB = this.modules.get(b.name)
        return (modA?.priority ?? 999) - (modB?.priority ?? 999)
      })

    for (const modConfig of sorted) {
      if (alreadyApplied.has(modConfig.name)) continue

      const mod = this.modules.get(modConfig.name)
      if (!mod) {
        this.logger?.warn(`Stealth module not registered: ${modConfig.name}`)
        continue
      }

      try {
        await mod.apply(modConfig.config, ctx)
        alreadyApplied.add(modConfig.name)
        applied.push(modConfig.name)

        if (mod.verify) {
          const ok = await mod.verify(ctx)
          if (!ok) {
            this.logger?.warn(`Stealth module verify failed: ${modConfig.name}`)
          }
        }
      } catch (err) {
        this.logger?.error(`Stealth module apply failed: ${modConfig.name}`, {
          error:
            err instanceof Error
              ? { message: err.message, stack: err.stack, name: err.name }
              : { message: String(err), name: 'UnknownError' },
        })
      }
    }

    this.applied.set(slaveId, alreadyApplied)
    return applied
  }

  getAppliedModules(slaveId: string): string[] {
    return Array.from(this.applied.get(slaveId) ?? [])
  }

  clearApplied(slaveId: string): void {
    this.applied.delete(slaveId)
  }
}
