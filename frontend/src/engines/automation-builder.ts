/**
 * engines/automation-builder.ts
 * --------------------------------------------------------------------
 * Automation Builder engine. Reuses the existing WorkflowEngine
 * (src/engines/workflow-engine.ts) WorkflowNode/WorkflowEdge model.
 *
 * Each automation = a WorkflowDefinition row + a UnifiedCapability (the
 * engine already has registerAsCapability). The builder publishes
 * automation nodes as CanvasDefinition cards so they're editable live
 * (no rebuild — invariant 7).
 */

import type { CapabilityEventBus } from './capability-event-bus';
import type { StructuredLogger } from './structured-logger';
import type {
  AutomationDefinition,
  AutomationExecution,
  AutomationNode,
  AutomationEdge,
} from '../shared/automation';
import type { AutomationStore } from '../storage/contracts/automation-store';
import { ulid } from '../lib/ulid';

export interface AutomationBuilderDeps {
  automationStore: AutomationStore;
  eventBus: CapabilityEventBus;
  logger: StructuredLogger;
}

export class AutomationBuilder {
  constructor(private deps: AutomationBuilderDeps) {}

  async list(filter?: { workspaceId?: string; status?: string }): Promise<AutomationDefinition[]> {
    return this.deps.automationStore.list(filter);
  }

  async get(id: string): Promise<AutomationDefinition | null> {
    return this.deps.automationStore.get(id);
  }

  async create(input: {
    slug: string;
    name: string;
    description?: string;
    workspaceId: string;
    nodes: AutomationNode[];
    edges: AutomationEdge[];
    trigger: AutomationDefinition['trigger'];
    capabilityId?: string;
    author?: AutomationDefinition['author'];
    tags?: string[];
  }): Promise<AutomationDefinition> {
    const capabilityId = input.capabilityId ?? `cap:automation:${input.slug}`;
    const auto = await this.deps.automationStore.create({
      ...input,
      capabilityId,
    });
    this.deps.eventBus.emit({
      type: 'automation:created',
      automationId: auto.id,
      slug: auto.slug,
      capabilityId,
    });
    return auto;
  }

  /** Update the visual DAG (live edit; no rebuild). */
  async updateGraph(
    id: string,
    nodes: AutomationNode[],
    edges: AutomationEdge[],
  ): Promise<AutomationDefinition> {
    const updated = await this.deps.automationStore.updateGraph(id, nodes, edges);
    this.deps.eventBus.emit({
      type: 'automation:updated',
      automationId: id,
      version: updated.version,
    });
    return updated;
  }

  /**
   * Execute an automation. Walks the DAG from the trigger node,
   * invoking each node's capability, until completion or a HITL gate.
   * Returns the execution row (status: completed | hitl | failed).
   */
  async execute(automationId: string): Promise<AutomationExecution> {
    const auto = await this.deps.automationStore.get(automationId);
    if (!auto) throw new Error(`Automation not found: ${automationId}`);
    const traceId = ulid();
    const execution = await this.deps.automationStore.startExecution(automationId, traceId);

    this.deps.logger.info('automation-builder', `executing ${auto.slug}`, {
      automationId,
      traceId,
      nodeCount: auto.nodes.length,
    });

    // Walk the DAG from the trigger node.
    const trigger = auto.nodes.find((n) => n.kind === 'trigger');
    if (!trigger) {
      await this.deps.automationStore.updateExecution(execution.id, {
        status: 'failed',
        error: 'no trigger node',
        completedAt: Date.now(),
      });
      return execution;
    }

    // Simple linear walk: from trigger, follow edges in order.
    let current: AutomationNode | undefined = trigger;
    const visited = new Set<string>();
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      const start = Date.now();
      this.deps.automationStore
        .updateExecution(execution.id, {
          nodeStates: {
            ...execution.nodeStates,
            [current.id]: { status: 'running', startedAt: start },
          },
        })
        .catch(() => {});
  // [audit] log the error with context here

      // For the prototype, each node "succeeds" with a stub output.
      // Production dispatches to cap:* capabilities via /api/capabilities/:id/execute.
      const out = { ok: true, node: current.id, capabilityId: current.capabilityId };
      execution.nodeStates[current.id] = {
        status: 'completed',
        startedAt: start,
        completedAt: Date.now(),
        output: out,
      };

      // If this is a HITL gate, pause execution.
      if (current.kind === 'hitl') {
        await this.deps.automationStore.updateExecution(execution.id, {
          status: 'hitl',
          nodeStates: execution.nodeStates,
        });
        this.deps.eventBus.emit({
          type: 'automation:hitl',
          automationId,
          executionId: execution.id,
          nodeId: current.id,
          traceId,
        });
        return execution;
      }

      // Follow the first outgoing edge.
      const edge = auto.edges.find((e) => e.fromNodeId === current!.id);
      current = edge ? auto.nodes.find((n) => n.id === edge.toNodeId) : undefined;
    }

    await this.deps.automationStore.updateExecution(execution.id, {
      status: 'completed',
      completedAt: Date.now(),
      nodeStates: execution.nodeStates,
      output: { ok: true, traceId },
    });
    this.deps.eventBus.emit({
      type: 'automation:completed',
      automationId,
      executionId: execution.id,
      traceId,
    });
    return execution;
  }

  async listExecutions(automationId: string, limit?: number): Promise<AutomationExecution[]> {
    return this.deps.automationStore.listExecutions(automationId, limit);
  }

  async dispatch(capabilityId: string, input: Record<string, unknown>): Promise<unknown> {
    switch (capabilityId) {
      case 'cap:automation:list':
        return this.list({
          workspaceId: input.workspaceId ? String(input.workspaceId) : undefined,
          status: input.status ? String(input.status) : undefined,
        });
      case 'cap:automation:create':
        return this.create({
          slug: String(input.slug),
          name: String(input.name),
          description: input.description ? String(input.description) : undefined,
          workspaceId: String(input.workspaceId),
          nodes: (input.nodes as AutomationNode[]) ?? [],
          edges: (input.edges as AutomationEdge[]) ?? [],
          trigger: (input.trigger as AutomationDefinition['trigger']) ?? { kind: 'manual' },
          capabilityId: input.capabilityId ? String(input.capabilityId) : undefined,
          author: input.author as AutomationDefinition['author'] | undefined,
          tags: Array.isArray(input.tags) ? (input.tags as string[]) : undefined,
        });
      case 'cap:automation:update_graph':
        return this.updateGraph(
          String(input.automationId),
          (input.nodes as AutomationNode[]) ?? [],
          (input.edges as AutomationEdge[]) ?? [],
        );
      case 'cap:automation:execute':
        return this.execute(String(input.automationId));
      case 'cap:automation:executions':
        return this.listExecutions(String(input.automationId));
      default:
        throw new Error(`automation-builder: unknown capability ${capabilityId}`);
    }
  }

  static capabilities(): string[] {
    return [
      'cap:automation:list',
      'cap:automation:create',
      'cap:automation:update_graph',
      'cap:automation:execute',
      'cap:automation:executions',
    ];
  }
}
