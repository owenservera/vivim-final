/*
  Warnings:

  - You are about to alter the column `created_at` on the `agent_decision_log` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `completed_at` on the `agent_loop_run` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `started_at` on the `agent_loop_run` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `agent_step` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `alert_condition` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updated_at` on the `alert_condition` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `acknowledged_at` on the `alert_event` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `fired_at` on the `alert_event` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `completed_at` on the `automation_run` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `started_at` on the `automation_run` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `automation_schedule` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `last_run_at` on the `automation_schedule` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `next_run_at` on the `automation_schedule` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updated_at` on the `automation_schedule` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `completed_at` on the `autonomous_step` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `started_at` on the `autonomous_step` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `completed_at` on the `autonomous_task` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `started_at` on the `autonomous_task` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `ts` on the `binding_event` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `ts` on the `binding_status_log` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `capability_binding` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updated_at` on the `capability_binding` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `capability_macro` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updated_at` on the `capability_macro` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `capability_program` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updated_at` on the `capability_program` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `capability_shape` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updated_at` on the `capability_shape` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `capability_shape_binding` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `capability_taxonomy` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updated_at` on the `capability_taxonomy` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `capability_taxonomy_version` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `capability_telemetry` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `last_error_ts` on the `capability_telemetry` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `last_executed_at` on the `capability_telemetry` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updated_at` on the `capability_telemetry` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `capability_tier` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updated_at` on the `capability_tier` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `circuit_breaker_state` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `half_opened_at` on the `circuit_breaker_state` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `last_fail_at` on the `circuit_breaker_state` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `last_success_at` on the `circuit_breaker_state` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `opened_at` on the `circuit_breaker_state` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updated_at` on the `circuit_breaker_state` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `ts` on the `config_audit` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `config_entry` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updated_at` on the `config_entry` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `assembled_at` on the `context_layer` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `conversation` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `last_message_at` on the `conversation` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updated_at` on the `conversation` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `conversation_message` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `assigned_at` on the `conversation_topic` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `ts` on the `decision_record` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `discovery_result` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `discovery_session` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updated_at` on the `discovery_session` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `detected_at` on the `drift_event` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `resolved_at` on the `drift_event` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `entity` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `first_seen_at` on the `entity` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `last_seen_at` on the `entity` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updated_at` on the `entity` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `ts` on the `entity_mention` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `episodic_memory` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `ts` on the `failure_classification` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `ts` on the `fleet_event` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `harness_checkpoint` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `ts` on the `health_tick` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `hitl_gate` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `expires_at` on the `hitl_gate` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `resolved_at` on the `hitl_gate` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `completed_at` on the `hpe_session` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `hpe_session` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `started_at` on the `hpe_session` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `completed_at` on the `import_job` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `started_at` on the `import_job` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `kernel_events` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `kernel_spans` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `kernel_topology` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `ts` on the `learning_event` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `ts` on the `manifest_change_log` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `detected_at` on the `manifest_drift` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `resolved_at` on the `manifest_drift` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `mcp_server_config` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updated_at` on the `mcp_server_config` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `mcp_tool` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `mcp_tool_call` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `curated_at` on the `memory_curated` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `memory_embedding` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `ts` on the `memory_feedback` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `applied_at` on the `migration_log` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `mirror_state` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `last_sync_at` on the `mirror_state` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updated_at` on the `mirror_state` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `ts` on the `mux_response` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `completed_at` on the `mux_session` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `started_at` on the `mux_session` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `nlcl_graph_edges` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `nlcl_graph_nodes` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `optimistic_update` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `resolved_at` on the `optimistic_update` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `ts` on the `outcome` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `pattern_extract` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `first_seen_at` on the `pattern_extract` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `last_seen_at` on the `pattern_extract` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updated_at` on the `pattern_extract` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `plugin_registry` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `loaded_at` on the `plugin_registry` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updated_at` on the `plugin_registry` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `procedural_rule` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updated_at` on the `procedural_rule` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `profile_session` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updated_at` on the `profile_session` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `program_version_metric` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `first_executed_at` on the `program_version_metric` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `last_executed_at` on the `program_version_metric` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updated_at` on the `program_version_metric` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `project` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updated_at` on the `project` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `provider_account` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `last_login_at` on the `provider_account` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updated_at` on the `provider_account` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `provider_archetype` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updated_at` on the `provider_archetype` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `provider_capability` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `last_used_at` on the `provider_capability` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `selector_last_miss_at` on the `provider_capability` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updated_at` on the `provider_capability` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `provider_config` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updated_at` on the `provider_config` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `ts` on the `provider_cost_log` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `provider_definition` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updated_at` on the `provider_definition` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `provider_endpoint` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updated_at` on the `provider_endpoint` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `provider_health` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `last_check_at` on the `provider_health` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updated_at` on the `provider_health` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `snapshot_ts` on the `provider_health_history` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `window_end_ts` on the `provider_health_history` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `window_start_ts` on the `provider_health_history` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `ts` on the `provider_latency_log` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `provider_manifest_version` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `provider_model` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updated_at` on the `provider_model` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `provider_parser` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updated_at` on the `provider_parser` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `provider_session` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updated_at` on the `provider_session` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `provider_shape_binding` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `provider_stream_config` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updated_at` on the `provider_stream_config` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `ts` on the `registration_event` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `ts` on the `route_event` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `ts` on the `route_request` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `route_spec` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updated_at` on the `route_spec` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `route_target` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updated_at` on the `routing_preference` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `rule` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updated_at` on the `rule` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `ts` on the `sandbox_audit` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `snapshot_ts` on the `selector_health_history` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `window_end_ts` on the `selector_health_history` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `window_start_ts` on the `selector_health_history` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `selector_strategy` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `last_used_at` on the `selector_strategy` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updated_at` on the `selector_strategy` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `semantic_memory` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `expires_at` on the `semantic_memory` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `session_checkpoint` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `ts` on the `state_transition` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `stealth_launch_profile` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updated_at` on the `stealth_launch_profile` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `stealth_module_profile` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updated_at` on the `stealth_module_profile` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `stream_block` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `synced_at` on the `sync_log` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `ts` on the `sync_log` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `last_sync_at` on the `sync_peer` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `paired_at` on the `sync_peer` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `ts` on the `telemetry_cycle_log` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `completed_at` on the `test_run` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `started_at` on the `test_run` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `ts` on the `token_budget` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `topic` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updated_at` on the `topic` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `ts` on the `trace_entry` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `ts` on the `transfer_attempt` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `transfer_candidate` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `transfer_pattern` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `last_transferred_at` on the `transfer_pattern` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updated_at` on the `transfer_pattern` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `learned_at` on the `user_preference` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `vivim_session` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updated_at` on the `vivim_session` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `workflow_credential` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `workflow_definition` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updated_at` on the `workflow_definition` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `completed_at` on the `workflow_execution` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `started_at` on the `workflow_execution` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `completed_at` on the `workflow_node_execution` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `started_at` on the `workflow_node_execution` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `created_at` on the `workflow_webhook` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updated_at` on the `workspace_mode` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.

*/
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

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_agent_decision_log" (
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
INSERT INTO "new_agent_decision_log" ("agent_id", "confidence", "created_at", "decision_type", "id", "input_json", "output_json", "reasoning", "timestamp") SELECT "agent_id", "confidence", "created_at", "decision_type", "id", "input_json", "output_json", "reasoning", "timestamp" FROM "agent_decision_log";
DROP TABLE "agent_decision_log";
ALTER TABLE "new_agent_decision_log" RENAME TO "agent_decision_log";
CREATE TABLE "new_agent_loop_run" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agent_id" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "input_json" TEXT,
    "output_json" TEXT,
    "started_at" BIGINT NOT NULL,
    "completed_at" BIGINT
);
INSERT INTO "new_agent_loop_run" ("agent_id", "completed_at", "goal", "id", "input_json", "output_json", "started_at", "status") SELECT "agent_id", "completed_at", "goal", "id", "input_json", "output_json", "started_at", "status" FROM "agent_loop_run";
DROP TABLE "agent_loop_run";
ALTER TABLE "new_agent_loop_run" RENAME TO "agent_loop_run";
CREATE TABLE "new_agent_step" (
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
INSERT INTO "new_agent_step" ("action_json", "action_type", "created_at", "duration_ms", "id", "result_json", "run_id", "step_index", "success") SELECT "action_json", "action_type", "created_at", "duration_ms", "id", "result_json", "run_id", "step_index", "success" FROM "agent_step";
DROP TABLE "agent_step";
ALTER TABLE "new_agent_step" RENAME TO "agent_step";
CREATE TABLE "new_alert_condition" (
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
INSERT INTO "new_alert_condition" ("cooldown_s", "created_at", "id", "is_active", "metric", "name", "operator", "provider_id", "threshold", "updated_at", "window_s") SELECT "cooldown_s", "created_at", "id", "is_active", "metric", "name", "operator", "provider_id", "threshold", "updated_at", "window_s" FROM "alert_condition";
DROP TABLE "alert_condition";
ALTER TABLE "new_alert_condition" RENAME TO "alert_condition";
CREATE TABLE "new_alert_event" (
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
INSERT INTO "new_alert_event" ("acknowledged", "acknowledged_at", "acknowledged_by", "condition_id", "fired_at", "id", "metric_value", "provider_id", "threshold") SELECT "acknowledged", "acknowledged_at", "acknowledged_by", "condition_id", "fired_at", "id", "metric_value", "provider_id", "threshold" FROM "alert_event";
DROP TABLE "alert_event";
ALTER TABLE "new_alert_event" RENAME TO "alert_event";
CREATE INDEX "idx_ae_condition" ON "alert_event"("condition_id", "fired_at");
CREATE TABLE "new_automation_run" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schedule_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "result_json" TEXT,
    "error" TEXT,
    "started_at" BIGINT NOT NULL,
    "completed_at" BIGINT,
    CONSTRAINT "automation_run_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "automation_schedule" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_automation_run" ("completed_at", "error", "id", "result_json", "schedule_id", "started_at", "status") SELECT "completed_at", "error", "id", "result_json", "schedule_id", "started_at", "status" FROM "automation_run";
DROP TABLE "automation_run";
ALTER TABLE "new_automation_run" RENAME TO "automation_run";
CREATE INDEX "idx_ar_schedule" ON "automation_run"("schedule_id", "started_at");
CREATE TABLE "new_automation_schedule" (
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
INSERT INTO "new_automation_schedule" ("action", "action_config_json", "created_at", "id", "is_active", "last_run_at", "name", "next_run_at", "schedule_type", "schedule_value", "updated_at") SELECT "action", "action_config_json", "created_at", "id", "is_active", "last_run_at", "name", "next_run_at", "schedule_type", "schedule_value", "updated_at" FROM "automation_schedule";
DROP TABLE "automation_schedule";
ALTER TABLE "new_automation_schedule" RENAME TO "automation_schedule";
CREATE TABLE "new_autonomous_step" (
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
INSERT INTO "new_autonomous_step" ("action", "action_input_json", "classification", "completed_at", "description", "error", "id", "requires_human_approval", "result_json", "started_at", "status", "step_index", "task_id") SELECT "action", "action_input_json", "classification", "completed_at", "description", "error", "id", "requires_human_approval", "result_json", "started_at", "status", "step_index", "task_id" FROM "autonomous_step";
DROP TABLE "autonomous_step";
ALTER TABLE "new_autonomous_step" RENAME TO "autonomous_step";
CREATE INDEX "idx_ast_task" ON "autonomous_step"("task_id");
CREATE TABLE "new_autonomous_task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "goal_json" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result_json" TEXT,
    "error" TEXT,
    "started_at" BIGINT NOT NULL,
    "completed_at" BIGINT
);
INSERT INTO "new_autonomous_task" ("completed_at", "error", "goal_json", "id", "result_json", "started_at", "status") SELECT "completed_at", "error", "goal_json", "id", "result_json", "started_at", "status" FROM "autonomous_task";
DROP TABLE "autonomous_task";
ALTER TABLE "new_autonomous_task" RENAME TO "autonomous_task";
CREATE INDEX "idx_at_status" ON "autonomous_task"("status");
CREATE TABLE "new_binding_event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "binding_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "data_json" TEXT NOT NULL DEFAULT '{}',
    "ts" BIGINT NOT NULL,
    CONSTRAINT "binding_event_binding_id_fkey" FOREIGN KEY ("binding_id") REFERENCES "capability_binding" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_binding_event" ("binding_id", "data_json", "event_type", "id", "ts") SELECT "binding_id", "data_json", "event_type", "id", "ts" FROM "binding_event";
DROP TABLE "binding_event";
ALTER TABLE "new_binding_event" RENAME TO "binding_event";
CREATE TABLE "new_binding_status_log" (
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
INSERT INTO "new_binding_status_log" ("actor", "binding_id", "confidence_at_transition", "from_program_id", "from_status", "id", "metadata_json", "reason", "success_rate_at_transition", "to_program_id", "to_status", "trigger", "ts") SELECT "actor", "binding_id", "confidence_at_transition", "from_program_id", "from_status", "id", "metadata_json", "reason", "success_rate_at_transition", "to_program_id", "to_status", "trigger", "ts" FROM "binding_status_log";
DROP TABLE "binding_status_log";
ALTER TABLE "new_binding_status_log" RENAME TO "binding_status_log";
CREATE INDEX "idx_bsl_binding" ON "binding_status_log"("binding_id", "ts");
CREATE INDEX "idx_bsl_trigger" ON "binding_status_log"("trigger");
CREATE INDEX "idx_bsl_ts" ON "binding_status_log"("ts");
CREATE TABLE "new_capability_binding" (
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
INSERT INTO "new_capability_binding" ("best_program_id", "confidence", "created_at", "current_program_id", "global_id", "id", "promotion_history_json", "provider_id", "status", "updated_at") SELECT "best_program_id", "confidence", "created_at", "current_program_id", "global_id", "id", "promotion_history_json", "provider_id", "status", "updated_at" FROM "capability_binding";
DROP TABLE "capability_binding";
ALTER TABLE "new_capability_binding" RENAME TO "capability_binding";
CREATE INDEX "idx_cb_provider" ON "capability_binding"("provider_id");
CREATE INDEX "idx_cb_status" ON "capability_binding"("status");
CREATE INDEX "idx_cb_global" ON "capability_binding"("global_id");
CREATE UNIQUE INDEX "capability_binding_global_id_provider_id_key" ON "capability_binding"("global_id", "provider_id");
CREATE TABLE "new_capability_macro" (
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
INSERT INTO "new_capability_macro" ("created_at", "dag_json", "description", "id", "is_active", "name", "provider_id", "updated_at") SELECT "created_at", "dag_json", "description", "id", "is_active", "name", "provider_id", "updated_at" FROM "capability_macro";
DROP TABLE "capability_macro";
ALTER TABLE "new_capability_macro" RENAME TO "capability_macro";
CREATE INDEX "idx_cm_provider" ON "capability_macro"("provider_id");
CREATE TABLE "new_capability_program" (
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
INSERT INTO "new_capability_program" ("binding_id", "config_json", "created_at", "id", "is_active", "name", "superseded_by", "updated_at", "version") SELECT "binding_id", "config_json", "created_at", "id", "is_active", "name", "superseded_by", "updated_at", "version" FROM "capability_program";
DROP TABLE "capability_program";
ALTER TABLE "new_capability_program" RENAME TO "capability_program";
CREATE INDEX "idx_cp_binding" ON "capability_program"("binding_id");
CREATE TABLE "new_capability_shape" (
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
INSERT INTO "new_capability_shape" ("created_at", "discovery_hints_json", "expected_caps_json", "id", "is_built_in", "name", "parser_expectations_json", "projection_rules_json", "updated_at") SELECT "created_at", "discovery_hints_json", "expected_caps_json", "id", "is_built_in", "name", "parser_expectations_json", "projection_rules_json", "updated_at" FROM "capability_shape";
DROP TABLE "capability_shape";
ALTER TABLE "new_capability_shape" RENAME TO "capability_shape";
CREATE TABLE "new_capability_shape_binding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shape_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "capability_id" TEXT NOT NULL,
    "mapping_json" TEXT NOT NULL,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "created_at" BIGINT NOT NULL
);
INSERT INTO "new_capability_shape_binding" ("capability_id", "created_at", "id", "is_active", "mapping_json", "provider_id", "shape_id") SELECT "capability_id", "created_at", "id", "is_active", "mapping_json", "provider_id", "shape_id" FROM "capability_shape_binding";
DROP TABLE "capability_shape_binding";
ALTER TABLE "new_capability_shape_binding" RENAME TO "capability_shape_binding";
CREATE TABLE "new_capability_taxonomy" (
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
INSERT INTO "new_capability_taxonomy" ("aliases_json", "availability_json", "category", "concurrency_safe", "created_at", "data_flow", "depends_on_json", "description", "existential_rule", "id", "input_type", "interaction_mode", "max_result_size", "min_plan_tier", "mutation_effects_json", "name", "op_classification", "parent_capability_id", "prefetch", "recovery_behavior", "requires_user_confirmation", "result_component", "result_layout", "search_hints_json", "slug", "state_persistence", "ui_component", "ui_group", "ui_icon", "ui_input_schema", "ui_label", "ui_layer_depth", "ui_order", "ui_position", "ui_priority", "ui_states_json", "ui_visibility_rule", "updated_at") SELECT "aliases_json", "availability_json", "category", "concurrency_safe", "created_at", "data_flow", "depends_on_json", "description", "existential_rule", "id", "input_type", "interaction_mode", "max_result_size", "min_plan_tier", "mutation_effects_json", "name", "op_classification", "parent_capability_id", "prefetch", "recovery_behavior", "requires_user_confirmation", "result_component", "result_layout", "search_hints_json", "slug", "state_persistence", "ui_component", "ui_group", "ui_icon", "ui_input_schema", "ui_label", "ui_layer_depth", "ui_order", "ui_position", "ui_priority", "ui_states_json", "ui_visibility_rule", "updated_at" FROM "capability_taxonomy";
DROP TABLE "capability_taxonomy";
ALTER TABLE "new_capability_taxonomy" RENAME TO "capability_taxonomy";
CREATE UNIQUE INDEX "capability_taxonomy_slug_key" ON "capability_taxonomy"("slug");
CREATE INDEX "idx_ct_category" ON "capability_taxonomy"("category");
CREATE INDEX "idx_ct_position" ON "capability_taxonomy"("ui_position", "ui_group", "ui_order");
CREATE INDEX "idx_ct_slug" ON "capability_taxonomy"("slug");
CREATE INDEX "idx_ct_parent" ON "capability_taxonomy"("parent_capability_id");
CREATE INDEX "idx_ct_classification" ON "capability_taxonomy"("op_classification");
CREATE TABLE "new_capability_taxonomy_version" (
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
INSERT INTO "new_capability_taxonomy_version" ("actor", "capability_id", "change_summary", "changed_fields_json", "created_at", "id", "snapshot_json", "version") SELECT "actor", "capability_id", "change_summary", "changed_fields_json", "created_at", "id", "snapshot_json", "version" FROM "capability_taxonomy_version";
DROP TABLE "capability_taxonomy_version";
ALTER TABLE "new_capability_taxonomy_version" RENAME TO "capability_taxonomy_version";
CREATE INDEX "idx_ctv_cap" ON "capability_taxonomy_version"("capability_id", "version");
CREATE INDEX "idx_ctv_created" ON "capability_taxonomy_version"("created_at");
CREATE UNIQUE INDEX "capability_taxonomy_version_capability_id_version_key" ON "capability_taxonomy_version"("capability_id", "version");
CREATE TABLE "new_capability_telemetry" (
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
INSERT INTO "new_capability_telemetry" ("avg_latency_ms", "binding_id", "capability_id", "consecutive_failures", "created_at", "fail_count", "id", "last_error", "last_error_ts", "last_executed_at", "p50_latency_ms", "p95_latency_ms", "program_id", "provider_id", "success_count", "total_executions", "updated_at", "window_1h_executions", "window_1h_success_count", "window_24h_executions", "window_24h_success_count", "window_7d_executions", "window_7d_success_count") SELECT "avg_latency_ms", "binding_id", "capability_id", "consecutive_failures", "created_at", "fail_count", "id", "last_error", "last_error_ts", "last_executed_at", "p50_latency_ms", "p95_latency_ms", "program_id", "provider_id", "success_count", "total_executions", "updated_at", "window_1h_executions", "window_1h_success_count", "window_24h_executions", "window_24h_success_count", "window_7d_executions", "window_7d_success_count" FROM "capability_telemetry";
DROP TABLE "capability_telemetry";
ALTER TABLE "new_capability_telemetry" RENAME TO "capability_telemetry";
CREATE INDEX "idx_captel_provider" ON "capability_telemetry"("provider_id");
CREATE INDEX "idx_captel_capability" ON "capability_telemetry"("capability_id");
CREATE INDEX "idx_captel_updated" ON "capability_telemetry"("updated_at");
CREATE UNIQUE INDEX "capability_telemetry_capability_id_binding_id_program_id_key" ON "capability_telemetry"("capability_id", "binding_id", "program_id");
CREATE TABLE "new_capability_tier" (
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
INSERT INTO "new_capability_tier" ("capability_id", "created_at", "custom_config_json", "id", "max_file_size", "max_models", "max_options", "plan_tier", "ui_component_override", "ui_icon_override", "ui_input_schema_override", "ui_label_override", "ui_states_override_json", "updated_at") SELECT "capability_id", "created_at", "custom_config_json", "id", "max_file_size", "max_models", "max_options", "plan_tier", "ui_component_override", "ui_icon_override", "ui_input_schema_override", "ui_label_override", "ui_states_override_json", "updated_at" FROM "capability_tier";
DROP TABLE "capability_tier";
ALTER TABLE "new_capability_tier" RENAME TO "capability_tier";
CREATE UNIQUE INDEX "capability_tier_capability_id_plan_tier_key" ON "capability_tier"("capability_id", "plan_tier");
CREATE TABLE "new_circuit_breaker_state" (
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
INSERT INTO "new_circuit_breaker_state" ("created_at", "fail_count", "half_opened_at", "id", "last_fail_at", "last_success_at", "opened_at", "slave_id", "state", "updated_at") SELECT "created_at", "fail_count", "half_opened_at", "id", "last_fail_at", "last_success_at", "opened_at", "slave_id", "state", "updated_at" FROM "circuit_breaker_state";
DROP TABLE "circuit_breaker_state";
ALTER TABLE "new_circuit_breaker_state" RENAME TO "circuit_breaker_state";
CREATE UNIQUE INDEX "circuit_breaker_state_slave_id_key" ON "circuit_breaker_state"("slave_id");
CREATE TABLE "new_config_audit" (
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
INSERT INTO "new_config_audit" ("action", "actor", "engine_id", "entry_id", "from_json", "id", "to_json", "ts") SELECT "action", "actor", "engine_id", "entry_id", "from_json", "id", "to_json", "ts" FROM "config_audit";
DROP TABLE "config_audit";
ALTER TABLE "new_config_audit" RENAME TO "config_audit";
CREATE INDEX "idx_ca_engine" ON "config_audit"("engine_id", "ts");
CREATE INDEX "idx_ca_entry" ON "config_audit"("entry_id", "ts");
CREATE TABLE "new_config_entry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "engine_id" TEXT NOT NULL,
    "scope_type" TEXT NOT NULL,
    "scope_id" TEXT,
    "config_json" TEXT NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);
INSERT INTO "new_config_entry" ("config_json", "created_at", "engine_id", "id", "schema_version", "scope_id", "scope_type", "updated_at") SELECT "config_json", "created_at", "engine_id", "id", "schema_version", "scope_id", "scope_type", "updated_at" FROM "config_entry";
DROP TABLE "config_entry";
ALTER TABLE "new_config_entry" RENAME TO "config_entry";
CREATE INDEX "idx_ce_engine" ON "config_entry"("engine_id");
CREATE UNIQUE INDEX "config_entry_engine_id_scope_type_scope_id_key" ON "config_entry"("engine_id", "scope_type", "scope_id");
CREATE TABLE "new_context_layer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_id" TEXT NOT NULL,
    "layer_name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "token_count" INTEGER NOT NULL,
    "priority" REAL NOT NULL,
    "sources_json" TEXT NOT NULL DEFAULT '[]',
    "assembled_at" BIGINT NOT NULL
);
INSERT INTO "new_context_layer" ("assembled_at", "content", "conversation_id", "id", "layer_name", "priority", "sources_json", "token_count") SELECT "assembled_at", "content", "conversation_id", "id", "layer_name", "priority", "sources_json", "token_count" FROM "context_layer";
DROP TABLE "context_layer";
ALTER TABLE "new_context_layer" RENAME TO "context_layer";
CREATE INDEX "idx_clr_conv" ON "context_layer"("conversation_id");
CREATE INDEX "idx_clr_layer" ON "context_layer"("layer_name");
CREATE TABLE "new_conversation" (
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
INSERT INTO "new_conversation" ("context_json", "created_at", "external_id", "id", "import_job_id", "last_message_at", "message_count", "project_id", "provider_id", "provider_session_id", "source", "state", "title", "topic_id", "updated_at") SELECT "context_json", "created_at", "external_id", "id", "import_job_id", "last_message_at", "message_count", "project_id", "provider_id", "provider_session_id", "source", "state", "title", "topic_id", "updated_at" FROM "conversation";
DROP TABLE "conversation";
ALTER TABLE "new_conversation" RENAME TO "conversation";
CREATE INDEX "idx_conv_session" ON "conversation"("provider_session_id");
CREATE INDEX "idx_conv_provider" ON "conversation"("provider_id");
CREATE INDEX "conversation_source_idx" ON "conversation"("source");
CREATE INDEX "conversation_external_id_idx" ON "conversation"("external_id");
CREATE INDEX "conversation_import_job_id_idx" ON "conversation"("import_job_id");
CREATE TABLE "new_conversation_message" (
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
    CONSTRAINT "conversation_message_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "conversation_message_parent_message_id_fkey" FOREIGN KEY ("parent_message_id") REFERENCES "conversation_message" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_conversation_message" ("block_count", "blocks_json", "content", "conversation_id", "created_at", "id", "latency_ms", "metadata_json", "model", "parent_message_id", "role", "sequence_index", "token_count") SELECT "block_count", "blocks_json", "content", "conversation_id", "created_at", "id", "latency_ms", "metadata_json", "model", "parent_message_id", "role", "sequence_index", "token_count" FROM "conversation_message";
DROP TABLE "conversation_message";
ALTER TABLE "new_conversation_message" RENAME TO "conversation_message";
CREATE INDEX "idx_cm_conv" ON "conversation_message"("conversation_id", "sequence_index");
CREATE TABLE "new_conversation_topic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 0.5,
    "assigned_at" BIGINT NOT NULL,
    "assigned_by" TEXT NOT NULL DEFAULT 'auto'
);
INSERT INTO "new_conversation_topic" ("assigned_at", "assigned_by", "confidence", "conversation_id", "id", "topic_id") SELECT "assigned_at", "assigned_by", "confidence", "conversation_id", "id", "topic_id" FROM "conversation_topic";
DROP TABLE "conversation_topic";
ALTER TABLE "new_conversation_topic" RENAME TO "conversation_topic";
CREATE UNIQUE INDEX "conversation_topic_conversation_id_topic_id_key" ON "conversation_topic"("conversation_id", "topic_id");
CREATE TABLE "new_decision_record" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "decision_text" TEXT NOT NULL,
    "rationale" TEXT,
    "alternatives_json" TEXT NOT NULL DEFAULT '[]',
    "confidence" REAL NOT NULL DEFAULT 0.5,
    "ts" BIGINT NOT NULL
);
INSERT INTO "new_decision_record" ("alternatives_json", "confidence", "conversation_id", "decision_text", "id", "message_id", "rationale", "ts") SELECT "alternatives_json", "confidence", "conversation_id", "decision_text", "id", "message_id", "rationale", "ts" FROM "decision_record";
DROP TABLE "decision_record";
ALTER TABLE "new_decision_record" RENAME TO "decision_record";
CREATE INDEX "decision_record_conversation_id_idx" ON "decision_record"("conversation_id");
CREATE TABLE "new_discovery_result" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "provider_id" TEXT,
    "approved_by" TEXT,
    "manifest_json" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" BIGINT NOT NULL
);
INSERT INTO "new_discovery_result" ("approved_by", "created_at", "id", "manifest_json", "provider_id", "session_id", "status") SELECT "approved_by", "created_at", "id", "manifest_json", "provider_id", "session_id", "status" FROM "discovery_result";
DROP TABLE "discovery_result";
ALTER TABLE "new_discovery_result" RENAME TO "discovery_result";
CREATE TABLE "new_discovery_session" (
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
INSERT INTO "new_discovery_session" ("capabilities_json", "confidence", "created_at", "error", "id", "interactive_json", "manifest_draft_json", "parser_format", "shape_id", "status", "updated_at", "url") SELECT "capabilities_json", "confidence", "created_at", "error", "id", "interactive_json", "manifest_draft_json", "parser_format", "shape_id", "status", "updated_at", "url" FROM "discovery_session";
DROP TABLE "discovery_session";
ALTER TABLE "new_discovery_session" RENAME TO "discovery_session";
CREATE TABLE "new_drift_event" (
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
INSERT INTO "new_drift_event" ("binding_id", "capability_id", "description", "detected_at", "drift_type", "id", "provider_id", "resolved", "resolved_at", "severity") SELECT "binding_id", "capability_id", "description", "detected_at", "drift_type", "id", "provider_id", "resolved", "resolved_at", "severity" FROM "drift_event";
DROP TABLE "drift_event";
ALTER TABLE "new_drift_event" RENAME TO "drift_event";
CREATE INDEX "idx_de_provider" ON "drift_event"("provider_id", "detected_at");
CREATE TABLE "new_entity" (
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
INSERT INTO "new_entity" ("confidence", "created_at", "description", "entity_type", "first_seen_at", "id", "last_seen_at", "mention_count", "name", "updated_at") SELECT "confidence", "created_at", "description", "entity_type", "first_seen_at", "id", "last_seen_at", "mention_count", "name", "updated_at" FROM "entity";
DROP TABLE "entity";
ALTER TABLE "new_entity" RENAME TO "entity";
CREATE INDEX "entity_entity_type_idx" ON "entity"("entity_type");
CREATE UNIQUE INDEX "entity_name_entity_type_key" ON "entity"("name", "entity_type");
CREATE TABLE "new_entity_mention" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 0.5,
    "ts" BIGINT NOT NULL,
    CONSTRAINT "entity_mention_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_entity_mention" ("confidence", "context", "conversation_id", "entity_id", "id", "message_id", "ts") SELECT "confidence", "context", "conversation_id", "entity_id", "id", "message_id", "ts" FROM "entity_mention";
DROP TABLE "entity_mention";
ALTER TABLE "new_entity_mention" RENAME TO "entity_mention";
CREATE INDEX "entity_mention_entity_id_idx" ON "entity_mention"("entity_id");
CREATE INDEX "entity_mention_conversation_id_idx" ON "entity_mention"("conversation_id");
CREATE TABLE "new_episodic_memory" (
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
INSERT INTO "new_episodic_memory" ("action", "capability_id", "created_at", "duration_ms", "id", "input_json", "output_json", "provider_id", "slave_id", "success", "tags_json", "timestamp") SELECT "action", "capability_id", "created_at", "duration_ms", "id", "input_json", "output_json", "provider_id", "slave_id", "success", "tags_json", "timestamp" FROM "episodic_memory";
DROP TABLE "episodic_memory";
ALTER TABLE "new_episodic_memory" RENAME TO "episodic_memory";
CREATE TABLE "new_failure_classification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "outcome_id" TEXT NOT NULL,
    "failure_type" TEXT NOT NULL,
    "is_recoverable" INTEGER NOT NULL DEFAULT 0,
    "suggested_action" TEXT,
    "ts" BIGINT NOT NULL,
    CONSTRAINT "failure_classification_outcome_id_fkey" FOREIGN KEY ("outcome_id") REFERENCES "outcome" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_failure_classification" ("failure_type", "id", "is_recoverable", "outcome_id", "suggested_action", "ts") SELECT "failure_type", "id", "is_recoverable", "outcome_id", "suggested_action", "ts" FROM "failure_classification";
DROP TABLE "failure_classification";
ALTER TABLE "new_failure_classification" RENAME TO "failure_classification";
CREATE TABLE "new_fleet_event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slave_id" TEXT NOT NULL,
    "provider_id" TEXT,
    "event_type" TEXT NOT NULL,
    "event_data_json" TEXT NOT NULL DEFAULT '{}',
    "ts" BIGINT NOT NULL,
    CONSTRAINT "fleet_event_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_fleet_event" ("event_data_json", "event_type", "id", "provider_id", "slave_id", "ts") SELECT "event_data_json", "event_type", "id", "provider_id", "slave_id", "ts" FROM "fleet_event";
DROP TABLE "fleet_event";
ALTER TABLE "new_fleet_event" RENAME TO "fleet_event";
CREATE INDEX "idx_fe_slave" ON "fleet_event"("slave_id", "ts");
CREATE INDEX "idx_fe_provider" ON "fleet_event"("provider_id", "ts");
CREATE TABLE "new_harness_checkpoint" (
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
INSERT INTO "new_harness_checkpoint" ("active_dag_json", "auth_state", "conversation_id", "created_at", "dag_position", "id", "loaded_modules_json", "page_title", "page_url", "slave_id") SELECT "active_dag_json", "auth_state", "conversation_id", "created_at", "dag_position", "id", "loaded_modules_json", "page_title", "page_url", "slave_id" FROM "harness_checkpoint";
DROP TABLE "harness_checkpoint";
ALTER TABLE "new_harness_checkpoint" RENAME TO "harness_checkpoint";
CREATE INDEX "idx_hc_slave" ON "harness_checkpoint"("slave_id", "created_at");
CREATE INDEX "idx_hc_conv" ON "harness_checkpoint"("conversation_id");
CREATE TABLE "new_health_tick" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "slave_id" TEXT,
    "status" TEXT NOT NULL,
    "response_ms" INTEGER,
    "error" TEXT,
    "ts" BIGINT NOT NULL,
    CONSTRAINT "health_tick_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_health_tick" ("error", "id", "provider_id", "response_ms", "slave_id", "status", "ts") SELECT "error", "id", "provider_id", "response_ms", "slave_id", "status", "ts" FROM "health_tick";
DROP TABLE "health_tick";
ALTER TABLE "new_health_tick" RENAME TO "health_tick";
CREATE INDEX "idx_ht_provider" ON "health_tick"("provider_id", "ts");
CREATE TABLE "new_hitl_gate" (
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
INSERT INTO "new_hitl_gate" ("created_at", "default_value", "expires_at", "gate_type", "id", "options_json", "prompt", "resolved_at", "resolved_by", "response", "status", "step_id", "task_id") SELECT "created_at", "default_value", "expires_at", "gate_type", "id", "options_json", "prompt", "resolved_at", "resolved_by", "response", "status", "step_id", "task_id" FROM "hitl_gate";
DROP TABLE "hitl_gate";
ALTER TABLE "new_hitl_gate" RENAME TO "hitl_gate";
CREATE INDEX "idx_hg_task_status" ON "hitl_gate"("task_id", "status");
CREATE INDEX "idx_hg_status" ON "hitl_gate"("status");
CREATE TABLE "new_hpe_session" (
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
INSERT INTO "new_hpe_session" ("actions", "agent_id", "completed_at", "created_at", "id", "prompt", "response", "started_at", "status") SELECT "actions", "agent_id", "completed_at", "created_at", "id", "prompt", "response", "started_at", "status" FROM "hpe_session";
DROP TABLE "hpe_session";
ALTER TABLE "new_hpe_session" RENAME TO "hpe_session";
CREATE INDEX "idx_hs_agent" ON "hpe_session"("agent_id", "started_at");
CREATE TABLE "new_import_job" (
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
INSERT INTO "new_import_job" ("completed_at", "config_json", "error", "file_path", "id", "import_source", "result_json", "started_at", "status") SELECT "completed_at", "config_json", "error", "file_path", "id", "import_source", "result_json", "started_at", "status" FROM "import_job";
DROP TABLE "import_job";
ALTER TABLE "new_import_job" RENAME TO "import_job";
CREATE INDEX "import_job_import_source_idx" ON "import_job"("import_source");
CREATE TABLE "new_kernel_events" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kind" TEXT NOT NULL,
    "engine_id" TEXT,
    "data" TEXT,
    "created_at" BIGINT NOT NULL DEFAULT 0
);
INSERT INTO "new_kernel_events" ("created_at", "data", "engine_id", "id", "kind") SELECT "created_at", "data", "engine_id", "id", "kind" FROM "kernel_events";
DROP TABLE "kernel_events";
ALTER TABLE "new_kernel_events" RENAME TO "kernel_events";
CREATE INDEX "idx_kernel_events_kind" ON "kernel_events"("kind");
CREATE INDEX "idx_kernel_events_time" ON "kernel_events"("created_at");
CREATE TABLE "new_kernel_spans" (
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
INSERT INTO "new_kernel_spans" ("attrs", "created_at", "duration", "end_time", "engine_id", "error", "id", "name", "parent_id", "start_time", "status", "trace_id") SELECT "attrs", "created_at", "duration", "end_time", "engine_id", "error", "id", "name", "parent_id", "start_time", "status", "trace_id" FROM "kernel_spans";
DROP TABLE "kernel_spans";
ALTER TABLE "new_kernel_spans" RENAME TO "kernel_spans";
CREATE INDEX "idx_kernel_spans_trace" ON "kernel_spans"("trace_id");
CREATE INDEX "idx_kernel_spans_engine" ON "kernel_spans"("engine_id");
CREATE INDEX "idx_kernel_spans_time" ON "kernel_spans"("start_time");
CREATE TABLE "new_kernel_topology" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "snapshot" TEXT NOT NULL,
    "created_at" BIGINT NOT NULL
);
INSERT INTO "new_kernel_topology" ("created_at", "id", "snapshot") SELECT "created_at", "id", "snapshot" FROM "kernel_topology";
DROP TABLE "kernel_topology";
ALTER TABLE "new_kernel_topology" RENAME TO "kernel_topology";
CREATE TABLE "new_learning_event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "capability_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "data_json" TEXT NOT NULL DEFAULT '{}',
    "ts" BIGINT NOT NULL,
    CONSTRAINT "learning_event_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "learning_event_capability_id_fkey" FOREIGN KEY ("capability_id") REFERENCES "capability_taxonomy" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_learning_event" ("capability_id", "data_json", "event_type", "id", "provider_id", "ts") SELECT "capability_id", "data_json", "event_type", "id", "provider_id", "ts" FROM "learning_event";
DROP TABLE "learning_event";
ALTER TABLE "new_learning_event" RENAME TO "learning_event";
CREATE TABLE "new_manifest_change_log" (
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
INSERT INTO "new_manifest_change_log" ("actor", "change_type", "file_path", "id", "manifest_version_id", "new_hash", "old_hash", "provider_id", "rows_added", "rows_modified", "rows_removed", "tables_affected_json", "ts") SELECT "actor", "change_type", "file_path", "id", "manifest_version_id", "new_hash", "old_hash", "provider_id", "rows_added", "rows_modified", "rows_removed", "tables_affected_json", "ts" FROM "manifest_change_log";
DROP TABLE "manifest_change_log";
ALTER TABLE "new_manifest_change_log" RENAME TO "manifest_change_log";
CREATE INDEX "idx_mcl_provider" ON "manifest_change_log"("provider_id", "ts");
CREATE INDEX "idx_mcl_type" ON "manifest_change_log"("change_type");
CREATE INDEX "idx_mcl_ts" ON "manifest_change_log"("ts");
CREATE TABLE "new_manifest_drift" (
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
INSERT INTO "new_manifest_drift" ("db_value", "detected_at", "drift_type", "id", "provider_id", "record_id", "resolved", "resolved_at", "resolved_by_actor", "seed_value", "table_name") SELECT "db_value", "detected_at", "drift_type", "id", "provider_id", "record_id", "resolved", "resolved_at", "resolved_by_actor", "seed_value", "table_name" FROM "manifest_drift";
DROP TABLE "manifest_drift";
ALTER TABLE "new_manifest_drift" RENAME TO "manifest_drift";
CREATE INDEX "idx_md_provider" ON "manifest_drift"("provider_id", "resolved", "detected_at");
CREATE TABLE "new_mcp_server_config" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "enabled" INTEGER NOT NULL DEFAULT 0,
    "port" INTEGER NOT NULL DEFAULT 0,
    "tools_json" TEXT NOT NULL DEFAULT '[]',
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);
INSERT INTO "new_mcp_server_config" ("created_at", "enabled", "id", "name", "port", "tools_json", "updated_at") SELECT "created_at", "enabled", "id", "name", "port", "tools_json", "updated_at" FROM "mcp_server_config";
DROP TABLE "mcp_server_config";
ALTER TABLE "new_mcp_server_config" RENAME TO "mcp_server_config";
CREATE UNIQUE INDEX "mcp_server_config_name_key" ON "mcp_server_config"("name");
CREATE TABLE "new_mcp_tool" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "server_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "input_schema_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" BIGINT NOT NULL
);
INSERT INTO "new_mcp_tool" ("created_at", "description", "id", "input_schema_json", "name", "server_id") SELECT "created_at", "description", "id", "input_schema_json", "name", "server_id" FROM "mcp_tool";
DROP TABLE "mcp_tool";
ALTER TABLE "new_mcp_tool" RENAME TO "mcp_tool";
CREATE TABLE "new_mcp_tool_call" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "server_id" TEXT NOT NULL,
    "tool_name" TEXT NOT NULL,
    "input_json" TEXT NOT NULL,
    "output_json" TEXT,
    "success" BOOLEAN NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "created_at" BIGINT NOT NULL
);
INSERT INTO "new_mcp_tool_call" ("created_at", "duration_ms", "id", "input_json", "output_json", "server_id", "success", "tool_name") SELECT "created_at", "duration_ms", "id", "input_json", "output_json", "server_id", "success", "tool_name" FROM "mcp_tool_call";
DROP TABLE "mcp_tool_call";
ALTER TABLE "new_mcp_tool_call" RENAME TO "mcp_tool_call";
CREATE TABLE "new_memory_curated" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memory_type" TEXT NOT NULL,
    "memory_id" TEXT NOT NULL,
    "curated_by" TEXT NOT NULL DEFAULT 'user',
    "is_verified" INTEGER NOT NULL DEFAULT 1,
    "is_pinned" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "curated_at" BIGINT NOT NULL
);
INSERT INTO "new_memory_curated" ("curated_at", "curated_by", "id", "is_pinned", "is_verified", "memory_id", "memory_type", "note") SELECT "curated_at", "curated_by", "id", "is_pinned", "is_verified", "memory_id", "memory_type", "note" FROM "memory_curated";
DROP TABLE "memory_curated";
ALTER TABLE "new_memory_curated" RENAME TO "memory_curated";
CREATE UNIQUE INDEX "memory_curated_memory_type_memory_id_key" ON "memory_curated"("memory_type", "memory_id");
CREATE TABLE "new_memory_embedding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "embedding" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "dimensions" INTEGER NOT NULL,
    "content_hash" TEXT NOT NULL,
    "created_at" BIGINT NOT NULL
);
INSERT INTO "new_memory_embedding" ("content_hash", "created_at", "dimensions", "embedding", "entity_id", "entity_type", "id", "model") SELECT "content_hash", "created_at", "dimensions", "embedding", "entity_id", "entity_type", "id", "model" FROM "memory_embedding";
DROP TABLE "memory_embedding";
ALTER TABLE "new_memory_embedding" RENAME TO "memory_embedding";
CREATE UNIQUE INDEX "memory_embedding_entity_type_entity_id_key" ON "memory_embedding"("entity_type", "entity_id");
CREATE TABLE "new_memory_feedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memory_type" TEXT NOT NULL,
    "memory_id" TEXT NOT NULL,
    "feedback" TEXT NOT NULL,
    "correction" TEXT,
    "user_id" TEXT NOT NULL DEFAULT 'default',
    "ts" BIGINT NOT NULL
);
INSERT INTO "new_memory_feedback" ("correction", "feedback", "id", "memory_id", "memory_type", "ts", "user_id") SELECT "correction", "feedback", "id", "memory_id", "memory_type", "ts", "user_id" FROM "memory_feedback";
DROP TABLE "memory_feedback";
ALTER TABLE "new_memory_feedback" RENAME TO "memory_feedback";
CREATE INDEX "idx_mf_memory" ON "memory_feedback"("memory_type", "memory_id");
CREATE TABLE "new_migration_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "applied_at" BIGINT NOT NULL
);
INSERT INTO "new_migration_log" ("applied_at", "checksum", "filename", "id") SELECT "applied_at", "checksum", "filename", "id" FROM "migration_log";
DROP TABLE "migration_log";
ALTER TABLE "new_migration_log" RENAME TO "migration_log";
CREATE TABLE "new_mirror_state" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_id" TEXT NOT NULL,
    "chrome_state_json" TEXT,
    "ui_state_json" TEXT,
    "pending_ops_json" TEXT,
    "last_sync_at" BIGINT NOT NULL,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);
INSERT INTO "new_mirror_state" ("chrome_state_json", "conversation_id", "created_at", "id", "last_sync_at", "pending_ops_json", "ui_state_json", "updated_at") SELECT "chrome_state_json", "conversation_id", "created_at", "id", "last_sync_at", "pending_ops_json", "ui_state_json", "updated_at" FROM "mirror_state";
DROP TABLE "mirror_state";
ALTER TABLE "new_mirror_state" RENAME TO "mirror_state";
CREATE UNIQUE INDEX "mirror_state_conversation_id_key" ON "mirror_state"("conversation_id");
CREATE TABLE "new_mux_response" (
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
INSERT INTO "new_mux_response" ("account_id", "cost_cents", "error", "id", "latency_ms", "mux_session_id", "ok", "provider_id", "response", "ts") SELECT "account_id", "cost_cents", "error", "id", "latency_ms", "mux_session_id", "ok", "provider_id", "response", "ts" FROM "mux_response";
DROP TABLE "mux_response";
ALTER TABLE "new_mux_response" RENAME TO "mux_response";
CREATE INDEX "idx_mr_session" ON "mux_response"("mux_session_id");
CREATE INDEX "idx_mr_provider" ON "mux_response"("provider_id");
CREATE TABLE "new_mux_session" (
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
INSERT INTO "new_mux_session" ("best_provider_id", "completed_at", "conversation_id", "id", "message", "started_at", "status", "strategy", "synthesized_response", "total_cost_cents", "total_latency_ms") SELECT "best_provider_id", "completed_at", "conversation_id", "id", "message", "started_at", "status", "strategy", "synthesized_response", "total_cost_cents", "total_latency_ms" FROM "mux_session";
DROP TABLE "mux_session";
ALTER TABLE "new_mux_session" RENAME TO "mux_session";
CREATE INDEX "idx_ms_conv" ON "mux_session"("conversation_id");
CREATE INDEX "idx_ms_status" ON "mux_session"("status");
CREATE TABLE "new_nlcl_graph_edges" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "from_id" TEXT NOT NULL,
    "to_id" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "weight" REAL NOT NULL DEFAULT 1,
    "data_json" TEXT,
    "created_at" BIGINT NOT NULL DEFAULT 0
);
INSERT INTO "new_nlcl_graph_edges" ("created_at", "data_json", "from_id", "id", "relation", "to_id", "weight") SELECT "created_at", "data_json", "from_id", "id", "relation", "to_id", "weight" FROM "nlcl_graph_edges";
DROP TABLE "nlcl_graph_edges";
ALTER TABLE "new_nlcl_graph_edges" RENAME TO "nlcl_graph_edges";
CREATE INDEX "idx_nlcl_edges_from" ON "nlcl_graph_edges"("from_id");
CREATE INDEX "idx_nlcl_edges_to" ON "nlcl_graph_edges"("to_id");
CREATE INDEX "idx_nlcl_edges_rel" ON "nlcl_graph_edges"("relation");
CREATE TABLE "new_nlcl_graph_nodes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "data_json" TEXT,
    "created_at" BIGINT NOT NULL DEFAULT 0
);
INSERT INTO "new_nlcl_graph_nodes" ("created_at", "data_json", "id", "kind", "label") SELECT "created_at", "data_json", "id", "kind", "label" FROM "nlcl_graph_nodes";
DROP TABLE "nlcl_graph_nodes";
ALTER TABLE "new_nlcl_graph_nodes" RENAME TO "nlcl_graph_nodes";
CREATE INDEX "idx_nlcl_nodes_kind" ON "nlcl_graph_nodes"("kind");
CREATE INDEX "idx_nlcl_nodes_label" ON "nlcl_graph_nodes"("label");
CREATE TABLE "new_optimistic_update" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "expected_state_json" TEXT NOT NULL,
    "actual_state_json" TEXT,
    "confirmed" INTEGER NOT NULL DEFAULT 0,
    "created_at" BIGINT NOT NULL,
    "resolved_at" BIGINT
);
INSERT INTO "new_optimistic_update" ("action", "actual_state_json", "confirmed", "conversation_id", "created_at", "expected_state_json", "id", "resolved_at") SELECT "action", "actual_state_json", "confirmed", "conversation_id", "created_at", "expected_state_json", "id", "resolved_at" FROM "optimistic_update";
DROP TABLE "optimistic_update";
ALTER TABLE "new_optimistic_update" RENAME TO "optimistic_update";
CREATE TABLE "new_outcome" (
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
INSERT INTO "new_outcome" ("binding_id", "capability_id", "confidence", "duration_ms", "error", "id", "ok", "program_id", "provider_id", "selector_hit", "selector_strategy_id", "selector_used", "ts") SELECT "binding_id", "capability_id", "confidence", "duration_ms", "error", "id", "ok", "program_id", "provider_id", "selector_hit", "selector_strategy_id", "selector_used", "ts" FROM "outcome";
DROP TABLE "outcome";
ALTER TABLE "new_outcome" RENAME TO "outcome";
CREATE INDEX "idx_o_provider" ON "outcome"("provider_id", "ts");
CREATE INDEX "idx_o_cap" ON "outcome"("capability_id", "ts");
CREATE INDEX "idx_o_ok" ON "outcome"("ok", "ts");
CREATE INDEX "idx_o_ts" ON "outcome"("ts");
CREATE TABLE "new_pattern_extract" (
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
INSERT INTO "new_pattern_extract" ("confidence", "created_at", "description", "first_seen_at", "id", "last_seen_at", "name", "occurrences", "pattern_type", "updated_at") SELECT "confidence", "created_at", "description", "first_seen_at", "id", "last_seen_at", "name", "occurrences", "pattern_type", "updated_at" FROM "pattern_extract";
DROP TABLE "pattern_extract";
ALTER TABLE "new_pattern_extract" RENAME TO "pattern_extract";
CREATE UNIQUE INDEX "pattern_extract_name_pattern_type_key" ON "pattern_extract"("name", "pattern_type");
CREATE TABLE "new_plugin_registry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "capabilities_json" TEXT NOT NULL DEFAULT '[]',
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "loaded_at" BIGINT,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);
INSERT INTO "new_plugin_registry" ("capabilities_json", "created_at", "file_path", "id", "is_active", "loaded_at", "name", "updated_at", "version") SELECT "capabilities_json", "created_at", "file_path", "id", "is_active", "loaded_at", "name", "updated_at", "version" FROM "plugin_registry";
DROP TABLE "plugin_registry";
ALTER TABLE "new_plugin_registry" RENAME TO "plugin_registry";
CREATE UNIQUE INDEX "plugin_registry_name_key" ON "plugin_registry"("name");
CREATE TABLE "new_procedural_rule" (
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
INSERT INTO "new_procedural_rule" ("action", "condition", "confidence", "created_at", "failure_count", "id", "last_triggered", "name", "success_count", "updated_at") SELECT "action", "condition", "confidence", "created_at", "failure_count", "id", "last_triggered", "name", "success_count", "updated_at" FROM "procedural_rule";
DROP TABLE "procedural_rule";
ALTER TABLE "new_procedural_rule" RENAME TO "procedural_rule";
CREATE TABLE "new_profile_session" (
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
INSERT INTO "new_profile_session" ("chrome_slave_id", "created_at", "id", "port", "profile_dir", "provider_session_id", "state", "updated_at") SELECT "chrome_slave_id", "created_at", "id", "port", "profile_dir", "provider_session_id", "state", "updated_at" FROM "profile_session";
DROP TABLE "profile_session";
ALTER TABLE "new_profile_session" RENAME TO "profile_session";
CREATE INDEX "idx_prs_session" ON "profile_session"("provider_session_id");
CREATE TABLE "new_program_version_metric" (
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
INSERT INTO "new_program_version_metric" ("avg_latency_ms", "binding_id", "created_at", "fail_count", "first_executed_at", "id", "last_executed_at", "p50_latency_ms", "p95_latency_ms", "p99_latency_ms", "program_id", "program_version", "success_count", "total_executions", "updated_at", "window_1h_success", "window_1h_total", "window_24h_success", "window_24h_total", "window_7d_success", "window_7d_total") SELECT "avg_latency_ms", "binding_id", "created_at", "fail_count", "first_executed_at", "id", "last_executed_at", "p50_latency_ms", "p95_latency_ms", "p99_latency_ms", "program_id", "program_version", "success_count", "total_executions", "updated_at", "window_1h_success", "window_1h_total", "window_24h_success", "window_24h_total", "window_7d_success", "window_7d_total" FROM "program_version_metric";
DROP TABLE "program_version_metric";
ALTER TABLE "new_program_version_metric" RENAME TO "program_version_metric";
CREATE INDEX "idx_pvm_binding" ON "program_version_metric"("binding_id");
CREATE INDEX "idx_pvm_program" ON "program_version_metric"("program_id");
CREATE INDEX "idx_pvm_updated" ON "program_version_metric"("updated_at");
CREATE UNIQUE INDEX "program_version_metric_binding_id_program_id_program_version_key" ON "program_version_metric"("binding_id", "program_id", "program_version");
CREATE TABLE "new_project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "conversation_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);
INSERT INTO "new_project" ("conversation_count", "created_at", "description", "id", "name", "status", "updated_at") SELECT "conversation_count", "created_at", "description", "id", "name", "status", "updated_at" FROM "project";
DROP TABLE "project";
ALTER TABLE "new_project" RENAME TO "project";
CREATE TABLE "new_provider_account" (
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
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
    CONSTRAINT "provider_account_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_provider_account" ("chrome_slave_id", "created_at", "debug_port", "email", "id", "is_default", "is_kind", "last_login_at", "login_attempts", "login_state", "plan_tier", "profile_dir", "provider_id", "provider_state_json", "updated_at") SELECT "chrome_slave_id", "created_at", "debug_port", "email", "id", "is_default", "is_kind", "last_login_at", "login_attempts", "login_state", "plan_tier", "profile_dir", "provider_id", "provider_state_json", "updated_at" FROM "provider_account";
DROP TABLE "provider_account";
ALTER TABLE "new_provider_account" RENAME TO "provider_account";
CREATE INDEX "idx_pa_provider" ON "provider_account"("provider_id");
CREATE INDEX "idx_pa_email" ON "provider_account"("email");
CREATE INDEX "idx_pa_login" ON "provider_account"("login_state");
CREATE UNIQUE INDEX "provider_account_provider_id_email_key" ON "provider_account"("provider_id", "email");
CREATE TABLE "new_provider_archetype" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shape_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "manifest_json" TEXT NOT NULL,
    "is_default" INTEGER NOT NULL DEFAULT 0,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);
INSERT INTO "new_provider_archetype" ("created_at", "description", "id", "is_default", "manifest_json", "name", "shape_id", "updated_at") SELECT "created_at", "description", "id", "is_default", "manifest_json", "name", "shape_id", "updated_at" FROM "provider_archetype";
DROP TABLE "provider_archetype";
ALTER TABLE "new_provider_archetype" RENAME TO "provider_archetype";
CREATE TABLE "new_provider_capability" (
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
INSERT INTO "new_provider_capability" ("avg_latency_ms", "confidence", "consecutive_failures", "created_at", "data_flow_override", "depends_on_override_json", "existential_rule_override", "fail_count", "global_capability_id", "id", "interaction_mode_override", "last_used_at", "min_plan_tier_override", "mutation_effects_override_json", "p95_latency_ms", "provider_id", "recovery_behavior_override", "recovery_strategies_json", "selector_hit_count", "selector_last_error", "selector_last_miss_at", "selector_miss_count", "state_persistence_override", "success_count", "ui_component_override", "ui_group_override", "ui_icon_override", "ui_input_schema_override", "ui_label_override", "ui_order_override", "ui_position_override", "ui_priority_override", "ui_states_override_json", "ui_visibility_rule_override", "updated_at") SELECT "avg_latency_ms", "confidence", "consecutive_failures", "created_at", "data_flow_override", "depends_on_override_json", "existential_rule_override", "fail_count", "global_capability_id", "id", "interaction_mode_override", "last_used_at", "min_plan_tier_override", "mutation_effects_override_json", "p95_latency_ms", "provider_id", "recovery_behavior_override", "recovery_strategies_json", "selector_hit_count", "selector_last_error", "selector_last_miss_at", "selector_miss_count", "state_persistence_override", "success_count", "ui_component_override", "ui_group_override", "ui_icon_override", "ui_input_schema_override", "ui_label_override", "ui_order_override", "ui_position_override", "ui_priority_override", "ui_states_override_json", "ui_visibility_rule_override", "updated_at" FROM "provider_capability";
DROP TABLE "provider_capability";
ALTER TABLE "new_provider_capability" RENAME TO "provider_capability";
CREATE INDEX "idx_pc_provider" ON "provider_capability"("provider_id");
CREATE INDEX "idx_pc_cap" ON "provider_capability"("global_capability_id");
CREATE INDEX "idx_pc_confidence" ON "provider_capability"("provider_id", "confidence");
CREATE INDEX "idx_pc_selector" ON "provider_capability"("provider_id", "selector_hit_count");
CREATE UNIQUE INDEX "provider_capability_provider_id_global_capability_id_key" ON "provider_capability"("provider_id", "global_capability_id");
CREATE TABLE "new_provider_config" (
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
INSERT INTO "new_provider_config" ("config_key", "config_type", "config_value", "created_at", "id", "is_secret", "provider_id", "updated_at") SELECT "config_key", "config_type", "config_value", "created_at", "id", "is_secret", "provider_id", "updated_at" FROM "provider_config";
DROP TABLE "provider_config";
ALTER TABLE "new_provider_config" RENAME TO "provider_config";
CREATE UNIQUE INDEX "provider_config_provider_id_config_key_key" ON "provider_config"("provider_id", "config_key");
CREATE TABLE "new_provider_cost_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "cost_cents" INTEGER NOT NULL,
    "tokens_input" INTEGER NOT NULL DEFAULT 0,
    "tokens_output" INTEGER NOT NULL DEFAULT 0,
    "model" TEXT,
    "ts" BIGINT NOT NULL
);
INSERT INTO "new_provider_cost_log" ("cost_cents", "id", "model", "provider_id", "tokens_input", "tokens_output", "ts") SELECT "cost_cents", "id", "model", "provider_id", "tokens_input", "tokens_output", "ts" FROM "provider_cost_log";
DROP TABLE "provider_cost_log";
ALTER TABLE "new_provider_cost_log" RENAME TO "provider_cost_log";
CREATE INDEX "idx_pcl_provider" ON "provider_cost_log"("provider_id", "ts");
CREATE TABLE "new_provider_definition" (
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
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);
INSERT INTO "new_provider_definition" ("auth_type", "capabilities_json", "category", "created_at", "description", "display_name", "documentation_url", "fleet_config_json", "has_multi_account", "id", "is_active", "models_json", "profile_strategy", "provider_type", "slug", "updated_at", "website_url") SELECT "auth_type", "capabilities_json", "category", "created_at", "description", "display_name", "documentation_url", "fleet_config_json", "has_multi_account", "id", "is_active", "models_json", "profile_strategy", "provider_type", "slug", "updated_at", "website_url" FROM "provider_definition";
DROP TABLE "provider_definition";
ALTER TABLE "new_provider_definition" RENAME TO "provider_definition";
CREATE UNIQUE INDEX "provider_definition_slug_key" ON "provider_definition"("slug");
CREATE TABLE "new_provider_endpoint" (
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
INSERT INTO "new_provider_endpoint" ("composer_type", "content_editable", "created_at", "endpoint_type", "id", "is_default", "label", "provider_id", "selectors_json", "send_method", "updated_at", "url") SELECT "composer_type", "content_editable", "created_at", "endpoint_type", "id", "is_default", "label", "provider_id", "selectors_json", "send_method", "updated_at", "url" FROM "provider_endpoint";
DROP TABLE "provider_endpoint";
ALTER TABLE "new_provider_endpoint" RENAME TO "provider_endpoint";
CREATE INDEX "idx_pe_provider" ON "provider_endpoint"("provider_id");
CREATE TABLE "new_provider_health" (
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
INSERT INTO "new_provider_health" ("circuit_open", "created_at", "drift_recent", "drift_unresolved", "fleet_error", "fleet_running", "fleet_stopped", "id", "last_check_at", "overall_score", "overall_status", "parser_confidence_avg", "provider_id", "selector_hit_rate_avg", "signals_json", "updated_at") SELECT "circuit_open", "created_at", "drift_recent", "drift_unresolved", "fleet_error", "fleet_running", "fleet_stopped", "id", "last_check_at", "overall_score", "overall_status", "parser_confidence_avg", "provider_id", "selector_hit_rate_avg", "signals_json", "updated_at" FROM "provider_health";
DROP TABLE "provider_health";
ALTER TABLE "new_provider_health" RENAME TO "provider_health";
CREATE UNIQUE INDEX "provider_health_provider_id_key" ON "provider_health"("provider_id");
CREATE TABLE "new_provider_health_history" (
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
INSERT INTO "new_provider_health_history" ("active_sessions", "avg_response_latency_ms", "capability_executions", "capability_failures", "capability_successes", "circuit_breaker_state", "drift_events_unresolved", "error_count", "fleet_restarts", "id", "p50_response_latency_ms", "p95_response_latency_ms", "p99_response_latency_ms", "parser_confidence_avg", "provider_id", "runtime_state", "schema_version", "selector_hit_rate_avg", "snapshot_ts", "total_conversations", "total_messages", "window_end_ts", "window_start_ts") SELECT "active_sessions", "avg_response_latency_ms", "capability_executions", "capability_failures", "capability_successes", "circuit_breaker_state", "drift_events_unresolved", "error_count", "fleet_restarts", "id", "p50_response_latency_ms", "p95_response_latency_ms", "p99_response_latency_ms", "parser_confidence_avg", "provider_id", "runtime_state", "schema_version", "selector_hit_rate_avg", "snapshot_ts", "total_conversations", "total_messages", "window_end_ts", "window_start_ts" FROM "provider_health_history";
DROP TABLE "provider_health_history";
ALTER TABLE "new_provider_health_history" RENAME TO "provider_health_history";
CREATE INDEX "idx_phh_provider" ON "provider_health_history"("provider_id", "snapshot_ts");
CREATE INDEX "idx_phh_window" ON "provider_health_history"("window_start_ts", "window_end_ts");
CREATE TABLE "new_provider_latency_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "capability_id" TEXT,
    "ts" BIGINT NOT NULL
);
INSERT INTO "new_provider_latency_log" ("capability_id", "id", "latency_ms", "provider_id", "ts") SELECT "capability_id", "id", "latency_ms", "provider_id", "ts" FROM "provider_latency_log";
DROP TABLE "provider_latency_log";
ALTER TABLE "new_provider_latency_log" RENAME TO "provider_latency_log";
CREATE INDEX "idx_pll_provider" ON "provider_latency_log"("provider_id", "ts");
CREATE TABLE "new_provider_manifest_version" (
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
INSERT INTO "new_provider_manifest_version" ("actor", "change_summary", "content_json", "created_at", "hash", "id", "manifest_file", "provider_id", "version") SELECT "actor", "change_summary", "content_json", "created_at", "hash", "id", "manifest_file", "provider_id", "version" FROM "provider_manifest_version";
DROP TABLE "provider_manifest_version";
ALTER TABLE "new_provider_manifest_version" RENAME TO "provider_manifest_version";
CREATE INDEX "idx_pmv_provider" ON "provider_manifest_version"("provider_id", "version");
CREATE UNIQUE INDEX "provider_manifest_version_provider_id_manifest_file_version_key" ON "provider_manifest_version"("provider_id", "manifest_file", "version");
CREATE TABLE "new_provider_model" (
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
INSERT INTO "new_provider_model" ("capabilities_json", "context_window", "created_at", "display_name", "id", "is_active", "is_default", "max_output_tokens", "model_slug", "pricing_input_per_1m", "pricing_output_per_1m", "provider_id", "supports_streaming", "supports_thinking", "supports_tools", "supports_vision", "updated_at") SELECT "capabilities_json", "context_window", "created_at", "display_name", "id", "is_active", "is_default", "max_output_tokens", "model_slug", "pricing_input_per_1m", "pricing_output_per_1m", "provider_id", "supports_streaming", "supports_thinking", "supports_tools", "supports_vision", "updated_at" FROM "provider_model";
DROP TABLE "provider_model";
ALTER TABLE "new_provider_model" RENAME TO "provider_model";
CREATE UNIQUE INDEX "provider_model_provider_id_model_slug_key" ON "provider_model"("provider_id", "model_slug");
CREATE TABLE "new_provider_parser" (
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
INSERT INTO "new_provider_parser" ("created_at", "fallback_parser_id", "id", "is_active", "parser_file_path", "parser_hash", "parser_logic_code", "parser_logic_type", "parser_name", "parser_version", "provider_id", "updated_at") SELECT "created_at", "fallback_parser_id", "id", "is_active", "parser_file_path", "parser_hash", "parser_logic_code", "parser_logic_type", "parser_name", "parser_version", "provider_id", "updated_at" FROM "provider_parser";
DROP TABLE "provider_parser";
ALTER TABLE "new_provider_parser" RENAME TO "provider_parser";
CREATE INDEX "idx_pp_provider" ON "provider_parser"("provider_id");
CREATE TABLE "new_provider_session" (
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
INSERT INTO "new_provider_session" ("account_id", "context_json", "created_at", "id", "provider_id", "state", "updated_at", "vivim_session_id") SELECT "account_id", "context_json", "created_at", "id", "provider_id", "state", "updated_at", "vivim_session_id" FROM "provider_session";
DROP TABLE "provider_session";
ALTER TABLE "new_provider_session" RENAME TO "provider_session";
CREATE INDEX "idx_ps_session" ON "provider_session"("vivim_session_id");
CREATE TABLE "new_provider_shape_binding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "archetype_id" TEXT NOT NULL,
    "shape_id" TEXT NOT NULL,
    "config_json" TEXT,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "created_at" BIGINT NOT NULL
);
INSERT INTO "new_provider_shape_binding" ("archetype_id", "config_json", "created_at", "id", "is_active", "provider_id", "shape_id") SELECT "archetype_id", "config_json", "created_at", "id", "is_active", "provider_id", "shape_id" FROM "provider_shape_binding";
DROP TABLE "provider_shape_binding";
ALTER TABLE "new_provider_shape_binding" RENAME TO "provider_shape_binding";
CREATE TABLE "new_provider_stream_config" (
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
INSERT INTO "new_provider_stream_config" ("completion_detectors_json", "content_type", "created_at", "delta_path_json", "harness_js", "id", "is_active", "provider_id", "sse_format", "stream_terminal_json", "stream_transport", "superseded_by", "updated_at", "version") SELECT "completion_detectors_json", "content_type", "created_at", "delta_path_json", "harness_js", "id", "is_active", "provider_id", "sse_format", "stream_terminal_json", "stream_transport", "superseded_by", "updated_at", "version" FROM "provider_stream_config";
DROP TABLE "provider_stream_config";
ALTER TABLE "new_provider_stream_config" RENAME TO "provider_stream_config";
CREATE INDEX "idx_psc_provider" ON "provider_stream_config"("provider_id");
CREATE INDEX "idx_psc_transport" ON "provider_stream_config"("stream_transport");
CREATE UNIQUE INDEX "provider_stream_config_provider_id_stream_transport_version_key" ON "provider_stream_config"("provider_id", "stream_transport", "version");
CREATE TABLE "new_registration_event" (
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
INSERT INTO "new_registration_event" ("actor", "change_summary", "event_type", "field_name", "from_value", "id", "manifest_version_id", "provider_id", "record_id", "table_name", "to_value", "ts") SELECT "actor", "change_summary", "event_type", "field_name", "from_value", "id", "manifest_version_id", "provider_id", "record_id", "table_name", "to_value", "ts" FROM "registration_event";
DROP TABLE "registration_event";
ALTER TABLE "new_registration_event" RENAME TO "registration_event";
CREATE INDEX "idx_re_provider" ON "registration_event"("provider_id", "ts");
CREATE INDEX "idx_re_type" ON "registration_event"("event_type");
CREATE INDEX "idx_re_table" ON "registration_event"("table_name");
CREATE TABLE "new_route_event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "route_request_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_data_json" TEXT NOT NULL DEFAULT '{}',
    "ts" BIGINT NOT NULL,
    CONSTRAINT "route_event_route_request_id_fkey" FOREIGN KEY ("route_request_id") REFERENCES "route_request" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_route_event" ("event_data_json", "event_type", "id", "route_request_id", "ts") SELECT "event_data_json", "event_type", "id", "route_request_id", "ts" FROM "route_event";
DROP TABLE "route_event";
ALTER TABLE "new_route_event" RENAME TO "route_event";
CREATE TABLE "new_route_request" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "route_spec_id" TEXT NOT NULL,
    "conversation_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result_json" TEXT,
    "ts" BIGINT NOT NULL,
    CONSTRAINT "route_request_route_spec_id_fkey" FOREIGN KEY ("route_spec_id") REFERENCES "route_spec" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_route_request" ("conversation_id", "id", "result_json", "route_spec_id", "status", "ts") SELECT "conversation_id", "id", "result_json", "route_spec_id", "status", "ts" FROM "route_request";
DROP TABLE "route_request";
ALTER TABLE "new_route_request" RENAME TO "route_request";
CREATE TABLE "new_route_spec" (
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
INSERT INTO "new_route_spec" ("capability_id", "config_json", "created_at", "id", "is_active", "name", "provider_id", "updated_at") SELECT "capability_id", "config_json", "created_at", "id", "is_active", "name", "provider_id", "updated_at" FROM "route_spec";
DROP TABLE "route_spec";
ALTER TABLE "new_route_spec" RENAME TO "route_spec";
CREATE TABLE "new_route_target" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "route_spec_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "account_id" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "created_at" BIGINT NOT NULL,
    CONSTRAINT "route_target_route_spec_id_fkey" FOREIGN KEY ("route_spec_id") REFERENCES "route_spec" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_route_target" ("account_id", "created_at", "id", "is_active", "priority", "provider_id", "route_spec_id") SELECT "account_id", "created_at", "id", "is_active", "priority", "provider_id", "route_spec_id" FROM "route_target";
DROP TABLE "route_target";
ALTER TABLE "new_route_target" RENAME TO "route_target";
CREATE TABLE "new_routing_preference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "capability_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "score" REAL NOT NULL DEFAULT 0.5,
    "sample_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" BIGINT NOT NULL
);
INSERT INTO "new_routing_preference" ("capability_id", "id", "provider_id", "sample_count", "score", "updated_at") SELECT "capability_id", "id", "provider_id", "sample_count", "score", "updated_at" FROM "routing_preference";
DROP TABLE "routing_preference";
ALTER TABLE "new_routing_preference" RENAME TO "routing_preference";
CREATE INDEX "idx_rp_cap" ON "routing_preference"("capability_id");
CREATE UNIQUE INDEX "routing_preference_capability_id_provider_id_key" ON "routing_preference"("capability_id", "provider_id");
CREATE TABLE "new_rule" (
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
INSERT INTO "new_rule" ("action_json", "condition_json", "confidence", "created_at", "id", "is_active", "name", "rule_type", "updated_at") SELECT "action_json", "condition_json", "confidence", "created_at", "id", "is_active", "name", "rule_type", "updated_at" FROM "rule";
DROP TABLE "rule";
ALTER TABLE "new_rule" RENAME TO "rule";
CREATE TABLE "new_sandbox_audit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "handler_slug" TEXT NOT NULL,
    "ok" INTEGER NOT NULL,
    "error" TEXT,
    "permissions_json" TEXT NOT NULL,
    "ts" BIGINT NOT NULL
);
INSERT INTO "new_sandbox_audit" ("error", "handler_slug", "id", "ok", "permissions_json", "ts") SELECT "error", "handler_slug", "id", "ok", "permissions_json", "ts" FROM "sandbox_audit";
DROP TABLE "sandbox_audit";
ALTER TABLE "new_sandbox_audit" RENAME TO "sandbox_audit";
CREATE INDEX "idx_sa_handler" ON "sandbox_audit"("handler_slug", "ts");
CREATE TABLE "new_selector_health_history" (
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
INSERT INTO "new_selector_health_history" ("avg_duration_ms", "binding_id", "hit_count", "hit_rate", "id", "miss_count", "p95_duration_ms", "schema_version", "selector_strategy_id", "snapshot_ts", "window_end_ts", "window_start_ts") SELECT "avg_duration_ms", "binding_id", "hit_count", "hit_rate", "id", "miss_count", "p95_duration_ms", "schema_version", "selector_strategy_id", "snapshot_ts", "window_end_ts", "window_start_ts" FROM "selector_health_history";
DROP TABLE "selector_health_history";
ALTER TABLE "new_selector_health_history" RENAME TO "selector_health_history";
CREATE INDEX "idx_shh_selector" ON "selector_health_history"("selector_strategy_id", "snapshot_ts");
CREATE INDEX "idx_shh_binding" ON "selector_health_history"("binding_id", "snapshot_ts");
CREATE INDEX "idx_shh_window" ON "selector_health_history"("window_start_ts", "window_end_ts");
CREATE TABLE "new_selector_strategy" (
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
INSERT INTO "new_selector_strategy" ("capability_id", "created_at", "hit_count", "id", "is_active", "last_used_at", "miss_count", "name", "priority", "provider_id", "selector_value", "strategy_type", "updated_at") SELECT "capability_id", "created_at", "hit_count", "id", "is_active", "last_used_at", "miss_count", "name", "priority", "provider_id", "selector_value", "strategy_type", "updated_at" FROM "selector_strategy";
DROP TABLE "selector_strategy";
ALTER TABLE "new_selector_strategy" RENAME TO "selector_strategy";
CREATE INDEX "idx_ss_cap" ON "selector_strategy"("capability_id", "provider_id");
CREATE INDEX "idx_ss_provider" ON "selector_strategy"("provider_id");
CREATE TABLE "new_semantic_memory" (
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
INSERT INTO "new_semantic_memory" ("confidence", "created_at", "expires_at", "id", "object_json", "predicate", "source", "subject", "timestamp") SELECT "confidence", "created_at", "expires_at", "id", "object_json", "predicate", "source", "subject", "timestamp" FROM "semantic_memory";
DROP TABLE "semantic_memory";
ALTER TABLE "new_semantic_memory" RENAME TO "semantic_memory";
CREATE TABLE "new_session_checkpoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vivim_session_id" TEXT NOT NULL,
    "checkpoint_json" TEXT NOT NULL,
    "created_at" BIGINT NOT NULL,
    CONSTRAINT "session_checkpoint_vivim_session_id_fkey" FOREIGN KEY ("vivim_session_id") REFERENCES "vivim_session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_session_checkpoint" ("checkpoint_json", "created_at", "id", "vivim_session_id") SELECT "checkpoint_json", "created_at", "id", "vivim_session_id" FROM "session_checkpoint";
DROP TABLE "session_checkpoint";
ALTER TABLE "new_session_checkpoint" RENAME TO "session_checkpoint";
CREATE INDEX "idx_sc_session" ON "session_checkpoint"("vivim_session_id", "created_at");
CREATE TABLE "new_state_transition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "from_state" TEXT,
    "to_state" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "metadata_json" TEXT NOT NULL DEFAULT '{}',
    "ts" BIGINT NOT NULL
);
INSERT INTO "new_state_transition" ("entity_id", "entity_type", "from_state", "id", "metadata_json", "to_state", "trigger", "ts") SELECT "entity_id", "entity_type", "from_state", "id", "metadata_json", "to_state", "trigger", "ts" FROM "state_transition";
DROP TABLE "state_transition";
ALTER TABLE "new_state_transition" RENAME TO "state_transition";
CREATE INDEX "idx_st_entity" ON "state_transition"("entity_type", "entity_id", "ts");
CREATE TABLE "new_stealth_launch_profile" (
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
INSERT INTO "new_stealth_launch_profile" ("attach_port", "chrome_args_json", "created_at", "extension_id", "extra_args_json", "id", "mode", "stealth_profile_id", "updated_at", "window_size_json") SELECT "attach_port", "chrome_args_json", "created_at", "extension_id", "extra_args_json", "id", "mode", "stealth_profile_id", "updated_at", "window_size_json" FROM "stealth_launch_profile";
DROP TABLE "stealth_launch_profile";
ALTER TABLE "new_stealth_launch_profile" RENAME TO "stealth_launch_profile";
CREATE TABLE "new_stealth_module_profile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "modules_json" TEXT NOT NULL DEFAULT '[]',
    "created_at" BIGINT NOT NULL DEFAULT 0,
    "updated_at" BIGINT NOT NULL DEFAULT 0
);
INSERT INTO "new_stealth_module_profile" ("created_at", "id", "modules_json", "name", "updated_at") SELECT "created_at", "id", "modules_json", "name", "updated_at" FROM "stealth_module_profile";
DROP TABLE "stealth_module_profile";
ALTER TABLE "new_stealth_module_profile" RENAME TO "stealth_module_profile";
CREATE TABLE "new_stream_block" (
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
INSERT INTO "new_stream_block" ("block_data", "block_index", "block_kind", "block_meta", "conversation_id", "created_at", "id", "message_id") SELECT "block_data", "block_index", "block_kind", "block_meta", "conversation_id", "created_at", "id", "message_id" FROM "stream_block";
DROP TABLE "stream_block";
ALTER TABLE "new_stream_block" RENAME TO "stream_block";
CREATE INDEX "idx_sb_conv" ON "stream_block"("conversation_id", "message_id", "block_index");
CREATE INDEX "idx_sb_message" ON "stream_block"("message_id");
CREATE INDEX "idx_sb_kind" ON "stream_block"("conversation_id", "block_kind");
CREATE UNIQUE INDEX "stream_block_conversation_id_message_id_block_index_key" ON "stream_block"("conversation_id", "message_id", "block_index");
CREATE TABLE "new_sync_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "device_id" TEXT NOT NULL,
    "table" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "data_json" TEXT NOT NULL,
    "ts" BIGINT NOT NULL,
    "synced_at" BIGINT
);
INSERT INTO "new_sync_log" ("data_json", "device_id", "id", "operation", "record_id", "synced_at", "table", "ts") SELECT "data_json", "device_id", "id", "operation", "record_id", "synced_at", "table", "ts" FROM "sync_log";
DROP TABLE "sync_log";
ALTER TABLE "new_sync_log" RENAME TO "sync_log";
CREATE INDEX "idx_sl_device" ON "sync_log"("device_id", "synced_at");
CREATE INDEX "idx_sl_record" ON "sync_log"("table", "record_id");
CREATE TABLE "new_sync_peer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "device_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "public_key" TEXT NOT NULL,
    "last_sync_at" BIGINT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paired_at" BIGINT
);
INSERT INTO "new_sync_peer" ("device_id", "id", "last_sync_at", "name", "paired_at", "public_key", "status") SELECT "device_id", "id", "last_sync_at", "name", "paired_at", "public_key", "status" FROM "sync_peer";
DROP TABLE "sync_peer";
ALTER TABLE "new_sync_peer" RENAME TO "sync_peer";
CREATE UNIQUE INDEX "sync_peer_device_id_key" ON "sync_peer"("device_id");
CREATE TABLE "new_telemetry_cycle_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schedule_name" TEXT NOT NULL,
    "rows_written" INTEGER NOT NULL DEFAULT 0,
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "ts" BIGINT NOT NULL
);
INSERT INTO "new_telemetry_cycle_log" ("duration_ms", "error", "id", "rows_written", "schedule_name", "ts") SELECT "duration_ms", "error", "id", "rows_written", "schedule_name", "ts" FROM "telemetry_cycle_log";
DROP TABLE "telemetry_cycle_log";
ALTER TABLE "new_telemetry_cycle_log" RENAME TO "telemetry_cycle_log";
CREATE INDEX "idx_tcl_schedule" ON "telemetry_cycle_log"("schedule_name", "ts");
CREATE TABLE "new_test_run" (
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
INSERT INTO "new_test_run" ("binding_id", "capability_id", "completed_at", "id", "provider_id", "result_json", "started_at", "status", "test_type") SELECT "binding_id", "capability_id", "completed_at", "id", "provider_id", "result_json", "started_at", "status", "test_type" FROM "test_run";
DROP TABLE "test_run";
ALTER TABLE "new_test_run" RENAME TO "test_run";
CREATE TABLE "new_token_budget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_id" TEXT NOT NULL,
    "total_budget" INTEGER NOT NULL,
    "layers_json" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "ts" BIGINT NOT NULL
);
INSERT INTO "new_token_budget" ("conversation_id", "id", "layers_json", "strategy", "total_budget", "ts") SELECT "conversation_id", "id", "layers_json", "strategy", "total_budget", "ts" FROM "token_budget";
DROP TABLE "token_budget";
ALTER TABLE "new_token_budget" RENAME TO "token_budget";
CREATE INDEX "idx_tb_conv" ON "token_budget"("conversation_id");
CREATE TABLE "new_topic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "conversation_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);
INSERT INTO "new_topic" ("color", "conversation_count", "created_at", "description", "id", "name", "updated_at") SELECT "color", "conversation_count", "created_at", "description", "id", "name", "updated_at" FROM "topic";
DROP TABLE "topic";
ALTER TABLE "new_topic" RENAME TO "topic";
CREATE TABLE "new_trace_entry" (
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
INSERT INTO "new_trace_entry" ("account_id", "cdp_method", "cdp_params_json", "cdp_result_json", "conversation_id", "duration_ms", "engine", "error", "id", "method", "ok", "provider_id", "request_id", "slave_id", "ts") SELECT "account_id", "cdp_method", "cdp_params_json", "cdp_result_json", "conversation_id", "duration_ms", "engine", "error", "id", "method", "ok", "provider_id", "request_id", "slave_id", "ts" FROM "trace_entry";
DROP TABLE "trace_entry";
ALTER TABLE "new_trace_entry" RENAME TO "trace_entry";
CREATE INDEX "idx_te_engine" ON "trace_entry"("engine", "ts");
CREATE INDEX "idx_te_conv" ON "trace_entry"("conversation_id", "ts");
CREATE INDEX "idx_te_provider" ON "trace_entry"("provider_id", "ts");
CREATE INDEX "idx_te_slave" ON "trace_entry"("slave_id", "ts");
CREATE TABLE "new_transfer_attempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transfer_candidate_id" TEXT NOT NULL,
    "ok" INTEGER NOT NULL DEFAULT 0,
    "result_json" TEXT,
    "error" TEXT,
    "duration_ms" INTEGER,
    "ts" BIGINT NOT NULL,
    CONSTRAINT "transfer_attempt_transfer_candidate_id_fkey" FOREIGN KEY ("transfer_candidate_id") REFERENCES "transfer_candidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_transfer_attempt" ("duration_ms", "error", "id", "ok", "result_json", "transfer_candidate_id", "ts") SELECT "duration_ms", "error", "id", "ok", "result_json", "transfer_candidate_id", "ts" FROM "transfer_attempt";
DROP TABLE "transfer_attempt";
ALTER TABLE "new_transfer_attempt" RENAME TO "transfer_attempt";
CREATE TABLE "new_transfer_candidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transfer_pattern_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "metadata_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" BIGINT NOT NULL,
    CONSTRAINT "transfer_candidate_transfer_pattern_id_fkey" FOREIGN KEY ("transfer_pattern_id") REFERENCES "transfer_pattern" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_transfer_candidate" ("created_at", "id", "metadata_json", "status", "transfer_pattern_id") SELECT "created_at", "id", "metadata_json", "status", "transfer_pattern_id" FROM "transfer_candidate";
DROP TABLE "transfer_candidate";
ALTER TABLE "new_transfer_candidate" RENAME TO "transfer_candidate";
CREATE TABLE "new_transfer_pattern" (
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
INSERT INTO "new_transfer_pattern" ("capability_id", "confidence", "created_at", "from_provider_id", "id", "last_transferred_at", "to_provider_id", "updated_at") SELECT "capability_id", "confidence", "created_at", "from_provider_id", "id", "last_transferred_at", "to_provider_id", "updated_at" FROM "transfer_pattern";
DROP TABLE "transfer_pattern";
ALTER TABLE "new_transfer_pattern" RENAME TO "transfer_pattern";
CREATE TABLE "new_user_preference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL DEFAULT 'default',
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "learned_at" BIGINT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 0.5
);
INSERT INTO "new_user_preference" ("confidence", "id", "key", "learned_at", "user_id", "value") SELECT "confidence", "id", "key", "learned_at", "user_id", "value" FROM "user_preference";
DROP TABLE "user_preference";
ALTER TABLE "new_user_preference" RENAME TO "user_preference";
CREATE UNIQUE INDEX "user_preference_user_id_key_key" ON "user_preference"("user_id", "key");
CREATE TABLE "new_vivim_session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "state" TEXT NOT NULL DEFAULT 'idle',
    "context_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);
INSERT INTO "new_vivim_session" ("context_json", "created_at", "id", "state", "updated_at") SELECT "context_json", "created_at", "id", "state", "updated_at" FROM "vivim_session";
DROP TABLE "vivim_session";
ALTER TABLE "new_vivim_session" RENAME TO "vivim_session";
CREATE TABLE "new_workflow_credential" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflow_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value_encrypted" TEXT NOT NULL,
    "created_at" BIGINT NOT NULL
);
INSERT INTO "new_workflow_credential" ("created_at", "id", "name", "type", "value_encrypted", "workflow_id") SELECT "created_at", "id", "name", "type", "value_encrypted", "workflow_id" FROM "workflow_credential";
DROP TABLE "workflow_credential";
ALTER TABLE "new_workflow_credential" RENAME TO "workflow_credential";
CREATE TABLE "new_workflow_definition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "nodes_json" TEXT NOT NULL,
    "edges_json" TEXT NOT NULL,
    "variables_json" TEXT,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);
INSERT INTO "new_workflow_definition" ("created_at", "description", "edges_json", "id", "name", "nodes_json", "updated_at", "variables_json") SELECT "created_at", "description", "edges_json", "id", "name", "nodes_json", "updated_at", "variables_json" FROM "workflow_definition";
DROP TABLE "workflow_definition";
ALTER TABLE "new_workflow_definition" RENAME TO "workflow_definition";
CREATE TABLE "new_workflow_execution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflow_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "input_json" TEXT,
    "output_json" TEXT,
    "started_at" BIGINT NOT NULL,
    "completed_at" BIGINT
);
INSERT INTO "new_workflow_execution" ("completed_at", "id", "input_json", "output_json", "started_at", "status", "workflow_id") SELECT "completed_at", "id", "input_json", "output_json", "started_at", "status", "workflow_id" FROM "workflow_execution";
DROP TABLE "workflow_execution";
ALTER TABLE "new_workflow_execution" RENAME TO "workflow_execution";
CREATE TABLE "new_workflow_node_execution" (
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
INSERT INTO "new_workflow_node_execution" ("completed_at", "error", "execution_id", "id", "input_json", "node_id", "output_json", "started_at", "status") SELECT "completed_at", "error", "execution_id", "id", "input_json", "node_id", "output_json", "started_at", "status" FROM "workflow_node_execution";
DROP TABLE "workflow_node_execution";
ALTER TABLE "new_workflow_node_execution" RENAME TO "workflow_node_execution";
CREATE TABLE "new_workflow_webhook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflow_id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "secret" TEXT,
    "created_at" BIGINT NOT NULL
);
INSERT INTO "new_workflow_webhook" ("active", "created_at", "id", "method", "path", "secret", "workflow_id") SELECT "active", "created_at", "id", "method", "path", "secret", "workflow_id" FROM "workflow_webhook";
DROP TABLE "workflow_webhook";
ALTER TABLE "new_workflow_webhook" RENAME TO "workflow_webhook";
CREATE TABLE "new_workspace_mode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL DEFAULT 'default',
    "mode" TEXT NOT NULL DEFAULT 'chat',
    "panels_json" TEXT NOT NULL DEFAULT '[]',
    "updated_at" BIGINT NOT NULL
);
INSERT INTO "new_workspace_mode" ("id", "mode", "panels_json", "updated_at", "user_id") SELECT "id", "mode", "panels_json", "updated_at", "user_id" FROM "workspace_mode";
DROP TABLE "workspace_mode";
ALTER TABLE "new_workspace_mode" RENAME TO "workspace_mode";
CREATE UNIQUE INDEX "workspace_mode_user_id_key" ON "workspace_mode"("user_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "capability_override_provider_id_capability_id_override_type_key" ON "capability_override"("provider_id", "capability_id", "override_type");

-- CreateIndex
CREATE INDEX "idx_ci_intent" ON "capability_intent"("intent_text");

-- CreateIndex
CREATE INDEX "idx_ci_primary" ON "capability_intent"("is_primary");

-- CreateIndex
CREATE INDEX "idx_ma_message" ON "message_attachment"("message_id");

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
