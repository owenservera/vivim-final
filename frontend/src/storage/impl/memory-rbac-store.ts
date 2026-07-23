/**
 * storage/impl/memory-rbac-store.ts
 */

import type { WorkspaceMembership, PermissionCheck, Role } from '../../shared/rbac';
import { ROLE_SPECS } from '../../shared/rbac';
import type { RbacStore } from '../contracts/rbac-store';

export class MemoryRbacStore implements RbacStore {
  private rows = new Map<string, WorkspaceMembership>(); // key: `${workspaceId}|${userId}`

  private key(workspaceId: string, userId: string): string {
    return `${workspaceId}|${userId}`;
  }

  async getMembership(workspaceId: string, userId: string): Promise<WorkspaceMembership | null> {
    return this.rows.get(this.key(workspaceId, userId)) ?? null;
  }

  async listMembers(workspaceId: string): Promise<WorkspaceMembership[]> {
    const all = [...this.rows.values()];
    return all.filter((m) => m.workspaceId === workspaceId);
  }

  async grantRole(input: {
    workspaceId: string;
    userId: string;
    role: Role;
    grantedBy: string;
    capabilityOverrides?: Record<string, 'grant' | 'deny'>;
  }): Promise<WorkspaceMembership> {
    const now = Date.now();
    const id = `membership:${input.workspaceId}:${input.userId}:${now.toString(36)}`;
    const row: WorkspaceMembership = {
      id,
      workspaceId: input.workspaceId,
      userId: input.userId,
      role: input.role,
      capabilityOverrides: input.capabilityOverrides ?? {},
      grantedAt: now,
      grantedBy: input.grantedBy,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(this.key(input.workspaceId, input.userId), row);
    return row;
  }

  async updateRole(workspaceId: string, userId: string, role: Role): Promise<WorkspaceMembership> {
    const existing = this.rows.get(this.key(workspaceId, userId));
    if (!existing) throw new Error(`Membership not found: ${workspaceId}|${userId}`);
    existing.role = role;
    existing.updatedAt = Date.now();
    return existing;
  }

  async revokeMembership(workspaceId: string, userId: string): Promise<boolean> {
    return this.rows.delete(this.key(workspaceId, userId));
  }

  async check(workspaceId: string, userId: string, capabilityId: string): Promise<PermissionCheck> {
    const m = this.rows.get(this.key(workspaceId, userId));
    if (!m) {
      return {
        userId,
        workspaceId,
        capabilityId,
        allowed: false,
        reason: 'no-membership',
      };
    }
    // Check explicit overrides first.
    const override = m.capabilityOverrides[capabilityId];
    if (override === 'deny') {
      return { userId, workspaceId, capabilityId, allowed: false, reason: 'override-deny', role: m.role };
    }
    if (override === 'grant') {
      return { userId, workspaceId, capabilityId, allowed: true, reason: 'override-grant', role: m.role };
    }
    // Check role capabilities.
    const spec = ROLE_SPECS.find((r) => r.id === m.role);
    if (!spec) {
      return { userId, workspaceId, capabilityId, allowed: false, reason: 'denied', role: m.role };
    }
    if (spec.capabilities.includes('*') || spec.capabilities.includes(capabilityId)) {
      return { userId, workspaceId, capabilityId, allowed: true, reason: 'role', role: m.role };
    }
    return { userId, workspaceId, capabilityId, allowed: false, reason: 'denied', role: m.role };
  }
}
