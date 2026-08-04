// src/executor/profile-allocator.ts
// Chrome profile directory management — allocation, lifecycle, cleanup.
//
// Enforces the invariant: for every (providerSlug, accountId) exactly one
// profile directory exists under chrome-profiles/<provider>/<account>, and it
// is the authenticated one. See specs/033-profile-cleanup/.

import { existsSync, lstatSync } from 'node:fs'
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

export const DEFAULT_PROFILE_BASE = 'chrome-profiles'

/**
 * Calculate the total size of a directory in bytes (best-effort, async).
 * Skips files that cannot be read (permissions, etc.).
 */
async function calcDirSize(dir: string): Promise<number> {
  let total = 0
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        total += await calcDirSize(full)
      } else {
        try {
          const s = await stat(full)
          total += s.size
        } catch {
          // skip unreadable files
        }
      }
    }
  } catch {
    // skip unreadable directories
  }
  return total
}

// Legacy / stray roots that may exist at repo root outside the canonical base.
// Mirrors scripts/cleanup-credentials.ps1 sweep list (the "stray" class in
// specs/033-profile-cleanup/research.md D1).
const LEGACY_ROOTS = [
  'chatgpt',
  'claude',
  'gemini',
  'deepseek',
  'prov_claude',
  'data/chrome-profiles',
]

export interface ProfileMeta {
  providerSlug: string
  accountId: string
  allocatedAt: string
  lastUsed: string
  crashCount?: number
  diskSizeBytes?: number
  lastAuthVerifiedAt?: string
}

export interface ProfileRecord {
  providerSlug: string
  accountId: string
  path: string
  hasCookies: boolean
  lastUsed: Date
  metaPresent: boolean
  liveSlave: boolean
  groupKey: string
}

export interface ProfileGroup {
  groupKey: string
  providerSlug: string
  accountId: string
  records: ProfileRecord[]
  authenticated: ProfileRecord[]
  keepCandidate: ProfileRecord | null
  removable: ProfileRecord[]
  warnings: string[]
}

export interface StrayRoot {
  path: string
  providerHint: string | null
  disposition: 'remove' | 'protect'
}

export interface CleanupPlan {
  generatedAt: string
  canonicalBase: string
  mode: 'dry-run' | 'enforce'
  groups: ProfileGroup[]
  strayRoots: StrayRoot[]
  summary: {
    providers: number
    groups: number
    keepCandidates: number
    removable: number
    protected: number
    stray: number
  }
}

export interface CleanupResult {
  removedPaths: string[]
  protectedPaths: string[]
  warnings: string[]
  errors: string[]
}

export interface PlanOpts {
  provider?: string
  account?: string
  liveSlavePaths?: Set<string>
}

export class ProfileAllocator {
  private baseDir: string

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? DEFAULT_PROFILE_BASE
  }

  /**
   * Sanitize a directory name component (e.g. email) for filesystem use.
   * Replaces @ with -at- to avoid Chrome --user-data-dir issues.
   */
  static sanitizeDirName(name: string): string {
    return name.replace(/@/g, '-at-')
  }

  getPath(providerSlug: string, accountId: string): string {
    return resolve(join(this.baseDir, providerSlug, ProfileAllocator.sanitizeDirName(accountId)))
  }

  /** Canonical single path for a (provider, account). Shared with ChromeSetupWizard. */
  canonicalPath(providerSlug: string, accountId: string): string {
    return this.getPath(providerSlug, accountId)
  }

  async allocate(providerSlug: string, accountId: string): Promise<string> {
    const dir = this.getPath(providerSlug, accountId)
    await mkdir(dir, { recursive: true })

    const metaPath = join(dir, '.profile-meta.json')
    if (!existsSync(metaPath)) {
      const now = new Date().toISOString()
      const meta: ProfileMeta = {
        providerSlug,
        accountId,
        allocatedAt: now,
        lastUsed: now,
      }
      await writeFile(metaPath, JSON.stringify(meta, null, 2))
    }

    return dir
  }

  async release(providerSlug: string, accountId: string): Promise<void> {
    const dir = this.getPath(providerSlug, accountId)
    const metaPath = join(dir, '.profile-meta.json')

    if (existsSync(metaPath)) {
      const raw = await readFile(metaPath, 'utf-8')
      const meta: ProfileMeta = JSON.parse(raw)
      meta.lastUsed = new Date().toISOString()
      await writeFile(metaPath, JSON.stringify(meta, null, 2))
    }
  }

  /**
   * Record a crash event for this profile and update disk footprint.
   * Called by FleetSupervisor when a slave transitions to 'crashed' status.
   */
  async recordCrash(providerSlug: string, accountId: string): Promise<void> {
    const dir = this.getPath(providerSlug, accountId)
    const metaPath = join(dir, '.profile-meta.json')

    if (existsSync(metaPath)) {
      const raw = await readFile(metaPath, 'utf-8')
      const meta: ProfileMeta = JSON.parse(raw)
      meta.crashCount = (meta.crashCount ?? 0) + 1
      meta.diskSizeBytes = await calcDirSize(dir)
      await writeFile(metaPath, JSON.stringify(meta, null, 2))
    }
  }

  /**
   * Update the profile's disk footprint and last auth verification timestamp.
   * Called after successful CDP session verification.
   */
  async recordAuthVerified(providerSlug: string, accountId: string): Promise<void> {
    const dir = this.getPath(providerSlug, accountId)
    const metaPath = join(dir, '.profile-meta.json')

    if (existsSync(metaPath)) {
      const raw = await readFile(metaPath, 'utf-8')
      const meta: ProfileMeta = JSON.parse(raw)
      meta.lastAuthVerifiedAt = new Date().toISOString()
      meta.diskSizeBytes = await calcDirSize(dir)
      await writeFile(metaPath, JSON.stringify(meta, null, 2))
    }
  }

  async list(): Promise<
    Array<{
      providerSlug: string
      accountId: string
      path: string
      lastUsed: Date
      crashCount: number
      diskSizeBytes: number
      lastAuthVerifiedAt: Date | null
    }>
  > {
    const results: Array<{
      providerSlug: string
      accountId: string
      path: string
      lastUsed: Date
      crashCount: number
      diskSizeBytes: number
      lastAuthVerifiedAt: Date | null
    }> = []

    if (!existsSync(this.baseDir)) return results

    const providers = await readdir(this.baseDir, { withFileTypes: true })
    for (const provider of providers) {
      if (!provider.isDirectory()) continue

      const accountsDir = join(this.baseDir, provider.name)
      const accounts = await readdir(accountsDir, { withFileTypes: true })
      for (const account of accounts) {
        if (!account.isDirectory()) continue

        const dir = join(accountsDir, account.name)
        const metaPath = join(dir, '.profile-meta.json')
        let lastUsed = new Date(0)
        let crashCount = 0
        let diskSizeBytes = 0
        let lastAuthVerifiedAt: Date | null = null

        if (existsSync(metaPath)) {
          try {
            const raw = await readFile(metaPath, 'utf-8')
            const meta: ProfileMeta = JSON.parse(raw)
            lastUsed = new Date(meta.lastUsed)
            crashCount = meta.crashCount ?? 0
            diskSizeBytes = meta.diskSizeBytes ?? 0
            lastAuthVerifiedAt = meta.lastAuthVerifiedAt ? new Date(meta.lastAuthVerifiedAt) : null
          } catch {
            // corrupted meta, use defaults
          }
        }

        results.push({
          providerSlug: provider.name,
          accountId: account.name,
          path: dir,
          lastUsed,
          crashCount,
          diskSizeBytes,
          lastAuthVerifiedAt,
        })
      }
    }

    return results
  }

  async clean(olderThanDays = 30): Promise<number> {
    const profiles = await this.list()
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000
    let removed = 0

    for (const profile of profiles) {
      if (profile.lastUsed.getTime() < cutoff) {
        try {
          await rm(profile.path, { recursive: true, force: true })
          removed++
        } catch {
          // best-effort removal
        }
      }
    }

    return removed
  }

  /**
   * True when the profile directory holds a persisted authenticated session.
   * Chrome stores cookies per-profile inside subdirectories:
   * - Modern Chrome (88+): `Default/Network/Cookies` or `Profile N/Network/Cookies`
   * - Legacy Chrome (<88): root-level `Cookies` or `Network/Cookies`
   *
   * We check all known positions because the cookie file presence (any size > 0)
   * is the source of truth for "is this provider authenticated" (FR-7/FR-8/FR-23).
   * Profile directories follow the canonical layout:
   *   chrome-profiles/<provider-slug>/<accountId>/Profile N/Network/Cookies
   */
  async isAuthenticated(profileDir: string): Promise<boolean> {
    if (!existsSync(profileDir)) return false

    // Legacy root-level cookie files (Chrome < 88)
    const rootCookies = ['Cookies', 'Cookies-journal', 'Network/Cookies']

    // Profile subdirectories (Default, Profile 1, Profile 2, etc.)
    const profileSubdirs = ['Default', 'Profile 1', 'Profile 2', 'Profile 3', 'Profile 4']

    for (const subdir of profileSubdirs) {
      const subdirCookies = [
        join(subdir, 'Cookies'),
        join(subdir, 'Cookies-journal'),
        join(subdir, 'Network', 'Cookies'),
      ]
      for (const cookieFile of [...rootCookies, ...subdirCookies]) {
        try {
          const full = join(profileDir, cookieFile)
          if (existsSync(full)) {
            const s = await stat(full)
            if (s.size > 0) return true
          }
        } catch {
          // keep checking other candidates
        }
      }
    }
    return false
  }

  /** True when the provider has no persisted authenticated session (FR-7). */
  async requiresFirstRun(profileDir: string): Promise<boolean> {
    return !(await this.isAuthenticated(profileDir))
  }

  /**
   * Heuristic: a running Chrome holds `SingletonLock` in its profile dir.
   * Enhanced with liveness verification:
   * - Unix: SingletonLock is a symlink when Chrome is alive; stale regular file after crash.
   * - Windows: SingletonLock is a regular file; verified via process PID check.
   * Used as a defense-in-depth guard against deleting a live slave.
   */
  async isLiveSlave(profileDir: string): Promise<boolean> {
    const lockPath = join(profileDir, 'SingletonLock')
    try {
      if (!existsSync(lockPath)) return false

      // On Unix, Chrome creates SingletonLock as a symlink to the profile dir.
      // After a crash, it remains as a regular file (stale).
      if (process.platform !== 'win32') {
        try {
          const stats = lstatSync(lockPath)
          if (!stats.isSymbolicLink()) return false // stale lock from crashed process
        } catch {
          return false
        }
      }

      // Verify the lock isn't orphaned by checking for a live Chrome process
      // holding this profile. Best-effort: if we can't verify, assume live.
      return await this.isLockHeldByProcess(profileDir)
    } catch {
      return false
    }
  }

  /**
   * Check if a Chrome process is actively holding the profile's SingletonLock.
   * On Windows: checks if any chrome.exe process has this profile dir in its command line.
   * On Unix: checks if the lock symlink target is still valid.
   */
  private async isLockHeldByProcess(profileDir: string): Promise<boolean> {
    try {
      if (process.platform === 'win32') {
        // Use Get-CimInstance to find Chrome processes with this profile dir
        const proc = Bun.spawnSync(
          [
            'powershell',
            '-NoProfile',
            '-Command',
            `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Select-Object -ExpandProperty CommandLine`,
          ],
          { stdout: 'pipe', stderr: 'pipe' },
        )
        const output = proc.stdout.toString().trim()
        if (!output) return false
        const profileNorm = profileDir.replace(/\\/g, '/').toLowerCase()
        return (
          output.toLowerCase().includes(profileNorm) ||
          output.toLowerCase().includes(profileNorm.replace(/\//g, '\\'))
        )
      }
      // Unix: lock symlink exists and is valid — assume live
      return true
    } catch {
      return true // best-effort: assume live if check fails
    }
  }

  /** Enumerate all profiles as ProfileRecords (with auth + live-slave flags). */
  async listRecords(liveSlavePaths?: Set<string>): Promise<ProfileRecord[]> {
    const list = await this.list()
    const recs: ProfileRecord[] = []
    for (const p of list) {
      recs.push({
        providerSlug: p.providerSlug,
        accountId: p.accountId,
        path: p.path,
        hasCookies: await this.isAuthenticated(p.path),
        lastUsed: p.lastUsed,
        metaPresent: existsSync(join(p.path, '.profile-meta.json')),
        liveSlave: liveSlavePaths?.has(resolve(p.path)) ?? false,
        groupKey: `${p.providerSlug}::${p.accountId}`,
      })
    }
    return recs
  }

  /**
   * Group records by (providerSlug, accountId) and select the keep-candidate:
   * authenticated with newest lastUsed; else newest lastUsed (flagged
   * needs-relogin). Live slaves are never marked removable.
   */
  buildGroups(records: ProfileRecord[]): ProfileGroup[] {
    const map = new Map<string, ProfileRecord[]>()
    for (const r of records) {
      const arr = map.get(r.groupKey) ?? []
      arr.push(r)
      map.set(r.groupKey, arr)
    }

    const groups: ProfileGroup[] = []
    for (const [groupKey, recs] of map) {
      const [providerSlug, accountId] = groupKey.split('::')
      const authenticated = recs.filter((r) => r.hasCookies)
      const warnings: string[] = []
      let keepCandidate: ProfileRecord | null = null

      const byNewest = (a: ProfileRecord, b: ProfileRecord) =>
        b.lastUsed.getTime() - a.lastUsed.getTime()
      if (authenticated.length >= 1) {
        const sorted = [...authenticated].sort(byNewest)
        keepCandidate = sorted[0] ?? null
      } else if (recs.length >= 1) {
        const sorted = [...recs].sort(byNewest)
        keepCandidate = sorted[0] ?? null
        warnings.push(
          `no authenticated profile for ${groupKey}; keeping most-recently-used (needs relogin)`,
        )
      }

      const keepPath = keepCandidate?.path
      let removable = keepPath ? recs.filter((r) => r.path !== keepPath) : []
      const protectedLive = removable.filter((r) => r.liveSlave)
      removable = removable.filter((r) => !r.liveSlave)
      for (const p of protectedLive) warnings.push(`protected live slave: ${p.path}`)

      groups.push({
        groupKey,
        providerSlug: providerSlug!,
        accountId: accountId!,
        records: recs,
        authenticated,
        keepCandidate,
        removable,
        warnings,
      })
    }
    return groups
  }

  /** Find stray top-level provider dirs at repo root outside the canonical base. */
  async findStrayRoots(): Promise<StrayRoot[]> {
    const repoRoot = resolve(this.baseDir, '..')
    const canonicalAbs = resolve(this.baseDir)
    const out: StrayRoot[] = []
    for (const name of LEGACY_ROOTS) {
      const p = resolve(repoRoot, name)
      if (!existsSync(p)) continue
      if (resolve(p) === canonicalAbs) continue
      const top = name.split('/')[0] ?? ''
      const isDiscovery = name.includes('discovery')
      out.push({
        path: p,
        providerHint: /^[a-z0-9]+$/i.test(top) ? top : null,
        disposition: isDiscovery ? 'protect' : 'remove',
      })
    }
    return out
  }

  /**
   * Build the (read-only) cleanup plan. `liveSlavePaths` is the set of profile
   * dirs currently bound to a running Chrome (computed by the caller, e.g. via
   * ProviderAccount.debugPort CDP ping) so the plan can mark them protected.
   */
  async plan(opts?: PlanOpts): Promise<CleanupPlan> {
    let records = await this.listRecords(opts?.liveSlavePaths)
    if (opts?.provider) records = records.filter((r) => r.providerSlug === opts.provider)
    if (opts?.account) {
      const sane = ProfileAllocator.sanitizeDirName(opts.account)
      records = records.filter((r) => r.accountId === sane)
    }
    const groups = this.buildGroups(records)
    const strayRoots = await this.findStrayRoots()

    const protectedCount = groups.reduce(
      (n, g) => n + g.removable.filter((r) => r.liveSlave).length,
      0,
    )

    return {
      generatedAt: new Date().toISOString(),
      canonicalBase: resolve(this.baseDir),
      mode: 'dry-run',
      groups,
      strayRoots,
      summary: {
        providers: new Set(groups.map((g) => g.providerSlug)).size,
        groups: groups.length,
        keepCandidates: groups.filter((g) => g.keepCandidate).length,
        removable: groups.reduce((n, g) => n + g.removable.length, 0),
        protected: protectedCount,
        stray: strayRoots.length,
      },
    }
  }

  /**
   * Adopt the single existing profile for (provider, account) if one exists —
   * authenticated preferred. Used by ChromeSetupWizard so it never creates a
   * second directory (FR-016).
   */
  async findExisting(
    providerSlug: string,
    accountId: string,
    liveSlavePaths?: Set<string>,
  ): Promise<ProfileRecord | null> {
    const groups = this.buildGroups(await this.listRecords(liveSlavePaths))
    const sane = ProfileAllocator.sanitizeDirName(accountId)
    const g = groups.find((x) => x.providerSlug === providerSlug && x.accountId === sane)
    return g?.keepCandidate ?? null
  }

  /**
   * Apply a plan: remove every `removable` record and every `remove`-disposition
   * stray root, protecting live slaves (SingletonLock) and the `discovery` group.
   * Best-effort per removal; records protected/best-effort failures in result.
   * Pure read side-effects only — never touches the DB (FR-008 snapshot is the
   * caller's responsibility).
   */
  async enforce(plan: CleanupPlan): Promise<CleanupResult> {
    const result: CleanupResult = { removedPaths: [], protectedPaths: [], warnings: [], errors: [] }

    for (const g of plan.groups) {
      if (g.providerSlug === 'discovery') continue
      if (!g.keepCandidate) continue
      for (const r of g.removable) {
        if (await this.isLiveSlave(r.path)) {
          result.protectedPaths.push(r.path)
          result.warnings.push(`protected live slave: ${r.path}`)
          continue
        }
        try {
          await rm(r.path, { recursive: true, force: true })
          result.removedPaths.push(r.path)
        } catch (e) {
          result.errors.push(`failed to remove ${r.path}: ${(e as Error).message}`)
        }
      }
    }

    for (const s of plan.strayRoots) {
      if (s.disposition === 'protect') {
        result.protectedPaths.push(s.path)
        continue
      }
      if (await this.isLiveSlave(s.path)) {
        result.protectedPaths.push(s.path)
        result.warnings.push(`protected live stray: ${s.path}`)
        continue
      }
      try {
        await rm(s.path, { recursive: true, force: true })
        result.removedPaths.push(s.path)
      } catch (e) {
        result.errors.push(`failed to remove ${s.path}: ${(e as Error).message}`)
      }
    }

    return result
  }
}
