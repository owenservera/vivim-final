/**
 * lib/ws-url.ts
 * --------------------------------------------------------------------
 * Shared WebSocket URL builder and API base resolution. Used by DevConsole,
 * useWebSocket, and the capability API client.
 *
 * In Tauri mode, listens for `backend-ready` events from the Rust sidecar
 * supervisor to dynamically update the backend port (handles fallback from
 * 9421 → 9422 etc.).
 */

const DEFAULT_PORT = 9421

let activePort = DEFAULT_PORT

function isTauriEnvironment(): boolean {
  if (typeof window === 'undefined') return false
  if ('__TAURI_INTERNALS__' in window) return true
  const host = window.location.hostname
  return host === 'ipc.localhost' || host === 'tauri.localhost'
}

/** Returns the API base URL for fetch calls. Empty string in browser, http://127.0.0.1:<PORT> in Tauri. */
export function getApiBase(): string {
  if (isTauriEnvironment()) return `http://127.0.0.1:${activePort}`
  return ''
}

function resolveWsHost(): string {
  if (isTauriEnvironment()) return `127.0.0.1:${activePort}`
  return window.location.host
}

function buildWsBackend(): string {
  if (typeof window === 'undefined') return 'ws://localhost:9421'
  return `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${resolveWsHost()}`
}

/** Returns the WebSocket URL for the backend firehose. */
export function getWsUrl(): string {
  return `${buildWsBackend()}/ws`
}

// ── Dynamic port listener (Tauri only) ──────────────────────────────────────
// When the Rust sidecar supervisor emits "backend-ready" with the actual bound
// port (which may differ from DEFAULT_PORT if fallback occurred), update activePort
// so subsequent getApiBase() / getWsUrl() calls target the correct port.
if (isTauriEnvironment() && typeof window !== 'undefined') {
  try {
    // Tauri v2 API: window.__TAURI_INTERNALS__.event.listen
    const tauri = (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ as
      | {
          event?: {
            listen: (event: string, cb: (e: { payload: unknown }) => void) => Promise<() => void>
          }
        }
      | undefined
    tauri?.event?.listen('backend-ready', (e) => {
      const port = Number(e.payload)
      if (Number.isFinite(port) && port > 0 && port !== activePort) {
        activePort = port
      }
    })
  } catch {
  // [audit] log the error with context here
    // Non-critical: static port fallback still works.
  }
}
