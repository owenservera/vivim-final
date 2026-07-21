// web/ui/src/ml/capabilities.ts
// Declares the ML capabilities as UnifiedCapabilities with surfaces:['ui'] (R8 / G5),
// and provides a host-side handler so sandboxes can consume them through the
// existing CapabilityBus (they MUST NOT import @litertjs/core directly).
//
// These capabilities are frontend-only. They are documented here so the
// cross-surface parity tooling (devops verify-cross-surface) can see them, and
// so a future backend wiring has a single source of truth.

import { useMlStore } from './ml-store';
import { useMediaStore } from './media-runtime';
import { classify } from './prerouter';

export interface MlCapabilityDef {
  capId: string;
  slug: string;
  surfaces: string[];
  description: string;
}

export const ML_CAPABILITIES: MlCapabilityDef[] = [
  { capId: 'cap:ml:embed', slug: 'ml_embed', surfaces: ['ui'], description: 'Embed a string into a vector' },
  { capId: 'cap:ml:rerank', slug: 'ml_rerank', surfaces: ['ui'], description: 'Re-rank candidates by query embedding' },
  { capId: 'cap:ml:preroute', slug: 'ml_preroute', surfaces: ['ui'], description: 'Classify NL phrase as local/remote' },
  { capId: 'cap:ml:caption', slug: 'ml_caption', surfaces: ['ui'], description: 'Local image labels/caption' },
];

export interface CapabilityRequest {
  capability: string;
  input: Record<string, unknown>;
}

export interface CapabilityResponse {
  ok: boolean;
  output?: unknown;
  error?: string;
}

/**
 * Host-side handler for `cap:ml:*` requests coming over the CapabilityBus.
 * Returns an error result (never throws) so the sandbox gets a clean deny.
 */
export async function handleMlCapability(req: CapabilityRequest): Promise<CapabilityResponse> {
  try {
    switch (req.capability) {
      case 'cap:ml:embed': {
        const text = String(req.input.text ?? '');
        const vector = await useMlStore.getState().embed(text);
        if (!vector) return { ok: false, error: 'ml runtime unavailable' };
        return { ok: true, output: { vector } };
      }
      case 'cap:ml:rerank': {
        const query = String(req.input.query ?? '');
        const candidates = (req.input.candidates as { id: string; text: string }[]) ?? [];
        const qVec = await useMlStore.getState().embed(query);
        if (!qVec) return { ok: false, error: 'ml runtime unavailable' };
        // Lazy import cosine to avoid a server path.
        const { cosine } = await import('./embed-runtime');
        const ranked = candidates
          .map((c) => ({ id: c.id, score: 0 }))
          .sort((a, b) => b.score - a.score);
        // Compute similarity for each candidate's text.
        const scored = await Promise.all(
          candidates.map(async (c) => {
            const v = await useMlStore.getState().embed(c.text);
            return { id: c.id, score: v ? cosine(qVec, v) : 0 };
          }),
        );
        void ranked;
        return { ok: true, output: { ranked: scored.sort((a, b) => b.score - a.score) } };
      }
      case 'cap:ml:preroute': {
        const phrase = String(req.input.phrase ?? '');
        const result = classify(phrase);
        if (result.route === 'local') useMlStore.getState().recordLocalAction();
        return { ok: true, output: result };
      }
      case 'cap:ml:caption': {
        const imageDataUrl = String(req.input.imageDataUrl ?? '');
        const labels = await useMediaStore.getState().label(imageDataUrl);
        return { ok: true, output: { labels } };
      }
      default:
        return { ok: false, error: `unknown ml capability: ${req.capability}` };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'ml capability failed' };
  }
}
