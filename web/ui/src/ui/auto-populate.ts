// web/ui/src/ui/auto-populate.ts
// Auto-populate the UIComponentRegistry from backend capabilities.
// At boot time, fetches /api/capabilities?surface=ui and applies slot
// overrides based on the ui_component and ui_position columns from
// the CapabilityTaxonomy table.
//
// This is the frontend half of the FRONTEND=BACKEND invariant.
// The backend registers capabilities with ui metadata; this module
// reads that metadata and hot-swaps the appropriate UI slots.

import { register, type SlotId, isSlotId } from './registry.js'
import type { SlotOverrideClaim } from './slots.js'

// ── Types ─────────────────────────────────────────────────────────────────

interface CapabilityUIRow {
  slug: string
  name: string
  category: string
  ui_component: string | null
  ui_position: string | null
  ui_order: number | null
  ui_group: string | null
  ui_label: string | null
  ui_icon: string | null
}

interface AutoPopulateResult {
  populated: number
  skipped: number
  errors: string[]
}

// ── Component catalog bridge ──────────────────────────────────────────────

// The catalog is populated by registerCatalogEntry() calls in the app boot.
// auto-populate reads from it to resolve ui_component key → React component.
// This is the same catalog that backend override claims use (H6).

let catalogGetter: (() => Map<string, unknown>) | null = null

/**
 * Register a function that returns the current component catalog.
 * Called once at app boot after registerCatalogEntry() calls are done.
 */
export function setCatalogGetter(getter: () => Map<string, unknown>): void {
  catalogGetter = getter
}

// ── Fetch capabilities from backend ───────────────────────────────────────

async function fetchCapabilities(): Promise<CapabilityUIRow[]> {
  try {
    const res = await fetch('/api/capabilities?surface=ui')
    if (!res.ok) return []
    const data = await res.json() as { capabilities?: CapabilityUIRow[] }
    return data.capabilities ?? []
  } catch {
    return []
  }
}

// ── Apply slot overrides ──────────────────────────────────────────────────

/**
 * Apply a single capability's UI metadata to the registry.
 * Returns true if successfully applied.
 */
function applyCapabilityOverride(
  cap: CapabilityUIRow,
  catalog: Map<string, unknown>,
): boolean {
  if (!cap.ui_component || !cap.ui_position) return false
  if (!isSlotId(cap.ui_position)) return false

  const slot = cap.ui_position as SlotId
  const component = catalog.get(cap.ui_component)
  if (!component) return false

  // Register the component for this capability's slug
  register(slot, cap.slug, component as React.ComponentType<Record<string, unknown>>, {
    sandbox: [cap.slug],
  })

  return true
}

// ── Main auto-populate function ───────────────────────────────────────────

/**
 * Auto-populate UI slot overrides from backend capabilities.
 * Call this once at app boot time.
 *
 * @returns Result with counts of populated/skipped/errored capabilities
 */
export async function autoPopulate(): Promise<AutoPopulateResult> {
  const result: AutoPopulateResult = { populated: 0, skipped: 0, errors: [] }

  const catalog = catalogGetter?.()
  if (!catalog) {
    result.errors.push('Catalog getter not registered — call setCatalogGetter() first')
    return result
  }

  const capabilities = await fetchCapabilities()
  if (capabilities.length === 0) {
    return result
  }

  for (const cap of capabilities) {
    try {
      const applied = applyCapabilityOverride(cap, catalog)
      if (applied) {
        result.populated++
      } else {
        result.skipped++
      }
    } catch (err) {
      result.errors.push(`Error applying ${cap.slug}: ${err}`)
    }
  }

  return result
}

// ── Live update subscription (optional) ───────────────────────────────────

let wsConnection: WebSocket | null = null

/**
 * Subscribe to live capability changes via WebSocket.
 * When a capability's UI metadata changes, re-apply the override.
 */
export function subscribeToLiveUpdates(): void {
  try {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws/capabilities`
    wsConnection = new WebSocket(wsUrl)

    wsConnection.onmessage = (event) => {
      try {
        const data = JSON.parse(String(event.data)) as {
          type: string
          capability?: CapabilityUIRow
        }
        if (data.type === 'capability:updated' && data.capability) {
          const catalog = catalogGetter?.()
          if (catalog) {
            applyCapabilityOverride(data.capability, catalog)
          }
        }
      } catch {
        // ignore malformed messages
      }
    }

    wsConnection.onerror = () => {
      // WebSocket errors are non-fatal; auto-populate already ran
    }
  } catch {
    // WebSocket not available; auto-populate still works via fetch
  }
}

/**
 * Disconnect live update subscription.
 */
export function unsubscribeFromLiveUpdates(): void {
  wsConnection?.close()
  wsConnection = null
}
