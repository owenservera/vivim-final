/**
 * lib/tauri-bridge.ts — Tauri V2 / Web dual-mode API bridge
 * ----------------------------------------------------------------
 * When running inside Tauri the frontend uses `@tauri-apps/api` invoke()
 * to call the Rust backend directly (IPC).  On the web it falls back to
 * standard `fetch()` against the Next.js API routes or the proxied backend.
 *
 * Usage:
 *   import { tauriInvoke, isTauri } from '@/lib/tauri-bridge';
 *   if (isTauri()) {
 *     const result = await tauriInvoke('backend_ready');
 *   }
 */

// Dynamic import guard — @tauri-apps/api is only bundled when running in Tauri.
// The try/catch + typeof ensures this file is safe to import in pure web mode.

let _isTauri: boolean | null = null;

export function isTauri(): boolean {
  if (_isTauri !== null) return _isTauri;
  try {
    _isTauri = typeof window !== 'undefined' && '__TAURI__' in window;
  } catch {
    _isTauri = false;
  }
  return _isTauri;
}

export type TauriInvoke = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

let _invoke: TauriInvoke | null = null;

/**
 * Call a Tauri IPC command.  Only works inside the Tauri shell.
 * Falls back to a no-op + warning in web mode — callers should guard
 * with `isTauri()` or use `apiCall()` below which auto-switches.
 */
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) {
    throw new Error(`[tauri-bridge] tauriInvoke('${cmd}') called outside Tauri — use apiCall() for web fallback`);
  }
  if (!_invoke) {
    const mod = await import('@tauri-apps/api/core');
    _invoke = mod.invoke as TauriInvoke;
  }
  return _invoke(cmd, args);
}

/**
 * Unified API call: uses Tauri IPC when available, HTTP fetch otherwise.
 * This is the recommended way for SDK/hooks to call the backend.
 */
export async function apiCall<T = unknown>(
  path: string,
  options?: { method?: string; body?: unknown; headers?: Record<string, string> },
): Promise<T> {
  if (isTauri()) {
    // In Tauri V2, sidecar/backend calls go through Tauri commands.
    // The path is mapped to a command name, e.g. '/api/health' → 'api_health'
    const cmd = 'api_' + path.replace(/^\//, '').replace(/\//g, '_');
    return tauriInvoke<T>(cmd, { body: options?.body, method: options?.method });
  }
  // Web fallback — standard fetch with timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
  const resp = await fetch(path, {
    method: options?.method ?? 'GET',
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`API ${options?.method ?? 'GET'} ${path} → ${resp.status}: ${text}`);
  }
  return resp.json() as Promise<T>;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Signal to the Tauri shell that the backend is ready and the window
 * should be shown.  No-op on the web.
 */
export async function signalBackendReady(): Promise<void> {
  if (isTauri()) {
    await tauriInvoke('backend_ready');
  }
}
