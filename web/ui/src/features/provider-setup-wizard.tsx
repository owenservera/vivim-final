import { useEffect, useState } from 'react'
import { ActionRegistry } from '../actions/registry.js'

// Step type for wizard flow
type SetupStep = 'workspace' | 'provider' | 'account' | 'login' | 'done'

// Available providers
const PROVIDERS = [
  { id: 'chatgpt', name: 'ChatGPT', icon: '🤖', url: 'https://chatgpt.com/' },
  { id: 'claude', name: 'Claude', icon: '🪨', url: 'https://claude.ai/' },
  { id: 'gemini', name: 'Gemini', icon: '💎', url: 'https://gemini.google.com/' },
]

// Default workspace based on platform
const DEFAULT_WORKSPACE = process.platform === 'win32' ? 'C:\\.config\\vivim' : '/.config/vivim'

export function ProviderSetupWizard({ onComplete }: { onComplete?: () => void }) {
  const [step, setStep] = useState<SetupStep>('workspace')
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null)
  const [accountSlug, setAccountSlug] = useState('')
  const [workspacePath, setWorkspacePath] = useState('')
  const [launching, setLaunching] = useState(false)
  const [launchResult, setLaunchResult] = useState<{ profileDir: string; loginUrl: string; pid: number } | null>(null)

  // Load workspace hint on mount
  useEffect(() => {
    fetch('/api/setup/workspace')
      .then((r) => r.json())
      .then((d) => setWorkspacePath(d.workspacePath ?? DEFAULT_WORKSPACE))
      .catch(() => setWorkspacePath(DEFAULT_WORKSPACE))
  }, [])

  const handleWorkspaceSave = async () => {
    if (!workspacePath) return
    await fetch('/api/setup/workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: workspacePath }),
    })
    setStep('provider')
  }

  const handleProviderSelect = (providerId: string) => {
    setSelectedProvider(providerId)
    setStep('account')
  }

  const handleStartLogin = async () => {
    if (!selectedProvider || !workspacePath) return
    setLaunching(true)
    try {
      const resp = await fetch('/api/setup/launch-visible', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: selectedProvider,
          accountSlug,
          workspace: workspacePath,
        }),
      })
      const result = await resp.json()
      setLaunchResult(result)
      setStep('login')
    } finally {
      setLaunching(false)
    }
  }

  const handleVerifyComplete = async () => {
    if (!launchResult || !selectedProvider) return
    const resp = await fetch('/api/setup/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ port: 9222 }),
    })
    const v = await resp.json()
    if (v.loggedIn) {
      await fetch('/api/setup/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: selectedProvider,
          accountSlug,
          workspace: workspacePath,
          profileDir: launchResult.profileDir,
          debugPort: 9222,
        }),
      })
      setStep('done')
      onComplete?.()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          {step === 'workspace' && 'Select Workspace Folder'}
          {step === 'provider' && 'Select Provider to Add'}
          {step === 'account' && 'Account Nickname'}
          {step === 'login' && 'Log In to Provider'}
          {step === 'done' && 'Setup Complete!'}
        </h2>

        {step === 'workspace' && (
<div className="space-y-4">
             <div>
               <label htmlFor="workspace-input" className="block text-sm font-medium text-gray-700 mb-1">
                 Workspace Path (Chrome profiles will be saved here)
               </label>
               <input
                 id="workspace-input"
                 type="text"
                 value={workspacePath}
                 onChange={(e) => setWorkspacePath(e.target.value)}
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
              onClick={handleWorkspaceSave}
              disabled={!workspacePath.trim()}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        )}

        {step === 'provider' && (
          <div className="space-y-2">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => handleProviderSelect(p.id)}
                className="w-full p-3 rounded-lg border border-gray-200 hover:bg-gray-50 text-left flex items-center gap-3"
              >
                <span className="text-2xl">{p.icon}</span>
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-gray-500">{p.url}</div>
                </div>
              </button>
            ))}
            <div className="mt-4 p-3 bg-blue-50 rounded text-sm text-blue-700">
              Your Chrome profile will be saved in a separate folder for each provider.
              This isolates your login sessions and lets you use multiple accounts.
            </div>
            <button
              onClick={() => setStep('workspace')}
              className="w-full mt-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
            >
              Change Workspace Path
            </button>
          </div>
        )}

        {step === 'account' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Nickname
              </label>
              <input
                type="text"
                value={accountSlug}
                onChange={(e) => setAccountSlug(e.target.value)}
                placeholder="e.g. 'work', 'personal'"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="p-3 bg-gray-50 rounded text-xs">
              Profile folder: {workspacePath}/{selectedProvider}/{accountSlug}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setStep('provider')}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
              >
                Back
              </button>
              <button
                onClick={handleStartLogin}
                disabled={!accountSlug.trim() || launching}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {launching ? 'Launching Chrome...' : 'Open Chrome for Login'}
              </button>
            </div>
          </div>
        )}

        {step === 'login' && (
          <div className="space-y-4">
            <div className="p-4 bg-yellow-50 rounded">
              <p className="text-sm text-yellow-800">
                A Chrome window should now be open to the login page.
                Log in to {selectedProvider}, then return here.
              </p>
            </div>
            <div className="text-xs text-gray-500 font-mono">
              Profile: {launchResult?.profileDir}
              <br />
              PID: {launchResult?.pid}
            </div>
            <button
              onClick={handleVerifyComplete}
              className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              I've Logged In — Verify Session
            </button>
          </div>
        )}

        {step === 'done' && (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">✓</div>
            <p className="text-gray-700">Your {selectedProvider} account is ready!</p>
            <button
              onClick={onComplete}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Continue to App
            </button>
          </div>
        )}
      </div>
    </div>
  )
}