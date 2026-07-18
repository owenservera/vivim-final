// templates/bespoke-renderer.tsx
// BESPOKE RENDERER SCAFFOLD — promote a proven capability to a custom, reusable
// component. Register it in CapabilityRegistry so the CapabilitySurface host
// renders it instead of the generic renderer (placement still follows ui_position).
//
// Copy into: web/ui/src/features/<slug>-renderer.tsx  (e.g. rename-conversation-renderer.tsx)

import type { FC } from 'react'
import { CapabilityRegistry, type CapabilityRenderProps } from '../registry/index.js'
import type { ResolvedCapability } from '../components/generic-capability-renderer.js'

// 1) Build your custom UI from the resolved contract.
export const MyCapabilityRenderer: FC<CapabilityRenderProps> = ({ slug, contract, onAction }) => {
  const cap = contract as unknown as ResolvedCapability
  // TODO: render bespoke layout using cap.* fields.
  return (
    <section className="cap-bespoke" data-slug={slug}>
      <h3>{cap.uiLabel}</h3>
      <button
        type="button"
        onClick={() => (onAction ?? ((s: string, p: Record<string, unknown>) => void 0))(slug, {})}
      >
        {cap.uiLabel}
      </button>
    </section>
  )
}

// 2) Register once (idempotent). `bestPracticeNote` captures the lesson learned
//    from the sandbox iteration that earned promotion.
CapabilityRegistry.register('my.slug', {
  slug: 'my.slug',
  bestPracticeNote: 'Why this capability needed a custom renderer (layout / rich input / reuse).',
  component: MyCapabilityRenderer,
})

// 3) Mount is automatic: CapabilitySurface looks up CapabilityRegistry by slug.
//    No manual routing required.
