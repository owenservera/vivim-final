// web/sandbox/src/features/provider-manager.tsx
// Unit 6.5 — Provider Management UI: add/remove/switch provider accounts.

import { useEffect, useState } from 'react'
import { ProviderSetupWizard } from '@ui/features/provider-setup-wizard.js'

interface Profile {
  providerId: string
  accountSlug: string
  loginState: string
  profileDir: string
  debugPort: number
}

const PROVIDER_ICONS: Record<string, string> = {
  chatgpt: '🤖',
  claude: '🧠',
  gemini: '✨',
}

const LOGIN_STATE_COLORS: Record<string, string> = {
  logged_in: 'bg-green-100 text-green-700',
  logged_out: 'bg-red-100 text-red-700',
  unknown: 'bg-gray-100 text-gray-500',
}

export function ProviderManager({ onClose }: { onClose?: () => void }) {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [showAddWizard, setShowAddWizard] = useState(false)

  useEffect(() => {
    loadProfiles()
  }, [])

  const loadProfiles = async () => {
    try {
      const resp = await fetch('/api/setup/profiles')
      const data = await resp.json()
      setProfiles(data.profiles ?? [])
    } catch {
      // ignore
    }
  }

  const handleRemove = async (providerId: string, accountSlug: string) => {
    try {
      await fetch(`/api/setup/profiles/${providerId}/${accountSlug}`, { method: 'DELETE' })
    } catch {
      // ignore — remove from local state either way
    }
    setProfiles((prev) => prev.filter((p) => !(p.providerId === providerId && p.accountSlug === accountSlug)))
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Provider Accounts</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">
            ×
          </button>
        </div>

        <div className="space-y-2 mb-4">
          {profiles.map((p) => (
            <div
              key={`${p.providerId}-${p.accountSlug}`}
              className="flex items-center justify-between p-3 border rounded"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{PROVIDER_ICONS[p.providerId] ?? '🌐'}</span>
                <div>
                  <div className="font-medium capitalize">{p.providerId}</div>
                  <div className="text-xs text-gray-500">{p.accountSlug}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    LOGIN_STATE_COLORS[p.loginState] ?? LOGIN_STATE_COLORS.unknown
                  }`}
                >
                  {p.loginState}
                </span>
                <button
                  onClick={() => handleRemove(p.providerId, p.accountSlug)}
                  className="text-red-500 text-sm hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          {profiles.length === 0 && <p className="text-gray-500 text-sm">No providers configured.</p>}
        </div>

        <button
          onClick={() => setShowAddWizard(true)}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + Add Provider
        </button>

        {showAddWizard && (
          <div className="mt-4 border-t pt-4">
            <ProviderSetupWizard
              onComplete={() => {
                setShowAddWizard(false)
                loadProfiles()
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
