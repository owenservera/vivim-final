import { useEffect, useState } from 'react'
import { useCapabilityStore } from '../store/capability-store.js'
import { CapabilityCatalog } from '../features/capability-catalog.js'
import { CapabilityHarness } from '../features/capability-harness.js'
import { ConversationSurface } from '../features/conversation-surface.js'
import { ConversationList } from '../features/conversation-list.js'
import { HealthDashboard } from '../features/health-dashboard.js'
import { ProviderManager } from '../features/provider-manager.js'
import { WorkspaceSettings } from '../features/workspace-settings.js'
import { DebugPanel } from '../features/debug-panel.js'
import { ProviderSetupWizard } from '@ui/features/provider-setup-wizard.js'

export function SandboxApp() {
  const { selectedCapability, loadCapabilities } = useCapabilityStore()
  const [showSetup, setShowSetup] = useState(false)
  const [showProviderManager, setShowProviderManager] = useState(false)
  const [showWorkspaceSettings, setShowWorkspaceSettings] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [view, setView] = useState<'capabilities' | 'chat' | 'health'>('capabilities')

  useEffect(() => {
    loadCapabilities()
    fetch('/api/setup/profiles')
      .then((r) => r.json())
      .then((d) => {
        if (!d.profiles || d.profiles.length === 0) {
          setShowSetup(true)
        }
      })
      .catch(() => {})
  }, [loadCapabilities])

  const startConversation = async (providerId: string) => {
    try {
      const resp = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId }),
      })
      const data = await resp.json()
      if (data.id) {
        setConversationId(data.id)
        setView('chat')
      }
    } catch (err) {
      console.error('Failed to create conversation:', err)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {showSetup && <ProviderSetupWizard onComplete={() => setShowSetup(false)} />}
      {showProviderManager && <ProviderManager onClose={() => setShowProviderManager(false)} />}
      {showWorkspaceSettings && <WorkspaceSettings onClose={() => setShowWorkspaceSettings(false)} />}

      <header className="border-b border-gray-200 bg-white px-4 py-3 flex items-center gap-4">
        <h1 className="text-lg font-semibold text-gray-900">Vivim Sandbox</h1>
        <p className="text-sm text-gray-500">Frontend-native test surface for backend capabilities</p>
        <div className="ml-auto flex gap-2 items-center">
          <button
            onClick={() => setView('capabilities')}
            className={`px-3 py-1 text-sm rounded ${
              view === 'capabilities' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Capabilities
          </button>
          <button
            onClick={() => setView('chat')}
            className={`px-3 py-1 text-sm rounded ${
              view === 'chat' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Chat
          </button>
          <button
            onClick={() => setView('health')}
            className={`px-3 py-1 text-sm rounded ${
              view === 'health' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Health
          </button>
          {view === 'capabilities' && (
            <select
              onChange={(e) => e.target.value && startConversation(e.target.value)}
              className="px-2 py-1 text-sm border rounded"
              defaultValue=""
            >
              <option value="" disabled>
                Start chat with...
              </option>
              <option value="chatgpt">ChatGPT</option>
              <option value="claude">Claude</option>
              <option value="gemini">Gemini</option>
            </select>
          )}
          <button
            onClick={() => setShowProviderManager(true)}
            className="text-sm text-gray-600 hover:text-gray-800"
            title="Provider Accounts"
          >
            Providers
          </button>
          <button
            onClick={() => setShowWorkspaceSettings(true)}
            className="text-sm text-gray-600 hover:text-gray-800"
            title="Workspace Settings"
          >
            Settings
          </button>
        </div>
      </header>

      <main className="flex h-[calc(100vh-52px)]">
        {view === 'capabilities' ? (
          <>
            <CapabilityCatalog />
            <CapabilityHarness selectedCapabilitySlug={selectedCapability} />
            <DebugPanel />
          </>
        ) : view === 'chat' ? (
          <>
            <ConversationList
              onSelect={(id) => {
                setConversationId(id)
                setView('chat')
              }}
              activeId={conversationId}
            />
            <ConversationSurface conversationId={conversationId} />
          </>
        ) : (
          <HealthDashboard />
        )}
      </main>
    </div>
  )
}