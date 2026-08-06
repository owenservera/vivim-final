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
    "applied_at" BIGINT NOT NULL
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

-- CreateTable
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

-- CreateTable
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
    "last_used_at" BIGINT,
    "selector_hit_count" INTEGER NOT NULL DEFAULT 0,
    "selector_miss_count" INTEGER NOT NULL DEFAULT 0,
    "selector_last_miss_at" BIGINT,
    "selector_last_error" TEXT,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
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
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
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
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
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

-- CreateTable
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
    "ts" BIGINT NOT NULL
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
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
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
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
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
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
    CONSTRAINT "capability_binding_global_id_fkey" FOREIGN KEY ("global_id") REFERENCES "capability_taxonomy" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "capability_binding_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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
    "last_used_at" BIGINT,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
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
    "ts" BIGINT NOT NULL,
    CONSTRAINT "outcome_capability_id_fkey" FOREIGN KEY ("capability_id") REFERENCES "capability_taxonomy" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "vivim_session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "state" TEXT NOT NULL DEFAULT 'idle',
    "context_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT,
    CONSTRAINT "conversation_message_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "conversation_message_parent_message_id_fkey" FOREIGN KEY ("parent_message_id") REFERENCES "conversation_message" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "session_checkpoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vivim_session_id" TEXT NOT NULL,
    "checkpoint_json" TEXT NOT NULL,
    "created_at" BIGINT NOT NULL,
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
    "created_at" BIGINT NOT NULL,
    CONSTRAINT "stream_block_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "stream_block_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "conversation_message" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "node_alias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "alias_id" TEXT NOT NULL,
    "canonical_id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 1.0,
    "created_at" BIGINT NOT NULL
);

-- CreateTable
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
    "created_at" BIGINT NOT NULL,
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
    "ts" BIGINT NOT NULL,
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
    "resolved_at" BIGINT,
    "detected_at" BIGINT NOT NULL,
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
    "created_at" BIGINT NOT NULL,
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
    "ts" BIGINT NOT NULL,
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
    "window_start_ts" BIGINT NOT NULL,
    "window_end_ts" BIGINT NOT NULL,
    "snapshot_ts" BIGINT NOT NULL,
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
    "window_start_ts" BIGINT NOT NULL,
    "window_end_ts" BIGINT NOT NULL,
    "snapshot_ts" BIGINT NOT NULL,
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
    "ts" BIGINT NOT NULL,
    CONSTRAINT "manifest_change_log_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "telemetry_cycle_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schedule_name" TEXT NOT NULL,
    "rows_written" INTEGER NOT NULL DEFAULT 0,
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "ts" BIGINT NOT NULL
);

-- CreateTable
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

-- CreateTable
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
    "created_at" BIGINT NOT NULL
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "mcp_server_config" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "enabled" INTEGER NOT NULL DEFAULT 0,
    "port" INTEGER NOT NULL DEFAULT 0,
    "tools_json" TEXT NOT NULL DEFAULT '[]',
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

-- CreateTable
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

-- CreateTable
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
    "detected_at" BIGINT NOT NULL,
    "resolved_at" BIGINT,
    CONSTRAINT "drift_event_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "fleet_event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slave_id" TEXT NOT NULL,
    "provider_id" TEXT,
    "event_type" TEXT NOT NULL,
    "event_data_json" TEXT NOT NULL DEFAULT '{}',
    "ts" BIGINT NOT NULL,
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
    "last_check_at" BIGINT,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
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
    "last_run_at" BIGINT,
    "next_run_at" BIGINT,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

-- CreateTable
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
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
    CONSTRAINT "alert_condition_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "route_request" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "route_spec_id" TEXT NOT NULL,
    "conversation_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result_json" TEXT,
    "ts" BIGINT NOT NULL,
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
    "created_at" BIGINT NOT NULL,
    CONSTRAINT "route_target_route_spec_id_fkey" FOREIGN KEY ("route_spec_id") REFERENCES "route_spec" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "route_event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "route_request_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_data_json" TEXT NOT NULL DEFAULT '{}',
    "ts" BIGINT NOT NULL,
    CONSTRAINT "route_event_route_request_id_fkey" FOREIGN KEY ("route_request_id") REFERENCES "route_request" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "transfer_candidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transfer_pattern_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "metadata_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" BIGINT NOT NULL,
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
    "ts" BIGINT NOT NULL,
    CONSTRAINT "transfer_attempt_transfer_candidate_id_fkey" FOREIGN KEY ("transfer_candidate_id") REFERENCES "transfer_candidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "binding_event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "binding_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "data_json" TEXT NOT NULL DEFAULT '{}',
    "ts" BIGINT NOT NULL,
    CONSTRAINT "binding_event_binding_id_fkey" FOREIGN KEY ("binding_id") REFERENCES "capability_binding" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "failure_classification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "outcome_id" TEXT NOT NULL,
    "failure_type" TEXT NOT NULL,
    "is_recoverable" INTEGER NOT NULL DEFAULT 0,
    "suggested_action" TEXT,
    "ts" BIGINT NOT NULL,
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
    "started_at" BIGINT NOT NULL,
    "completed_at" BIGINT
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
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "capability_shape_binding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shape_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "capability_id" TEXT NOT NULL,
    "mapping_json" TEXT NOT NULL,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "created_at" BIGINT NOT NULL
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "provider_shape_binding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "archetype_id" TEXT NOT NULL,
    "shape_id" TEXT NOT NULL,
    "config_json" TEXT,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "created_at" BIGINT NOT NULL
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
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "discovery_result" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "provider_id" TEXT,
    "approved_by" TEXT,
    "manifest_json" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" BIGINT NOT NULL
);

-- CreateTable
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

-- CreateTable
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
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
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
    "started_at" BIGINT NOT NULL,
    "completed_at" BIGINT
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
    "started_at" BIGINT,
    "completed_at" BIGINT
);

-- CreateTable
CREATE TABLE "workflow_webhook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflow_id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "secret" TEXT,
    "created_at" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "workflow_credential" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflow_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value_encrypted" TEXT NOT NULL,
    "created_at" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "mcp_tool" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "server_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "input_schema_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" BIGINT NOT NULL
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
    "created_at" BIGINT NOT NULL
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
    "created_at" BIGINT NOT NULL
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
    "expires_at" BIGINT,
    "created_at" BIGINT NOT NULL
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
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
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
    "created_at" BIGINT NOT NULL
);

-- CreateTable
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
    "created_at" BIGINT NOT NULL
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "topic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "conversation_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "conversation_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "conversation_topic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 0.5,
    "assigned_at" BIGINT NOT NULL,
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
    "started_at" BIGINT NOT NULL,
    "completed_at" BIGINT
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
    "created_at" BIGINT NOT NULL
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "routing_preference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "capability_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "score" REAL NOT NULL DEFAULT 0.5,
    "sample_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "provider_cost_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "cost_cents" INTEGER NOT NULL,
    "tokens_input" INTEGER NOT NULL DEFAULT 0,
    "tokens_output" INTEGER NOT NULL DEFAULT 0,
    "model" TEXT,
    "ts" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "provider_latency_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "capability_id" TEXT,
    "ts" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "situation_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_id" TEXT,
    "detected_type" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "signals_json" TEXT NOT NULL,
    "timestamp" INTEGER NOT NULL
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "token_budget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_id" TEXT NOT NULL,
    "total_budget" INTEGER NOT NULL,
    "layers_json" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "ts" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "workspace_mode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL DEFAULT 'default',
    "mode" TEXT NOT NULL DEFAULT 'chat',
    "panels_json" TEXT NOT NULL DEFAULT '[]',
    "updated_at" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "user_preference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL DEFAULT 'default',
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "learned_at" BIGINT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 0.5
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "memory_feedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memory_type" TEXT NOT NULL,
    "memory_id" TEXT NOT NULL,
    "feedback" TEXT NOT NULL,
    "correction" TEXT,
    "user_id" TEXT NOT NULL DEFAULT 'default',
    "ts" BIGINT NOT NULL
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "autonomous_task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "goal_json" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result_json" TEXT,
    "error" TEXT,
    "started_at" BIGINT NOT NULL,
    "completed_at" BIGINT
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "sync_peer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "device_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "public_key" TEXT NOT NULL,
    "last_sync_at" BIGINT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paired_at" BIGINT
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "kernel_topology" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "snapshot" TEXT NOT NULL,
    "created_at" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "kernel_events" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kind" TEXT NOT NULL,
    "engine_id" TEXT,
    "data" TEXT,
    "created_at" BIGINT NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "nlcl_graph_nodes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "data_json" TEXT,
    "created_at" BIGINT NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "nlcl_graph_edges" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "from_id" TEXT NOT NULL,
    "to_id" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "weight" REAL NOT NULL DEFAULT 1,
    "data_json" TEXT,
    "created_at" BIGINT NOT NULL DEFAULT 0
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "stealth_module_profile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "modules_json" TEXT NOT NULL DEFAULT '[]',
    "created_at" BIGINT NOT NULL DEFAULT 0,
    "updated_at" BIGINT NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "stealth_policy" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "default_launch_profile_id" TEXT,
    "default_module_profile_id" TEXT,
    "provider_overrides_json" TEXT NOT NULL DEFAULT '{}'
);

-- CreateTable
CREATE TABLE "sandbox_audit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "handler_slug" TEXT NOT NULL,
    "ok" INTEGER NOT NULL,
    "error" TEXT,
    "permissions_json" TEXT NOT NULL,
    "ts" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "health_digest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "day" TEXT NOT NULL,
    "markdown" TEXT NOT NULL,
    "metrics_json" TEXT NOT NULL,
    "created_at" BIGINT NOT NULL
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "workflow_retry_queue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "node_execution_id" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "next_retry_at" BIGINT NOT NULL,
    "max_attempts" INTEGER NOT NULL,
    "backoff_ms" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending'
);

-- CreateTable
CREATE TABLE "workflow_version" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflow_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "definition_json" TEXT NOT NULL,
    "created_at" BIGINT NOT NULL
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
CREATE INDEX "idx_psc_provider" ON "provider_stream_config"("provider_id");

-- CreateIndex
CREATE INDEX "idx_psc_transport" ON "provider_stream_config"("stream_transport");

-- CreateIndex
CREATE UNIQUE INDEX "provider_stream_config_provider_id_stream_transport_version_key" ON "provider_stream_config"("provider_id", "stream_transport", "version");

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
CREATE UNIQUE INDEX "capability_override_provider_id_capability_id_override_type_key" ON "capability_override"("provider_id", "capability_id", "override_type");

-- CreateIndex
CREATE INDEX "idx_ci_intent" ON "capability_intent"("intent_text");

-- CreateIndex
CREATE INDEX "idx_ci_primary" ON "capability_intent"("is_primary");

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
CREATE INDEX "idx_ma_message" ON "message_attachment"("message_id");

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
CREATE INDEX "idx_node_type" ON "node"("type");

-- CreateIndex
CREATE INDEX "idx_node_parent" ON "node"("parent_id");

-- CreateIndex
CREATE INDEX "idx_node_conversation" ON "node"("conversation_id");

-- CreateIndex
CREATE INDEX "idx_node_message" ON "node"("message_id");

-- CreateIndex
CREATE INDEX "idx_node_created" ON "node"("created_at");

-- CreateIndex
CREATE INDEX "idx_node_search" ON "node"("search_text");

-- CreateIndex
CREATE INDEX "idx_node_content_hash" ON "node"("content_hash");

-- CreateIndex
CREATE INDEX "idx_node_state" ON "node"("state");

-- CreateIndex
CREATE INDEX "idx_nodeversion_node" ON "node_version"("node_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_node_version" ON "node_version"("node_id", "version");

-- CreateIndex
CREATE INDEX "idx_node_alias_canonical" ON "node_alias"("canonical_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_node_alias" ON "node_alias"("alias_id");

-- CreateIndex
CREATE INDEX "idx_edge_source" ON "node_edge"("source_id");

-- CreateIndex
CREATE INDEX "idx_edge_target" ON "node_edge"("target_id");

-- CreateIndex
CREATE INDEX "idx_edge_type" ON "node_edge"("edge_type");

-- CreateIndex
CREATE UNIQUE INDEX "uq_edge" ON "node_edge"("source_id", "target_id", "edge_type");

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
CREATE INDEX "idx_harness_cmd_id" ON "harness_command"("command_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_harness_cmd_id_ver" ON "harness_command"("command_id", "version");

-- CreateIndex
CREATE INDEX "idx_repair_conv" ON "repair_session"("conversation_id");

-- CreateIndex
CREATE INDEX "idx_repair_cmd" ON "repair_session"("command_id");

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

-- CreateIndex
CREATE INDEX "idx_ms_conv" ON "mux_session"("conversation_id");

-- CreateIndex
CREATE INDEX "idx_ms_status" ON "mux_session"("status");

-- CreateIndex
CREATE INDEX "idx_mr_session" ON "mux_response"("mux_session_id");

-- CreateIndex
CREATE INDEX "idx_mr_provider" ON "mux_response"("provider_id");

-- CreateIndex
CREATE INDEX "idx_rp_cap" ON "routing_preference"("capability_id");

-- CreateIndex
CREATE UNIQUE INDEX "routing_preference_capability_id_provider_id_key" ON "routing_preference"("capability_id", "provider_id");

-- CreateIndex
CREATE INDEX "idx_pcl_provider" ON "provider_cost_log"("provider_id", "ts");

-- CreateIndex
CREATE INDEX "idx_pll_provider" ON "provider_latency_log"("provider_id", "ts");

-- CreateIndex
CREATE INDEX "idx_sl_conv" ON "situation_log"("conversation_id");

-- CreateIndex
CREATE INDEX "idx_sl_type" ON "situation_log"("detected_type");

-- CreateIndex
CREATE INDEX "idx_clr_conv" ON "context_layer"("conversation_id");

-- CreateIndex
CREATE INDEX "idx_clr_layer" ON "context_layer"("layer_name");

-- CreateIndex
CREATE INDEX "idx_tb_conv" ON "token_budget"("conversation_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_mode_user_id_key" ON "workspace_mode"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_preference_user_id_key_key" ON "user_preference"("user_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_registry_name_key" ON "plugin_registry"("name");

-- CreateIndex
CREATE UNIQUE INDEX "memory_curated_memory_type_memory_id_key" ON "memory_curated"("memory_type", "memory_id");

-- CreateIndex
CREATE INDEX "idx_mf_memory" ON "memory_feedback"("memory_type", "memory_id");

-- CreateIndex
CREATE UNIQUE INDEX "policy_rule_name_key" ON "policy_rule"("name");

-- CreateIndex
CREATE INDEX "idx_at_status" ON "autonomous_task"("status");

-- CreateIndex
CREATE INDEX "idx_ast_task" ON "autonomous_step"("task_id");

-- CreateIndex
CREATE INDEX "idx_hg_task_status" ON "hitl_gate"("task_id", "status");

-- CreateIndex
CREATE INDEX "idx_hg_status" ON "hitl_gate"("status");

-- CreateIndex
CREATE INDEX "idx_sl_device" ON "sync_log"("device_id", "synced_at");

-- CreateIndex
CREATE INDEX "idx_sl_record" ON "sync_log"("table", "record_id");

-- CreateIndex
CREATE UNIQUE INDEX "sync_peer_device_id_key" ON "sync_peer"("device_id");

-- CreateIndex
CREATE INDEX "idx_hs_agent" ON "hpe_session"("agent_id", "started_at");

-- CreateIndex
CREATE INDEX "idx_kernel_spans_trace" ON "kernel_spans"("trace_id");

-- CreateIndex
CREATE INDEX "idx_kernel_spans_engine" ON "kernel_spans"("engine_id");

-- CreateIndex
CREATE INDEX "idx_kernel_spans_time" ON "kernel_spans"("start_time");

-- CreateIndex
CREATE INDEX "idx_kernel_prov_trace" ON "kernel_provenance"("trace_id");

-- CreateIndex
CREATE INDEX "idx_kernel_prov_engine" ON "kernel_provenance"("engine_id");

-- CreateIndex
CREATE INDEX "idx_kernel_prov_kind" ON "kernel_provenance"("kind");

-- CreateIndex
CREATE INDEX "idx_kernel_events_kind" ON "kernel_events"("kind");

-- CreateIndex
CREATE INDEX "idx_kernel_events_time" ON "kernel_events"("created_at");

-- CreateIndex
CREATE INDEX "idx_nlcl_nodes_kind" ON "nlcl_graph_nodes"("kind");

-- CreateIndex
CREATE INDEX "idx_nlcl_nodes_label" ON "nlcl_graph_nodes"("label");

-- CreateIndex
CREATE INDEX "idx_nlcl_edges_from" ON "nlcl_graph_edges"("from_id");

-- CreateIndex
CREATE INDEX "idx_nlcl_edges_to" ON "nlcl_graph_edges"("to_id");

-- CreateIndex
CREATE INDEX "idx_nlcl_edges_rel" ON "nlcl_graph_edges"("relation");

-- CreateIndex
CREATE INDEX "idx_sa_handler" ON "sandbox_audit"("handler_slug", "ts");

-- CreateIndex
CREATE UNIQUE INDEX "health_digest_day_key" ON "health_digest"("day");

-- CreateIndex
CREATE INDEX "idx_hd_day" ON "health_digest"("day");

-- CreateIndex
CREATE INDEX "idx_cu_message" ON "content_unit"("message_id");

-- CreateIndex
CREATE INDEX "idx_cu_conv_type" ON "content_unit"("conversation_id", "unit_type");

-- CreateIndex
CREATE INDEX "idx_ml_source" ON "message_link"("source_message_id");

-- CreateIndex
CREATE INDEX "idx_ml_target" ON "message_link"("target_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_link_source_message_id_target_message_id_relation_key" ON "message_link"("source_message_id", "target_message_id", "relation");

-- CreateIndex
CREATE INDEX "idx_ment_message" ON "message_entity"("message_id");

-- CreateIndex
CREATE INDEX "idx_ment_entity" ON "message_entity"("entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_entity_message_id_entity_id_key" ON "message_entity"("message_id", "entity_id");

-- CreateIndex
CREATE INDEX "idx_mlink_source" ON "memory_link"("source_memory_type", "source_memory_id");

-- CreateIndex
CREATE INDEX "idx_mlink_target" ON "memory_link"("target_memory_type", "target_memory_id");

-- CreateIndex
CREATE UNIQUE INDEX "memory_link_source_memory_type_source_memory_id_target_memory_type_target_memory_id_relation_key" ON "memory_link"("source_memory_type", "source_memory_id", "target_memory_type", "target_memory_id", "relation");

-- CreateIndex
CREATE INDEX "idx_macc_memory" ON "memory_access"("memory_type", "memory_id");

-- CreateIndex
CREATE INDEX "idx_macc_time" ON "memory_access"("created_at");

-- CreateIndex
CREATE INDEX "idx_rl_type" ON "reflection_log"("reflection_type");

-- CreateIndex
CREATE INDEX "idx_rl_conv" ON "reflection_log"("conversation_id");

-- CreateIndex
CREATE INDEX "idx_rl_time" ON "reflection_log"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "context_budget_config_user_id_key" ON "context_budget_config"("user_id");

-- CreateIndex
CREATE INDEX "idx_sd_conv" ON "situation_detection"("conversation_id");

-- CreateIndex
CREATE INDEX "idx_sd_type" ON "situation_detection"("detected_type");

-- CreateIndex
CREATE INDEX "idx_sd_time" ON "situation_detection"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "provider_type_slug_key" ON "provider_type"("slug");

-- CreateIndex
CREATE INDEX "idx_prim_scope" ON "primitive"("scope");

-- CreateIndex
CREATE INDEX "idx_prim_family" ON "primitive"("family_id");

-- CreateIndex
CREATE INDEX "idx_prim_provider" ON "primitive"("provider_id");

-- CreateIndex
CREATE INDEX "idx_uc_prim" ON "ui_component"("primitive_id");

-- CreateIndex
CREATE INDEX "idx_uc_owner" ON "ui_component"("scope", "owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_comp_resolve" ON "ui_component"("primitive_id", "scope", "owner_id", "variant");

-- CreateIndex
CREATE INDEX "idx_user_status" ON "user"("status");

-- CreateIndex
CREATE INDEX "idx_user_default" ON "user"("is_default");

-- CreateIndex
CREATE INDEX "idx_wrq_status_time" ON "workflow_retry_queue"("status", "next_retry_at");

-- CreateIndex
CREATE INDEX "idx_wv_wf" ON "workflow_version"("workflow_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_wv_wf_ver" ON "workflow_version"("workflow_id", "version");

