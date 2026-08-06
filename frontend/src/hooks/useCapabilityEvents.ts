// frontend/src/hooks/useCapabilityEvents.ts
// P2-7: Callback registration for capability execution events.
// Use inside a component that already has WebSocket access.

import type { WsCapabilityFailedEvent, WsCapabilityProgressEvent } from '@/types/shared/ws-events'
import { useCallback } from 'react'

interface CapabilityEventHandlers {
  onFailed?: (event: WsCapabilityFailedEvent) => void
  onProgress?: (event: WsCapabilityProgressEvent) => void
}

/**
 * Hook that returns memoized handlers for capability events.
 * Pass these to your WebSocket onMessage handler.
 */
export function useCapabilityEvents(handlers: CapabilityEventHandlers) {
  const handleFailed = useCallback(
    (event: unknown) => {
      if (
        typeof event === 'object' &&
        event !== null &&
        (event as { type: string }).type === 'capability:failed'
      ) {
        handlers.onFailed?.(event as WsCapabilityFailedEvent)
      }
    },
    [handlers.onFailed],
  )

  const handleProgress = useCallback(
    (event: unknown) => {
      if (
        typeof event === 'object' &&
        event !== null &&
        (event as { type: string }).type === 'capability:progress'
      ) {
        handlers.onProgress?.(event as WsCapabilityProgressEvent)
      }
    },
    [handlers.onProgress],
  )

  return { handleFailed, handleProgress }
}
