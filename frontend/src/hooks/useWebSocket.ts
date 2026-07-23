/**
 * useWebSocket.ts — WebSocket hook for ws://localhost:9420/ws.
 * Auto-reconnects with exponential backoff.
 * Provides typed message handling.
 */
"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { getWsUrl } from "@/sdk/backend-client"

export type WsStatus = "connecting" | "connected" | "disconnected" | "error"

export interface WsMessage {
  type: string
  payload?: unknown
  timestamp?: string
}

interface UseWebSocketOptions {
  onMessage?: (msg: WsMessage) => void
  onStatusChange?: (status: WsStatus) => void
  autoConnect?: boolean
  maxReconnectAttempts?: number
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    onMessage,
    onStatusChange,
    autoConnect = true,
    maxReconnectAttempts = 10,
  } = options

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttempts = useRef(0)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [status, setStatus] = useState<WsStatus>("disconnected")
  const subscribedTopics = useRef<Set<string>>(new Set())

  const updateStatus = useCallback((s: WsStatus) => {
    setStatus(s)
    onStatusChange?.(s)
  }, [onStatusChange])

  // Use ref to break circular dependency between connect and scheduleReconnect
  const connectRef = useRef<() => void>(() => {})

  const scheduleReconnect = useCallback(() => {
    if (reconnectAttempts.current >= maxReconnectAttempts) return

    const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 30000)
    reconnectAttempts.current++

    reconnectTimer.current = setTimeout(() => {
      connectRef.current?.()
    }, delay)
  }, [maxReconnectAttempts])

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    updateStatus("connecting")
    const ws = new WebSocket(getWsUrl())

    ws.onopen = () => {
      reconnectAttempts.current = 0
      updateStatus("connected")
      // Re-subscribe to all topics after reconnect
      for (const topic of subscribedTopics.current) {
        ws.send(JSON.stringify({ type: "subscribe", topic }))
      }
    }

    ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data)
        onMessage?.(msg)
      } catch {
        // Non-JSON message — treat as raw text
        onMessage?.({ type: "raw", payload: event.data })
      }
    }

    ws.onclose = () => {
      updateStatus("disconnected")
      scheduleReconnect()
    }

    ws.onerror = () => {
      updateStatus("error")
      ws.close()
    }

    wsRef.current = ws
  }, [onMessage, updateStatus, scheduleReconnect])

  // Store connect in ref for scheduleReconnect to call
  connectRef.current = connect

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current)
      reconnectTimer.current = null
    }
    reconnectAttempts.current = maxReconnectAttempts // prevent reconnect
    wsRef.current?.close()
    wsRef.current = null
    updateStatus("disconnected")
  }, [updateStatus, maxReconnectAttempts])

  const send = useCallback((msg: WsMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [])

  const subscribe = useCallback((topic: string) => {
    subscribedTopics.current.add(topic)
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "subscribe", topic }))
    }
  }, [])

  const unsubscribe = useCallback((topic: string) => {
    subscribedTopics.current.delete(topic)
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "unsubscribe", topic }))
    }
  }, [])

  useEffect(() => {
    if (autoConnect) connect()
    return () => disconnect()
  }, [autoConnect, connect, disconnect])

  return { status, connect, disconnect, send, subscribe, unsubscribe }
}
