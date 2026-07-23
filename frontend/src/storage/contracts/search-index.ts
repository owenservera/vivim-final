/**
 * storage/contracts/search-index.ts
 * --------------------------------------------------------------------
 * #2 Universal Search — search index contract.
 * Fuzzy search across all entities.
 */

import type { SearchHit, SearchQuery, SearchResponse } from '../../shared/search';

export interface SearchIndex {
  /** Index a single document. */
  index(hit: SearchHit): Promise<void>;
  /** Index many documents (bulk). */
  indexMany(hits: SearchHit[]): Promise<void>;
  /** Remove a document from the index. */
  remove(kind: SearchHit['kind'], id: string): Promise<void>;
  /** Search the index. */
  search(query: SearchQuery): Promise<SearchResponse>;
  /** Clear the index. */
  clear(): Promise<void>;
  /** Total indexed documents. */
  size(): number;
}
