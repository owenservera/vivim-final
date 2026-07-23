/**
 * lib/canvas-engine-bootstrap.ts
 * --------------------------------------------------------------------
 * Server-side singleton wiring. Builds one bag of in-memory stores +
 * engines and reuses it across API route handlers. Production swaps the
 * memory impls for Prisma impls (still via the same contracts).
 *
 * Phase 2 adds: workspace/document/media/automation/agent stores +
 * engines, MediaBridge, ShellCommandStore + Engine, routeSyncWorkspace.
 */

import { CapabilityEventBus } from '../engines/capability-event-bus';
import { StructuredLogger, TraceStore } from '../engines/structured-logger';
import { CanvasLayerMounter } from '../engines/canvas-layer-mounter';
import { CanvasRegistry } from '../engines/canvas-registry';
import { PluginHotReload } from '../engines/plugin-hot-reload';
import { AdaptiveWorkspace } from '../engines/adaptive-workspace';
import { buildRouteSyncDeps } from '../engines/conceptual-model-service';
import { DocumentEngine } from '../engines/document-engine';
import { MediaEngine } from '../engines/media-engine';
import { MemoryMediaBridge } from '../engines/media-bridge';
import { AnnotationEngine, type AnnotationStore } from '../engines/annotation-engine';
import { WorkspaceEngine } from '../engines/workspace-engine';
import { AutomationBuilder } from '../engines/automation-builder';
import { AgentsBuilder } from '../engines/agents-builder';
import { ShellCommandEngine } from '../engines/shell-command-engine';
import { NotificationEngine } from '../engines/notification-engine';
import { SearchEngine } from '../engines/search-engine';
import { PresenceEngine } from '../engines/presence-engine';
import { AuditEngine } from '../engines/audit-engine';
import { RbacEngine } from '../engines/rbac-engine';
import { TemplateEngine } from '../engines/template-engine';
import { DocumentEditorEngine } from '../engines/document-editor-engine';
import { ZLayerEngine } from '../engines/z-layer-engine';
import { DrawerEngine } from '../engines/drawer-engine';
import { UIEngine } from '../engines/ui-engine';
import {
  MemoryAccountStore,
  MemoryAgentStore,
  MemoryAutomationStore,
  MemoryCanvasDefinitionStore,
  MemoryCapabilityTierStore,
  MemoryDocumentStore,
  MemoryHitlGateStore,
  MemoryMediaStore,
  MemoryPolicyRuleStore,
  MemoryPrimitiveStore,
  MemoryProviderStore,
  MemoryProviderTypeStore,
  MemoryShellCommandStore,
  MemoryUiComponentStore,
  MemoryUserLayoutStore,
  MemoryWorkspaceStore,
  // Phase 3
  MemoryNotificationStore,
  MemoryAuditStore,
  MemoryRbacStore,
  MemoryWorkspaceTemplateStore,
  MemoryPresenceStore,
  MemorySearchIndex,
  MemoryOnboardingStore,
  // Phase 4
  MemoryDocumentEditStore,
  MemoryZLayerStore,
  MemoryDrawerStore,
} from '../storage/impl';
import { registerDefaultCommands } from '../cli/commands/shell';
import { ulid } from './ulid';

/** Simple in-memory AnnotationStore (lives inside the bootstrap bag). */
class MemoryAnnotationStore implements AnnotationStore {
  private rows = new Map<string, import('../engines/annotation-engine').Annotation>();
  async get(id: string) {
    return this.rows.get(id) ?? null;
  }
  async list(filter?: { targetKind?: string; targetId?: string }) {
    const all = [...this.rows.values()];
    return all.filter((r) => {
      if (filter?.targetKind && r.targetKind !== filter.targetKind) return false;
      if (filter?.targetId && r.targetId !== filter.targetId) return false;
      return true;
    });
  }
  async create(input: Omit<import('../engines/annotation-engine').Annotation, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = Date.now();
    const id = `ann:${input.slug}:${now.toString(36)}`;
    const row = { ...input, id, createdAt: now, updatedAt: now };
    this.rows.set(id, row);
    return row;
  }
  async update(id: string, patch: Partial<import('../engines/annotation-engine').Annotation>) {
    const existing = this.rows.get(id);
    if (!existing) throw new Error(`Annotation not found: ${id}`);
    const updated = { ...existing, ...patch, id, updatedAt: Date.now() };
    this.rows.set(id, updated);
    return updated;
  }
  async remove(id: string) {
    return this.rows.delete(id);
  }
}

export interface CanvasEngineBag {
  // Phase 1
  eventBus: CapabilityEventBus;
  logger: StructuredLogger;
  traceStore: TraceStore;
  uiComponentStore: MemoryUiComponentStore;
  providerTypeStore: MemoryProviderTypeStore;
  primitiveStore: MemoryPrimitiveStore;
  providerStore: MemoryProviderStore;
  accountStore: MemoryAccountStore;
  capabilityTierStore: MemoryCapabilityTierStore;
  userLayoutStore: MemoryUserLayoutStore;
  canvasDefinitionStore: MemoryCanvasDefinitionStore;
  canvasRegistry: CanvasRegistry;
  layerMounter: CanvasLayerMounter;
  hotReload: PluginHotReload;
  workspace: AdaptiveWorkspace;
  routeSyncDeps: ReturnType<typeof buildRouteSyncDeps>;

  // Phase 2 — workspace OS expansion
  workspaceStore: MemoryWorkspaceStore;
  documentStore: MemoryDocumentStore;
  mediaStore: MemoryMediaStore;
  automationStore: MemoryAutomationStore;
  agentStore: MemoryAgentStore;
  hitlGateStore: MemoryHitlGateStore;
  policyRuleStore: MemoryPolicyRuleStore;
  annotationStore: MemoryAnnotationStore;
  shellCommandStore: MemoryShellCommandStore;

  documentEngine: DocumentEngine;
  mediaEngine: MediaEngine;
  mediaBridge: MemoryMediaBridge;
  annotationEngine: AnnotationEngine;
  workspaceEngine: WorkspaceEngine;
  automationBuilder: AutomationBuilder;
  agentsBuilder: AgentsBuilder;
  shellCommandEngine: ShellCommandEngine;

  // Phase 3 — UX enhancement engines + stores
  notificationStore: MemoryNotificationStore;
  auditStore: MemoryAuditStore;
  rbacStore: MemoryRbacStore;
  templateStore: MemoryWorkspaceTemplateStore;
  presenceStore: MemoryPresenceStore;
  searchIndex: MemorySearchIndex;
  onboardingStore: MemoryOnboardingStore;
  notificationEngine: NotificationEngine;
  searchEngine: SearchEngine;
  presenceEngine: PresenceEngine;
  auditEngine: AuditEngine;
  rbacEngine: RbacEngine;
  templateEngine: TemplateEngine;

  // Phase 4 — doc suite, z-layers, drawers
  documentEditStore: MemoryDocumentEditStore;
  zLayerStore: MemoryZLayerStore;
  drawerStore: MemoryDrawerStore;
  documentEditorEngine: DocumentEditorEngine;
  zLayerEngine: ZLayerEngine;
  drawerEngine: DrawerEngine;

  // V8 — Central Reprogrammability Engine
  uiEngine: UIEngine;
}

let _bag: CanvasEngineBag | null = null;
let _seeded = false;

export function getEngineBag(): CanvasEngineBag {
  if (_bag) return _bag;
  const eventBus = CapabilityEventBus.getInstance();
  const logger = new StructuredLogger('info');
  const traceStore = new TraceStore();
  logger.addSink((entry) => {
    if (entry.traceId && entry.spanId) {
      traceStore.append({
        id: entry.spanId,
        traceId: entry.traceId,
        spanId: entry.spanId,
        parentSpanId: entry.parentSpanId,
        engine: entry.engine ?? 'unknown',
        method: entry.msg,
        durationMs: entry.durationMs ?? 0,
        ok: !entry.msg.toLowerCase().includes('error'),
        createdAt: entry.ts,
      });
    }
  });

  // Phase 1 stores
  const uiComponentStore = new MemoryUiComponentStore();
  const providerTypeStore = new MemoryProviderTypeStore();
  const primitiveStore = new MemoryPrimitiveStore();
  const providerStore = new MemoryProviderStore();
  const accountStore = new MemoryAccountStore();
  const capabilityTierStore = new MemoryCapabilityTierStore();
  const userLayoutStore = new MemoryUserLayoutStore();
  const canvasDefinitionStore = new MemoryCanvasDefinitionStore();

  // Phase 2 stores
  const workspaceStore = new MemoryWorkspaceStore();
  const documentStore = new MemoryDocumentStore();
  const mediaStore = new MemoryMediaStore();
  const automationStore = new MemoryAutomationStore();
  const agentStore = new MemoryAgentStore();
  const hitlGateStore = new MemoryHitlGateStore();
  const policyRuleStore = new MemoryPolicyRuleStore();
  const annotationStore = new MemoryAnnotationStore();
  const shellCommandStore = new MemoryShellCommandStore();

  // Phase 1 engines
  const canvasRegistry = new CanvasRegistry(canvasDefinitionStore, eventBus);
  const layerMounter = new CanvasLayerMounter(eventBus);
  const hotReload = new PluginHotReload();
  const routeSyncDeps = buildRouteSyncDeps({
    eventBus,
    logger,
    uiComponentStore,
    providerTypeStore,
    primitiveStore,
    providerStore,
    accountStore,
    capabilityTierStore,
  });
  const workspace = new AdaptiveWorkspace(routeSyncDeps, eventBus, logger);

  // Phase 2 engines
  const mediaBridge = new MemoryMediaBridge();
  const documentEngine = new DocumentEngine({ documentStore, eventBus, logger });
  const mediaEngine = new MediaEngine({ mediaStore, eventBus, logger, bridge: mediaBridge });
  const annotationEngine = new AnnotationEngine({ annotationStore, eventBus, logger });
  const workspaceEngine = new WorkspaceEngine({ workspaceStore, eventBus, logger });
  const automationBuilder = new AutomationBuilder({ automationStore, eventBus, logger });
  const agentsBuilder = new AgentsBuilder({
    agentStore,
    hitlGateStore,
    policyRuleStore,
    eventBus,
    logger,
  });
  const shellCommandEngine = new ShellCommandEngine({ commandStore: shellCommandStore, eventBus, logger });

  // Register the default CLI command catalog (FRONTEND=BACKEND two-way).
  registerDefaultCommands(shellCommandStore);

  // Phase 3 stores
  const notificationStore = new MemoryNotificationStore();
  const auditStore = new MemoryAuditStore();
  const rbacStore = new MemoryRbacStore();
  const templateStore = new MemoryWorkspaceTemplateStore();
  const presenceStore = new MemoryPresenceStore();
  const searchIndex = new MemorySearchIndex();
  const onboardingStore = new MemoryOnboardingStore();

  // Phase 3 engines
  const notificationEngine = new NotificationEngine({ notificationStore, eventBus, logger });
  const searchEngine = new SearchEngine({
    searchIndex,
    shellCommandStore,
    documentStore,
    mediaStore,
    automationStore,
    agentStore,
    workspaceStore,
    providerStore,
    logger,
  });
  const presenceEngine = new PresenceEngine({ presenceStore, eventBus, logger });
  const auditEngine = new AuditEngine({ auditStore, eventBus, logger });
  const rbacEngine = new RbacEngine({ rbacStore, eventBus, logger });
  const templateEngine = new TemplateEngine({
    templateStore,
    workspaceStore,
    documentStore,
    mediaStore,
    automationStore,
    agentStore,
    eventBus,
    logger,
  });

  // Start the engines that subscribe to the bus.
  notificationEngine.start();
  auditEngine.start();

  // Phase 4 stores + engines
  const documentEditStore = new MemoryDocumentEditStore(documentStore);
  const zLayerStore = new MemoryZLayerStore();
  const drawerStore = new MemoryDrawerStore();
  const documentEditorEngine = new DocumentEditorEngine({ editStore: documentEditStore, eventBus, logger });
  const zLayerEngine = new ZLayerEngine({ zLayerStore, eventBus, logger });
  const drawerEngine = new DrawerEngine({ drawerStore, eventBus, logger });

  // V8 — UI Engine
  const uiEngine = new UIEngine({ eventBus, logger });

  _bag = {
    eventBus,
    logger,
    traceStore,
    uiComponentStore,
    providerTypeStore,
    primitiveStore,
    providerStore,
    accountStore,
    capabilityTierStore,
    userLayoutStore,
    canvasDefinitionStore,
    canvasRegistry,
    layerMounter,
    hotReload,
    workspace,
    routeSyncDeps,

    // Phase 2
    workspaceStore,
    documentStore,
    mediaStore,
    automationStore,
    agentStore,
    hitlGateStore,
    policyRuleStore,
    annotationStore,
    shellCommandStore,

    documentEngine,
    mediaEngine,
    mediaBridge,
    annotationEngine,
    workspaceEngine,
    automationBuilder,
    agentsBuilder,
    shellCommandEngine,

    // Phase 3
    notificationStore,
    auditStore,
    rbacStore,
    templateStore,
    presenceStore,
    searchIndex,
    onboardingStore,
    notificationEngine,
    searchEngine,
    presenceEngine,
    auditEngine,
    rbacEngine,
    templateEngine,

    // Phase 4
    documentEditStore,
    zLayerStore,
    drawerStore,
    documentEditorEngine,
    zLayerEngine,
    drawerEngine,

    // V8
    uiEngine,
  };
  return _bag;
}

/** Idempotent seed flag — set after the first seedCanvasModel() run. */
export function isSeeded(): boolean {
  return _seeded;
}
export function markSeeded(): void {
  _seeded = true;
}

export function newTraceId(): string {
  return ulid();
}
