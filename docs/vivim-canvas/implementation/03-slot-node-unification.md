# 03 — Slot ↔ Node Unification (C3)

**Unit:** C3.1 (`useNodeTypes.tsx`)
**Key idea:** The `UIComponentRegistry`'s `nodeTypes` map **is** the hot-swap
registry. No second registry.

---

## 1. Before: two parallel systems

```
vivim-canvas:        CanvasDefinition rows → LayerHost.mount() → DOM nodes
hot-swap UI:         UIComponentRegistry.resolve(slot, ctx) → React component
```

Two notions of "what renders where", two resolution paths, two override
mechanisms. The unification collapses them.

---

## 2. After: one system

```
SLOT_IDS ──▶ React Flow nodeTypes
              └─ each SLOT_ID is a node type
                   └─ SlotNode wraps registry.resolve() in ZoomNode
                        └─ resolved component renders inside the node
```

The `nodeTypes` map **is** the registry surface. `UIComponentRegistry.resolve()`
is the resolution function. `data.overrideSlug` is the context.

---

## 3. `useNodeTypes` (C3.1)

`web/ui/src/features/canvas/useNodeTypes.tsx`

```tsx
export function useNodeTypes(): Record<string, ComponentType<NodeProps>> {
  return useMemo(() => {
    const types: Record<string, ComponentType<NodeProps>> = {}
    for (const slotId of SLOT_IDS) {
      types[slotId] = createSlotNodeType(slotId)
    }
    return types
  }, [])
}
```

`SLOT_IDS` is the canonical slot catalog from `web/ui/src/ui/slots.ts`
(`chat.entry`, `chat.sidebar`, `chat.thread`, …). Each becomes a React Flow
node type.

### The SlotNode wrapper

```tsx
function createSlotNodeType(slotId: SlotId) {
  const category = slotId.split('.')[0] ?? 'chat'
  const SlotNode = memo(function SlotNode({ data }: NodeProps) {
    const nodeData = data as { overrideSlug?: string; providerSlug?: string }
    const ctx = {
      providerSlug: nodeData.providerSlug ?? nodeData.overrideSlug ?? 'default',
      capabilitySlug: nodeData.overrideSlug,
    }
    const { component: Component } = resolve(slotId, ctx)
    return (
      <ZoomNode
        label={SLOT_LABELS[slotId] ?? slotId}
        color={CATEGORY_COLORS[category]}
      >
        <Component slotId={slotId} />
      </ZoomNode>
    )
  })
  SlotNode.displayName = `SlotNode(${slotId})`
  return SlotNode
}
```

---

## 4. Resolution precedence (unchanged, now per-node)

`registry.resolve(slot, ctx)` applies the same precedence as before:

```
capabilitySlug  >  providerSlug  >  default
```

The node's `data.overrideSlug` supplies the context:

| `data.overrideSlug` | Resolution |
|---------------------|------------|
| `'cap:chat:summarize'` | capability-level bespoke renderer |
| `'provider:claude'` | provider-level bespoke renderer |
| `undefined` | generic default |

This is the **hot-swap** mechanism: a backend `uiSlots` claim calls
`applyClaim(slot, slug, claim)` → `register(slot, slug, component)` → the next
render of any node with `data.overrideSlug === slug` picks up the bespoke
component. (See `05-data-driven-seeding.md`.)

---

## 5. Category colors + labels

Two small lookup tables drive the ZoomNode card/dot appearance:

```ts
const CATEGORY_COLORS: Record<string, string> = {
  chat: '#6366f1', system: '#10b981', automation: '#f59e0b',
  agents: '#8b5cf6', projects: '#3b82f6', knowledge: '#ec4899',
  designer: '#14b8a6', plugin: '#f97316',
}

const SLOT_LABELS: Record<string, string> = {
  'chat.entry': 'Entry', 'chat.sidebar': 'Sidebar', 'chat.thread': 'Thread',
  'chat.bubble': 'Bubble', 'chat.composer': 'Composer', 'chat.send': 'Send',
  'chat.attach': 'Attach', 'chat.streaming': 'Streaming', 'chat.result': 'Result',
  'chat.confirm': 'Confirm', 'chat.error': 'Error', 'chat.header': 'Header',
  'chat.actionBar': 'Actions',
}
```

---

## 6. Why this is correct (SOTA alignment)

- **One registry, not two.** React Flow's `nodeTypes` is the *only* place node
  types are declared. The hot-swap registry is consumed, not duplicated.
- **Resolution stays in the registry.** We don't re-implement precedence in the
  canvas; we call `resolve()` which already enforces
  `capability > provider > default`.
- **Per-node context.** `data.overrideSlug` means two nodes of the same slot can
  resolve to different components simultaneously (e.g. two chat threads, each
  under a different provider).

---

## 7. Acceptance (from PRD-C3)

- [x] `nodeTypes` is built from `SLOT_IDS` (the slot catalog)
- [x] Each node type wraps `registry.resolve()` with `data.overrideSlug` context
- [x] `capabilitySlug > providerSlug > default` precedence preserved
- [x] `bun run typecheck` passes

---

## 8. Extending with new slots

To add a new slot:
1. Add the id to `SLOT_IDS` in `web/ui/src/ui/slots.ts`
2. Register a default in `web/ui/src/ui/defaults/index.tsx`
3. Add a label in `useNodeTypes.tsx` `SLOT_LABELS`
4. (Optional) add a `CanvasDefinition` row + `BrowserLayerHost` mount for a
   data-driven layer

No change to `CanvasSurface` or React Flow config is needed — the loop picks it
up automatically.
