/**
 * engines/rbac-engine.ts
 * --------------------------------------------------------------------
 * #9 RBAC Permissions Manager — engine.
 * Wraps the RbacStore; exposes grant/check/list capabilities.
 */

import type { CapabilityEventBus } from './capability-event-bus';
import type { StructuredLogger } from './structured-logger';
import type { WorkspaceMembership, PermissionCheck, Role } from '../shared/rbac';
import { ROLE_SPECS } from '../shared/rbac';
import type { RbacStore } from '../storage/contracts/rbac-store';

export interface RbacEngineDeps {
  rbacStore: RbacStore;
  eventBus: CapabilityEventBus;
  logger: StructuredLogger;
}

export class RbacEngine {
  constructor(private deps: RbacEngineDeps) {}

  /** List the 4 role specs. */
  listRoles() {
    return ROLE_SPECS;
  }

  async listMembers(workspaceId: string): Promise<WorkspaceMembership[]> {
    return this.deps.rbacStore.listMembers(workspaceId);
  }

  async grantRole(input: {
    workspaceId: string;
    userId: string;
    role: Role;
    grantedBy: string;
    capabilityOverrides?: Record<string, 'grant' | 'deny'>;
  }): Promise<WorkspaceMembership> {
    const m = await this.deps.rbacStore.grantRole(input);
    this.deps.eventBus.emit({
      type: 'rbac:role_granted',
      workspaceId: input.workspaceId,
      userId: input.userId,
      role: input.role,
      grantedBy: input.grantedBy,
    });
    return m;
  }

  async updateRole(workspaceId: string, userId: string, role: Role): Promise<WorkspaceMembership> {
    const m = await this.deps.rbacStore.updateRole(workspaceId, userId, role);
    this.deps.eventBus.emit({
      type: 'rbac:role_updated',
      workspaceId,
      userId,
      role,
    });
    return m;
  }

  async revokeMembership(workspaceId: string, userId: string): Promise<boolean> {
    const ok = await this.deps.rbacStore.revokeMembership(workspaceId, userId);
    if (ok) {
      this.deps.eventBus.emit({ type: 'rbac:membership_revoked', workspaceId, userId });
    }
    return ok;
  }

  async check(workspaceId: string, userId: string, capabilityId: string): Promise<PermissionCheck> {
    return this.deps.rbacStore.check(workspaceId, userId, capabilityId);
  }

  async dispatch(capabilityId: string, input: Record<string, unknown>): Promise<unknown> {
    switch (capabilityId) {
      case 'cap:rbac:list_roles':
        return this.listRoles();
      case 'cap:rbac:list_members':
        return this.listMembers(String(input.workspaceId));
      case 'cap:rbac:grant':
        return this.grantRole({
          workspaceId: String(input.workspaceId),
          userId: String(input.userId),
          role: input.role as Role,
          grantedBy: String(input.grantedBy ?? 'user:demo'),
          capabilityOverrides: input.capabilityOverrides as Record<string, 'grant' | 'deny'> | undefined,
        });
      case 'cap:rbac:update_role':
        return this.updateRole(String(input.workspaceId), String(input.userId), input.role as Role);
      case 'cap:rbac:revoke':
        return this.revokeMembership(String(input.workspaceId), String(input.userId));
      case 'cap:rbac:check':
        return this.check(String(input.workspaceId), String(input.userId), String(input.capabilityId));
      default:
        throw new Error(`rbac-engine: unknown capability ${capabilityId}`);
    }
  }

  static capabilities(): string[] {
    return ['cap:rbac:list_roles', 'cap:rbac:list_members', 'cap:rbac:grant', 'cap:rbac:update_role', 'cap:rbac:revoke', 'cap:rbac:check'];
  }
}
