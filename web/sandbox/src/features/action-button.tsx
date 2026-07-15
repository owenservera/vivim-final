// web/sandbox/src/features/action-button.tsx
// Bespoke renderer promoted for capabilities declaring `ui.component:
// 'action-button'` (e.g. the schedule capabilities). Demonstrates the
// FRONTEND = BACKEND bespoke path: the backend names the renderer slug, the
// frontend promotes a real component under that slug, and execution flows
// through the universal /api/capabilities/:slug/execute transport.

import { ActionRegistry } from '@ui'
import { type CapabilityRenderProps } from '@ui/registry/index.js'
import { z } from 'zod'

const EXECUTE = z.object({ slug: z.string() })

export function ActionButton({ slug, contract, onAction }: CapabilityRenderProps) {
  const name = (contract.name as string) ?? slug
  const description = (contract.description as string) ?? ''
  const uiState = (contract.ui_state as string) ?? ''

  const handleClick = () => {
    const params = { slug }
    if (onAction) onAction('capability.execute', params)
    else ActionRegistry.dispatch('capability.execute', params).catch(console.error)
  }

  return (
    <section className="max-w-2xl">
      <h2 className="text-xl font-semibold text-gray-900">{name}</h2>
      <p className="text-gray-600 mt-1">{description}</p>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
          onClick={handleClick}
        >
          {uiState ? <span aria-hidden>{uiState}</span> : null}
          <span>{name}</span>
        </button>
        <span className="text-xs text-gray-400">action-button · bespoke renderer</span>
      </div>
    </section>
  )
}
