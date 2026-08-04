/**
 * storage/impl/index.ts — barrel for in-memory impls.
 * Engines MUST NOT import this directly (B2 invariant).
 *
 * Phase 2 adds: workspace, document, media, automation, agent,
 * hitl-gate, policy-rule, shell-command stores.
 */
export { MemoryUiComponentStore } from './memory-ui-component-store';
export { MemoryProviderTypeStore } from './memory-provider-type-store';
export { MemoryPrimitiveStore } from './memory-primitive-store';
export { MemoryProviderStore } from './memory-provider-store';
export { MemoryAccountStore } from './memory-account-store';
export { MemoryCapabilityTierStore } from './memory-capability-tier-store';
export { MemoryUserLayoutStore } from './memory-user-layout-store';
export { MemoryCanvasDefinitionStore } from './memory-canvas-definition-store';

// Phase 2
export { MemoryWorkspaceStore } from './memory-workspace-store';
export { MemoryDocumentStore } from './memory-document-store';
export { MemoryMediaStore } from './memory-media-store';
export { MemoryAutomationStore } from './memory-automation-store';
export { MemoryAgentStore, MemoryHitlGateStore, MemoryPolicyRuleStore } from './memory-agent-store';
export { MemoryAnnotationStore } from './memory-annotation-store';
export { MemoryShellCommandStore } from './memory-shell-command-store';

// Phase 3 — UX enhancements
export { MemoryNotificationStore } from './memory-notification-store';
export { MemoryAuditStore } from './memory-audit-store';
export { MemoryRbacStore } from './memory-rbac-store';
export { MemoryWorkspaceTemplateStore } from './memory-template-store';
export { MemoryPresenceStore } from './memory-presence-store';
export { MemorySearchIndex } from './memory-search-index';
export { MemoryOnboardingStore } from './memory-onboarding-store';
export { PrismaOnboardingStore } from './prisma-onboarding-store';

// Phase 4 — doc suite, z-layers, drawers
export { MemoryDocumentEditStore } from './memory-document-edit-store';
export { MemoryZLayerStore } from './memory-z-layer-store';
export { MemoryDrawerStore } from './memory-drawer-store';
