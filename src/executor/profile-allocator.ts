// src/executor/profile-allocator.ts
// Chrome profile directory management — allocation, lifecycle, cleanup.

import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export const DEFAULT_PROFILE_BASE = 'chrome-profiles'

interface ProfileMeta {
  providerSlug: string
  accountId: string
  allocatedAt: string
  lastUsed: string
}

export class ProfileAllocator {
  private baseDir: string

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? DEFAULT_PROFILE_BASE
  }

  getPath(providerSlug: string, accountId: string): string {
    return join(this.baseDir, providerSlug, accountId)
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

  async list(): Promise<
    Array<{ providerSlug: string; accountId: string; path: string; lastUsed: Date }>
  > {
    const results: Array<{
      providerSlug: string
      accountId: string
      path: string
      lastUsed: Date
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

        if (existsSync(metaPath)) {
          try {
            const raw = await readFile(metaPath, 'utf-8')
            const meta: ProfileMeta = JSON.parse(raw)
            lastUsed = new Date(meta.lastUsed)
          } catch {
            // corrupted meta, use epoch
          }
        }

        results.push({
          providerSlug: provider.name,
          accountId: account.name,
          path: dir,
          lastUsed,
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
}
