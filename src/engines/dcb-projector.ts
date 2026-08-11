/**
 * @module engines/dcb-projector
 *
 * TypeScript port of the Rust DCB projector.
 * Projects a DynamicContextBundle into various text surfaces
 * (inject prompt, system message, capsule, panel card).
 *
 * This is the rendering layer — it turns structured layer items
 * into human-readable or LLM-consumable text.
 */

import type { LayerType } from './cortex-budget.js'
import type { DcbProfile } from './dcb-profile.js'

// ── Types ────────────────────────────────────────────────────────

export type Surface = 'inject_prompt' | 'system_message' | 'capsule' | 'panel_card'

export interface LayerItem {
  layer: LayerType
  text: string
  provenance: {
    source: string
    label: string
    provider?: string
  }
  confidence: number
  recencySecs: number
  tokenCost: number
  included: boolean
}

export interface DynamicContextBundle {
  id: string
  profile: DcbProfile
  projectId?: string
  layers: LayerItem[]
  totalTokens: number
  budget: number
  modelTarget?: string
  createdAt: string
}

// ── Layer order (canonical) ────────────────────────────────────

const LAYER_ORDER: LayerType[] = [
  'L0Identity',
  'L1GlobalPrefs',
  'L2Topic',
  'L3Entity',
  'LpProjectState',
  'LdDecisions',
  'L4Conversation',
  'L5JitContext',
  'L6RecentHistory',
  'L7UserQuery',
]

// ── Helpers ─────────────────────────────────────────────────────

function recencyDecay(secs: number): number {
  return Math.exp(-(secs / (7 * 86400)))
}

function layerHeader(layer: LayerType): string {
  switch (layer) {
    case 'L0Identity':
      return 'Who I am'
    case 'L1GlobalPrefs':
      return 'Preferences'
    case 'L2Topic':
      return 'Relevant background'
    case 'L3Entity':
      return 'Key entities'
    case 'LpProjectState':
      return 'Project state'
    case 'LdDecisions':
      return 'Decisions'
    case 'L4Conversation':
      return 'Conversation arc'
    case 'L5JitContext':
      return 'Recent across apps'
    case 'L6RecentHistory':
      return 'Recent messages'
    case 'L7UserQuery':
      return 'My query'
  }
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '\u2026' : text
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Project a DCB into a text surface.
 */
export function project(dcb: DynamicContextBundle, surface: Surface): string {
  switch (surface) {
    case 'inject_prompt':
      return projectInject(dcb)
    case 'system_message':
      return projectSystem(dcb)
    case 'capsule':
      return projectCapsule(dcb)
    case 'panel_card':
      return projectCard(dcb)
  }
}

// ── Internal projectors ───────────────────────────────────────────

function includedLayers(dcb: DynamicContextBundle): Array<[LayerType, LayerItem[]]> {
  const map = new Map<LayerType, LayerItem[]>()
  for (const item of dcb.layers) {
    if (!item.included) continue
    const list = map.get(item.layer) ?? []
    list.push(item)
    map.set(item.layer, list)
  }
  return LAYER_ORDER.filter((l) => map.has(l)).map((l) => [l, map.get(l)!])
}

function sortedItems(items: LayerItem[]): LayerItem[] {
  return [...items].sort(
    (a, b) =>
      b.confidence * recencyDecay(b.recencySecs) - a.confidence * recencyDecay(a.recencySecs),
  )
}

function projectInject(dcb: DynamicContextBundle): string {
  const sections = includedLayers(dcb)
  if (sections.length === 0) return ''

  const parts: string[] = []
  parts.push('[Context \u2014 VIVIM]')

  if (dcb.projectId) {
    const providers = [
      ...new Set(
        dcb.layers.filter((l) => l.provenance.provider).map((l) => l.provenance.provider!),
      ),
    ]
    const pStr = providers.length > 0 ? providers.join(', ') : 'your apps'
    parts.push(`You are continuing work on **${dcb.projectId}** (active across ${pStr}).`)
    parts.push('')
  }

  for (const [layer, items] of sections) {
    if (layer === 'L7UserQuery') continue
    parts.push(`### ${layerHeader(layer)}`)
    for (const item of sortedItems(items)) {
      const text = truncate(item.text, 500)
      if (item.provenance.source === 'Conversation' || layer === 'L5JitContext') {
        parts.push(`- ${text}  ^${item.provenance.label}`)
      } else {
        parts.push(`- ${text}`)
      }
    }
    parts.push('')
  }

  parts.push('[End context]')
  return parts.join('\n')
}

function projectSystem(dcb: DynamicContextBundle): string {
  const inject = projectInject(dcb)
  if (!inject) return ''
  return `Use the following context about the user and their project to inform your response.\n\n${inject}`
}

function projectCapsule(dcb: DynamicContextBundle): string {
  const sections = includedLayers(dcb)
  if (sections.length === 0) return ''

  const parts: string[] = ['\n# VIVIM Context Capsule\n']

  for (const [layer, items] of sections) {
    if (layer === 'L7UserQuery') continue
    parts.push(`## ${layerHeader(layer)}`)
    for (const item of sortedItems(items)) {
      parts.push(`- ${truncate(item.text, 500)}  ^${item.provenance.label}`)
    }
    parts.push('')
  }

  // Trimmed section
  const trimmed = dcb.layers.filter((l) => !l.included)
  if (trimmed.length > 0) {
    parts.push('---')
    parts.push('### Trimmed for budget')
    for (const item of trimmed) {
      parts.push(
        `- ${truncate(item.text, 80)} (~${item.tokenCost} tokens)  ^${item.provenance.label}`,
      )
    }
    parts.push('')
  }

  return parts.join('\n')
}

function projectCard(dcb: DynamicContextBundle): string {
  const sections = includedLayers(dcb)
  if (sections.length === 0) {
    const providers = [
      ...new Set(
        dcb.layers
          .filter((l) => l.included)
          .map((l) => l.provenance.provider)
          .filter(Boolean),
      ),
    ]
    return `${providers.length} apps active`
  }

  const previewParts: string[] = []
  for (const [layer, items] of sections.slice(0, 2)) {
    const first = sortedItems(items)[0]
    if (first) {
      previewParts.push(`**${layerHeader(layer)}:** ${truncate(first.text, 120)}`)
    }
  }

  const decisions = dcb.layers.filter((l) => l.included && l.layer === 'LdDecisions').length
  const threads = dcb.layers.filter((l) => l.included && l.layer === 'L5JitContext').length
  const providers = [
    ...new Set(
      dcb.layers
        .filter((l) => l.included)
        .map((l) => l.provenance.provider)
        .filter(Boolean),
    ),
  ]

  const summary = `${decisions} decisions \u00b7 ${threads} threads \u00b7 ${providers.length} apps`
  return previewParts.length > 0 ? `${previewParts.join('\n\n')}\n\n${summary}` : summary
}
