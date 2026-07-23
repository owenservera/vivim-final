/**
 * storage/contracts/rbac-store.ts
 * --------------------------------------------------------------------
 * #9 RBAC Permissions Manager — store contract.
 */

import type { WorkspaceMembership, PermissionCheck, Role } from '../../shared/rbac';

export interface RbacStore {
  /** Get a user's membership in a workspace. */
  getMembership(workspaceId: string, userId: string): Promise<WorkspaceMembership | null>;
  /** List all members of a workspace. */
  listMembers(workspaceId: string): Promise<WorkspaceMembership[]>;
  /** Grant a role to a user in a workspace. */
  grantRole(input: {
    workspaceId: string;
    userId: string;
    role: Role;
    grantedBy: string;
    capabilityOverrides?: Record<string, 'grant' | 'deny'>;
  }): Promise<WorkspaceMembership>;
  /** Update a user's role. */
  updateRole(workspaceId: string, userId: string, role: Role): Promise<WorkspaceMembership>;
  /** Remove a user from a workspace. */
  revokeMembership(workspaceId: string, userId: string): Promise<boolean>;
  /** Check if a user can invoke a capability in a workspace. */
  check(workspaceId: string, userId: string, capabilityId: string): Promise<PermissionCheck>;
}
