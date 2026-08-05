/**
 * shared/search.ts
 * --------------------------------------------------------------------
 * #2 Universal Search — fuzzy search across all entities.
 * Single box, ranked results.
 */

export type SearchEntityKind =
  | 'command' // shell command
  | 'document'
  | 'media'
  | 'automation'
  | 'agent'
  | 'workspace'
  | 'provider'
  | 'capability'
  | 'notification'
  | 'panel'

export interface SearchHit {
  kind: SearchEntityKind
  id: string
  title: string
  subtitle?: string
  /** Match score 0..1 (higher = better). */
  score: number
  /** The URL or action to invoke when selected. */
  actionUrl?: string
  actionLabel?: string
  /** Icon (emoji). */
  icon: string
}

export interface SearchQuery {
  text: string
  /** Filter by entity kind. */
  kinds?: SearchEntityKind[]
  /** Workspace scope. */
  workspaceId?: string
  /** Max results per kind. */
  perKindLimit?: number
  /** Total max results. */
  limit?: number
}

export interface SearchResponse {
  query: string
  hits: SearchHit[]
  /** Per-kind counts (before per-kind limit). */
  counts: Record<SearchEntityKind, number>
  durationMs: number
}
