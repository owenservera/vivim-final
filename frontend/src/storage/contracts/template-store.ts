/**
 * storage/contracts/template-store.ts
 * --------------------------------------------------------------------
 * #10 Workspace Templates Gallery — store contract.
 * Templates are mostly static (WORKSPACE_TEMPLATES constant); the store
 * tracks which workspaces were created from which template.
 */

import type { WorkspaceTemplate } from '../../shared/template';

export interface WorkspaceTemplateStore {
  list(): WorkspaceTemplate[];
  get(id: string): WorkspaceTemplate | null;
  getBySlug(slug: string): WorkspaceTemplate | null;
  /** Record that a workspace was created from a template. */
  recordInstantiation(workspaceId: string, templateId: string): Promise<void>;
  /** List workspaces created from a template. */
  listInstantiations(templateId: string): Promise<string[]>;
}
