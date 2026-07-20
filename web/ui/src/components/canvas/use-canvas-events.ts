'use client';

/**
 * components/canvas/use-canvas-events.ts
 * --------------------------------------------------------------------
 * Subscribes to live canvas events from the backend (SSE fallback since
 * Next.js routes don't natively expose WS). Re-validates the resolved
 * surface on `canvas:surface:resolved` / `workspace:reresolved` /
 * `canvas:def:updated` so a hot-swap re-renders WITHOUT page reload.
 *
 * Implements bundle 02 §D re-coupling: context change → backend
 * re-resolves → SSE event → frontend invalidates query → React
 * re-renders only the changed nodes.
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { EventBus } from './event-bus';

export interface CanvasEvent {
  type:
    | 'canvas:surface:resolved'
    | 'canvas:layer:spawned'
    | 'canvas:layer:dismissed'
    | 'workspace:reresolved'
    | 'canvas:def:updated'
    | 'canvas:def:deprecated'
    | 'capability:actions:changed';
  traceId?: string;
  workspaceId?: string;
  definitionId?: string;
  slug?: string;
  instanceId?: string;
  [key: string]: unknown;
}

const globalBus = new EventBus();

export function getCanvasEventBus(): EventBus {
  return globalBus;
}

export function useCanvasEvents(workspaceId: string | null) {
  const qc = useQueryClient();
  const evtRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!workspaceId) return;

    // SSE subscription. Each event triggers a query invalidation so the
    // resolved surface is refetched and React re-renders the diff.
    const url = `/api/canvas/events?workspaceId=${encodeURIComponent(workspaceId)}`;
    let es: EventSource | null = null;
    try {
      es = new EventSource(url);
      evtRef.current = es;
      es.onmessage = (msg) => {
        try {
          const evt = JSON.parse(msg.data) as CanvasEvent;
          globalBus.emit(evt.type, evt);
          // Invalidate the resolve query for this workspace — TanStack Query
          // will refetch /api/canvas/resolve and re-render only changed nodes.
          qc.invalidateQueries({ queryKey: ['canvas:resolve'] });
        } catch {
          // ignore malformed events
        }
      };
    } catch {
      // EventSource not available (e.g. SSR) — silent no-op.
    }

    return () => {
      es?.close();
      evtRef.current = null;
    };
  }, [workspaceId, qc]);
}
