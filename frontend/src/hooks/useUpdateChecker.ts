/**
 * useUpdateChecker — React hook for checking and applying updates
 *
 * Supports:
 * - App updates
 * - Provider-specific updates
 */

import { useIO } from '@/components/canvas/UnifiedIOProvider'
import { useCallback, useEffect, useState } from 'react'

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

interface ProviderStatus {
  slug: string
  installed: boolean
  version?: string
  parserVersion?: string
}

interface UpdateProgress {
  downloaded: number
  total: number
  percent: number
}

interface UseUpdateCheckerReturn {
  // App updates
  currentVersion: string | null
  updateAvailable: boolean
  updateInfo: UpdateInfo | null
  checking: boolean
  downloading: boolean
  installing: boolean
  progress: UpdateProgress | null
  error: string | null

  // Provider updates
  providers: ProviderStatus[]
  providerUpdates: Map<string, ProviderUpdate>

  // Actions
  checkForUpdates: () => Promise<void>
  checkProviderUpdate: (slug: string) => Promise<void>
  checkAllProviderUpdates: () => Promise<void>
  downloadUpdate: () => Promise<void>
  installUpdate: () => Promise<void>
  applyUpdate: () => Promise<void>
  installProviderUpdate: (
    slug: string,
    parserCode: string,
    capabilities: Record<string, unknown>[],
  ) => Promise<void>
}

export function useUpdateChecker(): UseUpdateCheckerReturn {
  const io = useIO()
  // App update state
  const [currentVersion, setCurrentVersion] = useState<string | null>(null)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [checking, setChecking] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [progress, setProgress] = useState<UpdateProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Provider state
  const [providers, setProviders] = useState<ProviderStatus[]>([])
  const [providerUpdates, setProviderUpdates] = useState<Map<string, ProviderUpdate>>(new Map())

  // ── App Updates ────────────────────────────────────────────────────────────

  const checkForUpdates = useCallback(async () => {
    try {
      setChecking(true)
      setError(null)

      const { data } = await io.get<{
        ok: boolean
        currentVersion?: string
        update?: UpdateInfo
        error?: string
      }>('/api/update/check')

      if (data.ok) {
        setCurrentVersion(data.currentVersion ?? null)

        if (data.update?.available) {
          setUpdateAvailable(true)
          setUpdateInfo(data.update)
        } else {
          setUpdateAvailable(false)
          setUpdateInfo(null)
        }
      } else {
        setError(data.error || 'Failed to check for updates')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setChecking(false)
    }
  }, [io])

  const downloadUpdate = useCallback(async () => {
    if (!updateInfo?.downloadUrl) {
      setError('No download URL available')
      return
    }

    try {
      setDownloading(true)
      setError(null)
      setProgress(null)

      const filename = `vivim-update-${updateInfo.latestVersion}.exe`

      const { data } = await io.post<{ ok: boolean; filePath?: string; error?: string }>(
        '/api/update/download',
        {
          url: updateInfo.downloadUrl,
          filename,
        },
      )

      if (data.ok) {
        // Download complete, now install
        await installUpdate(data.filePath)
      } else {
        setError(data.error || 'Download failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed')
    } finally {
      setDownloading(false)
    }
  }, [updateInfo, io])

  const installUpdate = useCallback(
    async (filePath?: string) => {
      try {
        setInstalling(true)
        setError(null)

        const { data } = await io.post<{ ok: boolean; error?: string }>('/api/update/install', {
          filePath: filePath ?? updateInfo?.downloadUrl,
          type: 'app',
        })

        if (!data.ok) {
          setError(data.error || 'Installation failed')
        }
        // If successful, app will restart
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Installation failed')
      } finally {
        setInstalling(false)
      }
    },
    [updateInfo, io],
  )

  const applyUpdate = useCallback(async () => {
    try {
      setDownloading(true)
      setError(null)
      setProgress(null)

      const { data } = await io.post<{ ok: boolean; updated?: boolean; error?: string }>(
        '/api/update/apply',
      )

      if (data.ok) {
        if (data.updated) {
          setInstalling(true)
          // App will restart
        }
      } else {
        setError(data.error || 'Update failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setDownloading(false)
    }
  }, [io])

  // ── Provider Updates ───────────────────────────────────────────────────────

  const checkProviderUpdate = useCallback(
    async (slug: string) => {
      try {
        const { data } = await io.get<{ ok: boolean; update?: ProviderUpdate }>(
          `/api/update/provider/${slug}`,
        )

        if (data.ok && data.update) {
          const update = data.update
          setProviderUpdates((prev) => new Map(prev).set(slug, update))
        }
      } catch (err) {
        console.error(`Failed to check ${slug} update:`, err)
      }
    },
    [io],
  )

  const checkAllProviderUpdates = useCallback(async () => {
    try {
      // First get list of installed providers
      const { data } = await io.get<{ ok: boolean; providers?: ProviderStatus[] }>(
        '/api/update/providers',
      )

      if (data.ok && data.providers) {
        setProviders(data.providers)

        // Check each provider for updates
        for (const provider of data.providers) {
          await checkProviderUpdate(provider.slug)
        }
      }
    } catch (err) {
      console.error('Failed to check provider updates:', err)
    }
  }, [io, checkProviderUpdate])

  const installProviderUpdate = useCallback(
    async (slug: string, parserCode: string, capabilities: Record<string, unknown>[]) => {
      try {
        const { data } = await io.post<{ ok: boolean; error?: string }>('/api/update/install', {
          type: 'provider',
          provider: slug,
          parserCode,
          capabilities,
        })

        if (data.ok) {
          // Remove from pending updates
          setProviderUpdates((prev) => {
            const next = new Map(prev)
            next.delete(slug)
            return next
          })

          // Refresh provider list
          await checkAllProviderUpdates()
        } else {
          setError(data.error || 'Failed to update provider')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update provider')
      }
    },
    [io, checkAllProviderUpdates],
  )

  // Check for updates on mount
  useEffect(() => {
    checkForUpdates()
    checkAllProviderUpdates()
  }, [checkForUpdates, checkAllProviderUpdates])

  return {
    // App updates
    currentVersion,
    updateAvailable,
    updateInfo,
    checking,
    downloading,
    installing,
    progress,
    error,

    // Provider updates
    providers,
    providerUpdates,

    // Actions
    checkForUpdates,
    checkProviderUpdate,
    checkAllProviderUpdates,
    downloadUpdate,
    installUpdate,
    applyUpdate,
    installProviderUpdate,
  }
}
