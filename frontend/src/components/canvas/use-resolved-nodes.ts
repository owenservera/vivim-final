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
  return useQuery<ResolvedSurface>({
    queryKey: ['canvas:resolve', req.workspaceId, req.userId, req.providerIds, req.accounts, req.slotIds, req.variant],
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
