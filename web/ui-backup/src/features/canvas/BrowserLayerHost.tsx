// web/ui/src/features/canvas/BrowserLayerHost.tsx
// Browser-side LayerHost implementation (PRD-C2).
// Mounts a CanvasDefinition row as a React Flow node on the infinite plane.
// Replaces the server-only ServerLayerHost for the browser context.
// v2: drag-to-reposition (layer header draggable), resize handles (8-point).

import type { LayerHost, CanvasDefinition } from 'shared/canvas-types.js'
import type { CanvasNode } from './CanvasSurface.js'

/**
 * Create a browser-side LayerHost that writes React Flow nodes.
 * setNodes is the React state setter from CanvasSurface.
 */
export function createBrowserLayerHost(
  setNodes: React.Dispatch<React.SetStateAction<CanvasNode[]>>,
): LayerHost {
  const mounted = new Set<string>()

  return {
    async mount(instanceId: string, def: CanvasDefinition) {
      const node: CanvasNode = {
        id: instanceId,
        type: def.category,
        position: { x: def.layout.x, y: def.layout.y },
        data: {
          definitionId: def.id,
          sandbox: def.sandbox.allowCapabilities,
          overrideSlug: def.slug,
          z: def.layout.z ?? 0,
        },
        style: { width: def.layout.w, height: def.layout.h },
        draggable: true,
      }
      setNodes((prev) => [...prev, node])
      mounted.add(instanceId)
      return { hostNodeId: instanceId }
    },

    async unmount(instanceId: string) {
      setNodes((prev) => prev.filter((n) => n.id !== instanceId))
      mounted.delete(instanceId)
    },

    isMounted(instanceId: string) {
      return mounted.has(instanceId)
    },
  }
}

// ── Draggable Layer Header ───────────────────────────────────────────────────

interface DraggableHeaderProps {
  title: string
  instanceId: string
  onDragEnd: (x: number, y: number) => void
}

/**
 * Wraps a layer's header area with drag-to-reposition behavior.
 * On drag end, emits the new position so the host can persist via PATCH.
 */
export function makeDraggable(
  headerEl: HTMLElement,
  instanceId: string,
  onDragEnd: (x: number, y: number) => void,
): () => void {
  let startX = 0
  let startY = 0
  let dragging = false

  const onMouseDown = (e: MouseEvent) => {
    dragging = true
    startX = e.clientX
    startY = e.clientY
    e.preventDefault()
  }

  const onMouseMove = (e: MouseEvent) => {
    if (!dragging) return
    const dx = e.clientX - startX
    const dy = e.clientY - startY
    // Visual feedback could be applied here via CSS translate
  }

  const onMouseUp = (e: MouseEvent) => {
    if (!dragging) return
    dragging = false
    const dx = e.clientX - startX
    const dy = e.clientY - startY
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      onDragEnd(e.clientX, e.clientY)
    }
  }

  headerEl.addEventListener('mousedown', onMouseDown)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)

  return () => {
    headerEl.removeEventListener('mousedown', onMouseDown)
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }
}

// ── 8-Point Resize Handles ───────────────────────────────────────────────────

export const RESIZE_HANDLE_POSITIONS = [
  'top', 'top-right', 'right', 'bottom-right', 'bottom', 'bottom-left', 'left', 'top-left',
] as const

export type ResizeHandlePosition = (typeof RESIZE_HANDLE_POSITIONS)[number]

interface ResizeHandlesProps {
  /** Called on each resize delta. */
  onResize: (w: number, h: number) => void
  /** Called when resize completes. */
  onResizeEnd: (w: number, h: number) => void
  /** Minimum dimensions. */
  minWidth?: number
  minHeight?: number
}

/**
 * Creates 8 resize handle elements appended to a container.
 * Each handle is absolutely positioned. The caller manages start/end via
 * the returned cleanup + per-handle mouse event hooks.
 */
export function createResizeHandles(
  container: HTMLElement,
  currentW: number,
  currentH: number,
  opts: ResizeHandlesProps,
): () => void {
  const minW = opts.minWidth ?? 120
  const minH = opts.minHeight ?? 80
  const handles: HTMLElement[] = []
  let activeHandle: ResizeHandlePosition | null = null
  let startX = 0
  let startY = 0
  let startW = 0
  let startH = 0

  const handleSize = 8

  const styles: Record<ResizeHandlePosition, React.CSSProperties> = {
    top: { top: -handleSize / 2, left: '50%', width: '100%', height: handleSize, cursor: 'n-resize' },
    'top-right': { top: -handleSize / 2, right: -handleSize / 2, width: handleSize, height: handleSize, cursor: 'ne-resize' },
    right: { top: '50%', right: -handleSize / 2, width: handleSize, height: '100%', cursor: 'e-resize' },
    'bottom-right': { bottom: -handleSize / 2, right: -handleSize / 2, width: handleSize, height: handleSize, cursor: 'se-resize' },
    bottom: { bottom: -handleSize / 2, left: '50%', width: '100%', height: handleSize, cursor: 's-resize' },
    'bottom-left': { bottom: -handleSize / 2, left: -handleSize / 2, width: handleSize, height: handleSize, cursor: 'sw-resize' },
    left: { top: '50%', left: -handleSize / 2, width: handleSize, height: '100%', cursor: 'w-resize' },
    'top-left': { top: -handleSize / 2, left: -handleSize / 2, width: handleSize, height: handleSize, cursor: 'nw-resize' },
  }

  for (const pos of RESIZE_HANDLE_POSITIONS) {
    const el = document.createElement('div')
    Object.assign(el.style, {
      position: 'absolute',
      zIndex: '10',
      ...styles[pos],
      opacity: '0',
    })
    el.setAttribute('data-resize-handle', pos)
    el.addEventListener('mouseenter', () => { el.style.opacity = '1' })
    el.addEventListener('mouseleave', () => { if (activeHandle !== pos) el.style.opacity = '0' })
    el.addEventListener('mousedown', (e) => {
      activeHandle = pos
      startX = e.clientX
      startY = e.clientY
      startW = currentW
      startH = currentH
      el.style.opacity = '1'
      e.preventDefault()
      e.stopPropagation()
    })
    container.appendChild(el)
    handles.push(el)
  }

  const onMouseMove = (e: MouseEvent) => {
    if (!activeHandle) return
    const dx = e.clientX - startX
    const dy = e.clientY - startY
    let newW = startW
    let newH = startH

    if (activeHandle.includes('right')) newW = Math.max(minW, startW + dx)
    if (activeHandle.includes('left')) newW = Math.max(minW, startW - dx)
    if (activeHandle.includes('bottom')) newH = Math.max(minH, startH + dy)
    if (activeHandle.includes('top')) newH = Math.max(minH, startH - dy)

    opts.onResize(newW, newH)
  }

  const onMouseUp = (_e: MouseEvent) => {
    if (activeHandle) {
      const w = currentW
      const h = currentH
      // Compute final dimensions
      activeHandle = null
      opts.onResizeEnd(w, h)
      for (const el of handles) el.style.opacity = '0'
    }
  }

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)

  return () => {
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
    for (const el of handles) container.removeChild(el)
  }
}
