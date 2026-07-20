// src/schema/agentic.ts
// Agentic backbone — first-class Node sub-types for the SOTA agentic system.
//
// Design stance (beyond the base plan): the 150-model schema already has a kernel
// provenance trace, NLCL knowledge graph, semantic/episodic/procedural memory, routing
// preferences, provider archetypes and mux sessions. What it LACKS is:
//   1. A durable OBJECTIVE that survives across many runs (sleep / wake / re-plan).
//   2. A mutable, versioned AGENT BELIEF state (the agent's working view of the world,
//      distinct from FSRS curation memory).
//   3. CAUSAL provenance: an agent step that emits a node must link to it by a typed
//      edge, so the graph answers "which exact step produced this memory, under which
//      governance policy, by which agent." Today provenance is engine-scoped, not
//      step->node.
//   4. ECONOMIC + REPUTATION coupling in governance: allocation is data-driven by
//      cost/reputation, not just round-robin cursors.
//
// Every type below is a Node row. Payload lives in dataJson, validated by the Zod
// schema. ACU fields (version, state, authorDid, acl, quality) apply automatically.

import { z } from 'zod'

// ── Shared: actor reference ──────────────────────────────────────────────────
// A human and an agent are interchangeable as edge/author endpoints. This is the
// "agents are users" principle made explicit in data.

export const ActorRefSchema = z.object({
  kind: z.enum(['user', 'agent']),
  id: z.string().min(1),
})
export type ActorRef = z.infer<typeof ActorRefSchema>

export function actorDid(a: ActorRef): string {
  return `${a.kind}:${a.id}`
}

export function parseActorDid(did: string | null | undefined): ActorRef | null {
  if (!did) return null
  const i = did.indexOf(':')
  if (i < 0) return null
  const kind = did.slice(0, i)
  const id = did.slice(i + 1)
  if ((kind === 'user' || kind === 'agent') && id) return { kind, id }
  return null
}

// ── Edge vocabulary (typed, graph-walkable) ──────────────────────────────────

export const AGENTIC_EDGE = {
  SPAWNED: 'spawned', // agent -> agent (lineage)
  USES: 'uses', // agent -> tool
  PLAYS: 'plays', // agent -> role
  PLAYED_BY: 'played_by', // role -> agent (assignment history)
  DEFINES: 'defines', // governance_policy -> role
  GOVERNS: 'governs', // governance_policy -> agent_run
  CHILD: 'child', // agent_run -> agent_run (sub-agent tree)
  STEP: 'step', // agent_run -> agent_step
  INVOKED_IN: 'invoked_in', // tool -> agent_step
  VERSION_OF: 'version_of', // tool -> tool (fork/remix)
  EMITS: 'emits', // agent_step -> node (CAUSAL PROVENANCE)
  BELIEVES: 'believes', // agent/objective -> agent_belief
  PURSUES: 'pursues', // agent -> objective
  SUBTASK: 'subtask', // objective -> objective
  BUILT: 'built', // builder_run -> agent
} as const

// ── 1. cap-store.agent — Agent as an actor ──────────────────────────────────

export const AgentReputationSchema = z.object({
  score: z.number().min(0).max(1).default(0.5),
  runsCompleted: z.number().int().nonnegative().default(0),
  runsFailed: z.number().int().nonnegative().default(0),
  avgQuality: z.number().min(0).max(1).default(0.5),
  avgCostCents: z.number().nonnegative().default(0),
})
export type AgentReputation = z.infer<typeof AgentReputationSchema>

export const AgentDataSchema = z.object({
  handle: z.string().min(1),
  displayName: z.string().min(1),
  personaJson: z.record(z.unknown()).default({}),
  modelPrefsJson: z.record(z.unknown()).default({}),
  capabilitiesJson: z.record(z.unknown()).default({}),
  reputation: AgentReputationSchema.default({}),
  status: z.enum(['draft', 'active', 'paused', 'retired']).default('draft'),
  parentAgentId: z.string().optional(),
  createdByActor: ActorRefSchema,
})
export type AgentData = z.infer<typeof AgentDataSchema>

// ── 2. cap-store.role — a governance slot ───────────────────────────────────

export const RoleDataSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  requiredCapabilitiesJson: z.record(z.unknown()).default({}),
  constraintsJson: z
    .object({
      maxCostCents: z.number().nonnegative().optional(),
      maxTokens: z.number().int().nonnegative().optional(),
      allowBrowser: z.boolean().default(false),
      allowTools: z.boolean().default(true),
      maxSteps: z.number().int().nonnegative().optional(),
    })
    .default({}),
})
export type RoleData = z.infer<typeof RoleDataSchema>

// ── 3. cap-store.governance_policy — multi-role / multi-model allocation ────
// Strategy drives allocation. Roles map to candidate agents + models + weights.
// allocationJson + rotationStateJson are runtime state. ECONOMIC/REPUTATION knobs
// make allocation data-driven (cost-aware, reputation-weighted) rather than a dumb
// round-robin cursor.

export const GovernanceRoleBindingSchema = z.object({
  roleId: z.string(),
  candidateAgentIds: z.array(z.string()).default([]),
  weights: z.array(z.number().min(0)).default([]),
  models: z.array(z.string()).default([]),
  fallbackAgentIds: z.array(z.string()).default([]),
})
export type GovernanceRoleBinding = z.infer<typeof GovernanceRoleBindingSchema>

export const GovernancePolicyDataSchema = z.object({
  name: z.string().min(1),
  strategy: z
    .enum([
      'round_robin',
      'weighted',
      'capability_match',
      'cost_aware',
      'fallback_chain',
      'ensemble',
    ])
    .default('round_robin'),
  roles: z.array(GovernanceRoleBindingSchema).default([]),
  allocationJson: z.record(z.unknown()).default({}),
  rotationStateJson: z.record(z.unknown()).default({}),
  // Economic + reputation coupling (the real differentiator):
  costBudgetCents: z.number().nonnegative().optional(),
  reputationFloor: z.number().min(0).max(1).optional(),
  preferLowerCost: z.boolean().default(false),
  stopConditionsJson: z
    .object({
      maxSteps: z.number().int().nonnegative().optional(),
      convergeOn: z.string().optional(),
      deadlineAt: z.number().optional(),
    })
    .default({}),
})
export type GovernancePolicyData = z.infer<typeof GovernancePolicyDataSchema>

// ── 4. cap-store.agent_run — durable, resumable, forkable ───────────────────

export const AgentRunDataSchema = z.object({
  goalJson: z.record(z.unknown()).default({}),
  objectiveId: z.string().optional(),
  governancePolicyId: z.string().optional(),
  roleBindingsJson: z.record(z.unknown()).default({}),
  status: z
    .enum(['queued', 'running', 'paused', 'awaiting_human', 'done', 'failed', 'superseded'])
    .default('queued'),
  parentRunId: z.string().optional(),
  rootRunId: z.string().optional(),
  checkpointJson: z.record(z.unknown()).default({}),
  costJson: z
    .object({
      totalCostCents: z.number().nonnegative().default(0),
      perProvider: z.record(z.number().nonnegative()).default({}),
      totalTokens: z.number().int().nonnegative().default(0),
    })
    .default({}),
  resultJson: z.record(z.unknown()).optional(),
})
export type AgentRunData = z.infer<typeof AgentRunDataSchema>

// ── 5. cap-store.agent_step — atomic unit of work (CAUSAL PROVENANCE) ────────

export const AgentStepDataSchema = z.object({
  runId: z.string(),
  stepIndex: z.number().int().nonnegative(),
  roleId: z.string().optional(),
  actor: ActorRefSchema,
  actionType: z.enum([
    'llm_call',
    'tool_call',
    'human_input',
    'spawn',
    'decide',
    'observe',
    'reflect',
  ]),
  modelRef: z.string().optional(),
  inputJson: z.record(z.unknown()).default({}),
  outputJson: z.record(z.unknown()).default({}),
  toolCallId: z.string().optional(),
  success: z.boolean().default(true),
  durationMs: z.number().int().nonnegative().default(0),
  costJson: z
    .object({
      costCents: z.number().nonnegative().default(0),
      tokens: z.number().int().nonnegative().default(0),
    })
    .default({}),
  // Causal provenance: node ids this step emitted (memory/artifact/belief/objective).
  emitsNodeIds: z.array(z.string()).default([]),
})
export type AgentStepData = z.infer<typeof AgentStepDataSchema>

// ── 6. cap-store.tool — generated / registered tool ─────────────────────────

export const ToolDataSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  kind: z.enum(['generated', 'mcp', 'builtin', 'imported']).default('generated'),
  codeRef: z.string().default(''),
  inputSchemaJson: z.record(z.unknown()).default({}),
  outputSchemaJson: z.record(z.unknown()).default({}),
  sandboxJson: z
    .object({
      timeoutMs: z.number().int().positive().default(5000),
      allowNetwork: z.boolean().default(false),
      allowFs: z.boolean().default(false),
      allowBrowser: z.boolean().default(false),
      permissions: z.array(z.string()).default([]),
    })
    .default({}),
  version: z.number().int().positive().default(1),
  status: z.enum(['draft', 'active', 'deprecated']).default('draft'),
  generatedByActor: ActorRefSchema,
  provenanceJson: z.record(z.unknown()).default({}),
})
export type ToolData = z.infer<typeof ToolDataSchema>

// ── 7. cap-store.objective — durable cross-run intent (NEW, beyond plan) ─────
// The thing the system actually pursues. Survives across many runs; has an agenda
// (sleep / wake / re-plan); tracks progress. Nothing in the 150-model schema
// persists intent across runs — this is the missing spine.

export const ObjectiveAgendaItemSchema = z.object({
  id: z.string(),
  kind: z.enum(['task', 'wait_for_event', 'human_check', 'sleep_until', 'review']),
  payloadJson: z.record(z.unknown()).default({}),
  status: z.enum(['pending', 'active', 'done', 'skipped', 'blocked']).default('pending'),
})
export type ObjectiveAgendaItem = z.infer<typeof ObjectiveAgendaItemSchema>

export const ObjectiveDataSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(''),
  goalJson: z.record(z.unknown()).default({}),
  status: z
    .enum(['draft', 'active', 'paused', 'blocked', 'succeeded', 'failed', 'archived'])
    .default('active'),
  agenda: z.array(ObjectiveAgendaItemSchema).default([]),
  agendaCursor: z.number().int().nonnegative().default(0),
  progress: z.number().min(0).max(1).default(0),
  ownerActor: ActorRefSchema,
  parentObjectiveId: z.string().optional(),
  wakeAt: z.number().optional(),
  successCriteriaJson: z.record(z.unknown()).default({}),
})
export type ObjectiveData = z.infer<typeof ObjectiveDataSchema>

// ── 8. cap-store.agent_belief — versioned, mutable world-model (NEW) ─────────
// The agent's working view of the world, distinct from FSRS curation memory.
// Each mutation writes a version (time-travelable). Beliefs can be retracted.

export const AgentBeliefDataSchema = z.object({
  ownerKind: z.enum(['agent', 'objective']),
  ownerId: z.string(),
  topic: z.string().min(1),
  claim: z.string().min(1),
  confidence: z.number().min(0).max(1).default(0.5),
  evidenceNodeIds: z.array(z.string()).default([]),
  retracted: z.boolean().default(false),
  sourceStepId: z.string().optional(),
})
export type AgentBeliefData = z.infer<typeof AgentBeliefDataSchema>

// ── 9. cap-store.builder_run — agent construction (separate subsystem emits this)

export const BuilderRunDataSchema = z.object({
  initiatorActor: ActorRefSchema,
  intentJson: z.record(z.unknown()).default({}),
  mode: z.enum(['human_led', 'agent_led']).default('human_led'),
  stage: z
    .enum(['discover', 'infer', 'draft', 'validate', 'spawn', 'done', 'failed'])
    .default('discover'),
  producedAgentId: z.string().optional(),
  producedRunId: z.string().optional(),
  status: z.enum(['pending', 'running', 'done', 'failed']).default('pending'),
  resultJson: z.record(z.unknown()).default({}),
})
export type BuilderRunData = z.infer<typeof BuilderRunDataSchema>

// ── Node type discriminator additions ──────────────────────────────────────

export const AGENTIC_NODE_TYPES = [
  'cap-store.agent',
  'cap-store.role',
  'cap-store.governance_policy',
  'cap-store.agent_run',
  'cap-store.agent_step',
  'cap-store.tool',
  'cap-store.objective',
  'cap-store.agent_belief',
  'cap-store.builder_run',
] as const

export type AgenticNodeType = (typeof AGENTIC_NODE_TYPES)[number]

export const agenticDataSchemas: Record<AgenticNodeType, z.ZodTypeAny> = {
  'cap-store.agent': AgentDataSchema,
  'cap-store.role': RoleDataSchema,
  'cap-store.governance_policy': GovernancePolicyDataSchema,
  'cap-store.agent_run': AgentRunDataSchema,
  'cap-store.agent_step': AgentStepDataSchema,
  'cap-store.tool': ToolDataSchema,
  'cap-store.objective': ObjectiveDataSchema,
  'cap-store.agent_belief': AgentBeliefDataSchema,
  'cap-store.builder_run': BuilderRunDataSchema,
}
