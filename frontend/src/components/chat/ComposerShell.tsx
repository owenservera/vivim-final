'use client';

import { useCallback, useEffect, useMemo, useRef, useState, createContext, useContext } from 'react';
import type {
  ComposerInstanceScope,
  ComposerShellContext,
  ModelOption,
  CapabilityToggle,
  Attachment,
  QuotedMessage,
  ComposerUserConfig,
} from '@/types/api';
import { sendMessage, getProviderCapabilities, listProviders } from '@/sdk/backend-client';
import { classify } from '@/ml/prerouter';
import { useMlStore } from '@/ml/ml-store';
import { BUILTIN_ADDONS } from '@/features/composer-addons';
import { TextEntryBox } from './TextEntryBox';
import { SendButton } from './SendButton';

// ── Context ──────────────────────────────────────────────────────────────

const ShellContext = createContext<ComposerShellContext | null>(null);

export function useComposerShellContext(): ComposerShellContext {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('useComposerShellContext must be used inside ComposerShell');
  return ctx;
}

// ── Default scope ────────────────────────────────────────────────────────

function generateInstanceId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function defaultChatScope(workspaceId = 'ws:global'): ComposerInstanceScope {
  return {
    workspaceId,
    surfaceSlug: 'chat',
    regionSlotId: 'chat.composer',
    activeZLayer: 'content',
    instanceId: generateInstanceId(),
    behavior: 'chat',
  };
}

// ── LocalStorage helpers ─────────────────────────────────────────────────

function loadConfig(instanceId: string): ComposerUserConfig {
  try {
    const raw = localStorage.getItem(`vivim:composer-addons:${instanceId}`);
    if (raw) return JSON.parse(raw) as ComposerUserConfig;
  } catch { /* corrupt or missing */ }
  return { enabledAddOns: [], showToggleMenu: false };
}

function saveConfig(instanceId: string, config: ComposerUserConfig): void {
  try {
    localStorage.setItem(`vivim:composer-addons:${instanceId}`, JSON.stringify(config));
  } catch { /* storage full or disabled */ }
}

// ── Behavior dispatch ────────────────────────────────────────────────────

type BehaviorResult = { ok: boolean; error?: string };

async function dispatchBehavior(
  behavior: ComposerInstanceScope['behavior'],
  text: string,
  conversationId: string | null,
): Promise<BehaviorResult> {
  switch (behavior) {
    case 'chat': {
      if (!conversationId) return { ok: false, error: 'No active conversation' };
      const res = await sendMessage(conversationId, text).catch(() => null);
      if (!res) return { ok: false, error: 'Send failed (network error)' };
      return { ok: res.ok, error: res.error };
    }
    default: {
      console.log(`[ComposerShell] behavior=${behavior} text="${text}" (stub)`);
      return { ok: true };
    }
  }
}

// ── Props ────────────────────────────────────────────────────────────────

interface ComposerShellProps {
  scope: ComposerInstanceScope;
  conversationId: string | null;
  providerId: string | null;
  onSendResult?: (ok: boolean, error?: string) => void;
  onStreamingChange?: (streaming: boolean) => void;
  children?: React.ReactNode;
}

// ── Component ────────────────────────────────────────────────────────────

export function ComposerShell({
  scope,
  conversationId,
  providerId,
  onSendResult,
  onStreamingChange,
}: ComposerShellProps) {
  const [draft, setDraft] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [config, setConfig] = useState<ComposerUserConfig>(() => loadConfig(scope.instanceId));

  // Add-on state
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelOption | null>(null);
  const [capabilities, setCapabilities] = useState<CapabilityToggle[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [quotedMessage, setQuotedMessage] = useState<QuotedMessage | null>(null);

  // Persist config on change
  useEffect(() => {
    saveConfig(scope.instanceId, config);
  }, [config, scope.instanceId]);

  // Fetch models from provider
  useEffect(() => {
    if (!providerId) return;
    let cancelled = false;
    (async () => {
      const res = await listProviders().catch(() => null);
      if (!res?.ok || cancelled) return;
      const provider = (res.data?.providers ?? []).find((p: { id: string }) => p.id === providerId);
      if (provider) {
        const rawModels = (provider as Record<string, unknown>).modelsJson;
        const parsed: ModelOption[] = typeof rawModels === 'string'
          ? (JSON.parse(rawModels) as ModelOption[])
          : [];
        if (!cancelled) {
          setModels(parsed);
          if (parsed.length > 0 && !selectedModel) setSelectedModel(parsed[0]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [providerId]);

  // Fetch capabilities from provider
  useEffect(() => {
    if (!providerId) return;
    let cancelled = false;
    (async () => {
      const res = await getProviderCapabilities(providerId, 'free').catch(() => null);
      if (!res?.ok || cancelled) return;
      const caps = (res.data?.capabilities ?? []).map((c: { slug: string; name?: string }) => ({
        slug: c.slug,
        name: c.name ?? c.slug,
        enabled: false,
      }));
      if (!cancelled) setCapabilities(caps);
    })();
    return () => { cancelled = true; };
  }, [providerId]);

  // Stop streaming
  const stopStreaming = useCallback(() => {
    setIsStreaming(false);
    onStreamingChange?.(false);
  }, [onStreamingChange]);

  // Toggle add-ons
  const toggleAddOn = useCallback((key: string) => {
    setConfig((prev) => {
      const exists = prev.enabledAddOns.includes(key);
      return {
        ...prev,
        enabledAddOns: exists
          ? prev.enabledAddOns.filter((k) => k !== key)
          : [...prev.enabledAddOns, key],
      };
    });
  }, []);

  // Toggle gear menu
  const toggleGearMenu = useCallback(() => {
    setConfig((prev) => ({ ...prev, showToggleMenu: !prev.showToggleMenu }));
  }, []);

  // Submit handler
  const handleSubmit = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setIsStreaming(true);
    onStreamingChange?.(true);

    // ML prerouter classify
    const route = classify(text);
    if (route.route === 'local' && route.action) {
      useMlStore.getState().recordLocalAction();
    }

    const result = await dispatchBehavior(scope.behavior, text, conversationId);
    setIsStreaming(false);
    onStreamingChange?.(false);
    onSendResult?.(result.ok, result.error);
    if (result.ok) setDraft('');
  }, [scope.behavior, conversationId, onSendResult, onStreamingChange]);

  // Build context for add-ons
  const shellContext = useMemo<ComposerShellContext>(() => ({
    scope,
    providerId,
    models,
    selectedModel,
    setModel: setSelectedModel,
    capabilities,
    toggleCapability: (slug: string) => {
      setCapabilities((prev) =>
        prev.map((c) => (c.slug === slug ? { ...c, enabled: !c.enabled } : c)),
      );
    },
    attachments,
    addAttachment: (file: File) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      setAttachments((prev) => [...prev, { id, file }]);
    },
    removeAttachment: (id: string) => {
      setAttachments((prev) => prev.filter((a) => a.id !== id));
    },
    quotedMessage,
    setQuote: setQuotedMessage,
    isStreaming,
    stopStreaming,
    enabledAddOns: config.enabledAddOns,
    toggleAddOn,
  }), [scope, providerId, models, selectedModel, capabilities, attachments, quotedMessage, isStreaming, stopStreaming, config.enabledAddOns, toggleAddOn]);

  // Group add-ons by position
  const topAddOns = BUILTIN_ADDONS.filter(
    (a) => a.position === 'top' && config.enabledAddOns.includes(a.key),
  );
  const bottomAddOns = BUILTIN_ADDONS.filter(
    (a) => a.position === 'bottom' && config.enabledAddOns.includes(a.key),
  );

  const send = useCallback(() => {
    if (draft.trim()) handleSubmit(draft.trim());
  }, [draft, handleSubmit]);

  return (
    <ShellContext.Provider value={shellContext}>
      <div
        style={{
          borderTop: '1px solid var(--border)',
        }}
      >
        {/* Top add-ons (model selector, capability chips, quote bar) */}
        {topAddOns.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px 0',
              flexWrap: 'wrap',
            }}
          >
            {topAddOns.map((addOn) => (
              <addOn.Component key={addOn.key} context={shellContext} />
            ))}
          </div>
        )}

        {/* Input row: textarea + send button */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: 10,
          }}
        >
          <TextEntryBox
            value={draft}
            onChange={setDraft}
            onSubmit={handleSubmit}
            placeholder={
              scope.behavior === 'chat' ? 'Message...' :
              scope.behavior === 'search' ? 'Search...' :
              scope.behavior === 'prompt' ? 'What should the agent do?' :
              scope.behavior === 'command' ? 'Type a command...' :
              scope.behavior === 'comment' ? 'Add a comment...' :
              'Message...'
            }
          />
          <SendButton onClick={send} disabled={!draft.trim()} />
        </div>

        {/* Bottom add-ons (streaming bar, footer hints, attachment preview) */}
        {bottomAddOns.length > 0 && (
          <div>
            {bottomAddOns.map((addOn) => (
              <addOn.Component key={addOn.key} context={shellContext} />
            ))}
          </div>
        )}

        {/* Gear toggle menu */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: '0 10px 4px',
          }}
        >
          <button
            type="button"
            onClick={toggleGearMenu}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 16,
              padding: 2,
              fontFamily: 'inherit',
            }}
            title="Toggle add-ons"
          >
            ⚙
          </button>
        </div>

        {config.showToggleMenu && (
          <div
            style={{
              padding: '6px 10px 8px',
              borderTop: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
            }}
          >
            {BUILTIN_ADDONS.map((addOn) => (
              <label
                key={addOn.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '3px 0',
                  fontSize: 12,
                  color: 'var(--text)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={config.enabledAddOns.includes(addOn.key)}
                  onChange={() => toggleAddOn(addOn.key)}
                />
                {addOn.icon && <span>{addOn.icon}</span>}
                {addOn.label}
              </label>
            ))}
          </div>
        )}
      </div>
    </ShellContext.Provider>
  );
}
