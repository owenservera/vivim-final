'use client';

/**
 * components/canvas/SlotNode.tsx
 * Wrapper that renders a resolved slot component inside the canvas.
 * Handles loading, error boundaries, and consistent node chrome.
 */

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { Icon } from './Icon';
import type { AnyComponent } from '@/sdk/canvas/register-slot';

interface EBProps { slotId: string; children: ReactNode }
interface EBState { hasError: boolean; error: Error | null }

class NodeErrorBoundary extends Component<EBProps, EBState> {
  state: EBState = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[SlotNode] "${this.props.slotId}" crashed:`, error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return <div style={{ padding: 12, fontSize: 11, color: '#ef4444', fontFamily: 'var(--font-mono)' }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Node failed</div>
        <div>{this.state.error?.message ?? 'unknown'}</div>
      </div>;
    }
    return this.props.children;
  }
}

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
    <NodeErrorBoundary slotId={slotId}>
      <div data-slot-node={slotId} data-source={source} data-provider={providerSlug ?? ''} style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--card)', overflow: 'hidden', ...style }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', height: 28, flexShrink: 0, borderBottom: collapsed ? 'none' : '1px solid var(--border)', background: 'var(--secondary)', fontSize: 10, fontWeight: 600, color: 'var(--foreground)' }}>
          <Icon name="layers" size={11} className="text-muted-foreground" />
          <span style={{ flex: 1 }}>{LABELS[slotId] ?? slotId}</span>
          {providerSlug && <span style={{ fontSize: 9, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }}>{providerSlug}</span>}
          {headerActions}
        </div>
        {!collapsed && <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }} className="scrollbar-thin">
          {loading ? <div style={{ padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 16, height: 16, border: '2px solid var(--border)', borderTopColor: 'var(--ring)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /></div> : <Comp {...componentProps} />}
        </div>}
      </div>
    </NodeErrorBoundary>
  );
}
