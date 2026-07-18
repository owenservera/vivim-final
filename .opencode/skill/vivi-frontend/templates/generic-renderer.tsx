// templates/generic-renderer.tsx
// GENERIC CAPABILITY RENDERER — contract interpreter. Renders ANY capability
// from its ResolvedCapability contract: no per-capability code.
//
// Copy into: web/ui/src/components/generic-capability-renderer.tsx
//
// Consumes: uiComponent (primitive), uiLabel/uiIcon/uiPriority, uiInputSchema
// (auto-form), availability (gating), requiresUserConfirmation (ConfirmGate),
// resultComponent/resultLayout (ResultRenderer). Dispatches via onAction(slug).

import { useState, type FormEvent } from 'react'
import type { CapabilityRenderProps } from '../registry/index.js'
import { ActionRegistry } from '../actions/registry.js'
import { ConfirmGate } from './confirm-gate.js'
import { ResultRenderer, type RenderResult } from './result-renderer.js'

/** Fully-resolved capability contract (mirror of references/ui-contract.md). */
export interface ResolvedCapability {
  id: string
  slug: string
  name: string
  category: string
  description?: string
  uiComponent: string
  uiLabel: string
  uiIcon: string
  uiPosition: string
  uiOrder: number
  uiGroup: string
  uiLayerDepth: number
  parentCapabilityId: string | null
  uiPriority: string
  interactionMode: string
  uiStates: string[]
  uiVisibilityRule: string | null
  existentialRule: string | null
  uiInputSchema: Record<string, unknown>
  mutationEffects: Record<string, unknown>
  recoveryBehavior: string
  statePersistence: string
  dataFlow: string
  minPlanTier: string
  dependsOn: string[]
  concurrencySafe: boolean
  opClassification: string | null
  requiresUserConfirmation: boolean
  maxResultSize: number
  resultComponent: string
  resultLayout: string
  searchHints: string[]
  aliases: string[]
  availability: {
    requiresLogin?: boolean
    requiresChrome?: boolean
    requiresProvider?: string
    requiresModel?: string
  }
  prefetch: boolean
}

interface PrimitiveProps {
  cap: ResolvedCapability
  onRun: (params: Record<string, unknown>) => void
  running: boolean
}

function Primitive({ cap, onRun, running }: PrimitiveProps) {
  switch (cap.uiComponent) {
    case 'toggle':
      return (
        <button type="button" className="cap-prim cap-prim--toggle" aria-pressed={running} disabled={running} onClick={() => onRun({})}>
          {cap.uiIcon ? <span aria-hidden>{cap.uiIcon}</span> : null} {cap.uiLabel}
        </button>
      )
    case 'select':
    case 'text_input':
      return <InputForm cap={cap} onRun={onRun} running={running} />
    case 'file_upload':
      return (
        <label className="cap-prim cap-prim--file">
          {cap.uiIcon ? <span aria-hidden>{cap.uiIcon}</span> : null} {cap.uiLabel}
          <input type="file" disabled={running} onChange={(e) => onRun({ file: e.target.files?.[0] })} />
        </label>
      )
    case 'action_button':
    default:
      return (
        <button type="button" className={`cap-prim cap-prim--button cap-prim--${cap.uiPriority}`} disabled={running} onClick={() => onRun({})}>
          {cap.uiIcon ? <span aria-hidden>{cap.uiIcon}</span> : null} {cap.uiLabel}
        </button>
      )
  }
}

function InputForm({ cap, onRun, running }: PrimitiveProps) {
  const schema = (cap.uiInputSchema?.properties ?? {}) as Record<string, { type?: string }>
  const [values, setValues] = useState<Record<string, string>>({})
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const params: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(values)) params[k] = v
    onRun(params)
  }
  return (
    <form className="cap-prim cap-prim--form" onSubmit={submit}>
      {Object.entries(schema).map(([key, prop]) => (
        <input
          key={key}
          className="cap-input"
          placeholder={key}
          type={prop.type === 'number' ? 'number' : 'text'}
          value={values[key] ?? ''}
          disabled={running}
          onChange={(e) => setValues((p) => ({ ...p, [key]: e.target.value }))}
        />
      ))}
      <button type="submit" className="cap-prim cap-prim--button" disabled={running}>
        {cap.uiLabel}
      </button>
    </form>
  )
}

export function GenericCapabilityRenderer({ slug, contract, onAction }: CapabilityRenderProps) {
  const cap = contract as unknown as ResolvedCapability
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<RenderResult | null>(null)

  // Availability gating (availability_json + min_plan_tier).
  const gated = cap.availability.requiresLogin || cap.availability.requiresChrome
  if (gated) {
    return (
      <div className="cap-gen cap-gen--gated" title="Requires login or Chrome session">
        {cap.uiIcon ? <span aria-hidden>{cap.uiIcon}</span> : null} {cap.uiLabel} (locked)
      </div>
    )
  }

  const run = (params: Record<string, unknown>) => {
    setRunning(true)
    setResult(null)
    const fire = onAction ?? ((s: string, p: Record<string, unknown>) => ActionRegistry.dispatch(s, p))
    Promise.resolve(fire(slug, params))
      .then((r) => setResult({ ok: true, data: r }))
      .catch((e: unknown) => setResult({ ok: false, error: e instanceof Error ? e.message : String(e) }))
      .finally(() => setRunning(false))
  }

  const trigger = (
    <Primitive cap={cap} onRun={run} running={running} />
  )

  return (
    <div className="cap-gen" data-slug={slug}>
      {cap.description ? <p className="cap-gen__desc">{cap.description}</p> : null}
      {cap.requiresUserConfirmation ? <ConfirmGate label={cap.uiLabel} onConfirm={() => run({})}>{trigger}</ConfirmGate> : trigger}
      {result ? <ResultRenderer component={cap.resultComponent} layout={cap.resultLayout} result={result} /> : null}
    </div>
  )
}
