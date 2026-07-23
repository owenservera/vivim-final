/**
 * engines/workspace-engine.ts
 * --------------------------------------------------------------------
 * Workspace engine. Manages the workspace visual taxonomy
 * (workspace → surface → region → node) and the 3D z-axis layer model.
 *
 * Extends the v2 AdaptiveWorkspace. The shell stays dumb — 3D
 * transforms are data-driven from routeSyncWorkspace output, not
 * hardcoded.
 */

import type { CapabilityEventBus } from './capability-event-bus';
import type { StructuredLogger } from './structured-logger';
import type { WorkspaceTaxonomy, WorkspaceSurface } from '../shared/workspace';
import { GLOBAL_WORKSPACE_ID } from '../shared/workspace';
import type { WorkspaceStore } from '../storage/contracts/workspace-store';
import { ulid } from '../lib/ulid';

export interface WorkspaceEngineDeps {
  workspaceStore: WorkspaceStore;
  eventBus: CapabilityEventBus;
  logger: StructuredLogger;
}

export class WorkspaceEngine {
  constructor(private deps: WorkspaceEngineDeps) {}

  /** Always resolvable. Lazy-seeded on first access. */
  async getGlobal(): Promise<WorkspaceTaxonomy> {
    return this.deps.workspaceStore.getGlobal();
  }

  async get(id: string): Promise<WorkspaceTaxonomy | null> {
    return this.deps.workspaceStore.get(id);
  }

  async list(filter?: { parentId?: string; kind?: string }): Promise<WorkspaceTaxonomy[]> {
    return this.deps.workspaceStore.list(filter);
  }

  /** Create a child workspace. The global workspace cannot be removed. */
  async create(input: {
    slug: string;
    displayName: string;
    kind?: WorkspaceTaxonomy['kind'];
    parentId?: string;
    ownerId?: string;
    isDefault?: boolean;
  }): Promise<WorkspaceTaxonomy> {
    const ws = await this.deps.workspaceStore.create(input);
    this.deps.eventBus.emit({
      type: 'workspace:created',
      workspaceId: ws.id,
      parentId: ws.parentId,
      slug: ws.slug,
    });
    this.deps.logger.info('workspace-engine', `created workspace ${ws.slug}`, {
      workspaceId: ws.id,
      zDepth: ws.zDepth,
    });
    return ws;
  }

  /**
   * Switch workspace — re-couple a new routeSyncWorkspace under a new
   * traceId. Emits `workspace:switched` so the frontend re-resolves
   * and re-renders only the diff (bundle 02 §D re-coupling).
   */
  async switchWorkspace(
    fromWorkspaceId: string | null,
    toWorkspaceId: string,
    userId: string,
  ): Promise<WorkspaceTaxonomy> {
    const ws = await this.deps.workspaceStore.get(toWorkspaceId);
    if (!ws) throw new Error(`Workspace not found: ${toWorkspaceId}`);
    const traceId = ulid();
    this.deps.eventBus.emit({
      type: 'workspace:switched',
      traceId,
      fromWorkspaceId,
      toWorkspaceId,
      userId,
    });
    this.deps.logger.info('workspace-engine', `switched ${fromWorkspaceId} → ${toWorkspaceId}`, {
      traceId,
    });
    return ws;
  }

  async upsertSurface(
    workspaceId: string,
    surface: Omit<WorkspaceSurface, 'workspaceId'>,
  ): Promise<WorkspaceSurface> {
    return this.deps.workspaceStore.upsertSurface(workspaceId, surface);
  }

  async remove(id: string): Promise<boolean> {
    if (id === GLOBAL_WORKSPACE_ID) return false;
    const ok = await this.deps.workspaceStore.remove(id);
    if (ok) this.deps.eventBus.emit({ type: 'workspace:removed', workspaceId: id });
    return ok;
  }

  async dispatch(capabilityId: string, input: Record<string, unknown>): Promise<unknown> {
    switch (capabilityId) {
      case 'cap:workspace:list':
        return this.list({
          parentId: input.parentId ? String(input.parentId) : undefined,
          kind: input.kind ? String(input.kind) : undefined,
        });
      case 'cap:workspace:create':
        return this.create({
          slug: String(input.slug),
          displayName: String(input.displayName),
          kind: input.kind as WorkspaceTaxonomy['kind'] | undefined,
          parentId: input.parentId ? String(input.parentId) : undefined,
          ownerId: input.ownerId ? String(input.ownerId) : undefined,
          isDefault: input.isDefault === true,
        });
      case 'cap:workspace:switch':
        return this.switchWorkspace(
          input.fromWorkspaceId ? String(input.fromWorkspaceId) : null,
          String(input.toWorkspaceId),
          String(input.userId ?? 'user:1'),
        );
      case 'cap:workspace:get':
        return this.get(String(input.workspaceId));
      default:
        throw new Error(`workspace-engine: unknown capability ${capabilityId}`);
    }
  }

  static capabilities(): string[] {
    return ['cap:workspace:list', 'cap:workspace:create', 'cap:workspace:switch', 'cap:workspace:get'];
  }
}
