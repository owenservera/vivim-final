# Surface Slots — `ui_position` semantics

`CapabilityResolutionEngine` groups resolved capabilities into exactly five panel slots by
`uiPosition`. The `CapabilitySurface` host renders one region per slot and places each capability
inside its slot, sorted by `uiGroup` then `uiOrder`. Never hardcode which capabilities go where —
the contract decides.

| Slot | Meaning | Typical contents | Layout hint |
|------|---------|------------------|------------|
| `composer` | Primary action bar above/around the input box | send_message, attach, model_select | horizontal row, primary + secondary |
| `header` | Top app bar | provider_switcher, settings, health | right-aligned icons |
| `message` | Inline within a message bubble | react, copy, retry, branch | contextual hover affordances |
| `sidebar` | Left/right persistent panel | capability catalog, memory, context | vertical list, scrollable |
| `inline` | Embedded into a surface (cards, lists) | provider cards, search results | grid/list |

## Resolution grouping (server)

```typescript
interface ResolvedCapabilities {
  composer: ResolvedCapability[]
  header: ResolvedCapability[]
  message: ResolvedCapability[]
  sidebar: ResolvedCapability[]
  inline: ResolvedCapability[]
  total: number
  resolvedAt: number
}
```

If the endpoint returns a flat array instead of this grouped shape, group client-side:

```typescript
const byPosition = (caps: ResolvedCapability[]) => {
  const slots = { composer: [], header: [], message: [], sidebar: [], inline: [] }
  for (const c of caps) (slots[c.uiPosition] ?? slots.inline).push(c)
  for (const key of Object.keys(slots) as (keyof typeof slots)[])
    slots[key].sort((a, b) => a.uiGroup.localeCompare(b.uiGroup) || a.uiOrder - b.uiOrder)
  return slots
}
```

## Promotion note

A bespoke renderer registered in `CapabilityRegistry` still occupies its `uiPosition` slot — the
host looks up the registry by `slug` *after* grouping, so promotion never changes placement.
