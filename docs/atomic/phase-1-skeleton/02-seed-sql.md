# Unit 1.2: Seed SQL — CHECK Constraints, Views, Seed Data

**Phase:** 1 | **File:** `prisma/seed.sql`
**Depends:** 1.1 Prisma Schema | **Produces:** Post-migration SQL enhancements

## Summary
SQLite+Prisma cannot express CHECK constraints, views, or expression defaults
(`unixepoch()`) in the Prisma schema. Apply these via a post-migration SQL file
run after `prisma db push`.

## CHECK Constraints (20 total)
```sql
ALTER TABLE provider_endpoint ADD CHECK (endpoint_type IN ('landing','chat','login','api','auth'));
ALTER TABLE provider_account ADD CHECK (plan_tier IN ('free','pro','max','enterprise'));
ALTER TABLE provider_account ADD CHECK (login_state IN ('unknown','logged_out','logging_in','logged_in','login_failed','rate_limited','captcha_required'));
ALTER TABLE capability_taxonomy ADD CHECK (min_plan_tier IN ('free','pro','max','enterprise'));
ALTER TABLE capability_taxonomy ADD CHECK (op_classification IN ('read','write','destructive','navigate','search'));
ALTER TABLE capability_tier ADD CHECK (plan_tier IN ('free','pro','max','enterprise'));
ALTER TABLE capability_binding ADD CHECK (status IN ('broken','flaky','prospect','retired','stable','test-1','test-2'));
ALTER TABLE selector_strategy ADD CHECK (strategy_type IN ('css','xpath','text','aria','data','regex','composite'));
ALTER TABLE conversation_message ADD CHECK (role IN ('user','assistant','system','tool'));
ALTER TABLE stream_block ADD CHECK (block_kind IN ('text','tool_call','tool_result','error','thinking','image','audio','video','file','code','json','markdown','html','citation','reference','metadata'));
ALTER TABLE registration_event ADD CHECK (event_type IN ('registered','updated','removed','activated','deactivated','config_changed','model_added','model_removed','model_updated','capability_added','capability_removed','capability_updated','manifest_changed','drift_detected','drift_resolved'));
ALTER TABLE manifest_drift ADD CHECK (drift_type IN ('added','removed','modified','missing_table','extra_table','schema_diff'));
ALTER TABLE binding_status_log ADD CHECK (trigger IN ('initial','promoted','demoted','retired','reactivated','config_changed','telemetry_updated','manual_override','program_superseded','health_check','circuit_breaker'));
ALTER TABLE manifest_change_log ADD CHECK (change_type IN ('created','updated','deleted','schema_changed','config_changed','model_added','model_removed','capability_added','capability_removed','full_reload'));
ALTER TABLE config_entry ADD CHECK (scope_type IN ('global','provider','account','engine'));
ALTER TABLE config_audit ADD CHECK (action IN ('created','updated','reloaded','reset'));
ALTER TABLE circuit_breaker_state ADD CHECK (state IN ('closed','half_open','open'));
ALTER TABLE provider_health ADD CHECK (overall_status IN ('healthy','degraded','unhealthy','unknown'));
ALTER TABLE automation_schedule ADD CHECK (schedule_type IN ('cron','interval','event'));
ALTER TABLE automation_run ADD CHECK (status IN ('running','completed','failed'));
```

## Views (9 total)
- `v_coverage_by_provider` — bound + stable + configured capabilities per provider
- `v_failure_distribution` — errors grouped by capability + provider
- `v_recent_outcomes` — outcomes in last 24h with capability/provider names
- `v_strategy_success` — selector hit/miss rates with hit_rate_pct
- `v_catalog_summary` — capabilities per category, provider count, stable count
- `v_outcome_stream_metrics` — hourly success/fail counts per provider
- `v_provider_surface` — endpoints, parsers, models, capabilities, accounts, health per provider
- `v_parser_confidence` — parser version + confidence + consecutive failures
- `v_capability_ui_audit` — full UI contract audit: components, positions, bindings, tiers, overrides

## Seed Data
```sql
INSERT OR IGNORE INTO schema_meta (key, value) VALUES
  ('schema_version', '1'),
  ('migration_id', '001_baseline'),
  ('created_at', strftime('%s', 'now')),
  ('table_count', '54'),
  ('view_count', '9');
```

## Gate
- All 20 CHECK constraints applied
- All 9 views created
- Seed data inserted
- `SELECT COUNT(*) FROM schema_meta` returns 5
