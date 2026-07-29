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

export function TemplatesGallery({ onCreated }: { onCreated?: (workspaceId: string) => void }) {
  const [templates, setTemplates] = useState<WorkspaceTemplate[]>([]);
  const [creating, setCreating] = useState<string | null>(null);
  const [created, setCreated] = useState<Record<string, string>>({}); // templateId  workspaceId

  useEffect(() => {
    fetch('/api/template/list')
      .then((r) => r.json())
      .then((data: { ok: boolean; templates: WorkspaceTemplate[] }) => {
        if (data.ok) setTemplates(data.templates);
      })
      .catch(() => {});
  }, []);

  const create = async (tpl: WorkspaceTemplate) => {
    setCreating(tpl.id);
    try {
      const res = await fetch('/api/template/instantiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: tpl.id, ownerId: 'user:demo' }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        workspaceId?: string;
        createdDocs?: number;
        createdMedia?: number;
      };
      if (data.ok && data.workspaceId) {
        setCreated((c) => ({ ...c, [tpl.id]: data.workspaceId! }));
        onCreated?.(data.workspaceId);
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
                  background: '#10b98122',
                  border: '1px solid #10b981',
                  borderRadius: 4,
                  fontSize: 11,
                  color: '#10b981',
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
