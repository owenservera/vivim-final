/**
 * storage/provider/storage-provider.ts
 * --------------------------------------------------------------------
 * The canonical interface for acquiring storage in vivim-final.
 * Every consumer (canvas-engine-bootstrap, API routes, engines via deps)
 * goes through a StorageProvider instead of importing impl classes.
 */

import type { AccountStore } from '../contracts/account-store'
import type { CanvasDefinitionStore } from '../contracts/canvas-definition-store'
import type { CapabilityTierStore } from '../contracts/capability-tier-store'
import type { PrimitiveStore } from '../contracts/primitive-store'
import type { ProviderStore } from '../contracts/provider-store'
import type { ProviderTypeStore } from '../contracts/provider-type-store'
import type { UiComponentStore } from '../contracts/ui-component-store'
import type { UserLayoutStore } from '../contracts/user-layout-store'

import type { AgentStore, HitlGateStore, PolicyRuleStore } from '../contracts/agent-store'
import type { AnnotationStore } from '../contracts/annotation-store'
import type { AutomationStore } from '../contracts/automation-store'
import type { DocumentStore } from '../contracts/document-store'
import type { MediaStore } from '../contracts/media-store'
import type { ShellCommandStore } from '../contracts/shell-command-store'
import type { WorkspaceStore } from '../contracts/workspace-store'

import type { AuditStore } from '../contracts/audit-store'
import type { NotificationStore } from '../contracts/notification-store'
import type { OnboardingStore } from '../contracts/onboarding-store'
import type { PresenceStore } from '../contracts/presence-store'
import type { RbacStore } from '../contracts/rbac-store'
import type { SearchIndex } from '../contracts/search-index'
import type { WorkspaceTemplateStore } from '../contracts/template-store'

import type { DocumentEditStore } from '../contracts/document-edit-store'
import type { DrawerStore } from '../contracts/drawer-store'
import type { ZLayerStore } from '../contracts/z-layer-store'

export interface StorageProvider {
  /** Identifies the impl — used by /api/storage/health. */
  readonly name: 'memory' | 'prisma' | 'test'

  // Phase 1 — core canvas (8 stores)
  readonly uiComponentStore: UiComponentStore
  readonly providerTypeStore: ProviderTypeStore
  readonly primitiveStore: PrimitiveStore
  readonly providerStore: ProviderStore
  readonly accountStore: AccountStore
  readonly capabilityTierStore: CapabilityTierStore
  readonly userLayoutStore: UserLayoutStore
  readonly canvasDefinitionStore: CanvasDefinitionStore

  // Phase 2 — workspace OS (9 stores)
  readonly workspaceStore: WorkspaceStore
  readonly documentStore: DocumentStore
  readonly mediaStore: MediaStore
  readonly automationStore: AutomationStore
  readonly agentStore: AgentStore
  readonly hitlGateStore: HitlGateStore
  readonly policyRuleStore: PolicyRuleStore
  readonly annotationStore: AnnotationStore
  readonly shellCommandStore: ShellCommandStore

  // Phase 3 — UX enhancement (7 stores)
  readonly notificationStore: NotificationStore
  readonly auditStore: AuditStore
  readonly rbacStore: RbacStore
  readonly templateStore: WorkspaceTemplateStore
  readonly presenceStore: PresenceStore
  readonly searchIndex: SearchIndex
  readonly onboardingStore: OnboardingStore

  // Phase 4 — doc suite (3 stores)
  readonly documentEditStore: DocumentEditStore
  readonly zLayerStore: ZLayerStore
  readonly drawerStore: DrawerStore
}
