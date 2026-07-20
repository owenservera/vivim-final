-- ─────────────────────────────────────────────────────────────────
-- SQL Dump: dev.db
-- Source: C:\0-BlackBoxProject-0\vivim-final\prisma\dev.db
-- Generated: 2026-07-19T00:48:05.279Z
-- ─────────────────────────────────────────────────────────────────

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ── Schema: Tables ────────────────────────────────────────────────────

CREATE TABLE "SchemaMeta" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    PRIMARY KEY ("key", "value")
);

CREATE TABLE "_prisma_migrations" (
    "id"                    TEXT PRIMARY KEY NOT NULL,
    "checksum"              TEXT NOT NULL,
    "finished_at"           DATETIME,
    "migration_name"        TEXT NOT NULL,
    "logs"                  TEXT,
    "rolled_back_at"        DATETIME,
    "started_at"            DATETIME NOT NULL DEFAULT current_timestamp,
    "applied_steps_count"   INTEGER UNSIGNED NOT NULL DEFAULT 0
);

CREATE TABLE "agent_decision_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agent_id" TEXT NOT NULL,
    "decision_type" TEXT NOT NULL,
    "input_json" TEXT NOT NULL,
    "output_json" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "reasoning" TEXT,
    "timestamp" INTEGER NOT NULL,
    "created_at" BIGINT NOT NULL
);

CREATE TABLE "agent_loop_run" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agent_id" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "input_json" TEXT,
    "output_json" TEXT,
    "started_at" BIGINT NOT NULL,
    "completed_at" BIGINT
);

CREATE TABLE "agent_step" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "run_id" TEXT NOT NULL,
    "step_index" INTEGER NOT NULL,
    "action_type" TEXT NOT NULL,
    "action_json" TEXT NOT NULL,
    "result_json" TEXT,
    "success" BOOLEAN NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "created_at" BIGINT NOT NULL
);

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
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
    CONSTRAINT "alert_condition_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "alert_event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "condition_id" TEXT NOT NULL,
    "provider_id" TEXT,
    "metric_value" REAL,
    "threshold" REAL,
    "fired_at" BIGINT NOT NULL,
    "acknowledged" INTEGER NOT NULL DEFAULT 0,
    "acknowledged_at" BIGINT,
    "acknowledged_by" TEXT,
    CONSTRAINT "alert_event_condition_id_fkey" FOREIGN KEY ("condition_id") REFERENCES "alert_condition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "automation_run" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schedule_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "result_json" TEXT,
    "error" TEXT,
    "started_at" BIGINT NOT NULL,
    "completed_at" BIGINT,
    CONSTRAINT "automation_run_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "automation_schedule" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "automation_schedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "schedule_type" TEXT NOT NULL,
    "schedule_value" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "action_config_json" TEXT NOT NULL DEFAULT '{}',
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "last_run_at" BIGINT,
    "next_run_at" BIGINT,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

CREATE TABLE "autonomous_step" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "task_id" TEXT NOT NULL,
    "step_index" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "action_input_json" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result_json" TEXT,
    "error" TEXT,
    "started_at" BIGINT,
    "completed_at" BIGINT,
    "requires_human_approval" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "autonomous_step_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "autonomous_task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "autonomous_task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "goal_json" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result_json" TEXT,
    "error" TEXT,
    "started_at" BIGINT NOT NULL,
    "completed_at" BIGINT
);

CREATE TABLE "binding_event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "binding_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "data_json" TEXT NOT NULL DEFAULT '{}',
    "ts" BIGINT NOT NULL,
    CONSTRAINT "binding_event_binding_id_fkey" FOREIGN KEY ("binding_id") REFERENCES "capability_binding" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "ts" BIGINT NOT NULL,
    CONSTRAINT "binding_status_log_binding_id_fkey" FOREIGN KEY ("binding_id") REFERENCES "capability_binding" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "capability_binding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "global_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'prospect',
    "best_program_id" TEXT,
    "current_program_id" TEXT,
    "promotion_history_json" TEXT NOT NULL DEFAULT '[]',
    "confidence" REAL NOT NULL DEFAULT 0.0,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
    CONSTRAINT "capability_binding_global_id_fkey" FOREIGN KEY ("global_id") REFERENCES "capability_taxonomy" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "capability_binding_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "capability_intent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "capability_id" TEXT NOT NULL,
    "intent_text" TEXT NOT NULL,
    "patterns_json" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 1.0,
    "is_primary" INTEGER NOT NULL DEFAULT 0,
    "created_at" BIGINT NOT NULL,
    CONSTRAINT "capability_intent_capability_id_fkey" FOREIGN KEY ("capability_id") REFERENCES "capability_taxonomy" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "capability_macro" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "provider_id" TEXT,
    "dag_json" TEXT NOT NULL,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
    CONSTRAINT "capability_macro_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "capability_override" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "capability_id" TEXT NOT NULL,
    "override_type" TEXT NOT NULL,
    "override_json" TEXT NOT NULL,
    "created_at" BIGINT NOT NULL,
    CONSTRAINT "capability_override_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "capability_override_capability_id_fkey" FOREIGN KEY ("capability_id") REFERENCES "capability_taxonomy" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "capability_program" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "binding_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT,
    "superseded_by" TEXT,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "config_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
    CONSTRAINT "capability_program_binding_id_fkey" FOREIGN KEY ("binding_id") REFERENCES "capability_binding" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "capability_program_superseded_by_fkey" FOREIGN KEY ("superseded_by") REFERENCES "capability_program" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "capability_shape" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "expected_caps_json" TEXT NOT NULL,
    "discovery_hints_json" TEXT NOT NULL,
    "projection_rules_json" TEXT NOT NULL,
    "parser_expectations_json" TEXT NOT NULL,
    "is_built_in" INTEGER NOT NULL DEFAULT 0,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

CREATE TABLE "capability_shape_binding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shape_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "capability_id" TEXT NOT NULL,
    "mapping_json" TEXT NOT NULL,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "created_at" BIGINT NOT NULL
);

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
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
    CONSTRAINT "capability_taxonomy_parent_capability_id_fkey" FOREIGN KEY ("parent_capability_id") REFERENCES "capability_taxonomy" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "capability_taxonomy_version" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "capability_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot_json" TEXT NOT NULL,
    "change_summary" TEXT,
    "changed_fields_json" TEXT NOT NULL DEFAULT '[]',
    "actor" TEXT NOT NULL DEFAULT 'system',
    "created_at" BIGINT NOT NULL,
    CONSTRAINT "capability_taxonomy_version_capability_id_fkey" FOREIGN KEY ("capability_id") REFERENCES "capability_taxonomy" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "last_executed_at" BIGINT,
    "last_error" TEXT,
    "last_error_ts" BIGINT,
    "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
    "window_1h_executions" INTEGER NOT NULL DEFAULT 0,
    "window_1h_success_count" INTEGER NOT NULL DEFAULT 0,
    "window_24h_executions" INTEGER NOT NULL DEFAULT 0,
    "window_24h_success_count" INTEGER NOT NULL DEFAULT 0,
    "window_7d_executions" INTEGER NOT NULL DEFAULT 0,
    "window_7d_success_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
    CONSTRAINT "capability_telemetry_capability_id_fkey" FOREIGN KEY ("capability_id") REFERENCES "capability_taxonomy" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "capability_telemetry_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
    CONSTRAINT "capability_tier_capability_id_fkey" FOREIGN KEY ("capability_id") REFERENCES "capability_taxonomy" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "circuit_breaker_state" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slave_id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "fail_count" INTEGER NOT NULL DEFAULT 0,
    "last_fail_at" BIGINT,
    "last_success_at" BIGINT,
    "opened_at" BIGINT,
    "half_opened_at" BIGINT,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

CREATE TABLE "config_audit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "engine_id" TEXT NOT NULL,
    "entry_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "from_json" TEXT,
    "to_json" TEXT,
    "actor" TEXT NOT NULL DEFAULT 'system',
    "ts" BIGINT NOT NULL,
    CONSTRAINT "config_audit_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "config_entry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "config_entry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "engine_id" TEXT NOT NULL,
    "scope_type" TEXT NOT NULL,
    "scope_id" TEXT,
    "config_json" TEXT NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

CREATE TABLE "content_unit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "message_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "unit_type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mime_type" TEXT,
    "metadata_json" TEXT NOT NULL DEFAULT '{}',
    "sequence_index" INTEGER NOT NULL DEFAULT 0,
    "quality_score" REAL,
    "created_at" BIGINT NOT NULL,
    CONSTRAINT "content_unit_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "conversation_message" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "context_budget_config" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL DEFAULT 'default',
    "max_context_tokens" INTEGER NOT NULL DEFAULT 128000,
    "response_style" TEXT NOT NULL DEFAULT 'balanced',
    "compression_strategy" TEXT NOT NULL DEFAULT 'auto',
    "system_layer_pct" REAL NOT NULL DEFAULT 0.10,
    "memory_layer_pct" REAL NOT NULL DEFAULT 0.15,
    "conversation_layer_pct" REAL NOT NULL DEFAULT 0.50,
    "situation_layer_pct" REAL NOT NULL DEFAULT 0.10,
    "reserve_pct" REAL NOT NULL DEFAULT 0.15,
    "enable_predictions" INTEGER NOT NULL DEFAULT 1,
    "enable_jit_retrieval" INTEGER NOT NULL DEFAULT 1,
    "enable_compression" INTEGER NOT NULL DEFAULT 1,
    "enable_entity_context" INTEGER NOT NULL DEFAULT 1,
    "enable_topic_context" INTEGER NOT NULL DEFAULT 1,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

CREATE TABLE "context_layer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_id" TEXT NOT NULL,
    "layer_name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "token_count" INTEGER NOT NULL,
    "priority" REAL NOT NULL,
    "sources_json" TEXT NOT NULL DEFAULT '[]',
    "assembled_at" BIGINT NOT NULL
);

CREATE TABLE "conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_session_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "title" TEXT,
    "state" TEXT NOT NULL DEFAULT 'active',
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "last_message_at" BIGINT,
    "context_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
    "project_id" TEXT,
    "topic_id" TEXT,
    "source" TEXT NOT NULL DEFAULT 'live',
    "external_id" TEXT,
    "import_job_id" TEXT,
    CONSTRAINT "conversation_provider_session_id_fkey" FOREIGN KEY ("provider_session_id") REFERENCES "provider_session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "conversation_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT,
    CONSTRAINT "conversation_message_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "conversation_message_parent_message_id_fkey" FOREIGN KEY ("parent_message_id") REFERENCES "conversation_message" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "conversation_topic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 0.5,
    "assigned_at" BIGINT NOT NULL,
    "assigned_by" TEXT NOT NULL DEFAULT 'auto'
);

CREATE TABLE "decision_record" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "decision_text" TEXT NOT NULL,
    "rationale" TEXT,
    "alternatives_json" TEXT NOT NULL DEFAULT '[]',
    "confidence" REAL NOT NULL DEFAULT 0.5,
    "ts" BIGINT NOT NULL
);

CREATE TABLE "discovery_result" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "provider_id" TEXT,
    "approved_by" TEXT,
    "manifest_json" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" BIGINT NOT NULL
);

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
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

CREATE TABLE "drift_event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "capability_id" TEXT,
    "binding_id" TEXT,
    "drift_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "description" TEXT,
    "resolved" INTEGER NOT NULL DEFAULT 0,
    "detected_at" BIGINT NOT NULL,
    "resolved_at" BIGINT,
    CONSTRAINT "drift_event_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "entity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "description" TEXT,
    "confidence" REAL NOT NULL DEFAULT 0.5,
    "mention_count" INTEGER NOT NULL DEFAULT 0,
    "first_seen_at" BIGINT NOT NULL,
    "last_seen_at" BIGINT NOT NULL,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

CREATE TABLE "entity_mention" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 0.5,
    "ts" BIGINT NOT NULL,
    CONSTRAINT "entity_mention_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "created_at" BIGINT NOT NULL
);

CREATE TABLE "failure_classification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "outcome_id" TEXT NOT NULL,
    "failure_type" TEXT NOT NULL,
    "is_recoverable" INTEGER NOT NULL DEFAULT 0,
    "suggested_action" TEXT,
    "ts" BIGINT NOT NULL,
    CONSTRAINT "failure_classification_outcome_id_fkey" FOREIGN KEY ("outcome_id") REFERENCES "outcome" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "fleet_event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slave_id" TEXT NOT NULL,
    "provider_id" TEXT,
    "event_type" TEXT NOT NULL,
    "event_data_json" TEXT NOT NULL DEFAULT '{}',
    "ts" BIGINT NOT NULL,
    CONSTRAINT "fleet_event_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "created_at" BIGINT NOT NULL
);

CREATE TABLE "harness_command" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "command_id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "params_schema_json" TEXT NOT NULL,
    "adaptor_ref" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

CREATE TABLE "health_digest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "day" TEXT NOT NULL,
    "markdown" TEXT NOT NULL,
    "metrics_json" TEXT NOT NULL,
    "created_at" BIGINT NOT NULL
);

CREATE TABLE "health_tick" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "slave_id" TEXT,
    "status" TEXT NOT NULL,
    "response_ms" INTEGER,
    "error" TEXT,
    "ts" BIGINT NOT NULL,
    CONSTRAINT "health_tick_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "hitl_gate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "task_id" TEXT NOT NULL,
    "step_id" TEXT NOT NULL,
    "gate_type" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "options_json" TEXT NOT NULL DEFAULT '[]',
    "default_value" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "resolved_by" TEXT,
    "resolved_at" BIGINT,
    "response" TEXT,
    "created_at" BIGINT NOT NULL,
    "expires_at" BIGINT,
    CONSTRAINT "hitl_gate_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "autonomous_task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "hpe_session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agent_id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "response" TEXT,
    "actions" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "started_at" BIGINT NOT NULL,
    "completed_at" BIGINT,
    "created_at" BIGINT NOT NULL
);

CREATE TABLE "import_job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "import_source" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "config_json" TEXT NOT NULL DEFAULT '{}',
    "result_json" TEXT,
    "error" TEXT,
    "started_at" BIGINT NOT NULL,
    "completed_at" BIGINT
);

CREATE TABLE "kernel_events" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kind" TEXT NOT NULL,
    "engine_id" TEXT,
    "data" TEXT,
    "created_at" BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE "kernel_provenance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trace_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "kind" TEXT NOT NULL,
    "engine_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "input" TEXT,
    "output" TEXT,
    "duration" INTEGER,
    "timestamp" INTEGER NOT NULL
);

CREATE TABLE "kernel_spans" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trace_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "name" TEXT NOT NULL,
    "start_time" INTEGER NOT NULL,
    "end_time" INTEGER,
    "duration" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ok',
    "error" TEXT,
    "attrs" TEXT,
    "engine_id" TEXT,
    "created_at" BIGINT NOT NULL
);

CREATE TABLE "kernel_topology" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "snapshot" TEXT NOT NULL,
    "created_at" BIGINT NOT NULL
);

CREATE TABLE "latency_measurement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_id" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "timestamp" INTEGER NOT NULL
);

CREATE TABLE "learning_event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "capability_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "data_json" TEXT NOT NULL DEFAULT '{}',
    "ts" BIGINT NOT NULL,
    CONSTRAINT "learning_event_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "learning_event_capability_id_fkey" FOREIGN KEY ("capability_id") REFERENCES "capability_taxonomy" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "ts" BIGINT NOT NULL,
    CONSTRAINT "manifest_change_log_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "resolved_at" BIGINT,
    "detected_at" BIGINT NOT NULL,
    CONSTRAINT "manifest_drift_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "mcp_server_config" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "enabled" INTEGER NOT NULL DEFAULT 0,
    "port" INTEGER NOT NULL DEFAULT 0,
    "tools_json" TEXT NOT NULL DEFAULT '[]',
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

CREATE TABLE "mcp_tool" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "server_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "input_schema_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" BIGINT NOT NULL
);

CREATE TABLE "mcp_tool_call" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "server_id" TEXT NOT NULL,
    "tool_name" TEXT NOT NULL,
    "input_json" TEXT NOT NULL,
    "output_json" TEXT,
    "success" BOOLEAN NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "created_at" BIGINT NOT NULL
);

CREATE TABLE "memory_access" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memory_type" TEXT NOT NULL,
    "memory_id" TEXT NOT NULL,
    "access_reason" TEXT NOT NULL,
    "query_text" TEXT,
    "result_rank" INTEGER,
    "was_used" INTEGER NOT NULL DEFAULT 0,
    "latency_ms" INTEGER NOT NULL,
    "created_at" BIGINT NOT NULL
);

CREATE TABLE "memory_curated" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memory_type" TEXT NOT NULL,
    "memory_id" TEXT NOT NULL,
    "curated_by" TEXT NOT NULL DEFAULT 'user',
    "is_verified" INTEGER NOT NULL DEFAULT 1,
    "is_pinned" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "curated_at" BIGINT NOT NULL
);

CREATE TABLE "memory_embedding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "embedding" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "dimensions" INTEGER NOT NULL,
    "content_hash" TEXT NOT NULL,
    "created_at" BIGINT NOT NULL
);

CREATE TABLE "memory_feedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memory_type" TEXT NOT NULL,
    "memory_id" TEXT NOT NULL,
    "feedback" TEXT NOT NULL,
    "correction" TEXT,
    "user_id" TEXT NOT NULL DEFAULT 'default',
    "ts" BIGINT NOT NULL
);

CREATE TABLE "memory_link" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source_memory_type" TEXT NOT NULL,
    "source_memory_id" TEXT NOT NULL,
    "target_memory_type" TEXT NOT NULL,
    "target_memory_id" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "strength" REAL NOT NULL DEFAULT 0.5,
    "metadata_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" BIGINT NOT NULL
);

CREATE TABLE "message_attachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "message_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_path" TEXT NOT NULL,
    "thumbnail_path" TEXT,
    "metadata_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" BIGINT NOT NULL,
    CONSTRAINT "message_attachment_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "conversation_message" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "message_entity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "message_id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 0.5,
    "context" TEXT NOT NULL,
    "extraction_source" TEXT NOT NULL DEFAULT 'llm',
    "created_at" BIGINT NOT NULL,
    CONSTRAINT "message_entity_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "conversation_message" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "message_entity_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "message_link" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source_message_id" TEXT NOT NULL,
    "target_message_id" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "weight" REAL NOT NULL DEFAULT 1.0,
    "metadata_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" BIGINT NOT NULL,
    CONSTRAINT "message_link_source_message_id_fkey" FOREIGN KEY ("source_message_id") REFERENCES "conversation_message" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "message_link_target_message_id_fkey" FOREIGN KEY ("target_message_id") REFERENCES "conversation_message" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "migration_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "applied_at" BIGINT NOT NULL
);

CREATE TABLE "mirror_snapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_id" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "state_json" TEXT NOT NULL,
    "timestamp" INTEGER NOT NULL
);

CREATE TABLE "mirror_state" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_id" TEXT NOT NULL,
    "chrome_state_json" TEXT,
    "ui_state_json" TEXT,
    "pending_ops_json" TEXT,
    "last_sync_at" BIGINT NOT NULL,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

CREATE TABLE "mux_response" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mux_session_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "account_id" TEXT,
    "ok" INTEGER NOT NULL DEFAULT 0,
    "response" TEXT NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "cost_cents" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "ts" BIGINT NOT NULL,
    CONSTRAINT "mux_response_mux_session_id_fkey" FOREIGN KEY ("mux_session_id") REFERENCES "mux_session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "mux_session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "message" TEXT NOT NULL,
    "conversation_id" TEXT,
    "strategy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "synthesized_response" TEXT,
    "best_provider_id" TEXT,
    "total_cost_cents" INTEGER NOT NULL DEFAULT 0,
    "total_latency_ms" INTEGER NOT NULL DEFAULT 0,
    "started_at" BIGINT NOT NULL,
    "completed_at" BIGINT
);

CREATE TABLE "nlcl_graph_edges" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "from_id" TEXT NOT NULL,
    "to_id" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "weight" REAL NOT NULL DEFAULT 1,
    "data_json" TEXT,
    "created_at" BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE "nlcl_graph_nodes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "data_json" TEXT,
    "created_at" BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE "node" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "parent_id" TEXT,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "raw_source" TEXT,
    "data_json" TEXT NOT NULL DEFAULT '{}',
    "edges_json" TEXT NOT NULL DEFAULT '[]',
    "meta_json" TEXT NOT NULL DEFAULT '{}',
    "search_text" TEXT NOT NULL DEFAULT '',
    "conversation_id" TEXT,
    "message_id" TEXT,
    "source_parser" TEXT,
    "content_hash" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "state" TEXT NOT NULL DEFAULT 'active',
    "security_level" INTEGER,
    "content_type" TEXT,
    "author_did" TEXT,
    "signature" TEXT,
    "acl_json" TEXT NOT NULL DEFAULT '{}',
    "quality_json" TEXT NOT NULL DEFAULT '{}',
    "valid_from" BIGINT,
    "valid_until" BIGINT,
    "parent_version" INTEGER,
    "acu_type" TEXT,
    "lineage_kind" TEXT,
    "extractor_version" TEXT,
    "parser_version" TEXT,
    "value_score" REAL,
    "is_high_value" INTEGER NOT NULL DEFAULT 0,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
    CONSTRAINT "node_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "node" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "node_alias" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "alias_id" TEXT NOT NULL,
  "canonical_id" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "confidence" REAL NOT NULL DEFAULT 1.0,
  "created_at" BIGINT NOT NULL
);

CREATE TABLE "node_edge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source_id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "edge_type" TEXT NOT NULL,
    "label" TEXT,
    "weight" REAL,
    "properties_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" BIGINT NOT NULL,
    CONSTRAINT "node_edge_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "node" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "node_edge_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "node" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "node_version" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "node_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "content_ref" TEXT NOT NULL,
    "op" TEXT NOT NULL,
    "parent_version" INTEGER,
    "created_at" BIGINT NOT NULL,
    CONSTRAINT "node_version_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "node" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "observation_event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_id" TEXT NOT NULL,
    "slave_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "data_json" TEXT NOT NULL,
    "timestamp" INTEGER NOT NULL
);

CREATE TABLE "optimistic_update" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "expected_state_json" TEXT NOT NULL,
    "actual_state_json" TEXT,
    "confirmed" INTEGER NOT NULL DEFAULT 0,
    "created_at" BIGINT NOT NULL,
    "resolved_at" BIGINT
);

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
    "ts" BIGINT NOT NULL,
    CONSTRAINT "outcome_capability_id_fkey" FOREIGN KEY ("capability_id") REFERENCES "capability_taxonomy" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE TABLE "pattern_extract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "pattern_type" TEXT NOT NULL,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "confidence" REAL NOT NULL DEFAULT 0.5,
    "first_seen_at" BIGINT NOT NULL,
    "last_seen_at" BIGINT NOT NULL,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

CREATE TABLE "plugin_registry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "capabilities_json" TEXT NOT NULL DEFAULT '[]',
    "description" TEXT,
    "depends_on_json" TEXT NOT NULL DEFAULT '[]',
    "integrity_hash" TEXT,
    "manifest_json" TEXT NOT NULL DEFAULT '{}',
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "loaded_at" BIGINT,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

CREATE TABLE "policy_rule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "requires_approval" INTEGER NOT NULL DEFAULT 0,
    "cooldown_ms" INTEGER NOT NULL DEFAULT 0,
    "max_occurrences" INTEGER NOT NULL DEFAULT 1000000,
    "window_ms" INTEGER NOT NULL DEFAULT 60000,
    "is_active" INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE "primitive" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scope" TEXT NOT NULL,
    "family_id" TEXT,
    "provider_id" TEXT,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "default_region_json" TEXT NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
    CONSTRAINT "primitive_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "provider_type" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "procedural_rule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 0.5,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "last_triggered" INTEGER,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

CREATE TABLE "profile_session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_session_id" TEXT NOT NULL,
    "profile_dir" TEXT NOT NULL,
    "chrome_slave_id" TEXT,
    "state" TEXT NOT NULL DEFAULT 'stopped',
    "port" INTEGER,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
    CONSTRAINT "profile_session_provider_session_id_fkey" FOREIGN KEY ("provider_session_id") REFERENCES "provider_session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "last_executed_at" BIGINT,
    "first_executed_at" BIGINT,
    "window_1h_total" INTEGER NOT NULL DEFAULT 0,
    "window_1h_success" INTEGER NOT NULL DEFAULT 0,
    "window_24h_total" INTEGER NOT NULL DEFAULT 0,
    "window_24h_success" INTEGER NOT NULL DEFAULT 0,
    "window_7d_total" INTEGER NOT NULL DEFAULT 0,
    "window_7d_success" INTEGER NOT NULL DEFAULT 0,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
    CONSTRAINT "program_version_metric_binding_id_fkey" FOREIGN KEY ("binding_id") REFERENCES "capability_binding" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "program_version_metric_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "capability_program" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "conversation_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

CREATE TABLE "provider_account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "plan_tier" TEXT NOT NULL DEFAULT 'free',
    "is_default" INTEGER NOT NULL DEFAULT 0,
    "is_kind" INTEGER NOT NULL DEFAULT 0,
    "login_state" TEXT NOT NULL DEFAULT 'unknown',
    "login_attempts" INTEGER NOT NULL DEFAULT 0,
    "last_login_at" BIGINT,
    "provider_state_json" TEXT NOT NULL DEFAULT '{}',
    "debug_port" INTEGER,
    "profile_dir" TEXT,
    "chrome_slave_id" TEXT,
    "user_id" TEXT NOT NULL DEFAULT 'default',
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
    CONSTRAINT "provider_account_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "provider_archetype" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shape_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "manifest_json" TEXT NOT NULL,
    "is_default" INTEGER NOT NULL DEFAULT 0,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

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
    "last_used_at" BIGINT,
    "selector_hit_count" INTEGER NOT NULL DEFAULT 0,
    "selector_miss_count" INTEGER NOT NULL DEFAULT 0,
    "selector_last_miss_at" BIGINT,
    "selector_last_error" TEXT,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
    CONSTRAINT "provider_capability_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "provider_config" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "config_key" TEXT NOT NULL,
    "config_value" TEXT NOT NULL,
    "config_type" TEXT NOT NULL DEFAULT 'string',
    "is_secret" INTEGER NOT NULL DEFAULT 0,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
    CONSTRAINT "provider_config_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "provider_cost_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "cost_cents" INTEGER NOT NULL,
    "tokens_input" INTEGER NOT NULL DEFAULT 0,
    "tokens_output" INTEGER NOT NULL DEFAULT 0,
    "model" TEXT,
    "ts" BIGINT NOT NULL
);

CREATE TABLE "provider_definition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'ai',
    "provider_type" TEXT NOT NULL DEFAULT 'llm',
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "protocol_status" TEXT NOT NULL DEFAULT 'Active',
    "website_url" TEXT,
    "documentation_url" TEXT,
    "auth_type" TEXT NOT NULL DEFAULT 'browser',
    "has_multi_account" INTEGER NOT NULL DEFAULT 0,
    "profile_strategy" TEXT NOT NULL DEFAULT 'per_account',
    "fleet_config_json" TEXT NOT NULL DEFAULT '{}',
    "capabilities_json" TEXT NOT NULL DEFAULT '{}',
    "models_json" TEXT NOT NULL DEFAULT '[]',
    "plugin_id" TEXT,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

CREATE TABLE "provider_endpoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "endpoint_type" TEXT NOT NULL DEFAULT 'landing',
    "is_default" INTEGER NOT NULL DEFAULT 0,
    "selectors_json" TEXT NOT NULL DEFAULT '{}',
    "composer_type" TEXT NOT NULL DEFAULT 'textarea',
    "send_method" TEXT NOT NULL DEFAULT 'both',
    "content_editable" INTEGER NOT NULL DEFAULT 0,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
    CONSTRAINT "provider_endpoint_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "last_check_at" BIGINT,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
    CONSTRAINT "provider_health_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "window_start_ts" BIGINT NOT NULL,
    "window_end_ts" BIGINT NOT NULL,
    "snapshot_ts" BIGINT NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "provider_health_history_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "provider_latency_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "capability_id" TEXT,
    "ts" BIGINT NOT NULL
);

CREATE TABLE "provider_manifest_version" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "manifest_file" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "hash" TEXT NOT NULL,
    "content_json" TEXT NOT NULL,
    "change_summary" TEXT,
    "actor" TEXT NOT NULL DEFAULT 'system',
    "created_at" BIGINT NOT NULL,
    CONSTRAINT "provider_manifest_version_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
    CONSTRAINT "provider_model_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "provider_parser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "parser_name" TEXT NOT NULL,
    "parser_version" INTEGER NOT NULL DEFAULT 1,
    "parser_logic_type" TEXT NOT NULL DEFAULT 'file',
    "parser_file_path" TEXT,
    "parser_logic_code" TEXT,
    "parser_hash" TEXT,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "fallback_parser_id" TEXT,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
    CONSTRAINT "provider_parser_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "provider_parser_fallback_parser_id_fkey" FOREIGN KEY ("fallback_parser_id") REFERENCES "provider_parser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "provider_session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vivim_session_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'idle',
    "context_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
    CONSTRAINT "provider_session_vivim_session_id_fkey" FOREIGN KEY ("vivim_session_id") REFERENCES "vivim_session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "provider_session_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "provider_session_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "provider_account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "provider_shape_binding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "archetype_id" TEXT NOT NULL,
    "shape_id" TEXT NOT NULL,
    "config_json" TEXT,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "created_at" BIGINT NOT NULL
);

CREATE TABLE "provider_stream_config" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "stream_transport" TEXT NOT NULL,
    "stream_terminal_json" TEXT NOT NULL DEFAULT '[]',
    "sse_format" TEXT,
    "delta_path_json" TEXT,
    "content_type" TEXT,
    "completion_detectors_json" TEXT NOT NULL DEFAULT '[]',
    "harness_js" TEXT,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 1,
    "superseded_by" TEXT,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
    CONSTRAINT "provider_stream_config_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "provider_stream_config_superseded_by_fkey" FOREIGN KEY ("superseded_by") REFERENCES "provider_stream_config" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "provider_type" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "slot_catalog_json" TEXT NOT NULL DEFAULT '[]',
    "region_layout_json" TEXT NOT NULL DEFAULT '{}',
    "interaction_grammar_json" TEXT NOT NULL DEFAULT '{}',
    "base_primitive" TEXT NOT NULL DEFAULT 'conversations',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

CREATE TABLE "reflection_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT,
    "conversation_id" TEXT,
    "reflection_type" TEXT NOT NULL,
    "input_json" TEXT NOT NULL,
    "output_json" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 0.5,
    "applied" INTEGER NOT NULL DEFAULT 0,
    "created_at" BIGINT NOT NULL
);

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
    "ts" BIGINT NOT NULL,
    CONSTRAINT "registration_event_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "repair_session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_id" TEXT,
    "command_id" TEXT,
    "original_content" TEXT NOT NULL,
    "repaired_content" TEXT,
    "strategy" TEXT NOT NULL,
    "success" INTEGER NOT NULL,
    "errors_json" TEXT NOT NULL,
    "repairs_json" TEXT NOT NULL,
    "created_at" BIGINT NOT NULL
);

CREATE TABLE "route_event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "route_request_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_data_json" TEXT NOT NULL DEFAULT '{}',
    "ts" BIGINT NOT NULL,
    CONSTRAINT "route_event_route_request_id_fkey" FOREIGN KEY ("route_request_id") REFERENCES "route_request" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "route_request" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "route_spec_id" TEXT NOT NULL,
    "conversation_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result_json" TEXT,
    "ts" BIGINT NOT NULL,
    CONSTRAINT "route_request_route_spec_id_fkey" FOREIGN KEY ("route_spec_id") REFERENCES "route_spec" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "route_spec" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "capability_id" TEXT NOT NULL,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "config_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
    CONSTRAINT "route_spec_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "route_spec_capability_id_fkey" FOREIGN KEY ("capability_id") REFERENCES "capability_taxonomy" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "route_target" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "route_spec_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "account_id" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "created_at" BIGINT NOT NULL,
    CONSTRAINT "route_target_route_spec_id_fkey" FOREIGN KEY ("route_spec_id") REFERENCES "route_spec" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "routing_preference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "capability_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "score" REAL NOT NULL DEFAULT 0.5,
    "sample_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" BIGINT NOT NULL
);

CREATE TABLE "rule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "rule_type" TEXT NOT NULL,
    "condition_json" TEXT NOT NULL DEFAULT '{}',
    "action_json" TEXT NOT NULL DEFAULT '{}',
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "confidence" REAL NOT NULL DEFAULT 0.0,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

CREATE TABLE "sandbox_audit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "handler_slug" TEXT NOT NULL,
    "ok" INTEGER NOT NULL,
    "error" TEXT,
    "permissions_json" TEXT NOT NULL,
    "ts" BIGINT NOT NULL
);

CREATE TABLE "selector_health_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "selector_strategy_id" TEXT NOT NULL,
    "binding_id" TEXT NOT NULL,
    "hit_count" INTEGER NOT NULL DEFAULT 0,
    "miss_count" INTEGER NOT NULL DEFAULT 0,
    "hit_rate" REAL NOT NULL DEFAULT 0,
    "avg_duration_ms" REAL NOT NULL DEFAULT 0,
    "p95_duration_ms" REAL NOT NULL DEFAULT 0,
    "window_start_ts" BIGINT NOT NULL,
    "window_end_ts" BIGINT NOT NULL,
    "snapshot_ts" BIGINT NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "selector_health_history_selector_strategy_id_fkey" FOREIGN KEY ("selector_strategy_id") REFERENCES "selector_strategy" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "selector_health_history_binding_id_fkey" FOREIGN KEY ("binding_id") REFERENCES "capability_binding" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "last_used_at" BIGINT,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
    CONSTRAINT "selector_strategy_capability_id_fkey" FOREIGN KEY ("capability_id") REFERENCES "capability_taxonomy" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "selector_strategy_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "semantic_memory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subject" TEXT NOT NULL,
    "predicate" TEXT NOT NULL,
    "object_json" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 1.0,
    "source" TEXT NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "expires_at" BIGINT,
    "created_at" BIGINT NOT NULL
);

CREATE TABLE "session_checkpoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vivim_session_id" TEXT NOT NULL,
    "checkpoint_json" TEXT NOT NULL,
    "created_at" BIGINT NOT NULL,
    CONSTRAINT "session_checkpoint_vivim_session_id_fkey" FOREIGN KEY ("vivim_session_id") REFERENCES "vivim_session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "situation_detection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_id" TEXT,
    "detected_type" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "signals_json" TEXT NOT NULL,
    "recommended_action" TEXT,
    "action_taken" TEXT,
    "action_result" TEXT,
    "timestamp" INTEGER NOT NULL
);

CREATE TABLE "situation_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_id" TEXT,
    "detected_type" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "signals_json" TEXT NOT NULL,
    "timestamp" INTEGER NOT NULL
);

CREATE TABLE "state_transition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "from_state" TEXT,
    "to_state" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "metadata_json" TEXT NOT NULL DEFAULT '{}',
    "ts" BIGINT NOT NULL
);

CREATE TABLE "stealth_launch_profile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mode" TEXT NOT NULL DEFAULT 'cdp_stealth',
    "chrome_args_json" TEXT NOT NULL DEFAULT '[]',
    "stealth_profile_id" TEXT,
    "attach_port" INTEGER,
    "extension_id" TEXT,
    "window_size_json" TEXT NOT NULL DEFAULT '{"width":1280,"height":720}',
    "extra_args_json" TEXT NOT NULL DEFAULT '[]',
    "created_at" BIGINT NOT NULL DEFAULT 0,
    "updated_at" BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE "stealth_module_profile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "modules_json" TEXT NOT NULL DEFAULT '[]',
    "created_at" BIGINT NOT NULL DEFAULT 0,
    "updated_at" BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE "stealth_policy" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "default_launch_profile_id" TEXT,
    "default_module_profile_id" TEXT,
    "provider_overrides_json" TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE "stream_block" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "block_index" INTEGER NOT NULL,
    "block_kind" TEXT NOT NULL,
    "block_data" TEXT NOT NULL,
    "block_meta" TEXT NOT NULL DEFAULT '{}',
    "created_at" BIGINT NOT NULL,
    CONSTRAINT "stream_block_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "stream_block_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "conversation_message" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "sync_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "device_id" TEXT NOT NULL,
    "table" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "data_json" TEXT NOT NULL,
    "ts" BIGINT NOT NULL,
    "synced_at" BIGINT
);

CREATE TABLE "sync_peer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "device_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "public_key" TEXT NOT NULL,
    "last_sync_at" BIGINT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paired_at" BIGINT
);

CREATE TABLE "telemetry_cycle_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schedule_name" TEXT NOT NULL,
    "rows_written" INTEGER NOT NULL DEFAULT 0,
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "ts" BIGINT NOT NULL
);

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

CREATE TABLE "test_run" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "capability_id" TEXT,
    "binding_id" TEXT,
    "provider_id" TEXT,
    "test_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "result_json" TEXT,
    "started_at" BIGINT NOT NULL,
    "completed_at" BIGINT
);

CREATE TABLE "token_budget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_id" TEXT NOT NULL,
    "total_budget" INTEGER NOT NULL,
    "layers_json" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "ts" BIGINT NOT NULL
);

CREATE TABLE "topic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "conversation_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

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
    "ts" BIGINT NOT NULL
);

CREATE TABLE "transfer_attempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transfer_candidate_id" TEXT NOT NULL,
    "ok" INTEGER NOT NULL DEFAULT 0,
    "result_json" TEXT,
    "error" TEXT,
    "duration_ms" INTEGER,
    "ts" BIGINT NOT NULL,
    CONSTRAINT "transfer_attempt_transfer_candidate_id_fkey" FOREIGN KEY ("transfer_candidate_id") REFERENCES "transfer_candidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "transfer_candidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transfer_pattern_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "metadata_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" BIGINT NOT NULL,
    CONSTRAINT "transfer_candidate_transfer_pattern_id_fkey" FOREIGN KEY ("transfer_pattern_id") REFERENCES "transfer_pattern" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "transfer_pattern" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "from_provider_id" TEXT NOT NULL,
    "to_provider_id" TEXT NOT NULL,
    "capability_id" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 0.0,
    "last_transferred_at" BIGINT,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
    CONSTRAINT "transfer_pattern_from_provider_id_fkey" FOREIGN KEY ("from_provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "transfer_pattern_to_provider_id_fkey" FOREIGN KEY ("to_provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "transfer_pattern_capability_id_fkey" FOREIGN KEY ("capability_id") REFERENCES "capability_taxonomy" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ui_component" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "primitive_id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "variant" TEXT,
    "component_key" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "html" TEXT NOT NULL DEFAULT '',
    "css" TEXT NOT NULL DEFAULT '',
    "script_url" TEXT,
    "sandbox_json" TEXT NOT NULL DEFAULT '{}',
    "constraints_json" TEXT NOT NULL DEFAULT '{}',
    "contract_json" TEXT NOT NULL DEFAULT '{}',
    "archetype" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'published',
    "author" TEXT NOT NULL DEFAULT 'system',
    "default_region_json" TEXT NOT NULL DEFAULT '',
    "tags_json" TEXT NOT NULL DEFAULT '[]',
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
    CONSTRAINT "ui_component_primitive_id_fkey" FOREIGN KEY ("primitive_id") REFERENCES "primitive" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "user" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "display_name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "avatar_color" TEXT NOT NULL,
    "avatar_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "is_default" INTEGER NOT NULL DEFAULT 0,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
    "last_active_at" BIGINT,
    "last_session_id" TEXT
);

CREATE TABLE "user_preference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL DEFAULT 'default',
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "learned_at" BIGINT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 0.5
);

CREATE TABLE "vivim_session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "state" TEXT NOT NULL DEFAULT 'idle',
    "context_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

CREATE TABLE "workflow_credential" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflow_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value_encrypted" TEXT NOT NULL,
    "created_at" BIGINT NOT NULL
);

CREATE TABLE "workflow_definition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "nodes_json" TEXT NOT NULL,
    "edges_json" TEXT NOT NULL,
    "variables_json" TEXT,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

CREATE TABLE "workflow_edge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflow_id" TEXT NOT NULL,
    "edge_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "condition" TEXT
);

CREATE TABLE "workflow_execution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflow_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "input_json" TEXT,
    "output_json" TEXT,
    "started_at" BIGINT NOT NULL,
    "completed_at" BIGINT
);

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

CREATE TABLE "workflow_node_execution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "execution_id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "input_json" TEXT,
    "output_json" TEXT,
    "error" TEXT,
    "started_at" BIGINT,
    "completed_at" BIGINT
);

CREATE TABLE "workflow_retry_queue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "node_execution_id" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "next_retry_at" BIGINT NOT NULL,
    "max_attempts" INTEGER NOT NULL,
    "backoff_ms" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE "workflow_version" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflow_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "definition_json" TEXT NOT NULL,
    "created_at" BIGINT NOT NULL
);

CREATE TABLE "workflow_webhook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflow_id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "secret" TEXT,
    "created_at" BIGINT NOT NULL
);

CREATE TABLE "workspace_mode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL DEFAULT 'default',
    "mode" TEXT NOT NULL DEFAULT 'chat',
    "panels_json" TEXT NOT NULL DEFAULT '[]',
    "updated_at" BIGINT NOT NULL
);

-- ── Schema: Indexes ───────────────────────────────────────────────────

CREATE UNIQUE INDEX "capability_binding_global_id_provider_id_key" ON "capability_binding"("global_id", "provider_id");

CREATE UNIQUE INDEX "capability_override_provider_id_capability_id_override_type_key" ON "capability_override"("provider_id", "capability_id", "override_type");

CREATE UNIQUE INDEX "capability_taxonomy_slug_key" ON "capability_taxonomy"("slug");

CREATE UNIQUE INDEX "capability_taxonomy_version_capability_id_version_key" ON "capability_taxonomy_version"("capability_id", "version");

CREATE UNIQUE INDEX "capability_telemetry_capability_id_binding_id_program_id_key" ON "capability_telemetry"("capability_id", "binding_id", "program_id");

CREATE UNIQUE INDEX "capability_tier_capability_id_plan_tier_key" ON "capability_tier"("capability_id", "plan_tier");

CREATE UNIQUE INDEX "circuit_breaker_state_slave_id_key" ON "circuit_breaker_state"("slave_id");

CREATE UNIQUE INDEX "config_entry_engine_id_scope_type_scope_id_key" ON "config_entry"("engine_id", "scope_type", "scope_id");

CREATE UNIQUE INDEX "context_budget_config_user_id_key" ON "context_budget_config"("user_id");

CREATE INDEX "conversation_external_id_idx" ON "conversation"("external_id");

CREATE INDEX "conversation_import_job_id_idx" ON "conversation"("import_job_id");

CREATE INDEX "conversation_source_idx" ON "conversation"("source");

CREATE UNIQUE INDEX "conversation_topic_conversation_id_topic_id_key" ON "conversation_topic"("conversation_id", "topic_id");

CREATE INDEX "decision_record_conversation_id_idx" ON "decision_record"("conversation_id");

CREATE INDEX "entity_entity_type_idx" ON "entity"("entity_type");

CREATE INDEX "entity_mention_conversation_id_idx" ON "entity_mention"("conversation_id");

CREATE INDEX "entity_mention_entity_id_idx" ON "entity_mention"("entity_id");

CREATE UNIQUE INDEX "entity_name_entity_type_key" ON "entity"("name", "entity_type");

CREATE UNIQUE INDEX "health_digest_day_key" ON "health_digest"("day");

CREATE INDEX "idx_ae_condition" ON "alert_event"("condition_id", "fired_at");

CREATE INDEX "idx_ar_schedule" ON "automation_run"("schedule_id", "started_at");

CREATE INDEX "idx_ast_task" ON "autonomous_step"("task_id");

CREATE INDEX "idx_at_status" ON "autonomous_task"("status");

CREATE INDEX "idx_bsl_binding" ON "binding_status_log"("binding_id", "ts");

CREATE INDEX "idx_bsl_trigger" ON "binding_status_log"("trigger");

CREATE INDEX "idx_bsl_ts" ON "binding_status_log"("ts");

CREATE INDEX "idx_ca_engine" ON "config_audit"("engine_id", "ts");

CREATE INDEX "idx_ca_entry" ON "config_audit"("entry_id", "ts");

CREATE INDEX "idx_captel_capability" ON "capability_telemetry"("capability_id");

CREATE INDEX "idx_captel_provider" ON "capability_telemetry"("provider_id");

CREATE INDEX "idx_captel_updated" ON "capability_telemetry"("updated_at");

CREATE INDEX "idx_cb_global" ON "capability_binding"("global_id");

CREATE INDEX "idx_cb_provider" ON "capability_binding"("provider_id");

CREATE INDEX "idx_cb_status" ON "capability_binding"("status");

CREATE INDEX "idx_ce_engine" ON "config_entry"("engine_id");

CREATE INDEX "idx_ci_intent" ON "capability_intent"("intent_text");

CREATE INDEX "idx_ci_primary" ON "capability_intent"("is_primary");

CREATE INDEX "idx_clr_conv" ON "context_layer"("conversation_id");

CREATE INDEX "idx_clr_layer" ON "context_layer"("layer_name");

CREATE INDEX "idx_cm_conv" ON "conversation_message"("conversation_id", "sequence_index");

CREATE INDEX "idx_cm_provider" ON "capability_macro"("provider_id");

CREATE INDEX "idx_conv_provider" ON "conversation"("provider_id");

CREATE INDEX "idx_conv_session" ON "conversation"("provider_session_id");

CREATE INDEX "idx_cp_binding" ON "capability_program"("binding_id");

CREATE INDEX "idx_ct_category" ON "capability_taxonomy"("category");

CREATE INDEX "idx_ct_classification" ON "capability_taxonomy"("op_classification");

CREATE INDEX "idx_ct_parent" ON "capability_taxonomy"("parent_capability_id");

CREATE INDEX "idx_ct_position" ON "capability_taxonomy"("ui_position", "ui_group", "ui_order");

CREATE INDEX "idx_ct_slug" ON "capability_taxonomy"("slug");

CREATE INDEX "idx_ctv_cap" ON "capability_taxonomy_version"("capability_id", "version");

CREATE INDEX "idx_ctv_created" ON "capability_taxonomy_version"("created_at");

CREATE INDEX "idx_cu_conv_type" ON "content_unit"("conversation_id", "unit_type");

CREATE INDEX "idx_cu_message" ON "content_unit"("message_id");

CREATE INDEX "idx_de_provider" ON "drift_event"("provider_id", "detected_at");

CREATE INDEX "idx_edge_source" ON "node_edge"("source_id");

CREATE INDEX "idx_edge_target" ON "node_edge"("target_id");

CREATE INDEX "idx_edge_type" ON "node_edge"("edge_type");

CREATE INDEX "idx_fe_provider" ON "fleet_event"("provider_id", "ts");

CREATE INDEX "idx_fe_slave" ON "fleet_event"("slave_id", "ts");

CREATE INDEX "idx_harness_cmd_id" ON "harness_command"("command_id");

CREATE INDEX "idx_hc_conv" ON "harness_checkpoint"("conversation_id");

CREATE INDEX "idx_hc_slave" ON "harness_checkpoint"("slave_id", "created_at");

CREATE INDEX "idx_hd_day" ON "health_digest"("day");

CREATE INDEX "idx_hg_status" ON "hitl_gate"("status");

CREATE INDEX "idx_hg_task_status" ON "hitl_gate"("task_id", "status");

CREATE INDEX "idx_hs_agent" ON "hpe_session"("agent_id", "started_at");

CREATE INDEX "idx_ht_provider" ON "health_tick"("provider_id", "ts");

CREATE INDEX "idx_kernel_events_kind" ON "kernel_events"("kind");

CREATE INDEX "idx_kernel_events_time" ON "kernel_events"("created_at");

CREATE INDEX "idx_kernel_prov_engine" ON "kernel_provenance"("engine_id");

CREATE INDEX "idx_kernel_prov_kind" ON "kernel_provenance"("kind");

CREATE INDEX "idx_kernel_prov_trace" ON "kernel_provenance"("trace_id");

CREATE INDEX "idx_kernel_spans_engine" ON "kernel_spans"("engine_id");

CREATE INDEX "idx_kernel_spans_time" ON "kernel_spans"("start_time");

CREATE INDEX "idx_kernel_spans_trace" ON "kernel_spans"("trace_id");

CREATE INDEX "idx_ma_message" ON "message_attachment"("message_id");

CREATE INDEX "idx_macc_memory" ON "memory_access"("memory_type", "memory_id");

CREATE INDEX "idx_macc_time" ON "memory_access"("created_at");

CREATE INDEX "idx_mcl_provider" ON "manifest_change_log"("provider_id", "ts");

CREATE INDEX "idx_mcl_ts" ON "manifest_change_log"("ts");

CREATE INDEX "idx_mcl_type" ON "manifest_change_log"("change_type");

CREATE INDEX "idx_md_provider" ON "manifest_drift"("provider_id", "resolved", "detected_at");

CREATE INDEX "idx_ment_entity" ON "message_entity"("entity_id");

CREATE INDEX "idx_ment_message" ON "message_entity"("message_id");

CREATE INDEX "idx_mf_memory" ON "memory_feedback"("memory_type", "memory_id");

CREATE INDEX "idx_ml_source" ON "message_link"("source_message_id");

CREATE INDEX "idx_ml_target" ON "message_link"("target_message_id");

CREATE INDEX "idx_mlink_source" ON "memory_link"("source_memory_type", "source_memory_id");

CREATE INDEX "idx_mlink_target" ON "memory_link"("target_memory_type", "target_memory_id");

CREATE INDEX "idx_mr_provider" ON "mux_response"("provider_id");

CREATE INDEX "idx_mr_session" ON "mux_response"("mux_session_id");

CREATE INDEX "idx_ms_conv" ON "mux_session"("conversation_id");

CREATE INDEX "idx_ms_status" ON "mux_session"("status");

CREATE INDEX "idx_nlcl_edges_from" ON "nlcl_graph_edges"("from_id");

CREATE INDEX "idx_nlcl_edges_rel" ON "nlcl_graph_edges"("relation");

CREATE INDEX "idx_nlcl_edges_to" ON "nlcl_graph_edges"("to_id");

CREATE INDEX "idx_nlcl_nodes_kind" ON "nlcl_graph_nodes"("kind");

CREATE INDEX "idx_nlcl_nodes_label" ON "nlcl_graph_nodes"("label");

CREATE INDEX "idx_node_alias_canonical" ON "node_alias" ("canonical_id");

CREATE INDEX "idx_node_content_hash" ON "node"("content_hash");

CREATE INDEX "idx_node_conversation" ON "node"("conversation_id");

CREATE INDEX "idx_node_created" ON "node"("created_at");

CREATE INDEX "idx_node_message" ON "node"("message_id");

CREATE INDEX "idx_node_parent" ON "node"("parent_id");

CREATE INDEX "idx_node_search" ON "node"("search_text");

CREATE INDEX "idx_node_state" ON "node"("state");

CREATE INDEX "idx_node_type" ON "node"("type");

CREATE INDEX "idx_nodeversion_node" ON "node_version"("node_id");

CREATE INDEX "idx_o_cap" ON "outcome"("capability_id", "ts");

CREATE INDEX "idx_o_ok" ON "outcome"("ok", "ts");

CREATE INDEX "idx_o_provider" ON "outcome"("provider_id", "ts");

CREATE INDEX "idx_o_ts" ON "outcome"("ts");

CREATE INDEX "idx_pa_email" ON "provider_account"("email");

CREATE INDEX "idx_pa_login" ON "provider_account"("login_state");

CREATE INDEX "idx_pa_provider" ON "provider_account"("provider_id");

CREATE INDEX "idx_pc_cap" ON "provider_capability"("global_capability_id");

CREATE INDEX "idx_pc_confidence" ON "provider_capability"("provider_id", "confidence");

CREATE INDEX "idx_pc_provider" ON "provider_capability"("provider_id");

CREATE INDEX "idx_pc_selector" ON "provider_capability"("provider_id", "selector_hit_count");

CREATE INDEX "idx_pcl_provider" ON "provider_cost_log"("provider_id", "ts");

CREATE INDEX "idx_pe_provider" ON "provider_endpoint"("provider_id");

CREATE INDEX "idx_phh_provider" ON "provider_health_history"("provider_id", "snapshot_ts");

CREATE INDEX "idx_phh_window" ON "provider_health_history"("window_start_ts", "window_end_ts");

CREATE INDEX "idx_pll_provider" ON "provider_latency_log"("provider_id", "ts");

CREATE INDEX "idx_pmv_provider" ON "provider_manifest_version"("provider_id", "version");

CREATE INDEX "idx_pp_provider" ON "provider_parser"("provider_id");

CREATE INDEX "idx_prim_family" ON "primitive"("family_id");

CREATE INDEX "idx_prim_provider" ON "primitive"("provider_id");

CREATE INDEX "idx_prim_scope" ON "primitive"("scope");

CREATE INDEX "idx_prs_session" ON "profile_session"("provider_session_id");

CREATE INDEX "idx_ps_session" ON "provider_session"("vivim_session_id");

CREATE INDEX "idx_psc_provider" ON "provider_stream_config"("provider_id");

CREATE INDEX "idx_psc_transport" ON "provider_stream_config"("stream_transport");

CREATE INDEX "idx_pvm_binding" ON "program_version_metric"("binding_id");

CREATE INDEX "idx_pvm_program" ON "program_version_metric"("program_id");

CREATE INDEX "idx_pvm_updated" ON "program_version_metric"("updated_at");

CREATE INDEX "idx_re_provider" ON "registration_event"("provider_id", "ts");

CREATE INDEX "idx_re_table" ON "registration_event"("table_name");

CREATE INDEX "idx_re_type" ON "registration_event"("event_type");

CREATE INDEX "idx_repair_cmd" ON "repair_session"("command_id");

CREATE INDEX "idx_repair_conv" ON "repair_session"("conversation_id");

CREATE INDEX "idx_rl_conv" ON "reflection_log"("conversation_id");

CREATE INDEX "idx_rl_time" ON "reflection_log"("created_at");

CREATE INDEX "idx_rl_type" ON "reflection_log"("reflection_type");

CREATE INDEX "idx_rp_cap" ON "routing_preference"("capability_id");

CREATE INDEX "idx_sa_handler" ON "sandbox_audit"("handler_slug", "ts");

CREATE INDEX "idx_sb_conv" ON "stream_block"("conversation_id", "message_id", "block_index");

CREATE INDEX "idx_sb_kind" ON "stream_block"("conversation_id", "block_kind");

CREATE INDEX "idx_sb_message" ON "stream_block"("message_id");

CREATE INDEX "idx_sc_session" ON "session_checkpoint"("vivim_session_id", "created_at");

CREATE INDEX "idx_sd_conv" ON "situation_detection"("conversation_id");

CREATE INDEX "idx_sd_time" ON "situation_detection"("timestamp");

CREATE INDEX "idx_sd_type" ON "situation_detection"("detected_type");

CREATE INDEX "idx_shh_binding" ON "selector_health_history"("binding_id", "snapshot_ts");

CREATE INDEX "idx_shh_selector" ON "selector_health_history"("selector_strategy_id", "snapshot_ts");

CREATE INDEX "idx_shh_window" ON "selector_health_history"("window_start_ts", "window_end_ts");

CREATE INDEX "idx_sl_conv" ON "situation_log"("conversation_id");

CREATE INDEX "idx_sl_device" ON "sync_log"("device_id", "synced_at");

CREATE INDEX "idx_sl_record" ON "sync_log"("table", "record_id");

CREATE INDEX "idx_sl_type" ON "situation_log"("detected_type");

CREATE INDEX "idx_ss_cap" ON "selector_strategy"("capability_id", "provider_id");

CREATE INDEX "idx_ss_provider" ON "selector_strategy"("provider_id");

CREATE INDEX "idx_st_entity" ON "state_transition"("entity_type", "entity_id", "ts");

CREATE INDEX "idx_tb_conv" ON "token_budget"("conversation_id");

CREATE INDEX "idx_tcl_schedule" ON "telemetry_cycle_log"("schedule_name", "ts");

CREATE INDEX "idx_te_conv" ON "trace_entry"("conversation_id", "ts");

CREATE INDEX "idx_te_engine" ON "trace_entry"("engine", "ts");

CREATE INDEX "idx_te_provider" ON "trace_entry"("provider_id", "ts");

CREATE INDEX "idx_te_slave" ON "trace_entry"("slave_id", "ts");

CREATE INDEX "idx_tsd_day" ON "telemetry_summary_daily"("day_ts");

CREATE INDEX "idx_tsd_provider" ON "telemetry_summary_daily"("provider_id", "day_ts");

CREATE INDEX "idx_uc_owner" ON "ui_component"("scope", "owner_id");

CREATE INDEX "idx_uc_prim" ON "ui_component"("primitive_id");

CREATE INDEX "idx_user_default" ON "user"("is_default");

CREATE INDEX "idx_user_status" ON "user"("status");

CREATE INDEX "idx_wrq_status_time" ON "workflow_retry_queue"("status", "next_retry_at");

CREATE INDEX "idx_wv_wf" ON "workflow_version"("workflow_id");

CREATE INDEX "import_job_import_source_idx" ON "import_job"("import_source");

CREATE UNIQUE INDEX "mcp_server_config_name_key" ON "mcp_server_config"("name");

CREATE UNIQUE INDEX "memory_curated_memory_type_memory_id_key" ON "memory_curated"("memory_type", "memory_id");

CREATE UNIQUE INDEX "memory_embedding_entity_type_entity_id_key" ON "memory_embedding"("entity_type", "entity_id");

CREATE UNIQUE INDEX "memory_link_source_memory_type_source_memory_id_target_memory_type_target_memory_id_relation_key" ON "memory_link"("source_memory_type", "source_memory_id", "target_memory_type", "target_memory_id", "relation");

CREATE UNIQUE INDEX "message_entity_message_id_entity_id_key" ON "message_entity"("message_id", "entity_id");

CREATE UNIQUE INDEX "message_link_source_message_id_target_message_id_relation_key" ON "message_link"("source_message_id", "target_message_id", "relation");

CREATE UNIQUE INDEX "mirror_state_conversation_id_key" ON "mirror_state"("conversation_id");

CREATE UNIQUE INDEX "pattern_extract_name_pattern_type_key" ON "pattern_extract"("name", "pattern_type");

CREATE UNIQUE INDEX "plugin_registry_name_key" ON "plugin_registry"("name");

CREATE UNIQUE INDEX "policy_rule_name_key" ON "policy_rule"("name");

CREATE UNIQUE INDEX "program_version_metric_binding_id_program_id_program_version_key" ON "program_version_metric"("binding_id", "program_id", "program_version");

CREATE UNIQUE INDEX "provider_account_provider_id_email_key" ON "provider_account"("provider_id", "email");

CREATE UNIQUE INDEX "provider_capability_provider_id_global_capability_id_key" ON "provider_capability"("provider_id", "global_capability_id");

CREATE UNIQUE INDEX "provider_config_provider_id_config_key_key" ON "provider_config"("provider_id", "config_key");

CREATE UNIQUE INDEX "provider_definition_slug_key" ON "provider_definition"("slug");

CREATE UNIQUE INDEX "provider_health_provider_id_key" ON "provider_health"("provider_id");

CREATE UNIQUE INDEX "provider_manifest_version_provider_id_manifest_file_version_key" ON "provider_manifest_version"("provider_id", "manifest_file", "version");

CREATE UNIQUE INDEX "provider_model_provider_id_model_slug_key" ON "provider_model"("provider_id", "model_slug");

CREATE UNIQUE INDEX "provider_stream_config_provider_id_stream_transport_version_key" ON "provider_stream_config"("provider_id", "stream_transport", "version");

CREATE UNIQUE INDEX "provider_type_slug_key" ON "provider_type"("slug");

CREATE UNIQUE INDEX "routing_preference_capability_id_provider_id_key" ON "routing_preference"("capability_id", "provider_id");

CREATE UNIQUE INDEX "stream_block_conversation_id_message_id_block_index_key" ON "stream_block"("conversation_id", "message_id", "block_index");

CREATE UNIQUE INDEX "sync_peer_device_id_key" ON "sync_peer"("device_id");

CREATE UNIQUE INDEX "telemetry_summary_daily_provider_id_day_ts_key" ON "telemetry_summary_daily"("provider_id", "day_ts");

CREATE UNIQUE INDEX "uniq_comp_resolve" ON "ui_component"("primitive_id", "scope", "owner_id", "variant");

CREATE UNIQUE INDEX "uq_edge" ON "node_edge"("source_id", "target_id", "edge_type");

CREATE UNIQUE INDEX "uq_harness_cmd_id_ver" ON "harness_command"("command_id", "version");

CREATE UNIQUE INDEX "uq_node_alias" ON "node_alias" ("alias_id");

CREATE UNIQUE INDEX "uq_node_version" ON "node_version"("node_id", "version");

CREATE UNIQUE INDEX "uq_wv_wf_ver" ON "workflow_version"("workflow_id", "version");

CREATE UNIQUE INDEX "user_preference_user_id_key_key" ON "user_preference"("user_id", "key");

CREATE UNIQUE INDEX "workspace_mode_user_id_key" ON "workspace_mode"("user_id");

-- ── Data ──────────────────────────────────────────────────────────────

-- SchemaMeta: (empty)

-- _prisma_migrations: 1 rows
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES
  ('c6447419-689e-4f4f-b314-e2404319732c', '78ad17d65a7f0f2ac5a34d0cdb00af51cfe74cca9f834cd8a6919ff424448b35', 1784365811015, '0001_init', '', NULL, 1784365811015, 0);

-- agent_decision_log: (empty)

-- agent_loop_run: 5 rows
INSERT INTO "agent_loop_run" ("id", "agent_id", "goal", "status", "input_json", "output_json", "started_at", "completed_at") VALUES
  ('seed:agent:researcher', 'agent:researcher', 'Reference researcher agent role (seeded)', 'completed', '{"role":"researcher"}', '{"kind":"agent-role"}', 1784418101336, 1784418101336),
  ('seed:agent:extractor', 'agent:extractor', 'Reference extractor agent role (seeded)', 'completed', '{"role":"extractor"}', '{"kind":"agent-role"}', 1784418101336, 1784418101336),
  ('seed:agent:synthesizer', 'agent:synthesizer', 'Reference synthesizer agent role (seeded)', 'completed', '{"role":"synthesizer"}', '{"kind":"agent-role"}', 1784418101336, 1784418101336),
  ('seed:agent:monitor', 'agent:monitor', 'Reference monitor agent role (seeded)', 'completed', '{"role":"monitor"}', '{"kind":"agent-role"}', 1784418101336, 1784418101336),
  ('seed:agent:tester', 'agent:tester', 'Reference tester agent role (seeded)', 'completed', '{"role":"tester"}', '{"kind":"agent-role"}', 1784418101336, 1784418101336);

-- agent_step: 5 rows
INSERT INTO "agent_step" ("id", "run_id", "step_index", "action_type", "action_json", "result_json", "success", "duration_ms", "created_at") VALUES
  ('seed:agent:researcher:0', 'seed:agent:researcher', 0, 'register_role', '{"role":"researcher"}', '{"kind":"agent-role"}', 1, 0, 1784418101336),
  ('seed:agent:extractor:0', 'seed:agent:extractor', 0, 'register_role', '{"role":"extractor"}', '{"kind":"agent-role"}', 1, 0, 1784418101336),
  ('seed:agent:synthesizer:0', 'seed:agent:synthesizer', 0, 'register_role', '{"role":"synthesizer"}', '{"kind":"agent-role"}', 1, 0, 1784418101336),
  ('seed:agent:monitor:0', 'seed:agent:monitor', 0, 'register_role', '{"role":"monitor"}', '{"kind":"agent-role"}', 1, 0, 1784418101336),
  ('seed:agent:tester:0', 'seed:agent:tester', 0, 'register_role', '{"role":"tester"}', '{"kind":"agent-role"}', 1, 0, 1784418101336);

-- alert_condition: (empty)

-- alert_event: (empty)

-- automation_run: (empty)

-- automation_schedule: (empty)

-- autonomous_step: (empty)

-- autonomous_task: (empty)

-- binding_event: (empty)

-- binding_status_log: (empty)

-- capability_binding: 57 rows
INSERT INTO "capability_binding" ("id", "global_id", "provider_id", "status", "best_program_id", "current_program_id", "promotion_history_json", "confidence", "created_at", "updated_at") VALUES
  ('bind:generic:cap:cdp:Runtime.disable', 'cap:cdp:Runtime.disable', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102055,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330480, 1784418102055),
  ('bind:generic:cap:cdp:Runtime.callFunctionOn', 'cap:cdp:Runtime.callFunctionOn', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102056,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330481, 1784418102056),
  ('bind:generic:cap:cdp:Runtime.evaluate', 'cap:cdp:Runtime.evaluate', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102056,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330481, 1784418102056),
  ('bind:generic:cap:cdp:Target.attachToTarget', 'cap:cdp:Target.attachToTarget', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102063,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330487, 1784418102063),
  ('bind:generic:cap:cdp:Input.dispatchKeyEvent', 'cap:cdp:Input.dispatchKeyEvent', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102063,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330488, 1784418102063),
  ('bind:generic:cap:cdp:Input.dispatchMouseEvent', 'cap:cdp:Input.dispatchMouseEvent', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102063,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330488, 1784418102063),
  ('bind:generic:cap:cdp:Input.insertText', 'cap:cdp:Input.insertText', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102063,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330488, 1784418102063),
  ('bind:generic:cap:cdp:Fetch.failRequest', 'cap:cdp:Fetch.failRequest', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102064,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330489, 1784418102064),
  ('bind:generic:cap:cdp:Tracing.start', 'cap:cdp:Tracing.start', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102065,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330490, 1784418102065),
  ('bind:generic:cap:cdp:Page.captureScreenshot', 'cap:cdp:Page.captureScreenshot', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102059,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330484, 1784418102059),
  ('bind:generic:cap:cdp:Page.handleJavaScriptDialog', 'cap:cdp:Page.handleJavaScriptDialog', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102059,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330484, 1784418102059),
  ('bind:generic:cap:cdp:Tracing.end', 'cap:cdp:Tracing.end', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102065,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330490, 1784418102065),
  ('bind:generic:cap:cdp:DOM.enable', 'cap:cdp:DOM.enable', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102059,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330484, 1784418102059),
  ('bind:generic:cap:cdp:Debugger.pause', 'cap:cdp:Debugger.pause', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102066,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330491, 1784418102066),
  ('bind:generic:cap:cdp:Debugger.enable', 'cap:cdp:Debugger.enable', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102065,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330490, 1784418102065),
  ('bind:generic:cap:cdp:DOM.disable', 'cap:cdp:DOM.disable', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102059,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330484, 1784418102059),
  ('bind:generic:cap:cdp:Network.setBlockedURLs', 'cap:cdp:Network.setBlockedURLs', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102061,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330486, 1784418102061),
  ('bind:generic:cap:cdp:Network.getCookies', 'cap:cdp:Network.getCookies', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102061,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330486, 1784418102061),
  ('bind:generic:cap:cdp:Network.disable', 'cap:cdp:Network.disable', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102061,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330486, 1784418102061),
  ('bind:generic:cap:cdp:Fetch.enable', 'cap:cdp:Fetch.enable', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102063,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330488, 1784418102063),
  ('bind:generic:cap:cdp:Debugger.disable', 'cap:cdp:Debugger.disable', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102066,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330491, 1784418102066),
  ('bind:generic:cap:cdp:Debugger.resume', 'cap:cdp:Debugger.resume', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102066,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330491, 1784418102066),
  ('bind:generic:cap:cdp:CSS.getComputedStyleForNode', 'cap:cdp:CSS.getComputedStyleForNode', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102067,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330491, 1784418102067),
  ('bind:generic:cap:cdp:Page.close', 'cap:cdp:Page.close', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102058,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330483, 1784418102058),
  ('bind:generic:cap:cdp:Log.disable', 'cap:cdp:Log.disable', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102067,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330492, 1784418102067),
  ('bind:generic:cap:cdp:CSS.enable', 'cap:cdp:CSS.enable', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102066,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330491, 1784418102066),
  ('bind:generic:cap:cdp:CSS.disable', 'cap:cdp:CSS.disable', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102066,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330491, 1784418102066),
  ('bind:generic:cap:cdp:Log.clear', 'cap:cdp:Log.clear', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102067,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330492, 1784418102067),
  ('bind:generic:cap:cdp:Fetch.continueRequest', 'cap:cdp:Fetch.continueRequest', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102064,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330489, 1784418102064),
  ('bind:generic:cap:cdp:Emulation.setDeviceMetricsOverride', 'cap:cdp:Emulation.setDeviceMetricsOverride', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102064,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330489, 1784418102064),
  ('bind:generic:cap:cdp:Emulation.setUserAgentOverride', 'cap:cdp:Emulation.setUserAgentOverride', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102064,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330490, 1784418102064),
  ('bind:generic:cap:cdp:Emulation.setGeolocationOverride', 'cap:cdp:Emulation.setGeolocationOverride', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102065,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330490, 1784418102065),
  ('bind:generic:cap:cdp:Log.enable', 'cap:cdp:Log.enable', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102067,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330492, 1784418102067),
  ('bind:generic:cap:cdp:Network.setUserAgentOverride', 'cap:cdp:Network.setUserAgentOverride', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102062,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330486, 1784418102062),
  ('bind:generic:cap:cdp:Fetch.disable', 'cap:cdp:Fetch.disable', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102064,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330488, 1784418102064),
  ('bind:generic:cap:cdp:Fetch.fulfillRequest', 'cap:cdp:Fetch.fulfillRequest', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102064,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330489, 1784418102064),
  ('bind:generic:cap:cdp:Page.crash', 'cap:cdp:Page.crash', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102059,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330484, 1784418102059),
  ('bind:generic:cap:cdp:DOM.getDocument', 'cap:cdp:DOM.getDocument', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102060,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330484, 1784418102060),
  ('bind:generic:cap:cdp:Target.getTargets', 'cap:cdp:Target.getTargets', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102062,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330487, 1784418102062),
  ('bind:generic:cap:cdp:Page.enable', 'cap:cdp:Page.enable', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102058,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330482, 1784418102058),
  ('bind:generic:cap:cdp:Runtime.awaitPromise', 'cap:cdp:Runtime.awaitPromise', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102057,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330482, 1784418102057),
  ('bind:generic:cap:cdp:Page.disable', 'cap:cdp:Page.disable', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102058,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330482, 1784418102058),
  ('bind:generic:cap:cdp:Page.navigate', 'cap:cdp:Page.navigate', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102058,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330483, 1784418102058),
  ('bind:generic:cap:cdp:Target.closeTarget', 'cap:cdp:Target.closeTarget', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102062,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330487, 1784418102062),
  ('bind:generic:cap:cdp:Runtime.globalLexicalScopeNames', 'cap:cdp:Runtime.globalLexicalScopeNames', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102057,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330482, 1784418102057),
  ('bind:generic:cap:cdp:Page.reload', 'cap:cdp:Page.reload', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102058,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330483, 1784418102058),
  ('bind:generic:cap:cdp:DOM.setAttributeValue', 'cap:cdp:DOM.setAttributeValue', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102060,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330485, 1784418102060),
  ('bind:generic:cap:cdp:DOM.getOuterHTML', 'cap:cdp:DOM.getOuterHTML', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102061,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330485, 1784418102061),
  ('bind:generic:cap:cdp:DOM.removeNode', 'cap:cdp:DOM.removeNode', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102060,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330485, 1784418102060),
  ('bind:generic:cap:cdp:Network.enable', 'cap:cdp:Network.enable', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102061,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330486, 1784418102061),
  ('bind:generic:cap:cdp:DOM.getBoxModel', 'cap:cdp:DOM.getBoxModel', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102060,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330485, 1784418102060),
  ('bind:generic:cap:cdp:Target.createTarget', 'cap:cdp:Target.createTarget', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102062,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330487, 1784418102062),
  ('bind:generic:cap:cdp:Network.getResponseBody', 'cap:cdp:Network.getResponseBody', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102062,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330486, 1784418102062),
  ('bind:generic:cap:cdp:Network.clearBrowserCache', 'cap:cdp:Network.clearBrowserCache', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102062,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330487, 1784418102062),
  ('bind:generic:cap:cdp:Runtime.getProperties', 'cap:cdp:Runtime.getProperties', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102057,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330482, 1784418102057),
  ('bind:generic:cap:cdp:DOM.querySelector', 'cap:cdp:DOM.querySelector', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102060,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330485, 1784418102060),
  ('bind:generic:cap:cdp:Runtime.enable', 'cap:cdp:Runtime.enable', 'generic', 'prospect', NULL, NULL, '[{"ts":1784418102054,"from":"prospect","to":"prospect","reason":"d2-pending-verification"}]', 0, 1784366330479, 1784418102054);

-- capability_intent: (empty)

-- capability_macro: (empty)

-- capability_override: (empty)

-- capability_program: (empty)

-- capability_shape: (empty)

-- capability_shape_binding: (empty)

-- capability_taxonomy: 57 rows
INSERT INTO "capability_taxonomy" ("id", "name", "slug", "category", "description", "input_type", "ui_component", "ui_label", "ui_icon", "ui_position", "ui_order", "ui_layer_depth", "parent_capability_id", "ui_group", "ui_priority", "interaction_mode", "ui_states_json", "ui_visibility_rule", "existential_rule", "ui_input_schema", "mutation_effects_json", "recovery_behavior", "state_persistence", "data_flow", "min_plan_tier", "depends_on_json", "concurrency_safe", "op_classification", "requires_user_confirmation", "max_result_size", "result_component", "result_layout", "search_hints_json", "aliases_json", "availability_json", "prefetch", "created_at", "updated_at") VALUES
  ('cap:cdp:Runtime.enable', 'cap:cdp:Runtime.enable', 'cap-cdp-Runtime.enable', 'cdp', 'Discovered CDP capability cap:cdp:Runtime.enable', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230872, 1784418102054),
  ('cap:cdp:Network.getCookies', 'cap:cdp:Network.getCookies', 'cap-cdp-Network.getCookies', 'cdp', 'Discovered CDP capability cap:cdp:Network.getCookies', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230883, 1784418102061),
  ('cap:cdp:Network.getResponseBody', 'cap:cdp:Network.getResponseBody', 'cap-cdp-Network.getResponseBody', 'cdp', 'Discovered CDP capability cap:cdp:Network.getResponseBody', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230883, 1784418102062),
  ('cap:cdp:Network.setUserAgentOverride', 'cap:cdp:Network.setUserAgentOverride', 'cap-cdp-Network.setUserAgentOverride', 'cdp', 'Discovered CDP capability cap:cdp:Network.setUserAgentOverride', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230884, 1784418102062),
  ('cap:cdp:Network.clearBrowserCache', 'cap:cdp:Network.clearBrowserCache', 'cap-cdp-Network.clearBrowserCache', 'cdp', 'Discovered CDP capability cap:cdp:Network.clearBrowserCache', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230885, 1784418102062),
  ('cap:cdp:Emulation.setDeviceMetricsOverride', 'cap:cdp:Emulation.setDeviceMetricsOverride', 'cap-cdp-Emulation.setDeviceMetricsOverride', 'cdp', 'Discovered CDP capability cap:cdp:Emulation.setDeviceMetricsOverride', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230887, 1784418102064),
  ('cap:cdp:Emulation.setUserAgentOverride', 'cap:cdp:Emulation.setUserAgentOverride', 'cap-cdp-Emulation.setUserAgentOverride', 'cdp', 'Discovered CDP capability cap:cdp:Emulation.setUserAgentOverride', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230887, 1784418102064),
  ('cap:cdp:Emulation.setGeolocationOverride', 'cap:cdp:Emulation.setGeolocationOverride', 'cap-cdp-Emulation.setGeolocationOverride', 'cdp', 'Discovered CDP capability cap:cdp:Emulation.setGeolocationOverride', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230888, 1784418102065),
  ('cap:cdp:Fetch.continueRequest', 'cap:cdp:Fetch.continueRequest', 'cap-cdp-Fetch.continueRequest', 'cdp', 'Discovered CDP capability cap:cdp:Fetch.continueRequest', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230887, 1784418102064),
  ('cap:cdp:Input.dispatchKeyEvent', 'cap:cdp:Input.dispatchKeyEvent', 'cap-cdp-Input.dispatchKeyEvent', 'cdp', 'Discovered CDP capability cap:cdp:Input.dispatchKeyEvent', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230886, 1784418102063),
  ('cap:cdp:Input.dispatchMouseEvent', 'cap:cdp:Input.dispatchMouseEvent', 'cap-cdp-Input.dispatchMouseEvent', 'cdp', 'Discovered CDP capability cap:cdp:Input.dispatchMouseEvent', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230886, 1784418102063),
  ('cap:cdp:Tracing.start', 'cap:cdp:Tracing.start', 'cap-cdp-Tracing.start', 'cdp', 'Discovered CDP capability cap:cdp:Tracing.start', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230888, 1784418102065),
  ('cap:cdp:Tracing.end', 'cap:cdp:Tracing.end', 'cap-cdp-Tracing.end', 'cdp', 'Discovered CDP capability cap:cdp:Tracing.end', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230888, 1784418102065),
  ('cap:cdp:Runtime.disable', 'cap:cdp:Runtime.disable', 'cap-cdp-Runtime.disable', 'cdp', 'Discovered CDP capability cap:cdp:Runtime.disable', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230873, 1784418102055),
  ('cap:cdp:Debugger.pause', 'cap:cdp:Debugger.pause', 'cap-cdp-Debugger.pause', 'cdp', 'Discovered CDP capability cap:cdp:Debugger.pause', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230888, 1784418102066),
  ('cap:cdp:Runtime.evaluate', 'cap:cdp:Runtime.evaluate', 'cap-cdp-Runtime.evaluate', 'cdp', 'Discovered CDP capability cap:cdp:Runtime.evaluate', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230874, 1784418102056),
  ('cap:cdp:Debugger.resume', 'cap:cdp:Debugger.resume', 'cap-cdp-Debugger.resume', 'cdp', 'Discovered CDP capability cap:cdp:Debugger.resume', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230889, 1784418102066),
  ('cap:cdp:Runtime.callFunctionOn', 'cap:cdp:Runtime.callFunctionOn', 'cap-cdp-Runtime.callFunctionOn', 'cdp', 'Discovered CDP capability cap:cdp:Runtime.callFunctionOn', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230874, 1784418102056),
  ('cap:cdp:Input.insertText', 'cap:cdp:Input.insertText', 'cap-cdp-Input.insertText', 'cdp', 'Discovered CDP capability cap:cdp:Input.insertText', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230886, 1784418102063),
  ('cap:cdp:Fetch.enable', 'cap:cdp:Fetch.enable', 'cap-cdp-Fetch.enable', 'cdp', 'Discovered CDP capability cap:cdp:Fetch.enable', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230886, 1784418102063),
  ('cap:cdp:CSS.disable', 'cap:cdp:CSS.disable', 'cap-cdp-CSS.disable', 'cdp', 'Discovered CDP capability cap:cdp:CSS.disable', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230889, 1784418102066),
  ('cap:cdp:Debugger.enable', 'cap:cdp:Debugger.enable', 'cap-cdp-Debugger.enable', 'cdp', 'Discovered CDP capability cap:cdp:Debugger.enable', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230888, 1784418102065),
  ('cap:cdp:Target.createTarget', 'cap:cdp:Target.createTarget', 'cap-cdp-Target.createTarget', 'cdp', 'Discovered CDP capability cap:cdp:Target.createTarget', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230885, 1784418102062),
  ('cap:cdp:CSS.enable', 'cap:cdp:CSS.enable', 'cap-cdp-CSS.enable', 'cdp', 'Discovered CDP capability cap:cdp:CSS.enable', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230889, 1784418102066),
  ('cap:cdp:Target.closeTarget', 'cap:cdp:Target.closeTarget', 'cap-cdp-Target.closeTarget', 'cdp', 'Discovered CDP capability cap:cdp:Target.closeTarget', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230885, 1784418102062),
  ('cap:cdp:Debugger.disable', 'cap:cdp:Debugger.disable', 'cap-cdp-Debugger.disable', 'cdp', 'Discovered CDP capability cap:cdp:Debugger.disable', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230888, 1784418102066),
  ('cap:cdp:Runtime.getProperties', 'cap:cdp:Runtime.getProperties', 'cap-cdp-Runtime.getProperties', 'cdp', 'Discovered CDP capability cap:cdp:Runtime.getProperties', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230875, 1784418102057),
  ('cap:cdp:Log.disable', 'cap:cdp:Log.disable', 'cap-cdp-Log.disable', 'cdp', 'Discovered CDP capability cap:cdp:Log.disable', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230889, 1784418102067),
  ('cap:cdp:Runtime.awaitPromise', 'cap:cdp:Runtime.awaitPromise', 'cap-cdp-Runtime.awaitPromise', 'cdp', 'Discovered CDP capability cap:cdp:Runtime.awaitPromise', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230875, 1784418102057),
  ('cap:cdp:Runtime.globalLexicalScopeNames', 'cap:cdp:Runtime.globalLexicalScopeNames', 'cap-cdp-Runtime.globalLexicalScopeNames', 'cdp', 'Discovered CDP capability cap:cdp:Runtime.globalLexicalScopeNames', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230875, 1784418102057),
  ('cap:cdp:Page.crash', 'cap:cdp:Page.crash', 'cap-cdp-Page.crash', 'cdp', 'Discovered CDP capability cap:cdp:Page.crash', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230879, 1784418102059),
  ('cap:cdp:Target.getTargets', 'cap:cdp:Target.getTargets', 'cap-cdp-Target.getTargets', 'cdp', 'Discovered CDP capability cap:cdp:Target.getTargets', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230885, 1784418102062),
  ('cap:cdp:Fetch.disable', 'cap:cdp:Fetch.disable', 'cap-cdp-Fetch.disable', 'cdp', 'Discovered CDP capability cap:cdp:Fetch.disable', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230886, 1784418102064),
  ('cap:cdp:Log.enable', 'cap:cdp:Log.enable', 'cap-cdp-Log.enable', 'cdp', 'Discovered CDP capability cap:cdp:Log.enable', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230889, 1784418102067),
  ('cap:cdp:DOM.removeNode', 'cap:cdp:DOM.removeNode', 'cap-cdp-DOM.removeNode', 'cdp', 'Discovered CDP capability cap:cdp:DOM.removeNode', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230881, 1784418102060),
  ('cap:cdp:Page.navigate', 'cap:cdp:Page.navigate', 'cap-cdp-Page.navigate', 'cdp', 'Discovered CDP capability cap:cdp:Page.navigate', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230877, 1784418102058),
  ('cap:cdp:Page.reload', 'cap:cdp:Page.reload', 'cap-cdp-Page.reload', 'cdp', 'Discovered CDP capability cap:cdp:Page.reload', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230877, 1784418102058),
  ('cap:cdp:Page.close', 'cap:cdp:Page.close', 'cap-cdp-Page.close', 'cdp', 'Discovered CDP capability cap:cdp:Page.close', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230877, 1784418102058),
  ('cap:cdp:Page.captureScreenshot', 'cap:cdp:Page.captureScreenshot', 'cap-cdp-Page.captureScreenshot', 'cdp', 'Discovered CDP capability cap:cdp:Page.captureScreenshot', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230878, 1784418102059),
  ('cap:cdp:Page.disable', 'cap:cdp:Page.disable', 'cap-cdp-Page.disable', 'cdp', 'Discovered CDP capability cap:cdp:Page.disable', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230876, 1784418102058),
  ('cap:cdp:Page.handleJavaScriptDialog', 'cap:cdp:Page.handleJavaScriptDialog', 'cap-cdp-Page.handleJavaScriptDialog', 'cdp', 'Discovered CDP capability cap:cdp:Page.handleJavaScriptDialog', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230878, 1784418102059),
  ('cap:cdp:DOM.getOuterHTML', 'cap:cdp:DOM.getOuterHTML', 'cap-cdp-DOM.getOuterHTML', 'cdp', 'Discovered CDP capability cap:cdp:DOM.getOuterHTML', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230882, 1784418102061),
  ('cap:cdp:Network.enable', 'cap:cdp:Network.enable', 'cap-cdp-Network.enable', 'cdp', 'Discovered CDP capability cap:cdp:Network.enable', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230882, 1784418102061),
  ('cap:cdp:Network.disable', 'cap:cdp:Network.disable', 'cap-cdp-Network.disable', 'cdp', 'Discovered CDP capability cap:cdp:Network.disable', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230882, 1784418102061),
  ('cap:cdp:Fetch.fulfillRequest', 'cap:cdp:Fetch.fulfillRequest', 'cap-cdp-Fetch.fulfillRequest', 'cdp', 'Discovered CDP capability cap:cdp:Fetch.fulfillRequest', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230887, 1784418102064),
  ('cap:cdp:Network.setBlockedURLs', 'cap:cdp:Network.setBlockedURLs', 'cap-cdp-Network.setBlockedURLs', 'cdp', 'Discovered CDP capability cap:cdp:Network.setBlockedURLs', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230883, 1784418102061),
  ('cap:cdp:Page.enable', 'cap:cdp:Page.enable', 'cap-cdp-Page.enable', 'cdp', 'Discovered CDP capability cap:cdp:Page.enable', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230876, 1784418102058),
  ('cap:cdp:Fetch.failRequest', 'cap:cdp:Fetch.failRequest', 'cap-cdp-Fetch.failRequest', 'cdp', 'Discovered CDP capability cap:cdp:Fetch.failRequest', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230887, 1784418102064),
  ('cap:cdp:CSS.getComputedStyleForNode', 'cap:cdp:CSS.getComputedStyleForNode', 'cap-cdp-CSS.getComputedStyleForNode', 'cdp', 'Discovered CDP capability cap:cdp:CSS.getComputedStyleForNode', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230889, 1784418102067),
  ('cap:cdp:DOM.getDocument', 'cap:cdp:DOM.getDocument', 'cap-cdp-DOM.getDocument', 'cdp', 'Discovered CDP capability cap:cdp:DOM.getDocument', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230880, 1784418102060),
  ('cap:cdp:DOM.enable', 'cap:cdp:DOM.enable', 'cap-cdp-DOM.enable', 'cdp', 'Discovered CDP capability cap:cdp:DOM.enable', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230879, 1784418102059),
  ('cap:cdp:DOM.disable', 'cap:cdp:DOM.disable', 'cap-cdp-DOM.disable', 'cdp', 'Discovered CDP capability cap:cdp:DOM.disable', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230879, 1784418102059),
  ('cap:cdp:DOM.querySelector', 'cap:cdp:DOM.querySelector', 'cap-cdp-DOM.querySelector', 'cdp', 'Discovered CDP capability cap:cdp:DOM.querySelector', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230880, 1784418102060),
  ('cap:cdp:DOM.getBoxModel', 'cap:cdp:DOM.getBoxModel', 'cap-cdp-DOM.getBoxModel', 'cdp', 'Discovered CDP capability cap:cdp:DOM.getBoxModel', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230880, 1784418102060),
  ('cap:cdp:DOM.setAttributeValue', 'cap:cdp:DOM.setAttributeValue', 'cap-cdp-DOM.setAttributeValue', 'cdp', 'Discovered CDP capability cap:cdp:DOM.setAttributeValue', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230880, 1784418102060),
  ('cap:cdp:Log.clear', 'cap:cdp:Log.clear', 'cap-cdp-Log.clear', 'cdp', 'Discovered CDP capability cap:cdp:Log.clear', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230890, 1784418102067),
  ('cap:cdp:Target.attachToTarget', 'cap:cdp:Target.attachToTarget', 'cap-cdp-Target.attachToTarget', 'cdp', 'Discovered CDP capability cap:cdp:Target.attachToTarget', 'void', 'action_button', NULL, NULL, 'composer', 0, 0, NULL, 'default', 'secondary', 'single_click', '[]', NULL, NULL, '{}', '{}', 'retry_manual', 'none', 'user_to_provider', 'free', '[]', 0, NULL, 0, 100000, 'text_block', 'inline', '[]', '[]', '{}', 0, 1784351230886, 1784418102063);

-- capability_taxonomy_version: (empty)

-- capability_telemetry: (empty)

-- capability_tier: (empty)

-- circuit_breaker_state: (empty)

-- config_audit: (empty)

-- config_entry: (empty)

-- content_unit: (empty)

-- context_budget_config: (empty)

-- context_layer: (empty)

-- conversation: 5 rows
INSERT INTO "conversation" ("id", "provider_session_id", "provider_id", "title", "state", "message_count", "last_message_at", "context_json", "created_at", "updated_at", "project_id", "topic_id", "source", "external_id", "import_job_id") VALUES
  ('395ee978-d9bc-407f-baf8-a16dd12e53c1', '01KXT9F3E3PJMPAQH1SRPZD8FD', 'claude', NULL, 'active', 2, 1784367600437, '{"provider":{"id":"claude","slug":"claude","displayName":"claude"},"account":{"email":"claude_default","planTier":"free","loginState":"unknown"},"chrome":{"status":"running","circuitState":"closed"},"capabilities":{"total":57,"available":57}}', 1784367517140, 1784367600437, NULL, NULL, 'live', NULL, NULL),
  ('fbdb979f-831b-4439-8f11-25a1b176dc23', '01KXT9F3E3PJMPAQH1SRPZD8FD', 'claude', NULL, 'active', 0, NULL, '{}', 1784372346569, 1784372346569, NULL, NULL, 'live', NULL, NULL),
  ('26981fb4-af79-4342-9b66-cd47fb5f48e2', '01KXT9F3E3PJMPAQH1SRPZD8FD', 'claude', NULL, 'active', 0, NULL, '{}', 1784372358048, 1784372358048, NULL, NULL, 'live', NULL, NULL),
  ('7e915c73-921c-4ff2-ad51-f8d028b7c258', '01KXT9F3E3PJMPAQH1SRPZD8FD', 'claude', NULL, 'active', 2, 1784372580228, '{"provider":{"id":"claude","slug":"claude","displayName":"claude"},"account":{"email":"claude_default","planTier":"free","loginState":"unknown"},"chrome":{"status":"running","circuitState":"closed"},"capabilities":{"total":57,"available":57}}', 1784372502012, 1784372580228, NULL, NULL, 'live', NULL, NULL),
  ('e0dd4c14-7544-4895-a5b8-f218dd7bdc0e', '01KXVSX13T8KWBRMKY1ZWS06P1', 'gemini', NULL, 'active', 0, NULL, '{}', 1784418305149, 1784418305149, NULL, NULL, 'live', NULL, NULL);

-- conversation_message: 4 rows
INSERT INTO "conversation_message" ("id", "conversation_id", "role", "content", "blocks_json", "block_count", "parent_message_id", "sequence_index", "latency_ms", "token_count", "model", "metadata_json", "created_at", "updated_at") VALUES
  ('01KXT9HMCVCM5VTK56A99TXW44', '395ee978-d9bc-407f-baf8-a16dd12e53c1', 'user', 'hello', '[{"type":"text","text":"hello"}]', 1, NULL, 0, 0, NULL, NULL, '{}', 1784367600027, NULL),
  ('01KXT9HMENAVSAWDAAJRCQD051', '395ee978-d9bc-407f-baf8-a16dd12e53c1', 'assistant', '', '[]', 0, NULL, 0, 66453, NULL, NULL, '{}', 1784367600085, NULL),
  ('01KXTE9KTH3X9WNAVJ8KV1NACD', '7e915c73-921c-4ff2-ad51-f8d028b7c258', 'user', 'Say hi in exactly three words.', '[{"type":"text","text":"Say hi in exactly three words."}]', 1, NULL, 0, 0, NULL, NULL, '{}', 1784372580177, NULL),
  ('01KXTE9KTWV99CKQ944ZQFVCFK', '7e915c73-921c-4ff2-ad51-f8d028b7c258', 'assistant', '', '[]', 0, NULL, 0, 66246, NULL, NULL, '{}', 1784372580188, NULL);

-- conversation_topic: (empty)

-- decision_record: (empty)

-- discovery_result: (empty)

-- discovery_session: (empty)

-- drift_event: (empty)

-- entity: (empty)

-- entity_mention: (empty)

-- episodic_memory: (empty)

-- failure_classification: (empty)

-- fleet_event: 10 rows
INSERT INTO "fleet_event" ("id", "slave_id", "provider_id", "event_type", "event_data_json", "ts") VALUES
  ('01KXT8GC1X46FE5MC3514SC5HZ', 'claude_default_1784366507689', 'claude', 'spawned', '{"pid":16580,"port":9300}', 1784366510141),
  ('01KXT9FN2WP0JS8DDE5PRAW6A2', 'claude_claude_default_1784367533816', 'claude', 'spawned', '{"pid":13624,"port":9300}', 1784367535197),
  ('01KXTE211DVC3QJD5GGS0KXRRP', 'claude_default_1784372330161', 'claude', 'spawned', '{"pid":8868,"port":9300}', 1784372331565),
  ('01KXTE7M2XW1MNCK6PV98Z43GJ', 'claude_claude_default_1784372514016', 'claude', 'spawned', '{"pid":6540,"port":9301}', 1784372514909),
  ('01KXTGMZZ8247A2HMXHJ8GRQX1', 'gemini_user-at-gmail.com_1784375049177', 'gemini', 'spawned', '{"pid":13652,"port":9300}', 1784375050216),
  ('01KXTGNT7HMHSQJK7209NMJ4Q1', 'gemini_user-at-gmail.com_1784375061933', 'gemini', 'spawn_failed', '{"error":"ChromeLaunchTimeoutError: Chrome did not open debug port 9301 within 15000ms (C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe)"}', 1784375077105),
  ('01KXTGPMPBWNKXXAC939BJGYAN', 'gemini_user-at-gmail.com_1784375089012', 'gemini', 'spawn_failed', '{"error":"ChromeLaunchTimeoutError: Chrome did not open debug port 9302 within 15000ms (C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe)"}', 1784375104203),
  ('01KXTGR0AYQ1EHA74RQ1WBGJ4V', 'gemini_user-at-gmail.com_1784375133721', 'gemini', 'spawn_failed', '{"error":"ChromeLaunchTimeoutError: Chrome did not open debug port 9303 within 15000ms (C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe)"}', 1784375148894),
  ('01KXVSR45Z1DSBRNRGT749A271', 'gemini_owservera_1784418143558', 'gemini', 'spawned', '{"pid":15348,"port":9300}', 1784418144447),
  ('01KXVSWAAM20989E054VY00BMW', 'gemini_owservera_1784418266536', 'gemini', 'spawn_failed', '{"error":"ChromeLaunchTimeoutError: Chrome did not open debug port 9301 within 15000ms (C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe)"}', 1784418281812);

-- harness_checkpoint: (empty)

-- harness_command: (empty)

-- health_digest: (empty)

-- health_tick: (empty)

-- hitl_gate: (empty)

-- hpe_session: (empty)

-- import_job: (empty)

-- kernel_events: (empty)

-- kernel_provenance: (empty)

-- kernel_spans: (empty)

-- kernel_topology: (empty)

-- latency_measurement: (empty)

-- learning_event: (empty)

-- manifest_change_log: (empty)

-- manifest_drift: (empty)

-- mcp_server_config: (empty)

-- mcp_tool: (empty)

-- mcp_tool_call: (empty)

-- memory_access: (empty)

-- memory_curated: (empty)

-- memory_embedding: (empty)

-- memory_feedback: (empty)

-- memory_link: (empty)

-- message_attachment: (empty)

-- message_entity: (empty)

-- message_link: (empty)

-- migration_log: (empty)

-- mirror_snapshot: (empty)

-- mirror_state: (empty)

-- mux_response: (empty)

-- mux_session: (empty)

-- nlcl_graph_edges: (empty)

-- nlcl_graph_nodes: (empty)

-- node: 4 rows
INSERT INTO "node" ("id", "type", "parent_id", "schema_version", "raw_source", "data_json", "edges_json", "meta_json", "search_text", "conversation_id", "message_id", "source_parser", "content_hash", "version", "state", "security_level", "content_type", "author_did", "signature", "acl_json", "quality_json", "valid_from", "valid_until", "parent_version", "acu_type", "lineage_kind", "extractor_version", "parser_version", "value_score", "is_high_value", "created_at", "updated_at") VALUES
  ('01KXT9HMGP13TF2PH27P161M2S', 'cap-store.message', NULL, 1, 'hello', '{"role":"user","messageId":"01KXT9HMENAVSAWDAAJRCQD051","text":"hello","blockCount":1}', '[]', '{"conversationId":"395ee978-d9bc-407f-baf8-a16dd12e53c1","messageId":"01KXT9HMENAVSAWDAAJRCQD051","sourceParser":"conversation-manager"}', '', '395ee978-d9bc-407f-baf8-a16dd12e53c1', '01KXT9HMENAVSAWDAAJRCQD051', 'conversation-manager', 'b75ac2eb0066da73397da8cc3873e21e083845964ea72688470340263cce6e73', 1, 'active', 0, 'message', 'user', NULL, '{"canView":true,"canRemix":false,"canReshare":false}', '{}', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 1784367600150, 1784367600150),
  ('01KXT9HMKTJXT181N0X9BFEH3T', 'cap-store.message', '01KXT9HMGP13TF2PH27P161M2S', 1, '', '{"role":"assistant","messageId":"01KXT9HMENAVSAWDAAJRCQD051","text":"","blockCount":0}', '[{"type":"responds_to","targetId":"01KXT9HMGP13TF2PH27P161M2S","properties":{"role":"assistant"}}]', '{"conversationId":"395ee978-d9bc-407f-baf8-a16dd12e53c1","messageId":"01KXT9HMENAVSAWDAAJRCQD051","sourceParser":"conversation-manager"}', '', '395ee978-d9bc-407f-baf8-a16dd12e53c1', '01KXT9HMENAVSAWDAAJRCQD051', 'conversation-manager', '06565e910fb39c09ea8318a979accccbef44cb5a1b69638cffabc7056b32c687', 1, 'active', 0, 'message', 'assistant', NULL, '{"canView":true,"canRemix":false,"canReshare":false}', '{}', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 1784367600250, 1784367600250),
  ('01KXTE9KV28Q9K74SMDREKF4NX', 'cap-store.message', NULL, 1, 'Say hi in exactly three words.', '{"role":"user","messageId":"01KXTE9KTWV99CKQ944ZQFVCFK","text":"Say hi in exactly three words.","blockCount":1}', '[]', '{"conversationId":"7e915c73-921c-4ff2-ad51-f8d028b7c258","messageId":"01KXTE9KTWV99CKQ944ZQFVCFK","sourceParser":"conversation-manager"}', '', '7e915c73-921c-4ff2-ad51-f8d028b7c258', '01KXTE9KTWV99CKQ944ZQFVCFK', 'conversation-manager', 'f3b5c933ae0b4b2c9db858336e3eb6a1d937bb3a361fcffcac1214640198a207', 1, 'active', 0, 'message', 'user', NULL, '{"canView":true,"canRemix":false,"canReshare":false}', '{}', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 1784372580194, 1784372580194),
  ('01KXTE9KVJR3DCR7X9DH1XNDYE', 'cap-store.message', '01KXTE9KV28Q9K74SMDREKF4NX', 1, '', '{"role":"assistant","messageId":"01KXTE9KTWV99CKQ944ZQFVCFK","text":"","blockCount":0}', '[{"type":"responds_to","targetId":"01KXTE9KV28Q9K74SMDREKF4NX","properties":{"role":"assistant"}}]', '{"conversationId":"7e915c73-921c-4ff2-ad51-f8d028b7c258","messageId":"01KXTE9KTWV99CKQ944ZQFVCFK","sourceParser":"conversation-manager"}', '', '7e915c73-921c-4ff2-ad51-f8d028b7c258', '01KXTE9KTWV99CKQ944ZQFVCFK', 'conversation-manager', 'ebd0b6b78a045a05f22ad2dc138ba2067357a518c0fc740408ac3223c052c1da', 1, 'active', 0, 'message', 'assistant', NULL, '{"canView":true,"canRemix":false,"canReshare":false}', '{}', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 1784372580210, 1784372580210);

-- node_alias: (empty)

-- node_edge: 2 rows
INSERT INTO "node_edge" ("id", "source_id", "target_id", "edge_type", "label", "weight", "properties_json", "created_at") VALUES
  ('01KXT9HMRE69ZXN04A4QF5YKX2', '01KXT9HMKTJXT181N0X9BFEH3T', '01KXT9HMGP13TF2PH27P161M2S', 'responds_to', NULL, NULL, '{"role":"assistant"}', 1784367600250),
  ('01KXTE9KVZ7CHF8SGX268NHGFH', '01KXTE9KVJR3DCR7X9DH1XNDYE', '01KXTE9KV28Q9K74SMDREKF4NX', 'responds_to', NULL, NULL, '{"role":"assistant"}', 1784372580210);

-- node_version: 4 rows
INSERT INTO "node_version" ("id", "node_id", "version", "hash", "content_ref", "op", "parent_version", "created_at") VALUES
  ('01KXT9HMJ826ZBDMVN4VQXRBYG', '01KXT9HMGP13TF2PH27P161M2S', 1, 'b75ac2eb0066da73397da8cc3873e21e083845964ea72688470340263cce6e73', '{"role":"user","messageId":"01KXT9HMENAVSAWDAAJRCQD051","text":"hello","blockCount":1}', 'create', NULL, 1784367600150),
  ('01KXT9HMP85WEKSE18PBB9RAZS', '01KXT9HMKTJXT181N0X9BFEH3T', 1, '06565e910fb39c09ea8318a979accccbef44cb5a1b69638cffabc7056b32c687', '{"role":"assistant","messageId":"01KXT9HMENAVSAWDAAJRCQD051","text":"","blockCount":0}', 'create', NULL, 1784367600250),
  ('01KXTE9KVDQ1SEXNSFTNHRYPC0', '01KXTE9KV28Q9K74SMDREKF4NX', 1, 'f3b5c933ae0b4b2c9db858336e3eb6a1d937bb3a361fcffcac1214640198a207', '{"role":"user","messageId":"01KXTE9KTWV99CKQ944ZQFVCFK","text":"Say hi in exactly three words.","blockCount":1}', 'create', NULL, 1784372580194),
  ('01KXTE9KVQGXMRQ44BP59FZQDZ', '01KXTE9KVJR3DCR7X9DH1XNDYE', 1, 'ebd0b6b78a045a05f22ad2dc138ba2067357a518c0fc740408ac3223c052c1da', '{"role":"assistant","messageId":"01KXTE9KTWV99CKQ944ZQFVCFK","text":"","blockCount":0}', 'create', NULL, 1784372580210);

-- observation_event: (empty)

-- optimistic_update: (empty)

-- outcome: (empty)

-- pattern_extract: (empty)

-- plugin_registry: (empty)

-- policy_rule: 6 rows
INSERT INTO "policy_rule" ("id", "name", "condition", "classification", "requires_approval", "cooldown_ms", "max_occurrences", "window_ms", "is_active") VALUES
  ('01KXVSPVMB6E6HER5D3J310FNE', 'read_only_safe', 'action matches ^(get|list|read|query|fetch|search)$', 'read', 0, 0, 1000000, 60000, 1),
  ('01KXVSPVNWQ1C9R7XR6XM5FP3D', 'navigate_safe', 'action matches ^(navigate|goto|open|visit)$', 'navigate', 0, 0, 1000000, 60000, 1),
  ('01KXVSPVRY2FMT7DG4CF9Y3R7D', 'write_needs_approval', 'action matches ^(create|update|delete|submit|save|write|patch)$', 'write', 1, 0, 10, 60000, 1),
  ('01KXVSPVSS6FSBJTDHDZ6T7YCA', 'destructive_always', 'action matches ^(delete_permanent|format|reset|drop|purge|destroy)$', 'destructive', 1, 5000, 3, 300000, 1),
  ('01KXVSPVTPD490E70AW55JSYH4', 'financial_always', 'action matches ^(purchase|pay|transfer|checkout|buy|subscribe)$', 'financial', 1, 10000, 5, 600000, 1),
  ('01KXVSPVTTG52BAZ490T5W6QZS', 'communication_always', 'action matches ^(send_email|send_message|post_comment|reply)$', 'communication', 1, 0, 20, 60000, 1);

-- primitive: 53 rows
INSERT INTO "primitive" ("id", "scope", "family_id", "provider_id", "label", "description", "default_region_json", "version", "created_at", "updated_at") VALUES
  ('prim:cross:message-bubble', 'cross-type', NULL, NULL, 'Message Bubble', 'One message card from one sender. Shared across chat/messenger/social.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358836895, 1784358836895),
  ('prim:cross:attach-doc', 'cross-type', NULL, NULL, 'Attach Doc', 'Attach file/image/doc before sending.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358836915, 1784358836915),
  ('prim:cross:composer', 'cross-type', NULL, NULL, 'Composer', 'Text-entry surface that produces a message/post.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358836958, 1784358836958),
  ('prim:cross:send-action', 'cross-type', NULL, NULL, 'Send Action', 'Commit composed content.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358836973, 1784358836973),
  ('prim:cross:thread', 'cross-type', NULL, NULL, 'Thread / Conversation List', 'Scroll region of past messages.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358836986, 1784358836986),
  ('prim:cross:sender-identity', 'cross-type', NULL, NULL, 'Sender Identity', 'Who is "me" (account switcher / avatar).', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837034, 1784358837034),
  ('prim:cross:search', 'cross-type', NULL, NULL, 'Search', 'Find within the surface.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837048, 1784358837048),
  ('prim:cross:notification', 'cross-type', NULL, NULL, 'Notification', 'Toast / badge surface.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837057, 1784358837057),
  ('prim:cross:settings', 'cross-type', NULL, NULL, 'Settings', 'Gear / preferences entry.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837071, 1784358837071),
  ('prim:cross:error-surface', 'cross-type', NULL, NULL, 'Error Surface', 'Error / empty / blocked state.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837101, 1784358837101),
  ('prim:ai-chat:prompt-box', 'family', '01KXT166HPX6FWQZAJCQ1GPFF0', NULL, 'Prompt Box', 'Composer variant for AI chat.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837112, 1784358837112),
  ('prim:ai-chat:response-bubble', 'family', '01KXT166HPX6FWQZAJCQ1GPFF0', NULL, 'Response Bubble', 'Assistant message bubble.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837162, 1784358837162),
  ('prim:ai-chat:user-bubble', 'family', '01KXT166HPX6FWQZAJCQ1GPFF0', NULL, 'User Bubble', 'User message bubble.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837175, 1784358837175),
  ('prim:ai-chat:model-switcher', 'family', '01KXT166HPX6FWQZAJCQ1GPFF0', NULL, 'Model Switcher', 'Pick the underlying model.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837188, 1784358837188),
  ('prim:ai-chat:new-chat', 'family', '01KXT166HPX6FWQZAJCQ1GPFF0', NULL, 'New Chat', 'Start a fresh conversation.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837196, 1784358837196),
  ('prim:ai-chat:chat-history-sidebar', 'family', '01KXT166HPX6FWQZAJCQ1GPFF0', NULL, 'Chat History Sidebar', 'List of past conversations.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837222, 1784358837222),
  ('prim:ai-chat:streaming-indicator', 'family', '01KXT166HPX6FWQZAJCQ1GPFF0', NULL, 'Streaming Indicator', 'Token streaming progress.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837230, 1784358837230),
  ('prim:ai-chat:regenerate', 'family', '01KXT166HPX6FWQZAJCQ1GPFF0', NULL, 'Regenerate', 'Re-run the last assistant turn.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837246, 1784358837246),
  ('prim:ai-chat:copy-message', 'family', '01KXT166HPX6FWQZAJCQ1GPFF0', NULL, 'Copy Message', 'Copy a message to clipboard.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837274, 1784358837274),
  ('prim:ai-chat:branch', 'family', '01KXT166HPX6FWQZAJCQ1GPFF0', NULL, 'Branch', 'Fork a conversation branch.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837288, 1784358837288),
  ('prim:email:folder-list', 'family', '01KXT166KQE4RJ5JXVJF2939AA', NULL, 'Folder List', 'Inbox/sent/drafts.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837302, 1784358837302),
  ('prim:email:message-list', 'family', '01KXT166KQE4RJ5JXVJF2939AA', NULL, 'Message List', 'List of messages in a folder.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837329, 1784358837329),
  ('prim:email:message-reader', 'family', '01KXT166KQE4RJ5JXVJF2939AA', NULL, 'Message Reader', 'Read a single message.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837341, 1784358837341),
  ('prim:email:compose-window', 'family', '01KXT166KQE4RJ5JXVJF2939AA', NULL, 'Compose Window', 'Rich compose surface.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837349, 1784358837349),
  ('prim:email:to-cc-bcc', 'family', '01KXT166KQE4RJ5JXVJF2939AA', NULL, 'To / Cc / Bcc', 'Recipient fields.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837382, 1784358837382),
  ('prim:email:send', 'family', '01KXT166KQE4RJ5JXVJF2939AA', NULL, 'Send', 'Send email.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837410, 1784358837410),
  ('prim:email:archive', 'family', '01KXT166KQE4RJ5JXVJF2939AA', NULL, 'Archive', 'Archive a message.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837421, 1784358837421),
  ('prim:email:label', 'family', '01KXT166KQE4RJ5JXVJF2939AA', NULL, 'Label', 'Tag a message.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837428, 1784358837428),
  ('prim:email:signature', 'family', '01KXT166KQE4RJ5JXVJF2939AA', NULL, 'Signature', 'Auto signature.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837441, 1784358837441),
  ('prim:email:draft-autosave', 'family', '01KXT166KQE4RJ5JXVJF2939AA', NULL, 'Draft Autosave', 'Persist drafts.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837455, 1784358837455),
  ('prim:messenger:conversation-list', 'family', '01KXT166M1YJ0SWMZJNVW6XWMC', NULL, 'Conversation List', 'List of chats.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837480, 1784358837480),
  ('prim:messenger:chat-header', 'family', '01KXT166M1YJ0SWMZJNVW6XWMC', NULL, 'Chat Header', 'Contact name/status.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837507, 1784358837507),
  ('prim:messenger:message-bubble', 'family', '01KXT166M1YJ0SWMZJNVW6XWMC', NULL, 'Message Bubble', 'One message bubble.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837515, 1784358837515),
  ('prim:messenger:typing-indicator', 'family', '01KXT166M1YJ0SWMZJNVW6XWMC', NULL, 'Typing Indicator', 'Peer is typing.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837529, 1784358837529),
  ('prim:messenger:emoji-picker', 'family', '01KXT166M1YJ0SWMZJNVW6XWMC', NULL, 'Emoji Picker', 'Insert emoji.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837559, 1784358837559),
  ('prim:messenger:voice-note', 'family', '01KXT166M1YJ0SWMZJNVW6XWMC', NULL, 'Voice Note', 'Send audio.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837568, 1784358837568),
  ('prim:messenger:read-receipt', 'family', '01KXT166M1YJ0SWMZJNVW6XWMC', NULL, 'Read Receipt', 'Seen state.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837580, 1784358837580),
  ('prim:messenger:status-presence', 'family', '01KXT166M1YJ0SWMZJNVW6XWMC', NULL, 'Status / Presence', 'Online/last-seen.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837591, 1784358837591),
  ('prim:social:feed', 'family', '01KXT166MH7DXJNEN80TS7PJB2', NULL, 'Feed', 'Infinite scroll of posts.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837616, 1784358837616),
  ('prim:social:post-card', 'family', '01KXT166MH7DXJNEN80TS7PJB2', NULL, 'Post Card', 'One post in the feed.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837629, 1784358837629),
  ('prim:social:composer', 'family', '01KXT166MH7DXJNEN80TS7PJB2', NULL, 'Composer', 'Top-of-feed or modal composer.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837636, 1784358837636),
  ('prim:social:like-react', 'family', '01KXT166MH7DXJNEN80TS7PJB2', NULL, 'Like / React', 'Reaction control.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837710, 1784358837710),
  ('prim:social:comment', 'family', '01KXT166MH7DXJNEN80TS7PJB2', NULL, 'Comment', 'Comment on a post.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837737, 1784358837737),
  ('prim:social:share', 'family', '01KXT166MH7DXJNEN80TS7PJB2', NULL, 'Share', 'Share a post.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837751, 1784358837751),
  ('prim:social:follow-button', 'family', '01KXT166MH7DXJNEN80TS7PJB2', NULL, 'Follow Button', 'Follow/unfollow.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837759, 1784358837759),
  ('prim:social:stories-tray', 'family', '01KXT166MH7DXJNEN80TS7PJB2', NULL, 'Stories Tray', 'Stories rail.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837785, 1784358837785),
  ('prim:social:profile-header', 'family', '01KXT166MH7DXJNEN80TS7PJB2', NULL, 'Profile Header', 'User profile header.', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837840, 1784358837840),
  ('prim:provider:chatgpt:canvas-viewer', 'provider', NULL, 'chatgpt', 'Canvas Viewer', 'ChatGPT canvas code viewer', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837856, 1784358837856),
  ('prim:provider:claude:artifacts-viewer', 'provider', NULL, 'claude', 'Artifacts Viewer', 'Claude artifacts viewer', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837870, 1784358837870),
  ('prim:provider:gemini:inline-images', 'provider', NULL, 'gemini', 'Inline Images', 'Gemini inline image display', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837877, 1784358837877),
  ('prim:provider:chatgpt:model-picker', 'provider', NULL, 'chatgpt', 'Model Picker', 'Provider-specific model picker', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837890, 1784358837890),
  ('prim:provider:claude:code-block-viewer', 'provider', NULL, 'claude', 'Code Block Viewer', 'Code block with syntax highlighting', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837903, 1784358837903),
  ('prim:provider:gemini:image-generator', 'provider', NULL, 'gemini', 'Image Generator', 'Gemini image generation surface', '{"x":0,"y":0,"w":320,"h":200}', 1, 1784358837911, 1784358837911);

-- procedural_rule: (empty)

-- profile_session: (empty)

-- program_version_metric: (empty)

-- project: (empty)

-- provider_account: 2 rows
INSERT INTO "provider_account" ("id", "provider_id", "email", "plan_tier", "is_default", "is_kind", "login_state", "login_attempts", "last_login_at", "provider_state_json", "debug_port", "profile_dir", "chrome_slave_id", "user_id", "created_at", "updated_at") VALUES
  ('claude_default', 'claude', 'claude_default@local', 'free', 1, 0, 'unknown', 0, NULL, '{}', NULL, NULL, NULL, 'default', 1784367517033, 1784367517033),
  ('gemini_default', 'gemini', 'gemini_default@local', 'free', 1, 0, 'unknown', 0, NULL, '{}', NULL, NULL, NULL, 'default', 1784418305055, 1784418305055);

-- provider_archetype: (empty)

-- provider_capability: 14 rows
INSERT INTO "provider_capability" ("id", "provider_id", "global_capability_id", "recovery_strategies_json", "ui_component_override", "ui_label_override", "ui_icon_override", "ui_position_override", "ui_order_override", "ui_group_override", "ui_priority_override", "interaction_mode_override", "ui_states_override_json", "ui_visibility_rule_override", "existential_rule_override", "ui_input_schema_override", "mutation_effects_override_json", "recovery_behavior_override", "state_persistence_override", "data_flow_override", "min_plan_tier_override", "depends_on_override_json", "confidence", "success_count", "fail_count", "consecutive_failures", "avg_latency_ms", "p95_latency_ms", "last_used_at", "selector_hit_count", "selector_miss_count", "selector_last_miss_at", "selector_last_error", "created_at", "updated_at") VALUES
  ('01KXVSPR06FPCYQMAA9SKTJ7QP', 'chatgpt', 'send_message', '[{"type":"retry_selector"},{"type":"navigate_home"}]', 'text_input', 'Send to ChatGPT', 'arrow-up-circle', 'composer', NULL, NULL, 'primary', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, 0, 0, 0, 0, 0, NULL, 0, 0, NULL, NULL, 1784418099051, 1784418099207),
  ('01KXVSPR1JPXNRPJ4DHZQT0224', 'chatgpt', 'select_model', '[]', 'dropdown_selector', 'Select GPT Model', 'cpu', 'header', NULL, NULL, 'primary', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, 0, 0, 0, 0, 0, NULL, 0, 0, NULL, NULL, 1784418099051, 1784418099265),
  ('01KXVSPR9G8VENPM3V28SRJX84', 'claude', 'send_message', '[{"type":"retry_selector"},{"type":"retry_with_fallback","config":{"fallback_selector":"textarea"}},{"type":"navigate_home"}]', 'text_input', 'Send to Claude', 'arrow-up-circle', 'composer', NULL, NULL, 'primary', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, 0, 0, 0, 0, 0, NULL, 0, 0, NULL, NULL, 1784418099427, 1784418099504),
  ('01KXVSPRAQ56C3MXQRVPP4Y6PY', 'claude', 'select_model', '[]', 'dropdown_selector', 'Select Claude Model', 'cpu', 'header', NULL, NULL, 'primary', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, 0, 0, 0, 0, 0, NULL, 0, 0, NULL, NULL, 1784418099427, 1784418099543),
  ('01KXVSPRAX601V1QW08AQ6NCYH', 'claude', 'toggle_extended_thinking', '[]', 'toggle_switch', 'Extended Thinking', NULL, 'header', NULL, NULL, 'secondary', NULL, NULL, NULL, 'message_has_thinking_block', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, 0, 0, 0, 0, 0, NULL, 0, 0, NULL, NULL, 1784418099427, 1784418099549),
  ('01KXVSPRB5JT9GRMKGXXKEETXJ', 'claude', 'deep_research', '[]', 'action_button', 'Deep Research', 'flask', 'composer', NULL, NULL, 'secondary', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'pro', NULL, 1, 0, 0, 0, 0, 0, NULL, 0, 0, NULL, NULL, 1784418099427, 1784418099557),
  ('01KXVSPRJWVMBN5SDH5J7R67XJ', 'deepseek', 'send_message', '[{"type":"retry_selector"},{"type":"navigate_home"}]', 'text_input', 'Send to DeepSeek', 'arrow-up-circle', 'composer', NULL, NULL, 'primary', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, 0, 0, 0, 0, 0, NULL, 0, 0, NULL, NULL, 1784418099695, 1784418099804),
  ('01KXVSPRWCMAQMDWKN653AM465', 'gemini', 'send_message', '[{"type":"retry_selector"},{"type":"navigate_home"}]', 'text_input', 'Send to Gemini', 'arrow-up-circle', 'composer', NULL, NULL, 'primary', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, 0, 0, 0, 0, 0, NULL, 0, 0, NULL, NULL, 1784418099967, 1784418100108),
  ('01KXVSPRX48XW6K6M8281RRAV1', 'gemini', 'select_model', '[]', 'dropdown_selector', 'Select Gemini Model', 'cpu', 'header', NULL, NULL, 'primary', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, 0, 0, 0, 0, 0, NULL, 0, 0, NULL, NULL, 1784418099967, 1784418100132),
  ('01KXVSPS3REAWM505VX9342FP8', 'qwen', 'send_message', '[{"type":"retry_selector"},{"type":"navigate_home"}]', 'text_input', 'Send to Qwen', 'arrow-up-circle', 'composer', NULL, NULL, 'primary', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, 0, 0, 0, 0, 0, NULL, 0, 0, NULL, NULL, 1784418100291, 1784418100344),
  ('01KXVSPS42AZTQ5J4CQENBB1XX', 'qwen', 'select_model', '[]', 'dropdown_selector', 'Select Qwen Model', 'cpu', 'header', NULL, NULL, 'primary', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, 0, 0, 0, 0, 0, NULL, 0, 0, NULL, NULL, 1784418100291, 1784418100354),
  ('01KXVSPSA35Z2FNHCTRTT67Q42', 'studio-ai', 'send_message', '[{"type":"retry_selector"},{"type":"navigate_home"}]', 'text_input', 'Send to Studio AI', 'arrow-up-circle', 'composer', NULL, NULL, 'primary', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, 0, 0, 0, 0, 0, NULL, 0, 0, NULL, NULL, 1784418100475, 1784418100547),
  ('01KXVSPSBC5ZBA897Q8HVF3W9Y', 'studio-ai', 'select_model', '[]', 'dropdown_selector', 'Select Model', 'cpu', 'header', NULL, NULL, 'primary', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, 0, 0, 0, 0, 0, NULL, 0, 0, NULL, NULL, 1784418100475, 1784418100589),
  ('01KXVSPSVCDK4F4XKNHNENGNZF', 'z-ai', 'send_message', '[{"type":"retry_selector"}]', 'text_input', 'Send to Z AI', 'arrow-up-circle', 'composer', NULL, NULL, 'primary', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, 0, 0, 0, 0, 0, NULL, 0, 0, NULL, NULL, 1784418101002, 1784418101100);

-- provider_config: 18 rows
INSERT INTO "provider_config" ("id", "provider_id", "config_key", "config_value", "config_type", "is_secret", "created_at", "updated_at") VALUES
  ('01KXVSPR2D0CZGNNXTA36HG1QY', 'chatgpt', 'base_url', 'https://chatgpt.com', 'string', 0, 1784418099051, 1784418099277),
  ('01KXVSPR2GB0MTDTNJ0W6EX617', 'chatgpt', 'auth_type', 'email', 'string', 0, 1784418099051, 1784418099280),
  ('01KXVSPRCQJBGR2DYAY87BVTSR', 'claude', 'base_url', 'https://claude.ai', 'string', 0, 1784418099427, 1784418099608),
  ('01KXVSPREMGB4W25GK2KPHBV9F', 'claude', 'auth_type', 'email', 'string', 0, 1784418099427, 1784418099669),
  ('01KXVSPRK2A76YJCYEJDSK312C', 'deepseek', 'base_url', 'https://chat.deepseek.com', 'string', 0, 1784418099695, 1784418099810),
  ('01KXVSPRMPCX2YE112C0HT12AF', 'deepseek', 'auth_type', 'email', 'string', 0, 1784418099695, 1784418099862),
  ('01KXVSPRQVJJPYYTTMCC4D1E4P', 'facebook', 'poll_strategy', 'cdp-scrape', 'string', 0, 1784418099897, 1784418099963),
  ('01KXVSPRX97DV4AS2XB89JW2PW', 'gemini', 'base_url', 'https://gemini.google.com', 'string', 0, 1784418099967, 1784418100137),
  ('01KXVSPRXGMFFHM4B2M7B0856J', 'gemini', 'auth_type', 'google', 'string', 0, 1784418099967, 1784418100144),
  ('01KXVSPS4SNMCZEXXJX62BPST5', 'qwen', 'base_url', 'https://tongyi.aliyun.com', 'string', 0, 1784418100291, 1784418100377),
  ('01KXVSPS5FZFZ2S4XN3WN6PXSR', 'qwen', 'auth_type', 'email', 'string', 0, 1784418100291, 1784418100399),
  ('01KXVSPS7HC02RAQHP5AHX92PV', 'slack', 'poll_strategy', 'webhook', 'string', 0, 1784418100435, 1784418100470),
  ('01KXVSPSD888J73EZDGYYKVZEC', 'studio-ai', 'base_url', 'https://aistudio.google.com', 'string', 0, 1784418100475, 1784418100667),
  ('01KXVSPSEZ055E14QR43VDQCJX', 'studio-ai', 'auth_type', 'google', 'string', 0, 1784418100475, 1784418100703),
  ('01KXVSPSM7GBKYF62HE21QX7GD', 'telegram', 'poll_strategy', 'polling', 'string', 0, 1784418100823, 1784418100871),
  ('01KXVSPSR686MZDCQF1NPRKHSR', 'whatsapp', 'poll_strategy', 'cdp-scrape', 'string', 0, 1784418100881, 1784418100998),
  ('01KXVSPSW631RBMN002NFG45C2', 'z-ai', 'base_url', 'https://api.z.ai/v1', 'string', 0, 1784418101002, 1784418101126),
  ('01KXVSPSW8T6YQMCKEWG95NT1J', 'z-ai', 'auth_type', 'api_key', 'string', 0, 1784418101002, 1784418101128);

-- provider_cost_log: (empty)

-- provider_definition: 13 rows
INSERT INTO "provider_definition" ("id", "slug", "display_name", "description", "category", "provider_type", "is_active", "protocol_status", "website_url", "documentation_url", "auth_type", "has_multi_account", "profile_strategy", "fleet_config_json", "capabilities_json", "models_json", "plugin_id", "created_at", "updated_at") VALUES
  ('chatgpt', 'chatgpt', 'ChatGPT', 'OpenAI''s ChatGPT assistant', 'ai', 'llm', 1, 'Active', 'https://chatgpt.com', 'https://platform.openai.com/docs', 'browser', 1, 'per_account', '{"port_range":[9252,9280],"extra_args":["--no-first-run"]}', '["select_model","send_message","edit_message","regenerate_response","upload_file","create_new_chat","navigate_chat","delete_chat","rename_chat","browse_with_bing"]', '[]', NULL, 1784351220963, 1784418099069),
  ('claude', 'claude', 'Claude', 'Anthropic''s Claude AI assistant', 'ai', 'llm', 1, 'Active', 'https://claude.ai', 'https://docs.anthropic.com', 'browser', 1, 'per_account', '{"port_range":[9222,9250],"extra_args":["--disable-features=Translate","--no-first-run"]}', '["select_model","send_message","edit_message","regenerate_response","toggle_extended_thinking","upload_file","create_new_chat","navigate_chat","delete_chat","rename_chat","deep_research"]', '[]', NULL, 1784351221956, 1784418099465),
  ('deepseek', 'deepseek', 'DeepSeek', 'DeepSeek AI assistant with strong coding and reasoning capabilities', 'ai', 'llm', 1, 'Active', 'https://chat.deepseek.com', 'https://platform.deepseek.com/api-docs', 'browser', 0, 'per_account', '{"port_range":[9312,9340]}', '["send_message","edit_message","regenerate_response","create_new_chat","navigate_chat","delete_chat","rename_chat"]', '[]', NULL, 1784351222776, 1784418099717),
  ('facebook', 'facebook', 'Facebook Messenger', 'Facebook Messenger channel', 'messaging', 'messaging', 1, 'Active', 'https://www.facebook.com/messages', NULL, 'browser', 0, 'single', '{"port_range":[9360,9380],"extra_args":["--no-first-run"]}', '["channel_add","channel_connect","message_send","message_receive"]', '[]', NULL, 1784351224195, 1784418099900),
  ('gemini', 'gemini', 'Gemini', 'Google''s Gemini AI assistant', 'ai', 'llm', 1, 'Active', 'https://gemini.google.com', 'https://ai.google.dev/docs', 'browser', 1, 'per_account', '{"port_range":[9282,9310],"extra_args":["--no-first-run"]}', '["select_model","send_message","edit_message","regenerate_response","upload_file","create_new_chat","navigate_chat","delete_chat","rename_chat"]', '[]', NULL, 1784351224599, 1784418099969),
  ('qwen', 'qwen', 'Qwen', 'Alibaba''s Qwen AI assistant', 'ai', 'llm', 1, 'Active', 'https://tongyi.aliyun.com', 'https://help.aliyun.com/zh/model-studio/', 'browser', 0, 'per_account', '{"port_range":[9372,9400]}', '["send_message","select_model","create_new_chat","navigate_chat"]', '[]', NULL, 1784351225319, 1784418100294),
  ('slack', 'slack', 'Slack', 'Slack messaging channel', 'messaging', 'messaging', 1, 'Active', 'https://api.slack.com', NULL, 'oauth', 0, 'single', '{"port_range":[9400,9420],"extra_args":[]}', '["channel_add","channel_connect","message_send","message_receive"]', '[]', NULL, 1784351226364, 1784418100437),
  ('studio-ai', 'studio-ai', 'Studio AI', 'Google AI Studio — Gemini API playground and prototyping environment', 'ai', 'llm', 1, 'Active', 'https://aistudio.google.com', 'https://ai.google.dev/docs', 'browser', 0, 'per_account', '{"port_range":[9342,9370]}', '["send_message","select_model","create_new_chat","navigate_chat"]', '[]', NULL, 1784351226508, 1784418100477),
  ('system', 'system', 'System', 'System-level fallback parsers — universal fallback chain', 'system', 'system', 1, 'Active', 'https://vivim.app', NULL, 'none', 0, 'shared', '{}', '[]', '[]', NULL, 1784351226952, 1784418100787),
  ('telegram', 'telegram', 'Telegram', 'Telegram messaging channel', 'messaging', 'messaging', 1, 'Active', 'https://core.telegram.org', NULL, 'api_key', 0, 'single', '{"port_range":[9380,9400],"extra_args":[]}', '["channel_add","channel_connect","message_send","message_receive"]', '[]', NULL, 1784351227185, 1784418100855),
  ('whatsapp', 'whatsapp', 'WhatsApp', 'WhatsApp Web messaging channel', 'messaging', 'messaging', 1, 'Active', 'https://web.whatsapp.com', NULL, 'browser', 0, 'single', '{"port_range":[9340,9360],"extra_args":["--no-first-run"]}', '["channel_add","channel_connect","message_send","message_receive"]', '[]', NULL, 1784351227701, 1784418100901),
  ('z-ai', 'z-ai', 'Z AI', 'Z.AI — Z.ai''s multimodal AI assistant', 'ai', 'llm', 1, 'Active', 'https://z.ai', NULL, 'api', 0, 'shared', '{}', '["send_message","select_model"]', '[]', NULL, 1784351228085, 1784418101004),
  ('generic', 'generic', 'Generic', 'Format-agnostic fallback provider for the parser chain', 'system', 'system', 1, 'Active', 'https://cap-store.local', NULL, 'none', 0, 'none', '{}', '[]', '[]', NULL, 1784358933899, 1784418100259);

-- provider_endpoint: 21 rows
INSERT INTO "provider_endpoint" ("id", "provider_id", "url", "label", "endpoint_type", "is_default", "selectors_json", "composer_type", "send_method", "content_editable", "created_at", "updated_at") VALUES
  ('01KXVSPQY99NS6ZKHM3TSY1B79', 'chatgpt', 'https://chatgpt.com', 'Landing', 'landing', 1, '{}', 'textarea', 'both', 0, 1784418099051, 1784418099146),
  ('01KXVSPQYF5BP2BJHQT3GZQ93A', 'chatgpt', 'https://chatgpt.com', 'Chat', 'chat', 0, '{"composer":"#prompt-textarea","send_button":"[data-testid=''send-button'']"}', 'textarea', 'both', 0, 1784418099051, 1784418099151),
  ('01KXVSPQYKDE9MTBGQ092E8RPN', 'chatgpt', 'https://chatgpt.com/auth/login', 'Login', 'login', 0, '{"email_input":"input[name=''email'']","continue_button":"button[type=''submit'']"}', 'textarea', 'both', 0, 1784418099051, 1784418099155),
  ('01KXVSPR92R4FQQQT38W2XC5SY', 'claude', 'https://claude.ai', 'Landing', 'landing', 1, '{}', 'textarea', 'both', 0, 1784418099427, 1784418099490),
  ('01KXVSPR953MPKYFCQAS9A46ST', 'claude', 'https://claude.ai/chat', 'Chat', 'chat', 0, '{"composer":"[contenteditable]","send_button":"[aria-label=''Send Message'']"}', 'prosemirror', 'both', 1, 1784418099427, 1784418099493),
  ('01KXVSPR980VF0XYTAE0YJZ4JR', 'claude', 'https://claude.ai/login', 'Login', 'login', 0, '{"email_input":"input[type=''email'']","continue_button":"button[type=''submit'']"}', 'textarea', 'both', 0, 1784418099427, 1784418099496),
  ('01KXVSPRHDX83N25RXVNDWJNKK', 'deepseek', 'https://chat.deepseek.com', 'Landing', 'landing', 1, '{}', 'textarea', 'both', 0, 1784418099695, 1784418099776),
  ('01KXVSPRJKEZ42BPDBQYM9Z175', 'deepseek', 'https://chat.deepseek.com', 'Chat', 'chat', 0, '{"composer":"textarea","send_button":"button[aria-label=''Send'']"}', 'textarea', 'both', 0, 1784418099695, 1784418099796),
  ('01KXVSPRJQNVSM92B23TXS9QZT', 'deepseek', 'https://chat.deepseek.com/sign_in', 'Login', 'login', 0, '{"email_input":"input[type=''email'']","continue_button":"button[type=''submit'']"}', 'textarea', 'both', 0, 1784418099695, 1784418099799),
  ('01KXVSPRQN20KPJDHY334BAMCW', 'facebook', 'https://www.facebook.com/messages', 'Web', 'landing', 1, '{}', 'textarea', 'both', 0, 1784418099897, 1784418099957),
  ('01KXVSPRTMGMRCXY8XHM26ECWR', 'gemini', 'https://gemini.google.com', 'Landing', 'landing', 1, '{}', 'textarea', 'both', 0, 1784418099967, 1784418100056),
  ('01KXVSPRTV7YP77K0H9Y7REKMC', 'gemini', 'https://gemini.google.com/app', 'Chat', 'chat', 0, '{"composer":".ql-editor","send_button":"button[aria-label=''Send message'']"}', 'quill', 'both', 1, 1784418099967, 1784418100059),
  ('01KXVSPRTYS0D01E4GVFDPH1T1', 'gemini', 'https://accounts.google.com', 'Login', 'login', 0, '{}', 'textarea', 'both', 0, 1784418099967, 1784418100062),
  ('01KXVSPS2Y6NPH9F8V59NBY04E', 'qwen', 'https://tongyi.aliyun.com', 'Landing', 'landing', 1, '{}', 'textarea', 'both', 0, 1784418100291, 1784418100318),
  ('01KXVSPS3J23CKDCE773W3YRA6', 'qwen', 'https://tongyi.aliyun.com/qianwen', 'Chat', 'chat', 0, '{"composer":"textarea","send_button":"button[aria-label=''Send'']"}', 'textarea', 'both', 0, 1784418100291, 1784418100338),
  ('01KXVSPS6SVK158YJM2WY2T33E', 'slack', 'https://slack.com/api', 'API', 'landing', 1, '{}', 'textarea', 'both', 0, 1784418100435, 1784418100442),
  ('01KXVSPS82Z26NVRQZ2S17DJDR', 'studio-ai', 'https://aistudio.google.com', 'Landing', 'landing', 1, '{}', 'textarea', 'both', 0, 1784418100475, 1784418100487),
  ('01KXVSPS8BGFYMYJHNJSSRQA20', 'studio-ai', 'https://aistudio.google.com/prompts/new_chat', 'Chat', 'chat', 0, '{"composer":"rich-textarea","send_button":"button[aria-label=''Send message'']"}', 'textarea', 'both', 0, 1784418100475, 1784418100491),
  ('01KXVSPSM108WAKGBKFP506FGA', 'telegram', 'https://api.telegram.org', 'Bot API', 'landing', 1, '{}', 'textarea', 'both', 0, 1784418100823, 1784418100865),
  ('01KXVSPSNA4NPSSVDVPZKH6409', 'whatsapp', 'https://web.whatsapp.com', 'Web', 'landing', 1, '{}', 'textarea', 'both', 0, 1784418100881, 1784418100906),
  ('01KXVSPSRGGJ2KC6DMK0S3SEJN', 'z-ai', 'https://api.z.ai/v1', 'API', 'api', 1, '{}', 'textarea', 'both', 0, 1784418101002, 1784418101008);

-- provider_health: (empty)

-- provider_health_history: (empty)

-- provider_latency_log: (empty)

-- provider_manifest_version: (empty)

-- provider_model: 18 rows
INSERT INTO "provider_model" ("id", "provider_id", "model_slug", "display_name", "is_active", "is_default", "capabilities_json", "context_window", "max_output_tokens", "supports_streaming", "supports_vision", "supports_thinking", "supports_tools", "pricing_input_per_1m", "pricing_output_per_1m", "created_at", "updated_at") VALUES
  ('01KXVSPR2TZ32WPJFACDNGNNY1', 'chatgpt', 'gpt-4o', 'GPT-4o', 1, 1, '[]', 128000, 16384, 1, 1, 0, 1, NULL, NULL, 1784418099051, 1784418099291),
  ('01KXVSPR4Y2AWD6QKWN90WVVCC', 'chatgpt', 'gpt-4o-mini', 'GPT-4o Mini', 1, 0, '[]', 128000, 16384, 1, 1, 0, 1, NULL, NULL, 1784418099051, 1784418099358),
  ('01KXVSPR57WB0ZJ8GK3QJ69B1K', 'chatgpt', 'o3', 'o3', 1, 0, '[]', 200000, 100000, 1, 1, 1, 1, NULL, NULL, 1784418099051, 1784418099367),
  ('01KXVSPR5B2M23779KS8GMHKM3', 'chatgpt', 'o4-mini', 'o4-mini', 1, 0, '[]', 200000, 100000, 1, 1, 1, 1, NULL, NULL, 1784418099051, 1784418099371),
  ('01KXVSPREZTVTYEGB91392N897', 'claude', 'claude-sonnet-4-20250514', 'Sonnet 4', 1, 1, '[]', 200000, 64000, 1, 1, 1, 1, NULL, NULL, 1784418099427, 1784418099679),
  ('01KXVSPRF3N4GH3HYNQV6PKFPN', 'claude', 'claude-opus-4-20250514', 'Opus 4', 1, 0, '[]', 200000, 64000, 1, 1, 1, 1, NULL, NULL, 1784418099427, 1784418099683),
  ('01KXVSPRFAWYSTH7DVKH1HDXRR', 'claude', 'claude-haiku-4-20250514', 'Haiku 4', 1, 0, '[]', 200000, 64000, 1, 1, 0, 1, NULL, NULL, 1784418099427, 1784418099691),
  ('01KXVSPRNJZT5MFS31KN54E6GN', 'deepseek', 'deepseek-chat', 'DeepSeek Chat (V3)', 1, 1, '[]', 65536, 8192, 1, 0, 0, 1, NULL, NULL, 1784418099695, 1784418099891),
  ('01KXVSPRNP6MP515ESTDF3ZFRD', 'deepseek', 'deepseek-reasoner', 'DeepSeek Reasoner (R1)', 1, 0, '[]', 65536, 8192, 1, 0, 1, 0, NULL, NULL, 1784418099695, 1784418099894),
  ('01KXVSPS04FP1EJN16DKN33MHC', 'gemini', 'gemini-2.5-pro', 'Gemini 2.5 Pro', 1, 1, '[]', 1048576, 65536, 1, 1, 1, 1, NULL, NULL, 1784418099967, 1784418100228),
  ('01KXVSPS07C0AJ3HK9AVEPX97N', 'gemini', 'gemini-2.5-flash', 'Gemini 2.5 Flash', 1, 0, '[]', 1048576, 65536, 1, 1, 1, 1, NULL, NULL, 1784418099967, 1784418100231),
  ('01KXVSPS0A8SGAG2D1JS2EDG81', 'gemini', 'gemini-2.0-flash', 'Gemini 2.0 Flash', 1, 0, '[]', 1048576, 8192, 1, 1, 0, 1, NULL, NULL, 1784418099967, 1784418100234),
  ('01KXVSPS5J7RFYPC5K80BANSB6', 'qwen', 'qwen-max', 'Qwen Max', 1, 1, '[]', 32768, 8192, 1, 0, 0, 1, NULL, NULL, 1784418100291, 1784418100403),
  ('01KXVSPS5NEBW91MPBCSAYWZQV', 'qwen', 'qwen-plus', 'Qwen Plus', 1, 0, '[]', 131072, 8192, 1, 0, 0, 1, NULL, NULL, 1784418100291, 1784418100405),
  ('01KXVSPS6AD1WWWSHY9TP0VS3C', 'qwen', 'qwen-turbo', 'Qwen Turbo', 1, 0, '[]', 131072, 8192, 1, 0, 0, 0, NULL, NULL, 1784418100291, 1784418100426),
  ('01KXVSPSF369BQ0BVJ223ZJC6Y', 'studio-ai', 'gemini-2.5-pro-preview', 'Gemini 2.5 Pro Preview', 1, 1, '[]', 1048576, 65536, 1, 1, 1, 1, NULL, NULL, 1784418100475, 1784418100707),
  ('01KXVSPSG7305A0Q2JP23YCQ0J', 'studio-ai', 'gemini-2.5-flash-preview', 'Gemini 2.5 Flash Preview', 1, 0, '[]', 1048576, 65536, 1, 1, 0, 1, NULL, NULL, 1784418100475, 1784418100743),
  ('01KXVSPSWCCKSDHR7NJTW8KA9P', 'z-ai', 'z-ai-default', 'Z AI Default', 1, 1, '[]', 128000, 4096, 1, 0, 0, 0, NULL, NULL, 1784418101002, 1784418101132);

-- provider_parser: 6 rows
INSERT INTO "provider_parser" ("id", "provider_id", "parser_name", "parser_version", "parser_logic_type", "parser_file_path", "parser_logic_code", "parser_hash", "is_active", "fallback_parser_id", "created_at", "updated_at") VALUES
  ('parser:claude:001_streaming_sse', 'claude', 'claude/001_streaming_sse', 1, 'inline', NULL, '
function parse(rawBody) {
  const blocks = [];
  const lines = String(rawBody).split(''\n'');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith(''data:'')) continue;
    const payload = trimmed.slice(5).trim();
    if (payload === ''[DONE]'') break;
    try {
      const json = JSON.parse(payload);
      if (json.type === ''content_block_start'' && json.content_block) {
        const cb = json.content_block;
        if (cb.type === ''thinking'') blocks.push({ type: ''reasoning'', text: '''' });
        else if (cb.type === ''tool_use'') blocks.push({ type: ''tool-call'', toolCallId: ''tc_'' + blocks.length, toolName: String(cb.name || ''''), input: cb.input || {} });
        else if (cb.type === ''image'' || cb.type === ''image_url'') blocks.push({ type: ''file'', mediaType: cb.source && cb.source.type === ''image/jpeg'' ? ''image/jpeg'' : ''image/png'', url: String((cb.source && cb.source.url) || cb.url || ''''), filename: String(cb.alt || '''') });
        else if (cb.type === ''text'') blocks.push({ type: ''text'', text: String(cb.text || '''') });
      }
      if (json.type === ''content_block_delta'' && json.delta) {
        const delta = json.delta;
        if (typeof delta.text === ''string'') {
          const last = blocks[blocks.length - 1];
          if (last && last.type === ''text'') last.text += delta.text;
          else blocks.push({ type: ''text'', text: delta.text });
        } else if (typeof delta.thinking === ''string'') {
          const last = blocks[blocks.length - 1];
          if (last && last.type === ''reasoning'') last.text += delta.thinking;
          else blocks.push({ type: ''reasoning'', text: delta.thinking });
        }
      }
      if (json.type === ''message_start'' && json.message) blocks.push({ type: ''meta'', key: ''message_id'', value: json.message.id });
      if (json.type === ''message_stop'' || json.type === ''error'') {
        const last = blocks[blocks.length - 1];
        if (last && last.type !== ''meta'') blocks.push({ type: ''meta'', key: ''stopped'', value: json.type });
      }
    } catch (_e) { /* skip unparseable lines */ }
  }
  if (blocks.length === 0 && rawBody.length > 0) blocks.push({ type: ''text'', text: rawBody });
  return blocks;
}
function detectCompletion(rawBody) {
  return String(rawBody).includes(''message_stop'') || String(rawBody).includes(''[DONE]'');
}
function getConfidence(rawBody) {
  const b = String(rawBody);
  const hasData = b.includes(''data:'');
  const hasContent = b.includes(''content_block_delta'') || b.includes(''content_block_start'');
  if (!hasData) return 0;
  if (!hasContent) return b.includes(''message_stop'') ? 0.7 : 0.3;
  return 1;
}
module.exports.default = { name: ''claude/001_streaming_sse'', version: 1, providerId: ''claude'', parse: parse, detectCompletion: detectCompletion, getConfidence: getConfidence };
', '9d411b264658a07722e44cd81c6a99fd9daea0cb8fbd3be181a1e50c70bc2131', 1, 'parser:generic:001_format_agnostic', 1784418101157, 1784418101255),
  ('parser:chatgpt:001_openai_delta', 'chatgpt', 'chatgpt/001_openai_delta', 1, 'inline', NULL, '
function extractOpenAIBlock(data) {
  const api = data.choices && data.choices[0] && data.choices[0].delta && data.choices[0].delta.content;
  if (api !== undefined && api !== null) return { type: ''text'', text: String(api) };
  if (data.o === ''patch'' && Array.isArray(data.v)) {
    const parts = [];
    for (const patch of data.v) {
      if (patch && typeof patch === ''object'' && typeof patch.p === ''string'' && typeof patch.v === ''string'') {
        if (patch.p.indexOf(''/message/content/parts/'') === 0 && (patch.o === ''append'' || patch.o === ''add'' || patch.o === ''replace'')) parts.push(patch.v);
      }
    }
    if (parts.length > 0) return { type: ''text'', text: parts.join('''') };
  }
  if (data.o === ''add'' && data.v && data.v.message && data.v.message.content && data.v.message.content.parts) {
    return fromParts(data.v.message.content.parts);
  }
  const cp = data.message && data.message.content && data.message.content.parts;
  if (Array.isArray(cp)) return fromParts(cp);
  return null;
}
function fromParts(parts) {
  const blocks = [];
  for (const p of parts) {
    if (typeof p === ''string'') blocks.push({ type: ''text'', text: p });
    else if (p && typeof p === ''object'' && ''asset_pointer'' in p) blocks.push({ type: ''file'', url: String(p.asset_pointer), mediaType: ''image/png'', filename: '''' });
  }
  if (blocks.length === 0) return null;
  return blocks.length === 1 ? blocks[0] : blocks[0];
}
function parse(rawBody) {
  const blocks = [];
  const lines = String(rawBody).split(''\n'');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith(''data:'')) continue;
    const payload = trimmed.slice(5).trim();
    if (payload === ''[DONE]'') break;
    try {
      const data = JSON.parse(payload);
      const block = extractOpenAIBlock(data);
      if (block) {
        if (Array.isArray(block)) blocks.push.apply(blocks, block);
        else blocks.push(block);
      }
    } catch (_e) { /* skip */ }
  }
  if (blocks.length === 0 && rawBody.length > 0) blocks.push({ type: ''text'', text: rawBody });
  return blocks;
}
function detectCompletion(rawBody) {
  return String(rawBody).includes(''[DONE]'') || String(rawBody).includes(''"finish_reason"'');
}
function getConfidence(rawBody) {
  const b = String(rawBody);
  if (!b.includes(''data:'')) return 0;
  if (b.includes(''choices'') && b.includes(''delta'')) return 1;
  if (b.includes(''[DONE]'')) return 0.7;
  return 0.3;
}
module.exports.default = { name: ''chatgpt/001_openai_delta'', version: 1, providerId: ''chatgpt'', parse: parse, detectCompletion: detectCompletion, getConfidence: getConfidence };
', 'e3bc30a621c72a9aa916b583dd3a36b0a7f85ce075a76f1ed7e472c5687b70ff', 1, 'parser:generic:001_format_agnostic', 1784418101157, 1784418101290),
  ('parser:gemini:001_batchexecute', 'gemini', 'gemini/001_batchexecute', 1, 'inline', NULL, '
function safeJsonParse(s) { try { return JSON.parse(s); } catch (_e) { return s; } }
function decodeEnvelope(raw) {
  const frames = [];
  let text = String(raw);
  if (text.indexOf(")]}''\n") === 0) text = text.slice(5);
  const lines = text.split(''\n'');
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (/^\d+$/.test(t)) continue;
    if (t.charAt(0) !== ''['') continue;
    try {
      const arr = JSON.parse(t);
      if (!Array.isArray(arr)) continue;
      let isTerminal = false;
      for (const child of arr) { if (Array.isArray(child) && child[0] === ''e'') { isTerminal = true; break; } }
      for (const child of arr) {
        if (Array.isArray(child) && child[0] === ''wrb.fr'') {
          frames.push({ rpc: String(child[1] || ''''), payload: typeof child[2] === ''string'' ? safeJsonParse(child[2]) : child[2], error: child[5] != null ? child[5] : null, isTerminal: isTerminal });
        }
      }
      if (isTerminal && frames.length === 0) frames.push({ rpc: '''', payload: null, error: null, isTerminal: true });
    } catch (_e) { /* skip */ }
  }
  return frames;
}
function parseStreamChunk(frame) {
  const payload = frame.payload;
  if (!Array.isArray(payload)) return null;
  // Real gemini batchexecute: payload[4] holds [[deltaText]] (or payload[3]).
  const candidate = payload[4] != null ? payload[4] : payload[3];
  const textArr = Array.isArray(candidate) ? candidate[0] : undefined;
  // text lives at textArr[0]; some envelopes double-wrap as textArr[1].
  let deltaArr = Array.isArray(textArr) ? (textArr[1] != null ? textArr[1] : textArr[0]) : undefined;
  if (typeof deltaArr === ''undefined'' && Array.isArray(textArr)) deltaArr = textArr[0];
  let textDelta = '''';
  if (Array.isArray(deltaArr)) textDelta = deltaArr.filter(function (s) { return typeof s === ''string''; }).join('''');
  else if (typeof deltaArr === ''string'') textDelta = deltaArr;
  return textDelta ? { textDelta: textDelta } : null;
}
function parse(rawBody) {
  const blocks = [];
  const frames = decodeEnvelope(rawBody);
  for (const frame of frames) {
    if (frame.isTerminal) continue;
    if (frame.rpc) {
      const delta = parseStreamChunk(frame);
      if (delta && delta.textDelta) blocks.push({ type: ''text'', text: delta.textDelta });
      else blocks.push({ type: ''meta'', key: ''gemini_'' + frame.rpc, value: frame.payload });
    }
  }
  if (blocks.length === 0 && rawBody.length > 0) blocks.push({ type: ''text'', text: rawBody });
  return blocks;
}
function detectCompletion(rawBody) {
  const b = String(rawBody);
  return b.includes(''[["e"'') || b.includes(''"e"'') || b.includes(''"isTerminal":true'');
}
function getConfidence(rawBody) {
  const b = String(rawBody);
  if (b.indexOf('')]}\'''') === 0 || b.includes(''wrb.fr'')) return 1;
  if (b.includes(''[['')) return 0.6;
  return 0.2;
}
module.exports.default = { name: ''gemini/001_batchexecute'', version: 1, providerId: ''gemini'', parse: parse, detectCompletion: detectCompletion, getConfidence: getConfidence };
', '61abc26e092bbdd21e4679bcfcec4e6923ef1d9ca8f82298d479c1bf5cfe6fdc', 1, 'parser:generic:001_format_agnostic', 1784418101157, 1784418101296),
  ('parser:gemini:002_ai_studio', 'gemini', 'gemini/002_ai_studio', 2, 'inline', NULL, '
function parse(rawBody) {
  const blocks = [];
  const lines = String(rawBody).split(''\n'');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith(''data:'')) continue;
    const payload = trimmed.slice(5).trim();
    if (payload === ''[DONE]'') break;
    try {
      const data = JSON.parse(payload);
      const text = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
      if (text !== undefined && text !== null) blocks.push({ type: ''text'', text: String(text) });
    } catch (_e) { /* skip */ }
  }
  if (blocks.length === 0 && rawBody.length > 0) blocks.push({ type: ''text'', text: rawBody });
  return blocks;
}
function detectCompletion(rawBody) {
  return String(rawBody).includes(''[DONE]'') || String(rawBody).includes(''"finishReason"'');
}
function getConfidence(rawBody) {
  const b = String(rawBody);
  if (!b.includes(''data:'')) return 0;
  if (b.includes(''candidates'') && b.includes(''parts'')) return 1;
  if (b.includes(''[DONE]'')) return 0.7;
  return 0.3;
}
module.exports.default = { name: ''gemini/002_ai_studio'', version: 2, providerId: ''gemini'', parse: parse, detectCompletion: detectCompletion, getConfidence: getConfidence };
', '33f7644ff246d8620374c97b1d52add8a55723e3cf6a4ef291a62e88b32d5132', 1, 'parser:generic:001_format_agnostic', 1784418101157, 1784418101298),
  ('parser:generic:001_format_agnostic', 'generic', 'generic/001_format_agnostic', 1, 'inline', NULL, '
function parse(rawBody) {
  const b = String(rawBody);
  const blocks = [];
  // SSE data: frames
  const lines = b.split(''\n'');
  let sawSse = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith(''data:'')) continue;
    sawSse = true;
    const payload = trimmed.slice(5).trim();
    if (payload === ''[DONE]'') continue;
    try {
      const data = JSON.parse(payload);
      const choices = data.choices && data.choices[0];
      const delta = choices && choices.delta && choices.delta.content;
      if (typeof delta === ''string'' && delta) { blocks.push({ type: ''text'', text: delta }); continue; }
      const parts = choices && choices.message && choices.message.content && choices.message.content.parts;
      if (Array.isArray(parts)) { blocks.push({ type: ''text'', text: parts.join('''') }); continue; }
      const studio = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
      if (typeof studio === ''string'' && studio) { blocks.push({ type: ''text'', text: studio }); continue; }
    } catch (_e) { /* not JSON, leave to raw fallback */ }
  }
  // Gemini batchexecute array
  if (!blocks.length && b.indexOf(''[['') === 0) {
    try {
      const arr = JSON.parse(b);
      const walk = function (node) {
        if (typeof node === ''string'') blocks.push({ type: ''text'', text: node });
        else if (Array.isArray(node)) node.forEach(walk);
      };
      walk(arr);
    } catch (_e) { /* leave to raw */ }
  }
  if (!blocks.length) blocks.push({ type: ''text'', text: b });
  return blocks;
}
function detectCompletion(rawBody) {
  const b = String(rawBody);
  return b.includes(''[DONE]'') || b.includes(''message_stop'') || b.indexOf(''[["e"'') === 0;
}
function getConfidence(rawBody) {
  const b = String(rawBody);
  if (b.includes(''choices'') || b.includes(''candidates'') || b.includes(''wrb.fr'')) return 0.4;
  if (b.includes(''data:'') || b.includes(''[['')) return 0.2;
  return 0.1;
}
module.exports.default = { name: ''generic/001_format_agnostic'', version: 1, providerId: ''generic'', parse: parse, detectCompletion: detectCompletion, getConfidence: getConfidence };
', '71497fc3099f4014bd4e21200ddf46f30e92f4594aa9ff109c7c21413545923e', 1, 'parser:system:001_raw_text', 1784418101157, 1784418101300),
  ('parser:system:001_raw_text', 'system', 'system/001_raw_text', 1, 'inline', NULL, '
function parse(rawBody) {
  const b = String(rawBody);
  return b.length > 0 ? [{ type: ''text'', text: b }] : [];
}
function detectCompletion() { return true; }
function getConfidence() { return 0.05; }
module.exports.default = { name: ''system/001_raw_text'', version: 1, providerId: ''system'', parse: parse, detectCompletion: detectCompletion, getConfidence: getConfidence };
', '4403068b29982edbedecd623d76794a334ceacd8d5b7dac27b15929da0f4cab3', 1, NULL, 1784418101157, 1784418101217);

-- provider_session: 2 rows
INSERT INTO "provider_session" ("id", "vivim_session_id", "provider_id", "account_id", "state", "context_json", "created_at", "updated_at") VALUES
  ('01KXT9F3E3PJMPAQH1SRPZD8FD', '01KXT9F3CRER61DG2ZJ0T4Y3VY', 'claude', 'claude_default', 'idle', '{}', 1784367517033, 1784367517033),
  ('01KXVSX13T8KWBRMKY1ZWS06P1', '01KXVSX112JMBFKH92SMV3X18M', 'gemini', 'gemini_default', 'idle', '{}', 1784418305055, 1784418305055);

-- provider_shape_binding: (empty)

-- provider_stream_config: (empty)

-- provider_type: 4 rows
INSERT INTO "provider_type" ("id", "slug", "display_name", "description", "slot_catalog_json", "region_layout_json", "interaction_grammar_json", "base_primitive", "version", "created_at", "updated_at") VALUES
  ('01KXT166HPX6FWQZAJCQ1GPFF0', 'ai-chat', 'AI Chat Webapp', 'Composer + transcript thread + bubbles', '["prompt-box","response-bubble","user-bubble","model-switcher","new-chat","chat-history-sidebar","streaming-indicator","regenerate","copy-message","branch"]', '{}', '{"basePrimitive":"conversations","sendGesture":"enter"}', 'conversations', 1, 1784358836791, 1784358836791),
  ('01KXT166KQE4RJ5JXVJF2939AA', 'email', 'Email', 'Folder list + message list + reader + compose', '["folder-list","message-list","message-reader","compose-window","to-cc-bcc","send","archive","label","signature","draft-autosave"]', '{}', '{"basePrimitive":"mailbox","sendGesture":"enter"}', 'mailbox', 1, 1784358836855, 1784358836855),
  ('01KXT166M1YJ0SWMZJNVW6XWMC', 'messenger', 'Messengers', 'Conversation list + chat + bubbles', '["conversation-list","chat-header","message-bubble","typing-indicator","emoji-picker","voice-note","read-receipt","status-presence"]', '{}', '{"basePrimitive":"conversations","sendGesture":"enter"}', 'conversations', 1, 1784358836866, 1784358836866),
  ('01KXT166MH7DXJNEN80TS7PJB2', 'social', 'Social', 'Feed + post cards + composer + reactions', '["feed","post-card","composer","like-react","comment","share","follow-button","stories-tray","profile-header"]', '{}', '{"basePrimitive":"feed","sendGesture":"enter"}', 'feed', 1, 1784358836881, 1784358836881);

-- reflection_log: (empty)

-- registration_event: (empty)

-- repair_session: (empty)

-- route_event: (empty)

-- route_request: (empty)

-- route_spec: (empty)

-- route_target: (empty)

-- routing_preference: (empty)

-- rule: (empty)

-- sandbox_audit: 36 rows
INSERT INTO "sandbox_audit" ("id", "handler_slug", "ok", "error", "permissions_json", "ts") VALUES
  ('01KXT8AVMD8XE6ESWPTS227HZJ', 'parser:e3bc30a621c72a9aa916b583dd3a36b0a7f85ce075a76f1ed7e472c5687b70ff', 1, NULL, '{"canFetch":[],"canReadFile":[],"canWriteFile":[],"canUseClipboard":false}', 1784366329519),
  ('01KXT8AVRJTVYJDGMZFD64EBPD', 'parser:9d411b264658a07722e44cd81c6a99fd9daea0cb8fbd3be181a1e50c70bc2131', 1, NULL, '{"canFetch":[],"canReadFile":[],"canWriteFile":[],"canUseClipboard":false}', 1784366329627),
  ('01KXT8AVRY43GXK1NSD145W7SF', 'parser:33f7644ff246d8620374c97b1d52add8a55723e3cf6a4ef291a62e88b32d5132', 1, NULL, '{"canFetch":[],"canReadFile":[],"canWriteFile":[],"canUseClipboard":false}', 1784366329631),
  ('01KXT8AVS0ZJ61VSZWW1WJ8CBR', 'parser:b1abb0432ce459e1ecb323ad5c9ce151f99ad64d931be573dcfb66fafc45da44', 1, NULL, '{"canFetch":[],"canReadFile":[],"canWriteFile":[],"canUseClipboard":false}', 1784366329633),
  ('01KXT8AVS6QKQ3WQ30X1WPF2JZ', 'parser:71497fc3099f4014bd4e21200ddf46f30e92f4594aa9ff109c7c21413545923e', 1, NULL, '{"canFetch":[],"canReadFile":[],"canWriteFile":[],"canUseClipboard":false}', 1784366329639),
  ('01KXT8AVS9YYPT57APTDV99B08', 'parser:4403068b29982edbedecd623d76794a334ceacd8d5b7dac27b15929da0f4cab3', 1, NULL, '{"canFetch":[],"canReadFile":[],"canWriteFile":[],"canUseClipboard":false}', 1784366329644),
  ('01KXTH7Y4V789Q8DP8QPQ85EH4', 'parser:e3bc30a621c72a9aa916b583dd3a36b0a7f85ce075a76f1ed7e472c5687b70ff', 1, NULL, '{"canFetch":[],"canReadFile":[],"canWriteFile":[],"canUseClipboard":false}', 1784375670941),
  ('01KXTH7Y51DF1BTQDE8YTKNT2W', 'parser:9d411b264658a07722e44cd81c6a99fd9daea0cb8fbd3be181a1e50c70bc2131', 1, NULL, '{"canFetch":[],"canReadFile":[],"canWriteFile":[],"canUseClipboard":false}', 1784375670946),
  ('01KXTH7Y5KFCAEDPMBSGXPMKBH', 'parser:33f7644ff246d8620374c97b1d52add8a55723e3cf6a4ef291a62e88b32d5132', 1, NULL, '{"canFetch":[],"canReadFile":[],"canWriteFile":[],"canUseClipboard":false}', 1784375670964),
  ('01KXTH7Y5QFH9MH0M9JVH8NZBY', 'parser:b1abb0432ce459e1ecb323ad5c9ce151f99ad64d931be573dcfb66fafc45da44', 1, NULL, '{"canFetch":[],"canReadFile":[],"canWriteFile":[],"canUseClipboard":false}', 1784375670968),
  ('01KXTH7Y5TCH8RG5G0SXA86S1K', 'parser:71497fc3099f4014bd4e21200ddf46f30e92f4594aa9ff109c7c21413545923e', 1, NULL, '{"canFetch":[],"canReadFile":[],"canWriteFile":[],"canUseClipboard":false}', 1784375670971),
  ('01KXTH7Y5YSJDCHDRBHPHHP7FY', 'parser:4403068b29982edbedecd623d76794a334ceacd8d5b7dac27b15929da0f4cab3', 1, NULL, '{"canFetch":[],"canReadFile":[],"canWriteFile":[],"canUseClipboard":false}', 1784375670975),
  ('01KXTHK9KWW21K2NTJ9E5SAHX0', 'parser:e3bc30a621c72a9aa916b583dd3a36b0a7f85ce075a76f1ed7e472c5687b70ff', 1, NULL, '{"canFetch":[],"canReadFile":[],"canWriteFile":[],"canUseClipboard":false}', 1784376043134),
  ('01KXTHK9M367WHBHTZKX4BQ6YD', 'parser:9d411b264658a07722e44cd81c6a99fd9daea0cb8fbd3be181a1e50c70bc2131', 1, NULL, '{"canFetch":[],"canReadFile":[],"canWriteFile":[],"canUseClipboard":false}', 1784376043140),
  ('01KXTHK9M5DNMN9WZKJ9GEJC41', 'parser:33f7644ff246d8620374c97b1d52add8a55723e3cf6a4ef291a62e88b32d5132', 1, NULL, '{"canFetch":[],"canReadFile":[],"canWriteFile":[],"canUseClipboard":false}', 1784376043142),
  ('01KXTHK9M7AZX76CV9GB16JWGW', 'parser:b1abb0432ce459e1ecb323ad5c9ce151f99ad64d931be573dcfb66fafc45da44', 1, NULL, '{"canFetch":[],"canReadFile":[],"canWriteFile":[],"canUseClipboard":false}', 1784376043144),
  ('01KXTHK9M9QM6CPX6WSKZ8BEV6', 'parser:71497fc3099f4014bd4e21200ddf46f30e92f4594aa9ff109c7c21413545923e', 1, NULL, '{"canFetch":[],"canReadFile":[],"canWriteFile":[],"canUseClipboard":false}', 1784376043146),
  ('01KXTHK9MBBEEMRC1CXHJ008WK', 'parser:4403068b29982edbedecd623d76794a334ceacd8d5b7dac27b15929da0f4cab3', 1, NULL, '{"canFetch":[],"canReadFile":[],"canWriteFile":[],"canUseClipboard":false}', 1784376043148),
  ('01KXTHXQBMR23CZYA37Q6M5AXH', 'parser:e3bc30a621c72a9aa916b583dd3a36b0a7f85ce075a76f1ed7e472c5687b70ff', 1, NULL, '{"canFetch":[],"canReadFile":[],"canWriteFile":[],"canUseClipboard":false}', 1784376384886),
  ('01KXTHXQBXTX1RQYJNJTWEVJS9', 'parser:9d411b264658a07722e44cd81c6a99fd9daea0cb8fbd3be181a1e50c70bc2131', 1, NULL, '{"canFetch":[],"canReadFile":[],"canWriteFile":[],"canUseClipboard":false}', 1784376384894),
  ('01KXTHXQC140GNXJE6J58A9Q4K', 'parser:33f7644ff246d8620374c97b1d52add8a55723e3cf6a4ef291a62e88b32d5132', 1, NULL, '{"canFetch":[],"canReadFile":[],"canWriteFile":[],"canUseClipboard":false}', 1784376384898),
  ('01KXTHXQD4W0DH7P8ZNYNTK6RH', 'parser:61abc26e092bbdd21e4679bcfcec4e6923ef1d9ca8f82298d479c1bf5cfe6fdc', 1, NULL, '{"canFetch":[],"canReadFile":[],"canWriteFile":[],"canUseClipboard":false}', 1784376384933),
  ('01KXTHXQDCZ358N6JZCZK4357G', 'parser:71497fc3099f4014bd4e21200ddf46f30e92f4594aa9ff109c7c21413545923e', 1, NULL, '{"canFetch":[],"canReadFile":[],"canWriteFile":[],"canUseClipboard":false}', 1784376384942),
  ('01KXTHXQDH6K1879HQC949SN5E', 'parser:4403068b29982edbedecd623d76794a334ceacd8d5b7dac27b15929da0f4cab3', 1, NULL, '{"canFetch":[],"canReadFile":[],"canWriteFile":[],"canUseClipboard":false}', 1784376384946),
  ('01KXVJTWHEG4TY949Z7A0MTQJ7', 'parser:e3bc30a621c72a9aa916b583dd3a36b0a7f85ce075a76f1ed7e472c5687b70ff', 1, NULL, '{"canFetch":[],"canReadFile":[],"canWriteFile":[],"canUseClipboard":false}', 1784410894898),
  ('01KXVJTWJ9S3SNYS45AR1X33X7', 'parser:9d411b264658a07722e44cd81c6a99fd9daea0cb8fbd3be181a1e50c70bc2131', 1, NULL, '{"canFetch":[],"canReadFile":[],"canWriteFile":[],"canUseClipboard":false}', 1784410894937),
  ('01KXVJTWJZ1JW9KCFBKTJ6QS2K', 'parser:33f7644ff246d8620374c97b1d52add8a55723e3cf6a4ef291a62e88b32d5132', 1, NULL, '{"canFetch":[],"canReadFile":[],"canWriteFile":[],"canUseClipboard":false}', 1784410894945),
  ('01KXVJTWK47N6Q0WK8774N080R', 'parser:61abc26e092bbdd21e4679bcfcec4e6923ef1d9ca8f82298d479c1bf5cfe6fdc', 1, NULL, '{"canFetch":[],"canReadFile":[],"canWriteFile":[],"canUseClipboard":false}', 1784410894950),
  ('01KXVJTWKSB0YVSFWMD53H31P6', 'parser:71497fc3099f4014bd4e21200ddf46f30e92f4594aa9ff109c7c21413545923e', 1, NULL, '{"canFetch":[],"canReadFile":[],"canWriteFile":[],"canUseClipboard":false}', 1784410894985),
  ('01KXVJTWMFRE7Y1VFFS68ZVJSJ', 'parser:4403068b29982edbedecd623d76794a334ceacd8d5b7dac27b15929da0f4cab3', 1, NULL, '{"canFetch":[],"canReadFile":[],"canWriteFile":[],"canUseClipboard":false}', 1784410894992),
  ('01KXVSPT6Q1AV9T6M22EC90C0D', 'parser:e3bc30a621c72a9aa916b583dd3a36b0a7f85ce075a76f1ed7e472c5687b70ff', 1, NULL, '{"canFetch":[],"canReadFile":[],"canWriteFile":[],"canUseClipboard":false}', 1784418101466),
  ('01KXVSPT6XKBV0BD4RPHN3TAJP', 'parser:9d411b264658a07722e44cd81c6a99fd9daea0cb8fbd3be181a1e50c70bc2131', 1, NULL, '{"canFetch":[],"canReadFile":[],"canWriteFile":[],"canUseClipboard":false}', 1784418101470),
  ('01KXVSPT75A9Y80KCPP8JK3HG9', 'parser:33f7644ff246d8620374c97b1d52add8a55723e3cf6a4ef291a62e88b32d5132', 1, NULL, '{"canFetch":[],"canReadFile":[],"canWriteFile":[],"canUseClipboard":false}', 1784418101493),
  ('01KXVSPT7V0T91ET01CHCEVWJX', 'parser:61abc26e092bbdd21e4679bcfcec4e6923ef1d9ca8f82298d479c1bf5cfe6fdc', 1, NULL, '{"canFetch":[],"canReadFile":[],"canWriteFile":[],"canUseClipboard":false}', 1784418101500),
  ('01KXVSPT7YB5AD881605JAXVNW', 'parser:71497fc3099f4014bd4e21200ddf46f30e92f4594aa9ff109c7c21413545923e', 1, NULL, '{"canFetch":[],"canReadFile":[],"canWriteFile":[],"canUseClipboard":false}', 1784418101503),
  ('01KXVSPT81VP9812DTC8PCWGB6', 'parser:4403068b29982edbedecd623d76794a334ceacd8d5b7dac27b15929da0f4cab3', 1, NULL, '{"canFetch":[],"canReadFile":[],"canWriteFile":[],"canUseClipboard":false}', 1784418101507);

-- selector_health_history: (empty)

-- selector_strategy: (empty)

-- semantic_memory: (empty)

-- session_checkpoint: (empty)

-- situation_detection: (empty)

-- situation_log: (empty)

-- state_transition: (empty)

-- stealth_launch_profile: (empty)

-- stealth_module_profile: (empty)

-- stealth_policy: (empty)

-- stream_block: (empty)

-- sync_log: (empty)

-- sync_peer: (empty)

-- telemetry_cycle_log: (empty)

-- telemetry_summary_daily: (empty)

-- test_run: (empty)

-- token_budget: (empty)

-- topic: (empty)

-- trace_entry: (empty)

-- transfer_attempt: (empty)

-- transfer_candidate: (empty)

-- transfer_pattern: (empty)

-- ui_component: 22 rows
INSERT INTO "ui_component" ("id", "primitive_id", "scope", "owner_id", "variant", "component_key", "display_name", "html", "css", "script_url", "sandbox_json", "constraints_json", "contract_json", "archetype", "version", "status", "author", "default_region_json", "tags_json", "created_at", "updated_at") VALUES
  ('uc:cross-type:global:prim:cross:message-bubble', 'prim:cross:message-bubble', 'cross-type', 'global', NULL, 'message-bubble.base', 'Base Message Bubble', '<div class="bubble">{{content}}</div>', '', NULL, '{}', '{}', '{}', NULL, 1, 'published', 'system', '', '[]', 1784358837935, 1784358837935),
  ('uc:cross-type:global:prim:cross:composer', 'prim:cross:composer', 'cross-type', 'global', NULL, 'composer.base', 'Base Composer', '<textarea class="composer"></textarea>', '', NULL, '{}', '{}', '{}', NULL, 1, 'published', 'system', '', '[]', 1784358837968, 1784358837968),
  ('uc:family:01KXT166HPX6FWQZAJCQ1GPFF0:prim:cross:composer', 'prim:cross:composer', 'family', '01KXT166HPX6FWQZAJCQ1GPFF0', NULL, 'composer.ai-chat', 'AI-Chat Composer', '<textarea class="composer ai-chat" placeholder="Send a message…"></textarea>', '', NULL, '{}', '{}', '{}', NULL, 1, 'published', 'system', '', '[]', 1784358837989, 1784358837989),
  ('uc:family:01KXT166HPX6FWQZAJCQ1GPFF0:prim:cross:composer:gemini', 'prim:cross:composer', 'family', '01KXT166HPX6FWQZAJCQ1GPFF0', 'gemini', 'composer.ai-chat.gemini', 'Gemini Composer (contenteditable)', '<div class="composer gemini" contenteditable="true"></div>', '', NULL, '{}', '{}', '{}', NULL, 1, 'published', 'system', '', '[]', 1784358838042, 1784358838042),
  ('uc:family:01KXT166HPX6FWQZAJCQ1GPFF0:prim:ai-chat:prompt-box', 'prim:ai-chat:prompt-box', 'family', '01KXT166HPX6FWQZAJCQ1GPFF0', NULL, 'prompt-box.ai-chat', 'AI-Chat Prompt Box', '<div class="prompt-box" contenteditable="true"></div>', '', NULL, '{}', '{}', '{}', NULL, 1, 'published', 'system', '', '[]', 1784358838056, 1784358838056),
  ('uc:family:01KXT166HPX6FWQZAJCQ1GPFF0:prim:ai-chat:response-bubble', 'prim:ai-chat:response-bubble', 'family', '01KXT166HPX6FWQZAJCQ1GPFF0', NULL, 'response-bubble.ai-chat', 'AI Response Bubble', '<div class="bubble assistant">{{content}}</div>', '', NULL, '{}', '{}', '{}', NULL, 1, 'published', 'system', '', '[]', 1784358838072, 1784358838072),
  ('uc:family:01KXT166HPX6FWQZAJCQ1GPFF0:prim:ai-chat:chat-history-sidebar', 'prim:ai-chat:chat-history-sidebar', 'family', '01KXT166HPX6FWQZAJCQ1GPFF0', NULL, 'chat-history-sidebar.ai-chat', 'AI-Chat History Sidebar', '<div class="sidebar history">{{conversations}}</div>', '', NULL, '{}', '{}', '{}', NULL, 1, 'published', 'system', '', '[]', 1784358838092, 1784358838092),
  ('uc:family:01KXT166KQE4RJ5JXVJF2939AA:prim:cross:composer', 'prim:cross:composer', 'family', '01KXT166KQE4RJ5JXVJF2939AA', NULL, 'composer.email', 'Email Compose', '<div class="email-compose"><input class="to" placeholder="To" /><textarea class="body"></textarea></div>', '', NULL, '{}', '{}', '{}', NULL, 1, 'published', 'system', '', '[]', 1784358838111, 1784358838111),
  ('uc:family:01KXT166KQE4RJ5JXVJF2939AA:prim:email:message-reader', 'prim:email:message-reader', 'family', '01KXT166KQE4RJ5JXVJF2939AA', NULL, 'message-reader.email', 'Email Message Reader', '<div class="email-reader">{{body}}</div>', '', NULL, '{}', '{}', '{}', NULL, 1, 'published', 'system', '', '[]', 1784358838125, 1784358838125),
  ('uc:family:01KXT166KQE4RJ5JXVJF2939AA:prim:email:message-list', 'prim:email:message-list', 'family', '01KXT166KQE4RJ5JXVJF2939AA', NULL, 'message-list.email', 'Email Message List', '<ul class="email-list">{{messages}}</ul>', '', NULL, '{}', '{}', '{}', NULL, 1, 'published', 'system', '', '[]', 1784358838143, 1784358838143),
  ('uc:family:01KXT166KQE4RJ5JXVJF2939AA:prim:email:folder-list', 'prim:email:folder-list', 'family', '01KXT166KQE4RJ5JXVJF2939AA', NULL, 'folder-list.email', 'Email Folder List', '<nav class="email-folders">{{folders}}</nav>', '', NULL, '{}', '{}', '{}', NULL, 1, 'published', 'system', '', '[]', 1784358838189, 1784358838189),
  ('uc:family:01KXT166M1YJ0SWMZJNVW6XWMC:prim:cross:composer', 'prim:cross:composer', 'family', '01KXT166M1YJ0SWMZJNVW6XWMC', NULL, 'composer.messenger', 'Messenger Composer', '<textarea class="messenger-composer" placeholder="Message…"></textarea>', '', NULL, '{}', '{}', '{}', NULL, 1, 'published', 'system', '', '[]', 1784358838210, 1784358838210),
  ('uc:family:01KXT166M1YJ0SWMZJNVW6XWMC:prim:messenger:conversation-list', 'prim:messenger:conversation-list', 'family', '01KXT166M1YJ0SWMZJNVW6XWMC', NULL, 'conversation-list.messenger', 'Messenger Conversation List', '<ul class="conversation-list">{{chats}}</ul>', '', NULL, '{}', '{}', '{}', NULL, 1, 'published', 'system', '', '[]', 1784358838226, 1784358838226),
  ('uc:family:01KXT166M1YJ0SWMZJNVW6XWMC:prim:messenger:message-bubble', 'prim:messenger:message-bubble', 'family', '01KXT166M1YJ0SWMZJNVW6XWMC', NULL, 'message-bubble.messenger', 'Messenger Message Bubble', '<div class="messenger-bubble">{{content}}</div>', '', NULL, '{}', '{}', '{}', NULL, 1, 'published', 'system', '', '[]', 1784358838241, 1784358838241),
  ('uc:family:01KXT166M1YJ0SWMZJNVW6XWMC:prim:messenger:typing-indicator', 'prim:messenger:typing-indicator', 'family', '01KXT166M1YJ0SWMZJNVW6XWMC', NULL, 'typing-indicator.messenger', 'Messenger Typing Indicator', '<div class="typing-indicator"><span></span><span></span><span></span></div>', '', NULL, '{}', '{}', '{}', NULL, 1, 'published', 'system', '', '[]', 1784358838274, 1784358838274),
  ('uc:family:01KXT166MH7DXJNEN80TS7PJB2:prim:social:composer', 'prim:social:composer', 'family', '01KXT166MH7DXJNEN80TS7PJB2', NULL, 'composer.social', 'Social Composer', '<div class="social-composer" contenteditable="true" placeholder="What’s happening?"></div>', '', NULL, '{}', '{}', '{}', NULL, 1, 'published', 'system', '', '[]', 1784358838290, 1784358838290),
  ('uc:family:01KXT166MH7DXJNEN80TS7PJB2:prim:social:feed', 'prim:social:feed', 'family', '01KXT166MH7DXJNEN80TS7PJB2', NULL, 'feed.social', 'Social Feed', '<div class="social-feed">{{posts}}</div>', '', NULL, '{}', '{}', '{}', NULL, 1, 'published', 'system', '', '[]', 1784358838321, 1784358838321),
  ('uc:family:01KXT166MH7DXJNEN80TS7PJB2:prim:social:post-card', 'prim:social:post-card', 'family', '01KXT166MH7DXJNEN80TS7PJB2', NULL, 'post-card.social', 'Social Post Card', '<article class="post-card">{{content}}</article>', '', NULL, '{}', '{}', '{}', NULL, 1, 'published', 'system', '', '[]', 1784358838347, 1784358838347),
  ('uc:provider:chatgpt:prim:ai-chat:response-bubble:chatgpt', 'prim:ai-chat:response-bubble', 'provider', 'chatgpt', 'chatgpt', 'canvas-viewer.chatgpt', 'ChatGPT Canvas Viewer', '<div class="chatgpt-canvas"><iframe class="canvas-frame"></iframe></div>', '', NULL, '{}', '{}', '{}', NULL, 1, 'published', 'system', '', '[]', 1784358838363, 1784358838363),
  ('uc:provider:chatgpt:prim:ai-chat:model-switcher:chatgpt', 'prim:ai-chat:model-switcher', 'provider', 'chatgpt', 'chatgpt', 'model-picker.chatgpt', 'ChatGPT Model Picker', '<select class="model-picker chatgpt">{{models}}</select>', '', NULL, '{}', '{}', '{}', NULL, 1, 'published', 'system', '', '[]', 1784358838389, 1784358838389),
  ('uc:provider:claude:prim:ai-chat:response-bubble:claude', 'prim:ai-chat:response-bubble', 'provider', 'claude', 'claude', 'artifacts-viewer.claude', 'Claude Artifacts Viewer', '<div class="claude-artifacts"><pre><code>{{content}}</code></pre></div>', '', NULL, '{}', '{}', '{}', NULL, 1, 'published', 'system', '', '[]', 1784358838405, 1784358838405),
  ('uc:provider:gemini:prim:ai-chat:response-bubble:gemini', 'prim:ai-chat:response-bubble', 'provider', 'gemini', 'gemini', 'inline-images.gemini', 'Gemini Inline Images', '<div class="gemini-inline-images"><img src="{{url}}" alt="{{alt}}" /></div>', '', NULL, '{}', '{}', '{}', NULL, 1, 'published', 'system', '', '[]', 1784358838421, 1784358838421);

-- user: (empty)

-- user_preference: (empty)

-- vivim_session: 2 rows
INSERT INTO "vivim_session" ("id", "state", "context_json", "created_at", "updated_at") VALUES
  ('01KXT9F3CRER61DG2ZJ0T4Y3VY', 'idle', '{}', 1784367517033, 1784367517033),
  ('01KXVSX112JMBFKH92SMV3X18M', 'idle', '{}', 1784418305055, 1784418305055);

-- workflow_credential: (empty)

-- workflow_definition: (empty)

-- workflow_edge: (empty)

-- workflow_execution: (empty)

-- workflow_node: (empty)

-- workflow_node_execution: (empty)

-- workflow_retry_queue: (empty)

-- workflow_version: (empty)

-- workflow_webhook: (empty)

-- workspace_mode: (empty)

-- ─────────────────────────────────────────────────────────────────
-- Total: 153 tables, 0 views, 210 indexes, 371 rows
-- ─────────────────────────────────────────────────────────────────