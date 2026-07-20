'use client';

/**
 * components/canvas/AgentOverlay.tsx (V6 #2)
 * --------------------------------------------------------------------
 * Agent Canvas Co-Pilot — ghost overlay for proposed node changes.
 *
 * When the agent proposes ops (spawn/wire/arrange), they appear as
 * ghosted overlays. User accepts/rejects per-node (HITL gate).
 *
 * Ghost nodes are semi-transparent with a dashed border. Accepted ops
 * become real nodes; rejected ops disappear.
 */

import { useState, useEffect } from 'react';
import type { AgentCanvasPlan, AgentCanvasOp } from '../../shared/agent-canvas';

export interface AgentOverlayProps {
  plan: AgentCanvasPlan | null;
  viewport: { x: number; y: number; zoom: number };
  width: number;
  height: number;
  onAccept: (opId: string) => void;
  onReject: (opId: string) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
}

export function AgentOverlay({
  plan,
  viewport,
  width,
  height,
  onAccept,
  onReject,
  onAcceptAll,
  onRejectAll,
}: AgentOverlayProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (plan) setVisible(true);
  }, [plan]);

  if (!plan || !visible) return null;

  const pendingOps = plan.ops.filter((op) => op.status === 'pending');
  if (pendingOps.length === 0) return null;

  return (
    <>
      {/* Ghost nodes */}
      <svg
        width={width}
        height={height}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 800 }}
      >
        <g
          transform={`translate(${width / 2}, ${height / 2}) scale(${viewport.zoom}) translate(${-viewport.x}, ${-viewport.y})`}
        >
          {pendingOps
            .filter((op) => op.action === 'spawn_node' && op.nodeSpec?.layout)
            .map((op) => {
              const layout = op.nodeSpec!.layout!;
              return (
                <g key={op.id}>
                  <rect
                    x={layout.x}
                    y={layout.y}
                    width={layout.w}
                    height={layout.h}
                    fill="var(--accent-subtle)"
                    stroke="var(--accent)"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    rx={8}
                    opacity={0.8}
                  />
                  <text
                    x={layout.x + layout.w / 2}
                    y={layout.y + 20}
                    fill="var(--accent)"
                    fontSize={12}
                    fontFamily="ui-sans-serif, system-ui"
                    textAnchor="middle"
                    fontWeight={600}
                  >
                    + {op.nodeSpec!.title}
                  </text>
                  <text
                    x={layout.x + layout.w / 2}
                    y={layout.y + 36}
                    fill="var(--text-muted)"
                    fontSize={10}
                    fontFamily="ui-sans-serif, system-ui"
                    textAnchor="middle"
                  >
                    {op.nodeSpec!.category} · {op.nodeSpec!.slotId}
                  </text>
                </g>
              );
            })}
          {/* Ghost connections */}
          {pendingOps
            .filter((op) => op.action === 'wire')
            .map((op) => (
              <g key={op.id}>
                <line
                  x1={0}
                  y1={0}
                  x2={100}
                  y2={100}
                  stroke="var(--accent)"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  opacity={0.6}
                />
              </g>
            ))}
        </g>
      </svg>

      {/* HITL accept/reject bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--accent)',
          borderRadius: 10,
          boxShadow: 'var(--shadow)',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          zIndex: 900,
          fontFamily: 'ui-sans-serif, system-ui',
          color: 'var(--text)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 16 }}>🤖</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>Agent proposes {pendingOps.length} changes</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              "{plan.prompt}"
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={onAcceptAll}
            style={{
              padding: '4px 12px',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >
            ✓ Accept all
          </button>
          <button
            onClick={onRejectAll}
            style={{
              padding: '4px 12px',
              background: 'transparent',
              color: '#ef4444',
              border: '1px solid #ef4444',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >
            ✕ Reject all
          </button>
          <button
            onClick={() => setVisible(false)}
            style={{
              padding: '4px 8px',
              background: 'transparent',
              color: 'var(--text-muted)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 11,
              fontFamily: 'inherit',
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </>
  );
}
