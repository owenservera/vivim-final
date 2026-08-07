// src/storage/impl/agentic-store-impl.ts
// AgenticStoreImpl — AgenticStoreContract over NodeStoreContract + Prisma.
//
// Every backbone entity (agent/role/policy/run/step/tool/objective/belief/
// toolset/capability) is a typed cap-store.* Node. Relational helper tables
// (AgentBuilderRun, RunInbox, SlotBinding) are the only direct Prisma writes.

import type { PrismaClient } from '@prisma/client'
import { newId } from '../../ids.js'
import { AGENTIC_EDGE, type ActorRef, actorDid } from '../../schema/agentic.js'
import { createNode } from '../../schema/node.js'
import type {
  AgentSpec,
  AgenticStoreContract,
  BeliefSpec,
  GovernancePolicySpec,
  InboxTask,
  ObjectiveSpec,
  RoleBinding,
  RoleSpec,
  RunSpec,
  StepSpec,
  ToolSpec,
} from '../contracts/agentic-store.js'
import type { NodeStoreContract } from '../contracts/node-store.js'

const now = () => Date.now()

function parseJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback
  try {
    return JSON.parse(s) as T
  } catch {
    return fallback
  }
}

export class AgenticStoreImpl implements AgenticStoreContract {
  constructor(
    readonly nodes: NodeStoreContract,
    private readonly prisma: PrismaClient,
  ) {}

  async createAgent(spec: AgentSpec): Promise<{ id: string }> {
    const id = newId()
    const node = createNode(
      'cap-store.agent',
      {
        handle: spec.handle,
        displayName: spec.displayName,
        personaJson: spec.personaJson ?? {},
        modelPrefsJson: spec.modelPrefsJson ?? {},
        capabilitiesJson: spec.capabilitiesJson ?? {},
        reputation: {
          score: 0.5,
          runsCompleted: 0,
          runsFailed: 0,
          avgQuality: 0.5,
          avgCostCents: 0,
        },
        status: spec.status ?? 'draft',
        parentAgentId: spec.parentAgentId,
        createdByActor: spec.createdByActor,
      },
      { id, authorDid: actorDid(spec.createdByActor) },
    )
    await this.nodes.putNode(node)
    return { id }
  }

  async putAgent(spec: AgentSpec): Promise<{ id: string }> {
    return this.createAgent(spec)
  }

  async getAgent(id: string): Promise<unknown | null> {
    const row = await this.nodes.getNode(id)
    return row ? parseJson(row.dataJson, null) : null
  }

  async listAgents(opts: { status?: string } = {}): Promise<unknown[]> {
    const rows = await this.nodes.listNodes({ type: 'cap-store.agent' })
    return rows
      .map((r) => parseJson(r.dataJson, null))
      .filter((d: any) => !opts.status || d?.status === opts.status)
  }

  async updateReputation(
    agentId: string,
    outcome: 'success' | 'failure',
    costCents = 0,
  ): Promise<void> {
    const row = await this.nodes.getNode(agentId)
    if (!row) return
    const data = parseJson<any>(row.dataJson, null)
    if (!data) return
    const rep = data.reputation ?? {
      score: 0.5,
      runsCompleted: 0,
      runsFailed: 0,
      avgQuality: 0.5,
      avgCostCents: 0,
    }
    if (outcome === 'success') rep.runsCompleted += 1
    else rep.runsFailed += 1
    const total = rep.runsCompleted + rep.runsFailed
    if (total > 0) {
      rep.score = (rep.runsCompleted * 1 + rep.runsFailed * 0) / total
      rep.avgCostCents = (rep.avgCostCents * (total - 1) + costCents) / total
    }
    data.reputation = rep
    await this.nodes.updateNode(agentId, {
      dataJson: JSON.stringify(data),
      contentHash: undefined,
    } as never)
  }

  // ── Governance ─────────────────────────────────────────────────────────

  async putGovernancePolicy(spec: GovernancePolicySpec): Promise<{ id: string }> {
    const id = newId()
    const node = createNode(
      'cap-store.governance_policy',
      {
        name: spec.name,
        strategy: spec.strategy ?? 'round_robin',
        roles: spec.roles ?? [],
        allocationJson: {},
        rotationStateJson: {},
        costBudgetCents: spec.costBudgetCents,
        reputationFloor: spec.reputationFloor,
        preferLowerCost: spec.preferLowerCost ?? false,
        stopConditionsJson: (spec.stopConditionsJson as any) ?? {},
      },
      { id },
    )
    await this.nodes.putNode(node)
    return { id }
  }

  async evaluateAllocation(policyId: string, ctx: Record<string, unknown>): Promise<RoleBinding[]> {
    const row = await this.nodes.getNode(policyId)
    if (!row) return []
    const policy = parseJson<any>(row.dataJson, null)
    const bindings: RoleBinding[] = []
    const requestedRole = ctx.roleId as string | undefined
    for (const role of policy?.roles ?? []) {
      if (requestedRole && role.roleId !== requestedRole) continue
      const agentId = this.pickAgent(policy, role)
      if (!agentId) continue
      bindings.push({
        roleId: role.roleId,
        agentId,
        model: role.models?.[0],
        weight: role.weights?.[0],
      })
    }
    // persist advanced rotation cursor (round_robin / weighted state)
    if (policy?.rotationStateJson && Object.keys(policy.rotationStateJson).length) {
      await this.nodes.updateNode(policyId, {
        dataJson: JSON.stringify({
          ...parseJson<any>(row.dataJson, {}),
          rotationStateJson: policy.rotationStateJson,
        }),
      } as never)
    }
    return bindings
  }

  private pickAgent(policy: any, role: any): string | null {
    const candidates: string[] = role.candidateAgentIds ?? []
    const fallbacks: string[] = role.fallbackAgentIds ?? []
    if (candidates.length === 0) return fallbacks[0] ?? null

    const strategy = policy?.strategy
    if (strategy === 'cost_aware' && policy?.costBudgetCents != null) {
      const within = candidates.filter((id) => {
        const rep = this.agentRep.get(id)
        return !rep || rep.avgCostCents <= policy.costBudgetCents
      })
      const pool = within.length ? within : candidates
      if (pool.length) {
        return pool.reduce((a, b) =>
          (this.agentRep.get(a)?.avgCostCents ?? 0) <= (this.agentRep.get(b)?.avgCostCents ?? 0)
            ? a
            : b,
        )
      }
    }
    if (strategy === 'weighted' && role.weights?.length) {
      const total = role.weights.reduce((a: number, b: number) => a + b, 0)
      if (total > 0) {
        let r = Math.random() * total
        for (let i = 0; i < candidates.length; i++) {
          r -= role.weights[i] ?? 0
          if (r <= 0) return candidates[i] as string
        }
      }
    }
    // round_robin / default: advance a cursor per role
    const cursorKey = `role:${role.roleId}`
    const cursor = ((policy.rotationStateJson?.[cursorKey] as number) ?? 0) % candidates.length
    const chosen = candidates[cursor] as string
    policy.rotationStateJson = policy.rotationStateJson ?? {}
    policy.rotationStateJson[cursorKey] = cursor + 1
    return chosen
  }

  async putRole(spec: RoleSpec): Promise<{ id: string }> {
    const id = newId()
    const node = createNode(
      'cap-store.role',
      {
        name: spec.name,
        description: spec.description ?? '',
        requiredCapabilitiesJson: spec.requiredCapabilitiesJson ?? {},
        constraintsJson: spec.constraintsJson ?? {},
      },
      { id },
    )
    await this.nodes.putNode(node)
    return { id }
  }

  async assignRole(roleId: string, agentId: string): Promise<void> {
    const role = await this.nodes.getNode(roleId)
    if (!role) return
    const rdata = parseJson<any>(role.dataJson, {})
    if (!rdata) return
    const edges = await this.nodes.getOutgoingEdges(roleId)
    edges.push({ type: AGENTIC_EDGE.PLAYED_BY, targetId: agentId })
    await this.nodes.updateNode(roleId, {
      edgesJson: JSON.stringify(edges),
      dataJson: role.dataJson,
    } as never)
    void rdata
  }

  // cache of agent reputation for cost-aware picks (populated lazily)
  private agentRep = new Map<string, { avgCostCents: number; score: number }>()

  // ── Runs ───────────────────────────────────────────────────────────────

  async startRun(spec: RunSpec): Promise<{ id: string; runId: string }> {
    const id = newId()
    const rootRunId = spec.rootRunId ?? id
    const node = createNode(
      'cap-store.agent_run',
      {
        goalJson: spec.goalJson ?? {},
        objectiveId: spec.objectiveId,
        governancePolicyId: spec.governancePolicyId,
        roleBindingsJson: spec.roleBindingsJson ?? {},
        status: 'running',
        parentRunId: spec.parentRunId,
        rootRunId,
        checkpointJson: {},
        costJson: { totalCostCents: 0, perProvider: {}, totalTokens: 0 },
        resultJson: undefined,
      },
      { id },
    )
    await this.nodes.putNode(node)
    if (spec.governancePolicyId) {
      const edges = await this.nodes.getOutgoingEdges(id)
      edges.push({ type: AGENTIC_EDGE.GOVERNS, targetId: id })
      // governance_policy -> agent_run is stored on the policy node's edges
      const gp = await this.nodes.getNode(spec.governancePolicyId)
      if (gp) {
        const gpEdges = parseJson<any[]>(gp.edgesJson, [])
        gpEdges.push({ type: AGENTIC_EDGE.GOVERNS, targetId: id })
        await this.nodes.updateNode(spec.governancePolicyId, {
          dataJson: gp.dataJson,
          edgesJson: JSON.stringify(gpEdges),
        } as never)
      }
      void edges
    }
    return { id, runId: id }
  }

  async appendStep(step: StepSpec): Promise<{ id: string }> {
    const id = newId()
    const node = createNode(
      'cap-store.agent_step',
      {
        runId: step.runId,
        stepIndex: step.stepIndex,
        roleId: step.roleId,
        actor: step.actor,
        actionType: step.actionType,
        modelRef: step.modelRef,
        inputJson: step.inputJson ?? {},
        outputJson: step.outputJson ?? {},
        toolCallId: step.toolCallId,
        success: step.success ?? true,
        durationMs: step.durationMs ?? 0,
        costJson: {
          costCents: step.costCents ?? 0,
          tokens: step.tokens ?? 0,
        },
        emitsNodeIds: step.emitsNodeIds ?? [],
      },
      { id, authorDid: actorDid(step.actor) },
    )
    await this.nodes.putNode(node)
    // agent_run -> agent_step edge
    const run = await this.nodes.getNode(step.runId)
    if (run) {
      const edges = parseJson<any[]>(run.edgesJson, [])
      edges.push({ type: AGENTIC_EDGE.STEP, targetId: id })
      await this.nodes.updateNode(step.runId, {
        dataJson: run.dataJson,
        edgesJson: JSON.stringify(edges),
      } as never)
    }
    return { id }
  }

  async checkpointRun(runId: string, state: Record<string, unknown>): Promise<void> {
    const run = await this.nodes.getNode(runId)
    if (!run) return
    const data = parseJson<any>(run.dataJson, null)
    if (!data) return
    data.checkpointJson = state
    await this.nodes.updateNode(runId, {
      dataJson: JSON.stringify(data),
    } as never)
  }

  async resumeRun(runId: string): Promise<{ id: string; checkpointJson: Record<string, unknown> }> {
    const run = await this.nodes.getNode(runId)
    if (!run) throw new Error(`resumeRun: run ${runId} not found`)
    const data = parseJson<any>(run.dataJson, null)
    return { id: runId, checkpointJson: data?.checkpointJson ?? {} }
  }

  async forkRun(
    runId: string,
    goalPatch: Record<string, unknown>,
  ): Promise<{ id: string; runId: string }> {
    const parent = await this.nodes.getNode(runId)
    if (!parent) throw new Error(`forkRun: run ${runId} not found`)
    const pdata = parseJson<any>(parent.dataJson, {})
    const id = newId()
    const node = createNode(
      'cap-store.agent_run',
      {
        goalJson: { ...(pdata.goalJson ?? {}), ...goalPatch },
        objectiveId: pdata.objectiveId,
        governancePolicyId: pdata.governancePolicyId,
        roleBindingsJson: pdata.roleBindingsJson ?? {},
        status: 'running',
        parentRunId: runId,
        rootRunId: pdata.rootRunId ?? runId,
        checkpointJson: {},
        costJson: { totalCostCents: 0, perProvider: {}, totalTokens: 0 },
        resultJson: undefined,
      },
      { id },
    )
    await this.nodes.putNode(node)
    return { id, runId: id }
  }

  async enqueueTask(runId: string, task: InboxTask): Promise<{ id: string }> {
    const id = newId()
    await this.prisma.runInbox.create({
      data: {
        id,
        runId,
        priority: task.priority,
        contentJson: JSON.stringify(task.contentJson),
        status: 'pending',
        createdAt: now(),
        updatedAt: now(),
      },
    })
    return { id }
  }

  async drainInbox(
    runId: string,
  ): Promise<Array<{ id: string; contentJson: Record<string, unknown> }>> {
    const rows = await this.prisma.runInbox.findMany({
      where: { runId, status: 'pending' },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    })
    const out: Array<{ id: string; contentJson: Record<string, unknown> }> = []
    for (const r of rows) {
      out.push({ id: r.id, contentJson: parseJson(r.contentJson, {}) })
      await this.prisma.runInbox.update({
        where: { id: r.id },
        data: { status: 'done', updatedAt: now() },
      })
    }
    return out
  }

  // ── Budgets ──────────────────────────────────────────────────────────────

  async accrueCost(runId: string, costCents: number, tokens = 0): Promise<void> {
    const run = await this.nodes.getNode(runId)
    if (!run) return
    const data = parseJson<any>(run.dataJson, null)
    if (!data) return
    data.costJson = data.costJson ?? { totalCostCents: 0, perProvider: {}, totalTokens: 0 }
    data.costJson.totalCostCents = (data.costJson.totalCostCents ?? 0) + costCents
    data.costJson.totalTokens = (data.costJson.totalTokens ?? 0) + tokens
    await this.nodes.updateNode(runId, { dataJson: JSON.stringify(data) } as never)
  }

  async checkBudget(
    runId: string,
    kind: 'cost' | 'tokens' | 'iterations' | 'duration',
    used: number,
    limit: number,
  ): Promise<void> {
    void runId
    if (used > limit) {
      throw new (await import('../../errors.js')).BudgetExceededError(kind, used, limit)
    }
  }

  // ── Tools ────────────────────────────────────────────────────────────────

  async putTool(spec: ToolSpec): Promise<{ id: string }> {
    const id = newId()
    // Generated tools default to a DENY-ALL sandbox (R3 safety).
    const sandboxJson =
      spec.kind === 'generated'
        ? {
            timeoutMs: 5000,
            allowNetwork: false,
            allowFs: false,
            allowBrowser: false,
            permissions: [],
          }
        : (spec.sandboxJson ?? {})
    const node = createNode(
      'cap-store.tool',
      {
        name: spec.name,
        description: spec.description ?? '',
        kind: spec.kind ?? 'generated',
        codeRef: spec.codeRef ?? '',
        inputSchemaJson: spec.inputSchemaJson ?? {},
        outputSchemaJson: spec.outputSchemaJson ?? {},
        sandboxJson,
        version: 1,
        status: 'draft',
        generatedByActor: spec.generatedByActor,
        provenanceJson: {},
      },
      { id, authorDid: actorDid(spec.generatedByActor) },
    )
    await this.nodes.putNode(node)
    return { id }
  }

  async invokeTool(
    toolId: string,
    input: Record<string, unknown>,
  ): Promise<{ toolCallId: string }> {
    const toolCallId = newId()
    void toolId
    void input
    return { toolCallId }
  }

  async putToolset(spec: { name: string; toolIds: string[] }): Promise<{ id: string }> {
    const id = newId()
    const node = createNode(
      'cap-store.tool',
      {
        name: spec.name,
        description: 'toolset',
        kind: 'builtin',
        codeRef: '',
        inputSchemaJson: { toolIds: spec.toolIds },
        outputSchemaJson: {},
        sandboxJson: {
          timeoutMs: 5000,
          allowNetwork: false,
          allowFs: false,
          allowBrowser: false,
          permissions: [],
        },
        version: 1,
        status: 'active',
        generatedByActor: { kind: 'agent', id: 'system' },
        provenanceJson: {},
      },
      { id },
    )
    await this.nodes.putNode(node)
    return { id }
  }

  async bindToolset(toolsetId: string, runId: string): Promise<void> {
    const run = await this.nodes.getNode(runId)
    if (!run) return
    const edges = parseJson<any[]>(run.edgesJson, [])
    edges.push({ type: AGENTIC_EDGE.USES, targetId: toolsetId })
    await this.nodes.updateNode(runId, {
      dataJson: run.dataJson,
      edgesJson: JSON.stringify(edges),
    } as never)
  }

  // ── Objectives ────────────────────────────────────────────────────────────

  async putObjective(spec: ObjectiveSpec): Promise<{ id: string }> {
    const id = newId()
    const node = createNode(
      'cap-store.objective',
      {
        title: spec.title,
        description: spec.description ?? '',
        goalJson: spec.goalJson ?? {},
        status: 'active',
        agenda: (spec.agenda ?? []).map((a) => ({
          id: a.id,
          kind: a.kind,
          payloadJson: a.payloadJson ?? {},
          status: 'pending',
        })),
        agendaCursor: 0,
        progress: 0,
        ownerActor: spec.ownerActor,
        parentObjectiveId: spec.parentObjectiveId,
        wakeAt: undefined,
        successCriteriaJson: spec.successCriteriaJson ?? {},
      },
      { id, authorDid: actorDid(spec.ownerActor) },
    )
    await this.nodes.putNode(node)
    return { id }
  }

  async advanceAgenda(objectiveId: string): Promise<{ current: string | null; done: boolean }> {
    const obj = await this.nodes.getNode(objectiveId)
    if (!obj) return { current: null, done: true }
    const data = parseJson<any>(obj.dataJson, null)
    if (!data) return { current: null, done: true }
    const agenda: any[] = data.agenda ?? []
    const cursor = data.agendaCursor ?? 0
    // mark current done
    if (cursor > 0 && agenda[cursor - 1]) agenda[cursor - 1].status = 'done'
    if (cursor >= agenda.length) {
      data.status = 'succeeded'
      data.progress = 1
      await this.nodes.updateNode(objectiveId, { dataJson: JSON.stringify(data) } as never)
      return { current: null, done: true }
    }
    const item = agenda[cursor]
    item.status = 'active'
    data.agendaCursor = cursor + 1
    data.progress = cursor / Math.max(agenda.length, 1)
    await this.nodes.updateNode(objectiveId, { dataJson: JSON.stringify(data) } as never)
    return { current: item.id, done: false }
  }

  async sleepObjective(id: string, until: number): Promise<void> {
    const obj = await this.nodes.getNode(id)
    if (!obj) return
    const data = parseJson<any>(obj.dataJson, null)
    if (!data) return
    data.status = 'paused'
    data.wakeAt = until
    await this.nodes.updateNode(id, { dataJson: JSON.stringify(data) } as never)
  }

  async wakeObjective(id: string): Promise<void> {
    const obj = await this.nodes.getNode(id)
    if (!obj) return
    const data = parseJson<any>(obj.dataJson, null)
    if (!data) return
    data.status = 'active'
    data.wakeAt = undefined
    await this.nodes.updateNode(id, { dataJson: JSON.stringify(data) } as never)
  }

  // ── Beliefs ────────────────────────────────────────────────────────────────

  async putBelief(spec: BeliefSpec): Promise<{ id: string; version: number }> {
    const id = newId()
    const node = createNode(
      'cap-store.agent_belief',
      {
        ownerKind: spec.ownerKind,
        ownerId: spec.ownerId,
        topic: spec.topic,
        claim: spec.claim,
        confidence: spec.confidence ?? 0.5,
        evidenceNodeIds: spec.evidenceNodeIds ?? [],
        retracted: false,
        sourceStepId: spec.sourceStepId,
      },
      { id },
    )
    await this.nodes.putNode(node)
    return { id, version: 1 }
  }

  async retractBelief(beliefId: string): Promise<void> {
    const b = await this.nodes.getNode(beliefId)
    if (!b) return
    const data = parseJson<any>(b.dataJson, null)
    if (!data) return
    data.retracted = true
    await this.nodes.updateNode(beliefId, { dataJson: JSON.stringify(data) } as never)
  }

  async getBeliefs(ownerKind: 'agent' | 'objective', ownerId: string): Promise<unknown[]> {
    const rows = await this.nodes.listNodes({ type: 'cap-store.agent_belief' })
    return rows
      .map((r) => parseJson(r.dataJson, null))
      .filter((d: any) => d && d.ownerKind === ownerKind && d.ownerId === ownerId)
  }

  // ── Capabilities ────────────────────────────────────────────────────────────

  async putCapability(spec: {
    name: string
    kind: string
    configJson?: Record<string, unknown>
  }): Promise<{ id: string }> {
    const id = newId()
    const node = createNode(
      'cap-store.tool',
      {
        name: spec.name,
        description: `capability:${spec.kind}`,
        kind: 'builtin',
        codeRef: '',
        inputSchemaJson: spec.configJson ?? {},
        outputSchemaJson: {},
        sandboxJson: {
          timeoutMs: 5000,
          allowNetwork: false,
          allowFs: false,
          allowBrowser: false,
          permissions: [],
        },
        version: 1,
        status: 'active',
        generatedByActor: { kind: 'agent', id: 'system' },
        provenanceJson: { capabilityKind: spec.kind },
      },
      { id },
    )
    await this.nodes.putNode(node)
    return { id }
  }

  async bindCapability(capId: string, runId: string, ordering = 0): Promise<void> {
    const run = await this.nodes.getNode(runId)
    if (!run) return
    const edges = parseJson<any[]>(run.edgesJson, [])
    edges.push({ type: AGENTIC_EDGE.USES, targetId: capId, properties: { ordering } })
    await this.nodes.updateNode(runId, {
      dataJson: run.dataJson,
      edgesJson: JSON.stringify(edges),
    } as never)
  }

  // ── Builder subsystem ────────────────────────────────────────────────────────

  async startBuilderRun(
    intent: Record<string, unknown>,
    mode: 'human_led' | 'agent_led',
    initiator: ActorRef,
  ): Promise<{ id: string }> {
    const id = newId()
    await this.prisma.agentBuilderRun.create({
      data: {
        id,
        initiatorJson: JSON.stringify(initiator),
        intentJson: JSON.stringify(intent),
        mode,
        stage: 'discover',
        status: 'running',
        resultJson: '{}',
        createdAt: now(),
        updatedAt: now(),
      },
    })
    return { id }
  }

  async spawnFromBuilder(builderRunId: string): Promise<{ agentId: string; runId: string }> {
    const br = await this.prisma.agentBuilderRun.findUnique({ where: { id: builderRunId } })
    if (!br) throw new Error(`spawnFromBuilder: builder run ${builderRunId} not found`)
    const intent = parseJson<Record<string, unknown>>(br.intentJson, {})
    const initiator = parseJson<ActorRef>(br.initiatorJson, { kind: 'user', id: 'system' })
    const handle = (intent.handle as string) ?? `agent-${builderRunId.slice(0, 8)}`
    const { id: agentId } = await this.putAgent({
      handle,
      displayName: (intent.displayName as string) ?? handle,
      createdByActor: initiator,
      status: 'active',
    })
    const { id: runId } = await this.startRun({
      goalJson: intent,
      roleBindingsJson: { builderRunId },
    })
    await this.prisma.agentBuilderRun.update({
      where: { id: builderRunId },
      data: {
        stage: 'done',
        status: 'done',
        producedAgentId: agentId,
        producedRunId: runId,
        resultJson: JSON.stringify({ agentId, runId }),
        updatedAt: now(),
      },
    })
    return { agentId, runId }
  }

  // ── SlotBinding (audited UI hot-swap) ──────────────────────────────────────────

  async bindSlot(slot: {
    slotId: string
    componentId: string
    boundAgentId?: string
    boundRoleId?: string
    boundByActor: ActorRef
    auditJson?: Record<string, unknown>
  }): Promise<{ id: string }> {
    const id = newId()
    // deactivate previous active binding for the slot
    await this.prisma.slotBinding.updateMany({
      where: { slotId: slot.slotId, active: 1 },
      data: { active: 0, updatedAt: now() },
    })
    await this.prisma.slotBinding.create({
      data: {
        id,
        slotId: slot.slotId,
        componentId: slot.componentId,
        boundAgentId: slot.boundAgentId ?? null,
        boundRoleId: slot.boundRoleId ?? null,
        boundByJson: JSON.stringify(slot.boundByActor),
        active: 1,
        auditJson: JSON.stringify(slot.auditJson ?? {}),
        createdAt: now(),
        updatedAt: now(),
      },
    })
    return { id }
  }

  async listSlotBindings(slotId?: string): Promise<unknown[]> {
    const rows = await this.prisma.slotBinding.findMany({
      where: slotId ? { slotId, active: 1 } : { active: 1 },
    })
    return rows.map((r) => ({
      id: r.id,
      slotId: r.slotId,
      componentId: r.componentId,
      boundAgentId: r.boundAgentId,
      boundRoleId: r.boundRoleId,
      boundBy: parseJson(r.boundByJson, null),
      auditJson: parseJson(r.auditJson, {}),
    }))
  }

  // ── Agent chat thread (reuses Conversation / ConversationMessage / StreamBlock) ──

  /** Ensure the agent:<id> provider scaffolding (ProviderDefinition + session). */
  private async ensureAgentProviderSession(agentId: string): Promise<string> {
    const providerId = `agent:${agentId}`
    const accountId = `agent:${agentId}`
    const ts = now()
    await this.prisma.providerDefinition.upsert({
      where: { id: providerId },
      create: {
        id: providerId,
        slug: providerId,
        displayName: `Agent ${agentId}`,
        category: 'agent',
        providerType: 'agent',
        authType: 'none',
        isActive: 1,
        createdAt: ts,
        updatedAt: ts,
      },
      update: { updatedAt: ts },
    })
    const existing = await this.prisma.providerSession.findFirst({
      where: { providerId, accountId },
      select: { id: true },
    })
    if (existing) return existing.id
    const vivimSession = await this.prisma.vivimSession.create({
      data: { id: newId(), state: 'idle', contextJson: '{}', createdAt: ts, updatedAt: ts },
    })
    await this.prisma.providerAccount.upsert({
      where: { id: accountId },
      create: {
        id: accountId,
        providerId,
        email: `${accountId}@local`,
        planTier: 'free',
        isDefault: 1,
        isKind: 0,
        loginState: 'unknown',
        loginAttempts: 0,
        providerStateJson: '{}',
        createdAt: ts,
        updatedAt: ts,
      },
      update: { updatedAt: ts },
    })
    const session = await this.prisma.providerSession.create({
      data: {
        id: newId(),
        vivimSessionId: vivimSession.id,
        providerId,
        accountId,
        state: 'idle',
        contextJson: '{}',
        createdAt: ts,
        updatedAt: ts,
      },
    })
    return session.id
  }

  async startAgentConversation(
    actor: ActorRef,
    goal: string,
    opts?: { title?: string; agentId?: string },
  ): Promise<{ providerSessionId: string; conversationId: string }> {
    const agentId = opts?.agentId ?? actor.id
    const providerSessionId = await this.ensureAgentProviderSession(agentId)
    const conversationId = newId()
    const ts = now()
    await this.prisma.conversation.create({
      data: {
        id: conversationId,
        providerSessionId,
        providerId: `agent:${agentId}`,
        title: opts?.title ?? goal.slice(0, 80),
        state: 'active',
        messageCount: 0,
        contextJson: JSON.stringify({ goal, actorDid: actorDid(actor) }),
        createdAt: ts,
        updatedAt: ts,
      },
    })
    // Author the opening goal as a user message (one query lens for all threads).
    await this.appendAgentMessage(conversationId, {
      role: 'user',
      text: goal,
      authorDid: actorDid(actor),
    })
    return { providerSessionId, conversationId }
  }

  async appendAgentMessage(
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
  ): Promise<{ id: string }> {
    const id = newId()
    const ts = now()
    const blocks = msg.blocks ?? [{ kind: 'text', data: { text: msg.text } }]
    const count = await this.prisma.conversationMessage.count({ where: { conversationId } })
    await this.prisma.conversationMessage.create({
      data: {
        id,
        conversationId,
        role: msg.role,
        content: msg.text,
        blocksJson: JSON.stringify(blocks),
        blockCount: blocks.length,
        sequenceIndex: count,
        model: msg.model ?? null,
        metadataJson: JSON.stringify({
          authorDid: msg.authorDid ?? null,
          stepId: msg.stepId ?? null,
        }),
        createdAt: ts,
        updatedAt: ts,
      },
    })
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { messageCount: { increment: 1 }, lastMessageAt: ts, updatedAt: ts },
    })
    let idx = 0
    for (const b of blocks) {
      await this.prisma.streamBlock.create({
        data: {
          id: newId(),
          conversationId,
          messageId: id,
          blockIndex: idx++,
          blockKind: b.kind,
          blockData: JSON.stringify(b.data),
          blockMeta: JSON.stringify(b.meta ?? {}),
          createdAt: ts,
        },
      })
    }
    // Causal link: the producing step emits this message node.
    if (msg.stepId) await this.linkStepToMessage(msg.stepId, id)
    return { id }
  }

  async getAgentMessages(conversationId: string, opts?: { limit?: number }): Promise<unknown[]> {
    const rows = await this.prisma.conversationMessage.findMany({
      where: { conversationId },
      orderBy: { sequenceIndex: 'asc' },
      take: opts?.limit ?? 100,
    })
    return rows.map((r) => ({
      id: r.id,
      role: r.role,
      content: r.content,
      blocks: parseJson<any[]>(r.blocksJson, []),
      model: r.model,
      sequenceIndex: r.sequenceIndex,
      metadata: parseJson(r.metadataJson, {}),
    }))
  }

  async linkStepToMessage(stepId: string, messageId: string): Promise<void> {
    const step = await this.nodes.getNode(stepId)
    if (!step) return
    const data = parseJson<any>(step.dataJson, null)
    if (!data) return
    const emits: string[] = data.emitsNodeIds ?? []
    if (!emits.includes(messageId)) emits.push(messageId)
    data.emitsNodeIds = emits
    await this.nodes.updateNode(stepId, { dataJson: JSON.stringify(data) } as never)
  }

  // ── OpenCode served session (feature 027) ──
  // Peer provider 'opencode' reuses ProviderSession/Conversation/StreamBlock + the
  // AgentSession landing table. Idempotent by serve `sessionId` (= providerSessionId).
  async createOpencodeAgentSession(opts: {
    sessionId: string
    model?: string
    agentName?: string
    projectPath?: string
    title?: string
  }): Promise<{ providerSessionId: string; conversationId: string; agentSessionId: string }> {
    const ts = now()
    const providerId = 'opencode'
    const accountId = 'opencode'

    const existing = await this.prisma.agentSession.findUnique({
      where: { providerSessionId: opts.sessionId },
      select: { id: true, providerSessionId: true },
    })
    if (existing) {
      const conv = await this.prisma.conversation.findFirst({
        where: { providerSessionId: existing.providerSessionId },
        select: { id: true },
      })
      return {
        providerSessionId: existing.providerSessionId,
        conversationId: conv?.id ?? '',
        agentSessionId: existing.id,
      }
    }

    await this.prisma.providerDefinition.upsert({
      where: { id: providerId },
      create: {
        id: providerId,
        slug: providerId,
        displayName: 'OpenCode Serve',
        category: 'local-agent',
        providerType: 'local-agent',
        authType: 'none',
        isActive: 1,
        createdAt: ts,
        updatedAt: ts,
      },
      update: { updatedAt: ts },
    })
    await this.prisma.providerAccount.upsert({
      where: { id: accountId },
      create: {
        id: accountId,
        providerId,
        email: `${accountId}@local`,
        planTier: 'free',
        isDefault: 1,
        isKind: 0,
        loginState: 'unknown',
        loginAttempts: 0,
        providerStateJson: '{}',
        createdAt: ts,
        updatedAt: ts,
      },
      update: { updatedAt: ts },
    })
    const vivimSession = await this.prisma.vivimSession.create({
      data: { id: newId(), state: 'idle', contextJson: '{}', createdAt: ts, updatedAt: ts },
    })
    const session = await this.prisma.providerSession.create({
      data: {
        id: opts.sessionId,
        vivimSessionId: vivimSession.id,
        providerId,
        accountId,
        state: 'active',
        contextJson: JSON.stringify({ serve: true }),
        createdAt: ts,
        updatedAt: ts,
      },
    })

    const conversationId = newId()
    await this.prisma.conversation.create({
      data: {
        id: conversationId,
        providerSessionId: session.id,
        providerId,
        title: opts.title ?? `opencode ${opts.sessionId.slice(0, 8)}`,
        state: 'active',
        messageCount: 0,
        contextJson: JSON.stringify({
          serve: true,
          model: opts.model ?? null,
          agentName: opts.agentName ?? null,
          projectPath: opts.projectPath ?? null,
        }),
        createdAt: ts,
        updatedAt: ts,
      },
    })

    const agentSession = await this.prisma.agentSession.create({
      data: {
        id: newId(),
        providerSessionId: session.id,
        providerId,
        agentName: opts.agentName ?? 'opencode',
        model: opts.model ?? null,
        projectPath: opts.projectPath ?? null,
        status: 'active',
        createdAt: ts,
        updatedAt: ts,
      },
    })

    return {
      providerSessionId: session.id,
      conversationId,
      agentSessionId: agentSession.id,
    }
  }

  // ── OpenCode landing-table writers (feature 027), idempotent ──

  async appendAgentPermissionDecision(row: {
    agentSessionId: string
    providerPermissionId: string
    toolName: string
    riskTier: number
    decision: 'allow' | 'deny' | 'allow_always'
    payload?: unknown
  }): Promise<void> {
    const ts = now()
    await this.prisma.agentPermissionDecision.upsert({
      where: { providerPermissionId: row.providerPermissionId },
      create: {
        id: newId(),
        agentSessionId: row.agentSessionId,
        providerPermissionId: row.providerPermissionId,
        toolName: row.toolName,
        riskTier: row.riskTier,
        requestedAt: ts,
        respondedAt: ts,
        decision: row.decision,
        decidedBy: 'governor',
        payloadJson: JSON.stringify(row.payload ?? null),
        createdAt: BigInt(ts),
      },
      update: {
        decision: row.decision,
        respondedAt: ts,
        decidedBy: 'governor',
        payloadJson: JSON.stringify(row.payload ?? null),
      },
    })
  }

  async appendAgentFileEdit(row: {
    agentSessionId: string
    filePath: string
    patch: unknown[]
    messageId?: string
  }): Promise<void> {
    await this.prisma.agentFileEdit.create({
      data: {
        id: newId(),
        agentSessionId: row.agentSessionId,
        filePath: row.filePath,
        messageId: row.messageId ?? null,
        patchJson: JSON.stringify(row.patch ?? []),
        beforeHash: null,
        afterHash: null,
        createdAt: BigInt(Date.now()),
      },
    })
  }
}
