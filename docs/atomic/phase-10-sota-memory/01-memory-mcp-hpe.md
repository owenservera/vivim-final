# Phase 10: SOTA — Memory + MCP + Harness Protocol (12 units)

**Phase:** 10 | **Depends:** Phase 1-9 | **Source:** SOTA-06, SOTA-07, SOTA-09

## 10.1-10.3: MemoryEngine (`src/engines/memory-engine.ts`)
Three memory types, queryable by other engines.

```typescript
class MemoryEngine {
  constructor(episodic: EpisodicMemoryStore, semantic: SemanticMemoryStore, procedural: ProceduralMemoryStore, eventBus: CapabilityEventBus) {}

  // Recording
  async recordEpisode(episode: EpisodicMemoryInput): Promise<void>;
  async assertFact(fact: SemanticMemoryInput): Promise<void>;
  async createRule(rule: ProceduralRuleInput): Promise<void>;

  // Querying
  async recallEpisodes(opts: EpisodeQueryOpts): Promise<EpisodicMemory[]>;
  async recallFacts(subject: string, predicate?: string): Promise<SemanticMemory[]>;
  async findRules(context: RuleContext): Promise<ProceduralRule[]>;

  // Learning
  async learnFromEpisode(episode: EpisodicMemory): Promise<void>;
  async minePatterns(opts?: { providerId?: string; since?: number }): Promise<MiningResult>;
  async consolidate(): Promise<void>;

  // Agent support
  async getAgentContext(providerId: string, capabilityId: string): Promise<AgentMemoryContext>;
}
```

**Memory types:** Episodic (execution records), Semantic (provider facts, subject-predicate-object), Procedural (learned rules: condition→action)

**Consolidation schedule:** learn_from_episodes=5min, mine_patterns=1hr, consolidate_facts=6hr, prune_rules=24hr, update_confidence=1hr, transfer_mining=24hr

## 10.4: TransferAccelerator (`src/engines/transfer-accelerator.ts`)
Mine successful patterns from one provider → propose transfers to similar providers.

```typescript
class TransferAccelerator {
  async findTransferCandidates(): Promise<TransferCandidate[]>;
  async attemptTransfer(candidateId: string): Promise<TransferAttemptResult>;
  async batchTransfer(opts?: { shapeId?: string }): Promise<BatchTransferResult>;
}
```

## 10.5: StreamingProtocol (supersedes v1 batch-only)
Progressive block delivery during capture. `conversation:block` events restored.

```typescript
// Parser interface extension
interface ParserModule {
  parse(rawBody: string): ContentBlock[];
  parseIncremental?(chunks: AsyncIterable<string>): AsyncIterable<ContentBlock[]>;
}

// Pipeline:
// CAPTURE: capture each data: frame as it arrives
// PARSE: parse incrementally → emit conversation:block per block
// STORE: batch all blocks at end
// EMIT: conversation:stream_start → blocks → conversation:stream_end → conversation:complete
```

## 10.6: McpServerAdapter (`src/engines/mcp-server-adapter.ts`)
Expose Governor + capabilities as MCP tools.

```typescript
class McpServerAdapter {
  async start(port: number): Promise<void>;
  async stop(): Promise<void>;
  // Registered tools: chrome_launch, chrome_navigate, chrome_send_keys, chrome_click,
  //   chrome_screenshot, chrome_get_state, chrome_execute_capability,
  //   chrome_capture, provider_list, provider_get_capabilities, conversation_send
}
```

## 10.7: McpClientAdapter (`src/engines/mcp-client-adapter.ts`)
Consume external MCP servers as capability providers within the system.

```typescript
class McpClientAdapter {
  async connect(serverId: string): Promise<void>;
  async disconnect(serverId: string): Promise<void>;
  async listTools(serverId: string): Promise<ToolDefinition[]>;
  async callTool(serverId: string, toolName: string, input: Record<string, unknown>): Promise<ToolResult>;
}
```

## 10.8-10.10: HarnessProtocolEngine (`src/engines/harness-protocol-engine.ts`)
Bidirectional LLM⇄harness bridge with 3 subsystems.

**PromptAugmenter (outbound):** Injects HarnessActionSchema into every prompt — available capabilities, current page state, valid selectors, DAG step types, expected response format.

**ResponseExtractor (inbound):** 5-strategy chain: schema_guided → json_block → structure_detect → llm_repair → plain_text. Produces ContentBlock[] + HarnessAction[].

**ActionRouter:** Validates HarnessAction[] against capability registry. Routes: capability_action→CapabilityEngine, dag_step→Governor.cdp, agentic_goal→AgenticLoopEngine, workflow_call→WorkflowEngine, observation_request→ObservationTap, data_transform→in-process.

**Execution Feedback Loop:** Collects execution outcomes, feeds back into next prompt context.

```typescript
interface HarnessAction =
  | { type: 'capability_action'; capabilitySlug: string; providerId: string; input: Record<string, unknown>; confidence: number }
  | { type: 'dag_step'; step: HarnessNode; slaveId: string }
  | { type: 'agentic_goal'; goal: AgenticGoal; slaveId: string }
  | { type: 'workflow_call'; workflowId: string; input: Record<string, unknown> }
  | { type: 'observation_request'; what: ('dom'|'network'|'console'|'screenshot')[]; slaveId: string }
  | { type: 'data_transform'; expression: string; outputVariable: string };
```

**Config:** Reprogrammable via ConfigManager (extractionTimeoutMs=5000, llmRepairEnabled=true, autoApproveReadOps=true, autoApproveWriteOps=false, requireApprovalDestructive=true, maxFeedbackActions=10).

## 10.11: Schema Delta — Phase 10
~27 new tables across L1 (provider_archetype, shape_binding, discovery_session, discovery_result), L3 (capability_shape, shape_binding), L4 (ui_mirror_state, optimistic_update, latency_measurement, dom_snapshot), L9 (workflow_* tables, 5 total), L10 (mcp_tool, mcp_tool_call), L12 (episodic_memory, semantic_memory, procedural_rule, agent_decision_log), L14 NEW (observation_event, network_intercept_log, console_log), L15 NEW (agent_loop_run, agent_step). Modified: provider_definition, capability_taxonomy, selector_strategy, mcp_server_config. New views: v_provider_shape, v_workflow_execution_summary, v_agent_loop_summary, v_memory_summary. Grand total: ~81 tables.

## 10.12: Store Impls — Phase 8-10
Store implementations for all SOTA store contracts using PrismaClient.

## Gate
- MemoryEngine records and recalls episodes
- Procedural rules mined from execution patterns
- TransferAccelerator proposes cross-provider transfers
- MCP server responds to tool calls from external clients
- MCP client calls external MCP tools
- HPE: prompt augmentation <5ms, extraction <200ms (except llm_repair)
- Streaming: progressive blocks rendered as they arrive
- All new tables created, indexes applied
