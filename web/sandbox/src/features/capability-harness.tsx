import { useCapabilityStore } from '../store/capability-store.js'
import { ActionRegistry, AgentBridge, CapabilityRegistry } from '@ui'
import { GenericCapabilityRenderer } from './generic-capability-renderer.js'
import { z } from 'zod'
import { useEffect, useRef, type ComponentType } from 'react'

const ExecuteCapabilityParamsSchema = z.object({
  slug: z.string(),
})

export function CapabilityHarness({ selectedCapabilitySlug }: { selectedCapabilitySlug: string | null }) {
  const { capabilities } = useCapabilityStore()
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    ActionRegistry.register('capability.execute', {
      description: 'Execute a capability by slug',
      params: ExecuteCapabilityParamsSchema,
      run: async (params: z.infer<typeof ExecuteCapabilityParamsSchema>) => {
        const response = await fetch(`/api/capabilities/${encodeURIComponent(params.slug)}/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: {} }),
        })
        const result = await response.json()
        return result
      },
    })

    if (!wsRef.current) {
      const ws = new WebSocket('ws://localhost:9420/ws')
      wsRef.current = ws
      ws.onopen = () => {
        const sessionId = `sandbox-${crypto.randomUUID?.() ?? Math.random()}`
        // AgentBridge.initialize wires message handling internally (B8 parity).
        AgentBridge.initialize(ws, sessionId)
      }
    }
  }, [])

  const capability = capabilities.find((c) => c.slug === selectedCapabilitySlug)

  if (!capability) {
    return (
      <main className="flex-1 p-6">
        <p className="text-gray-500">Select a capability from the catalog to begin.</p>
      </main>
    )
  }

  // FRONTEND = BACKEND: resolve the renderer by the backend-declared
  // `ui_component` slug. A bespoke renderer promoted in CapabilityRegistry
  // wins; otherwise the generic contract-driven renderer is the fallback.
  const uiComponent = capability.ui_component
  const Renderer: ComponentType<{
    slug: string
    contract: Record<string, unknown>
    onAction?: (actionId: string, params: Record<string, unknown>) => void
  }> = CapabilityRegistry.get(uiComponent)?.component ?? GenericCapabilityRenderer

  return (
    <main className="flex-1 p-6 overflow-auto">
      <Renderer
        slug={capability.slug}
        contract={capability as unknown as Record<string, unknown>}
      />
    </main>
  )
}
