'use client';

/**
 * components/canvas/TemplatesGallery.tsx (#10)
 * --------------------------------------------------------------------
 * Workspace Templates Gallery — pre-configured team setups.
 * 6 templates: Research Team, Content Studio, DevOps Pipeline,
 * Customer Support, Personal Workspace, Knowledge Base.
 *
 * One-click "Create" instantiates a workspace + seeds sample docs/media.
 */

import { useEffect, useState } from 'react';
import type { WorkspaceTemplate } from '../../shared/template';
import { SectionLabel } from './SectionLabel';
import { useIO } from './UnifiedIOProvider';

export function TemplatesGallery({ onCreated }: { onCreated?: (workspaceId: string) => void }) {
  const [templates, setTemplates] = useState<WorkspaceTemplate[]>([]);
  const [creating, setCreating] = useState<string | null>(null);
  const [created, setCreated] = useState<Record<string, string>>({}); // templateId  workspaceId
  const io = useIO();

  useEffect(() => {
    io.get<{ ok: boolean; templates: WorkspaceTemplate[] }>('/api/template/list')
      .then((res) => {
        if (res.data?.ok) setTemplates(res.data.templates);
      })
      .catch(() => {});
  }, [io]);

  const create = async (tpl: WorkspaceTemplate) => {
    setCreating(tpl.id);
    try {
      const res = await io.post<{
        ok: boolean;
        workspaceId?: string;
        createdDocs?: number;
        createdMedia?: number;
      }>('/api/template/instantiate', { templateId: tpl.id, ownerId: 'user:demo' });
      if (res.data?.ok && res.data.workspaceId) {
        setCreated((c) => ({ ...c, [tpl.id]: res.data!.workspaceId! }));
        onCreated?.(res.data.workspaceId);
      }
    } finally {
      setCreating(null);
    }
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
      <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>Workspace Templates</h2>
      <p style={{ margin: '0 0 16px', fontSize: 12, color: 'var(--text-muted)' }}>
        One-click pre-configured setups. Each creates a workspace + seeds sample docs/media.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {templates.map((tpl) => (
          <div
            key={tpl.id}
            style={{
              padding: 14,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 24 }}>{tpl.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{tpl.name}</div>
                <SectionLabel style={{ fontSize: 9 }}>
                  {tpl.category}
                  {tpl.featured && ' · ⭐ featured'}
                </SectionLabel>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>{tpl.description}</p>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {tpl.surfaces.map((s) => (
                <span key={s} style={pillStyle}>{s}</span>
              ))}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-subtle)' }}>
              {tpl.automationSlugs.length} automations · {tpl.agentSlugs.length} agents · {tpl.sampleDocs.length} sample docs
            </div>
            {created[tpl.id] ? (
              <div
                style={{
                  padding: '6px 10px',
                  background: 'var(--color-success-surface)',
                  border: '1px solid var(--color-success)',
                  borderRadius: 4,
                  fontSize: 11,
                  color: 'var(--color-success)',
                  textAlign: 'center',
                }}
              >
                 Created  <code style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>{created[tpl.id].slice(0, 24)}</code>
              </div>
            ) : (
              <button
                onClick={() => create(tpl)}
                disabled={creating === tpl.id}
                style={{
                  padding: '6px 12px',
                  background: 'var(--accent)',
                  color: 'var(--accent-fg)',
                  border: 'none',
                  borderRadius: 6,
                  cursor: creating === tpl.id ? 'wait' : 'pointer',
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  opacity: creating === tpl.id ? 0.6 : 1,
                }}
              >
                {creating === tpl.id ? 'Creating…' : `Create from template `}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const pillStyle: React.CSSProperties = {
  padding: '1px 6px',
  background: 'var(--accent-subtle)',
  color: 'var(--accent)',
  borderRadius: 3,
  fontSize: 9,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};
