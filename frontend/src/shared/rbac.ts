/**
 * shared/rbac.ts
 * --------------------------------------------------------------------
 * #9 RBAC Permissions Manager — role/permission types.
 * 4 roles: viewer | member | editor | admin.
 * Per-workspace + per-capability grants.
 */

export type Role = 'viewer' | 'member' | 'editor' | 'admin';

export interface RoleSpec {
  id: Role;
  label: string;
  description: string;
  /** Capabilities this role can invoke by default. '*' = all. */
  capabilities: string[];
  /** Whether the role can manage other members. */
  canManageMembers: boolean;
  /** Whether the role can publish/edit CanvasDefinitions. */
  canPublish: boolean;
  /** Whether the role can delete workspaces. */
  canDeleteWorkspace: boolean;
  color: string;
}

export const ROLE_SPECS: RoleSpec[] = [
  {
    id: 'viewer',
    label: 'Viewer',
    description: 'Read-only access. Can view cards, run automations, but not edit.',
    capabilities: ['cap:document:read', 'cap:media:play', 'cap:canvas:resolve', 'cap:canvas:shell-command'],
    canManageMembers: false,
    canPublish: false,
    canDeleteWorkspace: false,
    color: '#64748b',
  },
  {
    id: 'member',
    label: 'Member',
    description: 'Standard access. Can create docs/media, run automations + agents.',
    capabilities: [
      'cap:document:open', 'cap:document:read', 'cap:document:annotate',
      'cap:media:open', 'cap:media:play', 'cap:media:transcribe',
      'cap:automation:execute', 'cap:agent:invoke',
      'cap:canvas:resolve', 'cap:canvas:shell-command',
    ],
    canManageMembers: false,
    canPublish: false,
    canDeleteWorkspace: false,
    color: '#0ea5e9',
  },
  {
    id: 'editor',
    label: 'Editor',
    description: 'Can publish/edit CanvasDefinitions, create automations + agents.',
    capabilities: ['*'], // all member caps + publish
    canManageMembers: false,
    canPublish: true,
    canDeleteWorkspace: false,
    color: '#8b5cf6',
  },
  {
    id: 'admin',
    label: 'Admin',
    description: 'Full access. Can manage members, delete workspaces, edit policy.',
    capabilities: ['*'],
    canManageMembers: true,
    canPublish: true,
    canDeleteWorkspace: true,
    color: '#dc2626',
  },
];

export interface WorkspaceMembership {
  id: string;
  workspaceId: string;
  userId: string;
  role: Role;
  /** Per-capability overrides (grant or deny). */
  capabilityOverrides: Record<string, 'grant' | 'deny'>;
  grantedAt: number;
  grantedBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface PermissionCheck {
  userId: string;
  workspaceId: string;
  capabilityId: string;
  allowed: boolean;
  reason: 'role' | 'override-grant' | 'override-deny' | 'no-membership' | 'denied';
  role?: Role;
}
