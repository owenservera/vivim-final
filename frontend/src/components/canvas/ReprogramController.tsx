'use client';

/**
 * components/canvas/ReprogramController.tsx
 * --------------------------------------------------------------------
 * Phase 5 of ROADMAP-REPROGRAMMABLE-CANVAS.md — Reprogram-This Modal.
 *
 * Mounts the ReprogramModal globally (one instance per page). Three triggers:
 *   1. ⌘R / Ctrl+R when a surface is hovered (intercepted before browser reload).
 *      The hovered surface id is tracked via the `data-surface-id` attribute
 *      on any DOM element. The closest ancestor with that attribute wins.
 *   2. Right-click → "Reprogram" in VCardMenu — emits a `vivim:reprogram`
 *      CustomEvent on window with { surfaceId, source: 'context-menu' }.
 *   3. Programmatic: any code can dispatch a `vivim:reprogram` CustomEvent.
 *
 * The controller reads the surface's current spec from the SurfaceRegistry.
 * Since the registry lives on the backend, the controller issues a fetch to
 * /api/surface/:id/spec (added in Phase 5; see surface-router). If that
 * endpoint isn't available yet, the controller falls back to a placeholder
 * spec with kind: 'custom'.
 *
 * CONTRACT_VERSION: 1
 */

import { useCallback, useEffect, useState } from 'react';
import { ReprogramModal } from './ReprogramModal';
import { useIO } from './UnifiedIOProvider';
import type { SurfaceSpec } from '@backend/reprogrammability/schema/spec';

// ── Helpers ──────────────────────────────────────────────────────────────────

interface ReprogramEventDetail {
  surfaceId: string;
  source?: 'context-menu' | 'keyboard' | 'programmatic';
  initialSpec?: SurfaceSpec;
}

/** Find the closest ancestor with a `data-surface-id` attribute. */
function findSurfaceIdFromTarget(target: EventTarget | null): string | null {
  if (!(target instanceof HTMLElement)) return null;
  const el = target.closest<HTMLElement>('[data-surface-id]');
  return el?.dataset.surfaceId ?? null;
}

// ── Controller ───────────────────────────────────────────────────────────────

export function ReprogramController() {
  const io = useIO();
  const [open, setOpen] = useState(false);
  const [surfaceId, setSurfaceId] = useState<string | null>(null);
  const [initialSpec, setInitialSpec] = useState<SurfaceSpec | null>(null);
  const [loadingSpec, setLoadingSpec] = useState(false);

  // ── Open the modal for a surface id ──────────────────────────────────────
  const openForSurface = useCallback(
    async (id: string, hint?: SurfaceSpec) => {
      setSurfaceId(id);
      setOpen(true);
      setLoadingSpec(true);
      setInitialSpec(hint ?? null);

      // Try to fetch the canonical spec from the backend.
      try {
        const res = await io.get<{ ok: boolean; spec?: SurfaceSpec; error?: string }>(
          `/api/surface/${encodeURIComponent(id)}/spec`,
        );
        if (res.data?.ok && res.data.spec) {
          setInitialSpec(res.data.spec);
        }
      } catch {
        // Best-effort — the modal still works with a placeholder spec.
      } finally {
        setLoadingSpec(false);
      }
    },
    [io],
  );

  // ── Listen for `vivim:reprogram` CustomEvents (from VCardMenu, etc.) ──────
  useEffect(() => {
    const onReprogram = (e: Event) => {
      const detail = (e as CustomEvent<ReprogramEventDetail>).detail;
      if (!detail?.surfaceId) return;
      void openForSurface(detail.surfaceId, detail.initialSpec);
    };
    window.addEventListener('vivim:reprogram', onReprogram as EventListener);
    return () => window.removeEventListener('vivim:reprogram', onReprogram as EventListener);
  }, [openForSurface]);

  // ── ⌘R / Ctrl+R handler ─────────────────────────────────────────────────
  // Intercept the browser's reload key when a surface is hovered. We track
  // the hovered surface via mousemove + the `data-surface-id` attribute.
  useEffect(() => {
    let hoveredSurfaceId: string | null = null;
    const onMouseMove = (e: MouseEvent) => {
      hoveredSurfaceId = findSurfaceIdFromTarget(e.target);
    };
    const onKey = (e: KeyboardEvent) => {
      // ⌘R on macOS = browser reload; Ctrl+R on others = reload.
      // We intercept BOTH only when a surface is hovered AND the modal is closed
      // AND the user is NOT inside an input/textarea (so the Composer's own ⌘R
      // handling can take precedence in builder mode).
      if (open) return;
      if (!((e.metaKey && e.key === 'r') || (e.ctrlKey && e.key === 'r'))) return;
      // Skip if focus is in an input/textarea/contenteditable.
      const active = document.activeElement as HTMLElement | null;
      if (
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.isContentEditable)
      ) {
        return;
      }
      if (!hoveredSurfaceId) return;
      // Skip if a modifier other than meta/ctrl is held (allow shift+⌘R for safe-mode in Phase 9).
      if (e.shiftKey) return; // ⌘⇧R is reserved for "Reset to Factory" in Phase 9.
      e.preventDefault();
      e.stopPropagation();
      void openForSurface(hoveredSurfaceId);
    };
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open, openForSurface]);

  // ── Close ─────────────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    setOpen(false);
    setSurfaceId(null);
    setInitialSpec(null);
  }, []);

  if (!open) return null;

  return (
    <ReprogramModal
      surfaceId={surfaceId}
      initialSpec={loadingSpec ? null : initialSpec}
      open={open}
      onClose={handleClose}
    />
  );
}

// ── Helper: dispatch a `vivim:reprogram` event from anywhere ────────────────

export function dispatchReprogram(surfaceId: string, initialSpec?: SurfaceSpec): void {
  window.dispatchEvent(
    new CustomEvent<ReprogramEventDetail>('vivim:reprogram', {
      detail: { surfaceId, source: 'programmatic', initialSpec },
    }),
  );
}
