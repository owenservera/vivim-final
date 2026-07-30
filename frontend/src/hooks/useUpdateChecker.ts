/**
 * useUpdateChecker — React hook for checking and applying updates
 *
 * Supports:
 * - App updates
 * - Provider-specific updates
 */

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

  const getBaseUrl = useCallback(() => {
    if (typeof window !== 'undefined') {
      return window.location.origin
    }
    return 'http://localhost:9420'
  }, [])

  // ── App Updates ────────────────────────────────────────────────────────────

  const checkForUpdates = useCallback(async () => {
    try {
      setChecking(true)
      setError(null)

      const response = await fetch(`${getBaseUrl()}/api/update/check`)
      const data = await response.json()

      if (data.ok) {
        setCurrentVersion(data.currentVersion)

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
  }, [getBaseUrl])

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

      const response = await fetch(`${getBaseUrl()}/api/update/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: updateInfo.downloadUrl,
          filename,
        }),
      })

      const data = await response.json()

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
  }, [updateInfo, getBaseUrl])

  const installUpdate = useCallback(
    async (filePath?: string) => {
      try {
        setInstalling(true)
        setError(null)

        const response = await fetch(`${getBaseUrl()}/api/update/install`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filePath: filePath ?? updateInfo?.downloadUrl,
            type: 'app',
          }),
        })

        const data = await response.json()

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
    [updateInfo, getBaseUrl],
  )

  const applyUpdate = useCallback(async () => {
    try {
      setDownloading(true)
      setError(null)
      setProgress(null)

      const response = await fetch(`${getBaseUrl()}/api/update/apply`, {
        method: 'POST',
      })

      const data = await response.json()

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
  }, [getBaseUrl])

  // ── Provider Updates ───────────────────────────────────────────────────────

  const checkProviderUpdate = useCallback(
    async (slug: string) => {
      try {
        const response = await fetch(`${getBaseUrl()}/api/update/provider/${slug}`)
        const data = await response.json()

        if (data.ok && data.update) {
          setProviderUpdates((prev) => new Map(prev).set(slug, data.update))
        }
      } catch (err) {
        console.error(`Failed to check ${slug} update:`, err)
      }
    },
    [getBaseUrl],
  )

  const checkAllProviderUpdates = useCallback(async () => {
    try {
      // First get list of installed providers
      const response = await fetch(`${getBaseUrl()}/api/update/providers`)
      const data = await response.json()

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
  }, [getBaseUrl, checkProviderUpdate])

  const installProviderUpdate = useCallback(
    async (slug: string, parserCode: string, capabilities: Record<string, unknown>[]) => {
      try {
        const response = await fetch(`${getBaseUrl()}/api/update/install`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'provider',
            provider: slug,
            parserCode,
            capabilities,
          }),
        })

        const data = await response.json()

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
    [getBaseUrl, checkAllProviderUpdates],
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
