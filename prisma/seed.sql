-- ============================================================================
-- cap-store v1 — Post-Prisma Schema Enhancements
-- Run after: bunx prisma db push
-- Adds: CHECK constraints, Views, Expression defaults
-- ============================================================================

-- ============================================================================
-- CHECK Constraints (Prisma SQLite limitation: no CHECK in schema)
-- ============================================================================

-- provider_endpoint.endpoint_type
ALTER TABLE provider_endpoint ADD CONSTRAINT chk_pe_endpoint_type
  CHECK (endpoint_type IN ('landing','chat','login','api','auth'));

-- provider_account.plan_tier
ALTER TABLE provider_account ADD CONSTRAINT chk_pa_plan_tier
  CHECK (plan_tier IN ('free','pro','max','enterprise'));

-- provider_account.login_state
ALTER TABLE provider_account ADD CONSTRAINT chk_pa_login_state
  CHECK (login_state IN ('unknown','logged_out','logging_in','logged_in','login_failed','rate_limited','captcha_required'));

-- capability_taxonomy.min_plan_tier
ALTER TABLE capability_taxonomy ADD CONSTRAINT chk_ct_min_plan_tier
  CHECK (min_plan_tier IN ('free','pro','max','enterprise'));

-- capability_taxonomy.op_classification
ALTER TABLE capability_taxonomy ADD CONSTRAINT chk_ct_op_classification
  CHECK (op_classification IN ('read','write','destructive','navigate','search'));

-- capability_tier.plan_tier
ALTER TABLE capability_tier ADD CONSTRAINT chk_ctr_plan_tier
  CHECK (plan_tier IN ('free','pro','max','enterprise'));

-- capability_binding.status
ALTER TABLE capability_binding ADD CONSTRAINT chk_cb_status
  CHECK (status IN ('broken','flaky','prospect','retired','stable','test-1','test-2'));

-- selector_strategy.strategy_type
ALTER TABLE selector_strategy ADD CONSTRAINT chk_ss_strategy_type
  CHECK (strategy_type IN ('css','xpath','text','aria','data','regex','composite'));

-- conversation_message.role
ALTER TABLE conversation_message ADD CONSTRAINT chk_cm_role
  CHECK (role IN ('user','assistant','system','tool'));

-- stream_block.block_kind
ALTER TABLE stream_block ADD CONSTRAINT chk_sb_block_kind
  CHECK (block_kind IN (
    'text','tool_call','tool_result','error','thinking',
    'image','audio','video','file','code','json',
    'markdown','html','citation','reference','metadata'
  ));

-- registration_event.event_type
ALTER TABLE registration_event ADD CONSTRAINT chk_re_event_type
  CHECK (event_type IN (
    'registered','updated','removed','activated','deactivated',
    'config_changed','model_added','model_removed','model_updated',
    'capability_added','capability_removed','capability_updated',
    'manifest_changed','drift_detected','drift_resolved'
  ));

-- manifest_drift.drift_type
ALTER TABLE manifest_drift ADD CONSTRAINT chk_md_drift_type
  CHECK (drift_type IN ('added','removed','modified','missing_table','extra_table','schema_diff'));

-- binding_status_log.trigger
ALTER TABLE binding_status_log ADD CONSTRAINT chk_bsl_trigger
  CHECK (trigger IN (
    'initial','promoted','demoted','retired','reactivated',
    'config_changed','telemetry_updated','manual_override',
    'program_superseded','health_check','circuit_breaker'
  ));

-- manifest_change_log.change_type
ALTER TABLE manifest_change_log ADD CONSTRAINT chk_mcl_change_type
  CHECK (change_type IN (
    'created','updated','deleted','schema_changed',
    'config_changed','model_added','model_removed',
    'capability_added','capability_removed','full_reload'
  ));

-- config_entry.scope_type
ALTER TABLE config_entry ADD CONSTRAINT chk_ce_scope_type
  CHECK (scope_type IN ('global','provider','account','engine'));

-- config_audit.action
ALTER TABLE config_audit ADD CONSTRAINT chk_ca_action
  CHECK (action IN ('created','updated','reloaded','reset'));

-- circuit_breaker_state.state
ALTER TABLE circuit_breaker_state ADD CONSTRAINT chk_cbs_state
  CHECK (state IN ('closed','half_open','open'));

-- provider_health.overall_status
ALTER TABLE provider_health ADD CONSTRAINT chk_ph_overall_status
  CHECK (overall_status IN ('healthy','degraded','unhealthy','unknown'));

-- automation_schedule.schedule_type
ALTER TABLE automation_schedule ADD CONSTRAINT chk_as_schedule_type
  CHECK (schedule_type IN ('cron','interval','event'));

-- automation_run.status
ALTER TABLE automation_run ADD CONSTRAINT chk_ar_status
  CHECK (status IN ('running','completed','failed'));

-- ============================================================================
-- Views (9 core views from design doc)
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
-- End of post-Prisma schema enhancements
-- ============================================================================
