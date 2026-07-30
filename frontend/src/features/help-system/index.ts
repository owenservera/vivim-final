/**
 * index.ts
 * ---------------------------------------------------------------------------
 * Barrel exports for the help system feature.
 *
 * All I/O routes through UnifiedIO (Invariant 5).
 * Search powered by backend NLCL system (5-layer intent resolution).
 */

export { HelpWidget } from './HelpWidget'
export { HelpPanel } from './HelpPanel'
export { SearchBar } from './SearchBar'
export { AIChat } from './AIChat'
export { useCapabilitySearch } from './useCapabilitySearch'
export { useHelpAnalytics } from './useHelpAnalytics'
export { useScreenContext } from './useScreenContext'
export type { CapabilitySearchResult, CapabilitySearchStats } from './useCapabilitySearch'
export type { HelpTab } from './HelpPanel'
export type { Citation, SuggestedAction, ChatMessage } from './AIChat'
export type { HelpAnalyticsEvent, HelpAnalyticsEventType } from './useHelpAnalytics'
export type { ScreenContext, ScreenElement, FormData } from './useScreenContext'
