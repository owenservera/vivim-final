import { useEffect, useState } from 'react'
import { useCapabilityStore } from '../store/capability-store.js'
import { CapabilityCatalog } from '../features/capability-catalog.js'
import { CapabilityHarness } from '../features/capability-harness.js'
import { ProviderSetupWizard } from '@ui/features/provider-setup-wizard.js'

export function SandboxApp() {
  const { selectedCapability, loadCapabilities } = useCapabilityStore()
  const [showSetup, setShowSetup] = useState(false)

  useEffect(() => {
    loadCapabilities()
    // Check if any profiles exist
    fetch('/api/setup/profiles')
      .then((r) => r.json())
      .then((d) => {
        if (!d.profiles || d.profiles.length === 0) {
          setShowSetup(true)
        }
      })
      .catch(() => {})
  }, [loadCapabilities])

  return (
    <div className="min-h-screen bg-gray-50">
      {showSetup && <ProviderSetupWizard onComplete={() => setShowSetup(false)} />}
      <header className="border-b border-gray-200 bg-white px-4 py-3">
        <h1 className="text-lg font-semibold text-gray-900">Vivim Sandbox</h1>
        <p className="text-sm text-gray-500">Frontend-native test surface for backend capabilities</p>
      </header>

      <main className="flex h-[calc(100vh-88px)]">
        <CapabilityCatalog />
        <CapabilityHarness selectedCapabilitySlug={selectedCapability} />
      </main>
    </div>
  )
}