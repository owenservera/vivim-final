/**
 * storage/contracts/workspace-store.ts
 * --------------------------------------------------------------------
 * WorkspaceTaxonomy store contract. Engines depend on this; impl lives
 * in `storage/impl/*` (B2 invariant).
 */

import type { WorkspaceTaxonomy, WorkspaceSurface, WorkspaceRegion } from '../../shared/workspace';

export interface WorkspaceStore {
  get(id: string): Promise<WorkspaceTaxonomy | null>;
  getBySlug(slug: string): Promise<WorkspaceTaxonomy | null>;
  /** The global workspace always exists (id = GLOBAL_WORKSPACE_ID). */
  getGlobal(): Promise<WorkspaceTaxonomy>;
  list(filter?: { parentId?: string; kind?: string }): Promise<WorkspaceTaxonomy[]>;
  /** Create a child workspace. parentId defaults to GLOBAL_WORKSPACE_ID. */
  create(input: {
    slug: string;
    displayName: string;
    kind?: WorkspaceTaxonomy['kind'];
    parentId?: string;
    ownerId?: string;
    isDefault?: boolean;
  }): Promise<WorkspaceTaxonomy>;
  update(id: string, patch: Partial<WorkspaceTaxonomy>): Promise<WorkspaceTaxonomy>;
  remove(id: string): Promise<boolean>;
  /** Add / update a surface inside a workspace. */
  upsertSurface(workspaceId: string, surface: Omit<WorkspaceSurface, 'workspaceId'>): Promise<WorkspaceSurface>;
  /** Add / update a region inside a surface. */
  upsertRegion(workspaceId: string, region: WorkspaceRegion): Promise<WorkspaceRegion>;
}
