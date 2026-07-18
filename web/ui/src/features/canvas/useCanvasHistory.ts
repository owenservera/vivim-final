// web/ui/src/features/canvas/useCanvasHistory.ts
// Undo/redo for canvas operations using a command pattern stack.
// v2: concrete command types (Spawn, Dismiss, Move, Resize), max depth 100.

import { useCallback, useRef, useState } from 'react'

export interface CanvasCommand {
  undo: () => void
  redo: () => void
  label: string
}

export interface CanvasHistory {
  push: (cmd: CanvasCommand) => void
  undo: () => void
  redo: () => void
  clear: () => void
  canUndo: boolean
  canRedo: boolean
  lastUndoLabel: string | null
  lastRedoLabel: string | null
  maxDepth: number
}

// ── Concrete command types ──────────────────────────────────────────────────

export interface SpawnCommand extends CanvasCommand {
  kind: 'spawn'
  layerId: string
}

export interface DismissCommand extends CanvasCommand {
  kind: 'dismiss'
  layerId: string
}

export interface MoveCommand extends CanvasCommand {
  kind: 'move'
  layerId: string
}

export interface ResizeCommand extends CanvasCommand {
  kind: 'resize'
  layerId: string
}

export function makeSpawnCommand(
  layerId: string,
  doSpawn: () => void,
  doDismiss: () => void,
): CanvasCommand {
  return {
    label: `Spawn ${layerId}`,
    undo: doDismiss,
    redo: doSpawn,
  } as SpawnCommand & { kind: 'spawn'; layerId: string }
}

export function makeDismissCommand(
  layerId: string,
  doDismiss: () => void,
  doSpawn: () => void,
): CanvasCommand {
  return {
    label: `Dismiss ${layerId}`,
    undo: doSpawn,
    redo: doDismiss,
  } as DismissCommand & { kind: 'dismiss'; layerId: string }
}

export function makeMoveCommand(
  layerId: string,
  fromX: number, fromY: number,
  toX: number, toY: number,
  apply: (x: number, y: number) => void,
): CanvasCommand {
  return {
    label: `Move ${layerId}`,
    undo: () => apply(fromX, fromY),
    redo: () => apply(toX, toY),
  } as MoveCommand & { kind: 'move'; layerId: string }
}

export function makeResizeCommand(
  layerId: string,
  fromW: number, fromH: number,
  toW: number, toH: number,
  apply: (w: number, h: number) => void,
): CanvasCommand {
  return {
    label: `Resize ${layerId}`,
    undo: () => apply(fromW, fromH),
    redo: () => apply(toW, toH),
  } as ResizeCommand & { kind: 'resize'; layerId: string }
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useCanvasHistory(maxDepth = 100): CanvasHistory {
  const undoStack = useRef<CanvasCommand[]>([])
  const redoStack = useRef<CanvasCommand[]>([])
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [lastUndoLabel, setLastUndoLabel] = useState<string | null>(null)
  const [lastRedoLabel, setLastRedoLabel] = useState<string | null>(null)

  const push = useCallback(
    (cmd: CanvasCommand) => {
      undoStack.current.push(cmd)
      if (undoStack.current.length > maxDepth) {
        undoStack.current.shift()
      }
      redoStack.current = []
      setCanUndo(true)
      setCanRedo(false)
      setLastUndoLabel(cmd.label)
      setLastRedoLabel(null)
    },
    [maxDepth],
  )

  const undo = useCallback(() => {
    const cmd = undoStack.current.pop()
    if (!cmd) return
    try {
      cmd.undo()
      redoStack.current.push(cmd)
      setCanUndo(undoStack.current.length > 0)
      setCanRedo(true)
      setLastUndoLabel(undoStack.current[undoStack.current.length - 1]?.label ?? null)
      setLastRedoLabel(cmd.label)
    } catch {
      // undo failed — discard
    }
  }, [])

  const redo = useCallback(() => {
    const cmd = redoStack.current.pop()
    if (!cmd) return
    try {
      cmd.redo()
      undoStack.current.push(cmd)
      setCanRedo(redoStack.current.length > 0)
      setCanUndo(true)
      setLastRedoLabel(redoStack.current[redoStack.current.length - 1]?.label ?? null)
      setLastUndoLabel(cmd.label)
    } catch {
      // redo failed — discard
    }
  }, [])

  const clear = useCallback(() => {
    undoStack.current = []
    redoStack.current = []
    setCanUndo(false)
    setCanRedo(false)
    setLastUndoLabel(null)
    setLastRedoLabel(null)
  }, [])

  return { push, undo, redo, clear, canUndo, canRedo, lastUndoLabel, lastRedoLabel, maxDepth }
}
