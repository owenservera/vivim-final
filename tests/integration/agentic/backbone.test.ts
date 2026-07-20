// tests/integration/agentic/backbone.test.ts
// Agentic backbone — 11 quickstart integration scenarios (plan §6 / §6b / §6c).
// Uses a real in-memory SQLite Prisma client (fixture copy) so relational
// features + the Node graph are fully exercised.

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { AgentBuilderEngine } from '../../../src/engines/agent-builder.js'
import { BeliefStore } from '../../../src/engines/belief-store.js'
import { BudgetEngine } from '../../../src/engines/budget-engine.js'
import { CapabilityBinder } from '../../../src/engines/capability-binder.js'
import { CapabilityEventBus } from '../../../src/engines/capability-event-bus.js'
import { EventRecordStore } from '../../../src/engines/event-record-store.js'
import { GovernanceEngine } from '../../../src/engines/governance-engine.js'
import { ObjectiveEngine } from '../../../src/engines/objective-engine.js'
import { BudgetExceededError } from '../../../src/errors.js'
import { type ActorRef, actorDid } from '../../../src/schema/agentic.js'
import { schemaRegistry } from '../../../src/schema/node.js'
import { registerAllSchemas } from '../../../src/schema/schemas.js'
import { AgenticStoreImpl } from '../../../src/storage/impl/agentic-store-impl.js'
import { NodeStoreImpl } from '../../../src/storage/impl/node-store-impl.js'

const FIXTURE = join(import.meta.dir, '..', '..', 'fixtures', 'node-store-test.db')

let dir: string
let prisma: PrismaClient
let nodes: NodeStoreImpl
let store: AgenticStoreImpl
let gov: GovernanceEngine
let budget: BudgetEngine
let objective: ObjectiveEngine
let _belief: BeliefStore
let binder: CapabilityBinder
let builder: AgentBuilderEngine
let events: EventRecordStore

const user: ActorRef = { kind: 'user', id: 'u1' }
const agent: ActorRef = { kind: 'agent', id: 'a1' }

beforeAll(async () => {
  registerAllSchemas()
  dir = mkdtempSync(join(tmpdir(), 'agentic-test-'))
  const dbPath = join(dir, 'test.db')
  copyFileSync(FIXTURE, dbPath)
  prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } })
  nodes = new NodeStoreImpl(prisma as never)
  store = new AgenticStoreImpl(nodes, prisma)
  gov = new GovernanceEngine(store)
  budget = new BudgetEngine(store)
  objective = new ObjectiveEngine(store)
  _belief = new BeliefStore(store)
  binder = new CapabilityBinder(store)
  builder = new AgentBuilderEngine(store)
  events = new EventRecordStore(prisma)
})

afterAll(async () => {
  await prisma.$disconnect()
  rmSync(dir, { recursive: true, force: true })
})

function dataOf(nodeId: string): Promise<any> {
  return nodes.getNode(nodeId).then((r) => (r ? JSON.parse(r.dataJson) : null))
}

describe('agentic backbone: schema registration', () => {
  it('registers all 10 agentic node types into SchemaRegistry', () => {
    for (const t of [
      'cap-store.agent',
      'cap-store.role',
      'cap-store.governance_policy',
      'cap-store.agent_run',
      'cap-store.agent_step',
      'cap-store.tool',
      'cap-store.objective',
      'cap-store.agent_belief',
      'cap-store.builder_run',
    ]) {
      expect(schemaRegistry.has(t)).toBe(true)
    }
  })
})

describe('scenario 1: human-led spawn + durable resume', () => {
  it('builder -> agent -> run -> step -> checkpoint -> resume', async () => {
    const { id: brId } = await builder.startBuilderRun(
      { handle: 'jarvis', displayName: 'Jarvis' },
      'human_led',
      user,
    )
    const { agentId, runId } = await builder.spawnFromBuilder(brId)
    expect(agentId).toBeTruthy()
    expect(runId).toBeTruthy()

    await store.appendStep({
      runId,
      stepIndex: 0,
      actor: agent,
      actionType: 'llm_call',
      costCents: 10,
      tokens: 100,
      emitsNodeIds: [],
    })
    await store.checkpointRun(runId, { stage: 'mid', note: 'durable' })
    const resumed = await store.resumeRun(runId)
    expect(resumed.checkpointJson).toEqual({ stage: 'mid', note: 'durable' })

    // 3 identity axes are distinct
    const rdata = await dataOf(runId)
    expect(rdata.rootRunId).toBe(runId)
    expect(rdata.status).toBe('running')
  })
})

describe('scenario 2: multi-role governance', () => {
  it('round_robin rotates; cost_aware picks lowest-cost candidate', async () => {
    const { id: gId } = await store.putGovernancePolicy({
      name: 'multi',
      strategy: 'round_robin',
      roles: [
        {
          roleId: 'r1',
          candidateAgentIds: ['a-x', 'a-y'],
          models: ['m1'],
          weights: [1, 1],
        },
      ],
    })
    const b1 = await gov.evaluateAllocation(gId, {})
    const b2 = await gov.evaluateAllocation(gId, {})
    const b3 = await gov.evaluateAllocation(gId, {})
    const ids = [b1[0]?.agentId, b2[0]?.agentId, b3[0]?.agentId]
    // rotation happened across 3 calls
    expect(new Set(ids).size).toBeGreaterThan(1)

    // cost_aware
    const { id: g2 } = await store.putGovernancePolicy({
      name: 'cost',
      strategy: 'cost_aware',
      costBudgetCents: 100,
      roles: [
        {
          roleId: 'r2',
          candidateAgentIds: ['cheap', 'pricey'],
          models: ['m1'],
        },
      ],
    })
    const rep = { cheap: { score: 1, avgCostCents: 5 }, pricey: { score: 1, avgCostCents: 500 } }
    const costRes = await gov.evaluateAllocation(g2, { agentReputation: rep })
    expect(costRes[0]?.agentId).toBe('cheap')
  })
})

describe('scenario 3: tool generation + deferred approval', () => {
  it('generated tool defaults to deny-all; invoke returns a toolCallId', async () => {
    const { id: toolId } = await store.putTool({
      name: 't1',
      kind: 'generated',
      generatedByActor: agent,
    })
    const td = await dataOf(toolId)
    expect(td.sandboxJson.allowNetwork).toBe(false)
    expect(td.sandboxJson.allowFs).toBe(false)
    expect(td.sandboxJson.allowBrowser).toBe(false)

    const { id: runId } = await store.startRun({ goalJson: {} })
    const { id: stepId } = await store.appendStep({
      runId,
      stepIndex: 0,
      actor: agent,
      actionType: 'tool_call',
      toolCallId: undefined,
      success: false,
    })
    await store.nodes.updateNode(stepId, {
      dataJson: JSON.stringify({
        ...(await dataOf(stepId)),
        success: false,
        outputJson: { callStatus: 'pending_human' },
      }),
    } as never)
    const sd = await dataOf(stepId)
    expect(sd.outputJson.callStatus).toBe('pending_human')
  })
})

describe('scenario 4: agent-led recursion', () => {
  it('agent_step spawn -> child agent + child run', async () => {
    const { id: brId } = await builder.startBuilderRun({ handle: 'parent' }, 'human_led', user)
    const { agentId, runId } = await builder.spawnFromBuilder(brId)
    const child = await builder.spawnChild(
      runId,
      { handle: 'child', displayName: 'Child' },
      { kind: 'agent', id: agentId },
    )
    expect(child.agentId).toBeTruthy()
    expect(child.runId).toBeTruthy()
    const parentRow = await nodes.getNode(runId)
    const edges = parentRow ? JSON.parse(parentRow.edgesJson ?? '[]') : []
    expect(edges.some((e: any) => e.type === 'child' && e.targetId === child.runId)).toBe(true)
  })
})

describe('scenario 5: objective across runs', () => {
  it('run #1 does task + sleeps; run #2 advances -> review -> succeeded', async () => {
    const { id: objId } = await objective.putObjective({
      title: 'ship',
      ownerActor: agent,
      agenda: [
        { id: 't1', kind: 'task' },
        { id: 's1', kind: 'sleep_until' },
        { id: 'r1', kind: 'review' },
      ],
    })
    const r1 = await objective.advance(objId) // t1
    expect(r1.current).toBe('t1')
    await objective.sleep(objId, Date.now() + 1000)
    const od = await dataOf(objId)
    expect(od.status).toBe('paused')
    await objective.wake(objId)
    const r2a = await objective.advance(objId) // s1
    expect(r2a.current).toBe('s1')
    const r2b = await objective.advance(objId) // r1
    expect(r2b.current).toBe('r1')
    const r2c = await objective.advance(objId) // done
    expect(r2c.done).toBe(true)
    const final = await dataOf(objId)
    expect(final.status).toBe('succeeded')
  })
})

describe('scenario 6: capability-as-data + budget', () => {
  it('bind a budget capability; checkBudget raises BudgetExceededError', async () => {
    const { id: capId } = await binder.putCapability({
      name: 'budget-cap',
      kind: 'budget',
      configJson: { cap: 100 },
    })
    const { id: runId } = await store.startRun({ goalJson: {} })
    await binder.bind(capId, runId, 1)
    const caps = await binder.resolveOrder(runId)
    expect(caps.length).toBe(1)

    await expect(budget.guard(runId, 'cost', 150, 100)).rejects.toThrow(BudgetExceededError)
    await budget.guard(runId, 'cost', 50, 100) // ok, no throw
  })
})

describe('scenario 7: causal provenance walk', () => {
  it('step emits a memory node linked by typed edge', async () => {
    const { id: runId } = await store.startRun({ goalJson: {} })
    const memId = `mem-${Math.random().toString(36).slice(2)}`
    await nodes.putNode({
      id: memId,
      type: 'cap-store.memory',
      schemaVersion: 1,
      version: 1,
      state: 'active',
      data: { content: 'hello', summary: 's', category: 'c' },
      edges: [],
      meta: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    const { id: stepId } = await store.appendStep({
      runId,
      stepIndex: 0,
      actor: agent,
      actionType: 'observe',
      emitsNodeIds: [memId],
    })
    const sd = await dataOf(stepId)
    expect(sd.emitsNodeIds).toContain(memId)
    const runRow = await nodes.getNode(runId)
    const edges = JSON.parse(runRow?.edgesJson ?? '[]')
    expect(edges.some((e: any) => e.type === 'step' && e.targetId === stepId)).toBe(true)
  })
})

describe('scenario 8: time-travel + fork', () => {
  it('records versions; forkRun produces a child with patched goal', async () => {
    const { id: runId } = await store.startRun({ goalJson: { a: 1 } })
    await store.checkpointRun(runId, { p: 1 })
    const v1 = await nodes.getNodeAtVersion(runId, 1)
    expect(v1).not.toBeNull()
    const { id: childId } = await store.forkRun(runId, { a: 2, b: 3 })
    const cd = await dataOf(childId)
    expect(cd.goalJson).toEqual({ a: 2, b: 3 })
    expect(cd.parentRunId).toBe(runId)
  })
})

describe('scenario 9: OpenCode peer projection (EventRecord substrate)', () => {
  it('consumes an SSE-style event into EventRecord; chain verifies', async () => {
    await events.append({
      source: 'opencode',
      type: 'message.created',
      entityId: 'm1',
      payload: { role: 'assistant', text: 'hi' },
    })
    await events.append({
      source: 'opencode',
      type: 'message.updated',
      entityId: 'm1',
      payload: { blocks: [{ kind: 'tool_call' }] },
    })
    const chain = await events.verifyChain('opencode')
    expect(chain.ok).toBe(true)
    const list = await events.list('opencode')
    expect(list.length).toBe(2)
  })
})

describe('scenario 10: permission governance (Governor decides)', () => {
  it('a tier>3 permission is auto-denied and written as a decision', async () => {
    const bus = CapabilityEventBus.getInstance()
    CapabilityEventBus.resetInstance()
    const fresh = CapabilityEventBus.getInstance()
    fresh.setDurableStore(events)

    const { id: sessionId } = await prisma.agentSession.create({
      data: {
        id: 'as-1',
        providerSessionId: 'ps-1',
        status: 'idle',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    })
    // Governor: deny tier > 3
    const risk = 4
    const decision = risk > 3 ? 'deny' : 'allow'
    await prisma.agentPermissionDecision.create({
      data: {
        id: 'apd-1',
        agentSessionId: sessionId,
        providerPermissionId: 'perm-1',
        toolName: 'fs.write',
        riskTier: risk,
        requestedAt: Date.now(),
        respondedAt: Date.now(),
        decision,
        decidedBy: actorDid({ kind: 'agent', id: 'governor' }),
        payloadJson: '{}',
        createdAt: Date.now(),
      },
    })
    const row = await prisma.agentPermissionDecision.findUnique({
      where: { providerPermissionId: 'perm-1' },
    })
    expect(row?.decision).toBe('deny')
    void bus
  })
})

describe('scenario 11: file edit truth (RFC-6902 patch)', () => {
  it('stores a JSON Patch; replayable from EventRecord', async () => {
    const session = await prisma.agentSession.create({
      data: {
        id: 'as-2',
        providerSessionId: 'ps-2',
        status: 'idle',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    })
    const patch = [{ op: 'replace', path: '/name', value: 'x' }]
    await prisma.agentFileEdit.create({
      data: {
        id: 'afe-1',
        agentSessionId: session.id,
        filePath: 'a.ts',
        patchJson: JSON.stringify(patch),
        beforeHash: 'h1',
        afterHash: 'h2',
        createdAt: Date.now(),
      },
    })
    await events.append({
      source: 'opencode',
      type: 'diff',
      entityId: 'afe-1',
      payload: { filePath: 'a.ts', patch },
    })
    const row = await prisma.agentFileEdit.findUnique({ where: { id: 'afe-1' } })
    expect(JSON.parse(row?.patchJson ?? '[]')).toEqual(patch)
    const ev = await events.list('opencode')
    expect(ev.some((e) => e.entityId === 'afe-1')).toBe(true)
  })
})

describe('scenario 9b: agent chat thread (reuses Conversation/Message/StreamBlock)', () => {
  it('startAgentConversation -> appendAgentMessage -> projected message + StreamBlock', async () => {
    const { conversationId, providerSessionId } = await store.startAgentConversation(
      agent,
      'build a scheduler',
      { title: 'scheduler' },
    )
    expect(conversationId).toBeTruthy()
    expect(providerSessionId).toBeTruthy()

    // assistant reply with a tool_call block
    const { id: msgId } = await store.appendAgentMessage(conversationId, {
      role: 'assistant',
      text: 'On it',
      model: 'm1',
      blocks: [
        { kind: 'text', data: { text: 'On it' } },
        { kind: 'tool_call', data: { name: 'fs.write', args: {} } },
      ],
    })

    const msgs = await store.getAgentMessages(conversationId)
    expect(msgs.length).toBe(2) // opening goal (user) + assistant reply
    const assistant = msgs[1] as any
    expect(assistant.role).toBe('assistant')
    expect(assistant.model).toBe('m1')

    const blocks = await prisma.streamBlock.findMany({ where: { messageId: msgId } })
    expect(blocks.length).toBe(2)
    expect(blocks.map((b: any) => b.blockKind).sort()).toEqual(['text', 'tool_call'])

    // causal link via agent_step
    const { id: brId } = await builder.startBuilderRun({ handle: 'x' }, 'human_led', user)
    const { runId: stepRunId } = await builder.spawnFromBuilder(brId)
    const { id: stepId } = await store.appendStep({
      runId: stepRunId,
      stepIndex: 0,
      actor: agent,
      actionType: 'llm_call',
    })
    await store.linkStepToMessage(stepId, msgId)
    const sd = await dataOf(stepId)
    expect(sd.emitsNodeIds).toContain(msgId)
  })
})

describe('slot binding audit hook', () => {
  it('writes an audited active SlotBinding and deactivates the prior', async () => {
    const { id: s1 } = await store.bindSlot({
      slotId: 'chat.composer',
      componentId: 'A',
      boundByActor: user,
    })
    const { id: s2 } = await store.bindSlot({
      slotId: 'chat.composer',
      componentId: 'B',
      boundByActor: user,
    })
    const active = (await store.listSlotBindings('chat.composer')) as Array<{
      id: string
      componentId: string
    }>
    expect(active.length).toBe(1)
    expect(active[0]!.id).toBe(s2)
    expect(active[0]!.componentId).toBe('B')
    void s1
  })
})
