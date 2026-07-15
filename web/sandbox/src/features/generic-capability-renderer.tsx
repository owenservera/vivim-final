// web/sandbox/src/features/generic-capability-renderer.tsx
// 90.9: generic renderer — can render ANY capability from its contract. Used
// when no bespoke renderer is promoted in the CapabilityRegistry ledger for
// the capability's `ui_component` slug (FRONTEND = BACKEND fallback).

import { ActionRegistry } from '@ui'
import { type CapabilityRenderProps } from '@ui/registry/index.js'
import { z } from 'zod'

const GENERIC_EXECUTE = z.object({ slug: z.string() })

export function GenericCapabilityRenderer({ slug, contract, onAction }: CapabilityRenderProps) {
  const name = (contract.name as string) ?? slug
  const description = (contract.description as string) ?? ''
  const uiComponent = (contract.ui_component as string) ?? slug
  const uiPosition = (contract.ui_position as string) ?? '—'
  const uiGroup = (contract.ui_group as string) ?? '—'
  const uiOrder = (contract.ui_order as number) ?? 0
  const planTier = (contract.plan_tier as string) ?? 'free'
  const dependencies = (contract.dependencies as string[]) ?? []

  const handleExecute = () => {
    const params = { slug }
    if (onAction) onAction('capability.execute', params)
    else ActionRegistry.dispatch('capability.execute', params).catch(console.error)
  }

  return (
    <section className="max-w-2xl">
      <h2 className="text-xl font-semibold text-gray-900">{name}</h2>
      <p className="text-gray-600 mt-1">{description}</p>

      <div className="mt-6 p-4 border border-gray-200 rounded-lg bg-white">
        <h3 className="text-sm font-medium text-gray-700 mb-2">UI Contract (generic)</h3>
        <dl className="text-xs space-y-1">
          <div><dt className="font-medium inline">Component:</dt> <dd className="inline">{uiComponent}</dd></div>
          <div><dt className="font-medium inline">Position:</dt> <dd className="inline">{uiPosition}</dd></div>
          <div><dt className="font-medium inline">Group:</dt> <dd className="inline">{uiGroup}</dd></div>
          <div><dt className="font-medium inline">Order:</dt> <dd className="inline">{String(uiOrder)}</dd></div>
          <div><dt className="font-medium inline">Plan Tier:</dt> <dd className="inline">{planTier}</dd></div>
        </dl>

        {dependencies.length > 0 && (
          <div className="mt-3">
            <dt className="font-medium text-gray-700">Dependencies:</dt>
            <dd className="ml-2">{dependencies.join(', ')}</dd>
          </div>
        )}
      </div>

      <div className="mt-4">
        <button
          type="button"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={handleExecute}
        >
          Execute Capability
        </button>
      </div>
    </section>
  )
}
