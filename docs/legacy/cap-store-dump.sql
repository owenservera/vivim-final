-- ─────────────────────────────────────────────────────────────────
-- SQL Dump: capability-store.db
-- Source: C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\cap-store\data\capability-store.db
-- Generated: 2026-07-19T00:47:34.758Z
-- ─────────────────────────────────────────────────────────────────

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ── Schema: Tables ────────────────────────────────────────────────────

CREATE TABLE alert_condition (
  id TEXT PRIMARY KEY,                    -- 'ac:<ulid>'
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  provider_id TEXT,                       -- nullable: null = global
  metric TEXT NOT NULL,                   -- 'failure_rate' | 'latency_p95' | 'confidence_drop' | 'circuit_breaker_open'
  operator TEXT NOT NULL,                 -- '>' | '>=' | '<' | '<=' | '==' | '!='
  threshold REAL NOT NULL,
  window_ms INTEGER NOT NULL DEFAULT 300000,  -- 5min sliding window
  severity TEXT NOT NULL DEFAULT 'medium',  -- 'low' | 'medium' | 'high' | 'critical'
  enabled INTEGER NOT NULL DEFAULT 1,
  cooldown_ms INTEGER NOT NULL DEFAULT 600000,  -- 10min cooldown between firings
  webhook_url TEXT,                       -- nullable: null = no webhook
  last_fired_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE alert_event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  condition_id TEXT NOT NULL,             -- ref → alert_condition
  provider_id TEXT,
  severity TEXT NOT NULL,
  metric_value REAL NOT NULL,
  threshold REAL NOT NULL,
  message TEXT NOT NULL,
  webhook_delivered INTEGER NOT NULL DEFAULT 0,
  webhook_response_code INTEGER,
  created_at INTEGER NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE automation_run (
  id TEXT PRIMARY KEY,                    -- 'ar:<ulid>'
  schedule_id TEXT NOT NULL,              -- ref → automation_schedule
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  status TEXT NOT NULL DEFAULT 'running',  -- 'running' | 'completed' | 'error'
  error TEXT,
  summary TEXT,                           -- JSON: { bindingsChecked: 5, healingsTriggered: 2, ... }
  schema_version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE automation_schedule (
  id TEXT PRIMARY KEY,                    -- 'as:<ulid>'
  name TEXT NOT NULL,                      -- 'healing' | 'monitoring' | 'adaptation' | 'discovery'
  enabled INTEGER NOT NULL DEFAULT 1,
  interval_ms INTEGER NOT NULL,           -- e.g. 1800000 (30min), 3600000 (1hr), 43200000 (12hr)
  last_run_at INTEGER,
  next_run_at INTEGER,
  last_status TEXT DEFAULT 'idle',        -- 'idle' | 'running' | 'completed' | 'error'
  last_error TEXT,
  config TEXT NOT NULL DEFAULT '{}',      -- JSON: loop-specific config
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE binding_event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  binding_id TEXT NOT NULL,
  kind TEXT NOT NULL,                       -- 'status_change' | 'promotion' | 'demotion' | 'strategy_added' | 'strategy_removed' | 'rollback' | 'program_change' | 'transfer'
  from_state TEXT,
  to_state TEXT,
  reason TEXT NOT NULL,
  actor TEXT,
  metadata TEXT,                            -- JSON
  schema_version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE capability_binding (
  id TEXT PRIMARY KEY,                              -- 'b:<provider>:<slug>'
  provider_id TEXT NOT NULL,
  global_id TEXT NOT NULL,                          -- ref → capability_taxonomy.id
  status TEXT NOT NULL CHECK (status IN
    ('prospect','test-1','test-2','stable','flaky','broken','retired')),
  confidence REAL NOT NULL DEFAULT 0,
  oks INTEGER NOT NULL DEFAULT 0,
  fails INTEGER NOT NULL DEFAULT 0,
  last_ok_ms INTEGER,
  replay_verified INTEGER NOT NULL DEFAULT 0,
  intended_matched INTEGER,                        -- 0/1/NULL
  pattern_hits INTEGER NOT NULL DEFAULT 0,
  best_program_id TEXT,                            -- nullable, ref → capability_program.id
  transfer_origin TEXT,                            -- JSON or NULL
  promotion_history TEXT NOT NULL DEFAULT '[]',    -- JSON
  schema_version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  provenance TEXT NOT NULL,
  UNIQUE(provider_id, global_id),
  FOREIGN KEY (global_id) REFERENCES capability_taxonomy(id)
);

CREATE TABLE capability_program (
  id TEXT PRIMARY KEY,                              -- 'p:<uuid>'
  binding_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  steps TEXT NOT NULL,                              -- JSON: ActionStep[]
  when_clauses TEXT NOT NULL DEFAULT '[]',          -- JSON: Condition[] (column renamed to avoid SQL keyword)
  verify_clauses TEXT NOT NULL DEFAULT '[]',        -- JSON: Condition[]
  superseded_by TEXT,                               -- ref → capability_program.id, nullable
  retired_at INTEGER,
  schema_version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  provenance TEXT NOT NULL,
  UNIQUE(binding_id, version),
  FOREIGN KEY (binding_id) REFERENCES capability_binding(id)
);

CREATE TABLE capability_taxonomy (
  id TEXT PRIMARY KEY,                              -- 't:global:<slug>'
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  required_affordances TEXT NOT NULL DEFAULT '[]', -- JSON
  common_gotchas TEXT NOT NULL DEFAULT '[]',       -- JSON
  version INTEGER NOT NULL DEFAULT 1,
  schema_version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  provenance TEXT NOT NULL                         -- JSON
);

CREATE TABLE chrome_profile (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  user_data_dir TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0,
  last_used INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE circuit_breaker_state (
  provider_id TEXT PRIMARY KEY,
  state TEXT NOT NULL,                 -- 'closed' | 'open' | 'half-open'
  failures INTEGER NOT NULL DEFAULT 0,
  opened_at INTEGER,
  cooldown_until INTEGER,
  last_failure_ms INTEGER,
  updated_at INTEGER NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE confidence_by_strategy (
  binding_id TEXT NOT NULL,
  strategy_type TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0,
  windowed_oks INTEGER NOT NULL DEFAULT 0,
  windowed_fails INTEGER NOT NULL DEFAULT 0,
  last_computed_at INTEGER NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (binding_id, strategy_type)
);

CREATE TABLE confidence_snapshot (
  binding_id TEXT PRIMARY KEY,
  confidence REAL NOT NULL DEFAULT 0,
  windowed_oks INTEGER NOT NULL DEFAULT 0,
  windowed_fails INTEGER NOT NULL DEFAULT 0,
  window_size INTEGER NOT NULL DEFAULT 30,
  last_computed_at INTEGER NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE conversation (
  id TEXT PRIMARY KEY,
  vivim_session_id TEXT NOT NULL,
  provider_session_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  turn_count INTEGER NOT NULL DEFAULT 0,
  last_turn_at INTEGER,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (vivim_session_id) REFERENCES vivim_session(id),
  FOREIGN KEY (provider_session_id) REFERENCES provider_session(id)
);

CREATE TABLE discovered_account (
  id              TEXT PRIMARY KEY,
  chrome_profile_id   TEXT NOT NULL,
  chrome_profile_email TEXT NOT NULL,
  chrome_profile_dir  TEXT NOT NULL,
  chrome_profile_display_name TEXT,
  provider_id     TEXT NOT NULL,
  login_state     TEXT NOT NULL DEFAULT 'logged_in',   -- logged_in | logged_out
  last_scanned    INTEGER NOT NULL,
  created_at      INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000), last_login_at INTEGER,
  UNIQUE (chrome_profile_id, provider_id)
);

CREATE TABLE discovery_objective (
  id TEXT PRIMARY KEY,                    -- 'do:<ulid>'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,    -- higher = more important
  status TEXT NOT NULL DEFAULT 'open',    -- 'open' | 'in-progress' | 'completed' | 'abandoned'
  provider_id TEXT,                       -- nullable: null = global
  binding_id TEXT,                        -- nullable
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER,
  schema_version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE drift_event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  binding_id TEXT NOT NULL,
  drift_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'low',
  old_value REAL,
  new_value REAL,
  threshold REAL,
  resolved INTEGER NOT NULL DEFAULT 0,
  resolved_at INTEGER,
  schema_version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE endpoint (
  id TEXT PRIMARY KEY,                              -- 'e:<uuid>'
  provider_id TEXT NOT NULL,
  url_pattern TEXT NOT NULL,
  transport TEXT NOT NULL CHECK (transport IN ('sse','batchexecute')),
  terminal_marker TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0,
  verified_at INTEGER,
  binding_ids TEXT NOT NULL DEFAULT '[]',           -- JSON
  schema_version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
, last_stream_status_code INTEGER, last_stream_status_ms INTEGER, content_type TEXT);

CREATE TABLE failure_classification (
  id TEXT PRIMARY KEY,
  outcome_id TEXT NOT NULL,
  failure_type TEXT NOT NULL,               -- 'selector_not_found' | 'element_changed' | 'dom_restructured' | 'timing_issue' | 'wrong_capability' | 'unknown'
  confidence REAL NOT NULL,
  signals TEXT NOT NULL,                    -- JSON array
  suggested_strategies TEXT NOT NULL,      -- JSON array
  healing_priority REAL NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE fleet_event (
  id TEXT PRIMARY KEY,
  event TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);

CREATE TABLE fleet_slave (
  id TEXT PRIMARY KEY,
  chrome_profile_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'stopped',
  pid INTEGER,
  cdp_port INTEGER,
  started_at INTEGER,
  last_heartbeat INTEGER,
  error_message TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (chrome_profile_id) REFERENCES chrome_profile(id)
);

CREATE TABLE hole (
  id TEXT PRIMARY KEY,                              -- 'h:<uuid>'
  provider_id TEXT NOT NULL,
  role TEXT NOT NULL,
  name TEXT,
  layer_index INTEGER NOT NULL DEFAULT 0,
  classified_as TEXT,
  discovered_at INTEGER NOT NULL,
  consumed_by TEXT NOT NULL DEFAULT '[]',           -- JSON: binding_id[]
  schema_version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
, fingerprint TEXT);

CREATE TABLE learning_event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  kind TEXT NOT NULL,                       -- 'create' | 'transition' | 'verify' | 'revert' | 'reject'
  learning_id TEXT NOT NULL,
  learning_type TEXT NOT NULL,              -- 'config-tune' | 'provider-override' | 'behavioral-rule' | 'recipe-fix' | 'code-proposal'
  status TEXT NOT NULL,                     -- 'proposed' | 'applied' | 'verified' | 'regressed' | 'reverted' | 'rejected'
  payload TEXT NOT NULL,                    -- JSON
  applied_diff TEXT,                        -- JSON array
  evidence TEXT,                            -- JSON array
  rationale TEXT NOT NULL,
  source TEXT NOT NULL,                     -- 'agent' | 'report-candidate' | 'operator'
  actor TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE migration_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,         -- 'taxonomy-globals' | 'actions' | 'outcomes' | 'patterns' | 'capability-map' | 'observations'
  source_path TEXT NOT NULL,
  records_read INTEGER NOT NULL,
  records_written INTEGER NOT NULL,
  records_skipped INTEGER NOT NULL,
  skip_reasons TEXT,            -- JSON array
  ts INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL
);

CREATE TABLE outcome (
  id TEXT PRIMARY KEY,                              -- 'o:<uuid>'
  ts INTEGER NOT NULL,
  binding_id TEXT NOT NULL,
  program_id TEXT,
  ok INTEGER NOT NULL,                              -- 0/1
  duration_ms INTEGER NOT NULL,
  error TEXT,
  observation TEXT,                                 -- JSON
  schema_version INTEGER NOT NULL DEFAULT 1
, strategy_id TEXT, ttft_ms INTEGER, total_ms INTEGER, blocks_json TEXT);

CREATE TABLE pattern (
  id TEXT PRIMARY KEY,                              -- 'pt:<uuid>'
  provider_id TEXT NOT NULL,
  binding_id TEXT,
  failed_selector TEXT NOT NULL,
  ax_name_hint TEXT,
  fix_selector TEXT NOT NULL,
  verified INTEGER NOT NULL DEFAULT 0,
  hit_count INTEGER NOT NULL DEFAULT 0,
  last_hit INTEGER,
  schema_version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
, failure_type TEXT NOT NULL DEFAULT '', miss_count INTEGER NOT NULL DEFAULT 0, last_hit_ms INTEGER, last_miss_ms INTEGER, source TEXT NOT NULL DEFAULT 'auto');

CREATE TABLE profile_session (
  id TEXT PRIMARY KEY,
  vivim_session_id TEXT NOT NULL,
  profile_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  chrome_pid INTEGER,
  debug_port INTEGER,
  user_data_dir TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1, settings TEXT NOT NULL DEFAULT '{}', auth_state TEXT NOT NULL DEFAULT 'unknown', provider_id TEXT, account_id TEXT,
  FOREIGN KEY (vivim_session_id) REFERENCES vivim_session(id)
);

CREATE TABLE provider (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  landing_url TEXT NOT NULL,
  ready_selector TEXT,
  composer_selector TEXT,
  composer_is_contenteditable INTEGER NOT NULL DEFAULT 0,
  stream_url_pattern TEXT,
  stream_transport TEXT,                -- 'sse' | 'batchexecute' | 'http'
  stream_terminal TEXT,
  sse_format TEXT,
  locale TEXT,
  locale_variants TEXT,                  -- JSON
  warmup_ms INTEGER NOT NULL DEFAULT 0,
  headless_settle_ms INTEGER NOT NULL DEFAULT 0,
  rate_limit_per_minute INTEGER,
  tier TEXT NOT NULL DEFAULT 'standard', -- 'premium' | 'standard' | 'economy'
  status TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'cold' | 'auth-required' | 'sunset'
  config TEXT NOT NULL DEFAULT '{}',      -- JSON
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE provider_account (
  id TEXT PRIMARY KEY,
  chrome_profile_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  account_email TEXT NOT NULL,
  display_name TEXT,
  plan_type TEXT DEFAULT 'unknown',
  status TEXT DEFAULT 'unknown',
  last_verified INTEGER,
  total_requests INTEGER NOT NULL DEFAULT 0,
  successful_requests INTEGER NOT NULL DEFAULT 0,
  failed_requests INTEGER NOT NULL DEFAULT 0,
  last_request_at INTEGER,
  avg_latency_ms REAL,
  classification TEXT DEFAULT 'personal',
  tags TEXT DEFAULT '[]',
  created_at INTEGER NOT NULL, is_default INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (chrome_profile_id) REFERENCES chrome_profile(id)
);

CREATE TABLE provider_config (
  provider_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  display_name TEXT NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE provider_health (
  provider_id TEXT PRIMARY KEY,
  runtime_state TEXT NOT NULL DEFAULT 'unconfigured',
  active_sessions INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  last_active_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE provider_health_tick (
  ts INTEGER NOT NULL,
  provider_id TEXT NOT NULL,
  pid_alive INTEGER NOT NULL,           -- boolean
  cdp_connected INTEGER NOT NULL,
  cdp_zombie_count INTEGER NOT NULL,
  last_command_at INTEGER,
  uptime_s INTEGER NOT NULL,
  failures_last_60s INTEGER NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (ts, provider_id)
);

CREATE TABLE provider_session (
  id TEXT PRIMARY KEY,
  vivim_session_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at INTEGER,
  finished_at INTEGER,
  error TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (vivim_session_id) REFERENCES vivim_session(id)
);

CREATE TABLE route_binding (
  id TEXT PRIMARY KEY,
  route_id TEXT NOT NULL,
  chrome_profile_id TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (chrome_profile_id) REFERENCES chrome_profile(id),
  FOREIGN KEY (provider_account_id) REFERENCES provider_account(id)
);

CREATE TABLE route_event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  route_request_id TEXT NOT NULL,             -- ref → route_request
  route_target_id TEXT,                       -- ref → route_target (null for request-level events)
  kind TEXT NOT NULL,                         -- 'created' | 'started' | 'target_started' | 'target_ok' | 'target_error' | 'target_cancelled' | 'completed' | 'cancelled'
  detail TEXT,                                -- JSON: event-specific data
  schema_version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE route_request (
  id TEXT PRIMARY KEY,                        -- 'rr:<ulid>'
  ts INTEGER NOT NULL,
  spec TEXT NOT NULL,                         -- original route spec string (e.g. 'claude+gemini')
  command TEXT NOT NULL,                      -- the verb/command (e.g. 'send-prompt')
  args TEXT NOT NULL DEFAULT '{}',            -- JSON: command arguments
  failure_mode TEXT NOT NULL DEFAULT 'all',   -- 'any' | 'all' | 'first-ready' | 'compare'
  priority TEXT NOT NULL DEFAULT 'normal',    -- 'high' | 'normal' | 'low'
  targets TEXT NOT NULL,                      -- JSON: string[] of resolved provider IDs
  status TEXT NOT NULL DEFAULT 'pending',     -- 'pending' | 'running' | 'completed' | 'cancelled' | 'error'
  started_at INTEGER,
  finished_at INTEGER,
  result_summary TEXT,                        -- JSON: aggregate result
  schema_version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE route_target (
  id TEXT PRIMARY KEY,                        -- 'rt:<ulid>'
  route_request_id TEXT NOT NULL,             -- ref → route_request
  provider_id TEXT NOT NULL,                  -- ref → provider
  binding_id TEXT,                            -- ref → capability_binding (resolved)
  status TEXT NOT NULL DEFAULT 'pending',     -- 'pending' | 'running' | 'ok' | 'error' | 'skipped' | 'cancelled'
  error TEXT,
  started_at INTEGER,
  finished_at INTEGER,
  outcome_id TEXT,                            -- ref → outcome (if execution completed)
  schema_version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE rule (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  rule TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',    -- 'manual' | 'agent' | 'migrated'
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE schema_meta (
        key TEXT NOT NULL, value TEXT NOT NULL, updated_at INTEGER NOT NULL,
        PRIMARY KEY (key, value)
      );

CREATE TABLE selector_strategy (
  id TEXT PRIMARY KEY,
  binding_id TEXT NOT NULL,
  strategy_type TEXT NOT NULL,            -- 'primary' | 'aria-variant' | 'text-based' | 'role-name' | 'structural' | 'css-fallback' | 'positional'
  selector TEXT NOT NULL,
  verified INTEGER NOT NULL DEFAULT 0,
  hit_count INTEGER NOT NULL DEFAULT 0,
  miss_count INTEGER NOT NULL DEFAULT 0,
  total_attempts INTEGER NOT NULL DEFAULT 0,
  success_rate REAL NOT NULL DEFAULT 0,
  avg_duration_ms REAL NOT NULL DEFAULT 0,
  last_attempt_ms INTEGER,
  source TEXT NOT NULL DEFAULT 'manual',  -- 'auto' | 'manual' | 'healed' | 'transfer'
  parent_strategy_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE session_checkpoint (
  id TEXT PRIMARY KEY,
  vivim_session_id TEXT NOT NULL,
  checkpoint_at INTEGER NOT NULL,
  pid INTEGER,
  port INTEGER,
  profile_snapshots TEXT NOT NULL DEFAULT '[]',
  conversation_snapshots TEXT NOT NULL DEFAULT '[]',
  restore_summary TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (vivim_session_id) REFERENCES vivim_session(id)
);

CREATE TABLE state_transition (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  reason TEXT,
  actor TEXT,
  metadata TEXT,
  schema_version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE trace_event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  binding_id TEXT,
  step_id TEXT,
  phase TEXT NOT NULL,                   -- 'when' | 'locate' | 'arm' | 'act' | 'observe' | 'done'
  ok INTEGER NOT NULL,                  -- boolean
  duration_ms INTEGER,
  detail TEXT,                          -- JSON
  schema_version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE transfer_attempt (
  id TEXT PRIMARY KEY,                  -- 'ta:<uuid>'
  candidate_id TEXT NOT NULL,           -- ref → transfer_candidate.id
  ts INTEGER NOT NULL,
  ok INTEGER NOT NULL,                  -- boolean
  duration_ms INTEGER NOT NULL,
  error TEXT,
  attempt_kind TEXT NOT NULL,           -- 'simulated' | 'live' | 'replay'
  schema_version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE transfer_candidate (
  id TEXT PRIMARY KEY,                  -- 'tc:<uuid>'
  pattern_id TEXT NOT NULL,             -- ref → transfer_pattern
  target_provider TEXT NOT NULL,
  candidate_selector TEXT NOT NULL,
  derivation TEXT NOT NULL,             -- 'text-based' | 'structural:<provider>' | 'role-match from <src>' | 'direct'
  confidence REAL NOT NULL,
  generated_at INTEGER NOT NULL,
  applied_at INTEGER,
  result TEXT,                          -- 'pending' | 'applied' | 'rejected' | 'expired'
  rejection_reason TEXT,
  schema_version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE transfer_pattern (
  id TEXT PRIMARY KEY,                  -- 'tp:<uuid>'
  global_id TEXT NOT NULL,              -- ref → capability_taxonomy.id
  source_provider TEXT NOT NULL,
  strategy_type TEXT NOT NULL,
  source_selector TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0,
  hit_count INTEGER NOT NULL DEFAULT 0,
  first_seen_ms INTEGER NOT NULL,
  last_validated_ms INTEGER,
  verified INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE vivim_session (
  id TEXT PRIMARY KEY,
  ts INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'idle',
  provider_ids TEXT NOT NULL DEFAULT '[]',
  current_provider TEXT,
  current_step INTEGER NOT NULL DEFAULT 0,
  total_steps INTEGER NOT NULL DEFAULT 0,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1
);

-- ── Schema: Views ─────────────────────────────────────────────────────

CREATE VIEW v_catalog_summary AS
SELECT
  (SELECT COUNT(*) FROM capability_taxonomy) AS taxonomy_globals,
  (SELECT COUNT(*) FROM capability_binding) AS bindings,
  (SELECT COUNT(*) FROM capability_program) AS programs,
  (SELECT COUNT(*) FROM hole) AS holes,
  (SELECT COUNT(*) FROM endpoint) AS endpoints,
  (SELECT COUNT(*) FROM pattern) AS patterns,
  (SELECT COUNT(*) FROM outcome) AS outcomes,
  (SELECT COUNT(*) FROM provider) AS providers,
  (SELECT COUNT(*) FROM selector_strategy) AS strategies,
  (SELECT COUNT(*) FROM rule) AS rules,
  (SELECT COUNT(*) FROM learning_event) AS learning_events,
  (SELECT COUNT(*) FROM binding_event) AS binding_events,
  (SELECT COUNT(*) FROM failure_classification) AS failure_classifications;

CREATE VIEW v_coverage_by_provider AS
SELECT
  b.provider_id,
  COUNT(*) AS total_bindings,
  SUM(CASE WHEN b.status = 'stable' THEN 1 ELSE 0 END) AS stable,
  SUM(CASE WHEN b.status = 'test-1' THEN 1 ELSE 0 END) AS test_1,
  SUM(CASE WHEN b.status = 'test-2' THEN 1 ELSE 0 END) AS test_2,
  SUM(CASE WHEN b.status = 'flaky' THEN 1 ELSE 0 END) AS flaky,
  SUM(CASE WHEN b.status = 'broken' THEN 1 ELSE 0 END) AS broken,
  SUM(CASE WHEN b.status = 'prospect' THEN 1 ELSE 0 END) AS prospect,
  SUM(CASE WHEN b.status = 'retired' THEN 1 ELSE 0 END) AS retired,
  ROUND(AVG(b.confidence), 3) AS avg_confidence
FROM capability_binding b
GROUP BY b.provider_id;

CREATE VIEW v_failure_distribution AS
SELECT
  o.binding_id,
  b.provider_id,
  COALESCE(fc.failure_type,
    CASE
      WHEN o.ok = 1 THEN 'ok'
      WHEN o.error LIKE '%no-match%' OR o.error LIKE '%element not found%' OR o.error LIKE '%selector%not found%' THEN 'selector_not_found'
      WHEN o.error LIKE '%timeout%' OR o.error LIKE '%timed out%' THEN 'timing_issue'
      WHEN o.error LIKE '%stale%' OR o.error LIKE '%element%detached%' OR o.error LIKE '%element%changed%' THEN 'element_changed'
      WHEN o.error LIKE '%multiple%matches%' OR o.error LIKE '%ambiguous%' THEN 'wrong_capability'
      WHEN o.error LIKE '%page%reloaded%' OR o.error LIKE '%dom%changed%' THEN 'dom_restructured'
      ELSE 'unknown'
    END
  ) AS failure_type,
  o.ts,
  o.duration_ms
FROM outcome o
LEFT JOIN capability_binding b ON b.id = o.binding_id
LEFT JOIN failure_classification fc ON fc.outcome_id = o.id;

CREATE VIEW v_outcome_stream_metrics AS
SELECT
  binding_id,
  COUNT(*) AS total_outcomes,
  SUM(CASE WHEN ok = 1 THEN 1 ELSE 0 END) AS ok_count,
  SUM(CASE WHEN ok = 0 THEN 1 ELSE 0 END) AS fail_count,
  ROUND(AVG(ttft_ms), 1) AS avg_ttft_ms,
  ROUND(AVG(total_ms), 1) AS avg_total_ms,
  ROUND(MIN(ttft_ms), 1) AS min_ttft_ms,
  ROUND(MAX(ttft_ms), 1) AS max_ttft_ms,
  ROUND(AVG(duration_ms), 1) AS avg_step_duration_ms,
  MAX(ts) AS last_outcome_ts
FROM outcome
WHERE ts >= (strftime('%s','now') * 1000) - (7 * 24 * 60 * 60 * 1000)  -- last 7 days
GROUP BY binding_id;

CREATE VIEW v_recent_outcomes AS
SELECT
  o.binding_id,
  o.ok,
  o.ts,
  o.duration_ms,
  o.strategy_id,
  ROW_NUMBER() OVER (PARTITION BY o.binding_id ORDER BY o.ts DESC) AS rn
FROM outcome o;

CREATE VIEW v_strategy_success AS
SELECT
  s.binding_id,
  s.id AS strategy_id,
  s.strategy_type,
  s.selector,
  s.total_attempts,
  s.success_rate,
  s.avg_duration_ms,
  s.last_attempt_ms,
  s.source
FROM selector_strategy s;

-- ── Schema: Indexes ───────────────────────────────────────────────────

CREATE INDEX idx_alert_condition_enabled ON alert_condition(enabled);

CREATE INDEX idx_alert_condition_provider ON alert_condition(provider_id);

CREATE INDEX idx_alert_event_condition ON alert_event(condition_id);

CREATE INDEX idx_alert_event_severity ON alert_event(severity);

CREATE INDEX idx_alert_event_ts ON alert_event(ts);

CREATE INDEX idx_automation_run_schedule ON automation_run(schedule_id);

CREATE INDEX idx_automation_run_status ON automation_run(status);

CREATE INDEX idx_automation_schedule_enabled ON automation_schedule(enabled);

CREATE INDEX idx_automation_schedule_name ON automation_schedule(name);

CREATE INDEX idx_binding_event_binding ON binding_event(binding_id);

CREATE INDEX idx_binding_event_ts ON binding_event(ts);

CREATE INDEX idx_binding_global ON capability_binding(global_id);

CREATE INDEX idx_binding_provider ON capability_binding(provider_id);

CREATE INDEX idx_binding_status ON capability_binding(status);

CREATE INDEX idx_checkpoint_vivim_session ON session_checkpoint(vivim_session_id);

CREATE INDEX idx_chrome_profile_email ON chrome_profile(email);

CREATE INDEX idx_conversation_provider_session_id ON conversation(provider_session_id);

CREATE INDEX idx_conversation_vivim_session_id ON conversation(vivim_session_id);

CREATE INDEX idx_discovered_account_profile ON discovered_account (chrome_profile_id);

CREATE INDEX idx_discovered_account_provider ON discovered_account (provider_id);

CREATE INDEX idx_discovery_objective_priority ON discovery_objective(priority DESC);

CREATE INDEX idx_discovery_objective_provider ON discovery_objective(provider_id);

CREATE INDEX idx_discovery_objective_status ON discovery_objective(status);

CREATE INDEX idx_drift_event_binding ON drift_event(binding_id);

CREATE INDEX idx_drift_event_severity ON drift_event(severity);

CREATE INDEX idx_drift_event_ts ON drift_event(ts);

CREATE INDEX idx_endpoint_provider ON endpoint(provider_id);

CREATE INDEX idx_failure_outcome ON failure_classification(outcome_id);

CREATE INDEX idx_failure_type ON failure_classification(failure_type);

CREATE INDEX idx_fleet_event_created ON fleet_event(created_at);

CREATE INDEX idx_fleet_event_event ON fleet_event(event);

CREATE INDEX idx_fleet_slave_profile ON fleet_slave(chrome_profile_id);

CREATE INDEX idx_fleet_slave_status ON fleet_slave(status);

CREATE INDEX idx_health_provider_ts ON provider_health_tick(provider_id, ts);

CREATE INDEX idx_health_ts ON provider_health_tick(ts);

CREATE INDEX idx_hole_fingerprint ON hole(provider_id, fingerprint);

CREATE INDEX idx_hole_provider ON hole(provider_id);

CREATE UNIQUE INDEX idx_hole_provider_fingerprint_uniq
  ON hole(provider_id, fingerprint)
  WHERE fingerprint IS NOT NULL;

CREATE INDEX idx_hole_provider_role ON hole(provider_id, role);

CREATE INDEX idx_learning_id ON learning_event(learning_id);

CREATE INDEX idx_learning_status ON learning_event(status);

CREATE INDEX idx_learning_type ON learning_event(learning_type);

CREATE INDEX idx_outcome_binding_ts ON outcome(binding_id, ts);

CREATE INDEX idx_outcome_ts ON outcome(ts);

CREATE INDEX idx_pattern_binding ON pattern(binding_id);

CREATE INDEX idx_pattern_failure_type ON pattern(failure_type);

CREATE INDEX idx_pattern_provider ON pattern(provider_id);

CREATE INDEX idx_profile_session_hidden ON profile_session(id) WHERE json_extract(settings, '$.hidden') = 1;

CREATE INDEX idx_profile_session_vivim_session_id ON profile_session(vivim_session_id);

CREATE INDEX idx_program_binding ON capability_program(binding_id);

CREATE INDEX idx_provider_account_default ON provider_account(provider_id, is_default);

CREATE INDEX idx_provider_account_profile ON provider_account(chrome_profile_id);

CREATE INDEX idx_provider_account_provider ON provider_account(provider_id);

CREATE INDEX idx_provider_account_status ON provider_account(status);

CREATE INDEX idx_provider_health_runtime_state ON provider_health(runtime_state);

CREATE INDEX idx_provider_session_status ON provider_session(status);

CREATE INDEX idx_provider_session_vivim_session_id ON provider_session(vivim_session_id);

CREATE INDEX idx_provider_status ON provider(status);

CREATE INDEX idx_route_binding_profile ON route_binding(chrome_profile_id);

CREATE INDEX idx_route_binding_route ON route_binding(route_id);

CREATE INDEX idx_route_event_request ON route_event(route_request_id);

CREATE INDEX idx_route_event_ts ON route_event(ts);

CREATE INDEX idx_route_request_status ON route_request(status);

CREATE INDEX idx_route_request_ts ON route_request(ts);

CREATE INDEX idx_route_target_provider ON route_target(provider_id);

CREATE INDEX idx_route_target_request ON route_target(route_request_id);

CREATE INDEX idx_rule_active ON rule(active);

CREATE INDEX idx_rule_scope ON rule(scope);

CREATE INDEX idx_state_transition_entity ON state_transition(entity_type, entity_id);

CREATE INDEX idx_strategy_binding ON selector_strategy(binding_id);

CREATE INDEX idx_strategy_success ON selector_strategy(binding_id, success_rate DESC);

CREATE INDEX idx_taxonomy_category ON capability_taxonomy(category);

CREATE INDEX idx_trace_binding_ts ON trace_event(binding_id, ts);

CREATE INDEX idx_trace_phase ON trace_event(phase);

CREATE INDEX idx_trace_ts ON trace_event(ts);

CREATE INDEX idx_transfer_attempt_candidate ON transfer_attempt(candidate_id);

CREATE INDEX idx_transfer_attempt_ts ON transfer_attempt(ts);

CREATE INDEX idx_transfer_candidate_pattern ON transfer_candidate(pattern_id);

CREATE INDEX idx_transfer_candidate_target ON transfer_candidate(target_provider);

CREATE INDEX idx_transfer_pattern_global ON transfer_pattern(global_id);

CREATE INDEX idx_transfer_pattern_source ON transfer_pattern(source_provider);

CREATE INDEX idx_vivim_session_status ON vivim_session(status);

-- ── Data ──────────────────────────────────────────────────────────────

-- alert_condition: (empty)

-- alert_event: (empty)

-- automation_run: (empty)

-- automation_schedule: (empty)

-- binding_event: (empty)

-- capability_binding: 104 rows
INSERT INTO "capability_binding" ("id", "provider_id", "global_id", "status", "confidence", "oks", "fails", "last_ok_ms", "replay_verified", "intended_matched", "pattern_hits", "best_program_id", "transfer_origin", "promotion_history", "schema_version", "created_at", "updated_at", "provenance") VALUES
  ('b:claude:use-memory-ai-chat', 'claude', 't:global:use-memory-ai-chat', 'flaky', 0.31749999987599203, 1, 3, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_use_memory_ai_chat-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"flaky","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298499864, '{"source":"migrated","origin_id":"use-memory-ai-chat::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:open-model-menu', 'claude', 't:global:open-model-menu', 'stable', 0.6699999977678571, 3, 1, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_open_model_menu-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298499874, '{"source":"migrated","origin_id":"open-model-menu::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:open-thinking-menu', 'claude', 't:global:open-thinking-menu', 'flaky', 0.33833333023313494, 1, 2, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_open_thinking_menu-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"flaky","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298499880, '{"source":"migrated","origin_id":"open-thinking-menu::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:add-files-connectors-and-more', 'claude', 't:global:add-files-connectors-and-more', 'stable', 0.732499996155754, 20, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_add_files_connectors_and_more-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298499886, '{"source":"migrated","origin_id":"add-files-connectors-and-more::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:model-sonnet-46-low', 'claude', 't:global:model-sonnet-46-low', 'broken', 0.37249999541170636, 3, 1, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_model_sonnet_46_low-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"broken","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298499892, '{"source":"migrated","origin_id":"model-sonnet-46-low::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:learn-moreopens-in-new-tab', 'claude', 't:global:learn-moreopens-in-new-tab', 'stable', 0.7324999946676587, 15, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_learn_moreopens_in_new_tab-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298499899, '{"source":"migrated","origin_id":"learn-moreopens-in-new-tab::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:working', 'claude', 't:global:working', 'flaky', 0.3383333271329365, 1, 2, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_working-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"flaky","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298499905, '{"source":"migrated","origin_id":"working::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:more-options-for-test-message', 'claude', 't:global:more-options-for-test-message', 'stable', 0.6699999930555556, 3, 1, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_more_options_for_test_message-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298499911, '{"source":"migrated","origin_id":"more-options-for-test-message::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:thought-process', 'claude', 't:global:thought-process', 'stable', 0.7324999921875, 5, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_thought_process-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298499919, '{"source":"migrated","origin_id":"thought-process::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:more-options-for-prime-number', 'claude', 't:global:more-options-for-prime-number', 'stable', 0.6699999913194444, 3, 1, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_more_options_for_prime_number-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298499924, '{"source":"migrated","origin_id":"more-options-for-prime-number-::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:model-haiku-45-extended', 'claude', 't:global:model-haiku-45-extended', 'stable', 0.7324999905753968, 18, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_model_haiku_45_extended-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298499931, '{"source":"migrated","origin_id":"model-haiku-45-extended::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:more-options-for-ready-to-begi', 'claude', 't:global:more-options-for-ready-to-begi', 'stable', 0.6699999899553571, 3, 1, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_more_options_for_ready_to_begi-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298499936, '{"source":"migrated","origin_id":"more-options-for-ready-to-begi::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:send-prompt', 'claude', 't:global:send-prompt', 'stable', 0.7324999892113095, 4, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_send_prompt-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298499943, '{"source":"migrated","origin_id":"send-prompt::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:gemini:send-prompt', 'gemini', 't:global:send-prompt', 'flaky', 0.33833332167658725, 1, 2, 1783298499851, 0, NULL, 0, 'p:mig-b_gemini_send_prompt-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"flaky","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298499952, '{"source":"migrated","origin_id":"send-prompt::gemini","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:stop-generation', 'claude', 't:global:stop-generation', 'flaky', 0.3383333205605159, 1, 2, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_stop_generation-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"flaky","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298499959, '{"source":"migrated","origin_id":"stop-generation::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:attach-file', 'claude', 't:global:attach-file', 'stable', 0.732499986359127, 2, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_attach_file-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298499965, '{"source":"migrated","origin_id":"attach-file::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:gemini:attach-file', 'gemini', 't:global:attach-file', 'flaky', 0.3383333189484127, 1, 2, 1783298499851, 0, NULL, 0, 'p:mig-b_gemini_attach_file-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"flaky","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298499995, '{"source":"migrated","origin_id":"attach-file::gemini","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:chatgpt:attach-file', 'chatgpt', 't:global:attach-file', 'stable', 0.7324999817708333, 3, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_chatgpt_attach_file-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500002, '{"source":"migrated","origin_id":"attach-file::chatgpt","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:attach-image', 'claude', 't:global:attach-image', 'flaky', 0.33833331436011904, 1, 2, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_attach_image-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"flaky","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500007, '{"source":"migrated","origin_id":"attach-image::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:gemini:attach-image', 'gemini', 't:global:attach-image', 'test-1', 0.4916666470734127, 2, 1, 1783298499851, 0, NULL, 0, 'p:mig-b_gemini_attach_image-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"test-1","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500012, '{"source":"migrated","origin_id":"attach-image::gemini","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:voice-input', 'claude', 't:global:voice-input', 'stable', 0.7324999797867063, 2, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_voice_input-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500017, '{"source":"migrated","origin_id":"voice-input::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:chatgpt:compose-prompt', 'chatgpt', 't:global:compose-prompt', 'stable', 0.7324999790426587, 2, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_chatgpt_compose_prompt-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500024, '{"source":"migrated","origin_id":"compose-prompt::chatgpt","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:gemini:compose-prompt', 'gemini', 't:global:compose-prompt', 'flaky', 0.379999978422619, 2, 2, 1783298499851, 0, NULL, 0, 'p:mig-b_gemini_compose_prompt-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"flaky","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500029, '{"source":"migrated","origin_id":"compose-prompt::gemini","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:chatgpt:stop-code', 'chatgpt', 't:global:stop-code', 'flaky', 0.3383333110119048, 1, 2, 1783298499851, 0, NULL, 0, 'p:mig-b_chatgpt_stop_code-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"flaky","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500035, '{"source":"migrated","origin_id":"stop-code::chatgpt","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:gemini:stop-code', 'gemini', 't:global:stop-code', 'flaky', 0.33833331014384915, 1, 2, 1783298499851, 0, NULL, 0, 'p:mig-b_gemini_stop_code-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"flaky","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500048, '{"source":"migrated","origin_id":"stop-code::gemini","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:chatgpt:upgrade-plan', 'chatgpt', 't:global:upgrade-plan', 'stable', 0.6699999749503969, 3, 1, 1783298499851, 0, NULL, 0, 'p:mig-b_chatgpt_upgrade_plan-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500060, '{"source":"migrated","origin_id":"upgrade-plan::chatgpt","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:gemini:upgrade-plan', 'gemini', 't:global:upgrade-plan', 'flaky', 0.3799999738343254, 2, 2, 1783298499851, 0, NULL, 0, 'p:mig-b_gemini_upgrade_plan-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"flaky","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500065, '{"source":"migrated","origin_id":"upgrade-plan::gemini","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:gemini:dismiss-onboarding', 'gemini', 't:global:dismiss-onboarding', 'flaky', 0.33833330654761906, 1, 2, 1783298499851, 0, NULL, 0, 'p:mig-b_gemini_dismiss_onboarding-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"flaky","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500071, '{"source":"migrated","origin_id":"dismiss-onboarding::gemini","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:gemini:toggle-extended-thinking', 'gemini', 't:global:toggle-extended-thinking', 'flaky', 0.3383333058035714, 1, 2, 1783298499851, 0, NULL, 0, 'p:mig-b_gemini_toggle_extended_thinking-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"flaky","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500076, '{"source":"migrated","origin_id":"toggle-extended-thinking::gemini","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:chatgpt:more', 'chatgpt', 't:global:more', 'stable', 0.7324999718501984, 3, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_chatgpt_more-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500083, '{"source":"migrated","origin_id":"more::chatgpt","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:chatgpt:projects', 'chatgpt', 't:global:projects', 'stable', 0.7324999709821429, 3, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_chatgpt_projects-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500089, '{"source":"migrated","origin_id":"projects::chatgpt","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:gemini:toggle-notebooks', 'gemini', 't:global:toggle-notebooks', 'stable', 0.649166636904762, 4, 2, 1783298499851, 0, NULL, 0, 'p:mig-b_gemini_toggle_notebooks-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500095, '{"source":"migrated","origin_id":"toggle-notebooks::gemini","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:gemini:toggle-recents', 'gemini', 't:global:toggle-recents', 'flaky', 0.37999996937003966, 2, 2, 1783298499851, 0, NULL, 0, 'p:mig-b_gemini_toggle_recents-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"flaky","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500102, '{"source":"migrated","origin_id":"toggle-recents::gemini","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:gemini:google-account-owen-wallace-se', 'gemini', 't:global:google-account-owen-wallace-se', 'stable', 0.7324999686259921, 5, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_gemini_google_account_owen_wallace_se-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500113, '{"source":"migrated","origin_id":"google-account-owen-wallace-se::gemini","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:gemini:settings', 'gemini', 't:global:settings', 'stable', 0.7324999672619048, 5, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_gemini_settings-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500119, '{"source":"migrated","origin_id":"settings::gemini","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:settings', 'claude', 't:global:settings', 'stable', 0.7324999665178571, 4, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_settings-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500125, '{"source":"migrated","origin_id":"settings::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:gemini:upload-tools', 'gemini', 't:global:upload-tools', 'stable', 0.7324999657738095, 3, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_gemini_upload_tools-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500132, '{"source":"migrated","origin_id":"upload--tools::gemini","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:gemini:open-mode-picker-currently-fla', 'gemini', 't:global:open-mode-picker-currently-fla', 'stable', 0.732499964905754, 5, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_gemini_open_mode_picker_currently_fla-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500138, '{"source":"migrated","origin_id":"open-mode-picker-currently-fla::gemini","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:clear-composer', 'claude', 't:global:clear-composer', 'broken', 0.3724999641617064, 3, 1, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_clear_composer-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"broken","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500144, '{"source":"migrated","origin_id":"clear-composer::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:copy', 'claude', 't:global:copy', 'stable', 0.7324999632936509, 3, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_copy-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500151, '{"source":"migrated","origin_id":"copy::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:go-back', 'claude', 't:global:go-back', 'flaky', 0.33833329575892857, 1, 2, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_go_back-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"flaky","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500157, '{"source":"migrated","origin_id":"go-back::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:thinking', 'claude', 't:global:thinking', 'stable', 0.7324999618055555, 4, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_thinking-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500164, '{"source":"migrated","origin_id":"thinking::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:read-aloud', 'claude', 't:global:read-aloud', 'stable', 0.7324999609375, 3, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_read_aloud-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500169, '{"source":"migrated","origin_id":"read-aloud::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:retry', 'claude', 't:global:retry', 'stable', 0.7324999601934524, 3, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_retry-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500175, '{"source":"migrated","origin_id":"retry::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:chatgpt:branch-from-message', 'chatgpt', 't:global:branch-from-message', 'flaky', 0.338333292906746, 1, 2, 1783298499851, 0, NULL, 0, 'p:mig-b_chatgpt_branch_from_message-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"flaky","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500181, '{"source":"migrated","origin_id":"branch-from-message::chatgpt","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:chatgpt:view-sources', 'chatgpt', 't:global:view-sources', 'flaky', 0.33833329228670633, 1, 2, 1783298499851, 0, NULL, 0, 'p:mig-b_chatgpt_view_sources-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"flaky","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500186, '{"source":"migrated","origin_id":"view-sources::chatgpt","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:chatgpt:open-profile', 'chatgpt', 't:global:open-profile', 'stable', 0.7324999582093255, 2, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_chatgpt_open_profile-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500192, '{"source":"migrated","origin_id":"open-profile::chatgpt","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:chatgpt:new-chat', 'chatgpt', 't:global:new-chat', 'stable', 0.7324999574652777, 5, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_chatgpt_new_chat-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500198, '{"source":"migrated","origin_id":"new-chat::chatgpt","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:chatgpt:regenerate-with-model', 'chatgpt', 't:global:regenerate-with-model', 'flaky', 0.3383332900545635, 1, 2, 1783298499851, 0, NULL, 0, 'p:mig-b_chatgpt_regenerate_with_model-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"flaky","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500204, '{"source":"migrated","origin_id":"regenerate-with-model::chatgpt","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:chatgpt:entertainment', 'chatgpt', 't:global:entertainment', 'flaky', 0.3383332893105159, 1, 2, 1783298499851, 0, NULL, 0, 'p:mig-b_chatgpt_entertainment-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"flaky","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500210, '{"source":"migrated","origin_id":"entertainment::chatgpt","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:chatgpt:black-box-project', 'chatgpt', 't:global:black-box-project', 'stable', 0.6699999552331349, 3, 1, 1783298499851, 0, NULL, 0, 'p:mig-b_chatgpt_black_box_project-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500215, '{"source":"migrated","origin_id":"black-box-project::chatgpt","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:chatgpt:telepathy-research', 'chatgpt', 't:global:telepathy-research', 'flaky', 0.3799999546130952, 2, 2, 1783298499851, 0, NULL, 0, 'p:mig-b_chatgpt_telepathy_research-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"flaky","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500221, '{"source":"migrated","origin_id":"telepathy-research::chatgpt","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:chatgpt:timewatchers', 'chatgpt', 't:global:timewatchers', 'flaky', 0.40499995386904764, 3, 2, 1783298499851, 0, NULL, 0, 'p:mig-b_chatgpt_timewatchers-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"flaky","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500227, '{"source":"migrated","origin_id":"timewatchers::chatgpt","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:chatgpt:math', 'chatgpt', 't:global:math', 'stable', 0.732499953125, 3, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_chatgpt_math-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500233, '{"source":"migrated","origin_id":"math::chatgpt","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:chatgpt:show-more', 'chatgpt', 't:global:show-more', 'flaky', 0.4049999523809524, 3, 2, 1783298499851, 0, NULL, 0, 'p:mig-b_chatgpt_show_more-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"flaky","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500239, '{"source":"migrated","origin_id":"show-more::chatgpt","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:more-options', 'claude', 't:global:more-options', 'stable', 0.7324999516369047, 4, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_more_options-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500245, '{"source":"migrated","origin_id":"more-options::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:gemini:search-chats', 'gemini', 't:global:search-chats', 'stable', 0.7324999507688492, 2, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_gemini_search_chats-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500252, '{"source":"migrated","origin_id":"search-chats::gemini","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:gemini:select-thinking-level', 'gemini', 't:global:select-thinking-level', 'flaky', 0.3383332833581349, 1, 2, 1783298499851, 0, NULL, 0, 'p:mig-b_gemini_select_thinking_level-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"flaky","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500258, '{"source":"migrated","origin_id":"select-thinking-level::gemini","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:gemini:pin-message', 'gemini', 't:global:pin-message', 'flaky', 0.3383332826140873, 1, 2, 1783298499851, 0, NULL, 0, 'p:mig-b_gemini_pin_message-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"flaky","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500264, '{"source":"migrated","origin_id":"pin-message::gemini","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:attach-pdf', 'claude', 't:global:attach-pdf', 'stable', 0.7324999485367063, 2, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_attach_pdf-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500270, '{"source":"migrated","origin_id":"attach-pdf::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:attach-folder', 'claude', 't:global:attach-folder', 'stable', 0.7324999477926588, 2, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_attach_folder-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500276, '{"source":"migrated","origin_id":"attach-folder::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:attach-from-drive', 'claude', 't:global:attach-from-drive', 'stable', 0.7324999470486111, 2, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_attach_from_drive-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500282, '{"source":"migrated","origin_id":"attach-from-drive::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:paste-image', 'claude', 't:global:paste-image', 'stable', 0.7324999463045635, 2, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_paste_image-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500288, '{"source":"migrated","origin_id":"paste-image::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:dictate', 'claude', 't:global:dictate', 'stable', 0.732499945436508, 2, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_dictate-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500294, '{"source":"migrated","origin_id":"dictate::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:slash-command', 'claude', 't:global:slash-command', 'stable', 0.7324999448164683, 2, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_slash_command-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500300, '{"source":"migrated","origin_id":"slash-command::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:mention-file', 'claude', 't:global:mention-file', 'stable', 0.7324999440724207, 3, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_mention_file-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500306, '{"source":"migrated","origin_id":"mention-file::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:insert-template', 'claude', 't:global:insert-template', 'stable', 0.732499943328373, 2, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_insert_template-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500312, '{"source":"migrated","origin_id":"insert-template::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:prompt-category', 'claude', 't:global:prompt-category', 'stable', 0.7324999425843254, 2, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_prompt_category-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500318, '{"source":"migrated","origin_id":"prompt-category::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:expand-composer', 'claude', 't:global:expand-composer', 'stable', 0.7324999418402778, 5, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_expand_composer-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500324, '{"source":"migrated","origin_id":"expand-composer::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:give-feedback', 'claude', 't:global:give-feedback', 'flaky', 0.37999994109623014, 1, 1, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_give_feedback-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"flaky","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500330, '{"source":"migrated","origin_id":"give-feedback::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:quote-message', 'claude', 't:global:quote-message', 'flaky', 0.33833327368551586, 1, 2, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_quote_message-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"flaky","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500336, '{"source":"migrated","origin_id":"quote-message::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:chatgpt:chats', 'chatgpt', 't:global:chats', 'stable', 0.732499939608135, 2, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_chatgpt_chats-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500342, '{"source":"migrated","origin_id":"chats::chatgpt","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:chatgpt:owen-wallace-servera-free-open', 'chatgpt', 't:global:owen-wallace-servera-free-open', 'stable', 0.7324999388640874, 2, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_chatgpt_owen_wallace_servera_free_open-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500348, '{"source":"migrated","origin_id":"owen-wallace-servera-free-open::chatgpt","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:chatgpt:close-sidebar', 'chatgpt', 't:global:close-sidebar', 'stable', 0.7324999381200397, 2, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_chatgpt_close_sidebar-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500353, '{"source":"migrated","origin_id":"close-sidebar::chatgpt","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:chatgpt:open-project-options-for-timew', 'chatgpt', 't:global:open-project-options-for-timew', 'flaky', 0.3799999375, 2, 2, 1783298499851, 0, NULL, 0, 'p:mig-b_chatgpt_open_project_options_for_timew-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"flaky","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500359, '{"source":"migrated","origin_id":"open-project-options-for-timew::chatgpt","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:chatgpt:open-project-options-for-math', 'chatgpt', 't:global:open-project-options-for-math', 'flaky', 0.3799999366319444, 2, 2, 1783298499851, 0, NULL, 0, 'p:mig-b_chatgpt_open_project_options_for_math-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"flaky","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500366, '{"source":"migrated","origin_id":"open-project-options-for-math::chatgpt","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:star-chat', 'claude', 't:global:star-chat', 'prospect', 0.2, 0, 0, NULL, 0, NULL, 0, 'p:mig-b_claude_star_chat-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"prospect","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500371, '{"source":"migrated","origin_id":"star-chat::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:delete-chat', 'claude', 't:global:delete-chat', 'prospect', 0.2, 0, 0, NULL, 0, NULL, 0, 'p:mig-b_claude_delete_chat-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"prospect","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500377, '{"source":"migrated","origin_id":"delete-chat::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:more-options-for-short-haiku-r', 'claude', 't:global:more-options-for-short-haiku-r', 'stable', 0.7324999345238096, 2, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_more_options_for_short_haiku_r-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500384, '{"source":"migrated","origin_id":"more-options-for-short-haiku-r::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:chatgpt:open-sidebar', 'chatgpt', 't:global:open-sidebar', 'stable', 0.7324999336557539, 3, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_chatgpt_open_sidebar-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500390, '{"source":"migrated","origin_id":"open-sidebar::chatgpt","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:chatgpt:recents', 'chatgpt', 't:global:recents', 'stable', 0.7324999329117063, 3, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_chatgpt_recents-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500396, '{"source":"migrated","origin_id":"recents::chatgpt","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:chatgpt:open-profile-menu', 'chatgpt', 't:global:open-profile-menu', 'stable', 0.7324999321676587, 3, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_chatgpt_open_profile_menu-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500403, '{"source":"migrated","origin_id":"open-profile-menu::chatgpt","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:chatgpt:model-selector', 'chatgpt', 't:global:model-selector', 'stable', 0.7324999312996032, 3, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_chatgpt_model_selector-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500409, '{"source":"migrated","origin_id":"model-selector::chatgpt","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:chatgpt:add-files-and-more', 'chatgpt', 't:global:add-files-and-more', 'stable', 0.7324999305555555, 3, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_chatgpt_add_files_and_more-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500415, '{"source":"migrated","origin_id":"add-files-and-more::chatgpt","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:chatgpt:open-conversation-options', 'chatgpt', 't:global:open-conversation-options', 'stable', 0.7324999298115079, 3, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_chatgpt_open_conversation_options-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500422, '{"source":"migrated","origin_id":"open-conversation-options::chatgpt","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:chatgpt:pin-chat', 'chatgpt', 't:global:pin-chat', 'flaky', 0.37999992894345236, 1, 1, 1783298499851, 0, NULL, 0, 'p:mig-b_chatgpt_pin_chat-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"flaky","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500427, '{"source":"migrated","origin_id":"pin-chat::chatgpt","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:chatgpt:move-to-project', 'chatgpt', 't:global:move-to-project', 'flaky', 0.3799999283234127, 1, 1, 1783298499851, 0, NULL, 0, 'p:mig-b_chatgpt_move_to_project-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"flaky","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500433, '{"source":"migrated","origin_id":"move-to-project::chatgpt","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:gemini:todays-date-model-and-account', 'gemini', 't:global:todays-date-model-and-account', 'stable', 0.7324999275793651, 2, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_gemini_todays_date_model_and_account-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500438, '{"source":"migrated","origin_id":"todays-date-model-and-account::gemini","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:gemini:redo', 'gemini', 't:global:redo', 'test-1', 0.5749999269593253, 1, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_gemini_redo-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"test-1","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500445, '{"source":"migrated","origin_id":"redo::gemini","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:open-customize', 'claude', 't:global:open-customize', 'stable', 0.6491665927579364, 2, 1, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_open_customize-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500451, '{"source":"migrated","origin_id":"open-customize::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:open-projects', 'claude', 't:global:open-projects', 'prospect', 0.075, 0, 1, NULL, 0, NULL, 0, 'p:mig-b_claude_open_projects-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"prospect","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500457, '{"source":"migrated","origin_id":"open-projects::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:expand-navigation', 'claude', 't:global:expand-navigation', 'stable', 0.7324999246031746, 2, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_expand_navigation-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500463, '{"source":"migrated","origin_id":"expand-navigation::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:open-settings', 'claude', 't:global:open-settings', 'stable', 0.732499923859127, 2, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_open_settings-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500470, '{"source":"migrated","origin_id":"open-settings::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:toggle-web-search', 'claude', 't:global:toggle-web-search', 'prospect', 0.075, 0, 3, NULL, 0, NULL, 0, 'p:mig-b_claude_toggle_web_search-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"prospect","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500481, '{"source":"migrated","origin_id":"toggle-web-search::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:go-back-nav', 'claude', 't:global:go-back-nav', 'stable', 0.7324999215029762, 2, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_go_back_nav-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500489, '{"source":"migrated","origin_id":"go-back-nav::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:open-attach-menu', 'claude', 't:global:open-attach-menu', 'stable', 0.7324999206349206, 2, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_open_attach_menu-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500495, '{"source":"migrated","origin_id":"open-attach-menu::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:add-skill', 'claude', 't:global:add-skill', 'flaky', 0.379999919890873, 1, 1, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_add_skill-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"flaky","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500501, '{"source":"migrated","origin_id":"add-skill::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:add-custom-connector', 'claude', 't:global:add-custom-connector', 'flaky', 0.3799999191468254, 1, 1, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_add_custom_connector-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"flaky","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500507, '{"source":"migrated","origin_id":"add-custom-connector::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:start-new-project', 'claude', 't:global:start-new-project', 'flaky', 0.37999991840277775, 1, 1, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_start_new_project-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"flaky","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500513, '{"source":"migrated","origin_id":"start-new-project::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:select-model-haiku', 'claude', 't:global:select-model-haiku', 'stable', 0.7324999175347222, 2, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_select_model_haiku-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500520, '{"source":"migrated","origin_id":"select-model-haiku::claude","meta":{"from":"capabilit-lab/data/actions.json"}}');
INSERT INTO "capability_binding" ("id", "provider_id", "global_id", "status", "confidence", "oks", "fails", "last_ok_ms", "replay_verified", "intended_matched", "pattern_hits", "best_program_id", "transfer_origin", "promotion_history", "schema_version", "created_at", "updated_at", "provenance") VALUES
  ('b:claude:go-home', 'claude', 't:global:go-home', 'stable', 0.7324999167906746, 2, 0, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_go_home-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"stable","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500530, '{"source":"migrated","origin_id":"go-home::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:new-chat-claude', 'claude', 't:global:new-chat-claude', 'prospect', 0.075, 0, 2, NULL, 0, NULL, 0, 'p:mig-b_claude_new_chat_claude-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"prospect","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500536, '{"source":"migrated","origin_id":"new-chat-claude::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:select-model-sonnet', 'claude', 't:global:select-model-sonnet', 'prospect', 0.075, 0, 1, NULL, 0, NULL, 0, 'p:mig-b_claude_select_model_sonnet-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"prospect","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500543, '{"source":"migrated","origin_id":"select-model-sonnet::claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('b:claude:open-more-models', 'claude', 't:global:open-more-models', 'flaky', 0.37999991393849203, 1, 1, 1783298499851, 0, NULL, 0, 'p:mig-b_claude_open_more_models-v1', NULL, '[{"ts":1783298499851,"from_status":null,"to_status":"flaky","reason":"migrated","actor":"cap-store migrate"}]', 1, 1782868071205, 1783298500549, '{"source":"migrated","origin_id":"open-more-models::claude","meta":{"from":"capabilit-lab/data/actions.json"}}');

-- capability_program: 104 rows
INSERT INTO "capability_program" ("id", "binding_id", "version", "steps", "when_clauses", "verify_clauses", "superseded_by", "retired_at", "schema_version", "created_at", "updated_at", "provenance") VALUES
  ('p:mig-b_claude_use_memory_ai_chat-v1', 'b:claude:use-memory-ai-chat', 1, '[{"op":"click","text":"t use memory"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298499858, '{"source":"migrated","origin_id":"use-memory-ai-chat::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_open_model_menu-v1', 'b:claude:open-model-menu', 1, '[{"op":"click","text":"Model:"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298499872, '{"source":"migrated","origin_id":"open-model-menu::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_open_thinking_menu-v1', 'b:claude:open-thinking-menu', 1, '[{"text":"thinking","op":"click"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298499878, '{"source":"migrated","origin_id":"open-thinking-menu::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_add_files_connectors_and_more-v1', 'b:claude:add-files-connectors-and-more', 1, '[{"op":"click","text":"Add files, connectors, and more"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298499885, '{"source":"migrated","origin_id":"add-files-connectors-and-more::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_model_sonnet_46_low-v1', 'b:claude:model-sonnet-46-low', 1, '[{"op":"click","text":"Model: Sonnet 4.6 Low"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298499890, '{"source":"migrated","origin_id":"model-sonnet-46-low::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_learn_moreopens_in_new_tab-v1', 'b:claude:learn-moreopens-in-new-tab', 1, '[{"op":"click","text":"Learn more(opens in new tab)"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298499897, '{"source":"migrated","origin_id":"learn-moreopens-in-new-tab::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_working-v1', 'b:claude:working', 1, '[{"text":"working","op":"click"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298499904, '{"source":"migrated","origin_id":"working::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_more_options_for_test_message-v1', 'b:claude:more-options-for-test-message', 1, '[{"text":"more","op":"click"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298499910, '{"source":"migrated","origin_id":"more-options-for-test-message::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_thought_process-v1', 'b:claude:thought-process', 1, '[{"op":"click","text":"Thought process"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298499917, '{"source":"migrated","origin_id":"thought-process::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_more_options_for_prime_number-v1', 'b:claude:more-options-for-prime-number', 1, '[{"text":"more","op":"click"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298499923, '{"source":"migrated","origin_id":"more-options-for-prime-number-::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_model_haiku_45_extended-v1', 'b:claude:model-haiku-45-extended', 1, '[{"op":"click","text":"Model: Haiku 4.5 Extended"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298499929, '{"source":"migrated","origin_id":"model-haiku-45-extended::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_more_options_for_ready_to_begi-v1', 'b:claude:more-options-for-ready-to-begi', 1, '[{"text":"more","op":"click"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298499934, '{"source":"migrated","origin_id":"more-options-for-ready-to-begi::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_send_prompt-v1', 'b:claude:send-prompt', 1, '[{"op":"click","text":"prompt"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298499941, '{"source":"migrated","origin_id":"send-prompt::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_gemini_send_prompt-v1', 'b:gemini:send-prompt', 1, '[{"text":"send","op":"click"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298499950, '{"source":"migrated","origin_id":"send-prompt::gemini::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_stop_generation-v1', 'b:claude:stop-generation', 1, '[{"text":"stop","op":"click"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298499957, '{"source":"migrated","origin_id":"stop-generation::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_attach_file-v1', 'b:claude:attach-file', 1, '[{"op":"click","text":"file"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298499963, '{"source":"migrated","origin_id":"attach-file::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_gemini_attach_file-v1', 'b:gemini:attach-file', 1, '[{"text":"file","op":"click"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298499970, '{"source":"migrated","origin_id":"attach-file::gemini::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_chatgpt_attach_file-v1', 'b:chatgpt:attach-file', 1, '[{"op":"type","text":"attach file. Respond briefly."}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500000, '{"source":"migrated","origin_id":"attach-file::chatgpt::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_attach_image-v1', 'b:claude:attach-image', 1, '[{"text":"image","op":"click"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500005, '{"source":"migrated","origin_id":"attach-image::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_gemini_attach_image-v1', 'b:gemini:attach-image', 1, '[{"text":"image","op":"click"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500011, '{"source":"migrated","origin_id":"attach-image::gemini::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_voice_input-v1', 'b:claude:voice-input', 1, '[{"op":"click","text":"voice"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500016, '{"source":"migrated","origin_id":"voice-input::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_chatgpt_compose_prompt-v1', 'b:chatgpt:compose-prompt', 1, '[{"text":"compose","op":"click"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500022, '{"source":"migrated","origin_id":"compose-prompt::chatgpt::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_gemini_compose_prompt-v1', 'b:gemini:compose-prompt', 1, '[{"text":"compose prompt","op":"click"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500027, '{"source":"migrated","origin_id":"compose-prompt::gemini::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_chatgpt_stop_code-v1', 'b:chatgpt:stop-code', 1, '[{"text":"stop","op":"click"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500033, '{"source":"migrated","origin_id":"stop-code::chatgpt::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_gemini_stop_code-v1', 'b:gemini:stop-code', 1, '[{"text":"stop","op":"click"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500043, '{"source":"migrated","origin_id":"stop-code::gemini::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_chatgpt_upgrade_plan-v1', 'b:chatgpt:upgrade-plan', 1, '[{"text":"upgrade","op":"click"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500058, '{"source":"migrated","origin_id":"upgrade-plan::chatgpt::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_gemini_upgrade_plan-v1', 'b:gemini:upgrade-plan', 1, '[{"text":"upgrade","op":"click"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500064, '{"source":"migrated","origin_id":"upgrade-plan::gemini::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_gemini_dismiss_onboarding-v1', 'b:gemini:dismiss-onboarding', 1, '[{"text":"dismiss","op":"click"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500069, '{"source":"migrated","origin_id":"dismiss-onboarding::gemini::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_gemini_toggle_extended_thinking-v1', 'b:gemini:toggle-extended-thinking', 1, '[{"text":"thinking","op":"click"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500075, '{"source":"migrated","origin_id":"toggle-extended-thinking::gemini::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_chatgpt_more-v1', 'b:chatgpt:more', 1, '[{"op":"click","text":"More"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500081, '{"source":"migrated","origin_id":"more::chatgpt::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_chatgpt_projects-v1', 'b:chatgpt:projects', 1, '[{"op":"click","text":"Projects"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500087, '{"source":"migrated","origin_id":"projects::chatgpt::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_gemini_toggle_notebooks-v1', 'b:gemini:toggle-notebooks', 1, '[{"op":"click","text":"Toggle Notebooks"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500093, '{"source":"migrated","origin_id":"toggle-notebooks::gemini::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_gemini_toggle_recents-v1', 'b:gemini:toggle-recents', 1, '[{"text":"recents","op":"click"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500100, '{"source":"migrated","origin_id":"toggle-recents::gemini::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_gemini_google_account_owen_wallace_se-v1', 'b:gemini:google-account-owen-wallace-se', 1, '[{"op":"click","text":"Google Account: owen wallace-servera (ow"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500110, '{"source":"migrated","origin_id":"google-account-owen-wallace-se::gemini::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_gemini_settings-v1', 'b:gemini:settings', 1, '[{"op":"click","text":"Settings"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500117, '{"source":"migrated","origin_id":"settings::gemini::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_settings-v1', 'b:claude:settings', 1, '[{"op":"click","text":"Settings"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500123, '{"source":"migrated","origin_id":"settings::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_gemini_upload_tools-v1', 'b:gemini:upload-tools', 1, '[{"op":"click","text":"Upload & tools"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500130, '{"source":"migrated","origin_id":"upload--tools::gemini::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_gemini_open_mode_picker_currently_fla-v1', 'b:gemini:open-mode-picker-currently-fla', 1, '[{"op":"click","text":"Open mode picker, currently Flash"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500136, '{"source":"migrated","origin_id":"open-mode-picker-currently-fla::gemini::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_clear_composer-v1', 'b:claude:clear-composer', 1, '[{"op":"click","text":"Clear composer"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500142, '{"source":"migrated","origin_id":"clear-composer::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_copy-v1', 'b:claude:copy', 1, '[{"op":"click","text":"Copy"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500149, '{"source":"migrated","origin_id":"copy::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_go_back-v1', 'b:claude:go-back', 1, '[{"text":"back","op":"click"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500156, '{"source":"migrated","origin_id":"go-back::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_thinking-v1', 'b:claude:thinking', 1, '[{"op":"click","text":"Thinking"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500162, '{"source":"migrated","origin_id":"thinking::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_read_aloud-v1', 'b:claude:read-aloud', 1, '[{"op":"click","text":"Read aloud"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500168, '{"source":"migrated","origin_id":"read-aloud::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_retry-v1', 'b:claude:retry', 1, '[{"op":"click","text":"Retry"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500174, '{"source":"migrated","origin_id":"retry::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_chatgpt_branch_from_message-v1', 'b:chatgpt:branch-from-message', 1, '[{"text":"branch","op":"click"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500179, '{"source":"migrated","origin_id":"branch-from-message::chatgpt::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_chatgpt_view_sources-v1', 'b:chatgpt:view-sources', 1, '[{"text":"sources","op":"click"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500185, '{"source":"migrated","origin_id":"view-sources::chatgpt::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_chatgpt_open_profile-v1', 'b:chatgpt:open-profile', 1, '[{"text":"profile","op":"click"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500191, '{"source":"migrated","origin_id":"open-profile::chatgpt::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_chatgpt_new_chat-v1', 'b:chatgpt:new-chat', 1, '[{"text":"new","op":"click"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500196, '{"source":"migrated","origin_id":"new-chat::chatgpt::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_chatgpt_regenerate_with_model-v1', 'b:chatgpt:regenerate-with-model', 1, '[{"text":"regenerate","op":"click"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500202, '{"source":"migrated","origin_id":"regenerate-with-model::chatgpt::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_chatgpt_entertainment-v1', 'b:chatgpt:entertainment', 1, '[{"text":"entertainment","op":"click"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500208, '{"source":"migrated","origin_id":"entertainment::chatgpt::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_chatgpt_black_box_project-v1', 'b:chatgpt:black-box-project', 1, '[{"text":"project","op":"click"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500214, '{"source":"migrated","origin_id":"black-box-project::chatgpt::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_chatgpt_telepathy_research-v1', 'b:chatgpt:telepathy-research', 1, '[{"text":"telepathy","op":"click"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500219, '{"source":"migrated","origin_id":"telepathy-research::chatgpt::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_chatgpt_timewatchers-v1', 'b:chatgpt:timewatchers', 1, '[{"op":"click","text":"TIMEWATCHERS"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500225, '{"source":"migrated","origin_id":"timewatchers::chatgpt::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_chatgpt_math-v1', 'b:chatgpt:math', 1, '[{"op":"click","text":"MATH"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500231, '{"source":"migrated","origin_id":"math::chatgpt::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_chatgpt_show_more-v1', 'b:chatgpt:show-more', 1, '[{"op":"click","text":"Show more"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500237, '{"source":"migrated","origin_id":"show-more::chatgpt::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_more_options-v1', 'b:claude:more-options', 1, '[{"op":"click","text":"More options"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500243, '{"source":"migrated","origin_id":"more-options::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_gemini_search_chats-v1', 'b:gemini:search-chats', 1, '[{"op":"click","text":"Search chats"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500250, '{"source":"migrated","origin_id":"search-chats::gemini::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_gemini_select_thinking_level-v1', 'b:gemini:select-thinking-level', 1, '[{"text":"thinking","op":"click"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500256, '{"source":"migrated","origin_id":"select-thinking-level::gemini::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_gemini_pin_message-v1', 'b:gemini:pin-message', 1, '[{"text":"pin","op":"click"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500262, '{"source":"migrated","origin_id":"pin-message::gemini::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_attach_pdf-v1', 'b:claude:attach-pdf', 1, '[{"op":"type","text":"attach pdf. Respond briefly."}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500268, '{"source":"migrated","origin_id":"attach-pdf::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_attach_folder-v1', 'b:claude:attach-folder', 1, '[{"op":"type","text":"attach folder. Respond briefly."}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500274, '{"source":"migrated","origin_id":"attach-folder::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_attach_from_drive-v1', 'b:claude:attach-from-drive', 1, '[{"op":"type","text":"attach from drive. Respond briefly."}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500280, '{"source":"migrated","origin_id":"attach-from-drive::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_paste_image-v1', 'b:claude:paste-image', 1, '[{"op":"type","text":"paste image. Respond briefly."}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500286, '{"source":"migrated","origin_id":"paste-image::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_dictate-v1', 'b:claude:dictate', 1, '[{"op":"type","text":"dictate. Respond briefly."}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500292, '{"source":"migrated","origin_id":"dictate::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_slash_command-v1', 'b:claude:slash-command', 1, '[{"op":"type","text":"slash command. Respond briefly."}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500298, '{"source":"migrated","origin_id":"slash-command::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_mention_file-v1', 'b:claude:mention-file', 1, '[{"op":"type","text":"mention file. Respond briefly."}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500305, '{"source":"migrated","origin_id":"mention-file::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_insert_template-v1', 'b:claude:insert-template', 1, '[{"op":"type","text":"insert template. Respond briefly."}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500310, '{"source":"migrated","origin_id":"insert-template::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_prompt_category-v1', 'b:claude:prompt-category', 1, '[{"op":"type","text":"prompt category. Respond briefly."}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500316, '{"source":"migrated","origin_id":"prompt-category::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_expand_composer-v1', 'b:claude:expand-composer', 1, '[{"op":"type","text":"expand composer. Respond briefly."}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500322, '{"source":"migrated","origin_id":"expand-composer::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_give_feedback-v1', 'b:claude:give-feedback', 1, '[{"text":"feedback","op":"click"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500328, '{"source":"migrated","origin_id":"give-feedback::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_quote_message-v1', 'b:claude:quote-message', 1, '[{"text":"quote","op":"click"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500335, '{"source":"migrated","origin_id":"quote-message::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_chatgpt_chats-v1', 'b:chatgpt:chats', 1, '[{"text":"chats","op":"click"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500340, '{"source":"migrated","origin_id":"chats::chatgpt::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_chatgpt_owen_wallace_servera_free_open-v1', 'b:chatgpt:owen-wallace-servera-free-open', 1, '[{"text":"owen","op":"click"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500346, '{"source":"migrated","origin_id":"owen-wallace-servera-free-open::chatgpt::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_chatgpt_close_sidebar-v1', 'b:chatgpt:close-sidebar', 1, '[{"text":"close","op":"click"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500352, '{"source":"migrated","origin_id":"close-sidebar::chatgpt::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_chatgpt_open_project_options_for_timew-v1', 'b:chatgpt:open-project-options-for-timew', 1, '[{"text":"timewatchers","op":"click"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500358, '{"source":"migrated","origin_id":"open-project-options-for-timew::chatgpt::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_chatgpt_open_project_options_for_math-v1', 'b:chatgpt:open-project-options-for-math', 1, '[{"text":"math","op":"click"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500364, '{"source":"migrated","origin_id":"open-project-options-for-math::chatgpt::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_star_chat-v1', 'b:claude:star-chat', 1, '[{"op":"click","text":"Star"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500370, '{"source":"migrated","origin_id":"star-chat::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_delete_chat-v1', 'b:claude:delete-chat', 1, '[{"op":"click","text":"Delete"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500375, '{"source":"migrated","origin_id":"delete-chat::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_more_options_for_short_haiku_r-v1', 'b:claude:more-options-for-short-haiku-r', 1, '[{"op":"click","text":"More options for Short haiku request"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500382, '{"source":"migrated","origin_id":"more-options-for-short-haiku-r::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_chatgpt_open_sidebar-v1', 'b:chatgpt:open-sidebar', 1, '[{"op":"click","text":"Open sidebar"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500388, '{"source":"migrated","origin_id":"open-sidebar::chatgpt::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_chatgpt_recents-v1', 'b:chatgpt:recents', 1, '[{"op":"click","text":"Recents"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500394, '{"source":"migrated","origin_id":"recents::chatgpt::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_chatgpt_open_profile_menu-v1', 'b:chatgpt:open-profile-menu', 1, '[{"op":"click","text":"Open profile menu"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500401, '{"source":"migrated","origin_id":"open-profile-menu::chatgpt::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_chatgpt_model_selector-v1', 'b:chatgpt:model-selector', 1, '[{"op":"click","text":"Model selector"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500407, '{"source":"migrated","origin_id":"model-selector::chatgpt::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_chatgpt_add_files_and_more-v1', 'b:chatgpt:add-files-and-more', 1, '[{"op":"click","text":"Add files and more"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500413, '{"source":"migrated","origin_id":"add-files-and-more::chatgpt::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_chatgpt_open_conversation_options-v1', 'b:chatgpt:open-conversation-options', 1, '[{"op":"click","text":"Open conversation options"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500420, '{"source":"migrated","origin_id":"open-conversation-options::chatgpt::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_chatgpt_pin_chat-v1', 'b:chatgpt:pin-chat', 1, '[{"op":"click","text":"Pin chat"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500426, '{"source":"migrated","origin_id":"pin-chat::chatgpt::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_chatgpt_move_to_project-v1', 'b:chatgpt:move-to-project', 1, '[{"op":"click","text":"Move to project"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500431, '{"source":"migrated","origin_id":"move-to-project::chatgpt::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_gemini_todays_date_model_and_account-v1', 'b:gemini:todays-date-model-and-account', 1, '[{"op":"click","text":"Today''s Date, Model, and Account"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500437, '{"source":"migrated","origin_id":"todays-date-model-and-account::gemini::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_gemini_redo-v1', 'b:gemini:redo', 1, '[{"op":"click","text":"Redo"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500443, '{"source":"migrated","origin_id":"redo::gemini::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_open_customize-v1', 'b:claude:open-customize', 1, '[{"op":"click","text":"Customize"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500449, '{"source":"migrated","origin_id":"open-customize::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_open_projects-v1', 'b:claude:open-projects', 1, '[{"op":"click","text":"Proyectos"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500455, '{"source":"migrated","origin_id":"open-projects::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_expand_navigation-v1', 'b:claude:expand-navigation', 1, '[{"op":"click","text":"Expand navigation"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500461, '{"source":"migrated","origin_id":"expand-navigation::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_open_settings-v1', 'b:claude:open-settings', 1, '[{"op":"click","text":"Settings"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500468, '{"source":"migrated","origin_id":"open-settings::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_toggle_web_search-v1', 'b:claude:toggle-web-search', 1, '[{"op":"click","text":"Web"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500475, '{"source":"migrated","origin_id":"toggle-web-search::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_go_back_nav-v1', 'b:claude:go-back-nav', 1, '[{"op":"click","text":"Back"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500487, '{"source":"migrated","origin_id":"go-back-nav::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_open_attach_menu-v1', 'b:claude:open-attach-menu', 1, '[{"op":"click","text":"Add files, connectors, and more"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500493, '{"source":"migrated","origin_id":"open-attach-menu::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_add_skill-v1', 'b:claude:add-skill', 1, '[{"op":"click","text":"Add skill"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500499, '{"source":"migrated","origin_id":"add-skill::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_add_custom_connector-v1', 'b:claude:add-custom-connector', 1, '[{"op":"click","text":"Add custom connector"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500505, '{"source":"migrated","origin_id":"add-custom-connector::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_start_new_project-v1', 'b:claude:start-new-project', 1, '[{"op":"click","text":"Start a new project"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500511, '{"source":"migrated","origin_id":"start-new-project::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_select_model_haiku-v1', 'b:claude:select-model-haiku', 1, '[{"op":"click","text":"Haiku"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500518, '{"source":"migrated","origin_id":"select-model-haiku::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}');
INSERT INTO "capability_program" ("id", "binding_id", "version", "steps", "when_clauses", "verify_clauses", "superseded_by", "retired_at", "schema_version", "created_at", "updated_at", "provenance") VALUES
  ('p:mig-b_claude_go_home-v1', 'b:claude:go-home', 1, '[{"op":"click","text":"Claude"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500527, '{"source":"migrated","origin_id":"go-home::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_new_chat_claude-v1', 'b:claude:new-chat-claude', 1, '[{"op":"click","text":"Nueva"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500535, '{"source":"migrated","origin_id":"new-chat-claude::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_select_model_sonnet-v1', 'b:claude:select-model-sonnet', 1, '[{"op":"click","text":"Sonnet 4.6"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500541, '{"source":"migrated","origin_id":"select-model-sonnet::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('p:mig-b_claude_open_more_models-v1', 'b:claude:open-more-models', 1, '[{"op":"click","text":"More models"}]', '[]', '[]', NULL, NULL, 1, 1782868071205, 1783298500547, '{"source":"migrated","origin_id":"open-more-models::claude::v1","meta":{"from":"capabilit-lab/data/actions.json"}}');

-- capability_taxonomy: 253 rows
INSERT INTO "capability_taxonomy" ("id", "slug", "name", "description", "category", "required_affordances", "common_gotchas", "version", "schema_version", "created_at", "updated_at", "provenance") VALUES
  ('t:global:accept-cookies', 'accept-cookies', 'Accept Cookies', 'category: auth; reveal: none', 'auth', '[]', '[]', 1, 1, 1782868069904, 1783298499421, '{"source":"migrated","origin_id":"accept-cookies","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:reject-cookies', 'reject-cookies', 'Reject Cookies', 'category: auth; reveal: none', 'auth', '[]', '[]', 1, 1, 1782868069904, 1783298499428, '{"source":"migrated","origin_id":"reject-cookies","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:customize-cookies', 'customize-cookies', 'Customize Cookies', 'category: auth; reveal: dialog', 'auth', '[]', '[]', 1, 1, 1782868069904, 1783298499433, '{"source":"migrated","origin_id":"customize-cookies","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:login-google', 'login-google', 'Login Google', 'category: auth; reveal: external', 'auth', '[]', '[]', 1, 1, 1782868069904, 1783298499438, '{"source":"migrated","origin_id":"login-google","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:login-email', 'login-email', 'Login Email', 'category: auth; reveal: navigation; slots: [object Object]', 'auth', '[]', '[]', 1, 1, 1782868069904, 1783298499443, '{"source":"migrated","origin_id":"login-email","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:login-apple', 'login-apple', 'Login Apple', 'category: auth; reveal: external', 'auth', '[]', '[]', 1, 1, 1782868069904, 1783298499445, '{"source":"migrated","origin_id":"login-apple","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:login-microsoft', 'login-microsoft', 'Login Microsoft', 'category: auth; reveal: external', 'auth', '[]', '[]', 1, 1, 1782868069904, 1783298499447, '{"source":"migrated","origin_id":"login-microsoft","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:login-sso', 'login-sso', 'Login Sso', 'category: auth; reveal: navigation', 'auth', '[]', '[]', 1, 1, 1782868069904, 1783298499449, '{"source":"migrated","origin_id":"login-sso","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:verify-email-code', 'verify-email-code', 'Verify Email Code', 'category: auth; reveal: navigation; slots: [object Object]', 'auth', '[]', '[]', 1, 1, 1782868069904, 1783298499452, '{"source":"migrated","origin_id":"verify-email-code","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:solve-captcha', 'solve-captcha', 'Solve Captcha', 'category: auth; reveal: dialog', 'auth', '[]', '[]', 1, 1, 1782868069904, 1783298499454, '{"source":"migrated","origin_id":"solve-captcha","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:logout', 'logout', 'Logout', 'category: auth; reveal: navigation', 'auth', '[]', '["risk: destructive — never auto-trigger"]', 1, 1, 1782868069904, 1783298499456, '{"source":"migrated","origin_id":"logout","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:switch-account', 'switch-account', 'Switch Account', 'category: auth; reveal: menu', 'auth', '[]', '[]', 1, 1, 1782868069904, 1783298499461, '{"source":"migrated","origin_id":"switch-account","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:dismiss-onboarding', 'dismiss-onboarding', 'Dismiss Onboarding', 'category: onboarding; reveal: none', 'onboarding', '[]', '[]', 1, 1, 1782868069904, 1783298499466, '{"source":"migrated","origin_id":"dismiss-onboarding","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:skip-tour', 'skip-tour', 'Skip Tour', 'category: onboarding; reveal: none', 'onboarding', '[]', '[]', 1, 1, 1782868069904, 1783298499471, '{"source":"migrated","origin_id":"skip-tour","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:accept-terms', 'accept-terms', 'Accept Terms', 'category: onboarding; reveal: none', 'onboarding', '[]', '[]', 1, 1, 1782868069904, 1783298499476, '{"source":"migrated","origin_id":"accept-terms","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:decline-terms', 'decline-terms', 'Decline Terms', 'category: onboarding; reveal: none', 'onboarding', '[]', '["risk: destructive — never auto-trigger"]', 1, 1, 1782868069904, 1783298499478, '{"source":"migrated","origin_id":"decline-terms","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:enable-memory', 'enable-memory', 'Enable Memory', 'category: onboarding; reveal: none', 'onboarding', '[]', '[]', 1, 1, 1782868069904, 1783298499480, '{"source":"migrated","origin_id":"enable-memory","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:disable-memory', 'disable-memory', 'Disable Memory', 'category: onboarding; reveal: none', 'onboarding', '[]', '[]', 1, 1, 1782868069904, 1783298499482, '{"source":"migrated","origin_id":"disable-memory","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:dismiss-banner', 'dismiss-banner', 'Dismiss Banner', 'category: onboarding; reveal: none', 'onboarding', '[]', '[]', 1, 1, 1782868069904, 1783298499484, '{"source":"migrated","origin_id":"dismiss-banner","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:close-whats-new', 'close-whats-new', 'Close Whats New', 'category: onboarding; reveal: none', 'onboarding', '[]', '[]', 1, 1, 1782868069904, 1783298499486, '{"source":"migrated","origin_id":"close-whats-new","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:compose-prompt', 'compose-prompt', 'Compose Prompt', 'category: compose; reveal: none; slots: [object Object]', 'compose', '[]', '[]', 1, 1, 1782868069904, 1783298499488, '{"source":"migrated","origin_id":"compose-prompt","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:send-prompt', 'send-prompt', 'Send Prompt', 'category: compose; reveal: submit', 'compose', '[]', '[]', 1, 1, 1782868069904, 1783298499490, '{"source":"migrated","origin_id":"send-prompt","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:stop-generation', 'stop-generation', 'Stop Generation', 'category: compose; reveal: none', 'compose', '[]', '[]', 1, 1, 1782868069904, 1783298499492, '{"source":"migrated","origin_id":"stop-generation","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:clear-composer', 'clear-composer', 'Clear Composer', 'category: compose; reveal: none', 'compose', '[]', '[]', 1, 1, 1782868069904, 1783298499494, '{"source":"migrated","origin_id":"clear-composer","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:attach-file', 'attach-file', 'Attach File', 'category: compose; reveal: dialog', 'compose', '[]', '[]', 1, 1, 1782868069904, 1783298499496, '{"source":"migrated","origin_id":"attach-file","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:attach-image', 'attach-image', 'Attach Image', 'category: compose; reveal: dialog', 'compose', '[]', '[]', 1, 1, 1782868069904, 1783298499498, '{"source":"migrated","origin_id":"attach-image","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:attach-pdf', 'attach-pdf', 'Attach Pdf', 'category: compose; reveal: dialog', 'compose', '[]', '[]', 1, 1, 1782868069904, 1783298499499, '{"source":"migrated","origin_id":"attach-pdf","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:attach-folder', 'attach-folder', 'Attach Folder', 'category: compose; reveal: dialog', 'compose', '[]', '[]', 1, 1, 1782868069904, 1783298499501, '{"source":"migrated","origin_id":"attach-folder","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:attach-from-drive', 'attach-from-drive', 'Attach From Drive', 'category: compose; reveal: dialog', 'compose', '[]', '[]', 1, 1, 1782868069904, 1783298499503, '{"source":"migrated","origin_id":"attach-from-drive","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:attach-from-connector', 'attach-from-connector', 'Attach From Connector', 'category: compose; reveal: menu; slots: [object Object]', 'compose', '[]', '[]', 1, 1, 1782868069904, 1783298499505, '{"source":"migrated","origin_id":"attach-from-connector","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:paste-image', 'paste-image', 'Paste Image', 'category: compose; reveal: none', 'compose', '[]', '[]', 1, 1, 1782868069904, 1783298499507, '{"source":"migrated","origin_id":"paste-image","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:voice-input', 'voice-input', 'Voice Input', 'category: compose; reveal: toggle', 'compose', '[]', '[]', 1, 1, 1782868069904, 1783298499509, '{"source":"migrated","origin_id":"voice-input","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:dictate', 'dictate', 'Dictate', 'category: compose; reveal: toggle', 'compose', '[]', '[]', 1, 1, 1782868069904, 1783298499511, '{"source":"migrated","origin_id":"dictate","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:slash-command', 'slash-command', 'Slash Command', 'category: compose; reveal: menu; slots: [object Object]', 'compose', '[]', '[]', 1, 1, 1782868069904, 1783298499513, '{"source":"migrated","origin_id":"slash-command","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:mention-file', 'mention-file', 'Mention File', 'category: compose; reveal: menu', 'compose', '[]', '[]', 1, 1, 1782868069904, 1783298499515, '{"source":"migrated","origin_id":"mention-file","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:insert-template', 'insert-template', 'Insert Template', 'category: compose; reveal: menu; slots: [object Object]', 'compose', '[]', '[]', 1, 1, 1782868069904, 1783298499517, '{"source":"migrated","origin_id":"insert-template","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:prompt-category', 'prompt-category', 'Prompt Category', 'category: compose; reveal: menu; slots: [object Object]', 'compose', '[]', '[]', 1, 1, 1782868069904, 1783298499524, '{"source":"migrated","origin_id":"prompt-category","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:expand-composer', 'expand-composer', 'Expand Composer', 'category: compose; reveal: toggle', 'compose', '[]', '[]', 1, 1, 1782868069904, 1783298499526, '{"source":"migrated","origin_id":"expand-composer","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:drag-drop-file', 'drag-drop-file', 'Drag Drop File', 'category: compose; reveal: none', 'compose', '[]', '[]', 1, 1, 1782868069904, 1783298499531, '{"source":"migrated","origin_id":"drag-drop-file","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:open-model-menu', 'open-model-menu', 'Open Model Menu', 'category: model; reveal: menu', 'model', '[]', '[]', 1, 1, 1782868069904, 1783298499536, '{"source":"migrated","origin_id":"open-model-menu","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:select-model', 'select-model', 'Select Model', 'category: model; reveal: menu; slots: [object Object]', 'model', '[]', '[]', 1, 1, 1782868069904, 1783298499541, '{"source":"migrated","origin_id":"select-model","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:select-thinking-level', 'select-thinking-level', 'Select Thinking Level', 'category: model; reveal: menu; slots: [object Object]', 'model', '[]', '[]', 1, 1, 1782868069904, 1783298499546, '{"source":"migrated","origin_id":"select-thinking-level","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:set-temperature', 'set-temperature', 'Set Temperature', 'category: model; reveal: panel; slots: [object Object]', 'model', '[]', '[]', 1, 1, 1782868069904, 1783298499548, '{"source":"migrated","origin_id":"set-temperature","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:set-top-p', 'set-top-p', 'Set Top P', 'category: model; reveal: panel; slots: [object Object]', 'model', '[]', '[]', 1, 1, 1782868069904, 1783298499550, '{"source":"migrated","origin_id":"set-top-p","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:set-max-tokens', 'set-max-tokens', 'Set Max Tokens', 'category: model; reveal: panel; slots: [object Object]', 'model', '[]', '[]', 1, 1, 1782868069904, 1783298499552, '{"source":"migrated","origin_id":"set-max-tokens","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:set-system-prompt', 'set-system-prompt', 'Set System Prompt', 'category: model; reveal: panel; slots: [object Object]', 'model', '[]', '[]', 1, 1, 1782868069904, 1783298499554, '{"source":"migrated","origin_id":"set-system-prompt","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:set-custom-instructions', 'set-custom-instructions', 'Set Custom Instructions', 'category: model; reveal: dialog; slots: [object Object]', 'model', '[]', '[]', 1, 1, 1782868069904, 1783298499556, '{"source":"migrated","origin_id":"set-custom-instructions","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:toggle-web-search', 'toggle-web-search', 'Toggle Web Search', 'category: model; reveal: toggle; slots: [object Object]', 'model', '[]', '[]', 1, 1, 1782868069904, 1783298499558, '{"source":"migrated","origin_id":"toggle-web-search","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:toggle-code-interpreter', 'toggle-code-interpreter', 'Toggle Code Interpreter', 'category: model; reveal: toggle; slots: [object Object]', 'model', '[]', '[]', 1, 1, 1782868069904, 1783298499560, '{"source":"migrated","origin_id":"toggle-code-interpreter","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:toggle-tools', 'toggle-tools', 'Toggle Tools', 'category: model; reveal: toggle; slots: [object Object]', 'model', '[]', '[]', 1, 1, 1782868069904, 1783298499562, '{"source":"migrated","origin_id":"toggle-tools","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:toggle-memory', 'toggle-memory', 'Toggle Memory', 'category: model; reveal: toggle; slots: [object Object]', 'model', '[]', '[]', 1, 1, 1782868069904, 1783298499564, '{"source":"migrated","origin_id":"toggle-memory","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:toggle-extended-thinking', 'toggle-extended-thinking', 'Toggle Extended Thinking', 'category: model; reveal: toggle; slots: [object Object]', 'model', '[]', '[]', 1, 1, 1782868069904, 1783298499566, '{"source":"migrated","origin_id":"toggle-extended-thinking","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:toggle-artifacts', 'toggle-artifacts', 'Toggle Artifacts', 'category: model; reveal: toggle; slots: [object Object]', 'model', '[]', '[]', 1, 1, 1782868069904, 1783298499568, '{"source":"migrated","origin_id":"toggle-artifacts","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:toggle-notebooks', 'toggle-notebooks', 'Toggle Notebooks', 'category: model; reveal: toggle; slots: [object Object]', 'model', '[]', '[]', 1, 1, 1782868069904, 1783298499570, '{"source":"migrated","origin_id":"toggle-notebooks","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:select-persona', 'select-persona', 'Select Persona', 'category: model; reveal: menu; slots: [object Object]', 'model', '[]', '[]', 1, 1, 1782868069904, 1783298499572, '{"source":"migrated","origin_id":"select-persona","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:select-style', 'select-style', 'Select Style', 'category: model; reveal: menu; slots: [object Object]', 'model', '[]', '[]', 1, 1, 1782868069904, 1783298499574, '{"source":"migrated","origin_id":"select-style","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:select-output-language', 'select-output-language', 'Select Output Language', 'category: model; reveal: menu; slots: [object Object]', 'model', '[]', '[]', 1, 1, 1782868069904, 1783298499576, '{"source":"migrated","origin_id":"select-output-language","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:select-response-length', 'select-response-length', 'Select Response Length', 'category: model; reveal: menu; slots: [object Object]', 'model', '[]', '[]', 1, 1, 1782868069904, 1783298499578, '{"source":"migrated","origin_id":"select-response-length","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:new-chat', 'new-chat', 'New Chat', 'category: conversation; reveal: navigation', 'conversation', '[]', '[]', 1, 1, 1782868069904, 1783298499579, '{"source":"migrated","origin_id":"new-chat","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:rename-chat', 'rename-chat', 'Rename Chat', 'category: conversation; reveal: inline-expand; slots: [object Object]', 'conversation', '[]', '[]', 1, 1, 1782868069904, 1783298499581, '{"source":"migrated","origin_id":"rename-chat","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:delete-chat', 'delete-chat', 'Delete Chat', 'category: conversation; reveal: dialog', 'conversation', '[]', '["risk: destructive — never auto-trigger"]', 1, 1, 1782868069904, 1783298499583, '{"source":"migrated","origin_id":"delete-chat","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:archive-chat', 'archive-chat', 'Archive Chat', 'category: conversation; reveal: toast', 'conversation', '[]', '[]', 1, 1, 1782868069904, 1783298499585, '{"source":"migrated","origin_id":"archive-chat","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:unarchive-chat', 'unarchive-chat', 'Unarchive Chat', 'category: conversation; reveal: toast', 'conversation', '[]', '[]', 1, 1, 1782868069904, 1783298499587, '{"source":"migrated","origin_id":"unarchive-chat","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:pin-chat', 'pin-chat', 'Pin Chat', 'category: conversation; reveal: none', 'conversation', '[]', '[]', 1, 1, 1782868069904, 1783298499588, '{"source":"migrated","origin_id":"pin-chat","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:unpin-chat', 'unpin-chat', 'Unpin Chat', 'category: conversation; reveal: none', 'conversation', '[]', '[]', 1, 1, 1782868069904, 1783298499590, '{"source":"migrated","origin_id":"unpin-chat","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:duplicate-chat', 'duplicate-chat', 'Duplicate Chat', 'category: conversation; reveal: navigation', 'conversation', '[]', '[]', 1, 1, 1782868069904, 1783298499592, '{"source":"migrated","origin_id":"duplicate-chat","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:search-chats', 'search-chats', 'Search Chats', 'category: conversation; reveal: dialog; slots: [object Object]', 'conversation', '[]', '[]', 1, 1, 1782868069904, 1783298499594, '{"source":"migrated","origin_id":"search-chats","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:filter-chats', 'filter-chats', 'Filter Chats', 'category: conversation; reveal: menu', 'conversation', '[]', '[]', 1, 1, 1782868069904, 1783298499596, '{"source":"migrated","origin_id":"filter-chats","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:sort-chats', 'sort-chats', 'Sort Chats', 'category: conversation; reveal: menu', 'conversation', '[]', '[]', 1, 1, 1782868069904, 1783298499597, '{"source":"migrated","origin_id":"sort-chats","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:open-chat', 'open-chat', 'Open Chat', 'category: conversation; reveal: navigation', 'conversation', '[]', '[]', 1, 1, 1782868069904, 1783298499599, '{"source":"migrated","origin_id":"open-chat","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:branch-chat', 'branch-chat', 'Branch Chat', 'category: conversation; reveal: navigation', 'conversation', '[]', '[]', 1, 1, 1782868069904, 1783298499601, '{"source":"migrated","origin_id":"branch-chat","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:share-chat', 'share-chat', 'Share Chat', 'category: conversation; reveal: dialog', 'conversation', '[]', '[]', 1, 1, 1782868069904, 1783298499603, '{"source":"migrated","origin_id":"share-chat","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:export-chat', 'export-chat', 'Export Chat', 'category: conversation; reveal: menu; slots: [object Object]', 'conversation', '[]', '[]', 1, 1, 1782868069904, 1783298499605, '{"source":"migrated","origin_id":"export-chat","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:move-to-project', 'move-to-project', 'Move To Project', 'category: conversation; reveal: menu; slots: [object Object]', 'conversation', '[]', '[]', 1, 1, 1782868069904, 1783298499606, '{"source":"migrated","origin_id":"move-to-project","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:create-project', 'create-project', 'Create Project', 'category: conversation; reveal: dialog; slots: [object Object]', 'conversation', '[]', '[]', 1, 1, 1782868069904, 1783298499608, '{"source":"migrated","origin_id":"create-project","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:select-project', 'select-project', 'Select Project', 'category: conversation; reveal: menu; slots: [object Object]', 'conversation', '[]', '[]', 1, 1, 1782868069904, 1783298499610, '{"source":"migrated","origin_id":"select-project","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:open-project-menu', 'open-project-menu', 'Open Project Menu', 'category: conversation; reveal: menu', 'conversation', '[]', '[]', 1, 1, 1782868069904, 1783298499611, '{"source":"migrated","origin_id":"open-project-menu","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:open-history', 'open-history', 'Open History', 'category: conversation; reveal: panel', 'conversation', '[]', '[]', 1, 1, 1782868069904, 1783298499613, '{"source":"migrated","origin_id":"open-history","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:copy-message', 'copy-message', 'Copy Message', 'category: message; reveal: toast', 'message', '[]', '[]', 1, 1, 1782868069904, 1783298499615, '{"source":"migrated","origin_id":"copy-message","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:copy-code', 'copy-code', 'Copy Code', 'category: message; reveal: toast', 'message', '[]', '[]', 1, 1, 1782868069904, 1783298499617, '{"source":"migrated","origin_id":"copy-code","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:edit-message', 'edit-message', 'Edit Message', 'category: message; reveal: inline-expand; slots: [object Object]', 'message', '[]', '[]', 1, 1, 1782868069904, 1783298499619, '{"source":"migrated","origin_id":"edit-message","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:resend-message', 'resend-message', 'Resend Message', 'category: message; reveal: submit', 'message', '[]', '[]', 1, 1, 1782868069904, 1783298499620, '{"source":"migrated","origin_id":"resend-message","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:regenerate', 'regenerate', 'Regenerate', 'category: message; reveal: submit', 'message', '[]', '[]', 1, 1, 1782868069904, 1783298499622, '{"source":"migrated","origin_id":"regenerate","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:regenerate-with-model', 'regenerate-with-model', 'Regenerate With Model', 'category: message; reveal: menu; slots: [object Object]', 'message', '[]', '[]', 1, 1, 1782868069904, 1783298499624, '{"source":"migrated","origin_id":"regenerate-with-model","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:continue-generation', 'continue-generation', 'Continue Generation', 'category: message; reveal: submit', 'message', '[]', '[]', 1, 1, 1782868069904, 1783298499625, '{"source":"migrated","origin_id":"continue-generation","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:retry', 'retry', 'Retry', 'category: message; reveal: submit', 'message', '[]', '[]', 1, 1, 1782868069904, 1783298499627, '{"source":"migrated","origin_id":"retry","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:thumbs-up', 'thumbs-up', 'Thumbs Up', 'category: message; reveal: toast', 'message', '[]', '[]', 1, 1, 1782868069904, 1783298499629, '{"source":"migrated","origin_id":"thumbs-up","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:thumbs-down', 'thumbs-down', 'Thumbs Down', 'category: message; reveal: dialog', 'message', '[]', '[]', 1, 1, 1782868069904, 1783298499631, '{"source":"migrated","origin_id":"thumbs-down","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:give-feedback', 'give-feedback', 'Give Feedback', 'category: message; reveal: dialog; slots: [object Object]', 'message', '[]', '[]', 1, 1, 1782868069904, 1783298499632, '{"source":"migrated","origin_id":"give-feedback","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:read-aloud', 'read-aloud', 'Read Aloud', 'category: message; reveal: toggle', 'message', '[]', '[]', 1, 1, 1782868069904, 1783298499634, '{"source":"migrated","origin_id":"read-aloud","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:quote-message', 'quote-message', 'Quote Message', 'category: message; reveal: none', 'message', '[]', '[]', 1, 1, 1782868069904, 1783298499636, '{"source":"migrated","origin_id":"quote-message","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:branch-from-message', 'branch-from-message', 'Branch From Message', 'category: message; reveal: navigation', 'message', '[]', '[]', 1, 1, 1782868069904, 1783298499637, '{"source":"migrated","origin_id":"branch-from-message","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:view-sources', 'view-sources', 'View Sources', 'category: message; reveal: panel', 'message', '[]', '[]', 1, 1, 1782868069904, 1783298499639, '{"source":"migrated","origin_id":"view-sources","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:view-citations', 'view-citations', 'View Citations', 'category: message; reveal: popover', 'message', '[]', '[]', 1, 1, 1782868069904, 1783298499641, '{"source":"migrated","origin_id":"view-citations","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:expand-thinking', 'expand-thinking', 'Expand Thinking', 'category: message; reveal: inline-expand', 'message', '[]', '[]', 1, 1, 1782868069904, 1783298499642, '{"source":"migrated","origin_id":"expand-thinking","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:collapse-thinking', 'collapse-thinking', 'Collapse Thinking', 'category: message; reveal: inline-expand', 'message', '[]', '[]', 1, 1, 1782868069904, 1783298499644, '{"source":"migrated","origin_id":"collapse-thinking","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:view-token-usage', 'view-token-usage', 'View Token Usage', 'category: message; reveal: popover', 'message', '[]', '[]', 1, 1, 1782868069904, 1783298499646, '{"source":"migrated","origin_id":"view-token-usage","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:translate-message', 'translate-message', 'Translate Message', 'category: message; reveal: menu; slots: [object Object]', 'message', '[]', '[]', 1, 1, 1782868069904, 1783298499648, '{"source":"migrated","origin_id":"translate-message","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:pin-message', 'pin-message', 'Pin Message', 'category: message; reveal: none', 'message', '[]', '[]', 1, 1, 1782868069904, 1783298499650, '{"source":"migrated","origin_id":"pin-message","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:bookmark-message', 'bookmark-message', 'Bookmark Message', 'category: message; reveal: none', 'message', '[]', '[]', 1, 1, 1782868069904, 1783298499652, '{"source":"migrated","origin_id":"bookmark-message","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}');
INSERT INTO "capability_taxonomy" ("id", "slug", "name", "description", "category", "required_affordances", "common_gotchas", "version", "schema_version", "created_at", "updated_at", "provenance") VALUES
  ('t:global:report-message', 'report-message', 'Report Message', 'category: message; reveal: dialog', 'message', '[]', '[]', 1, 1, 1782868069904, 1783298499655, '{"source":"migrated","origin_id":"report-message","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:open-artifact', 'open-artifact', 'Open Artifact', 'category: artifact; reveal: panel', 'artifact', '[]', '[]', 1, 1, 1782868069904, 1783298499658, '{"source":"migrated","origin_id":"open-artifact","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:close-artifact', 'close-artifact', 'Close Artifact', 'category: artifact; reveal: panel', 'artifact', '[]', '[]', 1, 1, 1782868069904, 1783298499660, '{"source":"migrated","origin_id":"close-artifact","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:edit-artifact', 'edit-artifact', 'Edit Artifact', 'category: artifact; reveal: inline-expand; slots: [object Object]', 'artifact', '[]', '[]', 1, 1, 1782868069904, 1783298499661, '{"source":"migrated","origin_id":"edit-artifact","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:run-code', 'run-code', 'Run Code', 'category: artifact; reveal: inline-expand', 'artifact', '[]', '[]', 1, 1, 1782868069904, 1783298499663, '{"source":"migrated","origin_id":"run-code","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:stop-code', 'stop-code', 'Stop Code', 'category: artifact; reveal: none', 'artifact', '[]', '[]', 1, 1, 1782868069904, 1783298499665, '{"source":"migrated","origin_id":"stop-code","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:copy-artifact', 'copy-artifact', 'Copy Artifact', 'category: artifact; reveal: toast', 'artifact', '[]', '[]', 1, 1, 1782868069904, 1783298499667, '{"source":"migrated","origin_id":"copy-artifact","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:download-artifact', 'download-artifact', 'Download Artifact', 'category: artifact; reveal: none', 'artifact', '[]', '[]', 1, 1, 1782868069904, 1783298499668, '{"source":"migrated","origin_id":"download-artifact","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:artifact-version-history', 'artifact-version-history', 'Artifact Version History', 'category: artifact; reveal: menu', 'artifact', '[]', '[]', 1, 1, 1782868069904, 1783298499670, '{"source":"migrated","origin_id":"artifact-version-history","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:revert-artifact', 'revert-artifact', 'Revert Artifact', 'category: artifact; reveal: dialog', 'artifact', '[]', '["risk: destructive — never auto-trigger"]', 1, 1, 1782868069904, 1783298499672, '{"source":"migrated","origin_id":"revert-artifact","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:preview-artifact', 'preview-artifact', 'Preview Artifact', 'category: artifact; reveal: toggle', 'artifact', '[]', '[]', 1, 1, 1782868069904, 1783298499675, '{"source":"migrated","origin_id":"preview-artifact","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:fullscreen-artifact', 'fullscreen-artifact', 'Fullscreen Artifact', 'category: artifact; reveal: toggle', 'artifact', '[]', '[]', 1, 1, 1782868069904, 1783298499677, '{"source":"migrated","origin_id":"fullscreen-artifact","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:publish-artifact', 'publish-artifact', 'Publish Artifact', 'category: artifact; reveal: dialog', 'artifact', '[]', '[]', 1, 1, 1782868069904, 1783298499679, '{"source":"migrated","origin_id":"publish-artifact","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:fork-artifact', 'fork-artifact', 'Fork Artifact', 'category: artifact; reveal: navigation', 'artifact', '[]', '[]', 1, 1, 1782868069904, 1783298499681, '{"source":"migrated","origin_id":"fork-artifact","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:open-canvas', 'open-canvas', 'Open Canvas', 'category: artifact; reveal: panel', 'artifact', '[]', '[]', 1, 1, 1782868069904, 1783298499682, '{"source":"migrated","origin_id":"open-canvas","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:canvas-comment', 'canvas-comment', 'Canvas Comment', 'category: artifact; reveal: popover', 'artifact', '[]', '[]', 1, 1, 1782868069904, 1783298499684, '{"source":"migrated","origin_id":"canvas-comment","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:canvas-suggest-edit', 'canvas-suggest-edit', 'Canvas Suggest Edit', 'category: artifact; reveal: inline-expand', 'artifact', '[]', '[]', 1, 1, 1782868069904, 1783298499686, '{"source":"migrated","origin_id":"canvas-suggest-edit","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:open-settings', 'open-settings', 'Open Settings', 'category: account; reveal: dialog', 'account', '[]', '[]', 1, 1, 1782868069904, 1783298499688, '{"source":"migrated","origin_id":"open-settings","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:open-profile', 'open-profile', 'Open Profile', 'category: account; reveal: menu', 'account', '[]', '[]', 1, 1, 1782868069904, 1783298499690, '{"source":"migrated","origin_id":"open-profile","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:edit-profile', 'edit-profile', 'Edit Profile', 'category: account; reveal: dialog', 'account', '[]', '[]', 1, 1, 1782868069904, 1783298499692, '{"source":"migrated","origin_id":"edit-profile","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:open-billing', 'open-billing', 'Open Billing', 'category: account; reveal: navigation', 'account', '[]', '[]', 1, 1, 1782868069904, 1783298499693, '{"source":"migrated","origin_id":"open-billing","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:upgrade-plan', 'upgrade-plan', 'Upgrade Plan', 'category: account; reveal: navigation', 'account', '[]', '["risk: destructive — never auto-trigger"]', 1, 1, 1782868069904, 1783298499695, '{"source":"migrated","origin_id":"upgrade-plan","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:downgrade-plan', 'downgrade-plan', 'Downgrade Plan', 'category: account; reveal: dialog', 'account', '[]', '["risk: destructive — never auto-trigger"]', 1, 1, 1782868069904, 1783298499697, '{"source":"migrated","origin_id":"downgrade-plan","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:manage-subscription', 'manage-subscription', 'Manage Subscription', 'category: account; reveal: navigation', 'account', '[]', '[]', 1, 1, 1782868069904, 1783298499699, '{"source":"migrated","origin_id":"manage-subscription","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:open-data-controls', 'open-data-controls', 'Open Data Controls', 'category: account; reveal: dialog', 'account', '[]', '[]', 1, 1, 1782868069904, 1783298499701, '{"source":"migrated","origin_id":"open-data-controls","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:clear-history', 'clear-history', 'Clear History', 'category: account; reveal: dialog', 'account', '[]', '["risk: destructive — never auto-trigger"]', 1, 1, 1782868069904, 1783298499703, '{"source":"migrated","origin_id":"clear-history","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:export-data', 'export-data', 'Export Data', 'category: account; reveal: dialog', 'account', '[]', '[]', 1, 1, 1782868069904, 1783298499705, '{"source":"migrated","origin_id":"export-data","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:delete-account', 'delete-account', 'Delete Account', 'category: account; reveal: dialog', 'account', '[]', '["risk: destructive — never auto-trigger"]', 1, 1, 1782868069904, 1783298499707, '{"source":"migrated","origin_id":"delete-account","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:manage-api-keys', 'manage-api-keys', 'Manage Api Keys', 'category: account; reveal: navigation', 'account', '[]', '[]', 1, 1, 1782868069904, 1783298499709, '{"source":"migrated","origin_id":"manage-api-keys","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:manage-connectors', 'manage-connectors', 'Manage Connectors', 'category: account; reveal: dialog; slots: [object Object]', 'account', '[]', '[]', 1, 1, 1782868069904, 1783298499711, '{"source":"migrated","origin_id":"manage-connectors","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:manage-integrations', 'manage-integrations', 'Manage Integrations', 'category: account; reveal: dialog', 'account', '[]', '[]', 1, 1, 1782868069904, 1783298499713, '{"source":"migrated","origin_id":"manage-integrations","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:toggle-theme', 'toggle-theme', 'Toggle Theme', 'category: account; reveal: toggle; slots: [object Object]', 'account', '[]', '[]', 1, 1, 1782868069904, 1783298499715, '{"source":"migrated","origin_id":"toggle-theme","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:set-language', 'set-language', 'Set Language', 'category: account; reveal: menu; slots: [object Object]', 'account', '[]', '[]', 1, 1, 1782868069904, 1783298499717, '{"source":"migrated","origin_id":"set-language","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:notification-settings', 'notification-settings', 'Notification Settings', 'category: account; reveal: dialog', 'account', '[]', '[]', 1, 1, 1782868069904, 1783298499718, '{"source":"migrated","origin_id":"notification-settings","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:privacy-settings', 'privacy-settings', 'Privacy Settings', 'category: account; reveal: dialog', 'account', '[]', '[]', 1, 1, 1782868069904, 1783298499720, '{"source":"migrated","origin_id":"privacy-settings","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:security-settings', 'security-settings', 'Security Settings', 'category: account; reveal: dialog', 'account', '[]', '[]', 1, 1, 1782868069904, 1783298499722, '{"source":"migrated","origin_id":"security-settings","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:manage-devices', 'manage-devices', 'Manage Devices', 'category: account; reveal: dialog', 'account', '[]', '[]', 1, 1, 1782868069904, 1783298499724, '{"source":"migrated","origin_id":"manage-devices","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:manage-mfa', 'manage-mfa', 'Manage Mfa', 'category: account; reveal: dialog', 'account', '[]', '[]', 1, 1, 1782868069904, 1783298499726, '{"source":"migrated","origin_id":"manage-mfa","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:contact-support', 'contact-support', 'Contact Support', 'category: account; reveal: external', 'account', '[]', '[]', 1, 1, 1782868069904, 1783298499727, '{"source":"migrated","origin_id":"contact-support","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:toggle-sidebar', 'toggle-sidebar', 'Toggle Sidebar', 'category: nav; reveal: panel; slots: [object Object]', 'nav', '[]', '[]', 1, 1, 1782868069904, 1783298499729, '{"source":"migrated","origin_id":"toggle-sidebar","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:toggle-recents', 'toggle-recents', 'Toggle Recents', 'category: nav; reveal: panel; slots: [object Object]', 'nav', '[]', '[]', 1, 1, 1782868069904, 1783298499731, '{"source":"migrated","origin_id":"toggle-recents","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:collapse-sidebar', 'collapse-sidebar', 'Collapse Sidebar', 'category: nav; reveal: panel', 'nav', '[]', '[]', 1, 1, 1782868069904, 1783298499733, '{"source":"migrated","origin_id":"collapse-sidebar","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:open-search', 'open-search', 'Open Search', 'category: nav; reveal: dialog; slots: [object Object]', 'nav', '[]', '[]', 1, 1, 1782868069904, 1783298499735, '{"source":"migrated","origin_id":"open-search","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:open-command-palette', 'open-command-palette', 'Open Command Palette', 'category: nav; reveal: dialog', 'nav', '[]', '[]', 1, 1, 1782868069904, 1783298499738, '{"source":"migrated","origin_id":"open-command-palette","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:open-shortcuts', 'open-shortcuts', 'Open Shortcuts', 'category: nav; reveal: dialog', 'nav', '[]', '[]', 1, 1, 1782868069904, 1783298499740, '{"source":"migrated","origin_id":"open-shortcuts","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:open-help', 'open-help', 'Open Help', 'category: nav; reveal: menu', 'nav', '[]', '[]', 1, 1, 1782868069904, 1783298499742, '{"source":"migrated","origin_id":"open-help","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:open-docs', 'open-docs', 'Open Docs', 'category: nav; reveal: external', 'nav', '[]', '[]', 1, 1, 1782868069904, 1783298499744, '{"source":"migrated","origin_id":"open-docs","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:open-changelog', 'open-changelog', 'Open Changelog', 'category: nav; reveal: dialog', 'nav', '[]', '[]', 1, 1, 1782868069904, 1783298499746, '{"source":"migrated","origin_id":"open-changelog","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:scroll-to-bottom', 'scroll-to-bottom', 'Scroll To Bottom', 'category: nav; reveal: none', 'nav', '[]', '[]', 1, 1, 1782868069904, 1783298499748, '{"source":"migrated","origin_id":"scroll-to-bottom","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:scroll-to-top', 'scroll-to-top', 'Scroll To Top', 'category: nav; reveal: none', 'nav', '[]', '[]', 1, 1, 1782868069904, 1783298499749, '{"source":"migrated","origin_id":"scroll-to-top","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:load-more', 'load-more', 'Load More', 'category: nav; reveal: inline-expand', 'nav', '[]', '[]', 1, 1, 1782868069904, 1783298499751, '{"source":"migrated","origin_id":"load-more","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:next-page', 'next-page', 'Next Page', 'category: nav; reveal: navigation', 'nav', '[]', '[]', 1, 1, 1782868069904, 1783298499753, '{"source":"migrated","origin_id":"next-page","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:prev-page', 'prev-page', 'Prev Page', 'category: nav; reveal: navigation', 'nav', '[]', '[]', 1, 1, 1782868069904, 1783298499758, '{"source":"migrated","origin_id":"prev-page","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:tab-switch', 'tab-switch', 'Tab Switch', 'category: nav; reveal: toggle; slots: [object Object]', 'nav', '[]', '[]', 1, 1, 1782868069904, 1783298499760, '{"source":"migrated","origin_id":"tab-switch","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:go-back', 'go-back', 'Go Back', 'category: nav; reveal: navigation', 'nav', '[]', '[]', 1, 1, 1782868069904, 1783298499762, '{"source":"migrated","origin_id":"go-back","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:go-forward', 'go-forward', 'Go Forward', 'category: nav; reveal: navigation', 'nav', '[]', '[]', 1, 1, 1782868069904, 1783298499764, '{"source":"migrated","origin_id":"go-forward","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:share-link', 'share-link', 'Share Link', 'category: collab; reveal: dialog', 'collab', '[]', '[]', 1, 1, 1782868069904, 1783298499765, '{"source":"migrated","origin_id":"share-link","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:copy-share-link', 'copy-share-link', 'Copy Share Link', 'category: collab; reveal: toast', 'collab', '[]', '[]', 1, 1, 1782868069904, 1783298499767, '{"source":"migrated","origin_id":"copy-share-link","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:invite-member', 'invite-member', 'Invite Member', 'category: collab; reveal: dialog; slots: [object Object]', 'collab', '[]', '[]', 1, 1, 1782868069904, 1783298499769, '{"source":"migrated","origin_id":"invite-member","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:manage-permissions', 'manage-permissions', 'Manage Permissions', 'category: collab; reveal: menu; slots: [object Object]', 'collab', '[]', '[]', 1, 1, 1782868069904, 1783298499771, '{"source":"migrated","origin_id":"manage-permissions","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:publish-public', 'publish-public', 'Publish Public', 'category: collab; reveal: dialog', 'collab', '[]', '[]', 1, 1, 1782868069904, 1783298499773, '{"source":"migrated","origin_id":"publish-public","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:unpublish', 'unpublish', 'Unpublish', 'category: collab; reveal: dialog', 'collab', '[]', '["risk: destructive — never auto-trigger"]', 1, 1, 1782868069904, 1783298499775, '{"source":"migrated","origin_id":"unpublish","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:add-comment', 'add-comment', 'Add Comment', 'category: collab; reveal: popover; slots: [object Object]', 'collab', '[]', '[]', 1, 1, 1782868069904, 1783298499777, '{"source":"migrated","origin_id":"add-comment","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:resolve-comment', 'resolve-comment', 'Resolve Comment', 'category: collab; reveal: none', 'collab', '[]', '[]', 1, 1, 1782868069904, 1783298499779, '{"source":"migrated","origin_id":"resolve-comment","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:view-activity', 'view-activity', 'View Activity', 'category: collab; reveal: panel', 'collab', '[]', '[]', 1, 1, 1782868069904, 1783298499780, '{"source":"migrated","origin_id":"view-activity","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:transfer-ownership', 'transfer-ownership', 'Transfer Ownership', 'category: collab; reveal: dialog', 'collab', '[]', '["risk: destructive — never auto-trigger"]', 1, 1, 1782868069904, 1783298499782, '{"source":"migrated","origin_id":"transfer-ownership","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:leave-shared', 'leave-shared', 'Leave Shared', 'category: collab; reveal: dialog', 'collab', '[]', '["risk: destructive — never auto-trigger"]', 1, 1, 1782868069904, 1783298499784, '{"source":"migrated","origin_id":"leave-shared","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:confirm-dialog', 'confirm-dialog', 'Confirm Dialog', 'category: dialog; reveal: none', 'dialog', '[]', '[]', 1, 1, 1782868069904, 1783298499786, '{"source":"migrated","origin_id":"confirm-dialog","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:cancel-dialog', 'cancel-dialog', 'Cancel Dialog', 'category: dialog; reveal: none', 'dialog', '[]', '[]', 1, 1, 1782868069904, 1783298499788, '{"source":"migrated","origin_id":"cancel-dialog","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:close-dialog', 'close-dialog', 'Close Dialog', 'category: dialog; reveal: none', 'dialog', '[]', '[]', 1, 1, 1782868069904, 1783298499790, '{"source":"migrated","origin_id":"close-dialog","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:accept-modal', 'accept-modal', 'Accept Modal', 'category: dialog; reveal: none', 'dialog', '[]', '[]', 1, 1, 1782868069904, 1783298499792, '{"source":"migrated","origin_id":"accept-modal","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:dismiss-modal', 'dismiss-modal', 'Dismiss Modal', 'category: dialog; reveal: none', 'dialog', '[]', '[]', 1, 1, 1782868069904, 1783298499793, '{"source":"migrated","origin_id":"dismiss-modal","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:dismiss-toast', 'dismiss-toast', 'Dismiss Toast', 'category: dialog; reveal: none', 'dialog', '[]', '[]', 1, 1, 1782868069904, 1783298499795, '{"source":"migrated","origin_id":"dismiss-toast","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:dismiss-tooltip', 'dismiss-tooltip', 'Dismiss Tooltip', 'category: dialog; reveal: none', 'dialog', '[]', '[]', 1, 1, 1782868069904, 1783298499797, '{"source":"migrated","origin_id":"dismiss-tooltip","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:expand-accordion', 'expand-accordion', 'Expand Accordion', 'category: dialog; reveal: inline-expand', 'dialog', '[]', '[]', 1, 1, 1782868069904, 1783298499799, '{"source":"migrated","origin_id":"expand-accordion","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:undo', 'undo', 'Undo', 'category: dialog; reveal: toast', 'dialog', '[]', '[]', 1, 1, 1782868069904, 1783298499801, '{"source":"migrated","origin_id":"undo","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:redo', 'redo', 'Redo', 'category: dialog; reveal: toast', 'dialog', '[]', '[]', 1, 1, 1782868069904, 1783298499802, '{"source":"migrated","origin_id":"redo","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:save', 'save', 'Save', 'category: dialog; reveal: toast', 'dialog', '[]', '[]', 1, 1, 1782868069904, 1783298499804, '{"source":"migrated","origin_id":"save","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:discard', 'discard', 'Discard', 'category: dialog; reveal: dialog', 'dialog', '[]', '["risk: destructive — never auto-trigger"]', 1, 1, 1782868069904, 1783298499806, '{"source":"migrated","origin_id":"discard","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:retry-network', 'retry-network', 'Retry Network', 'category: dialog; reveal: none', 'dialog', '[]', '[]', 1, 1, 1782868069904, 1783298499808, '{"source":"migrated","origin_id":"retry-network","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:reload', 'reload', 'Reload', 'category: dialog; reveal: navigation', 'dialog', '[]', '[]', 1, 1, 1782868069904, 1783298499810, '{"source":"migrated","origin_id":"reload","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:zoom-in', 'zoom-in', 'Zoom In', 'category: misc; reveal: none', 'misc', '[]', '[]', 1, 1, 1782868069904, 1783298499812, '{"source":"migrated","origin_id":"zoom-in","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:zoom-out', 'zoom-out', 'Zoom Out', 'category: misc; reveal: none', 'misc', '[]', '[]', 1, 1, 1782868069904, 1783298499813, '{"source":"migrated","origin_id":"zoom-out","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:enter-fullscreen', 'enter-fullscreen', 'Enter Fullscreen', 'category: misc; reveal: toggle', 'misc', '[]', '[]', 1, 1, 1782868069904, 1783298499815, '{"source":"migrated","origin_id":"enter-fullscreen","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:exit-fullscreen', 'exit-fullscreen', 'Exit Fullscreen', 'category: misc; reveal: toggle', 'misc', '[]', '[]', 1, 1, 1782868069904, 1783298499817, '{"source":"migrated","origin_id":"exit-fullscreen","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:download-file', 'download-file', 'Download File', 'category: misc; reveal: none', 'misc', '[]', '[]', 1, 1, 1782868069904, 1783298499819, '{"source":"migrated","origin_id":"download-file","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:upload-file', 'upload-file', 'Upload File', 'category: misc; reveal: dialog', 'misc', '[]', '[]', 1, 1, 1782868069904, 1783298499821, '{"source":"migrated","origin_id":"upload-file","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:drag-reorder', 'drag-reorder', 'Drag Reorder', 'category: misc; reveal: none', 'misc', '[]', '[]', 1, 1, 1782868069904, 1783298499822, '{"source":"migrated","origin_id":"drag-reorder","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:multi-select', 'multi-select', 'Multi Select', 'category: misc; reveal: none', 'misc', '[]', '[]', 1, 1, 1782868069904, 1783298499824, '{"source":"migrated","origin_id":"multi-select","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:select-all', 'select-all', 'Select All', 'category: misc; reveal: none', 'misc', '[]', '[]', 1, 1, 1782868069904, 1783298499826, '{"source":"migrated","origin_id":"select-all","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:deselect-all', 'deselect-all', 'Deselect All', 'category: misc; reveal: none', 'misc', '[]', '[]', 1, 1, 1782868069904, 1783298499827, '{"source":"migrated","origin_id":"deselect-all","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:open-context-menu', 'open-context-menu', 'Open Context Menu', 'category: misc; reveal: menu', 'misc', '[]', '[]', 1, 1, 1782868069904, 1783298499829, '{"source":"migrated","origin_id":"open-context-menu","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:hover-preview', 'hover-preview', 'Hover Preview', 'category: misc; reveal: popover', 'misc', '[]', '[]', 1, 1, 1782868069904, 1783298499831, '{"source":"migrated","origin_id":"hover-preview","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:keyboard-submit', 'keyboard-submit', 'Keyboard Submit', 'category: misc; reveal: submit', 'misc', '[]', '[]', 1, 1, 1782868069904, 1783298499832, '{"source":"migrated","origin_id":"keyboard-submit","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:paste', 'paste', 'Paste', 'category: misc; reveal: none', 'misc', '[]', '[]', 1, 1, 1782868069904, 1783298499834, '{"source":"migrated","origin_id":"paste","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:copy', 'copy', 'Copy', 'category: misc; reveal: toast', 'misc', '[]', '[]', 1, 1, 1782868069904, 1783298499836, '{"source":"migrated","origin_id":"copy","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:cut', 'cut', 'Cut', 'category: misc; reveal: none', 'misc', '[]', '[]', 1, 1, 1782868069904, 1783298499837, '{"source":"migrated","origin_id":"cut","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:refresh-data', 'refresh-data', 'Refresh Data', 'category: misc; reveal: none', 'misc', '[]', '[]', 1, 1, 1782868069904, 1783298499839, '{"source":"migrated","origin_id":"refresh-data","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:filter-results', 'filter-results', 'Filter Results', 'category: misc; reveal: menu', 'misc', '[]', '[]', 1, 1, 1782868069904, 1783298499841, '{"source":"migrated","origin_id":"filter-results","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:sort-results', 'sort-results', 'Sort Results', 'category: misc; reveal: menu', 'misc', '[]', '[]', 1, 1, 1782868069904, 1783298499843, '{"source":"migrated","origin_id":"sort-results","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}');
INSERT INTO "capability_taxonomy" ("id", "slug", "name", "description", "category", "required_affordances", "common_gotchas", "version", "schema_version", "created_at", "updated_at", "provenance") VALUES
  ('t:global:rate-app', 'rate-app', 'Rate App', 'category: misc; reveal: dialog', 'misc', '[]', '[]', 1, 1, 1782868069904, 1783298499844, '{"source":"migrated","origin_id":"rate-app","meta":{"from":"capabilit-lab/data/taxonomy/globals.json"}}'),
  ('t:global:use-memory-ai-chat', 'use-memory-ai-chat', 'use-memory-ai-chat', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868071206, '{"source":"migrated","origin_id":"use-memory-ai-chat","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:open-thinking-menu', 'open-thinking-menu', 'open-thinking-menu', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868071244, '{"source":"migrated","origin_id":"open-thinking-menu","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:add-files-connectors-and-more', 'add-files-connectors-and-more', 'add-files-connectors-and-more', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868071255, '{"source":"migrated","origin_id":"add-files-connectors-and-more","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:model-sonnet-46-low', 'model-sonnet-46-low', 'model-sonnet-46-low', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868071264, '{"source":"migrated","origin_id":"model-sonnet-46-low","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:learn-moreopens-in-new-tab', 'learn-moreopens-in-new-tab', 'learn-moreopens-in-new-tab', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868071295, '{"source":"migrated","origin_id":"learn-moreopens-in-new-tab","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:working', 'working', 'working', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868071304, '{"source":"migrated","origin_id":"working","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:more-options-for-test-message', 'more-options-for-test-message', 'more-options-for-test-message', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868071330, '{"source":"migrated","origin_id":"more-options-for-test-message","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:thought-process', 'thought-process', 'thought-process', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868071340, '{"source":"migrated","origin_id":"thought-process","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:more-options-for-prime-number', 'more-options-for-prime-number', 'more-options-for-prime-number-', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868071368, '{"source":"migrated","origin_id":"more-options-for-prime-number-","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:model-haiku-45-extended', 'model-haiku-45-extended', 'model-haiku-45-extended', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868071380, '{"source":"migrated","origin_id":"model-haiku-45-extended","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:more-options-for-ready-to-begi', 'more-options-for-ready-to-begi', 'more-options-for-ready-to-begi', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868071390, '{"source":"migrated","origin_id":"more-options-for-ready-to-begi","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:more', 'more', 'more', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868071584, '{"source":"migrated","origin_id":"more","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:projects', 'projects', 'projects', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868071592, '{"source":"migrated","origin_id":"projects","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:google-account-owen-wallace-se', 'google-account-owen-wallace-se', 'google-account-owen-wallace-se', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868071678, '{"source":"migrated","origin_id":"google-account-owen-wallace-se","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:settings', 'settings', 'settings', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868071689, '{"source":"migrated","origin_id":"settings","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:upload-tools', 'upload-tools', 'upload--tools', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868071719, '{"source":"migrated","origin_id":"upload--tools","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:open-mode-picker-currently-fla', 'open-mode-picker-currently-fla', 'open-mode-picker-currently-fla', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868071746, '{"source":"migrated","origin_id":"open-mode-picker-currently-fla","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:thinking', 'thinking', 'thinking', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868071792, '{"source":"migrated","origin_id":"thinking","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:entertainment', 'entertainment', 'entertainment', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868071875, '{"source":"migrated","origin_id":"entertainment","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:black-box-project', 'black-box-project', 'black-box-project', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868071885, '{"source":"migrated","origin_id":"black-box-project","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:telepathy-research', 'telepathy-research', 'telepathy-research', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868071912, '{"source":"migrated","origin_id":"telepathy-research","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:timewatchers', 'timewatchers', 'timewatchers', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868071929, '{"source":"migrated","origin_id":"timewatchers","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:math', 'math', 'math', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868071949, '{"source":"migrated","origin_id":"math","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:show-more', 'show-more', 'show-more', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868071967, '{"source":"migrated","origin_id":"show-more","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:more-options', 'more-options', 'more-options', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868071975, '{"source":"migrated","origin_id":"more-options","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:chats', 'chats', 'chats', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868072171, '{"source":"migrated","origin_id":"chats","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:owen-wallace-servera-free-open', 'owen-wallace-servera-free-open', 'owen-wallace-servera-free-open', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868072179, '{"source":"migrated","origin_id":"owen-wallace-servera-free-open","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:close-sidebar', 'close-sidebar', 'close-sidebar', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868072190, '{"source":"migrated","origin_id":"close-sidebar","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:open-project-options-for-timew', 'open-project-options-for-timew', 'open-project-options-for-timew', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868072210, '{"source":"migrated","origin_id":"open-project-options-for-timew","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:open-project-options-for-math', 'open-project-options-for-math', 'open-project-options-for-math', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868072218, '{"source":"migrated","origin_id":"open-project-options-for-math","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:star-chat', 'star-chat', 'star-chat', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868072241, '{"source":"migrated","origin_id":"star-chat","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:more-options-for-short-haiku-r', 'more-options-for-short-haiku-r', 'more-options-for-short-haiku-r', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868072256, '{"source":"migrated","origin_id":"more-options-for-short-haiku-r","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:open-sidebar', 'open-sidebar', 'open-sidebar', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868072265, '{"source":"migrated","origin_id":"open-sidebar","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:recents', 'recents', 'recents', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868072332, '{"source":"migrated","origin_id":"recents","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:open-profile-menu', 'open-profile-menu', 'open-profile-menu', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868072340, '{"source":"migrated","origin_id":"open-profile-menu","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:model-selector', 'model-selector', 'model-selector', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868072348, '{"source":"migrated","origin_id":"model-selector","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:add-files-and-more', 'add-files-and-more', 'add-files-and-more', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868072370, '{"source":"migrated","origin_id":"add-files-and-more","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:open-conversation-options', 'open-conversation-options', 'open-conversation-options', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868072382, '{"source":"migrated","origin_id":"open-conversation-options","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:todays-date-model-and-account', 'todays-date-model-and-account', 'todays-date-model-and-account', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868072418, '{"source":"migrated","origin_id":"todays-date-model-and-account","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:open-customize', 'open-customize', 'open-customize', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868072449, '{"source":"migrated","origin_id":"open-customize","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:open-projects', 'open-projects', 'open-projects', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868072458, '{"source":"migrated","origin_id":"open-projects","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:expand-navigation', 'expand-navigation', 'expand-navigation', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868072469, '{"source":"migrated","origin_id":"expand-navigation","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:go-back-nav', 'go-back-nav', 'go-back-nav', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868072505, '{"source":"migrated","origin_id":"go-back-nav","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:open-attach-menu', 'open-attach-menu', 'open-attach-menu', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868072518, '{"source":"migrated","origin_id":"open-attach-menu","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:add-skill', 'add-skill', 'add-skill', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868072541, '{"source":"migrated","origin_id":"add-skill","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:add-custom-connector', 'add-custom-connector', 'add-custom-connector', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868072550, '{"source":"migrated","origin_id":"add-custom-connector","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:start-new-project', 'start-new-project', 'start-new-project', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868072560, '{"source":"migrated","origin_id":"start-new-project","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:select-model-haiku', 'select-model-haiku', 'select-model-haiku', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868072583, '{"source":"migrated","origin_id":"select-model-haiku","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:go-home', 'go-home', 'go-home', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868072602, '{"source":"migrated","origin_id":"go-home","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:new-chat-claude', 'new-chat-claude', 'new-chat-claude', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868072629, '{"source":"migrated","origin_id":"new-chat-claude","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:select-model-sonnet', 'select-model-sonnet', 'select-model-sonnet', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868072638, '{"source":"migrated","origin_id":"select-model-sonnet","meta":{"from":"capabilit-lab/data/actions.json"}}'),
  ('t:global:open-more-models', 'open-more-models', 'open-more-models', 'migrated from actions.json; not in seed catalog', 'uncategorized', '[]', '[]', 1, 1, 1782868071205, 1782868072703, '{"source":"migrated","origin_id":"open-more-models","meta":{"from":"capabilit-lab/data/actions.json"}}');

-- chrome_profile: 4 rows
INSERT INTO "chrome_profile" ("id", "email", "display_name", "user_data_dir", "is_active", "last_used", "created_at") VALUES
  ('cp-backbone-intelligence-advisors-gmail-com', 'backbone.intelligence.advisors@gmail.com', 'Your Chrome', 'C:\Users\VIVIM.inc\AppData\Local\Google\Chrome\User Data\Default', 0, 1783033024963, 1783032234429),
  ('cp-vivim-advisors-gmail-com', 'vivim.advisors@gmail.com', 'Your Chrome', 'C:\Users\VIVIM.inc\AppData\Local\Google\Chrome\User Data\Profile 2', 0, NULL, 1783032234432),
  ('cp-owservera-gmail-com', 'owservera@gmail.com', 'Your Chrome', 'C:\Users\VIVIM.inc\AppData\Local\Google\Chrome\User Data\Profile 3', 1, 1783073254782, 1783032234434),
  ('cp-owen-vivim-love', 'owen@vivim.love', 'vivim.love', 'C:\Users\VIVIM.inc\AppData\Local\Google\Chrome\User Data\Profile 4', 0, NULL, 1783032234436);

-- circuit_breaker_state: (empty)

-- confidence_by_strategy: (empty)

-- confidence_snapshot: (empty)

-- conversation: (empty)

-- discovered_account: 18 rows
INSERT INTO "discovered_account" ("id", "chrome_profile_id", "chrome_profile_email", "chrome_profile_dir", "chrome_profile_display_name", "provider_id", "login_state", "last_scanned", "created_at", "last_login_at") VALUES
  ('da-cp-backbone-intelligence-advisors-gmail-com-claude', 'cp-backbone-intelligence-advisors-gmail-com', 'backbone.intelligence.advisors@gmail.com', 'C:\Users\VIVIM.inc\AppData\Local\Google\Chrome\User Data\Default', 'Your Chrome', 'claude', 'logged_in', 1783288570354, 1783247892986, NULL),
  ('da-cp-backbone-intelligence-advisors-gmail-com-gemini', 'cp-backbone-intelligence-advisors-gmail-com', 'backbone.intelligence.advisors@gmail.com', 'C:\Users\VIVIM.inc\AppData\Local\Google\Chrome\User Data\Default', 'Your Chrome', 'gemini', 'logged_in', 1783288570354, 1783247892993, NULL),
  ('da-cp-backbone-intelligence-advisors-gmail-com-chatgpt', 'cp-backbone-intelligence-advisors-gmail-com', 'backbone.intelligence.advisors@gmail.com', 'C:\Users\VIVIM.inc\AppData\Local\Google\Chrome\User Data\Default', 'Your Chrome', 'chatgpt', 'logged_in', 1783288570354, 1783247892996, NULL),
  ('da-cp-backbone-intelligence-advisors-gmail-com-deepseek', 'cp-backbone-intelligence-advisors-gmail-com', 'backbone.intelligence.advisors@gmail.com', 'C:\Users\VIVIM.inc\AppData\Local\Google\Chrome\User Data\Default', 'Your Chrome', 'deepseek', 'logged_in', 1783288570354, 1783247892998, NULL),
  ('da-cp-backbone-intelligence-advisors-gmail-com-studio-ai', 'cp-backbone-intelligence-advisors-gmail-com', 'backbone.intelligence.advisors@gmail.com', 'C:\Users\VIVIM.inc\AppData\Local\Google\Chrome\User Data\Default', 'Your Chrome', 'studio-ai', 'logged_in', 1783288570354, 1783247893001, NULL),
  ('da-cp-backbone-intelligence-advisors-gmail-com-z-ai', 'cp-backbone-intelligence-advisors-gmail-com', 'backbone.intelligence.advisors@gmail.com', 'C:\Users\VIVIM.inc\AppData\Local\Google\Chrome\User Data\Default', 'Your Chrome', 'z-ai', 'logged_in', 1783288570354, 1783247893005, NULL),
  ('da-cp-vivim-advisors-gmail-com-claude', 'cp-vivim-advisors-gmail-com', 'vivim.advisors@gmail.com', 'C:\Users\VIVIM.inc\AppData\Local\Google\Chrome\User Data\Profile 2', 'Your Chrome', 'claude', 'logged_in', 1783288570354, 1783247893007, NULL),
  ('da-cp-vivim-advisors-gmail-com-gemini', 'cp-vivim-advisors-gmail-com', 'vivim.advisors@gmail.com', 'C:\Users\VIVIM.inc\AppData\Local\Google\Chrome\User Data\Profile 2', 'Your Chrome', 'gemini', 'logged_in', 1783288570354, 1783247893009, NULL),
  ('da-cp-vivim-advisors-gmail-com-chatgpt', 'cp-vivim-advisors-gmail-com', 'vivim.advisors@gmail.com', 'C:\Users\VIVIM.inc\AppData\Local\Google\Chrome\User Data\Profile 2', 'Your Chrome', 'chatgpt', 'logged_in', 1783288570354, 1783247893011, NULL),
  ('da-cp-vivim-advisors-gmail-com-deepseek', 'cp-vivim-advisors-gmail-com', 'vivim.advisors@gmail.com', 'C:\Users\VIVIM.inc\AppData\Local\Google\Chrome\User Data\Profile 2', 'Your Chrome', 'deepseek', 'logged_in', 1783288570354, 1783247893013, NULL),
  ('da-cp-vivim-advisors-gmail-com-studio-ai', 'cp-vivim-advisors-gmail-com', 'vivim.advisors@gmail.com', 'C:\Users\VIVIM.inc\AppData\Local\Google\Chrome\User Data\Profile 2', 'Your Chrome', 'studio-ai', 'logged_in', 1783288570354, 1783247893016, NULL),
  ('da-cp-vivim-advisors-gmail-com-z-ai', 'cp-vivim-advisors-gmail-com', 'vivim.advisors@gmail.com', 'C:\Users\VIVIM.inc\AppData\Local\Google\Chrome\User Data\Profile 2', 'Your Chrome', 'z-ai', 'logged_in', 1783288570354, 1783247893018, NULL),
  ('da-cp-owservera-gmail-com-claude', 'cp-owservera-gmail-com', 'owservera@gmail.com', 'C:\Users\VIVIM.inc\AppData\Local\Google\Chrome\User Data\Profile 3', 'Your Chrome', 'claude', 'logged_in', 1783294790508, 1783247893020, 1783294790508),
  ('da-cp-owservera-gmail-com-gemini', 'cp-owservera-gmail-com', 'owservera@gmail.com', 'C:\Users\VIVIM.inc\AppData\Local\Google\Chrome\User Data\Profile 3', 'Your Chrome', 'gemini', 'logged_in', 1783247892792, 1783247893022, NULL),
  ('da-cp-owservera-gmail-com-chatgpt', 'cp-owservera-gmail-com', 'owservera@gmail.com', 'C:\Users\VIVIM.inc\AppData\Local\Google\Chrome\User Data\Profile 3', 'Your Chrome', 'chatgpt', 'logged_in', 1783301388042, 1783247893026, 1783301388041),
  ('da-cp-owservera-gmail-com-deepseek', 'cp-owservera-gmail-com', 'owservera@gmail.com', 'C:\Users\VIVIM.inc\AppData\Local\Google\Chrome\User Data\Profile 3', 'Your Chrome', 'deepseek', 'logged_in', 1783247892792, 1783247893029, NULL),
  ('da-cp-owservera-gmail-com-qwen', 'cp-owservera-gmail-com', 'owservera@gmail.com', 'C:\Users\VIVIM.inc\AppData\Local\Google\Chrome\User Data\Profile 3', 'Your Chrome', 'qwen', 'logged_in', 1783247892792, 1783247893031, NULL),
  ('da-cp-owservera-gmail-com-z-ai', 'cp-owservera-gmail-com', 'owservera@gmail.com', 'C:\Users\VIVIM.inc\AppData\Local\Google\Chrome\User Data\Profile 3', 'Your Chrome', 'z-ai', 'logged_in', 1783247892792, 1783247893033, NULL);

-- discovery_objective: (empty)

-- drift_event: (empty)

-- endpoint: (empty)

-- failure_classification: (empty)

-- fleet_event: 173 rows
INSERT INTO "fleet_event" ("id", "event", "payload", "created_at") VALUES
  ('fe-1783085096535-y7yi2k32i2p', 'fleet.slave.starting', '{"providerId":"claude","slaveId":"fs-1783085096515-0r2pz0khjgg","cdpPort":9224}', 1783085096535),
  ('fe-1783085097609-d3mkxqfdfy9', 'fleet.slave.running', '{"providerId":"claude","slaveId":"fs-1783085096515-0r2pz0khjgg","cdpPort":9224,"pid":9584}', 1783085097609),
  ('fe-1783086564843-wa87spsuupn', 'fleet.slave.dead', '{"providerId":"claude","slaveId":"fs-1783085096515-0r2pz0khjgg"}', 1783086564844),
  ('fe-1783086564847-2i68si4tmb7', 'fleet.slave.restarting', '{"providerId":"claude","retry":1,"backoffMs":5000}', 1783086564847),
  ('fe-1783086569861-q9e3lvmmlzj', 'fleet.slave.starting', '{"providerId":"claude","slaveId":"fs-1783085096515-0r2pz0khjgg","cdpPort":9224}', 1783086569861),
  ('fe-1783086570777-zcgdsx0li2', 'fleet.slave.running', '{"providerId":"claude","slaveId":"fs-1783085096515-0r2pz0khjgg","cdpPort":9224,"pid":15312}', 1783086570777),
  ('fe-1783086570793-qpi02xogmds', 'fleet.slave.restarted', '{"providerId":"claude","retry":1}', 1783086570793),
  ('fe-1783089445864-lsmaj0ldlyh', 'fleet.slave.died', '{"providerId":"claude","cdpPort":9224}', 1783089445864),
  ('fe-1783089445867-lqf73h7ig5s', 'fleet.slave.restarting', '{"providerId":"claude","retry":1,"backoffMs":5000}', 1783089445867),
  ('fe-1783089450879-2p92b5saav7', 'fleet.slave.starting', '{"providerId":"claude","slaveId":"fs-1783085096515-0r2pz0khjgg","cdpPort":9224}', 1783089450880),
  ('fe-1783089452301-mdq3z3svb4', 'fleet.slave.running', '{"providerId":"claude","slaveId":"fs-1783085096515-0r2pz0khjgg","cdpPort":9224,"pid":17028}', 1783089452301),
  ('fe-1783089452304-tkl32i8s5jb', 'fleet.slave.restarted', '{"providerId":"claude","retry":1}', 1783089452304),
  ('fe-1783093802780-x4xwzh8lpn', 'fleet.slave.dead', '{"providerId":"claude","slaveId":"fs-1783085096515-0r2pz0khjgg"}', 1783093802781),
  ('fe-1783093802784-s343o8xahp7', 'fleet.slave.restarting', '{"providerId":"claude","retry":1,"backoffMs":5000}', 1783093802784),
  ('fe-1783093807819-z19fqo4ppa9', 'fleet.slave.starting', '{"providerId":"claude","slaveId":"fs-1783085096515-0r2pz0khjgg","cdpPort":9224}', 1783093807819),
  ('fe-1783093808667-9rw3x890otd', 'fleet.slave.running', '{"providerId":"claude","slaveId":"fs-1783085096515-0r2pz0khjgg","cdpPort":9224,"pid":4484}', 1783093808667),
  ('fe-1783093808671-irsrvuyu90i', 'fleet.slave.restarted', '{"providerId":"claude","retry":1}', 1783093808671),
  ('fe-1783095092165-pbj2rkegk5s', 'fleet.slave.dead', '{"providerId":"claude","slaveId":"fs-1783085096515-0r2pz0khjgg"}', 1783095092166),
  ('fe-1783095092170-bkvmgy0i2p', 'fleet.slave.restarting', '{"providerId":"claude","retry":1,"backoffMs":5000}', 1783095092171),
  ('fe-1783095097195-0g4fhxzb9lm9', 'fleet.slave.starting', '{"providerId":"claude","slaveId":"fs-1783085096515-0r2pz0khjgg","cdpPort":9224}', 1783095097195),
  ('fe-1783095099319-04i0yhfmrvrf', 'fleet.slave.running', '{"providerId":"claude","slaveId":"fs-1783085096515-0r2pz0khjgg","cdpPort":9224,"pid":17964}', 1783095099319),
  ('fe-1783095099322-fsfcpntnz9g', 'fleet.slave.restarted', '{"providerId":"claude","retry":1}', 1783095099322),
  ('fe-1783100084662-al09z4sp4yw', 'fleet.slave.dead', '{"providerId":"claude","slaveId":"fs-1783085096515-0r2pz0khjgg"}', 1783100084663),
  ('fe-1783100084666-g6f6ei88kbh', 'fleet.slave.restarting', '{"providerId":"claude","retry":1,"backoffMs":5000}', 1783100084666),
  ('fe-1783100089682-w354ealn0j', 'fleet.slave.starting', '{"providerId":"claude","slaveId":"fs-1783085096515-0r2pz0khjgg","cdpPort":9224}', 1783100089682),
  ('fe-1783100090902-d2qd3rlake', 'fleet.slave.running', '{"providerId":"claude","slaveId":"fs-1783085096515-0r2pz0khjgg","cdpPort":9224,"pid":2340}', 1783100090902),
  ('fe-1783100090904-ejmsqndb0bp', 'fleet.slave.restarted', '{"providerId":"claude","retry":1}', 1783100090904),
  ('fe-1783100582408-om8mbcpe1tg', 'fleet.slave.dead', '{"providerId":"claude","slaveId":"fs-1783085096515-0r2pz0khjgg"}', 1783100582408),
  ('fe-1783100582428-6begl2fuwnk', 'fleet.slave.restarting', '{"providerId":"claude","retry":1,"backoffMs":5000}', 1783100582428),
  ('fe-1783100587458-ue7nmi9d1yk', 'fleet.slave.starting', '{"providerId":"claude","slaveId":"fs-1783085096515-0r2pz0khjgg","cdpPort":9224}', 1783100587458),
  ('fe-1783100590695-xpyw7r66z0l', 'fleet.slave.running', '{"providerId":"claude","slaveId":"fs-1783085096515-0r2pz0khjgg","cdpPort":9224,"pid":2340}', 1783100590695),
  ('fe-1783100590698-po4pqry0ulh', 'fleet.slave.restarted', '{"providerId":"claude","retry":1}', 1783100590698),
  ('fe-1783106389007-isal6m8pyip', 'fleet.slave.dead', '{"providerId":"claude","slaveId":"fs-1783085096515-0r2pz0khjgg"}', 1783106389007),
  ('fe-1783106389028-xp899jnz55a', 'fleet.slave.restarting', '{"providerId":"claude","retry":1,"backoffMs":5000}', 1783106389028),
  ('fe-1783106394083-affrsq0voum', 'fleet.slave.starting', '{"providerId":"claude","slaveId":"fs-1783085096515-0r2pz0khjgg","cdpPort":9224}', 1783106394084),
  ('fe-1783106396598-x2rxhlhobe', 'fleet.slave.running', '{"providerId":"claude","slaveId":"fs-1783085096515-0r2pz0khjgg","cdpPort":9224,"pid":18748}', 1783106396598),
  ('fe-1783106396613-yka9x1nu11n', 'fleet.slave.restarted', '{"providerId":"claude","retry":1}', 1783106396613),
  ('fe-1783112661057-5oqwq7u27ob', 'fleet.slave.attached', '{"providerId":"gemini","slaveId":"fs-1783112661048-t98a2c08jw","cdpPort":9222,"source":"external"}', 1783112661057),
  ('fe-1783176203591-szvgkap5rkf', 'fleet.slave.stopped', '{"providerId":"claude"}', 1783176203591),
  ('fe-1783177007369-2tgev48kp6', 'fleet.slave.stopped', '{"providerId":"claude"}', 1783177007369),
  ('fe-1783177069033-hv0y297bi9j', 'fleet.slave.stopped', '{"providerId":"claude"}', 1783177069033),
  ('fe-1783189918203-gedczekwel', 'fleet.slave.dead', '{"providerId":"gemini","slaveId":"fs-1783112661048-t98a2c08jw"}', 1783189918203),
  ('fe-1783189918209-gq6rlfzniov', 'fleet.slave.restarting', '{"providerId":"gemini","retry":1,"backoffMs":5000}', 1783189918209),
  ('fe-1783189918740-w1xlvxtsxze', 'fleet.slave.starting', '{"providerId":"claude","slaveId":"fs-1783085096515-0r2pz0khjgg","cdpPort":9224}', 1783189918740),
  ('fe-1783189920639-vxeuyze6qom', 'fleet.slave.running', '{"providerId":"claude","slaveId":"fs-1783085096515-0r2pz0khjgg","cdpPort":9224,"pid":14804}', 1783189920639),
  ('fe-1783189923233-ncsynhffaba', 'fleet.slave.starting', '{"providerId":"gemini","slaveId":"fs-1783112661048-t98a2c08jw","cdpPort":9222}', 1783189923233),
  ('fe-1783189925176-u46yczrieqg', 'fleet.slave.running', '{"providerId":"gemini","slaveId":"fs-1783112661048-t98a2c08jw","cdpPort":9222,"pid":13344}', 1783189925176),
  ('fe-1783189925182-7c4e22nhic4', 'fleet.slave.restarted', '{"providerId":"gemini","retry":1}', 1783189925182),
  ('fe-1783325801135-ijrqjiu80qs', 'fleet.slave.dead', '{"providerId":"claude","slaveId":"fs-1783085096515-0r2pz0khjgg"}', 1783325801135),
  ('fe-1783325801153-vqp36sspg0s', 'fleet.slave.restarting', '{"providerId":"claude","retry":1,"backoffMs":5000}', 1783325801153),
  ('fe-1783325806196-2sp4qa8phm', 'fleet.slave.starting', '{"providerId":"claude","slaveId":"fs-1783085096515-0r2pz0khjgg","cdpPort":9224}', 1783325806196),
  ('fe-1783325808381-1zpmb9kjv4z', 'fleet.slave.running', '{"providerId":"claude","slaveId":"fs-1783085096515-0r2pz0khjgg","cdpPort":9224,"pid":5544}', 1783325808381),
  ('fe-1783325808386-pwdj5xqedhb', 'fleet.slave.restarted', '{"providerId":"claude","retry":1}', 1783325808386),
  ('fe-1783325808413-4a7pbuh7zi5', 'fleet.slave.dead', '{"providerId":"gemini","slaveId":"fs-1783112661048-t98a2c08jw"}', 1783325808413),
  ('fe-1783325808418-z2q3hyzc69', 'fleet.slave.restarting', '{"providerId":"gemini","retry":1,"backoffMs":5000}', 1783325808418),
  ('fe-1783325813434-w4g8jxc285h', 'fleet.slave.starting', '{"providerId":"gemini","slaveId":"fs-1783112661048-t98a2c08jw","cdpPort":9222}', 1783325813434),
  ('fe-1783325815533-57gb7bhg4ys', 'fleet.slave.running', '{"providerId":"gemini","slaveId":"fs-1783112661048-t98a2c08jw","cdpPort":9222,"pid":9012}', 1783325815533),
  ('fe-1783325815537-hdge7wfl1ii', 'fleet.slave.restarted', '{"providerId":"gemini","retry":1}', 1783325815537),
  ('fe-1783326076451-mdurp9lfdv', 'fleet.provider.connect_failed', '{"providerId":"claude","email":"test@test.com","error":"Logged in but could not extract account email"}', 1783326076451),
  ('fe-1783331133921-my7wgl1ts6i', 'fleet.slave.dead', '{"slaveId":"fs-1783032278769-p4tm1tmj4w","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com"}', 1783331133921),
  ('fe-1783331133928-aau11li0ymw', 'fleet.slave.dead', '{"slaveId":"fs-1783085096515-0r2pz0khjgg","chromeProfileId":"provider-claude"}', 1783331133928),
  ('fe-1783331133945-wj2kufstysm', 'fleet.slave.dead', '{"slaveId":"fs-1783112661048-t98a2c08jw","chromeProfileId":"provider-gemini"}', 1783331133945),
  ('fe-1783247899303-fcjp0wcbjzn', 'fleet.slave.starting', '{"providerId":"chatgpt","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222}', 1783247899303),
  ('fe-1783247900402-svvnr9vxb7n', 'fleet.slave.running', '{"providerId":"chatgpt","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222,"pid":10536}', 1783247900402),
  ('fe-1783247903992-lxpbvy42dve', 'fleet.provider.connect_failed', '{"providerId":"chatgpt","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","email":"backbone.intelligence.advisors@gmail.com","error":"Session expired — page shows login prompt"}', 1783247903992),
  ('fe-1783247908200-tkbu2cueqp', 'fleet.slave.starting', '{"providerId":"chatgpt","chromeProfileId":"cp-owservera-gmail-com","slaveId":"fs-1783064694295-5ieukjd9m8u","cdpPort":9223}', 1783247908200),
  ('fe-1783247909092-1sr4i304lb', 'fleet.slave.running', '{"providerId":"chatgpt","chromeProfileId":"cp-owservera-gmail-com","slaveId":"fs-1783064694295-5ieukjd9m8u","cdpPort":9223,"pid":11872}', 1783247909092),
  ('fe-1783247912771-0mrsxodskhyd', 'fleet.provider.connect_failed', '{"providerId":"chatgpt","chromeProfileId":"cp-owservera-gmail-com","email":"owservera@gmail.com","error":"Session expired — page shows login prompt"}', 1783247912771),
  ('fe-1783256921028-g0qgcks21jc', 'fleet.slave.dead', '{"slaveId":"fs-1783032278769-p4tm1tmj4w","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com"}', 1783256921029),
  ('fe-1783256921055-1m9by4e1y87', 'fleet.slave.dead', '{"slaveId":"fs-1783064694295-5ieukjd9m8u","chromeProfileId":"cp-owservera-gmail-com"}', 1783256921055),
  ('fe-1783280722601-1c972wr8jaei', 'fleet.slave.starting', '{"providerId":"claude","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222}', 1783280722601),
  ('fe-1783280723970-lw14xmryrqi', 'fleet.slave.running', '{"providerId":"claude","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222,"pid":4044}', 1783280723970),
  ('fe-1783280730871-b2k2s0zsnzp', 'fleet.slave.starting', '{"providerId":"claude","chromeProfileId":"cp-owservera-gmail-com","slaveId":"fs-1783064694295-5ieukjd9m8u","cdpPort":9223}', 1783280730872),
  ('fe-1783280732107-xfo6nvo6rq', 'fleet.slave.running', '{"providerId":"claude","chromeProfileId":"cp-owservera-gmail-com","slaveId":"fs-1783064694295-5ieukjd9m8u","cdpPort":9223,"pid":7732}', 1783280732107),
  ('fe-1783280737394-spll098xind', 'fleet.provider.connected', '{"providerId":"claude","chromeProfileId":"cp-owservera-gmail-com","email":"owservera@gmail.com","accountId":"pa-1783280737389-nfxaqizpt4e"}', 1783280737394),
  ('fe-1783280804896-78oljva4n35', 'fleet.slave.starting', '{"providerId":"chatgpt","chromeProfileId":"cp-vivim-advisors-gmail-com","slaveId":"fs-1783280804885-w6bbmnf5c9s","cdpPort":9224}', 1783280804896),
  ('fe-1783280806315-qaojmk1du8o', 'fleet.slave.running', '{"providerId":"chatgpt","chromeProfileId":"cp-vivim-advisors-gmail-com","slaveId":"fs-1783280804885-w6bbmnf5c9s","cdpPort":9224,"pid":8624}', 1783280806315),
  ('fe-1783280810436-833f0bcda03', 'fleet.provider.connect_failed', '{"providerId":"chatgpt","chromeProfileId":"cp-vivim-advisors-gmail-com","email":"vivim.advisors@gmail.com","error":"Session expired — page shows login prompt"}', 1783280810436),
  ('fe-1783280900047-6c5iwk52chq', 'fleet.slave.stopped', '{"providerId":"chatgpt","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com"}', 1783280900047),
  ('fe-1783282997801-kl3an8lyff8', 'fleet.slave.dead', '{"slaveId":"fs-1783064694295-5ieukjd9m8u","chromeProfileId":"cp-owservera-gmail-com"}', 1783282997801),
  ('fe-1783282997819-emu7x8754fa', 'fleet.slave.dead', '{"slaveId":"fs-1783280804885-w6bbmnf5c9s","chromeProfileId":"cp-vivim-advisors-gmail-com"}', 1783282997819),
  ('fe-1783284136789-z4usehgotie', 'fleet.slave.starting', '{"providerId":"claude","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222}', 1783284136789),
  ('fe-1783284138104-a3cu2mut6in', 'fleet.slave.running', '{"providerId":"claude","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222,"pid":8272}', 1783284138104),
  ('fe-1783284170129-wr5kf8lsfdk', 'fleet.slave.starting', '{"providerId":"gemini","chromeProfileId":"cp-owservera-gmail-com","slaveId":"fs-1783064694295-5ieukjd9m8u","cdpPort":9223}', 1783284170129),
  ('fe-1783284171474-uep8zi8ogpa', 'fleet.slave.running', '{"providerId":"gemini","chromeProfileId":"cp-owservera-gmail-com","slaveId":"fs-1783064694295-5ieukjd9m8u","cdpPort":9223,"pid":8284}', 1783284171474),
  ('fe-1783284175391-21wfe830ofm', 'fleet.provider.connect_failed', '{"providerId":"gemini","chromeProfileId":"cp-owservera-gmail-com","email":"owservera@gmail.com","error":"Session expired — page shows login prompt"}', 1783284175391),
  ('fe-1783284220771-jutyb0wtux', 'fleet.slave.stopped', '{"providerId":"chatgpt","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com"}', 1783284220771),
  ('fe-1783284227773-lz7b0nobhn', 'fleet.slave.stopped', '{"providerId":"deepseek","chromeProfileId":"cp-owservera-gmail-com"}', 1783284227773),
  ('fe-1783284692701-lp1yocrgig', 'fleet.slave.stopped', '{"providerId":"chatgpt","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com"}', 1783284692701),
  ('fe-1783284698403-qqerdhln86g', 'fleet.slave.starting', '{"providerId":"claude","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222}', 1783284698403),
  ('fe-1783284699933-7hdzf6s3uul', 'fleet.slave.running', '{"providerId":"claude","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222,"pid":14552}', 1783284699933),
  ('fe-1783285762794-2d4d60wmywz', 'fleet.slave.stopped', '{"providerId":"chatgpt","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com"}', 1783285762794),
  ('fe-1783287829346-esefyd51dkh', 'fleet.slave.starting', '{"providerId":"chatgpt","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222}', 1783287829346),
  ('fe-1783287831210-62gqbpbnzyi', 'fleet.slave.running', '{"providerId":"chatgpt","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222,"pid":14140}', 1783287831210),
  ('fe-1783287840118-h77rm1an2e', 'fleet.slave.starting', '{"providerId":"chatgpt","chromeProfileId":"cp-owservera-gmail-com","slaveId":"fs-1783064694295-5ieukjd9m8u","cdpPort":9223}', 1783287840118),
  ('fe-1783287841593-842euixu2r3', 'fleet.slave.running', '{"providerId":"chatgpt","chromeProfileId":"cp-owservera-gmail-com","slaveId":"fs-1783064694295-5ieukjd9m8u","cdpPort":9223,"pid":3848}', 1783287841593),
  ('fe-1783287845374-c59lepd0lic', 'fleet.provider.connect_failed', '{"providerId":"chatgpt","chromeProfileId":"cp-owservera-gmail-com","email":"owservera@gmail.com","error":"Session expired — page shows login prompt"}', 1783287845374),
  ('fe-1783287870909-jus920d30jk', 'fleet.provider.disconnected', '{"accountId":"pa-1783247912768-tonruj4jy1q"}', 1783287870909),
  ('fe-1783287871726-va3qo887jfd', 'fleet.provider.disconnected', '{"accountId":"pa-1783287845371-6jxt9hh1hui"}', 1783287871726),
  ('fe-1783287872369-w09p8mwc14n', 'fleet.provider.connect_failed', '{"providerId":"chatgpt","chromeProfileId":"cp-owservera-gmail-com","email":"owservera@gmail.com","error":"Session expired — page shows login prompt"}', 1783287872369);
INSERT INTO "fleet_event" ("id", "event", "payload", "created_at") VALUES
  ('fe-1783287872631-2dxvnrprygv', 'fleet.provider.disconnected', '{"accountId":"pa-1783280810433-1cjgr3460xt"}', 1783287872631),
  ('fe-1783287873579-vvibjny0si', 'fleet.provider.disconnected', '{"accountId":"pa-1783287872366-m8ayt57mzi"}', 1783287873579),
  ('fe-1783288556131-c4ye4tgk9sb', 'fleet.slave.starting', '{"providerId":"chatgpt","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222}', 1783288556131),
  ('fe-1783288558809-kum7r53z9cn', 'fleet.slave.running', '{"providerId":"chatgpt","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222,"pid":8364}', 1783288558809),
  ('fe-1783288580891-d2yw5ztkhi', 'fleet.slave.stopped', '{"providerId":"chatgpt","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com"}', 1783288580891),
  ('fe-1783288580941-zmm2ev9g54o', 'fleet.slave.dead', '{"slaveId":"fs-1783064694295-5ieukjd9m8u","chromeProfileId":"cp-owservera-gmail-com"}', 1783288580941),
  ('fe-1783288584323-xl433b22v6e', 'fleet.slave.starting', '{"providerId":"chatgpt","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222}', 1783288584323),
  ('fe-1783288585525-wtj6sgf3si', 'fleet.slave.running', '{"providerId":"chatgpt","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222,"pid":4824}', 1783288585525),
  ('fe-1783289089832-zycxyrun06r', 'fleet.slave.dead', '{"slaveId":"fs-1783032278769-p4tm1tmj4w","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com"}', 1783289089832),
  ('fe-1783289654388-xzloiot2w4', 'fleet.slave.starting', '{"providerId":"chatgpt","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222}', 1783289654388),
  ('fe-1783289656478-0iaj2f5vk3tc', 'fleet.slave.running', '{"providerId":"chatgpt","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222,"pid":6340}', 1783289656478),
  ('fe-1783290114169-al6r56ja27o', 'fleet.slave.stopped', '{"providerId":"chatgpt","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com"}', 1783290114169),
  ('fe-1783290168413-c9kpae01so8', 'fleet.slave.starting', '{"providerId":"chatgpt","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222}', 1783290168413),
  ('fe-1783290170386-xs14pavzdte', 'fleet.slave.running', '{"providerId":"chatgpt","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222,"pid":16984}', 1783290170386),
  ('fe-1783290205782-pw4dod0b3u9', 'fleet.slave.stopped', '{"providerId":"chatgpt","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com"}', 1783290205782),
  ('fe-1783290210932-x6j02n7yvsi', 'fleet.slave.starting', '{"providerId":"gemini","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222}', 1783290210932),
  ('fe-1783290213843-xu66xucbyn', 'fleet.slave.running', '{"providerId":"gemini","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222,"pid":4028}', 1783290213843),
  ('fe-1783290566119-7n0faqmywsi', 'fleet.slave.dead', '{"slaveId":"fs-1783032278769-p4tm1tmj4w","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com"}', 1783290566120),
  ('fe-1783291500034-7lqwvko3tu', 'fleet.slave.starting', '{"providerId":"chatgpt","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222}', 1783291500035),
  ('fe-1783291502980-az9sp11ya5j', 'fleet.slave.running', '{"providerId":"chatgpt","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222,"pid":9096}', 1783291502980),
  ('fe-1783291514581-st1d9kgjypb', 'fleet.provider.connected', '{"providerId":"chatgpt","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","email":"backbone.intelligence.advisors@gmail.com","accountId":"pa-1783247903988-qcb4ykwne5"}', 1783291514581),
  ('fe-1783293304842-tk5enk0bbi9', 'fleet.provider.disconnected', '{"accountId":"pa-1783247903988-qcb4ykwne5"}', 1783293304842),
  ('fe-1783293313672-1h9k23ynaie', 'fleet.slave.stopped', '{"providerId":"chatgpt","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com"}', 1783293313672),
  ('fe-1783294255409-xf3w26mquw', 'fleet.slave.starting', '{"providerId":"chatgpt","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222}', 1783294255409),
  ('fe-1783294257100-jbuhbtpzh3m', 'fleet.slave.running', '{"providerId":"chatgpt","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222,"pid":16204}', 1783294257100),
  ('fe-1783294453680-eb9yohy74d', 'fleet.slave.dead', '{"slaveId":"fs-1783032278769-p4tm1tmj4w","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com"}', 1783294453680),
  ('fe-1783294525594-0ig3htikh83k', 'fleet.slave.starting', '{"providerId":"chatgpt","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222}', 1783294525594),
  ('fe-1783294527061-219wls4mmko', 'fleet.slave.running', '{"providerId":"chatgpt","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222,"pid":3840}', 1783294527062),
  ('fe-1783294542082-ub9agnqagwm', 'fleet.provider.connect_failed', '{"providerId":"chatgpt","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","email":"backbone.intelligence.advisors@gmail.com","error":"CDP probe failed: verifyLogin(chatgpt) timed out after 15000ms"}', 1783294542082),
  ('fe-1783294764419-uxse9ikwpz', 'fleet.slave.stopped', '{"providerId":"chatgpt","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com"}', 1783294764419),
  ('fe-1783294768670-zr1498w5axq', 'fleet.slave.starting', '{"providerId":"claude","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222}', 1783294768670),
  ('fe-1783294770711-3dax98wpqsp', 'fleet.slave.running', '{"providerId":"claude","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222,"pid":15188}', 1783294770711),
  ('fe-1783294781833-56oekiue79q', 'fleet.slave.starting', '{"providerId":"claude","chromeProfileId":"cp-owservera-gmail-com","slaveId":"fs-1783064694295-5ieukjd9m8u","cdpPort":9223}', 1783294781833),
  ('fe-1783294783213-w9l8txhnsrn', 'fleet.slave.running', '{"providerId":"claude","chromeProfileId":"cp-owservera-gmail-com","slaveId":"fs-1783064694295-5ieukjd9m8u","cdpPort":9223,"pid":5232}', 1783294783213),
  ('fe-1783294790517-87xghyloxsv', 'fleet.provider.connected', '{"providerId":"claude","chromeProfileId":"cp-owservera-gmail-com","email":"owservera@gmail.com","accountId":"pa-1783280737389-nfxaqizpt4e"}', 1783294790517),
  ('fe-1783295016415-ir6ocblk7vn', 'fleet.slave.dead', '{"slaveId":"fs-1783032278769-p4tm1tmj4w","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com"}', 1783295016416),
  ('fe-1783295016492-jah10r3xl6h', 'fleet.slave.dead', '{"slaveId":"fs-1783064694295-5ieukjd9m8u","chromeProfileId":"cp-owservera-gmail-com"}', 1783295016493),
  ('fe-1783295031682-0ujm2x0p49zm', 'fleet.slave.starting', '{"providerId":"claude","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222}', 1783295031682),
  ('fe-1783295033476-0t1hrab37u4', 'fleet.slave.running', '{"providerId":"claude","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222,"pid":7136}', 1783295033476),
  ('fe-1783298706417-epeye1m0tjj', 'fleet.provider.connect_failed', '{"providerId":"claude","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","email":"backbone.intelligence.advisors@gmail.com","error":"Page loaded but chat interface not ready ({\"hasPasswordInput\":false,\"hasLoginForm\":false,\"hasLoginUrl\":false,\"hasLoginText\":false,\"hasReadySelector\":false,\"url\":\"https://claude.ai/logout?involuntary=1&returnTo=%2Flogin%3Ffrom%3Dlogout%26reauth%3D1%26returnTo%3D%252Fnew\"})"}', 1783298706417),
  ('fe-1783298762912-48zajc1iyba', 'fleet.slave.stopped', '{"providerId":"chatgpt","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com"}', 1783298762912),
  ('fe-1783299053860-pipt23p0jg', 'fleet.slave.starting', '{"providerId":"claude","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222}', 1783299053860),
  ('fe-1783299055217-igr67kznhw', 'fleet.slave.running', '{"providerId":"claude","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222,"pid":9448}', 1783299055217),
  ('fe-1783299814861-0u9ld4xuk5l', 'fleet.slave.dead', '{"slaveId":"fs-1783032278769-p4tm1tmj4w","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com"}', 1783299814861),
  ('fe-1783299866574-dgmq8it6h', 'fleet.slave.starting', '{"providerId":"claude","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222}', 1783299866595),
  ('fe-1783299867849-h9ahifmdob4', 'fleet.slave.running', '{"providerId":"claude","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222,"pid":7624}', 1783299867849),
  ('fe-1783300659234-7ue2n6g5c5a', 'fleet.slave.dead', '{"slaveId":"fs-1783032278769-p4tm1tmj4w","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com"}', 1783300659235),
  ('fe-1783300690271-3c97atzap9b', 'fleet.slave.starting', '{"providerId":"claude","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222}', 1783300690271),
  ('fe-1783300691463-8to86rcr3lf', 'fleet.slave.running', '{"providerId":"claude","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222,"pid":6704}', 1783300691463),
  ('fe-1783300855396-vduoriui0u', 'fleet.slave.starting', '{"providerId":"claude","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222}', 1783300855396),
  ('fe-1783300856311-morehit9u6', 'fleet.slave.running', '{"providerId":"claude","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222,"pid":4896}', 1783300856311),
  ('fe-1783301067823-pvirdexwbid', 'fleet.slave.starting', '{"providerId":"claude","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222}', 1783301067823),
  ('fe-1783301069327-m8xzkqpfg4j', 'fleet.slave.running', '{"providerId":"claude","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222,"pid":15004}', 1783301069327),
  ('fe-1783301383415-oo3gn1x3dgj', 'fleet.slave.starting', '{"providerId":"chatgpt","chromeProfileId":"cp-owservera-gmail-com","slaveId":"fs-1783064694295-5ieukjd9m8u","cdpPort":9223}', 1783301383415),
  ('fe-1783301384267-48fdd5m8js4', 'fleet.slave.running', '{"providerId":"chatgpt","chromeProfileId":"cp-owservera-gmail-com","slaveId":"fs-1783064694295-5ieukjd9m8u","cdpPort":9223,"pid":828}', 1783301384267),
  ('fe-1783301388049-0im6amxa8fe', 'fleet.provider.connected', '{"providerId":"chatgpt","chromeProfileId":"cp-owservera-gmail-com","email":"owservera@gmail.com","accountId":"pa-1783287872366-m8ayt57mzi"}', 1783301388049),
  ('fe-1783301725001-bmvhokz7cdh', 'fleet.slave.stopped', '{"providerId":"chatgpt","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com"}', 1783301725001),
  ('fe-1783301733320-ugi2w26mbd8', 'fleet.slave.starting', '{"providerId":"chatgpt","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222}', 1783301733320),
  ('fe-1783301734182-h0yj9t7at4', 'fleet.slave.running', '{"providerId":"chatgpt","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222,"pid":13492}', 1783301734182),
  ('fe-1783301736780-2u5c90idyzh', 'fleet.slave.dead', '{"slaveId":"fs-1783064694295-5ieukjd9m8u","chromeProfileId":"cp-owservera-gmail-com"}', 1783301736780),
  ('fe-1783301821043-75j2dvto0w', 'fleet.slave.stopped', '{"providerId":"chatgpt","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com"}', 1783301821043),
  ('fe-1783301824045-avxvwm5qi9f', 'fleet.slave.starting', '{"providerId":"claude","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222}', 1783301824045),
  ('fe-1783301824882-uh9fn2qd6m', 'fleet.slave.running', '{"providerId":"claude","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222,"pid":15644}', 1783301824882),
  ('fe-1783302581550-3y61j57264b', 'fleet.slave.dead', '{"slaveId":"fs-1783032278769-p4tm1tmj4w","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com"}', 1783302581550),
  ('fe-1783302726953-ectm4ci57yq', 'fleet.slave.starting', '{"providerId":"claude","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222}', 1783302726953),
  ('fe-1783302729046-vfy2dmsyt3', 'fleet.slave.running', '{"providerId":"claude","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222,"pid":5640}', 1783302729046),
  ('fe-1783303075954-v8dm5bujnnr', 'fleet.slave.dead', '{"slaveId":"fs-1783032278769-p4tm1tmj4w","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com"}', 1783303075955),
  ('fe-1783303081053-agkrtwygqed', 'fleet.slave.starting', '{"providerId":"claude","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222}', 1783303081053),
  ('fe-1783303082674-865i0nb21if', 'fleet.slave.running', '{"providerId":"claude","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222,"pid":3232}', 1783303082676),
  ('fe-1783304723005-meawta6mgye', 'fleet.slave.dead', '{"slaveId":"fs-1783032278769-p4tm1tmj4w","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com"}', 1783304723005),
  ('fe-1783304734951-ysse3se4r4h', 'fleet.slave.starting', '{"providerId":"claude","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222}', 1783304734951),
  ('fe-1783304740150-bptpn7ljd0u', 'fleet.slave.running', '{"providerId":"claude","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com","slaveId":"fs-1783032278769-p4tm1tmj4w","cdpPort":9222,"pid":12300}', 1783304740151),
  ('fe-1783306021462-kygywrtera', 'fleet.slave.dead', '{"slaveId":"fs-1783032278769-p4tm1tmj4w","chromeProfileId":"cp-backbone-intelligence-advisors-gmail-com"}', 1783306021462);

-- fleet_slave: 3 rows
INSERT INTO "fleet_slave" ("id", "chrome_profile_id", "status", "pid", "cdp_port", "started_at", "last_heartbeat", "error_message", "created_at") VALUES
  ('fs-1783032278769-p4tm1tmj4w', 'cp-backbone-intelligence-advisors-gmail-com', 'error', 12300, 9222, NULL, 1783306021434, 'Process not running', 1783032278769),
  ('fs-1783064694295-5ieukjd9m8u', 'cp-owservera-gmail-com', 'error', 828, 9223, NULL, 1783301736778, 'Process not running', 1783064694295),
  ('fs-1783280804885-w6bbmnf5c9s', 'cp-vivim-advisors-gmail-com', 'error', 8624, 9224, NULL, 1783282997818, 'Process not running', 1783280804885);

-- hole: 677 rows
INSERT INTO "hole" ("id", "provider_id", "role", "name", "layer_index", "classified_as", "discovered_at", "consumed_by", "schema_version", "created_at", "updated_at", "fingerprint") VALUES
  ('h:1ebb042578cfac43', 'chatgpt', 'button', 'Open sidebar', 0, 'menu-trigger', 1782747223236, '[]', 1, 1782868074480, 1783298502076, NULL),
  ('h:3cb5f1371958d27d', 'chatgpt', 'a', 'New chat', 0, 'nav', 1782434131028, '[]', 1, 1782868074480, 1783298501850, NULL),
  ('h:f48dfc0a1bbcb274', 'chatgpt', 'button', 'Search', 0, 'action', 1782747223236, '[]', 1, 1782868074480, 1783298502077, NULL),
  ('h:f32d7ef6c55f41ec', 'chatgpt', 'button', 'Recents', 0, 'menu-trigger', 1782747223236, '[]', 1, 1782868074480, 1783298502079, NULL),
  ('h:3fc3fe71a1a61d5d', 'chatgpt', 'nav', 'Sidebar', 0, 'action', 1782747223236, '[]', 1, 1782868074480, 1783298502081, NULL),
  ('h:939b4240369eff97', 'chatgpt', 'button', 'Open profile menu', 0, 'menu-trigger', 1782747223236, '[]', 1, 1782868074480, 1783298502083, NULL),
  ('h:5b75f3a60d7b74dd', 'chatgpt', 'div', 'ChatGPTUpgradeShareYou said:attach file.', 0, 'commerce', 1782747223236, '[]', 1, 1782868074480, 1783298502084, NULL),
  ('h:557acb49e16bd564', 'chatgpt', 'button', 'Model selector', 0, 'menu-trigger', 1782434131028, '[]', 1, 1782868074480, 1783298501871, NULL),
  ('h:ffcf8f0b7ea753da', 'chatgpt', 'div', 'attach file. Respond briefly.', 0, 'action', 1782747223236, '[]', 1, 1782868074480, 1783298502086, NULL),
  ('h:47b09c41d2b9fc01', 'chatgpt', 'div', 'attach pdf. Respond briefly.', 0, 'action', 1782747223236, '[]', 1, 1782868074480, 1783298502088, NULL),
  ('h:efc9cd6244e898d0', 'chatgpt', 'div', 'You said:attach file. Respond briefly.Ch', 0, 'action', 1782747223236, '[]', 1, 1782868074480, 1783298502090, NULL),
  ('h:8ad8b5234b719cb8', 'chatgpt', 'div', 'window.__oai_logHTML?window.__oai_logHTM', 0, 'action', 1782434131028, '[]', 1, 1782868074480, 1783298501867, NULL),
  ('h:8335defc19778f97', 'chatgpt', 'button', 'Add files and more', 0, 'menu-trigger', 1782434131028, '[]', 1, 1782868074480, 1783298501872, NULL),
  ('h:51c51de89b734cdf', 'chatgpt', 'button', 'Upgrade', 0, 'commerce', 1782434131028, '[]', 1, 1782868074480, 1783298501846, NULL),
  ('h:b174b361ba56b0c5', 'chatgpt', 'textbox', 'Chat with ChatGPT', 0, 'composer', 1782434131028, '[]', 1, 1782868074480, 1783298501874, NULL),
  ('h:686008f674fd7e1d', 'chatgpt', 'div', 'Share', 0, 'action', 1782747223236, '[]', 1, 1782868074480, 1783298502091, NULL),
  ('h:143cdfbabfea53b4', 'chatgpt', 'button', 'Share', 0, 'action', 1782434131028, '[]', 1, 1782868074480, 1783298501876, NULL),
  ('h:f0bb3f86f520e2e8', 'chatgpt', 'button', 'Open conversation options', 0, 'menu-trigger', 1782434131028, '[]', 1, 1782868074480, 1783298501880, NULL),
  ('h:3853462735ba38ca', 'chatgpt', 'a', 'Home', 1, 'link', 1783298501638, '[]', 1, 1782868074480, 1783298501766, NULL),
  ('h:9d563ed80ebf86fd', 'chatgpt', 'a', 'Hello World Request', 1, 'link', 1782747278719, '[]', 1, 1782868074480, 1783298502107, NULL),
  ('h:c155bf0210daa622', 'chatgpt', 'a', 'Say hello world', 1, 'link', 1782747278719, '[]', 1, 1782868074480, 1783298502109, NULL),
  ('h:8fc6c4ddbd29c35c', 'chatgpt', 'a', 'Hello world request', 1, 'link', 1782747278719, '[]', 1, 1782868074480, 1783298502111, NULL),
  ('h:969eba925a07f187', 'chatgpt', 'a', 'No response received', 1, 'link', 1782747278719, '[]', 1, 1782868074480, 1783298502113, NULL),
  ('h:94375487aef592e6', 'chatgpt', 'a', 'Why July Pride Month', 1, 'link', 1782747302550, '[]', 1, 1782868074480, 1783298502121, NULL),
  ('h:565bb4fe67f7956f', 'chatgpt', 'div', 'owen wallace-serveraFreeUpgrade', 1, 'commerce', 1783298501638, '[]', 1, 1782868074480, 1783298501775, NULL),
  ('h:3b354451b1106ff0', 'chatgpt', 'button', 'owen wallace-servera Free, open profile ', 1, 'menu-trigger', 1783298501638, '[]', 1, 1782868074480, 1783298501777, NULL),
  ('h:cc3eec35043bf9c3', 'chatgpt', 'button', 'Model selector', 1, 'menu-trigger', 1783298501638, '[]', 1, 1782868074480, 1783298501778, NULL),
  ('h:1242c0dabd436153', 'chatgpt', 'div', 'attach pdf. Respond briefly.', 1, 'action', 1783298501638, '[]', 1, 1782868074480, 1783298501780, NULL),
  ('h:a9d3d4c31a983030', 'chatgpt', 'div', 'You said:attach file. Respond briefly.Ch', 1, 'action', 1783298501638, '[]', 1, 1782868074480, 1783298501782, NULL),
  ('h:480155756c423e25', 'chatgpt', 'div', 'window.__oai_logHTML?window.__oai_logHTM', 1, 'action', 1783298501638, '[]', 1, 1782868074480, 1783298501783, NULL),
  ('h:527d8c784b24ff73', 'chatgpt', 'div', 'ChatGPTUpgradeShareYou said:attach file.', 1, 'commerce', 1783298501638, '[]', 1, 1782868074480, 1783298501785, NULL),
  ('h:cc529310067970ea', 'chatgpt', 'button', 'Upgrade', 1, 'commerce', 1783298501638, '[]', 1, 1782868074480, 1783298501787, NULL),
  ('h:4ec9306adf8a8916', 'chatgpt', 'button', 'Add files and more', 1, 'menu-trigger', 1783298501638, '[]', 1, 1782868074480, 1783298501789, NULL),
  ('h:b6bca3dcb132656a', 'chatgpt', 'menuitem', 'Delete', 1, 'action', 1782747302550, '[]', 1, 1782868074480, 1783298502122, NULL),
  ('h:cee6317fc8bee80e', 'chatgpt', 'menuitem', 'Archive', 1, 'action', 1782747302550, '[]', 1, 1782868074480, 1783298502124, NULL),
  ('h:482cc78145395355', 'chatgpt', 'menuitem', 'Pin chat', 1, 'action', 1782747302550, '[]', 1, 1782868074480, 1783298502125, NULL),
  ('h:79a8a47b398b29c7', 'chatgpt', 'menuitem', 'Move to project', 1, 'menu-trigger', 1782747302550, '[]', 1, 1782868074480, 1783298502127, NULL),
  ('h:c9397aad5ac18708', 'chatgpt', 'menuitem', 'Rename', 1, 'action', 1782747302550, '[]', 1, 1782868074480, 1783298502128, NULL),
  ('h:62ed8228bcede78b', 'chatgpt', 'menuitem', 'Start a group chat', 1, 'action', 1782747302550, '[]', 1, 1782868074480, 1783298502130, NULL),
  ('h:f650cc8ef3a8b4d2', 'chatgpt', 'menuitem', 'Share', 1, 'action', 1782747302550, '[]', 1, 1782868074480, 1783298502131, NULL),
  ('h:021156217d800f31', 'chatgpt', 'textbox', 'Chat with ChatGPT', 1, 'composer', 1783298501638, '[]', 1, 1782868074480, 1783298501803, NULL),
  ('h:af5c9d6e74a9cf8b', 'chatgpt', 'button', 'Start dictation', 1, 'action', 1783298501638, '[]', 1, 1782868074480, 1783298501804, NULL),
  ('h:6eb0264c13596c1d', 'chatgpt', 'button', 'Send prompt', 1, 'submit', 1783298501638, '[]', 1, 1782868074480, 1783298501806, NULL),
  ('h:abbac0ff6d36d5d6', 'chatgpt', 'button', 'Share', 1, 'action', 1783298501638, '[]', 1, 1782868074480, 1783298501808, NULL),
  ('h:146cebc86e07b5c6', 'chatgpt', 'button', 'Open conversation options', 1, 'menu-trigger', 1783298501638, '[]', 1, 1782868074480, 1783298501809, NULL),
  ('h:2e6ed4fb70bc70e0', 'chatgpt', 'a', 'Home', 0, 'link', 1782434131028, '[]', 1, 1782434131028, 1783298501814, NULL),
  ('h:c500859fc5eccb01', 'chatgpt', 'a', 'New chatCtrlShiftO', 0, 'nav', 1782434131028, '[]', 1, 1782434131028, 1783298501817, NULL),
  ('h:348748d45ea4181e', 'chatgpt', 'button', 'SearchCtrlK', 0, 'action', 1782434131028, '[]', 1, 1782434131028, 1783298501819, NULL),
  ('h:643b4ebdaa8baf65', 'chatgpt', 'a', 'Library', 0, 'link', 1782434131028, '[]', 1, 1782434131028, 1783298501821, NULL),
  ('h:feb9ed9c82f951e5', 'chatgpt', 'a', 'Apps', 0, 'link', 1782434131028, '[]', 1, 1782434131028, 1783298501823, NULL),
  ('h:8c0c33ea290c1319', 'chatgpt', 'a', 'Codex', 0, 'link', 1782434131028, '[]', 1, 1782434131028, 1783298501825, NULL),
  ('h:75aa7a49db0d207a', 'chatgpt', 'div', 'More', 0, 'menu-trigger', 1782434131028, '[]', 1, 1782434131028, 1783298501827, NULL),
  ('h:fd17f0a93a67dc5a', 'chatgpt', 'button', 'Projects', 0, 'menu-trigger', 1782434131028, '[]', 1, 1782434131028, 1783298501828, NULL),
  ('h:4fb642ce79c9613c', 'chatgpt', 'button', 'ENTERTAINMENT', 0, 'menu-trigger', 1782434131028, '[]', 1, 1782434131028, 1783298501830, NULL),
  ('h:aa3d9e53bedfb5fb', 'chatgpt', 'button', 'BLACK BOX PROJECT', 0, 'menu-trigger', 1782434131028, '[]', 1, 1782434131028, 1783298501832, NULL),
  ('h:86713af846a037fd', 'chatgpt', 'button', 'Telepathy Research', 0, 'menu-trigger', 1782434131028, '[]', 1, 1782434131028, 1783298501834, NULL),
  ('h:4ac44d69b3410291', 'chatgpt', 'button', 'TIMEWATCHERS', 0, 'menu-trigger', 1782434131028, '[]', 1, 1782434131028, 1783298501836, NULL),
  ('h:83a989b98b4c98cc', 'chatgpt', 'button', 'MATH', 0, 'menu-trigger', 1782434131028, '[]', 1, 1782434131028, 1783298501837, NULL),
  ('h:78d9c27911cee1a4', 'chatgpt', 'button', 'Show more', 0, 'menu-trigger', 1782434131028, '[]', 1, 1782434131028, 1783298501839, NULL),
  ('h:0d8f29f3bdaf89f8', 'chatgpt', 'button', 'Chats', 0, 'menu-trigger', 1782434131028, '[]', 1, 1782434131028, 1783298501841, NULL),
  ('h:63227ba35576f664', 'chatgpt', 'div', 'owen wallace-serveraFreeUpgrade', 0, 'commerce', 1782434131028, '[]', 1, 1782434131028, 1783298501843, NULL),
  ('h:379447fe95907454', 'chatgpt', 'button', 'owen wallace-servera Free, open profile ', 0, 'menu-trigger', 1782434131028, '[]', 1, 1782434131028, 1783298501845, NULL),
  ('h:1251ad72060edd52', 'chatgpt', 'button', 'Open project home', 0, 'action', 1782434131028, '[]', 1, 1782434131028, 1783298501848, NULL),
  ('h:0e11214f057a6991', 'chatgpt', 'button', 'Organize chats', 0, 'menu-trigger', 1782434131028, '[]', 1, 1782434131028, 1783298501852, NULL),
  ('h:02f690d4cf3185df', 'chatgpt', 'button', 'Open project options for MATH', 0, 'menu-trigger', 1782434131028, '[]', 1, 1782434131028, 1783298501854, NULL),
  ('h:333f4a4ba66ed331', 'chatgpt', 'button', 'Open project options for TIMEWATCHERS', 0, 'menu-trigger', 1782434131028, '[]', 1, 1782434131028, 1783298501856, NULL),
  ('h:68170e3bf5db01c4', 'chatgpt', 'button', 'Open project options for Telepathy Resea', 0, 'menu-trigger', 1782434131028, '[]', 1, 1782434131028, 1783298501858, NULL),
  ('h:b4bcc23acea90c19', 'chatgpt', 'button', 'Open project options for BLACK BOX PROJE', 0, 'menu-trigger', 1782434131028, '[]', 1, 1782434131028, 1783298501860, NULL),
  ('h:6b2ffa00b1cb7c34', 'chatgpt', 'button', 'Open project options for ENTERTAINMENT', 0, 'menu-trigger', 1782434131028, '[]', 1, 1782434131028, 1783298501861, NULL),
  ('h:a853eee1eb4bdcfe', 'chatgpt', 'button', 'Close sidebar', 0, 'menu-trigger', 1782434131028, '[]', 1, 1782434131028, 1783298501863, NULL),
  ('h:6b62ef0f577800ba', 'chatgpt', 'nav', 'Chat history', 0, 'nav', 1782434131028, '[]', 1, 1782434131028, 1783298501865, NULL),
  ('h:2953add266eb5cff', 'chatgpt', 'div', 'ChatGPTUpgradeSharewindow.__oai_logHTML?', 0, 'commerce', 1782434131028, '[]', 1, 1782434131028, 1783298501869, NULL),
  ('h:26207a4bcfef1467', 'chatgpt', 'button', 'Start dictation', 0, 'action', 1782434131028, '[]', 1, 1782434131028, 1783298501878, NULL),
  ('h:c658450f9149143a', 'chatgpt', 'button', 'Send prompt', 0, 'submit', 1782434131028, '[]', 1, 1782434131028, 1783298501882, NULL),
  ('h:2b6413f0d1bbbfbe', 'chatgpt', 'button', 'BLACK BOX PROJECT- BOOK NOTES', 1, 'menu-trigger', 1782434585740, '[]', 1, 1782434585740, 1783298501883, NULL),
  ('h:d6adf843bb5c69a9', 'chatgpt', 'button', 'VIVIM.LOVE', 1, 'menu-trigger', 1782434585740, '[]', 1, 1782434585740, 1783298501885, NULL),
  ('h:7e1100a45247c242', 'chatgpt', 'button', '00000GHOST HELPERS000000000', 1, 'menu-trigger', 1782434585740, '[]', 1, 1782434585740, 1783298501887, NULL),
  ('h:5282235045805f20', 'chatgpt', 'button', 'AI-KIT', 1, 'menu-trigger', 1782434585740, '[]', 1, 1782434585740, 1783298501888, NULL),
  ('h:cfa8da307612b244', 'chatgpt', 'button', 'PEP', 1, 'menu-trigger', 1782434585740, '[]', 1, 1782434585740, 1783298501890, NULL),
  ('h:8d5d686dfd9dd74d', 'chatgpt', 'button', 'AALTOM', 1, 'menu-trigger', 1782434585740, '[]', 1, 1782434585740, 1783298501891, NULL),
  ('h:28165e806fef1150', 'chatgpt', 'button', '### natTURLizs && DIFFFUS FUS', 1, 'menu-trigger', 1782434585740, '[]', 1, 1782434585740, 1783298501893, NULL),
  ('h:ddcd7a1673d0ff3c', 'chatgpt', 'button', 'add db', 1, 'menu-trigger', 1782434585740, '[]', 1, 1782434585740, 1783298501895, NULL),
  ('h:42bf57bc6af6744f', 'chatgpt', 'button', 'new kit', 1, 'menu-trigger', 1782434585740, '[]', 1, 1782434585740, 1783298501896, NULL),
  ('h:7d02c4a6fcd68f23', 'chatgpt', 'button', 'adsf', 1, 'menu-trigger', 1782434585740, '[]', 1, 1782434585740, 1783298501898, NULL),
  ('h:08a1a27b158682d0', 'chatgpt', 'button', 'AI-kit-clean', 1, 'menu-trigger', 1782434585740, '[]', 1, 1782434585740, 1783298501900, NULL),
  ('h:cea61500ee52e12e', 'chatgpt', 'button', 'TW_ASSETS', 1, 'menu-trigger', 1782434585740, '[]', 1, 1782434585740, 1783298501901, NULL),
  ('h:c4478a19105fef57', 'chatgpt', 'button', 'AgentX', 1, 'menu-trigger', 1782434585740, '[]', 1, 1782434585740, 1783298501903, NULL),
  ('h:18b4665a1e411d07', 'chatgpt', 'button', 'Open project options for AgentX', 1, 'menu-trigger', 1782434585740, '[]', 1, 1782434585740, 1783298501904, NULL),
  ('h:c580bf728dac7814', 'chatgpt', 'button', 'Open project options for TW_ASSETS', 1, 'menu-trigger', 1782434585740, '[]', 1, 1782434585740, 1783298501906, NULL),
  ('h:856bc8f890255bd1', 'chatgpt', 'button', 'Open project options for AI-kit-clean', 1, 'menu-trigger', 1782434585740, '[]', 1, 1782434585740, 1783298501907, NULL),
  ('h:7ef599f5ca2b6e28', 'chatgpt', 'button', 'Open project options for adsf', 1, 'menu-trigger', 1782434585740, '[]', 1, 1782434585740, 1783298501909, NULL),
  ('h:9ca19cdf8798b614', 'chatgpt', 'button', 'Open project options for new kit', 1, 'menu-trigger', 1782434585740, '[]', 1, 1782434585740, 1783298501910, NULL),
  ('h:d99a262d4285fcb6', 'chatgpt', 'button', 'Open project options for add db', 1, 'menu-trigger', 1782434585740, '[]', 1, 1782434585740, 1783298501916, NULL),
  ('h:296ee6313730faaa', 'chatgpt', 'button', 'Open project options for ### natTURLizs ', 1, 'menu-trigger', 1782434585740, '[]', 1, 1782434585740, 1783298501919, NULL),
  ('h:2713ed8f610d6102', 'chatgpt', 'button', 'Open project options for AALTOM', 1, 'menu-trigger', 1782434585740, '[]', 1, 1782434585740, 1783298501920, NULL),
  ('h:12587734f6eab444', 'chatgpt', 'button', 'Open project options for PEP', 1, 'menu-trigger', 1782434585740, '[]', 1, 1782434585740, 1783298501922, NULL),
  ('h:89cf673663d88200', 'chatgpt', 'button', 'Open project options for AI-KIT', 1, 'menu-trigger', 1782434585740, '[]', 1, 1782434585740, 1783298501923, NULL),
  ('h:209692b8af33fdb0', 'chatgpt', 'button', 'Open project options for 00000GHOST HELP', 1, 'menu-trigger', 1782434585740, '[]', 1, 1782434585740, 1783298501925, NULL),
  ('h:cda9e75f30863ae1', 'chatgpt', 'button', 'Open project options for 🌱', 1, 'menu-trigger', 1782434585740, '[]', 1, 1782434585740, 1783298501927, NULL),
  ('h:f478c1151cd8c96d', 'chatgpt', 'button', 'Open project options for VIVIM.LOVE', 1, 'menu-trigger', 1782434585740, '[]', 1, 1782434585740, 1783298501929, NULL);
INSERT INTO "hole" ("id", "provider_id", "role", "name", "layer_index", "classified_as", "discovered_at", "consumed_by", "schema_version", "created_at", "updated_at", "fingerprint") VALUES
  ('h:ac0b96326ddb39db', 'chatgpt', 'div', 'You said:Say: helloChatGPT said:hello 👋', 1, 'action', 1782434585740, '[]', 1, 1782434585740, 1783298501930, NULL),
  ('h:e6150534915af7b7', 'chatgpt', 'div', 'hello 👋', 1, 'action', 1782434585740, '[]', 1, 1782434585740, 1783298501932, NULL),
  ('h:d4bdbec570c4dc48', 'chatgpt', 'div', 'Say: hello', 1, 'action', 1782434585740, '[]', 1, 1782434585740, 1783298501934, NULL),
  ('h:96f1313db3ba80d4', 'chatgpt', 'p', 'hello 👋', 1, 'action', 1782434585740, '[]', 1, 1782434585740, 1783298501936, NULL),
  ('h:4642ff6755b6dca8', 'chatgpt', 'div', 'ChatGPTUpgradeShareYou said:Say: helloCh', 1, 'commerce', 1782434585740, '[]', 1, 1782434585740, 1783298501938, NULL),
  ('h:3520061c3b2957f3', 'chatgpt', 'a', 'Hello request', 1, 'link', 1782446476647, '[]', 1, 1782446476647, 1783298501940, NULL),
  ('h:f927a81920f2800e', 'chatgpt', 'a', 'Prime Intellect Discoveries', 1, 'link', 1782446476647, '[]', 1, 1782446476647, 1783298501941, NULL),
  ('h:968a7ccd1a73dc5c', 'chatgpt', 'a', 'Private Company in Disclosure Day', 1, 'link', 1782446476647, '[]', 1, 1782446476647, 1783298501943, NULL),
  ('h:caa11eb0a03c366d', 'chatgpt', 'a', 'Web Page Automation Filtering', 1, 'link', 1782446476647, '[]', 1, 1782446476647, 1783298501945, NULL),
  ('h:a9a47639283abbd3', 'chatgpt', 'a', 'Préstamos empresariales España', 1, 'link', 1782446476647, '[]', 1, 1782446476647, 1783298501947, NULL),
  ('h:d1f559267905be41', 'chatgpt', 'a', 'Tauri Chromium Integration', 1, 'link', 1782446476647, '[]', 1, 1782446476647, 1783298501949, NULL),
  ('h:d839aabf4059bda0', 'chatgpt', 'a', 'Math question response', 1, 'link', 1782446476647, '[]', 1, 1782446476647, 1783298501950, NULL),
  ('h:02bd97a120b5aef8', 'chatgpt', 'a', 'Familia Garza México', 1, 'link', 1782446476647, '[]', 1, 1782446476647, 1783298501952, NULL),
  ('h:1de113df9b528745', 'chatgpt', 'a', 'AI Project Manager Architecture', 1, 'link', 1782446476647, '[]', 1, 1782446476647, 1783298501954, NULL),
  ('h:4559597c932aa792', 'chatgpt', 'a', 'Cargo build size optimization', 1, 'link', 1782446476647, '[]', 1, 1782446476647, 1783298501955, NULL),
  ('h:c72daf7d26d471bf', 'chatgpt', 'a', 'Local Gmail API Access', 1, 'link', 1782446476647, '[]', 1, 1782446476647, 1783298501957, NULL),
  ('h:010c43dba40e10ea', 'chatgpt', 'a', 'Impulse Space Overview', 1, 'link', 1782446476647, '[]', 1, 1782446476647, 1783298501958, NULL),
  ('h:ad8e3372d97da50d', 'chatgpt', 'a', 'Situación Cash Patel', 1, 'link', 1782446476647, '[]', 1, 1782446476647, 1783298501960, NULL),
  ('h:0702cf50ce365cff', 'chatgpt', 'a', 'Ivan Franco Mexico Dictator', 1, 'link', 1782446476647, '[]', 1, 1782446476647, 1783298501962, NULL),
  ('h:e7ac5720a9805c9d', 'chatgpt', 'menuitem', 'Read aloud', 1, 'action', 1782446476647, '[]', 1, 1782446476647, 1783298501963, NULL),
  ('h:3a9b51a3fb643d39', 'chatgpt', 'menuitem', 'Branch in new chat', 1, 'nav', 1782446476647, '[]', 1, 1782446476647, 1783298501965, NULL),
  ('h:238a2cdb49a8c024', 'chatgpt', 'menuitem', 'View sources', 1, 'action', 1782446476647, '[]', 1, 1782446476647, 1783298501966, NULL),
  ('h:1b9ee7bbc08f2c4b', 'chatgpt', 'menuitem', 'Today, 2:34 AM', 1, 'action', 1782446476647, '[]', 1, 1782446476647, 1783298501968, NULL),
  ('h:aef61948d701ca4b', 'chatgpt', 'menu', 'Today, 2:34 AMView sourcesBranch in new ', 1, 'action', 1782446476647, '[]', 1, 1782446476647, 1783298501969, NULL),
  ('h:7d2149b3d2d1737b', 'chatgpt', 'group', 'Response actions', 1, 'action', 1782446478603, '[]', 1, 1782446478603, 1783298501971, NULL),
  ('h:dcdf55fb98612ded', 'chatgpt', 'button', 'Copy response', 1, 'action', 1782446478603, '[]', 1, 1782446478603, 1783298501972, NULL),
  ('h:2bf65f2498baa76f', 'chatgpt', 'button', 'Good response', 1, 'action', 1782446478603, '[]', 1, 1782446478603, 1783298501974, NULL),
  ('h:949445380ab7b8e8', 'chatgpt', 'button', 'Bad response', 1, 'action', 1782446478603, '[]', 1, 1782446478603, 1783298501976, NULL),
  ('h:06fc833a4115cdd1', 'chatgpt', 'button', 'Switch model', 1, 'menu-trigger', 1782446478603, '[]', 1, 1782446478603, 1783298501978, NULL),
  ('h:51759ab5e4e8ab77', 'chatgpt', 'div', 'More actions', 1, 'menu-trigger', 1782446478603, '[]', 1, 1782446478603, 1783298501980, NULL),
  ('h:f80d9ab08a2a743a', 'chatgpt', 'button', 'More actions', 1, 'menu-trigger', 1782446478603, '[]', 1, 1782446478603, 1783298501982, NULL),
  ('h:ed88056d95c825d8', 'chatgpt', 'li', 'Local Gmail API Access', 0, 'action', 1782446567491, '[]', 1, 1782446567491, 1783298501984, NULL),
  ('h:58ad5def4b1f3cfb', 'chatgpt', 'li', 'Familia Garza México', 0, 'action', 1782446567491, '[]', 1, 1782446567491, 1783298501986, NULL),
  ('h:ce025029fcf9c964', 'chatgpt', 'li', 'Web Page Automation Filtering', 0, 'action', 1782446567491, '[]', 1, 1782446567491, 1783298501988, NULL),
  ('h:0fb2745db4db163f', 'chatgpt', 'li', 'Prime Intellect Discoveries', 0, 'action', 1782446567491, '[]', 1, 1782446567491, 1783298501990, NULL),
  ('h:e1e6918fac864f37', 'chatgpt', 'div', 'clear composer. Respond briefly.', 0, 'action', 1782446567491, '[]', 1, 1782446567491, 1783298501992, NULL),
  ('h:134bfe73b2af0bb3', 'chatgpt', 'div', 'Generation stopped. Brief response. 👍1/', 0, 'action', 1782446567491, '[]', 1, 1782446567491, 1783298501994, NULL),
  ('h:1d962bc903e9d81f', 'chatgpt', 'div', 'stop generation. Respond briefly.0/2', 0, 'action', 1782446567491, '[]', 1, 1782446567491, 1783298501995, NULL),
  ('h:4059c65b63441d51', 'chatgpt', 'div', 'stop generation. Respond briefly.', 0, 'action', 1782446567491, '[]', 1, 1782446567491, 1783298501997, NULL),
  ('h:1a107d3a8ff048ea', 'chatgpt', 'div', '0/2', 0, 'action', 1782446567491, '[]', 1, 1782446567491, 1783298501999, NULL),
  ('h:e20b8726d7c45639', 'chatgpt', 'p', 'Generation stopped. Brief response. 👍', 0, 'action', 1782446567491, '[]', 1, 1782446567491, 1783298502000, NULL),
  ('h:e317f76cf862f8e5', 'chatgpt', 'div', '1/2', 0, 'action', 1782446567491, '[]', 1, 1782446567491, 1783298502002, NULL),
  ('h:9d92d5e84b2b450c', 'chatgpt', 'a', '[0,0], chat in project TIMEWATCHERS', 1, 'link', 1782449040773, '[]', 1, 1782449040773, 1783298502003, NULL),
  ('h:f510c1672058e583', 'chatgpt', 'a', 'Audit and enhancements, chat in project ', 1, 'link', 1782449040773, '[]', 1, 1782449040773, 1783298502005, NULL),
  ('h:17db5da73fd25669', 'chatgpt', 'a', 'JavaScript CPU profile explanation, chat', 1, 'menu-trigger', 1782449040773, '[]', 1, 1782449040773, 1783298502007, NULL),
  ('h:8b597f96b850b0a0', 'chatgpt', 'a', 'Engine implementation overview, chat in ', 1, 'link', 1782449040773, '[]', 1, 1782449040773, 1783298502009, NULL),
  ('h:f057a6311a43d0e7', 'chatgpt', 'a', 'Readiness milestone assumptions, chat in', 1, 'link', 1782449040773, '[]', 1, 1782449040773, 1783298502011, NULL),
  ('h:3623d7da1150b620', 'chatgpt', 'menuitemradio', 'By project', 1, 'action', 1782449040773, '[]', 1, 1782449040773, 1783298502013, NULL),
  ('h:490a91092d6cdffd', 'chatgpt', 'menuitemradio', 'In one list', 1, 'action', 1782449040773, '[]', 1, 1782449040773, 1783298502015, NULL),
  ('h:f619f867162697b6', 'chatgpt', 'div', 'Organize chats', 1, 'action', 1782449040773, '[]', 1, 1782449040773, 1783298502017, NULL),
  ('h:18dd49096ff39407', 'chatgpt', 'div', 'Create an imageWrite or editLook somethi', 1, 'action', 1782449040773, '[]', 1, 1782449040773, 1783298502018, NULL),
  ('h:f038424650b83b63', 'chatgpt', 'div', 'Ready when you are.Ready when you are.', 1, 'action', 1782449040773, '[]', 1, 1782449040773, 1783298502020, NULL),
  ('h:3c0f160171f3223e', 'chatgpt', 'button', 'Create an image', 1, 'action', 1782449040773, '[]', 1, 1782449040773, 1783298502022, NULL),
  ('h:1453b365dab24b34', 'chatgpt', 'div', 'ChatGPTUpgradeReady when you are.Ready w', 1, 'commerce', 1782449040773, '[]', 1, 1782449040773, 1783298502024, NULL),
  ('h:e6519769c30e95dd', 'chatgpt', 'div', 'Ready when you are.', 1, 'action', 1782449040773, '[]', 1, 1782449040773, 1783298502026, NULL),
  ('h:c01940c91e8f15ec', 'chatgpt', 'button', 'Write or edit', 1, 'action', 1782449040773, '[]', 1, 1782449040773, 1783298502028, NULL),
  ('h:73dbfc7f5d9a57b7', 'chatgpt', 'button', 'Look something up', 1, 'action', 1782449040773, '[]', 1, 1782449040773, 1783298502030, NULL),
  ('h:f7c8703ad866f9ba', 'chatgpt', 'button', 'Turn on temporary chat', 1, 'action', 1782449040773, '[]', 1, 1782449040773, 1783298502031, NULL),
  ('h:37ea31bd4422a314', 'chatgpt', 'div', 'New chatSearchRecentsChat historyNew cha', 1, 'nav', 1782449044266, '[]', 1, 1782449044266, 1783298502033, NULL),
  ('h:a5b568867232225f', 'chatgpt', 'menuitem', 'Share project', 1, 'action', 1782449044266, '[]', 1, 1782449044266, 1783298502034, NULL),
  ('h:4b9cfdbcbbfd6774', 'chatgpt', 'menuitem', 'Rename project', 1, 'action', 1782449044266, '[]', 1, 1782449044266, 1783298502036, NULL),
  ('h:e79ef57dac9c74ef', 'chatgpt', 'menuitem', 'Project settings', 1, 'menu-trigger', 1782449044266, '[]', 1, 1782449044266, 1783298502037, NULL),
  ('h:6b9e04684bd49057', 'chatgpt', 'menu', 'Share projectRename projectProject setti', 1, 'action', 1782449044266, '[]', 1, 1782449044266, 1783298502039, NULL),
  ('h:65fb9b7c570dfbe3', 'chatgpt', 'menuitem', 'Pin project', 1, 'action', 1782449044266, '[]', 1, 1782449044266, 1783298502041, NULL),
  ('h:54b0accf112cad45', 'chatgpt', 'menuitem', 'Delete project', 1, 'action', 1782449044266, '[]', 1, 1782449044266, 1783298502043, NULL),
  ('h:e85fdea9f1d3091f', 'chatgpt', 'div', 'Share projectRename projectProject setti', 1, 'action', 1782449044266, '[]', 1, 1782449044266, 1783298502045, NULL),
  ('h:e54ccbdb871bd09c', 'chatgpt', 'menuitem', 'Project home', 1, 'action', 1782449044266, '[]', 1, 1782449044266, 1783298502047, NULL),
  ('h:5a4c265cd3d74cdb', 'chatgpt', 'div', 'MATHChatGPTUpgrade', 1, 'commerce', 1782449045965, '[]', 1, 1782449045965, 1783298502049, NULL),
  ('h:0d7ef9c9e9e760a3', 'chatgpt', 'div', 'MATHChatGPTUpgradeMATHSharewindow.__oai_', 0, 'commerce', 1782449096985, '[]', 1, 1782449096985, 1783298502051, NULL),
  ('h:c6c5c1e84bb89953', 'chatgpt', 'div', 'MATHSharewindow.__oai_logHTML?window.__o', 0, 'action', 1782449096985, '[]', 1, 1782449096985, 1783298502053, NULL),
  ('h:d19323d8ae8c8227', 'chatgpt', 'div', 'MATHShare', 0, 'action', 1782449096985, '[]', 1, 1782449096985, 1783298502054, NULL),
  ('h:0365df6668071f39', 'chatgpt', 'div', 'No chats yetChats in MATH will live here', 0, 'action', 1782449096985, '[]', 1, 1782449096985, 1783298502056, NULL),
  ('h:1c4daf121f9066ba', 'chatgpt', 'tab', 'Chats', 0, 'nav', 1782449096985, '[]', 1, 1782449096985, 1783298502058, NULL),
  ('h:761f8c93e096effe', 'chatgpt', 'button', 'Open project icon and color menu. Select', 0, 'menu-trigger', 1782449096985, '[]', 1, 1782449096985, 1783298502060, NULL),
  ('h:f0edef7034e57d3d', 'chatgpt', 'tablist', 'Project sections', 0, 'action', 1782449096985, '[]', 1, 1782449096985, 1783298502062, NULL),
  ('h:bf64158155e2e446', 'chatgpt', 'textbox', 'New chat in MATH', 0, 'composer', 1782449096985, '[]', 1, 1782449096985, 1783298502063, NULL),
  ('h:7a4c90a3162dda71', 'chatgpt', 'button', 'Edit the title of MATH', 0, 'action', 1782449096985, '[]', 1, 1782449096985, 1783298502065, NULL),
  ('h:cb90b0a81b3b0eb1', 'chatgpt', 'tab', 'Sources', 0, 'action', 1782449096985, '[]', 1, 1782449096985, 1783298502066, NULL),
  ('h:2c110b97ba3b1532', 'chatgpt', 'h1', 'MATH', 0, 'action', 1782449096985, '[]', 1, 1782449096985, 1783298502068, NULL),
  ('h:fc661866c2d000ec', 'chatgpt', 'div', 'ChatsSources', 0, 'action', 1782449096985, '[]', 1, 1782449096985, 1783298502070, NULL),
  ('h:ea38477f34546cea', 'chatgpt', 'p', 'Chats in MATH will live here', 0, 'action', 1782449096985, '[]', 1, 1782449096985, 1783298502071, NULL),
  ('h:22087636044ea62e', 'chatgpt', 'h3', 'No chats yet', 0, 'action', 1782449096985, '[]', 1, 1782449096985, 1783298502073, NULL),
  ('h:ab09068db3f7386b', 'chatgpt', 'button', 'Show project details', 0, 'menu-trigger', 1782449096985, '[]', 1, 1782449096985, 1783298502074, NULL),
  ('h:fccbb62d2b85a147', 'chatgpt', 'li', 'Hello World Request', 1, 'action', 1782747278719, '[]', 1, 1782747278719, 1783298502093, NULL),
  ('h:9f575eaf6f7994ad', 'chatgpt', 'li', 'No response received', 1, 'action', 1782747278719, '[]', 1, 1782747278719, 1783298502095, NULL),
  ('h:fd9cd8d9bc3fb4e9', 'chatgpt', 'li', 'Hello world request', 1, 'action', 1782747278719, '[]', 1, 1782747278719, 1783298502097, NULL),
  ('h:bdb2762c2187ab84', 'chatgpt', 'li', 'Say hello world', 1, 'action', 1782747278719, '[]', 1, 1782747278719, 1783298502099, NULL),
  ('h:33a0de96ff0ceec5', 'chatgpt', 'li', 'File Attachment Instructions', 1, 'action', 1782747278719, '[]', 1, 1782747278719, 1783298502101, NULL),
  ('h:15baace162d8b1b5', 'chatgpt', 'div', 'RecentsFile Attachment InstructionsHello', 1, 'nav', 1782747278719, '[]', 1, 1782747278719, 1783298502102, NULL),
  ('h:25583c21e741bb74', 'chatgpt', 'h2', 'Recents', 1, 'nav', 1782747278719, '[]', 1, 1782747278719, 1783298502104, NULL),
  ('h:bb593e780e9aee1b', 'chatgpt', 'a', 'File Attachment Instructions', 1, 'link', 1782747278719, '[]', 1, 1782747278719, 1783298502106, NULL),
  ('h:abdb8a16af227681', 'chatgpt', 'div', 'ChatGPT PlusOur smartest model & moreUpg', 1, 'action', 1782747291925, '[]', 1, 1782747291925, 1783298502115, NULL),
  ('h:fc8b677b788a76f0', 'chatgpt', 'menu', 'ChatGPT PlusOur smartest model & moreUpg', 1, 'action', 1782747291925, '[]', 1, 1782747291925, 1783298502116, NULL),
  ('h:816e6c721d24ef61', 'chatgpt', 'menuitemradio', 'ChatGPTGreat for everyday tasks', 1, 'action', 1782747291925, '[]', 1, 1782747291925, 1783298502118, NULL),
  ('h:19bd032b1ea2845a', 'chatgpt', 'menuitem', 'ChatGPT PlusOur smartest model & moreUpg', 1, 'action', 1782747291925, '[]', 1, 1782747291925, 1783298502119, NULL),
  ('h:f94d8259b9f44779', 'claude', 'div', 'Fable 5Currently unavailableUpgrade', 0, 'commerce', 1783298502143, '[]', 1, 1782868075079, 1783298502143, NULL),
  ('h:c01cd96ae6e6c0dc', 'claude', 'group', 'Fable 5Currently unavailableUpgradeOpus', 0, 'commerce', 1782761058502, '[]', 1, 1782868075079, 1783298502792, NULL),
  ('h:303ffe43bff687a4', 'claude', 'group', 'Opus 4.7UpgradeOpus 4.6UpgradeOpus 3Upgr', 0, 'commerce', 1782761058502, '[]', 1, 1782868075079, 1783298502794, NULL),
  ('h:ec11961b07afe646', 'claude', 'menuitemradio', 'Opus 4.6Upgrade', 0, 'commerce', 1783298502143, '[]', 1, 1782868075079, 1783298502149, NULL),
  ('h:cbb77044a3e4c048', 'claude', 'menuitemradio', 'Opus 3Upgrade', 0, 'commerce', 1783298502143, '[]', 1, 1782868075079, 1783298502151, NULL);
INSERT INTO "hole" ("id", "provider_id", "role", "name", "layer_index", "classified_as", "discovered_at", "consumed_by", "schema_version", "created_at", "updated_at", "fingerprint") VALUES
  ('h:d05852a26b24315d', 'claude', 'menuitemradio', 'Opus 4.7Upgrade', 0, 'commerce', 1783298502143, '[]', 1, 1782868075079, 1783298502152, NULL),
  ('h:e0ff881f57252998', 'claude', 'menuitemradio', 'Sonnet 4.6', 0, 'action', 1783298502143, '[]', 1, 1782868075079, 1783298502154, NULL),
  ('h:3f59e1d86bbfd478', 'claude', 'div', 'Add custom connectorBETAConnect Claude ', 0, 'action', 1782760990956, '[]', 1, 1782868075079, 1783298502765, NULL),
  ('h:27869db19f15a8af', 'claude', 'span', 'Add custom connectorBETA', 0, 'action', 1782760990956, '[]', 1, 1782868075079, 1783298502767, NULL),
  ('h:54b91b188d29eb2a', 'claude', 'span', 'Connect Claude to your data and tools. L', 0, 'action', 1782760990956, '[]', 1, 1782868075079, 1783298502769, NULL),
  ('h:6343653c2a53a242', 'claude', 'input', 'Name', 0, 'action', 1782760990956, '[]', 1, 1782868075079, 1783298502771, NULL),
  ('h:c2c7dfb73b187314', 'claude', 'input', 'Remote MCP server URL', 0, 'action', 1782760990956, '[]', 1, 1782868075079, 1783298502772, NULL),
  ('h:4aba907032c04782', 'claude', 'button', 'Advanced settings', 0, 'menu-trigger', 1782760990956, '[]', 1, 1782868075079, 1783298502774, NULL),
  ('h:723e374e78f351fa', 'claude', 'input', 'OAuth Client ID (optional)', 0, 'action', 1782760990956, '[]', 1, 1782868075079, 1783298502776, NULL),
  ('h:6c0958d37df17522', 'claude', 'menuitemradio', 'español (Latinoamérica)', 0, 'action', 1783298502143, '[]', 1, 1782868075079, 1783298502167, NULL),
  ('h:8fb33b4de78aff3c', 'claude', 'menuitemradio', 'italiano (Italia)', 0, 'action', 1783298502143, '[]', 1, 1782868075079, 1783298502169, NULL),
  ('h:0c2c0998f1e7bba6', 'claude', 'menuitemradio', 'Indonesia (Indonesia)', 0, 'action', 1783298502143, '[]', 1, 1782868075079, 1783298502171, NULL),
  ('h:f4f90a1a89b9b39d', 'claude', 'menuitemradio', 'Deutsch (Deutschland)', 0, 'action', 1783298502143, '[]', 1, 1782868075079, 1783298502172, NULL),
  ('h:bf0fa267bd59d7ee', 'claude', 'menuitemradio', 'français (France)', 0, 'action', 1783298502143, '[]', 1, 1782868075079, 1783298502174, NULL),
  ('h:acf1b549d663d29e', 'claude', 'menuitemradio', 'English (United States)', 0, 'action', 1783298502143, '[]', 1, 1782868075079, 1783298502175, NULL),
  ('h:ee5932205d017b7d', 'claude', 'button', 'Upgrade', 0, 'commerce', 1783298502143, '[]', 1, 1782868075079, 1783298502177, NULL),
  ('h:623580aefc438e48', 'claude', 'menuitemradio', 'español (España)', 0, 'action', 1783298502143, '[]', 1, 1782868075079, 1783298502178, NULL),
  ('h:1a7e9658d0ee2ae0', 'claude', 'menuitemradio', 'Haiku 4.5Fastest for quick answers', 0, 'action', 1783298502143, '[]', 1, 1782868075079, 1783298502180, NULL),
  ('h:6f381cdc3e8d01aa', 'claude', 'group', 'Haiku 4.5Fastest for quick answers', 0, 'action', 1783298502143, '[]', 1, 1782868075079, 1783298502181, NULL),
  ('h:1865269a432f7aa8', 'claude', 'menuitem', 'ExtendedAlways uses deep reasoning', 0, 'action', 1783298502143, '[]', 1, 1782868075079, 1783298502183, NULL),
  ('h:746882dff7a74dbb', 'claude', 'menuitem', 'More models', 0, 'menu-trigger', 1783298502143, '[]', 1, 1782868075079, 1783298502185, NULL),
  ('h:4d8e019364920c67', 'claude', 'input', 'OAuth Client Secret (optional)', 0, 'action', 1782760990956, '[]', 1, 1782868075079, 1783298502777, NULL),
  ('h:7edd4f8366008b41', 'claude', 'div', 'Advanced settings', 0, 'menu-trigger', 1782760990956, '[]', 1, 1782868075079, 1783298502787, NULL),
  ('h:fb1bbd4cc1725d05', 'claude', 'a', 'Learn more about connectors', 0, 'menu-trigger', 1782760990956, '[]', 1, 1782868075079, 1783298502789, NULL),
  ('h:5de8982db7a400fb', 'claude', 'div', 'Add custom connectorBETA', 0, 'action', 1782760990956, '[]', 1, 1782868075079, 1783298502791, NULL),
  ('h:7b37dc7a30b5435b', 'claude', 'button', 'Open sidebar', 0, 'action', 1782371926039, '[]', 1, 1782371926039, 1783298502197, NULL),
  ('h:e28ae0baafa3a3af', 'claude', 'main', 'Free planUpgradeHey there, owenClaude Fa', 0, 'commerce', 1782371926039, '[]', 1, 1782371926039, 1783298502199, NULL),
  ('h:fa455f47652b2080', 'claude', 'span', 'Claude Fable 5 is currently unavailable.', 0, 'action', 1782371926039, '[]', 1, 1782371926039, 1783298502201, NULL),
  ('h:153de6858d2efdc5', 'claude', 'textbox', 'Write your prompt to Claude', 0, 'composer', 1782371926039, '[]', 1, 1782371926039, 1783298502202, NULL),
  ('h:c899ea5d56548d11', 'claude', 'button', 'Add files, connectors, and more', 0, 'menu-trigger', 1782371926039, '[]', 1, 1782371926039, 1783298502204, NULL),
  ('h:8062bc57610940f2', 'claude', 'ul', 'Prompt categories', 0, 'action', 1782371926039, '[]', 1, 1782371926039, 1783298502206, NULL),
  ('h:ee5728a46831dc15', 'claude', 'div', 'Sonnet 4.6 Low', 0, 'action', 1782371926039, '[]', 1, 1782371926039, 1783298502208, NULL),
  ('h:9da4fcd3c63ccac0', 'claude', 'button', 'Code', 0, 'action', 1782371926039, '[]', 1, 1782371926039, 1783298502210, NULL),
  ('h:5a1c61c6be9893d5', 'claude', 'li', 'Code', 0, 'action', 1782371926039, '[]', 1, 1782371926039, 1783298502212, NULL),
  ('h:f459cc8800ecd3a6', 'claude', 'div', 'Hey there, owen', 0, 'action', 1782371926039, '[]', 1, 1782371926039, 1783298502213, NULL),
  ('h:99a547b373f97a10', 'claude', 'button', 'Write', 0, 'action', 1782371926039, '[]', 1, 1782371926039, 1783298502215, NULL),
  ('h:d6ef418d2e2788b2', 'claude', 'span', 'Hey there, owen', 0, 'action', 1782371926039, '[]', 1, 1782371926039, 1783298502217, NULL),
  ('h:9687fd9cb4f56cd5', 'claude', 'div', 'Free planUpgrade', 0, 'commerce', 1782371926039, '[]', 1, 1782371926039, 1783298502219, NULL),
  ('h:01455a0b7f30b2d5', 'claude', 'button', 'Learn', 0, 'action', 1782371926039, '[]', 1, 1782371926039, 1783298502221, NULL),
  ('h:4993a4135158f1d3', 'claude', 'div', 'Claude Fable 5 is currently unavailable.', 0, 'action', 1782371926039, '[]', 1, 1782371926039, 1783298502222, NULL),
  ('h:64597a96081d3781', 'claude', 'a', 'Upgrade', 0, 'commerce', 1782371926039, '[]', 1, 1782371926039, 1783298502224, NULL),
  ('h:da201ecec3f4ca72', 'claude', 'button', 'Life stuff', 0, 'action', 1782371926039, '[]', 1, 1782371926039, 1783298502225, NULL),
  ('h:5e258370116b41e0', 'claude', 'button', 'Model: Sonnet 4.6 Low', 0, 'menu-trigger', 1782371926039, '[]', 1, 1782371926039, 1783298502227, NULL),
  ('h:248cf9248639030c', 'claude', 'button', 'Claude’s choice', 0, 'action', 1782371926039, '[]', 1, 1782371926039, 1783298502228, NULL),
  ('h:4cbca04dcf28c100', 'claude', 'button', 'Settings', 0, 'menu-trigger', 1782371926039, '[]', 1, 1782371926039, 1783298502230, NULL),
  ('h:187bcf67fa28083a', 'claude', 'a', 'Learn more(opens in new tab)', 0, 'menu-trigger', 1782371926039, '[]', 1, 1782371926039, 1783298502231, NULL),
  ('h:3ee11037d24eb733', 'claude', 'button', 'Press and hold to record', 0, 'action', 1782371926039, '[]', 1, 1782371926039, 1783298502233, NULL),
  ('h:f2b2dfe851e1f032', 'claude', 'button', 'Use voice mode', 0, 'action', 1782371926039, '[]', 1, 1782371926039, 1783298502234, NULL),
  ('h:ba916692e2bedf16', 'claude', 'button', 'Dismiss', 0, 'action', 1782371926039, '[]', 1, 1782371926039, 1783298502236, NULL),
  ('h:8147d854ae7e61ac', 'claude', 'button', 'Use incognito', 0, 'action', 1782371926039, '[]', 1, 1782371926039, 1783298502238, NULL),
  ('h:0f87a8d2b09adf9c', 'claude', 'main', 'Free planUpgradeGood evening, owenClaude', 0, 'commerce', 1782406704937, '[]', 1, 1782406704937, 1783298502240, NULL),
  ('h:12633ee8ec804a22', 'claude', 'div', 'Good evening, owen', 0, 'action', 1782406704937, '[]', 1, 1782406704937, 1783298502242, NULL),
  ('h:82c7d6adaa4f298e', 'claude', 'span', 'Good evening, owen', 0, 'action', 1782406704937, '[]', 1, 1782406704937, 1783298502243, NULL),
  ('h:39d412d8d8cc7504', 'claude', 'div', 'Sonnet 4.6 Low', 0, 'action', 1782406704937, '[]', 1, 1782406704937, 1783298502246, NULL),
  ('h:4e74e56db559eed5', 'claude', 'tooltip', 'Add files, connectors, and more/', 1, 'menu-trigger', 1782407015044, '[]', 1, 1782407015044, 1783298502247, NULL),
  ('h:c927b8bdd3b94714', 'claude', 'presentation', 'Fable 5Currently unavailableFor your to', 1, 'action', 1782407015044, '[]', 1, 1782407015044, 1783298502249, NULL),
  ('h:cd27cfc738de7f67', 'claude', 'div', 'Fable 5Currently unavailableFor your to', 1, 'action', 1782407015044, '[]', 1, 1782407015044, 1783298502251, NULL),
  ('h:2b1c2493dbc62642', 'claude', 'menuitemradio', 'Opus 4.8For complex tasksUpgrade', 1, 'commerce', 1782407015044, '[]', 1, 1782407015044, 1783298502253, NULL),
  ('h:a077a0e8be0a52fc', 'claude', 'menuitemradio', 'Sonnet 4.6Most efficient for everyday ta', 1, 'action', 1782407015044, '[]', 1, 1782407015044, 1783298502255, NULL),
  ('h:57f83c66105c7922', 'claude', 'group', 'Fable 5Currently unavailableFor your to', 1, 'action', 1782407015044, '[]', 1, 1782407015044, 1783298502257, NULL),
  ('h:b68d16574854172e', 'claude', 'menuitemradio', 'Haiku 4.5Fastest for quick answers', 1, 'action', 1782407015044, '[]', 1, 1782407015044, 1783298502258, NULL),
  ('h:be203e894d78ea90', 'claude', 'menuitem', 'More models', 1, 'menu-trigger', 1782407015044, '[]', 1, 1782407015044, 1783298502260, NULL),
  ('h:060964e9d34eefed', 'claude', 'menuitem', 'EffortLow', 1, 'menu-trigger', 1782407015044, '[]', 1, 1782407015044, 1783298502262, NULL),
  ('h:7c90df60e9a33eb9', 'claude', 'div', 'Higher effort means more thorough respon', 2, 'menu-trigger', 1782407299996, '[]', 1, 1782407299996, 1783298502263, NULL),
  ('h:40e0a7a34fd2b8c5', 'claude', 'presentation', 'Higher effort means more thorough respon', 2, 'menu-trigger', 1782407299996, '[]', 1, 1782407299996, 1783298502265, NULL),
  ('h:30c5d3799aaa7428', 'claude', 'menuitemradio', 'LowDefault', 2, 'action', 1782407299996, '[]', 1, 1782407299996, 1783298502266, NULL),
  ('h:0b412a891d0574e3', 'claude', 'menuitemradio', 'Medium', 2, 'action', 1782407299996, '[]', 1, 1782407299996, 1783298502267, NULL),
  ('h:c927853c40c96f6d', 'claude', 'menuitemradio', 'High', 2, 'action', 1782407299996, '[]', 1, 1782407299996, 1783298502269, NULL),
  ('h:38428d2f9dbeae0e', 'claude', 'menuitemradio', 'Max', 2, 'action', 1782407299996, '[]', 1, 1782407299996, 1783298502271, NULL),
  ('h:9b0cef935cf9fd50', 'claude', 'menuitem', 'ThinkingCan think for more complex tasks', 2, 'menu-trigger', 1782407299996, '[]', 1, 1782407299996, 1783298502273, NULL),
  ('h:b2a05c4365c9c3ee', 'claude', 'span', 'Add files, connectors, and more', 2, 'menu-trigger', 1782407299996, '[]', 1, 1782407299996, 1783298502274, NULL),
  ('h:6a902e929b255a3c', 'claude', 'switch', 'Thinking', 2, 'toggle', 1782407299996, '[]', 1, 1782407299996, 1783298502276, NULL),
  ('h:47debd5abdef43e0', 'claude', 'group', 'LowDefaultMediumHighMax', 2, 'action', 1782407299996, '[]', 1, 1782407299996, 1783298502278, NULL),
  ('h:82b3b3c4be3365aa', 'claude', 'button', 'Upgrade', 2, 'commerce', 1782407299996, '[]', 1, 1782407299996, 1783298502279, NULL),
  ('h:88ce93eda14aaa16', 'claude', 'menuitemcheckbox', 'Web search', 1, 'action', 1782415854982, '[]', 1, 1782415854982, 1783298502281, NULL),
  ('h:ce0987a2b0d5bc1f', 'claude', 'div', 'Add files or photosCtrl+UTake a screensh', 1, 'action', 1782415854982, '[]', 1, 1782415854982, 1783298502283, NULL),
  ('h:0f37a1a062b2d2f1', 'claude', 'menuitem', 'Skills', 1, 'menu-trigger', 1782415854982, '[]', 1, 1782415854982, 1783298502285, NULL),
  ('h:b4bbca8300640475', 'claude', 'menuitem', 'Add to project', 1, 'menu-trigger', 1782415854982, '[]', 1, 1782415854982, 1783298502287, NULL),
  ('h:c4e46ea7e71fd010', 'claude', 'menuitem', 'Take a screenshot', 1, 'action', 1782415854982, '[]', 1, 1782415854982, 1783298502288, NULL),
  ('h:9114dd93fa142806', 'claude', 'menuitem', 'Add files or photosCtrl+U', 1, 'action', 1782415854982, '[]', 1, 1782415854982, 1783298502290, NULL),
  ('h:2f13226b9de1fd7c', 'claude', 'menuitem', 'Add connector', 1, 'menu-trigger', 1782415854982, '[]', 1, 1782415854982, 1783298502291, NULL),
  ('h:b511b113a5d93be3', 'claude', 'menuitem', 'Add plugins...', 1, 'action', 1782415854982, '[]', 1, 1782415854982, 1783298502293, NULL),
  ('h:a7b903c1feb844b3', 'claude', 'span', 'Web search', 1, 'action', 1782415854982, '[]', 1, 1782415854982, 1783298502295, NULL),
  ('h:80287060cf4b2bfe', 'claude', 'div', 'How can I help you today?Sonnet 4.6 Low', 1, 'action', 1782415858617, '[]', 1, 1782415858617, 1783298502297, NULL),
  ('h:c595c98d8194ec0b', 'claude', 'menuitem', 'skill-creator', 1, 'action', 1782415858617, '[]', 1, 1782415858617, 1783298502299, NULL),
  ('h:689c06647e95384a', 'claude', 'menuitem', 'Manage skills', 1, 'action', 1782415858617, '[]', 1, 1782415858617, 1783298502300, NULL),
  ('h:569b4aadaed05b64', 'claude', 'menuitem', 'Browse connectors', 1, 'action', 1782415858617, '[]', 1, 1782415858617, 1783298502302, NULL),
  ('h:cdcee2e1ffff01c5', 'claude', 'menuitem', 'Add custom connector', 1, 'action', 1782415858617, '[]', 1, 1782415858617, 1783298502303, NULL),
  ('h:0229ca709184a683', 'claude', 'div', 'Browse connectorsAdd custom connector', 1, 'action', 1782415858617, '[]', 1, 1782415858617, 1783298502305, NULL),
  ('h:de51d61959fc5b27', 'claude', 'menuitem', 'Start a new project', 1, 'action', 1782415858617, '[]', 1, 1782415858617, 1783298502307, NULL),
  ('h:0ccde9eed3312a75', 'claude', 'div', 'Start a new project', 1, 'action', 1782415858617, '[]', 1, 1782415858617, 1783298502308, NULL),
  ('h:642890f8a7cf759c', 'claude', 'menuitemradio', 'Opus 3Upgrade', 1, 'commerce', 1782415858617, '[]', 1, 1782415858617, 1783298502309, NULL),
  ('h:4cf96bab72f5354c', 'claude', 'menuitemradio', 'Opus 4.6Upgrade', 1, 'commerce', 1782415858617, '[]', 1, 1782415858617, 1783298502311, NULL),
  ('h:d33fce3bce31a9ef', 'claude', 'menuitemradio', 'Opus 4.7Upgrade', 1, 'commerce', 1782415858617, '[]', 1, 1782415858617, 1783298502312, NULL),
  ('h:24447b8f902cba28', 'claude', 'div', 'Opus 4.7UpgradeOpus 4.6UpgradeOpus 3Upgr', 1, 'commerce', 1782415858617, '[]', 1, 1782415858617, 1783298502314, NULL),
  ('h:42acd6d62e9e0dae', 'claude', 'div', 'Claude finished the responseYou said: Sa', 0, 'action', 1782421243861, '[]', 1, 1782421243861, 1783298502316, NULL),
  ('h:d641d9e48123cc45', 'claude', 'div', 'Test messageFree planUpgrade', 0, 'commerce', 1782421243861, '[]', 1, 1782421243861, 1783298502317, NULL),
  ('h:3e1561db6cdd425e', 'claude', 'button', 'Test message, rename chat', 0, 'action', 1782421243861, '[]', 1, 1782421243861, 1783298502319, NULL),
  ('h:dd9f2b6bf1816e28', 'claude', 'note', 'Claude is AI and can make mistakes. Plea', 0, 'action', 1782421243861, '[]', 1, 1782421243861, 1783298502320, NULL),
  ('h:1d2c9c36a443085f', 'claude', 'div', 'Want to be notified when Claude responds', 0, 'action', 1782421243861, '[]', 1, 1782421243861, 1783298502322, NULL);
INSERT INTO "hole" ("id", "provider_id", "role", "name", "layer_index", "classified_as", "discovered_at", "consumed_by", "schema_version", "created_at", "updated_at", "fingerprint") VALUES
  ('h:4bbd1a18923ee6cc', 'claude', 'div', 'You said: Say: testSay: test10:31 PM', 0, 'action', 1782421243861, '[]', 1, 1782421243861, 1783298502323, NULL),
  ('h:592316784542152e', 'claude', 'div', 'You said: Search the web: what is the ca', 0, 'action', 1782421243861, '[]', 1, 1782421243861, 1783298502325, NULL),
  ('h:e641f5411dc2808d', 'claude', 'div', 'WorkingSearched the web', 0, 'action', 1782421243861, '[]', 1, 1782421243861, 1783298502326, NULL),
  ('h:be03b4f0fbf07038', 'claude', 'button', 'Working', 0, 'menu-trigger', 1782421243861, '[]', 1, 1782421243861, 1783298502328, NULL),
  ('h:a576fafe8b0b292e', 'claude', 'div', 'Claude responded: The capital of France ', 0, 'action', 1782421243861, '[]', 1, 1782421243861, 1783298502329, NULL),
  ('h:9355fbd6027f4830', 'claude', 'button', 'Copy', 0, 'action', 1782421243861, '[]', 1, 1782421243861, 1783298502331, NULL),
  ('h:8f705dab55ae33e3', 'claude', 'button', 'Read aloud', 0, 'action', 1782421243861, '[]', 1, 1782421243861, 1783298502332, NULL),
  ('h:9210c134d6c2c133', 'claude', 'button', 'Searching the web', 0, 'action', 1782421243862, '[]', 1, 1782421243862, 1783298502334, NULL),
  ('h:8cfb484e96ef718b', 'claude', 'button', 'More options for Test message', 0, 'menu-trigger', 1782421243862, '[]', 1, 1782421243862, 1783298502336, NULL),
  ('h:4ac2fcc2ae47ab91', 'claude', 'div', 'Test message', 0, 'action', 1782421243862, '[]', 1, 1782421243862, 1783298502338, NULL),
  ('h:bfc37130bf6da37c', 'claude', 'button', 'Give positive feedback', 0, 'action', 1782421243862, '[]', 1, 1782421243862, 1783298502340, NULL),
  ('h:aa5e9c039508c508', 'claude', 'button', 'Give negative feedback', 0, 'action', 1782421243862, '[]', 1, 1782421243862, 1783298502341, NULL),
  ('h:43a14edf8dd65214', 'claude', 'button', 'Retry', 0, 'action', 1782421243862, '[]', 1, 1782421243862, 1783298502343, NULL),
  ('h:561863f8ed182f5e', 'claude', 'button', 'Dismiss upgrade banner', 0, 'commerce', 1782421243862, '[]', 1, 1782421243862, 1783298502345, NULL),
  ('h:14553bce59ce172d', 'claude', 'button', 'Notify', 0, 'action', 1782421243862, '[]', 1, 1782421243862, 1783298502347, NULL),
  ('h:578584f488c0476e', 'claude', 'div', 'Learn more(opens in new tab)', 0, 'menu-trigger', 1782421243862, '[]', 1, 1782421243862, 1783298502355, NULL),
  ('h:0bdfdb05034931dc', 'claude', 'span', 'Notify', 0, 'action', 1782421243862, '[]', 1, 1782421243862, 1783298502358, NULL),
  ('h:7add6019a121c0a5', 'claude', 'button', 'Share', 0, 'action', 1782421243862, '[]', 1, 1782421243862, 1783298502360, NULL),
  ('h:62a12f83b0d81ab4', 'claude', 'div', 'Share', 0, 'action', 1782421243862, '[]', 1, 1782421243862, 1783298502361, NULL),
  ('h:3c6c4708e94013f9', 'claude', 'div', 'StarRenameAdd to projectDelete', 1, 'action', 1782421274902, '[]', 1, 1782421274902, 1783298502363, NULL),
  ('h:3d039225df4e2038', 'claude', 'menuitem', 'Star', 1, 'action', 1782421274902, '[]', 1, 1782421274902, 1783298502364, NULL),
  ('h:0033da95fc18c17b', 'claude', 'menuitem', 'Rename', 1, 'action', 1782421274902, '[]', 1, 1782421274902, 1783298502366, NULL),
  ('h:ec803b32c116dcd0', 'claude', 'menuitem', 'Add to project', 1, 'menu-trigger', 1782421274902, '[]', 1, 1782421274902, 1783298502367, NULL),
  ('h:d24dba300386972e', 'claude', 'menuitem', 'Delete', 1, 'action', 1782421274902, '[]', 1, 1782421274902, 1783298502369, NULL),
  ('h:c90a51aab2c71966', 'claude', 'div', 'skill-creator', 1, 'action', 1782421274902, '[]', 1, 1782421274902, 1783298502374, NULL),
  ('h:1ad4d2955130829f', 'claude', 'menuitem', 'Add skill', 1, 'action', 1782421274902, '[]', 1, 1782421274902, 1783298502378, NULL),
  ('h:3585b2f45824c051', 'claude', 'div', 'No projects available', 1, 'action', 1782421277781, '[]', 1, 1782421277781, 1783298502383, NULL),
  ('h:fa264b4e2927bd8b', 'claude', 'input', 'Search projects', 1, 'action', 1782421277781, '[]', 1, 1782421277781, 1783298502388, NULL),
  ('h:d5fc1d2d0526c0e4', 'claude', 'div', 'Sonnet 4.6Most efficient for everyday ta', 1, 'action', 1782421277781, '[]', 1, 1782421277781, 1783298502390, NULL),
  ('h:89dcbab5e1df66a0', 'claude', 'div', 'Fable 5Currently unavailableUpgradeOpus', 1, 'commerce', 1782421283688, '[]', 1, 1782421283688, 1783298502391, NULL),
  ('h:80462be31761e9c0', 'claude', 'presentation', 'Fable 5Currently unavailableUpgradeOpus', 1, 'commerce', 1782421283688, '[]', 1, 1782421283688, 1783298502393, NULL),
  ('h:42954d270a48d956', 'claude', 'div', 'Done', 1, 'action', 1782421283688, '[]', 1, 1782421283688, 1783298502395, NULL),
  ('h:3ac62b396ab6a7da', 'claude', 'span', 'Upgrade to Claude Pro to use our best an', 1, 'commerce', 1782422496486, '[]', 1, 1782422496486, 1783298502397, NULL),
  ('h:0b6c5a98008d0258', 'claude', 'div', 'Claude finished the responseYou said: Wr', 0, 'action', 1782425814234, '[]', 1, 1782425814234, 1783298502399, NULL),
  ('h:87a57969aa987d6f', 'claude', 'button', 'Simple prime number checker, rename chat', 0, 'action', 1782425814234, '[]', 1, 1782425814234, 1783298502404, NULL),
  ('h:84d8ae6655058ddf', 'claude', 'div', 'You said: Write Python: def is_prime(n):', 0, 'action', 1782425814234, '[]', 1, 1782425814234, 1783298502408, NULL),
  ('h:439007b38eb0c50e', 'claude', 'group', 'Claude works directly with your codebase', 0, 'action', 1782425814234, '[]', 1, 1782425814234, 1783298502413, NULL),
  ('h:c2470c75b7e2b0fc', 'claude', 'div', '.cc-install-nudge { container-type: inli', 0, 'action', 1782425814234, '[]', 1, 1782425814234, 1783298502418, NULL),
  ('h:089c45fe25faae1f', 'claude', 'div', 'Haiku 4.5 Extended', 0, 'action', 1782425814234, '[]', 1, 1782425814234, 1783298502420, NULL),
  ('h:0a9166f49dcebdee', 'claude', 'p', 'Source URL: https://en.wikipedia.org/wik', 0, 'action', 1782425814234, '[]', 1, 1782425814234, 1783298502421, NULL),
  ('h:3bff99c645d2fd44', 'claude', 'p', 'The capital of Brazil is Brasília, locat', 0, 'action', 1782425814234, '[]', 1, 1782425814234, 1783298502423, NULL),
  ('h:6482024c8b2226f5', 'claude', 'button', 'Searched the web', 0, 'menu-trigger', 1782425814234, '[]', 1, 1782425814234, 1783298502424, NULL),
  ('h:76589092c3b2da13', 'claude', 'div', 'You said: Search web: capital of Brazil.', 0, 'action', 1782425814234, '[]', 1, 1782425814234, 1783298502426, NULL),
  ('h:8bdd8f25971b2536', 'claude', 'span', 'Wikipedia', 0, 'action', 1782425814234, '[]', 1, 1782425814234, 1783298502428, NULL),
  ('h:27df470c44125979', 'claude', 'p', 'Let Claude edit files, run commands, and', 0, 'action', 1782425814234, '[]', 1, 1782425814234, 1783298502429, NULL),
  ('h:4a4cdf91adc4205c', 'claude', 'a', 'Wikipedia', 0, 'link', 1782425814234, '[]', 1, 1782425814234, 1783298502431, NULL),
  ('h:6aa394acee8ad279', 'claude', 'button', 'More options for Simple prime number che', 0, 'menu-trigger', 1782425814234, '[]', 1, 1782425814234, 1783298502433, NULL),
  ('h:642b2a34f40312e1', 'claude', 'div', 'Simple prime number checker', 0, 'action', 1782425814234, '[]', 1, 1782425814234, 1783298502435, NULL),
  ('h:e301d8369998975c', 'claude', 'button', 'Model: Haiku 4.5 Extended', 0, 'menu-trigger', 1782425814235, '[]', 1, 1782425814235, 1783298502437, NULL),
  ('h:24061a4e5ba6ef1a', 'claude', 'button', 'Install', 0, 'menu-trigger', 1782425814235, '[]', 1, 1782425814235, 1783298502439, NULL),
  ('h:6e3804af013f42db', 'claude', 'div', 'Prime number checker functionFree planU', 0, 'action', 1782430859027, '[]', 1, 1782430859027, 1783298502440, NULL),
  ('h:e58eb7483229bebc', 'claude', 'button', 'Prime number checker function, rename ch', 0, 'action', 1782430859027, '[]', 1, 1782430859027, 1783298502443, NULL),
  ('h:f637be05bafb9e08', 'claude', 'div', 'You said: In one sentence, what is a wat', 0, 'action', 1782430859027, '[]', 1, 1782430859027, 1783298502445, NULL),
  ('h:6ae6e1ff6d0d9265', 'claude', 'div', 'You said: Write a one-line Python functi', 0, 'action', 1782430859027, '[]', 1, 1782430859027, 1783298502449, NULL),
  ('h:dfb9c2c73972ea1c', 'claude', 'span', 'Want to be notified when Claude responds', 0, 'action', 1782430859027, '[]', 1, 1782430859027, 1783298502454, NULL),
  ('h:ebc63b5059946444', 'claude', 'p', 'A watering hole is a natural source of w', 0, 'action', 1782430859027, '[]', 1, 1782430859027, 1783298502459, NULL),
  ('h:188d5d7a88d92d88', 'claude', 'button', 'Thought process', 0, 'menu-trigger', 1782430859027, '[]', 1, 1782430859027, 1783298502464, NULL),
  ('h:373cde3933bc8947', 'claude', 'div', 'In one sentence, what is a watering hole', 0, 'action', 1782430859027, '[]', 1, 1782430859027, 1783298502466, NULL),
  ('h:359d779415f1282f', 'claude', 'button', 'More options for Prime number checker fu', 0, 'menu-trigger', 1782430859027, '[]', 1, 1782430859027, 1783298502467, NULL),
  ('h:866f617fe4dd9d68', 'claude', 'a', 'Claude is AI and can make mistakes. Plea', 0, 'link', 1782430859027, '[]', 1, 1782430859027, 1783298502469, NULL),
  ('h:61da6ddf600dbd8a', 'claude', 'div', 'Prime number checker function', 0, 'action', 1782430859027, '[]', 1, 1782430859027, 1783298502470, NULL),
  ('h:8638279cda34d090', 'claude', 'p', 'In one sentence, what is a watering hole', 0, 'action', 1782430859027, '[]', 1, 1782430859027, 1783298502472, NULL),
  ('h:f85f0e69fe646f8d', 'claude', 'div', 'Haiku 4.5 Extended', 0, 'action', 1782430859027, '[]', 1, 1782430859027, 1783298502474, NULL),
  ('h:694d0c013ebf9b12', 'claude', 'span', '1:15 AM', 0, 'action', 1782430859027, '[]', 1, 1782430859027, 1783298502476, NULL),
  ('h:c68fe335f916c00f', 'claude', 'toolbar', 'Message actions', 0, 'action', 1782430859027, '[]', 1, 1782430859027, 1783298502478, NULL),
  ('h:53fb88d2701867b2', 'claude', 'button', 'Edit', 0, 'action', 1782430859027, '[]', 1, 1782430859027, 1783298502479, NULL),
  ('h:41b4b5cf68d211ce', 'claude', 'div', 'New chatChatsProjectsArtifactsCod', 0, 'nav', 1782430859027, '[]', 1, 1782430859027, 1783298502481, NULL),
  ('h:25d4be8e2fa59f32', 'claude', 'p', 'The user is asking for a one-sentence de', 1, 'action', 1782430869054, '[]', 1, 1782430869054, 1783298502482, NULL),
  ('h:332e7b3158810416', 'claude', 'presentation', 'Start a new project', 1, 'action', 1782430869054, '[]', 1, 1782430869054, 1783298502484, NULL),
  ('h:71a6b512f838e63e', 'claude', 'div', 'Manage skillsAdd skill', 1, 'action', 1782430869054, '[]', 1, 1782430869054, 1783298502485, NULL),
  ('h:810ce9181522f56f', 'claude', 'presentation', 'Browse connectorsAdd custom connector', 1, 'action', 1782430869054, '[]', 1, 1782430869054, 1783298502487, NULL),
  ('h:df17f54d12f90cd1', 'claude', 'menuitem', 'ExtendedAlways uses deep reasoning', 1, 'action', 1782430874962, '[]', 1, 1782430874962, 1783298502489, NULL),
  ('h:712c7b78bfac7920', 'claude', 'div', 'Haiku 4.5Fastest for quick answersExten', 1, 'action', 1782430874962, '[]', 1, 1782430874962, 1783298502491, NULL),
  ('h:974088e2037a9716', 'claude', 'menuitemradio', 'Haiku 4.5Fastest for quick answers', 1, 'action', 1782430874962, '[]', 1, 1782430874962, 1783298502492, NULL),
  ('h:5419e98e1c3ebb2f', 'claude', 'switch', 'Extended', 1, 'toggle', 1782430874962, '[]', 1, 1782430874962, 1783298502494, NULL),
  ('h:45c5a221ebdc5fc7', 'claude', 'div', 'Fable 5Currently unavailableUpgrade', 1, 'commerce', 1782430879034, '[]', 1, 1782430879034, 1783298502496, NULL),
  ('h:5b75efa1787963e2', 'claude', 'menuitemradio', 'Opus 4.8Upgrade', 1, 'commerce', 1782430879034, '[]', 1, 1782430879034, 1783298502497, NULL),
  ('h:fb967efab590499b', 'claude', 'menuitemradio', 'Sonnet 4.6', 1, 'action', 1782430879034, '[]', 1, 1782430879034, 1783298502499, NULL),
  ('h:8edd27d6d5539a84', 'claude', 'button', 'Ready to begin, rename chat', 0, 'action', 1782431826863, '[]', 1, 1782431826863, 1783298502500, NULL),
  ('h:de3b4d4b98f87ea4', 'claude', 'div', 'You said: Say: readySay: ready1:56 AM', 0, 'action', 1782431826863, '[]', 1, 1782431826863, 1783298502502, NULL),
  ('h:2ac7aa107e827c60', 'claude', 'div', 'Say: ready1:56 AM', 0, 'action', 1782431826863, '[]', 1, 1782431826863, 1783298502504, NULL),
  ('h:44b8d408c84c8e06', 'claude', 'div', 'Thought processThought process', 0, 'action', 1782431826863, '[]', 1, 1782431826863, 1783298502506, NULL),
  ('h:a31348d5091d21fb', 'claude', 'p', 'Ready', 0, 'action', 1782431826863, '[]', 1, 1782431826863, 1783298502507, NULL),
  ('h:8fd6bfc277f8fec2', 'claude', 'div', 'Claude responded: ReadyThought processTh', 0, 'action', 1782431826863, '[]', 1, 1782431826863, 1783298502509, NULL),
  ('h:1fded97b78edeb39', 'claude', 'button', 'More options for Ready to begin', 0, 'menu-trigger', 1782431826863, '[]', 1, 1782431826863, 1783298502511, NULL),
  ('h:971ffc646c2a9815', 'claude', 'div', 'Ready to begin', 0, 'action', 1782431826863, '[]', 1, 1782431826863, 1783298502512, NULL),
  ('h:11865ef31012b4b5', 'claude', 'span', '1:56 AM', 0, 'action', 1782431826863, '[]', 1, 1782431826863, 1783298502514, NULL),
  ('h:66e2e8751148a8fb', 'claude', 'div', 'Say: ready', 0, 'action', 1782431826863, '[]', 1, 1782431826863, 1783298502516, NULL),
  ('h:d40b04f42d2d2854', 'claude', 'p', 'Say: ready', 0, 'action', 1782431826863, '[]', 1, 1782431826863, 1783298502518, NULL),
  ('h:d8cb2f696a490ab1', 'claude', 'group', 'Haiku 4.5Fastest for quick answers', 1, 'action', 1782431846493, '[]', 1, 1782431846493, 1783298502519, NULL),
  ('h:3038c637ab2a7a19', 'claude', 'div', 'The user is asking me to simply say "rea', 1, 'action', 1782431852298, '[]', 1, 1782431852298, 1783298502521, NULL),
  ('h:8c9b1720ddedbd9e', 'claude', 'p', 'The user is asking me to simply say "rea', 1, 'action', 1782431852298, '[]', 1, 1782431852298, 1783298502522, NULL),
  ('h:e73678cf03f9fc91', 'claude', 'main', 'Free planUpgradeWhat shall we think thro', 0, 'commerce', 1782431964756, '[]', 1, 1782431964756, 1783298502524, NULL),
  ('h:bc5af68430620bd2', 'claude', 'div', 'How can I help you today?Haiku 4.5 Exte', 0, 'action', 1782431964756, '[]', 1, 1782431964756, 1783298502526, NULL),
  ('h:22483831b2a70f9c', 'claude', 'div', 'What shall we think through?', 0, 'action', 1782431964756, '[]', 1, 1782431964756, 1783298502528, NULL),
  ('h:e84b4320c220cf92', 'claude', 'span', 'What shall we think through?', 0, 'action', 1782431964756, '[]', 1, 1782431964756, 1783298502529, NULL),
  ('h:f3236197e8717579', 'claude', 'li', 'Write', 0, 'action', 1782431964756, '[]', 1, 1782431964756, 1783298502531, NULL),
  ('h:f908eb49a2b92f82', 'claude', 'li', 'Claude’s choice', 0, 'action', 1782431964756, '[]', 1, 1782431964756, 1783298502533, NULL),
  ('h:7f451c90fcc088c5', 'claude', 'tooltip', 'Upgrade to Claude Pro to use our best an', 1, 'commerce', 1782431974573, '[]', 1, 1782431974573, 1783298502535, NULL),
  ('h:62bf5289276b8e74', 'claude', 'div', 'You said: Search: who is the current CEO', 0, 'action', 1782442961070, '[]', 1, 1782442961070, 1783298502537, NULL);
INSERT INTO "hole" ("id", "provider_id", "role", "name", "layer_index", "classified_as", "discovered_at", "consumed_by", "schema_version", "created_at", "updated_at", "fingerprint") VALUES
  ('h:06df047338f15a47', 'claude', 'div', 'You said: clear composer.clear composer.', 0, 'action', 1782442961070, '[]', 1, 1782442961070, 1783298502539, NULL),
  ('h:e68bf1b1adcacc29', 'claude', 'button', 'Thinking', 0, 'menu-trigger', 1782442961070, '[]', 1, 1782442961070, 1783298502541, NULL),
  ('h:06d4e37a61289295', 'claude', 'div', 'Clear composerFree planUpgrade', 0, 'commerce', 1782442961070, '[]', 1, 1782442961070, 1783298502543, NULL),
  ('h:8cd72fa73228ce75', 'claude', 'button', 'Clear composer, rename chat', 0, 'action', 1782442961070, '[]', 1, 1782442961070, 1783298502545, NULL),
  ('h:91b482df4acf5eea', 'claude', 'button', 'current CEO of Microsoft10 results', 0, 'action', 1782442961070, '[]', 1, 1782442961070, 1783298502550, NULL),
  ('h:7ab77df13c756aa6', 'claude', 'a', 'MICROSOFT CORP - Form 8-K - FY2010www.se', 0, 'link', 1782442961070, '[]', 1, 1782442961070, 1783298502552, NULL),
  ('h:23e31bf98fb3d44a', 'claude', 'div', 'MICROSOFT CORP - Form 8-K - FY2010www.se', 0, 'action', 1782442961070, '[]', 1, 1782442961070, 1783298502554, NULL),
  ('h:7c6bfe4502c50465', 'claude', 'div', 'Clear composer', 0, 'action', 1782442961070, '[]', 1, 1782442961070, 1783298502556, NULL),
  ('h:cdc43f849260a480', 'claude', 'div', 'Claude finished the responseYou said: cl', 0, 'action', 1782442961070, '[]', 1, 1782442961070, 1783298502558, NULL),
  ('h:f962d54b574c498e', 'claude', 'div', 'Blue button · HTML', 0, 'action', 1782442961070, '[]', 1, 1782442961070, 1783298502560, NULL),
  ('h:db29553d5e260176', 'claude', 'radiogroup', 'File view mode', 0, 'action', 1782442961070, '[]', 1, 1782442961070, 1783298502562, NULL),
  ('h:189afae1a31a7a89', 'claude', 'h2', 'Blue button', 0, 'action', 1782442961070, '[]', 1, 1782442961070, 1783298502564, NULL),
  ('h:46ef996a6bf0e2ae', 'claude', 'span', 'HTML', 0, 'action', 1782442961070, '[]', 1, 1782442961070, 1783298502565, NULL),
  ('h:9e0e85a3e7bf20af', 'claude', 'div', 'Blue button · HTMLCopy', 0, 'action', 1782442961070, '[]', 1, 1782442961070, 1783298502567, NULL),
  ('h:0ef31c1bef588110', 'claude', 'button', 'More options', 0, 'menu-trigger', 1782442961070, '[]', 1, 1782442961070, 1783298502568, NULL),
  ('h:a8fa0c096cc3fbaf', 'claude', 'button', 'Refresh', 0, 'action', 1782442961070, '[]', 1, 1782442961070, 1783298502570, NULL),
  ('h:5afced7afc215cac', 'claude', 'button', 'Expand', 0, 'action', 1782442961070, '[]', 1, 1782442961070, 1783298502571, NULL),
  ('h:7ac446be93f70298', 'claude', 'button', 'Go back', 0, 'action', 1782442961070, '[]', 1, 1782442961070, 1783298502573, NULL),
  ('h:82f709c8578ac582', 'claude', 'p', 'The user is asking me to:', 1, 'action', 1782443001992, '[]', 1, 1782443001992, 1783298502575, NULL),
  ('h:92cd71976450a7ff', 'claude', 'ol', 'Search for who is the current CEO of Mic', 1, 'action', 1782443001992, '[]', 1, 1782443001992, 1783298502577, NULL),
  ('h:9d2f9d488208b800', 'claude', 'div', 'The user is asking me to: Search for who', 1, 'action', 1782443001992, '[]', 1, 1782443001992, 1783298502579, NULL),
  ('h:a990c33d67310949', 'claude', 'p', 'This is an interesting request because t', 1, 'action', 1782443001992, '[]', 1, 1782443001992, 1783298502580, NULL),
  ('h:2d04822d16efb7eb', 'claude', 'button', 'Show more', 1, 'menu-trigger', 1782443001992, '[]', 1, 1782443001992, 1783298502582, NULL),
  ('h:3c2c6e9b03ee73da', 'claude', 'p', 'The user asked me to search for who is t', 1, 'action', 1782443001992, '[]', 1, 1782443001992, 1783298502584, NULL),
  ('h:b9217d06a6d93279', 'claude', 'li', 'Reply with exactly: "recursion is when a', 1, 'action', 1782443001992, '[]', 1, 1782443001992, 1783298502585, NULL),
  ('h:da4ac8537b8953a6', 'claude', 'li', 'Provide the exact source URL', 1, 'action', 1782443001992, '[]', 1, 1782443001992, 1783298502587, NULL),
  ('h:df367e0c93852ade', 'claude', 'li', 'Search for who is the current CEO of Mic', 1, 'action', 1782443001992, '[]', 1, 1782443001992, 1783298502589, NULL),
  ('h:601acf1119c97fc7', 'claude', 'div', 'owen.gvoice@gmail.comSettingsCtrl⇧,Lan', 1, 'menu-trigger', 1782443008241, '[]', 1, 1782443008241, 1783298502591, NULL),
  ('h:b7521448f57ceb1f', 'claude', 'menuitem', 'SettingsCtrl⇧,', 1, 'menu-trigger', 1782443008241, '[]', 1, 1782443008241, 1783298502593, NULL),
  ('h:ec1ecb039cb028f7', 'claude', 'menuitem', 'Language', 1, 'menu-trigger', 1782443008241, '[]', 1, 1782443008241, 1783298502594, NULL),
  ('h:efb5e8c2e27e247d', 'claude', 'menuitem', 'Get help', 1, 'action', 1782443008241, '[]', 1, 1782443008241, 1783298502596, NULL),
  ('h:01b0ecb88209a829', 'claude', 'menuitem', 'Upgrade plan', 1, 'commerce', 1782443008241, '[]', 1, 1782443008241, 1783298502598, NULL),
  ('h:726dd4ae871e7631', 'claude', 'menuitem', 'Get apps and extensions', 1, 'action', 1782443008241, '[]', 1, 1782443008241, 1783298502600, NULL),
  ('h:00a2d1c45057eba9', 'claude', 'menuitem', 'Learn more', 1, 'menu-trigger', 1782443008241, '[]', 1, 1782443008241, 1783298502601, NULL),
  ('h:027f45ff2664e13f', 'claude', 'menuitem', 'Log out', 1, 'action', 1782443008241, '[]', 1, 1782443008241, 1783298502603, NULL),
  ('h:9782f97626000591', 'claude', 'div', 'Claude responded: Satya Nadella is the C', 1, 'action', 1782443014444, '[]', 1, 1782443014444, 1783298502604, NULL),
  ('h:78e32adcec8d6dd3', 'claude', 'a', 'Who is the CEO of Microsoft in 2026? Sat', 1, 'link', 1782443014444, '[]', 1, 1782443014444, 1783298502606, NULL),
  ('h:0bd3a6dea55ab9cc', 'claude', 'a', 'MICROSOFT CORP - Form 8-K - FY2019www.se', 1, 'link', 1782443014444, '[]', 1, 1782443014444, 1783298502608, NULL),
  ('h:4fae49f6f0b516ba', 'claude', 'a', 'MICROSOFT CORP - Form 8-K - FY2013www.se', 1, 'link', 1782443014444, '[]', 1, 1782443014444, 1783298502609, NULL),
  ('h:c4f1a4edc9e54fcb', 'claude', 'a', 'MICROSOFT CORP - Form 8-K - FY2014www.se', 1, 'link', 1782443014444, '[]', 1, 1782443014444, 1783298502611, NULL),
  ('h:fc4bf685dc346f54', 'claude', 'menuitem', 'Keyboard shortcutsCtrl/', 1, 'action', 1782443014444, '[]', 1, 1782443014444, 1783298502613, NULL),
  ('h:d5bf24d3d36f4af4', 'claude', 'menuitem', 'Your privacy choices', 1, 'action', 1782443014444, '[]', 1, 1782443014444, 1783298502615, NULL),
  ('h:94d819f01bcad3fc', 'claude', 'div', 'About AnthropicTutorialsCoursesUsage ', 1, 'action', 1782443014444, '[]', 1, 1782443014444, 1783298502617, NULL),
  ('h:b517f5f50c7bf8ce', 'claude', 'menuitem', 'Privacy policy', 1, 'action', 1782443014444, '[]', 1, 1782443014444, 1783298502619, NULL),
  ('h:d8ed1f972a001cef', 'claude', 'menuitem', 'Usage policy', 1, 'action', 1782443014444, '[]', 1, 1782443014444, 1783298502621, NULL),
  ('h:e3d7c5eb7c7053cd', 'claude', 'menuitem', 'Courses', 1, 'action', 1782443014444, '[]', 1, 1782443014444, 1783298502623, NULL),
  ('h:8744722281702d23', 'claude', 'menuitem', 'Tutorials', 1, 'action', 1782443014444, '[]', 1, 1782443014444, 1783298502625, NULL),
  ('h:eba84a288eef7984', 'claude', 'menuitem', 'About Anthropic', 1, 'action', 1782443014444, '[]', 1, 1782443014444, 1783298502627, NULL),
  ('h:0ea1086ab7afc547', 'claude', 'menuitemradio', 'italiano (Italia)', 1, 'action', 1782443014444, '[]', 1, 1782443014444, 1783298502629, NULL),
  ('h:7e2498f18c14f925', 'claude', 'menuitemradio', 'Indonesia (Indonesia)', 1, 'action', 1782443014444, '[]', 1, 1782443014444, 1783298502630, NULL),
  ('h:f682d7bbca872de1', 'claude', 'menuitemradio', 'Deutsch (Deutschland)', 1, 'action', 1782443014444, '[]', 1, 1782443014444, 1783298502632, NULL),
  ('h:eb9f4907de477494', 'claude', 'menuitemradio', 'français (France)', 1, 'action', 1782443014444, '[]', 1, 1782443014444, 1783298502634, NULL),
  ('h:c2263762fc7dd30c', 'claude', 'menuitemradio', 'English (United States)', 1, 'action', 1782443014444, '[]', 1, 1782443014444, 1783298502636, NULL),
  ('h:1a06b3070bfae367', 'claude', 'div', 'English (United States)français (France', 1, 'action', 1782443014444, '[]', 1, 1782443014444, 1783298502637, NULL),
  ('h:d64eb9f8bf04376a', 'claude', 'menuitemradio', 'português (Brasil)', 1, 'action', 1782443014444, '[]', 1, 1782443014444, 1783298502639, NULL),
  ('h:3d2d095f3552505d', 'claude', 'menuitemradio', 'español (Latinoamérica)', 1, 'action', 1782443014444, '[]', 1, 1782443014444, 1783298502641, NULL),
  ('h:d237504e1062ea25', 'claude', 'menuitemradio', 'español (España)', 1, 'action', 1782443014444, '[]', 1, 1782443014444, 1783298502643, NULL),
  ('h:76eee4041c095bdb', 'claude', 'div', 'Simple greetingFree planUpgrade', 1, 'commerce', 1782448996458, '[]', 1, 1782448996458, 1783298502645, NULL),
  ('h:44e9f0913d126b3c', 'claude', 'button', 'Simple greeting, rename chat', 1, 'action', 1782448996458, '[]', 1, 1782448996458, 1783298502647, NULL),
  ('h:8a21e8fb50a76034', 'claude', 'div', 'You said: Say: hiSay: hi6:08 AMClaud', 1, 'action', 1782448996458, '[]', 1, 1782448996458, 1783298502649, NULL),
  ('h:aca55605a93a0286', 'claude', 'div', 'You said: expand composer.expand compose', 1, 'action', 1782448996458, '[]', 1, 1782448996458, 1783298502650, NULL),
  ('h:f1d89f5f75a43e91', 'claude', 'div', 'expand composer. Respond briefly.6:12 AM', 1, 'action', 1782448996458, '[]', 1, 1782448996458, 1783298502652, NULL),
  ('h:9c0cd25aaf99ab1b', 'claude', 'p', 'I''m not sure what you mean. Are you aski', 1, 'action', 1782448996458, '[]', 1, 1782448996458, 1783298502653, NULL),
  ('h:ec5b9b03137dd347', 'claude', 'div', 'Claude responded: I''m not sure what you ', 1, 'action', 1782448996458, '[]', 1, 1782448996458, 1783298502655, NULL),
  ('h:938ee6a8053d59c9', 'claude', 'button', 'More options for Simple greeting', 1, 'menu-trigger', 1782448996458, '[]', 1, 1782448996458, 1783298502657, NULL),
  ('h:c4d8188473fb956c', 'claude', 'div', 'Simple greeting', 1, 'action', 1782448996458, '[]', 1, 1782448996458, 1783298502658, NULL),
  ('h:e816f775b8de21aa', 'claude', 'p', 'expand composer. Respond briefly.', 1, 'action', 1782448996458, '[]', 1, 1782448996458, 1783298502660, NULL),
  ('h:55dfe8c62933ffc8', 'claude', 'span', '6:12 AM', 1, 'action', 1782448996458, '[]', 1, 1782448996458, 1783298502662, NULL),
  ('h:f7b9f2b11f766112', 'claude', 'div', 'expand composer. Respond briefly.', 1, 'action', 1782448996458, '[]', 1, 1782448996458, 1783298502663, NULL),
  ('h:bafafcc2d8caca3e', 'claude', 'div', 'Create a Python function that implements', 0, 'action', 1782470347209, '[]', 1, 1782470347209, 1783298502665, NULL),
  ('h:339660ce557c8658', 'claude', 'presentation', 'owen.gvoice@gmail.comSettingsCtrl⇧,Lan', 0, 'menu-trigger', 1782470504633, '[]', 1, 1782470504633, 1783298502666, NULL),
  ('h:8b42104d29d13b1e', 'claude', 'presentation', 'owen.gvoice@gmail.com', 0, 'action', 1782470828194, '[]', 1, 1782470828194, 1783298502668, NULL),
  ('h:bb3171e7344ed703', 'claude', 'div', 'Do more with Claude, everywhere you work', 0, 'menu-trigger', 1782473990468, '[]', 1, 1782473990468, 1783298502670, NULL),
  ('h:504ee16f119e8365', 'claude', 'div', 'Analyze data, build presentations, draft', 0, 'action', 1782473990468, '[]', 1, 1782473990468, 1783298502671, NULL),
  ('h:5f3e8cf0c7d28dfe', 'claude', 'div', 'Microsoft 365Analyze data, build present', 0, 'action', 1782473990468, '[]', 1, 1782473990468, 1783298502673, NULL),
  ('h:630ce58da96d3fc0', 'claude', 'div', 'Claude DesignBetaBuild something you can', 0, 'action', 1782473990468, '[]', 1, 1782473990468, 1783298502675, NULL),
  ('h:f9ac8927b76bba91', 'claude', 'ul', 'Prototypes you can clickWireframes from ', 0, 'action', 1782473990468, '[]', 1, 1782473990468, 1783298502676, NULL),
  ('h:95a561ea90822d19', 'claude', 'p', 'Build something you can click, share, or', 0, 'action', 1782473990468, '[]', 1, 1782473990468, 1783298502678, NULL),
  ('h:16cefcdd20b2564b', 'claude', 'li', 'Wireframes from a sketch', 0, 'action', 1782473990468, '[]', 1, 1782473990468, 1783298502680, NULL),
  ('h:11d6427afcf31b4b', 'claude', 'strong', 'Anything else', 0, 'action', 1782473990468, '[]', 1, 1782473990468, 1783298502681, NULL),
  ('h:bfd26aa9a1709266', 'claude', 'li', 'Anything else you can describe', 0, 'action', 1782473990468, '[]', 1, 1782473990468, 1783298502683, NULL),
  ('h:e4c1bc366c29c5fa', 'claude', 'div', 'Journal appclaude.com/design1Burn letter', 0, 'action', 1782473990468, '[]', 1, 1782473990468, 1783298502685, NULL),
  ('h:65564e7e82f5b51a', 'claude', 'div', 'DesktopChat, cowork, and code in one app', 0, 'action', 1782473990468, '[]', 1, 1782473990468, 1783298502686, NULL),
  ('h:750520b241d2e010', 'claude', 'div', 'Chat, cowork, and code in one app. Claud', 0, 'action', 1782473990468, '[]', 1, 1782473990468, 1783298502688, NULL),
  ('h:08add39640f61acc', 'claude', 'button', 'Play Claude Design demo video', 0, 'action', 1782473990468, '[]', 1, 1782473990468, 1783298502690, NULL),
  ('h:5b23f03aeffbb26f', 'claude', 'button', 'Close', 0, 'action', 1782473990468, '[]', 1, 1782473990468, 1783298502691, NULL),
  ('h:dde88e319b88b970', 'claude', 'main', 'Free planUpgradeGood afternoon, owenClau', 0, 'commerce', 1782474946288, '[]', 1, 1782474946288, 1783298502693, NULL),
  ('h:ac3ffced0d572cf8', 'claude', 'span', 'Good afternoon, owen', 0, 'action', 1782474946288, '[]', 1, 1782474946288, 1783298502694, NULL),
  ('h:cf8e95eca22e1621', 'claude', 'main', 'Free planUpgradeIt’s late-night owenClau', 0, 'commerce', 1782512680236, '[]', 1, 1782512680236, 1783298502696, NULL),
  ('h:78f8171dd20b8708', 'claude', 'status', 'Claude Fable 5 is currently unavailable.', 0, 'action', 1782512680236, '[]', 1, 1782512680236, 1783298502698, NULL),
  ('h:f52b64b97ae74d1c', 'claude', 'div', 'It’s late-night owen', 0, 'action', 1782512680236, '[]', 1, 1782512680236, 1783298502703, NULL),
  ('h:a9584aee92e1d917', 'claude', 'span', 'It’s late-night owen', 0, 'action', 1782512680236, '[]', 1, 1782512680236, 1783298502706, NULL),
  ('h:79cef1863da93013', 'claude', 'main', 'Free planUpgradeowen returns!Claude Fabl', 0, 'commerce', 1782582688901, '[]', 1, 1782582688901, 1783298502707, NULL),
  ('h:908fc0c32d7d5294', 'claude', 'div', 'owen returns!', 0, 'action', 1782582688901, '[]', 1, 1782582688901, 1783298502709, NULL),
  ('h:c90f86bd2b55ec1d', 'claude', 'span', 'owen returns!', 0, 'action', 1782582688901, '[]', 1, 1782582688901, 1783298502711, NULL),
  ('h:1fae04920ff66ea1', 'claude', 'div', 'Claude finished the responseYou said: He', 0, 'action', 1782584133371, '[]', 1, 1782584133371, 1783298502713, NULL),
  ('h:200cf7d0d8bb6c8c', 'claude', 'div', 'Short haiku requestFree planUpgrade', 0, 'commerce', 1782584133371, '[]', 1, 1782584133371, 1783298502715, NULL),
  ('h:ca4fc8e03a4dc843', 'claude', 'button', 'Short haiku request, rename chat', 0, 'action', 1782584133371, '[]', 1, 1782584133371, 1783298502716, NULL),
  ('h:e16d87106e2ac7bb', 'claude', 'div', 'You said: Hello, write a short haiku.Hel', 0, 'action', 1782584133371, '[]', 1, 1782584133371, 1783298502718, NULL),
  ('h:265dc8e8eba3c544', 'claude', 'button', 'More options for Short haiku request', 0, 'menu-trigger', 1782584133371, '[]', 1, 1782584133371, 1783298502720, NULL);
INSERT INTO "hole" ("id", "provider_id", "role", "name", "layer_index", "classified_as", "discovered_at", "consumed_by", "schema_version", "created_at", "updated_at", "fingerprint") VALUES
  ('h:1d972d84df8566fc', 'claude', 'div', 'Short haiku request', 0, 'action', 1782584133371, '[]', 1, 1782584133371, 1783298502722, NULL),
  ('h:7fa1b00372a188e2', 'claude', 'p', 'Summer rain falls soft Green leaves drin', 0, 'action', 1782584567388, '[]', 1, 1782584567388, 1783298502724, NULL),
  ('h:1fd35c9e60f602ec', 'claude', 'div', 'What is the meaning of life? Answer in e', 1, 'action', 1782585394700, '[]', 1, 1782585394700, 1783298502726, NULL),
  ('h:ee19357e783a5f60', 'claude', 'p', 'Let me verify the syllable counts:', 1, 'action', 1782585394700, '[]', 1, 1782585394700, 1783298502728, NULL),
  ('h:2f512913ef6f37be', 'claude', 'p', 'Line 1 (5 syllables): Summer rain falls ', 1, 'action', 1782585394700, '[]', 1, 1782585394700, 1783298502730, NULL),
  ('h:cfe04ec3d6164744', 'claude', 'p', 'This is a simple task that doesn''t requi', 1, 'action', 1782585394700, '[]', 1, 1782585394700, 1783298502732, NULL),
  ('h:d58d2a518e3fc441', 'claude', 'p', 'The user is asking me to write a short h', 1, 'action', 1782585394700, '[]', 1, 1782585394700, 1783298502734, NULL),
  ('h:42ae81a98d5278b7', 'claude', 'div', 'The user is asking me to write a short h', 1, 'action', 1782585394700, '[]', 1, 1782585394700, 1783298502735, NULL),
  ('h:6e1f00d31e0e985f', 'claude', 'button', 'Back', 0, 'action', 1782760784870, '[]', 1, 1782760784870, 1783298502737, NULL),
  ('h:912aa1530d6a8835', 'claude', 'a', 'Skills', 0, 'link', 1782760784870, '[]', 1, 1782760784870, 1783298502739, NULL),
  ('h:2b3bff653e52398f', 'claude', 'a', 'Connectors', 0, 'link', 1782760784870, '[]', 1, 1782760784870, 1783298502741, NULL),
  ('h:9725192b4941a060', 'claude', 'button', 'Plugins', 0, 'action', 1782760784870, '[]', 1, 1782760784870, 1783298502743, NULL),
  ('h:ea7d1942532f4930', 'claude', 'div', 'SkillsConnectorsPlugins', 0, 'action', 1782760784870, '[]', 1, 1782760784870, 1783298502745, NULL),
  ('h:ab4182ec6bc7b6d9', 'claude', 'button', 'Expand navigation', 0, 'menu-trigger', 1782760784870, '[]', 1, 1782760784870, 1783298502746, NULL),
  ('h:933207ee5e1ac6fb', 'claude', 'div', 'Customize ClaudeSkills, connectors, and ', 0, 'action', 1782760784870, '[]', 1, 1782760784870, 1783298502748, NULL),
  ('h:be4375848abefcbc', 'claude', 'button', 'Connect your appsLet Claude read and wri', 0, 'action', 1782760784870, '[]', 1, 1782760784870, 1783298502750, NULL),
  ('h:a1610574a8c2a04d', 'claude', 'div', 'Connect your appsLet Claude read and wri', 0, 'action', 1782760784870, '[]', 1, 1782760784870, 1783298502752, NULL),
  ('h:b4779d0da56bc293', 'claude', 'a', 'Create new skillsTeach Claude your proce', 0, 'link', 1782760784870, '[]', 1, 1782760784870, 1783298502754, NULL),
  ('h:20e91024f2ccac44', 'claude', 'button', 'Browse pluginsAdd pre-built knowledge fo', 0, 'action', 1782760784870, '[]', 1, 1782760784870, 1783298502756, NULL),
  ('h:5d0b4187a100f6bf', 'claude', 'h1', 'Customize Claude', 0, 'action', 1782760784870, '[]', 1, 1782760784870, 1783298502758, NULL),
  ('h:b1301a9eaf7cfbd2', 'claude', 'span', 'Back', 0, 'action', 1782760829040, '[]', 1, 1782760829040, 1783298502759, NULL),
  ('h:f311e6d647d90d0a', 'claude', 'div', 'SkillsConnectorsPersonal pluginsGive Cl', 0, 'action', 1782760829040, '[]', 1, 1782760829040, 1783298502761, NULL),
  ('h:5923da9a86f7dc9f', 'claude', 'presentation', 'Add files or photosCtrl+UTake a screensh', 0, 'action', 1782760930285, '[]', 1, 1782760930285, 1783298502763, NULL),
  ('h:8d6f6ae219e5ce4c', 'claude', 'p', 'Only use connectors from developers you ', 0, 'action', 1782760990956, '[]', 1, 1782760990956, 1783298502779, NULL),
  ('h:f937bb13105e5c8b', 'claude', 'p', 'Building an MCP server? Report issues an', 0, 'action', 1782760990956, '[]', 1, 1782760990956, 1783298502781, NULL),
  ('h:90dce0d86063adbe', 'claude', 'div', 'CancelAdd', 0, 'action', 1782760990956, '[]', 1, 1782760990956, 1783298502783, NULL),
  ('h:22b0026608538b10', 'claude', 'a', 'Report issues and subscribe to updates h', 0, 'commerce', 1782760990956, '[]', 1, 1782760990956, 1783298502785, NULL),
  ('h:acef5c67b41a1c54', 'claude', 'presentation', 'Haiku 4.5Fastest for quick answersExten', 0, 'action', 1782761058502, '[]', 1, 1782761058502, 1783298502796, NULL),
  ('h:69ae8d8d495c365c', 'deepseek', 'div', 'By signing up or logging in, you consent', 0, 'action', 1782446865938, '[]', 1, 1782868075985, 1783298502849, NULL),
  ('h:34e0de2cd3839116', 'deepseek', 'a', 'Terms of Use', 0, 'link', 1782446865938, '[]', 1, 1782868075985, 1783298502851, NULL),
  ('h:24702ea44a331469', 'deepseek', 'button', 'Log in', 0, 'action', 1782446865938, '[]', 1, 1782868075985, 1783298502853, NULL),
  ('h:a13ffbc8acf9f7b2', 'deepseek', 'input', 'Password', 0, 'action', 1782446865938, '[]', 1, 1782868075985, 1783298502855, NULL),
  ('h:9cea5b28dd34c306', 'deepseek', 'input', 'Phone number / email address', 0, 'action', 1782446865938, '[]', 1, 1782868075985, 1783298502856, NULL),
  ('h:aef9d406e9eb975b', 'deepseek', 'div', '浙ICP备2023025841号 · Contact us', 0, 'action', 1782446865938, '[]', 1, 1782868075985, 1783298502866, NULL),
  ('h:7a35a5663866caba', 'deepseek', 'a', '浙ICP备2023025841号', 0, 'link', 1782446865938, '[]', 1, 1782868075985, 1783298502869, NULL),
  ('h:ddc089a357624e88', 'deepseek', 'a', 'Privacy Policy', 0, 'link', 1782446865938, '[]', 1, 1782868075985, 1783298502871, NULL),
  ('h:2c1983eb0ef33530', 'deepseek', 'a', 'Contact us', 0, 'link', 1782446865938, '[]', 1, 1782868075985, 1783298502872, NULL),
  ('h:d563f3bf878bc033', 'gemini', 'a', 'New chat', 0, 'nav', 1782434257938, '[]', 1, 1782868076031, 1783298503149, NULL),
  ('h:83dd84aada894c7c', 'gemini', 'a', 'Search chats', 0, 'link', 1782434257938, '[]', 1, 1782868076031, 1783298503153, NULL),
  ('h:42aa074769bee100', 'gemini', 'a', 'Images', 0, 'link', 1782434257938, '[]', 1, 1782868076031, 1783298503155, NULL),
  ('h:f8fcb431ad154adb', 'gemini', 'a', 'Library', 0, 'link', 1782434257938, '[]', 1, 1782868076031, 1783298503157, NULL),
  ('h:a5920c1c2a274361', 'gemini', 'infinite-scroller', 'ImagesLibraryGemsNotebooksNew notebookRe', 0, 'action', 1782434257938, '[]', 1, 1782868076031, 1783298503162, NULL),
  ('h:ac876744916423b5', 'gemini', 'button', 'Toggle Notebooks', 0, 'menu-trigger', 1782434257938, '[]', 1, 1782868076031, 1783298503164, NULL),
  ('h:b4548a569dd74824', 'gemini', 'a', 'System Check and Assistance Offered', 0, 'link', 1782747909300, '[]', 1, 1782868076031, 1783298503292, NULL),
  ('h:c35158690182465b', 'gemini', 'a', 'Today''s Date, Model, and Account', 0, 'menu-trigger', 1782747909300, '[]', 1, 1782868076031, 1783298503294, NULL),
  ('h:7fdcc8340e09e1e5', 'gemini', 'a', 'A Simple Greeting', 0, 'link', 1782747909300, '[]', 1, 1782868076031, 1783298503296, NULL),
  ('h:8bcf7e3640eed63a', 'gemini', 'a', 'Simple Math Question Answered', 0, 'link', 1782434257938, '[]', 1, 1782868076031, 1783298503172, NULL),
  ('h:6d841dbe057f8ec0', 'gemini', 'button', 'Gemini Apps Activity', 0, 'action', 1782434257938, '[]', 1, 1782868076031, 1783298503179, NULL),
  ('h:686ca901dd9d83cd', 'gemini', 'a', 'Google Account: owen wallace-servera (ow', 0, 'menu-trigger', 1782434257938, '[]', 1, 1782868076031, 1783298503183, NULL),
  ('h:dedf5cfa71b3c1de', 'gemini', 'div', 'Palma, Spain Based on your places (Home)', 0, 'action', 1782434257938, '[]', 1, 1782868076031, 1783298503185, NULL),
  ('h:5c03b7a93cc3a1b5', 'gemini', 'button', 'Update location', 0, 'action', 1782747909300, '[]', 1, 1782868076031, 1783298503297, NULL),
  ('h:a4a4f3ecf2912d39', 'gemini', 'button', 'Palma, Spain', 0, 'action', 1782434257938, '[]', 1, 1782868076031, 1783298503187, NULL),
  ('h:a6b3ef92684cf9da', 'gemini', 'div', 'New chatSearch chatsImagesLibraryGemsIma', 0, 'nav', 1782434257938, '[]', 1, 1782868076031, 1783298503151, NULL),
  ('h:ecdca0cbb83d6f7f', 'gemini', 'div', 'owen wallace-servera', 0, 'action', 1782434257938, '[]', 1, 1782868076031, 1783298503190, NULL),
  ('h:e2a97e23c027a6ca', 'gemini', 'button', 'Close sidebar', 0, 'action', 1782434257938, '[]', 1, 1782868076031, 1783298503192, NULL),
  ('h:8f79f23ca5be2b2c', 'gemini', 'button', 'Settings', 0, 'menu-trigger', 1782434257938, '[]', 1, 1782868076031, 1783298503194, NULL),
  ('h:2766e2a13a357018', 'gemini', 'input-container', 'Flash', 0, 'action', 1782747909300, '[]', 1, 1782868076031, 1783298503299, NULL),
  ('h:adfcc70812977ad9', 'gemini', 'div', 'Hi owen, what''s on your mind?', 0, 'action', 1782747909300, '[]', 1, 1782868076031, 1783298503301, NULL),
  ('h:a4fa2dfa8b6bd57b', 'gemini', 'div', 'Upgrade', 0, 'commerce', 1782434257938, '[]', 1, 1782868076031, 1783298503198, NULL),
  ('h:b8282259889a9f54', 'gemini', 'div', 'Flash', 0, 'action', 1782434257938, '[]', 1, 1782868076031, 1783298503201, NULL),
  ('h:f5494ec6e9d822a1', 'gemini', 'span', 'Hi owen, what''s on your mind?', 0, 'action', 1782747909300, '[]', 1, 1782868076031, 1783298503303, NULL),
  ('h:8e84b28600ba9818', 'gemini', 'link', 'Upgrade', 0, 'commerce', 1782434257938, '[]', 1, 1782868076031, 1783298503208, NULL),
  ('h:0db60be1db1ec960', 'gemini', 'button', 'Open mode picker, currently Flash', 0, 'menu-trigger', 1782434257938, '[]', 1, 1782868076031, 1783298503209, NULL),
  ('h:6e4c831327e4ce4c', 'gemini', 'button', 'Temporary chat', 0, 'action', 1782434257938, '[]', 1, 1782868076031, 1783298503213, NULL),
  ('h:d8d7a43eb9fd7174', 'gemini', 'a', 'New chat', 1, 'nav', 1783298502879, '[]', 1, 1782868076031, 1783298503038, NULL),
  ('h:e4dfcbdf3204e4b3', 'gemini', 'div', 'New chatSearch chatsImagesLibraryGemsIma', 1, 'nav', 1783298502879, '[]', 1, 1782868076031, 1783298503040, NULL),
  ('h:632a67367a5b9164', 'gemini', 'a', 'Search chats', 1, 'link', 1783298502879, '[]', 1, 1782868076031, 1783298503042, NULL),
  ('h:2b189a5db2f72ffd', 'gemini', 'a', 'OpenCode Go API Key Settings', 1, 'menu-trigger', 1782446563198, '[]', 1, 1782868076031, 1783298503260, NULL),
  ('h:ac6dc333abdea104', 'gemini', 'a', 'Batch Script for API Key Switching', 1, 'link', 1782446563198, '[]', 1, 1782868076031, 1783298503262, NULL),
  ('h:fd16437fa1bd4a53', 'gemini', 'a', 'Linux VPS for AI Coding Agents', 1, 'link', 1782747971332, '[]', 1, 1782868076031, 1783298503345, NULL),
  ('h:b3feafaba734995e', 'gemini', 'a', 'AI Agents for Editable Graphic Design', 1, 'link', 1782747971332, '[]', 1, 1782868076031, 1783298503346, NULL),
  ('h:ecfb4b8eed1a5d57', 'gemini', 'a', 'VIVIM: Unlocking Data Pipeline Possibili', 1, 'link', 1782747971332, '[]', 1, 1782868076031, 1783298503348, NULL),
  ('h:aaa24092285a4e80', 'gemini', 'a', 'Rust `yup-oauth2` Import Error', 1, 'link', 1782747971332, '[]', 1, 1782868076031, 1783298503350, NULL),
  ('h:e94ea7f49e7fd114', 'gemini', 'a', 'Anthropic Acquires Stainless API Tools', 1, 'link', 1782747971332, '[]', 1, 1782868076031, 1783298503352, NULL),
  ('h:f103dbb38150e508', 'gemini', 'a', 'Automating User Journey Demos', 1, 'link', 1782747971332, '[]', 1, 1782868076031, 1783298503353, NULL),
  ('h:4023349a65556b8e', 'gemini', 'a', 'Debugging Bun Applications Guide', 1, 'link', 1782747971332, '[]', 1, 1782868076031, 1783298503355, NULL),
  ('h:277e4e5c8744e5d1', 'gemini', 'a', 'Investigating Bun Compromise Watchdog Al', 1, 'link', 1782747971332, '[]', 1, 1782868076031, 1783298503356, NULL),
  ('h:5511d5776533b98a', 'gemini', 'a', 'Greeting and Offer of Help', 1, 'link', 1782747971332, '[]', 1, 1782868076031, 1783298503358, NULL),
  ('h:52a0268343d93aca', 'gemini', 'button', 'Gemini Apps Activity', 1, 'action', 1783298502879, '[]', 1, 1782868076031, 1783298503066, NULL),
  ('h:3edede5c6c0ad4ee', 'gemini', 'gem-nav-list-item', 'Activity', 1, 'action', 1783298502879, '[]', 1, 1782868076031, 1783298503068, NULL),
  ('h:1f79d28181ff10ba', 'gemini', 'a', 'Google Account: owen wallace-servera (ow', 1, 'menu-trigger', 1783298502879, '[]', 1, 1782868076031, 1783298503070, NULL),
  ('h:1a77da35df6c39ec', 'gemini', 'div', 'Palma, Spain Based on your places (Home)', 1, 'action', 1783298502879, '[]', 1, 1782868076031, 1783298503072, NULL),
  ('h:81da1aec3e4b1939', 'gemini', 'button', 'Palma, Spain', 1, 'action', 1783298502879, '[]', 1, 1782868076031, 1783298503074, NULL),
  ('h:4bc21a8aa7cb5d57', 'gemini', 'span', 'Based on your places (Home)', 1, 'action', 1783298502879, '[]', 1, 1782868076031, 1783298503076, NULL),
  ('h:8aa5b4e958afd140', 'gemini', 'div', 'owen wallace-servera', 1, 'action', 1783298502879, '[]', 1, 1782868076031, 1783298503077, NULL),
  ('h:357da16ba59ff7ab', 'gemini', 'button', 'Close sidebar', 1, 'action', 1783298502879, '[]', 1, 1782868076031, 1783298503079, NULL),
  ('h:d44c2fb0d212aa1a', 'gemini', 'button', 'Settings', 1, 'menu-trigger', 1783298502879, '[]', 1, 1782868076031, 1783298503081, NULL),
  ('h:452525dd4f691269', 'gemini', 'group', 'Activity owen wallace-servera', 1, 'action', 1783298502879, '[]', 1, 1782868076031, 1783298503083, NULL),
  ('h:8f0ffe2230e30a25', 'gemini', 'infinite-scroller', 'ImagesLibraryGemsNotebooksNew notebookRe', 1, 'action', 1783298502879, '[]', 1, 1782868076031, 1783298503085, NULL),
  ('h:6299c4dd7afb9b61', 'gemini', 'div', 'Upgrade', 1, 'commerce', 1783298502879, '[]', 1, 1782868076031, 1783298503087, NULL),
  ('h:eb03fa46539270df', 'gemini', 'infinite-scroller', 'You said search the web for example of o', 1, 'action', 1782434640115, '[]', 1, 1782868076031, 1783298503215, NULL),
  ('h:ff65db1d5e2b9bd5', 'gemini', 'div', 'Flash 3.1 Flash-Lite Fastest answers 3.5', 1, 'action', 1782434652428, '[]', 1, 1782868076031, 1783298503250, NULL),
  ('h:b565ab42f59c562a', 'gemini', 'hallucination-disclaimer', 'Gemini is AI and can make mistakes, incl', 1, 'action', 1782434640115, '[]', 1, 1782868076031, 1783298503216, NULL),
  ('h:b6507c3d877ce276', 'gemini', 'button', 'Upload & tools', 1, 'menu-trigger', 1783298502879, '[]', 1, 1782868076031, 1783298503094, NULL),
  ('h:5d0ac9d4599eaf44', 'gemini', 'p', 'Instead of hardcoding your API key direc', 1, 'action', 1782434640115, '[]', 1, 1782868076031, 1783298503223, NULL),
  ('h:1fcb3a8c8ed8ab96', 'gemini', 'p', 'If you are configuring the core OpenCode', 1, 'action', 1782434640115, '[]', 1, 1782868076031, 1783298503224, NULL),
  ('h:7f121406e2577884', 'gemini', 'code', '~/.config/opencode/opencode.json', 1, 'action', 1782434640115, '[]', 1, 1782868076031, 1783298503226, NULL),
  ('h:3e4ea20009dcefb0', 'gemini', 'h3', 'Scenario 1: Native OpenCode Configuratio', 1, 'action', 1782434640115, '[]', 1, 1782868076031, 1783298503228, NULL),
  ('h:cb99b36a613fc34a', 'gemini', 'div', 'Depending on whether you are configuring', 1, 'action', 1782434640115, '[]', 1, 1782868076031, 1783298503229, NULL),
  ('h:0f0366247a01d214', 'gemini', 'p', 'Here are the standard JSON configuration', 1, 'action', 1782434640115, '[]', 1, 1782868076031, 1783298503231, NULL);
INSERT INTO "hole" ("id", "provider_id", "role", "name", "layer_index", "classified_as", "discovered_at", "consumed_by", "schema_version", "created_at", "updated_at", "fingerprint") VALUES
  ('h:3e7699a203711a00', 'gemini', 'p', 'Depending on whether you are configuring', 1, 'action', 1782434640115, '[]', 1, 1782868076031, 1783298503233, NULL),
  ('h:47d74c09234018d0', 'gemini', 'user-query-content', 'You said search the web for example of o', 1, 'action', 1782434640115, '[]', 1, 1782868076031, 1783298503218, NULL),
  ('h:95b57bff7722e79d', 'gemini', 'div', 'You said search the web for example of o', 1, 'action', 1782434640115, '[]', 1, 1782868076031, 1783298503219, NULL),
  ('h:557906808ae18d71', 'gemini', 'span', 'You said search the web for example of o', 1, 'action', 1782434640115, '[]', 1, 1782868076031, 1783298503221, NULL),
  ('h:235420e21539bbfc', 'gemini', 'p', 'search the web for example of opencode G', 1, 'action', 1782434640115, '[]', 1, 1782868076031, 1783298503235, NULL),
  ('h:09adb97e423aaf7a', 'gemini', 'code', '@ai-sdk/openai-compatible', 1, 'action', 1782434640115, '[]', 1, 1782868076031, 1783298503237, NULL),
  ('h:1a958c3fa0f40870', 'gemini', 'b', 'VS Code Chat / GitHub Copilot Chat', 1, 'action', 1782434640115, '[]', 1, 1782868076031, 1783298503239, NULL),
  ('h:59ba7f8f410466e6', 'gemini', 'menuitem', '3.1 Flash-Lite Fastest answers', 1, 'menu-trigger', 1782434652428, '[]', 1, 1782868076031, 1783298503252, NULL),
  ('h:0daf04da533771ad', 'gemini', 'menuitem', '3.5 Flash All-around help', 1, 'menu-trigger', 1782434652428, '[]', 1, 1782868076031, 1783298503253, NULL),
  ('h:b099ce34e942a8d0', 'gemini', 'menuitem', '3.1 Pro Advanced math and code', 1, 'menu-trigger', 1782434652428, '[]', 1, 1782868076031, 1783298503255, NULL),
  ('h:7170c2464f5865c1', 'gemini', 'menuitem', 'Thinking level Standard', 1, 'menu-trigger', 1782434652428, '[]', 1, 1782868076031, 1783298503258, NULL),
  ('h:902a5a0be89e33b2', 'gemini', 'b', 'OpenCode TUI/CLI', 1, 'action', 1782434640115, '[]', 1, 1782868076031, 1783298503241, NULL),
  ('h:1178c0e98ad075b4', 'gemini', 'link', 'Upgrade', 1, 'commerce', 1783298502879, '[]', 1, 1782868076031, 1783298503128, NULL),
  ('h:20e3aa4fafbc4677', 'gemini', 'bard-mode-switcher', 'Flash 3.1 Flash-Lite Fastest answers 3.5', 1, 'action', 1782446567717, '[]', 1, 1782868076031, 1783298503281, NULL),
  ('h:fbcc14d343853882', 'gemini', 'button', 'Open mode picker, currently Flash', 1, 'menu-trigger', 1783298502879, '[]', 1, 1782868076031, 1783298503132, NULL),
  ('h:c1cdd09b7cd0ce0f', 'gemini', 'button', 'Copy prompt', 1, 'action', 1782434640115, '[]', 1, 1782868076031, 1783298503244, NULL),
  ('h:1cbea7032f075a16', 'gemini', 'button', 'Edit', 1, 'action', 1782434640115, '[]', 1, 1782868076031, 1783298503246, NULL),
  ('h:e213f4c3532e5e55', 'gemini', 'button', 'Microphone', 1, 'action', 1783298502879, '[]', 1, 1782868076031, 1783298503137, NULL),
  ('h:376d00168b5b0779', 'gemini', 'button', 'Open menu for conversation actions.', 1, 'menu-trigger', 1782434640115, '[]', 1, 1782868076031, 1783298503248, NULL),
  ('h:72d52faa680f0534', 'gemini', 'gem-nav-list-item', 'Anthropic Acquires Stainless API Tools', 1, 'action', 1782748034224, '[]', 1, 1782868076031, 1783298503361, NULL),
  ('h:0c5adab6b2ddfd7e', 'gemini', 'html', 'window.WIZ_global_data = {"AEJOSc":false', 0, 'action', 1782434175648, '[]', 1, 1782434175648, 1783298503146, NULL),
  ('h:9bf5f716bb3800ee', 'gemini', 'a', 'Gems', 0, 'link', 1782434257938, '[]', 1, 1782434257938, 1783298503160, NULL),
  ('h:bd342d0cb7cfe049', 'gemini', 'a', 'New notebook', 0, 'link', 1782434257938, '[]', 1, 1782434257938, 1783298503166, NULL),
  ('h:3aacf3eb803c66f0', 'gemini', 'button', 'Toggle Recents', 0, 'menu-trigger', 1782434257938, '[]', 1, 1782434257938, 1783298503168, NULL),
  ('h:9113406d14a29929', 'gemini', 'a', 'TypeScript HTTP Server With CDP', 0, 'link', 1782434257938, '[]', 1, 1782434257938, 1783298503170, NULL),
  ('h:ddd7d2cf2378e547', 'gemini', 'a', 'Sky Color Identification', 0, 'link', 1782434257938, '[]', 1, 1782434257938, 1783298503174, NULL),
  ('h:c4f010dc37f4d1d4', 'gemini', 'gem-nav-list-item', 'Quantum Computing Explained Simply', 0, 'action', 1782434257938, '[]', 1, 1782434257938, 1783298503175, NULL),
  ('h:8b89f5ee9b395793', 'gemini', 'a', 'Quantum Computing Explained Simply', 0, 'link', 1782434257938, '[]', 1, 1782434257938, 1783298503177, NULL),
  ('h:cd8f996fbdeb03a3', 'gemini', 'gem-nav-list-item', 'Activity', 0, 'action', 1782434257938, '[]', 1, 1782434257938, 1783298503181, NULL),
  ('h:51fda3f55e0c43a9', 'gemini', 'span', 'Based on your places (Home)', 0, 'action', 1782434257938, '[]', 1, 1782434257938, 1783298503188, NULL),
  ('h:5ac1c846dbd7710d', 'gemini', 'group', 'Activity owen wallace-servera', 0, 'action', 1782434257938, '[]', 1, 1782434257938, 1783298503196, NULL),
  ('h:3aa6e590a8aeb1f5', 'gemini', 'div', 'What should we focus on?', 0, 'action', 1782434257938, '[]', 1, 1782434257938, 1783298503199, NULL),
  ('h:22272ae057bd51b4', 'gemini', 'button', 'Upload & tools', 0, 'menu-trigger', 1782434257938, '[]', 1, 1782434257938, 1783298503203, NULL),
  ('h:edec4a9c507edc8e', 'gemini', 'textbox', 'Enter a prompt for Gemini', 0, 'composer', 1782434257938, '[]', 1, 1782434257938, 1783298503204, NULL),
  ('h:1b828de31c1f5894', 'gemini', 'span', 'What should we focus on?', 0, 'action', 1782434257938, '[]', 1, 1782434257938, 1783298503206, NULL),
  ('h:05095b8582c5c480', 'gemini', 'button', 'Microphone', 0, 'action', 1782434257938, '[]', 1, 1782434257938, 1783298503211, NULL),
  ('h:76a0bb8b36fa5e14', 'gemini', 'code', 'opencode.json', 1, 'action', 1782434640115, '[]', 1, 1782434640115, 1783298503243, NULL),
  ('h:4240734351ba104c', 'gemini', 'menu', '3.1 Flash-Lite Fastest answers 3.5 Flash', 1, 'action', 1782434652428, '[]', 1, 1782434652428, 1783298503257, NULL),
  ('h:69e2b988f8843a16', 'gemini', 'user-query-content', 'You said simpler', 1, 'action', 1782446563198, '[]', 1, 1782446563198, 1783298503263, NULL),
  ('h:2302f8696d918ae7', 'gemini', 'div', 'stop generation. Respond briefly.Flash', 1, 'action', 1782446563198, '[]', 1, 1782446563198, 1783298503265, NULL),
  ('h:fe5ba5f629ed5471', 'gemini', 'div', 'You said simpler Gemini said', 1, 'action', 1782446563198, '[]', 1, 1782446563198, 1783298503266, NULL),
  ('h:e0715e1173dbd95b', 'gemini', 'button', 'Show more options', 1, 'menu-trigger', 1782446563198, '[]', 1, 1782446563198, 1783298503268, NULL),
  ('h:4af430fce11500cc', 'gemini', 'bard-mode-switcher', 'Flash', 1, 'action', 1782446563198, '[]', 1, 1782446563198, 1783298503270, NULL),
  ('h:bf423857382e1526', 'gemini', 'div', 'You said simpler', 1, 'action', 1782446563198, '[]', 1, 1782446563198, 1783298503271, NULL),
  ('h:5ea36fb2c4bc5b12', 'gemini', 'span', 'You said simpler', 1, 'action', 1782446563198, '[]', 1, 1782446563198, 1783298503273, NULL),
  ('h:d7a268dbad7fb2e0', 'gemini', 'p', 'simpler', 1, 'action', 1782446563198, '[]', 1, 1782446563198, 1783298503275, NULL),
  ('h:1c1377935f7b675f', 'gemini', 'button', 'Send message', 1, 'submit', 1782446563198, '[]', 1, 1782446563198, 1783298503277, NULL),
  ('h:51c0ad9cecc9a0c4', 'gemini', 'div', 'stop generation. Respond briefly.', 1, 'action', 1782446563198, '[]', 1, 1782446563198, 1783298503278, NULL),
  ('h:232d68a0a39ae78e', 'gemini', 'menu', 'Menu options', 1, 'menu-trigger', 1782446565736, '[]', 1, 1782446565736, 1783298503280, NULL),
  ('h:1be57b0b353951ab', 'gemini', 'menuitem', 'Share conversation', 0, 'action', 1782446651260, '[]', 1, 1782446651260, 1783298503283, NULL),
  ('h:de6b7f4bb26e22b9', 'gemini', 'menuitem', 'Pin', 0, 'action', 1782446651260, '[]', 1, 1782446651260, 1783298503285, NULL),
  ('h:a146db2ee83ecc02', 'gemini', 'menuitem', 'Rename', 0, 'action', 1782446651260, '[]', 1, 1782446651260, 1783298503286, NULL),
  ('h:e4ee413f47a9bfbd', 'gemini', 'menuitem', 'Delete', 0, 'action', 1782446651260, '[]', 1, 1782446651260, 1783298503288, NULL),
  ('h:aea017826148d6b0', 'gemini', 'div', 'Share conversation Pin Rename Delete', 0, 'action', 1782446651260, '[]', 1, 1782446651260, 1783298503289, NULL),
  ('h:7a83f476e156e726', 'gemini', 'menu', 'Share conversation Pin Rename Delete', 1, 'action', 1782446666560, '[]', 1, 1782446666560, 1783298503291, NULL),
  ('h:ff892e6ec9a75627', 'gemini', 'a', 'Sterile And Waste-Free Fluid', 1, 'link', 1782747954220, '[]', 1, 1782747954220, 1783298503304, NULL),
  ('h:17f637ee831d842c', 'gemini', 'a', 'Fastest Planet: Orbital vs. Rotational S', 1, 'link', 1782747954220, '[]', 1, 1782747954220, 1783298503305, NULL),
  ('h:08ad1eb29b4af28a', 'gemini', 'a', 'Ten Recipes From Ingredients', 1, 'link', 1782747954220, '[]', 1, 1782747954220, 1783298503307, NULL),
  ('h:5737694b57803fb2', 'gemini', 'gem-nav-list-item', 'Ten Recipes From Ingredients', 1, 'action', 1782747954220, '[]', 1, 1782747954220, 1783298503309, NULL),
  ('h:77a6d870495cdf23', 'gemini', 'a', 'Mediterranean Recipes From Easy to Hard', 1, 'link', 1782747954220, '[]', 1, 1782747954220, 1783298503310, NULL),
  ('h:47427b018d6af1f8', 'gemini', 'div', 'owservera@gmail.com', 1, 'action', 1782747954220, '[]', 1, 1782747954220, 1783298503311, NULL),
  ('h:b6c6baed0b339991', 'gemini', 'div', 'Google Account', 1, 'menu-trigger', 1782747954220, '[]', 1, 1782747954220, 1783298503313, NULL),
  ('h:5e9c10e3cf4c785b', 'gemini', 'infinite-scroller', 'You said Hi - what day is it today - wha', 1, 'action', 1782747954220, '[]', 1, 1782747954220, 1783298503315, NULL),
  ('h:99cc3794dc5e59a2', 'gemini', 'div', 'You said Hi - what day is it today - wha', 1, 'action', 1782747954220, '[]', 1, 1782747954220, 1783298503317, NULL),
  ('h:c0a3e52c480e859c', 'gemini', 'button', 'Good response', 1, 'action', 1782747954220, '[]', 1, 1782747954220, 1783298503319, NULL),
  ('h:5edcb0402cbf5aab', 'gemini', 'p', 'As for your account, you are logged in a', 1, 'menu-trigger', 1782747954220, '[]', 1, 1782747954220, 1783298503321, NULL),
  ('h:54ff8c1f6548d58b', 'gemini', 'div', 'Today is Saturday, June 27, 2026.I am Ge', 1, 'action', 1782747954220, '[]', 1, 1782747954220, 1783298503322, NULL),
  ('h:6a42167077ca1f06', 'gemini', 'p', 'Today is Saturday, June 27, 2026.', 1, 'action', 1782747954220, '[]', 1, 1782747954220, 1783298503324, NULL),
  ('h:48bcaa52ef701786', 'gemini', 'user-query-content', 'You said Hi - what day is it today - wha', 1, 'action', 1782747954220, '[]', 1, 1782747954220, 1783298503326, NULL),
  ('h:7a98b7d0a4d70020', 'gemini', 'button', 'Bad response', 1, 'action', 1782747954220, '[]', 1, 1782747954220, 1783298503328, NULL),
  ('h:404af6b301b872b9', 'gemini', 'button', 'Redo', 1, 'action', 1782747954220, '[]', 1, 1782747954220, 1783298503329, NULL),
  ('h:c196e4070b4f5754', 'gemini', 'b', 'Saturday, June 27, 2026', 1, 'action', 1782747954220, '[]', 1, 1782747954220, 1783298503331, NULL),
  ('h:62f4d2ae2b3f9752', 'gemini', 'span', 'You said Hi - what day is it today - wha', 1, 'action', 1782747954220, '[]', 1, 1782747954220, 1783298503333, NULL),
  ('h:1818dbee64bc046e', 'gemini', 'button', 'Copy', 1, 'action', 1782747954220, '[]', 1, 1782747954220, 1783298503338, NULL),
  ('h:8f7d4ea03cc24193', 'gemini', 'p', 'Hi - what day is it today - what model a', 1, 'action', 1782747954220, '[]', 1, 1782747954220, 1783298503341, NULL),
  ('h:2dd85dae5ceacfca', 'gemini', 'b', 'Owen Alexander Wallace-Servera', 1, 'action', 1782747954220, '[]', 1, 1782747954220, 1783298503343, NULL),
  ('h:98315a80fc416a26', 'gemini', 'gem-nav-list-item', 'Mediterranean Recipes From Easy to Hard', 1, 'action', 1782748021329, '[]', 1, 1782748021329, 1783298503360, NULL);

-- learning_event: (empty)

-- migration_log: 90 rows
INSERT INTO "migration_log" ("id", "source", "source_path", "records_read", "records_written", "records_skipped", "skip_reasons", "ts", "duration_ms") VALUES
  (1, 'taxonomy-globals', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\taxonomy\globals.json', 201, 201, 0, '[]', 1782868071184, 1295),
  (2, 'actions', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\actions.json', 104, 208, 0, '[]', 1782868072713, 1510),
  (3, 'outcomes', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\learning\outcomes.jsonl', 882, 613, 268, '["binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for claude::new-chat","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for deepseek::send-text","binding missing for deepseek::send-text","binding missing for deepseek::send-text","binding missing for deepseek::send-text","binding missing for deepseek::send-text","binding missing for deepseek::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text"]', 1782868074474, 1758),
  (4, 'capability-map', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\chatgpt\capability-map.json', 99, 99, 0, '[]', 1782868074683, 205),
  (5, 'holes', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\chatgpt\holes.json', 180, 180, 0, '[]', 1782868075064, 377),
  (6, 'observations', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\chatgpt\observations.jsonl', 10, 4, 6, '["binding missing for chatgpt::read-discovery","binding missing for chatgpt::mow chatgpt --step 30 --layer 0 --port 9223","binding missing for chatgpt::mow chatgpt --step 25 --port 9223","binding missing for chatgpt::read-discovery","binding missing for chatgpt::mow chatgpt --step 25 --port 9223","binding missing for chatgpt::mow chatgpt"]', 1782868075076, 10),
  (7, 'capability-map', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\claude\capability-map.json', 30, 30, 0, '[]', 1782868075154, 76),
  (8, 'holes', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\claude\holes.json', 316, 316, 0, '[]', 1782868075947, 792),
  (9, 'observations', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\claude\observations.jsonl', 174, 11, 163, '["binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 40 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 40 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude","binding missing for claude::mow claude","binding missing for claude::mow claude","binding missing for claude::click claude --text Simple prime number checker","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 25 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::click claude --text Add files","binding missing for claude::mow claude --step 25 --layer 1","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 20 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 15 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::click claude --text Model: Haiku","binding missing for claude::click claude --text Sonnet","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 15 --layer 2","binding missing for claude::click claude --text Model: Haiku","binding missing for claude::click claude --text More models","binding missing for claude::mow claude --step 15 --layer 2","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 40 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::click claude --text Settings","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::click claude --text Go back","binding missing for claude::mow claude --step 30","binding missing for claude::mow claude --step 40","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 60","binding missing for claude::mow claude --step 80","binding missing for claude::mow claude","binding missing for claude::click claude --text Thinking","binding missing for claude::click claude --text Model: Haiku 4.5 Extended","binding missing for claude::click claude --text Haiku 4.5 Extended","binding missing for claude::click claude --text Send Message","binding missing for claude::click claude --text Thought process","binding missing for claude::click claude --text Thought process","binding missing for claude::click claude --text Send Message","binding missing for claude::click claude --text Copy","binding missing for claude::click claude --text Retry","binding missing for claude::click claude --text Read aloud","binding missing for claude::click claude --text Clear composer","binding missing for claude::click claude --text Go back","binding missing for claude::click claude --text Stop generating","binding missing for claude::click claude --text Send Message","binding missing for claude::click claude --text Stop generating","binding missing for claude::mow claude --step 40 --layer 0","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::click claude --text More options","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::click claude --text More options for Short haiku request","binding missing for claude::click claude --text Star","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::mow claude","binding missing for claude::click claude --text Personalizar --register open-customize","binding missing for claude::click claude --text Proyectos --register open-projects","binding missing for claude::click claude --text Customize --register open-customize","binding missing for claude::mow claude","binding missing for claude::click claude --text Settings --register open-settings","binding missing for claude::mow claude","binding missing for claude::click claude --text Web search --register toggle-web-search","binding missing for claude::click claude --text Back --register go-back-nav","binding missing for claude::click claude --text Add files, connectors, and more --register open-attach-menu","binding missing for claude::mow claude","binding missing for claude::click claude --text Web search --register toggle-web-search --verify-gone Web search","binding missing for claude::click claude --text Web --register toggle-web-search","binding missing for claude::mow claude","binding missing for claude::click claude --text Add skill --register add-skill","binding missing for claude::click claude --text Add custom connector --register add-custom-connector","binding missing for claude::click claude --text Start a new project --register start-new-project","binding missing for claude::click claude --text Haiku --register select-model-haiku","binding missing for claude::click claude --text Model: --register open-model-menu","binding missing for claude::mow claude","binding missing for claude::click claude --text Close","binding missing for claude::click claude --text Claude --register go-home","binding missing for claude::click claude --text New conversation --register new-chat-claude","binding missing for claude::click claude --text Nueva --register new-chat-claude","binding missing for claude::mow claude","binding missing for claude::click claude --text Sonnet 4.6 --register select-model-sonnet","binding missing for claude::click claude --text More models --register open-more-models","binding missing for claude::mow claude","binding missing for claude::click claude --text Close","binding missing for claude::read-discovery"]', 1782868075982, 33),
  (10, 'capability-map', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\deepseek\capability-map.json', 9, 9, 0, '[]', 1782868076002, 18),
  (11, 'holes', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\deepseek\holes.json', 9, 9, 0, '[]', 1782868076026, 22),
  (12, 'observations', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\deepseek\observations.jsonl', 3, 0, 3, '["binding missing for deepseek::mow deepseek --step 30 --layer 0 --port 9225","binding missing for deepseek::mow deepseek --step 30 --port 9225","binding missing for deepseek::mow deepseek --step 30 --port 9225"]', 1782868076028, 1),
  (13, 'capability-map', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\gemini\capability-map.json', 138, 138, 0, '[]', 1782868076319, 289),
  (14, 'holes', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\gemini\holes.json', 121, 121, 0, '[]', 1782868076592, 271),
  (15, 'observations', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\gemini\observations.jsonl', 6, 0, 6, '["binding missing for gemini::mow gemini --step 30 --layer 0 --port 9222","binding missing for gemini::mow gemini --step 30 --layer 0 --port 9222","binding missing for gemini::mow gemini --step 25 --port 9222","binding missing for gemini::mow gemini --step 20 --layer 1 --port 9222","binding missing for gemini::mow gemini --step 25 --port 9222","binding missing for gemini::mow gemini"]', 1782868076595, 2),
  (16, 'taxonomy-globals', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\taxonomy\globals.json', 201, 201, 0, '[]', 1782868110853, 1199),
  (17, 'actions', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\actions.json', 104, 208, 0, '[]', 1782868112370, 1514),
  (18, 'outcomes', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\learning\outcomes.jsonl', 882, 613, 268, '["binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for claude::new-chat","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for deepseek::send-text","binding missing for deepseek::send-text","binding missing for deepseek::send-text","binding missing for deepseek::send-text","binding missing for deepseek::send-text","binding missing for deepseek::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text"]', 1782868113672, 1299),
  (19, 'capability-map', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\chatgpt\capability-map.json', 99, 99, 0, '[]', 1782868113880, 204),
  (20, 'holes', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\chatgpt\holes.json', 180, 180, 0, '[]', 1782868114250, 368),
  (21, 'observations', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\chatgpt\observations.jsonl', 10, 4, 6, '["binding missing for chatgpt::read-discovery","binding missing for chatgpt::mow chatgpt --step 30 --layer 0 --port 9223","binding missing for chatgpt::mow chatgpt --step 25 --port 9223","binding missing for chatgpt::read-discovery","binding missing for chatgpt::mow chatgpt --step 25 --port 9223","binding missing for chatgpt::mow chatgpt"]', 1782868114263, 9),
  (22, 'capability-map', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\claude\capability-map.json', 30, 30, 0, '[]', 1782868114326, 62),
  (23, 'holes', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\claude\holes.json', 316, 316, 0, '[]', 1782868114962, 634),
  (24, 'observations', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\claude\observations.jsonl', 174, 11, 163, '["binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 40 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 40 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude","binding missing for claude::mow claude","binding missing for claude::mow claude","binding missing for claude::click claude --text Simple prime number checker","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 25 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::click claude --text Add files","binding missing for claude::mow claude --step 25 --layer 1","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 20 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 15 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::click claude --text Model: Haiku","binding missing for claude::click claude --text Sonnet","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 15 --layer 2","binding missing for claude::click claude --text Model: Haiku","binding missing for claude::click claude --text More models","binding missing for claude::mow claude --step 15 --layer 2","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 40 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::click claude --text Settings","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::click claude --text Go back","binding missing for claude::mow claude --step 30","binding missing for claude::mow claude --step 40","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 60","binding missing for claude::mow claude --step 80","binding missing for claude::mow claude","binding missing for claude::click claude --text Thinking","binding missing for claude::click claude --text Model: Haiku 4.5 Extended","binding missing for claude::click claude --text Haiku 4.5 Extended","binding missing for claude::click claude --text Send Message","binding missing for claude::click claude --text Thought process","binding missing for claude::click claude --text Thought process","binding missing for claude::click claude --text Send Message","binding missing for claude::click claude --text Copy","binding missing for claude::click claude --text Retry","binding missing for claude::click claude --text Read aloud","binding missing for claude::click claude --text Clear composer","binding missing for claude::click claude --text Go back","binding missing for claude::click claude --text Stop generating","binding missing for claude::click claude --text Send Message","binding missing for claude::click claude --text Stop generating","binding missing for claude::mow claude --step 40 --layer 0","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::click claude --text More options","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::click claude --text More options for Short haiku request","binding missing for claude::click claude --text Star","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::mow claude","binding missing for claude::click claude --text Personalizar --register open-customize","binding missing for claude::click claude --text Proyectos --register open-projects","binding missing for claude::click claude --text Customize --register open-customize","binding missing for claude::mow claude","binding missing for claude::click claude --text Settings --register open-settings","binding missing for claude::mow claude","binding missing for claude::click claude --text Web search --register toggle-web-search","binding missing for claude::click claude --text Back --register go-back-nav","binding missing for claude::click claude --text Add files, connectors, and more --register open-attach-menu","binding missing for claude::mow claude","binding missing for claude::click claude --text Web search --register toggle-web-search --verify-gone Web search","binding missing for claude::click claude --text Web --register toggle-web-search","binding missing for claude::mow claude","binding missing for claude::click claude --text Add skill --register add-skill","binding missing for claude::click claude --text Add custom connector --register add-custom-connector","binding missing for claude::click claude --text Start a new project --register start-new-project","binding missing for claude::click claude --text Haiku --register select-model-haiku","binding missing for claude::click claude --text Model: --register open-model-menu","binding missing for claude::mow claude","binding missing for claude::click claude --text Close","binding missing for claude::click claude --text Claude --register go-home","binding missing for claude::click claude --text New conversation --register new-chat-claude","binding missing for claude::click claude --text Nueva --register new-chat-claude","binding missing for claude::mow claude","binding missing for claude::click claude --text Sonnet 4.6 --register select-model-sonnet","binding missing for claude::click claude --text More models --register open-more-models","binding missing for claude::mow claude","binding missing for claude::click claude --text Close","binding missing for claude::read-discovery"]', 1782868114997, 32),
  (25, 'capability-map', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\deepseek\capability-map.json', 9, 9, 0, '[]', 1782868115018, 19),
  (26, 'holes', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\deepseek\holes.json', 9, 9, 0, '[]', 1782868115051, 32),
  (27, 'observations', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\deepseek\observations.jsonl', 3, 0, 3, '["binding missing for deepseek::mow deepseek --step 30 --layer 0 --port 9225","binding missing for deepseek::mow deepseek --step 30 --port 9225","binding missing for deepseek::mow deepseek --step 30 --port 9225"]', 1782868115053, 1),
  (28, 'capability-map', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\gemini\capability-map.json', 138, 138, 0, '[]', 1782868115338, 283),
  (29, 'holes', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\gemini\holes.json', 121, 121, 0, '[]', 1782868115579, 239),
  (30, 'observations', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\gemini\observations.jsonl', 6, 0, 6, '["binding missing for gemini::mow gemini --step 30 --layer 0 --port 9222","binding missing for gemini::mow gemini --step 30 --layer 0 --port 9222","binding missing for gemini::mow gemini --step 25 --port 9222","binding missing for gemini::mow gemini --step 20 --layer 1 --port 9222","binding missing for gemini::mow gemini --step 25 --port 9222","binding missing for gemini::mow gemini"]', 1782868115582, 1),
  (31, 'taxonomy-globals', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\taxonomy\globals.json', 201, 201, 0, '[]', 1782939756882, 388),
  (32, 'actions', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\actions.json', 104, 208, 0, '[]', 1782939757581, 696),
  (33, 'outcomes', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\learning\outcomes.jsonl', 882, 613, 268, '["binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for claude::new-chat","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for deepseek::send-text","binding missing for deepseek::send-text","binding missing for deepseek::send-text","binding missing for deepseek::send-text","binding missing for deepseek::send-text","binding missing for deepseek::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text"]', 1782939758788, 1205),
  (34, 'capability-map', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\chatgpt\capability-map.json', 99, 99, 0, '[]', 1782939758972, 180),
  (35, 'holes', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\chatgpt\holes.json', 180, 180, 0, '[]', 1782939759337, 363),
  (36, 'observations', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\chatgpt\observations.jsonl', 10, 4, 6, '["binding missing for chatgpt::read-discovery","binding missing for chatgpt::mow chatgpt --step 30 --layer 0 --port 9223","binding missing for chatgpt::mow chatgpt --step 25 --port 9223","binding missing for chatgpt::read-discovery","binding missing for chatgpt::mow chatgpt --step 25 --port 9223","binding missing for chatgpt::mow chatgpt"]', 1782939759349, 9),
  (37, 'capability-map', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\claude\capability-map.json', 30, 30, 0, '[]', 1782939759418, 67),
  (38, 'holes', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\claude\holes.json', 316, 316, 0, '[]', 1782939760016, 596),
  (39, 'observations', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\claude\observations.jsonl', 174, 11, 163, '["binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 40 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 40 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude","binding missing for claude::mow claude","binding missing for claude::mow claude","binding missing for claude::click claude --text Simple prime number checker","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 25 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::click claude --text Add files","binding missing for claude::mow claude --step 25 --layer 1","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 20 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 15 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::click claude --text Model: Haiku","binding missing for claude::click claude --text Sonnet","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 15 --layer 2","binding missing for claude::click claude --text Model: Haiku","binding missing for claude::click claude --text More models","binding missing for claude::mow claude --step 15 --layer 2","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 40 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::click claude --text Settings","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::click claude --text Go back","binding missing for claude::mow claude --step 30","binding missing for claude::mow claude --step 40","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 60","binding missing for claude::mow claude --step 80","binding missing for claude::mow claude","binding missing for claude::click claude --text Thinking","binding missing for claude::click claude --text Model: Haiku 4.5 Extended","binding missing for claude::click claude --text Haiku 4.5 Extended","binding missing for claude::click claude --text Send Message","binding missing for claude::click claude --text Thought process","binding missing for claude::click claude --text Thought process","binding missing for claude::click claude --text Send Message","binding missing for claude::click claude --text Copy","binding missing for claude::click claude --text Retry","binding missing for claude::click claude --text Read aloud","binding missing for claude::click claude --text Clear composer","binding missing for claude::click claude --text Go back","binding missing for claude::click claude --text Stop generating","binding missing for claude::click claude --text Send Message","binding missing for claude::click claude --text Stop generating","binding missing for claude::mow claude --step 40 --layer 0","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::click claude --text More options","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::click claude --text More options for Short haiku request","binding missing for claude::click claude --text Star","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::mow claude","binding missing for claude::click claude --text Personalizar --register open-customize","binding missing for claude::click claude --text Proyectos --register open-projects","binding missing for claude::click claude --text Customize --register open-customize","binding missing for claude::mow claude","binding missing for claude::click claude --text Settings --register open-settings","binding missing for claude::mow claude","binding missing for claude::click claude --text Web search --register toggle-web-search","binding missing for claude::click claude --text Back --register go-back-nav","binding missing for claude::click claude --text Add files, connectors, and more --register open-attach-menu","binding missing for claude::mow claude","binding missing for claude::click claude --text Web search --register toggle-web-search --verify-gone Web search","binding missing for claude::click claude --text Web --register toggle-web-search","binding missing for claude::mow claude","binding missing for claude::click claude --text Add skill --register add-skill","binding missing for claude::click claude --text Add custom connector --register add-custom-connector","binding missing for claude::click claude --text Start a new project --register start-new-project","binding missing for claude::click claude --text Haiku --register select-model-haiku","binding missing for claude::click claude --text Model: --register open-model-menu","binding missing for claude::mow claude","binding missing for claude::click claude --text Close","binding missing for claude::click claude --text Claude --register go-home","binding missing for claude::click claude --text New conversation --register new-chat-claude","binding missing for claude::click claude --text Nueva --register new-chat-claude","binding missing for claude::mow claude","binding missing for claude::click claude --text Sonnet 4.6 --register select-model-sonnet","binding missing for claude::click claude --text More models --register open-more-models","binding missing for claude::mow claude","binding missing for claude::click claude --text Close","binding missing for claude::read-discovery"]', 1782939760043, 25),
  (40, 'capability-map', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\deepseek\capability-map.json', 9, 9, 0, '[]', 1782939760062, 17),
  (41, 'holes', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\deepseek\holes.json', 9, 9, 0, '[]', 1782939760079, 16),
  (42, 'observations', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\deepseek\observations.jsonl', 3, 0, 3, '["binding missing for deepseek::mow deepseek --step 30 --layer 0 --port 9225","binding missing for deepseek::mow deepseek --step 30 --port 9225","binding missing for deepseek::mow deepseek --step 30 --port 9225"]', 1782939760081, 1),
  (43, 'capability-map', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\gemini\capability-map.json', 138, 138, 0, '[]', 1782939760340, 257),
  (44, 'holes', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\gemini\holes.json', 121, 121, 0, '[]', 1782939760595, 253),
  (45, 'observations', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\gemini\observations.jsonl', 6, 0, 6, '["binding missing for gemini::mow gemini --step 30 --layer 0 --port 9222","binding missing for gemini::mow gemini --step 30 --layer 0 --port 9222","binding missing for gemini::mow gemini --step 25 --port 9222","binding missing for gemini::mow gemini --step 20 --layer 1 --port 9222","binding missing for gemini::mow gemini --step 25 --port 9222","binding missing for gemini::mow gemini"]', 1782939760598, 1),
  (46, 'taxonomy-globals', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\taxonomy\globals.json', 201, 201, 0, '[]', 1783007624253, 590),
  (47, 'actions', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\actions.json', 104, 208, 0, '[]', 1783007625154, 898),
  (48, 'outcomes', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\learning\outcomes.jsonl', 882, 613, 268, '["binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for claude::new-chat","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for deepseek::send-text","binding missing for deepseek::send-text","binding missing for deepseek::send-text","binding missing for deepseek::send-text","binding missing for deepseek::send-text","binding missing for deepseek::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text"]', 1783007626863, 1694),
  (49, 'capability-map', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\chatgpt\capability-map.json', 99, 99, 0, '[]', 1783007627139, 272),
  (50, 'holes', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\chatgpt\holes.json', 180, 180, 0, '[]', 1783007627540, 399),
  (51, 'observations', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\chatgpt\observations.jsonl', 10, 4, 6, '["binding missing for chatgpt::read-discovery","binding missing for chatgpt::mow chatgpt --step 30 --layer 0 --port 9223","binding missing for chatgpt::mow chatgpt --step 25 --port 9223","binding missing for chatgpt::read-discovery","binding missing for chatgpt::mow chatgpt --step 25 --port 9223","binding missing for chatgpt::mow chatgpt"]', 1783007627552, 9),
  (52, 'capability-map', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\claude\capability-map.json', 30, 30, 0, '[]', 1783007627618, 65),
  (53, 'holes', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\claude\holes.json', 316, 316, 0, '[]', 1783007628395, 775),
  (54, 'observations', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\claude\observations.jsonl', 174, 11, 163, '["binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 40 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 40 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude","binding missing for claude::mow claude","binding missing for claude::mow claude","binding missing for claude::click claude --text Simple prime number checker","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 25 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::click claude --text Add files","binding missing for claude::mow claude --step 25 --layer 1","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 20 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 15 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::click claude --text Model: Haiku","binding missing for claude::click claude --text Sonnet","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 15 --layer 2","binding missing for claude::click claude --text Model: Haiku","binding missing for claude::click claude --text More models","binding missing for claude::mow claude --step 15 --layer 2","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 40 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::click claude --text Settings","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::click claude --text Go back","binding missing for claude::mow claude --step 30","binding missing for claude::mow claude --step 40","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 60","binding missing for claude::mow claude --step 80","binding missing for claude::mow claude","binding missing for claude::click claude --text Thinking","binding missing for claude::click claude --text Model: Haiku 4.5 Extended","binding missing for claude::click claude --text Haiku 4.5 Extended","binding missing for claude::click claude --text Send Message","binding missing for claude::click claude --text Thought process","binding missing for claude::click claude --text Thought process","binding missing for claude::click claude --text Send Message","binding missing for claude::click claude --text Copy","binding missing for claude::click claude --text Retry","binding missing for claude::click claude --text Read aloud","binding missing for claude::click claude --text Clear composer","binding missing for claude::click claude --text Go back","binding missing for claude::click claude --text Stop generating","binding missing for claude::click claude --text Send Message","binding missing for claude::click claude --text Stop generating","binding missing for claude::mow claude --step 40 --layer 0","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::click claude --text More options","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::click claude --text More options for Short haiku request","binding missing for claude::click claude --text Star","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::mow claude","binding missing for claude::click claude --text Personalizar --register open-customize","binding missing for claude::click claude --text Proyectos --register open-projects","binding missing for claude::click claude --text Customize --register open-customize","binding missing for claude::mow claude","binding missing for claude::click claude --text Settings --register open-settings","binding missing for claude::mow claude","binding missing for claude::click claude --text Web search --register toggle-web-search","binding missing for claude::click claude --text Back --register go-back-nav","binding missing for claude::click claude --text Add files, connectors, and more --register open-attach-menu","binding missing for claude::mow claude","binding missing for claude::click claude --text Web search --register toggle-web-search --verify-gone Web search","binding missing for claude::click claude --text Web --register toggle-web-search","binding missing for claude::mow claude","binding missing for claude::click claude --text Add skill --register add-skill","binding missing for claude::click claude --text Add custom connector --register add-custom-connector","binding missing for claude::click claude --text Start a new project --register start-new-project","binding missing for claude::click claude --text Haiku --register select-model-haiku","binding missing for claude::click claude --text Model: --register open-model-menu","binding missing for claude::mow claude","binding missing for claude::click claude --text Close","binding missing for claude::click claude --text Claude --register go-home","binding missing for claude::click claude --text New conversation --register new-chat-claude","binding missing for claude::click claude --text Nueva --register new-chat-claude","binding missing for claude::mow claude","binding missing for claude::click claude --text Sonnet 4.6 --register select-model-sonnet","binding missing for claude::click claude --text More models --register open-more-models","binding missing for claude::mow claude","binding missing for claude::click claude --text Close","binding missing for claude::read-discovery"]', 1783007628423, 26),
  (55, 'capability-map', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\deepseek\capability-map.json', 9, 9, 0, '[]', 1783007628455, 31),
  (56, 'holes', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\deepseek\holes.json', 9, 9, 0, '[]', 1783007628477, 21),
  (57, 'observations', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\deepseek\observations.jsonl', 3, 0, 3, '["binding missing for deepseek::mow deepseek --step 30 --layer 0 --port 9225","binding missing for deepseek::mow deepseek --step 30 --port 9225","binding missing for deepseek::mow deepseek --step 30 --port 9225"]', 1783007628479, 1),
  (58, 'capability-map', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\gemini\capability-map.json', 138, 138, 0, '[]', 1783007628894, 413),
  (59, 'holes', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\gemini\holes.json', 121, 121, 0, '[]', 1783007629220, 325),
  (60, 'observations', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\gemini\observations.jsonl', 6, 0, 6, '["binding missing for gemini::mow gemini --step 30 --layer 0 --port 9222","binding missing for gemini::mow gemini --step 30 --layer 0 --port 9222","binding missing for gemini::mow gemini --step 25 --port 9222","binding missing for gemini::mow gemini --step 20 --layer 1 --port 9222","binding missing for gemini::mow gemini --step 25 --port 9222","binding missing for gemini::mow gemini"]', 1783007629223, 1),
  (61, 'taxonomy-globals', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\taxonomy\globals.json', 201, 201, 0, '[]', 1783009818616, 729),
  (62, 'actions', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\actions.json', 104, 208, 0, '[]', 1783009819625, 1006),
  (63, 'outcomes', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\learning\outcomes.jsonl', 882, 613, 268, '["binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for claude::new-chat","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for deepseek::send-text","binding missing for deepseek::send-text","binding missing for deepseek::send-text","binding missing for deepseek::send-text","binding missing for deepseek::send-text","binding missing for deepseek::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text"]', 1783009821053, 1426),
  (64, 'capability-map', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\chatgpt\capability-map.json', 99, 99, 0, '[]', 1783009821402, 333),
  (65, 'holes', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\chatgpt\holes.json', 180, 180, 0, '[]', 1783009821891, 488),
  (66, 'observations', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\chatgpt\observations.jsonl', 10, 4, 6, '["binding missing for chatgpt::read-discovery","binding missing for chatgpt::mow chatgpt --step 30 --layer 0 --port 9223","binding missing for chatgpt::mow chatgpt --step 25 --port 9223","binding missing for chatgpt::read-discovery","binding missing for chatgpt::mow chatgpt --step 25 --port 9223","binding missing for chatgpt::mow chatgpt"]', 1783009821924, 20),
  (67, 'capability-map', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\claude\capability-map.json', 30, 30, 0, '[]', 1783009822004, 79),
  (68, 'holes', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\claude\holes.json', 316, 316, 0, '[]', 1783009822977, 958),
  (69, 'observations', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\claude\observations.jsonl', 174, 11, 163, '["binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 40 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 40 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude","binding missing for claude::mow claude","binding missing for claude::mow claude","binding missing for claude::click claude --text Simple prime number checker","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 25 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::click claude --text Add files","binding missing for claude::mow claude --step 25 --layer 1","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 20 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 15 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::click claude --text Model: Haiku","binding missing for claude::click claude --text Sonnet","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 15 --layer 2","binding missing for claude::click claude --text Model: Haiku","binding missing for claude::click claude --text More models","binding missing for claude::mow claude --step 15 --layer 2","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 40 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::click claude --text Settings","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::click claude --text Go back","binding missing for claude::mow claude --step 30","binding missing for claude::mow claude --step 40","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 60","binding missing for claude::mow claude --step 80","binding missing for claude::mow claude","binding missing for claude::click claude --text Thinking","binding missing for claude::click claude --text Model: Haiku 4.5 Extended","binding missing for claude::click claude --text Haiku 4.5 Extended","binding missing for claude::click claude --text Send Message","binding missing for claude::click claude --text Thought process","binding missing for claude::click claude --text Thought process","binding missing for claude::click claude --text Send Message","binding missing for claude::click claude --text Copy","binding missing for claude::click claude --text Retry","binding missing for claude::click claude --text Read aloud","binding missing for claude::click claude --text Clear composer","binding missing for claude::click claude --text Go back","binding missing for claude::click claude --text Stop generating","binding missing for claude::click claude --text Send Message","binding missing for claude::click claude --text Stop generating","binding missing for claude::mow claude --step 40 --layer 0","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::click claude --text More options","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::click claude --text More options for Short haiku request","binding missing for claude::click claude --text Star","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::mow claude","binding missing for claude::click claude --text Personalizar --register open-customize","binding missing for claude::click claude --text Proyectos --register open-projects","binding missing for claude::click claude --text Customize --register open-customize","binding missing for claude::mow claude","binding missing for claude::click claude --text Settings --register open-settings","binding missing for claude::mow claude","binding missing for claude::click claude --text Web search --register toggle-web-search","binding missing for claude::click claude --text Back --register go-back-nav","binding missing for claude::click claude --text Add files, connectors, and more --register open-attach-menu","binding missing for claude::mow claude","binding missing for claude::click claude --text Web search --register toggle-web-search --verify-gone Web search","binding missing for claude::click claude --text Web --register toggle-web-search","binding missing for claude::mow claude","binding missing for claude::click claude --text Add skill --register add-skill","binding missing for claude::click claude --text Add custom connector --register add-custom-connector","binding missing for claude::click claude --text Start a new project --register start-new-project","binding missing for claude::click claude --text Haiku --register select-model-haiku","binding missing for claude::click claude --text Model: --register open-model-menu","binding missing for claude::mow claude","binding missing for claude::click claude --text Close","binding missing for claude::click claude --text Claude --register go-home","binding missing for claude::click claude --text New conversation --register new-chat-claude","binding missing for claude::click claude --text Nueva --register new-chat-claude","binding missing for claude::mow claude","binding missing for claude::click claude --text Sonnet 4.6 --register select-model-sonnet","binding missing for claude::click claude --text More models --register open-more-models","binding missing for claude::mow claude","binding missing for claude::click claude --text Close","binding missing for claude::read-discovery"]', 1783009823026, 48),
  (70, 'capability-map', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\deepseek\capability-map.json', 9, 9, 0, '[]', 1783009823045, 17),
  (71, 'holes', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\deepseek\holes.json', 9, 9, 0, '[]', 1783009823075, 28),
  (72, 'observations', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\deepseek\observations.jsonl', 3, 0, 3, '["binding missing for deepseek::mow deepseek --step 30 --layer 0 --port 9225","binding missing for deepseek::mow deepseek --step 30 --port 9225","binding missing for deepseek::mow deepseek --step 30 --port 9225"]', 1783009823091, 1),
  (73, 'capability-map', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\gemini\capability-map.json', 138, 138, 0, '[]', 1783009823473, 380),
  (74, 'holes', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\gemini\holes.json', 121, 121, 0, '[]', 1783009823716, 242),
  (75, 'observations', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\gemini\observations.jsonl', 6, 0, 6, '["binding missing for gemini::mow gemini --step 30 --layer 0 --port 9222","binding missing for gemini::mow gemini --step 30 --layer 0 --port 9222","binding missing for gemini::mow gemini --step 25 --port 9222","binding missing for gemini::mow gemini --step 20 --layer 1 --port 9222","binding missing for gemini::mow gemini --step 25 --port 9222","binding missing for gemini::mow gemini"]', 1783009823718, 0),
  (76, 'taxonomy-globals', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\taxonomy\globals.json', 201, 201, 0, '[]', 1783298499846, 427),
  (77, 'actions', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\actions.json', 104, 208, 0, '[]', 1783298500551, 702),
  (78, 'outcomes', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\learning\outcomes.jsonl', 882, 613, 268, '["binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for claude::new-chat","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for deepseek::send-text","binding missing for deepseek::send-text","binding missing for deepseek::send-text","binding missing for deepseek::send-text","binding missing for deepseek::send-text","binding missing for deepseek::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text","binding missing for chatgpt::send-text"]', 1783298501634, 1081),
  (79, 'capability-map', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\chatgpt\capability-map.json', 99, 99, 0, '[]', 1783298501811, 174),
  (80, 'holes', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\chatgpt\holes.json', 180, 180, 0, '[]', 1783298502133, 321),
  (81, 'observations', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\chatgpt\observations.jsonl', 10, 4, 6, '["binding missing for chatgpt::read-discovery","binding missing for chatgpt::mow chatgpt --step 30 --layer 0 --port 9223","binding missing for chatgpt::mow chatgpt --step 25 --port 9223","binding missing for chatgpt::read-discovery","binding missing for chatgpt::mow chatgpt --step 25 --port 9223","binding missing for chatgpt::mow chatgpt"]', 1783298502141, 7),
  (82, 'capability-map', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\claude\capability-map.json', 30, 30, 0, '[]', 1783298502193, 50),
  (83, 'holes', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\claude\holes.json', 316, 316, 0, '[]', 1783298502798, 602),
  (84, 'observations', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\claude\observations.jsonl', 174, 11, 163, '["binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 40 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 40 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude","binding missing for claude::mow claude","binding missing for claude::mow claude","binding missing for claude::click claude --text Simple prime number checker","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 25 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::click claude --text Add files","binding missing for claude::mow claude --step 25 --layer 1","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 20 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 15 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::click claude --text Model: Haiku","binding missing for claude::click claude --text Sonnet","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 15 --layer 2","binding missing for claude::click claude --text Model: Haiku","binding missing for claude::click claude --text More models","binding missing for claude::mow claude --step 15 --layer 2","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 40 --layer 0","binding missing for claude::read-discovery","binding missing for claude::read-discovery","binding missing for claude::click claude --text Settings","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::click claude --text Go back","binding missing for claude::mow claude --step 30","binding missing for claude::mow claude --step 40","binding missing for claude::read-discovery","binding missing for claude::mow claude --step 60","binding missing for claude::mow claude --step 80","binding missing for claude::mow claude","binding missing for claude::click claude --text Thinking","binding missing for claude::click claude --text Model: Haiku 4.5 Extended","binding missing for claude::click claude --text Haiku 4.5 Extended","binding missing for claude::click claude --text Send Message","binding missing for claude::click claude --text Thought process","binding missing for claude::click claude --text Thought process","binding missing for claude::click claude --text Send Message","binding missing for claude::click claude --text Copy","binding missing for claude::click claude --text Retry","binding missing for claude::click claude --text Read aloud","binding missing for claude::click claude --text Clear composer","binding missing for claude::click claude --text Go back","binding missing for claude::click claude --text Stop generating","binding missing for claude::click claude --text Send Message","binding missing for claude::click claude --text Stop generating","binding missing for claude::mow claude --step 40 --layer 0","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::click claude --text More options","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::click claude --text More options for Short haiku request","binding missing for claude::click claude --text Star","binding missing for claude::mow claude --step 30 --layer 0","binding missing for claude::mow claude","binding missing for claude::click claude --text Personalizar --register open-customize","binding missing for claude::click claude --text Proyectos --register open-projects","binding missing for claude::click claude --text Customize --register open-customize","binding missing for claude::mow claude","binding missing for claude::click claude --text Settings --register open-settings","binding missing for claude::mow claude","binding missing for claude::click claude --text Web search --register toggle-web-search","binding missing for claude::click claude --text Back --register go-back-nav","binding missing for claude::click claude --text Add files, connectors, and more --register open-attach-menu","binding missing for claude::mow claude","binding missing for claude::click claude --text Web search --register toggle-web-search --verify-gone Web search","binding missing for claude::click claude --text Web --register toggle-web-search","binding missing for claude::mow claude","binding missing for claude::click claude --text Add skill --register add-skill","binding missing for claude::click claude --text Add custom connector --register add-custom-connector","binding missing for claude::click claude --text Start a new project --register start-new-project","binding missing for claude::click claude --text Haiku --register select-model-haiku","binding missing for claude::click claude --text Model: --register open-model-menu","binding missing for claude::mow claude","binding missing for claude::click claude --text Close","binding missing for claude::click claude --text Claude --register go-home","binding missing for claude::click claude --text New conversation --register new-chat-claude","binding missing for claude::click claude --text Nueva --register new-chat-claude","binding missing for claude::mow claude","binding missing for claude::click claude --text Sonnet 4.6 --register select-model-sonnet","binding missing for claude::click claude --text More models --register open-more-models","binding missing for claude::mow claude","binding missing for claude::click claude --text Close","binding missing for claude::read-discovery"]', 1783298502826, 27),
  (85, 'capability-map', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\deepseek\capability-map.json', 9, 9, 0, '[]', 1783298502847, 18),
  (86, 'holes', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\deepseek\holes.json', 9, 9, 0, '[]', 1783298502874, 26),
  (87, 'observations', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\deepseek\observations.jsonl', 3, 0, 3, '["binding missing for deepseek::mow deepseek --step 30 --layer 0 --port 9225","binding missing for deepseek::mow deepseek --step 30 --port 9225","binding missing for deepseek::mow deepseek --step 30 --port 9225"]', 1783298502876, 1),
  (88, 'capability-map', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\gemini\capability-map.json', 138, 138, 0, '[]', 1783298503141, 263),
  (89, 'holes', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\gemini\holes.json', 121, 121, 0, '[]', 1783298503363, 219),
  (90, 'observations', 'C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\data\providers\gemini\observations.jsonl', 6, 0, 6, '["binding missing for gemini::mow gemini --step 30 --layer 0 --port 9222","binding missing for gemini::mow gemini --step 30 --layer 0 --port 9222","binding missing for gemini::mow gemini --step 25 --port 9222","binding missing for gemini::mow gemini --step 20 --layer 1 --port 9222","binding missing for gemini::mow gemini --step 25 --port 9222","binding missing for gemini::mow gemini"]', 1783298503366, 1);

-- outcome: 629 rows
INSERT INTO "outcome" ("id", "ts", "binding_id", "program_id", "ok", "duration_ms", "error", "observation", "schema_version", "strategy_id", "ttft_ms", "total_ms", "blocks_json") VALUES
  ('o:b555253a7d29ec3a', 1782410136962, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:ecae4f08cd5fc341', 1782410137413, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"button\"][aria-label=\"Open sidebar\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:5be0acddeeb45d3d', 1782410551442, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:fd07a38b7dab3092', 1782410551612, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:3201c12a79803fef', 1782410860534, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:b287b411084e21b1', 1782410860677, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:f4621bade4daecf1', 1782411082439, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:4db4c75b9e769ca1', 1782411082566, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:146059ed087325d7', 1782411413977, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:79fa673e43a7c02f', 1782411414097, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:fad0a6a5fc6b8ac7', 1782411854298, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:db672d90a4d0fff3', 1782411855033, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:b89922f0ddb4c207', 1782417672815, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:f53d349db4f9f2e1', 1782417673454, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:ff0eec9a1a18d032', 1782418251256, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:a10909392df5c1be', 1782418251628, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:da0966ae5ca33e47', 1782418301846, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:be2add098d6110b7', 1782418307066, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:d18efa43d68c63b2', 1782418355078, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:530f3e34c140be5e', 1782418364239, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:2384818780ee3c15', 1782418416787, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:c88072a2e9a49425', 1782418417344, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:f705b914e255dcae', 1782418491242, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:8a0730b40a8e7f5f', 1782418495074, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:95ad2588bddab6b3', 1782418548679, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:869e6aa642cb450f', 1782418548795, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:1368f97f060c96bb', 1782418633333, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:5feeeb03608f1f24', 1782418633593, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:5a28570e811e992a', 1782418727157, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:f5196bcc647efb90', 1782418727403, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:9f647f56fbd1c9ef', 1782419260419, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:67947be126cdf996', 1782419260515, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:bd48d0d205684a4c', 1782419313785, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:5965aaf3d42dbe40', 1782419313828, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:4238323af025de81', 1782419358223, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:1933662df09d055f', 1782419358294, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:c8e6744b406d86b9', 1782419454502, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:a28c5a0f805071d3', 1782419454619, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:54b37e8f981ea766', 1782419476839, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:0679231446ec8bf4', 1782419477020, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:169f8260b7b406a7', 1782419510042, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:9364e33e0ff528de', 1782419510330, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:59715ee59707a4dc', 1782419570415, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:8d93aaa7cc142f80', 1782419570601, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:f65b5b3d328ca7b7', 1782419625278, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:afb2fa8f3b61c9e1', 1782419625425, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:10ab04687d8338c4', 1782420311132, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:5fadf802c66aaf43', 1782420311498, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:7295272a25778b5b', 1782420340145, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:ac6558949a78fa3f', 1782420340448, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:b7506aed668bf76c', 1782420390135, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:4caf7b7434b99d5e', 1782420390584, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:3769cb52215bf01b', 1782421305441, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Search projects\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:062860be82bcb114', 1782421305619, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Search projects\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:ba7ef8ee9c0b83d7', 1782421347549, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Search projects\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:c9573956b5c7b3d6', 1782421347669, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Search projects\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:359b254229818761', 1782421391992, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Search projects\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:f096f03c4d024280', 1782421392588, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Search projects\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:ef6ce7f7ad8c5452', 1782421550170, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:a7e59f69e1ef503d', 1782421551853, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:129f44a57fdd7bc7', 1782421568602, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:eedff2a82a60c9e8', 1782421568730, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:a9a87103babc7f90', 1782421618529, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:4a2d20cf9d216c88', 1782421618707, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:23384b4fc4bbe12a', 1782421734110, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:409a7f5b93701799', 1782421735275, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:d80c90e5d074930c', 1782421757525, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:eb7e4d3963dccb24', 1782421757694, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:26963417fe0f0c34', 1782421826513, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:635cc93deaa890d4', 1782421832049, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:ae1dc5ef450d695e', 1782421903662, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:911ba79f3a2efca4', 1782421905846, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:e55eacb0454c1e0b', 1782421906751, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:28607ad8731a0ebd', 1782421909371, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:7f9d18cf1aeb5c81', 1782421953875, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:f06d55fbe41ae53b', 1782421954421, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:5008df7e035c0dbe', 1782422509418, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:ff419a7943455d7a', 1782422510100, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:731052c1627f0438', 1782422544668, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:b50f932c8e8c32ed', 1782422546370, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:ef369732d2921ae5', 1782422591278, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:5efd0470bc5c086a', 1782422591556, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:fd4b3c2b408793f9', 1782422694033, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:c9424e29d046cfef', 1782422695514, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:cdd6483ece24e049', 1782422737521, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:d8fa9514195c3ce7', 1782422738432, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:289c50f8b1b19127', 1782422788247, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:4b79b59f85894d39', 1782422789308, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:669542a3c1e31bc6', 1782423176476, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:89ee43a6b0af6bf7', 1782423177015, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:651d1eb7a94e108f', 1782423339944, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:359a21d9c9dc9241', 1782423341132, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:34683baa20957d8f', 1782424346823, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:27f92676541637a7', 1782424347771, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:9990e8faf716d384', 1782424370319, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:f2a703b81faef1a3', 1782424370588, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:773d80651cb0f8a9', 1782424409867, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:cbc7dedeb1c2f737', 1782424410140, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:f8af621900bb9e16', 1782425185170, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:b85d1e7b9687b50a', 1782425185855, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL);
INSERT INTO "outcome" ("id", "ts", "binding_id", "program_id", "ok", "duration_ms", "error", "observation", "schema_version", "strategy_id", "ttft_ms", "total_ms", "blocks_json") VALUES
  ('o:f9dac87675adeb26', 1782425230309, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:b884c918f1d6db61', 1782425230655, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:cce0ece5775bcae5', 1782426740083, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:cbb3ea32434904dd', 1782426741493, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:23e58b78e6521528', 1782426901013, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:fc8c596f594f9bcb', 1782426901281, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:8f40f41b8e5b1009', 1782426925328, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:56f360f6841a844f', 1782426925552, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:1041fbb346d95953', 1782427012784, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:d36a02c18e538816', 1782427014871, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:b794d4c443716573', 1782428538584, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:29f6c80a53937b1d', 1782428557720, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:8bb1ad838162bb5b', 1782428885059, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 0, 0, 'No textbox element found', '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:69461c72e1bbe800', 1782428892579, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 0, 0, 'No textbox element found', '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:1cd24a5c3a9eb6ea', 1782428901252, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 0, 0, 'No textbox element found', '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:489cfd65885647dc', 1782428940781, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:0be0b8ae6c30b12e', 1782428940913, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:d34497276b9a500d', 1782429107767, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:5d45e0a73ef3ddae', 1782429108008, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:9dc0e953a031f3c0', 1782429126738, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:3933df7b8b45c438', 1782429127044, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:344aef75ee9a1070', 1782429161467, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:57109d010ebe5eb1', 1782429161812, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:cd1fa1d2a75123e9', 1782429318008, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:c12c161bfda245e4', 1782429318413, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:354e98bfb3e4b77e', 1782429346903, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:57c05cb2578b8125', 1782429347112, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:6e24facb0bceec72', 1782430882894, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Search projects\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:85dd092e70bf4d2a', 1782430883358, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Search projects\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:4b9afd30cb98ea97', 1782430915869, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Search projects\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:032e3624f1443e86', 1782430916029, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Search projects\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:0df7385a36d9941a', 1782430989139, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:e3237ff9b16ed0f2', 1782430989496, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:e572aa677d1fb36f', 1782431023595, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:c1d4b965ee2011e1', 1782431023975, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:738f73863455e4db', 1782431062473, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:fb5911ccf01b688b', 1782431062782, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:6adb6631478e8bf1', 1782431622699, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:bf5620c4977c42a8', 1782431623657, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:1cc40226c6b26efe', 1782431708626, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:742c92bf8b44b12e', 1782431709588, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:0b6562ced9ad9c30', 1782431767281, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:b886d0f870ef44b3', 1782431767614, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:92006a17164d48f3', 1782431856663, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:3c59c9026a14dd9d', 1782431857413, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:d818c069293258ec', 1782431886156, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:65d69e03662998ad', 1782431886701, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:863f462bf279f171', 1782431980672, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:68d86abafadee1ca', 1782431981066, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:e0be7bf236213235', 1782432015535, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:75ef9448bd784e4d', 1782432015951, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:42af543f5c584898', 1782432086059, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:9ff90cd229aa2353', 1782432086627, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:db68ddc5195d21fe', 1782432134313, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:a331ff5293f9fdfb', 1782432134572, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:ca2d2fb40ef327f4', 1782433417107, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:759c74846aafb3d4', 1782433419433, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:d796385610906d06', 1782433432155, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:fd4c31826b305461', 1782433432827, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:b299e4f25b215fad', 1782433446003, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:b22c3552484aad78', 1782433446697, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:d45de61d4d09c39e', 1782433459393, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:5175fe7cfb301937', 1782433460895, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:d501f629c04721c2', 1782433473804, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:1ba8bbf3bbaa8866', 1782433474549, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:5bc706d0a314ad17', 1782433511479, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:9d6b34994c7689e2', 1782433512435, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:aec2210d6e4f779b', 1782433535811, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:dc20c3eb685e5ac4', 1782433537357, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:1ba89e0247958daa', 1782433600268, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:efa3adc26f04689a', 1782433600560, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:7f31f8af476a3652', 1782433614673, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:f2d7755eb9f26dd4', 1782433614888, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:254c6069f4df2819', 1782433627500, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:37adc8ea79c8c914', 1782433627666, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:3baae87283d5fa8a', 1782433640331, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:2b3d5ce670099f13', 1782433640502, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:5b39041205c9abef', 1782433653231, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:a95b75cc8c82c899', 1782433653431, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:20c228a4e1458388', 1782433666141, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:8dc43d35d14f3316', 1782433666516, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:316c4549f8f88360', 1782433679260, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:adfac0c3738fabfa', 1782433679437, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:aebe18f2e21bc61c', 1782433692006, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:c3e40fcbce5a4d1d', 1782433692351, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:00b2d30de1524d68', 1782433885558, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:3ded430b5485e859', 1782433886818, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:fc9aea9b199f4513', 1782433925398, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:457cafb986529fdc', 1782433925932, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:69dcdf7fb3724046', 1782434736162, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Enter a prompt for Gemini\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:9c2b0c18c3b9c512', 1782434738707, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"button\"][aria-label=\"Open menu for conversation actions.\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:4b7fc0f778e72656', 1782434753400, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Enter a prompt for Gemini\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:0cf2dd396a331760', 1782434754118, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"button\"][aria-label=\"Open menu for conversation actions.\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:84bdecf3c212f1cf', 1782436814653, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:b04184eecfd84eec', 1782436815089, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:682accbf44a0762c', 1782446531541, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Search projects\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:cff45d8ab90e90a6', 1782446531672, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Search projects\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:39abebac175a9cc3', 1782446543919, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Search projects\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:1750751d3382625b', 1782446544017, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Search projects\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:c6fdf0b496ab7f9a', 1782446556146, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Search projects\"]"}', 1, NULL, NULL, NULL, NULL);
INSERT INTO "outcome" ("id", "ts", "binding_id", "program_id", "ok", "duration_ms", "error", "observation", "schema_version", "strategy_id", "ttft_ms", "total_ms", "blocks_json") VALUES
  ('o:b3b0e1c0712b8a10', 1782446556238, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Search projects\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:36c4db7e529d46c0', 1782446568412, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Search projects\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:8f99e6b1753c3c3d', 1782446568486, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Search projects\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:f8a1867d00c8e268', 1782446577747, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Enter a prompt for Gemini\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:c06b5a8f428a5d40', 1782446578346, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"button\"][aria-label=\"Open menu for conversation actions.\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:292d6fff35db5866', 1782446580596, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Search projects\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:824ed2a77af83b96', 1782446580679, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Search projects\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:377edb7e5a08582e', 1782446590862, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Enter a prompt for Gemini\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:009ad4eff1fc47b6', 1782446591228, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"button\"][aria-label=\"Open menu for conversation actions.\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:4b8262e015ed9b10', 1782446592783, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Search projects\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:d9783eb3e2ab7522', 1782446592877, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Search projects\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:db12a474f3c46503', 1782446603832, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Enter a prompt for Gemini\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:ac00de1f6da071fa', 1782446604138, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"button\"][aria-label=\"Open menu for conversation actions.\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:1cba8a18ac585e61', 1782446604984, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Search projects\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:ee3444f0352bfccf', 1782446605076, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Search projects\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:91f613e8ada610d7', 1782446616778, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Enter a prompt for Gemini\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:954ab8a6c11d899d', 1782446617024, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"button\"][aria-label=\"Open menu for conversation actions.\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:7c0dd452e17b9da5', 1782446617232, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Search projects\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:dde8ef1214a5a975', 1782446617330, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Search projects\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:90b58e146a7ab095', 1782446629745, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Enter a prompt for Gemini\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:36a01331fe9870ec', 1782446630041, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"button\"][aria-label=\"Open menu for conversation actions.\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:8df1574b983efe53', 1782446681739, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Enter a prompt for Gemini\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:79a5a236d67ce41c', 1782446682023, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"button\"][aria-label=\"Open menu for conversation actions.\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:9eb8c97d9e690633', 1782446694627, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Enter a prompt for Gemini\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:229fcf2e4b301d63', 1782446694833, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"button\"][aria-label=\"Open menu for conversation actions.\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:a46cd8a59e075d4c', 1782446704262, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Search projects\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:9ae1b4170a0360c8', 1782446704326, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Search projects\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:18eeb01c03bd30af', 1782446707389, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Enter a prompt for Gemini\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:3871a96f87991f43', 1782446707644, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"button\"][aria-label=\"Open menu for conversation actions.\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:77d14d77a2ca2d1f', 1782446720235, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Enter a prompt for Gemini\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:a9a135072c9d50fb', 1782446720483, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"button\"][aria-label=\"Open menu for conversation actions.\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:2a9a50b8acae1a28', 1782446733108, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Enter a prompt for Gemini\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:f5bad70e5c7b6a40', 1782446733395, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"button\"][aria-label=\"Open menu for conversation actions.\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:25abdaf174b673a3', 1782446746059, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Enter a prompt for Gemini\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:446010cbdcbbf21f', 1782446746274, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"button\"][aria-label=\"Open menu for conversation actions.\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:a1a8789544cd6c84', 1782446758823, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Enter a prompt for Gemini\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:ddf620b881af76d2', 1782446759061, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"button\"][aria-label=\"Open menu for conversation actions.\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:b1c8cb24ca66c066', 1782446771695, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Enter a prompt for Gemini\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:c6d7e3e55ce96ade', 1782446771914, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"button\"][aria-label=\"Open menu for conversation actions.\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:b392afc320e4aaca', 1782446784402, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Enter a prompt for Gemini\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:1ae0de907f6e263c', 1782446784651, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"button\"][aria-label=\"Open menu for conversation actions.\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:c5033c0121f9449d', 1782446797235, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Enter a prompt for Gemini\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:14abf14e839417fc', 1782446797476, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"button\"][aria-label=\"Open menu for conversation actions.\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:aab8f09f346f9b95', 1782446933500, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:2e3af129c97da904', 1782446933588, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:3687b6627b61026b', 1782447056764, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:a1b284672ad31a51', 1782447056854, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:7efee14231d2c86f', 1782447069189, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:a531262916200c59', 1782447069255, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:818934432cb661dd', 1782447081534, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:02d25c92bb90e86a', 1782447081601, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:5ea589378664f1aa', 1782447093852, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:1044852c95788d6a', 1782447093928, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:07d462fbd478410f', 1782447106218, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:e06edde200c0f85c', 1782447106304, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:909766c7f11dda0e', 1782447118582, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:afd46d5e2d7f815d', 1782447118682, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:2f131f9918c625d4', 1782447130958, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:cbbda283d56c7b78', 1782447131054, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:4653fd9507f2cd78', 1782447143351, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:aceae8d6786c6fa2', 1782447143458, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:83356c0429cd34c8', 1782447155753, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:2df4651230ebc656', 1782447155862, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:6c16328209fcc1d6', 1782447168124, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:964d16bc7512495b', 1782447168222, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:5f1925bcb09ed434', 1782462626225, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 0, 0, 'No textbox element found matching "Enter a prompt"', '{"selector":".ql-editor"}', 1, NULL, NULL, NULL, NULL),
  ('o:fedec61b5204adce', 1782462626357, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 0, 0, 'No textbox element found matching "Enter a prompt"', '{"selector":".ql-editor"}', 1, NULL, NULL, NULL, NULL),
  ('o:1d8c6232a4a48703', 1782462626495, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 0, 0, 'No textbox element found matching "Enter a prompt"', '{"selector":".ql-editor"}', 1, NULL, NULL, NULL, NULL),
  ('o:f763cd448198ae74', 1782462626610, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 0, 0, 'No textbox element found matching "Enter a prompt"', '{"selector":".ql-editor"}', 1, NULL, NULL, NULL, NULL),
  ('o:e68e97884f1ce7f8', 1782462626721, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 0, 0, 'No textbox element found matching "Enter a prompt"', '{"selector":".ql-editor"}', 1, NULL, NULL, NULL, NULL),
  ('o:45670c9720a79769', 1782462626835, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 0, 0, 'No textbox element found matching "Enter a prompt"', '{"selector":".ql-editor"}', 1, NULL, NULL, NULL, NULL),
  ('o:93d3c7b5cdc21c05', 1782462626927, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 0, 0, 'No textbox element found matching "Enter a prompt"', '{"selector":".ql-editor"}', 1, NULL, NULL, NULL, NULL),
  ('o:30a5c72270fba1c6', 1782462627021, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 0, 0, 'No textbox element found matching "Enter a prompt"', '{"selector":".ql-editor"}', 1, NULL, NULL, NULL, NULL),
  ('o:aaa22603754d5d2a', 1782470220629, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:6da014fdff165583', 1782470221735, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:aa356fde69b1f682', 1782470245095, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:371ccf3e26250e1b', 1782470245608, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:65a0876b0513f644', 1782472261394, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:aba6e166779091f2', 1782472261980, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 0, 0, 'No textbox element found', '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:d578093d249aee36', 1782475082759, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:46aaf3e474f3bd09', 1782475082836, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:b17702fb4f14ff08', 1782475218793, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:4a77e96ccd320bfa', 1782475218821, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:c10d87f901e9fdba', 1782475364069, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:35140e6f67e174d0', 1782475364102, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:809520d17ec3c36a', 1782475543869, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:fc18735b43951bb2', 1782475543904, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:29ee2bae8a8185c8', 1782476072868, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:63c8c9446e433241', 1782476072968, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:05ba845c0aa6f2e5', 1782476223228, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:001701e35d15bbfd', 1782476223335, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:bb8c6cff96515632', 1782482922513, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:cdacf65149b4234e', 1782482922829, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:4a0a2f582ba9917f', 1782482982532, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:e89a1f62839228da', 1782482982777, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:0ff43fe2b689ab06', 1782483099266, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:407443e777ed4bee', 1782483099382, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:d491a33c8f3618e5', 1782483156556, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:08576536efaed52e', 1782483156627, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:81d341285573e0ad', 1782485016270, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL);
INSERT INTO "outcome" ("id", "ts", "binding_id", "program_id", "ok", "duration_ms", "error", "observation", "schema_version", "strategy_id", "ttft_ms", "total_ms", "blocks_json") VALUES
  ('o:a002bc5a319d747c', 1782485016480, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:5d929439a8afa07d', 1782489992133, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:f542ada119755dc6', 1782489992262, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:41a5d4a1aea5748e', 1782490364192, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:bdb592eade3f7af1', 1782490364312, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:ab45bc0b8ca1beb0', 1782490591852, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:31ca8253663a900b', 1782490591972, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:2596d37da119ac96', 1782490764165, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:c5a0464632388c9b', 1782490764295, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:37d391d2cf16764c', 1782490914522, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:0a8c655bfbf376a1', 1782490914660, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:40688262b5ac208b', 1782491013329, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:9caefce06f8a03c4', 1782491013472, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:487defebbc908402', 1782491202560, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:98965ba461d241a6', 1782491202694, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:d93696457512e587', 1782491357887, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:794297e7863f87c5', 1782491358021, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:346af626c31aec49', 1782491543786, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 0, 0, 'No textbox element found matching "Enter a prompt"', '{"selector":".ql-editor"}', 1, NULL, NULL, NULL, NULL),
  ('o:7f4a869b1db60321', 1782491593650, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 0, 0, 'No textbox element found matching "Enter a prompt"', '{"selector":".ql-editor"}', 1, NULL, NULL, NULL, NULL),
  ('o:7a5cd79424cc1b1a', 1782491727078, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:672b20ecdf57878d', 1782491727156, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:888294bfe36cddce', 1782491906228, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:e699ecbb4df40765', 1782491906343, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:2b5ebfbb8fcfa944', 1782491912431, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:a44013c4b6ccbd04', 1782491912465, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:836970395711879a', 1782491926017, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:aa6c3ba55d8a09ae', 1782491926084, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:af285157b321faf3', 1782492182893, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:2858f04b88922ea3', 1782492183079, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:b3573ff87a5564e5', 1782492213264, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:ff6e21f12b082946', 1782492213313, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:5ef8cd8908f1dfe4', 1782492265041, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:545c1dc9eab9be55', 1782492265089, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:330e49675df8fe74', 1782492594380, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:87f4643474a8bd7b', 1782492594474, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:7041b33676285eda', 1782493016371, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:d4b7f3c8c83e435e', 1782493016452, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:3bad90647913a062', 1782493053432, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:2d2e91a95fcf44e8', 1782493053505, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:d2545734ee9cc98f', 1782493092054, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:65d0a7223af6ca62', 1782493092110, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:ac0b4fd177ddda14', 1782493309637, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:b50664cf994af4be', 1782493309714, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:f0f576b2c6c37027', 1782493406106, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:dbef73c4cb2191c8', 1782493406150, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:e9fd9eb0a2f8e009', 1782493436009, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:c76e15fb8f6fd2bb', 1782493436087, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:987f81b5eb1f94df', 1782493520785, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:c4de5533df9bae35', 1782493520856, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:d18beeb85c3cffec', 1782493566770, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:7b0851249f1fb435', 1782493566828, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:fd985402639a85a9', 1782493583939, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:d300a1df9a6c0795', 1782493583985, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:7f2bd9b06700ee40', 1782493891637, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:e996e8664c389d20', 1782493891778, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:5d46c1399a34efba', 1782494874417, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:f9ec729fcd86c2f4', 1782494874541, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:4b9366a6bc5d27b7', 1782505414159, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:3978aafc407a42a5', 1782505414904, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:5988d9bb5255c8ef', 1782505523651, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 0, 0, 'No textbox element found', '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:88b55991cb420e60', 1782505606252, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:c5f7af3faed18b94', 1782505606441, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:fe787cac0db4ff06', 1782506160917, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:1609b06b0dfe04a5', 1782506161211, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:f224dec8997f67cc', 1782509514929, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:9626b736a2124733', 1782509515179, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:a1365063d6456206', 1782509571380, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:8d93f0950f386568', 1782509571679, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:20db91bd21d0093f', 1782513054123, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:60283b154106aa05', 1782513054724, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:e5ac869c28cb277a', 1782513684459, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:a01f572d730b21ec', 1782513685111, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:8a216b87311022ce', 1782514699755, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:2028adaa4ad0da67', 1782514703280, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:5f0b0d76d2c3eb88', 1782516814244, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:e336e8494b80a2aa', 1782516814694, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:b397c6767c81efdd', 1782517192548, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:95a221d0078967de', 1782517192952, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Write your prompt to Claude\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:bfa2c9f5bd8eee8d', 1782519623122, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:e55ce16ee5c58127', 1782519623473, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:bf6d9ec46aadd0de', 1782520283967, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:3f07b8dd6ea1470e', 1782520284409, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:c32e835ce69b42e5', 1782523396982, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:e52aa7666fc6dfcb', 1782523397256, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:02cd6f48d262303f', 1782523628646, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:974d88fd22809db2', 1782523628789, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:0e26d85dd87a3a5b', 1782524003562, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:89a828f3707afd14', 1782524003824, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:0eccc6abfc22c61d', 1782563665882, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:615cb7afec99e963', 1782563665993, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:3513b6b72028ffa7', 1782567634684, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:42bfab4d6cdd37bf', 1782567635515, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:586771a91382b789', 1782567727131, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:f112670292a7ba49', 1782567727337, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:a90d0fdc61678049', 1782567886223, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:0dcb43caa7aa1ae6', 1782567886407, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:fbc7b79955b3374b', 1782568007843, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:19a1cf838ab4fc74', 1782568008131, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:81bab0944f6e482c', 1782568860784, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:5aeecf29ca94c1fc', 1782568861966, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL);
INSERT INTO "outcome" ("id", "ts", "binding_id", "program_id", "ok", "duration_ms", "error", "observation", "schema_version", "strategy_id", "ttft_ms", "total_ms", "blocks_json") VALUES
  ('o:3124bf78db7e39e2', 1782569668845, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:d0f1e74234a27e16', 1782569669081, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:46444009f0bb06b7', 1782569746552, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:100347e11369375e', 1782569746743, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:b882ac4b4e3b5df6', 1782569830165, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:29c7c26b8cf06531', 1782569830314, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:99d0072dd8443582', 1782577665068, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:8099b7fd4a57dad3', 1782577665354, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:ed3c398b85b5f642', 1782577764279, 'b:claude:select-model-haiku', 'p:mig-b_claude_select_model_haiku-v1', 1, 0, NULL, '{"selector":"button[aria-label*=''Model'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:98e6f3d82c3ed6b4', 1782577766633, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:6f8933070b736977', 1782577766687, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:b2787a117e644e03', 1782580188331, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:e518166bb544f4b8', 1782580188486, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":".ql-editor"}', 1, NULL, NULL, NULL, NULL),
  ('o:7f8de5f8ef005c1e', 1782580189603, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"button[aria-label*=\"Send\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:f5a400545df0d26f', 1782580189840, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:2ca6e96966d85133', 1782580462581, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":".ql-editor"}', 1, NULL, NULL, NULL, NULL),
  ('o:25ef97f3380b1c13', 1782580462695, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:fde0e4f5074490a1', 1782580463511, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"button[aria-label*=\"Send\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:3aa8c0bbeb49d2d9', 1782580466185, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:fdf1464875ac6b30', 1782580566883, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:a44c75cca880607e', 1782580567474, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":".ql-editor"}', 1, NULL, NULL, NULL, NULL),
  ('o:5a22f67ee3c5b7c7', 1782580568610, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"button[aria-label*=\"Send\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:6ba5bacfd7af7f22', 1782580568873, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:92029d324cf4bb90', 1782582009819, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":".ql-editor"}', 1, NULL, NULL, NULL, NULL),
  ('o:48a0b74eb5e3a9ed', 1782582010210, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"button[aria-label*=\"Send\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:2ab1cce46464063a', 1782583534380, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:d3c35451f96c42ed', 1782583535799, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:429f156c3b88da25', 1782583961695, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:adaade4147fe0f78', 1782583971225, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:78031d865d564416', 1782585311178, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":".ql-editor"}', 1, NULL, NULL, NULL, NULL),
  ('o:2b6bafe9f25f07b1', 1782585311565, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"button[aria-label*=\"Send\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:eedd6ef33043779f', 1782585312644, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:109308b7d82ad0e4', 1782585590301, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:3547cac530826398', 1782585595709, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:17e04b7c14e0a897', 1782585866707, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 0, 0, 'No textbox element found', '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:0604a16580f5dbc8', 1782586510220, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:4fddbf9b3a716c54', 1782586513074, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:45f60d9aab41415d', 1782593956948, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:c88884e36d03993d', 1782593957229, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:1ef78d37247942ff', 1782594198487, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:7481a5649031d4ee', 1782594199183, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:e3b7ac542c105839', 1782594304463, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:11db4f6c30ea769b', 1782594304876, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:d870c790f27f4d94', 1782594651804, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":".ql-editor"}', 1, NULL, NULL, NULL, NULL),
  ('o:0c2b7095493f0f81', 1782594652053, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"button[aria-label*=\"Send\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:bb422d9206667e5e', 1782594658090, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:3ac62fb953e9d27e', 1782594664729, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:a467f7eb87821c4a', 1782594818488, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":".ql-editor"}', 1, NULL, NULL, NULL, NULL),
  ('o:c1d8eb6ca31929b8', 1782594818770, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"button[aria-label*=\"Send\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:4dff767d08b249a9', 1782594840074, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:06635c641ed11fb2', 1782594842176, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:953e872ea0077e2d', 1782673841455, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:645814550642a232', 1782673841728, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:427592ffe4ddf1a9', 1782673846591, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:68eb529fa2084d09', 1782673846719, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:8f551b45e47b679b', 1782673851631, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:ba95b5b2474f50bd', 1782673851665, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:c853db744df84a35', 1782673851736, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:de01549b34a6161d', 1782673852237, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:f3933b3dc5d84e07', 1782673856668, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:5cdf2b835afdfbf2', 1782673856832, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:23590af89167001f', 1782673861871, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":".ql-editor"}', 1, NULL, NULL, NULL, NULL),
  ('o:468d2e9e22556f89', 1782673862043, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:848fb1d2f8876851', 1782673862216, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"button[aria-label*=\"Send\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:b3e91ad92cd9b582', 1782673862827, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:1c20bf9a8004ac88', 1782673866632, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:684e091c47cf7f1f', 1782673866788, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:910887a5380e3b4e', 1782673871713, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:9a8c7cf834b7d103', 1782673871823, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:bfc67c442d223787', 1782673871936, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":".ql-editor"}', 1, NULL, NULL, NULL, NULL),
  ('o:29d78cf2698c0df4', 1782673872064, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":".ql-editor"}', 1, NULL, NULL, NULL, NULL),
  ('o:661f590f8ae50ae0', 1782673873016, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"button\"][aria-label=\"Open menu for conversation actions.\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:f126519d29841eb3', 1782673873247, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"button\"][aria-label=\"Open menu for conversation actions.\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:e456a858220e75d9', 1782673876822, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:ffd31589c0e4f93b', 1782673876938, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":".ql-editor"}', 1, NULL, NULL, NULL, NULL),
  ('o:3180f2da0455707a', 1782673877239, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:386a50426630c4e5', 1782673877798, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"button\"][aria-label=\"Open menu for conversation actions.\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:1e21fa718c77f9f1', 1782673904828, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:aac5aa09389a3c62', 1782673904950, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:fc860e392206a6f8', 1782673935173, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:81bc0026aa72c43b', 1782673936414, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:a46db2fbd95f66f4', 1782673966478, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:c08acbb67313628a', 1782673966489, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:45baf25593dbf75a', 1782673966990, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:58dd03cba8f51d22', 1782673967027, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:c9d091a152a51aa5', 1782673994770, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:036c9b2901eb95e7', 1782673994892, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:a9d7179d5ef91d3a', 1782674144305, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:131153a6ade4b2a3', 1782674144664, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:245bc8b401791eff', 1782674148229, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:9eac0b0132961f74', 1782674148386, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:86c504a08fa98d65', 1782674153219, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:e14fed1abd132917', 1782674153444, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:f6bfc7bcd04baaf5', 1782674153452, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:0b894e1797b0d2f8', 1782674158142, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:9a6f8eb953f3b2b3', 1782674158238, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:57efaa4f06fe86d2', 1782674164148, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:965f521bc2b0c862', 1782674164257, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":".ql-editor"}', 1, NULL, NULL, NULL, NULL),
  ('o:163dba0dac6e13b3', 1782674164346, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:4961540e74e2e33e', 1782674165364, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"button\"][aria-label=\"Open menu for conversation actions.\"]"}', 1, NULL, NULL, NULL, NULL);
INSERT INTO "outcome" ("id", "ts", "binding_id", "program_id", "ok", "duration_ms", "error", "observation", "schema_version", "strategy_id", "ttft_ms", "total_ms", "blocks_json") VALUES
  ('o:5b6bc717d3e4a41d', 1782674169002, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:4528b0524faf8f69', 1782674169374, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:e1ab975c44718acb', 1782674173937, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:71ab6271ce87ea6c', 1782674174059, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":".ql-editor"}', 1, NULL, NULL, NULL, NULL),
  ('o:4913d99356b8bc00', 1782674174103, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":".ql-editor"}', 1, NULL, NULL, NULL, NULL),
  ('o:cba38e5fcea37aac', 1782674174151, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:a8bf8d669ac7592f', 1782674175223, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"button\"][aria-label=\"Open menu for conversation actions.\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:b82f943be2409124', 1782674175521, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"button\"][aria-label=\"Open menu for conversation actions.\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:dba8d4ffd1236d38', 1782674179232, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:51548563d49ac6f9', 1782674179302, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":".ql-editor"}', 1, NULL, NULL, NULL, NULL),
  ('o:f0602a21f814318b', 1782674179419, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:c2142afbcc40b26e', 1782674180964, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"button\"][aria-label=\"Open menu for conversation actions.\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:88aa587ea6ae0138', 1782674192019, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:afb610fac9b5507a', 1782674192228, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:425c753b2ce440e4', 1782674196683, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:59924dc9e911c05a', 1782674197080, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":".ql-editor"}', 1, NULL, NULL, NULL, NULL),
  ('o:748ea262a6724d05', 1782674197213, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:ebf5b7dd930701cd', 1782674198065, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"button\"][aria-label=\"Open menu for conversation actions.\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:06904caf7c81b0b5', 1782676197204, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:3de95c4d710b1331', 1782676197533, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:bbbe830533f89cab', 1782676227469, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:18db46e3795dcd04', 1782676227589, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:558a0974f89950db', 1782676257607, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:a742579d7b38f920', 1782676257694, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:2f7d945fecd4a0a3', 1782676257798, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:59f51bb118b0c306', 1782676257936, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:518e3c6ca487ff53', 1782676287470, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:6ffd8a3e9769239d', 1782676287772, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:e8aa2e0b0886432e', 1782676718778, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:baa2d950b750e508', 1782676718992, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:37d6b8519c216aed', 1782676734522, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:29f8b9685e658906', 1782676734616, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:2ce6324ab85b405d', 1782676748930, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:1932033d00ce2bd2', 1782676749037, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:b9f33cd589c4b784', 1782676749136, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:259dc1916a04b039', 1782676749194, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:e57e7f8a1ee45957', 1782676763674, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:376c80a66f7cb3ef', 1782676763948, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:b5ef8d87b13252ce', 1782676778954, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:c7adff7ec444a47d', 1782676778991, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":".ql-editor"}', 1, NULL, NULL, NULL, NULL),
  ('o:3503c4adab983f65', 1782676779138, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:ff321f2b49952e3b', 1782676780073, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"button\"][aria-label=\"Open menu for conversation actions.\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:1cdc3082f2075b59', 1782676793900, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:0faac406f73a9a4e', 1782676794054, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:48e7bb828a7562d9', 1782676808965, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:661461e76f1d201e', 1782676808984, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":".ql-editor"}', 1, NULL, NULL, NULL, NULL),
  ('o:cd196a17ba15bd08', 1782676808999, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":".ql-editor"}', 1, NULL, NULL, NULL, NULL),
  ('o:ef8d5f9966770ba8', 1782676809095, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:889cf2e15ed58e64', 1782676809831, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"button\"][aria-label=\"Open menu for conversation actions.\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:8b29a92f3c9a241e', 1782676810122, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"button\"][aria-label=\"Open menu for conversation actions.\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:30557b6550ee725b', 1782676824154, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:566ad504c6dde97c', 1782676824240, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":".ql-editor"}', 1, NULL, NULL, NULL, NULL),
  ('o:d0ccbaaa291c088a', 1782676824404, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:2816b4fcb3ee44c4', 1782676824991, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"button\"][aria-label=\"Open menu for conversation actions.\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:f4340ad6c89ac4be', 1782678431121, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:947a5555d53c9a4e', 1782678431500, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:95d98d66f9d28db3', 1782678491183, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:3babc609d08a5e41', 1782678491197, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":".ql-editor"}', 1, NULL, NULL, NULL, NULL),
  ('o:faf0f40ca5875e6b', 1782678491489, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:c6adcf9ec23d4b17', 1782678492132, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"button\"][aria-label=\"Open menu for conversation actions.\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:9e84786b52c6ae58', 1782754749420, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 0, 0, 'No textbox element found', '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:ba77fc19b4a16a55', 1782755099853, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:f4b0a9ae98c811d5', 1782755102421, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 0, 0, 'No textbox element found', '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:75ed1dbd98a81ec9', 1782756034438, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":".ql-editor"}', 1, NULL, NULL, NULL, NULL),
  ('o:a17d629d715bcc08', 1782756037279, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"button[aria-label*=\"Send\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:0ec56f9e78b4006b', 1782756524322, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:abc95d8e7f429171', 1782756524880, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:ea8b92e508e61e92', 1782756529267, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":".ql-editor"}', 1, NULL, NULL, NULL, NULL),
  ('o:0b80b79f046cfc75', 1782756529988, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"button[aria-label*=\"Send\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:4c837e000fdefbac', 1782756574642, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:a26ab2f1c26b031e', 1782756577017, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 0, 0, 'No textbox element found', '{"selector":"[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:b7db8ad87ddb68c6', 1782757963589, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:7c5c8abf8deda55a', 1782757965849, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 0, 0, 'No textbox element found', '{"selector":"[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:704ee2c285748133', 1782757986316, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":".ql-editor"}', 1, NULL, NULL, NULL, NULL),
  ('o:c1cc531e956a0489', 1782757986533, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"button[aria-label*=\"Send\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:261b3bfa54fe3649', 1782758123865, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:a292413d7949af02', 1782758125218, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 0, 0, 'No textbox element found', '{"selector":"[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:1d5666e1ff8660ad', 1782758145670, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":".ql-editor"}', 1, NULL, NULL, NULL, NULL),
  ('o:16183b47fe15be90', 1782758146043, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"button[aria-label*=\"Send\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:95da1e93d1ac37e9', 1782758260241, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:c157eaa4b6e7213c', 1782758260973, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 0, 0, 'No textbox element found', '{"selector":"[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:4cf55745d95d82e7', 1782758283493, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":".ql-editor"}', 1, NULL, NULL, NULL, NULL),
  ('o:d3df2935e7889c7a', 1782758283865, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"button[aria-label*=\"Send\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:a23efd7830f05864', 1782759250992, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:e4648fbc81e454c1', 1782759251235, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:9177aa3b9a215d18', 1782759279198, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:d3c845e8afc15bcc', 1782759279397, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:b831b80e5f8e86b4', 1782761148599, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:69b9fd9c961e8788', 1782761148827, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:fe9aceb5b1b7e3ec', 1782761305332, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:7f9e2528033894a3', 1782761305837, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:ce5678f503e53571', 1782763760541, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Enter a prompt for Gemini\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:1041939956e09b80', 1782763761494, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"button\"][aria-label=\"Sign in\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:570e2360e973dc8f', 1782764142761, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:9ed3d47b18565171', 1782764214748, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Enter a prompt for Gemini\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:5c4ea39345edb4e1', 1782764216671, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"button\"][aria-label=\"Sign in\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:4d92efaceb37e4ea', 1782764231367, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:9f8a42a36346b711', 1782764273804, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:f497d5a43ddf58a0', 1782765368049, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:6696ab21d4c41951', 1782765465407, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Enter a prompt for Gemini\"]"}', 1, NULL, NULL, NULL, NULL);
INSERT INTO "outcome" ("id", "ts", "binding_id", "program_id", "ok", "duration_ms", "error", "observation", "schema_version", "strategy_id", "ttft_ms", "total_ms", "blocks_json") VALUES
  ('o:b76c3ddad1858d82', 1782765466051, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"button\"][aria-label=\"Sign in\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:0bbf60c973a198cc', 1782767158809, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:f102ea146df4f92a', 1782767244644, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Enter a prompt for Gemini\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:4a08ae6a8177f5a4', 1782767245075, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"button\"][aria-label=\"Sign in\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:ae7b6cd69f22df5d', 1782767356800, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 0, 0, 'No textbox element found', '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:dbf4008310594618', 1782767396706, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Enter a prompt for Gemini\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:366b4bf1f5919882', 1782767397369, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"button\"][aria-label=\"Sign in\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:e5248c4e5dd9362f', 1782767668567, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 0, 0, 'No textbox element found', '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:89cf5a13709d1d65', 1782768097826, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:18e89ecdc266ae26', 1782768164075, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:8106124bdc6dae90', 1782768254434, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"textbox\"][aria-label=\"Enter a prompt for Gemini\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:c52ec89f8449b115', 1782768257611, 'b:gemini:send-prompt', 'p:mig-b_gemini_send_prompt-v1', 1, 0, NULL, '{"selector":"[role=\"button\"][aria-label=\"Sign in\"]"}', 1, NULL, NULL, NULL, NULL),
  ('o:773c25b7e7743f8b', 1782810958069, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"selector":"div[contenteditable=''true'']"}', 1, NULL, NULL, NULL, NULL),
  ('o:9b51125630a29f75', 1782564148506, 'b:chatgpt:new-chat', 'p:mig-b_chatgpt_new_chat-v1', 1, 0, NULL, '{"matched":true,"label":"New chat"}', 1, NULL, NULL, NULL, NULL),
  ('o:88b6bf14baa28051', 1782580356845, 'b:chatgpt:new-chat', 'p:mig-b_chatgpt_new_chat-v1', 1, 0, NULL, '{"matched":true,"label":"New chat"}', 1, NULL, NULL, NULL, NULL),
  ('o:b555a2eaa8aa594e', 1782580445418, 'b:chatgpt:new-chat', 'p:mig-b_chatgpt_new_chat-v1', 1, 0, NULL, '{"matched":true,"label":"New chat"}', 1, NULL, NULL, NULL, NULL),
  ('o:2fc4334e874190be', 1782769535014, 'b:chatgpt:attach-file', 'p:mig-b_chatgpt_attach_file-v1', 1, 0, NULL, '{"matched":true,"label":"Chat with ChatGPT"}', 1, NULL, NULL, NULL, NULL),
  ('o:cc1de0389e98ad70', 1782368514311, 'b:claude:use-memory-ai-chat', 'p:mig-b_claude_use_memory_ai_chat-v1', 0, 0, 'target mismatch: ?', '{"matched":false,"label":null}', 1, NULL, NULL, NULL, NULL),
  ('o:144f0d9daaf2faf8', 1782487726665, 'b:claude:add-files-connectors-and-more', 'p:mig-b_claude_add_files_connectors_and_more-v1', 1, 0, NULL, '{"matched":true,"label":"Add files, connectors, and more"}', 1, NULL, NULL, NULL, NULL),
  ('o:6602c9ccb7c31f5c', 1782523456619, 'b:claude:expand-composer', 'p:mig-b_claude_expand_composer-v1', 1, 0, NULL, '{"matched":true,"label":"Write your prompt to Claude"}', 1, NULL, NULL, NULL, NULL),
  ('o:ac6955891fddca7a', 1782523464626, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 1, 0, NULL, '{"matched":true,"label":"Chrome extensions for Claude AI promptsChrome extensions for"}', 1, NULL, NULL, NULL, NULL),
  ('o:c8867855d39ba52f', 1782523576051, 'b:claude:model-sonnet-46-low', 'p:mig-b_claude_model_sonnet_46_low-v1', 0, 0, 'target mismatch: ?', '{"matched":false,"label":null}', 1, NULL, NULL, NULL, NULL),
  ('o:233e976a06a1d7b0', 1782523582813, 'b:claude:model-haiku-45-extended', 'p:mig-b_claude_model_haiku_45_extended-v1', 1, 0, NULL, '{"matched":true,"label":"Model: Haiku 4.5 Extended"}', 1, NULL, NULL, NULL, NULL),
  ('o:742b809d73fdb32a', 1782523587612, 'b:claude:model-haiku-45-extended', 'p:mig-b_claude_model_haiku_45_extended-v1', 1, 0, NULL, '{"matched":true,"label":"Model: Haiku 4.5 Extended"}', 1, NULL, NULL, NULL, NULL),
  ('o:46d91f136209aa39', 1782523600598, 'b:claude:clear-composer', 'p:mig-b_claude_clear_composer-v1', 0, 0, 'target mismatch: ?', '{"matched":false,"label":null}', 1, NULL, NULL, NULL, NULL),
  ('o:8533967513d24736', 1782523613575, 'b:claude:mention-file', 'p:mig-b_claude_mention_file-v1', 1, 0, NULL, '{"matched":true,"label":"Write your prompt to Claude"}', 1, NULL, NULL, NULL, NULL),
  ('o:8fa3fa286b9a3047', 1782594623080, 'b:claude:expand-composer', 'p:mig-b_claude_expand_composer-v1', 1, 0, NULL, '{"matched":true,"label":"Write your prompt to Claude"}', 1, NULL, NULL, NULL, NULL),
  ('o:7d746daf54dc6f1a', 1782594624945, 'b:claude:expand-composer', 'p:mig-b_claude_expand_composer-v1', 1, 0, NULL, '{"matched":true,"label":"Write your prompt to Claude"}', 1, NULL, NULL, NULL, NULL),
  ('o:58a8cac1-f1f9-4c98-8dff-fc4aa1fba903', 1783092690385, 'b:claude:send-prompt', 'p:mig-b_claude_send_prompt-v1', 0, 94, NULL, NULL, 1, NULL, NULL, 94, '[]');

-- pattern: (empty)

-- profile_session: (empty)

-- provider: 7 rows
INSERT INTO "provider" ("id", "display_name", "landing_url", "ready_selector", "composer_selector", "composer_is_contenteditable", "stream_url_pattern", "stream_transport", "stream_terminal", "sse_format", "locale", "locale_variants", "warmup_ms", "headless_settle_ms", "rate_limit_per_minute", "tier", "status", "config", "version", "created_at", "updated_at") VALUES
  ('chatgpt', 'ChatGPT', 'https://chatgpt.com/', '#prompt-textarea, .ProseMirror', '#prompt-textarea', 0, 'backend-api/conversation', 'sse', '[DONE]', 'openai', NULL, '{}', 0, 0, NULL, 'standard', 'active', '{}', 1, 1782868069000, 1782868069000),
  ('claude', 'Claude', 'https://claude.ai/new', 'div[contenteditable="true"], fieldset textarea', 'div[contenteditable="true"]', 1, 'claude.ai/api', 'sse', 'message_stop', 'anthropic', 'en', '{"New chat": "Nueva conversación", "Projects": "Proyectos"}', 0, 0, NULL, 'premium', 'active', '{}', 1, 1782868069000, 1782868069000),
  ('deepseek', 'DeepSeek', 'https://chat.deepseek.com/', 'textarea', 'textarea', 0, 'deepseek.com', 'sse', '[DONE]', 'openai', NULL, '{}', 0, 0, NULL, 'economy', 'active', '{}', 1, 1782868069000, 1782868069000),
  ('gemini', 'Gemini', 'https://gemini.google.com/app', '.ql-editor, rich-textarea .ql-editor', '.ql-editor', 1, 'batchexecute', 'batchexecute', '[["e"', 'google', NULL, '{}', 0, 0, NULL, 'premium', 'active', '{}', 1, 1782868069000, 1782868069000),
  ('studio-ai', 'AI Studio', 'https://aistudio.google.com/', 'textarea, [role="textbox"]', 'textarea, [role="textbox"]', 0, 'aistudio.google.com', 'sse', '[DONE]', 'google-ai-studio', NULL, '{}', 0, 0, NULL, 'standard', 'active', '{}', 1, 1782868069000, 1782868069000),
  ('z-ai', 'Z.AI', 'https://chat.z.ai/', 'textarea, [role="textbox"]', 'textarea, [role="textbox"]', 0, 'z.ai', 'sse', '[DONE]', 'openai', NULL, '{}', 0, 0, NULL, 'economy', 'active', '{}', 1, 1782868069000, 1782868069000),
  ('qwen', 'Qwen', 'https://tongyi.aliyun.com/', 'textarea, [role="textbox"], [contenteditable="true"]', 'textarea, [role="textbox"], [contenteditable="true"]', 0, 'tongyi.aliyun.com', 'sse', '[DONE]', 'openai', NULL, '{}', 0, 0, NULL, 'economy', 'active', '{}', 1, 1782868069000, 1782868069000);

-- provider_account: 9 rows
INSERT INTO "provider_account" ("id", "chrome_profile_id", "provider_id", "account_email", "display_name", "plan_type", "status", "last_verified", "total_requests", "successful_requests", "failed_requests", "last_request_at", "avg_latency_ms", "classification", "tags", "created_at", "is_default") VALUES
  ('pa-1783247903988-qcb4ykwne5', 'cp-backbone-intelligence-advisors-gmail-com', 'chatgpt', 'backbone.intelligence.advisors@gmail.com', NULL, 'unknown', 'disconnected', 1783293304838, 0, 0, 0, NULL, NULL, 'personal', '[]', 1783247903989, 0),
  ('pa-1783247912768-tonruj4jy1q', 'cp-owservera-gmail-com', 'chatgpt', 'owservera@gmail.com', NULL, 'unknown', 'disconnected', 1783287870907, 0, 0, 0, NULL, NULL, 'personal', '[]', 1783247912768, 0),
  ('pa-1783280737389-nfxaqizpt4e', 'cp-owservera-gmail-com', 'claude', 'owservera@gmail.com', NULL, 'unknown', 'connected', 1783294790511, 0, 0, 0, NULL, NULL, 'personal', '[]', 1783280737389, 1),
  ('pa-1783280810433-1cjgr3460xt', 'cp-vivim-advisors-gmail-com', 'chatgpt', 'vivim.advisors@gmail.com', NULL, 'unknown', 'disconnected', 1783287872628, 0, 0, 0, NULL, NULL, 'personal', '[]', 1783280810434, 0),
  ('pa-1783284175388-1ht3knnmio', 'cp-owservera-gmail-com', 'gemini', 'owservera@gmail.com', NULL, 'unknown', 'failed', NULL, 0, 0, 0, NULL, NULL, 'personal', '[]', 1783284175388, 0),
  ('pa-1783287845371-6jxt9hh1hui', 'cp-owservera-gmail-com', 'chatgpt', 'owservera@gmail.com', NULL, 'unknown', 'disconnected', 1783287871724, 0, 0, 0, NULL, NULL, 'personal', '[]', 1783287845371, 0),
  ('pa-1783287872366-m8ayt57mzi', 'cp-owservera-gmail-com', 'chatgpt', 'owservera@gmail.com', NULL, 'unknown', 'connected', 1783301388044, 0, 0, 0, NULL, NULL, 'personal', '[]', 1783287872366, 1),
  ('pa-1783294542079-mrii2bvb36', 'cp-backbone-intelligence-advisors-gmail-com', 'chatgpt', 'backbone.intelligence.advisors@gmail.com', NULL, 'unknown', 'failed', NULL, 0, 0, 0, NULL, NULL, 'personal', '[]', 1783294542079, 0),
  ('pa-1783298706414-vwdtvag4sd8', 'cp-backbone-intelligence-advisors-gmail-com', 'claude', 'backbone.intelligence.advisors@gmail.com', NULL, 'unknown', 'failed', NULL, 0, 0, 0, NULL, NULL, 'personal', '[]', 1783298706414, 0);

-- provider_config: 7 rows
INSERT INTO "provider_config" ("provider_id", "enabled", "display_name", "config", "created_at", "updated_at", "schema_version") VALUES
  ('chatgpt', 1, 'ChatGPT', '{"provider_id":"chatgpt","display_name":"ChatGPT","landing_url":"https://chatgpt.com/","ready_selector":"#prompt-textarea, .ProseMirror","stream_url_pattern":"backend-api/conversation","stream_transport":"sse","stream_terminal":"[DONE]","sse_format":"openai","composer_selector":"#prompt-textarea","composer_is_content_editable":false}', 1782995342699, 1782995342699, 1),
  ('claude', 1, 'Claude', '{"provider_id":"claude","display_name":"Claude","landing_url":"https://claude.ai/new","ready_selector":"div[contenteditable=\"true\"], fieldset textarea","stream_url_pattern":"claude.ai/api","stream_transport":"sse","stream_terminal":"message_stop","composer_selector":"div[contenteditable=\"true\"]","composer_is_content_editable":true,"locale":"en","locale_variants":{"New chat":"Nueva conversación","Projects":"Proyectos"}}', 1782995342702, 1782995342702, 1),
  ('deepseek', 1, 'DeepSeek', '{"provider_id":"deepseek","display_name":"DeepSeek","landing_url":"https://chat.deepseek.com/","ready_selector":"textarea","stream_url_pattern":"deepseek.com","stream_transport":"sse","stream_terminal":"[DONE]","sse_format":"openai","composer_selector":"textarea","composer_is_content_editable":false}', 1782995342716, 1782995342716, 1),
  ('gemini', 1, 'Gemini', '{"provider_id":"gemini","display_name":"Gemini","landing_url":"https://gemini.google.com/app","ready_selector":".ql-editor, rich-textarea .ql-editor","stream_url_pattern":"batchexecute","stream_transport":"batchexecute","stream_terminal":"[[\"e\"","composer_selector":".ql-editor","composer_is_content_editable":true}', 1782995342718, 1782995342718, 1),
  ('studio-ai', 1, 'Studio AI', '{"provider_id":"studio-ai","display_name":"Studio AI","landing_url":"https://aistudio.google.com/","ready_selector":"textarea, [role=\"textbox\"]","stream_url_pattern":"aistudio.google.com","stream_transport":"sse","stream_terminal":"[DONE]","sse_format":"google-ai-studio","composer_selector":"textarea, [role=\"textbox\"]","composer_is_content_editable":false}', 1782995342720, 1782995342720, 1),
  ('z-ai', 1, 'Z.AI', '{"provider_id":"z-ai","display_name":"Z.AI","landing_url":"https://chat.z.ai/","ready_selector":"textarea, [role=\"textbox\"]","stream_url_pattern":"z.ai","stream_transport":"sse","stream_terminal":"[DONE]","sse_format":"openai","composer_selector":"textarea, [role=\"textbox\"]","composer_is_content_editable":false}', 1782995342738, 1782995342738, 1),
  ('qwen', 1, 'Qwen', '{"provider_id":"qwen","display_name":"Qwen","landing_url":"https://tongyi.aliyun.com/","ready_selector":"textarea, [role=\"textbox\"], [contenteditable=\"true\"]","stream_url_pattern":"tongyi.aliyun.com","stream_transport":"sse","stream_terminal":"[DONE]","sse_format":"openai","composer_selector":"textarea, [role=\"textbox\"], [contenteditable=\"true\"]","composer_is_content_editable":false}', 1782995342742, 1782995342742, 1);

-- provider_health: (empty)

-- provider_health_tick: (empty)

-- provider_session: (empty)

-- route_binding: (empty)

-- route_event: 210 rows
INSERT INTO "route_event" ("id", "ts", "route_request_id", "route_target_id", "kind", "detail", "schema_version") VALUES
  (1, 1782903744355, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (2, 1782904082433, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (3, 1782904082883, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (4, 1782904172555, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (5, 1782904172981, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (6, 1782904225037, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (7, 1782904225497, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (8, 1782904263112, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (9, 1782904263500, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (10, 1782904454456, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (11, 1782904454928, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (12, 1782904834547, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (13, 1782904835082, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (14, 1782905493996, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (15, 1782905494561, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (16, 1782905745394, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (17, 1782905745959, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (18, 1782906494889, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (19, 1782906495371, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (20, 1782927485403, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (21, 1782927486115, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (22, 1782933672140, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (23, 1782933672505, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (24, 1782939958369, 'rr:00mr2kf0ie74fabbb757ec4066', NULL, 'created', '{"spec":"claude","command":"send-prompt","targets":["claude"]}', 1),
  (25, 1782939958448, 'rr:00mr2kf0ie74fabbb757ec4066', 'rt:00mr2kf0iie559daea0a334a62', 'target_error', '{"providerId":"claude","error":"db.insertOutcome is not a function. (In ''db.insertOutcome({\n    binding_id: bindingId,\n    ok,\n    ttft_ms: ttftMs ?? null,\n    total_ms: totalMs,\n    block_count: blockCount,\n    trace_json: JSON.stringify(trace),\n    model: null,\n    action_tag: null\n  })'', ''db.insertOutcome'' is undefined)"}', 1),
  (26, 1782991330843, 'rr:00mr3f03rne1ddea1cad914e08', NULL, 'created', '{"spec":"claude","command":"send-prompt","targets":["claude"]}', 1),
  (27, 1782991331445, 'rr:00mr3f03rne1ddea1cad914e08', 'rt:00mr3f03rsbe17bdab6d604e24', 'target_error', '{"providerId":"claude","error":"db.insertOutcome is not a function. (In ''db.insertOutcome({\n    binding_id: bindingId,\n    ok,\n    ttft_ms: ttftMs ?? null,\n    total_ms: totalMs,\n    block_count: blockCount,\n    trace_json: JSON.stringify(trace),\n    model: null,\n    action_tag: null\n  })'', ''db.insertOutcome'' is undefined)"}', 1),
  (28, 1782995392997, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (29, 1782995398146, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (30, 1782995778431, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (31, 1782995783491, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (32, 1782997306607, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (33, 1782997311724, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (34, 1782997698966, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (35, 1782997703726, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (36, 1782998283514, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (37, 1782998288576, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (38, 1783000686178, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (39, 1783000686326, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (40, 1783000728317, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (41, 1783000728453, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (42, 1783000957848, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (43, 1783000957985, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (44, 1783000986099, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (45, 1783000986251, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (46, 1783001273251, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (47, 1783001273404, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (48, 1783007049081, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (49, 1783007049265, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (50, 1783007146781, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (51, 1783007146964, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (52, 1783007262791, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (53, 1783007262961, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (54, 1783007377319, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (55, 1783007377464, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (56, 1783008222647, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (57, 1783008222856, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (58, 1783008351556, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (59, 1783008351695, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (60, 1783008387395, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (61, 1783008387884, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (62, 1783008485370, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (63, 1783008485502, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (64, 1783008645036, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (65, 1783008645187, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (66, 1783008727453, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (67, 1783008727581, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (68, 1783010302658, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (69, 1783010302821, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (70, 1783010763271, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (71, 1783010763512, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (72, 1783015915010, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (73, 1783015915152, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (74, 1783024101566, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (75, 1783024101690, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (76, 1783024149598, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (77, 1783024149722, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (78, 1783024177524, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (79, 1783024177646, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (80, 1783025213116, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (81, 1783025213255, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (82, 1783025240004, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (83, 1783025240132, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (84, 1783028924369, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (85, 1783028924639, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (86, 1783029172924, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (87, 1783029173231, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (88, 1783031465994, 'rr:00mr42wc8u636475141a7b4375', NULL, 'created', '{"spec":"gemini","command":"send-prompt","targets":["gemini"]}', 1),
  (89, 1783031466132, 'rr:00mr42wc8u636475141a7b4375', NULL, 'started', '{"spec":"gemini","command":"send-prompt"}', 1),
  (90, 1783031466144, 'rr:00mr42wc8u636475141a7b4375', 'rt:00mr42wc92053025da47ab494c', 'target_started', '{"providerId":"gemini"}', 1),
  (91, 1783031466279, 'rr:00mr42wc8u636475141a7b4375', 'rt:00mr42wc92053025da47ab494c', 'target_error', '{"providerId":"gemini","error":"db.insertOutcome is not a function. (In ''db.insertOutcome({\n    binding_id: bindingId,\n    ok,\n    ttft_ms: ttftMs ?? null,\n    total_ms: totalMs,\n    block_count: blockCount,\n    trace_json: JSON.stringify(trace),\n    model: null,\n    action_tag: null\n  })'', ''db.insertOutcome'' is undefined)"}', 1),
  (92, 1783031466298, 'rr:00mr42wc8u636475141a7b4375', NULL, 'completed', '{"finalStatus":"error","targetCount":1}', 1),
  (93, 1783031503238, 'rr:00mr42x4ymd93b5f3af31d4dbc', NULL, 'created', '{"spec":"claude","command":"send-prompt","targets":["claude"]}', 1),
  (94, 1783031503248, 'rr:00mr42x4ymd93b5f3af31d4dbc', NULL, 'started', '{"spec":"claude","command":"send-prompt"}', 1),
  (95, 1783031503263, 'rr:00mr42x4ymd93b5f3af31d4dbc', 'rt:00mr42x4zfc0becfd7659b4f63', 'target_started', '{"providerId":"claude"}', 1),
  (96, 1783031503422, 'rr:00mr42x4ymd93b5f3af31d4dbc', 'rt:00mr42x4zfc0becfd7659b4f63', 'target_error', '{"providerId":"claude","error":"db.insertOutcome is not a function. (In ''db.insertOutcome({\n    binding_id: bindingId,\n    ok,\n    ttft_ms: ttftMs ?? null,\n    total_ms: totalMs,\n    block_count: blockCount,\n    trace_json: JSON.stringify(trace),\n    model: null,\n    action_tag: null\n  })'', ''db.insertOutcome'' is undefined)"}', 1),
  (97, 1783031503441, 'rr:00mr42x4ymd93b5f3af31d4dbc', NULL, 'completed', '{"finalStatus":"error","targetCount":1}', 1),
  (98, 1783038677742, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (99, 1783038677894, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (100, 1783039070825, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1);
INSERT INTO "route_event" ("id", "ts", "route_request_id", "route_target_id", "kind", "detail", "schema_version") VALUES
  (101, 1783039070967, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (102, 1783039496307, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (103, 1783039496437, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (104, 1783039633506, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (105, 1783039633647, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (106, 1783062373911, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (107, 1783062374041, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (108, 1783062465198, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (109, 1783062465342, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (110, 1783062587489, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (111, 1783062587629, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (112, 1783062709101, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (113, 1783062709249, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (114, 1783062882078, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (115, 1783062882219, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (116, 1783063001535, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (117, 1783063001673, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (118, 1783063119889, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (119, 1783063120041, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (120, 1783063239326, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (121, 1783063239454, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (122, 1783063287001, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (123, 1783063287135, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (124, 1783068638504, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (125, 1783068638693, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (126, 1783069985982, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (127, 1783069986230, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (128, 1783072448671, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (129, 1783072448859, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (130, 1783075904537, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (131, 1783075904700, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (132, 1783076024649, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (133, 1783076024827, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (134, 1783079487828, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (135, 1783079487970, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (136, 1783079533715, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (137, 1783079533857, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (138, 1783079834862, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (139, 1783079834990, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (140, 1783079879480, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (141, 1783079879634, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (142, 1783084547976, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (143, 1783084548108, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (144, 1783084593738, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (145, 1783084593855, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (146, 1783084641617, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (147, 1783084641738, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (148, 1783084688588, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (149, 1783084688728, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (150, 1783086242935, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (151, 1783086243118, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (152, 1783086384685, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (153, 1783086384818, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (154, 1783087189669, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (155, 1783087189824, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (156, 1783087344182, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (157, 1783087344319, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (158, 1783087830057, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (159, 1783087830211, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (160, 1783092161196, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (161, 1783092161326, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (162, 1783092214425, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (163, 1783092214570, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (164, 1783092269324, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (165, 1783092269453, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (166, 1783092328657, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (167, 1783092328815, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (168, 1783092684378, 'rr:00mr53cgm9b3f720c688724413', NULL, 'created', '{"spec":"claude","command":"send-prompt","targets":["claude"]}', 1),
  (169, 1783092685028, 'rr:00mr53cgm9b3f720c688724413', NULL, 'started', '{"spec":"claude","command":"send-prompt"}', 1),
  (170, 1783092685030, 'rr:00mr53cgm9b3f720c688724413', 'rt:00mr53cgnj960acd8053de4eb4', 'target_started', '{"providerId":"claude"}', 1),
  (171, 1783092690510, 'rr:00mr53cgm9b3f720c688724413', 'rt:00mr53cgnj960acd8053de4eb4', 'target_error', '{"providerId":"claude","error":"Error: CDP error (Page.addScriptToEvaluateOnNewDocument): Session with given id not found.","responseText":null}', 1),
  (172, 1783092690534, 'rr:00mr53cgm9b3f720c688724413', NULL, 'completed', '{"finalStatus":"error","targetCount":1}', 1),
  (173, 1783093296378, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (174, 1783093296589, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (175, 1783093381588, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (176, 1783093381765, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (177, 1783158180735, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (178, 1783158180884, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (179, 1783158279329, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (180, 1783158279466, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (181, 1783158484496, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (182, 1783158484688, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (183, 1783158725289, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (184, 1783158725444, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (185, 1783158839125, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (186, 1783158839279, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (187, 1783159261811, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (188, 1783159261939, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (189, 1783161602623, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (190, 1783161602775, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (191, 1783161770659, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (192, 1783161770811, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (193, 1783166084221, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (194, 1783166084393, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (195, 1783327936291, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (196, 1783327936444, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (197, 1783331921183, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (198, 1783331921327, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (199, 1783332674755, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (200, 1783332674911, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1);
INSERT INTO "route_event" ("id", "ts", "route_request_id", "route_target_id", "kind", "detail", "schema_version") VALUES
  (201, 1783246900724, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (202, 1783246900868, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (203, 1783283835875, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (204, 1783283836046, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (205, 1783294255372, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (206, 1783294255541, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (207, 1783298426813, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (208, 1783298426980, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (209, 1783305906691, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1),
  (210, 1783305906840, 'nonexistent-id', NULL, 'cancelled', '{"cancelled_targets":0}', 1);

-- route_request: 5 rows
INSERT INTO "route_request" ("id", "ts", "spec", "command", "args", "failure_mode", "priority", "targets", "status", "started_at", "finished_at", "result_summary", "schema_version") VALUES
  ('rr:00mr2kf0ie74fabbb757ec4066', 1782939958358, 'claude', 'send-prompt', '{}', 'all', 'normal', '["claude"]', 'pending', NULL, NULL, NULL, 1),
  ('rr:00mr3f03rne1ddea1cad914e08', 1782991330835, 'claude', 'send-prompt', '{}', 'all', 'normal', '["claude"]', 'pending', NULL, NULL, NULL, 1),
  ('rr:00mr42wc8u636475141a7b4375', 1783031465982, 'gemini', 'send-prompt', '{"prompt":"Hello from automated test — start multi-turn convo"}', 'all', 'normal', '["gemini"]', 'error', 1783031466128, 1783031466287, NULL, 1),
  ('rr:00mr42x4ymd93b5f3af31d4dbc', 1783031503198, 'claude', 'send-prompt', '{"prompt":"Follow-up question: can you summarize the previous answer?"}', 'all', 'normal', '["claude"]', 'error', 1783031503244, 1783031503433, NULL, 1),
  ('rr:00mr53cgm9b3f720c688724413', 1783092684321, 'claude', 'send-prompt', '{"prompt":"hi"}', 'all', 'normal', '["claude"]', 'error', 1783092685020, 1783092690530, NULL, 1);

-- route_target: 5 rows
INSERT INTO "route_target" ("id", "route_request_id", "provider_id", "binding_id", "status", "error", "started_at", "finished_at", "outcome_id", "schema_version") VALUES
  ('rt:00mr2kf0iie559daea0a334a62', 'rr:00mr2kf0ie74fabbb757ec4066', 'claude', 'b:claude:send-prompt', 'error', 'db.insertOutcome is not a function. (In ''db.insertOutcome({
    binding_id: bindingId,
    ok,
    ttft_ms: ttftMs ?? null,
    total_ms: totalMs,
    block_count: blockCount,
    trace_json: JSON.stringify(trace),
    model: null,
    action_tag: null
  })'', ''db.insertOutcome'' is undefined)', 1782939958423, 1782939958446, NULL, 1),
  ('rt:00mr3f03rsbe17bdab6d604e24', 'rr:00mr3f03rne1ddea1cad914e08', 'claude', 'b:claude:send-prompt', 'error', 'db.insertOutcome is not a function. (In ''db.insertOutcome({
    binding_id: bindingId,
    ok,
    ttft_ms: ttftMs ?? null,
    total_ms: totalMs,
    block_count: blockCount,
    trace_json: JSON.stringify(trace),
    model: null,
    action_tag: null
  })'', ''db.insertOutcome'' is undefined)', 1782991331420, 1782991331443, NULL, 1),
  ('rt:00mr42wc92053025da47ab494c', 'rr:00mr42wc8u636475141a7b4375', 'gemini', 'b:gemini:send-prompt', 'error', 'db.insertOutcome is not a function. (In ''db.insertOutcome({
    binding_id: bindingId,
    ok,
    ttft_ms: ttftMs ?? null,
    total_ms: totalMs,
    block_count: blockCount,
    trace_json: JSON.stringify(trace),
    model: null,
    action_tag: null
  })'', ''db.insertOutcome'' is undefined)', 1783031466113, 1783031466276, NULL, 1),
  ('rt:00mr42x4zfc0becfd7659b4f63', 'rr:00mr42x4ymd93b5f3af31d4dbc', 'claude', 'b:claude:send-prompt', 'error', 'db.insertOutcome is not a function. (In ''db.insertOutcome({
    binding_id: bindingId,
    ok,
    ttft_ms: ttftMs ?? null,
    total_ms: totalMs,
    block_count: blockCount,
    trace_json: JSON.stringify(trace),
    model: null,
    action_tag: null
  })'', ''db.insertOutcome'' is undefined)', 1783031503241, 1783031503419, NULL, 1),
  ('rt:00mr53cgnj960acd8053de4eb4', 'rr:00mr53cgm9b3f720c688724413', 'claude', 'b:claude:send-prompt', 'error', 'Error: CDP error (Page.addScriptToEvaluateOnNewDocument): Session with given id not found.', 1783092685000, 1783092690489, NULL, 1);

-- rule: (empty)

-- schema_meta: 35 rows
INSERT INTO "schema_meta" ("key", "value", "updated_at") VALUES
  ('current_schema_version', '1', 1782868069000),
  ('cap_store_version', '0.1.0', 1782868069000),
  ('applied_migration', '001_init.sql', 1782868069211),
  ('cap_store_version', '0.2.0', 1782868069000),
  ('applied_migration', '002_provider.sql', 1782868069428),
  ('applied_migration', '003_selector_strategy.sql', 1782868069458),
  ('applied_migration', '004_learning.sql', 1782868069461),
  ('applied_migration', '005_binding_event.sql', 1782868069465),
  ('applied_migration', '006_failure_classification.sql', 1782868069468),
  ('applied_migration', '007_views.sql', 1782868069502),
  ('applied_migration', '008_provider_seed.sql', 1782868069506),
  ('applied_migration', '009_transfer.sql', 1782868069512),
  ('applied_migration', '010_trace.sql', 1782868069533),
  ('applied_migration', '011_health_ticks.sql', 1782868069536),
  ('applied_migration', '012_circuit_breaker.sql', 1782868069538),
  ('applied_migration', '013_endpoint_fields.sql', 1782868069546),
  ('applied_migration', '014_outcome_stream.sql', 1782868069576),
  ('applied_migration', '015_hole_fingerprint.sql', 1782868069583),
  ('applied_migration', '016_routing.sql', 1782868069588),
  ('applied_migration', '017_state_engine.sql', 1782868069593),
  ('applied_migration', '018_learning_confidence.sql', 1782868069661),
  ('applied_migration', '019_automation_alerting.sql', 1782868069870),
  ('applied_migration', '020_profile_session_settings.sql', 1782868069877),
  ('applied_migration', '021_auth_state.sql', 1782995342685),
  ('applied_migration', '022_checkpoint.sql', 1782995342689),
  ('applied_migration', '023_provider_health.sql', 1782995342692),
  ('applied_migration', '024_provider_config.sql', 1782995342695),
  ('applied_migration', '025_chrome_profiles.sql', 1783007047939),
  ('applied_migration', '026_fleet_event.sql', 1783079486773),
  ('applied_migration', '027_composite_profile_id.sql', 1783166083195),
  ('applied_migration', '028_vivim_session_states.sql', 1783170861367),
  ('applied_migration', '029_conversation_states.sql', 1783170861375),
  ('applied_migration', '030_discovered_accounts.sql', 1783327935079),
  ('applied_migration', '031_default_account.sql', 1783294254253),
  ('applied_migration', '031_cleanup_synthetic_profiles.sql', 1783305905535);

-- selector_strategy: (empty)

-- session_checkpoint: (empty)

-- state_transition: 32 rows
INSERT INTO "state_transition" ("id", "ts", "entity_type", "entity_id", "from_state", "to_state", "reason", "actor", "metadata", "schema_version") VALUES
  (1, 1782939952644, 'vivim_session', 'vs:00mr2kew3gf0c6bac5b8f5496d', 'idle', 'idle', 'created', NULL, NULL, 1),
  (2, 1782939952665, 'vivim_session', 'vs:00mr2kew3gf0c6bac5b8f5496d', 'idle', 'active', 'started', NULL, NULL, 1),
  (3, 1782991301440, 'vivim_session', 'vs:00mr3ezh2x3854b260caab41b1', 'idle', 'idle', 'created', NULL, NULL, 1),
  (4, 1782991301453, 'vivim_session', 'vs:00mr3ezh2x3854b260caab41b1', 'idle', 'active', 'started', NULL, NULL, 1),
  (5, 1782991396508, 'vivim_session', 'vs:00mr3f1iftb75ef2630d814db0', 'idle', 'idle', 'created', NULL, NULL, 1),
  (6, 1782991396526, 'vivim_session', 'vs:00mr3f1iftb75ef2630d814db0', 'idle', 'active', 'started', NULL, NULL, 1),
  (7, 1782997699187, 'vivim_session', 'vs:00mr3islm147e4df4e240e41d4', 'idle', 'idle', 'created', NULL, NULL, 1),
  (8, 1782997699202, 'vivim_session', 'vs:00mr3islm147e4df4e240e41d4', 'idle', 'active', 'started', NULL, NULL, 1),
  (9, 1783002859154, 'vivim_session', 'vs:00mr3lv72g7f4019924b284937', 'idle', 'idle', 'created', NULL, NULL, 1),
  (10, 1783002859180, 'vivim_session', 'vs:00mr3lv72g7f4019924b284937', 'idle', 'active', 'started', NULL, NULL, 1),
  (11, 1783002867297, 'vivim_session', 'vs:00mr3lvdcseb38db17a2fe4b2a', 'idle', 'idle', 'created', NULL, NULL, 1),
  (12, 1783002867444, 'vivim_session', 'vs:00mr3lvdcseb38db17a2fe4b2a', 'idle', 'active', 'started', NULL, NULL, 1),
  (13, 1783030355206, 'vivim_session', 'vs:00mr428j3t44e1a6eab7d34d31', 'idle', 'idle', 'created', NULL, NULL, 1),
  (14, 1783030355269, 'vivim_session', 'vs:00mr428j3t44e1a6eab7d34d31', 'idle', 'active', 'started', NULL, NULL, 1),
  (15, 1783030363502, 'vivim_session', 'vs:00mr428pjvde910fafd1a747e4', 'idle', 'idle', 'created', NULL, NULL, 1),
  (16, 1783030363549, 'vivim_session', 'vs:00mr428pjvde910fafd1a747e4', 'idle', 'active', 'started', NULL, NULL, 1),
  (17, 1783030381284, 'vivim_session', 'vs:00mr4293a8c27133e585e74e09', 'idle', 'idle', 'created', NULL, NULL, 1),
  (18, 1783030381368, 'vivim_session', 'vs:00mr4293a8c27133e585e74e09', 'idle', 'active', 'started', NULL, NULL, 1),
  (19, 1783030396641, 'vivim_session', 'vs:00mr429f4s957288f4c3c24062', 'idle', 'idle', 'created', NULL, NULL, 1),
  (20, 1783030396787, 'vivim_session', 'vs:00mr429f4s957288f4c3c24062', 'idle', 'active', 'started', NULL, NULL, 1),
  (21, 1783030469889, 'vivim_session', 'vs:00mr42azmuad8c86039ba04528', 'idle', 'idle', 'created', NULL, NULL, 1),
  (22, 1783030469952, 'vivim_session', 'vs:00mr42azmuad8c86039ba04528', 'idle', 'active', 'started', NULL, NULL, 1),
  (23, 1783031435665, 'vivim_session', 'vs:00mr42votl52e8f277b92c4490', 'idle', 'idle', 'created', NULL, NULL, 1),
  (24, 1783031435732, 'vivim_session', 'vs:00mr42votl52e8f277b92c4490', 'idle', 'active', 'started', NULL, NULL, 1),
  (25, 1783064633419, 'vivim_session', 'vs:00mr4mn8cz4338c3382ec64533', 'idle', 'idle', 'created', NULL, NULL, 1),
  (26, 1783064633466, 'vivim_session', 'vs:00mr4mn8cz4338c3382ec64533', 'idle', 'active', 'started', NULL, NULL, 1),
  (27, 1783064648696, 'vivim_session', 'vs:00mr4mnk67a67441eaa46a4262', 'idle', 'idle', 'created', NULL, NULL, 1),
  (28, 1783064648734, 'vivim_session', 'vs:00mr4mnk67a67441eaa46a4262', 'idle', 'active', 'started', NULL, NULL, 1),
  (29, 1783074621360, 'vivim_session', 'vs:00mr4slb1z0f183fbac9634840', 'idle', 'idle', 'created', NULL, NULL, 1),
  (30, 1783074621820, 'vivim_session', 'vs:00mr4slb1z0f183fbac9634840', 'idle', 'active', 'started', NULL, NULL, 1),
  (31, 1783085085346, 'vivim_session', 'vs:00mr4ytl7hc2177f2cdc6b401f', 'idle', 'idle', 'created', NULL, NULL, 1),
  (32, 1783085085359, 'vivim_session', 'vs:00mr4ytl7hc2177f2cdc6b401f', 'idle', 'active', 'started', NULL, NULL, 1);

-- trace_event: (empty)

-- transfer_attempt: (empty)

-- transfer_candidate: (empty)

-- transfer_pattern: (empty)

-- vivim_session: 16 rows
INSERT INTO "vivim_session" ("id", "ts", "status", "provider_ids", "current_provider", "current_step", "total_steps", "metadata", "created_at", "updated_at", "schema_version") VALUES
  ('vs:00mr2kew3gf0c6bac5b8f5496d', 1782939952635, 'running', '["chatgpt"]', NULL, 0, 1, '{}', 1782939952635, 1782939952663, 1),
  ('vs:00mr3ezh2x3854b260caab41b1', 1782991301432, 'running', '["chatgpt"]', NULL, 0, 1, '{}', 1782991301432, 1782991301451, 1),
  ('vs:00mr3f1iftb75ef2630d814db0', 1782991396505, 'running', '["chatgpt"]', NULL, 0, 1, '{}', 1782991396505, 1782991396522, 1),
  ('vs:00mr3islm147e4df4e240e41d4', 1782997699177, 'running', '["chatgpt"]', NULL, 0, 1, '{}', 1782997699177, 1782997699199, 1),
  ('vs:00mr3lv72g7f4019924b284937', 1783002859144, 'running', '["chatgpt"]', NULL, 0, 1, '{}', 1783002859144, 1783002859177, 1),
  ('vs:00mr3lvdcseb38db17a2fe4b2a', 1783002867292, 'running', '["chatgpt"]', NULL, 0, 1, '{}', 1783002867292, 1783002867442, 1),
  ('vs:00mr428j3t44e1a6eab7d34d31', 1783030355129, 'running', '["chatgpt"]', NULL, 0, 1, '{}', 1783030355129, 1783030355265, 1),
  ('vs:00mr428pjvde910fafd1a747e4', 1783030363483, 'running', '["chatgpt"]', NULL, 0, 1, '{}', 1783030363483, 1783030363546, 1),
  ('vs:00mr4293a8c27133e585e74e09', 1783030381280, 'running', '["chatgpt"]', NULL, 0, 1, '{}', 1783030381280, 1783030381365, 1),
  ('vs:00mr429f4s957288f4c3c24062', 1783030396636, 'running', '["chatgpt"]', NULL, 0, 1, '{}', 1783030396636, 1783030396761, 1),
  ('vs:00mr42azmuad8c86039ba04528', 1783030469862, 'running', '["chatgpt"]', NULL, 0, 1, '{}', 1783030469862, 1783030469948, 1),
  ('vs:00mr42votl52e8f277b92c4490', 1783031435625, 'running', '["chatgpt"]', NULL, 0, 1, '{}', 1783031435625, 1783031435703, 1),
  ('vs:00mr4mn8cz4338c3382ec64533', 1783064633363, 'running', '["chatgpt"]', NULL, 0, 1, '{}', 1783064633363, 1783064633462, 1),
  ('vs:00mr4mnk67a67441eaa46a4262', 1783064648671, 'running', '["chatgpt"]', NULL, 0, 1, '{}', 1783064648671, 1783064648721, 1),
  ('vs:00mr4slb1z0f183fbac9634840', 1783074621239, 'running', '["chatgpt"]', NULL, 0, 1, '{}', 1783074621239, 1783074621815, 1),
  ('vs:00mr4ytl7hc2177f2cdc6b401f', 1783085085341, 'running', '["chatgpt"]', NULL, 0, 1, '{}', 1783085085341, 1783085085357, 1);

-- ─────────────────────────────────────────────────────────────────
-- Total: 46 tables, 6 views, 82 indexes, 2381 rows
-- ─────────────────────────────────────────────────────────────────