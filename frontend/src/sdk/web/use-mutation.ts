'use client';

// src/sdk/web/use-mutation.ts
// Phase 4 of ROADMAP-REPROGRAMMABLE-CANVAS.md — Composer-as-Builder.
//
// The SDK hook for the MutationExecutor (Phase 3). All Composer / DiffPanel /
// HistoryPanel / Reprogram-Modal traffic goes through this hook so that:
//   - We have one shape (re-exports the canonical SurfaceMutation* types).
//   - We have one transport (useIO → /api/mutation/*).
//   - We can layer optimistic updates, undo/redo, and history polling
//     in one place without each caller re-implementing them.
//
// CONTRACT_VERSION: 1
//
// Backend routes (src/server/mutation-router.ts):
//   POST   /api/mutation/apply    — { plan } | { mutation } | { dsl } | { dslList }
//   POST   /api/mutation/preview  — { plan } | { dsl } | { dslList }
//   GET    /api/mutation/history?limit=N
//   GET    /api/mutation/status
//   POST   /api/mutation/undo
//   POST   /api/mutation/redo

import { useCallback, useEffect, useRef, useState } from 'react';
import { useIO } from '@/components/canvas/UnifiedIOProvider';
import type { IOEvent } from '@/components/canvas/UnifiedIOProvider';
import type {
  SurfaceMutation,
  SurfaceMutationPlan,
} from '../../../mini-services/backend/src/reprogrammability/mutation-schema.js';
import type { SurfaceSpec } from '../../../mini-services/backend/src/reprogrammability/schema/spec.js';

// ── Mirror of backend executor's AppliedMutationRecord ────────────────────────
// Kept in sync with mini-services/backend/src/reprogrammability/dsl/executor.ts.
// Type-only import from backend keeps a single source of truth.

export interface AppliedMutationRecord {
  id: string;
  planId?: string;
  mutation: SurfaceMutation;
  beforeSpec: SurfaceSpec;
  afterSpec: SurfaceSpec;
  appliedAt: number;
  ok: boolean;
  error?: string;
}

export interface ApplyPlanResult {
  ok: boolean;
  records: AppliedMutationRecord[];
  error?: string;
  rolledBack: boolean;
}

export interface PreviewEntry {
  mutation: SurfaceMutation;
  beforeSpec?: SurfaceSpec;
  afterSpec?: SurfaceSpec;
  error?: string;
}

export interface MutationStatus {
  canUndo: boolean;
  canRedo: boolean;
  historyLength: number;
}

// ── Wire shapes (the JSON the router actually returns) ───────────────────────

interface ApplyMutationResponse {
  ok: boolean;
  record?: AppliedMutationRecord;
  records?: AppliedMutationRecord[];
  result?: ApplyPlanResult;
  error?: string;
}

interface PreviewResponse {
  ok: boolean;
  preview?: PreviewEntry[];
  error?: string;
}

interface HistoryResponse {
  ok: boolean;
  history: AppliedMutationRecord[];
  count: number;
}

interface StatusResponse extends MutationStatus {
  ok: boolean;
}

interface UndoRedoResponse {
  ok: boolean;
  record?: AppliedMutationRecord;
  error?: string;
}

// ── Result discriminated union for the apply() return ────────────────────────

export type ApplyResult =
  | { ok: true; record?: AppliedMutationRecord; records?: AppliedMutationRecord[]; result?: ApplyPlanResult }
  | { ok: false; error: string };

export type PreviewResult =
  | { ok: true; entries: PreviewEntry[] }
  | { ok: false; error: string };

export type UndoRedoResult =
  | { ok: true; record: AppliedMutationRecord }
  | { ok: false; error: string };

// ── Hook options ─────────────────────────────────────────────────────────────

export interface UseMutationOptions {
  /** Poll /api/mutation/status on mount and every `pollMs` ms. Default: false. */
  pollStatus?: boolean;
  /** Polling interval in ms. Default: 5000. */
  pollMs?: number;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useMutation(opts: UseMutationOptions = {}) {
  const io = useIO();
  const { pollStatus = false, pollMs = 5000 } = opts;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<AppliedMutationRecord[]>([]);
  const [status, setStatus] = useState<MutationStatus>({
    canUndo: false,
    canRedo: false,
    historyLength: 0,
  });

  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  // ── refreshStatus: GET /api/mutation/status ────────────────────────────────
  const refreshStatus = useCallback(async (): Promise<void> => {
    try {
      const res = await io.get<StatusResponse>('/api/mutation/status');
      if (!mountedRef.current || !res.data) return;
      if (res.data.ok) {
        setStatus({
          canUndo: res.data.canUndo,
          canRedo: res.data.canRedo,
          historyLength: res.data.historyLength,
        });
      }
    } catch {
      // Silent — status polling is best-effort.
    }
  }, [io]);

  // ── refreshHistory: GET /api/mutation/history ──────────────────────────────
  const refreshHistory = useCallback(async (limit = 50): Promise<void> => {
    try {
      const res = await io.get<HistoryResponse>('/api/mutation/history', { query: { limit } });
      if (!mountedRef.current || !res.data) return;
      if (res.data.ok) {
        setHistory(res.data.history ?? []);
      }
    } catch {
      // Silent — history polling is best-effort.
    }
  }, [io]);

  // ── apply: POST /api/mutation/apply ────────────────────────────────────────
  // Accepts a plan, a single mutation, or a DSL string. The body shape picks
  // the input branch on the server side.
  const apply = useCallback(
    async (
      input:
        | { plan: SurfaceMutationPlan }
        | { mutation: SurfaceMutation }
        | { dsl: string }
        | { dslList: string },
    ): Promise<ApplyResult> => {
      setLoading(true);
      setError(null);
      try {
        const res = await io.post<ApplyMutationResponse>('/api/mutation/apply', input);
        if (!mountedRef.current) return { ok: false, error: 'unmounted' };
        const data = res.data;
        if (!data) return { ok: false, error: 'No response from server' };

        if (!data.ok) {
          const msg = data.error ?? 'Apply failed';
          setError(msg);
          return { ok: false, error: msg };
        }

        // Refresh status + history in the background after a successful apply.
        void refreshStatus();
        void refreshHistory();

        return {
          ok: true,
          record: data.record,
          records: data.records,
          result: data.result,
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Apply failed (network error)';
        if (mountedRef.current) setError(msg);
        return { ok: false, error: msg };
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    [io, refreshStatus, refreshHistory],
  );

  // ── preview: POST /api/mutation/preview ────────────────────────────────────
  const preview = useCallback(
    async (
      input:
        | { plan: SurfaceMutationPlan }
        | { dsl: string }
        | { dslList: string },
    ): Promise<PreviewResult> => {
      setLoading(true);
      setError(null);
      try {
        const res = await io.post<PreviewResponse>('/api/mutation/preview', input);
        if (!mountedRef.current) return { ok: false, error: 'unmounted' };
        const data = res.data;
        if (!data) return { ok: false, error: 'No response from server' };

        if (!data.ok) {
          const msg = data.error ?? 'Preview failed';
          setError(msg);
          return { ok: false, error: msg };
        }

        return { ok: true, entries: data.preview ?? [] };
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Preview failed (network error)';
        if (mountedRef.current) setError(msg);
        return { ok: false, error: msg };
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    [io],
  );

  // ── undo: POST /api/mutation/undo ──────────────────────────────────────────
  const undo = useCallback(async (): Promise<UndoRedoResult> => {
    setLoading(true);
    setError(null);
    try {
      const res = await io.post<UndoRedoResponse>('/api/mutation/undo', {});
      if (!mountedRef.current) return { ok: false, error: 'unmounted' };
      const data = res.data;
      if (!data) return { ok: false, error: 'No response from server' };

      if (!data.ok || !data.record) {
        const msg = data.error ?? 'Nothing to undo';
        setError(msg);
        return { ok: false, error: msg };
      }

      void refreshStatus();
      void refreshHistory();
      return { ok: true, record: data.record };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Undo failed (network error)';
      if (mountedRef.current) setError(msg);
      return { ok: false, error: msg };
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [io, refreshStatus, refreshHistory]);

  // ── redo: POST /api/mutation/redo ──────────────────────────────────────────
  const redo = useCallback(async (): Promise<UndoRedoResult> => {
    setLoading(true);
    setError(null);
    try {
      const res = await io.post<UndoRedoResponse>('/api/mutation/redo', {});
      if (!mountedRef.current) return { ok: false, error: 'unmounted' };
      const data = res.data;
      if (!data) return { ok: false, error: 'No response from server' };

      if (!data.ok || !data.record) {
        const msg = data.error ?? 'Nothing to redo';
        setError(msg);
        return { ok: false, error: msg };
      }

      void refreshStatus();
      void refreshHistory();
      return { ok: true, record: data.record };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Redo failed (network error)';
      if (mountedRef.current) setError(msg);
      return { ok: false, error: msg };
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [io, refreshStatus, refreshHistory]);

  // ── Status + history polling (optional) ────────────────────────────────────
  useEffect(() => {
    if (!pollStatus) return;
    void refreshStatus();
    void refreshHistory();
    const id = window.setInterval(() => {
      void refreshStatus();
      void refreshHistory();
    }, pollMs);
    return () => window.clearInterval(id);
  }, [pollStatus, pollMs, refreshStatus, refreshHistory]);

  // ── Live status via IO events (refresh on any successful POST to /api/mutation/*) ──
  useEffect(() => {
    const onEvent = (e: IOEvent) => {
      if (e.type === 'request:success' && e.method === 'POST' && e.url && e.url.includes('/api/mutation/')) {
        if (e.status !== undefined && e.status >= 200 && e.status < 300) {
          void refreshStatus();
          void refreshHistory();
        }
      }
    };
    // `io.on()` returns an unsubscribe function (UnifiedIO interface).
    const unsub = io.on(onEvent);
    return () => {
      unsub();
    };
  }, [io, refreshStatus, refreshHistory]);

  return {
    // State
    loading,
    error,
    history,
    status,
    // Actions
    apply,
    preview,
    undo,
    redo,
    refreshStatus,
    refreshHistory,
    // Clear the local error
    clearError: () => setError(null),
  };
}
