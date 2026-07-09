# SOTA-04 — Visual Workflow Engine (n8n Clone)

**Status:** DRAFT
**Priority:** P3
**Extends:** `02-merged-architecture.md` (P9 Agentic Harness), `04-merged-engines.md` (HarnessDAG)
**Supersedes:** v1 "Visual flow builder out of scope"

---

## Purpose

Transform the system from a capability-execution platform into a **workflow automation platform**. Users compose multi-step workflows visually (n8n-style drag-and-drop), and the system executes them across Chrome + external services + AI.

The HarnessDAG format from v1 is the **execution substrate**. The visual workflow builder is the **authoring layer**. The WorkflowCompiler translates visual workflow definitions into HarnessDAGs for execution.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    VISUAL WORKFLOW BUILDER (Frontend)                │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ Node     │  │ Edge     │  │ Canvas   │  │ Property │           │
│  │ Palette  │  │ Router   │  │ (DAG)    │  │ Panel    │           │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │
│                                                                     │
│  Node categories:                                                   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐     │
│  │Trigger  │ │Action   │ │Logic    │ │AI       │ │Data     │     │
│  │Nodes    │ │Nodes    │ │Nodes    │ │Nodes    │ │Nodes    │     │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘     │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           │ POST /api/workflows (save JSON)
                           │ POST /api/workflows/:id/execute
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    WORKFLOW ENGINE (Server)                          │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │
│  │ WorkflowCompiler │  │ WorkflowExecutor │  │ ExecutionContext │ │
│  │                  │  │                  │  │                  │ │
│  │ Visual JSON →    │  │ Runs compiled    │  │ Variables,       │ │
│  │ HarnessDAG       │  │ DAG step-by-step │  │ credentials,     │ │
│  │                  │  │ with observation │  │ environment,     │ │
│  │ Validates types  │  │ + branching +    │  │ secrets          │ │
│  │ Checks cycles    │  │ parallel + retry │  │                  │ │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘ │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │
│  │ ExecutionHistory │  │ ErrorRouter      │  │ HumanLoopGate    │ │
│  │                  │  │                  │  │                  │ │
│  │ Every run        │  │ Per-node error   │  │ Pauses execution │ │
│  │ recorded         │  │ handlers +       │  │ for human        │ │
│  │ Replayable       │  │ fallback chains  │  │ approval/input   │ │
│  │ Debuggable       │  │                  │  │                  │ │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Node Types

### Trigger Nodes (start a workflow)

| Node | Description | Config |
|------|-------------|--------|
| `manual_trigger` | User clicks "Run" in UI | — |
| `schedule_trigger` | Cron-based schedule | `cron: string` |
| `webhook_trigger` | External HTTP request starts workflow | `method, path, authToken` |
| `conversation_trigger` | Conversation event starts workflow | `eventType: 'message_received' \| 'message_sent' \| 'capability_executed'` |
| `event_trigger` | CapabilityEventBus event starts workflow | `eventType: string, filter?: object` |
| `fleet_trigger` | Fleet event starts workflow | `eventType: 'slave_started' \| 'slave_stopped' \| 'circuit_open'` |

### Action Nodes (execute something)

| Node | Description | Config |
|------|-------------|--------|
| `capability_action` | Execute a capability on a provider | `providerId, capabilitySlug, input` |
| `http_request` | Make an HTTP request | `method, url, headers, body, auth` |
| `mcp_tool_call` | Call an MCP tool | `serverId, toolName, input` |
| `chrome_navigate` | Navigate Chrome to a URL | `slaveId, url` |
| `chrome_screenshot` | Take a screenshot | `slaveId, format` |
| `chrome_execute_js` | Execute JavaScript in Chrome | `slaveId, script` |
| `sub_workflow` | Call another workflow as a node | `workflowId, inputMapping` |

### Logic Nodes (control flow)

| Node | Description | Config |
|------|-------------|--------|
| `branch_if` | If/else branching | `condition: Expression, thenBranch, elseBranch` |
| `branch_switch` | Multi-way branching | `expression, cases: [{value, branch}]` |
| `loop_for_each` | Iterate over array | `array: Expression, body: SubDAG` |
| `loop_while` | While loop | `condition: Expression, body: SubDAG` |
| `parallel_all` | Run branches in parallel, wait all | `branches: SubDAG[]` |
| `parallel_race` | Run branches in parallel, first wins | `branches: SubDAG[]` |
| `wait` | Wait for duration or condition | `durationMs? \| condition: Expression` |
| `merge` | Merge parallel branches | `strategy: 'first' \| 'last' \| 'concat' \| 'custom'` |
| `transform` | Transform data | `expression: Expression` |
| `filter` | Filter array | `condition: Expression` |

### AI Nodes (LLM-powered)

| Node | Description | Config |
|------|-------------|--------|
| `llm_call` | Call an LLM directly | `provider, model, messages, temperature, maxTokens` |
| `llm_classify` | Classify text into categories | `input: Expression, categories: string[], model` |
| `llm_extract` | Extract structured data from text | `input: Expression, schema: JSONSchema, model` |
| `llm_summarize` | Summarize text | `input: Expression, maxWords, model` |
| `agent_decide` | LLM decides next action | `context: Expression, options: string[], model` |
| `agent_loop` | Run agentic observation-action loop | `goal: string, constraints: AgenticConstraints` |

### Data Nodes (data manipulation)

| Node | Description | Config |
|------|-------------|--------|
| `variable_set` | Set a workflow variable | `name, value: Expression` |
| `variable_get` | Get a workflow variable | `name` |
| `constant` | Emit a constant value | `value` |
| `aggregate` | Aggregate array data | `array: Expression, operation: 'sum' \| 'avg' \| 'count' \| 'min' \| 'max'` |
| `format` | Format data as string | `template: string, variables: Record<string, Expression>` |

---

## Workflow Definition Schema

```typescript
interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  version: number;
  is_active: boolean;

  // Trigger configuration
  triggers: WorkflowTrigger[];

  // Nodes (the visual DAG)
  nodes: WorkflowNode[];

  // Edges (connections between nodes)
  edges: WorkflowEdge[];

  // Variables (workflow-level state)
  variables: WorkflowVariableDef[];

  // Credentials (referenced by nodes)
  credentials: WorkflowCredentialRef[];

  // Error handling
  errorHandling: {
    defaultStrategy: 'continue' | 'stop' | 'retry' | 'branch';
    retryConfig?: { maxRetries: number; backoffMs: number };
    errorBranchId?: string;          // node ID of error handler
  };

  // Execution settings
  settings: {
    maxDurationMs: number;           // default: 300000 (5 min)
    maxNodesExecuted: number;        // default: 100
    parallelism: number;             // max parallel branches: default 5
    saveExecutionHistory: boolean;   // default: true
    streamingMode: 'batch' | 'progressive'; // default: 'progressive'
  };

  // Metadata
  created_at: number;
  updated_at: number;
  created_by: string;
}

interface WorkflowNode {
  id: string;
  type: NodeType;                    // 'trigger' | 'action' | 'logic' | 'ai' | 'data'
  subtype: string;                   // 'manual_trigger' | 'capability_action' | 'branch_if' | ...
  name: string;                      // user-friendly name
  config: Record<string, unknown>;   // node-specific configuration
  position: { x: number; y: number }; // visual position on canvas

  // Error handling for this node
  onError?: {
    strategy: 'retry' | 'skip' | 'stop' | 'branch';
    retryConfig?: { maxRetries: number; backoffMs: number };
    branchId?: string;
  };

  // Human-in-the-loop
  humanLoop?: {
    enabled: boolean;
    prompt: string;
    timeoutMs: number;
    defaultAction: 'approve' | 'reject' | 'skip';
  };
}

interface WorkflowEdge {
  id: string;
  source: string;                    // source node ID
  target: string;                    // target node ID
  sourcePort?: string;               // output port (e.g., 'then', 'else', 'loop_body')
  targetPort?: string;               // input port
  condition?: Expression;            // edge condition (for conditional routing)
  label?: string;                    // visual label
}

type Expression = string;            // expression language: {{ $json.field }} or {{ $variables.x }}
// Expression syntax:
//   {{ $input }} — input data from previous node
//   {{ $json.field }} — JSON path into input data
//   {{ $variables.name }} — workflow variable
//   {{ $credentials.name }} — credential value
//   {{ $execution.id }} — current execution ID
//   {{ $node.<nodeId>.output }} — output of a specific node
//   {{ $now }} — current timestamp
//   {{ $env.NAME }} — environment variable
```

---

## WorkflowCompiler

Transforms a `WorkflowDefinition` into a `HarnessDAG` for execution:

```typescript
class WorkflowCompiler {
  compile(workflow: WorkflowDefinition): CompiledWorkflow {
    // 1. Validate: no cycles, all edges reference valid nodes, all expressions are valid
    // 2. Resolve trigger → entry point
    // 3. Build DAG from nodes + edges
    // 4. Inline sub-workflows
    // 5. Compile expressions to evaluator functions
    // 6. Return CompiledWorkflow
  }
}

interface CompiledWorkflow {
  workflowId: string;
  version: number;
  dag: HarnessDAG;                   // compiled execution DAG
  variables: Map<string, unknown>;   // initial variable values
  credentials: Map<string, unknown>; // resolved credential values
  nodeMap: Map<string, CompiledNode>; // node ID → compiled node
}

interface CompiledNode {
  nodeId: string;
  type: NodeType;
  subtype: string;
  executor: NodeExecutor;            // function that executes this node
  inputMappings: Expression[];       // expressions to evaluate for input
  outputMappings?: Expression[];     // expressions to evaluate for output
  errorConfig?: NodeErrorConfig;
  humanLoopConfig?: HumanLoopConfig;
}
```

---

## WorkflowEngine

```typescript
class WorkflowEngine {
  constructor(
    private governor: ChromeGovernor,
    private capabilityEngine: CapabilityEngine,
    private store: WorkflowStore,
    private eventBus: CapabilityEventBus,
    private mcpClient?: McpClientAdapter,
  ) {}

  // ── Workflow Management ───────────────────────────
  async createWorkflow(def: WorkflowDefinition): Promise<WorkflowDefinition>;
  async updateWorkflow(id: string, patch: Partial<WorkflowDefinition>): Promise<WorkflowDefinition>;
  async deleteWorkflow(id: string): Promise<void>;
  async getWorkflow(id: string): Promise<WorkflowDefinition | null>;
  async listWorkflows(opts?: { active?: boolean }): Promise<WorkflowDefinition[]>;

  // ── Execution ─────────────────────────────────────
  async execute(workflowId: string, input?: Record<string, unknown>): Promise<WorkflowExecution>;
  async executeFromTrigger(trigger: WorkflowTrigger, payload: Record<string, unknown>): Promise<WorkflowExecution>;
  async cancelExecution(executionId: string): Promise<void>;
  async getExecution(executionId: string): Promise<WorkflowExecution | null>;
  async getExecutionHistory(workflowId: string, opts?: { limit?: number; from?: number }): Promise<WorkflowExecution[]>;
  async replayExecution(executionId: string, opts?: { fromNode?: string }): Promise<WorkflowExecution>;

  // ── Human-in-the-Loop ─────────────────────────────
  async resolveHumanLoop(nodeExecutionId: string, decision: 'approve' | 'reject' | 'skip', input?: Record<string, unknown>): Promise<void>;
  async getPendingHumanLoops(): Promise<WorkflowNodeExecution[]>;

  // ── Webhook ───────────────────────────────────────
  async handleWebhook(webhookId: string, request: Request): Promise<Response>;
  async registerWebhook(workflowId: string, config: WebhookConfig): Promise<WebhookRegistration>;
  async unregisterWebhook(webhookId: string): Promise<void>;
}

interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowVersion: number;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'waiting_for_human';
  trigger: { type: string; payload: Record<string, unknown> };
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  variables: Record<string, unknown>;
  nodeExecutions: WorkflowNodeExecution[];
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  error?: string;
  // For streaming
  currentNodeId?: string;
  progress: { completed: number; total: number };
}

interface WorkflowNodeExecution {
  id: string;
  executionId: string;
  nodeId: string;
  nodeName: string;
  nodeType: NodeType;
  nodeSubtype: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'waiting_for_human';
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  // For human-in-the-loop
  humanLoop?: {
    prompt: string;
    status: 'pending' | 'approved' | 'rejected' | 'skipped' | 'timeout';
    resolvedBy?: string;
    resolvedAt?: number;
    input?: Record<string, unknown>;
  };
  // For retry
  retryCount: number;
  // For branching
  branchTaken?: string;
}
```

---

## Execution Flow

```
execute(workflowId, input)
  │
  ├─ [1] Load WorkflowDefinition
  ├─ [2] Compile via WorkflowCompiler
  ├─ [3] Create WorkflowExecution record
  ├─ [4] Initialize variables + credentials
  ├─ [5] Start at trigger node's target
  │
  ├─ [6] For each node in DAG order:
  │   │
  │   ├─ [6a] Evaluate input expressions → node input
  │   ├─ [6b] Check humanLoop — if enabled, pause execution
  │   │         └─ Emit workflow:human_loop_pending event
  │   │         └─ Wait for resolveHumanLoop() call
  │   ├─ [6c] Execute node:
  │   │         ├─ trigger → already handled
  │   │         ├─ action → delegate to appropriate engine
  │   │         ├─ logic → evaluate condition, route to branch
  │   │         ├─ ai → call LLM
  │   │         └─ data → evaluate expressions
  │   ├─ [6d] Record node execution (input, output, duration)
  │   ├─ [6e] Emit workflow:node_completed event (for UI streaming)
  │   ├─ [6f] Check error — if failed, route to error handler
  │   └─ [6g] Route to next node(s) via edges
  │
  ├─ [7] All nodes complete → WorkflowExecution.status = 'completed'
  ├─ [8] Emit workflow:completed event
  └─ [9] Return WorkflowExecution
```

---

## Human-in-the-Loop Protocol

```
Workflow execution reaches a node with humanLoop.enabled = true
  │
  ├─ [1] Pause execution
  ├─ [2] Create WorkflowNodeExecution with status = 'waiting_for_human'
  ├─ [3] Emit { type: 'workflow:human_loop_pending', executionId, nodeExecutionId, prompt }
  │     └─ WebSocket forwards to subscribed clients
  │     └─ UI shows approval dialog
  │
  ├─ [4] Wait for human response (timeout: humanLoop.timeoutMs)
  │
  ├─ [5] Human responds via POST /api/workflows/executions/:id/nodes/:nodeId/resolve
  │     └─ { decision: 'approve' | 'reject' | 'skip', input?: {...} }
  │
  ├─ [6] Resume execution:
  │     ├─ approve → continue with human-provided input (if any)
  │     ├─ reject → route to error handler
  │     └─ skip → skip this node, continue
  │
  └─ [7] If timeout → apply defaultAction
```

---

## Workflow Examples

### Example 1: Multi-Provider Research Pipeline

```
[manual_trigger]
       │
       ▼
[variable_set: topic = "{{ $input.topic }}"]
       │
       ▼
[parallel_all]
   ├── [capability_action: send_message on Claude with "Research: {{ $topic }}"]
   ├── [capability_action: send_message on ChatGPT with "Research: {{ $topic }}"]
   └── [capability_action: send_message on Gemini with "Research: {{ $topic }}"]
       │
       ▼
[transform: merge responses into array]
       │
       ▼
[llm_summarize: "Summarize these research findings: {{ $json }}"]
       │
       ▼
[http_request: POST results to webhook]
```

### Example 2: Self-Healing Selector Workflow

```
[event_trigger: capability:selector_drifted]
       │
       ▼
[variable_set: capability = "{{ $input.capabilityId }}"]
       │
       ▼
[branch_if: "{{ $input.missCount > 5 }}"]
   ├── (then)
   │   ├── [chrome_screenshot]
   │   ├── [llm_extract: "Find the selector for {{ $capability }} from this screenshot"]
   │   ├── [humanLoop: "Approve new selector: {{ $json.selector }}?"]
   │   └── [http_request: PUT /api/selectors/{{ $capability }} with new selector]
   └── (else)
       └── [wait: 60s]
```

### Example 3: Agentic Loop Workflow

```
[webhook_trigger: POST /webhook/research]
       │
       ▼
[agent_loop:
   goal: "Research {{ $input.topic }} and produce a summary",
   constraints: {
     allowedCapabilities: ['send_message', 'navigate', 'screenshot'],
     maxIterations: 15
   }
]
       │
       ▼
[llm_summarize: "{{ $agent_loop.output }}"]
       │
       ▼
[http_request: POST summary to webhook]
```

---

## WebSocket Events (New)

| Event Type | Direction | Purpose |
|-----------|-----------|---------|
| `workflow:started` | Server → Client | Workflow execution started |
| `workflow:node_started` | Server → Client | Node execution started |
| `workflow:node_completed` | Server → Client | Node execution completed |
| `workflow:node_failed` | Server → Client | Node execution failed |
| `workflow:human_loop_pending` | Server → Client | Human approval needed |
| `workflow:completed` | Server → Client | Workflow execution completed |
| `workflow:failed` | Server → Client | Workflow execution failed |
| `workflow:progress` | Server → Client | Progress update (completed/total nodes) |

---

## See also

- `SOTA-03` — Agentic loop engine (agent_loop node type)
- `SOTA-07` — Schema delta (new tables: workflow_definition, workflow_node, etc.)
- `04-merged-engines.md` — HarnessDAG format (execution substrate)
