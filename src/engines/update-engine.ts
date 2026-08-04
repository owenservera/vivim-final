/**
 * UpdateEngine — Auto-updater for Vivim Desktop
 *
 * Supports:
 * - App updates (full binary replacement)
 * - Provider-specific updates (parsers, capabilities)
 * - Database updates (schema migrations)
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { config } from '../config.js'
import { UpdateError } from '../errors.js'
import { getLogger } from '../lib/logger.js'

const log = getLogger('updater')

interface GitHubRelease {
  tag_name: string
  name: string
  body: string
  published_at: string
  assets: GitHubAsset[]
}

interface GitHubAsset {
  name: string
  browser_download_url: string
  size: number
  content_type: string
}

interface UpdateInfo {
  currentVersion: string
  latestVersion: string
  available: boolean
  releaseNotes: string
  downloadUrl: string
  downloadSize: number
  updateType: 'app' | 'provider' | 'database'
  providerSlug?: string
}

interface ProviderUpdate {
  provider: string
  version: string
  parserVersion: string
  capabilities: string[]
  changes: string[]
}

interface DownloadProgress {
  downloaded: number
  total: number
  percent: number
}

export class UpdateEngine {
  private readonly currentVersion: string
  private readonly repoOwner: string
  private readonly repoName: string
  private readonly updateDir: string
  private readonly dataDir: string
  private checkInterval: NodeJS.Timeout | null = null

  constructor(
    options: {
      currentVersion?: string
      repoOwner?: string
      repoName?: string
      updateDir?: string
      dataDir?: string
    } = {},
  ) {
    this.currentVersion = options.currentVersion ?? this.readCurrentVersion()
    this.repoOwner = options.repoOwner ?? 'owenservera'
    this.repoName = options.repoName ?? 'vivim-final'
    this.updateDir = options.updateDir ?? join(config.dataDir, 'updates')
    this.dataDir = options.dataDir ?? join(config.dataDir)
  }

  /**
   * Read current version from package.json or binary
   */
  private readCurrentVersion(): string {
    try {
      // Try to read from the server binary
      const { execSync } = require('node:child_process') as typeof import('node:child_process')
      const serverPath = join(config.dataDir, 'vivim-server.exe')
      if (existsSync(serverPath)) {
        const output = execSync(`"${serverPath}" --version`, {
          encoding: 'utf-8',
          timeout: 5000,
        }).trim()
        // Extract version from "1.3.14" format
        const match = output.match(/(\d+\.\d+\.\d+)/)
        if (match?.[1]) return match[1]
      }
    } catch {
      // Ignore errors
    }

    return '0.1.0'
  }

  /**
   * Get GitHub API URL for releases
   */
  private getReleaseUrl(tag?: string): string {
    if (tag) {
      return `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/releases/tags/${tag}`
    }
    return `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/releases/latest`
  }

  /**
   * Compare semver versions
   * Returns: 1 if a > b, -1 if a < b, 0 if equal
   */
  private compareVersions(a: string, b: string): number {
    const aParts = a.split('.').map(Number)
    const bParts = b.split('.').map(Number)

    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aVal = aParts[i] ?? 0
      const bVal = bParts[i] ?? 0

      if (aVal > bVal) return 1
      if (aVal < bVal) return -1
    }

    return 0
  }

  /**
   * Fetch release info from GitHub
   */
  async fetchRelease(tag?: string): Promise<GitHubRelease | null> {
    try {
      const response = await fetch(this.getReleaseUrl(tag), {
        signal: AbortSignal.timeout(10_000),
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Vivim-Desktop-Updater',
        },
      })

      if (!response.ok) {
        log.error({ status: response.status }, 'Failed to fetch release')
        return null
      }

      return (await response.json()) as GitHubRelease
    } catch (error) {
      log.error({ error }, 'Error fetching release')
      return null
    }
  }

  /**
   * Check for app updates
   */
  async checkForAppUpdates(): Promise<UpdateInfo | null> {
    log.info({ current: this.currentVersion }, 'Checking for app updates')

    const release = await this.fetchRelease()
    if (!release) {
      log.info('Could not fetch release info')
      return null
    }

    // Parse version from tag (e.g., "v1.0.0" -> "1.0.0")
    const latestVersion = release.tag_name.replace(/^v/, '')

    const available = this.compareVersions(latestVersion, this.currentVersion) > 0

    if (!available) {
      log.info('App is up to date')
      return null
    }

    log.info({ latestVersion }, 'Update available')

    // Find Windows installer asset
    const installerAsset = release.assets.find(
      (a) => a.name.endsWith('.exe') && a.name.includes('setup'),
    )

    // Find server binary asset (fallback)
    const serverAsset = release.assets.find(
      (a) => a.name.includes('server') && a.name.includes('windows'),
    )

    const asset = installerAsset ?? serverAsset

    return {
      currentVersion: this.currentVersion,
      latestVersion,
      available: true,
      releaseNotes: release.body,
      downloadUrl: asset?.browser_download_url ?? '',
      downloadSize: asset?.size ?? 0,
      updateType: 'app',
    }
  }

  /**
   * Check for provider-specific updates
   */
  async checkForProviderUpdates(providerSlug: string): Promise<ProviderUpdate | null> {
    log.info({ providerSlug }, 'Checking for provider updates')

    try {
      // Check for provider-specific release tag
      const release = await this.fetchRelease(`provider/${providerSlug}`)
      if (!release) {
        log.info({ providerSlug }, 'No provider release found')
        return null
      }

      // Parse provider update info from release body
      const parserVersion = release.body.match(/parser[:\s]+(\d+\.\d+\.\d+)/i)?.[1] ?? '1.0.0'
      const capabilities =
        release.body
          .match(/capabilities[:\s]+([^\n]+)/i)?.[1]
          ?.split(',')
          .map((s) => s.trim()) ?? []
      const changes = release.body.split('\n').filter((line) => line.startsWith('- '))

      return {
        provider: providerSlug,
        version: release.tag_name.replace(/^v/, ''),
        parserVersion,
        capabilities,
        changes,
      }
    } catch (error) {
      log.error({ error, providerSlug }, 'Error checking provider updates')
      return null
    }
  }

  /**
   * Download update file
   */
  async downloadUpdate(
    url: string,
    filename: string,
    onProgress?: (progress: DownloadProgress) => void,
  ): Promise<string> {
    // Ensure update directory exists
    await mkdir(this.updateDir, { recursive: true })

    const filePath = join(this.updateDir, filename)

    log.info({ url }, 'Downloading update')

    const response = await fetch(url, {
      signal: AbortSignal.timeout(120_000),
      headers: {
        'User-Agent': 'Vivim-Desktop-Updater',
      },
    })

    if (!response.ok) {
      throw new UpdateError(`Download failed: ${response.status}`)
    }

    const total = Number(response.headers.get('content-length') ?? 0)
    let downloaded = 0

    const reader = response.body?.getReader()
    if (!reader) {
      throw new UpdateError('No response body')
    }

    const chunks: Uint8Array[] = []

    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      chunks.push(value)
      downloaded += value.length

      if (total > 0) {
        onProgress?.({
          downloaded,
          total,
          percent: Math.round((downloaded / total) * 100),
        })
      }
    }

    // Write file
    const buffer = Buffer.concat(chunks)
    await writeFile(filePath, buffer)

    log.info({ downloaded, filePath }, 'Downloaded update')

    return filePath
  }

  /**
   * Install app update (run installer or replace binary)
   */
  async installAppUpdate(updatePath: string): Promise<void> {
    log.info('Installing app update')

    if (updatePath.endsWith('.exe')) {
      // Run installer silently
      log.info({ updatePath }, 'Running installer')

      const installer = spawn(updatePath, ['/S'], {
        detached: true,
        stdio: 'ignore',
      })

      installer.unref()

      // Give installer time to start
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Exit current process so installer can replace files
      log.info('Exiting for installer to complete')
      process.exit(0)
    } else {
      // Direct binary replacement
      const currentBinary = process.execPath
      const backupBinary = `${currentBinary}.bak`

      // Backup current binary
      const { renameSync } = require('node:fs') as typeof import('node:fs')
      renameSync(currentBinary, backupBinary)

      // Copy new binary
      const { copyFileSync } = require('node:fs') as typeof import('node:fs')
      copyFileSync(updatePath, currentBinary)

      // Restart app
      log.info('Restarting application')
      spawn(currentBinary, [], {
        detached: true,
        stdio: 'ignore',
      }).unref()

      process.exit(0)
    }
  }

  /**
   * Install provider update
   */
  async installProviderUpdate(
    providerSlug: string,
    parserCode: string,
    capabilities: Record<string, unknown>[],
  ): Promise<void> {
    log.info({ providerSlug }, 'Installing provider update')

    await mkdir(this.dataDir, { recursive: true })

    // Update parser file
    const parserDir = join(this.dataDir, 'parsers')
    await mkdir(parserDir, { recursive: true })
    const parserPath = join(parserDir, `${providerSlug}-parser.ts`)
    await writeFile(parserPath, parserCode)
    log.info({ parserPath }, 'Updated parser')

    // Update capabilities
    const capsPath = join(this.dataDir, `${providerSlug}-capabilities.json`)
    await writeFile(capsPath, JSON.stringify(capabilities, null, 2))
    log.info({ capsPath }, 'Updated capabilities')

    // Write update metadata
    const metaPath = join(this.dataDir, `${providerSlug}-update.json`)
    await writeFile(
      metaPath,
      JSON.stringify(
        {
          provider: providerSlug,
          updatedAt: new Date().toISOString(),
          parserVersion: '1.0.0',
        },
        null,
        2,
      ),
    )
  }

  /**
   * Check and install update if available
   */
  async checkAndUpdate(
    onProgress?: (progress: DownloadProgress) => void,
    onStatus?: (status: string) => void,
  ): Promise<boolean> {
    try {
      onStatus?.('Checking for updates...')

      const updateInfo = await this.checkForAppUpdates()
      if (!updateInfo || !updateInfo.available) {
        onStatus?.('App is up to date')
        return false
      }

      onStatus?.(`Update available: v${updateInfo.latestVersion}`)

      // Determine filename
      const filename = `vivim-update-${updateInfo.latestVersion}.exe`

      // Download
      onStatus?.('Downloading update...')
      const updatePath = await this.downloadUpdate(updateInfo.downloadUrl, filename, onProgress)

      // Install
      onStatus?.('Installing update...')
      await this.installAppUpdate(updatePath)

      return true
    } catch (error) {
      log.error({ error }, 'Update failed')
      onStatus?.('Update failed')
      return false
    }
  }

  /**
   * Start periodic update checks
   */
  startPeriodicChecks(intervalMs: number = 6 * 60 * 60 * 1000): void {
    // Check immediately
    this.checkForAppUpdates().catch((err) => log.error({ err }, 'Periodic check failed'))

    // Then periodically
    this.checkInterval = setInterval(() => {
      this.checkForAppUpdates().catch((err) => log.error({ err }, 'Periodic check failed'))
    }, intervalMs)

    log.info({ intervalMinutes: intervalMs / 1000 / 60 }, 'Periodic checks started')
  }

  /**
   * Stop periodic update checks
   */
  stopPeriodicChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
      log.info('Periodic checks stopped')
    }
  }

  /**
   * Get current version
   */
  getCurrentVersion(): string {
    return this.currentVersion
  }

  /**
   * List installed providers
   */
  async listInstalledProviders(): Promise<string[]> {
    try {
      const providersDir = join(this.dataDir, 'providers')
      if (!existsSync(providersDir)) {
        return []
      }

      const files = await readdir(providersDir)
      return files.filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''))
    } catch {
      return []
    }
  }

  /**
   * Get provider status
   */
  async getProviderStatus(providerSlug: string): Promise<{
    installed: boolean
    version?: string
    parserVersion?: string
  }> {
    try {
      const metaPath = join(this.dataDir, `${providerSlug}-update.json`)
      if (!existsSync(metaPath)) {
        return { installed: false }
      }

      const meta = JSON.parse(await readFile(metaPath, 'utf-8'))
      return {
        installed: true,
        version: meta.version,
        parserVersion: meta.parserVersion,
      }
    } catch {
      return { installed: false }
    }
  }
}

// Singleton instance
let instance: UpdateEngine | null = null

export function getUpdateEngine(): UpdateEngine {
  if (!instance) {
    instance = new UpdateEngine()
  }
  return instance
}
