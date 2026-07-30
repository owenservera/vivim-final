/**
 * HelpPanel.tsx
 * ---------------------------------------------------------------------------
 * Tab container for the help system: Search | Chat | Tours | Actions.
 *
 * Renders the active tab content and provides tab switching.
 */

'use client';

import { useState, type ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HelpTab = 'search' | 'chat' | 'tours' | 'actions';

interface HelpPanelProps {
  children: ReactNode;
  defaultTab?: HelpTab;
  onTabChange?: (tab: HelpTab) => void;
}

interface TabDef {
  id: HelpTab;
  label: string;
  icon: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TABS: TabDef[] = [
  { id: 'search', label: 'Search', icon: '🔍' },
  { id: 'chat', label: 'Chat', icon: '💬' },
  { id: 'tours', label: 'Tours', icon: '🎯' },
  { id: 'actions', label: 'Actions', icon: '⚡' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HelpPanel({ children, defaultTab = 'search', onTabChange }: HelpPanelProps) {
  const [activeTab, setActiveTab] = useState<HelpTab>(defaultTab);

  const handleTabClick = (tab: HelpTab) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  return (
    <div style={styles.container}>
      {/* Tab bar */}
      <div style={styles.tabBar} role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => handleTabClick(tab.id)}
            style={{
              ...styles.tab,
              ...(activeTab === tab.id ? styles.tabActive : {}),
            }}
          >
            <span style={styles.tabIcon}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={styles.content} role="tabpanel">
        {children}
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
    height: '100%',
    overflow: 'hidden',
  },
  tabBar: {
    display: 'flex',
    borderBottom: '1px solid var(--border, #e5e7eb)',
    backgroundColor: 'var(--bg-alt, #f9fafb)',
  },
  tab: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '10px 8px',
    fontSize: 13,
    fontWeight: 500,
    color: '#6b7280',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    transition: 'all 150ms',
  },
  tabActive: {
    color: '#3b82f6',
    borderBottomColor: '#3b82f6',
    backgroundColor: 'var(--bg, #ffffff)',
  },
  tabIcon: {
    fontSize: 14,
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: 16,
  },
};
