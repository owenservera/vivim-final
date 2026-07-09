# SOTA-07 — Schema, Streaming & MCP Delta

**Status:** DRAFT
**Priority:** P4
**Covers:** New SQL tables, streaming protocol, MCP wiring

---

## Part A: Schema Delta

### New Tables (L1: Provider KG extensions)

```sql
-- Provider archetype (shape definition)
CREATE TABLE IF NOT EXISTS provider_archetype (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  expected_capabilities_json TEXT NOT NULL DEFAULT '{}',
  discovery_hints_json TEXT NOT NULL DEFAULT '{}',
  projection_rules_json TEXT NOT NULL DEFAULT '{}',
  parser_expectations_json TEXT NOT NULL DEFAULT '{}',
  adapter_module_id TEXT,
  extends_archetype_id TEXT REFERENCES provider_archetype(id) ON DELETE SET NULL,
  overrides_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Provider -> archetype binding
CREATE TABLE IF NOT EXISTS provider_shape_binding (
  id TEXT NOT NULL PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES provider_definition(id) ON DELETE CASCADE,
  archetype_id TEXT NOT NULL REFERENCES provider_archetype(id) ON DELETE RESTRICT,
  shape_overrides_json TEXT,
  custom_adapter_module_id TEXT,
  discovery_session_id TEXT,
  match_confidence REAL NOT NULL DEFAULT 0,
  approved INTEGER NOT NULL DEFAULT 0,
  approved_by TEXT,
  approved_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(provider_id)
);

-- Discovery session
CREATE TABLE IF NOT EXISTS discovery_session (
  id TEXT NOT NULL PRIMARY KEY,
  target_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','navigating','analyzing','inferring','completed','failed')),
  detected_archetype TEXT,
  archetype_match_confidence REAL,
  inferred_capabilities_json TEXT,
  inferred_endpoints_json TEXT,
  inferred_parser_format TEXT,
  draft_manifest_json TEXT,
  dom_snapshots_taken INTEGER DEFAULT 0,
  interactions_attempted INTEGER DEFAULT 0,
  llm_calls_made INTEGER DEFAULT 0,
  error TEXT,
  started_at INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE INDEX idx_ds_status ON discovery_session(status, started_at DESC);

-- Discovery result (detailed findings)
CREATE TABLE IF NOT EXISTS discovery_result (
  id TEXT NOT NULL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES discovery_session(id) ON DELETE CASCADE,
  result_type TEXT NOT NULL CHECK (result_type IN ('dom_snapshot','interaction','llm_analysis','network_capture')),
  data_json TEXT NOT NULL,
  confidence REAL,
  ts INTEGER NOT NULL
);

CREATE INDEX idx_dr_session ON discovery_result(session_id, ts DESC);
```

### New Tables (L3: Capability extensions)

```sql
CREATE TABLE IF NOT EXISTS capability_shape (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  expected_fields_json TEXT NOT NULL DEFAULT '[]',
  ui_projection_rules_json TEXT NOT NULL DEFAULT '{}',
  adapter_module_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS capability_shape_binding (
  id TEXT NOT NULL PRIMARY KEY,
  capability_id TEXT NOT NULL REFERENCES capability_taxonomy(id) ON DELETE CASCADE,
  shape_id TEXT NOT NULL REFERENCES capability_shape(id) ON DELETE CASCADE,
  shape_overrides_json TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(capability_id, shape_id)
);
```

### New Tables (L4: Mirror state)

```sql
CREATE TABLE IF NOT EXISTS ui_mirror_state (
  id TEXT NOT NULL PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
  slave_id TEXT NOT NULL,
  projected_state_json TEXT NOT NULL,
  sync_version INTEGER NOT NULL DEFAULT 1,
  last_sync_at INTEGER NOT NULL,
  sync_latency_ms INTEGER DEFAULT 0,
  updated_at INTEGER NOT NULL,
  UNIQUE(conversation_id)
);

CREATE TABLE IF NOT EXISTS optimistic_update (
  id TEXT NOT NULL PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  expected_state_json TEXT NOT NULL,
  actual_state_json TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','reverted')),
  revert_reason TEXT,
  created_at INTEGER NOT NULL,
  resolved_at INTEGER
);

CREATE INDEX idx_ou_conv ON optimistic_update(conversation_id, status);

CREATE TABLE IF NOT EXISTS latency_measurement (
  id TEXT NOT NULL PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  budget_ms INTEGER,
  exceeded INTEGER NOT NULL DEFAULT 0,
  ts INTEGER NOT NULL
);

CREATE INDEX idx_lm_conv ON latency_measurement(conversation_id, ts DESC);
CREATE INDEX idx_lm_stage ON latency_measurement(stage, ts DESC);

CREATE TABLE IF NOT EXISTS dom_snapshot (
  id TEXT NOT NULL PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
  slave_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  page_state_json TEXT NOT NULL,
  dom_diff TEXT,
  network_log_json TEXT,
  conversation_state_json TEXT,
  mirror_state_json TEXT,
  trigger TEXT NOT NULL
);

CREATE INDEX idx_ds_conv ON dom_snapshot(conversation_id, timestamp DESC);
```

### New Tables (L9: Workflow)

```sql
CREATE TABLE IF NOT EXISTS workflow_definition (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  triggers_json TEXT NOT NULL DEFAULT '[]',
  nodes_json TEXT NOT NULL DEFAULT '[]',
  edges_json TEXT NOT NULL DEFAULT '[]',
  variables_json TEXT NOT NULL DEFAULT '[]',
  credentials_json TEXT NOT NULL DEFAULT '[]',
  error_handling_json TEXT NOT NULL DEFAULT '{}',
  settings_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS workflow_execution (
  id TEXT NOT NULL PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflow_definition(id) ON DELETE CASCADE,
  workflow_version INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running','completed','failed','cancelled','waiting_for_human')),
  trigger_json TEXT NOT NULL,
  input_json TEXT NOT NULL DEFAULT '{}',
  output_json TEXT,
  variables_json TEXT NOT NULL DEFAULT '{}',
  current_node_id TEXT,
  progress_completed INTEGER DEFAULT 0,
  progress_total INTEGER DEFAULT 0,
  error TEXT,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  duration_ms INTEGER
);

CREATE INDEX idx_we_workflow ON workflow_execution(workflow_id, started_at DESC);
CREATE INDEX idx_we_status ON workflow_execution(status, started_at DESC);

CREATE TABLE IF NOT EXISTS workflow_node_execution (
  id TEXT NOT NULL PRIMARY KEY,
  execution_id TEXT NOT NULL REFERENCES workflow_execution(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  node_name TEXT,
  node_type TEXT NOT NULL,
  node_subtype TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','completed','failed','skipped','waiting_for_human')),
  input_json TEXT,
  output_json TEXT,
  error TEXT,
  retry_count INTEGER DEFAULT 0,
  branch_taken TEXT,
  human_loop_status TEXT,
  human_loop_resolved_by TEXT,
  human_loop_resolved_at INTEGER,
  human_loop_input_json TEXT,
  started_at INTEGER,
  completed_at INTEGER,
  duration_ms INTEGER
);

CREATE INDEX idx_wne_execution ON workflow_node_execution(execution_id, started_at);

CREATE TABLE IF NOT EXISTS workflow_webhook (
  id TEXT NOT NULL PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflow_definition(id) ON DELETE CASCADE,
  path TEXT NOT NULL UNIQUE,
  method TEXT NOT NULL DEFAULT 'POST',
  auth_token TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS workflow_credential (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  credential_data_encrypted TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

### New Tables (L10: MCP)

```sql
CREATE TABLE IF NOT EXISTS mcp_tool (
  id TEXT NOT NULL PRIMARY KEY,
  server_config_id TEXT NOT NULL REFERENCES mcp_server_config(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  description TEXT,
  input_schema_json TEXT NOT NULL DEFAULT '{}',
  output_schema_json TEXT NOT NULL DEFAULT '{}',
  is_local INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  UNIQUE(server_config_id, tool_name)
);

CREATE TABLE IF NOT EXISTS mcp_tool_call (
  id TEXT NOT NULL PRIMARY KEY,
  tool_id TEXT NOT NULL REFERENCES mcp_tool(id) ON DELETE CASCADE,
  caller TEXT NOT NULL,
  input_json TEXT,
  output_json TEXT,
  ok INTEGER NOT NULL DEFAULT 1,
  error TEXT,
  duration_ms INTEGER,
  ts INTEGER NOT NULL
);

CREATE INDEX idx_mtc_tool ON mcp_tool_call(tool_id, ts DESC);
```

### New Tables (L12: Memory extensions)

```sql
CREATE TABLE IF NOT EXISTS episodic_memory (
  id TEXT NOT NULL PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES provider_definition(id) ON DELETE CASCADE,
  capability_id TEXT,
  conversation_id TEXT,
  episode_json TEXT NOT NULL,
  context_json TEXT NOT NULL,
  lessons_json TEXT DEFAULT '[]',
  embedding_blob BLOB,
  ts INTEGER NOT NULL
);

CREATE INDEX idx_em_provider ON episodic_memory(provider_id, ts DESC);
CREATE INDEX idx_em_capability ON episodic_memory(capability_id, ts DESC);

CREATE TABLE IF NOT EXISTS semantic_memory (
  id TEXT NOT NULL PRIMARY KEY,
  provider_id TEXT REFERENCES provider_definition(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  predicate TEXT NOT NULL,
  object TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  source TEXT NOT NULL DEFAULT 'observation',
  evidence_json TEXT DEFAULT '[]',
  superseded_by TEXT REFERENCES semantic_memory(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_sm_subject ON semantic_memory(subject, predicate);
CREATE INDEX idx_sm_provider ON semantic_memory(provider_id);

CREATE TABLE IF NOT EXISTS procedural_rule (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  condition_json TEXT NOT NULL DEFAULT '{}',
  action_json TEXT NOT NULL DEFAULT '{}',
  confidence REAL NOT NULL DEFAULT 0.5,
  source TEXT NOT NULL DEFAULT 'learned',
  times_applied INTEGER DEFAULT 0,
  times_succeeded INTEGER DEFAULT 0,
  times_failed INTEGER DEFAULT 0,
  last_applied_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_pr_confidence ON procedural_rule(confidence DESC);

CREATE TABLE IF NOT EXISTS agent_decision_log (
  id TEXT NOT NULL PRIMARY KEY,
  loop_run_id TEXT,
  provider_id TEXT,
  decision TEXT NOT NULL,
  reasoning TEXT,
  input_context_json TEXT,
  output_json TEXT,
  confidence REAL,
  ts INTEGER NOT NULL
);

CREATE INDEX idx_adl_loop ON agent_decision_log(loop_run_id, ts DESC);
```

### New Tables (L14: Observation — NEW layer)

```sql
CREATE TABLE IF NOT EXISTS observation_event (
  id TEXT NOT NULL PRIMARY KEY,
  slave_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  data_json TEXT NOT NULL,
  projected_json TEXT,
  ts INTEGER NOT NULL
);

CREATE INDEX idx_oe_slave ON observation_event(slave_id, ts DESC);
CREATE INDEX idx_oe_type ON observation_event(event_type, ts DESC);

CREATE TABLE IF NOT EXISTS network_intercept_log (
  id TEXT NOT NULL PRIMARY KEY,
  slave_id TEXT NOT NULL,
  request_url TEXT NOT NULL,
  request_method TEXT,
  request_headers_json TEXT,
  request_body TEXT,
  response_status INTEGER,
  response_headers_json TEXT,
  response_body TEXT,
  response_body_truncated INTEGER DEFAULT 0,
  duration_ms INTEGER,
  ts INTEGER NOT NULL
);

CREATE INDEX idx_nil_slave ON network_intercept_log(slave_id, ts DESC);
CREATE INDEX idx_nil_url ON network_intercept_log(request_url);

CREATE TABLE IF NOT EXISTS console_log (
  id TEXT NOT NULL PRIMARY KEY,
  slave_id TEXT NOT NULL,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  source TEXT,
  line_number INTEGER,
  stack_trace TEXT,
  ts INTEGER NOT NULL
);

CREATE INDEX idx_cl_slave ON console_log(slave_id, ts DESC);
```

### New Tables (L15: Agentic Loop — NEW layer)

```sql
CREATE TABLE IF NOT EXISTS agent_loop_run (
  id TEXT NOT NULL PRIMARY KEY,
  slave_id TEXT NOT NULL,
  conversation_id TEXT,
  goal TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'agentic'
    CHECK (mode IN ('dag','agentic','hybrid')),
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running','completed','failed','aborted','timed_out')),
  iterations INTEGER DEFAULT 0,
  duration_ms INTEGER,
  llm_calls_made INTEGER DEFAULT 0,
  cdp_commands_executed INTEGER DEFAULT 0,
  goal_achieved INTEGER DEFAULT 0,
  final_confidence REAL,
  error TEXT,
  started_at INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE INDEX idx_alr_slave ON agent_loop_run(slave_id, started_at DESC);
CREATE INDEX idx_alr_conv ON agent_loop_run(conversation_id);

CREATE TABLE IF NOT EXISTS agent_step (
  id TEXT NOT NULL PRIMARY KEY,
  loop_run_id TEXT NOT NULL REFERENCES agent_loop_run(id) ON DELETE CASCADE,
  iteration INTEGER NOT NULL,
  sense_result_json TEXT,
  plan_result_json TEXT,
  action_result_json TEXT,
  observation_result_json TEXT,
  reflection_result_json TEXT,
  adapt_result_json TEXT,
  sense_ms INTEGER,
  plan_ms INTEGER,
  act_ms INTEGER,
  observe_ms INTEGER,
  reflect_ms INTEGER,
  adapt_ms INTEGER,
  total_ms INTEGER,
  ts INTEGER NOT NULL
);

CREATE INDEX idx_as_loop ON agent_step(loop_run_id, iteration);
```

### New Tables (Telemetry extensions)

```sql
CREATE TABLE IF NOT EXISTS selector_heal_event (
  id TEXT NOT NULL PRIMARY KEY,
  selector_strategy_id TEXT NOT NULL REFERENCES selector_strategy(id) ON DELETE CASCADE,
  capability_id TEXT,
  provider_id TEXT,
  failed_selector TEXT,
  new_selector TEXT,
  method TEXT NOT NULL,
  confidence REAL,
  evidence TEXT,
  ts INTEGER NOT NULL
);

CREATE INDEX idx_she_selector ON selector_heal_event(selector_strategy_id, ts DESC);
```

### Modified Tables (ALTER statements)

```sql
ALTER TABLE provider_definition ADD COLUMN archetype_id TEXT REFERENCES provider_archetype(id);
ALTER TABLE provider_definition ADD COLUMN discovery_session_id TEXT REFERENCES discovery_session(id);
ALTER TABLE provider_definition ADD COLUMN is_self_describing INTEGER NOT NULL DEFAULT 0;

ALTER TABLE capability_taxonomy ADD COLUMN shape_id TEXT REFERENCES capability_shape(id);
ALTER TABLE capability_taxonomy ADD COLUMN is_discovered INTEGER NOT NULL DEFAULT 0;

ALTER TABLE selector_strategy ADD COLUMN selector_format TEXT NOT NULL DEFAULT 'css'
  CHECK (selector_format IN ('css','xpath','aria','text','visual','composite'));
ALTER TABLE selector_strategy ADD COLUMN semantic_data_json TEXT DEFAULT '{}';
ALTER TABLE selector_strategy ADD COLUMN heal_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE selector_strategy ADD COLUMN last_healed_at INTEGER;
ALTER TABLE selector_strategy ADD COLUMN original_selector_value TEXT;

ALTER TABLE mcp_server_config ADD COLUMN status TEXT NOT NULL DEFAULT 'stopped'
  CHECK (status IN ('stopped','running','error'));
```

### New Views

```sql
CREATE VIEW IF NOT EXISTS v_provider_shape AS
SELECT
  pd.id AS provider_id,
  pd.slug,
  pd.display_name,
  pa.name AS archetype_name,
  psb.match_confidence,
  psb.approved,
  ds.status AS discovery_status,
  pd.is_self_describing
FROM provider_definition pd
LEFT JOIN provider_shape_binding psb ON psb.provider_id = pd.id
LEFT JOIN provider_archetype pa ON pa.id = psb.archetype_id
LEFT JOIN discovery_session ds ON ds.id = pd.discovery_session_id;

CREATE VIEW IF NOT EXISTS v_workflow_execution_summary AS
SELECT
  wd.name AS workflow_name,
  we.status,
  we.started_at,
  we.duration_ms,
  we.progress_completed,
  we.progress_total,
  COUNT(wne.id) AS node_count,
  COUNT(CASE WHEN wne.status = 'failed' THEN 1 END) AS failed_nodes
FROM workflow_execution we
JOIN workflow_definition wd ON wd.id = we.workflow_id
LEFT JOIN workflow_node_execution wne ON wne.execution_id = we.id
GROUP BY we.id;

CREATE VIEW IF NOT EXISTS v_agent_loop_summary AS
SELECT
  alr.id,
  alr.slave_id,
  alr.goal,
  alr.status,
  alr.iterations,
  alr.duration_ms,
  alr.goal_achieved,
  alr.llm_calls_made,
  alr.started_at,
  pd.slug AS provider_slug
FROM agent_loop_run alr
LEFT JOIN provider_definition pd ON pd.id = (
  SELECT provider_id FROM provider_account WHERE chrome_slave_id = alr.slave_id LIMIT 1
);

CREATE VIEW IF NOT EXISTS v_memory_summary AS
SELECT
  pd.slug AS provider_slug,
  (SELECT COUNT(*) FROM episodic_memory em WHERE em.provider_id = pd.id) AS episodes,
  (SELECT COUNT(*) FROM semantic_memory sm WHERE sm.provider_id = pd.id AND sm.superseded_by IS NULL) AS facts,
  (SELECT COUNT(*) FROM procedural_rule pr WHERE pr.confidence > 0.5) AS active_rules
FROM provider_definition pd;
```

### Table Count Summary

| Category | New Tables | Modified Tables |
|----------|-----------|-----------------|
| Provider KG extensions | 4 | 1 (provider_definition) |
| Capability extensions | 2 | 1 (capability_taxonomy) |
| Mirror state | 4 | 0 |
| Workflow | 5 | 0 |
| MCP | 2 | 1 (mcp_server_config) |
| Memory | 4 | 0 |
| Observation (new layer) | 3 | 0 |
| Agentic loop (new layer) | 2 | 0 |
| Telemetry extensions | 1 | 1 (selector_strategy) |
| **Total new** | **~27** | **4 modified** |
| **Grand total (v1 + v2)** | **~81 tables** | |

---

## Part B: Streaming Protocol

### Supersedes v1 D1 (Batch-Only)

The v1 decision to use batch-after-capture streaming is **superseded**. The v2 system supports **progressive streaming** where blocks are emitted as they are parsed during capture.

### Protocol

```
POST /api/conversations/:id/send
  │
  ├─ [1] ConversationManager begins 8-step pipeline
  │
  ├─ [2] At step 5 (CAPTURE): Governor captures response via CDP
  │     └─ Network.responseReceived -> getResponseBody
  │     └─ For SSE: capture each data: frame as it arrives
  │
  ├─ [3] At step 6 (PARSE): StreamParserEngine parses incrementally
  │     ├─ As each SSE frame is captured -> parse immediately
  │     ├─ Each parsed ContentBlock -> emit conversation:block event
  │     └─ conversation:stream_start emitted before first block
  │
  ├─ [4] conversation:block events (per block):
  │     { type: 'conversation:block', conversationId, messageId, block: ContentBlock, blockIndex, totalBlocks?: null }
  │     └─ Frontend renders block immediately (progressive rendering)
  │
  ├─ [5] When capture completes:
  │     ├─ Final parse pass (for non-incremental parsers)
  │     ├─ Store all blocks in stream_block table
  │     ├─ Emit conversation:stream_end
  │     └─ Emit conversation:complete (for backward compat with v1)
  │
  └─ [6] HTTP response: { ok: true, messageId, blocks, text, latencyMs }
```

### Parser Interface Extension

```typescript
interface ParserModule {
  // v1 methods (preserved)
  parse(rawBody: string): ContentBlock[];
  detectCompletion(rawBody: string): boolean;
  getConfidence(rawBody: string): number;

  // NEW: Incremental parsing (for streaming)
  parseIncremental?(chunks: AsyncIterable<string>): AsyncIterable<ContentBlock[]>;
}
```

### Frontend Rendering Modes

| Mode | Behavior | When to use |
|------|----------|-------------|
| `progressive` | Render each block as it arrives | Default — best UX |
| `batch` | Wait for `conversation:complete`, render all at once | Slow connections, or jank |
| `hybrid` | Show typing indicator until first block, then progressive | Best of both |

---

## Part C: MCP Integration

### Supersedes v1 "MCP design slot only"

The MCP server and client adapters are now **wired** — not just design slots.

### MCP Server Adapter

```typescript
class McpServerAdapter {
  constructor(
    private governor: ChromeGovernor,
    private capabilityEngine: CapabilityEngine,
    private resolution: CapabilityResolutionEngine,
    private store: McpStore,
  ) {}

  async start(port: number): Promise<void>;
  async stop(): Promise<void>;
  // Registered MCP tools:
  //   chrome_launch, chrome_navigate, chrome_send_keys, chrome_click,
  //   chrome_screenshot, chrome_get_state, chrome_execute_capability,
  //   chrome_capture, provider_list, provider_get_capabilities, conversation_send
}
```

### MCP Client Adapter

```typescript
class McpClientAdapter {
  constructor(private store: McpStore) {}

  async connect(serverId: string): Promise<void>;
  async disconnect(serverId: string): Promise<void>;
  async listTools(serverId: string): Promise<ToolDefinition[]>;
  async callTool(serverId: string, toolName: string, input: Record<string, unknown>): Promise<ToolResult>;
  // External MCP tools are registered as capabilities:
  //   1. MCP tool -> provider_capability row (provider_type = 'mcp')
  //   2. MCP tool input_schema -> ui_input_schema
  //   3. MCP tool execution -> CapabilityEngine delegates to McpClientAdapter
}
```

### Use Cases

| Use Case | How |
|----------|-----|
| Claude Code controls Chrome via cap-store | Connect to cap-store MCP server, call chrome_execute_capability |
| Cursor uses cap-store for browser automation | Connect to MCP server, call chrome_navigate + chrome_send_keys |
| Cap-store calls external MCP server for data | McpClientAdapter connects, calls tool, uses result in workflow |
| n8n workflow calls MCP tool | Workflow's mcp_tool_call node uses McpClientAdapter |

---

## See also

- All SOTA docs reference this schema delta
- `03-merged-schema.md` — v1 baseline schema (these tables are additive)
