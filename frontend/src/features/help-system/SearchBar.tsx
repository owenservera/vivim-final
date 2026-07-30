/**
 * SearchBar.tsx
 * ---------------------------------------------------------------------------
 * Capability-registry-powered instant search bar for the help system.
 *
 * Features:
 *   - Debounced input (300ms)
 *   - Instant results from NLCL backend (5-layer intent resolution)
 *   - Result cards with title, description, category, confidence
 *   - Keyboard navigation (arrow keys, Enter to select)
 *   - "Ask AI" button to switch to AIChat
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { CapabilitySearchResult } from './useCapabilitySearch';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchBarProps {
  onResultClick: (result: CapabilitySearchResult) => void;
  onAskAI?: (query: string) => void;
  searchFn: (query: string) => Promise<CapabilitySearchResult[]>;
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function highlightMatch(text: string, query: string): string {
  if (!query) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

function getScoreColor(score: number): string {
  if (score >= 0.8) return '#22c55e'; // green
  if (score >= 0.6) return '#eab308'; // yellow
  return '#6b7280'; // gray
}

function getTypeIcon(type: string): string {
  switch (type) {
    case 'capability': return '⚡';
    case 'guide': return '📖';
    case 'help': return '❓';
    default: return '📄';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SearchBar({ onResultClick, onAskAI, searchFn, loading }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CapabilitySearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search
  const handleSearch = useCallback(
    (value: string) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      if (!value.trim()) {
        setResults([]);
        return;
      }

      debounceRef.current = setTimeout(async () => {
        const searchResults = await searchFn(value);
        setResults(searchResults);
        setSelectedIndex(-1);
      }, 300);
    },
    [searchFn]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          onResultClick(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setResults([]);
        inputRef.current?.blur();
        break;
    }
  };

  return (
    <div style={styles.container}>
      {/* Search Input */}
      <div style={styles.inputWrapper}>
        <svg style={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx={11} cy={11} r={8} />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            handleSearch(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search docs, guides, commands..."
          style={styles.input}
          aria-label="Search help documentation"
        />
        {loading && <div style={styles.spinner} />}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div style={styles.results}>
          {results.map((result, idx) => (
            <button
              key={result.id}
              onClick={() => onResultClick(result)}
              style={{
                ...styles.resultCard,
                ...(idx === selectedIndex ? styles.resultCardSelected : {}),
              }}
              aria-selected={idx === selectedIndex}
            >
              <div style={styles.resultHeader}>
                <span style={styles.resultSource}>
                  {getTypeIcon(result.type)} {result.category || result.type}
                </span>
                <span style={{ ...styles.resultScore, color: getScoreColor(result.confidence) }}>
                  {Math.round(result.confidence * 100)}%
                </span>
              </div>
              <div style={styles.resultTitle}>{result.title}</div>
              <div
                style={styles.resultSnippet}
                dangerouslySetInnerHTML={{
                  __html: highlightMatch(result.description.slice(0, 200), query),
                }}
              />
            </button>
          ))}

          {/* Ask AI button */}
          {onAskAI && query && (
            <button onClick={() => onAskAI(query)} style={styles.askAIButton}>
              Ask AI about &ldquo;{query.slice(0, 30)}{query.length > 30 ? '...' : ''}&rdquo;
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {query && !loading && results.length === 0 && (
        <div style={styles.empty}>
          <p>No results found for &ldquo;{query}&rdquo;</p>
          {onAskAI && (
            <button onClick={() => onAskAI(query)} style={styles.askAIButton}>
              Ask AI instead
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
    width: '100%',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: 12,
    width: 18,
    height: 18,
    color: '#6b7280',
    pointerEvents: 'none',
  },
  input: {
    width: '100%',
    padding: '12px 12px 12px 40px',
    fontSize: 14,
    fontFamily: 'inherit',
    border: '1px solid var(--border, #e5e7eb)',
    borderRadius: 8,
    outline: 'none',
    backgroundColor: 'var(--bg, #ffffff)',
    color: 'var(--text, #111827)',
    transition: 'border-color 150ms',
  },
  spinner: {
    position: 'absolute',
    right: 12,
    width: 16,
    height: 16,
    border: '2px solid #e5e7eb',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'spin 0.6s linear infinite',
  },
  results: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    maxHeight: 400,
    overflowY: 'auto',
    backgroundColor: 'var(--bg, #ffffff)',
    border: '1px solid var(--border, #e5e7eb)',
    borderRadius: 8,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    zIndex: 50,
  },
  resultCard: {
    display: 'block',
    width: '100%',
    padding: '12px 16px',
    textAlign: 'left',
    border: 'none',
    borderBottom: '1px solid var(--border, #f3f4f6)',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    transition: 'background-color 100ms',
  },
  resultCardSelected: {
    backgroundColor: 'var(--accent-bg, #f3f4f6)',
  },
  resultHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  resultSource: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: 'monospace',
  },
  resultScore: {
    fontSize: 11,
    fontWeight: 600,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--text, #111827)',
    marginBottom: 4,
  },
  resultSnippet: {
    fontSize: 13,
    color: 'var(--text, #374151)',
    lineHeight: 1.5,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  askAIButton: {
    display: 'block',
    width: '100%',
    padding: '10px 16px',
    textAlign: 'left',
    fontSize: 13,
    color: '#3b82f6',
    backgroundColor: '#eff6ff',
    border: 'none',
    borderTop: '1px solid var(--border, #e5e7eb)',
    cursor: 'pointer',
    transition: 'background-color 100ms',
  },
  empty: {
    padding: '20px 16px',
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 13,
  },
};
