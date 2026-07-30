/**
 * QuickActions.tsx
 * ---------------------------------------------------------------------------
 * Pre-built guided flows for common tasks. Each action launches a guide
 * or executes a capability directly.
 *
 * Actions:
 *   - Add Provider: Walk through provider setup
 *   - Send Message: Quick message to a provider
 *   - Switch Model: Change the active model
 *   - View Conversations: Open conversation history
 *   - Explore Capabilities: Browse available capabilities
 */

'use client';

import { useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: string;
  mode: 'guide' | 'execute';
  command?: string;
  capability?: string;
  category: 'setup' | 'chat' | 'explore';
}

interface QuickActionsProps {
  onExecute: (action: QuickAction) => void;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

const ACTIONS: QuickAction[] = [
  {
    id: 'add-provider',
    label: 'Add Provider',
    description: 'Set up a new AI provider (ChatGPT, Claude, Gemini, etc.)',
    icon: '🔌',
    mode: 'guide',
    category: 'setup',
  },
  {
    id: 'send-message',
    label: 'Send Message',
    description: 'Send a message to any connected provider',
    icon: '💬',
    mode: 'guide',
    category: 'chat',
  },
  {
    id: 'switch-model',
    label: 'Switch Model',
    description: 'Change the active AI model',
    icon: '🔄',
    mode: 'execute',
    capability: 'select_model',
    category: 'chat',
  },
  {
    id: 'view-conversations',
    label: 'View Conversations',
    description: 'Browse your chat history',
    icon: '📋',
    mode: 'execute',
    capability: 'list_conversations',
    category: 'explore',
  },
  {
    id: 'explore-capabilities',
    label: 'Explore Capabilities',
    description: 'See all available commands and features',
    icon: '⚡',
    mode: 'guide',
    category: 'explore',
  },
  {
    id: 'keyboard-shortcuts',
    label: 'Keyboard Shortcuts',
    description: 'Learn the essential keyboard shortcuts',
    icon: '⌨️',
    mode: 'guide',
    category: 'explore',
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QuickActions({ onExecute }: QuickActionsProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = [
    { id: 'setup', label: 'Setup' },
    { id: 'chat', label: 'Chat' },
    { id: 'explore', label: 'Explore' },
  ];

  const filteredActions = selectedCategory
    ? ACTIONS.filter((a) => a.category === selectedCategory)
    : ACTIONS;

  return (
    <div style={styles.container}>
      {/* Category filter */}
      <div style={styles.categories}>
        <button
          onClick={() => setSelectedCategory(null)}
          style={{
            ...styles.categoryButton,
            ...(selectedCategory === null ? styles.categoryActive : {}),
          }}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            style={{
              ...styles.categoryButton,
              ...(selectedCategory === cat.id ? styles.categoryActive : {}),
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Actions grid */}
      <div style={styles.grid}>
        {filteredActions.map((action) => (
          <button
            key={action.id}
            onClick={() => onExecute(action)}
            style={styles.actionCard}
          >
            <span style={styles.actionIcon}>{action.icon}</span>
            <div style={styles.actionContent}>
              <span style={styles.actionLabel}>{action.label}</span>
              <span style={styles.actionDescription}>{action.description}</span>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={styles.actionArrow}>
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  categories: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  categoryButton: {
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 500,
    borderRadius: 6,
    backgroundColor: 'var(--bg-alt, #f3f4f6)',
    color: '#6b7280',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 100ms',
  },
  categoryActive: {
    backgroundColor: '#3b82f6',
    color: '#ffffff',
  },
  grid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  actionCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
    backgroundColor: 'var(--bg, #ffffff)',
    border: '1px solid var(--border, #e5e7eb)',
    borderRadius: 8,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 100ms',
  },
  actionIcon: {
    fontSize: 20,
    flexShrink: 0,
  },
  actionContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--text, #111827)',
  },
  actionDescription: {
    fontSize: 12,
    color: '#6b7280',
  },
  actionArrow: {
    width: 16,
    height: 16,
    color: '#9ca3af',
    flexShrink: 0,
  },
};
