# UI Contract Reference — `ResolvedCapability`

The frontend renders from this shape. It is produced by `CapabilityResolutionEngine`
(`docs/merged-design-v2/04-merged-engines.md:816`) and returned by
`GET /api/capabilities?surface=ui`. It is the camelCased, fully-resolved projection of
`capability_taxonomy` (`03-merged-schema.md:237`) after the global → tier → provider override chain.

## Type

```typescript
type PlanTier = 'free' | 'pro' | 'max' | 'enterprise'

interface ResolvedCapability {
  // ── Identity ──────────────────────────────────────
  id: string
  slug: string
  name: string
  category: string
  description?: string

  // ── Core UI contract ──────────────────────────────
  uiComponent: string          // renderer-type key, default 'action_button'
  uiLabel: string
  uiIcon: string
  uiPosition: string           // composer | header | message | sidebar | inline
  uiOrder: number
  uiGroup: string
  uiLayerDepth: number
  parentCapabilityId: string | null
  uiPriority: string           // primary | secondary | …
  interactionMode: string      // single_click | toggle | hold | …
  uiStates: string[]           // state-machine states (ui_states_json)
  uiVisibilityRule: string | null
  existentialRule: string | null
  uiInputSchema: Record<string, unknown>   // JSON Schema for auto-form
  mutationEffects: Record<string, unknown>
  recoveryBehavior: string     // retry_manual | …
  statePersistence: string     // none | session | persistent
  dataFlow: string             // user_to_provider | provider_to_user | …
  minPlanTier: PlanTier
  dependsOn: string[]

  // ── vCode pattern ─────────────────────────────────
  concurrencySafe: boolean
  opClassification: 'read' | 'write' | 'destructive' | 'navigate' | 'search' | null
  requiresUserConfirmation: boolean
  maxResultSize: number
  resultComponent: string      // text_block | image_grid | table | … (default 'text_block')
  resultLayout: string         // inline | panel | modal | … (default 'inline')
  searchHints: string[]
  aliases: string[]
  availability: {
    requiresLogin?: boolean
    requiresChrome?: boolean
    requiresProvider?: string
    requiresModel?: string
  }
  prefetch: boolean

  // ── Override provenance (never assume origin) ────
  overrideSources: Record<string, 'global' | 'tier' | 'provider'>

  // ── Binding context ───────────────────────────────
  bindingStatus: string        // broken | flaky | prospect | stable | …
  bindingConfidence: number
  tierOverrides: {
    maxModels?: number
    maxFileSize?: number
    maxOptions?: number
    customConfig?: Record<string, unknown>
  }
}
```

## Field groups the renderer consumes

| Concern | Fields | Renderer responsibility |
|---------|--------|-------------------------|
| Slot placement | `uiPosition`, `uiOrder`, `uiGroup` | Host groups by `uiPosition`; sort by `uiGroup` then `uiOrder` |
| Trigger visual | `uiComponent`, `uiLabel`, `uiIcon`, `uiPriority`, `interactionMode` | Map `uiComponent` → primitive; default `action_button` |
| Input collection | `uiInputSchema` | Auto-generate a form from JSON Schema |
| Result display | `resultComponent`, `resultLayout`, `maxResultSize` | Hand to `ResultRenderer` |
| State | `uiStates`, `statePersistence` | Render current state; persist per `statePersistence` |
| Gating | `availability`, `minPlanTier`, `requiresUserConfirmation`, `dependsOn` | Hide/disable; show `ConfirmGate` when required |
| Safety | `opClassification`, `concurrencySafe` | Destructive/navigate → confirm; non-concurrent → disable while running |
| Discoverability | `searchHints`, `aliases` | Feed command bar / search |

## Known `uiComponent` primitives (extend as needed)

`action_button` (default) · `toggle` · `select` · `text_input` · `file_upload` ·
`composer` · `panel` · `modal`. Unknown values fall back to `action_button`.

## Known `resultComponent` values

`text_block` (default) · `image_grid` · `table` · `code_block` · `list` · `raw`.
Unknown values fall back to `text_block`.
