// src/engines/capability-resolution.ts
// CapabilityResolutionEngine — resolve capability UI contracts for a provider +
// plan tier via the 3-layer override chain (04-merged-engines.md §6).
// Read-only engine: applies COALESCE/CASE resolution (in the store) then filters
// by plan-tier gating, existential rules, dependency satisfaction, and search.

import type {
  CapabilityResolutionStore,
  RawResolutionRow,
} from '../storage/contracts/capability-resolution-store.js'

// ── Public types ─────────────────────────────────────────────────────────────

export type PlanTier = 'free' | 'pro' | 'max' | 'enterprise'

export type OverrideSource = 'global' | 'tier' | 'provider'

export interface AvailabilityGating {
  requiresLogin?: boolean
  requiresChrome?: boolean
  requiresProvider?: string
  requiresModel?: string
}

export interface CapabilityResolutionOptions {
  /** Active binding capability ids for the provider. Fetched from store if omitted. */
  activeBindings?: string[]
  /** Flat context used to evaluate existential rules. */
  conversationContext?: Record<string, unknown>
}

export interface ResolvedCapability {
  id: string
  slug: string
  name: string
  category: string
  // UI contract
  uiComponent: string
  uiLabel: string
  uiIcon: string
  uiPosition: string
  uiOrder: number
  uiGroup: string
  uiLayerDepth: number
  parentCapabilityId: string | null
  uiPriority: string
  interactionMode: string
  uiStates: string[]
  uiVisibilityRule: string | null
  existentialRule: string | null
  uiInputSchema: Record<string, unknown>
  mutationEffects: Record<string, unknown>
  recoveryBehavior: string
  statePersistence: string
  dataFlow: string
  minPlanTier: PlanTier
  dependsOn: string[]
  // vCode fields
  concurrencySafe: boolean
  opClassification: string | null
  requiresUserConfirmation: boolean
  maxResultSize: number
  resultComponent: string
  resultLayout: string
  // Hot-swap slot overrides (per-slot component key + sandbox whitelist),
  // sourced from provider_capability.ui_component_override (FRONTEND=BACKEND, H6).
  uiSlots: Record<string, { component?: string; sandbox?: string[] }>
  searchHints: string[]
  aliases: string[]
  availability: AvailabilityGating
  prefetch: boolean
  // Override sources (per resolved field)
  overrideSources: Record<string, OverrideSource>
  // Binding context
  bindingStatus: string
  bindingConfidence: number
  // Plan tier overrides
  tierOverrides: {
    maxModels?: number
    maxFileSize?: number
    maxOptions?: number
    customConfig?: Record<string, unknown>
  }
}

export interface ResolvedCapabilities {
  composer: ResolvedCapability[]
  header: ResolvedCapability[]
  message: ResolvedCapability[]
  sidebar: ResolvedCapability[]
  inline: ResolvedCapability[]
  total: number
  resolvedAt: number
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const TIER_RANK: Record<PlanTier, number> = {
  free: 0,
  pro: 1,
  max: 2,
  enterprise: 3,
}

function tierRank(tier: string): number {
  const normalized = tier.toLowerCase().trim()
  const rank = (TIER_RANK as Record<string, number | undefined>)[normalized]
  // Fail closed: an unrecognized tier must be gated, not treated as the open default.
  return rank === undefined ? Number.POSITIVE_INFINITY : rank
}

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (raw == null || raw === '') return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function toOverrideSource(v: string | null | undefined): OverrideSource {
  return v === 'provider' || v === 'tier' ? v : 'global'
}

/**
 * Parse provider_capability.ui_component_override into a per-slot override map.
 * The stored JSON has the shape: { "<slotId>": { "component"?: string, "sandbox"?: string[] } }.
 * A legacy plain-string value is ignored (treated as no overrides).
 */
function parseUiSlots(
  raw: string | null | undefined,
): Record<string, { component?: string; sandbox?: string[] }> {
  if (!raw || raw === '') return {}
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const out: Record<string, { component?: string; sandbox?: string[] }> = {}
      for (const [slot, val] of Object.entries(parsed)) {
        if (val && typeof val === 'object')
          out[slot] = val as { component?: string; sandbox?: string[] }
      }
      return out
    }
  } catch {
    return {}
  }
  return {}
}

const UI_POSITIONS = ['composer', 'header', 'message', 'sidebar', 'inline'] as const
type UiPosition = (typeof UI_POSITIONS)[number]

function normalizePosition(pos: string): UiPosition {
  return (UI_POSITIONS as readonly string[]).includes(pos) ? (pos as UiPosition) : 'inline'
}

// ── Engine ───────────────────────────────────────────────────────────────────

export class CapabilityResolutionEngine {
  constructor(private store: CapabilityResolutionStore) {}

  async resolve(
    providerId: string,
    planTier: PlanTier,
    opts?: CapabilityResolutionOptions,
  ): Promise<ResolvedCapabilities> {
    const rows = await this.store.resolveCapabilities(providerId, planTier)
    const activeBindings = opts?.activeBindings ?? (await this.store.getActiveBindings(providerId))
    return this.buildResult(rows, planTier, activeBindings, opts?.conversationContext)
  }

  async search(
    providerId: string,
    planTier: PlanTier,
    query: string,
    opts?: CapabilityResolutionOptions,
  ): Promise<ResolvedCapabilities> {
    const rows = await this.store.searchCapabilities(providerId, planTier, query)
    const activeBindings = opts?.activeBindings ?? (await this.store.getActiveBindings(providerId))
    const result = this.buildResult(rows, planTier, activeBindings, opts?.conversationContext)
    return this.applySearchFilter(result, query)
  }

  // ── internal ──────────────────────────────────────────────────────────────

  private buildResult(
    rows: RawResolutionRow[],
    planTier: PlanTier,
    activeBindings: string[],
    context?: Record<string, unknown>,
  ): ResolvedCapabilities {
    const bindingSet = new Set(activeBindings)
    const groups: Record<UiPosition, ResolvedCapability[]> = {
      composer: [],
      header: [],
      message: [],
      sidebar: [],
      inline: [],
    }

    for (const row of rows) {
      // [1] Plan tier gating
      if (tierRank(row.min_plan_tier) > tierRank(planTier)) continue

      const cap = this.mapRow(row)

      // [2] Existential rule evaluation
      if (!this.satisfiesExistentialRule(cap.existentialRule, context)) continue

      // [3] Dependency satisfaction
      if (!this.dependenciesSatisfied(cap.dependsOn, bindingSet)) continue

      groups[normalizePosition(cap.uiPosition)].push(cap)
    }

    // sort within groups: ui_group then ui_order
    for (const pos of UI_POSITIONS) {
      groups[pos].sort((a, b) =>
        a.uiGroup === b.uiGroup ? a.uiOrder - b.uiOrder : a.uiGroup.localeCompare(b.uiGroup),
      )
    }

    const total =
      groups.composer.length +
      groups.header.length +
      groups.message.length +
      groups.sidebar.length +
      groups.inline.length

    return {
      composer: groups.composer,
      header: groups.header,
      message: groups.message,
      sidebar: groups.sidebar,
      inline: groups.inline,
      total,
      resolvedAt: Date.now(),
    }
  }

  private mapRow(row: RawResolutionRow): ResolvedCapability {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      category: row.category,
      uiComponent: row.ui_component,
      uiLabel: row.ui_label,
      uiIcon: row.ui_icon,
      uiPosition: row.ui_position,
      uiOrder: row.ui_order,
      uiGroup: row.ui_group,
      uiLayerDepth: row.ui_layer_depth,
      parentCapabilityId: row.parent_capability_id,
      uiPriority: row.ui_priority,
      interactionMode: row.interaction_mode,
      uiStates: safeJsonParse<string[]>(row.ui_states_json, []),
      uiVisibilityRule: row.ui_visibility_rule,
      existentialRule: row.existential_rule,
      uiInputSchema: safeJsonParse<Record<string, unknown>>(row.ui_input_schema, {}),
      mutationEffects: safeJsonParse<Record<string, unknown>>(row.mutation_effects_json, {}),
      recoveryBehavior: row.recovery_behavior,
      statePersistence: row.state_persistence,
      dataFlow: row.data_flow,
      minPlanTier: (row.min_plan_tier as PlanTier) ?? 'free',
      dependsOn: safeJsonParse<string[]>(row.depends_on_json, []),
      concurrencySafe: row.concurrency_safe === 1,
      opClassification: row.op_classification,
      requiresUserConfirmation: row.requires_user_confirmation === 1,
      maxResultSize: row.max_result_size,
      resultComponent: row.result_component,
      resultLayout: row.result_layout,
      uiSlots: parseUiSlots(row.ui_component_override),
      searchHints: safeJsonParse<string[]>(row.search_hints_json, []),
      aliases: safeJsonParse<string[]>(row.aliases_json, []),
      availability: safeJsonParse<AvailabilityGating>(row.availability_json, {}),
      prefetch: row.prefetch === 1,
      // Convention (Hybrid, see candidates/capability-override-precedence.md):
      // the 17 base UI fields below are read from the PRE-MERGED base columns, so
      // `*_from` records the ORIGIN of that merged value (provenance), not a
      // runtime-applied override. Only `uiSlots` is applied at resolve time, from
      // `ui_component_override`. To keep value and provenance consistent, every
      // field that is actually taken from base reports its origin; `uiSlots`
      // reports 'provider' when an override is present, else 'global'.
      overrideSources: {
        uiComponent: toOverrideSource(row.component_from),
        uiLabel: toOverrideSource(row.label_from),
        uiIcon: toOverrideSource(row.icon_from),
        uiPosition: toOverrideSource(row.position_from),
        uiOrder: toOverrideSource(row.order_from),
        uiGroup: toOverrideSource(row.group_from),
        uiPriority: toOverrideSource(row.priority_from),
        interactionMode: toOverrideSource(row.interaction_from),
        uiStates: toOverrideSource(row.states_from),
        uiVisibilityRule: toOverrideSource(row.visibility_from),
        existentialRule: toOverrideSource(row.existential_from),
        uiInputSchema: toOverrideSource(row.input_schema_from),
        mutationEffects: toOverrideSource(row.mutation_from),
        recoveryBehavior: toOverrideSource(row.recovery_from),
        statePersistence: toOverrideSource(row.persistence_from),
        dataFlow: toOverrideSource(row.data_flow_from),
        minPlanTier: toOverrideSource(row.plan_tier_from),
        dependsOn: toOverrideSource(row.depends_from),
        uiSlots: row.ui_component_override ? 'provider' : 'global',
      },
      bindingStatus: row.binding_status,
      bindingConfidence: row.binding_confidence,
      tierOverrides: {
        maxModels: row.tier_max_models ?? undefined,
        maxFileSize: row.tier_max_file_size ?? undefined,
        maxOptions: row.tier_max_options ?? undefined,
        customConfig: row.tier_config_json
          ? safeJsonParse<Record<string, unknown>>(row.tier_config_json, {})
          : undefined,
      },
    }
  }

  /**
   * Evaluate a capability's existential rule against the conversation context.
   * Supported forms (whitespace-tolerant):
   *   "key"            → context.key is truthy
   *   "!key"           → context.key is falsy
   *   "key == value"   → String(context.key) === value
   *   "key != value"   → String(context.key) !== value
   * A null/empty rule is always satisfied. An unparseable rule defaults to satisfied.
   */
  private satisfiesExistentialRule(
    rule: string | null,
    context?: Record<string, unknown>,
  ): boolean {
    if (!rule || rule.trim() === '') return true
    // Fail closed: a rule that references the conversation context must NOT be
    // vacuously satisfied when no context is supplied. Omitting context means
    // "cannot prove the condition holds" -> exclude the capability (H6).
    if (!context) return false

    const expr = rule.trim()

    const eqMatch = expr.match(/^([\w.]+)\s*(==|!=)\s*(.+)$/)
    if (eqMatch) {
      const [, key, op, rawValue] = eqMatch
      const expected = (rawValue ?? '').trim().replace(/^['"]|['"]$/g, '')
      const actual = context[key as string]
      const equal = String(actual) === expected
      return op === '==' ? equal : !equal
    }

    if (expr.startsWith('!')) {
      const key = expr.slice(1).trim()
      return !context[key]
    }

    if (/^[\w.]+$/.test(expr)) {
      return Boolean(context[expr])
    }

    // Unparseable — do not hide the capability.
    return true
  }

  private dependenciesSatisfied(dependsOn: string[], bindings: Set<string>): boolean {
    if (dependsOn.length === 0) return true
    return dependsOn.every((dep) => bindings.has(dep))
  }

  private applySearchFilter(result: ResolvedCapabilities, query: string): ResolvedCapabilities {
    const q = query.trim().toLowerCase()
    if (q === '') return result

    const matches = (cap: ResolvedCapability): boolean =>
      cap.name.toLowerCase().includes(q) ||
      cap.slug.toLowerCase().includes(q) ||
      cap.searchHints.some((h) => h.toLowerCase().includes(q)) ||
      cap.aliases.some((a) => a.toLowerCase().includes(q))

    const composer = result.composer.filter(matches)
    const header = result.header.filter(matches)
    const message = result.message.filter(matches)
    const sidebar = result.sidebar.filter(matches)
    const inline = result.inline.filter(matches)

    return {
      composer,
      header,
      message,
      sidebar,
      inline,
      total: composer.length + header.length + message.length + sidebar.length + inline.length,
      resolvedAt: result.resolvedAt,
    }
  }
}
