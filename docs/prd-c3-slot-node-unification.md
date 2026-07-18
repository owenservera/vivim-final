# PRD-C3: Slot↔Node Unification

**Status:** Proposed | **Author:** vivim runtime | **Date:** 2026-07-16
**Part of:** [PRD-C1: Unified Infinite-Canvas Surface](prd-canvas-unified-surface.md)

## 1. Problem

The hot-swap `UIComponentRegistry` and the canvas `LayerHost` are separate systems. `ChatPage` resolves slots via `useSlot`/`registry.resolve()`; `LayerMounter` mounts `CanvasDefinition` rows via `LayerHost.mount()`. They share no code path.

## 2. Goals

- **G1 — `nodeTypes` IS the registry.** React Flow's `Record<string, ComponentType>` map replaces `UIComponentRegistry.defaults` + `bespoke`.
- **G2 — `ChatPage` retired.** Becomes a default node layout: `chat.entry`, `chat.sidebar`, `chat.thread`, `chat.bubble`, `chat.composer`, `chat.actionBar` are seed nodes.
- **G3 — `resolve()` becomes node-type lookup.** `data.overrideSlug` provides capability/provider context.
- **G4 — `applyClaim()` registers a nodeType** from backend `uiSlots`.

## 3. Design

### 3.1 Slot→NodeType mapping

```tsx
// Each SLOT_ID becomes a React Flow nodeType
const nodeTypes = {
  'chat.entry': ChatEntryNodeType,
  'chat.sidebar': ChatSidebarNodeType,
  'chat.thread': ChatThreadNodeType,
  'chat.bubble': ChatBubbleNodeType,
  'chat.composer': ChatComposerNodeType,
  'chat.send': ChatSendNodeType,
  'chat.attach': ChatAttachNodeType,
  'chat.streaming': ChatStreamingNodeType,
  'chat.result': ChatResultNodeType,
  'chat.confirm': ChatConfirmNodeType,
  'chat.error': ChatErrorNodeType,
  'chat.header': ChatHeaderNodeType,
  'chat.actionBar': ChatActionBarNodeType,
}
```

### 3.2 NodeType wraps registry resolve

```tsx
function createSlotNodeType(slotId: SlotId) {
  return memo(function SlotNode({ data }: { data: { overrideSlug?: string } }) {
    const ctx = {
      providerSlug: data.overrideSlug ?? 'default',
      capabilitySlug: data.overrideSlug,
    }
    const Component = resolve(slotId, ctx).component
    return <Component slotId={slotId} />
  })
}
```

### 3.3 Hot-swap = dynamic nodeType update

```tsx
// window.__vivim.ui.hotSwap now sets a nodeType
function hotSwap(slot: SlotId, slug: string, component: ComponentType) {
  // Update the nodeTypes map — React Flow re-renders affected nodes
  nodeTypeOverrides.set(`${slot}:${slug}`, component)
}
```

### 3.4 Default node layout (replaces ChatPage)

Seed nodes on the canvas:
```
{ id: 'entry', type: 'chat.entry', position: { x: 0, y: 0 } }
{ id: 'sidebar', type: 'chat.sidebar', position: { x: -400, y: 0 } }
{ id: 'thread', type: 'chat.thread', position: { x: 420, y: 0 } }
{ id: 'composer', type: 'chat.composer', position: { x: 420, y: 400 } }
{ id: 'header', type: 'chat.header', position: { x: 0, y: -60 } }
{ id: 'actionBar', type: 'chat.actionBar', position: { x: 0, y: 600 } }
```

## 4. Implementation

| Unit | What | Size |
|------|------|------|
| C3.1 | SLOT_IDS→nodeTypes mapping; useNodeTypes hook | Medium |
| C3.2 | Retire ChatPage; seed default node layout | Medium |
| C3.3 | window.__vivim.ui → dynamic nodeType updates | Small |

## 5. Acceptance

- `useNodeTypes()` returns 11 nodeType entries matching SLOT_IDS
- Default layout renders all 11 slot nodes on the canvas
- `hotSwap('chat.bubble','claude',X)` live-updates only Claude's bubble nodes
- `ChatPage.tsx` is retired (not imported anywhere)
