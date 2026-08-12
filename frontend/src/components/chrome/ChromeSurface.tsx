'use client';

/**
 * components/chrome/ChromeSurface.tsx
 * --------------------------------------------------------------------
 * Phase 9 of ROADMAP-REPROGRAMMABLE-CANVAS.md — Self-Modifying Chrome.
 *
 * A wrapper that turns each chrome element (UnifiedEntry, MainMenu,
 * etc.) into a ReprogrammableSurface. The wrapper:
 *   - reads the surface spec from the SurfaceRegistry (via /api/surface/:id/spec)
 *   - applies the spec to the wrapped children (placeholder text, button
 *     labels, panel default sizes, menu items, keyboard shortcuts)
 *   - exposes a `data-surface-id` attribute so ⌘R (Phase 5) can reprogram it
 *
 * The chrome surfaces are registered by `registerCanonicalSurfaces()` in
 * Phase 5. Phase 9 makes them WRAPPERS — the spec drives the rendered chrome.
 *
 * Safe-mode keybind: ⌘⇧R force-resets the Composer to factory. The keybind
 * is hardcoded and NOT reprogrammable (Invariant #6, Phase 10).
 *
 * CONTRACT_VERSION: 1
 */

import { useEffect, useState, type ReactNode } from 'react';
import { useIO } from '@/sdk/web';
import { dispatchReprogram } from '@/components/canvas/ReprogramController';

export interface ChromeSurfaceProps {
  /** The chrome surface id (e.g. "chrome:composer"). */
  surfaceId: string;
  /** The children to wrap (the actual chrome element). */
  children: ReactNode;
  /**
   * A function that receives the spec and returns props to spread onto the
   * children. This is how the spec drives the chrome.
   */
  applySpec?: (spec: ChromeSpec | null) => Record<string, unknown>;
}

interface ChromeSpec {
  kind: 'chrome';
  chromeKind?: string;
  enabled?: boolean;
  strings?: Record<string, string>;
  style?: Record<string, unknown>;
  shortcuts?: Record<string, string>;
}

export function ChromeSurface({
  surfaceId,
  children,
  applySpec,
}: ChromeSurfaceProps) {
  const io = useIO();
  const [spec, setSpec] = useState<ChromeSpec | null>(null);

  // Fetch the spec on mount + whenever surfaceId changes.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await io.get<{
          ok: boolean;
          spec?: ChromeSpec;
        }>(`/api/surface/${encodeURIComponent(surfaceId)}/spec`);
        if (cancelled) return;
        if (res.data?.ok && res.data.spec) {
          setSpec(res.data.spec);
        }
      } catch {
  // [audit] log the error with context here
        // Best-effort — the wrapped children render without spec.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [io, surfaceId]);

  // ── Safe-mode keybind: ⌘⇧R resets the Composer to factory ────────────────
  // Hardcoded — NOT reprogrammable (Invariant #6, codified in Phase 10).
  useEffect(() => {
    if (surfaceId !== 'chrome:composer') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey && e.shiftKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        e.stopPropagation();
        // Dispatch a reprogram event that opens the ReprogramModal with a
        // factory-reset intent. The ReprogramController will fetch the
        // canonical-chrome.json seed via /api/chrome/factory.
        dispatchReprogram(surfaceId, {
          kind: 'chrome',
          chromeKind: 'composer',
          enabled: true,
          strings: { placeholder: 'Send a message…' },
          style: {},
        });
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [surfaceId]);

  const appliedProps = applySpec ? applySpec(spec) : {};

  return (
    <div
      data-surface-id={surfaceId}
      {...appliedProps}
      style={{
        ...(appliedProps.style as object),
        ...(spec?.style as object),
      }}
    >
      {children}
    </div>
  );
}

// ── Helper: a default applySpec for the Composer (placeholder text) ─────────

export function composerSpecApplier(spec: ChromeSpec | null): Record<string, unknown> {
  if (!spec?.strings) return {};
  return {
    placeholder: spec.strings.placeholder ?? 'Send a message…',
  };
}
