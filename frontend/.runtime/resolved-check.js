"use client";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
export function useResolvedNodes(req) {
  const stableKey = useMemo(() => ["canvas:resolve", JSON.stringify(req)], [JSON.stringify(req)]);
  return useQuery({
    queryKey: stableKey,
    queryFn: async () => {
      const res = await fetch("/api/canvas/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req)
      });
      if (!res.ok)
        throw new Error(`resolve failed: ${res.status}`);
      return await res.json();
    },
    staleTime: 1e4,
    retry: 1,
    refetchOnWindowFocus: false
  });
}
