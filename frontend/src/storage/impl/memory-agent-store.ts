/**
 * storage/impl/memory-agent-store.ts
 */

import type {
  AgentDefinition,
  AgentRun,
  AgentStep,
  AgentEdge,
  HitlGate,
  PolicyRule,
} from '../../shared/agent';
import type {
  AgentStore,
  HitlGateStore,
  PolicyRuleStore,
} from '../contracts/agent-store';

export class MemoryAgentStore implements AgentStore {
  private rows = new Map<string, AgentDefinition>();
  private bySlug = new Map<string, string>();
  private runs = new Map<string, AgentRun>();

  async get(id: string): Promise<AgentDefinition | null> {
    return this.rows.get(id) ?? null;
  }

  async getBySlug(slug: string): Promise<AgentDefinition | null> {
    const id = this.bySlug.get(slug);
    return id ? (this.rows.get(id) ?? null) : null;
  }

  async list(filter?: { workspaceId?: string; status?: string }): Promise<AgentDefinition[]> {
    const all = [...this.rows.values()];
    return all.filter((r) => {
      if (filter?.workspaceId && r.workspaceId !== filter.workspaceId) return false;
      if (filter?.status && r.status !== filter.status) return false;
      return true;
    });
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
    capabilityId: string;
    author?: AgentDefinition['author'];
    tags?: string[];
  }): Promise<AgentDefinition> {
    const now = Date.now();
    const id = `agent:${input.slug}:${now.toString(36)}`;
    const hitlStepIds = input.steps.filter((s) => s.kind === 'hitl').map((s) => s.hitlGateId).filter(Boolean) as string[];
    const row: AgentDefinition = {
      id,
      slug: input.slug,
      name: input.name,
      description: input.description ?? '',
      workspaceId: input.workspaceId,
      steps: input.steps,
      edges: input.edges,
      entryStepId: input.entryStepId,
      defaultModelId: input.defaultModelId,
      maxLoopIterations: input.maxLoopIterations ?? 10,
      policyRuleId: input.policyRuleId,
      hitlGateIds: hitlStepIds,
      status: 'published',
      capabilityId: input.capabilityId,
      version: 1,
      author: input.author ?? 'system',
      tags: input.tags ?? [],
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(id, row);
    this.bySlug.set(row.slug, id);
    return row;
  }

  async update(id: string, patch: Partial<AgentDefinition>): Promise<AgentDefinition> {
    const existing = this.rows.get(id);
    if (!existing) throw new Error(`Agent not found: ${id}`);
    const updated: AgentDefinition = {
      ...existing,
      ...patch,
      id: existing.id,
      version: existing.version + 1,
      updatedAt: Date.now(),
    };
    this.rows.set(id, updated);
    return updated;
  }

  async updateDag(
    id: string,
    steps: AgentStep[],
    edges: AgentEdge[],
    entryStepId?: string,
  ): Promise<AgentDefinition> {
    return this.update(id, {
      steps,
      edges,
      ...(entryStepId ? { entryStepId } : {}),
    });
  }

  async setStatus(id: string, status: AgentDefinition['status']): Promise<void> {
    const existing = this.rows.get(id);
    if (!existing) return;
    existing.status = status;
    existing.updatedAt = Date.now();
  }

  async remove(id: string): Promise<boolean> {
    const row = this.rows.get(id);
    if (!row) return false;
    this.bySlug.delete(row.slug);
    return this.rows.delete(id);
  }

  async startRun(agentId: string, traceId: string): Promise<AgentRun> {
    const now = Date.now();
    const run: AgentRun = {
      id: `run:${agentId}:${now.toString(36)}`,
      agentId,
      traceId,
      status: 'running',
      iteration: 0,
      startedAt: now,
      stepStates: {},
    };
    this.runs.set(run.id, run);
    return run;
  }

  async getRun(runId: string): Promise<AgentRun | null> {
    return this.runs.get(runId) ?? null;
  }

  async listRuns(agentId: string, limit = 50): Promise<AgentRun[]> {
    return [...this.runs.values()]
      .filter((r) => r.agentId === agentId)
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, limit);
  }

  async updateRun(runId: string, patch: Partial<AgentRun>): Promise<AgentRun> {
    const existing = this.runs.get(runId);
    if (!existing) throw new Error(`Run not found: ${runId}`);
    Object.assign(existing, patch);
    return existing;
  }
}

export class MemoryHitlGateStore implements HitlGateStore {
  private rows = new Map<string, HitlGate>();
  private bySlug = new Map<string, string>();

  async get(id: string): Promise<HitlGate | null> {
    return this.rows.get(id) ?? null;
  }

  async getBySlug(slug: string): Promise<HitlGate | null> {
    const id = this.bySlug.get(slug);
    return id ? (this.rows.get(id) ?? null) : null;
  }

  async list(): Promise<HitlGate[]> {
    return [...this.rows.values()];
  }

  async upsert(input: Omit<HitlGate, 'createdAt' | 'updatedAt'>): Promise<HitlGate> {
    const existing = this.rows.get(input.id);
    const now = Date.now();
    const row: HitlGate = {
      ...input,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.rows.set(row.id, row);
    this.bySlug.set(row.slug, row.id);
    return row;
  }
}

export class MemoryPolicyRuleStore implements PolicyRuleStore {
  private rows = new Map<string, PolicyRule>();
  private bySlug = new Map<string, string>();

  async get(id: string): Promise<PolicyRule | null> {
    return this.rows.get(id) ?? null;
  }

  async getBySlug(slug: string): Promise<PolicyRule | null> {
    const id = this.bySlug.get(slug);
    return id ? (this.rows.get(id) ?? null) : null;
  }

  async list(): Promise<PolicyRule[]> {
    return [...this.rows.values()];
  }

  async upsert(input: Omit<PolicyRule, 'createdAt' | 'updatedAt'>): Promise<PolicyRule> {
    const existing = this.rows.get(input.id);
    const now = Date.now();
    const row: PolicyRule = {
      ...input,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.rows.set(row.id, row);
    this.bySlug.set(row.slug, row.id);
    return row;
  }
}
