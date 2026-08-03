/**
 * storage/provider/memory-storage-provider.ts
 * --------------------------------------------------------------------
 * The default StorageProvider impl. Wraps the 24 existing MemoryXStore
 * classes without changing their behavior. Nothing in production calls
 * this directly — getStorageProvider() returns it when
 * VIVIM_STORAGE_PROVIDER=memory (or unset).
 */

import type { StorageProvider } from './storage-provider';
import {
  MemoryUiComponentStore,
  MemoryProviderTypeStore,
  MemoryPrimitiveStore,
  MemoryProviderStore,
  MemoryAccountStore,
  MemoryCapabilityTierStore,
  MemoryUserLayoutStore,
  MemoryCanvasDefinitionStore,
  MemoryWorkspaceStore,
  MemoryDocumentStore,
  MemoryMediaStore,
  MemoryAutomationStore,
  MemoryAgentStore,
  MemoryHitlGateStore,
  MemoryPolicyRuleStore,
  MemoryAnnotationStore,
  MemoryShellCommandStore,
  MemoryNotificationStore,
  MemoryAuditStore,
  MemoryRbacStore,
  MemoryWorkspaceTemplateStore,
  MemoryPresenceStore,
  MemorySearchIndex,
  MemoryOnboardingStore,
  MemoryDocumentEditStore,
  MemoryZLayerStore,
  MemoryDrawerStore,
} from '../impl';

export class MemoryStorageProvider implements StorageProvider {
  readonly name = 'memory' as const;

  // Phase 1 — core canvas
  readonly uiComponentStore = new MemoryUiComponentStore();
  readonly providerTypeStore = new MemoryProviderTypeStore();
  readonly primitiveStore = new MemoryPrimitiveStore();
  readonly providerStore = new MemoryProviderStore();
  readonly accountStore = new MemoryAccountStore();
  readonly capabilityTierStore = new MemoryCapabilityTierStore();
  readonly userLayoutStore = new MemoryUserLayoutStore();
  readonly canvasDefinitionStore = new MemoryCanvasDefinitionStore();

  // Phase 2 — workspace OS
  readonly workspaceStore = new MemoryWorkspaceStore();
  readonly documentStore = new MemoryDocumentStore();
  readonly mediaStore = new MemoryMediaStore();
  readonly automationStore = new MemoryAutomationStore();
  readonly agentStore = new MemoryAgentStore();
  readonly hitlGateStore = new MemoryHitlGateStore();
  readonly policyRuleStore = new MemoryPolicyRuleStore();
  readonly annotationStore = new MemoryAnnotationStore();
  readonly shellCommandStore = new MemoryShellCommandStore();

  // Phase 3 — UX enhancement
  readonly notificationStore = new MemoryNotificationStore();
  readonly auditStore = new MemoryAuditStore();
  readonly rbacStore = new MemoryRbacStore();
  readonly templateStore = new MemoryWorkspaceTemplateStore();
  readonly presenceStore = new MemoryPresenceStore();
  readonly searchIndex = new MemorySearchIndex();
  readonly onboardingStore = new MemoryOnboardingStore();

  // Phase 4 — doc suite
  // NOTE: MemoryDocumentEditStore takes a documentStore argument.
  // Field initializers run in declaration order, so `this.documentStore`
  // IS available here because it's declared above (Phase 2).
  readonly documentEditStore = new MemoryDocumentEditStore(this.documentStore);
  readonly zLayerStore = new MemoryZLayerStore();
  readonly drawerStore = new MemoryDrawerStore();
}
