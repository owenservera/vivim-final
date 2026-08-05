/**
 * shared/ui-language.ts
 * --------------------------------------------------------------------
 * V8 G2 — UI Design Language: composable, modular, expandable.
 *
 * Every component exports a `UIComponentSpec` that extends the V7
 * `ComponentSpec` with:
 *   - properties: UIProperties (position, layout, visibility, interactivity,
 *     styling, lifecycle, permissions, validation)
 *   - features: capability slugs this component supports
 *   - actions: per-component action definitions
 *   - variants: named variant overrides
 *   - extends: inheritance chain (component → categoryDefaults →
 *     tierDefaults → systemDefaults)
 *
 * Inheritance: when resolving a property, the engine walks the chain:
 *   component.properties → category defaults → tier defaults → system defaults
 * First defined value wins (like CSS specificity).
 */

import type { CanvasLayout } from './canvas-types'
import type { ComponentCategory, ComponentKind, ComponentSpec } from './universal-registry'

// ── Property Traits ────────────────────────────────────────────────────

export interface UIPosition {
  slot?: string
  layout?: CanvasLayout
  anchor?: 'left' | 'right' | 'top' | 'bottom' | 'center' | 'floating'
}

export interface UILayout {
  resizable?: boolean
  minWidth?: number
  maxWidth?: number
  minHeight?: number
  maxHeight?: number
  resizeAxes?: 'both' | 'x' | 'y' | 'none'
  aspectRatio?: number
}

export interface UIVisibility {
  showWhen?: string // condition expression
  hideWhen?: string
  animation?: 'fade' | 'slide' | 'scale' | 'none'
  animationDurationMs?: number
  transitionDelayMs?: number
}

export interface UIInteractivity {
  focusable?: boolean
  draggable?: boolean
  contextMenu?: boolean
  keyboardNavigable?: boolean
  ariaRole?: string
  ariaLabel?: string
}

export interface UIStyling {
  themeToken?: string
  cssVars?: Record<string, string>
  darkModeVariant?: Record<string, string>
  lightModeVariant?: Record<string, string>
  borderRadius?: number
  boxShadow?: string
  padding?: string
}

export interface UILifecycle {
  onMount?: string // capability slug
  onUpdate?: string
  onUnmount?: string
  onError?: string
}

export interface UIPermissions {
  rbacScope?: string[]
  requiresConfirmation?: boolean
  confirmationPrompt?: string
}

export interface UIValidation {
  inputSchema?: Record<string, unknown> // Zod schema JSON
  outputSchema?: Record<string, unknown>
  deepMergeRules?: 'replace' | 'merge' | 'append'
}

export interface UIProperties {
  position?: UIPosition
  layout?: UILayout
  visibility?: UIVisibility
  interactivity?: UIInteractivity
  styling?: UIStyling
  lifecycle?: UILifecycle
  permissions?: UIPermissions
  validation?: UIValidation
}

// ── Actions + Variants ─────────────────────────────────────────────────

export interface UIAction {
  id: string
  label: string
  icon: string
  capabilityId: string // the cap:* slug to dispatch
  shortcut?: string
  requiresConfirmation?: boolean
  visibleWhen?: string // condition expression
  enabledWhen?: string
}

export interface UIVariant {
  id: string
  label: string
  propertyOverrides: Partial<UIProperties>
  actionOverrides?: UIAction[]
}

// ── UIComponentSpec (extends ComponentSpec) ────────────────────────────

export interface UIComponentSpec extends ComponentSpec {
  extends?: string // base component id (inheritance)
  properties: UIProperties
  features: string[] // capability slugs
  actions: UIAction[]
  variants: Record<string, UIVariant>
  defaultVariant?: string
}

// ── System / Category / Tier Defaults ──────────────────────────────────

export const SYSTEM_DEFAULTS: UIProperties = {
  position: { anchor: 'floating' },
  layout: { resizable: true, resizeAxes: 'both', minWidth: 80, minHeight: 60 },
  visibility: { animation: 'fade', animationDurationMs: 200 },
  interactivity: { focusable: true, draggable: true, contextMenu: true, keyboardNavigable: true },
  styling: { borderRadius: 8, boxShadow: '0 6px 24px -8px rgba(0,0,0,0.18)' },
  permissions: { requiresConfirmation: false },
  validation: { deepMergeRules: 'merge' },
}

export const CATEGORY_DEFAULTS: Partial<Record<ComponentCategory, UIProperties>> = {
  chat: {
    interactivity: {
      focusable: true,
      draggable: true,
      contextMenu: true,
      ariaRole: 'log',
      ariaLabel: 'Chat',
    },
    layout: { resizable: true, minWidth: 240, minHeight: 100 },
  },
  docs: {
    interactivity: {
      focusable: true,
      draggable: true,
      contextMenu: true,
      ariaRole: 'article',
      ariaLabel: 'Document',
    },
    layout: { resizable: true, minWidth: 320, minHeight: 200 },
  },
  media: {
    interactivity: {
      focusable: true,
      draggable: true,
      contextMenu: true,
      ariaRole: 'application',
      ariaLabel: 'Media player',
    },
    layout: { resizable: true, minWidth: 240, minHeight: 180 },
  },
  automation: {
    interactivity: {
      focusable: true,
      draggable: true,
      contextMenu: true,
      ariaRole: 'region',
      ariaLabel: 'Automation',
    },
  },
  agents: {
    interactivity: {
      focusable: true,
      draggable: true,
      contextMenu: true,
      ariaRole: 'region',
      ariaLabel: 'Agent',
    },
  },
  shell: {
    interactivity: {
      focusable: true,
      draggable: false,
      contextMenu: true,
      ariaRole: 'terminal',
      ariaLabel: 'Shell',
    },
    styling: { borderRadius: 6 },
  },
  audit: {
    interactivity: {
      focusable: true,
      draggable: false,
      contextMenu: false,
      ariaRole: 'region',
      ariaLabel: 'Audit dashboard',
    },
  },
  rbac: {
    interactivity: {
      focusable: true,
      draggable: false,
      contextMenu: false,
      ariaRole: 'region',
      ariaLabel: 'Permissions manager',
    },
    permissions: {
      requiresConfirmation: true,
      confirmationPrompt: 'Changing permissions may affect user access. Continue?',
    },
  },
}

export const KIND_DEFAULTS: Partial<Record<ComponentKind, UIProperties>> = {
  canvas: {
    interactivity: {
      focusable: true,
      draggable: false,
      contextMenu: false,
      ariaRole: 'application',
      ariaLabel: 'Canvas',
    },
    layout: { resizable: false },
  },
  card: {
    layout: { resizable: true, minWidth: 200, minHeight: 120 },
  },
  panel: {
    layout: { resizable: true, minWidth: 200, minHeight: 300 },
    visibility: { animation: 'slide' },
  },
  overlay: {
    visibility: { animation: 'scale', animationDurationMs: 150 },
    position: { anchor: 'center' },
  },
  control: {
    interactivity: { focusable: true, draggable: false },
  },
  primitive: {
    interactivity: { focusable: false, draggable: false, contextMenu: false },
  },
  hook: {
    interactivity: { focusable: false, draggable: false, contextMenu: false },
    visibility: { animation: 'none' },
  },
}

// ── Property Resolution (inheritance walk) ─────────────────────────────

/**
 * Resolve the full UIProperties for a component by walking the
 * inheritance chain: component → categoryDefaults → kindDefaults → systemDefaults.
 * First defined value wins (shallow merge per trait).
 */
export function resolveProperties(spec: UIComponentSpec): UIProperties {
  const categoryDefaults = CATEGORY_DEFAULTS[spec.category] ?? {}
  const kindDefaults = KIND_DEFAULTS[spec.kind] ?? {}
  const componentProps = spec.properties ?? {}

  return {
    position:
      componentProps.position ??
      categoryDefaults.position ??
      kindDefaults.position ??
      SYSTEM_DEFAULTS.position,
    layout: {
      ...SYSTEM_DEFAULTS.layout,
      ...kindDefaults.layout,
      ...categoryDefaults.layout,
      ...componentProps.layout,
    },
    visibility: {
      ...SYSTEM_DEFAULTS.visibility,
      ...kindDefaults.visibility,
      ...categoryDefaults.visibility,
      ...componentProps.visibility,
    },
    interactivity: {
      ...SYSTEM_DEFAULTS.interactivity,
      ...kindDefaults.interactivity,
      ...categoryDefaults.interactivity,
      ...componentProps.interactivity,
    },
    styling: {
      ...SYSTEM_DEFAULTS.styling,
      ...kindDefaults.styling,
      ...categoryDefaults.styling,
      ...componentProps.styling,
    },
    lifecycle: componentProps.lifecycle ?? categoryDefaults.lifecycle ?? kindDefaults.lifecycle,
    permissions: {
      ...SYSTEM_DEFAULTS.permissions,
      ...kindDefaults.permissions,
      ...categoryDefaults.permissions,
      ...componentProps.permissions,
    },
    validation: {
      ...SYSTEM_DEFAULTS.validation,
      ...kindDefaults.validation,
      ...categoryDefaults.validation,
      ...componentProps.validation,
    },
  }
}

/**
 * Deep-merge a partial property patch into an existing UIProperties.
 * Used by `uiEngine.setProperty()` and `extendSpec()`.
 */
export function mergeProperties(base: UIProperties, patch: Partial<UIProperties>): UIProperties {
  const result: UIProperties = { ...base }
  for (const key of Object.keys(patch) as Array<keyof UIProperties>) {
    const patchVal = patch[key]
    if (patchVal === undefined) continue
    const baseVal = base[key]
    if (
      baseVal &&
      typeof baseVal === 'object' &&
      !Array.isArray(baseVal) &&
      patchVal &&
      typeof patchVal === 'object'
    ) {
      ;(result as Record<string, unknown>)[key] = { ...baseVal, ...patchVal }
    } else {
      ;(result as Record<string, unknown>)[key] = patchVal
    }
  }
  return result
}

// ── Blueprint (the full UI layout/theme snapshot) ──────────────────────

export interface UIBlueprint {
  workspaceId: string
  components: Record<string, UIComponentSpec>
  themeMode: 'light' | 'dark' | 'auto'
  accentColor: string
  zLayerConfig?: Record<string, unknown>
  drawerConfig?: Record<string, unknown>
  version: number
  createdAt: number
  updatedAt: number
}

/**
 * Apply a blueprint patch — deep-merges component specs, bumps versions,
 * emits `ui:reprogrammed` on the event bus. The caller (UIEngine) handles
 * the emit; this function just computes the merged result.
 */
export function applyBlueprintPatch(
  current: UIBlueprint,
  patch: Partial<Pick<UIBlueprint, 'components' | 'themeMode' | 'accentColor'>>,
): UIBlueprint {
  const merged: UIBlueprint = {
    ...current,
    components: { ...current.components },
    version: current.version + 1,
    updatedAt: Date.now(),
  }
  if (patch.components) {
    for (const [id, spec] of Object.entries(patch.components)) {
      const existing = merged.components[id]
      if (existing) {
        // Hot-swap: merge properties + bump version.
        merged.components[id] = {
          ...existing,
          ...spec,
          properties: mergeProperties(existing.properties ?? {}, spec.properties ?? {}),
          version: existing.version + 1,
        }
      } else {
        merged.components[id] = spec
      }
    }
  }
  if (patch.themeMode) merged.themeMode = patch.themeMode
  if (patch.accentColor) merged.accentColor = patch.accentColor
  return merged
}
