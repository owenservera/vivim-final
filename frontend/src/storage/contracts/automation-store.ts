/**
 * storage/contracts/automation-store.ts
 * --------------------------------------------------------------------
 * AutomationDefinition store. Each automation = WorkflowDefinition row +
 * UnifiedCapability. The builder publishes automation nodes as cards.
 */

import type {
  AutomationDefinition,
  AutomationExecution,
  AutomationNode,
  AutomationEdge,
} from '../../shared/automation';

export interface AutomationStore {
  get(id: string): Promise<AutomationDefinition | null>;
  getBySlug(slug: string): Promise<AutomationDefinition | null>;
  list(filter?: { workspaceId?: string; status?: string }): Promise<AutomationDefinition[]>;
  create(input: {
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
  }): Promise<AutomationDefinition>;
  update(id: string, patch: Partial<AutomationDefinition>): Promise<AutomationDefinition>;
  /** Update nodes/edges (visual DAG edit). */
  updateGraph(id: string, nodes: AutomationNode[], edges: AutomationEdge[]): Promise<AutomationDefinition>;
  setStatus(id: string, status: AutomationDefinition['status']): Promise<void>;
  remove(id: string): Promise<boolean>;

  /** Execution log. */
  startExecution(automationId: string, traceId: string): Promise<AutomationExecution>;
  getExecution(executionId: string): Promise<AutomationExecution | null>;
  listExecutions(automationId: string, limit?: number): Promise<AutomationExecution[]>;
  updateExecution(executionId: string, patch: Partial<AutomationExecution>): Promise<AutomationExecution>;
}
