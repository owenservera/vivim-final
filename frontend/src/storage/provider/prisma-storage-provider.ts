/**
 * storage/provider/prisma-storage-provider.ts
 * --------------------------------------------------------------------
 * Prisma-backed StorageProvider.
 *
 * STATUS: 0/24 stores migrated (Task 09 brings it to 1/24).
 * See ROADMAP.md for the migration plan.
 */

import { PrismaOnboardingStore } from '../impl/prisma-onboarding-store'
import { NotImplementedErrorProxy } from './not-implemented-proxy'
import type { StorageProvider } from './storage-provider'

import type { AccountStore } from '../contracts/account-store'
import type { AgentStore, HitlGateStore, PolicyRuleStore } from '../contracts/agent-store'
import type { AnnotationStore } from '../contracts/annotation-store'
import type { AuditStore } from '../contracts/audit-store'
import type { AutomationStore } from '../contracts/automation-store'
import type { CanvasDefinitionStore } from '../contracts/canvas-definition-store'
import type { CapabilityTierStore } from '../contracts/capability-tier-store'
import type { DocumentEditStore } from '../contracts/document-edit-store'
import type { DocumentStore } from '../contracts/document-store'
import type { DrawerStore } from '../contracts/drawer-store'
import type { MediaStore } from '../contracts/media-store'
import type { NotificationStore } from '../contracts/notification-store'
import type { OnboardingStore } from '../contracts/onboarding-store'
import type { PresenceStore } from '../contracts/presence-store'
import type { PrimitiveStore } from '../contracts/primitive-store'
import type { ProviderStore } from '../contracts/provider-store'
import type { ProviderTypeStore } from '../contracts/provider-type-store'
import type { RbacStore } from '../contracts/rbac-store'
import type { SearchIndex } from '../contracts/search-index'
import type { ShellCommandStore } from '../contracts/shell-command-store'
import type { WorkspaceTemplateStore } from '../contracts/template-store'
import type { UiComponentStore } from '../contracts/ui-component-store'
import type { UserLayoutStore } from '../contracts/user-layout-store'
import type { WorkspaceStore } from '../contracts/workspace-store'
import type { ZLayerStore } from '../contracts/z-layer-store'

/**
 * Lazy singleton for the Prisma client used by PrismaOnboardingStore.
 * Avoids importing @prisma/client at module load (which fails in test/nodeless envs).
 */
let _prismaClient: { userOnboarding: unknown } | null = null

function getPrismaClient(): { userOnboarding: unknown } {
  if (!_prismaClient) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@prisma/client') as Record<string, unknown>
    const Ctor = mod.PrismaClient as new () => { userOnboarding: unknown }
    _prismaClient = new Ctor()
  }
  return _prismaClient
}

export class PrismaStorageProvider implements StorageProvider {
  readonly name = 'prisma' as const

  // Phase 1 — all stubs
  readonly uiComponentStore: UiComponentStore = NotImplementedErrorProxy.create<UiComponentStore>(
    'uiComponentStore',
    'PrismaUiComponentStore',
  )
  readonly providerTypeStore: ProviderTypeStore =
    NotImplementedErrorProxy.create<ProviderTypeStore>(
      'providerTypeStore',
      'PrismaProviderTypeStore',
    )
  readonly primitiveStore: PrimitiveStore = NotImplementedErrorProxy.create<PrimitiveStore>(
    'primitiveStore',
    'PrismaPrimitiveStore',
  )
  readonly providerStore: ProviderStore = NotImplementedErrorProxy.create<ProviderStore>(
    'providerStore',
    'PrismaProviderStore',
  )
  readonly accountStore: AccountStore = NotImplementedErrorProxy.create<AccountStore>(
    'accountStore',
    'PrismaAccountStore',
  )
  readonly capabilityTierStore: CapabilityTierStore =
    NotImplementedErrorProxy.create<CapabilityTierStore>(
      'capabilityTierStore',
      'PrismaCapabilityTierStore',
    )
  readonly userLayoutStore: UserLayoutStore = NotImplementedErrorProxy.create<UserLayoutStore>(
    'userLayoutStore',
    'PrismaUserLayoutStore',
  )
  readonly canvasDefinitionStore: CanvasDefinitionStore =
    NotImplementedErrorProxy.create<CanvasDefinitionStore>(
      'canvasDefinitionStore',
      'PrismaCanvasDefinitionStore',
    )

  // Phase 2 — all stubs
  readonly workspaceStore: WorkspaceStore = NotImplementedErrorProxy.create<WorkspaceStore>(
    'workspaceStore',
    'PrismaWorkspaceStore',
  )
  readonly documentStore: DocumentStore = NotImplementedErrorProxy.create<DocumentStore>(
    'documentStore',
    'PrismaDocumentStore',
  )
  readonly mediaStore: MediaStore = NotImplementedErrorProxy.create<MediaStore>(
    'mediaStore',
    'PrismaMediaStore',
  )
  readonly automationStore: AutomationStore = NotImplementedErrorProxy.create<AutomationStore>(
    'automationStore',
    'PrismaAutomationStore',
  )
  readonly agentStore: AgentStore = NotImplementedErrorProxy.create<AgentStore>(
    'agentStore',
    'PrismaAgentStore',
  )
  readonly hitlGateStore: HitlGateStore = NotImplementedErrorProxy.create<HitlGateStore>(
    'hitlGateStore',
    'PrismaHitlGateStore',
  )
  readonly policyRuleStore: PolicyRuleStore = NotImplementedErrorProxy.create<PolicyRuleStore>(
    'policyRuleStore',
    'PrismaPolicyRuleStore',
  )
  readonly annotationStore: AnnotationStore = NotImplementedErrorProxy.create<AnnotationStore>(
    'annotationStore',
    'PrismaAnnotationStore',
  )
  readonly shellCommandStore: ShellCommandStore =
    NotImplementedErrorProxy.create<ShellCommandStore>(
      'shellCommandStore',
      'PrismaShellCommandStore',
    )

  // Phase 3 — onboardingStore filled in Task 09; rest are stubs
  readonly notificationStore: NotificationStore =
    NotImplementedErrorProxy.create<NotificationStore>(
      'notificationStore',
      'PrismaNotificationStore',
    )
  readonly auditStore: AuditStore = NotImplementedErrorProxy.create<AuditStore>(
    'auditStore',
    'PrismaAuditStore',
  )
  readonly rbacStore: RbacStore = NotImplementedErrorProxy.create<RbacStore>(
    'rbacStore',
    'PrismaRbacStore',
  )
  readonly templateStore: WorkspaceTemplateStore =
    NotImplementedErrorProxy.create<WorkspaceTemplateStore>(
      'templateStore',
      'PrismaWorkspaceTemplateStore',
    )
  readonly presenceStore: PresenceStore = NotImplementedErrorProxy.create<PresenceStore>(
    'presenceStore',
    'PrismaPresenceStore',
  )
  readonly searchIndex: SearchIndex = NotImplementedErrorProxy.create<SearchIndex>(
    'searchIndex',
    'PrismaSearchIndex',
  )
  readonly onboardingStore: OnboardingStore = new PrismaOnboardingStore(getPrismaClient() as never)

  // Phase 4 — all stubs
  readonly documentEditStore: DocumentEditStore =
    NotImplementedErrorProxy.create<DocumentEditStore>(
      'documentEditStore',
      'PrismaDocumentEditStore',
    )
  readonly zLayerStore: ZLayerStore = NotImplementedErrorProxy.create<ZLayerStore>(
    'zLayerStore',
    'PrismaZLayerStore',
  )
  readonly drawerStore: DrawerStore = NotImplementedErrorProxy.create<DrawerStore>(
    'drawerStore',
    'PrismaDrawerStore',
  )
}
