// web/ui/src/components/canvas/RelatedNodes.tsx
// canvas.related slot — re-ranks knowledge-graph search results locally
// using LiteRT.js embeddings (R4 / G2). Runs ONLY on the host canvas.
//
// Flow: fetch server results via searchKnowledge -> embed query + each
// candidate -> cosine re-rank -> render top-K with a 'local' source badge.
// On ML unavailability, silently falls back to server order.

'use client';

import { useEffect, useState } from 'react';
import { searchKnowledge } from '@/sdk/backend-client';
import { useMlStore } from '@/ml/ml-store';
import { cosine } from '@/ml/embed-runtime';

interface KnowledgeResult {
  id: string;
  content: string;
  source?: string;
  score?: number;
}

interface RankedRelated {
  id: string;
  title: string;
  score: number;
  source: 'local' | 'server';
}

export function RelatedNodes({ query }: { query?: string }) {
  const [items, setItems] = useState<RankedRelated[]>([]);
  const [loading, setLoading] = useState(false);
  const status = useMlStore((s) => s.status);
  const q = query ?? 'related';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      const serverRes = await searchKnowledge(q).catch(() => null);
      const results: KnowledgeResult[] = serverRes?.data?.results ?? [];
      if (cancelled) return;

      // Attempt local re-rank.
      const rt = await useMlStore.getState().embed(q).catch(() => null);
      if (rt && results.length) {
        const scored = await Promise.all(
          results.map(async (r) => {
            const v = await useMlStore.getState().embed(r.content).catch(() => null);
            return { id: r.id, title: r.content.slice(0, 80), score: v ? cosine(rt, v) : r.score ?? 0 };
          }),
        );
        if (!cancelled) {
          setItems(scored.sort((a, b) => b.score - a.score).map((s) => ({ ...s, source: 'local' as const })));
        }
      } else if (!cancelled) {
        // Fallback: server order.
        setItems(
          results.map((r) => ({ id: r.id, title: r.content.slice(0, 80), score: r.score ?? 0, source: 'server' as const })),
        );
      }
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [q]);

  return (
    <div data-slot="canvas.related" style={{ padding: 12, fontSize: 13 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Related</div>
      {loading && <div style={{ opacity: 0.6 }}>loading…</div>}
      {!loading && items.length === 0 && <div style={{ opacity: 0.6 }}>no related nodes</div>}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
        {items.map((it) => (
          <li
            key={it.id}
            style={{
              border: '1px solid var(--border, #333)',
              borderRadius: 6,
              padding: '6px 8px',
              display: 'flex',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</span>
            <span
              style={{
                fontSize: 10,
                opacity: 0.7,
                border: '1px solid var(--border, #333)',
                borderRadius: 4,
                padding: '0 4px',
              }}
            >
              {it.source}
            </span>
          </li>
        ))}
      </ul>
      {status === 'ready' && (
        <div style={{ marginTop: 8, fontSize: 10, opacity: 0.5 }}>local re-rank · {useMlStore.getState().backend}</div>
      )}
    </div>
  );
}
