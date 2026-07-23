/**
 * useCapabilities.ts — Fetch + cache the capability list from the backend.
 * Uses React Query for caching and automatic refetch.
 */
"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { listCapabilities, executeCapability, interpret } from "@/sdk/backend-client"
import type { z } from "zod"
import { CapabilitySchema } from "@/sdk/backend-client"

type Capability = z.infer<typeof CapabilitySchema>

/** Fetch all capabilities, optionally filtered by surface */
export function useCapabilities(surface?: string) {
  return useQuery({
    queryKey: ["capabilities", surface],
    queryFn: async () => {
      const res = await listCapabilities(surface)
      if (!res.ok) throw new Error(res.error)
      return res.data!.capabilities
    },
    staleTime: 5 * 60 * 1000, // 5 minutes — capabilities don't change often
    refetchOnWindowFocus: false,
  })
}

/** Execute a capability by ID */
export function useExecuteCapability() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ capabilityId, input }: { capabilityId: string; input?: Record<string, unknown> }) => {
      const res = await executeCapability(capabilityId, input)
      if (!res.ok) throw new Error(res.error)
      return res.data!
    },
    onSuccess: () => {
      // Invalidate related queries after execution
      qc.invalidateQueries({ queryKey: ["capabilities"] })
    },
  })
}

/** Interpret natural language and get a capability + result */
export function useInterpret() {
  return useMutation({
    mutationFn: async ({ nl, context }: { nl: string; context?: Record<string, unknown> }) => {
      const res = await interpret(nl, context)
      if (!res.ok) throw new Error(res.error)
      return res.data!
    },
  })
}
