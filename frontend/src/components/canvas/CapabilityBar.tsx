"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useCapability } from "@/sdk/web"
import { Loader2, Zap, Search } from "lucide-react"

interface CapabilityBarProps {
  surface?: string
  onExecute?: (capabilityId: string, result: unknown) => void
}

export function CapabilityBar({ surface = "ui", onExecute }: CapabilityBarProps) {
  const { capabilities, loading, error, execute } = useCapability(surface)
  const [filter, setFilter] = useState("")
  const [executing, setExecuting] = useState<string | null>(null)

  const filtered = capabilities.filter(
    (c) =>
      !filter ||
      c.name.toLowerCase().includes(filter.toLowerCase()) ||
      c.slug.toLowerCase().includes(filter.toLowerCase()),
  )

  const handleExecute = async (capabilityId: string) => {
    setExecuting(capabilityId)
    try {
      const result = await execute(capabilityId)
      onExecute?.(capabilityId, result)
    } catch (err) {
      // [audit] removed: console.error("Capability execution failed:", err)
    } finally {
      setExecuting(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading capabilities...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-destructive text-sm py-2">
        <Zap className="h-4 w-4" />
        Failed to load capabilities — is the backend running at localhost:9420?
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter capabilities..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full pl-7 pr-2 py-1 text-xs border rounded-md bg-background"
            />
          </div>
          <Badge variant="outline" className="text-xs">
            {filtered.length} capabilities
          </Badge>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {filtered.map((cap) => (
            <Tooltip key={cap.id}>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => handleExecute(cap.id)}
                  disabled={executing === cap.id}
                >
                  {executing === cap.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Zap className="h-3 w-3" />
                  )}
                  {cap.name}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{cap.description ?? cap.slug}</p>
                {cap.surfaces && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Surfaces: {cap.surfaces.join(", ")}
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </TooltipProvider>
  )
}
