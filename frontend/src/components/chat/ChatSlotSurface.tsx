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

import { useMemo } from 'react';
import { resolveSlot, type AnyComponent } from '@/sdk/canvas/register-slot';
import { ErrorBoundary } from '@/components/ErrorBoundary';
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
      data-name={slot}
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
        // [audit] removed: console.warn(`[ChatSlotSurface] Failed to resolve slot ${pos.slot}:`, e);
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
          <ErrorBoundary name="chat.header">
            <ResolvedSlot
              slot="chat.header"
              component={resolved['chat.header']!.component}
              source={resolved['chat.header']!.source}
              props={slotProps['chat.header']}
            />
          </ErrorBoundary>
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
          <ErrorBoundary name="chat.sidebar">
            <ResolvedSlot
              slot="chat.sidebar"
              component={resolved['chat.sidebar']!.component}
              source={resolved['chat.sidebar']!.source}
              props={slotProps['chat.sidebar']}
            />
          </ErrorBoundary>
        )}
      </div>

      {/* Thread slot — includes streaming + bubble inner slots */}
      <div style={{ gridArea: 'thread', minHeight: 0, overflowY: 'auto', position: 'relative' }}>
        {resolved['chat.streaming'] && (
          <ErrorBoundary name="chat.streaming">
            <ResolvedSlot
              slot="chat.streaming"
              component={resolved['chat.streaming']!.component}
              source={resolved['chat.streaming']!.source}
              props={slotProps['chat.streaming']}
            />
          </ErrorBoundary>
        )}
        {resolved['chat.result'] && (
          <ErrorBoundary name="chat.result">
            <ResolvedSlot
              slot="chat.result"
              component={resolved['chat.result']!.component}
              source={resolved['chat.result']!.source}
              props={slotProps['chat.result']}
            />
          </ErrorBoundary>
        )}
        {resolved['chat.thread'] && (
          <ErrorBoundary name="chat.thread">
            <ResolvedSlot
              slot="chat.thread"
              component={resolved['chat.thread']!.component}
              source={resolved['chat.thread']!.source}
              props={slotProps['chat.thread']}
            />
          </ErrorBoundary>
        )}
      </div>

      {/* Composer slot — includes send + attach inner slots */}
      <div style={{ gridArea: 'composer', minHeight: 0, display: 'flex' }}>
        {resolved['chat.attach'] && (
          <ErrorBoundary name="chat.attach">
            <ResolvedSlot
              slot="chat.attach"
              component={resolved['chat.attach']!.component}
              source={resolved['chat.attach']!.source}
              props={slotProps['chat.attach']}
            />
          </ErrorBoundary>
        )}
        {resolved['chat.composer'] && (
          <ErrorBoundary name="chat.composer">
            <ResolvedSlot
              slot="chat.composer"
              component={resolved['chat.composer']!.component}
              source={resolved['chat.composer']!.source}
              props={slotProps['chat.composer']}
            />
          </ErrorBoundary>
        )}
        {resolved['chat.send'] && (
          <ErrorBoundary name="chat.send">
            <ResolvedSlot
              slot="chat.send"
              component={resolved['chat.send']!.component}
              source={resolved['chat.send']!.source}
              props={slotProps['chat.send']}
            />
          </ErrorBoundary>
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
          <ErrorBoundary name="chat.actionBar">
            <ResolvedSlot
              slot="chat.actionBar"
              component={resolved['chat.actionBar']!.component}
              source={resolved['chat.actionBar']!.source}
              props={slotProps['chat.actionBar']}
            />
          </ErrorBoundary>
        )}
      </div>

      {/* Overlay slots — confirm + error render as overlays */}
      {resolved['chat.confirm'] && (
        <ErrorBoundary name="chat.confirm">
          <ResolvedSlot
            slot="chat.confirm"
            component={resolved['chat.confirm']!.component}
            source={resolved['chat.confirm']!.source}
            props={slotProps['chat.confirm']}
          />
        </ErrorBoundary>
      )}
      {resolved['chat.error'] && (
        <ErrorBoundary name="chat.error">
          <ResolvedSlot
            slot="chat.error"
            component={resolved['chat.error']!.component}
            source={resolved['chat.error']!.source}
            props={slotProps['chat.error']}
          />
        </ErrorBoundary>
      )}

      {/* chat.entry — hidden, used as registration target */}
      {resolved['chat.entry'] && (
        <ErrorBoundary name="chat.entry">
          <ResolvedSlot
            slot="chat.entry"
            component={resolved['chat.entry']!.component}
            source={resolved['chat.entry']!.source}
            props={slotProps['chat.entry']}
          />
        </ErrorBoundary>
      )}
    </div>
  );
}
