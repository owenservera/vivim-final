/**
 * StreamingIndicator.tsx — Real-time streaming visualization.
 * Shows loading/streaming state with animated dots and progress.
 */
"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Loader2, Radio, Wifi, WifiOff } from "lucide-react"
import type { WsStatus } from "@/hooks/useWebSocket"

interface StreamingIndicatorProps {
  wsStatus: WsStatus
  isStreaming?: boolean
  streamProgress?: number // 0-100
  lastEvent?: string
}

export function StreamingIndicator({
  wsStatus,
  isStreaming = false,
  streamProgress,
  lastEvent,
}: StreamingIndicatorProps) {
  const [dots, setDots] = useState("")

  useEffect(() => {
    if (!isStreaming) return
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "" : d + "."))
    }, 400)
    return () => clearInterval(interval)
  }, [isStreaming])

  const wsBadge = () => {
    switch (wsStatus) {
      case "connected":
        return (
          <Badge variant="default" className="gap-1 bg-green-600 hover:bg-green-700">
            <Wifi className="h-3 w-3" />
            Live
          </Badge>
        )
      case "connecting":
        return (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Connecting
          </Badge>
        )
      case "error":
        return (
          <Badge variant="destructive" className="gap-1">
            <WifiOff className="h-3 w-3" />
            Disconnected
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="gap-1">
            <WifiOff className="h-3 w-3" />
            Offline
          </Badge>
        )
    }
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      {wsBadge()}
      {isStreaming && (
        <Badge variant="secondary" className="gap-1 animate-pulse">
          <Radio className="h-3 w-3" />
          Streaming{dots}
        </Badge>
      )}
      {streamProgress !== undefined && (
        <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${Math.min(streamProgress, 100)}%` }}
          />
        </div>
      )}
      {lastEvent && (
        <span className="text-muted-foreground truncate max-w-[200px]">
          {lastEvent}
        </span>
      )}
    </div>
  )
}
