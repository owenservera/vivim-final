-- CreateTable
CREATE TABLE "SchemaMeta" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    PRIMARY KEY ("key", "value")
);

-- CreateTable
CREATE TABLE "migration_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "applied_at" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "provider_definition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'ai',
    "provider_type" TEXT NOT NULL DEFAULT 'llm',
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "website_url" TEXT,
    "documentation_url" TEXT,
    "auth_type" TEXT NOT NULL DEFAULT 'browser',
    "has_multi_account" INTEGER NOT NULL DEFAULT 0,
    "profile_strategy" TEXT NOT NULL DEFAULT 'per_account',
    "fleet_config_json" TEXT NOT NULL DEFAULT '{}',
    "capabilities_json" TEXT NOT NULL DEFAULT '{}',
    "models_json" TEXT NOT NULL DEFAULT '[]',
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "provider_endpoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "endpoint_type" TEXT NOT NULL DEFAULT 'landing',
    "is_default" INTEGER NOT NULL DEFAULT 0,
    "selector_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    CONSTRAINT "provider_endpoint_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "provider_parser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "parser_name" TEXT NOT NULL,
    "parser_version" INTEGER NOT NULL DEFAULT 1,
    "parser_logic_type" TEXT NOT NULL DEFAULT 'file',
    "parser_file_path" TEXT,
    "parser_hash" TEXT,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "fallback_parser_id" TEXT,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    CONSTRAINT "provider_parser_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "provider_parser_fallback_parser_id_fkey" FOREIGN KEY ("fallback_parser_id") REFERENCES "provider_parser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "provider_capability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "global_capability_id" TEXT NOT NULL,
    "recovery_strategies_json" TEXT NOT NULL DEFAULT '[]',
    "ui_component_override" TEXT,
    "ui_label_override" TEXT,
    "ui_icon_override" TEXT,
    "ui_position_override" TEXT,
    "ui_order_override" INTEGER,
    "ui_group_override" TEXT,
    "ui_priority_override" TEXT,
    "interaction_mode_override" TEXT,
    "ui_states_override_json" TEXT,
    "ui_visibility_rule_override" TEXT,
    "existential_rule_override" TEXT,
    "ui_input_schema_override" TEXT,
    "mutation_effects_override_json" TEXT,
    "recovery_behavior_override" TEXT,
    "state_persistence_override" TEXT,
    "data_flow_override" TEXT,
    "min_plan_tier_override" TEXT,
    "depends_on_override_json" TEXT,
    "confidence" REAL NOT NULL DEFAULT 1.0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "fail_count" INTEGER NOT NULL DEFAULT 0,
    "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
    "avg_latency_ms" REAL NOT NULL DEFAULT 0,
    "p95_latency_ms" REAL NOT NULL DEFAULT 0,
    "last_used_at" INTEGER,
    "selector_hit_count" INTEGER NOT NULL DEFAULT 0,
    "selector_miss_count" INTEGER NOT NULL DEFAULT 0,
    "selector_last_miss_at" INTEGER,
    "selector_last_error" TEXT,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    CONSTRAINT "provider_capability_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "provider_config" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "config_key" TEXT NOT NULL,
    "config_value" TEXT NOT NULL,
    "config_type" TEXT NOT NULL DEFAULT 'string',
    "is_secret" INTEGER NOT NULL DEFAULT 0,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    CONSTRAINT "provider_config_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "provider_model" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "model_slug" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "is_default" INTEGER NOT NULL DEFAULT 0,
    "capabilities_json" TEXT NOT NULL DEFAULT '[]',
    "context_window" INTEGER,
    "max_output_tokens" INTEGER,
    "supports_streaming" INTEGER NOT NULL DEFAULT 0,
    "supports_vision" INTEGER NOT NULL DEFAULT 0,
    "supports_thinking" INTEGER NOT NULL DEFAULT 0,
    "supports_tools" INTEGER NOT NULL DEFAULT 0,
    "pricing_input_per_1m" REAL,
    "pricing_output_per_1m" REAL,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    CONSTRAINT "provider_model_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "provider_account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "plan_tier" TEXT NOT NULL DEFAULT 'free',
    "is_default" INTEGER NOT NULL DEFAULT 0,
    "is_kind" INTEGER NOT NULL DEFAULT 0,
    "login_state" TEXT NOT NULL DEFAULT 'unknown',
    "login_attempts" INTEGER NOT NULL DEFAULT 0,
    "last_login_at" INTEGER,
    "provider_state_json" TEXT NOT NULL DEFAULT '{}',
    "debug_port" INTEGER,
    "profile_dir" TEXT,
    "chrome_slave_id" TEXT,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    CONSTRAINT "provider_account_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "trace_entry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "engine" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "request_id" TEXT,
    "conversation_id" TEXT,
    "provider_id" TEXT,
    "account_id" TEXT,
    "slave_id" TEXT,
    "cdp_method" TEXT,
    "cdp_params_json" TEXT,
    "cdp_result_json" TEXT,
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "ok" INTEGER NOT NULL DEFAULT 1,
    "error" TEXT,
    "ts" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "capability_taxonomy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "input_type" TEXT NOT NULL DEFAULT 'void',
    "ui_component" TEXT NOT NULL DEFAULT 'action_button',
    "ui_label" TEXT,
    "ui_icon" TEXT,
    "ui_position" TEXT NOT NULL DEFAULT 'composer',
    "ui_order" INTEGER NOT NULL DEFAULT 0,
    "ui_layer_depth" INTEGER NOT NULL DEFAULT 0,
    "parent_capability_id" TEXT,
    "ui_group" TEXT NOT NULL DEFAULT 'default',
    "ui_priority" TEXT NOT NULL DEFAULT 'secondary',
    "interaction_mode" TEXT NOT NULL DEFAULT 'single_click',
    "ui_states_json" TEXT NOT NULL DEFAULT '[]',
    "ui_visibility_rule" TEXT,
    "existential_rule" TEXT,
    "ui_input_schema" TEXT NOT NULL DEFAULT '{}',
    "mutation_effects_json" TEXT NOT NULL DEFAULT '{}',
    "recovery_behavior" TEXT NOT NULL DEFAULT 'retry_manual',
    "state_persistence" TEXT NOT NULL DEFAULT 'none',
    "data_flow" TEXT NOT NULL DEFAULT 'user_to_provider',
    "min_plan_tier" TEXT NOT NULL DEFAULT 'free',
    "depends_on_json" TEXT NOT NULL DEFAULT '[]',
    "concurrency_safe" INTEGER NOT NULL DEFAULT 0,
    "op_classification" TEXT,
    "requires_user_confirmation" INTEGER NOT NULL DEFAULT 0,
    "max_result_size" INTEGER NOT NULL DEFAULT 100000,
    "result_component" TEXT NOT NULL DEFAULT 'text_block',
    "result_layout" TEXT NOT NULL DEFAULT 'inline',
    "search_hints_json" TEXT NOT NULL DEFAULT '[]',
    "aliases_json" TEXT NOT NULL DEFAULT '[]',
    "availability_json" TEXT NOT NULL DEFAULT '{}',
    "prefetch" INTEGER NOT NULL DEFAULT 0,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    CONSTRAINT "capability_taxonomy_parent_capability_id_fkey" FOREIGN KEY ("parent_capability_id") REFERENCES "capability_taxonomy" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "capability_tier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "capability_id" TEXT NOT NULL,
    "plan_tier" TEXT NOT NULL,
    "max_models" INTEGER,
    "max_file_size" INTEGER,
    "max_options" INTEGER,
    "custom_config_json" TEXT NOT NULL DEFAULT '{}',
    "ui_states_override_json" TEXT,
    "ui_component_override" TEXT,
    "ui_label_override" TEXT,
    "ui_icon_override" TEXT,
    "ui_input_schema_override" TEXT,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    CONSTRAINT "capability_tier_capability_id_fkey" FOREIGN KEY ("capability_id") REFERENCES "capability_taxonomy" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "capability_binding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "global_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'prospect',
    "best_program_id" TEXT,
    "current_program_id" TEXT,
    "promotion_history_json" TEXT NOT NULL DEFAULT '[]',
    "confidence" REAL NOT NULL DEFAULT 0.0,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    CONSTRAINT "capability_binding_global_id_fkey" FOREIGN KEY ("global_id") REFERENCES "capability_taxonomy" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "capability_binding_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "capability_program" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "binding_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT,
    "superseded_by" TEXT,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "config_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    CONSTRAINT "capability_program_binding_id_fkey" FOREIGN KEY ("binding_id") REFERENCES "capability_binding" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "capability_program_superseded_by_fkey" FOREIGN KEY ("superseded_by") REFERENCES "capability_program" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "selector_strategy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "capability_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "strategy_type" TEXT NOT NULL,
    "selector_value" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "hit_count" INTEGER NOT NULL DEFAULT 0,
    "miss_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" INTEGER,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    CONSTRAINT "selector_strategy_capability_id_fkey" FOREIGN KEY ("capability_id") REFERENCES "capability_taxonomy" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "selector_strategy_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "outcome" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "capability_id" TEXT NOT NULL,
    "binding_id" TEXT,
    "provider_id" TEXT NOT NULL,
    "program_id" TEXT,
    "selector_strategy_id" TEXT,
    "ok" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "duration_ms" INTEGER,
    "confidence" REAL,
    "selector_used" TEXT,
    "selector_hit" INTEGER,
    "ts" INTEGER NOT NULL,
    CONSTRAINT "outcome_capability_id_fkey" FOREIGN KEY ("capability_id") REFERENCES "capability_taxonomy" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "vivim_session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "state" TEXT NOT NULL DEFAULT 'idle',
    "context_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "provider_session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vivim_session_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'idle',
    "context_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    CONSTRAINT "provider_session_vivim_session_id_fkey" FOREIGN KEY ("vivim_session_id") REFERENCES "vivim_session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "provider_session_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "provider_session_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "provider_account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "profile_session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_session_id" TEXT NOT NULL,
    "profile_dir" TEXT NOT NULL,
    "chrome_slave_id" TEXT,
    "state" TEXT NOT NULL DEFAULT 'stopped',
    "port" INTEGER,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    CONSTRAINT "profile_session_provider_session_id_fkey" FOREIGN KEY ("provider_session_id") REFERENCES "provider_session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_session_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "title" TEXT,
    "state" TEXT NOT NULL DEFAULT 'active',
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "last_message_at" INTEGER,
    "context_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    "project_id" TEXT,
    "topic_id" TEXT,
    "source" TEXT NOT NULL DEFAULT 'live',
    "external_id" TEXT,
    "import_job_id" TEXT,
    CONSTRAINT "conversation_provider_session_id_fkey" FOREIGN KEY ("provider_session_id") REFERENCES "provider_session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "conversation_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "conversation_message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT,
    "blocks_json" TEXT NOT NULL DEFAULT '[]',
    "block_count" INTEGER NOT NULL DEFAULT 0,
    "parent_message_id" TEXT,
    "sequence_index" INTEGER NOT NULL DEFAULT 0,
    "latency_ms" INTEGER,
    "token_count" INTEGER,
    "model" TEXT,
    "metadata_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" INTEGER NOT NULL,
    CONSTRAINT "conversation_message_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "conversation_message_parent_message_id_fkey" FOREIGN KEY ("parent_message_id") REFERENCES "conversation_message" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "state_transition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "from_state" TEXT,
    "to_state" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "metadata_json" TEXT NOT NULL DEFAULT '{}',
    "ts" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "session_checkpoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vivim_session_id" TEXT NOT NULL,
    "checkpoint_json" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL,
    CONSTRAINT "session_checkpoint_vivim_session_id_fkey" FOREIGN KEY ("vivim_session_id") REFERENCES "vivim_session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "stream_block" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "block_index" INTEGER NOT NULL,
    "block_kind" TEXT NOT NULL,
    "block_data" TEXT NOT NULL,
    "block_meta" TEXT NOT NULL DEFAULT '{}',
    "created_at" INTEGER NOT NULL,
    CONSTRAINT "stream_block_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "stream_block_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "conversation_message" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "provider_manifest_version" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "manifest_file" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "hash" TEXT NOT NULL,
    "content_json" TEXT NOT NULL,
    "change_summary" TEXT,
    "actor" TEXT NOT NULL DEFAULT 'system',
    "created_at" INTEGER NOT NULL,
    CONSTRAINT "provider_manifest_version_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "registration_event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "manifest_version_id" TEXT,
    "event_type" TEXT NOT NULL,
    "table_name" TEXT NOT NULL,
    "record_id" TEXT,
    "field_name" TEXT,
    "from_value" TEXT,
    "to_value" TEXT,
    "change_summary" TEXT,
    "actor" TEXT NOT NULL DEFAULT 'system',
    "ts" INTEGER NOT NULL,
    CONSTRAINT "registration_event_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "manifest_drift" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "drift_type" TEXT NOT NULL,
    "table_name" TEXT,
    "record_id" TEXT,
    "seed_value" TEXT,
    "db_value" TEXT,
    "resolved" INTEGER NOT NULL DEFAULT 0,
    "resolved_by_actor" TEXT,
    "resolved_at" INTEGER,
    "detected_at" INTEGER NOT NULL,
    CONSTRAINT "manifest_drift_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "capability_taxonomy_version" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "capability_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot_json" TEXT NOT NULL,
    "change_summary" TEXT,
    "changed_fields_json" TEXT NOT NULL DEFAULT '[]',
    "actor" TEXT NOT NULL DEFAULT 'system',
    "created_at" INTEGER NOT NULL,
    CONSTRAINT "capability_taxonomy_version_capability_id_fkey" FOREIGN KEY ("capability_id") REFERENCES "capability_taxonomy" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "binding_status_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "binding_id" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "from_program_id" TEXT,
    "to_program_id" TEXT,
    "trigger" TEXT NOT NULL,
    "confidence_at_transition" REAL,
    "success_rate_at_transition" REAL,
    "reason" TEXT,
    "actor" TEXT NOT NULL DEFAULT 'system',
    "metadata_json" TEXT NOT NULL DEFAULT '{}',
    "ts" INTEGER NOT NULL,
    CONSTRAINT "binding_status_log_binding_id_fkey" FOREIGN KEY ("binding_id") REFERENCES "capability_binding" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "program_version_metric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "binding_id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "program_version" INTEGER NOT NULL,
    "total_executions" INTEGER NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "fail_count" INTEGER NOT NULL DEFAULT 0,
    "avg_latency_ms" REAL NOT NULL DEFAULT 0,
    "p50_latency_ms" REAL NOT NULL DEFAULT 0,
    "p95_latency_ms" REAL NOT NULL DEFAULT 0,
    "p99_latency_ms" REAL NOT NULL DEFAULT 0,
    "last_executed_at" INTEGER,
    "first_executed_at" INTEGER,
    "window_1h_total" INTEGER NOT NULL DEFAULT 0,
    "window_1h_success" INTEGER NOT NULL DEFAULT 0,
    "window_24h_total" INTEGER NOT NULL DEFAULT 0,
    "window_24h_success" INTEGER NOT NULL DEFAULT 0,
    "window_7d_total" INTEGER NOT NULL DEFAULT 0,
    "window_7d_success" INTEGER NOT NULL DEFAULT 0,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    CONSTRAINT "program_version_metric_binding_id_fkey" FOREIGN KEY ("binding_id") REFERENCES "capability_binding" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "program_version_metric_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "capability_program" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "provider_health_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "runtime_state" TEXT NOT NULL,
    "active_sessions" INTEGER NOT NULL DEFAULT 0,
    "total_conversations" INTEGER NOT NULL DEFAULT 0,
    "total_messages" INTEGER NOT NULL DEFAULT 0,
    "capability_executions" INTEGER NOT NULL DEFAULT 0,
    "capability_successes" INTEGER NOT NULL DEFAULT 0,
    "capability_failures" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "parser_confidence_avg" REAL,
    "selector_hit_rate_avg" REAL,
    "avg_response_latency_ms" REAL,
    "p50_response_latency_ms" REAL,
    "p95_response_latency_ms" REAL,
    "p99_response_latency_ms" REAL,
    "circuit_breaker_state" TEXT,
    "fleet_restarts" INTEGER NOT NULL DEFAULT 0,
    "drift_events_unresolved" INTEGER NOT NULL DEFAULT 0,
    "window_start_ts" INTEGER NOT NULL,
    "window_end_ts" INTEGER NOT NULL,
    "snapshot_ts" INTEGER NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "provider_health_history_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "capability_telemetry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "capability_id" TEXT NOT NULL,
    "binding_id" TEXT,
    "provider_id" TEXT NOT NULL,
    "program_id" TEXT,
    "total_executions" INTEGER NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "fail_count" INTEGER NOT NULL DEFAULT 0,
    "avg_latency_ms" REAL NOT NULL DEFAULT 0,
    "p50_latency_ms" REAL NOT NULL DEFAULT 0,
    "p95_latency_ms" REAL NOT NULL DEFAULT 0,
    "last_executed_at" INTEGER,
    "last_error" TEXT,
    "last_error_ts" INTEGER,
    "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
    "window_1h_executions" INTEGER NOT NULL DEFAULT 0,
    "window_1h_success_count" INTEGER NOT NULL DEFAULT 0,
    "window_24h_executions" INTEGER NOT NULL DEFAULT 0,
    "window_24h_success_count" INTEGER NOT NULL DEFAULT 0,
    "window_7d_executions" INTEGER NOT NULL DEFAULT 0,
    "window_7d_success_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    CONSTRAINT "capability_telemetry_capability_id_fkey" FOREIGN KEY ("capability_id") REFERENCES "capability_taxonomy" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "capability_telemetry_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "selector_health_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "selector_strategy_id" TEXT NOT NULL,
    "binding_id" TEXT NOT NULL,
    "hit_count" INTEGER NOT NULL DEFAULT 0,
    "miss_count" INTEGER NOT NULL DEFAULT 0,
    "hit_rate" REAL NOT NULL DEFAULT 0,
    "avg_duration_ms" REAL NOT NULL DEFAULT 0,
    "p95_duration_ms" REAL NOT NULL DEFAULT 0,
    "window_start_ts" INTEGER NOT NULL,
    "window_end_ts" INTEGER NOT NULL,
    "snapshot_ts" INTEGER NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "selector_health_history_selector_strategy_id_fkey" FOREIGN KEY ("selector_strategy_id") REFERENCES "selector_strategy" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "selector_health_history_binding_id_fkey" FOREIGN KEY ("binding_id") REFERENCES "capability_binding" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "telemetry_summary_daily" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "day_ts" TEXT NOT NULL,
    "total_conversations" INTEGER NOT NULL DEFAULT 0,
    "total_conversations_created" INTEGER NOT NULL DEFAULT 0,
    "total_messages_sent" INTEGER NOT NULL DEFAULT 0,
    "total_capability_executions" INTEGER NOT NULL DEFAULT 0,
    "total_capability_successes" INTEGER NOT NULL DEFAULT 0,
    "total_capability_failures" INTEGER NOT NULL DEFAULT 0,
    "total_errors" INTEGER NOT NULL DEFAULT 0,
    "avg_response_latency_ms" REAL NOT NULL DEFAULT 0,
    "p95_response_latency_ms" REAL NOT NULL DEFAULT 0,
    "peak_concurrent_sessions" INTEGER NOT NULL DEFAULT 0,
    "peak_concurrent_slaves" INTEGER NOT NULL DEFAULT 0,
    "parser_health_events" INTEGER NOT NULL DEFAULT 0,
    "circuit_breaker_opens" INTEGER NOT NULL DEFAULT 0,
    "circuit_breaker_resets" INTEGER NOT NULL DEFAULT 0,
    "drift_events" INTEGER NOT NULL DEFAULT 0,
    "drift_resolved" INTEGER NOT NULL DEFAULT 0,
    "fleet_restarts" INTEGER NOT NULL DEFAULT 0,
    "manifest_changes" INTEGER NOT NULL DEFAULT 0,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "telemetry_summary_daily_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "manifest_change_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "change_type" TEXT NOT NULL,
    "file_path" TEXT,
    "old_hash" TEXT,
    "new_hash" TEXT,
    "tables_affected_json" TEXT NOT NULL DEFAULT '[]',
    "rows_added" INTEGER NOT NULL DEFAULT 0,
    "rows_modified" INTEGER NOT NULL DEFAULT 0,
    "rows_removed" INTEGER NOT NULL DEFAULT 0,
    "actor" TEXT NOT NULL DEFAULT 'system',
    "manifest_version_id" TEXT,
    "ts" INTEGER NOT NULL,
    CONSTRAINT "manifest_change_log_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "telemetry_cycle_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schedule_name" TEXT NOT NULL,
    "rows_written" INTEGER NOT NULL DEFAULT 0,
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "ts" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "config_entry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "engine_id" TEXT NOT NULL,
    "scope_type" TEXT NOT NULL,
    "scope_id" TEXT,
    "config_json" TEXT NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "config_audit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "engine_id" TEXT NOT NULL,
    "entry_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "from_json" TEXT,
    "to_json" TEXT,
    "actor" TEXT NOT NULL DEFAULT 'system',
    "ts" INTEGER NOT NULL,
    CONSTRAINT "config_audit_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "config_entry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "harness_checkpoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slave_id" TEXT NOT NULL,
    "conversation_id" TEXT,
    "active_dag_json" TEXT,
    "dag_position" INTEGER,
    "loaded_modules_json" TEXT NOT NULL DEFAULT '[]',
    "page_url" TEXT,
    "page_title" TEXT,
    "auth_state" TEXT,
    "created_at" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "capability_macro" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "provider_id" TEXT,
    "dag_json" TEXT NOT NULL,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    CONSTRAINT "capability_macro_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mcp_server_config" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "enabled" INTEGER NOT NULL DEFAULT 0,
    "port" INTEGER NOT NULL DEFAULT 0,
    "tools_json" TEXT NOT NULL DEFAULT '[]',
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "health_tick" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "slave_id" TEXT,
    "status" TEXT NOT NULL,
    "response_ms" INTEGER,
    "error" TEXT,
    "ts" INTEGER NOT NULL,
    CONSTRAINT "health_tick_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "circuit_breaker_state" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slave_id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "fail_count" INTEGER NOT NULL DEFAULT 0,
    "last_fail_at" INTEGER,
    "last_success_at" INTEGER,
    "opened_at" INTEGER,
    "half_opened_at" INTEGER,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "drift_event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "capability_id" TEXT,
    "binding_id" TEXT,
    "drift_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "description" TEXT,
    "resolved" INTEGER NOT NULL DEFAULT 0,
    "detected_at" INTEGER NOT NULL,
    "resolved_at" INTEGER,
    CONSTRAINT "drift_event_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "fleet_event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slave_id" TEXT NOT NULL,
    "provider_id" TEXT,
    "event_type" TEXT NOT NULL,
    "event_data_json" TEXT NOT NULL DEFAULT '{}',
    "ts" INTEGER NOT NULL,
    CONSTRAINT "fleet_event_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "provider_health" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "overall_status" TEXT NOT NULL DEFAULT 'unknown',
    "overall_score" REAL NOT NULL DEFAULT 0,
    "signals_json" TEXT NOT NULL DEFAULT '{}',
    "parser_confidence_avg" REAL,
    "selector_hit_rate_avg" REAL,
    "fleet_running" INTEGER NOT NULL DEFAULT 0,
    "fleet_stopped" INTEGER NOT NULL DEFAULT 0,
    "fleet_error" INTEGER NOT NULL DEFAULT 0,
    "circuit_open" INTEGER NOT NULL DEFAULT 0,
    "drift_recent" INTEGER NOT NULL DEFAULT 0,
    "drift_unresolved" INTEGER NOT NULL DEFAULT 0,
    "last_check_at" INTEGER,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    CONSTRAINT "provider_health_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "automation_schedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "schedule_type" TEXT NOT NULL,
    "schedule_value" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "action_config_json" TEXT NOT NULL DEFAULT '{}',
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "last_run_at" INTEGER,
    "next_run_at" INTEGER,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "automation_run" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schedule_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "result_json" TEXT,
    "error" TEXT,
    "started_at" INTEGER NOT NULL,
    "completed_at" INTEGER,
    CONSTRAINT "automation_run_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "automation_schedule" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "alert_condition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "provider_id" TEXT,
    "metric" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "threshold" REAL NOT NULL,
    "window_s" INTEGER NOT NULL DEFAULT 300,
    "cooldown_s" INTEGER NOT NULL DEFAULT 600,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    CONSTRAINT "alert_condition_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "alert_event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "condition_id" TEXT NOT NULL,
    "provider_id" TEXT,
    "metric_value" REAL,
    "threshold" REAL,
    "fired_at" INTEGER NOT NULL,
    "acknowledged" INTEGER NOT NULL DEFAULT 0,
    "acknowledged_at" INTEGER,
    "acknowledged_by" TEXT,
    CONSTRAINT "alert_event_condition_id_fkey" FOREIGN KEY ("condition_id") REFERENCES "alert_condition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "route_spec" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "capability_id" TEXT NOT NULL,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "config_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    CONSTRAINT "route_spec_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "route_spec_capability_id_fkey" FOREIGN KEY ("capability_id") REFERENCES "capability_taxonomy" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "route_request" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "route_spec_id" TEXT NOT NULL,
    "conversation_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result_json" TEXT,
    "ts" INTEGER NOT NULL,
    CONSTRAINT "route_request_route_spec_id_fkey" FOREIGN KEY ("route_spec_id") REFERENCES "route_spec" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "route_target" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "route_spec_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "account_id" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "created_at" INTEGER NOT NULL,
    CONSTRAINT "route_target_route_spec_id_fkey" FOREIGN KEY ("route_spec_id") REFERENCES "route_spec" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "route_event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "route_request_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_data_json" TEXT NOT NULL DEFAULT '{}',
    "ts" INTEGER NOT NULL,
    CONSTRAINT "route_event_route_request_id_fkey" FOREIGN KEY ("route_request_id") REFERENCES "route_request" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "transfer_pattern" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "from_provider_id" TEXT NOT NULL,
    "to_provider_id" TEXT NOT NULL,
    "capability_id" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 0.0,
    "last_transferred_at" INTEGER,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    CONSTRAINT "transfer_pattern_from_provider_id_fkey" FOREIGN KEY ("from_provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "transfer_pattern_to_provider_id_fkey" FOREIGN KEY ("to_provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "transfer_pattern_capability_id_fkey" FOREIGN KEY ("capability_id") REFERENCES "capability_taxonomy" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "transfer_candidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transfer_pattern_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "metadata_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" INTEGER NOT NULL,
    CONSTRAINT "transfer_candidate_transfer_pattern_id_fkey" FOREIGN KEY ("transfer_pattern_id") REFERENCES "transfer_pattern" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "transfer_attempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transfer_candidate_id" TEXT NOT NULL,
    "ok" INTEGER NOT NULL DEFAULT 0,
    "result_json" TEXT,
    "error" TEXT,
    "duration_ms" INTEGER,
    "ts" INTEGER NOT NULL,
    CONSTRAINT "transfer_attempt_transfer_candidate_id_fkey" FOREIGN KEY ("transfer_candidate_id") REFERENCES "transfer_candidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "learning_event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "capability_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "data_json" TEXT NOT NULL DEFAULT '{}',
    "ts" INTEGER NOT NULL,
    CONSTRAINT "learning_event_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "learning_event_capability_id_fkey" FOREIGN KEY ("capability_id") REFERENCES "capability_taxonomy" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "rule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "rule_type" TEXT NOT NULL,
    "condition_json" TEXT NOT NULL DEFAULT '{}',
    "action_json" TEXT NOT NULL DEFAULT '{}',
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "confidence" REAL NOT NULL DEFAULT 0.0,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "binding_event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "binding_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "data_json" TEXT NOT NULL DEFAULT '{}',
    "ts" INTEGER NOT NULL,
    CONSTRAINT "binding_event_binding_id_fkey" FOREIGN KEY ("binding_id") REFERENCES "capability_binding" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "failure_classification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "outcome_id" TEXT NOT NULL,
    "failure_type" TEXT NOT NULL,
    "is_recoverable" INTEGER NOT NULL DEFAULT 0,
    "suggested_action" TEXT,
    "ts" INTEGER NOT NULL,
    CONSTRAINT "failure_classification_outcome_id_fkey" FOREIGN KEY ("outcome_id") REFERENCES "outcome" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "test_run" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "capability_id" TEXT,
    "binding_id" TEXT,
    "provider_id" TEXT,
    "test_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "result_json" TEXT,
    "started_at" INTEGER NOT NULL,
    "completed_at" INTEGER
);

-- CreateTable
CREATE TABLE "capability_shape" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "expected_caps_json" TEXT NOT NULL,
    "discovery_hints_json" TEXT NOT NULL,
    "projection_rules_json" TEXT NOT NULL,
    "parser_expectations_json" TEXT NOT NULL,
    "is_built_in" INTEGER NOT NULL DEFAULT 0,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "capability_shape_binding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shape_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "capability_id" TEXT NOT NULL,
    "mapping_json" TEXT NOT NULL,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "created_at" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "provider_archetype" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shape_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "manifest_json" TEXT NOT NULL,
    "is_default" INTEGER NOT NULL DEFAULT 0,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "provider_shape_binding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "archetype_id" TEXT NOT NULL,
    "shape_id" TEXT NOT NULL,
    "config_json" TEXT,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "created_at" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "discovery_session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'started',
    "shape_id" TEXT,
    "confidence" REAL NOT NULL DEFAULT 0,
    "capabilities_json" TEXT NOT NULL,
    "interactive_json" TEXT NOT NULL,
    "parser_format" TEXT,
    "manifest_draft_json" TEXT,
    "error" TEXT,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "discovery_result" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "provider_id" TEXT,
    "approved_by" TEXT,
    "manifest_json" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "mirror_state" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_id" TEXT NOT NULL,
    "chrome_state_json" TEXT,
    "ui_state_json" TEXT,
    "pending_ops_json" TEXT,
    "last_sync_at" INTEGER NOT NULL,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "optimistic_update" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "expected_state_json" TEXT NOT NULL,
    "actual_state_json" TEXT,
    "confirmed" INTEGER NOT NULL DEFAULT 0,
    "created_at" INTEGER NOT NULL,
    "resolved_at" INTEGER
);

-- CreateTable
CREATE TABLE "latency_measurement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_id" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "timestamp" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "mirror_snapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_id" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "state_json" TEXT NOT NULL,
    "timestamp" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "observation_event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_id" TEXT NOT NULL,
    "slave_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "data_json" TEXT NOT NULL,
    "timestamp" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "workflow_definition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "nodes_json" TEXT NOT NULL,
    "edges_json" TEXT NOT NULL,
    "variables_json" TEXT,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "workflow_node" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflow_id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "config_json" TEXT NOT NULL,
    "position_x" INTEGER,
    "position_y" INTEGER
);

-- CreateTable
CREATE TABLE "workflow_edge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflow_id" TEXT NOT NULL,
    "edge_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "condition" TEXT
);

-- CreateTable
CREATE TABLE "workflow_execution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflow_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "input_json" TEXT,
    "output_json" TEXT,
    "started_at" INTEGER NOT NULL,
    "completed_at" INTEGER
);

-- CreateTable
CREATE TABLE "workflow_node_execution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "execution_id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "input_json" TEXT,
    "output_json" TEXT,
    "error" TEXT,
    "started_at" INTEGER,
    "completed_at" INTEGER
);

-- CreateTable
CREATE TABLE "workflow_webhook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflow_id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "secret" TEXT,
    "created_at" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "workflow_credential" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflow_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value_encrypted" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "mcp_tool" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "server_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "input_schema_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "mcp_tool_call" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "server_id" TEXT NOT NULL,
    "tool_name" TEXT NOT NULL,
    "input_json" TEXT NOT NULL,
    "output_json" TEXT,
    "success" BOOLEAN NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "created_at" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "episodic_memory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "capability_id" TEXT,
    "slave_id" TEXT,
    "action" TEXT NOT NULL,
    "input_json" TEXT NOT NULL,
    "output_json" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "tags_json" TEXT NOT NULL DEFAULT '[]',
    "timestamp" INTEGER NOT NULL,
    "created_at" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "semantic_memory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subject" TEXT NOT NULL,
    "predicate" TEXT NOT NULL,
    "object_json" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 1.0,
    "source" TEXT NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "expires_at" INTEGER,
    "created_at" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "procedural_rule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 0.5,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "last_triggered" INTEGER,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "agent_decision_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agent_id" TEXT NOT NULL,
    "decision_type" TEXT NOT NULL,
    "input_json" TEXT NOT NULL,
    "output_json" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "reasoning" TEXT,
    "timestamp" INTEGER NOT NULL,
    "created_at" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "agent_loop_run" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agent_id" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "input_json" TEXT,
    "output_json" TEXT,
    "started_at" INTEGER NOT NULL,
    "completed_at" INTEGER
);

-- CreateTable
CREATE TABLE "agent_step" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "run_id" TEXT NOT NULL,
    "step_index" INTEGER NOT NULL,
    "action_type" TEXT NOT NULL,
    "action_json" TEXT NOT NULL,
    "result_json" TEXT,
    "success" BOOLEAN NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "created_at" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "entity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "description" TEXT,
    "confidence" REAL NOT NULL DEFAULT 0.5,
    "mention_count" INTEGER NOT NULL DEFAULT 0,
    "first_seen_at" INTEGER NOT NULL,
    "last_seen_at" INTEGER NOT NULL,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "entity_mention" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 0.5,
    "ts" INTEGER NOT NULL,
    CONSTRAINT "entity_mention_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "decision_record" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "decision_text" TEXT NOT NULL,
    "rationale" TEXT,
    "alternatives_json" TEXT NOT NULL DEFAULT '[]',
    "confidence" REAL NOT NULL DEFAULT 0.5,
    "ts" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "pattern_extract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "pattern_type" TEXT NOT NULL,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "confidence" REAL NOT NULL DEFAULT 0.5,
    "first_seen_at" INTEGER NOT NULL,
    "last_seen_at" INTEGER NOT NULL,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "topic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "conversation_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "conversation_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "conversation_topic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 0.5,
    "assigned_at" INTEGER NOT NULL,
    "assigned_by" TEXT NOT NULL DEFAULT 'auto'
);

-- CreateTable
CREATE TABLE "import_job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "import_source" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "config_json" TEXT NOT NULL DEFAULT '{}',
    "result_json" TEXT,
    "error" TEXT,
    "started_at" INTEGER NOT NULL,
    "completed_at" INTEGER
);

-- CreateTable
CREATE TABLE "memory_embedding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "embedding" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "dimensions" INTEGER NOT NULL,
    "content_hash" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "provider_definition_slug_key" ON "provider_definition"("slug");

-- CreateIndex
CREATE INDEX "idx_pe_provider" ON "provider_endpoint"("provider_id");

-- CreateIndex
CREATE INDEX "idx_pp_provider" ON "provider_parser"("provider_id");

-- CreateIndex
CREATE INDEX "idx_pc_provider" ON "provider_capability"("provider_id");

-- CreateIndex
CREATE INDEX "idx_pc_cap" ON "provider_capability"("global_capability_id");

-- CreateIndex
CREATE INDEX "idx_pc_confidence" ON "provider_capability"("provider_id", "confidence");

-- CreateIndex
CREATE INDEX "idx_pc_selector" ON "provider_capability"("provider_id", "selector_hit_count");

-- CreateIndex
CREATE UNIQUE INDEX "provider_capability_provider_id_global_capability_id_key" ON "provider_capability"("provider_id", "global_capability_id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_config_provider_id_config_key_key" ON "provider_config"("provider_id", "config_key");

-- CreateIndex
CREATE UNIQUE INDEX "provider_model_provider_id_model_slug_key" ON "provider_model"("provider_id", "model_slug");

-- CreateIndex
CREATE INDEX "idx_pa_provider" ON "provider_account"("provider_id");

-- CreateIndex
CREATE INDEX "idx_pa_email" ON "provider_account"("email");

-- CreateIndex
CREATE INDEX "idx_pa_login" ON "provider_account"("login_state");

-- CreateIndex
CREATE UNIQUE INDEX "provider_account_provider_id_email_key" ON "provider_account"("provider_id", "email");

-- CreateIndex
CREATE INDEX "idx_te_engine" ON "trace_entry"("engine", "ts");

-- CreateIndex
CREATE INDEX "idx_te_conv" ON "trace_entry"("conversation_id", "ts");

-- CreateIndex
CREATE INDEX "idx_te_provider" ON "trace_entry"("provider_id", "ts");

-- CreateIndex
CREATE INDEX "idx_te_slave" ON "trace_entry"("slave_id", "ts");

-- CreateIndex
CREATE UNIQUE INDEX "capability_taxonomy_slug_key" ON "capability_taxonomy"("slug");

-- CreateIndex
CREATE INDEX "idx_ct_category" ON "capability_taxonomy"("category");

-- CreateIndex
CREATE INDEX "idx_ct_position" ON "capability_taxonomy"("ui_position", "ui_group", "ui_order");

-- CreateIndex
CREATE INDEX "idx_ct_slug" ON "capability_taxonomy"("slug");

-- CreateIndex
CREATE INDEX "idx_ct_parent" ON "capability_taxonomy"("parent_capability_id");

-- CreateIndex
CREATE INDEX "idx_ct_classification" ON "capability_taxonomy"("op_classification");

-- CreateIndex
CREATE UNIQUE INDEX "capability_tier_capability_id_plan_tier_key" ON "capability_tier"("capability_id", "plan_tier");

-- CreateIndex
CREATE INDEX "idx_cb_provider" ON "capability_binding"("provider_id");

-- CreateIndex
CREATE INDEX "idx_cb_status" ON "capability_binding"("status");

-- CreateIndex
CREATE INDEX "idx_cb_global" ON "capability_binding"("global_id");

-- CreateIndex
CREATE UNIQUE INDEX "capability_binding_global_id_provider_id_key" ON "capability_binding"("global_id", "provider_id");

-- CreateIndex
CREATE INDEX "idx_cp_binding" ON "capability_program"("binding_id");

-- CreateIndex
CREATE INDEX "idx_ss_cap" ON "selector_strategy"("capability_id", "provider_id");

-- CreateIndex
CREATE INDEX "idx_ss_provider" ON "selector_strategy"("provider_id");

-- CreateIndex
CREATE INDEX "idx_o_provider" ON "outcome"("provider_id", "ts");

-- CreateIndex
CREATE INDEX "idx_o_cap" ON "outcome"("capability_id", "ts");

-- CreateIndex
CREATE INDEX "idx_o_ok" ON "outcome"("ok", "ts");

-- CreateIndex
CREATE INDEX "idx_o_ts" ON "outcome"("ts");

-- CreateIndex
CREATE INDEX "idx_ps_session" ON "provider_session"("vivim_session_id");

-- CreateIndex
CREATE INDEX "idx_prs_session" ON "profile_session"("provider_session_id");

-- CreateIndex
CREATE INDEX "idx_conv_session" ON "conversation"("provider_session_id");

-- CreateIndex
CREATE INDEX "idx_conv_provider" ON "conversation"("provider_id");

-- CreateIndex
CREATE INDEX "conversation_source_idx" ON "conversation"("source");

-- CreateIndex
CREATE INDEX "conversation_external_id_idx" ON "conversation"("external_id");

-- CreateIndex
CREATE INDEX "conversation_import_job_id_idx" ON "conversation"("import_job_id");

-- CreateIndex
CREATE INDEX "idx_cm_conv" ON "conversation_message"("conversation_id", "sequence_index");

-- CreateIndex
CREATE INDEX "idx_st_entity" ON "state_transition"("entity_type", "entity_id", "ts");

-- CreateIndex
CREATE INDEX "idx_sc_session" ON "session_checkpoint"("vivim_session_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_sb_conv" ON "stream_block"("conversation_id", "message_id", "block_index");

-- CreateIndex
CREATE INDEX "idx_sb_message" ON "stream_block"("message_id");

-- CreateIndex
CREATE INDEX "idx_sb_kind" ON "stream_block"("conversation_id", "block_kind");

-- CreateIndex
CREATE UNIQUE INDEX "stream_block_conversation_id_message_id_block_index_key" ON "stream_block"("conversation_id", "message_id", "block_index");

-- CreateIndex
CREATE INDEX "idx_pmv_provider" ON "provider_manifest_version"("provider_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "provider_manifest_version_provider_id_manifest_file_version_key" ON "provider_manifest_version"("provider_id", "manifest_file", "version");

-- CreateIndex
CREATE INDEX "idx_re_provider" ON "registration_event"("provider_id", "ts");

-- CreateIndex
CREATE INDEX "idx_re_type" ON "registration_event"("event_type");

-- CreateIndex
CREATE INDEX "idx_re_table" ON "registration_event"("table_name");

-- CreateIndex
CREATE INDEX "idx_md_provider" ON "manifest_drift"("provider_id", "resolved", "detected_at");

-- CreateIndex
CREATE INDEX "idx_ctv_cap" ON "capability_taxonomy_version"("capability_id", "version");

-- CreateIndex
CREATE INDEX "idx_ctv_created" ON "capability_taxonomy_version"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "capability_taxonomy_version_capability_id_version_key" ON "capability_taxonomy_version"("capability_id", "version");

-- CreateIndex
CREATE INDEX "idx_bsl_binding" ON "binding_status_log"("binding_id", "ts");

-- CreateIndex
CREATE INDEX "idx_bsl_trigger" ON "binding_status_log"("trigger");

-- CreateIndex
CREATE INDEX "idx_bsl_ts" ON "binding_status_log"("ts");

-- CreateIndex
CREATE INDEX "idx_pvm_binding" ON "program_version_metric"("binding_id");

-- CreateIndex
CREATE INDEX "idx_pvm_program" ON "program_version_metric"("program_id");

-- CreateIndex
CREATE INDEX "idx_pvm_updated" ON "program_version_metric"("updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "program_version_metric_binding_id_program_id_program_version_key" ON "program_version_metric"("binding_id", "program_id", "program_version");

-- CreateIndex
CREATE INDEX "idx_phh_provider" ON "provider_health_history"("provider_id", "snapshot_ts");

-- CreateIndex
CREATE INDEX "idx_phh_window" ON "provider_health_history"("window_start_ts", "window_end_ts");

-- CreateIndex
CREATE INDEX "idx_captel_provider" ON "capability_telemetry"("provider_id");

-- CreateIndex
CREATE INDEX "idx_captel_capability" ON "capability_telemetry"("capability_id");

-- CreateIndex
CREATE INDEX "idx_captel_updated" ON "capability_telemetry"("updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "capability_telemetry_capability_id_binding_id_program_id_key" ON "capability_telemetry"("capability_id", "binding_id", "program_id");

-- CreateIndex
CREATE INDEX "idx_shh_selector" ON "selector_health_history"("selector_strategy_id", "snapshot_ts");

-- CreateIndex
CREATE INDEX "idx_shh_binding" ON "selector_health_history"("binding_id", "snapshot_ts");

-- CreateIndex
CREATE INDEX "idx_shh_window" ON "selector_health_history"("window_start_ts", "window_end_ts");

-- CreateIndex
CREATE INDEX "idx_tsd_provider" ON "telemetry_summary_daily"("provider_id", "day_ts");

-- CreateIndex
CREATE INDEX "idx_tsd_day" ON "telemetry_summary_daily"("day_ts");

-- CreateIndex
CREATE UNIQUE INDEX "telemetry_summary_daily_provider_id_day_ts_key" ON "telemetry_summary_daily"("provider_id", "day_ts");

-- CreateIndex
CREATE INDEX "idx_mcl_provider" ON "manifest_change_log"("provider_id", "ts");

-- CreateIndex
CREATE INDEX "idx_mcl_type" ON "manifest_change_log"("change_type");

-- CreateIndex
CREATE INDEX "idx_mcl_ts" ON "manifest_change_log"("ts");

-- CreateIndex
CREATE INDEX "idx_tcl_schedule" ON "telemetry_cycle_log"("schedule_name", "ts");

-- CreateIndex
CREATE INDEX "idx_ce_engine" ON "config_entry"("engine_id");

-- CreateIndex
CREATE UNIQUE INDEX "config_entry_engine_id_scope_type_scope_id_key" ON "config_entry"("engine_id", "scope_type", "scope_id");

-- CreateIndex
CREATE INDEX "idx_ca_engine" ON "config_audit"("engine_id", "ts");

-- CreateIndex
CREATE INDEX "idx_ca_entry" ON "config_audit"("entry_id", "ts");

-- CreateIndex
CREATE INDEX "idx_hc_slave" ON "harness_checkpoint"("slave_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_hc_conv" ON "harness_checkpoint"("conversation_id");

-- CreateIndex
CREATE INDEX "idx_cm_provider" ON "capability_macro"("provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_server_config_name_key" ON "mcp_server_config"("name");

-- CreateIndex
CREATE INDEX "idx_ht_provider" ON "health_tick"("provider_id", "ts");

-- CreateIndex
CREATE UNIQUE INDEX "circuit_breaker_state_slave_id_key" ON "circuit_breaker_state"("slave_id");

-- CreateIndex
CREATE INDEX "idx_de_provider" ON "drift_event"("provider_id", "detected_at");

-- CreateIndex
CREATE INDEX "idx_fe_slave" ON "fleet_event"("slave_id", "ts");

-- CreateIndex
CREATE INDEX "idx_fe_provider" ON "fleet_event"("provider_id", "ts");

-- CreateIndex
CREATE UNIQUE INDEX "provider_health_provider_id_key" ON "provider_health"("provider_id");

-- CreateIndex
CREATE INDEX "idx_ar_schedule" ON "automation_run"("schedule_id", "started_at");

-- CreateIndex
CREATE INDEX "idx_ae_condition" ON "alert_event"("condition_id", "fired_at");

-- CreateIndex
CREATE UNIQUE INDEX "mirror_state_conversation_id_key" ON "mirror_state"("conversation_id");

-- CreateIndex
CREATE INDEX "entity_entity_type_idx" ON "entity"("entity_type");

-- CreateIndex
CREATE UNIQUE INDEX "entity_name_entity_type_key" ON "entity"("name", "entity_type");

-- CreateIndex
CREATE INDEX "entity_mention_entity_id_idx" ON "entity_mention"("entity_id");

-- CreateIndex
CREATE INDEX "entity_mention_conversation_id_idx" ON "entity_mention"("conversation_id");

-- CreateIndex
CREATE INDEX "decision_record_conversation_id_idx" ON "decision_record"("conversation_id");

-- CreateIndex
CREATE UNIQUE INDEX "pattern_extract_name_pattern_type_key" ON "pattern_extract"("name", "pattern_type");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_topic_conversation_id_topic_id_key" ON "conversation_topic"("conversation_id", "topic_id");

-- CreateIndex
CREATE INDEX "import_job_import_source_idx" ON "import_job"("import_source");

-- CreateIndex
CREATE UNIQUE INDEX "memory_embedding_entity_type_entity_id_key" ON "memory_embedding"("entity_type", "entity_id");
