# PRD-C7: Living Manifest via EventBus

**Status:** Proposed | **Author:** vivim runtime | **Date:** 2026-07-16
**Part of:** [PRD-C1: Unified Infinite-Canvas Surface](prd-canvas-unified-surface.md)

## 1. Problem

The `CanvasManifest` (types.ts:170–175) describes which definitions exist and what regions they expose. The oracle needs live visibility into what's mounted. Currently, the manifest is static (generated once, not updated on spawn/dismiss).

## 2. Goals

- **G1 — Live manifest.** `CanvasManifest` updates when layers spawn or dismiss. Oracle visibility stays consistent.
- **G2 — EventBus integration.** `CapabilityEventBus` emits `canvas:layer:spawned` and `canvas:layer:dismissed` events. Canvas subscribes and re-resolves node types.
- **G3 — Region spec sync.** `RegionSpec` (bound primitives/capabilities) stays consistent with live node state.

## 3. Design

### 3.1 EventBus subscription

```tsx
// CanvasSurface subscribes to layer events
useEffect(() => {
  const unsub = eventBus.on('canvas:layer:spawned', (e) => {
    // Add node from e.definition
    setNodes((prev) => [...prev, definitionToNode(e.definition, e.instance)])
  })
  const unsub2 = eventBus.on('canvas:layer:dismissed', (e) => {
    // Remove node
    setNodes((prev) => prev.filter((n) => n.id !== e.instanceId))
  })
  return () => { unsub(); unsub2() }
}, [eventBus])
```

### 3.2 Manifest regeneration

On any spawn/dismiss, regenerate `CanvasManifest`:
```typescript
function generateManifest(nodes: CanvasNode[], instances: LayerInstance[]): CanvasManifest {
  return {
    version: Date.now(),
    generatedAt: Date.now(),
    definitions: nodes.map((n) => ({
      definitionId: n.data.definitionId ?? n.id,
      slug: n.type,
      category: n.type.split('.')[0] as LayerCategory,
      regions: n.data.bindings?.map((b) => ({
        regionId: b.regionId,
        role: b.role,
        selector: b.selector,
        boundPrimitive: b.primitive,
        boundCapability: b.capabilitySlug,
        readScope: 'scoped' as const,
      })) ?? [],
    })),
    oracle: /* from OracleReadProvider */,
  }
}
```

### 3.3 Region consistency

When a node is hot-swapped (type changes), its `RegionSpec` updates in the manifest. The oracle sees the new regions immediately.

## 4. Acceptance

- Spawning a layer emits `canvas:layer:spawned`; manifest updates
- Dismissing a layer emits `canvas:layer:dismissed`; manifest updates
- `CanvasManifest.definitions` reflects current live nodes
- `RegionSpec` stays consistent with node bindings
- Oracle visibility is always current
