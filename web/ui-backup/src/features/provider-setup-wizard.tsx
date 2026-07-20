import { useEffect, useState } from 'react'
import type {
  LaunchVisibleResponse,
  ProfileEntry,
  RestoreResponse,
} from 'shared/api-types.js'
import { setupApi } from '../api/client.js'

// ── Shared constants ──────────────────────────────────────────────────────────

export const PROVIDERS = [
  { id: 'chatgpt', name: 'ChatGPT', icon: '🤖', url: 'https://chatgpt.com/' },
  { id: 'claude', name: 'Claude', icon: '🪨', url: 'https://claude.ai/' },
  { id: 'gemini', name: 'Gemini', icon: '💎', url: 'https://gemini.google.com/' },
]

const DEFAULT_WORKSPACE = navigator.platform.includes('Win')
  ? 'C:\\.config\\vivim'
  : '/.config/vivim'

// ── Wizard state ──────────────────────────────────────────────────────────────

export type SetupStep = 'workspace' | 'restore' | 'provider' | 'account' | 'login' | 'done'

// ── Step components ───────────────────────────────────────────────────────────

export function WorkspaceStep({
  workspacePath,
  onSetWorkspace,
}: {
  workspacePath: string
  onSetWorkspace: (path: string) => void
}) {
  const [localPath, setLocalPath] = useState(workspacePath)

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="workspace-input" className="block text-sm font-medium text-gray-700 mb-1">
          Workspace Path (Chrome profiles will be saved here)
        </label>
        <input
          id="workspace-input"
          type="text"
          value={localPath}
          onChange={(e) => setLocalPath(e.target.value)}
          placeholder={DEFAULT_WORKSPACE}
          className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 font-mono text-sm"
        />
        <p className="mt-1 text-xs text-gray-500">
          Default: {DEFAULT_WORKSPACE}
          <br />
          Profiles will be stored as: &lt;workspace&gt;/&lt;provider&gt;/&lt;account&gt;/
        </p>
      </div>
      <button
        onClick={() => onSetWorkspace(localPath)}
        disabled={!localPath.trim()}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        Continue
      </button>
    </div>
  )
}

export function RestoreStep({
  profiles,
  onRestore,
  onSkip,
  restoring,
}: {
  profiles: ProfileEntry[]
  onRestore: () => void
  onSkip: () => void
  restoring: boolean
}) {
  const grouped = PROVIDERS.map((p) => ({
    ...p,
    profiles: profiles.filter((f) => f.providerId === p.id),
  })).filter((g) => g.profiles.length > 0)

  return (
    <div className="space-y-4">
      <div className="p-3 bg-green-50 rounded text-sm text-green-800">
        Found {profiles.length} existing Chrome profile(s) with saved logins.
      </div>

      {grouped.map((g) => (
        <div key={g.id} className="border rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">{g.icon}</span>
            <span className="font-medium">{g.name}</span>
            {g.profiles.every((p) => p.dbLinked) ? (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Linked</span>
            ) : (
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">Needs Restore</span>
            )}
          </div>
          {g.profiles.map((p) => (
            <div key={p.accountSlug} className="text-xs text-gray-600 ml-8">
              {p.accountSlug} — {p.hasCookies ? '✅ has session' : '⚠️ no cookies'}
              {p.dbLinked ? ' — DB linked' : ' — DB missing'}
            </div>
          ))}
        </div>
      ))}

      <div className="flex gap-2">
        <button
          onClick={onSkip}
          className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
        >
          Skip — Set Up Manually
        </button>
        <button
          onClick={onRestore}
          disabled={restoring}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          {restoring ? 'Restoring...' : 'Restore All Profiles'}
        </button>
      </div>
    </div>
  )
}

export function ProviderStep({
  completedProviders,
  onSelect,
  onBack,
}: {
  completedProviders: Set<string>
  onSelect: (id: string) => void
  onBack: () => void
}) {
  return (
    <div className="space-y-2">
      {PROVIDERS.map((p) => {
        const done = completedProviders.has(p.id)
        return (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={`w-full p-3 rounded-lg border text-left flex items-center gap-3 ${
              done
                ? 'border-green-200 bg-green-50 opacity-75'
                : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            <span className="text-2xl">{p.icon}</span>
            <div className="flex-1">
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-gray-500">{p.url}</div>
            </div>
            {done && <span className="text-green-600 text-sm">✓ Done</span>}
          </button>
        )
      })}
      <div className="mt-4 p-3 bg-blue-50 rounded text-sm text-blue-700">
        Your Chrome profile will be saved in a separate folder for each provider.
        This isolates your login sessions and lets you use multiple accounts.
      </div>
      <button
        onClick={onBack}
        className="w-full mt-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
      >
        Change Workspace Path
      </button>
    </div>
  )
}

export function AccountStep({
  providerId,
  workspacePath,
  accountSlug,
  onSetAccountSlug,
  onStartLogin,
  launching,
  onBack,
}: {
  providerId: string
  workspacePath: string
  accountSlug: string
  onSetAccountSlug: (slug: string) => void
  onStartLogin: () => void
  launching: boolean
  onBack: () => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Account Nickname
        </label>
        <input
          type="text"
          value={accountSlug}
          onChange={(e) => onSetAccountSlug(e.target.value)}
          placeholder="e.g. 'work', 'personal'"
          className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="p-3 bg-gray-50 rounded text-xs">
        Profile folder: {workspacePath}/{providerId}/{accountSlug}
      </div>
      <div className="flex gap-2">
        <button
          onClick={onBack}
          className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
        >
          Back
        </button>
        <button
          onClick={onStartLogin}
          disabled={!accountSlug.trim() || launching}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {launching ? 'Launching Chrome...' : 'Open Chrome for Login'}
        </button>
      </div>
    </div>
  )
}

export function LoginStep({
  providerId,
  launchResult,
  onVerify,
}: {
  providerId: string
  launchResult: LaunchVisibleResponse
  onVerify: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="p-4 bg-yellow-50 rounded">
        <p className="text-sm text-yellow-800">
          A Chrome window should now be open to the login page.
          Log in to {providerId}, then return here.
        </p>
      </div>
      <div className="text-xs text-gray-500 font-mono">
        Profile: {launchResult.profileDir}
        <br />
        PID: {launchResult.pid}
        <br />
        Port: {launchResult.debugPort}
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        Auto-checking for login every 3s...
      </div>
      <button
        onClick={onVerify}
        className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
      >
        Check Now
      </button>
    </div>
  )
}

export function DoneStep({
  providerId,
  completedCount,
  totalCount,
  onAddAnother,
  onFinish,
}: {
  providerId: string
  completedCount: number
  totalCount: number
  onAddAnother: () => void
  onFinish: () => void
}) {
  return (
    <div className="text-center py-8">
      <div className="text-4xl mb-3">✓</div>
      <p className="text-gray-700">Your {providerId} account is ready!</p>
      <p className="text-sm text-gray-500 mt-1">
        {completedCount} of {totalCount} providers configured
      </p>
      <div className="flex gap-2 justify-center mt-4">
        {completedCount < totalCount ? (
          <button
            onClick={onAddAnother}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Add Another Provider
          </button>
        ) : null}
        <button
          onClick={onFinish}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          {completedCount < totalCount ? 'Skip Remaining' : 'Continue to App'}
        </button>
      </div>
    </div>
  )
}

// ── Main wizard ───────────────────────────────────────────────────────────────

export function ProviderSetupWizard({ onComplete }: { onComplete?: () => void }) {
  const [step, setStep] = useState<SetupStep>('workspace')
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null)
  const [accountSlug, setAccountSlug] = useState('')
  const [workspacePath, setWorkspacePath] = useState('')
  const [launching, setLaunching] = useState(false)
  const [launchResult, setLaunchResult] = useState<LaunchVisibleResponse | null>(null)
  const [profiles, setProfiles] = useState<ProfileEntry[]>([])
  const [restoring, setRestoring] = useState(false)
  const [completedProviders, setCompletedProviders] = useState<Set<string>>(new Set())

  // Load workspace + profiles on mount
  useEffect(() => {
    setupApi.getWorkspace()
      .then((d) => {
        const wp = d.workspacePath ?? DEFAULT_WORKSPACE
        setWorkspacePath(wp)
        return setupApi.getProfiles()
      })
      .then((p) => {
        setProfiles(p.profiles ?? [])
        const unlinked = (p.profiles ?? []).filter((f) => !f.dbLinked)
        if (unlinked.length > 0) {
          setStep('restore')
        } else {
          setStep('provider')
        }
      })
      .catch(() => {
        setWorkspacePath(DEFAULT_WORKSPACE)
        setStep('provider')
      })
  }, [])

  const handleRestore = async () => {
    setRestoring(true)
    try {
      const result = await setupApi.restore(workspacePath)
      // Mark all restored providers as completed
      const restored = new Set(result.restored.map((r) => r.providerId))
      setCompletedProviders(restored)
      setStep('provider')
    } finally {
      setRestoring(false)
    }
  }

  const handleStartLogin = async () => {
    if (!selectedProvider || !workspacePath) return
    setLaunching(true)
    try {
      const result = await setupApi.launchVisible({
        providerId: selectedProvider,
        accountSlug,
        workspace: workspacePath,
      })
      setLaunchResult(result)
      setStep('login')
    } finally {
      setLaunching(false)
    }
  }

  const handleVerifyComplete = async (): Promise<boolean> => {
    if (!launchResult || !selectedProvider) return false
    const v = await setupApi.verify({ port: launchResult.debugPort, providerId: selectedProvider })
    if (v.loggedIn) {
      await setupApi.complete({
        providerId: selectedProvider,
        accountSlug,
        workspace: workspacePath,
        profileDir: launchResult.profileDir,
        debugPort: launchResult.debugPort,
      })
      setCompletedProviders((prev) => new Set([...prev, selectedProvider!]))
      setStep('done')
    }
    return v.loggedIn
  }

  // Auto-poll for login completion
  useEffect(() => {
    if (step !== 'login' || !launchResult) return
    const interval = setInterval(async () => {
      try {
        await handleVerifyComplete()
      } catch {
        // ignore polling errors
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [step, launchResult])

  const handleAddAnother = () => {
    setSelectedProvider(null)
    setAccountSlug('')
    setLaunchResult(null)
    setStep('provider')
  }

  const titles: Record<SetupStep, string> = {
    workspace: 'Select Workspace Folder',
    restore: 'Restore Existing Profiles',
    provider: 'Select Provider to Add',
    account: 'Account Nickname',
    login: 'Log In to Provider',
    done: 'Setup Complete!',
  }

  const totalProviders = PROVIDERS.length

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">{titles[step]}</h2>

        {step === 'workspace' && (
          <WorkspaceStep
            workspacePath={workspacePath}
            onSetWorkspace={(path) => {
              setWorkspacePath(path)
              setStep('provider')
            }}
          />
        )}

        {step === 'restore' && (
          <RestoreStep
            profiles={profiles}
            onRestore={handleRestore}
            onSkip={() => setStep('provider')}
            restoring={restoring}
          />
        )}

        {step === 'provider' && (
          <ProviderStep
            completedProviders={completedProviders}
            onSelect={(id) => {
              setSelectedProvider(id)
              setStep('account')
            }}
            onBack={() => setStep('workspace')}
          />
        )}

        {step === 'account' && selectedProvider && (
          <AccountStep
            providerId={selectedProvider}
            workspacePath={workspacePath}
            accountSlug={accountSlug}
            onSetAccountSlug={setAccountSlug}
            onStartLogin={handleStartLogin}
            launching={launching}
            onBack={() => setStep('provider')}
          />
        )}

        {step === 'login' && launchResult && selectedProvider && (
          <LoginStep
            providerId={selectedProvider}
            launchResult={launchResult}
            onVerify={handleVerifyComplete}
          />
        )}

        {step === 'done' && selectedProvider && (
          <DoneStep
            providerId={selectedProvider}
            completedCount={completedProviders.size}
            totalCount={totalProviders}
            onAddAnother={handleAddAnother}
            onFinish={onComplete ?? (() => {})}
          />
        )}
      </div>
    </div>
  )
}
