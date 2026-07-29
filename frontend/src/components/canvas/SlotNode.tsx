'use client';

/**
 * components/canvas/SlotNode.tsx
 * Wrapper that renders a resolved slot component inside the canvas.
 * Handles loading, error boundaries, and consistent node chrome.
 */

import { type ReactNode } from 'react';
import { Icon } from './Icon';
import { Spinner } from './Spinner';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import type { AnyComponent } from '@/sdk/canvas/register-slot';

export interface SlotNodeProps {
  slotId: string;
  component: AnyComponent;
  source: 'default' | 'provider' | 'capability';
  providerSlug?: string;
  collapsed?: boolean;
  loading?: boolean;
  componentProps?: Record<string, unknown>;
  headerActions?: ReactNode;
  style?: React.CSSProperties;
}

const LABELS: Record<string, string> = {
  'chat.header': 'Header', 'chat.sidebar': 'Sidebar', 'chat.thread': 'Thread',
  'chat.composer': 'Composer', 'chat.send': 'Send', 'chat.attach': 'Attach',
  'chat.streaming': 'Streaming', 'chat.result': 'Result', 'chat.confirm': 'Confirm',
  'chat.error': 'Error', 'chat.entry': 'Entry', 'chat.actionBar': 'Actions',
  'chat.bubble': 'Bubble',
};

export function SlotNode({ slotId, component: Comp, source, providerSlug, collapsed, loading, componentProps = {}, headerActions, style }: SlotNodeProps) {
  return (
    <ErrorBoundary name={slotId}>
      <div data-slot-node={slotId} data-source={source} data-provider={providerSlug ?? ''} style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--card)', overflow: 'hidden', ...style }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', height: 28, flexShrink: 0, borderBottom: collapsed ? 'none' : '1px solid var(--border)', background: 'var(--secondary)', fontSize: 10, fontWeight: 600, color: 'var(--foreground)' }}>
          <Icon name="layers" size={11} className="text-muted-foreground" />
          <span style={{ flex: 1 }}>{LABELS[slotId] ?? slotId}</span>
          {providerSlug && <span style={{ fontSize: 9, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }}>{providerSlug}</span>}
          {headerActions}
        </div>
        {!collapsed && <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }} className="scrollbar-thin">
          {loading ? <div style={{ padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner size={16} /></div> : <Comp {...componentProps} />}
        </div>}
      </div>
    </ErrorBoundary>
  );
}
