/**
 * lib/ws-url.ts
 * --------------------------------------------------------------------
 * Shared WebSocket URL builder. Used by DevConsole and useWebSocket
 * without importing the full backend-client module.
 */

const WS_BACKEND =
  typeof window !== 'undefined'
    ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`
    : 'ws://localhost:9421';

/** Returns the WebSocket URL for the backend firehose. */
export function getWsUrl(): string {
  return WS_BACKEND + '/ws';
}
