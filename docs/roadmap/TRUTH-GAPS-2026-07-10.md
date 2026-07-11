# Truth-Grounded Gap Report

**Generated:** 2026-07-10T16:28:59.699Z
**Truth Score:** 58%

---

## Executive Summary

Truth Score: 58% (74/127 files are REAL)
Gaps: 354 total — 0 CRITICAL, 3 HIGH, 351 MEDIUM, 0 LOW
Top gap domains: general(108), schema(69), storage(32)
No critical blockers

---

## Gaps by Severity

### HIGH (3)

| ID | Domain | Summary | File | Effort |
|---|---|---|---|---|
| GAP-008 | general | Design claim violated: harness.ts | harness.ts | S |
| GAP-009 | general | Design claim violated: mirror-engine | src/engines/mirror-engine.ts | S |
| GAP-010 | general | Design claim violated: workflow-engine | src/engines/workflow-engine.ts | S |

### MEDIUM (351)

| ID | Domain | Summary | File | Effort |
|---|---|---|---|---|
| GAP-001 | chrome-management | Mixed file: src/engines/chrome-governor.ts | src/engines/chrome-governor.ts | S |
| GAP-002 | api-server | Mixed file: src/engines/mcp-server-adapter.ts | src/engines/mcp-server-adapter.ts | S |
| GAP-003 | general | Mixed file: src/engines/mirror-engine.ts | src/engines/mirror-engine.ts | S |
| GAP-004 | provider-routing | Mixed file: src/engines/provider-health.ts | src/engines/provider-health.ts | S |
| GAP-005 | general | Mixed file: src/engines/semantic-grounding.ts | src/engines/semantic-grounding.ts | S |
| GAP-006 | general | Mixed file: src/engines/workflow-engine.ts | src/engines/workflow-engine.ts | S |
| GAP-007 | api-server | Mixed file: src/router/router.ts | src/router/router.ts | S |
| GAP-011 | provider-routing | Design claim unverifiable: claude.json | seeds/providers/claude.json | S |
| GAP-012 | general | Design claim unverifiable: account-registry.ts | account-registry.ts | S |
| GAP-013 | general | Design claim unverifiable: slave-write.ts | slave-write.ts | S |
| GAP-014 | general | Design claim unverifiable: slave-read.ts | slave-read.ts | S |
| GAP-015 | general | Design claim unverifiable: stream-capture.ts | stream-capture.ts | S |
| GAP-016 | general | Design claim unverifiable: network-capture.ts | network-capture.ts | S |
| GAP-017 | general | Design claim unverifiable: probe.ts | probe.ts | S |
| GAP-018 | general | Design claim unverifiable: loop.ts | loop.ts | S |
| GAP-019 | session-state | Design claim unverifiable: conversation-driver.ts | conversation-driver.ts | S |
| GAP-020 | general | Design claim unverifiable: content-pipeline.ts | content-pipeline.ts | S |
| GAP-021 | provider-routing | Design claim unverifiable: provider-discovery-engine | src/engines/provider-discovery-engine.ts | S |
| GAP-022 | general | Design claim unverifiable: agentic-loop-engine | src/engines/agentic-loop-engine.ts | S |
| GAP-023 | general | Interface not implemented: AlertConditionRow | src/alerting/alerter.ts | S |
| GAP-024 | general | Interface not implemented: AlertEventRow | src/alerting/alerter.ts | S |
| GAP-025 | general | Interface not implemented: AutomationScheduleRow | src/automation/scheduler.ts | S |
| GAP-026 | general | Interface not implemented: AutomationRunRow | src/automation/scheduler.ts | S |
| GAP-027 | general | Interface not implemented: AutomationRunner | src/automation/scheduler.ts | S |
| GAP-028 | general | Interface not implemented: AutomationStore | src/automation/scheduler.ts | S |
| GAP-029 | cli | Interface not implemented: BackendBridgeOptions | src/cli/bridges/backend-bridge.ts | S |
| GAP-030 | cli | Interface not implemented: BridgeOptions | src/cli/bridges/cap-store-bridge.ts | S |
| GAP-031 | cli | Interface not implemented: CliCommand | src/cli/command-registry.ts | S |
| GAP-032 | cli | Interface not implemented: CliOutput | src/cli/command-registry.ts | S |
| GAP-033 | cli | Interface not implemented: PipelineStep | src/cli/pipeline-engine.ts | S |
| GAP-034 | general | Interface not implemented: AgenticGoal | src/engines/agentic-loop.ts | S |
| GAP-035 | general | Interface not implemented: AgenticLoopResult | src/engines/agentic-loop.ts | S |
| GAP-036 | general | Interface not implemented: PlanningStrategy | src/engines/agentic-loop.ts | S |
| GAP-037 | capability-system | Interface not implemented: WsLike | src/engines/capability-event-bus.ts | S |
| GAP-038 | capability-system | Interface not implemented: CapabilityMacroRow | src/engines/capability-macro.ts | S |
| GAP-039 | capability-system | Interface not implemented: MacroRunResult | src/engines/capability-macro.ts | S |
| GAP-040 | capability-system | Interface not implemented: HarnessRuntime | src/engines/capability-macro.ts | S |
| GAP-041 | capability-system | Interface not implemented: AvailabilityGating | src/engines/capability-resolution.ts | S |
| GAP-042 | capability-system | Interface not implemented: CapabilityResolutionOptions | src/engines/capability-resolution.ts | S |
| GAP-043 | capability-system | Interface not implemented: ResolvedCapability | src/engines/capability-resolution.ts | S |
| GAP-044 | capability-system | Interface not implemented: ResolvedCapabilities | src/engines/capability-resolution.ts | S |
| GAP-045 | capability-system | Interface not implemented: DomIndicator | src/engines/capability-shape-registry.ts | S |
| GAP-046 | capability-system | Interface not implemented: InteractiveElementPattern | src/engines/capability-shape-registry.ts | S |
| GAP-047 | capability-system | Interface not implemented: ProjectionRule | src/engines/capability-shape-registry.ts | S |
| GAP-048 | capability-system | Interface not implemented: CapabilityShape | src/engines/capability-shape-registry.ts | S |
| GAP-049 | capability-system | Interface not implemented: CapabilityAdapter | src/engines/capability-shape-registry.ts | S |
| GAP-050 | capability-system | Interface not implemented: CapabilityExecutionResult | src/engines/capability.ts | S |
| GAP-051 | capability-system | Interface not implemented: LoginDetectionResult | src/engines/capability.ts | S |
| GAP-052 | capability-system | Interface not implemented: LoginIndicator | src/engines/capability.ts | S |
| GAP-053 | capability-system | Interface not implemented: RecoveryStrategyResult | src/engines/capability.ts | S |
| GAP-054 | chrome-management | Interface not implemented: FleetConfig | src/engines/chrome-governor.ts | S |
| GAP-055 | chrome-management | Interface not implemented: LaunchOptions | src/engines/chrome-governor.ts | S |
| GAP-056 | chrome-management | Interface not implemented: ChromeSlave | src/engines/chrome-governor.ts | S |
| GAP-057 | chrome-management | Interface not implemented: CaptureResult | src/engines/chrome-governor.ts | S |
| GAP-058 | chrome-management | Interface not implemented: PageState | src/engines/chrome-governor.ts | S |
| GAP-059 | chrome-management | Interface not implemented: HarnessResult | src/engines/chrome-governor.ts | S |
| GAP-060 | chrome-management | Interface not implemented: HarnessDAG | src/engines/chrome-governor.ts | S |
| GAP-061 | chrome-management | Interface not implemented: SlaveHealth | src/engines/chrome-governor.ts | S |
| GAP-062 | chrome-management | Interface not implemented: GovernorEventBus | src/engines/chrome-governor.ts | S |
| GAP-063 | chrome-management | Interface not implemented: CDPTransport | src/engines/chrome-governor.ts | S |
| GAP-064 | chrome-management | Interface not implemented: CircuitBreaker | src/engines/chrome-governor.ts | S |
| GAP-065 | configuration | Interface not implemented: ConfigEventBus | src/engines/config-manager.ts | S |
| GAP-066 | configuration | Interface not implemented: ConfigAuditEntry | src/engines/config-manager.ts | S |
| GAP-067 | session-state | Interface not implemented: ResolvedCapabilities | src/engines/conversation-manager.ts | S |
| GAP-068 | session-state | Interface not implemented: ResolvedCapability | src/engines/conversation-manager.ts | S |
| GAP-069 | session-state | Interface not implemented: CapabilityResolutionEngine | src/engines/conversation-manager.ts | S |
| GAP-070 | session-state | Interface not implemented: StreamBlockStore | src/engines/conversation-manager.ts | S |
| GAP-071 | session-state | Interface not implemented: ConversationContext | src/engines/conversation-manager.ts | S |
| GAP-072 | session-state | Interface not implemented: SendResult | src/engines/conversation-manager.ts | S |
| GAP-073 | general | Interface not implemented: MemoizerEventBus | src/engines/execution-memoizer.ts | S |
| GAP-074 | general | Interface not implemented: MemoizerConfig | src/engines/execution-memoizer.ts | S |
| GAP-075 | general | Interface not implemented: CacheEntry | src/engines/execution-memoizer.ts | S |
| GAP-076 | general | Interface not implemented: MemoizerStats | src/engines/execution-memoizer.ts | S |
| GAP-077 | general | Interface not implemented: HarnessCheckpointRow | src/engines/harness-checkpoint.ts | S |
| GAP-078 | general | Interface not implemented: CheckpointInput | src/engines/harness-checkpoint.ts | S |
| GAP-079 | general | Interface not implemented: HarnessCheckpointStore | src/engines/harness-checkpoint.ts | S |
| GAP-080 | general | Interface not implemented: PromptContext | src/engines/harness-protocol-engine.ts | S |
| GAP-081 | general | Interface not implemented: ExtractedResponse | src/engines/harness-protocol-engine.ts | S |
| GAP-082 | general | Interface not implemented: HarnessProtocolConfig | src/engines/harness-protocol-engine.ts | S |
| GAP-083 | general | Interface not implemented: HarnessCondition | src/engines/harness-runtime.ts | S |
| GAP-084 | general | Interface not implemented: HarnessContext | src/engines/harness-runtime.ts | S |
| GAP-085 | general | Interface not implemented: HarnessModuleResult | src/engines/harness-runtime.ts | S |
| GAP-086 | general | Interface not implemented: HarnessTelemetryEvent | src/engines/harness-runtime.ts | S |
| GAP-087 | general | Interface not implemented: HarnessProgressEvent | src/engines/harness-runtime.ts | S |
| GAP-088 | general | Interface not implemented: Element | src/engines/harness-runtime.ts | S |
| GAP-089 | general | Interface not implemented: HarnessDAG | src/engines/harness-runtime.ts | S |
| GAP-090 | general | Interface not implemented: HarnessResult | src/engines/harness-runtime.ts | S |
| GAP-091 | general | Interface not implemented: ProviderManifest | src/engines/manifest-inference.ts | S |
| GAP-092 | general | Interface not implemented: InferredManifest | src/engines/manifest-inference.ts | S |
| GAP-093 | general | Interface not implemented: ValidationResult | src/engines/manifest-inference.ts | S |
| GAP-094 | cli | Interface not implemented: ToolDefinition | src/engines/mcp-client-adapter.ts | S |
| GAP-095 | cli | Interface not implemented: ToolResult | src/engines/mcp-client-adapter.ts | S |
| GAP-096 | cli | Interface not implemented: McpServerConnection | src/engines/mcp-client-adapter.ts | S |
| GAP-097 | api-server | Interface not implemented: McpToolDefinition | src/engines/mcp-server-adapter.ts | S |
| GAP-098 | api-server | Interface not implemented: McpToolCallResult | src/engines/mcp-server-adapter.ts | S |
| GAP-099 | api-server | Interface not implemented: McpServerConfig | src/engines/mcp-server-adapter.ts | S |
| GAP-100 | general | Interface not implemented: EpisodicMemory | src/engines/memory-engine.ts | S |
| GAP-101 | general | Interface not implemented: EpisodicMemoryInput | src/engines/memory-engine.ts | S |
| GAP-102 | general | Interface not implemented: SemanticMemory | src/engines/memory-engine.ts | S |
| GAP-103 | general | Interface not implemented: SemanticMemoryInput | src/engines/memory-engine.ts | S |
| GAP-104 | general | Interface not implemented: ProceduralRule | src/engines/memory-engine.ts | S |
| GAP-105 | general | Interface not implemented: ProceduralRuleInput | src/engines/memory-engine.ts | S |
| GAP-106 | general | Interface not implemented: EpisodeQueryOpts | src/engines/memory-engine.ts | S |
| GAP-107 | general | Interface not implemented: RuleContext | src/engines/memory-engine.ts | S |
| GAP-108 | general | Interface not implemented: AgentMemoryContext | src/engines/memory-engine.ts | S |
| GAP-109 | general | Interface not implemented: MiningResult | src/engines/memory-engine.ts | S |
| GAP-110 | general | Interface not implemented: MirrorStateRow | src/engines/mirror-engine.ts | S |
| GAP-111 | general | Interface not implemented: MirrorStateInput | src/engines/mirror-engine.ts | S |
| GAP-112 | general | Interface not implemented: OptimisticUpdateRow | src/engines/mirror-engine.ts | S |
| GAP-113 | general | Interface not implemented: OptimisticUpdateInput | src/engines/mirror-engine.ts | S |
| GAP-114 | general | Interface not implemented: LatencyMeasurementInput | src/engines/mirror-engine.ts | S |
| GAP-115 | general | Interface not implemented: LatencyReport | src/engines/mirror-engine.ts | S |
| GAP-116 | general | Interface not implemented: SnapshotRow | src/engines/mirror-engine.ts | S |
| GAP-117 | general | Interface not implemented: SnapshotInput | src/engines/mirror-engine.ts | S |
| GAP-118 | general | Interface not implemented: MirrorAction | src/engines/mirror-engine.ts | S |
| GAP-119 | general | Interface not implemented: ActionResult | src/engines/mirror-engine.ts | S |
| GAP-120 | general | Interface not implemented: ObservationOptions | src/engines/mirror-engine.ts | S |
| GAP-121 | general | Interface not implemented: MirrorState | src/engines/mirror-engine.ts | S |
| GAP-122 | general | Interface not implemented: BudgetResult | src/engines/mirror-engine.ts | S |
| GAP-123 | general | Interface not implemented: ObservationOptions | src/engines/observation-tap.ts | S |
| GAP-124 | general | Interface not implemented: ObservationEvent | src/engines/observation-tap.ts | S |
| GAP-125 | general | Interface not implemented: ProviderPlugin | src/engines/plugin-system.ts | S |
| GAP-126 | provider-routing | Interface not implemented: DiscoveryOptions | src/engines/provider-discovery.ts | S |
| GAP-127 | provider-routing | Interface not implemented: DiscoverySession | src/engines/provider-discovery.ts | S |
| GAP-128 | provider-routing | Interface not implemented: ProviderManifestDraft | src/engines/provider-discovery.ts | S |
| GAP-129 | provider-routing | Interface not implemented: ManifestEdits | src/engines/provider-discovery.ts | S |
| GAP-130 | provider-routing | Interface not implemented: RegisterResult | src/engines/provider-discovery.ts | S |
| GAP-131 | provider-routing | Interface not implemented: InteractiveDiscoverySession | src/engines/provider-discovery.ts | S |
| GAP-132 | provider-routing | Interface not implemented: ProviderSignal | src/engines/provider-health.ts | S |
| GAP-133 | provider-routing | Interface not implemented: ProviderHealth | src/engines/provider-health.ts | S |
| GAP-134 | provider-routing | Interface not implemented: ProviderRegistrarEventBus | src/engines/provider-registrar.ts | S |
| GAP-135 | provider-routing | Interface not implemented: RegisterResult | src/engines/provider-registrar.ts | S |
| GAP-136 | provider-routing | Interface not implemented: SeedAllResult | src/engines/provider-registrar.ts | S |
| GAP-137 | provider-routing | Interface not implemented: VerifyResult | src/engines/provider-registrar.ts | S |
| GAP-138 | provider-routing | Interface not implemented: ProviderRegistrarAuditor | src/engines/provider-registrar.ts | S |
| GAP-139 | observability | Interface not implemented: AuditorConfig | src/engines/registration-auditor.ts | S |
| GAP-140 | observability | Interface not implemented: AuditorEventBus | src/engines/registration-auditor.ts | S |
| GAP-141 | observability | Interface not implemented: ConfigManager | src/engines/registration-auditor.ts | S |
| GAP-142 | observability | Interface not implemented: UpsertResult | src/engines/registration-auditor.ts | S |
| GAP-143 | observability | Interface not implemented: AuditResult | src/engines/registration-auditor.ts | S |
| GAP-144 | observability | Interface not implemented: SeedAuditResult | src/engines/registration-auditor.ts | S |
| GAP-145 | observability | Interface not implemented: DriftDetectionResult | src/engines/registration-auditor.ts | S |
| GAP-146 | general | Interface not implemented: HealResult | src/engines/selector-healer.ts | S |
| GAP-147 | general | Interface not implemented: SelectorHealerConfig | src/engines/selector-healer.ts | S |
| GAP-148 | general | Interface not implemented: AccessibilityNode | src/engines/semantic-grounding.ts | S |
| GAP-149 | general | Interface not implemented: ResolvedElement | src/engines/semantic-grounding.ts | S |
| GAP-150 | general | Interface not implemented: ScreenshotRegion | src/engines/semantic-grounding.ts | S |
| GAP-151 | session-state | Interface not implemented: SessionCheckpointStore | src/engines/session-checkpoint.ts | S |
| GAP-152 | general | Interface not implemented: StateTransitionInput | src/engines/state-transition.ts | S |
| GAP-153 | general | Interface not implemented: StateTransitionRow | src/engines/state-transition.ts | S |
| GAP-154 | general | Interface not implemented: StateTransitionStore | src/engines/state-transition.ts | S |
| GAP-155 | session-state | Interface not implemented: ParseResult | src/engines/stream-parser.ts | S |
| GAP-156 | session-state | Interface not implemented: ParserConfig | src/engines/stream-parser.ts | S |
| GAP-157 | general | Interface not implemented: StreamingEvent | src/engines/streaming-protocol.ts | S |
| GAP-158 | observability | Interface not implemented: AggregationMetric | src/engines/telemetry-aggregator.ts | S |
| GAP-159 | observability | Interface not implemented: AggregationSchedule | src/engines/telemetry-aggregator.ts | S |
| GAP-160 | observability | Interface not implemented: RetentionRule | src/engines/telemetry-aggregator.ts | S |
| GAP-161 | observability | Interface not implemented: RetentionPolicy | src/engines/telemetry-aggregator.ts | S |
| GAP-162 | observability | Interface not implemented: TelemetryPipelineSettings | src/engines/telemetry-aggregator.ts | S |
| GAP-163 | observability | Interface not implemented: TelemetryPipelineConfig | src/engines/telemetry-aggregator.ts | S |
| GAP-164 | observability | Interface not implemented: CycleResult | src/engines/telemetry-aggregator.ts | S |
| GAP-165 | observability | Interface not implemented: RetentionResult | src/engines/telemetry-aggregator.ts | S |
| GAP-166 | observability | Interface not implemented: TrendPoint | src/engines/telemetry-aggregator.ts | S |
| GAP-167 | general | Interface not implemented: ToolDefinition | src/engines/tool-use-protocol.ts | S |
| GAP-168 | general | Interface not implemented: ToolResult | src/engines/tool-use-protocol.ts | S |
| GAP-169 | general | Interface not implemented: ToolUseProtocol | src/engines/tool-use-protocol.ts | S |
| GAP-170 | general | Interface not implemented: TransferCandidate | src/engines/transfer-accelerator.ts | S |
| GAP-171 | general | Interface not implemented: TransferAttemptResult | src/engines/transfer-accelerator.ts | S |
| GAP-172 | general | Interface not implemented: BatchTransferResult | src/engines/transfer-accelerator.ts | S |
| GAP-173 | general | Interface not implemented: ProviderCapabilityStore | src/engines/transfer-accelerator.ts | S |
| GAP-174 | general | Interface not implemented: VersionConfig | src/engines/version-manager.ts | S |
| GAP-175 | general | Interface not implemented: PromotionCondition | src/engines/version-manager.ts | S |
| GAP-176 | general | Interface not implemented: PromotionRule | src/engines/version-manager.ts | S |
| GAP-177 | general | Interface not implemented: DegradationRule | src/engines/version-manager.ts | S |
| GAP-178 | general | Interface not implemented: VersionComparison | src/engines/version-manager.ts | S |
| GAP-179 | general | Interface not implemented: PromotionTimeline | src/engines/version-manager.ts | S |
| GAP-180 | general | Interface not implemented: CompiledWorkflow | src/engines/workflow-compiler.ts | S |
| GAP-181 | general | Interface not implemented: CompileError | src/engines/workflow-compiler.ts | S |
| GAP-182 | general | Interface not implemented: CompileResult | src/engines/workflow-compiler.ts | S |
| GAP-183 | general | Interface not implemented: WorkflowNode | src/engines/workflow-engine.ts | S |
| GAP-184 | general | Interface not implemented: WorkflowEdge | src/engines/workflow-engine.ts | S |
| GAP-185 | general | Interface not implemented: WorkflowDefinition | src/engines/workflow-engine.ts | S |
| GAP-186 | general | Interface not implemented: NodeExecution | src/engines/workflow-engine.ts | S |
| GAP-187 | general | Interface not implemented: WorkflowExecution | src/engines/workflow-engine.ts | S |
| GAP-188 | general | Interface not implemented: WorkflowStore | src/engines/workflow-engine.ts | S |
| GAP-189 | general | Interface not implemented: McpClientAdapter | src/engines/workflow-engine.ts | S |
| GAP-190 | chrome-management | Interface not implemented: CdpClientOptions | src/executor/cdp-types.ts | S |
| GAP-191 | chrome-management | Interface not implemented: CommandOptions | src/executor/cdp-types.ts | S |
| GAP-192 | general | Interface not implemented: ContentBlock | src/executor/content-blocks.ts | S |
| GAP-193 | chrome-management | Interface not implemented: FleetConfig | src/executor/fleet-config.ts | S |
| GAP-194 | chrome-management | Interface not implemented: FleetSupervisorOptions | src/executor/fleet-supervisor.ts | S |
| GAP-195 | chrome-management | Interface not implemented: FleetSpawnOptions | src/executor/fleet-supervisor.ts | S |
| GAP-196 | chrome-management | Interface not implemented: FleetInstance | src/executor/fleet-supervisor.ts | S |
| GAP-197 | chrome-management | Interface not implemented: HealthProbeResult | src/executor/fleet-supervisor.ts | S |
| GAP-198 | general | Interface not implemented: LaunchResult | src/executor/launcher.ts | S |
| GAP-199 | general | Interface not implemented: ChromeLaunchOptions | src/executor/launcher.ts | S |
| GAP-200 | chrome-management | Interface not implemented: PortReaperOptions | src/executor/port-reaper.ts | S |
| GAP-201 | chrome-management | Interface not implemented: ReapResult | src/executor/port-reaper.ts | S |
| GAP-202 | chrome-management | Interface not implemented: OrphanInfo | src/executor/port-reaper.ts | S |
| GAP-203 | api-server | Interface not implemented: RouteInput | src/router/router.ts | S |
| GAP-204 | api-server | Interface not implemented: RouteResult | src/router/router.ts | S |
| GAP-205 | api-server | Interface not implemented: RouteDispatcher | src/router/router.ts | S |
| GAP-206 | schema | Interface not implemented: AlertCondition | src/schema/automation.ts | S |
| GAP-207 | schema | Interface not implemented: AlertEvent | src/schema/automation.ts | S |
| GAP-208 | schema | Interface not implemented: AutomationSchedule | src/schema/automation.ts | S |
| GAP-209 | schema | Interface not implemented: AutomationRun | src/schema/automation.ts | S |
| GAP-210 | schema | Interface not implemented: DiscoveryObjective | src/schema/automation.ts | S |
| GAP-211 | chrome-management | Interface not implemented: LaunchOptions | src/schema/chrome.ts | S |
| GAP-212 | chrome-management | Interface not implemented: ChromeSlave | src/schema/chrome.ts | S |
| GAP-213 | chrome-management | Interface not implemented: CDPCommand | src/schema/chrome.ts | S |
| GAP-214 | chrome-management | Interface not implemented: CDPResult | src/schema/chrome.ts | S |
| GAP-215 | configuration | Interface not implemented: ConfigEntry | src/schema/config.ts | S |
| GAP-216 | configuration | Interface not implemented: ConfigAuditEntry | src/schema/config.ts | S |
| GAP-217 | configuration | Interface not implemented: ConfigSchema | src/schema/config.ts | S |
| GAP-218 | schema | Interface not implemented: CapabilityTaxonomy | src/schema/core.ts | S |
| GAP-219 | schema | Interface not implemented: Binding | src/schema/core.ts | S |
| GAP-220 | schema | Interface not implemented: Program | src/schema/core.ts | S |
| GAP-221 | schema | Interface not implemented: Outcome | src/schema/core.ts | S |
| GAP-222 | schema | Interface not implemented: SelectorStrategy | src/schema/core.ts | S |
| GAP-223 | schema | Interface not implemented: HarnessNode | src/schema/harness.ts | S |
| GAP-224 | schema | Interface not implemented: HarnessDAG | src/schema/harness.ts | S |
| GAP-225 | schema | Interface not implemented: HarnessModule | src/schema/harness.ts | S |
| GAP-226 | schema | Interface not implemented: HarnessTelemetry | src/schema/harness.ts | S |
| GAP-227 | schema | Interface not implemented: HarnessCheckpoint | src/schema/harness.ts | S |
| GAP-228 | schema | Interface not implemented: ProviderHealthReport | src/schema/health.ts | S |
| GAP-229 | schema | Interface not implemented: HealthSignal | src/schema/health.ts | S |
| GAP-230 | schema | Interface not implemented: HealthHistory | src/schema/health.ts | S |
| GAP-231 | schema | Interface not implemented: LearningEvent | src/schema/learning.ts | S |
| GAP-232 | schema | Interface not implemented: Rule | src/schema/learning.ts | S |
| GAP-233 | schema | Interface not implemented: BindingEvent | src/schema/learning.ts | S |
| GAP-234 | provider-routing | Interface not implemented: ProviderDefinition | src/schema/provider.ts | S |
| GAP-235 | provider-routing | Interface not implemented: ProviderEndpoint | src/schema/provider.ts | S |
| GAP-236 | provider-routing | Interface not implemented: ProviderAccount | src/schema/provider.ts | S |
| GAP-237 | provider-routing | Interface not implemented: ProviderParser | src/schema/provider.ts | S |
| GAP-238 | provider-routing | Interface not implemented: RouteSpec | src/schema/routing.ts | S |
| GAP-239 | provider-routing | Interface not implemented: RouteRequest | src/schema/routing.ts | S |
| GAP-240 | provider-routing | Interface not implemented: RouteTarget | src/schema/routing.ts | S |
| GAP-241 | provider-routing | Interface not implemented: RouteEvent | src/schema/routing.ts | S |
| GAP-242 | session-state | Interface not implemented: VivimSession | src/schema/session.ts | S |
| GAP-243 | session-state | Interface not implemented: ProviderSession | src/schema/session.ts | S |
| GAP-244 | session-state | Interface not implemented: ProfileSession | src/schema/session.ts | S |
| GAP-245 | session-state | Interface not implemented: Conversation | src/schema/session.ts | S |
| GAP-246 | session-state | Interface not implemented: ConversationMessage | src/schema/session.ts | S |
| GAP-247 | schema | Interface not implemented: TelemetryPipelineConfig | src/schema/telemetry.ts | S |
| GAP-248 | schema | Interface not implemented: TelemetrySchedule | src/schema/telemetry.ts | S |
| GAP-249 | schema | Interface not implemented: TelemetryRetention | src/schema/telemetry.ts | S |
| GAP-250 | schema | Interface not implemented: TransferPattern | src/schema/transfer.ts | S |
| GAP-251 | schema | Interface not implemented: TransferCandidate | src/schema/transfer.ts | S |
| GAP-252 | schema | Interface not implemented: TransferAttempt | src/schema/transfer.ts | S |
| GAP-253 | schema | Interface not implemented: MigrationLogRow | src/schema/types.ts | S |
| GAP-254 | schema | Interface not implemented: ProviderDefinitionRow | src/schema/types.ts | S |
| GAP-255 | schema | Interface not implemented: ProviderEndpointRow | src/schema/types.ts | S |
| GAP-256 | schema | Interface not implemented: ProviderParserRow | src/schema/types.ts | S |
| GAP-257 | schema | Interface not implemented: ProviderCapabilityRow | src/schema/types.ts | S |
| GAP-258 | schema | Interface not implemented: ProviderConfigRow | src/schema/types.ts | S |
| GAP-259 | schema | Interface not implemented: ProviderModelRow | src/schema/types.ts | S |
| GAP-260 | schema | Interface not implemented: ProviderAccountRow | src/schema/types.ts | S |
| GAP-261 | schema | Interface not implemented: TraceEntryRow | src/schema/types.ts | S |
| GAP-262 | schema | Interface not implemented: CapabilityTaxonomyRow | src/schema/types.ts | S |
| GAP-263 | schema | Interface not implemented: CapabilityTierRow | src/schema/types.ts | S |
| GAP-264 | schema | Interface not implemented: CapabilityBindingRow | src/schema/types.ts | S |
| GAP-265 | schema | Interface not implemented: CapabilityProgramRow | src/schema/types.ts | S |
| GAP-266 | schema | Interface not implemented: SelectorStrategyRow | src/schema/types.ts | S |
| GAP-267 | schema | Interface not implemented: OutcomeRow | src/schema/types.ts | S |
| GAP-268 | schema | Interface not implemented: VivimSessionRow | src/schema/types.ts | S |
| GAP-269 | schema | Interface not implemented: ProviderSessionRow | src/schema/types.ts | S |
| GAP-270 | schema | Interface not implemented: ProfileSessionRow | src/schema/types.ts | S |
| GAP-271 | schema | Interface not implemented: ConversationRow | src/schema/types.ts | S |
| GAP-272 | schema | Interface not implemented: ConversationMessageRow | src/schema/types.ts | S |
| GAP-273 | schema | Interface not implemented: StateTransitionRow | src/schema/types.ts | S |
| GAP-274 | schema | Interface not implemented: SessionCheckpointRow | src/schema/types.ts | S |
| GAP-275 | schema | Interface not implemented: StreamBlockRow | src/schema/types.ts | S |
| GAP-276 | schema | Interface not implemented: ProviderManifestVersionRow | src/schema/types.ts | S |
| GAP-277 | schema | Interface not implemented: RegistrationEventRow | src/schema/types.ts | S |
| GAP-278 | schema | Interface not implemented: ManifestDriftRow | src/schema/types.ts | S |
| GAP-279 | schema | Interface not implemented: BindingStatusLogRow | src/schema/types.ts | S |
| GAP-280 | schema | Interface not implemented: ProgramVersionMetricRow | src/schema/types.ts | S |
| GAP-281 | schema | Interface not implemented: HealthHistoryRow | src/schema/types.ts | S |
| GAP-282 | schema | Interface not implemented: ConfigEntryRow | src/schema/types.ts | S |
| GAP-283 | schema | Interface not implemented: ConfigAuditRow | src/schema/types.ts | S |
| GAP-284 | schema | Interface not implemented: ManifestVersionInput | src/schema/types.ts | S |
| GAP-285 | schema | Interface not implemented: RegistrationEventInput | src/schema/types.ts | S |
| GAP-286 | schema | Interface not implemented: ManifestDriftInput | src/schema/types.ts | S |
| GAP-287 | schema | Interface not implemented: RouteSpecRow | src/schema/types.ts | S |
| GAP-288 | schema | Interface not implemented: RouteRequestRow | src/schema/types.ts | S |
| GAP-289 | schema | Interface not implemented: RouteTargetRow | src/schema/types.ts | S |
| GAP-290 | schema | Interface not implemented: RouteEventRow | src/schema/types.ts | S |
| GAP-291 | schema | Interface not implemented: VersionConfig | src/schema/versioning.ts | S |
| GAP-292 | schema | Interface not implemented: PromotionRule | src/schema/versioning.ts | S |
| GAP-293 | schema | Interface not implemented: DegradationRule | src/schema/versioning.ts | S |
| GAP-294 | schema | Interface not implemented: ProviderManifestVersion | src/schema/versioning.ts | S |
| GAP-295 | api-server | Interface not implemented: ServerContext | src/server/index.ts | S |
| GAP-296 | api-server | Interface not implemented: WsLike | src/server/websocket.ts | S |
| GAP-297 | capability-system | Interface not implemented: RawResolutionRow | src/storage/contracts/capability-resolution-store.ts | S |
| GAP-298 | capability-system | Interface not implemented: CapabilityResolutionStore | src/storage/contracts/capability-resolution-store.ts | S |
| GAP-299 | capability-system | Interface not implemented: CapabilityTaxonomyRow | src/storage/contracts/capability-store.ts | S |
| GAP-300 | capability-system | Interface not implemented: CapabilityBindingRow | src/storage/contracts/capability-store.ts | S |
| GAP-301 | capability-system | Interface not implemented: CapabilityProgramRow | src/storage/contracts/capability-store.ts | S |
| GAP-302 | capability-system | Interface not implemented: SelectorStrategyRow | src/storage/contracts/capability-store.ts | S |
| GAP-303 | capability-system | Interface not implemented: OutcomeRow | src/storage/contracts/capability-store.ts | S |
| GAP-304 | capability-system | Interface not implemented: OutcomeInput | src/storage/contracts/capability-store.ts | S |
| GAP-305 | capability-system | Interface not implemented: CapabilityStore | src/storage/contracts/capability-store.ts | S |
| GAP-306 | configuration | Interface not implemented: ConfigEntryRow | src/storage/contracts/config-store.ts | S |
| GAP-307 | configuration | Interface not implemented: ConfigAuditRow | src/storage/contracts/config-store.ts | S |
| GAP-308 | configuration | Interface not implemented: ConfigStore | src/storage/contracts/config-store.ts | S |
| GAP-309 | session-state | Interface not implemented: ConversationRow | src/storage/contracts/conversation-store.ts | S |
| GAP-310 | session-state | Interface not implemented: ConversationMessageRow | src/storage/contracts/conversation-store.ts | S |
| GAP-311 | session-state | Interface not implemented: ProviderAccountRow | src/storage/contracts/conversation-store.ts | S |
| GAP-312 | session-state | Interface not implemented: ConversationInput | src/storage/contracts/conversation-store.ts | S |
| GAP-313 | session-state | Interface not implemented: MessageInput | src/storage/contracts/conversation-store.ts | S |
| GAP-314 | storage | Interface not implemented: ProviderAccountRow | src/storage/contracts/governor-store.ts | S |
| GAP-315 | storage | Interface not implemented: FleetEventRow | src/storage/contracts/governor-store.ts | S |
| GAP-316 | storage | Interface not implemented: CircuitBreakerStateRow | src/storage/contracts/governor-store.ts | S |
| GAP-317 | storage | Interface not implemented: HealthTickRow | src/storage/contracts/governor-store.ts | S |
| GAP-318 | storage | Interface not implemented: TraceEntryRow | src/storage/contracts/governor-store.ts | S |
| GAP-319 | storage | Interface not implemented: FleetEventInput | src/storage/contracts/governor-store.ts | S |
| GAP-320 | storage | Interface not implemented: TraceEntryInput | src/storage/contracts/governor-store.ts | S |
| GAP-321 | storage | Interface not implemented: DriftEvent | src/storage/contracts/health-store.ts | S |
| GAP-322 | storage | Interface not implemented: CapabilityHealthRow | src/storage/contracts/health-store.ts | S |
| GAP-323 | storage | Interface not implemented: ParserWindowRow | src/storage/contracts/health-store.ts | S |
| GAP-324 | storage | Interface not implemented: HealthStore | src/storage/contracts/health-store.ts | S |
| GAP-325 | session-state | Interface not implemented: HpeSession | src/storage/contracts/hpe-session-store.ts | S |
| GAP-326 | session-state | Interface not implemented: HpeSessionStoreContract | src/storage/contracts/hpe-session-store.ts | S |
| GAP-327 | storage | Interface not implemented: ProviderParserRow | src/storage/contracts/parser-store.ts | S |
| GAP-328 | storage | Interface not implemented: ParserStore | src/storage/contracts/parser-store.ts | S |
| GAP-329 | provider-routing | Interface not implemented: ProviderStore | src/storage/contracts/provider-store.ts | S |
| GAP-330 | storage | Interface not implemented: RegistrationStore | src/storage/contracts/registration-store.ts | S |
| GAP-331 | api-server | Interface not implemented: RouterStore | src/storage/contracts/router-store.ts | S |
| GAP-332 | storage | Interface not implemented: StreamBlockRow | src/storage/contracts/stream-block-store.ts | S |
| GAP-333 | storage | Interface not implemented: HealthHistoryRow | src/storage/contracts/telemetry-store.ts | S |
| GAP-334 | storage | Interface not implemented: SelectorHealthRow | src/storage/contracts/telemetry-store.ts | S |
| GAP-335 | storage | Interface not implemented: DailySummaryRow | src/storage/contracts/telemetry-store.ts | S |
| GAP-336 | storage | Interface not implemented: CrossProviderSummary | src/storage/contracts/telemetry-store.ts | S |
| GAP-337 | storage | Interface not implemented: ManifestChangeInput | src/storage/contracts/telemetry-store.ts | S |
| GAP-338 | storage | Interface not implemented: ManifestChangeRow | src/storage/contracts/telemetry-store.ts | S |
| GAP-339 | storage | Interface not implemented: TaxonomyVersionRow | src/storage/contracts/version-store.ts | S |
| GAP-340 | storage | Interface not implemented: TaxonomyVersionInput | src/storage/contracts/version-store.ts | S |
| GAP-341 | storage | Interface not implemented: StatusLogRow | src/storage/contracts/version-store.ts | S |
| GAP-342 | storage | Interface not implemented: StatusLogInput | src/storage/contracts/version-store.ts | S |
| GAP-343 | storage | Interface not implemented: ProgramMetricRow | src/storage/contracts/version-store.ts | S |
| GAP-344 | storage | Interface not implemented: ProgramMetricInput | src/storage/contracts/version-store.ts | S |
| GAP-345 | storage | Interface not implemented: PrismaClientLike | src/storage/impl/prisma-like.ts | S |
| GAP-346 | general | Interface partial: AlertStore (6 methods missing) | src/alerting/alerter.ts | S |
| GAP-347 | capability-system | Interface partial: CapabilityMacroStore (3 methods missing) | src/engines/capability-macro.ts | S |
| GAP-348 | general | Interface partial: MirrorStore (4 methods missing) | src/engines/mirror-engine.ts | S |
| GAP-349 | session-state | Interface partial: ParserModule (1 methods missing) | src/engines/stream-parser.ts | S |
| GAP-350 | session-state | Interface partial: ConversationStore (6 methods missing) | src/engines/conversation-manager.ts | S |
| GAP-351 | storage | Interface partial: GovernorStore (10 methods missing) | src/engines/chrome-governor.ts | S |
| GAP-352 | storage | Interface partial: StreamBlockStoreContract (1 methods missing) | src/engines/stream-block-store.ts | S |
| GAP-353 | storage | Interface partial: TelemetryStore (5 methods missing) | src/engines/telemetry-aggregator.ts | S |
| GAP-354 | storage | Interface partial: VersionStore (8 methods missing) | src/engines/version-manager.ts | S |

---

## All Gaps

### GAP-008: Design claim violated: harness.ts

| Field | Value |
|---|---|
| Severity | HIGH |
| Domain | general |
| Type | DESIGN_CLAIM_VIOLATED |
| File | harness.ts |
| Interface | - |
| Design Doc | 08-merged-implementation.md |
| Effort | S |

Design doc "08-merged-implementation.md" claims harness.ts exists at line 105, but actual code is a stub or interface-only.

**Recommended Action:** Implement harness.ts to match design doc spec

---

### GAP-009: Design claim violated: mirror-engine

| Field | Value |
|---|---|
| Severity | HIGH |
| Domain | general |
| Type | DESIGN_CLAIM_VIOLATED |
| File | src/engines/mirror-engine.ts |
| Interface | - |
| Design Doc | sota-08-implementation-glossary-delta.md |
| Effort | S |

Design doc "sota-08-implementation-glossary-delta.md" claims mirror-engine exists at line 17, but actual code is a stub or interface-only.

**Recommended Action:** Implement mirror-engine to match design doc spec

---

### GAP-010: Design claim violated: workflow-engine

| Field | Value |
|---|---|
| Severity | HIGH |
| Domain | general |
| Type | DESIGN_CLAIM_VIOLATED |
| File | src/engines/workflow-engine.ts |
| Interface | - |
| Design Doc | sota-08-implementation-glossary-delta.md |
| Effort | S |

Design doc "sota-08-implementation-glossary-delta.md" claims workflow-engine exists at line 90, but actual code is a stub or interface-only.

**Recommended Action:** Implement workflow-engine to match design doc spec

---

### GAP-001: Mixed file: src/engines/chrome-governor.ts

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | chrome-management |
| Type | PARTIAL_IMPL |
| File | src/engines/chrome-governor.ts |
| Interface | - |
| Design Doc | - |
| Effort | S |

File has 78 real markers and 2 stub markers. Partially implemented.

**Recommended Action:** Complete implementation of stub methods in src/engines/chrome-governor.ts

---

### GAP-002: Mixed file: src/engines/mcp-server-adapter.ts

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | api-server |
| Type | PARTIAL_IMPL |
| File | src/engines/mcp-server-adapter.ts |
| Interface | - |
| Design Doc | - |
| Effort | S |

File has 7 real markers and 1 stub markers. Partially implemented.

**Recommended Action:** Complete implementation of stub methods in src/engines/mcp-server-adapter.ts

---

### GAP-003: Mixed file: src/engines/mirror-engine.ts

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | PARTIAL_IMPL |
| File | src/engines/mirror-engine.ts |
| Interface | - |
| Design Doc | - |
| Effort | S |

File has 15 real markers and 3 stub markers. Partially implemented.

**Recommended Action:** Complete implementation of stub methods in src/engines/mirror-engine.ts

---

### GAP-004: Mixed file: src/engines/provider-health.ts

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | provider-routing |
| Type | PARTIAL_IMPL |
| File | src/engines/provider-health.ts |
| Interface | - |
| Design Doc | - |
| Effort | S |

File has 41 real markers and 1 stub markers. Partially implemented.

**Recommended Action:** Complete implementation of stub methods in src/engines/provider-health.ts

---

### GAP-005: Mixed file: src/engines/semantic-grounding.ts

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | PARTIAL_IMPL |
| File | src/engines/semantic-grounding.ts |
| Interface | - |
| Design Doc | - |
| Effort | S |

File has 112 real markers and 5 stub markers. Partially implemented.

**Recommended Action:** Complete implementation of stub methods in src/engines/semantic-grounding.ts

---

### GAP-006: Mixed file: src/engines/workflow-engine.ts

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | PARTIAL_IMPL |
| File | src/engines/workflow-engine.ts |
| Interface | - |
| Design Doc | - |
| Effort | S |

File has 59 real markers and 4 stub markers. Partially implemented.

**Recommended Action:** Complete implementation of stub methods in src/engines/workflow-engine.ts

---

### GAP-007: Mixed file: src/router/router.ts

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | api-server |
| Type | PARTIAL_IMPL |
| File | src/router/router.ts |
| Interface | - |
| Design Doc | - |
| Effort | S |

File has 19 real markers and 2 stub markers. Partially implemented.

**Recommended Action:** Complete implementation of stub methods in src/router/router.ts

---

### GAP-011: Design claim unverifiable: claude.json

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | provider-routing |
| Type | DESIGN_CLAIM_UNVERIFIABLE |
| File | seeds/providers/claude.json |
| Interface | - |
| Design Doc | 08-merged-implementation.md |
| Effort | S |

Design doc "08-merged-implementation.md" mentions claude.json but no matching file found in codebase.

**Recommended Action:** Create seeds/providers/claude.json as specified in design doc

---

### GAP-012: Design claim unverifiable: account-registry.ts

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | DESIGN_CLAIM_UNVERIFIABLE |
| File | account-registry.ts |
| Interface | - |
| Design Doc | 08-merged-implementation.md |
| Effort | S |

Design doc "08-merged-implementation.md" mentions account-registry.ts but no matching file found in codebase.

**Recommended Action:** Create account-registry.ts as specified in design doc

---

### GAP-013: Design claim unverifiable: slave-write.ts

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | DESIGN_CLAIM_UNVERIFIABLE |
| File | slave-write.ts |
| Interface | - |
| Design Doc | 08-merged-implementation.md |
| Effort | S |

Design doc "08-merged-implementation.md" mentions slave-write.ts but no matching file found in codebase.

**Recommended Action:** Create slave-write.ts as specified in design doc

---

### GAP-014: Design claim unverifiable: slave-read.ts

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | DESIGN_CLAIM_UNVERIFIABLE |
| File | slave-read.ts |
| Interface | - |
| Design Doc | 08-merged-implementation.md |
| Effort | S |

Design doc "08-merged-implementation.md" mentions slave-read.ts but no matching file found in codebase.

**Recommended Action:** Create slave-read.ts as specified in design doc

---

### GAP-015: Design claim unverifiable: stream-capture.ts

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | DESIGN_CLAIM_UNVERIFIABLE |
| File | stream-capture.ts |
| Interface | - |
| Design Doc | 08-merged-implementation.md |
| Effort | S |

Design doc "08-merged-implementation.md" mentions stream-capture.ts but no matching file found in codebase.

**Recommended Action:** Create stream-capture.ts as specified in design doc

---

### GAP-016: Design claim unverifiable: network-capture.ts

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | DESIGN_CLAIM_UNVERIFIABLE |
| File | network-capture.ts |
| Interface | - |
| Design Doc | 08-merged-implementation.md |
| Effort | S |

Design doc "08-merged-implementation.md" mentions network-capture.ts but no matching file found in codebase.

**Recommended Action:** Create network-capture.ts as specified in design doc

---

### GAP-017: Design claim unverifiable: probe.ts

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | DESIGN_CLAIM_UNVERIFIABLE |
| File | probe.ts |
| Interface | - |
| Design Doc | 08-merged-implementation.md |
| Effort | S |

Design doc "08-merged-implementation.md" mentions probe.ts but no matching file found in codebase.

**Recommended Action:** Create probe.ts as specified in design doc

---

### GAP-018: Design claim unverifiable: loop.ts

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | DESIGN_CLAIM_UNVERIFIABLE |
| File | loop.ts |
| Interface | - |
| Design Doc | 08-merged-implementation.md |
| Effort | S |

Design doc "08-merged-implementation.md" mentions loop.ts but no matching file found in codebase.

**Recommended Action:** Create loop.ts as specified in design doc

---

### GAP-019: Design claim unverifiable: conversation-driver.ts

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | session-state |
| Type | DESIGN_CLAIM_UNVERIFIABLE |
| File | conversation-driver.ts |
| Interface | - |
| Design Doc | 08-merged-implementation.md |
| Effort | S |

Design doc "08-merged-implementation.md" mentions conversation-driver.ts but no matching file found in codebase.

**Recommended Action:** Create conversation-driver.ts as specified in design doc

---

### GAP-020: Design claim unverifiable: content-pipeline.ts

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | DESIGN_CLAIM_UNVERIFIABLE |
| File | content-pipeline.ts |
| Interface | - |
| Design Doc | 08-merged-implementation.md |
| Effort | S |

Design doc "08-merged-implementation.md" mentions content-pipeline.ts but no matching file found in codebase.

**Recommended Action:** Create content-pipeline.ts as specified in design doc

---

### GAP-021: Design claim unverifiable: provider-discovery-engine

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | provider-routing |
| Type | DESIGN_CLAIM_UNVERIFIABLE |
| File | src/engines/provider-discovery-engine.ts |
| Interface | - |
| Design Doc | sota-08-implementation-glossary-delta.md |
| Effort | S |

Design doc "sota-08-implementation-glossary-delta.md" mentions provider-discovery-engine but no matching file found in codebase.

**Recommended Action:** Create src/engines/provider-discovery-engine.ts as specified in design doc

---

### GAP-022: Design claim unverifiable: agentic-loop-engine

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | DESIGN_CLAIM_UNVERIFIABLE |
| File | src/engines/agentic-loop-engine.ts |
| Interface | - |
| Design Doc | sota-08-implementation-glossary-delta.md |
| Effort | S |

Design doc "sota-08-implementation-glossary-delta.md" mentions agentic-loop-engine but no matching file found in codebase.

**Recommended Action:** Create src/engines/agentic-loop-engine.ts as specified in design doc

---

### GAP-023: Interface not implemented: AlertConditionRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/alerting/alerter.ts |
| Interface | AlertConditionRow |
| Design Doc | - |
| Effort | S |

Interface AlertConditionRow in src/alerting/alerter.ts has no implementing class.

**Recommended Action:** Create implementing class for AlertConditionRow

---

### GAP-024: Interface not implemented: AlertEventRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/alerting/alerter.ts |
| Interface | AlertEventRow |
| Design Doc | - |
| Effort | S |

Interface AlertEventRow in src/alerting/alerter.ts has no implementing class.

**Recommended Action:** Create implementing class for AlertEventRow

---

### GAP-025: Interface not implemented: AutomationScheduleRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/automation/scheduler.ts |
| Interface | AutomationScheduleRow |
| Design Doc | - |
| Effort | S |

Interface AutomationScheduleRow in src/automation/scheduler.ts has no implementing class.

**Recommended Action:** Create implementing class for AutomationScheduleRow

---

### GAP-026: Interface not implemented: AutomationRunRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/automation/scheduler.ts |
| Interface | AutomationRunRow |
| Design Doc | - |
| Effort | S |

Interface AutomationRunRow in src/automation/scheduler.ts has no implementing class.

**Recommended Action:** Create implementing class for AutomationRunRow

---

### GAP-027: Interface not implemented: AutomationRunner

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/automation/scheduler.ts |
| Interface | AutomationRunner |
| Design Doc | - |
| Effort | S |

Interface AutomationRunner in src/automation/scheduler.ts has no implementing class.

**Recommended Action:** Create implementing class for AutomationRunner

---

### GAP-028: Interface not implemented: AutomationStore

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/automation/scheduler.ts |
| Interface | AutomationStore |
| Design Doc | - |
| Effort | S |

Interface AutomationStore in src/automation/scheduler.ts has no implementing class.

**Recommended Action:** Create implementing class for AutomationStore

---

### GAP-029: Interface not implemented: BackendBridgeOptions

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | cli |
| Type | INTERFACE_MISSING |
| File | src/cli/bridges/backend-bridge.ts |
| Interface | BackendBridgeOptions |
| Design Doc | - |
| Effort | S |

Interface BackendBridgeOptions in src/cli/bridges/backend-bridge.ts has no implementing class.

**Recommended Action:** Create implementing class for BackendBridgeOptions

---

### GAP-030: Interface not implemented: BridgeOptions

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | cli |
| Type | INTERFACE_MISSING |
| File | src/cli/bridges/cap-store-bridge.ts |
| Interface | BridgeOptions |
| Design Doc | - |
| Effort | S |

Interface BridgeOptions in src/cli/bridges/cap-store-bridge.ts has no implementing class.

**Recommended Action:** Create implementing class for BridgeOptions

---

### GAP-031: Interface not implemented: CliCommand

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | cli |
| Type | INTERFACE_MISSING |
| File | src/cli/command-registry.ts |
| Interface | CliCommand |
| Design Doc | - |
| Effort | S |

Interface CliCommand in src/cli/command-registry.ts has no implementing class.

**Recommended Action:** Create implementing class for CliCommand

---

### GAP-032: Interface not implemented: CliOutput

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | cli |
| Type | INTERFACE_MISSING |
| File | src/cli/command-registry.ts |
| Interface | CliOutput |
| Design Doc | - |
| Effort | S |

Interface CliOutput in src/cli/command-registry.ts has no implementing class.

**Recommended Action:** Create implementing class for CliOutput

---

### GAP-033: Interface not implemented: PipelineStep

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | cli |
| Type | INTERFACE_MISSING |
| File | src/cli/pipeline-engine.ts |
| Interface | PipelineStep |
| Design Doc | - |
| Effort | S |

Interface PipelineStep in src/cli/pipeline-engine.ts has no implementing class.

**Recommended Action:** Create implementing class for PipelineStep

---

### GAP-034: Interface not implemented: AgenticGoal

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/agentic-loop.ts |
| Interface | AgenticGoal |
| Design Doc | - |
| Effort | S |

Interface AgenticGoal in src/engines/agentic-loop.ts has no implementing class.

**Recommended Action:** Create implementing class for AgenticGoal

---

### GAP-035: Interface not implemented: AgenticLoopResult

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/agentic-loop.ts |
| Interface | AgenticLoopResult |
| Design Doc | - |
| Effort | S |

Interface AgenticLoopResult in src/engines/agentic-loop.ts has no implementing class.

**Recommended Action:** Create implementing class for AgenticLoopResult

---

### GAP-036: Interface not implemented: PlanningStrategy

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/agentic-loop.ts |
| Interface | PlanningStrategy |
| Design Doc | - |
| Effort | S |

Interface PlanningStrategy in src/engines/agentic-loop.ts has no implementing class.

**Recommended Action:** Create implementing class for PlanningStrategy

---

### GAP-037: Interface not implemented: WsLike

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | capability-system |
| Type | INTERFACE_MISSING |
| File | src/engines/capability-event-bus.ts |
| Interface | WsLike |
| Design Doc | - |
| Effort | S |

Interface WsLike in src/engines/capability-event-bus.ts has no implementing class.

**Recommended Action:** Create implementing class for WsLike

---

### GAP-038: Interface not implemented: CapabilityMacroRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | capability-system |
| Type | INTERFACE_MISSING |
| File | src/engines/capability-macro.ts |
| Interface | CapabilityMacroRow |
| Design Doc | - |
| Effort | S |

Interface CapabilityMacroRow in src/engines/capability-macro.ts has no implementing class.

**Recommended Action:** Create implementing class for CapabilityMacroRow

---

### GAP-039: Interface not implemented: MacroRunResult

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | capability-system |
| Type | INTERFACE_MISSING |
| File | src/engines/capability-macro.ts |
| Interface | MacroRunResult |
| Design Doc | - |
| Effort | S |

Interface MacroRunResult in src/engines/capability-macro.ts has no implementing class.

**Recommended Action:** Create implementing class for MacroRunResult

---

### GAP-040: Interface not implemented: HarnessRuntime

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | capability-system |
| Type | INTERFACE_MISSING |
| File | src/engines/capability-macro.ts |
| Interface | HarnessRuntime |
| Design Doc | - |
| Effort | S |

Interface HarnessRuntime in src/engines/capability-macro.ts has no implementing class.

**Recommended Action:** Create implementing class for HarnessRuntime

---

### GAP-041: Interface not implemented: AvailabilityGating

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | capability-system |
| Type | INTERFACE_MISSING |
| File | src/engines/capability-resolution.ts |
| Interface | AvailabilityGating |
| Design Doc | - |
| Effort | S |

Interface AvailabilityGating in src/engines/capability-resolution.ts has no implementing class.

**Recommended Action:** Create implementing class for AvailabilityGating

---

### GAP-042: Interface not implemented: CapabilityResolutionOptions

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | capability-system |
| Type | INTERFACE_MISSING |
| File | src/engines/capability-resolution.ts |
| Interface | CapabilityResolutionOptions |
| Design Doc | - |
| Effort | S |

Interface CapabilityResolutionOptions in src/engines/capability-resolution.ts has no implementing class.

**Recommended Action:** Create implementing class for CapabilityResolutionOptions

---

### GAP-043: Interface not implemented: ResolvedCapability

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | capability-system |
| Type | INTERFACE_MISSING |
| File | src/engines/capability-resolution.ts |
| Interface | ResolvedCapability |
| Design Doc | - |
| Effort | S |

Interface ResolvedCapability in src/engines/capability-resolution.ts has no implementing class.

**Recommended Action:** Create implementing class for ResolvedCapability

---

### GAP-044: Interface not implemented: ResolvedCapabilities

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | capability-system |
| Type | INTERFACE_MISSING |
| File | src/engines/capability-resolution.ts |
| Interface | ResolvedCapabilities |
| Design Doc | - |
| Effort | S |

Interface ResolvedCapabilities in src/engines/capability-resolution.ts has no implementing class.

**Recommended Action:** Create implementing class for ResolvedCapabilities

---

### GAP-045: Interface not implemented: DomIndicator

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | capability-system |
| Type | INTERFACE_MISSING |
| File | src/engines/capability-shape-registry.ts |
| Interface | DomIndicator |
| Design Doc | - |
| Effort | S |

Interface DomIndicator in src/engines/capability-shape-registry.ts has no implementing class.

**Recommended Action:** Create implementing class for DomIndicator

---

### GAP-046: Interface not implemented: InteractiveElementPattern

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | capability-system |
| Type | INTERFACE_MISSING |
| File | src/engines/capability-shape-registry.ts |
| Interface | InteractiveElementPattern |
| Design Doc | - |
| Effort | S |

Interface InteractiveElementPattern in src/engines/capability-shape-registry.ts has no implementing class.

**Recommended Action:** Create implementing class for InteractiveElementPattern

---

### GAP-047: Interface not implemented: ProjectionRule

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | capability-system |
| Type | INTERFACE_MISSING |
| File | src/engines/capability-shape-registry.ts |
| Interface | ProjectionRule |
| Design Doc | - |
| Effort | S |

Interface ProjectionRule in src/engines/capability-shape-registry.ts has no implementing class.

**Recommended Action:** Create implementing class for ProjectionRule

---

### GAP-048: Interface not implemented: CapabilityShape

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | capability-system |
| Type | INTERFACE_MISSING |
| File | src/engines/capability-shape-registry.ts |
| Interface | CapabilityShape |
| Design Doc | - |
| Effort | S |

Interface CapabilityShape in src/engines/capability-shape-registry.ts has no implementing class.

**Recommended Action:** Create implementing class for CapabilityShape

---

### GAP-049: Interface not implemented: CapabilityAdapter

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | capability-system |
| Type | INTERFACE_MISSING |
| File | src/engines/capability-shape-registry.ts |
| Interface | CapabilityAdapter |
| Design Doc | - |
| Effort | S |

Interface CapabilityAdapter in src/engines/capability-shape-registry.ts has no implementing class.

**Recommended Action:** Create implementing class for CapabilityAdapter

---

### GAP-050: Interface not implemented: CapabilityExecutionResult

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | capability-system |
| Type | INTERFACE_MISSING |
| File | src/engines/capability.ts |
| Interface | CapabilityExecutionResult |
| Design Doc | - |
| Effort | S |

Interface CapabilityExecutionResult in src/engines/capability.ts has no implementing class.

**Recommended Action:** Create implementing class for CapabilityExecutionResult

---

### GAP-051: Interface not implemented: LoginDetectionResult

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | capability-system |
| Type | INTERFACE_MISSING |
| File | src/engines/capability.ts |
| Interface | LoginDetectionResult |
| Design Doc | - |
| Effort | S |

Interface LoginDetectionResult in src/engines/capability.ts has no implementing class.

**Recommended Action:** Create implementing class for LoginDetectionResult

---

### GAP-052: Interface not implemented: LoginIndicator

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | capability-system |
| Type | INTERFACE_MISSING |
| File | src/engines/capability.ts |
| Interface | LoginIndicator |
| Design Doc | - |
| Effort | S |

Interface LoginIndicator in src/engines/capability.ts has no implementing class.

**Recommended Action:** Create implementing class for LoginIndicator

---

### GAP-053: Interface not implemented: RecoveryStrategyResult

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | capability-system |
| Type | INTERFACE_MISSING |
| File | src/engines/capability.ts |
| Interface | RecoveryStrategyResult |
| Design Doc | - |
| Effort | S |

Interface RecoveryStrategyResult in src/engines/capability.ts has no implementing class.

**Recommended Action:** Create implementing class for RecoveryStrategyResult

---

### GAP-054: Interface not implemented: FleetConfig

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | chrome-management |
| Type | INTERFACE_MISSING |
| File | src/engines/chrome-governor.ts |
| Interface | FleetConfig |
| Design Doc | - |
| Effort | S |

Interface FleetConfig in src/engines/chrome-governor.ts has no implementing class.

**Recommended Action:** Create implementing class for FleetConfig

---

### GAP-055: Interface not implemented: LaunchOptions

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | chrome-management |
| Type | INTERFACE_MISSING |
| File | src/engines/chrome-governor.ts |
| Interface | LaunchOptions |
| Design Doc | - |
| Effort | S |

Interface LaunchOptions in src/engines/chrome-governor.ts has no implementing class.

**Recommended Action:** Create implementing class for LaunchOptions

---

### GAP-056: Interface not implemented: ChromeSlave

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | chrome-management |
| Type | INTERFACE_MISSING |
| File | src/engines/chrome-governor.ts |
| Interface | ChromeSlave |
| Design Doc | - |
| Effort | S |

Interface ChromeSlave in src/engines/chrome-governor.ts has no implementing class.

**Recommended Action:** Create implementing class for ChromeSlave

---

### GAP-057: Interface not implemented: CaptureResult

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | chrome-management |
| Type | INTERFACE_MISSING |
| File | src/engines/chrome-governor.ts |
| Interface | CaptureResult |
| Design Doc | - |
| Effort | S |

Interface CaptureResult in src/engines/chrome-governor.ts has no implementing class.

**Recommended Action:** Create implementing class for CaptureResult

---

### GAP-058: Interface not implemented: PageState

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | chrome-management |
| Type | INTERFACE_MISSING |
| File | src/engines/chrome-governor.ts |
| Interface | PageState |
| Design Doc | - |
| Effort | S |

Interface PageState in src/engines/chrome-governor.ts has no implementing class.

**Recommended Action:** Create implementing class for PageState

---

### GAP-059: Interface not implemented: HarnessResult

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | chrome-management |
| Type | INTERFACE_MISSING |
| File | src/engines/chrome-governor.ts |
| Interface | HarnessResult |
| Design Doc | - |
| Effort | S |

Interface HarnessResult in src/engines/chrome-governor.ts has no implementing class.

**Recommended Action:** Create implementing class for HarnessResult

---

### GAP-060: Interface not implemented: HarnessDAG

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | chrome-management |
| Type | INTERFACE_MISSING |
| File | src/engines/chrome-governor.ts |
| Interface | HarnessDAG |
| Design Doc | - |
| Effort | S |

Interface HarnessDAG in src/engines/chrome-governor.ts has no implementing class.

**Recommended Action:** Create implementing class for HarnessDAG

---

### GAP-061: Interface not implemented: SlaveHealth

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | chrome-management |
| Type | INTERFACE_MISSING |
| File | src/engines/chrome-governor.ts |
| Interface | SlaveHealth |
| Design Doc | - |
| Effort | S |

Interface SlaveHealth in src/engines/chrome-governor.ts has no implementing class.

**Recommended Action:** Create implementing class for SlaveHealth

---

### GAP-062: Interface not implemented: GovernorEventBus

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | chrome-management |
| Type | INTERFACE_MISSING |
| File | src/engines/chrome-governor.ts |
| Interface | GovernorEventBus |
| Design Doc | - |
| Effort | S |

Interface GovernorEventBus in src/engines/chrome-governor.ts has no implementing class.

**Recommended Action:** Create implementing class for GovernorEventBus

---

### GAP-063: Interface not implemented: CDPTransport

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | chrome-management |
| Type | INTERFACE_MISSING |
| File | src/engines/chrome-governor.ts |
| Interface | CDPTransport |
| Design Doc | - |
| Effort | S |

Interface CDPTransport in src/engines/chrome-governor.ts has no implementing class.

**Recommended Action:** Create implementing class for CDPTransport

---

### GAP-064: Interface not implemented: CircuitBreaker

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | chrome-management |
| Type | INTERFACE_MISSING |
| File | src/engines/chrome-governor.ts |
| Interface | CircuitBreaker |
| Design Doc | - |
| Effort | S |

Interface CircuitBreaker in src/engines/chrome-governor.ts has no implementing class.

**Recommended Action:** Create implementing class for CircuitBreaker

---

### GAP-065: Interface not implemented: ConfigEventBus

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | configuration |
| Type | INTERFACE_MISSING |
| File | src/engines/config-manager.ts |
| Interface | ConfigEventBus |
| Design Doc | - |
| Effort | S |

Interface ConfigEventBus in src/engines/config-manager.ts has no implementing class.

**Recommended Action:** Create implementing class for ConfigEventBus

---

### GAP-066: Interface not implemented: ConfigAuditEntry

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | configuration |
| Type | INTERFACE_MISSING |
| File | src/engines/config-manager.ts |
| Interface | ConfigAuditEntry |
| Design Doc | - |
| Effort | S |

Interface ConfigAuditEntry in src/engines/config-manager.ts has no implementing class.

**Recommended Action:** Create implementing class for ConfigAuditEntry

---

### GAP-067: Interface not implemented: ResolvedCapabilities

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | session-state |
| Type | INTERFACE_MISSING |
| File | src/engines/conversation-manager.ts |
| Interface | ResolvedCapabilities |
| Design Doc | - |
| Effort | S |

Interface ResolvedCapabilities in src/engines/conversation-manager.ts has no implementing class.

**Recommended Action:** Create implementing class for ResolvedCapabilities

---

### GAP-068: Interface not implemented: ResolvedCapability

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | session-state |
| Type | INTERFACE_MISSING |
| File | src/engines/conversation-manager.ts |
| Interface | ResolvedCapability |
| Design Doc | - |
| Effort | S |

Interface ResolvedCapability in src/engines/conversation-manager.ts has no implementing class.

**Recommended Action:** Create implementing class for ResolvedCapability

---

### GAP-069: Interface not implemented: CapabilityResolutionEngine

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | session-state |
| Type | INTERFACE_MISSING |
| File | src/engines/conversation-manager.ts |
| Interface | CapabilityResolutionEngine |
| Design Doc | - |
| Effort | S |

Interface CapabilityResolutionEngine in src/engines/conversation-manager.ts has no implementing class.

**Recommended Action:** Create implementing class for CapabilityResolutionEngine

---

### GAP-070: Interface not implemented: StreamBlockStore

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | session-state |
| Type | INTERFACE_MISSING |
| File | src/engines/conversation-manager.ts |
| Interface | StreamBlockStore |
| Design Doc | - |
| Effort | S |

Interface StreamBlockStore in src/engines/conversation-manager.ts has no implementing class.

**Recommended Action:** Create implementing class for StreamBlockStore

---

### GAP-071: Interface not implemented: ConversationContext

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | session-state |
| Type | INTERFACE_MISSING |
| File | src/engines/conversation-manager.ts |
| Interface | ConversationContext |
| Design Doc | - |
| Effort | S |

Interface ConversationContext in src/engines/conversation-manager.ts has no implementing class.

**Recommended Action:** Create implementing class for ConversationContext

---

### GAP-072: Interface not implemented: SendResult

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | session-state |
| Type | INTERFACE_MISSING |
| File | src/engines/conversation-manager.ts |
| Interface | SendResult |
| Design Doc | - |
| Effort | S |

Interface SendResult in src/engines/conversation-manager.ts has no implementing class.

**Recommended Action:** Create implementing class for SendResult

---

### GAP-073: Interface not implemented: MemoizerEventBus

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/execution-memoizer.ts |
| Interface | MemoizerEventBus |
| Design Doc | - |
| Effort | S |

Interface MemoizerEventBus in src/engines/execution-memoizer.ts has no implementing class.

**Recommended Action:** Create implementing class for MemoizerEventBus

---

### GAP-074: Interface not implemented: MemoizerConfig

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/execution-memoizer.ts |
| Interface | MemoizerConfig |
| Design Doc | - |
| Effort | S |

Interface MemoizerConfig in src/engines/execution-memoizer.ts has no implementing class.

**Recommended Action:** Create implementing class for MemoizerConfig

---

### GAP-075: Interface not implemented: CacheEntry

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/execution-memoizer.ts |
| Interface | CacheEntry |
| Design Doc | - |
| Effort | S |

Interface CacheEntry in src/engines/execution-memoizer.ts has no implementing class.

**Recommended Action:** Create implementing class for CacheEntry

---

### GAP-076: Interface not implemented: MemoizerStats

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/execution-memoizer.ts |
| Interface | MemoizerStats |
| Design Doc | - |
| Effort | S |

Interface MemoizerStats in src/engines/execution-memoizer.ts has no implementing class.

**Recommended Action:** Create implementing class for MemoizerStats

---

### GAP-077: Interface not implemented: HarnessCheckpointRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/harness-checkpoint.ts |
| Interface | HarnessCheckpointRow |
| Design Doc | - |
| Effort | S |

Interface HarnessCheckpointRow in src/engines/harness-checkpoint.ts has no implementing class.

**Recommended Action:** Create implementing class for HarnessCheckpointRow

---

### GAP-078: Interface not implemented: CheckpointInput

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/harness-checkpoint.ts |
| Interface | CheckpointInput |
| Design Doc | - |
| Effort | S |

Interface CheckpointInput in src/engines/harness-checkpoint.ts has no implementing class.

**Recommended Action:** Create implementing class for CheckpointInput

---

### GAP-079: Interface not implemented: HarnessCheckpointStore

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/harness-checkpoint.ts |
| Interface | HarnessCheckpointStore |
| Design Doc | - |
| Effort | S |

Interface HarnessCheckpointStore in src/engines/harness-checkpoint.ts has no implementing class.

**Recommended Action:** Create implementing class for HarnessCheckpointStore

---

### GAP-080: Interface not implemented: PromptContext

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/harness-protocol-engine.ts |
| Interface | PromptContext |
| Design Doc | - |
| Effort | S |

Interface PromptContext in src/engines/harness-protocol-engine.ts has no implementing class.

**Recommended Action:** Create implementing class for PromptContext

---

### GAP-081: Interface not implemented: ExtractedResponse

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/harness-protocol-engine.ts |
| Interface | ExtractedResponse |
| Design Doc | - |
| Effort | S |

Interface ExtractedResponse in src/engines/harness-protocol-engine.ts has no implementing class.

**Recommended Action:** Create implementing class for ExtractedResponse

---

### GAP-082: Interface not implemented: HarnessProtocolConfig

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/harness-protocol-engine.ts |
| Interface | HarnessProtocolConfig |
| Design Doc | - |
| Effort | S |

Interface HarnessProtocolConfig in src/engines/harness-protocol-engine.ts has no implementing class.

**Recommended Action:** Create implementing class for HarnessProtocolConfig

---

### GAP-083: Interface not implemented: HarnessCondition

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/harness-runtime.ts |
| Interface | HarnessCondition |
| Design Doc | - |
| Effort | S |

Interface HarnessCondition in src/engines/harness-runtime.ts has no implementing class.

**Recommended Action:** Create implementing class for HarnessCondition

---

### GAP-084: Interface not implemented: HarnessContext

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/harness-runtime.ts |
| Interface | HarnessContext |
| Design Doc | - |
| Effort | S |

Interface HarnessContext in src/engines/harness-runtime.ts has no implementing class.

**Recommended Action:** Create implementing class for HarnessContext

---

### GAP-085: Interface not implemented: HarnessModuleResult

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/harness-runtime.ts |
| Interface | HarnessModuleResult |
| Design Doc | - |
| Effort | S |

Interface HarnessModuleResult in src/engines/harness-runtime.ts has no implementing class.

**Recommended Action:** Create implementing class for HarnessModuleResult

---

### GAP-086: Interface not implemented: HarnessTelemetryEvent

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/harness-runtime.ts |
| Interface | HarnessTelemetryEvent |
| Design Doc | - |
| Effort | S |

Interface HarnessTelemetryEvent in src/engines/harness-runtime.ts has no implementing class.

**Recommended Action:** Create implementing class for HarnessTelemetryEvent

---

### GAP-087: Interface not implemented: HarnessProgressEvent

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/harness-runtime.ts |
| Interface | HarnessProgressEvent |
| Design Doc | - |
| Effort | S |

Interface HarnessProgressEvent in src/engines/harness-runtime.ts has no implementing class.

**Recommended Action:** Create implementing class for HarnessProgressEvent

---

### GAP-088: Interface not implemented: Element

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/harness-runtime.ts |
| Interface | Element |
| Design Doc | - |
| Effort | S |

Interface Element in src/engines/harness-runtime.ts has no implementing class.

**Recommended Action:** Create implementing class for Element

---

### GAP-089: Interface not implemented: HarnessDAG

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/harness-runtime.ts |
| Interface | HarnessDAG |
| Design Doc | - |
| Effort | S |

Interface HarnessDAG in src/engines/harness-runtime.ts has no implementing class.

**Recommended Action:** Create implementing class for HarnessDAG

---

### GAP-090: Interface not implemented: HarnessResult

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/harness-runtime.ts |
| Interface | HarnessResult |
| Design Doc | - |
| Effort | S |

Interface HarnessResult in src/engines/harness-runtime.ts has no implementing class.

**Recommended Action:** Create implementing class for HarnessResult

---

### GAP-091: Interface not implemented: ProviderManifest

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/manifest-inference.ts |
| Interface | ProviderManifest |
| Design Doc | - |
| Effort | S |

Interface ProviderManifest in src/engines/manifest-inference.ts has no implementing class.

**Recommended Action:** Create implementing class for ProviderManifest

---

### GAP-092: Interface not implemented: InferredManifest

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/manifest-inference.ts |
| Interface | InferredManifest |
| Design Doc | - |
| Effort | S |

Interface InferredManifest in src/engines/manifest-inference.ts has no implementing class.

**Recommended Action:** Create implementing class for InferredManifest

---

### GAP-093: Interface not implemented: ValidationResult

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/manifest-inference.ts |
| Interface | ValidationResult |
| Design Doc | - |
| Effort | S |

Interface ValidationResult in src/engines/manifest-inference.ts has no implementing class.

**Recommended Action:** Create implementing class for ValidationResult

---

### GAP-094: Interface not implemented: ToolDefinition

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | cli |
| Type | INTERFACE_MISSING |
| File | src/engines/mcp-client-adapter.ts |
| Interface | ToolDefinition |
| Design Doc | - |
| Effort | S |

Interface ToolDefinition in src/engines/mcp-client-adapter.ts has no implementing class.

**Recommended Action:** Create implementing class for ToolDefinition

---

### GAP-095: Interface not implemented: ToolResult

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | cli |
| Type | INTERFACE_MISSING |
| File | src/engines/mcp-client-adapter.ts |
| Interface | ToolResult |
| Design Doc | - |
| Effort | S |

Interface ToolResult in src/engines/mcp-client-adapter.ts has no implementing class.

**Recommended Action:** Create implementing class for ToolResult

---

### GAP-096: Interface not implemented: McpServerConnection

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | cli |
| Type | INTERFACE_MISSING |
| File | src/engines/mcp-client-adapter.ts |
| Interface | McpServerConnection |
| Design Doc | - |
| Effort | S |

Interface McpServerConnection in src/engines/mcp-client-adapter.ts has no implementing class.

**Recommended Action:** Create implementing class for McpServerConnection

---

### GAP-097: Interface not implemented: McpToolDefinition

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | api-server |
| Type | INTERFACE_MISSING |
| File | src/engines/mcp-server-adapter.ts |
| Interface | McpToolDefinition |
| Design Doc | - |
| Effort | S |

Interface McpToolDefinition in src/engines/mcp-server-adapter.ts has no implementing class.

**Recommended Action:** Create implementing class for McpToolDefinition

---

### GAP-098: Interface not implemented: McpToolCallResult

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | api-server |
| Type | INTERFACE_MISSING |
| File | src/engines/mcp-server-adapter.ts |
| Interface | McpToolCallResult |
| Design Doc | - |
| Effort | S |

Interface McpToolCallResult in src/engines/mcp-server-adapter.ts has no implementing class.

**Recommended Action:** Create implementing class for McpToolCallResult

---

### GAP-099: Interface not implemented: McpServerConfig

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | api-server |
| Type | INTERFACE_MISSING |
| File | src/engines/mcp-server-adapter.ts |
| Interface | McpServerConfig |
| Design Doc | - |
| Effort | S |

Interface McpServerConfig in src/engines/mcp-server-adapter.ts has no implementing class.

**Recommended Action:** Create implementing class for McpServerConfig

---

### GAP-100: Interface not implemented: EpisodicMemory

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/memory-engine.ts |
| Interface | EpisodicMemory |
| Design Doc | - |
| Effort | S |

Interface EpisodicMemory in src/engines/memory-engine.ts has no implementing class.

**Recommended Action:** Create implementing class for EpisodicMemory

---

### GAP-101: Interface not implemented: EpisodicMemoryInput

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/memory-engine.ts |
| Interface | EpisodicMemoryInput |
| Design Doc | - |
| Effort | S |

Interface EpisodicMemoryInput in src/engines/memory-engine.ts has no implementing class.

**Recommended Action:** Create implementing class for EpisodicMemoryInput

---

### GAP-102: Interface not implemented: SemanticMemory

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/memory-engine.ts |
| Interface | SemanticMemory |
| Design Doc | - |
| Effort | S |

Interface SemanticMemory in src/engines/memory-engine.ts has no implementing class.

**Recommended Action:** Create implementing class for SemanticMemory

---

### GAP-103: Interface not implemented: SemanticMemoryInput

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/memory-engine.ts |
| Interface | SemanticMemoryInput |
| Design Doc | - |
| Effort | S |

Interface SemanticMemoryInput in src/engines/memory-engine.ts has no implementing class.

**Recommended Action:** Create implementing class for SemanticMemoryInput

---

### GAP-104: Interface not implemented: ProceduralRule

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/memory-engine.ts |
| Interface | ProceduralRule |
| Design Doc | - |
| Effort | S |

Interface ProceduralRule in src/engines/memory-engine.ts has no implementing class.

**Recommended Action:** Create implementing class for ProceduralRule

---

### GAP-105: Interface not implemented: ProceduralRuleInput

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/memory-engine.ts |
| Interface | ProceduralRuleInput |
| Design Doc | - |
| Effort | S |

Interface ProceduralRuleInput in src/engines/memory-engine.ts has no implementing class.

**Recommended Action:** Create implementing class for ProceduralRuleInput

---

### GAP-106: Interface not implemented: EpisodeQueryOpts

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/memory-engine.ts |
| Interface | EpisodeQueryOpts |
| Design Doc | - |
| Effort | S |

Interface EpisodeQueryOpts in src/engines/memory-engine.ts has no implementing class.

**Recommended Action:** Create implementing class for EpisodeQueryOpts

---

### GAP-107: Interface not implemented: RuleContext

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/memory-engine.ts |
| Interface | RuleContext |
| Design Doc | - |
| Effort | S |

Interface RuleContext in src/engines/memory-engine.ts has no implementing class.

**Recommended Action:** Create implementing class for RuleContext

---

### GAP-108: Interface not implemented: AgentMemoryContext

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/memory-engine.ts |
| Interface | AgentMemoryContext |
| Design Doc | - |
| Effort | S |

Interface AgentMemoryContext in src/engines/memory-engine.ts has no implementing class.

**Recommended Action:** Create implementing class for AgentMemoryContext

---

### GAP-109: Interface not implemented: MiningResult

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/memory-engine.ts |
| Interface | MiningResult |
| Design Doc | - |
| Effort | S |

Interface MiningResult in src/engines/memory-engine.ts has no implementing class.

**Recommended Action:** Create implementing class for MiningResult

---

### GAP-110: Interface not implemented: MirrorStateRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/mirror-engine.ts |
| Interface | MirrorStateRow |
| Design Doc | - |
| Effort | S |

Interface MirrorStateRow in src/engines/mirror-engine.ts has no implementing class.

**Recommended Action:** Create implementing class for MirrorStateRow

---

### GAP-111: Interface not implemented: MirrorStateInput

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/mirror-engine.ts |
| Interface | MirrorStateInput |
| Design Doc | - |
| Effort | S |

Interface MirrorStateInput in src/engines/mirror-engine.ts has no implementing class.

**Recommended Action:** Create implementing class for MirrorStateInput

---

### GAP-112: Interface not implemented: OptimisticUpdateRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/mirror-engine.ts |
| Interface | OptimisticUpdateRow |
| Design Doc | - |
| Effort | S |

Interface OptimisticUpdateRow in src/engines/mirror-engine.ts has no implementing class.

**Recommended Action:** Create implementing class for OptimisticUpdateRow

---

### GAP-113: Interface not implemented: OptimisticUpdateInput

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/mirror-engine.ts |
| Interface | OptimisticUpdateInput |
| Design Doc | - |
| Effort | S |

Interface OptimisticUpdateInput in src/engines/mirror-engine.ts has no implementing class.

**Recommended Action:** Create implementing class for OptimisticUpdateInput

---

### GAP-114: Interface not implemented: LatencyMeasurementInput

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/mirror-engine.ts |
| Interface | LatencyMeasurementInput |
| Design Doc | - |
| Effort | S |

Interface LatencyMeasurementInput in src/engines/mirror-engine.ts has no implementing class.

**Recommended Action:** Create implementing class for LatencyMeasurementInput

---

### GAP-115: Interface not implemented: LatencyReport

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/mirror-engine.ts |
| Interface | LatencyReport |
| Design Doc | - |
| Effort | S |

Interface LatencyReport in src/engines/mirror-engine.ts has no implementing class.

**Recommended Action:** Create implementing class for LatencyReport

---

### GAP-116: Interface not implemented: SnapshotRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/mirror-engine.ts |
| Interface | SnapshotRow |
| Design Doc | - |
| Effort | S |

Interface SnapshotRow in src/engines/mirror-engine.ts has no implementing class.

**Recommended Action:** Create implementing class for SnapshotRow

---

### GAP-117: Interface not implemented: SnapshotInput

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/mirror-engine.ts |
| Interface | SnapshotInput |
| Design Doc | - |
| Effort | S |

Interface SnapshotInput in src/engines/mirror-engine.ts has no implementing class.

**Recommended Action:** Create implementing class for SnapshotInput

---

### GAP-118: Interface not implemented: MirrorAction

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/mirror-engine.ts |
| Interface | MirrorAction |
| Design Doc | - |
| Effort | S |

Interface MirrorAction in src/engines/mirror-engine.ts has no implementing class.

**Recommended Action:** Create implementing class for MirrorAction

---

### GAP-119: Interface not implemented: ActionResult

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/mirror-engine.ts |
| Interface | ActionResult |
| Design Doc | - |
| Effort | S |

Interface ActionResult in src/engines/mirror-engine.ts has no implementing class.

**Recommended Action:** Create implementing class for ActionResult

---

### GAP-120: Interface not implemented: ObservationOptions

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/mirror-engine.ts |
| Interface | ObservationOptions |
| Design Doc | - |
| Effort | S |

Interface ObservationOptions in src/engines/mirror-engine.ts has no implementing class.

**Recommended Action:** Create implementing class for ObservationOptions

---

### GAP-121: Interface not implemented: MirrorState

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/mirror-engine.ts |
| Interface | MirrorState |
| Design Doc | - |
| Effort | S |

Interface MirrorState in src/engines/mirror-engine.ts has no implementing class.

**Recommended Action:** Create implementing class for MirrorState

---

### GAP-122: Interface not implemented: BudgetResult

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/mirror-engine.ts |
| Interface | BudgetResult |
| Design Doc | - |
| Effort | S |

Interface BudgetResult in src/engines/mirror-engine.ts has no implementing class.

**Recommended Action:** Create implementing class for BudgetResult

---

### GAP-123: Interface not implemented: ObservationOptions

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/observation-tap.ts |
| Interface | ObservationOptions |
| Design Doc | - |
| Effort | S |

Interface ObservationOptions in src/engines/observation-tap.ts has no implementing class.

**Recommended Action:** Create implementing class for ObservationOptions

---

### GAP-124: Interface not implemented: ObservationEvent

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/observation-tap.ts |
| Interface | ObservationEvent |
| Design Doc | - |
| Effort | S |

Interface ObservationEvent in src/engines/observation-tap.ts has no implementing class.

**Recommended Action:** Create implementing class for ObservationEvent

---

### GAP-125: Interface not implemented: ProviderPlugin

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/plugin-system.ts |
| Interface | ProviderPlugin |
| Design Doc | - |
| Effort | S |

Interface ProviderPlugin in src/engines/plugin-system.ts has no implementing class.

**Recommended Action:** Create implementing class for ProviderPlugin

---

### GAP-126: Interface not implemented: DiscoveryOptions

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | provider-routing |
| Type | INTERFACE_MISSING |
| File | src/engines/provider-discovery.ts |
| Interface | DiscoveryOptions |
| Design Doc | - |
| Effort | S |

Interface DiscoveryOptions in src/engines/provider-discovery.ts has no implementing class.

**Recommended Action:** Create implementing class for DiscoveryOptions

---

### GAP-127: Interface not implemented: DiscoverySession

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | provider-routing |
| Type | INTERFACE_MISSING |
| File | src/engines/provider-discovery.ts |
| Interface | DiscoverySession |
| Design Doc | - |
| Effort | S |

Interface DiscoverySession in src/engines/provider-discovery.ts has no implementing class.

**Recommended Action:** Create implementing class for DiscoverySession

---

### GAP-128: Interface not implemented: ProviderManifestDraft

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | provider-routing |
| Type | INTERFACE_MISSING |
| File | src/engines/provider-discovery.ts |
| Interface | ProviderManifestDraft |
| Design Doc | - |
| Effort | S |

Interface ProviderManifestDraft in src/engines/provider-discovery.ts has no implementing class.

**Recommended Action:** Create implementing class for ProviderManifestDraft

---

### GAP-129: Interface not implemented: ManifestEdits

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | provider-routing |
| Type | INTERFACE_MISSING |
| File | src/engines/provider-discovery.ts |
| Interface | ManifestEdits |
| Design Doc | - |
| Effort | S |

Interface ManifestEdits in src/engines/provider-discovery.ts has no implementing class.

**Recommended Action:** Create implementing class for ManifestEdits

---

### GAP-130: Interface not implemented: RegisterResult

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | provider-routing |
| Type | INTERFACE_MISSING |
| File | src/engines/provider-discovery.ts |
| Interface | RegisterResult |
| Design Doc | - |
| Effort | S |

Interface RegisterResult in src/engines/provider-discovery.ts has no implementing class.

**Recommended Action:** Create implementing class for RegisterResult

---

### GAP-131: Interface not implemented: InteractiveDiscoverySession

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | provider-routing |
| Type | INTERFACE_MISSING |
| File | src/engines/provider-discovery.ts |
| Interface | InteractiveDiscoverySession |
| Design Doc | - |
| Effort | S |

Interface InteractiveDiscoverySession in src/engines/provider-discovery.ts has no implementing class.

**Recommended Action:** Create implementing class for InteractiveDiscoverySession

---

### GAP-132: Interface not implemented: ProviderSignal

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | provider-routing |
| Type | INTERFACE_MISSING |
| File | src/engines/provider-health.ts |
| Interface | ProviderSignal |
| Design Doc | - |
| Effort | S |

Interface ProviderSignal in src/engines/provider-health.ts has no implementing class.

**Recommended Action:** Create implementing class for ProviderSignal

---

### GAP-133: Interface not implemented: ProviderHealth

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | provider-routing |
| Type | INTERFACE_MISSING |
| File | src/engines/provider-health.ts |
| Interface | ProviderHealth |
| Design Doc | - |
| Effort | S |

Interface ProviderHealth in src/engines/provider-health.ts has no implementing class.

**Recommended Action:** Create implementing class for ProviderHealth

---

### GAP-134: Interface not implemented: ProviderRegistrarEventBus

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | provider-routing |
| Type | INTERFACE_MISSING |
| File | src/engines/provider-registrar.ts |
| Interface | ProviderRegistrarEventBus |
| Design Doc | - |
| Effort | S |

Interface ProviderRegistrarEventBus in src/engines/provider-registrar.ts has no implementing class.

**Recommended Action:** Create implementing class for ProviderRegistrarEventBus

---

### GAP-135: Interface not implemented: RegisterResult

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | provider-routing |
| Type | INTERFACE_MISSING |
| File | src/engines/provider-registrar.ts |
| Interface | RegisterResult |
| Design Doc | - |
| Effort | S |

Interface RegisterResult in src/engines/provider-registrar.ts has no implementing class.

**Recommended Action:** Create implementing class for RegisterResult

---

### GAP-136: Interface not implemented: SeedAllResult

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | provider-routing |
| Type | INTERFACE_MISSING |
| File | src/engines/provider-registrar.ts |
| Interface | SeedAllResult |
| Design Doc | - |
| Effort | S |

Interface SeedAllResult in src/engines/provider-registrar.ts has no implementing class.

**Recommended Action:** Create implementing class for SeedAllResult

---

### GAP-137: Interface not implemented: VerifyResult

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | provider-routing |
| Type | INTERFACE_MISSING |
| File | src/engines/provider-registrar.ts |
| Interface | VerifyResult |
| Design Doc | - |
| Effort | S |

Interface VerifyResult in src/engines/provider-registrar.ts has no implementing class.

**Recommended Action:** Create implementing class for VerifyResult

---

### GAP-138: Interface not implemented: ProviderRegistrarAuditor

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | provider-routing |
| Type | INTERFACE_MISSING |
| File | src/engines/provider-registrar.ts |
| Interface | ProviderRegistrarAuditor |
| Design Doc | - |
| Effort | S |

Interface ProviderRegistrarAuditor in src/engines/provider-registrar.ts has no implementing class.

**Recommended Action:** Create implementing class for ProviderRegistrarAuditor

---

### GAP-139: Interface not implemented: AuditorConfig

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | observability |
| Type | INTERFACE_MISSING |
| File | src/engines/registration-auditor.ts |
| Interface | AuditorConfig |
| Design Doc | - |
| Effort | S |

Interface AuditorConfig in src/engines/registration-auditor.ts has no implementing class.

**Recommended Action:** Create implementing class for AuditorConfig

---

### GAP-140: Interface not implemented: AuditorEventBus

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | observability |
| Type | INTERFACE_MISSING |
| File | src/engines/registration-auditor.ts |
| Interface | AuditorEventBus |
| Design Doc | - |
| Effort | S |

Interface AuditorEventBus in src/engines/registration-auditor.ts has no implementing class.

**Recommended Action:** Create implementing class for AuditorEventBus

---

### GAP-141: Interface not implemented: ConfigManager

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | observability |
| Type | INTERFACE_MISSING |
| File | src/engines/registration-auditor.ts |
| Interface | ConfigManager |
| Design Doc | - |
| Effort | S |

Interface ConfigManager in src/engines/registration-auditor.ts has no implementing class.

**Recommended Action:** Create implementing class for ConfigManager

---

### GAP-142: Interface not implemented: UpsertResult

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | observability |
| Type | INTERFACE_MISSING |
| File | src/engines/registration-auditor.ts |
| Interface | UpsertResult |
| Design Doc | - |
| Effort | S |

Interface UpsertResult in src/engines/registration-auditor.ts has no implementing class.

**Recommended Action:** Create implementing class for UpsertResult

---

### GAP-143: Interface not implemented: AuditResult

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | observability |
| Type | INTERFACE_MISSING |
| File | src/engines/registration-auditor.ts |
| Interface | AuditResult |
| Design Doc | - |
| Effort | S |

Interface AuditResult in src/engines/registration-auditor.ts has no implementing class.

**Recommended Action:** Create implementing class for AuditResult

---

### GAP-144: Interface not implemented: SeedAuditResult

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | observability |
| Type | INTERFACE_MISSING |
| File | src/engines/registration-auditor.ts |
| Interface | SeedAuditResult |
| Design Doc | - |
| Effort | S |

Interface SeedAuditResult in src/engines/registration-auditor.ts has no implementing class.

**Recommended Action:** Create implementing class for SeedAuditResult

---

### GAP-145: Interface not implemented: DriftDetectionResult

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | observability |
| Type | INTERFACE_MISSING |
| File | src/engines/registration-auditor.ts |
| Interface | DriftDetectionResult |
| Design Doc | - |
| Effort | S |

Interface DriftDetectionResult in src/engines/registration-auditor.ts has no implementing class.

**Recommended Action:** Create implementing class for DriftDetectionResult

---

### GAP-146: Interface not implemented: HealResult

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/selector-healer.ts |
| Interface | HealResult |
| Design Doc | - |
| Effort | S |

Interface HealResult in src/engines/selector-healer.ts has no implementing class.

**Recommended Action:** Create implementing class for HealResult

---

### GAP-147: Interface not implemented: SelectorHealerConfig

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/selector-healer.ts |
| Interface | SelectorHealerConfig |
| Design Doc | - |
| Effort | S |

Interface SelectorHealerConfig in src/engines/selector-healer.ts has no implementing class.

**Recommended Action:** Create implementing class for SelectorHealerConfig

---

### GAP-148: Interface not implemented: AccessibilityNode

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/semantic-grounding.ts |
| Interface | AccessibilityNode |
| Design Doc | - |
| Effort | S |

Interface AccessibilityNode in src/engines/semantic-grounding.ts has no implementing class.

**Recommended Action:** Create implementing class for AccessibilityNode

---

### GAP-149: Interface not implemented: ResolvedElement

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/semantic-grounding.ts |
| Interface | ResolvedElement |
| Design Doc | - |
| Effort | S |

Interface ResolvedElement in src/engines/semantic-grounding.ts has no implementing class.

**Recommended Action:** Create implementing class for ResolvedElement

---

### GAP-150: Interface not implemented: ScreenshotRegion

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/semantic-grounding.ts |
| Interface | ScreenshotRegion |
| Design Doc | - |
| Effort | S |

Interface ScreenshotRegion in src/engines/semantic-grounding.ts has no implementing class.

**Recommended Action:** Create implementing class for ScreenshotRegion

---

### GAP-151: Interface not implemented: SessionCheckpointStore

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | session-state |
| Type | INTERFACE_MISSING |
| File | src/engines/session-checkpoint.ts |
| Interface | SessionCheckpointStore |
| Design Doc | - |
| Effort | S |

Interface SessionCheckpointStore in src/engines/session-checkpoint.ts has no implementing class.

**Recommended Action:** Create implementing class for SessionCheckpointStore

---

### GAP-152: Interface not implemented: StateTransitionInput

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/state-transition.ts |
| Interface | StateTransitionInput |
| Design Doc | - |
| Effort | S |

Interface StateTransitionInput in src/engines/state-transition.ts has no implementing class.

**Recommended Action:** Create implementing class for StateTransitionInput

---

### GAP-153: Interface not implemented: StateTransitionRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/state-transition.ts |
| Interface | StateTransitionRow |
| Design Doc | - |
| Effort | S |

Interface StateTransitionRow in src/engines/state-transition.ts has no implementing class.

**Recommended Action:** Create implementing class for StateTransitionRow

---

### GAP-154: Interface not implemented: StateTransitionStore

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/state-transition.ts |
| Interface | StateTransitionStore |
| Design Doc | - |
| Effort | S |

Interface StateTransitionStore in src/engines/state-transition.ts has no implementing class.

**Recommended Action:** Create implementing class for StateTransitionStore

---

### GAP-155: Interface not implemented: ParseResult

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | session-state |
| Type | INTERFACE_MISSING |
| File | src/engines/stream-parser.ts |
| Interface | ParseResult |
| Design Doc | - |
| Effort | S |

Interface ParseResult in src/engines/stream-parser.ts has no implementing class.

**Recommended Action:** Create implementing class for ParseResult

---

### GAP-156: Interface not implemented: ParserConfig

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | session-state |
| Type | INTERFACE_MISSING |
| File | src/engines/stream-parser.ts |
| Interface | ParserConfig |
| Design Doc | - |
| Effort | S |

Interface ParserConfig in src/engines/stream-parser.ts has no implementing class.

**Recommended Action:** Create implementing class for ParserConfig

---

### GAP-157: Interface not implemented: StreamingEvent

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/streaming-protocol.ts |
| Interface | StreamingEvent |
| Design Doc | - |
| Effort | S |

Interface StreamingEvent in src/engines/streaming-protocol.ts has no implementing class.

**Recommended Action:** Create implementing class for StreamingEvent

---

### GAP-158: Interface not implemented: AggregationMetric

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | observability |
| Type | INTERFACE_MISSING |
| File | src/engines/telemetry-aggregator.ts |
| Interface | AggregationMetric |
| Design Doc | - |
| Effort | S |

Interface AggregationMetric in src/engines/telemetry-aggregator.ts has no implementing class.

**Recommended Action:** Create implementing class for AggregationMetric

---

### GAP-159: Interface not implemented: AggregationSchedule

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | observability |
| Type | INTERFACE_MISSING |
| File | src/engines/telemetry-aggregator.ts |
| Interface | AggregationSchedule |
| Design Doc | - |
| Effort | S |

Interface AggregationSchedule in src/engines/telemetry-aggregator.ts has no implementing class.

**Recommended Action:** Create implementing class for AggregationSchedule

---

### GAP-160: Interface not implemented: RetentionRule

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | observability |
| Type | INTERFACE_MISSING |
| File | src/engines/telemetry-aggregator.ts |
| Interface | RetentionRule |
| Design Doc | - |
| Effort | S |

Interface RetentionRule in src/engines/telemetry-aggregator.ts has no implementing class.

**Recommended Action:** Create implementing class for RetentionRule

---

### GAP-161: Interface not implemented: RetentionPolicy

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | observability |
| Type | INTERFACE_MISSING |
| File | src/engines/telemetry-aggregator.ts |
| Interface | RetentionPolicy |
| Design Doc | - |
| Effort | S |

Interface RetentionPolicy in src/engines/telemetry-aggregator.ts has no implementing class.

**Recommended Action:** Create implementing class for RetentionPolicy

---

### GAP-162: Interface not implemented: TelemetryPipelineSettings

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | observability |
| Type | INTERFACE_MISSING |
| File | src/engines/telemetry-aggregator.ts |
| Interface | TelemetryPipelineSettings |
| Design Doc | - |
| Effort | S |

Interface TelemetryPipelineSettings in src/engines/telemetry-aggregator.ts has no implementing class.

**Recommended Action:** Create implementing class for TelemetryPipelineSettings

---

### GAP-163: Interface not implemented: TelemetryPipelineConfig

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | observability |
| Type | INTERFACE_MISSING |
| File | src/engines/telemetry-aggregator.ts |
| Interface | TelemetryPipelineConfig |
| Design Doc | - |
| Effort | S |

Interface TelemetryPipelineConfig in src/engines/telemetry-aggregator.ts has no implementing class.

**Recommended Action:** Create implementing class for TelemetryPipelineConfig

---

### GAP-164: Interface not implemented: CycleResult

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | observability |
| Type | INTERFACE_MISSING |
| File | src/engines/telemetry-aggregator.ts |
| Interface | CycleResult |
| Design Doc | - |
| Effort | S |

Interface CycleResult in src/engines/telemetry-aggregator.ts has no implementing class.

**Recommended Action:** Create implementing class for CycleResult

---

### GAP-165: Interface not implemented: RetentionResult

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | observability |
| Type | INTERFACE_MISSING |
| File | src/engines/telemetry-aggregator.ts |
| Interface | RetentionResult |
| Design Doc | - |
| Effort | S |

Interface RetentionResult in src/engines/telemetry-aggregator.ts has no implementing class.

**Recommended Action:** Create implementing class for RetentionResult

---

### GAP-166: Interface not implemented: TrendPoint

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | observability |
| Type | INTERFACE_MISSING |
| File | src/engines/telemetry-aggregator.ts |
| Interface | TrendPoint |
| Design Doc | - |
| Effort | S |

Interface TrendPoint in src/engines/telemetry-aggregator.ts has no implementing class.

**Recommended Action:** Create implementing class for TrendPoint

---

### GAP-167: Interface not implemented: ToolDefinition

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/tool-use-protocol.ts |
| Interface | ToolDefinition |
| Design Doc | - |
| Effort | S |

Interface ToolDefinition in src/engines/tool-use-protocol.ts has no implementing class.

**Recommended Action:** Create implementing class for ToolDefinition

---

### GAP-168: Interface not implemented: ToolResult

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/tool-use-protocol.ts |
| Interface | ToolResult |
| Design Doc | - |
| Effort | S |

Interface ToolResult in src/engines/tool-use-protocol.ts has no implementing class.

**Recommended Action:** Create implementing class for ToolResult

---

### GAP-169: Interface not implemented: ToolUseProtocol

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/tool-use-protocol.ts |
| Interface | ToolUseProtocol |
| Design Doc | - |
| Effort | S |

Interface ToolUseProtocol in src/engines/tool-use-protocol.ts has no implementing class.

**Recommended Action:** Create implementing class for ToolUseProtocol

---

### GAP-170: Interface not implemented: TransferCandidate

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/transfer-accelerator.ts |
| Interface | TransferCandidate |
| Design Doc | - |
| Effort | S |

Interface TransferCandidate in src/engines/transfer-accelerator.ts has no implementing class.

**Recommended Action:** Create implementing class for TransferCandidate

---

### GAP-171: Interface not implemented: TransferAttemptResult

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/transfer-accelerator.ts |
| Interface | TransferAttemptResult |
| Design Doc | - |
| Effort | S |

Interface TransferAttemptResult in src/engines/transfer-accelerator.ts has no implementing class.

**Recommended Action:** Create implementing class for TransferAttemptResult

---

### GAP-172: Interface not implemented: BatchTransferResult

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/transfer-accelerator.ts |
| Interface | BatchTransferResult |
| Design Doc | - |
| Effort | S |

Interface BatchTransferResult in src/engines/transfer-accelerator.ts has no implementing class.

**Recommended Action:** Create implementing class for BatchTransferResult

---

### GAP-173: Interface not implemented: ProviderCapabilityStore

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/transfer-accelerator.ts |
| Interface | ProviderCapabilityStore |
| Design Doc | - |
| Effort | S |

Interface ProviderCapabilityStore in src/engines/transfer-accelerator.ts has no implementing class.

**Recommended Action:** Create implementing class for ProviderCapabilityStore

---

### GAP-174: Interface not implemented: VersionConfig

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/version-manager.ts |
| Interface | VersionConfig |
| Design Doc | - |
| Effort | S |

Interface VersionConfig in src/engines/version-manager.ts has no implementing class.

**Recommended Action:** Create implementing class for VersionConfig

---

### GAP-175: Interface not implemented: PromotionCondition

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/version-manager.ts |
| Interface | PromotionCondition |
| Design Doc | - |
| Effort | S |

Interface PromotionCondition in src/engines/version-manager.ts has no implementing class.

**Recommended Action:** Create implementing class for PromotionCondition

---

### GAP-176: Interface not implemented: PromotionRule

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/version-manager.ts |
| Interface | PromotionRule |
| Design Doc | - |
| Effort | S |

Interface PromotionRule in src/engines/version-manager.ts has no implementing class.

**Recommended Action:** Create implementing class for PromotionRule

---

### GAP-177: Interface not implemented: DegradationRule

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/version-manager.ts |
| Interface | DegradationRule |
| Design Doc | - |
| Effort | S |

Interface DegradationRule in src/engines/version-manager.ts has no implementing class.

**Recommended Action:** Create implementing class for DegradationRule

---

### GAP-178: Interface not implemented: VersionComparison

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/version-manager.ts |
| Interface | VersionComparison |
| Design Doc | - |
| Effort | S |

Interface VersionComparison in src/engines/version-manager.ts has no implementing class.

**Recommended Action:** Create implementing class for VersionComparison

---

### GAP-179: Interface not implemented: PromotionTimeline

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/version-manager.ts |
| Interface | PromotionTimeline |
| Design Doc | - |
| Effort | S |

Interface PromotionTimeline in src/engines/version-manager.ts has no implementing class.

**Recommended Action:** Create implementing class for PromotionTimeline

---

### GAP-180: Interface not implemented: CompiledWorkflow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/workflow-compiler.ts |
| Interface | CompiledWorkflow |
| Design Doc | - |
| Effort | S |

Interface CompiledWorkflow in src/engines/workflow-compiler.ts has no implementing class.

**Recommended Action:** Create implementing class for CompiledWorkflow

---

### GAP-181: Interface not implemented: CompileError

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/workflow-compiler.ts |
| Interface | CompileError |
| Design Doc | - |
| Effort | S |

Interface CompileError in src/engines/workflow-compiler.ts has no implementing class.

**Recommended Action:** Create implementing class for CompileError

---

### GAP-182: Interface not implemented: CompileResult

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/workflow-compiler.ts |
| Interface | CompileResult |
| Design Doc | - |
| Effort | S |

Interface CompileResult in src/engines/workflow-compiler.ts has no implementing class.

**Recommended Action:** Create implementing class for CompileResult

---

### GAP-183: Interface not implemented: WorkflowNode

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/workflow-engine.ts |
| Interface | WorkflowNode |
| Design Doc | - |
| Effort | S |

Interface WorkflowNode in src/engines/workflow-engine.ts has no implementing class.

**Recommended Action:** Create implementing class for WorkflowNode

---

### GAP-184: Interface not implemented: WorkflowEdge

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/workflow-engine.ts |
| Interface | WorkflowEdge |
| Design Doc | - |
| Effort | S |

Interface WorkflowEdge in src/engines/workflow-engine.ts has no implementing class.

**Recommended Action:** Create implementing class for WorkflowEdge

---

### GAP-185: Interface not implemented: WorkflowDefinition

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/workflow-engine.ts |
| Interface | WorkflowDefinition |
| Design Doc | - |
| Effort | S |

Interface WorkflowDefinition in src/engines/workflow-engine.ts has no implementing class.

**Recommended Action:** Create implementing class for WorkflowDefinition

---

### GAP-186: Interface not implemented: NodeExecution

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/workflow-engine.ts |
| Interface | NodeExecution |
| Design Doc | - |
| Effort | S |

Interface NodeExecution in src/engines/workflow-engine.ts has no implementing class.

**Recommended Action:** Create implementing class for NodeExecution

---

### GAP-187: Interface not implemented: WorkflowExecution

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/workflow-engine.ts |
| Interface | WorkflowExecution |
| Design Doc | - |
| Effort | S |

Interface WorkflowExecution in src/engines/workflow-engine.ts has no implementing class.

**Recommended Action:** Create implementing class for WorkflowExecution

---

### GAP-188: Interface not implemented: WorkflowStore

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/workflow-engine.ts |
| Interface | WorkflowStore |
| Design Doc | - |
| Effort | S |

Interface WorkflowStore in src/engines/workflow-engine.ts has no implementing class.

**Recommended Action:** Create implementing class for WorkflowStore

---

### GAP-189: Interface not implemented: McpClientAdapter

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/engines/workflow-engine.ts |
| Interface | McpClientAdapter |
| Design Doc | - |
| Effort | S |

Interface McpClientAdapter in src/engines/workflow-engine.ts has no implementing class.

**Recommended Action:** Create implementing class for McpClientAdapter

---

### GAP-190: Interface not implemented: CdpClientOptions

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | chrome-management |
| Type | INTERFACE_MISSING |
| File | src/executor/cdp-types.ts |
| Interface | CdpClientOptions |
| Design Doc | - |
| Effort | S |

Interface CdpClientOptions in src/executor/cdp-types.ts has no implementing class.

**Recommended Action:** Create implementing class for CdpClientOptions

---

### GAP-191: Interface not implemented: CommandOptions

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | chrome-management |
| Type | INTERFACE_MISSING |
| File | src/executor/cdp-types.ts |
| Interface | CommandOptions |
| Design Doc | - |
| Effort | S |

Interface CommandOptions in src/executor/cdp-types.ts has no implementing class.

**Recommended Action:** Create implementing class for CommandOptions

---

### GAP-192: Interface not implemented: ContentBlock

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/executor/content-blocks.ts |
| Interface | ContentBlock |
| Design Doc | - |
| Effort | S |

Interface ContentBlock in src/executor/content-blocks.ts has no implementing class.

**Recommended Action:** Create implementing class for ContentBlock

---

### GAP-193: Interface not implemented: FleetConfig

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | chrome-management |
| Type | INTERFACE_MISSING |
| File | src/executor/fleet-config.ts |
| Interface | FleetConfig |
| Design Doc | - |
| Effort | S |

Interface FleetConfig in src/executor/fleet-config.ts has no implementing class.

**Recommended Action:** Create implementing class for FleetConfig

---

### GAP-194: Interface not implemented: FleetSupervisorOptions

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | chrome-management |
| Type | INTERFACE_MISSING |
| File | src/executor/fleet-supervisor.ts |
| Interface | FleetSupervisorOptions |
| Design Doc | - |
| Effort | S |

Interface FleetSupervisorOptions in src/executor/fleet-supervisor.ts has no implementing class.

**Recommended Action:** Create implementing class for FleetSupervisorOptions

---

### GAP-195: Interface not implemented: FleetSpawnOptions

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | chrome-management |
| Type | INTERFACE_MISSING |
| File | src/executor/fleet-supervisor.ts |
| Interface | FleetSpawnOptions |
| Design Doc | - |
| Effort | S |

Interface FleetSpawnOptions in src/executor/fleet-supervisor.ts has no implementing class.

**Recommended Action:** Create implementing class for FleetSpawnOptions

---

### GAP-196: Interface not implemented: FleetInstance

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | chrome-management |
| Type | INTERFACE_MISSING |
| File | src/executor/fleet-supervisor.ts |
| Interface | FleetInstance |
| Design Doc | - |
| Effort | S |

Interface FleetInstance in src/executor/fleet-supervisor.ts has no implementing class.

**Recommended Action:** Create implementing class for FleetInstance

---

### GAP-197: Interface not implemented: HealthProbeResult

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | chrome-management |
| Type | INTERFACE_MISSING |
| File | src/executor/fleet-supervisor.ts |
| Interface | HealthProbeResult |
| Design Doc | - |
| Effort | S |

Interface HealthProbeResult in src/executor/fleet-supervisor.ts has no implementing class.

**Recommended Action:** Create implementing class for HealthProbeResult

---

### GAP-198: Interface not implemented: LaunchResult

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/executor/launcher.ts |
| Interface | LaunchResult |
| Design Doc | - |
| Effort | S |

Interface LaunchResult in src/executor/launcher.ts has no implementing class.

**Recommended Action:** Create implementing class for LaunchResult

---

### GAP-199: Interface not implemented: ChromeLaunchOptions

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_MISSING |
| File | src/executor/launcher.ts |
| Interface | ChromeLaunchOptions |
| Design Doc | - |
| Effort | S |

Interface ChromeLaunchOptions in src/executor/launcher.ts has no implementing class.

**Recommended Action:** Create implementing class for ChromeLaunchOptions

---

### GAP-200: Interface not implemented: PortReaperOptions

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | chrome-management |
| Type | INTERFACE_MISSING |
| File | src/executor/port-reaper.ts |
| Interface | PortReaperOptions |
| Design Doc | - |
| Effort | S |

Interface PortReaperOptions in src/executor/port-reaper.ts has no implementing class.

**Recommended Action:** Create implementing class for PortReaperOptions

---

### GAP-201: Interface not implemented: ReapResult

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | chrome-management |
| Type | INTERFACE_MISSING |
| File | src/executor/port-reaper.ts |
| Interface | ReapResult |
| Design Doc | - |
| Effort | S |

Interface ReapResult in src/executor/port-reaper.ts has no implementing class.

**Recommended Action:** Create implementing class for ReapResult

---

### GAP-202: Interface not implemented: OrphanInfo

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | chrome-management |
| Type | INTERFACE_MISSING |
| File | src/executor/port-reaper.ts |
| Interface | OrphanInfo |
| Design Doc | - |
| Effort | S |

Interface OrphanInfo in src/executor/port-reaper.ts has no implementing class.

**Recommended Action:** Create implementing class for OrphanInfo

---

### GAP-203: Interface not implemented: RouteInput

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | api-server |
| Type | INTERFACE_MISSING |
| File | src/router/router.ts |
| Interface | RouteInput |
| Design Doc | - |
| Effort | S |

Interface RouteInput in src/router/router.ts has no implementing class.

**Recommended Action:** Create implementing class for RouteInput

---

### GAP-204: Interface not implemented: RouteResult

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | api-server |
| Type | INTERFACE_MISSING |
| File | src/router/router.ts |
| Interface | RouteResult |
| Design Doc | - |
| Effort | S |

Interface RouteResult in src/router/router.ts has no implementing class.

**Recommended Action:** Create implementing class for RouteResult

---

### GAP-205: Interface not implemented: RouteDispatcher

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | api-server |
| Type | INTERFACE_MISSING |
| File | src/router/router.ts |
| Interface | RouteDispatcher |
| Design Doc | - |
| Effort | S |

Interface RouteDispatcher in src/router/router.ts has no implementing class.

**Recommended Action:** Create implementing class for RouteDispatcher

---

### GAP-206: Interface not implemented: AlertCondition

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/automation.ts |
| Interface | AlertCondition |
| Design Doc | - |
| Effort | S |

Interface AlertCondition in src/schema/automation.ts has no implementing class.

**Recommended Action:** Create implementing class for AlertCondition

---

### GAP-207: Interface not implemented: AlertEvent

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/automation.ts |
| Interface | AlertEvent |
| Design Doc | - |
| Effort | S |

Interface AlertEvent in src/schema/automation.ts has no implementing class.

**Recommended Action:** Create implementing class for AlertEvent

---

### GAP-208: Interface not implemented: AutomationSchedule

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/automation.ts |
| Interface | AutomationSchedule |
| Design Doc | - |
| Effort | S |

Interface AutomationSchedule in src/schema/automation.ts has no implementing class.

**Recommended Action:** Create implementing class for AutomationSchedule

---

### GAP-209: Interface not implemented: AutomationRun

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/automation.ts |
| Interface | AutomationRun |
| Design Doc | - |
| Effort | S |

Interface AutomationRun in src/schema/automation.ts has no implementing class.

**Recommended Action:** Create implementing class for AutomationRun

---

### GAP-210: Interface not implemented: DiscoveryObjective

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/automation.ts |
| Interface | DiscoveryObjective |
| Design Doc | - |
| Effort | S |

Interface DiscoveryObjective in src/schema/automation.ts has no implementing class.

**Recommended Action:** Create implementing class for DiscoveryObjective

---

### GAP-211: Interface not implemented: LaunchOptions

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | chrome-management |
| Type | INTERFACE_MISSING |
| File | src/schema/chrome.ts |
| Interface | LaunchOptions |
| Design Doc | - |
| Effort | S |

Interface LaunchOptions in src/schema/chrome.ts has no implementing class.

**Recommended Action:** Create implementing class for LaunchOptions

---

### GAP-212: Interface not implemented: ChromeSlave

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | chrome-management |
| Type | INTERFACE_MISSING |
| File | src/schema/chrome.ts |
| Interface | ChromeSlave |
| Design Doc | - |
| Effort | S |

Interface ChromeSlave in src/schema/chrome.ts has no implementing class.

**Recommended Action:** Create implementing class for ChromeSlave

---

### GAP-213: Interface not implemented: CDPCommand

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | chrome-management |
| Type | INTERFACE_MISSING |
| File | src/schema/chrome.ts |
| Interface | CDPCommand |
| Design Doc | - |
| Effort | S |

Interface CDPCommand in src/schema/chrome.ts has no implementing class.

**Recommended Action:** Create implementing class for CDPCommand

---

### GAP-214: Interface not implemented: CDPResult

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | chrome-management |
| Type | INTERFACE_MISSING |
| File | src/schema/chrome.ts |
| Interface | CDPResult |
| Design Doc | - |
| Effort | S |

Interface CDPResult in src/schema/chrome.ts has no implementing class.

**Recommended Action:** Create implementing class for CDPResult

---

### GAP-215: Interface not implemented: ConfigEntry

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | configuration |
| Type | INTERFACE_MISSING |
| File | src/schema/config.ts |
| Interface | ConfigEntry |
| Design Doc | - |
| Effort | S |

Interface ConfigEntry in src/schema/config.ts has no implementing class.

**Recommended Action:** Create implementing class for ConfigEntry

---

### GAP-216: Interface not implemented: ConfigAuditEntry

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | configuration |
| Type | INTERFACE_MISSING |
| File | src/schema/config.ts |
| Interface | ConfigAuditEntry |
| Design Doc | - |
| Effort | S |

Interface ConfigAuditEntry in src/schema/config.ts has no implementing class.

**Recommended Action:** Create implementing class for ConfigAuditEntry

---

### GAP-217: Interface not implemented: ConfigSchema

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | configuration |
| Type | INTERFACE_MISSING |
| File | src/schema/config.ts |
| Interface | ConfigSchema |
| Design Doc | - |
| Effort | S |

Interface ConfigSchema in src/schema/config.ts has no implementing class.

**Recommended Action:** Create implementing class for ConfigSchema

---

### GAP-218: Interface not implemented: CapabilityTaxonomy

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/core.ts |
| Interface | CapabilityTaxonomy |
| Design Doc | - |
| Effort | S |

Interface CapabilityTaxonomy in src/schema/core.ts has no implementing class.

**Recommended Action:** Create implementing class for CapabilityTaxonomy

---

### GAP-219: Interface not implemented: Binding

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/core.ts |
| Interface | Binding |
| Design Doc | - |
| Effort | S |

Interface Binding in src/schema/core.ts has no implementing class.

**Recommended Action:** Create implementing class for Binding

---

### GAP-220: Interface not implemented: Program

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/core.ts |
| Interface | Program |
| Design Doc | - |
| Effort | S |

Interface Program in src/schema/core.ts has no implementing class.

**Recommended Action:** Create implementing class for Program

---

### GAP-221: Interface not implemented: Outcome

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/core.ts |
| Interface | Outcome |
| Design Doc | - |
| Effort | S |

Interface Outcome in src/schema/core.ts has no implementing class.

**Recommended Action:** Create implementing class for Outcome

---

### GAP-222: Interface not implemented: SelectorStrategy

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/core.ts |
| Interface | SelectorStrategy |
| Design Doc | - |
| Effort | S |

Interface SelectorStrategy in src/schema/core.ts has no implementing class.

**Recommended Action:** Create implementing class for SelectorStrategy

---

### GAP-223: Interface not implemented: HarnessNode

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/harness.ts |
| Interface | HarnessNode |
| Design Doc | - |
| Effort | S |

Interface HarnessNode in src/schema/harness.ts has no implementing class.

**Recommended Action:** Create implementing class for HarnessNode

---

### GAP-224: Interface not implemented: HarnessDAG

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/harness.ts |
| Interface | HarnessDAG |
| Design Doc | - |
| Effort | S |

Interface HarnessDAG in src/schema/harness.ts has no implementing class.

**Recommended Action:** Create implementing class for HarnessDAG

---

### GAP-225: Interface not implemented: HarnessModule

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/harness.ts |
| Interface | HarnessModule |
| Design Doc | - |
| Effort | S |

Interface HarnessModule in src/schema/harness.ts has no implementing class.

**Recommended Action:** Create implementing class for HarnessModule

---

### GAP-226: Interface not implemented: HarnessTelemetry

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/harness.ts |
| Interface | HarnessTelemetry |
| Design Doc | - |
| Effort | S |

Interface HarnessTelemetry in src/schema/harness.ts has no implementing class.

**Recommended Action:** Create implementing class for HarnessTelemetry

---

### GAP-227: Interface not implemented: HarnessCheckpoint

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/harness.ts |
| Interface | HarnessCheckpoint |
| Design Doc | - |
| Effort | S |

Interface HarnessCheckpoint in src/schema/harness.ts has no implementing class.

**Recommended Action:** Create implementing class for HarnessCheckpoint

---

### GAP-228: Interface not implemented: ProviderHealthReport

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/health.ts |
| Interface | ProviderHealthReport |
| Design Doc | - |
| Effort | S |

Interface ProviderHealthReport in src/schema/health.ts has no implementing class.

**Recommended Action:** Create implementing class for ProviderHealthReport

---

### GAP-229: Interface not implemented: HealthSignal

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/health.ts |
| Interface | HealthSignal |
| Design Doc | - |
| Effort | S |

Interface HealthSignal in src/schema/health.ts has no implementing class.

**Recommended Action:** Create implementing class for HealthSignal

---

### GAP-230: Interface not implemented: HealthHistory

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/health.ts |
| Interface | HealthHistory |
| Design Doc | - |
| Effort | S |

Interface HealthHistory in src/schema/health.ts has no implementing class.

**Recommended Action:** Create implementing class for HealthHistory

---

### GAP-231: Interface not implemented: LearningEvent

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/learning.ts |
| Interface | LearningEvent |
| Design Doc | - |
| Effort | S |

Interface LearningEvent in src/schema/learning.ts has no implementing class.

**Recommended Action:** Create implementing class for LearningEvent

---

### GAP-232: Interface not implemented: Rule

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/learning.ts |
| Interface | Rule |
| Design Doc | - |
| Effort | S |

Interface Rule in src/schema/learning.ts has no implementing class.

**Recommended Action:** Create implementing class for Rule

---

### GAP-233: Interface not implemented: BindingEvent

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/learning.ts |
| Interface | BindingEvent |
| Design Doc | - |
| Effort | S |

Interface BindingEvent in src/schema/learning.ts has no implementing class.

**Recommended Action:** Create implementing class for BindingEvent

---

### GAP-234: Interface not implemented: ProviderDefinition

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | provider-routing |
| Type | INTERFACE_MISSING |
| File | src/schema/provider.ts |
| Interface | ProviderDefinition |
| Design Doc | - |
| Effort | S |

Interface ProviderDefinition in src/schema/provider.ts has no implementing class.

**Recommended Action:** Create implementing class for ProviderDefinition

---

### GAP-235: Interface not implemented: ProviderEndpoint

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | provider-routing |
| Type | INTERFACE_MISSING |
| File | src/schema/provider.ts |
| Interface | ProviderEndpoint |
| Design Doc | - |
| Effort | S |

Interface ProviderEndpoint in src/schema/provider.ts has no implementing class.

**Recommended Action:** Create implementing class for ProviderEndpoint

---

### GAP-236: Interface not implemented: ProviderAccount

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | provider-routing |
| Type | INTERFACE_MISSING |
| File | src/schema/provider.ts |
| Interface | ProviderAccount |
| Design Doc | - |
| Effort | S |

Interface ProviderAccount in src/schema/provider.ts has no implementing class.

**Recommended Action:** Create implementing class for ProviderAccount

---

### GAP-237: Interface not implemented: ProviderParser

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | provider-routing |
| Type | INTERFACE_MISSING |
| File | src/schema/provider.ts |
| Interface | ProviderParser |
| Design Doc | - |
| Effort | S |

Interface ProviderParser in src/schema/provider.ts has no implementing class.

**Recommended Action:** Create implementing class for ProviderParser

---

### GAP-238: Interface not implemented: RouteSpec

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | provider-routing |
| Type | INTERFACE_MISSING |
| File | src/schema/routing.ts |
| Interface | RouteSpec |
| Design Doc | - |
| Effort | S |

Interface RouteSpec in src/schema/routing.ts has no implementing class.

**Recommended Action:** Create implementing class for RouteSpec

---

### GAP-239: Interface not implemented: RouteRequest

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | provider-routing |
| Type | INTERFACE_MISSING |
| File | src/schema/routing.ts |
| Interface | RouteRequest |
| Design Doc | - |
| Effort | S |

Interface RouteRequest in src/schema/routing.ts has no implementing class.

**Recommended Action:** Create implementing class for RouteRequest

---

### GAP-240: Interface not implemented: RouteTarget

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | provider-routing |
| Type | INTERFACE_MISSING |
| File | src/schema/routing.ts |
| Interface | RouteTarget |
| Design Doc | - |
| Effort | S |

Interface RouteTarget in src/schema/routing.ts has no implementing class.

**Recommended Action:** Create implementing class for RouteTarget

---

### GAP-241: Interface not implemented: RouteEvent

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | provider-routing |
| Type | INTERFACE_MISSING |
| File | src/schema/routing.ts |
| Interface | RouteEvent |
| Design Doc | - |
| Effort | S |

Interface RouteEvent in src/schema/routing.ts has no implementing class.

**Recommended Action:** Create implementing class for RouteEvent

---

### GAP-242: Interface not implemented: VivimSession

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | session-state |
| Type | INTERFACE_MISSING |
| File | src/schema/session.ts |
| Interface | VivimSession |
| Design Doc | - |
| Effort | S |

Interface VivimSession in src/schema/session.ts has no implementing class.

**Recommended Action:** Create implementing class for VivimSession

---

### GAP-243: Interface not implemented: ProviderSession

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | session-state |
| Type | INTERFACE_MISSING |
| File | src/schema/session.ts |
| Interface | ProviderSession |
| Design Doc | - |
| Effort | S |

Interface ProviderSession in src/schema/session.ts has no implementing class.

**Recommended Action:** Create implementing class for ProviderSession

---

### GAP-244: Interface not implemented: ProfileSession

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | session-state |
| Type | INTERFACE_MISSING |
| File | src/schema/session.ts |
| Interface | ProfileSession |
| Design Doc | - |
| Effort | S |

Interface ProfileSession in src/schema/session.ts has no implementing class.

**Recommended Action:** Create implementing class for ProfileSession

---

### GAP-245: Interface not implemented: Conversation

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | session-state |
| Type | INTERFACE_MISSING |
| File | src/schema/session.ts |
| Interface | Conversation |
| Design Doc | - |
| Effort | S |

Interface Conversation in src/schema/session.ts has no implementing class.

**Recommended Action:** Create implementing class for Conversation

---

### GAP-246: Interface not implemented: ConversationMessage

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | session-state |
| Type | INTERFACE_MISSING |
| File | src/schema/session.ts |
| Interface | ConversationMessage |
| Design Doc | - |
| Effort | S |

Interface ConversationMessage in src/schema/session.ts has no implementing class.

**Recommended Action:** Create implementing class for ConversationMessage

---

### GAP-247: Interface not implemented: TelemetryPipelineConfig

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/telemetry.ts |
| Interface | TelemetryPipelineConfig |
| Design Doc | - |
| Effort | S |

Interface TelemetryPipelineConfig in src/schema/telemetry.ts has no implementing class.

**Recommended Action:** Create implementing class for TelemetryPipelineConfig

---

### GAP-248: Interface not implemented: TelemetrySchedule

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/telemetry.ts |
| Interface | TelemetrySchedule |
| Design Doc | - |
| Effort | S |

Interface TelemetrySchedule in src/schema/telemetry.ts has no implementing class.

**Recommended Action:** Create implementing class for TelemetrySchedule

---

### GAP-249: Interface not implemented: TelemetryRetention

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/telemetry.ts |
| Interface | TelemetryRetention |
| Design Doc | - |
| Effort | S |

Interface TelemetryRetention in src/schema/telemetry.ts has no implementing class.

**Recommended Action:** Create implementing class for TelemetryRetention

---

### GAP-250: Interface not implemented: TransferPattern

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/transfer.ts |
| Interface | TransferPattern |
| Design Doc | - |
| Effort | S |

Interface TransferPattern in src/schema/transfer.ts has no implementing class.

**Recommended Action:** Create implementing class for TransferPattern

---

### GAP-251: Interface not implemented: TransferCandidate

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/transfer.ts |
| Interface | TransferCandidate |
| Design Doc | - |
| Effort | S |

Interface TransferCandidate in src/schema/transfer.ts has no implementing class.

**Recommended Action:** Create implementing class for TransferCandidate

---

### GAP-252: Interface not implemented: TransferAttempt

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/transfer.ts |
| Interface | TransferAttempt |
| Design Doc | - |
| Effort | S |

Interface TransferAttempt in src/schema/transfer.ts has no implementing class.

**Recommended Action:** Create implementing class for TransferAttempt

---

### GAP-253: Interface not implemented: MigrationLogRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/types.ts |
| Interface | MigrationLogRow |
| Design Doc | - |
| Effort | S |

Interface MigrationLogRow in src/schema/types.ts has no implementing class.

**Recommended Action:** Create implementing class for MigrationLogRow

---

### GAP-254: Interface not implemented: ProviderDefinitionRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/types.ts |
| Interface | ProviderDefinitionRow |
| Design Doc | - |
| Effort | S |

Interface ProviderDefinitionRow in src/schema/types.ts has no implementing class.

**Recommended Action:** Create implementing class for ProviderDefinitionRow

---

### GAP-255: Interface not implemented: ProviderEndpointRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/types.ts |
| Interface | ProviderEndpointRow |
| Design Doc | - |
| Effort | S |

Interface ProviderEndpointRow in src/schema/types.ts has no implementing class.

**Recommended Action:** Create implementing class for ProviderEndpointRow

---

### GAP-256: Interface not implemented: ProviderParserRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/types.ts |
| Interface | ProviderParserRow |
| Design Doc | - |
| Effort | S |

Interface ProviderParserRow in src/schema/types.ts has no implementing class.

**Recommended Action:** Create implementing class for ProviderParserRow

---

### GAP-257: Interface not implemented: ProviderCapabilityRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/types.ts |
| Interface | ProviderCapabilityRow |
| Design Doc | - |
| Effort | S |

Interface ProviderCapabilityRow in src/schema/types.ts has no implementing class.

**Recommended Action:** Create implementing class for ProviderCapabilityRow

---

### GAP-258: Interface not implemented: ProviderConfigRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/types.ts |
| Interface | ProviderConfigRow |
| Design Doc | - |
| Effort | S |

Interface ProviderConfigRow in src/schema/types.ts has no implementing class.

**Recommended Action:** Create implementing class for ProviderConfigRow

---

### GAP-259: Interface not implemented: ProviderModelRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/types.ts |
| Interface | ProviderModelRow |
| Design Doc | - |
| Effort | S |

Interface ProviderModelRow in src/schema/types.ts has no implementing class.

**Recommended Action:** Create implementing class for ProviderModelRow

---

### GAP-260: Interface not implemented: ProviderAccountRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/types.ts |
| Interface | ProviderAccountRow |
| Design Doc | - |
| Effort | S |

Interface ProviderAccountRow in src/schema/types.ts has no implementing class.

**Recommended Action:** Create implementing class for ProviderAccountRow

---

### GAP-261: Interface not implemented: TraceEntryRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/types.ts |
| Interface | TraceEntryRow |
| Design Doc | - |
| Effort | S |

Interface TraceEntryRow in src/schema/types.ts has no implementing class.

**Recommended Action:** Create implementing class for TraceEntryRow

---

### GAP-262: Interface not implemented: CapabilityTaxonomyRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/types.ts |
| Interface | CapabilityTaxonomyRow |
| Design Doc | - |
| Effort | S |

Interface CapabilityTaxonomyRow in src/schema/types.ts has no implementing class.

**Recommended Action:** Create implementing class for CapabilityTaxonomyRow

---

### GAP-263: Interface not implemented: CapabilityTierRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/types.ts |
| Interface | CapabilityTierRow |
| Design Doc | - |
| Effort | S |

Interface CapabilityTierRow in src/schema/types.ts has no implementing class.

**Recommended Action:** Create implementing class for CapabilityTierRow

---

### GAP-264: Interface not implemented: CapabilityBindingRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/types.ts |
| Interface | CapabilityBindingRow |
| Design Doc | - |
| Effort | S |

Interface CapabilityBindingRow in src/schema/types.ts has no implementing class.

**Recommended Action:** Create implementing class for CapabilityBindingRow

---

### GAP-265: Interface not implemented: CapabilityProgramRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/types.ts |
| Interface | CapabilityProgramRow |
| Design Doc | - |
| Effort | S |

Interface CapabilityProgramRow in src/schema/types.ts has no implementing class.

**Recommended Action:** Create implementing class for CapabilityProgramRow

---

### GAP-266: Interface not implemented: SelectorStrategyRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/types.ts |
| Interface | SelectorStrategyRow |
| Design Doc | - |
| Effort | S |

Interface SelectorStrategyRow in src/schema/types.ts has no implementing class.

**Recommended Action:** Create implementing class for SelectorStrategyRow

---

### GAP-267: Interface not implemented: OutcomeRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/types.ts |
| Interface | OutcomeRow |
| Design Doc | - |
| Effort | S |

Interface OutcomeRow in src/schema/types.ts has no implementing class.

**Recommended Action:** Create implementing class for OutcomeRow

---

### GAP-268: Interface not implemented: VivimSessionRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/types.ts |
| Interface | VivimSessionRow |
| Design Doc | - |
| Effort | S |

Interface VivimSessionRow in src/schema/types.ts has no implementing class.

**Recommended Action:** Create implementing class for VivimSessionRow

---

### GAP-269: Interface not implemented: ProviderSessionRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/types.ts |
| Interface | ProviderSessionRow |
| Design Doc | - |
| Effort | S |

Interface ProviderSessionRow in src/schema/types.ts has no implementing class.

**Recommended Action:** Create implementing class for ProviderSessionRow

---

### GAP-270: Interface not implemented: ProfileSessionRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/types.ts |
| Interface | ProfileSessionRow |
| Design Doc | - |
| Effort | S |

Interface ProfileSessionRow in src/schema/types.ts has no implementing class.

**Recommended Action:** Create implementing class for ProfileSessionRow

---

### GAP-271: Interface not implemented: ConversationRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/types.ts |
| Interface | ConversationRow |
| Design Doc | - |
| Effort | S |

Interface ConversationRow in src/schema/types.ts has no implementing class.

**Recommended Action:** Create implementing class for ConversationRow

---

### GAP-272: Interface not implemented: ConversationMessageRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/types.ts |
| Interface | ConversationMessageRow |
| Design Doc | - |
| Effort | S |

Interface ConversationMessageRow in src/schema/types.ts has no implementing class.

**Recommended Action:** Create implementing class for ConversationMessageRow

---

### GAP-273: Interface not implemented: StateTransitionRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/types.ts |
| Interface | StateTransitionRow |
| Design Doc | - |
| Effort | S |

Interface StateTransitionRow in src/schema/types.ts has no implementing class.

**Recommended Action:** Create implementing class for StateTransitionRow

---

### GAP-274: Interface not implemented: SessionCheckpointRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/types.ts |
| Interface | SessionCheckpointRow |
| Design Doc | - |
| Effort | S |

Interface SessionCheckpointRow in src/schema/types.ts has no implementing class.

**Recommended Action:** Create implementing class for SessionCheckpointRow

---

### GAP-275: Interface not implemented: StreamBlockRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/types.ts |
| Interface | StreamBlockRow |
| Design Doc | - |
| Effort | S |

Interface StreamBlockRow in src/schema/types.ts has no implementing class.

**Recommended Action:** Create implementing class for StreamBlockRow

---

### GAP-276: Interface not implemented: ProviderManifestVersionRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/types.ts |
| Interface | ProviderManifestVersionRow |
| Design Doc | - |
| Effort | S |

Interface ProviderManifestVersionRow in src/schema/types.ts has no implementing class.

**Recommended Action:** Create implementing class for ProviderManifestVersionRow

---

### GAP-277: Interface not implemented: RegistrationEventRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/types.ts |
| Interface | RegistrationEventRow |
| Design Doc | - |
| Effort | S |

Interface RegistrationEventRow in src/schema/types.ts has no implementing class.

**Recommended Action:** Create implementing class for RegistrationEventRow

---

### GAP-278: Interface not implemented: ManifestDriftRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/types.ts |
| Interface | ManifestDriftRow |
| Design Doc | - |
| Effort | S |

Interface ManifestDriftRow in src/schema/types.ts has no implementing class.

**Recommended Action:** Create implementing class for ManifestDriftRow

---

### GAP-279: Interface not implemented: BindingStatusLogRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/types.ts |
| Interface | BindingStatusLogRow |
| Design Doc | - |
| Effort | S |

Interface BindingStatusLogRow in src/schema/types.ts has no implementing class.

**Recommended Action:** Create implementing class for BindingStatusLogRow

---

### GAP-280: Interface not implemented: ProgramVersionMetricRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/types.ts |
| Interface | ProgramVersionMetricRow |
| Design Doc | - |
| Effort | S |

Interface ProgramVersionMetricRow in src/schema/types.ts has no implementing class.

**Recommended Action:** Create implementing class for ProgramVersionMetricRow

---

### GAP-281: Interface not implemented: HealthHistoryRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/types.ts |
| Interface | HealthHistoryRow |
| Design Doc | - |
| Effort | S |

Interface HealthHistoryRow in src/schema/types.ts has no implementing class.

**Recommended Action:** Create implementing class for HealthHistoryRow

---

### GAP-282: Interface not implemented: ConfigEntryRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/types.ts |
| Interface | ConfigEntryRow |
| Design Doc | - |
| Effort | S |

Interface ConfigEntryRow in src/schema/types.ts has no implementing class.

**Recommended Action:** Create implementing class for ConfigEntryRow

---

### GAP-283: Interface not implemented: ConfigAuditRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/types.ts |
| Interface | ConfigAuditRow |
| Design Doc | - |
| Effort | S |

Interface ConfigAuditRow in src/schema/types.ts has no implementing class.

**Recommended Action:** Create implementing class for ConfigAuditRow

---

### GAP-284: Interface not implemented: ManifestVersionInput

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/types.ts |
| Interface | ManifestVersionInput |
| Design Doc | - |
| Effort | S |

Interface ManifestVersionInput in src/schema/types.ts has no implementing class.

**Recommended Action:** Create implementing class for ManifestVersionInput

---

### GAP-285: Interface not implemented: RegistrationEventInput

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/types.ts |
| Interface | RegistrationEventInput |
| Design Doc | - |
| Effort | S |

Interface RegistrationEventInput in src/schema/types.ts has no implementing class.

**Recommended Action:** Create implementing class for RegistrationEventInput

---

### GAP-286: Interface not implemented: ManifestDriftInput

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/types.ts |
| Interface | ManifestDriftInput |
| Design Doc | - |
| Effort | S |

Interface ManifestDriftInput in src/schema/types.ts has no implementing class.

**Recommended Action:** Create implementing class for ManifestDriftInput

---

### GAP-287: Interface not implemented: RouteSpecRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/types.ts |
| Interface | RouteSpecRow |
| Design Doc | - |
| Effort | S |

Interface RouteSpecRow in src/schema/types.ts has no implementing class.

**Recommended Action:** Create implementing class for RouteSpecRow

---

### GAP-288: Interface not implemented: RouteRequestRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/types.ts |
| Interface | RouteRequestRow |
| Design Doc | - |
| Effort | S |

Interface RouteRequestRow in src/schema/types.ts has no implementing class.

**Recommended Action:** Create implementing class for RouteRequestRow

---

### GAP-289: Interface not implemented: RouteTargetRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/types.ts |
| Interface | RouteTargetRow |
| Design Doc | - |
| Effort | S |

Interface RouteTargetRow in src/schema/types.ts has no implementing class.

**Recommended Action:** Create implementing class for RouteTargetRow

---

### GAP-290: Interface not implemented: RouteEventRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/types.ts |
| Interface | RouteEventRow |
| Design Doc | - |
| Effort | S |

Interface RouteEventRow in src/schema/types.ts has no implementing class.

**Recommended Action:** Create implementing class for RouteEventRow

---

### GAP-291: Interface not implemented: VersionConfig

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/versioning.ts |
| Interface | VersionConfig |
| Design Doc | - |
| Effort | S |

Interface VersionConfig in src/schema/versioning.ts has no implementing class.

**Recommended Action:** Create implementing class for VersionConfig

---

### GAP-292: Interface not implemented: PromotionRule

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/versioning.ts |
| Interface | PromotionRule |
| Design Doc | - |
| Effort | S |

Interface PromotionRule in src/schema/versioning.ts has no implementing class.

**Recommended Action:** Create implementing class for PromotionRule

---

### GAP-293: Interface not implemented: DegradationRule

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/versioning.ts |
| Interface | DegradationRule |
| Design Doc | - |
| Effort | S |

Interface DegradationRule in src/schema/versioning.ts has no implementing class.

**Recommended Action:** Create implementing class for DegradationRule

---

### GAP-294: Interface not implemented: ProviderManifestVersion

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | schema |
| Type | INTERFACE_MISSING |
| File | src/schema/versioning.ts |
| Interface | ProviderManifestVersion |
| Design Doc | - |
| Effort | S |

Interface ProviderManifestVersion in src/schema/versioning.ts has no implementing class.

**Recommended Action:** Create implementing class for ProviderManifestVersion

---

### GAP-295: Interface not implemented: ServerContext

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | api-server |
| Type | INTERFACE_MISSING |
| File | src/server/index.ts |
| Interface | ServerContext |
| Design Doc | - |
| Effort | S |

Interface ServerContext in src/server/index.ts has no implementing class.

**Recommended Action:** Create implementing class for ServerContext

---

### GAP-296: Interface not implemented: WsLike

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | api-server |
| Type | INTERFACE_MISSING |
| File | src/server/websocket.ts |
| Interface | WsLike |
| Design Doc | - |
| Effort | S |

Interface WsLike in src/server/websocket.ts has no implementing class.

**Recommended Action:** Create implementing class for WsLike

---

### GAP-297: Interface not implemented: RawResolutionRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | capability-system |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/capability-resolution-store.ts |
| Interface | RawResolutionRow |
| Design Doc | - |
| Effort | S |

Interface RawResolutionRow in src/storage/contracts/capability-resolution-store.ts has no implementing class.

**Recommended Action:** Create implementing class for RawResolutionRow

---

### GAP-298: Interface not implemented: CapabilityResolutionStore

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | capability-system |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/capability-resolution-store.ts |
| Interface | CapabilityResolutionStore |
| Design Doc | - |
| Effort | S |

Interface CapabilityResolutionStore in src/storage/contracts/capability-resolution-store.ts has no implementing class.

**Recommended Action:** Create implementing class for CapabilityResolutionStore

---

### GAP-299: Interface not implemented: CapabilityTaxonomyRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | capability-system |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/capability-store.ts |
| Interface | CapabilityTaxonomyRow |
| Design Doc | - |
| Effort | S |

Interface CapabilityTaxonomyRow in src/storage/contracts/capability-store.ts has no implementing class.

**Recommended Action:** Create implementing class for CapabilityTaxonomyRow

---

### GAP-300: Interface not implemented: CapabilityBindingRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | capability-system |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/capability-store.ts |
| Interface | CapabilityBindingRow |
| Design Doc | - |
| Effort | S |

Interface CapabilityBindingRow in src/storage/contracts/capability-store.ts has no implementing class.

**Recommended Action:** Create implementing class for CapabilityBindingRow

---

### GAP-301: Interface not implemented: CapabilityProgramRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | capability-system |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/capability-store.ts |
| Interface | CapabilityProgramRow |
| Design Doc | - |
| Effort | S |

Interface CapabilityProgramRow in src/storage/contracts/capability-store.ts has no implementing class.

**Recommended Action:** Create implementing class for CapabilityProgramRow

---

### GAP-302: Interface not implemented: SelectorStrategyRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | capability-system |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/capability-store.ts |
| Interface | SelectorStrategyRow |
| Design Doc | - |
| Effort | S |

Interface SelectorStrategyRow in src/storage/contracts/capability-store.ts has no implementing class.

**Recommended Action:** Create implementing class for SelectorStrategyRow

---

### GAP-303: Interface not implemented: OutcomeRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | capability-system |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/capability-store.ts |
| Interface | OutcomeRow |
| Design Doc | - |
| Effort | S |

Interface OutcomeRow in src/storage/contracts/capability-store.ts has no implementing class.

**Recommended Action:** Create implementing class for OutcomeRow

---

### GAP-304: Interface not implemented: OutcomeInput

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | capability-system |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/capability-store.ts |
| Interface | OutcomeInput |
| Design Doc | - |
| Effort | S |

Interface OutcomeInput in src/storage/contracts/capability-store.ts has no implementing class.

**Recommended Action:** Create implementing class for OutcomeInput

---

### GAP-305: Interface not implemented: CapabilityStore

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | capability-system |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/capability-store.ts |
| Interface | CapabilityStore |
| Design Doc | - |
| Effort | S |

Interface CapabilityStore in src/storage/contracts/capability-store.ts has no implementing class.

**Recommended Action:** Create implementing class for CapabilityStore

---

### GAP-306: Interface not implemented: ConfigEntryRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | configuration |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/config-store.ts |
| Interface | ConfigEntryRow |
| Design Doc | - |
| Effort | S |

Interface ConfigEntryRow in src/storage/contracts/config-store.ts has no implementing class.

**Recommended Action:** Create implementing class for ConfigEntryRow

---

### GAP-307: Interface not implemented: ConfigAuditRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | configuration |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/config-store.ts |
| Interface | ConfigAuditRow |
| Design Doc | - |
| Effort | S |

Interface ConfigAuditRow in src/storage/contracts/config-store.ts has no implementing class.

**Recommended Action:** Create implementing class for ConfigAuditRow

---

### GAP-308: Interface not implemented: ConfigStore

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | configuration |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/config-store.ts |
| Interface | ConfigStore |
| Design Doc | - |
| Effort | S |

Interface ConfigStore in src/storage/contracts/config-store.ts has no implementing class.

**Recommended Action:** Create implementing class for ConfigStore

---

### GAP-309: Interface not implemented: ConversationRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | session-state |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/conversation-store.ts |
| Interface | ConversationRow |
| Design Doc | - |
| Effort | S |

Interface ConversationRow in src/storage/contracts/conversation-store.ts has no implementing class.

**Recommended Action:** Create implementing class for ConversationRow

---

### GAP-310: Interface not implemented: ConversationMessageRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | session-state |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/conversation-store.ts |
| Interface | ConversationMessageRow |
| Design Doc | - |
| Effort | S |

Interface ConversationMessageRow in src/storage/contracts/conversation-store.ts has no implementing class.

**Recommended Action:** Create implementing class for ConversationMessageRow

---

### GAP-311: Interface not implemented: ProviderAccountRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | session-state |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/conversation-store.ts |
| Interface | ProviderAccountRow |
| Design Doc | - |
| Effort | S |

Interface ProviderAccountRow in src/storage/contracts/conversation-store.ts has no implementing class.

**Recommended Action:** Create implementing class for ProviderAccountRow

---

### GAP-312: Interface not implemented: ConversationInput

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | session-state |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/conversation-store.ts |
| Interface | ConversationInput |
| Design Doc | - |
| Effort | S |

Interface ConversationInput in src/storage/contracts/conversation-store.ts has no implementing class.

**Recommended Action:** Create implementing class for ConversationInput

---

### GAP-313: Interface not implemented: MessageInput

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | session-state |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/conversation-store.ts |
| Interface | MessageInput |
| Design Doc | - |
| Effort | S |

Interface MessageInput in src/storage/contracts/conversation-store.ts has no implementing class.

**Recommended Action:** Create implementing class for MessageInput

---

### GAP-314: Interface not implemented: ProviderAccountRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | storage |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/governor-store.ts |
| Interface | ProviderAccountRow |
| Design Doc | - |
| Effort | S |

Interface ProviderAccountRow in src/storage/contracts/governor-store.ts has no implementing class.

**Recommended Action:** Create implementing class for ProviderAccountRow

---

### GAP-315: Interface not implemented: FleetEventRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | storage |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/governor-store.ts |
| Interface | FleetEventRow |
| Design Doc | - |
| Effort | S |

Interface FleetEventRow in src/storage/contracts/governor-store.ts has no implementing class.

**Recommended Action:** Create implementing class for FleetEventRow

---

### GAP-316: Interface not implemented: CircuitBreakerStateRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | storage |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/governor-store.ts |
| Interface | CircuitBreakerStateRow |
| Design Doc | - |
| Effort | S |

Interface CircuitBreakerStateRow in src/storage/contracts/governor-store.ts has no implementing class.

**Recommended Action:** Create implementing class for CircuitBreakerStateRow

---

### GAP-317: Interface not implemented: HealthTickRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | storage |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/governor-store.ts |
| Interface | HealthTickRow |
| Design Doc | - |
| Effort | S |

Interface HealthTickRow in src/storage/contracts/governor-store.ts has no implementing class.

**Recommended Action:** Create implementing class for HealthTickRow

---

### GAP-318: Interface not implemented: TraceEntryRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | storage |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/governor-store.ts |
| Interface | TraceEntryRow |
| Design Doc | - |
| Effort | S |

Interface TraceEntryRow in src/storage/contracts/governor-store.ts has no implementing class.

**Recommended Action:** Create implementing class for TraceEntryRow

---

### GAP-319: Interface not implemented: FleetEventInput

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | storage |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/governor-store.ts |
| Interface | FleetEventInput |
| Design Doc | - |
| Effort | S |

Interface FleetEventInput in src/storage/contracts/governor-store.ts has no implementing class.

**Recommended Action:** Create implementing class for FleetEventInput

---

### GAP-320: Interface not implemented: TraceEntryInput

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | storage |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/governor-store.ts |
| Interface | TraceEntryInput |
| Design Doc | - |
| Effort | S |

Interface TraceEntryInput in src/storage/contracts/governor-store.ts has no implementing class.

**Recommended Action:** Create implementing class for TraceEntryInput

---

### GAP-321: Interface not implemented: DriftEvent

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | storage |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/health-store.ts |
| Interface | DriftEvent |
| Design Doc | - |
| Effort | S |

Interface DriftEvent in src/storage/contracts/health-store.ts has no implementing class.

**Recommended Action:** Create implementing class for DriftEvent

---

### GAP-322: Interface not implemented: CapabilityHealthRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | storage |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/health-store.ts |
| Interface | CapabilityHealthRow |
| Design Doc | - |
| Effort | S |

Interface CapabilityHealthRow in src/storage/contracts/health-store.ts has no implementing class.

**Recommended Action:** Create implementing class for CapabilityHealthRow

---

### GAP-323: Interface not implemented: ParserWindowRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | storage |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/health-store.ts |
| Interface | ParserWindowRow |
| Design Doc | - |
| Effort | S |

Interface ParserWindowRow in src/storage/contracts/health-store.ts has no implementing class.

**Recommended Action:** Create implementing class for ParserWindowRow

---

### GAP-324: Interface not implemented: HealthStore

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | storage |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/health-store.ts |
| Interface | HealthStore |
| Design Doc | - |
| Effort | S |

Interface HealthStore in src/storage/contracts/health-store.ts has no implementing class.

**Recommended Action:** Create implementing class for HealthStore

---

### GAP-325: Interface not implemented: HpeSession

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | session-state |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/hpe-session-store.ts |
| Interface | HpeSession |
| Design Doc | - |
| Effort | S |

Interface HpeSession in src/storage/contracts/hpe-session-store.ts has no implementing class.

**Recommended Action:** Create implementing class for HpeSession

---

### GAP-326: Interface not implemented: HpeSessionStoreContract

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | session-state |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/hpe-session-store.ts |
| Interface | HpeSessionStoreContract |
| Design Doc | - |
| Effort | S |

Interface HpeSessionStoreContract in src/storage/contracts/hpe-session-store.ts has no implementing class.

**Recommended Action:** Create implementing class for HpeSessionStoreContract

---

### GAP-327: Interface not implemented: ProviderParserRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | storage |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/parser-store.ts |
| Interface | ProviderParserRow |
| Design Doc | - |
| Effort | S |

Interface ProviderParserRow in src/storage/contracts/parser-store.ts has no implementing class.

**Recommended Action:** Create implementing class for ProviderParserRow

---

### GAP-328: Interface not implemented: ParserStore

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | storage |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/parser-store.ts |
| Interface | ParserStore |
| Design Doc | - |
| Effort | S |

Interface ParserStore in src/storage/contracts/parser-store.ts has no implementing class.

**Recommended Action:** Create implementing class for ParserStore

---

### GAP-329: Interface not implemented: ProviderStore

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | provider-routing |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/provider-store.ts |
| Interface | ProviderStore |
| Design Doc | - |
| Effort | S |

Interface ProviderStore in src/storage/contracts/provider-store.ts has no implementing class.

**Recommended Action:** Create implementing class for ProviderStore

---

### GAP-330: Interface not implemented: RegistrationStore

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | storage |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/registration-store.ts |
| Interface | RegistrationStore |
| Design Doc | - |
| Effort | S |

Interface RegistrationStore in src/storage/contracts/registration-store.ts has no implementing class.

**Recommended Action:** Create implementing class for RegistrationStore

---

### GAP-331: Interface not implemented: RouterStore

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | api-server |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/router-store.ts |
| Interface | RouterStore |
| Design Doc | - |
| Effort | S |

Interface RouterStore in src/storage/contracts/router-store.ts has no implementing class.

**Recommended Action:** Create implementing class for RouterStore

---

### GAP-332: Interface not implemented: StreamBlockRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | storage |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/stream-block-store.ts |
| Interface | StreamBlockRow |
| Design Doc | - |
| Effort | S |

Interface StreamBlockRow in src/storage/contracts/stream-block-store.ts has no implementing class.

**Recommended Action:** Create implementing class for StreamBlockRow

---

### GAP-333: Interface not implemented: HealthHistoryRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | storage |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/telemetry-store.ts |
| Interface | HealthHistoryRow |
| Design Doc | - |
| Effort | S |

Interface HealthHistoryRow in src/storage/contracts/telemetry-store.ts has no implementing class.

**Recommended Action:** Create implementing class for HealthHistoryRow

---

### GAP-334: Interface not implemented: SelectorHealthRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | storage |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/telemetry-store.ts |
| Interface | SelectorHealthRow |
| Design Doc | - |
| Effort | S |

Interface SelectorHealthRow in src/storage/contracts/telemetry-store.ts has no implementing class.

**Recommended Action:** Create implementing class for SelectorHealthRow

---

### GAP-335: Interface not implemented: DailySummaryRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | storage |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/telemetry-store.ts |
| Interface | DailySummaryRow |
| Design Doc | - |
| Effort | S |

Interface DailySummaryRow in src/storage/contracts/telemetry-store.ts has no implementing class.

**Recommended Action:** Create implementing class for DailySummaryRow

---

### GAP-336: Interface not implemented: CrossProviderSummary

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | storage |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/telemetry-store.ts |
| Interface | CrossProviderSummary |
| Design Doc | - |
| Effort | S |

Interface CrossProviderSummary in src/storage/contracts/telemetry-store.ts has no implementing class.

**Recommended Action:** Create implementing class for CrossProviderSummary

---

### GAP-337: Interface not implemented: ManifestChangeInput

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | storage |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/telemetry-store.ts |
| Interface | ManifestChangeInput |
| Design Doc | - |
| Effort | S |

Interface ManifestChangeInput in src/storage/contracts/telemetry-store.ts has no implementing class.

**Recommended Action:** Create implementing class for ManifestChangeInput

---

### GAP-338: Interface not implemented: ManifestChangeRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | storage |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/telemetry-store.ts |
| Interface | ManifestChangeRow |
| Design Doc | - |
| Effort | S |

Interface ManifestChangeRow in src/storage/contracts/telemetry-store.ts has no implementing class.

**Recommended Action:** Create implementing class for ManifestChangeRow

---

### GAP-339: Interface not implemented: TaxonomyVersionRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | storage |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/version-store.ts |
| Interface | TaxonomyVersionRow |
| Design Doc | - |
| Effort | S |

Interface TaxonomyVersionRow in src/storage/contracts/version-store.ts has no implementing class.

**Recommended Action:** Create implementing class for TaxonomyVersionRow

---

### GAP-340: Interface not implemented: TaxonomyVersionInput

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | storage |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/version-store.ts |
| Interface | TaxonomyVersionInput |
| Design Doc | - |
| Effort | S |

Interface TaxonomyVersionInput in src/storage/contracts/version-store.ts has no implementing class.

**Recommended Action:** Create implementing class for TaxonomyVersionInput

---

### GAP-341: Interface not implemented: StatusLogRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | storage |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/version-store.ts |
| Interface | StatusLogRow |
| Design Doc | - |
| Effort | S |

Interface StatusLogRow in src/storage/contracts/version-store.ts has no implementing class.

**Recommended Action:** Create implementing class for StatusLogRow

---

### GAP-342: Interface not implemented: StatusLogInput

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | storage |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/version-store.ts |
| Interface | StatusLogInput |
| Design Doc | - |
| Effort | S |

Interface StatusLogInput in src/storage/contracts/version-store.ts has no implementing class.

**Recommended Action:** Create implementing class for StatusLogInput

---

### GAP-343: Interface not implemented: ProgramMetricRow

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | storage |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/version-store.ts |
| Interface | ProgramMetricRow |
| Design Doc | - |
| Effort | S |

Interface ProgramMetricRow in src/storage/contracts/version-store.ts has no implementing class.

**Recommended Action:** Create implementing class for ProgramMetricRow

---

### GAP-344: Interface not implemented: ProgramMetricInput

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | storage |
| Type | INTERFACE_MISSING |
| File | src/storage/contracts/version-store.ts |
| Interface | ProgramMetricInput |
| Design Doc | - |
| Effort | S |

Interface ProgramMetricInput in src/storage/contracts/version-store.ts has no implementing class.

**Recommended Action:** Create implementing class for ProgramMetricInput

---

### GAP-345: Interface not implemented: PrismaClientLike

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | storage |
| Type | INTERFACE_MISSING |
| File | src/storage/impl/prisma-like.ts |
| Interface | PrismaClientLike |
| Design Doc | - |
| Effort | S |

Interface PrismaClientLike in src/storage/impl/prisma-like.ts has no implementing class.

**Recommended Action:** Create implementing class for PrismaClientLike

---

### GAP-346: Interface partial: AlertStore (6 methods missing)

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_PARTIAL |
| File | src/alerting/alerter.ts |
| Interface | AlertStore |
| Design Doc | - |
| Effort | S |

Class Alerter implements AlertStore but 6/9 methods missing: listConditions, getCondition, createCondition, createEvent, acknowledgeEvent, getLastEventForCondition

**Recommended Action:** Implement missing methods: listConditions, getCondition, createCondition, createEvent, acknowledgeEvent, getLastEventForCondition

---

### GAP-347: Interface partial: CapabilityMacroStore (3 methods missing)

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | capability-system |
| Type | INTERFACE_PARTIAL |
| File | src/engines/capability-macro.ts |
| Interface | CapabilityMacroStore |
| Design Doc | - |
| Effort | S |

Class CapabilityMacroEngine implements CapabilityMacroStore but 3/5 methods missing: create, update, delete

**Recommended Action:** Implement missing methods: create, update, delete

---

### GAP-348: Interface partial: MirrorStore (4 methods missing)

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | general |
| Type | INTERFACE_PARTIAL |
| File | src/engines/mirror-engine.ts |
| Interface | MirrorStore |
| Design Doc | - |
| Effort | S |

Class MirrorEngine implements MirrorStore but 4/5 methods missing: upsertMirrorState, createOptimisticUpdate, recordLatency, createSnapshot

**Recommended Action:** Implement missing methods: upsertMirrorState, createOptimisticUpdate, recordLatency, createSnapshot

---

### GAP-349: Interface partial: ParserModule (1 methods missing)

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | session-state |
| Type | INTERFACE_PARTIAL |
| File | src/engines/stream-parser.ts |
| Interface | ParserModule |
| Design Doc | - |
| Effort | S |

Class StreamParserEngine implements ParserModule but 1/3 methods missing: getConfidence

**Recommended Action:** Implement missing methods: getConfidence

---

### GAP-350: Interface partial: ConversationStore (6 methods missing)

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | session-state |
| Type | INTERFACE_PARTIAL |
| File | src/engines/conversation-manager.ts |
| Interface | ConversationStore |
| Design Doc | - |
| Effort | S |

Class ConversationManager implements ConversationStore but 6/8 methods missing: updateConversation, deleteConversation, createMessage, getMessage, getLastMessage, getAccount

**Recommended Action:** Implement missing methods: updateConversation, deleteConversation, createMessage, getMessage, getLastMessage, getAccount

---

### GAP-351: Interface partial: GovernorStore (10 methods missing)

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | storage |
| Type | INTERFACE_PARTIAL |
| File | src/engines/chrome-governor.ts |
| Interface | GovernorStore |
| Design Doc | - |
| Effort | S |

Class ChromeGovernor implements GovernorStore but 10/11 methods missing: getAccount, getAccountsByProvider, upsertAccount, deleteAccount, createFleetEvent, getFleetEvents, getCircuitState, upsertCircuitState, createHealthTick, createTraceEntry

**Recommended Action:** Implement missing methods: getAccount, getAccountsByProvider, upsertAccount, deleteAccount, createFleetEvent, getFleetEvents, getCircuitState, upsertCircuitState, createHealthTick, createTraceEntry

---

### GAP-352: Interface partial: StreamBlockStoreContract (1 methods missing)

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | storage |
| Type | INTERFACE_PARTIAL |
| File | src/engines/stream-block-store.ts |
| Interface | StreamBlockStoreContract |
| Design Doc | - |
| Effort | S |

Class StreamBlockStore implements StreamBlockStoreContract but 1/2 methods missing: storeBlocks

**Recommended Action:** Implement missing methods: storeBlocks

---

### GAP-353: Interface partial: TelemetryStore (5 methods missing)

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | storage |
| Type | INTERFACE_PARTIAL |
| File | src/engines/telemetry-aggregator.ts |
| Interface | TelemetryStore |
| Design Doc | - |
| Effort | S |

Class TelemetryAggregator implements TelemetryStore but 5/6 methods missing: executeAggregationQuery, upsertRows, countRows, deleteRows, createManifestChange

**Recommended Action:** Implement missing methods: executeAggregationQuery, upsertRows, countRows, deleteRows, createManifestChange

---

### GAP-354: Interface partial: VersionStore (8 methods missing)

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Domain | storage |
| Type | INTERFACE_PARTIAL |
| File | src/engines/version-manager.ts |
| Interface | VersionStore |
| Design Doc | - |
| Effort | S |

Class VersionManager implements VersionStore but 8/9 methods missing: createTaxonomyVersion, getTaxonomyVersion, getLatestTaxonomyVersion, getTaxonomyVersionHistory, pruneOldVersions, createStatusLog, getLastStatusChange, upsertProgramMetric

**Recommended Action:** Implement missing methods: createTaxonomyVersion, getTaxonomyVersion, getLatestTaxonomyVersion, getTaxonomyVersionHistory, pruneOldVersions, createStatusLog, getLastStatusChange, upsertProgramMetric

---
