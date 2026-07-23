/**
 * storage/contracts/index.ts — barrel.
 * Phase 2 adds: workspace, document, media, automation, agent,
 * hitl-gate, policy-rule, shell-command stores.
 */
export * from './ui-component-store';
export * from './provider-type-store';
export * from './primitive-store';
export * from './provider-store';
export * from './account-store';
export * from './capability-tier-store';
export * from './user-layout-store';
export * from './canvas-definition-store';

// Phase 2
export * from './workspace-store';
export * from './document-store';
export * from './media-store';
export * from './automation-store';
export * from './agent-store';
export * from './shell-command-store';

// Phase 3 — UX enhancements
export * from './notification-store';
export * from './audit-store';
export * from './rbac-store';
export * from './template-store';
export * from './presence-store';
export * from './search-index';
export * from './onboarding-store';

// Phase 4 — doc suite, z-layers, drawers
export * from './document-edit-store';
export * from './z-layer-store';
export * from './drawer-store';
