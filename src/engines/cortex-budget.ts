/**
 * @module engines/cortex-budget
 *
 * TypeScript port of the Rust cortex budget module.
 * Token budget allocation across 10 context layers with 4-phase solver,
 * archetype boosts, pressure modifiers, and item packing.
 *
 * Layers (priority 0 = highest):
 *   L0 Identity → L1 Global Prefs → L2 Topic → L3 Entity →
 *   Lp Project State → Ld Decisions → L4 Conversation →
 *   L5 JIT Context → L6 Recent History → L7 User Query
 */

// ── Types ──────────────────────────────────────────────────────────

export const LAYER_TYPES = [
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
] as const

export type LayerType = (typeof LAYER_TYPES)[number]

export type DepthMode = 'Standard' | 'Deep' | 'Compact'

export interface BudgetConfig {
  layer: LayerType
  minTokens: number
  idealTokens: number
  maxTokens: number
  priority: number
  elasticity: number
}

export interface LayerAllocation {
  layer: LayerType
  allocatedTokens: number
}

export interface PressureSignals {
  conversationPressure: boolean
  entityCount: number
  messageHistoryRatio: number
}

export interface PackItem {
  layer: LayerType
  score: number
  tokens: number
  id: string
}

// ── Default Layer Configs ──────────────────────────────────────────

/**
 * Default budget configs for all 10 layers.
 * min/ideal/max are in tokens; priority 0 = most important.
 */
export function defaultLayerConfigs(): BudgetConfig[] {
  return [
    {
      layer: 'L0Identity',
      minTokens: 200,
      idealTokens: 1000,
      maxTokens: 2500,
      priority: 2,
      elasticity: 0.3,
    },
    {
      layer: 'L1GlobalPrefs',
      minTokens: 100,
      idealTokens: 500,
      maxTokens: 1500,
      priority: 3,
      elasticity: 0.5,
    },
    {
      layer: 'L2Topic',
      minTokens: 500,
      idealTokens: 3000,
      maxTokens: 8000,
      priority: 3,
      elasticity: 0.8,
    },
    {
      layer: 'L3Entity',
      minTokens: 200,
      idealTokens: 1500,
      maxTokens: 4000,
      priority: 4,
      elasticity: 0.7,
    },
    {
      layer: 'LpProjectState',
      minTokens: 200,
      idealTokens: 1500,
      maxTokens: 4000,
      priority: 4,
      elasticity: 0.7,
    },
    {
      layer: 'LdDecisions',
      minTokens: 150,
      idealTokens: 1000,
      maxTokens: 3000,
      priority: 4,
      elasticity: 0.6,
    },
    {
      layer: 'L4Conversation',
      minTokens: 1000,
      idealTokens: 6000,
      maxTokens: 16000,
      priority: 1,
      elasticity: 0.9,
    },
    {
      layer: 'L5JitContext',
      minTokens: 300,
      idealTokens: 2000,
      maxTokens: 6000,
      priority: 1,
      elasticity: 0.6,
    },
    {
      layer: 'L6RecentHistory',
      minTokens: 500,
      idealTokens: 4000,
      maxTokens: 12000,
      priority: 1,
      elasticity: 0.8,
    },
    {
      layer: 'L7UserQuery',
      minTokens: 300,
      idealTokens: 1000,
      maxTokens: 4000,
      priority: 0,
      elasticity: 0.0,
    },
  ]
}

// ── Pressure Modifiers ─────────────────────────────────────────────

/**
 * Apply dynamic pressure signals before allocation.
 * Squeezes topic under conversation pressure, expands entity on high entity count,
 * decays history when ratio is high.
 */
export function applyPressure(layers: BudgetConfig[], pressure: PressureSignals): BudgetConfig[] {
  return layers.map((c) => {
    const modified = { ...c }
    switch (c.layer) {
      case 'L2Topic':
        if (pressure.conversationPressure) {
          const squeeze = 0.6
          modified.idealTokens = Math.max(Math.floor(c.idealTokens * squeeze), c.minTokens)
          modified.maxTokens = Math.max(Math.floor(c.maxTokens * squeeze), modified.idealTokens)
        }
        break
      case 'L3Entity':
        if (pressure.entityCount > 20) {
          const scale = 1.5
          modified.idealTokens = Math.min(Math.floor(c.idealTokens * scale), 6000)
          modified.maxTokens = Math.min(Math.floor(c.maxTokens * scale), 8000)
        }
        break
      case 'L6RecentHistory':
        if (pressure.messageHistoryRatio > 3.0) {
          const decay = 0.5
          modified.idealTokens = Math.max(Math.floor(c.idealTokens * decay), c.minTokens)
          modified.maxTokens = Math.max(Math.floor(c.maxTokens * decay), modified.idealTokens)
        }
        break
    }
    return modified
  })
}

// ── Budget Allocator ──────────────────────────────────────────────

/**
 * Distribute `modelBudget` tokens across layers using a 4-phase solver:
 *   Phase 1: Guarantee minimums for all layers
 *   Phase 2: Proportional build-up to ideal
 *   Phase 3: Priority-based overflow to max
 *   Phase 4 (deficit): Cut-to-fit protecting fixed layers
 */
export function allocate(
  modelBudget: number,
  layers: BudgetConfig[],
  depthMode: DepthMode = 'Standard',
): LayerAllocation[] {
  // Adjust for depth mode
  const adjusted = layers.map((c) => {
    const m = { ...c }
    switch (depthMode) {
      case 'Deep':
        m.minTokens = Math.floor(c.minTokens * 1.2)
        m.idealTokens = Math.floor(c.idealTokens * 1.3)
        m.maxTokens = Math.floor(c.maxTokens * 1.5)
        break
      case 'Compact':
        m.minTokens = Math.floor(c.minTokens * 0.7)
        m.idealTokens = Math.floor(c.idealTokens * 0.6)
        m.maxTokens = Math.floor(c.maxTokens * 0.5)
        break
    }
    return m
  })

  const alloc = new Map<LayerType, number>()
  for (const c of adjusted) alloc.set(c.layer, 0)

  const sumMin = adjusted.reduce((s, c) => s + c.minTokens, 0)

  if (modelBudget <= sumMin) {
    // Phase 4: deficit recovery
    allocatePhase4(modelBudget, adjusted, alloc)
  } else {
    // Phase 1: guarantee minimums
    for (const c of adjusted) alloc.set(c.layer, c.minTokens)
    let remaining = modelBudget - sumMin

    // Phase 2: proportional build to ideal
    const roomToIdeal = adjusted.map((c) => ({
      layer: c.layer,
      room: Math.max(0, c.idealTokens - c.minTokens),
    }))
    const sumRoom = roomToIdeal.reduce((s, r) => s + r.room, 0)

    if (sumRoom > 0 && remaining > 0) {
      const allocExtra = Math.min(remaining, sumRoom)
      let totalAllocated = 0
      for (const { layer, room } of roomToIdeal) {
        const share = Math.floor((allocExtra * room) / sumRoom)
        alloc.set(layer, (alloc.get(layer) ?? 0) + share)
        totalAllocated += share
      }
      // Distribute rounding remainder
      let diff = allocExtra - totalAllocated
      for (const { layer, room } of roomToIdeal) {
        if (diff <= 0) break
        if (room > 0) {
          alloc.set(layer, (alloc.get(layer) ?? 0) + 1)
          diff--
        }
      }
      remaining -= allocExtra
    }

    // Phase 3: priority overflow to max
    if (remaining > 0) {
      const priorityGroups = [...new Set(adjusted.map((c) => c.priority))].sort()
      for (const priority of priorityGroups) {
        if (remaining === 0) break
        const groupRoom: Array<{ layer: LayerType; room: number }> = []
        for (const c of adjusted) {
          if (c.priority === priority) {
            const current = alloc.get(c.layer) ?? 0
            const room = Math.max(0, c.maxTokens - current)
            if (room > 0) groupRoom.push({ layer: c.layer, room })
          }
        }
        const sumGroupRoom = groupRoom.reduce((s, r) => s + r.room, 0)
        if (sumGroupRoom > 0) {
          const allocGroup = Math.min(remaining, sumGroupRoom)
          let totalGroupAlloc = 0
          for (const { layer, room } of groupRoom) {
            const share = Math.floor((allocGroup * room) / sumGroupRoom)
            alloc.set(layer, (alloc.get(layer) ?? 0) + share)
            totalGroupAlloc += share
          }
          let diff = allocGroup - totalGroupAlloc
          for (const { layer } of groupRoom) {
            if (diff <= 0) break
            alloc.set(layer, (alloc.get(layer) ?? 0) + 1)
            diff--
          }
          remaining -= allocGroup
        }
      }
    }
  }

  return layers.map((c) => ({
    layer: c.layer,
    allocatedTokens: alloc.get(c.layer) ?? 0,
  }))
}

/**
 * Phase 4 — cut-to-fit: protect fixed layers (L7, L0), then fill
 * remaining layers in priority order (ascending = highest priority first).
 */
function allocatePhase4(
  budget: number,
  layers: BudgetConfig[],
  alloc: Map<LayerType, number>,
): void {
  let remaining = budget

  // Protect fixed layers
  for (const target of ['L7UserQuery', 'L0Identity'] as LayerType[]) {
    const c = layers.find((l) => l.layer === target)
    if (c) {
      const a = Math.min(c.minTokens, remaining)
      alloc.set(target, a)
      remaining -= a
    }
  }

  // Fill rest by priority
  const rest = layers
    .filter((c) => c.layer !== 'L0Identity' && c.layer !== 'L7UserQuery')
    .sort((a, b) => a.priority - b.priority)

  for (const c of rest) {
    const a = Math.min(c.minTokens, remaining)
    alloc.set(c.layer, a)
    remaining -= a
  }
}

// ── Item Packing ──────────────────────────────────────────────────

/**
 * Pack scored items into a budget. Fixed layers (L0, L7) go first,
 * then other layers sorted by priority. Items within a layer are
 * sorted by score (descending).
 */
export function packItems(
  items: PackItem[],
  budget: number,
  depthMode: DepthMode = 'Standard',
): PackItem[] {
  const grouped = new Map<LayerType, PackItem[]>()
  for (const item of items) {
    const list = grouped.get(item.layer) ?? []
    list.push(item)
    grouped.set(item.layer, list)
  }

  const result: PackItem[] = []
  let used = 0

  // Fixed layers first
  for (const layer of ['L0Identity', 'L7UserQuery'] as LayerType[]) {
    const layerItems = (grouped.get(layer) ?? []).sort((a, b) => b.score - a.score)
    for (const item of layerItems) {
      if (used + item.tokens <= budget) {
        result.push(item)
        used += item.tokens
      }
    }
    grouped.delete(layer)
  }

  // Config-based caps
  const configs = new Map(defaultLayerConfigs().map((c) => [c.layer, c] as const))

  // Other layers by priority
  const otherLayers = [...grouped.keys()].sort(
    (a, b) => (configs.get(a)?.priority ?? 5) - (configs.get(b)?.priority ?? 5),
  )

  for (const layer of otherLayers) {
    const layerItems = (grouped.get(layer) ?? []).sort((a, b) => b.score - a.score)
    const cap =
      depthMode === 'Deep'
        ? (configs.get(layer)?.maxTokens ?? Number.MAX_SAFE_INTEGER)
        : depthMode === 'Compact'
          ? (configs.get(layer)?.minTokens ?? 0)
          : (configs.get(layer)?.idealTokens ?? Number.MAX_SAFE_INTEGER)

    let layerUsed = 0
    for (const item of layerItems) {
      if (used + item.tokens <= budget && layerUsed + item.tokens <= cap) {
        result.push(item)
        used += item.tokens
        layerUsed += item.tokens
      }
    }
  }

  return result
}
