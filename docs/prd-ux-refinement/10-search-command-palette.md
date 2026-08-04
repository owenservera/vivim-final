# PRD #10: Search & Command Palette

## Problem Statement

Search and command palette are functional but lack polish:
- `CommandPalette.tsx` uses inline styles (should use unified design system)
- `SearchPanel.tsx` duplicates search logic
- No search history/recents
- No search filters (by type, by date, by provider)
- No search result previews
- No keyboard shortcut for search (Cmd+K exists but not documented)
- No search analytics (what users search for)

## Goals

1. **Unified search** — single search component used in both palette and panel
2. **Search history** — remember last 10 searches, show as suggestions
3. **Search filters** — filter by type (command, document, media, etc.), date, provider
4. **Search result previews** — preview content on hover
5. **Keyboard shortcuts** — Cmd+K for palette, Cmd+Shift+F for full search
6. **Search analytics** — track search queries for UX improvement

## Scope

| Area | Files | Action |
|------|-------|--------|
| Unified search | `UnifiedSearch.tsx` (new) — single component used in both palette and panel |
| Search history | `useSearchHistory.ts` (new) — hook: `{ history, addSearch, clearHistory }` |
| Search filters | `SearchFilters.tsx` (new) — filter by type, date, provider |
| Search preview | `SearchPreview.tsx` (new) — hover preview of search result |
| Keyboard shortcuts | Update `CommandPalette.tsx` — add Cmd+Shift+F for full search |
| Search analytics | `searchAnalytics.ts` (new) — track search queries |

## Non-Goals

- Full-text search across all content
- Search indexing/reindexing
- Search result ranking optimization

## Implementation Steps

### Step 1: Unified search
Create `components/search/UnifiedSearch.tsx` — single component with debounced search, results grouped by kind.

### Step 2: Search history
Create `hooks/useSearchHistory.ts` — localStorage-backed search history.

### Step 3: Search filters
Create `components/search/SearchFilters.tsx` — filter chips for type, date, provider.

### Step 4: Search preview
Create `components/search/SearchPreview.tsx` — hover preview showing content snippet.

### Step 5: Keyboard shortcuts
Update `CommandPalette.tsx` — add Cmd+Shift+F for full search panel.

### Step 6: Search analytics
Create `lib/searchAnalytics.ts` — track search queries to `/api/analytics/search`.

## Acceptance Criteria

- [ ] Single search component used in palette and panel
- [ ] Search history shows last 10 searches as suggestions
- [ ] Search filters work (type, date, provider)
- [ ] Search result preview shows on hover
- [ ] Cmd+K opens palette, Cmd+Shift+F opens full search
- [ ] Search queries tracked for analytics
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds

## Priority

**P2** — Improves search UX but not blocking core functionality.

## Estimated Effort

~3–4 hours. Unified component + history + filters + preview.
