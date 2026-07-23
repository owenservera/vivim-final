'use client';

/**
 * components/canvas/CanvasNode.tsx
 * --------------------------------------------------------------------
 * A single node on the canvas. Draggable + resizable via pointer events
 * (no React Flow dependency — the shell is pure HTML).
 *
 * Each node renders a SandboxedNode iframe whose html/css/scriptUrl
 * come from the resolved CanvasDefinition row. The shell is dumb: it
 * doesn't know what's inside the iframe.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { SandboxedNode, type SandboxAuditEvent } from './SandboxedNode';
import type { CanvasLayout } from '../../shared/canvas-types';
import type { ResolvedSlot } from '../../shared/route-context';
import { buildSandboxPolicy } from '../../shared/canvas-types';

export interface CanvasNodeProps {
  slot: ResolvedSlot;
  layout: CanvasLayout;
  viewport: { x: number; y: number; zoom: number };
  onLayoutChange?: (instanceId: string, layout: CanvasLayout) => void;
  onCapabilityRequest?: (capability: string, input: Record<string, unknown>) => Promise<unknown>;
  onSandboxAudit?: (event: SandboxAuditEvent) => void;
}

export function CanvasNode({
  slot,
  layout,
  viewport,
  onLayoutChange,
  onCapabilityRequest,
  onSandboxAudit,
}: CanvasNodeProps) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [resizing, setResizing] = useState<{ startX: number; startY: number; origW: number; origH: number } | null>(null);

  // Screen-space position = (world - viewport.x) * zoom + center
  // For simplicity we use absolute positioning in a transformed parent.
  const screenX = (layout.x - viewport.x) * viewport.zoom;
  const screenY = (layout.y - viewport.y) * viewport.zoom;
  const screenW = layout.w * viewport.zoom;
  const screenH = layout.h * viewport.zoom;

  const onPointerDownDrag = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setDragging({ startX: e.clientX, startY: e.clientY, origX: layout.x, origY: layout.y });
    },
    [layout.x, layout.y],
  );

  const onPointerDownResize = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setResizing({ startX: e.clientX, startY: e.clientY, origW: layout.w, origH: layout.h });
    },
    [layout.w, layout.h],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (dragging) {
        const dx = (e.clientX - dragging.startX) / viewport.zoom;
        const dy = (e.clientY - dragging.startY) / viewport.zoom;
        onLayoutChange?.(`${slot.providerId}:${slot.slotId}`, {
          ...layout,
          x: dragging.origX + dx,
          y: dragging.origY + dy,
        });
      } else if (resizing) {
        const dw = (e.clientX - resizing.startX) / viewport.zoom;
        const dh = (e.clientY - resizing.startY) / viewport.zoom;
        onLayoutChange?.(`${slot.providerId}:${slot.slotId}`, {
          ...layout,
          w: Math.max(80, resizing.origW + dw),
          h: Math.max(60, resizing.origH + dh),
        });
      }
    },
    [dragging, resizing, viewport.zoom, layout, onLayoutChange, slot.providerId, slot.slotId],
  );

  const onPointerUp = useCallback(() => {
    setDragging(null);
    setResizing(null);
  }, []);

  useEffect(() => {
    if (!dragging && !resizing) return;
    window.addEventListener('pointermove', onPointerMove as unknown as EventListener);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove as unknown as EventListener);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [dragging, resizing, onPointerMove, onPointerUp]);

  // Build the CanvasDefinition payload for the SandboxedNode from the
  // resolved slot. If tier='system' and component=null, show a placeholder.
  const sandbox = slot.component
    ? safeParseSandbox(slot.component.sandboxJson)
    : buildSandboxPolicy({ allowCapabilities: [] });

  return (
    <div
      ref={nodeRef}
      data-node-id={`${slot.providerId}:${slot.slotId}`}
      data-tier={slot.tier}
      data-from-system-default={slot.fromSystemDefault}
      onPointerDown={onPointerDownDrag}
      style={{
        position: 'absolute',
        left: screenX,
        top: screenY,
        width: screenW,
        height: screenH,
        zIndex: layout.z,
        background: 'rgba(255,255,255,0.96)',
        border: '1px solid rgba(0,0,0,0.12)',
        borderRadius: 8,
        boxShadow: '0 6px 24px -8px rgba(0,0,0,0.18)',
        overflow: 'hidden',
        cursor: dragging ? 'grabbing' : 'grab',
        userSelect: 'none',
      }}
    >
      {/* Header: slot name + tier badge + provider */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 8px',
          background: 'rgba(0,0,0,0.04)',
          borderBottom: '1px solid rgba(0,0,0,0.08)',
          fontSize: 11,
          color: '#444',
          fontFamily: 'ui-sans-serif, system-ui',
        }}
      >
        <span>
          <strong>{slot.slotId}</strong>
          <span style={{ opacity: 0.6, marginLeft: 6 }}>{slot.providerId}</span>
        </span>
        <span
          style={{
            padding: '1px 6px',
            borderRadius: 4,
            background:
              slot.tier === 'provider+variant'
                ? '#fde68a'
                : slot.tier === 'provider'
                  ? '#fcd34d'
                  : slot.tier === 'family+variant'
                    ? '#bbf7d0'
                    : slot.tier === 'family'
                      ? '#86efac'
                      : slot.tier === 'cross-type'
                        ? '#bfdbfe'
                        : '#e5e7eb',
            fontSize: 10,
            fontWeight: 600,
          }}
        >
          {slot.tier}
        </span>
      </div>

      {/* Sandboxed iframe body */}
      <div style={{ position: 'absolute', inset: '28px 0 0 0' }}>
        {slot.component ? (
          <SandboxedNode
            instanceId={`${slot.providerId}:${slot.slotId}`}
            html={slot.component.html}
            css={slot.component.css}
            scriptUrl={slot.component.scriptUrl ?? undefined}
            sandbox={sandbox}
            layout={layout}
            onCapabilityRequest={onCapabilityRequest}
            onSandboxAudit={onSandboxAudit}
            liveKey={slot.component.version}
          />
        ) : (
          <div
            style={{
              padding: 12,
              fontFamily: 'ui-sans-serif, system-ui',
              fontSize: 12,
              color: '#888',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>System default</div>
            <div style={{ opacity: 0.7 }}>
              No CanvasDefinition row exists for this slot. The resolver fell to the
              system built-in fallback (tier=<code>{slot.tier}</code>).
            </div>
          </div>
        )}
      </div>

      {/* Resize handle */}
      <div
        onPointerDown={onPointerDownResize}
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: 16,
          height: 16,
          cursor: 'nwse-resize',
          background:
            'linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.25) 50%, rgba(0,0,0,0.25) 60%, transparent 60%, transparent 70%, rgba(0,0,0,0.25) 70%, rgba(0,0,0,0.25) 80%, transparent 80%)',
        }}
      />
    </div>
  );
}

function safeParseSandbox(json: string): import('../../shared/canvas-types').SandboxPolicy {
  try {
    const parsed = JSON.parse(json) as Partial<import('../../shared/canvas-types').SandboxPolicy>;
    return buildSandboxPolicy({
      allowCapabilities: parsed.allowCapabilities ?? [],
      allowNetwork: parsed.allowNetwork,
      budgetMs: parsed.budgetMs,
      csp: parsed.csp,
    });
  } catch {
    return buildSandboxPolicy({ allowCapabilities: [] });
  }
}
