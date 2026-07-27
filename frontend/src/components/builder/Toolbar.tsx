'use client';

/**
 * components/builder/Toolbar.tsx
 * --------------------------------------------------------------------
 * Phase 6 — Visual Builder. Top toolbar with actions: add surface,
 * add capability, save as template, export as JSON, run.
 *
 * CONTRACT_VERSION: 1
 */

import { useState } from 'react';
import { Icon } from '@/components/canvas/Icon';

export interface ToolbarProps {
  onClose?: () => void;
  onAddSurface?: (surfaceId: string) => void;
  onAddCapability?: (capabilityId: string) => void;
  onDeleteSelected?: () => void;
  onSaveAsTemplate?: (name: string, description?: string) => void;
  onRun?: () => void;
  onExport?: () => void;
  saving?: boolean;
  status?: string | null;
  error?: string | null;
}

export function Toolbar({
  onClose,
  onAddSurface,
  onAddCapability,
  onDeleteSelected,
  onSaveAsTemplate,
  onRun,
  onExport,
  saving,
  status,
  error,
}: ToolbarProps) {
  const [surfaceInput, setSurfaceInput] = useState('');
  const [capInput, setCapInput] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        borderBottom: '1px solid var(--border-subtle, #334155)',
        background: 'var(--bg-elevated, #1e293b)',
        fontSize: 12,
        color: 'var(--text-primary, #e2e8f0)',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon name="git" size={14} style={{ color: 'var(--accent, #3b82f6)' }} />
        <strong style={{ fontSize: 13 }}>Visual Builder</strong>
      </div>

      <div style={{ width: 1, height: 20, background: 'var(--border-subtle, #334155)' }} />

      {/* Add surface */}
      <div style={{ display: 'flex', gap: 4 }}>
        <input
          type="text"
          value={surfaceInput}
          onChange={(e) => setSurfaceInput(e.target.value)}
          placeholder="surfaceId (e.g. panel:conversations)"
          style={{
            padding: '4px 8px',
            background: 'var(--bg-canvas, #0f172a)',
            border: '1px solid var(--border-subtle, #334155)',
            borderRadius: 4,
            color: 'var(--text-primary, #e2e8f0)',
            fontSize: 11,
            width: 220,
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={() => {
            if (surfaceInput.trim()) {
              onAddSurface?.(surfaceInput.trim());
              setSurfaceInput('');
            }
          }}
          style={btnStyle}
        >
          + Surface
        </button>
      </div>

      {/* Add capability */}
      <div style={{ display: 'flex', gap: 4 }}>
        <input
          type="text"
          value={capInput}
          onChange={(e) => setCapInput(e.target.value)}
          placeholder="capabilityId (e.g. cap:chat:send)"
          style={{
            padding: '4px 8px',
            background: 'var(--bg-canvas, #0f172a)',
            border: '1px solid var(--border-subtle, #334155)',
            borderRadius: 4,
            color: 'var(--text-primary, #e2e8f0)',
            fontSize: 11,
            width: 220,
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={() => {
            if (capInput.trim()) {
              onAddCapability?.(capInput.trim());
              setCapInput('');
            }
          }}
          style={btnStyle}
        >
          + Capability
        </button>
      </div>

      <div style={{ width: 1, height: 20, background: 'var(--border-subtle, #334155)' }} />

      {/* Delete selected */}
      {onDeleteSelected && (
        <button
          type="button"
          onClick={onDeleteSelected}
          style={{ ...btnStyle, color: '#ef4444' }}
          title="Delete selected node + its edges"
        >
          <Icon name="trash-2" size={12} /> Delete
        </button>
      )}

      {/* Run */}
      <button
        type="button"
        onClick={onRun}
        style={{ ...btnStyle, background: 'var(--accent, #3b82f6)', color: 'white', border: 'none' }}
        title="Apply all rebind edges as a mutation plan"
      >
        <Icon name="play" size={12} /> Run
      </button>

      {/* Save as template */}
      <button
        type="button"
        onClick={() => setShowSaveForm((v) => !v)}
        disabled={saving}
        style={btnStyle}
        title="Save the graph as a WorkspaceTemplate"
      >
        <Icon name="save" size={12} /> {saving ? 'Saving…' : 'Save as template'}
      </button>

      {/* Export JSON */}
      <button
        type="button"
        onClick={onExport}
        style={btnStyle}
        title="Download the graph as JSON"
      >
        <Icon name="download" size={12} /> Export
      </button>

      {/* Right side: close */}
      <div style={{ flex: 1 }} />
      {status && (
        <span style={{ fontSize: 11, color: '#22c55e' }}>{status}</span>
      )}
      {error && (
        <span style={{ fontSize: 11, color: '#ef4444' }}>{error}</span>
      )}
      <button
        type="button"
        onClick={onClose}
        style={{
          ...btnStyle,
          background: 'transparent',
          border: '1px solid var(--border-subtle, #334155)',
        }}
        title="Close the Visual Builder"
      >
        <Icon name="x" size={12} /> Close
      </button>

      {/* Save-as-template form (collapsible) */}
      {showSaveForm && (
        <div
          style={{
            flexBasis: '100%',
            display: 'flex',
            gap: 6,
            padding: '8px 0',
            borderTop: '1px solid var(--border-subtle, #334155)',
            marginTop: 6,
          }}
        >
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="Template name"
            style={{
              padding: '4px 8px',
              background: 'var(--bg-canvas, #0f172a)',
              border: '1px solid var(--border-subtle, #334155)',
              borderRadius: 4,
              color: 'var(--text-primary, #e2e8f0)',
              fontSize: 11,
              width: 200,
              outline: 'none',
            }}
          />
          <input
            type="text"
            value={templateDesc}
            onChange={(e) => setTemplateDesc(e.target.value)}
            placeholder="Description (optional)"
            style={{
              padding: '4px 8px',
              background: 'var(--bg-canvas, #0f172a)',
              border: '1px solid var(--border-subtle, #334155)',
              borderRadius: 4,
              color: 'var(--text-primary, #e2e8f0)',
              fontSize: 11,
              width: 280,
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={() => {
              if (templateName.trim()) {
                onSaveAsTemplate?.(templateName.trim(), templateDesc.trim() || undefined);
                setShowSaveForm(false);
                setTemplateName('');
                setTemplateDesc('');
              }
            }}
            disabled={!templateName.trim() || saving}
            style={{
              ...btnStyle,
              background: 'var(--accent, #3b82f6)',
              color: 'white',
              border: 'none',
              opacity: !templateName.trim() || saving ? 0.6 : 1,
            }}
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 10px',
  background: 'var(--bg-canvas, #0f172a)',
  border: '1px solid var(--border-subtle, #334155)',
  borderRadius: 4,
  color: 'var(--text-primary, #e2e8f0)',
  fontSize: 11,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
