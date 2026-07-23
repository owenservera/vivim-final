import { describe, expect, test, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { useConversation } from '@/sdk/web/use-conversation';
import { useCapability } from '@/sdk/web/use-capability';
import { useSession } from '@/sdk/web/use-session';
import { useHealth } from '@/sdk/web/use-health';

vi.mock('@/components/canvas/UnifiedIOProvider', () => ({
  useIO: vi.fn(),
}));

import { useIO } from '@/components/canvas/UnifiedIOProvider';

function mockIO(overrides: Record<string, unknown> = {}) {
  const listeners = new Set<(_event: unknown) => void>();
  (useIO as ReturnType<typeof vi.fn>).mockReturnValue({
    get: vi.fn(),
    post: vi.fn(),
    request: vi.fn(),
    on: (l: (_event: unknown) => void) => { listeners.add(l); return () => listeners.delete(l); },
    ...overrides,
  } as unknown as ReturnType<typeof useIO>);
}

describe('useConversation', () => {
  test('refresh loads conversations', async () => {
    mockIO({
      get: vi.fn().mockResolvedValue({ data: { conversations: [{ id: '1', title: 'Test', createdAt: '2026-01-01' }] } }),
    });
    const { result } = renderHook(() => useConversation());

    await act(async () => { await result.current.refresh(); });

    expect(result.current.conversations).toHaveLength(1);
    expect(result.current.error).toBeNull();
    expect((useIO().get as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('/api/conversations');
  });

  test('create adds conversation to list', async () => {
    const newConv = { id: '2', title: 'New', createdAt: '2026-01-02' };
    mockIO({
      get: vi.fn().mockResolvedValue({ data: { conversations: [] } }),
      post: vi.fn().mockResolvedValue({ data: newConv }),
    });
    const { result } = renderHook(() => useConversation());

    await act(async () => { await result.current.create('chatgpt'); });

    expect(result.current.conversations).toHaveLength(1);
    expect(result.current.conversations[0].id).toBe('2');
  });

  test('remove filters conversation', async () => {
    mockIO({
      get: vi.fn().mockResolvedValue({ data: { conversations: [{ id: '1', title: 'Test', createdAt: '2026-01-01' }] } }),
      request: vi.fn().mockResolvedValue({ ok: true }),
    });
    const { result } = renderHook(() => useConversation());

    await act(async () => { await result.current.refresh(); });
    await act(async () => { await result.current.remove('1'); });

    expect(result.current.conversations).toHaveLength(0);
  });
});

describe('useCapability', () => {
  test('refresh loads capabilities', async () => {
    const caps = [{ id: 'cap-1', slug: 'send_message', name: 'Send' }];
    mockIO({
      get: vi.fn().mockResolvedValue({ data: { capabilities: caps } }),
    });
    const { result } = renderHook(() => useCapability('cli'));

    await act(async () => { await result.current.refresh(); });

    expect(result.current.capabilities).toEqual(caps);
    expect(useIO().get).toHaveBeenCalledWith('/api/capabilities?surface=cli');
  });

  test('execute calls capability endpoint', async () => {
    mockIO({
      post: vi.fn().mockResolvedValue({ data: { success: true } }),
    });
    const { result } = renderHook(() => useCapability());

    const out = await result.current.execute('cap:send_message:send', { text: 'hi' });

    expect(out).toEqual({ success: true });
    expect(useIO().post).toHaveBeenCalledWith('/api/capabilities/cap%3Asend_message%3Asend/execute', { text: 'hi' });
  });
});

describe('useSession', () => {
  test('getSession loads session', async () => {
    mockIO({
      get: vi.fn().mockResolvedValue({ data: { authenticated: true, userId: 'u1', email: 'a@b.com' } }),
    });
    const { result } = renderHook(() => useSession());

    await act(async () => { await result.current.getSession(); });

    expect(result.current.session.authenticated).toBe(true);
    expect(result.current.session.email).toBe('a@b.com');
  });

  test('login sets session', async () => {
    mockIO({
      post: vi.fn().mockResolvedValue({ data: { authenticated: true, userId: 'u1', email: 'a@b.com' } }),
    });
    const { result } = renderHook(() => useSession());

    await act(async () => { await result.current.login('a@b.com', 'pw'); });

    expect(result.current.session.authenticated).toBe(true);
  });
});

describe('useHealth', () => {
  test('check loads health', async () => {
    mockIO({
      get: vi.fn().mockResolvedValue({ data: { status: 'ok', version: '1.0' } }),
    });
    const { result } = renderHook(() => useHealth());

    await act(async () => { await result.current.check(); });

    expect(result.current.health?.status).toBe('ok');
    expect(result.current.error).toBeNull();
  });
});
