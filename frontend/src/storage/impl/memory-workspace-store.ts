/**
 * storage/impl/memory-workspace-store.ts
 * --------------------------------------------------------------------
 * In-memory WorkspaceStore. The global workspace (`ws:global`) is
 * created lazily on first access and always exists.
 */

import type {
  WorkspaceTaxonomy,
  WorkspaceSurface,
  WorkspaceRegion,
} from '../../shared/workspace';
import { GLOBAL_WORKSPACE_ID } from '../../shared/workspace';
import type { WorkspaceStore } from '../contracts/workspace-store';

export class MemoryWorkspaceStore implements WorkspaceStore {
  private rows = new Map<string, WorkspaceTaxonomy>();
  private bySlug = new Map<string, string>();
  private globalSeeded = false;

  async get(id: string): Promise<WorkspaceTaxonomy | null> {
    await this.ensureGlobal();
    return this.rows.get(id) ?? null;
  }

  async getBySlug(slug: string): Promise<WorkspaceTaxonomy | null> {
    await this.ensureGlobal();
    const id = this.bySlug.get(slug);
    return id ? (this.rows.get(id) ?? null) : null;
  }

  async getGlobal(): Promise<WorkspaceTaxonomy> {
    await this.ensureGlobal();
    return this.rows.get(GLOBAL_WORKSPACE_ID)!;
  }

  async list(filter?: { parentId?: string; kind?: string }): Promise<WorkspaceTaxonomy[]> {
    await this.ensureGlobal();
    const all = [...this.rows.values()];
    return all.filter((r) => {
      if (filter?.parentId && r.parentId !== filter.parentId) return false;
      if (filter?.kind && r.kind !== filter.kind) return false;
      return true;
    });
  }

  async create(input: {
    slug: string;
    displayName: string;
    kind?: WorkspaceTaxonomy['kind'];
    parentId?: string;
    ownerId?: string;
    isDefault?: boolean;
  }): Promise<WorkspaceTaxonomy> {
    await this.ensureGlobal();
    const now = Date.now();
    const parentId = input.parentId ?? GLOBAL_WORKSPACE_ID;
    const parent = this.rows.get(parentId);
    const zDepth = parent ? parent.zDepth + 1 : 0;
    const id = `ws:${input.slug}:${now.toString(36)}`;
    const row: WorkspaceTaxonomy = {
      id,
      slug: input.slug,
      displayName: input.displayName,
      kind: input.kind ?? 'standard',
      parentId,
      zDepth,
      surfaces: [],
      regions: [],
      ownerId: input.ownerId ?? 'user:1',
      isDefault: input.isDefault ?? false,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(id, row);
    this.bySlug.set(row.slug, id);
    return row;
  }

  async update(id: string, patch: Partial<WorkspaceTaxonomy>): Promise<WorkspaceTaxonomy> {
    const existing = this.rows.get(id);
    if (!existing) throw new Error(`Workspace not found: ${id}`);
    const updated: WorkspaceTaxonomy = {
      ...existing,
      ...patch,
      id: existing.id,
      updatedAt: Date.now(),
    };
    this.rows.set(id, updated);
    return updated;
  }

  async remove(id: string): Promise<boolean> {
    if (id === GLOBAL_WORKSPACE_ID) return false;
    const row = this.rows.get(id);
    if (!row) return false;
    this.bySlug.delete(row.slug);
    return this.rows.delete(id);
  }

  async upsertSurface(
    workspaceId: string,
    surface: Omit<WorkspaceSurface, 'workspaceId'>,
  ): Promise<WorkspaceSurface> {
    const ws = this.rows.get(workspaceId);
    if (!ws) throw new Error(`Workspace not found: ${workspaceId}`);
    const existing = ws.surfaces.find((s) => s.id === surface.id);
    const merged: WorkspaceSurface = { ...surface, workspaceId };
    if (existing) {
      Object.assign(existing, merged);
    } else {
      ws.surfaces.push(merged);
    }
    ws.updatedAt = Date.now();
    return merged;
  }

  async upsertRegion(workspaceId: string, region: WorkspaceRegion): Promise<WorkspaceRegion> {
    const ws = this.rows.get(workspaceId);
    if (!ws) throw new Error(`Workspace not found: ${workspaceId}`);
    const existing = ws.regions.find((r) => r.id === region.id);
    if (existing) {
      Object.assign(existing, region);
    } else {
      ws.regions.push(region);
    }
    ws.updatedAt = Date.now();
    return region;
  }

  /** Ensure the global workspace exists (lazy seed). */
  private async ensureGlobal(): Promise<void> {
    if (this.globalSeeded) return;
    if (this.rows.has(GLOBAL_WORKSPACE_ID)) {
      this.globalSeeded = true;
      return;
    }
    const now = Date.now();
    const global: WorkspaceTaxonomy = {
      id: GLOBAL_WORKSPACE_ID,
      slug: 'global',
      displayName: 'Global Workspace',
      kind: 'global',
      parentId: null,
      zDepth: 0,
      surfaces: [
        {
          id: 'surface:global:chat',
          workspaceId: GLOBAL_WORKSPACE_ID,
          slug: 'chat',
          displayName: 'Chat',
          kind: 'chat',
          zDepth: 0,
          layout: { x: 0, y: 0, z: 0, w: 1280, h: 800 },
        },
        {
          id: 'surface:global:docs',
          workspaceId: GLOBAL_WORKSPACE_ID,
          slug: 'docs',
          displayName: 'Documents',
          kind: 'docs',
          zDepth: 1,
          layout: { x: 0, y: 0, z: 1, w: 1280, h: 800 },
        },
        {
          id: 'surface:global:media',
          workspaceId: GLOBAL_WORKSPACE_ID,
          slug: 'media',
          displayName: 'Media',
          kind: 'media',
          zDepth: 2,
          layout: { x: 0, y: 0, z: 2, w: 1280, h: 800 },
        },
        {
          id: 'surface:global:automation',
          workspaceId: GLOBAL_WORKSPACE_ID,
          slug: 'automation',
          displayName: 'Automation Builder',
          kind: 'automation',
          zDepth: 3,
          layout: { x: 0, y: 0, z: 3, w: 1280, h: 800 },
        },
        {
          id: 'surface:global:agents',
          workspaceId: GLOBAL_WORKSPACE_ID,
          slug: 'agents',
          displayName: 'Agents Builder',
          kind: 'agents',
          zDepth: 4,
          layout: { x: 0, y: 0, z: 4, w: 1280, h: 800 },
        },
        {
          id: 'surface:global:shell',
          workspaceId: GLOBAL_WORKSPACE_ID,
          slug: 'shell',
          displayName: 'Shell',
          kind: 'shell',
          zDepth: 5,
          layout: { x: 0, y: 0, z: 5, w: 1280, h: 800 },
        },
      ],
      regions: [],
      ownerId: 'system',
      isDefault: true,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(GLOBAL_WORKSPACE_ID, global);
    this.bySlug.set('global', GLOBAL_WORKSPACE_ID);
    this.globalSeeded = true;
  }
}
