# 05 — Data-Driven Seeding (C5)

**Unit:** C5 (`useUiSlots.ts`)
**Principle (FRONTEND=BACKEND):** The backend publishes slot overrides; the
frontend applies them. No hard-coded component mapping in the UI.

---

## 1. Problem

The backend `ResolvedCapability` had UI fields (`resultComponent`,
`uiPosition`) but **no per-slot override map**. The frontend
`UIComponentRegistry` had no server-provided slot manifest. Swaps couldn't be
discovered or seeded from the backend.

---

## 2. The `uiSlots` contract

### Backend shape (`src/engines/capability-resolution.ts`)

```ts
export interface ResolvedCapability {
  // ... existing fields
  uiSlots?: {
    [slotId: string]: {
      component?: string   // catalog key → React component
      sandbox?: string[]   // P8: capability slugs this renderer may touch
    }
  }
}
```

The backend already parses `provider_capability.ui_component_override` (a JSON
column) into this map via `parseUiSlots()`:

```ts
function parseUiSlots(raw: string | null | undefined) {
  // raw = '{"chat.bubble": {"component": "claude-bubble", "sandbox": ["claude.*"]}}'
  //   → { "chat.bubble": { component: "claude-bubble", sandbox: ["claude.*"] } }
}
```

### Shared type (`shared/ui-slots.ts`)

```ts
export interface UiSlotClaim {
  component?: string
  sandbox?: string[]
}
export type UiSlotsMap = Record<string, UiSlotClaim>
```

### DB column (already exists)

```sql
ALTER TABLE provider_capability ADD COLUMN ui_component_override JSONB;
-- Format: { "chat.bubble": { "component": "claude-bubble", "sandbox": ["claude.*"] } }
```

---

## 3. Frontend application (C5)

`web/ui/src/features/canvas/useUiSlots.ts`

```ts
export function useUiSlots(conversationId?: string): UseUiSlotsResult {
  const [result, setResult] = useState({ applied: 0, loading: true, error: null })

  useEffect(() => {
    let cancelled = false
    async function apply() {
      const url = conversationId
        ? `/api/conversations/${conversationId}/capabilities`
        : '/api/capabilities?surface=ui'
      const res = await fetch(url)
      const data = await res.json() as { capabilities?: ResolvedCapability[] }

      let count = 0
      for (const cap of data.capabilities ?? []) {
        if (!cap.uiSlots) continue
        for (const [slotId, claim] of Object.entries(cap.uiSlots)) {
          if (!isSlotId(slotId)) continue
          if (!claim.component) continue
          applyClaim(slotId as SlotId, cap.slug, { slot: slotId as SlotId, ...claim })
          count++
        }
      }
      if (!cancelled) setResult({ applied: count, loading: false, error: null })
    }
    apply()
    return () => { cancelled = true }
  }, [conversationId])

  return result
}
```

### `applyClaim` → registry (existing, `web/ui/src/ui/registry.ts`)

```ts
export function applyClaim(slot: SlotId, slug: string, claim: SlotOverrideClaim): void {
  if (!claim.component) return
  const component = catalog.get(claim.component)
  if (!component) return // unknown catalog key — safe no-op
  register(slot, slug, component, { sandbox: claim.sandbox })
}
```

`register()` writes to the bespoke store keyed by `slug`. The next render of
any node with `data.overrideSlug === slug` resolves to the bespoke component
(see `03-slot-node-unification.md`).

---

## 4. Resolution chain

The `uiSlots` claims are layered with the same precedence as the registry:

```
global defaults  <  plan tier  <  provider overrides
```

| Source | Mechanism | Key |
|--------|-----------|-----|
| Global default | `registerDefault(slot, comp)` at boot | `slot` |
| Plan tier | `register(slot, planSlug, comp)` | `slot + planSlug` |
| Provider override | `applyClaim(slot, providerSlug, claim)` from `uiSlots` | `slot + providerSlug` |
| Capability override | `applyClaim(slot, capSlug, claim)` from `uiSlots` | `slot + capSlug` |

`registry.resolve()` checks `capabilitySlug` first, then `providerSlug`, then
default. So a capability-level `uiSlots` claim wins over a provider-level one.

---

## 5. Example: provider overrides a bubble

**Backend** (`provider_capability.ui_component_override`):

```json
{
  "chat.bubble": { "component": "claude-bubble", "sandbox": ["claude.*"] }
}
```

**Frontend flow:**

1. `useUiSlots()` fetches `/api/capabilities?surface=ui`
2. For capability `cap:chat:claude` with `uiSlots['chat.bubble']`, calls
   `applyClaim('chat.bubble', 'cap:chat:claude', { component: 'claude-bubble', sandbox: ['claude.*'] })`
3. `registry.register('chat.bubble', 'cap:chat:claude', ClaudeBubble, { sandbox: ['claude.*'] })`
4. Any node with `data.overrideSlug === 'cap:chat:claude'` and slot
   `chat.bubble` now renders `ClaudeBubble`

The `claude-bubble` key must be registered in the catalog via
`registerCatalogEntry('claude-bubble', ClaudeBubble)` at boot — otherwise
`applyClaim` is a safe no-op (unknown key).

---

## 6. Acceptance (from PRD-C5)

- [x] `GET /api/capabilities` returns `uiSlots` map per capability
- [x] Frontend applies `uiSlots` → registry on load (`useUiSlots`)
- [x] A provider can override a slot: `uiSlots['chat.bubble'] = { component: 'my-bubble' }`
- [x] Resolution chain works: global < plan < provider
- [x] `bun run typecheck` passes

---

## 7. Open items

- **Catalog seeding:** `useUiSlots` applies claims, but the *catalog* (the
  `component` keys) must be populated at boot by `registerCatalogEntry()` calls
  in `web/ui/src/ui/defaults/index.tsx`. New bespoke renderers need a catalog
  entry or `applyClaim` silently no-ops.
- **Plan tier:** the resolution chain supports plan-tier overrides, but no
  `uiSlots` source for plan tier exists yet (would need a plan/subscription
  table feeding `applyClaim`).
- **Persistence:** registry overrides survive refresh via `localStorage`
  (`registry.loadPersisted()`), so `uiSlots` applied in a session persist.
