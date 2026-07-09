# 03 — Merged Schema: Complete SQL Baseline

**Status:** FINAL — merged PRD
**Covers:** Original `03-schema-manifest.md` + `pending-design/01-schema-reconciliation.md` + all lifecycle tables from registration/versioning/telemetry docs + config + harness + MCP slots + vCode pattern columns

**Schema Management:** Prisma v6.5 (`prisma/schema.prisma`) for tables, relations, indexes, defaults. Post-migration SQL (`prisma/seed.sql`) for CHECK constraints, views, and expression defaults. Database: SQLite (`prisma/dev.db`).

**Output:** Copy-paste `prisma/seed.sql` for CHECK constraints + views + seed data. All table definitions are managed via Prisma schema.

---

## `001_baseline.sql`

```sql
-- ============================================================================
-- cap-store v1 Knowledge Graph Rebuild — Baseline Schema
-- Migration: 001_baseline.sql
-- Tables: ~54 | Views: 9
-- Date: 2026-07-09
-- ============================================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;

-- ============================================================================
-- L0: Bookkeeping
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (key, value)
);

CREATE TABLE IF NOT EXISTS migration_log (
  id TEXT NOT NULL PRIMARY KEY,
  filename TEXT NOT NULL,
  checksum TEXT NOT NULL,
  applied_at INTEGER NOT NULL
);

-- ============================================================================
-- L1: Provider Knowledge Graph
-- ============================================================================

CREATE TABLE IF NOT EXISTS provider_definition (
  id TEXT NOT NULL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'ai',
  provider_type TEXT NOT NULL DEFAULT 'llm',
  is_active INTEGER NOT NULL DEFAULT 1,
  website_url TEXT,
  documentation_url TEXT,
  auth_type TEXT NOT NULL DEFAULT 'browser',
  has_multi_account INTEGER NOT NULL DEFAULT 0,
  profile_strategy TEXT NOT NULL DEFAULT 'per_account',
  fleet_config_json TEXT NOT NULL DEFAULT '{}',
  capabilities_json TEXT NOT NULL DEFAULT '{}',
  models_json TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_endpoint (
  id TEXT NOT NULL PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES provider_definition(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  label TEXT NOT NULL,
  endpoint_type TEXT NOT NULL CHECK (endpoint_type IN ('landing','chat','login','api','auth')),
  is_default INTEGER NOT NULL DEFAULT 0,
  selector_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_pe_provider ON provider_endpoint(provider_id);

CREATE TABLE IF NOT EXISTS provider_parser (
  id TEXT NOT NULL PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES provider_definition(id) ON DELETE CASCADE,
  parser_name TEXT NOT NULL,
  parser_version INTEGER NOT NULL DEFAULT 1,
  parser_logic_type TEXT NOT NULL DEFAULT 'file',
  -- CHECK removed — default 'file', no engine uses inline/composed
  parser_file_path TEXT,
  parser_hash TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  fallback_parser_id TEXT REFERENCES provider_parser(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_pp_provider ON provider_parser(provider_id);

CREATE TABLE IF NOT EXISTS provider_capability (
  id TEXT NOT NULL PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES provider_definition(id) ON DELETE CASCADE,
  global_capability_id TEXT NOT NULL,
  -- NEW: vCode pattern — recovery strategy array
  recovery_strategies_json TEXT NOT NULL DEFAULT '[]',
  -- Override columns
  ui_component_override TEXT,
  ui_label_override TEXT,
  ui_icon_override TEXT,
  ui_position_override TEXT,
  ui_order_override INTEGER,
  ui_group_override TEXT,
  ui_priority_override TEXT,
  interaction_mode_override TEXT,
  ui_states_override_json TEXT,
  ui_visibility_rule_override TEXT,
  existential_rule_override TEXT,
  ui_input_schema_override TEXT,
  mutation_effects_override_json TEXT,
  recovery_behavior_override TEXT,
  state_persistence_override TEXT,
  data_flow_override TEXT,
  min_plan_tier_override TEXT,
  depends_on_override_json TEXT,
  -- Health
  confidence REAL NOT NULL DEFAULT 1.0,
  success_count INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  avg_latency_ms REAL DEFAULT 0,
  p95_latency_ms REAL DEFAULT 0,
  last_used_at INTEGER,
  -- Selector health (materialized aggregation from selector_strategy,
  -- refreshed by TelemetryAggregator on its scheduled cycle)
  selector_hit_count INTEGER NOT NULL DEFAULT 0,
  selector_miss_count INTEGER NOT NULL DEFAULT 0,
  selector_last_miss_at INTEGER,
  selector_last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(provider_id, global_capability_id)
);

CREATE INDEX idx_pc_provider ON provider_capability(provider_id);
CREATE INDEX idx_pc_cap ON provider_capability(global_capability_id);
CREATE INDEX idx_pc_confidence ON provider_capability(provider_id, confidence);
CREATE INDEX idx_pc_selector ON provider_capability(provider_id, selector_hit_count);

CREATE TABLE IF NOT EXISTS provider_config (
  id TEXT NOT NULL PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES provider_definition(id) ON DELETE CASCADE,
  config_key TEXT NOT NULL,
  config_value TEXT NOT NULL,
  config_type TEXT NOT NULL DEFAULT 'string',
  is_secret INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(provider_id, config_key)
);

CREATE TABLE IF NOT EXISTS provider_model (
  id TEXT NOT NULL PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES provider_definition(id) ON DELETE CASCADE,
  model_slug TEXT NOT NULL,
  display_name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_default INTEGER NOT NULL DEFAULT 0,
  capabilities_json TEXT NOT NULL DEFAULT '[]',
  context_window INTEGER,
  max_output_tokens INTEGER,
  supports_streaming INTEGER NOT NULL DEFAULT 0,
  supports_vision INTEGER NOT NULL DEFAULT 0,
  supports_thinking INTEGER NOT NULL DEFAULT 0,
  supports_tools INTEGER NOT NULL DEFAULT 0,
  pricing_input_per_1m REAL,
  pricing_output_per_1m REAL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(provider_id, model_slug)
);

CREATE TABLE IF NOT EXISTS provider_account (
  id TEXT NOT NULL PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES provider_definition(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  plan_tier TEXT NOT NULL DEFAULT 'free'
    CHECK (plan_tier IN ('free','pro','max','enterprise')),
  is_default INTEGER NOT NULL DEFAULT 0,
  is_kind INTEGER NOT NULL DEFAULT 0,
  login_state TEXT NOT NULL DEFAULT 'unknown'
    CHECK (login_state IN ('unknown','logged_out','logging_in','logged_in','login_failed','rate_limited','captcha_required')),
  login_attempts INTEGER NOT NULL DEFAULT 0,
  last_login_at INTEGER,
  provider_state_json TEXT NOT NULL DEFAULT '{}',
  debug_port INTEGER,
  profile_dir TEXT,
  chrome_slave_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(provider_id, email)
);

CREATE INDEX idx_pa_provider ON provider_account(provider_id);
CREATE INDEX idx_pa_email ON provider_account(email);
CREATE INDEX idx_pa_login ON provider_account(login_state);

-- ============================================================================
-- L2: Trace (NEW — from Governor.TraceLog)
-- ============================================================================

CREATE TABLE IF NOT EXISTS trace_entry (
  id TEXT NOT NULL PRIMARY KEY,
  engine TEXT NOT NULL,
  method TEXT NOT NULL,
  request_id TEXT,
  conversation_id TEXT,
  provider_id TEXT,
  account_id TEXT,
  slave_id TEXT,
  cdp_method TEXT,
  cdp_params_json TEXT,
  cdp_result_json TEXT,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  ok INTEGER NOT NULL DEFAULT 1,
  error TEXT,
  ts INTEGER NOT NULL
);

CREATE INDEX idx_te_engine ON trace_entry(engine, ts DESC);
CREATE INDEX idx_te_conv ON trace_entry(conversation_id, ts DESC);
CREATE INDEX idx_te_provider ON trace_entry(provider_id, ts DESC);
CREATE INDEX idx_te_slave ON trace_entry(slave_id, ts DESC);

-- ============================================================================
-- L3: Universal Capability System
-- ============================================================================

CREATE TABLE IF NOT EXISTS capability_taxonomy (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  description TEXT,
  -- UI contract fields (21 fields)
  input_type TEXT NOT NULL DEFAULT 'void',
  ui_component TEXT NOT NULL DEFAULT 'action_button',
  ui_label TEXT,
  ui_icon TEXT,
  ui_position TEXT NOT NULL DEFAULT 'composer',
  ui_order INTEGER DEFAULT 0,
  ui_layer_depth INTEGER NOT NULL DEFAULT 0,
  parent_capability_id TEXT REFERENCES capability_taxonomy(id) ON DELETE SET NULL,
  ui_group TEXT DEFAULT 'default',
  ui_priority TEXT NOT NULL DEFAULT 'secondary',
  interaction_mode TEXT NOT NULL DEFAULT 'single_click',
  ui_states_json TEXT DEFAULT '[]',
  ui_visibility_rule TEXT,
  existential_rule TEXT,
  ui_input_schema TEXT DEFAULT '{}',
  mutation_effects_json TEXT DEFAULT '{}',
  recovery_behavior TEXT NOT NULL DEFAULT 'retry_manual',
  state_persistence TEXT NOT NULL DEFAULT 'none',
  data_flow TEXT NOT NULL DEFAULT 'user_to_provider',
  min_plan_tier TEXT NOT NULL DEFAULT 'free'
    CHECK (min_plan_tier IN ('free','pro','max','enterprise')),
  depends_on_json TEXT DEFAULT '[]',
  -- NEW: vCode pattern — operation classification
  concurrency_safe INTEGER NOT NULL DEFAULT 0,
  op_classification TEXT CHECK (op_classification IN ('read','write','destructive','navigate','search')),
  requires_user_confirmation INTEGER NOT NULL DEFAULT 0,
  -- NEW: vCode pattern — result handling
  max_result_size INTEGER NOT NULL DEFAULT 100000,
  result_component TEXT NOT NULL DEFAULT 'text_block',
  result_layout TEXT NOT NULL DEFAULT 'inline',
  -- NEW: vCode pattern — discoverability
  search_hints_json TEXT NOT NULL DEFAULT '[]',
  aliases_json TEXT NOT NULL DEFAULT '[]',
  -- NEW: vCode pattern — availability gating
  availability_json TEXT NOT NULL DEFAULT '{}',
  -- NEW: vCode pattern — prefetch
  prefetch INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_ct_category ON capability_taxonomy(category);
CREATE INDEX idx_ct_position ON capability_taxonomy(ui_position, ui_group, ui_order);
CREATE INDEX idx_ct_slug ON capability_taxonomy(slug);
CREATE INDEX idx_ct_parent ON capability_taxonomy(parent_capability_id);
CREATE INDEX idx_ct_classification ON capability_taxonomy(op_classification);

CREATE TABLE IF NOT EXISTS capability_tier (
  id TEXT NOT NULL PRIMARY KEY,
  capability_id TEXT NOT NULL REFERENCES capability_taxonomy(id) ON DELETE CASCADE,
  plan_tier TEXT NOT NULL CHECK (plan_tier IN ('free','pro','max','enterprise')),
  max_models INTEGER,
  max_file_size INTEGER,
  max_options INTEGER,
  custom_config_json TEXT DEFAULT '{}',
  ui_states_override_json TEXT,
  ui_component_override TEXT,
  ui_label_override TEXT,
  ui_icon_override TEXT,
  ui_input_schema_override TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(capability_id, plan_tier)
);

CREATE TABLE IF NOT EXISTS capability_binding (
  id TEXT NOT NULL PRIMARY KEY,
  global_id TEXT NOT NULL REFERENCES capability_taxonomy(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL REFERENCES provider_definition(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'prospect'
    CHECK (status IN ('broken','flaky','prospect','retired','stable','test-1','test-2')),
  best_program_id TEXT,
  current_program_id TEXT,
  promotion_history_json TEXT NOT NULL DEFAULT '[]',
  confidence REAL NOT NULL DEFAULT 0.0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(global_id, provider_id)
);

CREATE INDEX idx_cb_provider ON capability_binding(provider_id);
CREATE INDEX idx_cb_status ON capability_binding(status);
CREATE INDEX idx_cb_global ON capability_binding(global_id);

CREATE TABLE IF NOT EXISTS capability_program (
  id TEXT NOT NULL PRIMARY KEY,
  binding_id TEXT NOT NULL REFERENCES capability_binding(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  name TEXT,
  superseded_by TEXT REFERENCES capability_program(id) ON DELETE SET NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  config_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_cp_binding ON capability_program(binding_id);

CREATE TABLE IF NOT EXISTS selector_strategy (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  capability_id TEXT NOT NULL REFERENCES capability_taxonomy(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL REFERENCES provider_definition(id) ON DELETE CASCADE,
  strategy_type TEXT NOT NULL CHECK (strategy_type IN ('css','xpath','text','aria','data','regex','composite')),
  selector_value TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  -- Source of truth for per-selector health.
  -- provider_capability.selector_hit_count and selector_miss_count
  -- are materialized aggregates refreshed by TelemetryAggregator.
  hit_count INTEGER NOT NULL DEFAULT 0,
  miss_count INTEGER NOT NULL DEFAULT 0,
  last_used_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_ss_cap ON selector_strategy(capability_id, provider_id);
CREATE INDEX idx_ss_provider ON selector_strategy(provider_id);

CREATE TABLE IF NOT EXISTS outcome (
  id TEXT NOT NULL PRIMARY KEY,
  capability_id TEXT NOT NULL,
  binding_id TEXT,
  provider_id TEXT NOT NULL,
  program_id TEXT,
  selector_strategy_id TEXT,
  ok INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  duration_ms INTEGER,
  confidence REAL,
  selector_used TEXT,
  selector_hit INTEGER,
  ts INTEGER NOT NULL
);

CREATE INDEX idx_o_provider ON outcome(provider_id, ts DESC);
CREATE INDEX idx_o_cap ON outcome(capability_id, ts DESC);
CREATE INDEX idx_o_ok ON outcome(ok, ts DESC);
CREATE INDEX idx_o_ts ON outcome(ts DESC);

-- ============================================================================
-- L4: State & Session
-- ============================================================================

CREATE TABLE IF NOT EXISTS vivim_session (
  id TEXT NOT NULL PRIMARY KEY,
  state TEXT NOT NULL DEFAULT 'idle',
  context_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_session (
  id TEXT NOT NULL PRIMARY KEY,
  vivim_session_id TEXT NOT NULL REFERENCES vivim_session(id) ON DELETE CASCADE,
  -- Authoritative provider FK. provider_session.provider_id is derived
  -- from the account FK (provider_account.provider_id) but is denormalized
  -- here for fast join-free access. If provider_id disagrees with the
  -- account's provider, the account FK wins (enforced by CHECK or trigger).
  provider_id TEXT NOT NULL REFERENCES provider_definition(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES provider_account(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'idle',
  context_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  -- CONSTRAINT: provider_id must match the account's provider
  -- Enforced at application layer; consider trigger for enforcement
  -- CHECK (provider_id = (SELECT provider_id FROM provider_account WHERE id = account_id))
);

CREATE INDEX idx_ps_session ON provider_session(vivim_session_id);

CREATE TABLE IF NOT EXISTS profile_session (
  id TEXT NOT NULL PRIMARY KEY,
  provider_session_id TEXT NOT NULL REFERENCES provider_session(id) ON DELETE CASCADE,
  profile_dir TEXT NOT NULL,
  chrome_slave_id TEXT,
  state TEXT NOT NULL DEFAULT 'stopped',
  port INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_prs_session ON profile_session(provider_session_id);

CREATE TABLE IF NOT EXISTS conversation (
  id TEXT NOT NULL PRIMARY KEY,
  provider_session_id TEXT NOT NULL REFERENCES provider_session(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL REFERENCES provider_definition(id) ON DELETE CASCADE,
  title TEXT,
  state TEXT NOT NULL DEFAULT 'active',
  message_count INTEGER NOT NULL DEFAULT 0,
  last_message_at INTEGER,
  context_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_conv_session ON conversation(provider_session_id);
CREATE INDEX idx_conv_provider ON conversation(provider_id);

CREATE TABLE IF NOT EXISTS conversation_message (
  id TEXT NOT NULL PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system','tool')),
  content TEXT,
  blocks_json TEXT NOT NULL DEFAULT '[]',
  block_count INTEGER NOT NULL DEFAULT 0,
  parent_message_id TEXT REFERENCES conversation_message(id) ON DELETE SET NULL,
  sequence_index INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER,
  token_count INTEGER,
  model TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_cm_conv ON conversation_message(conversation_id, sequence_index);

CREATE TABLE IF NOT EXISTS state_transition (
  id TEXT NOT NULL PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  from_state TEXT,
  to_state TEXT NOT NULL,
  trigger TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  ts INTEGER NOT NULL
);

CREATE INDEX idx_st_entity ON state_transition(entity_type, entity_id, ts DESC);

CREATE TABLE IF NOT EXISTS session_checkpoint (
  id TEXT NOT NULL PRIMARY KEY,
  vivim_session_id TEXT NOT NULL REFERENCES vivim_session(id) ON DELETE CASCADE,
  checkpoint_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_sc_session ON session_checkpoint(vivim_session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS stream_block (
  id TEXT NOT NULL PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL REFERENCES conversation_message(id) ON DELETE CASCADE,
  block_index INTEGER NOT NULL,
  block_kind TEXT NOT NULL CHECK (block_kind IN (
    'text','thinking','code','artifact','image','citation','tool_use','error','meta'
  )),
  block_data TEXT NOT NULL,
  block_meta TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  UNIQUE(conversation_id, message_id, block_index)
);

CREATE INDEX idx_sb_conv ON stream_block(conversation_id, message_id, block_index);
CREATE INDEX idx_sb_message ON stream_block(message_id);
CREATE INDEX idx_sb_kind ON stream_block(conversation_id, block_kind);

-- ============================================================================
-- L5: Registration Lifecycle (NEW)
-- ============================================================================

CREATE TABLE IF NOT EXISTS provider_manifest_version (
  id TEXT NOT NULL PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES provider_definition(id) ON DELETE CASCADE,
  manifest_file TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  hash TEXT NOT NULL,
  content_json TEXT NOT NULL,
  change_summary TEXT,
  actor TEXT NOT NULL DEFAULT 'system',
  created_at INTEGER NOT NULL,
  UNIQUE(provider_id, manifest_file, version)
);

CREATE INDEX idx_pmv_provider ON provider_manifest_version(provider_id, version DESC);

CREATE TABLE IF NOT EXISTS registration_event (
  id TEXT NOT NULL PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES provider_definition(id) ON DELETE CASCADE,
  manifest_version_id TEXT REFERENCES provider_manifest_version(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'created','updated','deleted','field_changed','table_written','rollback'
  )),
  table_name TEXT NOT NULL,
  record_id TEXT,
  field_name TEXT,
  from_value TEXT,
  to_value TEXT,
  change_summary TEXT,
  actor TEXT NOT NULL DEFAULT 'system',
  ts INTEGER NOT NULL
);

CREATE INDEX idx_re_provider ON registration_event(provider_id, ts DESC);
CREATE INDEX idx_re_type ON registration_event(event_type);
CREATE INDEX idx_re_table ON registration_event(table_name);

CREATE TABLE IF NOT EXISTS manifest_drift (
  id TEXT NOT NULL PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES provider_definition(id) ON DELETE CASCADE,
  drift_type TEXT NOT NULL CHECK (drift_type IN ('added','removed','modified','missing_table','extra_table','schema_diff')),
  table_name TEXT,
  record_id TEXT,
  seed_value TEXT,
  db_value TEXT,
  resolved INTEGER NOT NULL DEFAULT 0,
  resolved_by_actor TEXT,
  resolved_at INTEGER,
  detected_at INTEGER NOT NULL
);

CREATE INDEX idx_md_provider ON manifest_drift(provider_id, resolved, detected_at DESC);

-- ============================================================================
-- L6: Versioning Lifecycle (NEW)
-- ============================================================================

CREATE TABLE IF NOT EXISTS capability_taxonomy_version (
  id TEXT NOT NULL PRIMARY KEY,
  capability_id TEXT NOT NULL REFERENCES capability_taxonomy(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  -- Full snapshot of the capability row at this version (JSON blob)
  -- Serializes all 30+ columns into a single TEXT column to avoid
  -- schema drift: when capability_taxonomy adds a column, the version
  -- snapshot automatically captures it without a table migration.
  snapshot_json TEXT NOT NULL,
  -- Human-readable change summary for audit
  change_summary TEXT,
  -- Which fields changed in this version (array of field names)
  changed_fields_json TEXT NOT NULL DEFAULT '[]',
  actor TEXT DEFAULT 'system',
  created_at INTEGER NOT NULL,
  UNIQUE(capability_id, version)
);

CREATE INDEX idx_ctv_cap ON capability_taxonomy_version(capability_id, version DESC);
CREATE INDEX idx_ctv_created ON capability_taxonomy_version(created_at DESC);

CREATE TABLE IF NOT EXISTS binding_status_log (
  id TEXT NOT NULL PRIMARY KEY,
  binding_id TEXT NOT NULL REFERENCES capability_binding(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  from_program_id TEXT,
  to_program_id TEXT,
  trigger TEXT NOT NULL CHECK (trigger IN (
    'auto','manual','admin','health_degrade','health_upgrade','test_result','program_compare'
  )),
  confidence_at_transition REAL,
  success_rate_at_transition REAL,
  reason TEXT,
  actor TEXT DEFAULT 'system',
  metadata_json TEXT DEFAULT '{}',
  ts INTEGER NOT NULL
);

CREATE INDEX idx_bsl_binding ON binding_status_log(binding_id, ts DESC);
CREATE INDEX idx_bsl_trigger ON binding_status_log(trigger);
CREATE INDEX idx_bsl_ts ON binding_status_log(ts DESC);

CREATE TABLE IF NOT EXISTS program_version_metric (
  id TEXT NOT NULL PRIMARY KEY,
  binding_id TEXT NOT NULL REFERENCES capability_binding(id) ON DELETE CASCADE,
  program_id TEXT NOT NULL REFERENCES capability_program(id) ON DELETE CASCADE,
  program_version INTEGER NOT NULL,
  total_executions INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  avg_latency_ms REAL DEFAULT 0,
  p50_latency_ms REAL DEFAULT 0,
  p95_latency_ms REAL DEFAULT 0,
  p99_latency_ms REAL DEFAULT 0,
  last_executed_at INTEGER,
  first_executed_at INTEGER,
  window_1h_total INTEGER DEFAULT 0,
  window_1h_success INTEGER DEFAULT 0,
  window_24h_total INTEGER DEFAULT 0,
  window_24h_success INTEGER DEFAULT 0,
  window_7d_total INTEGER DEFAULT 0,
  window_7d_success INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(binding_id, program_id, program_version)
);

CREATE INDEX idx_pvm_binding ON program_version_metric(binding_id);
CREATE INDEX idx_pvm_program ON program_version_metric(program_id);
CREATE INDEX idx_pvm_updated ON program_version_metric(updated_at DESC);

-- ============================================================================
-- L7: Telemetry Lifecycle (NEW)
-- ============================================================================

CREATE TABLE IF NOT EXISTS provider_health_history (
  id TEXT NOT NULL PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES provider_definition(id) ON DELETE CASCADE,
  runtime_state TEXT NOT NULL,
  active_sessions INTEGER DEFAULT 0,
  total_conversations INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  capability_executions INTEGER DEFAULT 0,
  capability_successes INTEGER DEFAULT 0,
  capability_failures INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  parser_confidence_avg REAL,
  selector_hit_rate_avg REAL,
  avg_response_latency_ms REAL,
  p50_response_latency_ms REAL,
  p95_response_latency_ms REAL,
  p99_response_latency_ms REAL,
  circuit_breaker_state TEXT,
  fleet_restarts INTEGER DEFAULT 0,
  drift_events_unresolved INTEGER DEFAULT 0,
  window_start_ts INTEGER NOT NULL,
  window_end_ts INTEGER NOT NULL,
  snapshot_ts INTEGER NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_phh_provider ON provider_health_history(provider_id, snapshot_ts DESC);
CREATE INDEX idx_phh_window ON provider_health_history(window_start_ts, window_end_ts);

CREATE TABLE IF NOT EXISTS capability_telemetry (
  id TEXT NOT NULL PRIMARY KEY,
  capability_id TEXT NOT NULL REFERENCES capability_taxonomy(id) ON DELETE CASCADE,
  binding_id TEXT REFERENCES capability_binding(id) ON DELETE SET NULL,
  provider_id TEXT NOT NULL REFERENCES provider_definition(id) ON DELETE CASCADE,
  program_id TEXT REFERENCES capability_program(id) ON DELETE SET NULL,
  total_executions INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  avg_latency_ms REAL DEFAULT 0,
  p50_latency_ms REAL DEFAULT 0,
  p95_latency_ms REAL DEFAULT 0,
  last_executed_at INTEGER,
  last_error TEXT,
  last_error_ts INTEGER,
  consecutive_failures INTEGER DEFAULT 0,
  window_1h_executions INTEGER DEFAULT 0,
  window_1h_success_count INTEGER DEFAULT 0,
  window_24h_executions INTEGER DEFAULT 0,
  window_24h_success_count INTEGER DEFAULT 0,
  window_7d_executions INTEGER DEFAULT 0,
  window_7d_success_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(capability_id, binding_id, program_id)
);

CREATE INDEX idx_captel_provider ON capability_telemetry(provider_id);
CREATE INDEX idx_captel_capability ON capability_telemetry(capability_id);
CREATE INDEX idx_captel_updated ON capability_telemetry(updated_at DESC);

CREATE TABLE IF NOT EXISTS selector_health_history (
  id TEXT NOT NULL PRIMARY KEY,
  selector_strategy_id TEXT NOT NULL REFERENCES selector_strategy(id) ON DELETE CASCADE,
  binding_id TEXT NOT NULL REFERENCES capability_binding(id) ON DELETE CASCADE,
  hit_count INTEGER NOT NULL DEFAULT 0,
  miss_count INTEGER NOT NULL DEFAULT 0,
  hit_rate REAL NOT NULL DEFAULT 0,
  avg_duration_ms REAL DEFAULT 0,
  p95_duration_ms REAL DEFAULT 0,
  window_start_ts INTEGER NOT NULL,
  window_end_ts INTEGER NOT NULL,
  snapshot_ts INTEGER NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_shh_selector ON selector_health_history(selector_strategy_id, snapshot_ts DESC);
CREATE INDEX idx_shh_binding ON selector_health_history(binding_id, snapshot_ts DESC);
CREATE INDEX idx_shh_window ON selector_health_history(window_start_ts, window_end_ts);

CREATE TABLE IF NOT EXISTS telemetry_summary_daily (
  id TEXT NOT NULL PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES provider_definition(id) ON DELETE CASCADE,
  day_ts TEXT NOT NULL,
  total_conversations INTEGER NOT NULL DEFAULT 0,
  total_conversations_created INTEGER NOT NULL DEFAULT 0,
  total_messages_sent INTEGER NOT NULL DEFAULT 0,
  total_capability_executions INTEGER NOT NULL DEFAULT 0,
  total_capability_successes INTEGER NOT NULL DEFAULT 0,
  total_capability_failures INTEGER NOT NULL DEFAULT 0,
  total_errors INTEGER NOT NULL DEFAULT 0,
  avg_response_latency_ms REAL DEFAULT 0,
  p95_response_latency_ms REAL DEFAULT 0,
  peak_concurrent_sessions INTEGER DEFAULT 0,
  peak_concurrent_slaves INTEGER DEFAULT 0,
  parser_health_events INTEGER DEFAULT 0,
  circuit_breaker_opens INTEGER DEFAULT 0,
  circuit_breaker_resets INTEGER DEFAULT 0,
  drift_events INTEGER DEFAULT 0,
  drift_resolved INTEGER DEFAULT 0,
  fleet_restarts INTEGER DEFAULT 0,
  manifest_changes INTEGER DEFAULT 0,
  schema_version INTEGER NOT NULL DEFAULT 1,
  UNIQUE(provider_id, day_ts)
);

CREATE INDEX idx_tsd_provider ON telemetry_summary_daily(provider_id, day_ts DESC);
CREATE INDEX idx_tsd_day ON telemetry_summary_daily(day_ts);

CREATE TABLE IF NOT EXISTS manifest_change_log (
  id TEXT NOT NULL PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES provider_definition(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL CHECK (change_type IN (
    'seed_created','seed_updated','seed_deleted','manifest_reloaded','auto_heal','drift_resolved'
  )),
  file_path TEXT,
  old_hash TEXT,
  new_hash TEXT,
  tables_affected_json TEXT NOT NULL DEFAULT '[]',
  rows_added INTEGER DEFAULT 0,
  rows_modified INTEGER DEFAULT 0,
  rows_removed INTEGER DEFAULT 0,
  actor TEXT DEFAULT 'system',
  manifest_version_id TEXT REFERENCES provider_manifest_version(id) ON DELETE SET NULL,
  ts INTEGER NOT NULL
);

CREATE INDEX idx_mcl_provider ON manifest_change_log(provider_id, ts DESC);
CREATE INDEX idx_mcl_type ON manifest_change_log(change_type);
CREATE INDEX idx_mcl_ts ON manifest_change_log(ts DESC);

CREATE TABLE IF NOT EXISTS telemetry_cycle_log (
  id TEXT NOT NULL PRIMARY KEY,
  schedule_name TEXT NOT NULL,
  rows_written INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  ts INTEGER NOT NULL
);

CREATE INDEX idx_tcl_schedule ON telemetry_cycle_log(schedule_name, ts DESC);

-- ============================================================================
-- L8: Config (NEW)
-- ============================================================================

CREATE TABLE IF NOT EXISTS config_entry (
  id TEXT NOT NULL PRIMARY KEY,
  engine_id TEXT NOT NULL,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('global','provider','account','engine')),
  scope_id TEXT,
  config_json TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(engine_id, scope_type, scope_id)
);

CREATE INDEX idx_ce_engine ON config_entry(engine_id);

CREATE TABLE IF NOT EXISTS config_audit (
  id TEXT NOT NULL PRIMARY KEY,
  engine_id TEXT NOT NULL,
  entry_id TEXT NOT NULL REFERENCES config_entry(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('created','updated','reloaded','reset')),
  from_json TEXT,
  to_json TEXT,
  actor TEXT NOT NULL DEFAULT 'system',
  ts INTEGER NOT NULL
);

CREATE INDEX idx_ca_engine ON config_audit(engine_id, ts DESC);
CREATE INDEX idx_ca_entry ON config_audit(entry_id, ts DESC);

-- ============================================================================
-- L9: Harness (NEW)
-- ============================================================================

CREATE TABLE IF NOT EXISTS harness_checkpoint (
  id TEXT NOT NULL PRIMARY KEY,
  slave_id TEXT NOT NULL,
  conversation_id TEXT,
  active_dag_json TEXT,
  dag_position INTEGER,
  loaded_modules_json TEXT NOT NULL DEFAULT '[]',
  page_url TEXT,
  page_title TEXT,
  auth_state TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_hc_slave ON harness_checkpoint(slave_id, created_at DESC);
CREATE INDEX idx_hc_conv ON harness_checkpoint(conversation_id);

CREATE TABLE IF NOT EXISTS capability_macro (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  provider_id TEXT REFERENCES provider_definition(id) ON DELETE CASCADE,
  dag_json TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_cm_provider ON capability_macro(provider_id);

-- ============================================================================
-- L10: MCP Server Config (NEW — design slot)
-- ============================================================================

CREATE TABLE IF NOT EXISTS mcp_server_config (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 0,
  port INTEGER NOT NULL DEFAULT 0,
  tools_json TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- ============================================================================
-- L11: Operations
-- ============================================================================

CREATE TABLE IF NOT EXISTS health_tick (
  id TEXT NOT NULL PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES provider_definition(id) ON DELETE CASCADE,
  slave_id TEXT,
  status TEXT NOT NULL,
  response_ms INTEGER,
  error TEXT,
  ts INTEGER NOT NULL
);

CREATE INDEX idx_ht_provider ON health_tick(provider_id, ts DESC);

CREATE TABLE IF NOT EXISTS circuit_breaker_state (
  id TEXT NOT NULL PRIMARY KEY,
  slave_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('closed','half_open','open')),
  fail_count INTEGER NOT NULL DEFAULT 0,
  last_fail_at INTEGER,
  last_success_at INTEGER,
  opened_at INTEGER,
  half_opened_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(slave_id)
);

CREATE TABLE IF NOT EXISTS drift_event (
  id TEXT NOT NULL PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES provider_definition(id) ON DELETE CASCADE,
  capability_id TEXT,
  binding_id TEXT,
  drift_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  description TEXT,
  resolved INTEGER NOT NULL DEFAULT 0,
  detected_at INTEGER NOT NULL,
  resolved_at INTEGER
);

CREATE INDEX idx_de_provider ON drift_event(provider_id, detected_at DESC);

CREATE TABLE IF NOT EXISTS fleet_event (
  id TEXT NOT NULL PRIMARY KEY,
  slave_id TEXT NOT NULL,
  provider_id TEXT,
  event_type TEXT NOT NULL,
  event_data_json TEXT NOT NULL DEFAULT '{}',
  ts INTEGER NOT NULL
);

CREATE INDEX idx_fe_slave ON fleet_event(slave_id, ts DESC);
CREATE INDEX idx_fe_provider ON fleet_event(provider_id, ts DESC);

CREATE TABLE IF NOT EXISTS provider_health (
  id TEXT NOT NULL PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES provider_definition(id) ON DELETE CASCADE,
  overall_status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (overall_status IN ('healthy','degraded','unhealthy','unknown')),
  overall_score REAL NOT NULL DEFAULT 0,
  signals_json TEXT NOT NULL DEFAULT '{}',
  parser_confidence_avg REAL,
  selector_hit_rate_avg REAL,
  fleet_running INTEGER DEFAULT 0,
  fleet_stopped INTEGER DEFAULT 0,
  fleet_error INTEGER DEFAULT 0,
  circuit_open INTEGER DEFAULT 0,
  drift_recent INTEGER DEFAULT 0,
  drift_unresolved INTEGER DEFAULT 0,
  last_check_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(provider_id)
);

CREATE TABLE IF NOT EXISTS automation_schedule (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('cron','interval','event')),
  schedule_value TEXT NOT NULL,
  action TEXT NOT NULL,
  action_config_json TEXT NOT NULL DEFAULT '{}',
  is_active INTEGER NOT NULL DEFAULT 1,
  last_run_at INTEGER,
  next_run_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS automation_run (
  id TEXT NOT NULL PRIMARY KEY,
  schedule_id TEXT NOT NULL REFERENCES automation_schedule(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('running','completed','failed')),
  result_json TEXT,
  error TEXT,
  started_at INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE INDEX idx_ar_schedule ON automation_run(schedule_id, started_at DESC);

CREATE TABLE IF NOT EXISTS alert_condition (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  provider_id TEXT REFERENCES provider_definition(id) ON DELETE CASCADE,
  metric TEXT NOT NULL,
  operator TEXT NOT NULL,
  threshold REAL NOT NULL,
  window_s INTEGER NOT NULL DEFAULT 300,
  cooldown_s INTEGER NOT NULL DEFAULT 600,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS alert_event (
  id TEXT NOT NULL PRIMARY KEY,
  condition_id TEXT NOT NULL REFERENCES alert_condition(id) ON DELETE CASCADE,
  provider_id TEXT,
  metric_value REAL,
  threshold REAL,
  fired_at INTEGER NOT NULL,
  acknowledged INTEGER NOT NULL DEFAULT 0,
  acknowledged_at INTEGER,
  acknowledged_by TEXT
);

CREATE INDEX idx_ae_condition ON alert_event(condition_id, fired_at DESC);

-- ============================================================================
-- L12: Transfer & Learning
-- ============================================================================

CREATE TABLE IF NOT EXISTS route_spec (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  provider_id TEXT NOT NULL REFERENCES provider_definition(id) ON DELETE CASCADE,
  capability_id TEXT NOT NULL REFERENCES capability_taxonomy(id) ON DELETE CASCADE,
  is_active INTEGER NOT NULL DEFAULT 1,
  config_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS route_request (
  id TEXT NOT NULL PRIMARY KEY,
  route_spec_id TEXT NOT NULL REFERENCES route_spec(id) ON DELETE CASCADE,
  conversation_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  result_json TEXT,
  ts INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS route_target (
  id TEXT NOT NULL PRIMARY KEY,
  route_spec_id TEXT NOT NULL REFERENCES route_spec(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  account_id TEXT,
  priority INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS route_event (
  id TEXT NOT NULL PRIMARY KEY,
  route_request_id TEXT NOT NULL REFERENCES route_request(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data_json TEXT NOT NULL DEFAULT '{}',
  ts INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS transfer_pattern (
  id TEXT NOT NULL PRIMARY KEY,
  from_provider_id TEXT NOT NULL REFERENCES provider_definition(id) ON DELETE CASCADE,
  to_provider_id TEXT NOT NULL REFERENCES provider_definition(id) ON DELETE CASCADE,
  capability_id TEXT NOT NULL REFERENCES capability_taxonomy(id) ON DELETE CASCADE,
  confidence REAL NOT NULL DEFAULT 0.0,
  last_transferred_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS transfer_candidate (
  id TEXT NOT NULL PRIMARY KEY,
  transfer_pattern_id TEXT NOT NULL REFERENCES transfer_pattern(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS transfer_attempt (
  id TEXT NOT NULL PRIMARY KEY,
  transfer_candidate_id TEXT NOT NULL REFERENCES transfer_candidate(id) ON DELETE CASCADE,
  ok INTEGER NOT NULL DEFAULT 0,
  result_json TEXT,
  error TEXT,
  duration_ms INTEGER,
  ts INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS learning_event (
  id TEXT NOT NULL PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES provider_definition(id) ON DELETE CASCADE,
  capability_id TEXT NOT NULL REFERENCES capability_taxonomy(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}',
  ts INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rule (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  condition_json TEXT NOT NULL DEFAULT '{}',
  action_json TEXT NOT NULL DEFAULT '{}',
  is_active INTEGER NOT NULL DEFAULT 1,
  confidence REAL NOT NULL DEFAULT 0.0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS binding_event (
  id TEXT NOT NULL PRIMARY KEY,
  binding_id TEXT NOT NULL REFERENCES capability_binding(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}',
  ts INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS failure_classification (
  id TEXT NOT NULL PRIMARY KEY,
  outcome_id TEXT NOT NULL REFERENCES outcome(id) ON DELETE CASCADE,
  failure_type TEXT NOT NULL,
  is_recoverable INTEGER NOT NULL DEFAULT 0,
  suggested_action TEXT,
  ts INTEGER NOT NULL
);

-- ============================================================================
-- L13: Testing
-- ============================================================================

CREATE TABLE IF NOT EXISTS test_run (
  id TEXT NOT NULL PRIMARY KEY,
  capability_id TEXT,
  binding_id TEXT,
  provider_id TEXT,
  test_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  result_json TEXT,
  started_at INTEGER NOT NULL,
  completed_at INTEGER
);

-- ============================================================================
-- Views
-- ============================================================================

CREATE VIEW IF NOT EXISTS v_coverage_by_provider AS
SELECT
  pd.id AS provider_id,
  pd.slug,
  pd.display_name,
  COUNT(DISTINCT cb.global_id) AS bound_capabilities,
  COUNT(DISTINCT CASE WHEN cb.status IN ('stable','test-2') THEN cb.global_id END) AS stable_capabilities,
  COUNT(DISTINCT pc.global_capability_id) AS configured_capabilities
FROM provider_definition pd
LEFT JOIN capability_binding cb ON cb.provider_id = pd.id
LEFT JOIN provider_capability pc ON pc.provider_id = pd.id
GROUP BY pd.id;

CREATE VIEW IF NOT EXISTS v_failure_distribution AS
SELECT
  o.capability_id,
  ct.name AS capability_name,
  o.provider_id,
  pd.slug AS provider_slug,
  o.error,
  COUNT(*) AS failure_count,
  MIN(o.ts) AS first_failure,
  MAX(o.ts) AS last_failure
FROM outcome o
JOIN capability_taxonomy ct ON ct.id = o.capability_id
JOIN provider_definition pd ON pd.id = o.provider_id
WHERE o.ok = 0
GROUP BY o.capability_id, o.provider_id, o.error
ORDER BY failure_count DESC;

CREATE VIEW IF NOT EXISTS v_recent_outcomes AS
SELECT
  o.*,
  ct.name AS capability_name,
  pd.slug AS provider_slug
FROM outcome o
JOIN capability_taxonomy ct ON ct.id = o.capability_id
JOIN provider_definition pd ON pd.id = o.provider_id
WHERE o.ts > (unixepoch() - 86400)
ORDER BY o.ts DESC;

CREATE VIEW IF NOT EXISTS v_strategy_success AS
SELECT
  ss.id AS strategy_id,
  ss.name AS strategy_name,
  ss.capability_id,
  ct.name AS capability_name,
  ss.provider_id,
  ss.hit_count,
  ss.miss_count,
  CASE WHEN (ss.hit_count + ss.miss_count) > 0
    THEN ROUND(CAST(ss.hit_count AS REAL) / (ss.hit_count + ss.miss_count) * 100, 2)
    ELSE NULL
  END AS hit_rate_pct
FROM selector_strategy ss
JOIN capability_taxonomy ct ON ct.id = ss.capability_id;

CREATE VIEW IF NOT EXISTS v_catalog_summary AS
SELECT
  ct.category,
  COUNT(*) AS total_capabilities,
  COUNT(DISTINCT cb.provider_id) AS provider_count,
  COUNT(DISTINCT CASE WHEN cb.status = 'stable' THEN cb.global_id END) AS stable_count
FROM capability_taxonomy ct
LEFT JOIN capability_binding cb ON cb.global_id = ct.id
GROUP BY ct.category;

CREATE VIEW IF NOT EXISTS v_outcome_stream_metrics AS
SELECT
  o.provider_id,
  pd.slug AS provider_slug,
  strftime('%Y-%m-%d %H:00:00', o.ts / 1000, 'unixepoch') AS hour_bucket,
  COUNT(*) AS total,
  SUM(CASE WHEN o.ok = 1 THEN 1 ELSE 0 END) AS ok_count,
  SUM(CASE WHEN o.ok = 0 THEN 1 ELSE 0 END) AS fail_count,
  ROUND(AVG(o.duration_ms), 1) AS avg_duration_ms
FROM outcome o
JOIN provider_definition pd ON pd.id = o.provider_id
WHERE o.ts > (unixepoch() - 604800000)
GROUP BY o.provider_id, hour_bucket
ORDER BY o.provider_id, hour_bucket DESC;

CREATE VIEW IF NOT EXISTS v_provider_surface AS
SELECT
  pd.id AS provider_id,
  pd.slug,
  pd.display_name,
  COUNT(DISTINCT pe.id) AS endpoints,
  COUNT(DISTINCT pp.id) AS parsers,
  COUNT(DISTINCT pm.id) AS models,
  COUNT(DISTINCT pc.id) AS capabilities,
  COUNT(DISTINCT pa.id) AS accounts,
  COUNT(DISTINCT CASE WHEN pa.login_state = 'logged_in' THEN pa.id END) AS logged_in_accounts,
  ph.overall_status AS health_status,
  ph.overall_score AS health_score
FROM provider_definition pd
LEFT JOIN provider_endpoint pe ON pe.provider_id = pd.id
LEFT JOIN provider_parser pp ON pp.provider_id = pd.id AND pp.is_active = 1
LEFT JOIN provider_model pm ON pm.provider_id = pd.id AND pm.is_active = 1
LEFT JOIN provider_capability pc ON pc.provider_id = pd.id
LEFT JOIN provider_account pa ON pa.provider_id = pd.id
LEFT JOIN provider_health ph ON ph.provider_id = pd.id
GROUP BY pd.id;

CREATE VIEW IF NOT EXISTS v_parser_confidence AS
SELECT
  pp.provider_id,
  pd.slug AS provider_slug,
  pp.parser_name,
  pp.parser_version,
  pc.confidence AS avg_confidence,
  pc.consecutive_failures,
  pc.last_used_at
FROM provider_parser pp
JOIN provider_definition pd ON pd.id = pp.provider_id
JOIN provider_capability pc ON pc.provider_id = pd.id
WHERE pp.is_active = 1;

CREATE VIEW IF NOT EXISTS v_capability_ui_audit AS
SELECT
  ct.id,
  ct.name,
  ct.slug,
  ct.category,
  ct.ui_component,
  ct.ui_position,
  ct.ui_group,
  ct.ui_order,
  ct.ui_priority,
  ct.interaction_mode,
  ct.min_plan_tier,
  ct.op_classification,
  ct.requires_user_confirmation,
  ct.concurrency_safe,
  COUNT(DISTINCT cb.provider_id) AS bound_to_providers,
  COUNT(DISTINCT CASE WHEN cb.status = 'stable' THEN cb.provider_id END) AS stable_providers,
  COUNT(DISTINCT ctr.plan_tier) AS tier_overrides,
  COUNT(DISTINCT pc.provider_id) AS provider_overrides
FROM capability_taxonomy ct
LEFT JOIN capability_binding cb ON cb.global_id = ct.id
LEFT JOIN capability_tier ctr ON ctr.capability_id = ct.id
LEFT JOIN provider_capability pc ON pc.global_capability_id = ct.id
GROUP BY ct.id
ORDER BY ct.ui_position, ct.ui_group, ct.ui_order;

-- ============================================================================
-- Seed Data
-- ============================================================================

INSERT OR IGNORE INTO schema_meta (key, value) VALUES
  ('schema_version', '1'),
  ('migration_id', '001_baseline'),
  ('created_at', strftime('%s', 'now')),
  ('table_count', '54'),
  ('view_count', '9');

-- ============================================================================
-- End of baseline schema
-- ============================================================================
```

---

## Table Count Summary

| Layer | Tables | New? |
|-------|--------|------|
| L0: Bookkeeping | 2 | No |
| L1: Provider KG | 7 | No |
| L2: Trace | 1 | YES |
| L3: Capability System | 6 | No (columns added) |
| L4: State & Session | 8 | No |
| L5: Registration Lifecycle | 3 | YES |
| L6: Versioning Lifecycle | 3 | YES |
| L7: Telemetry Lifecycle | 6 | YES |
| L8: Config | 2 | YES |
| L9: Harness | 2 | YES |
| L10: MCP | 1 | YES (design slot) |
| L11: Operations | 9 | No |
| L12: Transfer & Learning | 8 | No |
| L13: Testing | 1 | No |
| **Total** | **~54** | **18 new** |

Views: 9 (v_coverage_by_provider, v_failure_distribution, v_recent_outcomes, v_strategy_success, v_catalog_summary, v_outcome_stream_metrics, v_provider_surface, v_parser_confidence, v_capability_ui_audit)

---

## Tables Deleted (22 removed)

| Table | Reason |
|-------|--------|
| `provider` | Duplicate of `provider_definition` |
| `provider_config_legacy` | Duplicate of `provider_config` |
| `capability` | Duplicate of `provider_capability` |
| `endpoint` | Duplicate of `provider_endpoint` |
| `provider_health` (duplicate at line 995) | Duplicate — kept the one at line 655 |
| `hole` | No engine reads it |
| `pattern` | No engine reads it |
| `confidence_snapshot` | No engine reads it |
| `confidence_by_strategy` | No engine reads it |
| `discovery_objective` | No engine reads it |
| `provider_selector` | Replaced by `selector_strategy` |
| `provider_artifact` | No usage specified |
| `fleet_slave` | Legacy — replaced by Governor |
| `chrome_profile` | Legacy — profiles managed by Governor.LifecycleManager |
| `route_binding` | Legacy — replaced by route_spec/route_target |
| `discovered_account` | Legacy — accounts stored in provider_account |
| `v_selector_health` | View referencing deleted `provider_selector` |
| `v_route_coverage` | View referencing deleted tables |
| `v_provider_config_coverage` | View referencing deleted tables |
| `v_confidence_trend` | View referencing deleted tables |
| `v_discovery_gap` | View referencing deleted tables |
| `v_endpoint_health` | View referencing deleted `endpoint` table |

---

## New Columns on `capability_taxonomy` (vCode patterns)

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `concurrency_safe` | INTEGER | 0 | Can this capability run in parallel with others? |
| `op_classification` | TEXT | NULL | read/write/destructive/navigate/search |
| `requires_user_confirmation` | INTEGER | 0 | Must user approve before execution? |
| `max_result_size` | INTEGER | 100000 | Threshold for result persistence to disk |
| `result_component` | TEXT | 'text_block' | Frontend component for rendering results |
| `result_layout` | TEXT | 'inline' | inline/overlay/sidebar/modal |
| `search_hints_json` | TEXT | '[]' | Keywords for capability search |
| `aliases_json` | TEXT | '[]' | Alternative capability slugs |
| `availability_json` | TEXT | '{}' | Richer gating: requires_login, requires_chrome, requires_provider |
| `prefetch` | INTEGER | 0 | Should Governor prefetch this capability? |

---

## See also

- `04-merged-engines.md` — Engines that read/write these tables
- `06-merged-seeds.md` — Seed data for provider manifests, parsers, harness modules
