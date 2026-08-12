// src/engines/browser-action-types.ts
// Phase 0/5 — Typed browser action grammar for CDP-backed automation.
// The model plans actions using grounded element refs (E1, E2, ...),
// never raw CSS/XPath. Phase 5 implements CDP-backed executors.

import { z } from 'zod'

// ── Grounded Element Reference ───────────────────────────────────────────

export const BrowserRefSchema = z.object({
  ref: z.string().regex(/^E\d+$/),
  role: z.string().optional(),
  name: z.string().optional(),
  text: z.string().optional(),
})

export type BrowserRef = z.infer<typeof BrowserRefSchema>

// ── Browser Action Vocabulary ────────────────────────────────────────────

export const BrowserActionSchema = z.discriminatedUnion('type', [
  // Navigation
  z.object({ type: z.literal('navigate'), url: z.string().url() }),
  z.object({ type: z.literal('back') }),
  z.object({ type: z.literal('forward') }),
  z.object({ type: z.literal('reload') }),

  // Interaction
  z.object({ type: z.literal('click'), ref: BrowserRefSchema.shape.ref }),
  z.object({ type: z.literal('double_click'), ref: BrowserRefSchema.shape.ref }),
  z.object({ type: z.literal('type'), ref: BrowserRefSchema.shape.ref, text: z.string() }),
  z.object({ type: z.literal('press'), key: z.string() }),
  z.object({ type: z.literal('select'), ref: BrowserRefSchema.shape.ref, value: z.string() }),
  z.object({ type: z.literal('check'), ref: BrowserRefSchema.shape.ref }),
  z.object({ type: z.literal('uncheck'), ref: BrowserRefSchema.shape.ref }),
  z.object({ type: z.literal('hover'), ref: BrowserRefSchema.shape.ref }),
  z.object({ type: z.literal('scroll'), deltaY: z.number() }),
  z.object({ type: z.literal('focus'), ref: BrowserRefSchema.shape.ref }),

  // Observation
  z.object({ type: z.literal('extract'), ref: BrowserRefSchema.shape.ref.optional() }),
  z.object({ type: z.literal('screenshot') }),

  // Synchronization
  z.object({ type: z.literal('wait'), ms: z.number().int().min(0).max(30_000) }),
  z.object({ type: z.literal('wait_for_text'), text: z.string() }),
  z.object({ type: z.literal('wait_for_element'), ref: BrowserRefSchema.shape.ref }),

  // Tab management
  z.object({ type: z.literal('new_tab'), url: z.string().url().optional() }),
  z.object({ type: z.literal('close_tab') }),
  z.object({ type: z.literal('switch_tab'), index: z.number().int().nonnegative() }),

  // Data movement
  z.object({ type: z.literal('download'), ref: BrowserRefSchema.shape.ref }),
  z.object({ type: z.literal('upload'), ref: BrowserRefSchema.shape.ref, filePath: z.string() }),
])

export type BrowserAction = z.infer<typeof BrowserActionSchema>

// ── Browser Snapshot (for grounding) ─────────────────────────────────────

export interface GroundedElement {
  ref: string
  role?: string
  name?: string
  text?: string
  tag?: string
  attributes?: Record<string, string>
}

export interface BrowserSnapshot {
  url: string
  title: string
  elements: GroundedElement[]
}

/**
 * Compact a browser snapshot into a string suitable for LLM context.
 * Truncates to 120 elements and 120 chars per field to stay within token budgets.
 */
export function compactSnapshot(snapshot: BrowserSnapshot): string {
  return [
    `URL: ${snapshot.url}`,
    `TITLE: ${snapshot.title}`,
    ...snapshot.elements.slice(0, 120).map((e) =>
      [
        e.ref,
        e.role ? `role=${e.role}` : '',
        e.name ? `name=${JSON.stringify(e.name)}` : '',
        e.text ? `text=${JSON.stringify(e.text.slice(0, 120))}` : '',
      ].filter(Boolean).join(' '),
    ),
  ].join('\n')
}

// ── Browser Grounder Interface ───────────────────────────────────────────

export interface BrowserGrounder {
  /** Take a compact accessibility snapshot of the current page. */
  snapshot(slaveId: string): Promise<BrowserSnapshot>
  /** Resolve a grounded element ref against the latest snapshot. */
  resolve(slaveId: string, ref: string): Promise<GroundedElement | null>
}
