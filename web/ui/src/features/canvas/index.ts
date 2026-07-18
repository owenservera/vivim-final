// web/ui/src/features/canvas/index.ts
// Canvas surface barrel exports.

export { CanvasSurface, CanvasSurfaceWithFirstRun, type CanvasNode } from './CanvasSurface.js'
export { useNodeTypes } from './useNodeTypes.js'
export { createBrowserLayerHost } from './BrowserLayerHost.js'
export { SandboxedLayer, type SandboxAuditEvent } from './SandboxedLayer.js'
export { useZoomTier, useZoom, type ZoomTier } from './useZoomLevel.js'
export { ZoomNode } from './ZoomNode.js'
export { useUiSlots } from './useUiSlots.js'
export { useStreamBlocks } from './useStreamBlocks.js'
export { StreamingSlot } from './StreamingSlot.js'
export { ResultSlot } from './ResultSlot.js'
export { useCanvasEvents } from './useCanvasEvents.js'
export { useManifest, type CanvasManifest } from './useManifest.js'
export { ErrorBoundary } from './ErrorBoundary.js'
export { LoadingSkeleton, EmptyLayer } from './LoadingSkeleton.js'
export { MinimapNode } from './MinimapNode.js'
export {
  useCanvasHistory,
  makeSpawnCommand,
  makeDismissCommand,
  makeMoveCommand,
  makeResizeCommand,
  type CanvasCommand,
  type CanvasHistory,
  type SpawnCommand,
  type DismissCommand,
  type MoveCommand,
  type ResizeCommand,
} from './useCanvasHistory.js'
export {
  useKeyboardShortcuts,
  getDefaultCanvasShortcuts,
  ShortcutOverlay,
  type ShortcutBinding,
} from './useKeyboardShortcuts.js'
export { ThemeProvider, useTheme, type Theme } from './ThemeProvider.js'
export { WelcomeOverlay } from './WelcomeOverlay.js'
export { FirstRunWizard, type WizardStep } from './FirstRunWizard.js'
