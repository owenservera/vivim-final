'use client'

import { handleKey } from '@/canvas/commands'
import { loadCanvas, saveCanvas } from '@/canvas/persistence'
import { useCanvasStore } from '@/canvas/store'
import type { CanvasPalette as CPalette, CanvasConfig, CanvasNode } from '@/canvas/types'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CanvasConfigPanel } from './CanvasConfigPanel'
import { CanvasMinimap } from './CanvasMinimap'
import { CanvasPalette } from './CanvasPalette'

export interface InfiniteCanvasProps {
  canvasId?: string
  className?: string
}

function CanvasNodeRenderer({
  node,
  config,
  selected,
  onSelect,
}: {
  node: CanvasNode
  config: CanvasConfig
  selected: boolean
  onSelect: (id: string) => void
}) {
  const w = node.size?.x ?? config.nodes.comfortable.width
  const h = node.size?.y ?? config.nodes.comfortable.height
  const categoryColor =
    config.palette.nodeByCategory[node.data.category as string] ?? config.palette.accent

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={node.label ?? node.type}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(node.id)
      }}
      style={{
        position: 'absolute',
        left: node.position.x,
        top: node.position.y,
        width: w,
        height: h,
        borderRadius: config.nodes.borderRadius,
        border: `2px solid ${selected ? config.palette.accent : config.palette.border}`,
        background: config.palette.surface,
        boxShadow: config.nodes.shadow ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: config.nodes.fontFamily,
        fontSize: config.nodes.fontSize,
        color: config.palette.text,
        transition: 'border-color 0.15s',
      }}
    >
      {/* Color bar */}
      <div style={{ height: 4, background: categoryColor, flexShrink: 0 }} />
      {/* Label */}
      <div
        style={{
          padding: '8px 12px',
          fontWeight: 600,
          borderBottom: `1px solid ${config.palette.border}`,
        }}
      >
        {node.label ?? node.type}
      </div>
      {/* Body */}
      <div
        style={{ flex: 1, padding: '8px 12px', overflow: 'auto', color: config.palette.textMuted }}
      >
        {node.type === 'note' && <span>{(node.data.text as string) ?? ''}</span>}
        {node.type === 'code' && (
          <code style={{ fontFamily: 'var(--font-geist-mono), monospace', fontSize: 12 }}>
            {(node.data.code as string) ?? ''}
          </code>
        )}
        {node.type === 'link' && (
          <a
            href={node.data.url as string}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: config.palette.accent, textDecoration: 'underline' }}
          >
            {node.data.url as string}
          </a>
        )}
        {node.type === 'package' && <span>{(node.data.slug as string) ?? node.id}</span>}
        {node.type === 'image' && Boolean(node.data.src) && (
          <img
            src={node.data.src as string}
            alt={node.label ?? ''}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        )}
        {node.type === 'group' && (
          <span style={{ fontStyle: 'italic', color: config.palette.textMuted }}>Group</span>
        )}
        {node.type === 'marker' && (
          <span style={{ fontSize: 20 }}>{(node.data.emoji as string) ?? '📌'}</span>
        )}
      </div>
    </div>
  )
}

function CanvasToolbarButton({
  label,
  onClick,
  active,
  palette,
}: {
  label: string
  onClick: () => void
  active: boolean
  palette: CPalette
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        padding: '4px 10px',
        borderRadius: 6,
        border: `1px solid ${active ? palette.accent : palette.border}`,
        background: active ? palette.accent : palette.surface,
        color: active ? palette.surface : palette.text,
        cursor: 'pointer',
        fontSize: 12,
        fontFamily: 'var(--font-geist-mono), monospace',
        fontWeight: 500,
      }}
    >
      {label}
    </button>
  )
}

export function InfiniteCanvas({ canvasId, className }: InfiniteCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [showConfig, setShowConfig] = useState(false)
  const [showPalette, setShowPalette] = useState(false)
  const [commandInput, setCommandInput] = useState('')
  const [pendingKeys, setPendingKeys] = useState('')
  const [statusText, setStatusText] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef<{ x: number; y: number } | null>(null)

  const {
    state,
    config,
    mode,
    selectedNodeIds,
    setViewport,
    panBy,
    zoomBy,
    select,
    clearSelection,
    addNode,
    removeNode,
    undo,
    redo,
    setMode,
    loadState,
    commit,
  } = useCanvasStore()

  useEffect(() => {
    if (!canvasId) return
    loadCanvas(canvasId).then((saved) => {
      if (saved) loadState(saved)
    })
  }, [canvasId, loadState])

  useEffect(() => {
    const timer = setTimeout(() => {
      saveCanvas(state)
    }, config.persistence.autosaveMs)
    return () => clearTimeout(timer)
  }, [state, config.persistence.autosaveMs])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (mode === 'command') {
        if (e.key === 'Enter') {
          const cmd = commandInput.trim().toLowerCase()
          if (cmd.startsWith('zoom ')) {
            const factor = Number.parseFloat(cmd.slice(5))
            if (!isNaN(factor)) zoomBy(factor)
          } else if (cmd === 'config' || cmd === 'settings') {
            setShowConfig(true)
          } else if (cmd === 'palette') {
            setShowPalette(true)
          }
          setCommandInput('')
          setMode('normal')
        } else if (e.key === 'Escape') {
          setCommandInput('')
          setMode('normal')
        } else if (e.key === 'Backspace') {
          setCommandInput((c) => c.slice(0, -1))
        } else if (e.key.length === 1) {
          setCommandInput((c) => c + e.key)
        }
        e.preventDefault()
        return
      }

      if (mode === 'insert') {
        if (e.key === 'Escape') {
          setMode('normal')
          setStatusText('')
        }
        return
      }

      const result = handleKey(e.key, mode, pendingKeys, config, { nodeIds: selectedNodeIds })
      setPendingKeys(result.pendingKeys)
      setMode(result.mode)
      if (result.statusText) setStatusText(result.statusText)

      if (result.action) {
        const act = result.action
        switch (act.kind) {
          case 'pan':
            panBy(act.dx, act.dy)
            break
          case 'zoom':
            zoomBy(act.factor)
            break
          case 'zoom-fit': {
            if (state.nodes.length > 0) {
              const xs = state.nodes.flatMap((n) => [n.position.x, n.position.x + (n.size?.x ?? 0)])
              const ys = state.nodes.flatMap((n) => [n.position.y, n.position.y + (n.size?.y ?? 0)])
              const minX = Math.min(...xs) - 100
              const minY = Math.min(...ys) - 100
              const maxX = Math.max(...xs) + 100
              const maxY = Math.max(...ys) + 100
              const vw = containerRef.current?.clientWidth ?? 800
              const vh = containerRef.current?.clientHeight ?? 600
              const scaleX = vw / (maxX - minX)
              const scaleY = vh / (maxY - minY)
              const s = Math.min(scaleX, scaleY, 1)
              setViewport({ origin: { x: minX, y: minY }, scale: s })
            }
            break
          }
          case 'node-delete':
            for (const id of act.ids) removeNode(id)
            commit()
            break
          case 'undo':
            undo()
            break
          case 'redo':
            redo()
            break
          case 'select-all': {
            const allIds = state.nodes.map((n) => n.id)
            select(allIds)
            break
          }
          case 'clear-selection':
            clearSelection()
            break
          case 'insert-note': {
            const at = act.at ?? {
              x: state.viewport.origin.x + (containerRef.current?.clientWidth ?? 800) / 2,
              y: state.viewport.origin.y + (containerRef.current?.clientHeight ?? 600) / 2,
            }
            addNode({
              type: 'note',
              position: at,
              data: { text: '' },
              label: 'New Note',
            })
            commit()
            break
          }
          case 'command-open':
            setMode('command')
            setCommandInput('')
            break
          case 'find':
            setStatusText('Find: not yet wired')
            break
        }
      }

      e.preventDefault()
    },
    [
      mode,
      pendingKeys,
      config,
      selectedNodeIds,
      state,
      commandInput,
      panBy,
      zoomBy,
      setViewport,
      setMode,
      select,
      clearSelection,
      addNode,
      removeNode,
      undo,
      redo,
      commit,
    ],
  )

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        const factor = e.deltaY > 0 ? 0.9 : 1.1
        zoomBy(factor, { x: e.clientX, y: e.clientY })
      } else {
        panBy(e.deltaX, e.deltaY)
      }
      e.preventDefault()
    },
    [zoomBy, panBy],
  )

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsDragging(true)
      dragStart.current = { x: e.clientX, y: e.clientY }
      e.preventDefault()
    }
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging && dragStart.current) {
        const dx = e.clientX - dragStart.current.x
        const dy = e.clientY - dragStart.current.y
        dragStart.current = { x: e.clientX, y: e.clientY }
        panBy(dx, dy)
      }
    },
    [isDragging, panBy],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    dragStart.current = null
  }, [])

  const { origin, scale } = state.viewport

  return (
    <div
      ref={containerRef}
      className={className}
      onKeyDown={handleKeyDown}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      tabIndex={0}
      role="application"
      aria-label="Infinite Canvas"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        outline: 'none',
        cursor: isDragging ? 'grabbing' : 'default',
        background: config.palette.background,
      }}
    >
      {config.grid.style !== 'none' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              config.grid.style === 'dots'
                ? `radial-gradient(circle, ${config.grid.color} 1px, transparent 1px)`
                : `linear-gradient(${config.grid.color} 1px, transparent 1px), linear-gradient(90deg, ${config.grid.color} 1px, transparent 1px)`,
            backgroundSize: `${config.grid.size * scale}px ${config.grid.size * scale}px`,
            backgroundPosition: `${-origin.x * scale}px ${-origin.y * scale}px`,
            opacity: 0.6,
            pointerEvents: 'none',
          }}
        />
      )}

      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translate(${-origin.x * scale}px, ${-origin.y * scale}px) scale(${scale})`,
          transformOrigin: '0 0',
          willChange: 'transform',
        }}
      >
        {state.nodes.map((node) => (
          <CanvasNodeRenderer
            key={node.id}
            node={node}
            config={config}
            selected={selectedNodeIds.includes(node.id)}
            onSelect={(id) => select([id])}
          />
        ))}
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            overflow: 'visible',
          }}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="10"
              refY="3.5"
              orient="auto"
            >
              <polygon
                points="0 0, 10 3.5, 0 7"
                fill={config.palette.edgeByKind['depends-on'] ?? '#78716c'}
              />
            </marker>
          </defs>
          {state.edges.map((edge) => {
            const fromNode = state.nodes.find((n) => n.id === edge.from)
            const toNode = state.nodes.find((n) => n.id === edge.to)
            if (!fromNode || !toNode) return null
            const x1 = fromNode.position.x + (fromNode.size?.x ?? 0) / 2
            const y1 = fromNode.position.y + (fromNode.size?.y ?? 0) / 2
            const x2 = toNode.position.x + (toNode.size?.x ?? 0) / 2
            const y2 = toNode.position.y + (toNode.size?.y ?? 0) / 2
            return (
              <line
                key={edge.id}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={config.palette.edgeByKind[edge.kind] ?? '#78716c'}
                strokeWidth={config.edges.width}
                markerEnd="url(#arrowhead)"
              />
            )
          })}
        </svg>
      </div>

      <CanvasMinimap
        nodes={state.nodes}
        viewport={state.viewport}
        containerSize={{
          w: containerRef.current?.clientWidth ?? 800,
          h: containerRef.current?.clientHeight ?? 600,
        }}
        palette={config.palette}
        onNavigate={(x, y, s) => setViewport({ origin: { x, y }, scale: s })}
      />

      <div
        style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontFamily: 'var(--font-geist-mono), monospace',
          fontSize: 12,
          color: config.palette.textMuted,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        <span
          style={{
            padding: '2px 8px',
            borderRadius: 4,
            background:
              mode === 'normal'
                ? 'rgba(0,0,0,0.06)'
                : mode === 'insert'
                  ? 'rgba(34,197,94,0.15)'
                  : mode === 'visual'
                    ? 'rgba(99,102,241,0.15)'
                    : 'rgba(234,179,8,0.15)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {mode}
        </span>
        {pendingKeys && <span>...{pendingKeys}</span>}
        {statusText && <span>{statusText}</span>}
        {mode === 'command' && (
          <span style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(0,0,0,0.06)' }}>
            :{commandInput}
          </span>
        )}
      </div>

      <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 4 }}>
        <CanvasToolbarButton
          label="Config"
          onClick={() => setShowConfig((v) => !v)}
          active={showConfig}
          palette={config.palette}
        />
        <CanvasToolbarButton
          label="Palette"
          onClick={() => setShowPalette((v) => !v)}
          active={showPalette}
          palette={config.palette}
        />
      </div>

      {showConfig && (
        <CanvasConfigPanel
          config={config}
          onClose={() => setShowConfig(false)}
          onReset={() => useCanvasStore.getState().resetConfig()}
        />
      )}

      {showPalette && (
        <CanvasPalette
          palette={config.palette}
          onChange={(patch) => {
            useCanvasStore.getState().setConfig({
              palette: { ...config.palette, ...patch },
            })
          }}
          onClose={() => setShowPalette(false)}
        />
      )}
    </div>
  )
}
