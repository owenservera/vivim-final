-- ============================================================================
-- vivim-final v1 Knowledge Graph Rebuild — Baseline Schema
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
  recovery_strategies_json TEXT NOT NULL DEFAULT '[]',
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
  confidence REAL NOT NULL DEFAULT 1.0,
  success_count INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  avg_latency_ms REAL DEFAULT 0,
  p95_latency_ms REAL DEFAULT 0,
  last_used_at INTEGER,
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
  plan_tier TEXT NOT NULL DEFAULT 'free' CHECK (plan_tier IN ('free','pro','max','enterprise')),
  is_default INTEGER NOT NULL DEFAULT 0,
  is_kind INTEGER NOT NULL DEFAULT 0,
  login_state TEXT NOT NULL DEFAULT 'unknown' CHECK (login_state IN ('unknown','logged_out','logging_in','logged_in','login_failed','rate_limited','captcha_required')),
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
-- L2: Trace
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
CREATE INDEX idx_te_engine_ok ON trace_entry(engine, ok, ts DESC);

-- ============================================================================
-- L3: Universal Capability System
-- ============================================================================

CREATE TABLE IF NOT EXISTS capability_taxonomy (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  description TEXT,
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
  min_plan_tier TEXT NOT NULL DEFAULT 'free' CHECK (min_plan_tier IN ('free','pro','max','enterprise')),
  depends_on_json TEXT DEFAULT '[]',
  concurrency_safe INTEGER NOT NULL DEFAULT 0,
  op_classification TEXT CHECK (op_classification IN ('read','write','destructive','navigate','search')),
  requires_user_confirmation INTEGER NOT NULL DEFAULT 0,
  max_result_size INTEGER NOT NULL DEFAULT 100000,
  result_component TEXT NOT NULL DEFAULT 'text_block',
  result_layout TEXT NOT NULL DEFAULT 'inline',
  search_hints_json TEXT NOT NULL DEFAULT '[]',
  aliases_json TEXT NOT NULL DEFAULT '[]',
  availability_json TEXT NOT NULL DEFAULT '{}',
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
  status TEXT NOT NULL DEFAULT 'prospect' CHECK (status IN ('broken','flaky','prospect','retired','stable','test-1','test-2')),
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
CREATE INDEX idx_o_provider_cap_ok ON outcome(provider_id, capability_id, ok, ts DESC);

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
  provider_id TEXT NOT NULL REFERENCES provider_definition(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES provider_account(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'idle',
  context_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
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
CREATE INDEX idx_cm_role ON conversation_message(role, created_at DESC);

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
  block_kind TEXT NOT NULL CHECK (block_kind IN ('text','thinking','code','artifact','image','citation','tool_use','error','meta')),
  block_data TEXT NOT NULL,
  block_meta TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  UNIQUE(conversation_id, message_id, block_index)
);

CREATE INDEX idx_sb_conv ON stream_block(conversation_id, message_id, block_index);
CREATE INDEX idx_sb_message ON stream_block(message_id);
CREATE INDEX idx_sb_kind ON stream_block(conversation_id, block_kind);
CREATE INDEX idx_sb_created ON stream_block(created_at);

-- ============================================================================
-- L5: Registration Lifecycle
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
  event_type TEXT NOT NULL CHECK (event_type IN ('created','updated','deleted','field_changed','table_written','rollback')),
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
CREATE INDEX idx_re_provider_type ON registration_event(provider_id, event_type, ts DESC);

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
-- L6: Versioning Lifecycle
-- ============================================================================

CREATE TABLE IF NOT EXISTS capability_taxonomy_version (
  id TEXT NOT NULL PRIMARY KEY,
  capability_id TEXT NOT NULL REFERENCES capability_taxonomy(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  change_summary TEXT,
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
  trigger TEXT NOT NULL CHECK (trigger IN ('auto','manual','admin','health_degrade','health_upgrade','test_result','program_compare')),
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
CREATE INDEX idx_pvm_last ON program_version_metric(last_executed_at DESC);

-- ============================================================================
-- L7: Telemetry
-- ============================================================================

CREATE TABLE IF NOT EXISTS health_history (
  id TEXT NOT NULL PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES provider_definition(id) ON DELETE CASCADE,
  overall_status TEXT NOT NULL,
  overall_score REAL NOT NULL,
  signals_json TEXT NOT NULL DEFAULT '{}',
  ts INTEGER NOT NULL
);

CREATE INDEX idx_hh_provider ON health_history(provider_id, ts DESC);

CREATE TABLE IF NOT EXISTS daily_summary (
  id TEXT NOT NULL PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES provider_definition(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  total_conversations INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  total_capabilities INTEGER DEFAULT 0,
  avg_latency_ms REAL DEFAULT 0,
  error_rate REAL DEFAULT 0,
  summary_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  UNIQUE(provider_id, date)
);

CREATE TABLE IF NOT EXISTS selector_health (
  id TEXT NOT NULL PRIMARY KEY,
  selector_id TEXT NOT NULL,
  hit_count INTEGER DEFAULT 0,
  miss_count INTEGER DEFAULT 0,
  hit_rate REAL DEFAULT 0,
  ts INTEGER NOT NULL
);

CREATE INDEX idx_sh_selector ON selector_health(selector_id, ts DESC);

-- ============================================================================
-- L8: Config
-- ============================================================================

CREATE TABLE IF NOT EXISTS config_entry (
  id TEXT NOT NULL PRIMARY KEY,
  engine_id TEXT NOT NULL,
  config_key TEXT NOT NULL,
  config_value TEXT NOT NULL,
  config_type TEXT NOT NULL DEFAULT 'string',
  is_runtime INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(engine_id, config_key)
);

CREATE INDEX idx_ce_engine ON config_entry(engine_id);

CREATE TABLE IF NOT EXISTS config_audit (
  id TEXT NOT NULL PRIMARY KEY,
  engine_id TEXT NOT NULL,
  config_key TEXT,
  from_value TEXT,
  to_value TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'system',
  ts INTEGER NOT NULL
);

CREATE INDEX idx_ca_engine ON config_audit(engine_id, ts DESC);

-- ============================================================================
-- Views
-- ============================================================================

CREATE VIEW IF NOT EXISTS v_provider_health AS
SELECT
  pd.id AS provider_id,
  pd.slug,
  pd.display_name,
  hh.overall_status,
  hh.overall_score,
  hh.ts,
  ROW_NUMBER() OVER (PARTITION BY pd.id ORDER BY hh.ts DESC) AS rn
FROM provider_definition pd
LEFT JOIN health_history hh ON hh.provider_id = pd.id;

CREATE VIEW IF NOT EXISTS v_capability_summary AS
SELECT
  ct.id,
  ct.slug,
  ct.name,
  ct.category,
  COUNT(DISTINCT cb.provider_id) AS provider_count,
  COUNT(DISTINCT CASE WHEN cb.status = 'stable' THEN cb.provider_id END) AS stable_provider_count
FROM capability_taxonomy ct
LEFT JOIN capability_binding cb ON cb.global_id = ct.id
GROUP BY ct.id;

CREATE VIEW IF NOT EXISTS v_conversation_summary AS
SELECT
  c.id,
  c.provider_id,
  c.title,
  c.state,
  c.message_count,
  c.last_message_at,
  COUNT(cm.id) AS actual_message_count
FROM conversation c
LEFT JOIN conversation_message cm ON cm.conversation_id = c.id
GROUP BY c.id;

CREATE VIEW IF NOT EXISTS v_daily_usage AS
SELECT
  date(ts / 1000, 'unixepoch') AS day,
  provider_id,
  COUNT(*) AS total_executions,
  SUM(CASE WHEN ok = 1 THEN 1 ELSE 0 END) AS successes,
  SUM(CASE WHEN ok = 0 THEN 1 ELSE 0 END) AS failures,
  AVG(duration_ms) AS avg_latency
FROM outcome
GROUP BY day, provider_id;
