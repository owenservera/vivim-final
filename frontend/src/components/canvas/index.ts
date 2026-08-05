/**
 * components/canvas/index.ts — barrel.
 * Phase 2 adds: WorkspaceSwitcher + cards (Doc/Media/Automation/Agent/Shell).
 */
export { CanvasSurface } from './CanvasSurface'
export type { CanvasSurfaceProps } from './CanvasSurface'
export { CanvasNode } from './CanvasNode'
export type { CanvasNodeProps } from './CanvasNode'
export { SandboxedNode } from './SandboxedNode'
export type { SandboxedNodeProps, SandboxAuditEvent } from './SandboxedNode'
export { useResolvedNodes } from './use-resolved-nodes'
export { useCanvasEvents, getCanvasEventBus } from './use-canvas-events'
export type { CanvasEvent } from './use-canvas-events'
export { EventBus } from './event-bus'
export { CommandStack } from './command-stack'
export type { Command } from './command-stack'
export { QuadTree } from './quad-tree'
export type { BoundingBox, Vec2, QTEntry } from './quad-tree'
export { worldToScreen, screenToWorld, clampZoom } from './transform'
export type { ViewportState } from './transform'
export { LiveConfigProvider, useLiveConfig } from './LiveConfigProvider'
export type { LiveConfigContextValue, LiveConfigProviderProps } from './LiveConfigProvider'

// Phase 2
export { WorkspaceSwitcher } from './WorkspaceSwitcher'
export type { WorkspaceSwitcherProps } from './WorkspaceSwitcher'
export { DocCard, MediaCard, AutomationCard, AgentCard, ShellCard } from './cards'
export type { DocCardProps, MediaCardProps, AutomationCardProps, AgentCardProps } from './cards'

// Phase 3 — UX enhancements
export { ThemeProvider, useTheme, ACCENT_COLORS } from './ThemeProvider'
export { ThemeSettings } from './ThemeSettings'
export { CommandPalette } from './CommandPalette'
export type { CommandPaletteProps } from './CommandPalette'
export { NotificationsCenter } from './NotificationsCenter'
export { OnboardingTour } from './OnboardingTour'
export type { OnboardingTourProps } from './OnboardingTour'
export { QuickActionsMenu } from './QuickActionsMenu'
export type { QuickActionsMenuProps } from './QuickActionsMenu'
export { PresenceIndicator } from './PresenceIndicator'
export { AuditDashboard } from './AuditDashboard'
export { RbacManager } from './RbacManager'
export { TemplatesGallery } from './TemplatesGallery'
export { DevConsole } from './DevConsole'

// Phase 5 — Conversation History Sync
export { ConversationSyncPanel } from './ConversationSyncPanel'

// Phase 4 — doc suite, z-layers, drawers, unified IO
export { UnifiedIOProvider, useIO, useIOEvents, IOError } from './UnifiedIOProvider'
export type { UnifiedIO, IORequestInit, IOResponse, IOEvent } from './UnifiedIOProvider'
export { DocEditor } from './cards/DocEditor'
export { ZLayerPanel } from './ZLayerPanel'
export { DrawerSystem } from './DrawerSystem'

// V6 — the living canvas
export { LivingCanvas } from './LivingCanvas'
export type { LivingCanvasProps } from './LivingCanvas'
export { useStreamSlot } from './use-stream-slot'
export type { UseStreamSlotOptions, UseStreamSlotResult } from './use-stream-slot'
export { useNodeTypes } from './use-node-types'
export type { NodeTypeEntry, UseNodeTypesResult } from './use-node-types'
export { SlotNode } from './SlotNode'
export type { SlotNodeProps } from './SlotNode'
export { StreamingNodeWrapper } from './StreamingNodeWrapper'
export { VCardMenu } from './VCardMenu'
export type { VCardMenuProps } from './VCardMenu'
export { ConnectionLayer } from './ConnectionLayer'
export type { ConnectionLayerProps } from './ConnectionLayer'
export { ObservabilityHUD } from './ObservabilityHUD'
export type { ObservabilityHUDProps } from './ObservabilityHUD'
export { AgentOverlay } from './AgentOverlay'
export type { AgentOverlayProps } from './AgentOverlay'

// SOTA Icon system — no emojis
export { Icon } from './Icon'
export type { IconProps, IconName } from './Icon'

// V9 — additional canvas components
// CapabilityBar, RelatedNodes, StreamingIndicator deferred to Phase 2
// (depend on hooks/SDK not yet ported)
export { Minimap } from './Minimap'
export type { MinimapProps } from './Minimap'
export { MinimapNode } from './MinimapNode'
export type { MinimapNodeProps } from './MinimapNode'
export { CanvasSearch } from './CanvasSearch'
export type { CanvasSearchProps } from './CanvasSearch'
export { ChatSurface } from '../chat/ChatSurface'

// New minimal chrome system
export { Panel } from './Panel'
export type { PanelConfig, PanelProps } from './Panel'
export { SlidePanel } from './SlidePanel'
export { PanelFrame } from './PanelFrame'
export type { PanelFrameProps } from './PanelFrame'
export { PanelPalette } from './PanelPalette'
export type { PanelPaletteProps } from './PanelPalette'
export { PanelSplit, usePanelSplitControls } from './PanelSplit'
export type { PanelSplitProps, SplitDirection } from './PanelSplit'
export { MainMenu } from './MainMenu'
export { ConversationsPanel } from './panels/ConversationsPanel'
export { SettingsPanel } from './panels/SettingsPanel'
export { ProvidersPanel } from './panels/ProvidersPanel'
export { DocumentsPanel } from './panels/DocumentsPanel'
export type { DocumentsPanelProps } from './panels/DocumentsPanel'
export { MediaPanel } from './panels/MediaPanel'
export type { MediaPanelProps } from './panels/MediaPanel'
export { AgentsPanel } from './panels/AgentsPanel'
export type { AgentsPanelProps } from './panels/AgentsPanel'

// Canvas capability upgrade — new panel components
export { HealthDashboard } from './HealthDashboard'
export { CapabilityCatalog } from './CapabilityCatalog'
export { SearchPanel } from './SearchPanel'
export { CanvasControlPanel } from './CanvasControlPanel'
export { TaskManager } from './TaskManager'
export { AutomationLauncher } from './AutomationLauncher'
export { FleetStatus } from './FleetStatus'
export { SessionControls } from './SessionControls'

// Shared UI primitives
export { Spinner } from './Spinner'
export { PanelShell } from './PanelShell'
export { ErrorBanner } from './ErrorBanner'
export { Toast } from './Toast'
export { Button } from './Button'
export { EmptyState } from './EmptyState'
export { TextArea } from './TextArea'
export { Truncate } from './Truncate'
export { SectionLabel } from './SectionLabel'
export { InputField } from './InputField'
export { StatusDot } from './StatusDot'

// SSOA — Session State-Organized Architecture
export { SessionStateProvider, useSessionState } from './SessionStateProvider'
export type { CanvasSessionState, SessionAction, LayerState } from './SessionStateProvider'
export { TabBar } from './TabBar'
export { LayerSwitcher } from './LayerSwitcher'
export { UnifiedEntry } from './UnifiedEntry'
export {
  getLayerConfig,
  getTabsForLayer,
  getPanelType,
  getPanelConfig,
  listPanels,
} from './TabConfig'
export type {
  LayerConfig,
  TabConfig,
  LayerId,
  PanelType,
  PanelSize,
  PanelDock,
  TabCategory,
} from './TabConfig'

// Update notification
export { UpdateNotification } from './UpdateNotification'

// Storage settings
export { StorageSettings } from './StorageSettings'

// Universal registry — single registry for ALL UI components
export { UniversalComponentProvider } from './UniversalComponentProvider'
export { registerAllComponents } from './register-all'
export {
  useComponent,
  useRegistry,
  register,
  unregister,
  resolve,
  list,
  listByKind,
  size,
  generateCliCommands,
} from './use-universal-registry'
export type {
  ComponentSpec,
  ResolveContext,
  ResolvedComponent,
  ComponentKind,
  ComponentCategory,
} from './use-universal-registry'

// Infinite Canvas system (Bundle 09)
export { InfiniteCanvas } from './InfiniteCanvas'
export type { InfiniteCanvasProps } from './InfiniteCanvas'
export { CanvasMinimap } from './CanvasMinimap'
export type { CanvasMinimapProps } from './CanvasMinimap'
export { CanvasConfigPanel } from './CanvasConfigPanel'
export type { CanvasConfigPanelProps } from './CanvasConfigPanel'
export { CanvasPalette } from './CanvasPalette'
export type { CanvasPaletteProps } from './CanvasPalette'
