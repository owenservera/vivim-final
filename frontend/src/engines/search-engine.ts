/**
 * engines/search-engine.ts
 * --------------------------------------------------------------------
 * #2 Universal Search — engine.
 * Aggregates results from all stores into the SearchIndex.
 * Indexed entities: command, document, media, automation, agent,
 * workspace, provider, capability.
 */

import type { StructuredLogger } from './structured-logger';
import type { SearchHit, SearchQuery, SearchResponse } from '../shared/search';
import type { SearchIndex } from '../storage/contracts/search-index';
import type { ShellCommandStore } from '../storage/contracts/shell-command-store';
import type { DocumentStore } from '../storage/contracts/document-store';
import type { MediaStore } from '../storage/contracts/media-store';
import type { AutomationStore } from '../storage/contracts/automation-store';
import type { AgentStore } from '../storage/contracts/agent-store';
import type { WorkspaceStore } from '../storage/contracts/workspace-store';
import type { ProviderStore } from '../storage/contracts/provider-store';

export interface SearchEngineDeps {
  searchIndex: SearchIndex;
  shellCommandStore: ShellCommandStore;
  documentStore: DocumentStore;
  mediaStore: MediaStore;
  automationStore: AutomationStore;
  agentStore: AgentStore;
  workspaceStore: WorkspaceStore;
  providerStore: ProviderStore;
  logger: StructuredLogger;
}

export class SearchEngine {
  constructor(private deps: SearchEngineDeps) {}

  /** Re-index everything (call on boot or after bulk changes). */
  async reindex(): Promise<void> {
    await this.deps.searchIndex.clear();

    // Commands.
    const commands = this.deps.shellCommandStore.list();
    const cmdHits: SearchHit[] = commands.map((c) => ({
      kind: 'command',
      id: c.path.join(' '),
      title: c.path.join(' '),
      subtitle: c.description,
      score: 0,
      actionUrl: `shell:${c.path.join(' ')}`,
      actionLabel: 'Run',
      icon: '⌨️',
    }));
    await this.deps.searchIndex.indexMany(cmdHits);

    // Documents.
    const docs = await this.deps.documentStore.list();
    await this.deps.searchIndex.indexMany(
      docs.map((d) => ({
        kind: 'document' as const,
        id: d.id,
        title: d.title,
        subtitle: `${d.engine} · ${d.mimeType}`,
        score: 0,
        actionUrl: `document:${d.id}`,
        actionLabel: 'Open',
        icon: '📄',
      })),
    );

    // Media.
    const medias = await this.deps.mediaStore.list();
    await this.deps.searchIndex.indexMany(
      medias.map((m) => ({
        kind: 'media' as const,
        id: m.id,
        title: m.title,
        subtitle: `${m.kind} · ${m.engine}`,
        score: 0,
        actionUrl: `media:${m.id}`,
        actionLabel: 'Open',
        icon: m.kind === 'video' ? '🎬' : m.kind === 'audio' ? '🎵' : '🖼️',
      })),
    );

    // Automations.
    const autos = await this.deps.automationStore.list();
    await this.deps.searchIndex.indexMany(
      autos.map((a) => ({
        kind: 'automation' as const,
        id: a.id,
        title: a.name,
        subtitle: `${a.trigger.kind} · ${a.status}`,
        score: 0,
        actionUrl: `automation:${a.id}`,
        actionLabel: 'Run',
        icon: '⚡',
      })),
    );

    // Agents.
    const agents = await this.deps.agentStore.list();
    await this.deps.searchIndex.indexMany(
      agents.map((a) => ({
        kind: 'agent' as const,
        id: a.id,
        title: a.name,
        subtitle: `${a.steps.length} steps`,
        score: 0,
        actionUrl: `agent:${a.id}`,
        actionLabel: 'Invoke',
        icon: '🤖',
      })),
    );

    // Workspaces.
    const workspaces = await this.deps.workspaceStore.list();
    await this.deps.searchIndex.indexMany(
      workspaces.map((w) => ({
        kind: 'workspace' as const,
        id: w.id,
        title: w.displayName,
        subtitle: `${w.kind} · z=${w.zDepth}`,
        score: 0,
        actionUrl: `workspace:${w.id}`,
        actionLabel: 'Switch',
        icon: '🗂️',
      })),
    );

    // Providers.
    const providers = await this.deps.providerStore.list();
    await this.deps.searchIndex.indexMany(
      providers.map((p) => ({
        kind: 'provider' as const,
        id: p.id,
        title: p.displayName,
        subtitle: p.slug,
        score: 0,
        actionUrl: `provider:${p.id}`,
        actionLabel: 'View',
        icon: '🔌',
      })),
    );

    this.deps.logger.info('search-engine', `indexed ${this.deps.searchIndex.size()} docs`);
  }

  async search(query: SearchQuery): Promise<SearchResponse> {
    return this.deps.searchIndex.search(query);
  }

  async dispatch(capabilityId: string, input: Record<string, unknown>): Promise<unknown> {
    switch (capabilityId) {
      case 'cap:search:query':
        return this.search({
          text: String(input.text ?? ''),
          kinds: Array.isArray(input.kinds) ? (input.kinds as SearchHit['kind'][]) : undefined,
          workspaceId: input.workspaceId ? String(input.workspaceId) : undefined,
          limit: typeof input.limit === 'number' ? input.limit : undefined,
        });
      case 'cap:search:reindex':
        await this.reindex();
        return { ok: true, size: this.deps.searchIndex.size() };
      default:
        throw new Error(`search-engine: unknown capability ${capabilityId}`);
    }
  }

  static capabilities(): string[] {
    return ['cap:search:query', 'cap:search:reindex'];
  }
}
