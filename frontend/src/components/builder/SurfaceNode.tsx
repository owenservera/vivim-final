'use client';

/**
 * components/builder/SurfaceNode.tsx
 * --------------------------------------------------------------------
 * Phase 6 — Visual Builder. A node representing a ReprogrammableSurface.
 * Shows spec summary + variant dropdown + input/output ports.
 *
 * CONTRACT_VERSION: 1
 */

import { useEffect, useState } from 'react';
import { Icon } from '@/components/canvas/Icon';
import { useIO } from '@/sdk/web';

export interface Port {
  id: string;
  label: string;
  direction: 'in' | 'out';
}

export interface SurfaceNodeData {
  type: 'surface';
  id: string;
  surfaceId: string;
  label: string;
  x: number;
  y: number;
  ports: Port[];
}

export interface SurfaceNodeProps {
  node: SurfaceNodeData;
  selected?: boolean;
  onMouseDown?: (e: React.MouseEvent) => void;
  onPortMouseDown?: (nodeId: string, portId: string, e: React.MouseEvent) => void;
}

export function SurfaceNode({
  node,
  selected,
  onMouseDown,
  onPortMouseDown,
}: SurfaceNodeProps) {
  const io = useIO();
  const [variantLabel, setVariantLabel] = useState<string>('default');

  // Best-effort: fetch the active variant name.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await io.get<{
          ok: boolean;
          active?: { name: string } | null;
        }>('/api/variant/_active', { query: { surfaceId: node.surfaceId } });
        if (cancelled) return;
        if (res.data?.ok && res.data.active?.name) {
          setVariantLabel(res.data.active.name);
        }
      } catch {
        // Best-effort.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [io, node.surfaceId]);

  return (
    <div
      style={{
        position: 'absolute',
        left: node.x,
        top: node.y,
        width: 200,
        background: 'var(--bg-elevated, #1e293b)',
        border: `1px solid ${selected ? 'var(--accent, #3b82f6)' : 'var(--border-subtle, #334155)'}`,
        borderRadius: 8,
        boxShadow: selected
          ? '0 0 0 3px rgba(59,130,246,0.3)'
          : '0 4px 12px rgba(0,0,0,0.3)',
        userSelect: 'none',
        cursor: 'move',
        fontSize: 12,
        color: 'var(--text-primary, #e2e8f0)',
      }}
      onMouseDown={onMouseDown}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 10px',
          borderBottom: '1px solid var(--border-subtle, #334155)',
        }}
      >
        <Icon name="layers" size={12} style={{ color: 'var(--accent, #3b82f6)' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 12,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {node.label}
          </div>
          <div
            style={{
              fontSize: 10,
              color: 'var(--text-muted, #94a3b8)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            <code>{node.surfaceId}</code>
          </div>
        </div>
        <span
          title="Active variant"
          style={{
            fontSize: 9,
            padding: '1px 6px',
            background: 'rgba(59,130,246,0.15)',
            color: 'var(--accent, #3b82f6)',
            borderRadius: 3,
            fontWeight: 500,
          }}
        >
          {variantLabel}
        </span>
      </div>

      {/* Ports */}
      <div style={{ padding: '6px 0' }}>
        {node.ports.map((port) => (
          <div
            key={port.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '4px 10px',
              gap: 8,
              fontSize: 11,
              position: 'relative',
            }}
          >
            {port.direction === 'in' ? (
              <span
                data-port-id={port.id}
                data-node-id={node.id}
                onMouseDown={(e) => onPortMouseDown?.(node.id, port.id, e)}
                style={{
                  position: 'absolute',
                  left: -5,
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: 'var(--accent, #3b82f6)',
                  border: '2px solid var(--bg-elevated, #1e293b)',
                  cursor: 'crosshair',
                }}
                title={`${port.label} (input)`}
              />
            ) : null}
            <span
              style={{
                flex: 1,
                color: 'var(--text-muted, #94a3b8)',
                textAlign: port.direction === 'in' ? 'left' : 'right',
              }}
            >
              {port.label}
            </span>
            {port.direction === 'out' ? (
              <span
                data-port-id={port.id}
                data-node-id={node.id}
                onMouseDown={(e) => onPortMouseDown?.(node.id, port.id, e)}
                style={{
                  position: 'absolute',
                  right: -5,
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: '#22c55e',
                  border: '2px solid var(--bg-elevated, #1e293b)',
                  cursor: 'crosshair',
                }}
                title={`${port.label} (output)`}
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
