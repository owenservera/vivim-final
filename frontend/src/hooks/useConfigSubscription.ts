// frontend/src/hooks/useConfigSubscription.ts
// P2-8: Subscribe to config:changed events via WebSocket.
// When received, triggers a callback so the UI can refresh.

'use client'

import { useCallback, useRef } from 'react'

/**
 * Hook that subscribes to config:changed WebSocket events.
 * Returns a ref that holds the latest config event data.
 */
export function useConfigSubscription(
  onConfigChanged?: (event: { type: string; [key: string]: unknown }) => void,
) {
  const callbackRef = useRef(onConfigChanged)
  callbackRef.current = onConfigChanged

  const handleMessage = useCallback((msg: { type: string; [key: string]: unknown }) => {
    if (msg.type === 'config:changed') {
      callbackRef.current?.(msg)
    }
  }, [])

  // This hook should be used inside a component that has WebSocket access.
  // Return the handler so consumers can wire it into their onMessage callback.
  return handleMessage
}
