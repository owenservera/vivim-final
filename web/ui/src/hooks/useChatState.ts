'use client';

/**
 * hooks/useChatState.ts
 * --------------------------------------------------------------------
 * Custom hook for chat message state management.
 * Extracted from page.tsx to reduce monolith complexity.
 */

import { useState, useCallback } from 'react';
import type { SearchHit } from '@/shared/search';
import type { AccountContext, PlanTier } from '@/shared/route-context';
import { executeCapability } from '@/sdk/backend-client';

export interface ChatStateOptions {
  workspaceId: string;
  providerIds: string[];
  setProviderIds: (ids: string[]) => void;
  accounts: AccountContext[];
  setAccounts: (accounts: AccountContext[]) => void;
  setWorkspace: (id: string) => void;
}

export interface ChatStateReturn {
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  themeOpen: boolean;
  setThemeOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  capResult: string | null;
  setCapResult: (result: string | null) => void;
  activeSurface: string;
  setActiveSurface: (surface: string) => void;
  toggleProvider: (id: string) => void;
  cycleTier: (providerId: string) => void;
  handlePaletteAction: (hit: SearchHit) => void;
}

const TIER_OPTIONS: PlanTier[] = ['free', 'trial', 'pro', 'enterprise'];

export function useChatState({
  workspaceId,
  providerIds,
  setProviderIds,
  accounts,
  setAccounts,
  setWorkspace,
}: ChatStateOptions): ChatStateReturn {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [capResult, setCapResult] = useState<string | null>(null);
  const [activeSurface, setActiveSurface] = useState('chat');

  const toggleProvider = useCallback((id: string) => {
    const isOn = providerIds.includes(id);
    if (isOn) {
      const next = providerIds.filter((p) => p !== id);
      setProviderIds(next);
      setAccounts(accounts.filter((a) => a.providerId !== id));
    } else {
      setProviderIds([...providerIds, id]);
      setAccounts([
        ...accounts,
        { accountId: `acct:${id}:free`, providerId: id, planTier: 'free' },
      ]);
    }
  }, [providerIds, accounts, setProviderIds, setAccounts]);

  const cycleTier = useCallback((providerId: string) => {
    setAccounts(
      accounts.map((a) => {
        if (a.providerId !== providerId) return a;
        const idx = TIER_OPTIONS.indexOf(a.planTier as typeof TIER_OPTIONS[number]);
        const next = TIER_OPTIONS[(idx + 1) % TIER_OPTIONS.length]!;
        return { ...a, planTier: next };
      }),
    );
  }, [accounts, setAccounts]);

  const handlePaletteAction = useCallback((hit: SearchHit) => {
    if (!hit.actionUrl) return;
    if (hit.actionUrl.startsWith('capability:')) {
      const capabilityId = hit.actionUrl.slice('capability:'.length);
      executeCapability(capabilityId)
        .then((res) => {
          setCapResult(res.ok ? `✓ ${hit.title}` : `✗ ${hit.title}: ${res.error}`);
          setTimeout(() => setCapResult(null), 3000);
        })
        .catch((e) => setCapResult(`✗ ${hit.title} error: ${String(e)}`));
      return;
    }
    if (hit.actionUrl.startsWith('switch-surface:')) {
      const surface = hit.actionUrl.slice('switch-surface:'.length);
      setActiveSurface(surface);
    } else if (hit.actionUrl.startsWith('shell:')) {
      const cmd = hit.actionUrl.slice('shell:'.length);
      setActiveSurface('shell');
      try {
        window.localStorage.setItem('vivim.shell.pendingCommand', cmd);
      } catch {
        // ignore
      }
    } else if (hit.actionUrl.startsWith('workspace:')) {
      const wsId = hit.actionUrl.slice('workspace:'.length);
      setWorkspace(wsId);
    }
  }, [setWorkspace]);

  return {
    paletteOpen,
    setPaletteOpen,
    themeOpen,
    setThemeOpen,
    capResult,
    setCapResult,
    activeSurface,
    setActiveSurface,
    toggleProvider,
    cycleTier,
    handlePaletteAction,
  };
}
