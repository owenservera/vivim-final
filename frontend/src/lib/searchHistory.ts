// frontend/src/lib/searchHistory.ts
// localStorage-backed search history with recency dedup.

const STORAGE_KEY = 'vivim-search-history'
const MAX_HISTORY = 20

export interface SearchHistoryEntry {
  query: string
  timestamp: number
}

export function getSearchHistory(): SearchHistoryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function addSearchHistory(query: string): void {
  if (typeof window === 'undefined' || !query.trim()) return
  const history = getSearchHistory().filter((e) => e.query !== query)
  history.unshift({ query: query.trim(), timestamp: Date.now() })
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
  } catch {
    // localStorage full or blocked — silent
  }
}

export function clearSearchHistory(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // silent
  }
}
