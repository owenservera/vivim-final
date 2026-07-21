// web/ui/src/ml/prerouter.ts
// NL pre-router (v1: deterministic heuristic; model slot reserved).
//
// Classifies a natural-language phrase as a LOCAL action (handled on the
// client without a remote provider round-trip) or REMOTE (route to
// /api/interpret). Low confidence -> remote. This is the Composer seam (G3):
// it runs before useInterpret()/sendMessage and, when local, increments the
// dev counter and may short-circuit.

export interface PrerouteResult {
  route: 'local' | 'remote';
  action?: string;
  confidence: number; // [0,1]; < 0.5 -> remote
}

// Intent -> local action keyword map. Extend as local capabilities grow.
const LOCAL_INTENTS: { action: string; patterns: RegExp }[] = [
  { action: 'select_model', patterns: /\b(switch|change|set|use)\b.*\b(model|provider)\b|\bmodel\b.*\b(switch|change)\b/i },
  { action: 'open_canvas', patterns: /\b(open|show|goto|focus)\b.*\b(canvas|graph|node)\b/i },
  { action: 'list_conversations', patterns: /\b(list|show|my)\b.*\b(conversations?|chats?)\b/i },
  { action: 'clear_chat', patterns: /\b(clear|reset|empty)\b.*\b(chat|conversation)\b/i },
];

/** Heuristic classification. Deterministic, zero ML cost. */
export function classify(phrase: string): PrerouteResult {
  const text = phrase.trim();
  if (!text) return { route: 'remote', confidence: 0 };

  for (const intent of LOCAL_INTENTS) {
    if (intent.patterns.test(text)) {
      // Confidence scales with phrase length signal; capped below 1 to stay
      // conservative so ambiguous input still falls through to remote.
      const confidence = Math.min(0.95, 0.6 + Math.min(text.length, 40) / 200);
      return { route: 'local', action: intent.action, confidence };
    }
  }
  return { route: 'remote', confidence: 0 };
}
