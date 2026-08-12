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
import { getLastResolveTraceId } from './use-resolved-nodes';

export interface CanvasEvent {
  type:
    | 'canvas:surface:resolved'
    | 'canvas:layer:spawned'
    | 'canvas:layer:dismissed'
    | 'workspace:reresolved'
    | 'canvas:def:updated'
    | 'canvas:def:deprecated'
    | 'capability:actions:changed'
    | 'stream:open'
    | 'heartbeat';
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
  const seenRef = useRef<Set<string>>(new Set());

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
          // Skip stream:open and heartbeat — these are connection signals, not canvas updates
          if (evt.type === 'stream:open' || evt.type === 'heartbeat') return;
          // Self-loop guard: a `canvas:surface:resolved` event that carries the
          // SAME traceId as our last resolve response is OUR OWN echo coming
          // back through the SSE forwarder. Invalidating here would refetch
          // /api/canvas/resolve → re-emit → loop forever. Genuine cross-tab
          // updates carry a different traceId, so they still invalidate.
          if (
            evt.type === 'canvas:surface:resolved' &&
            evt.traceId &&
            evt.traceId === getLastResolveTraceId()
          ) {
            return;
          }
          // Deduplicate: track by traceId to prevent replays on reconnect
          const key = evt.traceId ?? `${evt.type}:${evt.workspaceId ?? ''}:${evt.definitionId ?? ''}:${Date.now()}`;
          if (seenRef.current.has(key)) return;
          seenRef.current.add(key);
          // Cap at 500 entries to prevent memory leak
          if (seenRef.current.size > 500) {
            const arr = [...seenRef.current];
            seenRef.current = new Set(arr.slice(-250));
          }
          globalBus.emit(evt.type, evt);
          // Invalidate the resolve query for this workspace — TanStack Query
          // will refetch /api/canvas/resolve and re-render only changed nodes.
          qc.invalidateQueries({ queryKey: ['canvas:resolve'] });
        } catch {
  // [audit] log the error with context here
          // ignore malformed events
        }
      };
    } catch {
  // [audit] log the error with context here
      // EventSource not available (e.g. SSR) — silent no-op.
    }

    return () => {
      es?.close();
      evtRef.current = null;
    };
  }, [workspaceId, qc]);
}
