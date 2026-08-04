/**
 * lib/canvas-engine-bootstrap.ts
 * --------------------------------------------------------------------
 * Server-side singleton wiring. Builds one bag of in-memory stores +
 * engines and reuses it across API route handlers. Production swaps the
 * memory impls for Prisma impls via StorageProvider (env-driven).
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
import { AnnotationEngine } from '../engines/annotation-engine';
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
import { getStorageProvider, type StorageProvider } from '../storage/provider';
import type {
  UiComponentStore,
  ProviderTypeStore,
  PrimitiveStore,
  ProviderStore,
  AccountStore,
  CapabilityTierStore,
  UserLayoutStore,
  CanvasDefinitionStore,
  WorkspaceStore,
  DocumentStore,
  MediaStore,
  AutomationStore,
  AgentStore,
  HitlGateStore,
  PolicyRuleStore,
  AnnotationStore,
  ShellCommandStore,
  NotificationStore,
  AuditStore,
  RbacStore,
  WorkspaceTemplateStore,
  PresenceStore,
  SearchIndex,
  OnboardingStore,
  DocumentEditStore,
  ZLayerStore,
  DrawerStore,
} from '../storage/contracts';
import { registerDefaultCommands } from '../cli/commands/shell';
import { ulid } from './ulid';

export interface CanvasEngineBag {
  storage: StorageProvider;

  // Phase 1 — core canvas
  eventBus: CapabilityEventBus;
  logger: StructuredLogger;
  traceStore: TraceStore;
  readonly uiComponentStore: UiComponentStore;
  readonly providerTypeStore: ProviderTypeStore;
  readonly primitiveStore: PrimitiveStore;
  readonly providerStore: ProviderStore;
  readonly accountStore: AccountStore;
  readonly capabilityTierStore: CapabilityTierStore;
  readonly userLayoutStore: UserLayoutStore;
  readonly canvasDefinitionStore: CanvasDefinitionStore;
  canvasRegistry: CanvasRegistry;
  layerMounter: CanvasLayerMounter;
  hotReload: PluginHotReload;
  workspace: AdaptiveWorkspace;
  routeSyncDeps: ReturnType<typeof buildRouteSyncDeps>;

  // Phase 2 — workspace OS
  readonly workspaceStore: WorkspaceStore;
  readonly documentStore: DocumentStore;
  readonly mediaStore: MediaStore;
  readonly automationStore: AutomationStore;
  readonly agentStore: AgentStore;
  readonly hitlGateStore: HitlGateStore;
  readonly policyRuleStore: PolicyRuleStore;
  readonly annotationStore: AnnotationStore;
  readonly shellCommandStore: ShellCommandStore;

  documentEngine: DocumentEngine;
  mediaEngine: MediaEngine;
  mediaBridge: MemoryMediaBridge;
  annotationEngine: AnnotationEngine;
  workspaceEngine: WorkspaceEngine;
  automationBuilder: AutomationBuilder;
  agentsBuilder: AgentsBuilder;
  shellCommandEngine: ShellCommandEngine;

  // Phase 3 — UX enhancement
  readonly notificationStore: NotificationStore;
  readonly auditStore: AuditStore;
  readonly rbacStore: RbacStore;
  readonly templateStore: WorkspaceTemplateStore;
  readonly presenceStore: PresenceStore;
  readonly searchIndex: SearchIndex;
  readonly onboardingStore: OnboardingStore;
  notificationEngine: NotificationEngine;
  searchEngine: SearchEngine;
  presenceEngine: PresenceEngine;
  auditEngine: AuditEngine;
  rbacEngine: RbacEngine;
  templateEngine: TemplateEngine;

  // Phase 4 — doc suite
  readonly documentEditStore: DocumentEditStore;
  readonly zLayerStore: ZLayerStore;
  readonly drawerStore: DrawerStore;
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

  const storage = getStorageProvider();

  // Phase 1 engines
  const canvasRegistry = new CanvasRegistry(storage.canvasDefinitionStore, eventBus);
  const layerMounter = new CanvasLayerMounter(eventBus);
  const hotReload = new PluginHotReload();
  const routeSyncDeps = buildRouteSyncDeps({
    eventBus,
    logger,
    uiComponentStore: storage.uiComponentStore,
    providerTypeStore: storage.providerTypeStore,
    primitiveStore: storage.primitiveStore,
    providerStore: storage.providerStore,
    accountStore: storage.accountStore,
    capabilityTierStore: storage.capabilityTierStore,
  });
  const workspace = new AdaptiveWorkspace(routeSyncDeps, eventBus, logger);

  // Phase 2 engines
  const mediaBridge = new MemoryMediaBridge();
  const documentEngine = new DocumentEngine({ documentStore: storage.documentStore, eventBus, logger });
  const mediaEngine = new MediaEngine({ mediaStore: storage.mediaStore, eventBus, logger, bridge: mediaBridge });
  const annotationEngine = new AnnotationEngine({ annotationStore: storage.annotationStore, eventBus, logger });
  const workspaceEngine = new WorkspaceEngine({ workspaceStore: storage.workspaceStore, eventBus, logger });
  const automationBuilder = new AutomationBuilder({ automationStore: storage.automationStore, eventBus, logger });
  const agentsBuilder = new AgentsBuilder({
    agentStore: storage.agentStore,
    hitlGateStore: storage.hitlGateStore,
    policyRuleStore: storage.policyRuleStore,
    eventBus,
    logger,
  });
  const shellCommandEngine = new ShellCommandEngine({ commandStore: storage.shellCommandStore, eventBus, logger });

  // Register the default CLI command catalog (FRONTEND=BACKEND two-way).
  registerDefaultCommands(storage.shellCommandStore);

  // Phase 3 engines
  const notificationEngine = new NotificationEngine({ notificationStore: storage.notificationStore, eventBus, logger });
  const searchEngine = new SearchEngine({
    searchIndex: storage.searchIndex,
    shellCommandStore: storage.shellCommandStore,
    documentStore: storage.documentStore,
    mediaStore: storage.mediaStore,
    automationStore: storage.automationStore,
    agentStore: storage.agentStore,
    workspaceStore: storage.workspaceStore,
    providerStore: storage.providerStore,
    logger,
  });
  const presenceEngine = new PresenceEngine({ presenceStore: storage.presenceStore, eventBus, logger });
  const auditEngine = new AuditEngine({ auditStore: storage.auditStore, eventBus, logger });
  const rbacEngine = new RbacEngine({ rbacStore: storage.rbacStore, eventBus, logger });
  const templateEngine = new TemplateEngine({
    templateStore: storage.templateStore,
    workspaceStore: storage.workspaceStore,
    documentStore: storage.documentStore,
    mediaStore: storage.mediaStore,
    automationStore: storage.automationStore,
    agentStore: storage.agentStore,
    eventBus,
    logger,
  });

  // Start the engines that subscribe to the bus.
  notificationEngine.start();
  auditEngine.start();

  // Phase 4 engines
  const documentEditorEngine = new DocumentEditorEngine({ editStore: storage.documentEditStore, eventBus, logger });
  const zLayerEngine = new ZLayerEngine({ zLayerStore: storage.zLayerStore, eventBus, logger });
  const drawerEngine = new DrawerEngine({ drawerStore: storage.drawerStore, eventBus, logger });

  // V8 — UI Engine
  const uiEngine = new UIEngine({ eventBus, logger });

  _bag = {
    storage,
    eventBus,
    logger,
    traceStore,
    canvasRegistry,
    layerMounter,
    hotReload,
    workspace,
    routeSyncDeps,

    documentEngine,
    mediaEngine,
    mediaBridge,
    annotationEngine,
    workspaceEngine,
    automationBuilder,
    agentsBuilder,
    shellCommandEngine,

    notificationEngine,
    searchEngine,
    presenceEngine,
    auditEngine,
    rbacEngine,
    templateEngine,

    documentEditorEngine,
    zLayerEngine,
    drawerEngine,

    uiEngine,

    // Back-compat store getters — DO NOT add new ones; use `bag.storage.X` instead.
    get uiComponentStore() { return storage.uiComponentStore; },
    get providerTypeStore() { return storage.providerTypeStore; },
    get primitiveStore() { return storage.primitiveStore; },
    get providerStore() { return storage.providerStore; },
    get accountStore() { return storage.accountStore; },
    get capabilityTierStore() { return storage.capabilityTierStore; },
    get userLayoutStore() { return storage.userLayoutStore; },
    get canvasDefinitionStore() { return storage.canvasDefinitionStore; },
    get workspaceStore() { return storage.workspaceStore; },
    get documentStore() { return storage.documentStore; },
    get mediaStore() { return storage.mediaStore; },
    get automationStore() { return storage.automationStore; },
    get agentStore() { return storage.agentStore; },
    get hitlGateStore() { return storage.hitlGateStore; },
    get policyRuleStore() { return storage.policyRuleStore; },
    get annotationStore() { return storage.annotationStore; },
    get shellCommandStore() { return storage.shellCommandStore; },
    get notificationStore() { return storage.notificationStore; },
    get auditStore() { return storage.auditStore; },
    get rbacStore() { return storage.rbacStore; },
    get templateStore() { return storage.templateStore; },
    get presenceStore() { return storage.presenceStore; },
    get searchIndex() { return storage.searchIndex; },
    get onboardingStore() { return storage.onboardingStore; },
    get documentEditStore() { return storage.documentEditStore; },
    get zLayerStore() { return storage.zLayerStore; },
    get drawerStore() { return storage.drawerStore; },
  } as CanvasEngineBag;
  return _bag;
}

/** Idempotent seed flag — set after the first seedCanvasModel() run. */
export function isSeeded(): boolean {
  return _seeded;
}
export function markSeeded(): void {
  _seeded = true;
}

/** Test-only: reset the bag singleton so the next getEngineBag() creates a fresh bag. */
export function __resetEngineBagForTests(): void {
  _bag = null;
}

export function newTraceId(): string {
  return ulid();
}
