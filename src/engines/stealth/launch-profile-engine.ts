// src/engines/stealth/launch-profile-engine.ts
// 11.1 — LaunchProfileEngine: multi-mode launch strategy.
// Resolves per-provider launch profiles and builds Chrome args without the
// bot-signal flags that硬编码 buildChromeArgs used.

import { EngineError } from '../../errors.js'
import type { Logger } from '../../lib/logger.js'
import type { StealthProfileStore } from '../../storage/contracts/stealth-store.js'
import type { LaunchMode } from '../../storage/contracts/stealth-store.js'

export type { LaunchMode } from '../../storage/contracts/stealth-store.js'

export interface LaunchProfile {
  id: string
  mode: LaunchMode
  chromeArgs: string[]
  stealthProfileId: string | null
  attachPort: number | null
  extensionId: string | null
  windowSize: { width: number; height: number }
  extraArgs: string[]
}

export interface LaunchProfilePolicy {
  defaultProfileId: string
  providerOverrides: Record<string, string>
}

export class LaunchProfileEngine {
  private profiles = new Map<string, LaunchProfile>()

  constructor(
    private readonly store: StealthProfileStore,
    private readonly logger?: Logger,
  ) {
    void this.loadProfiles()
  }

  private async loadProfiles(): Promise<void> {
    try {
      const rows = await this.store.getAllLaunchProfiles()
      for (const row of rows) {
        this.profiles.set(row.id, this.mapRow(row))
      }
    } catch (err) {
      this.logger?.error('Failed to load launch profiles', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  async resolve(providerId: string): Promise<LaunchProfile> {
    const policy = await this.store.getPolicy()
    const overrides = policy?.providerOverridesJson
      ? (JSON.parse(policy.providerOverridesJson) as Record<string, string>)
      : {}
    const overrideId = overrides[providerId]
    const profileId = overrideId ?? policy?.defaultLaunchProfileId ?? 'default'
    const profile = this.profiles.get(profileId)
    if (!profile) return this.getDefaultProfile()
    return profile
  }

  buildArgs(profile: LaunchProfile, opts: { debugPort: number; profileDir: string }): string[] {
    switch (profile.mode) {
      case 'cdp_minimal':
        return this.buildMinimalArgs(opts)
      case 'cdp_stealth':
        return this.buildStealthArgs(profile, opts)
      case 'hidden':
        return this.buildHiddenArgs(profile, opts)
      case 'attach':
        return [] // attaching to an existing browser — no args
      case 'extension':
        return this.buildExtensionArgs(profile, opts)
      default:
        return this.buildMinimalArgs(opts)
    }
  }

  private buildMinimalArgs(opts: { debugPort: number; profileDir: string }): string[] {
    return [
      `--remote-debugging-port=${opts.debugPort}`,
      `--user-data-dir=${opts.profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
    ]
  }

  private buildStealthArgs(
    profile: LaunchProfile,
    opts: { debugPort: number; profileDir: string },
  ): string[] {
    const args = this.buildMinimalArgs(opts)
    args.push(...profile.chromeArgs)
    args.push('--window-position=-32000,-32000')
    args.push(`--window-size=${profile.windowSize.width},${profile.windowSize.height}`)
    return args
  }

  private buildHiddenArgs(
    profile: LaunchProfile,
    opts: { debugPort: number; profileDir: string },
  ): string[] {
    const args = this.buildMinimalArgs(opts)
    args.push('--window-position=-32000,-32000')
    args.push(`--window-size=${profile.windowSize.width},${profile.windowSize.height}`)
    return args
  }

  private buildExtensionArgs(
    profile: LaunchProfile,
    opts: { debugPort: number; profileDir: string },
  ): string[] {
    const args = this.buildMinimalArgs(opts)
    args.push(`--load-extension=${profile.extensionId ?? '/path/to/vivim-extension'}`)
    return args
  }

  private getDefaultProfile(): LaunchProfile {
    return {
      id: 'default',
      mode: 'cdp_minimal',
      chromeArgs: [],
      stealthProfileId: null,
      attachPort: null,
      extensionId: null,
      windowSize: { width: 1280, height: 720 },
      extraArgs: [],
    }
  }

  async registerProfile(profile: LaunchProfile): Promise<void> {
    this.profiles.set(profile.id, profile)
    const row = this.toRow(profile)
    await this.store.upsertLaunchProfile(row.id, row)
  }

  async updateProfile(id: string, patch: Partial<LaunchProfile>): Promise<void> {
    const existing = this.profiles.get(id)
    if (!existing) throw new EngineError(`Profile not found: ${id}`)
    const updated = { ...existing, ...patch }
    this.profiles.set(id, updated)
    const row = this.toRow(updated)
    await this.store.upsertLaunchProfile(row.id, row)
  }

  async deleteProfile(id: string): Promise<void> {
    this.profiles.delete(id)
    await this.store.deleteLaunchProfile(id)
  }

  listProfiles(): LaunchProfile[] {
    return [...this.profiles.values()]
  }

  getProfile(id: string): LaunchProfile | null {
    return this.profiles.get(id) ?? null
  }

  async reload(): Promise<void> {
    this.profiles.clear()
    await this.loadProfiles()
  }

  private mapRow(row: {
    id: string
    mode: string
    chromeArgsJson: string
    stealthProfileId: string | null
    attachPort: number | null
    extensionId: string | null
    windowSizeJson: string
    extraArgsJson: string
  }): LaunchProfile {
    return {
      id: row.id,
      mode: row.mode as LaunchMode,
      chromeArgs: parseJson(row.chromeArgsJson, []),
      stealthProfileId: row.stealthProfileId,
      attachPort: row.attachPort,
      extensionId: row.extensionId,
      windowSize: parseJson(row.windowSizeJson, { width: 1280, height: 720 }),
      extraArgs: parseJson(row.extraArgsJson, []),
    }
  }

  private toRow(profile: LaunchProfile): {
    id: string
    mode: string
    chromeArgsJson: string
    stealthProfileId: string | null
    attachPort: number | null
    extensionId: string | null
    windowSizeJson: string
    extraArgsJson: string
  } {
    return {
      id: profile.id,
      mode: profile.mode,
      chromeArgsJson: JSON.stringify(profile.chromeArgs),
      stealthProfileId: profile.stealthProfileId,
      attachPort: profile.attachPort,
      extensionId: profile.extensionId,
      windowSizeJson: JSON.stringify(profile.windowSize),
      extraArgsJson: JSON.stringify(profile.extraArgs),
    }
  }
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}
