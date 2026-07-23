/**
 * storage/impl/memory-search-index.ts
 * --------------------------------------------------------------------
 * In-memory SearchIndex with simple fuzzy matching (subsequence + word
 * boundary bonus). Production swaps in a real inverted index (lunr,
 * flexsearch, or a SQLite FTS5 table) with the same contract.
 */

import type { SearchHit, SearchQuery, SearchResponse, SearchEntityKind } from '../../shared/search';
import type { SearchIndex } from '../contracts/search-index';

interface IndexedDoc {
  hit: SearchHit;
  /** Lowercased title + subtitle for matching. */
  haystack: string;
  /** Tokenized words for word-boundary bonus. */
  words: string[];
}

export class MemorySearchIndex implements SearchIndex {
  private docs = new Map<string, IndexedDoc>(); // key: `${kind}|${id}`

  async index(hit: SearchHit): Promise<void> {
    const key = `${hit.kind}|${hit.id}`;
    const haystack = `${hit.title} ${hit.subtitle ?? ''}`.toLowerCase();
    this.docs.set(key, {
      hit,
      haystack,
      words: haystack.split(/\s+/).filter(Boolean),
    });
  }

  async indexMany(hits: SearchHit[]): Promise<void> {
    for (const h of hits) await this.index(h);
  }

  async remove(kind: SearchEntityKind, id: string): Promise<void> {
    this.docs.delete(`${kind}|${id}`);
  }

  async search(query: SearchQuery): Promise<SearchResponse> {
    const startedAt = Date.now();
    const q = query.text.trim().toLowerCase();
    const perKindLimit = query.perKindLimit ?? 5;
    const totalLimit = query.limit ?? 30;

    if (!q) {
      return { query: query.text, hits: [], counts: {} as Record<SearchEntityKind, number>, durationMs: 0 };
    }

    const qWords = q.split(/\s+/).filter(Boolean);
    const byKind = new Map<SearchEntityKind, SearchHit[]>();
    const counts = {} as Record<SearchEntityKind, number>;

    for (const doc of this.docs.values()) {
      // Filter by kinds if specified.
      if (query.kinds && !query.kinds.includes(doc.hit.kind)) continue;

      // Score: subsequence match + word-boundary bonus + prefix bonus.
      let score = 0;
      const allMatch = qWords.every((qw) => doc.haystack.includes(qw));
      if (!allMatch) continue;

      // Base score: title contains query.
      if (doc.hit.title.toLowerCase().includes(q)) score += 0.5;

      // Word-boundary bonus.
      for (const qw of qWords) {
        for (const w of doc.words) {
          if (w === qw) score += 0.3;
          else if (w.startsWith(qw)) score += 0.15;
        }
      }

      // Prefix bonus (title starts with query).
      if (doc.hit.title.toLowerCase().startsWith(q)) score += 0.2;

      // Clamp 0..1.
      score = Math.min(1, score);

      const bucket = byKind.get(doc.hit.kind) ?? [];
      bucket.push({ ...doc.hit, score });
      byKind.set(doc.hit.kind, bucket);
      counts[doc.hit.kind] = (counts[doc.hit.kind] ?? 0) + 1;
    }

    // Sort each bucket by score desc, take perKindLimit.
    const hits: SearchHit[] = [];
    for (const [kind, bucket] of byKind) {
      bucket.sort((a, b) => b.score - a.score);
      hits.push(...bucket.slice(0, perKindLimit));
    }

    // Sort all hits by score desc, take totalLimit.
    hits.sort((a, b) => b.score - a.score);
    const finalHits = hits.slice(0, totalLimit);

    return {
      query: query.text,
      hits: finalHits,
      counts,
      durationMs: Date.now() - startedAt,
    };
  }

  async clear(): Promise<void> {
    this.docs.clear();
  }

  size(): number {
    return this.docs.size;
  }
}
