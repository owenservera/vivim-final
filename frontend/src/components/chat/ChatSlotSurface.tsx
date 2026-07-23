'use client';

/**
 * components/chat/ChatSlotSurface.tsx
 * --------------------------------------------------------------------
 * Resolves all 13 chat.* slots via the SDK registry and renders
 * the resolved component for each slot position.
 *
 * This is the bridge between the slot system (sdk/canvas/register-slot)
 * and the actual chat UI. It replaces the hard-coded ChatSurface layout
 * with a slot-driven composition.
 *
 * Resolution precedence: capabilitySlug > providerSlug > default.
 */

import { useMemo, Component, type ReactNode, type ErrorInfo } from 'react';
import { resolveSlot, type AnyComponent } from '@/sdk/canvas/register-slot';
import type { SlotId } from '@/ui/slots';

// ── Slot context ────────────────────────────────────────────────────────────

export interface SlotContext {
  providerSlug: string;
  capabilitySlug?: string;
  /** Current conversation ID (if any). */
  conversationId?: string;
  /** Current conversation title (if any). */
  conversationTitle?: string;
  /** Active workspace ID. */
  workspaceId?: string;
}

// ── Slot positions in the chat layout ───────────────────────────────────────

interface ChatSlotSurfaceProps {
  /** Current provider slug (e.g. 'chatgpt', 'claude'). */
  providerSlug: string;
  /** Optional active capability slug for bespoke resolution. */
  capabilitySlug?: string;
  /** Props to forward to each resolved component. */
  slotProps?: Record<string, Record<string, unknown>>;
  /** Current conversation ID (if any). */
  conversationId?: string;
  /** Current conversation title (if any). */
  conversationTitle?: string;
  /** Active workspace ID. */
  workspaceId?: string;
}

// ── Slot layout definition ──────────────────────────────────────────────────

const SLOT_POSITIONS: Array<{
  slot: SlotId;
  area: string;
  style?: React.CSSProperties;
}> = [
  { slot: 'chat.header', area: 'header' },
  { slot: 'chat.sidebar', area: 'sidebar' },
  { slot: 'chat.thread', area: 'thread' },
  { slot: 'chat.composer', area: 'composer' },
  { slot: 'chat.actionBar', area: 'actionBar' },
  { slot: 'chat.entry', area: 'entry' },
  { slot: 'chat.bubble', area: 'bubble' },
  { slot: 'chat.send', area: 'send' },
  { slot: 'chat.attach', area: 'attach' },
  { slot: 'chat.streaming', area: 'streaming' },
  { slot: 'chat.result', area: 'result' },
  { slot: 'chat.confirm', area: 'confirm' },
  { slot: 'chat.error', area: 'error' },
];

// ── Error boundary for slot rendering ────────────────────────────────────────

interface ErrorBoundaryProps {
  slot: string;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class SlotErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ChatSlotSurface] Slot "${this.props.slot}" crashed:`, error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: 8,
            margin: 4,
            borderRadius: 6,
            border: '1px solid #ef4444',
            background: 'rgba(239,68,68,0.06)',
            color: '#ef4444',
            fontSize: 11,
            fontFamily: 'ui-monospace, monospace',
          }}
        >
          Slot "{this.props.slot}" failed: {this.state.error?.message ?? 'unknown error'}
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Render a resolved slot ──────────────────────────────────────────────────

function ResolvedSlot({
  slot,
  component: Component,
  source,
  props,
}: {
  slot: string;
  component: AnyComponent;
  source: string;
  props?: Record<string, unknown>;
}) {
  if (!Component) return null;

  return (
    <div
      data-slot={slot}
      data-slot-source={source}
      style={{ minWidth: 0, minHeight: 0, height: '100%' }}
    >
      <Component {...(props ?? {})} />
    </div>
  );
}

function SlotSkeleton() {
  return (
    <div style={{ padding: 8 }}>
      <div style={{ height: 12, width: '60%', borderRadius: 4, background: 'var(--muted)', animation: 'pulse 1.5s infinite', marginBottom: 6 }} />
      <div style={{ height: 8, width: '90%', borderRadius: 4, background: 'var(--muted)', animation: 'pulse 1.5s infinite', marginBottom: 4 }} />
      <div style={{ height: 8, width: '75%', borderRadius: 4, background: 'var(--muted)', animation: 'pulse 1.5s infinite' }} />
      <style>{`@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }`}</style>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function ChatSlotSurface({
  providerSlug,
  capabilitySlug,
  slotProps = {},
  conversationId,
  conversationTitle,
  workspaceId,
}: ChatSlotSurfaceProps) {
  const ctx: SlotContext = useMemo(
    () => ({ providerSlug, capabilitySlug, conversationId, conversationTitle, workspaceId }),
    [providerSlug, capabilitySlug, conversationId, conversationTitle, workspaceId],
  );

  // Resolve all slots
  const resolved = useMemo(() => {
    const results: Record<
      string,
      { component: AnyComponent; source: string } | null
    > = {};

    for (const pos of SLOT_POSITIONS) {
      try {
        const r = resolveSlot(pos.slot, ctx);
        results[pos.slot] = { component: r.component, source: r.source };
      } catch (e) {
        console.warn(`[ChatSlotSurface] Failed to resolve slot ${pos.slot}:`, e);
        results[pos.slot] = null;
      }
    }

    return results;
  }, [ctx]);

  // Count resolved slots for dynamic grid
  const resolvedCount = Object.values(resolved).filter(Boolean).length;
  const hasSidebar = !!resolved['chat.sidebar'];
  const hasComposer = !!resolved['chat.composer'];

  // Dynamic grid: hide columns with no resolved slots
  const gridTemplateColumns = [
    hasSidebar ? 'minmax(200px, 260px)' : '0px',
    '1fr',
    hasComposer ? 'minmax(200px, 260px)' : '0px',
  ].join(' ');

  const gridTemplateAreas = hasSidebar
    ? `'header header header' 'sidebar thread composer' 'sidebar actionBar actionBar'`
    : `'header header header' 'thread thread composer' 'thread thread actionBar'`;

  return (
    <div
      data-chat-slots="true"
      data-provider={providerSlug}
      data-capability={capabilitySlug ?? ''}
      data-resolved-slots={resolvedCount}
      style={{
        display: 'grid',
        gridTemplateColumns,
        gridTemplateRows: 'auto 1fr auto',
        gridTemplateAreas,
        height: '100%',
        width: '100%',
        minHeight: 0,
        fontFamily: 'ui-sans-serif, system-ui',
        background: 'var(--bg)',
        color: 'var(--text)',
      }}
    >
      {/* Header slot */}
      <div style={{ gridArea: 'header', borderBottom: '1px solid var(--border)' }}>
        {resolved['chat.header'] && (
          <SlotErrorBoundary slot="chat.header">
            <ResolvedSlot
              slot="chat.header"
              component={resolved['chat.header']!.component}
              source={resolved['chat.header']!.source}
              props={slotProps['chat.header']}
            />
          </SlotErrorBoundary>
        )}
      </div>

      {/* Sidebar slot */}
      <div
        style={{
          gridArea: 'sidebar',
          borderRight: '1px solid var(--border)',
          minHeight: 0,
          overflowY: 'auto',
        }}
      >
        {resolved['chat.sidebar'] && (
          <SlotErrorBoundary slot="chat.sidebar">
            <ResolvedSlot
              slot="chat.sidebar"
              component={resolved['chat.sidebar']!.component}
              source={resolved['chat.sidebar']!.source}
              props={slotProps['chat.sidebar']}
            />
          </SlotErrorBoundary>
        )}
      </div>

      {/* Thread slot — includes streaming + bubble inner slots */}
      <div style={{ gridArea: 'thread', minHeight: 0, overflowY: 'auto', position: 'relative' }}>
        {resolved['chat.streaming'] && (
          <SlotErrorBoundary slot="chat.streaming">
            <ResolvedSlot
              slot="chat.streaming"
              component={resolved['chat.streaming']!.component}
              source={resolved['chat.streaming']!.source}
              props={slotProps['chat.streaming']}
            />
          </SlotErrorBoundary>
        )}
        {resolved['chat.result'] && (
          <SlotErrorBoundary slot="chat.result">
            <ResolvedSlot
              slot="chat.result"
              component={resolved['chat.result']!.component}
              source={resolved['chat.result']!.source}
              props={slotProps['chat.result']}
            />
          </SlotErrorBoundary>
        )}
        {resolved['chat.thread'] && (
          <SlotErrorBoundary slot="chat.thread">
            <ResolvedSlot
              slot="chat.thread"
              component={resolved['chat.thread']!.component}
              source={resolved['chat.thread']!.source}
              props={slotProps['chat.thread']}
            />
          </SlotErrorBoundary>
        )}
      </div>

      {/* Composer slot — includes send + attach inner slots */}
      <div style={{ gridArea: 'composer', minHeight: 0, display: 'flex' }}>
        {resolved['chat.attach'] && (
          <SlotErrorBoundary slot="chat.attach">
            <ResolvedSlot
              slot="chat.attach"
              component={resolved['chat.attach']!.component}
              source={resolved['chat.attach']!.source}
              props={slotProps['chat.attach']}
            />
          </SlotErrorBoundary>
        )}
        {resolved['chat.composer'] && (
          <SlotErrorBoundary slot="chat.composer">
            <ResolvedSlot
              slot="chat.composer"
              component={resolved['chat.composer']!.component}
              source={resolved['chat.composer']!.source}
              props={slotProps['chat.composer']}
            />
          </SlotErrorBoundary>
        )}
        {resolved['chat.send'] && (
          <SlotErrorBoundary slot="chat.send">
            <ResolvedSlot
              slot="chat.send"
              component={resolved['chat.send']!.component}
              source={resolved['chat.send']!.source}
              props={slotProps['chat.send']}
            />
          </SlotErrorBoundary>
        )}
      </div>

      {/* Action bar slot */}
      <div
        style={{
          gridArea: 'actionBar',
          borderTop: '1px solid var(--border)',
          minHeight: 0,
        }}
      >
        {resolved['chat.actionBar'] && (
          <SlotErrorBoundary slot="chat.actionBar">
            <ResolvedSlot
              slot="chat.actionBar"
              component={resolved['chat.actionBar']!.component}
              source={resolved['chat.actionBar']!.source}
              props={slotProps['chat.actionBar']}
            />
          </SlotErrorBoundary>
        )}
      </div>

      {/* Overlay slots — confirm + error render as overlays */}
      {resolved['chat.confirm'] && (
        <SlotErrorBoundary slot="chat.confirm">
          <ResolvedSlot
            slot="chat.confirm"
            component={resolved['chat.confirm']!.component}
            source={resolved['chat.confirm']!.source}
            props={slotProps['chat.confirm']}
          />
        </SlotErrorBoundary>
      )}
      {resolved['chat.error'] && (
        <SlotErrorBoundary slot="chat.error">
          <ResolvedSlot
            slot="chat.error"
            component={resolved['chat.error']!.component}
            source={resolved['chat.error']!.source}
            props={slotProps['chat.error']}
          />
        </SlotErrorBoundary>
      )}

      {/* chat.entry — hidden, used as registration target */}
      {resolved['chat.entry'] && (
        <SlotErrorBoundary slot="chat.entry">
          <ResolvedSlot
            slot="chat.entry"
            component={resolved['chat.entry']!.component}
            source={resolved['chat.entry']!.source}
            props={slotProps['chat.entry']}
          />
        </SlotErrorBoundary>
      )}
    </div>
  );
}
