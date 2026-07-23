/**
 * storage/impl/memory-template-store.ts
 */

import type { WorkspaceTemplate } from '../../shared/template';
import { WORKSPACE_TEMPLATES } from '../../shared/template';
import type { WorkspaceTemplateStore } from '../contracts/template-store';

export class MemoryWorkspaceTemplateStore implements WorkspaceTemplateStore {
  private instantiations = new Map<string, string[]>(); // templateId → workspaceIds

  list(): WorkspaceTemplate[] {
    return WORKSPACE_TEMPLATES;
  }

  get(id: string): WorkspaceTemplate | null {
    return WORKSPACE_TEMPLATES.find((t) => t.id === id) ?? null;
  }

  getBySlug(slug: string): WorkspaceTemplate | null {
    return WORKSPACE_TEMPLATES.find((t) => t.slug === slug) ?? null;
  }

  async recordInstantiation(workspaceId: string, templateId: string): Promise<void> {
    let list = this.instantiations.get(templateId);
    if (!list) {
      list = [];
      this.instantiations.set(templateId, list);
    }
    if (!list.includes(workspaceId)) list.push(workspaceId);
  }

  async listInstantiations(templateId: string): Promise<string[]> {
    return this.instantiations.get(templateId) ?? [];
  }
}
