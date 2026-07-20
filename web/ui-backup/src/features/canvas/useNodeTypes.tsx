// web/ui/src/features/canvas/useNodeTypes.tsx
// Converts the existing UIComponentRegistry slot catalog into React Flow nodeTypes.
// Each SLOT_ID becomes a React Flow node type; resolution uses the same
// capabilitySlug > providerSlug > default precedence via registry.resolve().
// The node's data.overrideSlug provides the capability/provider context.
// ZoomNode wrapping provides zoom-tier-dependent rendering (PRD-C2).

import { useMemo } from 'react'
import { memo } from 'react'
import type { ComponentType } from 'react'
import type { NodeProps } from '@xyflow/react'
import { SLOT_IDS, type SlotId } from '../../ui/slots.js'
import { catalogResolve, resolve } from '../../ui/registry.js'
import { ZoomNode } from './ZoomNode.js'

/** Category → default color for dot/card mode. */
const CATEGORY_COLORS: Record<string, string> = {
  chat: '#6366f1',
  system: '#10b981',
  automation: '#f59e0b',
  agents: '#8b5cf6',
  projects: '#3b82f6',
  knowledge: '#ec4899',
  designer: '#14b8a6',
  plugin: '#f97316',
}

/** SlotId → human label for card mode. */
const SLOT_LABELS: Record<string, string> = {
  'chat.entry': 'Entry',
  'chat.sidebar': 'Sidebar',
  'chat.thread': 'Thread',
  'chat.bubble': 'Bubble',
  'chat.composer': 'Composer',
  'chat.send': 'Send',
  'chat.attach': 'Attach',
  'chat.streaming': 'Streaming',
  'chat.result': 'Result',
  'chat.confirm': 'Confirm',
  'chat.error': 'Error',
  'chat.header': 'Header',
  'chat.actionBar': 'Actions',
}

/**
 * Each slot becomes a React Flow nodeType.
 * Resolution: capabilitySlug > providerSlug > default (same as before).
 */
export function useNodeTypes(): Record<string, ComponentType<NodeProps>> {
  return useMemo(() => {
    const types: Record<string, ComponentType<NodeProps>> = {}
    for (const slotId of SLOT_IDS) {
      types[slotId] = createSlotNodeType(slotId)
    }
    types['conceptual'] = createConceptualNodeType()
    return types
  }, [])
}

/**
 * Generic node for resolved conceptual primitives that are not (yet) mapped to
 * a known chat SlotId. Renders the registered UiComponent by its catalog key,
 * falling back to a labelled placeholder so the canvas never blanks.
 */
function createConceptualNodeType() {
  const ConceptualNode = memo(function ConceptualNode({ data }: NodeProps) {
    const nodeData = data as {
      componentKey?: string
      primitiveId?: string
    }
    const Component = nodeData.componentKey ? catalogResolve(nodeData.componentKey) : undefined
    const label = nodeData.primitiveId ?? 'conceptual'
    return (
      <ZoomNode label={label} color="#64748b">
        {Component ? <Component slotId={nodeData.primitiveId ?? label} /> : null}
      </ZoomNode>
    )
  })
  ConceptualNode.displayName = 'ConceptualNode'
  return ConceptualNode
}

/**
 * Create a React Flow node component that wraps registry.resolve().
 * The node's data.overrideSlug drives capability/provider resolution.
 * ZoomNode provides zoom-tier-dependent rendering (dot/card/full).
 */
function createSlotNodeType(slotId: SlotId) {
  const category = slotId.split('.')[0] ?? 'chat'
  const SlotNode = memo(function SlotNode({ data }: NodeProps) {
    const nodeData = data as { overrideSlug?: string; providerSlug?: string }
    const ctx = {
      providerSlug: nodeData.providerSlug ?? nodeData.overrideSlug ?? 'default',
      capabilitySlug: nodeData.overrideSlug,
    }
    const { component: Component } = resolve(slotId, ctx)
    return (
      <ZoomNode
        label={SLOT_LABELS[slotId] ?? slotId}
        color={CATEGORY_COLORS[category]}
      >
        <Component slotId={slotId} />
      </ZoomNode>
    )
  })
  SlotNode.displayName = `SlotNode(${slotId})`
  return SlotNode
}
