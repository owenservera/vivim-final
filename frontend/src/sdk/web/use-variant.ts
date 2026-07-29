'use client';

// src/sdk/web/use-variant.ts
// Phase 5 of ROADMAP-REPROGRAMMABLE-CANVAS.md — Reprogram-This Modal.
//
// The SDK hook for SurfaceVariant CRUD + activation. Used by the
// ReprogramModal to read/write saved alternatives of a surface.
//
// Backend routes (src/server/variant-router.ts):
//   GET    /api/variant?surfaceId=…         — list variants
//   GET    /api/variant/:id                 — get single variant
//   GET    /api/variant/_active?surfaceId=… — get active variant
//   POST   /api/variant                     — create
//   PUT    /api/variant/:id                 — update
//   DELETE /api/variant/:id                 — delete
//   POST   /api/variant/:id/activate        — set as active
//
// CONTRACT_VERSION: 1

import { useCallback, useEffect, useRef, useState } from 'react';
import { useIO } from '@/components/canvas/UnifiedIOProvider';
import type {
  SurfaceVariant,
  UpsertSurfaceVariantInput,
} from '@backend/reprogrammability/variant-schema';
import type { AppliedMutationRecord } from './use-mutation';

interface ListResponse {
  ok: boolean;
  surfaceId: string;
  variants: SurfaceVariant[];
  count: number;
}

interface GetResponse {
  ok: boolean;
  variant: SurfaceVariant;
}

interface ActiveResponse {
  ok: boolean;
  surfaceId: string;
  active: SurfaceVariant | null;
}

interface CreateResponse {
  ok: boolean;
  variant: SurfaceVariant;
}

interface UpdateResponse {
  ok: boolean;
  variant: SurfaceVariant;
}

interface DeleteResponse {
  ok: boolean;
  deleted: string;
}

interface ActivateResponse {
  ok: boolean;
  variant: SurfaceVariant;
  applyRecord: AppliedMutationRecord;
}

export type VariantResult<T> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

export interface UseVariantOptions {
  /** Surface id this hook is bound to. All list operations filter on this. */
  surfaceId?: string;
  /** Auto-refresh variants on mount + every pollMs ms. Default: true. */
  poll?: boolean;
  /** Polling interval in ms. Default: 15000. */
  pollMs?: number;
}

export function useVariant(opts: UseVariantOptions = {}) {
  const io = useIO();
  const { surfaceId, poll = true, pollMs = 15000 } = opts;

  const [variants, setVariants] = useState<SurfaceVariant[]>([]);
  const [active, setActive] = useState<SurfaceVariant | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  // ── refresh: GET /api/variant?surfaceId=… + /api/variant/_active ───────────
  const refresh = useCallback(async (): Promise<void> => {
    if (!surfaceId) return;
    setLoading(true);
    setError(null);
    try {
      const [listRes, activeRes] = await Promise.all([
        io.get<ListResponse>('/api/variant', { query: { surfaceId } }),
        io.get<ActiveResponse>('/api/variant/_active', { query: { surfaceId } }),
      ]);
      if (!mountedRef.current) return;
      if (listRes.data?.ok) {
        setVariants(listRes.data.variants ?? []);
      }
      if (activeRes.data?.ok) {
        setActive(activeRes.data.active ?? null);
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : 'Failed to load variants');
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [io, surfaceId]);

  // ── create: POST /api/variant ──────────────────────────────────────────────
  const create = useCallback(
    async (input: UpsertSurfaceVariantInput): Promise<VariantResult<{ variant: SurfaceVariant }>> => {
      setLoading(true);
      setError(null);
      try {
        const res = await io.post<CreateResponse>('/api/variant', input);
        if (!mountedRef.current) return { ok: false, error: 'unmounted' };
        const data = res.data;
        if (!data || !data.ok) {
          const msg = 'Failed to create variant';
          setError(msg);
          return { ok: false, error: msg };
        }
        void refresh();
        return { ok: true, variant: data.variant };
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Network error';
        if (mountedRef.current) setError(msg);
        return { ok: false, error: msg };
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    [io, refresh],
  );

  // ── update: PUT /api/variant/:id ───────────────────────────────────────────
  const update = useCallback(
    async (
      variantId: string,
      input: UpsertSurfaceVariantInput,
    ): Promise<VariantResult<{ variant: SurfaceVariant }>> => {
      setLoading(true);
      setError(null);
      try {
        const res = await io.put<UpdateResponse>(`/api/variant/${variantId}`, input);
        if (!mountedRef.current) return { ok: false, error: 'unmounted' };
        const data = res.data;
        if (!data || !data.ok) {
          const msg = 'Failed to update variant';
          setError(msg);
          return { ok: false, error: msg };
        }
        void refresh();
        return { ok: true, variant: data.variant };
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Network error';
        if (mountedRef.current) setError(msg);
        return { ok: false, error: msg };
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    [io, refresh],
  );

  // ── remove: DELETE /api/variant/:id ────────────────────────────────────────
  const remove = useCallback(
    async (variantId: string): Promise<VariantResult<{ deleted: string }>> => {
      setLoading(true);
      setError(null);
      try {
        const res = await io.delete<DeleteResponse>(`/api/variant/${variantId}`);
        if (!mountedRef.current) return { ok: false, error: 'unmounted' };
        const data = res.data;
        if (!data || !data.ok) {
          const msg = 'Failed to delete variant';
          setError(msg);
          return { ok: false, error: msg };
        }
        void refresh();
        return { ok: true, deleted: data.deleted };
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Network error';
        if (mountedRef.current) setError(msg);
        return { ok: false, error: msg };
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    [io, refresh],
  );

  // ── activate: POST /api/variant/:id/activate ───────────────────────────────
  const activate = useCallback(
    async (
      variantId: string,
    ): Promise<VariantResult<{ variant: SurfaceVariant; applyRecord: AppliedMutationRecord }>> => {
      setLoading(true);
      setError(null);
      try {
        const res = await io.post<ActivateResponse>(`/api/variant/${variantId}/activate`, {});
        if (!mountedRef.current) return { ok: false, error: 'unmounted' };
        const data = res.data;
        if (!data || !data.ok) {
          const msg = 'Failed to activate variant';
          setError(msg);
          return { ok: false, error: msg };
        }
        void refresh();
        return { ok: true, variant: data.variant, applyRecord: data.applyRecord };
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Network error';
        if (mountedRef.current) setError(msg);
        return { ok: false, error: msg };
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    [io, refresh],
  );

  // ── Initial load + polling ──────────────────────────────────────────────────
  useEffect(() => {
    if (!surfaceId) return;
    void refresh();
    if (!poll) return;
    const id = window.setInterval(() => void refresh(), pollMs);
    return () => window.clearInterval(id);
  }, [surfaceId, poll, pollMs, refresh]);

  return {
    variants,
    active,
    loading,
    error,
    refresh,
    create,
    update,
    remove,
    activate,
    clearError: () => setError(null),
  };
}
