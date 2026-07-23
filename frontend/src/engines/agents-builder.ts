/**
 * engines/agents-builder.ts
 * --------------------------------------------------------------------
 * Agents Builder engine. Composes AutonomousTask / AutonomousStep /
 * HitlGate (prisma/schema.prisma L19) into reusable agent definitions
 * via the same visual DAG + card model.
 *
 * Agents are UnifiedCapability instances; an agent card on the canvas
 * can be invoked, observed (AgentStep / AgentLoopRun tables), and
 * hot-edited. Reuses the existing PolicyRule / HitlGate tables for
 * guardrails.
 */

import type { CapabilityEventBus } from './capability-event-bus';
import type { StructuredLogger } from './structured-logger';
import type {
  AgentDefinition,
  AgentRun,
  AgentStep,
  AgentEdge,
  HitlGate,
  PolicyRule,
} from '../shared/agent';
import type {
  AgentStore,
  HitlGateStore,
  PolicyRuleStore,
} from '../storage/contracts/agent-store';
import { ulid } from '../lib/ulid';

export interface AgentsBuilderDeps {
  agentStore: AgentStore;
  hitlGateStore: HitlGateStore;
  policyRuleStore: PolicyRuleStore;
  eventBus: CapabilityEventBus;
  logger: StructuredLogger;
}

export class AgentsBuilder {
  constructor(private deps: AgentsBuilderDeps) {}

  async list(filter?: { workspaceId?: string; status?: string }): Promise<AgentDefinition[]> {
    return this.deps.agentStore.list(filter);
  }

  async get(id: string): Promise<AgentDefinition | null> {
    return this.deps.agentStore.get(id);
  }

  async create(input: {
    slug: string;
    name: string;
    description?: string;
    workspaceId: string;
    steps: AgentStep[];
    edges: AgentEdge[];
    entryStepId: string;
    defaultModelId?: string;
    maxLoopIterations?: number;
    policyRuleId?: string;
    capabilityId?: string;
    author?: AgentDefinition['author'];
    tags?: string[];
  }): Promise<AgentDefinition> {
    const capabilityId = input.capabilityId ?? `cap:agent:${input.slug}`;
    const agent = await this.deps.agentStore.create({ ...input, capabilityId });
    this.deps.eventBus.emit({
      type: 'agent:created',
      agentId: agent.id,
      slug: agent.slug,
      capabilityId,
    });
    return agent;
  }

  /** Update the DAG (live edit; no rebuild). */
  async updateDag(
    id: string,
    steps: AgentStep[],
    edges: AgentEdge[],
    entryStepId?: string,
  ): Promise<AgentDefinition> {
    const updated = await this.deps.agentStore.updateDag(id, steps, edges, entryStepId);
    this.deps.eventBus.emit({
      type: 'agent:updated',
      agentId: id,
      version: updated.version,
    });
    return updated;
  }

  /**
   * Invoke an agent. Walks the step DAG from the entry step, looping
   * up to maxLoopIterations. HITL gates pause the run.
   */
  async invoke(agentId: string): Promise<AgentRun> {
    const agent = await this.deps.agentStore.get(agentId);
    if (!agent) throw new Error(`Agent not found: ${agentId}`);
    const traceId = ulid();
    const run = await this.deps.agentStore.startRun(agentId, traceId);

    this.deps.logger.info('agents-builder', `invoking ${agent.slug}`, {
      agentId,
      traceId,
      stepCount: agent.steps.length,
    });

    let current: AgentStep | undefined = agent.steps.find((s) => s.id === agent.entryStepId);
    let iteration = 0;
    const visited = new Set<string>();

    while (current && iteration < agent.maxLoopIterations) {
      if (visited.has(current.id)) {
        iteration += 1;
        // Loop back: find the next unvisited edge from any step already in the path.
        const nextEdge = agent.edges.find((e) => !visited.has(e.toStepId));
        current = nextEdge ? agent.steps.find((s) => s.id === nextEdge.toStepId) : undefined;
        continue;
      }
      visited.add(current.id);

      const start = Date.now();
      run.stepStates[current.id] = { status: 'running', startedAt: start };

      // For the prototype, each step "succeeds" with a stub output.
      // Production dispatches to cap:* capabilities or an LLM for 'think' steps.
      const out = { ok: true, step: current.id, kind: current.kind };
      run.stepStates[current.id] = {
        status: 'completed',
        startedAt: start,
        completedAt: Date.now(),
        output: out,
      };

      if (current.kind === 'hitl') {
        await this.deps.agentStore.updateRun(run.id, {
          status: 'hitl',
          iteration,
          stepStates: run.stepStates,
        });
        this.deps.eventBus.emit({
          type: 'agent:hitl',
          agentId,
          runId: run.id,
          stepId: current.id,
          traceId,
        });
        return run;
      }

      if (current.kind === 'output') {
        // Final step — complete the run.
        await this.deps.agentStore.updateRun(run.id, {
          status: 'completed',
          iteration,
          completedAt: Date.now(),
          stepStates: run.stepStates,
          finalOutput: out,
        });
        this.deps.eventBus.emit({
          type: 'agent:completed',
          agentId,
          runId: run.id,
          traceId,
        });
        return run;
      }

      const edge = agent.edges.find((e) => e.fromStepId === current!.id);
      current = edge ? agent.steps.find((s) => s.id === edge.toStepId) : undefined;
    }

    await this.deps.agentStore.updateRun(run.id, {
      status: 'completed',
      iteration,
      completedAt: Date.now(),
      stepStates: run.stepStates,
    });
    return run;
  }

  async listRuns(agentId: string, limit?: number): Promise<AgentRun[]> {
    return this.deps.agentStore.listRuns(agentId, limit);
  }

  // ── HitlGate + PolicyRule guardrails ──────────────────────────────────

  async listHitlGates(): Promise<HitlGate[]> {
    return this.deps.hitlGateStore.list();
  }

  async upsertHitlGate(input: Omit<HitlGate, 'createdAt' | 'updatedAt'>): Promise<HitlGate> {
    return this.deps.hitlGateStore.upsert(input);
  }

  async listPolicyRules(): Promise<PolicyRule[]> {
    return this.deps.policyRuleStore.list();
  }

  async upsertPolicyRule(input: Omit<PolicyRule, 'createdAt' | 'updatedAt'>): Promise<PolicyRule> {
    return this.deps.policyRuleStore.upsert(input);
  }

  async dispatch(capabilityId: string, input: Record<string, unknown>): Promise<unknown> {
    switch (capabilityId) {
      case 'cap:agent:list':
        return this.list({
          workspaceId: input.workspaceId ? String(input.workspaceId) : undefined,
          status: input.status ? String(input.status) : undefined,
        });
      case 'cap:agent:create':
        return this.create({
          slug: String(input.slug),
          name: String(input.name),
          description: input.description ? String(input.description) : undefined,
          workspaceId: String(input.workspaceId),
          steps: (input.steps as AgentStep[]) ?? [],
          edges: (input.edges as AgentEdge[]) ?? [],
          entryStepId: String(input.entryStepId),
          defaultModelId: input.defaultModelId ? String(input.defaultModelId) : undefined,
          maxLoopIterations: typeof input.maxLoopIterations === 'number' ? input.maxLoopIterations : undefined,
          policyRuleId: input.policyRuleId ? String(input.policyRuleId) : undefined,
          capabilityId: input.capabilityId ? String(input.capabilityId) : undefined,
          author: input.author as AgentDefinition['author'] | undefined,
          tags: Array.isArray(input.tags) ? (input.tags as string[]) : undefined,
        });
      case 'cap:agent:update_dag':
        return this.updateDag(
          String(input.agentId),
          (input.steps as AgentStep[]) ?? [],
          (input.edges as AgentEdge[]) ?? [],
          input.entryStepId ? String(input.entryStepId) : undefined,
        );
      case 'cap:agent:invoke':
        return this.invoke(String(input.agentId));
      case 'cap:agent:runs':
        return this.listRuns(String(input.agentId));
      case 'cap:hitl:list':
        return this.listHitlGates();
      case 'cap:policy:list':
        return this.listPolicyRules();
      default:
        throw new Error(`agents-builder: unknown capability ${capabilityId}`);
    }
  }

  static capabilities(): string[] {
    return [
      'cap:agent:list',
      'cap:agent:create',
      'cap:agent:update_dag',
      'cap:agent:invoke',
      'cap:agent:runs',
      'cap:hitl:list',
      'cap:policy:list',
    ];
  }
}
