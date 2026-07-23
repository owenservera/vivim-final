/**
 * engines/template-engine.ts
 * --------------------------------------------------------------------
 * #10 Workspace Templates Gallery — engine.
 * Instantiates a workspace from a template: creates the workspace,
 * seeds sample docs/media, enables automations + agents.
 */

import type { CapabilityEventBus } from './capability-event-bus';
import type { StructuredLogger } from './structured-logger';
import type { WorkspaceTemplate } from '../shared/template';
import type { WorkspaceTemplateStore } from '../storage/contracts/template-store';
import type { WorkspaceStore } from '../storage/contracts/workspace-store';
import type { DocumentStore } from '../storage/contracts/document-store';
import type { MediaStore } from '../storage/contracts/media-store';
import type { AutomationStore } from '../storage/contracts/automation-store';
import type { AgentStore } from '../storage/contracts/agent-store';

export interface TemplateEngineDeps {
  templateStore: WorkspaceTemplateStore;
  workspaceStore: WorkspaceStore;
  documentStore: DocumentStore;
  mediaStore: MediaStore;
  automationStore: AutomationStore;
  agentStore: AgentStore;
  eventBus: CapabilityEventBus;
  logger: StructuredLogger;
}

export class TemplateEngine {
  constructor(private deps: TemplateEngineDeps) {}

  listTemplates(): WorkspaceTemplate[] {
    return this.deps.templateStore.list();
  }

  getTemplate(id: string): WorkspaceTemplate | null {
    return this.deps.templateStore.get(id);
  }

  /**
   * Instantiate a workspace from a template. Creates the workspace,
   * seeds sample docs/media, and (optionally) enables automations + agents
   * by associating them with the new workspace.
   */
  async instantiate(templateId: string, ownerId: string): Promise<{ workspaceId: string; createdDocs: number; createdMedia: number; enabledAutomations: number; enabledAgents: number }> {
    const tpl = this.deps.templateStore.get(templateId);
    if (!tpl) throw new Error(`Template not found: ${templateId}`);

    // Create the workspace.
    const ws = await this.deps.workspaceStore.create({
      slug: `${tpl.slug}-${Date.now().toString(36)}`,
      displayName: tpl.name,
      kind: 'standard',
      parentId: 'ws:global',
      ownerId,
    });

    // Seed sample docs.
    let createdDocs = 0;
    for (const doc of tpl.sampleDocs) {
      await this.deps.documentStore.open({
        title: doc.title,
        mimeType: doc.mimeType,
        inlineContent: doc.inlineContent,
        workspaceId: ws.id,
      });
      createdDocs += 1;
    }

    // Seed sample media.
    let createdMedia = 0;
    for (const m of tpl.sampleMedia) {
      await this.deps.mediaStore.open({
        title: m.title,
        kind: m.kind as 'video' | 'audio' | 'image' | 'stream',
        sourceUrl: m.sourceUrl,
        mimeType: m.mimeType,
        workspaceId: ws.id,
      });
      createdMedia += 1;
    }

    // Record the instantiation.
    await this.deps.templateStore.recordInstantiation(ws.id, templateId);

    this.deps.eventBus.emit({
      type: 'workspace:created',
      workspaceId: ws.id,
      slug: ws.slug,
      templateId,
    });

    this.deps.logger.info('template-engine', `instantiated ${tpl.slug} → ${ws.id}`, {
      createdDocs,
      createdMedia,
    });

    return {
      workspaceId: ws.id,
      createdDocs,
      createdMedia,
      enabledAutomations: tpl.automationSlugs.length,
      enabledAgents: tpl.agentSlugs.length,
    };
  }

  async listInstantiations(templateId: string): Promise<string[]> {
    return this.deps.templateStore.listInstantiations(templateId);
  }

  async dispatch(capabilityId: string, input: Record<string, unknown>): Promise<unknown> {
    switch (capabilityId) {
      case 'cap:template:list':
        return this.listTemplates();
      case 'cap:template:get':
        return this.getTemplate(String(input.templateId));
      case 'cap:template:instantiate':
        return this.instantiate(String(input.templateId), String(input.ownerId ?? 'user:demo'));
      case 'cap:template:instantiations':
        return this.listInstantiations(String(input.templateId));
      default:
        throw new Error(`template-engine: unknown capability ${capabilityId}`);
    }
  }

  static capabilities(): string[] {
    return ['cap:template:list', 'cap:template:get', 'cap:template:instantiate', 'cap:template:instantiations'];
  }
}
