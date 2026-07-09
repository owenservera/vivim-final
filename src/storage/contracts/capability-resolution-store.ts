// src/storage/contracts/capability-resolution-store.ts
// CapabilityResolutionStore — read-only resolution contract (04-merged-engines.md §6).

export interface RawResolutionRow {
  // capability_taxonomy columns
  id: string
  slug: string
  name: string
  category: string
  ui_component: string
  ui_label: string
  ui_icon: string
  ui_position: string
  ui_order: number
  ui_group: string
  ui_layer_depth: number
  parent_capability_id: string | null
  ui_priority: string
  interaction_mode: string
  ui_states_json: string
  ui_visibility_rule: string | null
  existential_rule: string | null
  ui_input_schema: string
  mutation_effects_json: string
  recovery_behavior: string
  state_persistence: string
  data_flow: string
  min_plan_tier: string
  depends_on_json: string
  // vCode pattern columns
  concurrency_safe: number
  op_classification: string | null
  requires_user_confirmation: number
  max_result_size: number
  result_component: string
  result_layout: string
  search_hints_json: string
  aliases_json: string
  availability_json: string
  prefetch: number
  // override source tracking (global | tier | provider)
  component_from: string
  label_from: string
  icon_from: string
  position_from: string
  order_from: string
  group_from: string
  priority_from: string
  interaction_from: string
  states_from: string
  visibility_from: string
  existential_from: string
  input_schema_from: string
  mutation_from: string
  recovery_from: string
  persistence_from: string
  data_flow_from: string
  plan_tier_from: string
  depends_from: string
  // joined columns
  binding_status: string
  binding_confidence: number
  tier_max_models: number | null
  tier_max_file_size: number | null
  tier_max_options: number | null
  tier_config_json: string | null
}

export interface CapabilityResolutionStore {
  resolveCapabilities(providerId: string, planTier: string): Promise<RawResolutionRow[]>
  getActiveBindings(providerId: string): Promise<string[]>
  searchCapabilities(
    providerId: string,
    planTier: string,
    query: string,
  ): Promise<RawResolutionRow[]>
}
