// src/reprogrammability/schema/spec.ts
// Phase 1 of ROADMAP-REPROGRAMMABLE-CANVAS.md
//
// The `SurfaceSpec` discriminated union. Each `SurfaceKind` has a
// corresponding spec shape. The `custom` kind is an escape hatch for
// surfaces not yet modeled; Phase 10 audit flags them for promotion.
//
// CONTRACT_VERSION: 1

import { z } from 'zod'

/**
 * Spec for a card surface (DocCard, MediaCard, AutomationCard, …).
 */
export const CardSpecSchema = z.object({
  kind: z.literal('card'),
  /** Card variant — drives the renderer chosen by UIComponentRegistry. */
  variant: z.string(),
  /** Optional title; falls back to renderer default. */
  title: z.string().optional(),
  /** Optional source URL for content (e.g. document URL for DocCard). */
  sourceUrl: z.string().url().optional(),
  /** Inline content payload (renderer-specific). */
  content: z.unknown().optional(),
  /** Style overrides — CSS-in-JS object applied on top of variant defaults. */
  style: z.record(z.string(), z.unknown()).optional(),
  /** Capability bindings — which capabilities this card invokes. */
  capabilityBindings: z
    .array(
      z.object({
        capabilityId: z.string(),
        slot: z.string().optional(),
      }),
    )
    .optional(),
})

/**
 * Spec for a dockable side panel.
 */
export const PanelSpecSchema = z.object({
  kind: z.literal('panel'),
  variant: z.string(),
  title: z.string(),
  /** Default dock edge. */
  dock: z.enum(['left', 'right', 'bottom', 'top', 'floating']),
  /** Default size in pixels (width if dock is left/right, height if top/bottom). */
  defaultSize: z.number().int().positive().optional(),
  /** Whether the panel is visible by default. */
  visible: z.boolean().default(true),
  /** Whether the panel is collapsed by default. */
  collapsed: z.boolean().default(false),
  style: z.record(z.string(), z.unknown()).optional(),
})

/**
 * Spec for a canvas Z-layer (see ZLayerPanel).
 */
export const LayerSpecSchema = z.object({
  kind: z.literal('layer'),
  name: z.string(),
  /** Z-index. Higher = on top. */
  z: z.number().int(),
  /** Whether the layer is interactive (pointer-events). */
  interactive: z.boolean().default(true),
  /** Whether the layer is visible. */
  visible: z.boolean().default(true),
  /** Opacity 0..1. */
  opacity: z.number().min(0).max(1).default(1),
})

/**
 * Spec for a canvas primitive (workspace, projects, knowledge, …).
 * Primitives are the closed set in the current canvas engine; Phase 6
 * may open this up.
 */
export const PrimitiveSpecSchema = z.object({
  kind: z.literal('primitive'),
  /** One of the 6 current canvas primitive kinds. */
  primitiveKind: z.enum([
    'workspace',
    'projects',
    'knowledge',
    'agents',
    'providers',
    'conversations',
  ]),
  /** World coordinates on the infinite canvas. */
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  /** Size in world units. */
  size: z.object({
    w: z.number().positive(),
    h: z.number().positive(),
  }),
  /** Metadata bag — primitive-kind-specific data. */
  metadata: z.record(z.string(), z.unknown()).optional(),
})

/**
 * Spec for an app-chrome element (Composer, CommandBar, MainMenu, …).
 */
export const ChromeSpecSchema = z.object({
  kind: z.literal('chrome'),
  /** Which chrome element. */
  chromeKind: z.enum([
    'composer',
    'command-bar',
    'main-menu',
    'mobile-nav',
    'command-palette',
    'theme-settings',
    'dev-console',
    'onboarding-tour',
  ]),
  /** Localized strings for this chrome element. */
  strings: z.record(z.string(), z.string()).optional(),
  /** Style overrides. */
  style: z.record(z.string(), z.unknown()).optional(),
  /** Keyboard shortcuts (key → action id). */
  shortcuts: z.record(z.string(), z.string()).optional(),
  /** Whether this chrome element is enabled. */
  enabled: z.boolean().default(true),
})

/**
 * Spec for a chat slot (chat.default, chat.capability.*, …).
 */
export const SlotSpecSchema = z.object({
  kind: z.literal('slot'),
  /** Slot identifier, e.g. `chat.default`, `chat.capability.chatgpt`. */
  slotId: z.string(),
  /** Which renderer variant to use (capability > provider > default). */
  precedence: z.array(z.enum(['capability', 'provider', 'default'])),
  /** Capability id bound to this slot, if any. */
  capabilityId: z.string().optional(),
  /** Provider id bound to this slot, if any. */
  providerId: z.string().optional(),
})

/**
 * Escape-hatch spec for surfaces not yet modeled. Phase 10 audit flags
 * these for promotion to a first-class kind.
 */
export const CustomSpecSchema = z.object({
  kind: z.literal('custom'),
  /** URL documenting the shape of `data`. */
  schemaUrl: z.string().url(),
  /** The actual spec data. */
  data: z.unknown(),
})

/**
 * The discriminated union of all spec kinds.
 */
export const SurfaceSpecSchema = z.discriminatedUnion('kind', [
  CardSpecSchema,
  PanelSpecSchema,
  LayerSpecSchema,
  PrimitiveSpecSchema,
  ChromeSpecSchema,
  SlotSpecSchema,
  CustomSpecSchema,
])

/**
 * Helper: get the default spec schema for a kind (used when a surface
 * doesn't declare its own `specSchema`).
 */
export function defaultSpecSchemaForKind(kind: string): z.ZodType | null {
  switch (kind) {
    case 'card':
      return CardSpecSchema
    case 'panel':
      return PanelSpecSchema
    case 'layer':
      return LayerSpecSchema
    case 'primitive':
      return PrimitiveSpecSchema
    case 'chrome':
      return ChromeSpecSchema
    case 'slot':
      return SlotSpecSchema
    case 'custom':
      return CustomSpecSchema
    default:
      return null
  }
}

export type SurfaceSpec = z.infer<typeof SurfaceSpecSchema>
export type SurfaceSpecSchema = typeof SurfaceSpecSchema
export type CardSpec = z.infer<typeof CardSpecSchema>
export type PanelSpec = z.infer<typeof PanelSpecSchema>
export type LayerSpec = z.infer<typeof LayerSpecSchema>
export type PrimitiveSpec = z.infer<typeof PrimitiveSpecSchema>
export type ChromeSpec = z.infer<typeof ChromeSpecSchema>
export type SlotSpec = z.infer<typeof SlotSpecSchema>
export type CustomSpec = z.infer<typeof CustomSpecSchema>
