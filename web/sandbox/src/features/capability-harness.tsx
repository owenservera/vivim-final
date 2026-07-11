import { useCapabilityStore } from '../store/capability-store.js'
import { ActionRegistry, AgentBridge } from '@ui'
import { z } from 'zod'
import { useEffect, useRef } from 'react'

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
        const response = await fetch(`/api/conversations/1/capabilities/${params.slug}/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
        const result = await response.json()
        return result
      },
    })

    if (!wsRef.current) {
      const ws = new WebSocket('ws://localhost:9420/ws')
      wsRef.current = ws
      ws.onopen = () => {
        AgentBridge.initialize(ws, `sandbox-${crypto.randomUUID?.() ?? Math.random()}`)
      }
    }
  }, [])

  const capability = capabilities.find(c => c.slug === selectedCapabilitySlug)

  if (!capability) {
    return (
      <main className="flex-1 p-6">
        <p className="text-gray-500">Select a capability from the catalog to begin.</p>
      </main>
    )
  }

  return (
    <main className="flex-1 p-6 overflow-auto">
      <section className="max-w-2xl">
        <h2 className="text-xl font-semibold text-gray-900">{capability.name}</h2>
        <p className="text-gray-600 mt-1">{capability.description}</p>

        <div className="mt-6 p-4 border border-gray-200 rounded-lg bg-white">
          <h3 className="text-sm font-medium text-gray-700 mb-2">UI Contract</h3>
          <dl className="text-xs space-y-1">
            <div><dt className="font-medium inline">Position:</dt> <dd className="inline">{capability.ui_position}</dd></div>
            <div><dt className="font-medium inline">Group:</dt> <dd className="inline">{capability.ui_group}</dd></div>
            <div><dt className="font-medium inline">Order:</dt> <dd className="inline">{capability.ui_order}</dd></div>
            <div><dt className="font-medium inline">Plan Tier:</dt> <dd className="inline">{capability.plan_tier}</dd></div>
          </dl>

          {capability.dependencies && capability.dependencies.length > 0 && (
            <div className="mt-3">
              <dt className="font-medium text-gray-700">Dependencies:</dt>
              <dd className="ml-2">{capability.dependencies.join(', ')}</dd>
            </div>
          )}
        </div>

        <div className="mt-4">
          <button
            type="button"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={() => {
              ActionRegistry.dispatch('capability.execute', { slug: capability.slug }).catch(console.error)
            }}
          >
            Execute Capability
          </button>
        </div>
      </section>
    </main>
  )
}