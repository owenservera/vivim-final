'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useIO } from '@/components/canvas/UnifiedIOProvider';
import type { Conversation } from '@/types/api';

export function useConversation() {
  const io = useIO();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await io.get<Conversation[]>('/api/conversations');
      if (!mountedRef.current) return;
      const raw = res.data;
      setConversations(Array.isArray(raw) ? raw : (raw as { conversations?: Conversation[] }).conversations ?? []);
    } catch (e) {
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load conversations');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [io]);

  // R3-05: Auto-fetch conversations on mount
  useEffect(() => { refresh(); }, [refresh]);

  const create = useCallback(async (providerId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await io.post<Conversation>('/api/conversations', { providerId });
      if (!mountedRef.current) return null;
      const conv = res.data;
      // R3-09: Defensive parsing — ensure response has required fields
      if (!conv || typeof conv !== 'object' || !('id' in conv) || typeof (conv as Conversation).id !== 'string') {
        setError('Invalid conversation response from server');
        return null;
      }
      setConversations(prev => [conv as Conversation, ...prev]);
      return conv as Conversation;
    } catch (e) {
      if (!mountedRef.current) return null;
      setError(e instanceof Error ? e.message : 'Failed to create conversation');
      return null;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [io]);

  const remove = useCallback(async (conversationId: string): Promise<string | null> => {
    setLoading(true);
    setError(null);
    try {
      await io.request(`/api/conversations/${encodeURIComponent(conversationId)}`, { method: 'DELETE' });
      if (!mountedRef.current) return null;
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      return conversationId;
    } catch (e) {
      if (!mountedRef.current) return null;
      setError(e instanceof Error ? e.message : 'Failed to delete conversation');
      return null;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [io]);

  return { conversations, loading, error, refresh, create, remove };
}
