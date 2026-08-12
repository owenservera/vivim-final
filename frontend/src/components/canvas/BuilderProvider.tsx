'use client';

/**
 * components/canvas/BuilderProvider.tsx
 * --------------------------------------------------------------------
 * Phase 4 of ROADMAP-REPROGRAMMABLE-CANVAS.md — Composer-as-Builder.
 *
 * A React context that coordinates mutation-preview state across the
 * Composer, MutationDiffPanel, and MutationHistoryPanel. Without this
 * context, the three surfaces would each maintain their own preview
 * state and drift; with it, there is one place that holds:
 *   - the currently-previewed plan
 *   - the diff entries returned by /api/mutation/preview
 *   - the loading / error / applying flags
 *   - the actions: preview, apply, discard, edit, viewHistory
 *
 * The context wraps the whole CanvasApp in page.tsx. The Composer (deeply
 * nested under LivingCanvas → ChatSurface) consumes it via `useBuilder()`.
 * The DiffPanel and HistoryPanel (mounted as floating Panels) also consume
 * it. No prop drilling.
 *
 * CONTRACT_VERSION: 1
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useMutation, type AppliedMutationRecord, type PreviewEntry } from '@/sdk/web/use-mutation';
import type {
  SurfaceMutation,
  SurfaceMutationPlan,
} from '@backend/reprogrammability/mutation-schema';

// ── Context shape ────────────────────────────────────────────────────────────

export interface BuilderContextValue {
  // ── Preview state ──
  previewedPlan: SurfaceMutationPlan | null;
  previewEntries: PreviewEntry[] | null;
  previewLoading: boolean;
  previewError: string | null;
  applying: boolean;

  // ── Actions ──
  /** Preview a plan: runs /api/mutation/preview and stores the result. */
  previewMutation: (plan: SurfaceMutationPlan) => Promise<void>;
  /** Apply the currently-previewed plan (or a different one). Returns ok. */
  applyMutation: (plan?: SurfaceMutationPlan) => Promise<boolean>;
  /** Discard the current preview. */
  discardMutation: () => void;
  /** Edit the current preview JSON (Phase 5 will hook to Reprogram-Modal). */
  editMutation: (plan?: SurfaceMutationPlan) => void;
  /** View a historical record (reconstructs a 1-mutation plan + diff from the record). */
  viewHistoryRecord: (record: AppliedMutationRecord) => void;
}

const BuilderContext = createContext<BuilderContextValue | null>(null);

export function useBuilder(): BuilderContextValue | null {
  return useContext(BuilderContext);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Heuristic: does the NLCL `output` look like a mutation plan or a single
 * mutation? Returns a wrapped plan, or null if not a mutation.
 *
 * Two recognized shapes:
 *   1. { id, mutations: [...], provenance, ... } — a SurfaceMutationPlan.
 *   2. { op: 'replace'|'insert'|..., target: '...', provenance: '...', payload: ... } — a single SurfaceMutation.
 */
export function coerceToPlan(output: unknown): SurfaceMutationPlan | null {
  if (!output || typeof output !== 'object') return null;
  const o = output as Record<string, unknown>;

  // Case 1: it's already a plan.
  if (Array.isArray(o.mutations) && o.mutations.length > 0) {
    // Light validation: each mutation has `op` and `target`.
    const firstMutation = o.mutations[0] as Record<string, unknown> | undefined;
    if (firstMutation && typeof firstMutation.op === 'string' && typeof firstMutation.target === 'string') {
      return {
        id: typeof o.id === 'string' ? o.id : `plan-${Date.now()}`,
        mutations: o.mutations as SurfaceMutation[],
        provenance: (typeof o.provenance === 'string' ? o.provenance : 'nlcl') as SurfaceMutationPlan['provenance'],
        description: typeof o.description === 'string' ? o.description : undefined,
        rollback: Array.isArray(o.rollback) ? (o.rollback as SurfaceMutation[]) : undefined,
        parentPlanId: typeof o.parentPlanId === 'string' ? o.parentPlanId : undefined,
      };
    }
  }

  // Case 2: it's a single mutation.
  if (typeof o.op === 'string' && typeof o.target === 'string' && typeof o.provenance === 'string') {
    const mutation = o as unknown as SurfaceMutation;
    return {
      id: `plan-${Date.now()}`,
      mutations: [mutation],
      provenance: mutation.provenance,
      description: `From NLCL: ${mutation.op} ${mutation.target}`,
    };
  }

  return null;
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function BuilderProvider({ children }: { children: ReactNode }) {
  const mutation = useMutation();
  const [previewedPlan, setPreviewedPlan] = useState<SurfaceMutationPlan | null>(null);
  const [previewEntries, setPreviewEntries] = useState<PreviewEntry[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const previewMutation = useCallback(
    async (plan: SurfaceMutationPlan): Promise<void> => {
      setPreviewedPlan(plan);
      setPreviewLoading(true);
      setPreviewError(null);
      setPreviewEntries(null);
      const result = await mutation.preview({ plan });
      if (result.ok) {
        setPreviewEntries(result.entries);
      } else {
        setPreviewError(result.error);
        setPreviewEntries(null);
      }
      setPreviewLoading(false);
    },
    [mutation],
  );

  const applyMutation = useCallback(
    async (plan?: SurfaceMutationPlan): Promise<boolean> => {
      const target = plan ?? previewedPlan;
      if (!target) return false;
      setApplying(true);
      const result = await mutation.apply({ plan: target });
      setApplying(false);
      if (result.ok) {
        setPreviewedPlan(null);
        setPreviewEntries(null);
        setPreviewError(null);
        return true;
      }
      // Apply failed — keep the preview open so the user can see the error.
      setPreviewError(result.error);
      return false;
    },
    [mutation, previewedPlan],
  );

  const discardMutation = useCallback(() => {
    setPreviewedPlan(null);
    setPreviewEntries(null);
    setPreviewError(null);
  }, []);

  const editMutation = useCallback(
    (plan?: SurfaceMutationPlan) => {
      // Phase 5 will hook this to the Reprogram-Modal. For now, copy to clipboard.
      const target = plan ?? previewedPlan;
      if (!target) return;
      try {
        const json = JSON.stringify(target, null, 2);
        navigator.clipboard?.writeText(json);
        // [audit] removed: console.log('[Builder] edit mutation (Phase 5 will open Reprogram-Modal):', json);
      } catch {
  // [audit] log the error with context here
        // clipboard may be unavailable
      }
    },
    [previewedPlan],
  );

  const viewHistoryRecord = useCallback((record: AppliedMutationRecord) => {
    const plan: SurfaceMutationPlan = {
      id: `view-${record.id}`,
      mutations: [record.mutation],
      provenance: record.mutation.provenance,
      description: `Historical: ${record.mutation.op} ${record.mutation.target}`,
    };
    setPreviewedPlan(plan);
    setPreviewEntries([
      {
        mutation: record.mutation,
        beforeSpec: record.beforeSpec,
        afterSpec: record.afterSpec,
      },
    ]);
    setPreviewError(null);
    setPreviewLoading(false);
  }, []);

  const value = useMemo<BuilderContextValue>(
    () => ({
      previewedPlan,
      previewEntries,
      previewLoading,
      previewError,
      applying,
      previewMutation,
      applyMutation,
      discardMutation,
      editMutation,
      viewHistoryRecord,
    }),
    [
      previewedPlan,
      previewEntries,
      previewLoading,
      previewError,
      applying,
      previewMutation,
      applyMutation,
      discardMutation,
      editMutation,
      viewHistoryRecord,
    ],
  );

  return <BuilderContext.Provider value={value}>{children}</BuilderContext.Provider>;
}
