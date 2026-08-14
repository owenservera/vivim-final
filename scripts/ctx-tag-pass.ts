/**
 * scripts/ctx-tag-pass.ts
 *
 * Adds `// ctx: <tag>` comments to every model in prisma/schema.prisma
 * that doesn't already have one. Uses the authoritative assignment table
 * from docs/planning/dual-db/01-ctx-tag-pass.md.
 *
 * Run: bun run scripts/ctx-tag-pass.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..')
const SCHEMA_PATH = join(ROOT, 'prisma', 'schema.prisma')

// ── Tag assignment table ──────────────────────────────────────────
const TAG_MAP: Record<string, string> = {
  // System-side: provider
  ProviderDefinition: 'provider',
  ProviderEndpoint: 'provider',
  ProviderParser: 'provider',
  ProviderCapability: 'provider',
  ProviderConfig: 'provider',
  ProviderModel: 'provider',
  ProviderAccount: 'provider',
  ProviderStreamConfig: 'provider',
  ProviderManifestVersion: 'provider',
  RegistrationEvent: 'provider',
  ManifestDrift: 'provider',
  ManifestChangeLog: 'provider',
  ProviderHealthHistory: 'provider',
  ProviderHealth: 'provider',
  ProviderOverride: 'provider',

  // System-side: capability
  CapabilityTaxonomy: 'capability',
  CapabilityTier: 'capability',
  CapabilityBinding: 'capability',
  CapabilityProgram: 'capability',
  CapabilityTaxonomyVersion: 'capability',
  CapabilityIntent: 'capability',
  CapabilityMacro: 'capability',
  CapabilityShape: 'capability',
  CapabilityShapeBinding: 'capability',
  BindingStatusLog: 'capability',
  BindingEvent: 'capability',
  ProgramVersionMetric: 'capability',
  SelectorStrategy: 'capability',
  SelectorHealthHistory: 'capability',
  Outcome: 'capability',
  FailureClassification: 'capability',

  // System-side: routing
  RouteSpec: 'routing',
  RouteRequest: 'routing',
  RouteTarget: 'routing',
  RouteEvent: 'routing',
  TransferPattern: 'routing',
  TransferCandidate: 'routing',
  TransferAttempt: 'routing',
  LearningEvent: 'routing',
  RoutingPreference: 'routing',

  // System-side: telemetry
  CapabilityTelemetry: 'telemetry',
  TelemetrySummaryDaily: 'telemetry',
  TelemetryCycleLog: 'telemetry',
  ProviderCostLog: 'telemetry',
  ProviderLatencyLog: 'telemetry',

  // System-side: health
  HealthTick: 'health',
  CircuitBreakerState: 'health',
  DriftEvent: 'health',
  FleetEvent: 'health',
  AlertCondition: 'health',
  AlertEvent: 'health',
  HealthDigest: 'health',

  // System-side: config
  ConfigEntry: 'config',
  ConfigAudit: 'config',
  PolicyRule: 'config',
  Rule: 'config',

  // System-side: harness
  HarnessCheckpoint: 'harness',
  HarnessCommand: 'harness',
  RepairSession: 'harness',
  StealthLaunchProfile: 'harness',
  StealthModuleProfile: 'harness',
  StealthPolicy: 'harness',

  // System-side: mcp
  McpServerConfig: 'mcp',
  McpTool: 'mcp',
  McpToolCall: 'mcp',

  // System-side: workflow
  WorkflowDefinition: 'workflow',
  WorkflowNode: 'workflow',
  WorkflowEdge: 'workflow',
  WorkflowExecution: 'workflow',
  WorkflowNodeExecution: 'workflow',
  WorkflowWebhook: 'workflow',
  WorkflowCredential: 'workflow',
  WorkflowRetryQueue: 'workflow',
  WorkflowVersion: 'workflow',

  // System-side: kernel
  KernelSpan: 'kernel',
  KernelProvenance: 'kernel',
  KernelTopology: 'kernel',
  KernelEvent: 'kernel',
  NlclGraphNode: 'kernel',
  NlclGraphEdge: 'kernel',
  SandboxAudit: 'kernel',

  // System-side: discovery
  DiscoverySession: 'discovery',
  DiscoveryResult: 'discovery',
  ProviderOnboardingSession: 'discovery',
  DiscoveredDomEntity: 'discovery',
  ProtocolFingerprint: 'discovery',
  ParserCandidate: 'discovery',
  ParserTestResult: 'discovery',
  WebAppTaxonomy: 'discovery',
  TaxonomyGenerationRun: 'discovery',

  // System-side: ui-system
  ProviderType: 'ui-system',
  Primitive: 'ui-system',
  UiComponent: 'ui-system',
  SurfaceVersion: 'ui-system',

  // System-side: ops
  AutomationSchedule: 'ops',
  AutomationRun: 'ops',
  TestRun: 'ops',
  TraceEntry: 'ops',
  CommandDescription: 'ops',

  // System-side: agent-def
  AgentDefinition: 'agent-def',
  AgentBuilderRun: 'agent-def',
  RunInbox: 'agent-def',
  SlotBinding: 'agent-def',
  EventRecord: 'agent-def',

  // System-side: ai-gateway (already tagged, preserved)
  AIExecution: 'ai-gateway',
  AIExecutionEvent: 'ai-gateway',
  AIProviderInstance: 'ai-gateway',

  // System-side: schema
  SchemaMeta: 'schema',

  // ── User-side ──────────────────────────────────────────────────

  // User-side: conversation
  Conversation: 'conversation',
  ConversationMessage: 'conversation',
  StreamBlock: 'conversation',
  ContentUnit: 'conversation',
  MessageLink: 'conversation',
  MessageEntity: 'conversation',
  MessageAttachment: 'conversation',
  ConversationTopic: 'conversation',

  // User-side: node
  Node: 'node',
  NodeVersion: 'node',
  NodeAlias: 'node',
  NodeEdge: 'node',

  // User-side: session
  VivimSession: 'session',
  ProviderSession: 'session',
  ProfileSession: 'session',
  SessionCheckpoint: 'session',
  StateTransition: 'session',

  // User-side: memory
  MemoryEmbedding: 'memory',
  MemoryLink: 'memory',
  MemoryAccess: 'memory',
  MemoryCurated: 'memory',
  MemoryFeedback: 'memory',
  EpisodicMemory: 'memory',
  SemanticMemory: 'memory',
  ProceduralRule: 'memory',
  ReflectionLog: 'memory',

  // User-side: collection
  Collection: 'collection',
  CollectionItem: 'collection',

  // User-side: entity
  Entity: 'entity',
  EntityMention: 'entity',
  DecisionRecord: 'entity',
  PatternExtract: 'entity',

  // User-side: workspace
  WorkspaceMode: 'workspace',
  User: 'workspace',
  UserOnboarding: 'workspace',
  UserPreference: 'workspace',
  PluginRegistry: 'workspace',
  WorkspaceBackup: 'workspace',
  WorkspaceTemplateRow: 'workspace',

  // User-side: sync
  SyncLog: 'sync',
  SyncPeer: 'sync',
  ImportJob: 'sync',
  ConversationSyncState: 'sync',
  ConversationSyncLog: 'sync',
  SyncState: 'sync',

  // User-side: context
  SituationLog: 'context',
  ContextLayerRow: 'context',
  TokenBudgetRow: 'context',
  ContextBudgetConfig: 'context',
  SituationDetection: 'context',

  // User-side: autonomous
  AutonomousTask: 'autonomous',
  AutonomousStep: 'autonomous',
  HitlGate: 'autonomous',
  TaskTemplate: 'autonomous',
  HpeSession: 'autonomous',

  // User-side: agent
  AgentSession: 'agent',
  AgentPermissionDecision: 'agent',
  AgentFileEdit: 'agent',
  AgentLoopRun: 'agent',
  AgentStep: 'agent',
  AgentDecisionLog: 'agent',

  // User-side: mux
  MuxSession: 'mux',
  MuxResponseRow: 'mux',

  // User-side: webapp
  EntityContainer: 'webapp',
  EntityContainerMembership: 'webapp',
  ContentItem: 'webapp',
  Notification: 'webapp',
  Contact: 'webapp',
  ContactIdentity: 'webapp',
  MediaAttachment: 'webapp',
  ProviderCapabilityTaxonomy: 'webapp',

  // User-side: platform-ext
  DiscordVoiceState: 'platform-ext',
  DiscordMemberMeta: 'platform-ext',
  SlackChannelMeta: 'platform-ext',
  SlackThreadMeta: 'platform-ext',
  WhatsAppEncryptionMeta: 'platform-ext',
  WhatsAppContactMeta: 'platform-ext',
  RedditSubredditMeta: 'platform-ext',
  RedditPostMeta: 'platform-ext',
  NotionBlockMeta: 'platform-ext',
  NotionDatabaseMeta: 'platform-ext',
  NotionPageMeta: 'platform-ext',

  // User-side: topic
  Topic: 'topic',
  Project: 'topic',

  // User-side: mirror
  MirrorState: 'mirror',
  OptimisticUpdate: 'mirror',
  LatencyMeasurement: 'mirror',
  MirrorSnapshot: 'mirror',
  ObservationEvent: 'mirror',
}

// ── Main logic ────────────────────────────────────────────────────

const schema = readFileSync(SCHEMA_PATH, 'utf-8')
const lines = schema.split('\n')

const output: string[] = []
let tagged = 0
let skipped = 0
const untagged: string[] = []

for (let i = 0; i < lines.length; i++) {
  const line = lines[i]!
  const modelMatch = line.match(/^model\s+(\w+)\s*\{/)
  if (modelMatch) {
    const modelName = modelMatch[1]!

    // Check if previous non-empty line already has a ctx tag
    let prevIdx = i - 1
    while (prevIdx >= 0 && lines[prevIdx]!.trim() === '') prevIdx--
    const prevLine = lines[prevIdx] ?? ''
    const hasCtxTag = prevLine.match(/^\/\/\s*ctx:\s*(\S+)/)

    if (hasCtxTag) {
      // Already tagged — keep as-is
      skipped++
      output.push(line)
      continue
    }

    const tag = TAG_MAP[modelName]
    if (tag) {
      // Insert ctx tag before the model line
      // Preserve the indentation of the model line
      const indent = line.match(/^(\s*)/)?.[1] ?? ''
      output.push(`${indent}// ctx: ${tag}`)
      output.push(line)
      tagged++
    } else {
      // No tag assigned — flag it
      untagged.push(modelName)
      output.push(line)
    }
  } else {
    output.push(line)
  }
}

// Write back
writeFileSync(SCHEMA_PATH, output.join('\n'))

// Report
console.log(`ctx-tag pass complete:`)
console.log(`  tagged: ${tagged}`)
console.log(`  skipped (already had tag): ${skipped}`)
if (untagged.length > 0) {
  console.log(`  UNASSIGNED (${untagged.length}):`)
  for (const name of untagged) {
    console.log(`    - ${name}`)
  }
}
