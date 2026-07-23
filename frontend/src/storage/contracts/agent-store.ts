/**
 * storage/contracts/agent-store.ts
 * --------------------------------------------------------------------
 * AgentDefinition store. Composes AutonomousTask / AutonomousStep /
 * HitlGate into reusable agents via the same DAG + card model.
 */

import type {
  AgentDefinition,
  AgentRun,
  AgentStep,
  AgentEdge,
  HitlGate,
  PolicyRule,
} from '../../shared/agent';

export interface AgentStore {
  get(id: string): Promise<AgentDefinition | null>;
  getBySlug(slug: string): Promise<AgentDefinition | null>;
  list(filter?: { workspaceId?: string; status?: string }): Promise<AgentDefinition[]>;
  create(input: {
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
  }): Promise<AgentDefinition>;
  update(id: string, patch: Partial<AgentDefinition>): Promise<AgentDefinition>;
  /** Update the DAG (steps + edges). */
  updateDag(id: string, steps: AgentStep[], edges: AgentEdge[], entryStepId?: string): Promise<AgentDefinition>;
  setStatus(id: string, status: AgentDefinition['status']): Promise<void>;
  remove(id: string): Promise<boolean>;

  /** Run log (mirrors AgentLoopRun). */
  startRun(agentId: string, traceId: string): Promise<AgentRun>;
  getRun(runId: string): Promise<AgentRun | null>;
  listRuns(agentId: string, limit?: number): Promise<AgentRun[]>;
  updateRun(runId: string, patch: Partial<AgentRun>): Promise<AgentRun>;
}

/** HitlGate + PolicyRule stores (guardrails). */
export interface HitlGateStore {
  get(id: string): Promise<HitlGate | null>;
  getBySlug(slug: string): Promise<HitlGate | null>;
  list(): Promise<HitlGate[]>;
  upsert(input: Omit<HitlGate, 'createdAt' | 'updatedAt'>): Promise<HitlGate>;
}

export interface PolicyRuleStore {
  get(id: string): Promise<PolicyRule | null>;
  getBySlug(slug: string): Promise<PolicyRule | null>;
  list(): Promise<PolicyRule[]>;
  upsert(input: Omit<PolicyRule, 'createdAt' | 'updatedAt'>): Promise<PolicyRule>;
}
