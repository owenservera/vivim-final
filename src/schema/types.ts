// src/schema/types.ts
// Canonical TypeScript types for all database rows.
// Generated from 001_baseline.sql — one interface per table.

// ── L0: Bookkeeping ────────────────────────────────────────────────────────

export interface MigrationLogRow {
  id: string
  filename: string
  checksum: string
  applied_at: number
}

// ── L1: Provider Knowledge Graph ────────────────────────────────────────────

export interface ProviderDefinitionRow {
  id: string
  slug: string
  display_name: string
  description: string | null
  category: string
  provider_type: string
  is_active: number
  website_url: string | null
  documentation_url: string | null
  auth_type: string
  has_multi_account: number
  profile_strategy: string
  fleet_config_json: string
  capabilities_json: string
  models_json: string
  created_at: number
  updated_at: number
}

export interface ProviderEndpointRow {
  id: string
  provider_id: string
  url: string
  label: string
  endpoint_type: 'landing' | 'chat' | 'login' | 'api' | 'auth'
  is_default: number
  selectors_json: string
  composer_type: string
  send_method: string
  content_editable: number
  created_at: number
  updated_at: number
}

export interface ProviderParserRow {
  id: string
  provider_id: string
  parser_name: string
  parser_version: number
  parser_logic_type: string
  parser_file_path: string | null
  parser_logic_code: string | null // Inline TypeScript/JavaScript for DB-driven loading
  parser_hash: string | null
  sample_body: string | null // Representative wire-format sample for testing
  is_active: number
  fallback_parser_id: string | null
  created_at: number
  updated_at: number
}

export interface ProviderStreamConfigRow {
  id: string
  provider_id: string
  stream_transport: string // 'sse' | 'batchexecute' | 'websocket' | 'sse-patch'
  stream_terminal_json?: string
  sse_format?: string | null
  delta_path_json?: string | null
  content_type?: string | null
  completion_detectors_json?: string
  harness_js?: string | null
  is_active?: number
  version?: number
  superseded_by?: string | null
  created_at: number
  updated_at: number
}

export interface ProviderCapabilityRow {
  id: string
  provider_id: string
  global_capability_id: string
  recovery_strategies_json: string
  ui_component_override: string | null
  ui_label_override: string | null
  ui_icon_override: string | null
  ui_position_override: string | null
  ui_order_override: number | null
  ui_group_override: string | null
  ui_priority_override: string | null
  interaction_mode_override: string | null
  ui_states_override_json: string | null
  ui_visibility_rule_override: string | null
  existential_rule_override: string | null
  ui_input_schema_override: string | null
  mutation_effects_override_json: string | null
  recovery_behavior_override: string | null
  state_persistence_override: string | null
  data_flow_override: string | null
  min_plan_tier_override: string | null
  depends_on_override_json: string | null
  confidence: number
  success_count: number
  fail_count: number
  consecutive_failures: number
  avg_latency_ms: number
  p95_latency_ms: number
  last_used_at: number | null
  selector_hit_count: number
  selector_miss_count: number
  selector_last_miss_at: number | null
  selector_last_error: string | null
  created_at: number
  updated_at: number
}

export interface ProviderConfigRow {
  id: string
  provider_id: string
  config_key: string
  config_value: string
  config_type: string
  is_secret: number
  created_at: number
  updated_at: number
}

export interface ProviderModelRow {
  id: string
  provider_id: string
  model_slug: string
  display_name: string
  is_active: number
  is_default: number
  capabilities_json: string
  context_window: number | null
  max_output_tokens: number | null
  supports_streaming: number
  supports_vision: number
  supports_thinking: number
  supports_tools: number
  pricing_input_per_1m: number | null
  pricing_output_per_1m: number | null
  created_at: number
  updated_at: number
}

export interface ProviderAccountRow {
  id: string
  provider_id: string
  email: string
  plan_tier: 'free' | 'pro' | 'max' | 'enterprise'
  is_default: number
  is_kind: number
  login_state: string
  login_attempts: number
  last_login_at: number | null
  provider_state_json: string
  debug_port: number | null
  profile_dir: string | null
  chrome_slave_id: string | null
  created_at: number
  updated_at: number
}

// ── L2: Trace ───────────────────────────────────────────────────────────────

export interface TraceEntryRow {
  id: string
  engine: string
  method: string
  request_id: string | null
  conversation_id: string | null
  provider_id: string | null
  account_id: string | null
  slave_id: string | null
  cdp_method: string | null
  cdp_params_json: string | null
  cdp_result_json: string | null
  duration_ms: number
  ok: number
  error: string | null
  ts: number
}

// ── L3: Capability System ───────────────────────────────────────────────────

export interface CapabilityTaxonomyRow {
  id: string
  name: string
  slug: string
  category: string
  description: string | null
  input_type: string
  ui_component: string
  ui_label: string | null
  ui_icon: string | null
  ui_position: string
  ui_order: number
  ui_layer_depth: number
  parent_capability_id: string | null
  ui_group: string
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
  created_at: number
  updated_at: number
}

export interface CapabilityTierRow {
  id: string
  capability_id: string
  plan_tier: string
  max_models: number | null
  max_file_size: number | null
  max_options: number | null
  custom_config_json: string
  ui_states_override_json: string | null
  ui_component_override: string | null
  ui_label_override: string | null
  ui_icon_override: string | null
  ui_input_schema_override: string | null
  created_at: number
  updated_at: number
}

export interface CapabilityBindingRow {
  id: string
  global_id: string
  provider_id: string
  status: 'broken' | 'flaky' | 'prospect' | 'retired' | 'stable' | 'test-1' | 'test-2'
  best_program_id: string | null
  current_program_id: string | null
  promotion_history_json: string
  confidence: number
  created_at: number
  updated_at: number
}

export interface CapabilityProgramRow {
  id: string
  binding_id: string
  version: number
  name: string | null
  superseded_by: string | null
  is_active: number
  config_json: string
  created_at: number
  updated_at: number
}

export interface SelectorStrategyRow {
  id: string
  name: string
  capability_id: string
  provider_id: string
  strategy_type: 'css' | 'xpath' | 'text' | 'aria' | 'data' | 'regex' | 'composite'
  selector_value: string
  priority: number
  is_active: number
  hit_count: number
  miss_count: number
  last_used_at: number | null
  created_at: number
  updated_at: number
}

export interface OutcomeRow {
  id: string
  capability_id: string
  binding_id: string | null
  provider_id: string
  program_id: string | null
  selector_strategy_id: string | null
  ok: number
  error: string | null
  duration_ms: number | null
  confidence: number | null
  selector_used: string | null
  selector_hit: number | null
  ts: number
}

// ── L4: State & Session ─────────────────────────────────────────────────────

export interface VivimSessionRow {
  id: string
  state: string
  context_json: string
  created_at: number
  updated_at: number
}

export interface ProviderSessionRow {
  id: string
  vivim_session_id: string
  provider_id: string
  account_id: string
  state: string
  context_json: string
  created_at: number
  updated_at: number
}

export interface ProfileSessionRow {
  id: string
  provider_session_id: string
  profile_dir: string
  chrome_slave_id: string | null
  state: string
  port: number | null
  created_at: number
  updated_at: number
}

export interface ConversationRow {
  id: string
  provider_session_id: string
  provider_id: string
  title: string | null
  state: string
  message_count: number
  last_message_at: number | null
  context_json: string
  created_at: number
  updated_at: number
}

export interface ConversationMessageRow {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string | null
  blocks_json: string
  block_count: number
  parent_message_id: string | null
  sequence_index: number
  latency_ms: number | null
  token_count: number | null
  model: string | null
  metadata_json: string
  created_at: number
}

export interface StateTransitionRow {
  id: string
  entity_type: string
  entity_id: string
  from_state: string | null
  to_state: string
  trigger: string
  metadata_json: string
  ts: number
}

export interface SessionCheckpointRow {
  id: string
  vivim_session_id: string
  checkpoint_json: string
  created_at: number
}

export interface StreamBlockRow {
  id: string
  conversation_id: string
  message_id: string
  block_index: number
  block_kind: string
  block_data: string
  block_meta: string
  created_at: number
}

// ── L5-L8: Lifecycle, Config ───────────────────────────────────────────────

export interface ProviderManifestVersionRow {
  id: string
  provider_id: string
  manifest_file: string
  version: number
  hash: string
  content_json: string
  change_summary: string | null
  actor: string
  created_at: number
}

export interface RegistrationEventRow {
  id: string
  provider_id: string
  manifest_version_id: string | null
  event_type: string
  table_name: string
  record_id: string | null
  field_name: string | null
  from_value: string | null
  to_value: string | null
  change_summary: string | null
  actor: string
  ts: number
}

export interface ManifestDriftRow {
  id: string
  provider_id: string
  drift_type: string
  table_name: string | null
  record_id: string | null
  seed_value: string | null
  db_value: string | null
  resolved: number
  resolved_by_actor: string | null
  resolved_at: number | null
  detected_at: number
}

export interface BindingStatusLogRow {
  id: string
  binding_id: string
  from_status: string | null
  to_status: string
  from_program_id: string | null
  to_program_id: string | null
  trigger: string
  confidence_at_transition: number | null
  success_rate_at_transition: number | null
  reason: string | null
  actor: string
  metadata_json: string
  ts: number
}

export interface ProgramVersionMetricRow {
  id: string
  binding_id: string
  program_id: string
  program_version: number
  total_executions: number
  success_count: number
  fail_count: number
  avg_latency_ms: number
  p50_latency_ms: number
  p95_latency_ms: number
  p99_latency_ms: number
  last_executed_at: number | null
  first_executed_at: number | null
  window_1h_total: number
  window_1h_success: number
  window_24h_total: number
  window_24h_success: number
  window_7d_total: number
  window_7d_success: number
  created_at: number
  updated_at: number
}

export interface HealthHistoryRow {
  id: string
  providerId: string
  runtimeState: string
  activeSessions: number
  totalConversations: number
  totalMessages: number
  capabilityExecutions: number
  capabilitySuccesses: number
  capabilityFailures: number
  errorCount: number
  parserConfidenceAvg: number | null
  selectorHitRateAvg: number | null
  avgResponseLatencyMs: number | null
  p50ResponseLatencyMs: number | null
  p95ResponseLatencyMs: number | null
  p99ResponseLatencyMs: number | null
  circuitBreakerState: string | null
  fleetRestarts: number
  driftEventsUnresolved: number
  windowStartTs: number
  windowEndTs: number
  snapshotTs: number
  schemaVersion: number
}

export interface ConfigEntryRow {
  id: string
  engineId: string
  scopeType: string
  scopeId: string | null
  configJson: string
  schemaVersion: number
  createdAt: number
  updatedAt: number
}

export interface ConfigAuditRow {
  id: string
  engine_id: string
  config_key: string | null
  from_value: string | null
  to_value: string
  actor: string
  ts: number
}

// ── Input types (for store create methods) ──────────────────────────────────

export interface ManifestVersionInput {
  provider_id: string
  manifest_file: string
  version: number
  hash: string
  content_json: string
  change_summary?: string | null
  actor: string
}

export interface RegistrationEventInput {
  provider_id: string
  manifest_version_id?: string | null
  event_type: string
  table_name: string
  record_id?: string | null
  field_name?: string | null
  from_value?: string | null
  to_value?: string | null
  change_summary?: string | null
  actor: string
}

export interface ManifestDriftInput {
  provider_id: string
  drift_type: string
  table_name?: string | null
  record_id?: string | null
  seed_value?: string | null
  db_value?: string | null
}

// ── L12: Transfer & Routing ──────────────────────────────────────────────

export interface RouteSpecRow {
  id: string
  name: string
  provider_id: string
  capability_id: string
  is_active: number
  config_json: string
  created_at: number
  updated_at: number
}

export interface RouteRequestRow {
  id: string
  route_spec_id: string
  conversation_id: string | null
  status: string
  result_json: string | null
  ts: number
}

export interface RouteTargetRow {
  id: string
  route_spec_id: string
  provider_id: string
  account_id: string | null
  priority: number
  is_active: number
  created_at: number
}

export interface RouteEventRow {
  id: string
  route_request_id: string
  event_type: string
  event_data_json: string
  ts: number
}
