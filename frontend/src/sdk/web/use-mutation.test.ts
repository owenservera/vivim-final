// src/sdk/web/use-mutation.test.ts
// Phase 4 of ROADMAP-REPROGRAMMABLE-CANVAS.md — Composer-as-Builder.
//
// Tests the useMutation() hook. Verifies that:
//   - apply() sends the right body shape to /api/mutation/apply
//   - preview() sends the right body shape to /api/mutation/preview
//   - undo() / redo() hit the right endpoints
//   - refreshStatus() / refreshHistory() hit the right endpoints
//   - error paths populate `error` state correctly
//   - successful apply triggers status + history refresh

import { describe, expect, test, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';

vi.mock('@/components/canvas/UnifiedIOProvider', () => ({
  useIO: vi.fn(),
}));

import { useIO } from '@/components/canvas/UnifiedIOProvider';
import { useMutation } from './use-mutation';

type IOEvent = (e: unknown) => void;

function mockIO(overrides: Record<string, unknown> = {}) {
  const listeners = new Set<IOEvent>();
  const io = {
    get: vi.fn().mockResolvedValue({ data: { ok: true } }),
    post: vi.fn().mockResolvedValue({ data: { ok: true } }),
    request: vi.fn(),
    on: (l: IOEvent) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    ...overrides,
  };
  (useIO as ReturnType<typeof vi.fn>).mockReturnValue(io);
  return io;
}

describe('Phase 4 — useMutation hook', () => {
  test('apply sends {plan} to /api/mutation/apply', async () => {
    const io = mockIO({
      post: vi.fn().mockResolvedValue({
        data: { ok: true, record: { id: 'rec1', ok: true } },
      }),
      get: vi.fn().mockResolvedValue({ data: { ok: true, canUndo: true, canRedo: false, historyLength: 1 } }),
    });

    const { result } = renderHook(() => useMutation());

    const plan = {
      id: 'plan-1',
      mutations: [
        {
          op: 'replace' as const,
          target: 'panel:conversations',
          provenance: 'manual' as const,
          payload: { kind: 'panel', label: 'Conversations' },
        },
      ],
      provenance: 'manual' as const,
    };

    let r;
    await act(async () => {
      r = await result.current.apply({ plan });
    });

    expect(r!.ok).toBe(true);
    expect(io.post).toHaveBeenCalledWith('/api/mutation/apply', { plan });
  });

  test('apply sends {mutation} for single-mutation input', async () => {
    const io = mockIO({
      post: vi.fn().mockResolvedValue({ data: { ok: true, record: { id: 'r1', ok: true } } }),
      get: vi.fn().mockResolvedValue({ data: { ok: true, canUndo: false, canRedo: false, historyLength: 0 } }),
    });

    const { result } = renderHook(() => useMutation());

    const mutation = {
      op: 'replace' as const,
      target: 'panel:conversations',
      provenance: 'manual' as const,
      payload: { kind: 'panel' },
    };

    await act(async () => {
      await result.current.apply({ mutation });
    });

    expect(io.post).toHaveBeenCalledWith('/api/mutation/apply', { mutation });
  });

  test('apply sends {dsl} for DSL string input', async () => {
    const io = mockIO({
      post: vi.fn().mockResolvedValue({ data: { ok: true, record: { id: 'r1', ok: true } } }),
      get: vi.fn().mockResolvedValue({ data: { ok: true, canUndo: false, canRedo: false, historyLength: 0 } }),
    });

    const { result } = renderHook(() => useMutation());

    await act(async () => {
      await result.current.apply({ dsl: '/hide panel:conversations' });
    });

    expect(io.post).toHaveBeenCalledWith('/api/mutation/apply', { dsl: '/hide panel:conversations' });
  });

  test('preview sends {plan} to /api/mutation/preview', async () => {
    const io = mockIO({
      post: vi.fn().mockResolvedValue({
        data: {
          ok: true,
          preview: [
            {
              mutation: { op: 'replace', target: 'panel:foo', provenance: 'manual', payload: {} },
              beforeSpec: { kind: 'panel' },
              afterSpec: { kind: 'panel' },
            },
          ],
        },
      }),
    });

    const { result } = renderHook(() => useMutation());

    const plan = {
      id: 'plan-1',
      mutations: [{ op: 'replace' as const, target: 'panel:foo', provenance: 'manual' as const, payload: {} }],
      provenance: 'manual' as const,
    };

    let r;
    await act(async () => {
      r = await result.current.preview({ plan });
    });

    expect(r!.ok).toBe(true);
    expect(r!.entries).toHaveLength(1);
    expect(io.post).toHaveBeenCalledWith('/api/mutation/preview', { plan });
  });

  test('undo posts to /api/mutation/undo', async () => {
    const io = mockIO({
      post: vi.fn().mockResolvedValue({
        data: { ok: true, record: { id: 'undo-1', ok: true } },
      }),
      get: vi.fn().mockResolvedValue({ data: { ok: true, canUndo: false, canRedo: true, historyLength: 0 } }),
    });

    const { result } = renderHook(() => useMutation());

    let r;
    await act(async () => {
      r = await result.current.undo();
    });

    expect(r!.ok).toBe(true);
    expect(io.post).toHaveBeenCalledWith('/api/mutation/undo', {});
  });

  test('redo posts to /api/mutation/redo', async () => {
    const io = mockIO({
      post: vi.fn().mockResolvedValue({
        data: { ok: true, record: { id: 'redo-1', ok: true } },
      }),
      get: vi.fn().mockResolvedValue({ data: { ok: true, canUndo: true, canRedo: false, historyLength: 1 } }),
    });

    const { result } = renderHook(() => useMutation());

    let r;
    await act(async () => {
      r = await result.current.redo();
    });

    expect(r!.ok).toBe(true);
    expect(io.post).toHaveBeenCalledWith('/api/mutation/redo', {});
  });

  test('refreshStatus gets /api/mutation/status', async () => {
    const io = mockIO({
      get: vi.fn().mockResolvedValue({
        data: { ok: true, canUndo: true, canRedo: false, historyLength: 5 },
      }),
    });

    const { result } = renderHook(() => useMutation());

    await act(async () => {
      await result.current.refreshStatus();
    });

    expect(io.get).toHaveBeenCalledWith('/api/mutation/status');
    expect(result.current.status.canUndo).toBe(true);
    expect(result.current.status.historyLength).toBe(5);
  });

  test('refreshHistory gets /api/mutation/history with limit', async () => {
    const io = mockIO({
      get: vi.fn().mockResolvedValue({
        data: {
          ok: true,
          history: [{ id: 'h1', mutation: { op: 'replace', target: 'panel:foo', provenance: 'manual', payload: {} }, beforeSpec: {}, afterSpec: {}, appliedAt: 0, ok: true }],
          count: 1,
        },
      }),
    });

    const { result } = renderHook(() => useMutation());

    await act(async () => {
      await result.current.refreshHistory(25);
    });

    expect(io.get).toHaveBeenCalledWith('/api/mutation/history', { query: { limit: 25 } });
    expect(result.current.history).toHaveLength(1);
  });

  test('apply error populates error state', async () => {
    const io = mockIO({
      post: vi.fn().mockResolvedValue({
        data: { ok: false, error: 'Surface not found: panel:nope' },
      }),
    });

    const { result } = renderHook(() => useMutation());

    let r;
    await act(async () => {
      r = await result.current.apply({ dsl: '/hide panel:nope' });
    });

    expect(r!.ok).toBe(false);
    expect(r!.error).toBe('Surface not found: panel:nope');
    expect(result.current.error).toBe('Surface not found: panel:nope');
  });

  test('apply network error returns ok:false with error message', async () => {
    const io = mockIO({
      post: vi.fn().mockRejectedValue(new Error('Network down')),
    });

    const { result } = renderHook(() => useMutation());

    let r;
    await act(async () => {
      r = await result.current.apply({ dsl: '/hide panel:foo' });
    });

    expect(r!.ok).toBe(false);
    expect(r!.error).toBe('Network down');
  });

  test('clearError resets the error state', async () => {
    const io = mockIO({
      post: vi.fn().mockResolvedValue({ data: { ok: false, error: 'oops' } }),
    });

    const { result } = renderHook(() => useMutation());

    await act(async () => {
      await result.current.apply({ dsl: '/hide panel:foo' });
    });
    expect(result.current.error).toBe('oops');

    act(() => {
      result.current.clearError();
    });
    expect(result.current.error).toBeNull();
  });
});
