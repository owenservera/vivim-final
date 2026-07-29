'use client';

/**
 * components/canvas/RbacManager.tsx (#9)
 * --------------------------------------------------------------------
 * RBAC Permissions Manager — role/permission surface.
 * 4 roles (viewer/member/editor/admin). Per-workspace membership list
 * with grant/update/revoke. Per-capability override grants/denies.
 *
 * Includes a capability-check tester.
 */

import { useEffect, useState } from 'react';
import type { WorkspaceMembership, Role, RoleSpec, PermissionCheck } from '../../shared/rbac';

export function RbacManager({ workspaceId }: { workspaceId: string }) {
  const [roles, setRoles] = useState<RoleSpec[]>([]);
  const [members, setMembers] = useState<WorkspaceMembership[]>([]);
  const [checkResult, setCheckResult] = useState<PermissionCheck | null>(null);
  const [checkUser, setCheckUser] = useState('user:demo');
  const [checkCap, setCheckCap] = useState('cap:canvas:shell-command');
  const [grantUserId, setGrantUserId] = useState('');
  const [grantRole, setGrantRole] = useState<Role>('member');

  const fetchRoles = async () => {
    const res = await fetch('/api/rbac/roles');
    const data = (await res.json()) as { ok: boolean; roles: RoleSpec[] };
    if (data.ok) setRoles(data.roles);
  };

  const fetchMembers = async () => {
    const res = await fetch(`/api/rbac/members?workspaceId=${encodeURIComponent(workspaceId)}`);
    const data = (await res.json()) as { ok: boolean; members: WorkspaceMembership[] };
    if (data.ok) setMembers(data.members);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRoles();
    fetchMembers();
  }, [workspaceId]);

  const grant = async () => {
    if (!grantUserId.trim()) return;
    await fetch('/api/rbac/grant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId, userId: grantUserId, role: grantRole, grantedBy: 'user:demo' }),
    });
    setGrantUserId('');
    fetchMembers();
  };

  const updateRole = async (userId: string, role: Role) => {
    await fetch('/api/rbac/update_role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId, userId, role }),
    });
    fetchMembers();
  };

  const revoke = async (userId: string) => {
    await fetch('/api/rbac/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId, userId }),
    });
    fetchMembers();
  };

  const check = async () => {
    const res = await fetch('/api/rbac/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId, userId: checkUser, capabilityId: checkCap }),
    });
    const data = (await res.json()) as { ok: boolean; check: PermissionCheck };
    if (data.ok) setCheckResult(data.check);
  };

  return (
    <div
      style={{
        padding: 16,
        fontFamily: 'ui-sans-serif, system-ui',
        color: 'var(--text)',
        background: 'var(--bg)',
        height: '100%',
        overflowY: 'auto',
      }}
    >
      <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>Permissions · RBAC</h2>

      {/* Roles reference */}
      <section style={{ marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-muted)' }}>Role reference</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {roles.map((r) => (
            <div
              key={r.id}
              style={{
                padding: 10,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                borderTop: `3px solid ${r.color}`,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: r.color }}>{r.label}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>{r.description}</div>
              <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {r.canPublish && <span style={pillStyle}>publish</span>}
                {r.canManageMembers && <span style={pillStyle}>manage</span>}
                {r.canDeleteWorkspace && <span style={pillStyle}>delete</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Grant */}
      <section style={{ marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-muted)' }}>Grant role</h3>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={grantUserId}
            onChange={(e) => setGrantUserId(e.target.value)}
            placeholder="user id (e.g. user:demo)"
            style={{ ...inputStyle, flex: 1 }}
          />
          <select value={grantRole} onChange={(e) => setGrantRole(e.target.value as Role)} style={selectStyle}>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          <button onClick={grant} style={btnPrimary}>
            Grant
          </button>
        </div>
      </section>

      {/* Members */}
      <section style={{ marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-muted)' }}>
          Members ({members.length})
        </h3>
        {members.length === 0 && (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-subtle)', fontSize: 12, background: 'var(--bg-elevated)', borderRadius: 8 }}>
            No members yet. Grant a role above.
          </div>
        )}
        {members.map((m) => {
          const role = roles.find((r) => r.id === m.role);
          return (
            <div
              key={m.id}
              style={{
                padding: '8px 10px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderLeft: `3px solid ${role?.color ?? '#9ca3af'}`,
                borderRadius: 4,
                marginBottom: 4,
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                fontSize: 12,
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, flex: 1 }}>{m.userId}</span>
              <select
                value={m.role}
                onChange={(e) => updateRole(m.userId, e.target.value as Role)}
                style={selectStyle}
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
              <button onClick={() => revoke(m.userId)} style={btnDanger}>
                Revoke
              </button>
            </div>
          );
        })}
      </section>

      {/* Capability checker */}
      <section>
        <h3 style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-muted)' }}>Capability checker</h3>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <input
            value={checkUser}
            onChange={(e) => setCheckUser(e.target.value)}
            placeholder="user id"
            style={{ ...inputStyle, flex: 1 }}
          />
          <input
            value={checkCap}
            onChange={(e) => setCheckCap(e.target.value)}
            placeholder="capability id"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={check} style={btnPrimary}>
            Check
          </button>
        </div>
        {checkResult && (
          <div
            style={{
              padding: 10,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderLeft: `3px solid ${checkResult.allowed ? '#10b981' : '#ef4444'}`,
              borderRadius: 4,
              fontSize: 12,
            }}
          >
            <strong style={{ color: checkResult.allowed ? '#10b981' : '#ef4444' }}>
              {checkResult.allowed ? ' ALLOWED' : ' DENIED'}
            </strong>
            <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>reason: {checkResult.reason}</span>
            {checkResult.role && (
              <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>role: {checkResult.role}</span>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  padding: '4px 12px',
  background: 'var(--accent)',
  color: 'var(--accent-fg)',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 600,
  fontFamily: 'inherit',
};
const btnDanger: React.CSSProperties = {
  padding: '4px 10px',
  background: 'transparent',
  color: '#ef4444',
  border: '1px solid #ef4444',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 10,
  fontFamily: 'inherit',
};
const inputStyle: React.CSSProperties = {
  padding: '4px 8px',
  border: '1px solid var(--border)',
  background: 'var(--bg-elevated)',
  color: 'var(--text)',
  borderRadius: 4,
  fontSize: 11,
  fontFamily: 'var(--font-mono)',
};
const selectStyle: React.CSSProperties = {
  ...inputStyle,
  fontFamily: 'inherit',
};
const pillStyle: React.CSSProperties = {
  padding: '1px 6px',
  background: 'var(--accent-subtle)',
  color: 'var(--accent)',
  borderRadius: 3,
  fontSize: 9,
  fontWeight: 600,
};
