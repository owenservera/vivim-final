// Collaboration foundation (CRDT via Y.js + WebSocket presence).
//
// This module lays the groundwork for real-time multi-user editing
// WITHOUT shipping the full feature. It:
//   1. Wraps canvas state in a Y.js document so concurrent edits merge.
//   2. Connects to /api/canvas/sync for presence (who else is viewing).
//   3. Defers multi-cursor editing to a later package.
//
// The CRDT choice now prevents a costly migration later: if we shipped
// plain JSON and then added collaboration, every canvas would need a
// migration. By starting with Y.js, the data model is already
// conflict-free.

import { WebsocketProvider } from 'y-websocket'
import * as Y from 'yjs'
import type { CanvasEdge, CanvasNode, CanvasState } from './types'

export interface CollaborationSession {
  doc: Y.Doc
  provider: WebsocketProvider
  awareness: ReturnType<WebsocketProvider['awareness']>
  disconnect: () => void
}

export function initCollaboration(canvasId: string, syncUrl: string): CollaborationSession {
  const doc = new Y.Doc()
  const provider = new WebsocketProvider(syncUrl, `canvas:${canvasId}`, doc, {
    connect: true,
    maxBackoffTime: 30000,
  })

  // Awareness: who else is here. Each peer publishes { name, color, cursorViewport }.
  const awareness = provider.awareness
  awareness.setLocalStateField('joinedAt', new Date().toISOString())

  return {
    doc,
    provider,
    awareness,
    disconnect: () => {
      awareness.setLocalState(null)
      provider.disconnect()
      doc.destroy()
    },
  }
}

// Bind a Y.Array to canvas nodes. Each entry is a Y.Map matching CanvasNode.
export function bindNodes(
  doc: Y.Doc,
  onChange: (nodes: CanvasNode[]) => void,
): Y.Array<Y.Map<unknown>> {
  const arr = doc.getArray<Y.Map<unknown>>('nodes')
  arr.observe(() => {
    onChange(arr.map((m) => m.toJSON() as unknown as CanvasNode))
  })
  return arr
}

export function bindEdges(
  doc: Y.Doc,
  onChange: (edges: CanvasEdge[]) => void,
): Y.Array<Y.Map<unknown>> {
  const arr = doc.getArray<Y.Map<unknown>>('edges')
  arr.observe(() => {
    onChange(arr.map((m) => m.toJSON() as unknown as CanvasEdge))
  })
  return arr
}

// Push a local state change into the Y doc so it syncs to peers.
export function pushNode(arr: Y.Array<Y.Map<unknown>>, node: CanvasNode): void {
  const m = new Y.Map<unknown>()
  for (const [k, v] of Object.entries(node)) {
    m.set(k, v)
  }
  arr.push([m])
}

// Serialize the Y doc to a Uint8Array for binary sync / persistence.
export function serializeDoc(doc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(doc)
}

export function applyDocUpdate(doc: Y.Doc, update: Uint8Array): void {
  Y.applyUpdate(doc, update)
}

// Reconstruct a plain CanvasState from the Y doc (for export, save, etc.).
export function snapshotState(
  doc: Y.Doc,
  canvasId: string,
  viewport: CanvasState['viewport'],
): CanvasState {
  const nodes = doc
    .getArray<Y.Map<unknown>>('nodes')
    .map((m) => m.toJSON() as unknown as CanvasNode)
  const edges = doc
    .getArray<Y.Map<unknown>>('edges')
    .map((m) => m.toJSON() as unknown as CanvasEdge)
  return {
    schema: 'vivim.canvas/v1',
    id: canvasId,
    nodes,
    edges,
    bookmarks: [],
    viewport,
    updatedAt: new Date().toISOString(),
  }
}
