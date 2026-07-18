// web/ui/src/features/canvas/CanvasSurface.tsx
// The unified infinite-canvas frontend shell (PRD-C1).
// A single React Flow instance renders every UI region as a node.
// The UIComponentRegistry and LayerHost are unified into one nodeTypes registry.
// No dual shell — ChatPage is retired; all UI renders as nodes.
// EventBus-driven live updates (PRD-C7) + uiSlots resolution (PRD-C5).
// v2: depth-sorting, minimap, undo/redo, error boundaries, loading/empty states,
// welcome overlay, first-run wizard, theme, keyboard shortcuts.
// v2.1: snap-to-grid, state serialization, z-depth CSS, drag persistence.

import { useCallback, useEffect, useState, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  useReactFlow,
} from '@xyflow/react'
import type { Node, OnNodesChange, NodeDragHandler } from '@xyflow/react'
import { applyNodeChanges } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { CanvasLayer } from 'shared/canvas-types.js'
import { useNodeTypes } from './useNodeTypes.js'
import { useCanvasEvents } from './useCanvasEvents.js'
import { useUiSlots } from './useUiSlots.js'
import { useConceptualModel } from './useConceptualModel.js'
import { ErrorBoundary } from './ErrorBoundary.js'
import { LoadingSkeleton, EmptyLayer } from './LoadingSkeleton.js'
import { MinimapNode } from './MinimapNode.js'
import { useCanvasHistory, type CanvasCommand } from './useCanvasHistory.js'
import {
  useKeyboardShortcuts,
  getDefaultCanvasShortcuts,
  ShortcutOverlay,
} from './useKeyboardShortcuts.js'
import { ThemeProvider, useTheme } from './ThemeProvider.js'
import { WelcomeOverlay } from './WelcomeOverlay.js'
import { FirstRunWizard } from './FirstRunWizard.js'
import { FeatureTour } from './FeatureTour.js'
import { CanvasDesigner } from './CanvasDesigner.js'

/**
 * A "node" in our system is a capability-global / slot / canvas layer.
 * position comes from CanvasLayout{x,y}; type is the slot/capability slug.
 */
export interface CanvasNode extends Node {
  data: {
    overrideSlug?: string
    providerSlug?: string
    sandbox?: string[]
    definitionId?: string
    primitiveId?: string
    slotId?: string
    componentKey?: string
    fromSystemDefault?: boolean
    tier?: string
    z?: number
    layerId?: string
  }
}

// Seed nodes — fallback layout for the chat surface when the backend
// conceptual model is unreachable. Replaced at runtime by resolved slots.
const SEED_NODES: CanvasNode[] = [
  { id: 'chat.header', type: 'chat.header', position: { x: 0, y: -60 }, data: { z: 0 } },
  { id: 'chat.sidebar', type: 'chat.sidebar', position: { x: -400, y: 0 }, data: { z: 1 } },
  { id: 'chat.entry', type: 'chat.entry', position: { x: 0, y: 0 }, data: { z: 2 } },
  { id: 'chat.thread', type: 'chat.thread', position: { x: 420, y: 0 }, data: { z: 3 } },
  { id: 'chat.composer', type: 'chat.composer', position: { x: 420, y: 400 }, data: { z: 4 } },
  { id: 'chat.actionBar', type: 'chat.actionBar', position: { x: 0, y: 600 }, data: { z: 5 } },
]

/** Sort nodes by data.z for depth layering. */
function sortByDepth(nodes: CanvasNode[]): CanvasNode[] {
  return [...nodes].sort((a, b) => (a.data.z ?? 0) - (b.data.z ?? 0))
}

function nodeStyleWithDepth(node: CanvasNode): React.CSSProperties {
  const z = node.data.z ?? 0
  return {
    zIndex: z * 10,
    ...(node.style as React.CSSProperties),
  }
}

const BASE_URL = import.meta.env.VITE_API_URL ?? ''

export interface CanvasSurfaceProps {
  providerId?: string
}

function CanvasSurfaceInner({ providerId = 'chatgpt' }: CanvasSurfaceProps) {
  const nodeTypes = useNodeTypes()
  const conceptual = useConceptualModel(providerId)
  const [nodes, setNodes] = useState<CanvasNode[]>(SEED_NODES)
  const { setCenter } = useReactFlow()
  const history = useCanvasHistory(100)
  const [showWelcome, setShowWelcome] = useState(false)
  const [showWizard, setShowWizard] = useState(false)
  const [showDesigner, setShowDesigner] = useState(false)
  const [minimapVisible, setMinimapVisible] = useState(true)
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes
  const dragRef = useRef<{ nodeId: string; fromX: number; fromY: number } | null>(null)

  // C7: Subscribe to live canvas layer events via WebSocket
  useCanvasEvents(setNodes)

  // C5: Apply uiSlots claims from backend capabilities on mount
  useUiSlots()

  // State serialization: restore layers from backend on mount
  useEffect(() => {
    let cancelled = false
    fetch(`${BASE_URL}/api/canvas/layers`, { headers: { 'X-Source': 'frontend' } })
      .then((r) => r.json())
      .then((data: { ok?: boolean; result?: CanvasLayer[] }) => {
        if (cancelled || !data?.result) return
        const restored = data.result
          .filter((l) => l.visible)
          .map((l): CanvasNode => ({
            id: l.id,
            type: l.category,
            position: { x: l.layout.x, y: l.layout.y },
            style: { width: l.layout.w, height: l.layout.h },
            data: {
              z: l.layout.z,
              layerId: l.id,
              overrideSlug: l.name,
            },
            draggable: !l.locked,
          }))
        if (restored.length > 0) setNodes(restored)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Family-driven: when the conceptual surface resolves, swap seed nodes for
  // the resolved family slots (4-tier resolution, data-driven).
  useEffect(() => {
    if (conceptual.loading || conceptual.error) return
    const resolved = conceptual.toNodes()
    if (resolved.length > 0) setNodes(resolved)
  }, [conceptual])

  // Check for first-run state
  useEffect(() => {
    let cancelled = false
    fetch(`${BASE_URL}/api/workspace/mode`, { headers: { 'X-Source': 'frontend' } })
      .then((r) => r.json())
      .then((data: { exists?: boolean }) => {
        if (!cancelled && !data?.exists) {
          setShowWelcome(true)
          setShowWizard(false)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // ── Persistence helpers ──────────────────────────────────────────────────

  const persistLayout = useCallback((layerId: string, x: number, y: number, z: number, w: number, h: number) => {
    fetch(`${BASE_URL}/api/canvas/layers/${layerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Source': 'frontend' },
      body: JSON.stringify({ x, y, z, w, h }),
    }).catch(() => {})
  }, [])

  // ── Drag with persistence ─────────────────────────────────────────────────

  const onNodeDragStart: NodeDragHandler<CanvasNode> = useCallback((_event, node) => {
    dragRef.current = { nodeId: node.id, fromX: node.position.x, fromY: node.position.y }
  }, [])

  const onNodeDragStop: NodeDragHandler<CanvasNode> = useCallback((_event, node) => {
    const drag = dragRef.current
    if (!drag || drag.nodeId !== node.id) return
    const fromX = drag.fromX
    const fromY = drag.fromY
    const toX = node.position.x
    const toY = node.position.y

    if (fromX !== toX || fromY !== toY) {
      const z = node.data.z ?? 0
      const w = (node.style?.width as number) ?? 300
      const h = (node.style?.height as number) ?? 200
      if (node.data.layerId) persistLayout(node.data.layerId, toX, toY, z, w, h)

      const moveCmd: CanvasCommand = {
        label: `Move ${node.id}`,
        undo: () => {
          setNodes((prev) =>
            prev.map((n) => (n.id === node.id ? { ...n, position: { x: fromX, y: fromY } } : n)),
          )
        },
        redo: () => {
          setNodes((prev) =>
            prev.map((n) => (n.id === node.id ? { ...n, position: { x: toX, y: toY } } : n)),
          )
        },
      }
      history.push(moveCmd)
    }
    dragRef.current = null
  }, [history, persistLayout])

  // ── Node changes with undo ───────────────────────────────────────────────

  const onNodesChange: OnNodesChange<CanvasNode> = useCallback(
    (changes) => {
      const positionChanges = changes.filter((c) => c.type === 'position' && c.position)
      if (positionChanges.length > 0) {
        const prevNodes = new Map(nodesRef.current.map((n) => [n.id, n]))
        const moveCmd: CanvasCommand = {
          label: `Move ${positionChanges.length} node(s)`,
          undo: () => {
            setNodes((nds) =>
              nds.map((n) => {
                const prev = prevNodes.get(n.id)
                if (!prev) return n
                if (positionChanges.some((pc) => pc.id === n.id)) {
                  return { ...n, position: { ...prev.position } }
                }
                return n
              }),
            )
          },
          redo: () => {
            setNodes((nds) =>
              nds.map((n) => {
                const change = positionChanges.find((pc) => pc.id === n.id)
                if (!change?.position) return n
                return { ...n, position: { ...change.position } }
              }),
            )
          },
        }
        history.push(moveCmd)
      }

      setNodes((nds) => {
        for (const change of changes) {
          if (change.type === 'dimensions' && change.dimensions) {
            const idx = nds.findIndex((n) => n.id === change.id)
            if (idx >= 0) {
              const prevDims = { w: (nds[idx].style?.width as number) ?? 300, h: (nds[idx].style?.height as number) ?? 200 }
              const newDims = { w: change.dimensions.width as number, h: change.dimensions.height as number }
              if (nds[idx].data.layerId) {
                persistLayout(nds[idx].data.layerId!, nds[idx].position.x, nds[idx].position.y, nds[idx].data.z ?? 0, newDims.w, newDims.h)
              }
              const resizeCmd: CanvasCommand = {
                label: `Resize ${nds[idx].id}`,
                undo: () => {
                  setNodes((prev) =>
                    prev.map((n) =>
                      n.id === nds[idx].id ? { ...n, style: { ...n.style, width: prevDims.w, height: prevDims.h } } : n,
                    ),
                  )
                },
                redo: () => {
                  setNodes((prev) =>
                    prev.map((n) =>
                      n.id === nds[idx].id ? { ...n, style: { ...n.style, width: newDims.w, height: newDims.h } } : n,
                    ),
                  )
                },
              }
              history.push(resizeCmd)
            }
          }
        }
        return applyNodeChanges(changes, nds) as CanvasNode[]
      })
    },
    [history, persistLayout],
  )

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  const shortcuts = getDefaultCanvasShortcuts(history.undo, history.redo)
  shortcuts.push({
    key: 'm', action: () => setMinimapVisible((v) => !v), description: 'Toggle minimap',
  })
  shortcuts.push({
    key: 'f', action: () => setCenter(0, 0, { zoom: 1, duration: 300 }), description: 'Zoom to fit',
  })
  shortcuts.push({
    key: 'n', ctrl: true, action: () => {
      fetch(`${BASE_URL}/api/canvas/layers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Source': 'frontend' },
        body: JSON.stringify({ name: 'New Layer', category: 'chat', z: (nodes.length + 1) * 10 }),
      }).catch(() => {})
    }, description: 'New layer',
  })
  shortcuts.push({
    key: 'Delete', action: () => {}, description: 'Dismiss selected layer',
  })

  const kb = useKeyboardShortcuts(shortcuts)

  // Depth-sorted nodes with z-index styling
  const sortedNodes = sortByDepth(nodes).map((n) => ({
    ...n,
    style: nodeStyleWithDepth(n),
  }))

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <ErrorBoundary>
        <div style={{ perspective: '1000px', width: '100%', height: '100%' }}>
          <ReactFlow
            nodes={sortedNodes}
            edges={[]}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onNodeDragStart={onNodeDragStart}
            onNodeDragStop={onNodeDragStop}
            onlyRenderVisibleElements={true}
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            minZoom={0.1}
            maxZoom={4}
            snapToGrid={true}
            snapGrid={[20, 20]}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>

        {/* Custom minimap overlay */}
        {minimapVisible && <MinimapNode nodes={nodes} />}

        {/* Spec 002 (P2): Designer launch button */}
        <button
          type="button"
          onClick={() => setShowDesigner(true)}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            zIndex: 300,
            padding: '8px 14px',
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 8,
            border: '1px solid var(--border-primary, #374151)',
            background: 'var(--bg-secondary, #1f2937)',
            color: 'var(--text-primary, #f9fafb)',
            cursor: 'pointer',
          }}
        >
          Design Layer
        </button>
        <CanvasDesigner open={showDesigner} onClose={() => setShowDesigner(false)} />

        {/* Loading state */}
        {conceptual.loading && (
          <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 200 }}>
            <LoadingSkeleton width={200} height={40} />
          </div>
        )}

        {conceptual.error && (
          <div style={{
            position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
            zIndex: 200, padding: '8px 16px', borderRadius: 8, background: '#1f1f2e',
            border: '1px solid #ef4444', color: '#fca5a5', fontSize: 13,
          }}>
            {conceptual.error}
          </div>
        )}

        {/* Empty state */}
        {nodes.length === 0 && !conceptual.loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, pointerEvents: 'none' }}>
            <EmptyLayer message="No components — press Ctrl+N to add a layer" />
          </div>
        )}

        {/* Keyboard shortcut overlay */}
        {kb.showShortcutOverlay && <ShortcutOverlay shortcuts={shortcuts} />}
      </ErrorBoundary>
    </div>
  )
}

export function CanvasSurface(props: CanvasSurfaceProps) {
  return (
    <ThemeProvider>
      <CanvasSurfaceInner {...props} />
    </ThemeProvider>
  )
}

export function CanvasSurfaceWithFirstRun(props: CanvasSurfaceProps) {
  const [showWelcome, setShowWelcome] = useState(false)
  const [showWizard, setShowWizard] = useState(false)
  const [showTour, setShowTour] = useState(false)

  useEffect(() => {
    const completed = window.localStorage.getItem('vivim.onboarding_complete')
    if (completed === 'true') return
    let cancelled = false
    fetch(`${BASE_URL}/api/workspace/mode`, { headers: { 'X-Source': 'frontend' } })
      .then((r) => r.json())
      .then((data: { exists?: boolean }) => {
        if (!cancelled && !data?.exists) {
          setShowWelcome(true)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  if (showWizard) {
    return (
      <ThemeProvider>
        <FirstRunWizard
          onComplete={() => {
            setShowWizard(false)
            window.localStorage.setItem('vivim.onboarding_complete', 'true')
            const tourDone = window.localStorage.getItem('vivim.tour_complete')
            if (tourDone !== 'true') {
              setShowTour(true)
            }
          }}
        />
      </ThemeProvider>
    )
  }

  if (showTour) {
    return (
      <ThemeProvider>
        <FeatureTour onComplete={() => setShowTour(false)} />
        <CanvasSurface {...props} />
      </ThemeProvider>
    )
  }

  if (showWelcome) {
    return (
      <ThemeProvider>
        <WelcomeOverlay
          onStart={() => { setShowWelcome(false); setShowWizard(true) }}
          onSkip={() => { setShowWelcome(false) }}
        />
      </ThemeProvider>
    )
  }

  return <CanvasSurface {...props} />
}
