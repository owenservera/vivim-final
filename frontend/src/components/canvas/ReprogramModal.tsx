'use client';

/**
 * components/canvas/ReprogramModal.tsx
 * --------------------------------------------------------------------
 * Phase 5 of ROADMAP-REPROGRAMMABLE-CANVAS.md — Reprogram-This Modal.
 *
 * Every visible element has a "Reprogram" affordance (⌘R when hovered
 * or right-click → Reprogram). The modal:
 *   - shows the element's current spec as JSON (Advanced — collapsible)
 *   - shows a live preview pane that re-renders the surface from the spec
 *   - has an NLCL input ("describe a change…") that produces mutations
 *   - has a variant dropdown (existing variants + Save as new variant)
 *   - has Apply / Cancel / Reset buttons
 *
 * The modal reuses the Phase 4 pipeline: NLCL input → coerceToPlan() →
 * useMutation.apply() → BuilderProvider preview state. Same SurfaceMutation
 * shape, same executor, same undo stack. The only addition is variant
 * management via useVariant() (Phase 5 backend).
 *
 * CONTRACT_VERSION: 1
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation } from '@/sdk/web/use-mutation';
import { useVariant } from '@/sdk/web/use-variant';
import { useInterpret } from '@/sdk/web/use-interpret';
import { Icon, type IconName } from './Icon';
import {
  coerceToPlan,
  useBuilder,
} from './BuilderProvider';
import type {
  SurfaceMutationPlan,
  SurfaceMutation,
} from '@backend/reprogrammability/mutation-schema';
import type { SurfaceSpec } from '@backend/reprogrammability/schema/spec';
import type { SurfaceVariant } from '@backend/reprogrammability/variant-schema';

// ── Props ────────────────────────────────────────────────────────────────────

export interface ReprogramModalProps {
  /** The surface id to reprogram (e.g. `panel:conversations`). */
  surfaceId: string | null;
  /** The current spec to seed the editor with (read from the surface). */
  initialSpec?: SurfaceSpec | null;
  /** Open state. */
  open: boolean;
  /** Called when the user requests close (Esc, backdrop, X button). */
  onClose: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const OP_COLORS: Record<string, string> = {
  replace: '#3b82f6',
  insert: '#22c55e',
  remove: '#ef4444',
  reorder: '#a855f7',
  restyle: '#f59e0b',
  rebind: '#06b6d4',
  set_property: '#6366f1',
  set_slot: '#ec4899',
};

function opColor(op: string): string {
  return OP_COLORS[op] ?? '#64748b';
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function tryParseJson(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Invalid JSON' };
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export function ReprogramModal({
  surfaceId,
  initialSpec,
  open,
  onClose,
}: ReprogramModalProps) {
  const builder = useBuilder();
  const mutation = useMutation();
  const variant = useVariant({ surfaceId: surfaceId ?? undefined });

  // Editor state
  const [specText, setSpecText] = useState('');
  const [specError, setSpecError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // NLCL input state
  const [nlclInput, setNlclInput] = useState('');
  const [nlclBusy, setNlclBusy] = useState(false);
  const [nlclError, setNlclError] = useState<string | null>(null);
  const interpret = useInterpret();

  // Variant save form
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [variantName, setVariantName] = useState('');
  const [variantDescription, setVariantDescription] = useState('');

  // Reset the editor when the modal opens or surfaceId changes.
  useEffect(() => {
    if (open && initialSpec) {
      setSpecText(safeStringify(initialSpec));
      setSpecError(null);
      setShowAdvanced(false);
      setNlclInput('');
      setNlclError(null);
      setShowSaveForm(false);
      setVariantName('');
      setVariantDescription('');
    }
  }, [open, surfaceId, initialSpec]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  // Parsed spec (live)
  const parsedSpec = useMemo<{ ok: true; value: SurfaceSpec } | { ok: false; error: string }>(() => {
    if (!specText.trim()) return { ok: false, error: 'Spec is empty' };
    const result = tryParseJson(specText);
    if (!result.ok) return result;
    if (!result.value || typeof result.value !== 'object') {
      return { ok: false, error: 'Spec must be a JSON object' };
    }
    const obj = result.value as Record<string, unknown>;
    if (typeof obj.kind !== 'string') {
      return { ok: false, error: 'Spec must have a string "kind" field' };
    }
    return { ok: true, value: result.value as SurfaceSpec };
  }, [specText]);

  // ── Apply a single-mutation replace plan from the current editor ──────────
  const handleApply = useCallback(async () => {
    if (!surfaceId) return;
    if (!parsedSpec.ok) {
      setSpecError(parsedSpec.error);
      return;
    }
    const mutation_: SurfaceMutation = {
      op: 'replace',
      target: surfaceId,
      provenance: 'manual',
      payload: parsedSpec.value,
      reason: 'Reprogram-This modal: manual spec edit',
      idempotencyKey: `reprogram-modal-${surfaceId}-${Date.now()}`,
    };
    const plan: SurfaceMutationPlan = {
      id: `reprogram-modal-${Date.now()}`,
      mutations: [mutation_],
      provenance: 'manual',
      description: `Manual edit via Reprogram-This modal: ${surfaceId}`,
    };
    // Push through BuilderProvider so the preview/diff/history panels all update.
    if (builder) {
      await builder.previewMutation(plan);
      const ok = await builder.applyMutation(plan);
      if (ok) onClose();
    } else {
      // Fallback: apply directly via useMutation.
      const result = await mutation.apply({ plan });
      if (result.ok) onClose();
    }
  }, [surfaceId, parsedSpec, builder, mutation, onClose]);

  // ── Run NLCL: send the NLCL input, get a plan, preview it ────────────────
  const handleNlclSubmit = useCallback(async () => {
    if (!surfaceId || !nlclInput.trim()) return;
    setNlclBusy(true);
    setNlclError(null);
    try {
      const result = await interpret.interpret(nlclInput, {
        surface: 'ui',
        targetSurfaceId: surfaceId,
      });
      if (!result) {
        setNlclError('No response from NLCL engine');
        return;
      }
      // coerceToPlan returns a plan from NLCL output.
      const plan = coerceToPlan(
        // The InterpretResponse may carry the output in different places.
        // Try `output` first, then the whole result.
        (result as { output?: unknown }).output ?? result,
      );
      if (!plan) {
        setNlclError(
          'NLCL did not produce a mutation. Try: "/hide panel:conversations" or "restyle card:doc:abc background red".',
        );
        return;
      }
      // Override the target if the plan's mutations don't already specify this surface.
      for (const m of plan.mutations) {
        if (!m.target.startsWith(surfaceId)) {
          m.target = surfaceId;
        }
      }
      if (builder) {
        await builder.previewMutation(plan);
      }
    } catch (e) {
      setNlclError(e instanceof Error ? e.message : 'NLCL failed');
    } finally {
      setNlclBusy(false);
    }
  }, [surfaceId, nlclInput, interpret, builder]);

  // ── Apply the currently-previewed plan (from NLCL or elsewhere) ──────────
  const handleApplyPreview = useCallback(async () => {
    if (!builder?.previewedPlan) return;
    const ok = await builder.applyMutation();
    if (ok) {
      // Refresh the editor from the applied result.
      const lastEntry = builder.previewEntries?.[builder.previewEntries.length - 1];
      if (lastEntry?.afterSpec) {
        setSpecText(safeStringify(lastEntry.afterSpec));
      }
    }
  }, [builder]);

  // ── Reset to initial spec ──────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    if (initialSpec) setSpecText(safeStringify(initialSpec));
    setSpecError(null);
    if (builder) builder.discardMutation();
  }, [initialSpec, builder]);

  // ── Save current spec as a variant ────────────────────────────────────────
  const handleSaveVariant = useCallback(async () => {
    if (!surfaceId || !parsedSpec.ok || !variantName.trim()) return;
    const result = await variant.create({
      surfaceId,
      name: variantName.trim(),
      description: variantDescription.trim() || undefined,
      spec: parsedSpec.value,
      tags: ['reprogram-modal'],
    });
    if (result.ok) {
      setShowSaveForm(false);
      setVariantName('');
      setVariantDescription('');
    } else {
      setSpecError(`Failed to save variant: ${result.error}`);
    }
  }, [surfaceId, parsedSpec, variant, variantName, variantDescription]);

  // ── Activate a previously-saved variant ────────────────────────────────────
  const handleActivateVariant = useCallback(
    async (variantId: string) => {
      const result = await variant.activate(variantId);
      if (result.ok) {
        // Update the editor with the activated variant's spec.
        const activated = variant.variants.find((v) => v.id === variantId);
        if (activated) {
          setSpecText(safeStringify(activated.spec));
        }
      } else {
        setSpecError(`Failed to activate variant: ${result.error}`);
      }
    },
    [variant],
  );

  if (!open || !surfaceId) return null;

  const activeVariant = variant.active;
  const otherVariants = variant.variants.filter((v) => !v.isActive);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reprogram-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 'min(960px, 92vw)',
          maxHeight: '88vh',
          background: 'var(--bg-canvas, #ffffff)',
          border: '1px solid var(--border-subtle, #e2e8f0)',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
        }}
      >
        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '14px 20px',
            borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
            background: 'var(--bg-elevated, #f8fafc)',
          }}
        >
          <Icon name="settings" size={18} />
          <h2
            id="reprogram-modal-title"
            style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: 600,
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            Reprogram — <code style={{ fontSize: '13px', color: 'var(--accent, #3b82f6)' }}>{surfaceId}</code>
          </h2>
          {activeVariant && (
            <span
              title="Active variant"
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                background: 'var(--accent, #3b82f6)15',
                color: 'var(--accent, #3b82f6)',
                borderRadius: '4px',
                fontWeight: 500,
              }}
            >
              {activeVariant.name}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: 'var(--text-muted, #64748b)',
              borderRadius: '4px',
            }}
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        {/* ── Body ──────────────────────────────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1px',
            background: 'var(--border-subtle, #e2e8f0)',
            overflow: 'hidden',
            minHeight: 0,
          }}
        >
          {/* ── Left: Editor + NLCL input + Variants ───────────────────────── */}
          <div
            style={{
              background: 'var(--bg-canvas, #ffffff)',
              overflow: 'auto',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            {/* NLCL input */}
            <section>
              <label
                htmlFor="reprogram-nlcl"
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-muted, #64748b)',
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Describe a change
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  id="reprogram-nlcl"
                  type="text"
                  value={nlclInput}
                  onChange={(e) => setNlclInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleNlclSubmit();
                    }
                  }}
                  placeholder="e.g. /hide panel:conversations or restyle background red"
                  disabled={nlclBusy}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    border: '1px solid var(--border-subtle, #e2e8f0)',
                    borderRadius: '6px',
                    fontSize: '13px',
                    background: 'var(--bg-canvas, #ffffff)',
                    color: 'var(--text-primary, #0f172a)',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => void handleNlclSubmit()}
                  disabled={nlclBusy || !nlclInput.trim()}
                  style={{
                    padding: '8px 14px',
                    background: 'var(--accent, #3b82f6)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: nlclBusy || !nlclInput.trim() ? 'not-allowed' : 'pointer',
                    opacity: nlclBusy || !nlclInput.trim() ? 0.6 : 1,
                    fontSize: '13px',
                    fontWeight: 500,
                  }}
                >
                  {nlclBusy ? 'Interpreting…' : 'Interpret'}
                </button>
              </div>
              {nlclError && (
                <p style={{ marginTop: '6px', fontSize: '12px', color: '#ef4444' }}>{nlclError}</p>
              )}
            </section>

            {/* Variants */}
            <section>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '6px',
                }}
              >
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-muted, #64748b)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  Variants ({variant.variants.length})
                </span>
                <button
                  type="button"
                  onClick={() => setShowSaveForm((v) => !v)}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border-subtle, #e2e8f0)',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    color: 'var(--text-muted, #64748b)',
                  }}
                >
                  {showSaveForm ? 'Cancel' : '+ Save as variant'}
                </button>
              </div>

              {showSaveForm && (
                <div
                  style={{
                    padding: '10px',
                    border: '1px solid var(--border-subtle, #e2e8f0)',
                    borderRadius: '6px',
                    marginBottom: '8px',
                    background: 'var(--bg-elevated, #f8fafc)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <input
                    type="text"
                    value={variantName}
                    onChange={(e) => setVariantName(e.target.value)}
                    placeholder="Variant name (e.g. Compact)"
                    style={{
                      padding: '6px 10px',
                      border: '1px solid var(--border-subtle, #e2e8f0)',
                      borderRadius: '4px',
                      fontSize: '13px',
                      background: 'var(--bg-canvas, #ffffff)',
                    }}
                  />
                  <input
                    type="text"
                    value={variantDescription}
                    onChange={(e) => setVariantDescription(e.target.value)}
                    placeholder="Description (optional)"
                    style={{
                      padding: '6px 10px',
                      border: '1px solid var(--border-subtle, #e2e8f0)',
                      borderRadius: '4px',
                      fontSize: '13px',
                      background: 'var(--bg-canvas, #ffffff)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => void handleSaveVariant()}
                    disabled={!parsedSpec.ok || !variantName.trim() || variant.loading}
                    style={{
                      padding: '6px 12px',
                      background: 'var(--accent, #3b82f6)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 500,
                      opacity: !parsedSpec.ok || !variantName.trim() || variant.loading ? 0.6 : 1,
                    }}
                  >
                    Save
                  </button>
                </div>
              )}

              {variant.loading && (
                <p style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)' }}>Loading variants…</p>
              )}
              {variant.error && (
                <p style={{ fontSize: '12px', color: '#ef4444' }}>{variant.error}</p>
              )}
              {!variant.loading && otherVariants.length === 0 && !activeVariant && (
                <p style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)' }}>
                  No saved variants. Edit the spec and click &quot;Save as variant&quot;.
                </p>
              )}
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {activeVariant && (
                  <VariantRow
                    variant={activeVariant}
                    isActive
                    onActivate={() => void handleActivateVariant(activeVariant.id)}
                    onDelete={undefined}
                  />
                )}
                {otherVariants.map((v) => (
                  <VariantRow
                    key={v.id}
                    variant={v}
                    onActivate={() => void handleActivateVariant(v.id)}
                    onDelete={() => void variant.remove(v.id)}
                  />
                ))}
              </ul>
            </section>

            {/* Advanced: Spec JSON editor */}
            <section>
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-subtle, #e2e8f0)',
                  padding: '6px 10px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  color: 'var(--text-muted, #64748b)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  width: '100%',
                  justifyContent: 'space-between',
                }}
              >
                <span>Advanced — Spec JSON</span>
                <Icon name={showAdvanced ? 'chevron-up' : 'chevron-down'} size={14} />
              </button>
              {showAdvanced && (
                <div style={{ marginTop: '8px' }}>
                  <textarea
                    value={specText}
                    onChange={(e) => {
                      setSpecText(e.target.value);
                      setSpecError(null);
                    }}
                    spellCheck={false}
                    style={{
                      width: '100%',
                      minHeight: '260px',
                      padding: '10px',
                      border: `1px solid ${specError ? '#ef4444' : 'var(--border-subtle, #e2e8f0)'}`,
                      borderRadius: '6px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      lineHeight: 1.5,
                      background: 'var(--bg-elevated, #f8fafc)',
                      color: 'var(--text-primary, #0f172a)',
                      resize: 'vertical',
                      outline: 'none',
                    }}
                  />
                  {specError && (
                    <p style={{ marginTop: '4px', fontSize: '12px', color: '#ef4444' }}>{specError}</p>
                  )}
                  {!specError && !parsedSpec.ok && (
                    <p style={{ marginTop: '4px', fontSize: '12px', color: '#ef4444' }}>
                      {parsedSpec.error}
                    </p>
                  )}
                  {parsedSpec.ok && (
                    <p style={{ marginTop: '4px', fontSize: '11px', color: '#22c55e' }}>
                      Valid spec — kind: {parsedSpec.value.kind}
                    </p>
                  )}
                </div>
              )}
            </section>
          </div>

          {/* ── Right: Live preview + mutation preview ────────────────────── */}
          <div
            style={{
              background: 'var(--bg-canvas, #ffffff)',
              overflow: 'auto',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            {/* Live preview from current editor spec */}
            <section>
              <h3
                style={{
                  margin: '0 0 8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-muted, #64748b)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Live preview
              </h3>
              <div
                style={{
                  border: '1px dashed var(--border-subtle, #e2e8f0)',
                  borderRadius: '6px',
                  padding: '16px',
                  minHeight: '120px',
                  background: 'var(--bg-elevated, #f8fafc)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: 'var(--text-muted, #64748b)',
                  whiteSpace: 'pre-wrap',
                  overflow: 'auto',
                }}
              >
                {parsedSpec.ok
                  ? safeStringify(parsedSpec.value)
                  : `<invalid spec: ${parsedSpec.error}>`}
              </div>
            </section>

            {/* Pending mutation preview (from NLCL) */}
            {builder?.previewedPlan && (
              <section>
                <h3
                  style={{
                    margin: '0 0 8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-muted, #64748b)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  Pending mutation
                </h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {builder.previewedPlan.mutations.map((m, i) => (
                    <li
                      key={`${m.op}-${m.target}-${i}`}
                      style={{
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'flex-start',
                        padding: '8px',
                        border: '1px solid var(--border-subtle, #e2e8f0)',
                        borderRadius: '6px',
                        fontSize: '12px',
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 6px',
                          background: `${opColor(m.op)}22`,
                          color: opColor(m.op),
                          borderRadius: '3px',
                          fontWeight: 600,
                          fontSize: '10px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {m.op}
                      </span>
                      <code style={{ flex: 1, fontSize: '11px' }}>{m.target}</code>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted, #64748b)' }}>{m.provenance}</span>
                    </li>
                  ))}
                </ul>
                {builder.previewError && (
                  <p style={{ marginTop: '6px', fontSize: '12px', color: '#ef4444' }}>
                    {builder.previewError}
                  </p>
                )}
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={() => void handleApplyPreview()}
                    disabled={builder.applying || !!builder.previewError}
                    style={{
                      padding: '6px 14px',
                      background: 'var(--accent, #3b82f6)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 500,
                      opacity: builder.applying || !!builder.previewError ? 0.6 : 1,
                    }}
                  >
                    {builder.applying ? 'Applying…' : 'Apply mutation'}
                  </button>
                  <button
                    type="button"
                    onClick={() => builder.discardMutation()}
                    style={{
                      padding: '6px 14px',
                      background: 'transparent',
                      color: 'var(--text-muted, #64748b)',
                      border: '1px solid var(--border-subtle, #e2e8f0)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    Discard
                  </button>
                </div>
              </section>
            )}
          </div>
        </div>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            padding: '12px 20px',
            borderTop: '1px solid var(--border-subtle, #e2e8f0)',
            background: 'var(--bg-elevated, #f8fafc)',
          }}
        >
          <button
            type="button"
            onClick={handleReset}
            style={{
              padding: '8px 14px',
              background: 'transparent',
              color: 'var(--text-muted, #64748b)',
              border: '1px solid var(--border-subtle, #e2e8f0)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Reset
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 14px',
                background: 'transparent',
                color: 'var(--text-primary, #0f172a)',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleApply()}
              disabled={!parsedSpec.ok || (builder?.applying ?? false)}
              style={{
                padding: '8px 18px',
                background: 'var(--accent, #3b82f6)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                opacity: !parsedSpec.ok || (builder?.applying ?? false) ? 0.6 : 1,
              }}
            >
              {builder?.applying ? 'Applying…' : 'Apply spec'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Variant row sub-component ────────────────────────────────────────────────

function VariantRow({
  variant,
  isActive = false,
  onActivate,
  onDelete,
}: {
  variant: SurfaceVariant;
  isActive?: boolean;
  onActivate: () => void;
  onDelete?: () => void;
}) {
  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 8px',
        border: '1px solid var(--border-subtle, #e2e8f0)',
        borderRadius: '4px',
        background: isActive ? 'var(--accent, #3b82f6)10' : 'transparent',
      }}
    >
      <Icon name="layers" size={12} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--text-primary, #0f172a)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {variant.name}
          {variant.isLocked && (
            <Icon name="lock" size={10} style={{ marginLeft: '4px', display: 'inline' }} />
          )}
        </div>
        {variant.description && (
          <div
            style={{
              fontSize: '11px',
              color: 'var(--text-muted, #64748b)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {variant.description}
          </div>
        )}
      </div>
      {!isActive && (
        <button
          type="button"
          onClick={onActivate}
          title="Activate this variant"
          style={{
            padding: '2px 8px',
            background: 'transparent',
            border: '1px solid var(--border-subtle, #e2e8f0)',
            borderRadius: '3px',
            fontSize: '11px',
            cursor: 'pointer',
            color: 'var(--text-muted, #64748b)',
          }}
        >
          Activate
        </button>
      )}
      {onDelete && !variant.isLocked && (
        <button
          type="button"
          onClick={onDelete}
          title="Delete this variant"
          style={{
            padding: '2px 6px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: '#ef4444',
            fontSize: '11px',
          }}
        >
          <Icon name="trash-2" size={12} />
        </button>
      )}
    </li>
  );
}
