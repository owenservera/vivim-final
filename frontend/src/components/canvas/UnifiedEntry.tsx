'use client';

/**
 * components/canvas/UnifiedEntry.tsx
 * --------------------------------------------------------------------
 * Single entry point for all user input. Merges CommandBar navigation
 * + MasterComposer text input into one floating bar.
 *
 * Features:
 *   - Always visible (even with no conversation)
 *   - Layer-aware behavior routing (chat/prompt/command)
 *   - Creates conversation on first submit if none exists
 *   - Glass-morphism floating bar at top-center
 *   - Auto-expanding textarea (1 → 4 lines)
 *   - Cmd+K opens search, Cmd+. toggles panels
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIO } from './UnifiedIOProvider';
import { useSessionState } from './SessionStateProvider';
import { getLayerConfig } from './TabConfig';
import { dispatchBehavior, type Behavior } from '../../shared/dispatch-behavior';
import { Icon, type IconName } from './Icon';

interface UnifiedEntryProps {
  workspaceId: string;
  conversationId: string | null;
  providerId: string | null;
  createConversation?: (providerId?: string) => Promise<{ id: string } | null>;
  onConversationCreated?: (id: string) => void;
  onOpenSearch?: () => void;
  onOpenMenu?: () => void;
  onOpenAssistant?: () => void;
  onTogglePanel?: (panelId: string) => void;
}

const LAYER_COLORS: Record<string, string> = {
  chat: 'var(--layer-chat, #3b82f6)',
  build: 'var(--layer-build, #22c55e)',
  admin: 'var(--layer-admin, #ef4444)',
};

const LAYER_LABELS: Record<string, string> = {
  chat: 'Chat',
  build: 'Build',
  admin: 'Admin',
};

const LAYER_PLACEHOLDERS: Record<string, string> = {
  chat: 'Message...',
  build: 'Enter a prompt...',
  admin: 'Enter a command...',
};

export function UnifiedEntry({
  workspaceId,
  conversationId,
  providerId,
  createConversation,
  onConversationCreated,
  onOpenSearch,
  onOpenMenu,
  onOpenAssistant,
  onTogglePanel,
}: UnifiedEntryProps) {
  const io = useIO();
  const { state } = useSessionState();
  const layerConfig = useMemo(() => getLayerConfig(state.activeLayer), [state.activeLayer]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [draft, setDraft] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeLayer = state.activeLayer;
  const layerColor = LAYER_COLORS[activeLayer] ?? LAYER_COLORS.chat;
  const layerLabel = LAYER_LABELS[activeLayer] ?? 'Chat';
  const placeholder = conversationId
    ? LAYER_PLACEHOLDERS[activeLayer] ?? 'Message...'
    : 'Ask Vivim anything...';

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 20), 120)}px`;
  }, [draft]);

  // Clear error after 3s
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 3000);
    return () => clearTimeout(t);
  }, [error]);

  const handleSubmit = useCallback(async () => {
    const text = draft.trim();
    if (!text || isStreaming) return;

    setIsStreaming(true);
    setError(null);

    try {
      // If no conversation, create one first
      let activeConvId = conversationId;
      if (!activeConvId && activeLayer === 'chat') {
        if (createConversation) {
          const conv = await createConversation(providerId ?? undefined);
          activeConvId = conv?.id ?? null;
        } else {
          // Fallback: raw API call
          const res = await io.post<{ id: string }>(
            '/api/conversations',
            { providerId: providerId ?? undefined },
          );
          activeConvId = res.data?.id ?? null;
        }

        if (activeConvId) {
          onConversationCreated?.(activeConvId);
        } else {
          setError('Failed to create conversation');
          setIsStreaming(false);
          return;
        }
      }

      const behavior: Behavior = layerConfig.chatBehavior as Behavior;
      const result = await dispatchBehavior(behavior, text, activeConvId, io);

      if (result.ok) {
        setDraft('');
      } else {
        setError(result.error ?? 'Failed to send');
      }
    } catch {
      setError('Network error');
    } finally {
      setIsStreaming(false);
    }
  }, [draft, isStreaming, conversationId, activeLayer, layerConfig.chatBehavior, io, providerId, createConversation, onConversationCreated]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Cmd+K → search (capture before submit)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenSearch?.();
        return;
      }
      // Enter → submit (unless Shift for newline)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit, onOpenSearch],
  );

  return (
    <div
      style={{
        position: 'fixed',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '4px 6px',
        background: 'color-mix(in oklch, var(--card) 85%, transparent)',
        backdropFilter: 'blur(12px) saturate(1.2)',
        WebkitBackdropFilter: 'blur(12px) saturate(1.2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
        maxWidth: 'calc(100vw - 24px)',
        width: 560,
      }}
    >
      {/* Logo */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 6px',
          cursor: 'default',
          flexShrink: 0,
        }}
      >
        <Icon name="layers" size={14} className="text-primary" />
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '-0.02em' }}>Vivim</span>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 2px', flexShrink: 0 }} />

      {/* Text input */}
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={isStreaming}
        rows={1}
        style={{
          flex: 1,
          resize: 'none',
          padding: '6px 8px',
          border: 'none',
          borderRadius: 6,
          background: 'transparent',
          color: 'var(--text)',
          fontSize: 13,
          fontFamily: 'inherit',
          lineHeight: 1.4,
          minHeight: 20,
          maxHeight: 120,
          outline: 'none',
          opacity: isStreaming ? 0.5 : 1,
        }}
      />

      {/* Layer badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 8px',
          borderRadius: 6,
          background: `color-mix(in oklch, ${layerColor} 15%, transparent)`,
          color: layerColor,
          fontSize: 10,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          flexShrink: 0,
          cursor: 'default',
        }}
        title={`Current layer: ${layerLabel} (${layerConfig.chatBehavior})`}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: layerColor,
          }}
        />
        {layerLabel}
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 2px', flexShrink: 0 }} />

      {/* Search button */}
      <NavButton
        icon="search"
        label="Search (Cmd+K)"
        onClick={() => onOpenSearch?.()}
      />

      {/* Panel toggles */}
      {onTogglePanel && (
        <>
          <NavButton icon="message-square" label="Conversations" onClick={() => onTogglePanel('conversations')} />
          <NavButton icon="cpu" label="Providers" onClick={() => onTogglePanel('providers')} />
          <NavButton icon="activity" label="Health" onClick={() => onTogglePanel('health')} />
          <NavButton icon="grid" label="Capabilities" onClick={() => onTogglePanel('capabilities')} />
          <NavButton icon="settings" label="Settings" onClick={() => onTogglePanel('settings')} />
        </>
      )}

      {/* Divider */}
      <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 2px', flexShrink: 0 }} />

      {/* Assistant trigger */}
      {onOpenAssistant && (
        <NavButton icon="chat" label="Assistant (Cmd+Shift+H)" onClick={onOpenAssistant} />
      )}

      {/* Menu button */}
      <NavButton icon="menu" label="Menu" onClick={() => onOpenMenu?.()} />

      {/* Error toast */}
      {error && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginTop: 6,
            padding: '4px 10px',
            borderRadius: 6,
            background: 'var(--destructive, #ef4444)',
            color: '#fff',
            fontSize: 11,
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(0,0,0,0.16)',
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

// ── Nav button helper ──────────────────────────────────────────────────────

function NavButton({
  icon,
  label,
  onClick,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      aria-label={label}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 32,
        border: 'none',
        background: 'transparent',
        color: 'var(--muted-foreground)',
        borderRadius: 6,
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background 0.15s ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--muted)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <Icon name={icon} size={14} />
    </button>
  );
}
