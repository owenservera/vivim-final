# Phase 9: SOTA — Workflow Engine + Browser Automation (10 units)

**Phase:** 9 | **Depends:** Phase 1-8 | **Source:** SOTA-04, SOTA-05

## 9.1: WorkflowEngine (`src/engines/workflow-engine.ts`)
Execute visual workflow DAGs with human-in-the-loop, webhook triggers, and parallel execution.

```typescript
class WorkflowEngine {
  constructor(governor: ChromeGovernor, capabilityEngine: CapabilityEngine, store: WorkflowStore, eventBus: CapabilityEventBus, mcpClient?: McpClientAdapter) {}

  async createWorkflow(def: WorkflowDefinition): Promise<WorkflowDefinition>;
  async updateWorkflow(id: string, patch: Partial<WorkflowDefinition>): Promise<WorkflowDefinition>;
  async deleteWorkflow(id: string): Promise<void>;
  async getWorkflow(id: string): Promise<WorkflowDefinition | null>;
  async execute(workflowId: string, input?: Record<string, unknown>): Promise<WorkflowExecution>;
  async cancelExecution(executionId: string): Promise<void>;
  async replayExecution(executionId: string, opts?: { fromNode?: string }): Promise<WorkflowExecution>;
  async resolveHumanLoop(nodeExecutionId: string, decision: 'approve' | 'reject' | 'skip', input?: Record<string, unknown>): Promise<void>;
  async handleWebhook(webhookId: string, request: Request): Promise<Response>;
}
```

**5 node categories:** Trigger (6 types), Action (7 types), Logic (10 types), AI (6 types), Data (5 types).

## 9.2: WorkflowCompiler (`src/engines/workflow-compiler.ts`)
Transform visual workflow JSON → executable HarnessDAG.

```typescript
class WorkflowCompiler {
  compile(workflow: WorkflowDefinition): CompiledWorkflow;
  // Validates: no cycles, valid edge references, valid expressions
  // Compiles: expressions → evaluator functions, sub-workflows → inlined DAGs
}
```

## 9.3: SemanticGroundingEngine (`src/engines/semantic-grounding.ts`)
Replace CSS selectors with semantic references via accessibility tree.

```typescript
type SemanticSelector =
  | { type: 'aria'; role: string; name?: string; description?: string }
  | { type: 'text'; text: string; elementRole?: string }
  | { type: 'visual'; screenshotRegion: {...}; description: string }
  | { type: 'css'; selector: string }
  | { type: 'composite'; primary: SemanticSelector; fallbacks: SemanticSelector[] };

class SemanticGroundingEngine {
  async resolve(slaveId: string, selector: SemanticSelector): Promise<ResolvedElement | null>;
  async resolveAll(slaveId: string, selector: SemanticSelector): Promise<ResolvedElement[]>;
  async waitFor(slaveId: string, selector: SemanticSelector, timeoutMs?: number): Promise<ResolvedElement | null>;
  async getAccessibilityTree(slaveId: string): Promise<AccessibilityNode[]>;
  async resolveByVisual(slaveId: string, region: ScreenshotRegion, description: string): Promise<ResolvedElement | null>;
}
```

## 9.4: SelectorHealer (`src/engines/selector-healer.ts`)
LLM-powered selector repair when a selector misses.

```typescript
class SelectorHealer {
  async heal(params: { slaveId: string; failedSelector: SemanticSelector; capabilityId: string; providerId: string; context?: string }): Promise<HealResult | null>;
}
```

**Healing strategies (priority):** 1. ARIA match (relax name) → 2. Text match → 3. DOM structure analysis → 4. LLM proposal → 5. Visual match

## 9.5-9.6: Shadow DOM + Cross-Origin Frames
- Shadow DOM: accessibility tree includes shadow elements natively. CSS fallback uses shadow-piercing `>>>` selectors.
- Cross-origin: FrameAwareSelector with frameChain URLs. Page.getFrameTree → navigate to target frame → execute selector.

## 9.7: Anti-Detection Stealth (`seeds/harness/stealth.module.ts`)
Injected via Page.addScriptToEvaluateOnNewDocument: mask WebDriver, spoof navigator, human-like interaction patterns (type delay, click jitter, mouse curves), canvas fingerprint randomization, WebRTC prevention.

## 9.8-9.10: Human-in-the-Loop + Webhooks + Schema Delta
- HumanLoop: execution pauses, emits workflow:human_loop_pending, waits for resolveHumanLoop()
- Webhooks: POST /api/webhooks/:path triggers workflow
- Schema delta: workflow_definition, workflow_node (edges/nodes as JSON), workflow_execution, workflow_node_execution, workflow_webhook, workflow_credential

## Gate
- WorkflowEngine executes 5-node workflow end-to-end
- Human-in-the-loop nodes pause and resume correctly
- SelectorHealer proposes valid alternatives
- SemanticGroundingEngine resolves by ARIA role
- Anti-detection stealth prevents bot detection
