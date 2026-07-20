// src/storage/contracts/agentic-store.ts
// AgenticStoreContract — the persistence surface for the agentic backbone.
//
// The backbone is a *composition* over NodeStoreContract: every entity is a
// typed cap-store.* Node. Relational helpers (RunInbox, SlotBinding, builder
// pipeline) are materialized for fast queries, but the source of truth for
// agent/run/step/objective/belief/tool/role/policy/tool state is the Node graph.
//
// NOTE: EventRecord / AgentSession / AgentPermissionDecision / AgentFileEdit /
// AgentDefinition are OpenCode + event-substrate projections. They are exposed
// through the OpenCode ingest engine, NOT through this contract (which is the
// pure backbone). They are appended to prisma/schema.prisma alongside.

import type { ActorRef } from '../../schema/agentic.js'
import type { NodeStoreContract } from './node-store.js'

// ── Input/result shapes (loose — the Zod schemas in agentic.ts are the real validation) ──

export interface AgentSpec {
  handle: string
  displayName: string
  createdByActor: ActorRef
  personaJson?: Record<string, unknown>
  modelPrefsJson?: Record<string, unknown>
  capabilitiesJson?: Record<string, unknown>
  status?: 'draft' | 'active' | 'paused' | 'retired'
  parentAgentId?: string
}

export interface RoleSpec {
  name: string
  description?: string
  requiredCapabilitiesJson?: Record<string, unknown>
  constraintsJson?: Record<string, unknown>
}

export interface GovernancePolicySpec {
  name: string
  strategy?:
    | 'round_robin'
    | 'weighted'
    | 'capability_match'
    | 'cost_aware'
    | 'fallback_chain'
    | 'ensemble'
  roles?: Array<{
    roleId: string
    candidateAgentIds?: string[]
    weights?: number[]
    models?: string[]
    fallbackAgentIds?: string[]
  }>
  costBudgetCents?: number
  reputationFloor?: number
  preferLowerCost?: boolean
  stopConditionsJson?: Record<string, unknown>
}

export interface RunSpec {
  goalJson?: Record<string, unknown>
  objectiveId?: string
  governancePolicyId?: string
  roleBindingsJson?: Record<string, unknown>
  parentRunId?: string
  rootRunId?: string
  endStrategy?: 'early' | 'graceful' | 'exhaustive'
}

export interface StepSpec {
  runId: string
  stepIndex: number
  actor: ActorRef
  actionType: 'llm_call' | 'tool_call' | 'human_input' | 'spawn' | 'decide' | 'observe' | 'reflect'
  roleId?: string
  modelRef?: string
  inputJson?: Record<string, unknown>
  outputJson?: Record<string, unknown>
  toolCallId?: string
  success?: boolean
  durationMs?: number
  costCents?: number
  tokens?: number
  emitsNodeIds?: string[]
}

export interface ToolSpec {
  name: string
  description?: string
  kind?: 'generated' | 'mcp' | 'builtin' | 'imported'
  codeRef?: string
  inputSchemaJson?: Record<string, unknown>
  outputSchemaJson?: Record<string, unknown>
  sandboxJson?: Record<string, unknown>
  generatedByActor: ActorRef
}

export interface ObjectiveSpec {
  title: string
  description?: string
  goalJson?: Record<string, unknown>
  agenda?: Array<{
    id: string
    kind: 'task' | 'wait_for_event' | 'human_check' | 'sleep_until' | 'review'
    payloadJson?: Record<string, unknown>
  }>
  ownerActor: ActorRef
  parentObjectiveId?: string
  successCriteriaJson?: Record<string, unknown>
}

export interface BeliefSpec {
  ownerKind: 'agent' | 'objective'
  ownerId: string
  topic: string
  claim: string
  confidence?: number
  evidenceNodeIds?: string[]
  sourceStepId?: string
}

export interface InboxTask {
  priority: 'asap' | 'when_idle'
  contentJson: Record<string, unknown>
}

export interface RoleBinding {
  roleId: string
  agentId: string
  model?: string
  weight?: number
}

export interface AgenticStoreContract {
  // ── Underlying node store (composition root) ──
  readonly nodes: NodeStoreContract

  // ── Agents ──
  putAgent(spec: AgentSpec): Promise<{ id: string }>
  getAgent(id: string): Promise<unknown | null>
  listAgents(opts?: { status?: string }): Promise<unknown[]>
  updateReputation(
    agentId: string,
    outcome: 'success' | 'failure',
    costCents?: number,
  ): Promise<void>

  // ── Governance ──
  putGovernancePolicy(spec: GovernancePolicySpec): Promise<{ id: string }>
  evaluateAllocation(policyId: string, ctx: Record<string, unknown>): Promise<RoleBinding[]>
  putRole(spec: RoleSpec): Promise<{ id: string }>
  assignRole(roleId: string, agentId: string): Promise<void>

  // ── Runs (durable/resumable/forkable spine) ──
  startRun(spec: RunSpec): Promise<{ id: string; runId: string }>
  appendStep(step: StepSpec): Promise<{ id: string }>
  checkpointRun(runId: string, state: Record<string, unknown>): Promise<void>
  resumeRun(runId: string): Promise<{ id: string; checkpointJson: Record<string, unknown> }>
  forkRun(runId: string, goalPatch: Record<string, unknown>): Promise<{ id: string; runId: string }>
  enqueueTask(runId: string, task: InboxTask): Promise<{ id: string }>
  drainInbox(runId: string): Promise<Array<{ id: string; contentJson: Record<string, unknown> }>>

  // ── Budgets ──
  accrueCost(runId: string, costCents: number, tokens?: number): Promise<void>
  checkBudget(
    runId: string,
    kind: 'cost' | 'tokens' | 'iterations' | 'duration',
    used: number,
    limit: number,
  ): Promise<void>

  // ── Tools ──
  putTool(spec: ToolSpec): Promise<{ id: string }>
  invokeTool(toolId: string, input: Record<string, unknown>): Promise<{ toolCallId: string }>
  putToolset(spec: { name: string; toolIds: string[] }): Promise<{ id: string }>
  bindToolset(toolsetId: string, runId: string): Promise<void>

  // ── Objectives (cross-run intent) ──
  putObjective(spec: ObjectiveSpec): Promise<{ id: string }>
  advanceAgenda(objectiveId: string): Promise<{ current: string | null; done: boolean }>
  sleepObjective(id: string, until: number): Promise<void>
  wakeObjective(id: string): Promise<void>

  // ── Beliefs (versioned world-model) ──
  putBelief(spec: BeliefSpec): Promise<{ id: string; version: number }>
  retractBelief(beliefId: string): Promise<void>
  getBeliefs(ownerKind: 'agent' | 'objective', ownerId: string): Promise<unknown[]>

  // ── Capabilities (capability-as-data, bound to runs) ──
  putCapability(spec: {
    name: string
    kind: string
    configJson?: Record<string, unknown>
  }): Promise<{ id: string }>
  bindCapability(capId: string, runId: string, ordering?: number): Promise<void>

  // ── Builder subsystem (human-led + agent-led) ──
  startBuilderRun(
    intent: Record<string, unknown>,
    mode: 'human_led' | 'agent_led',
    initiator: ActorRef,
  ): Promise<{ id: string }>
  spawnFromBuilder(builderRunId: string): Promise<{ agentId: string; runId: string }>

  // ── SlotBinding (audited UI hot-swap) ──
  bindSlot(slot: {
    slotId: string
    componentId: string
    boundAgentId?: string
    boundRoleId?: string
    boundByActor: ActorRef
    auditJson?: Record<string, unknown>
  }): Promise<{ id: string }>
  listSlotBindings(slotId?: string): Promise<unknown[]>

  // ── Agent chat thread (first-class surface, reuses Conversation/Msg/StreamBlock) ──
  // An agent's thread is a Conversation whose providerSessionId points at a
  // ProviderSession with providerId='agent:<agentId>'. authorDid = actorDid(actor).
  startAgentConversation(
    actor: ActorRef,
    goal: string,
    opts?: { title?: string; agentId?: string },
  ): Promise<{ providerSessionId: string; conversationId: string }>
  appendAgentMessage(
    conversationId: string,
    msg: {
      role: 'user' | 'assistant' | 'system'
      text: string
      blocks?: Array<{
        kind: string
        data: Record<string, unknown>
        meta?: Record<string, unknown>
      }>
      model?: string
      authorDid?: string
      stepId?: string
    },
  ): Promise<{ id: string }>
  getAgentMessages(conversationId: string, opts?: { limit?: number }): Promise<unknown[]>
  // Causal link: an agent_step emits the message node (agent_step.emitsNodeIds).
  linkStepToMessage(stepId: string, messageId: string): Promise<void>

  // ── OpenCode served-session projection (feature 027) ──
  // Registers a served `opencode serve` session as a peer provider thread
  // (providerId='opencode'), creating the ProviderSession + Conversation + AgentSession
  // landing rows. Idempotent by serve `sessionId`.
  createOpencodeAgentSession(opts: {
    sessionId: string
    model?: string
    agentName?: string
    projectPath?: string
    title?: string
  }): Promise<{
    providerSessionId: string
    conversationId: string
    agentSessionId: string
  }>
  // Idempotent landing-table writers for served OpenCode events (feature 027).
  appendAgentPermissionDecision(row: {
    agentSessionId: string
    providerPermissionId: string
    toolName: string
    riskTier: number
    decision: 'allow' | 'deny' | 'allow_always'
    payload?: unknown
  }): Promise<void>
  appendAgentFileEdit(row: {
    agentSessionId: string
    filePath: string
    patch: unknown[]
    messageId?: string
  }): Promise<void>
}
