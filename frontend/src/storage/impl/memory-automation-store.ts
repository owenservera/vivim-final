/**
 * storage/impl/memory-automation-store.ts
 */

import type {
  AutomationDefinition,
  AutomationExecution,
  AutomationNode,
  AutomationEdge,
} from '../../shared/automation';
import type { AutomationStore } from '../contracts/automation-store';

export class MemoryAutomationStore implements AutomationStore {
  private rows = new Map<string, AutomationDefinition>();
  private bySlug = new Map<string, string>();
  private executions = new Map<string, AutomationExecution>();

  async get(id: string): Promise<AutomationDefinition | null> {
    return this.rows.get(id) ?? null;
  }

  async getBySlug(slug: string): Promise<AutomationDefinition | null> {
    const id = this.bySlug.get(slug);
    return id ? (this.rows.get(id) ?? null) : null;
  }

  async list(filter?: { workspaceId?: string; status?: string }): Promise<AutomationDefinition[]> {
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
    nodes: AutomationNode[];
    edges: AutomationEdge[];
    trigger: AutomationDefinition['trigger'];
    capabilityId: string;
    author?: AutomationDefinition['author'];
    tags?: string[];
  }): Promise<AutomationDefinition> {
    const now = Date.now();
    const id = `auto:${input.slug}:${now.toString(36)}`;
    const row: AutomationDefinition = {
      id,
      slug: input.slug,
      name: input.name,
      description: input.description ?? '',
      workspaceId: input.workspaceId,
      nodes: input.nodes,
      edges: input.edges,
      trigger: input.trigger,
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

  async update(id: string, patch: Partial<AutomationDefinition>): Promise<AutomationDefinition> {
    const existing = this.rows.get(id);
    if (!existing) throw new Error(`Automation not found: ${id}`);
    const updated: AutomationDefinition = {
      ...existing,
      ...patch,
      id: existing.id,
      version: existing.version + 1,
      updatedAt: Date.now(),
    };
    this.rows.set(id, updated);
    return updated;
  }

  async updateGraph(
    id: string,
    nodes: AutomationNode[],
    edges: AutomationEdge[],
  ): Promise<AutomationDefinition> {
    return this.update(id, { nodes, edges });
  }

  async setStatus(id: string, status: AutomationDefinition['status']): Promise<void> {
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

  async startExecution(automationId: string, traceId: string): Promise<AutomationExecution> {
    const now = Date.now();
    const execution: AutomationExecution = {
      id: `exec:${automationId}:${now.toString(36)}`,
      automationId,
      traceId,
      status: 'running',
      startedAt: now,
      nodeStates: {},
    };
    this.executions.set(execution.id, execution);
    return execution;
  }

  async getExecution(executionId: string): Promise<AutomationExecution | null> {
    return this.executions.get(executionId) ?? null;
  }

  async listExecutions(automationId: string, limit = 50): Promise<AutomationExecution[]> {
    return [...this.executions.values()]
      .filter((e) => e.automationId === automationId)
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, limit);
  }

  async updateExecution(
    executionId: string,
    patch: Partial<AutomationExecution>,
  ): Promise<AutomationExecution> {
    const existing = this.executions.get(executionId);
    if (!existing) throw new Error(`Execution not found: ${executionId}`);
    Object.assign(existing, patch);
    return existing;
  }
}
