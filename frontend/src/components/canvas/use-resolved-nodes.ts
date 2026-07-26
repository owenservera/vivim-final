'use client';

/**
 * components/canvas/use-resolved-nodes.ts
 * --------------------------------------------------------------------
 * React hook that fetches the resolved surface from `/api/canvas/resolve`
 * and rebuilds the node tree whenever the workspace / providers / accounts
 * change. Powered by TanStack Query for caching + invalidation.
 *
 * The shell is dumb: it just renders what the resolver returns. No
 * provider conditionals (Frontend=Backend, invariant 3).
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ResolvedSurface, RouteContext } from '../../shared/route-context';

export interface ResolveRequest {
  workspaceId: string;
  userId: string;
  providerIds: string[];
  accounts: RouteContext['accounts'];
  slotIds: string[];
  variant?: string;
}

export function useResolvedNodes(req: ResolveRequest) {
  // Stabilize query key via JSON stringify so inline-created objects
  // with the same values don't trigger needless re-fetches.
  const stableKey = useMemo(
    () => ['canvas:resolve', JSON.stringify(req)],
    [JSON.stringify(req)],
  );

  return useQuery<ResolvedSurface>({
    queryKey: stableKey,
    queryFn: async () => {
      const res = await fetch('/api/canvas/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });
      if (!res.ok) throw new Error(`resolve failed: ${res.status}`);
      return (await res.json()) as ResolvedSurface;
    },
    staleTime: 10_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
