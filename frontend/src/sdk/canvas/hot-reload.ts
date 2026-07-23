/**
 * sdk/canvas/hot-reload.ts
 * --------------------------------------------------------------------
 * G1.3 — `hotReload(watchDir)`: wraps PluginHotReload (file watcher)
 * AND subscribes to CanvasDefinition row changes via the event bus.
 *
 * A def edit → bus event → mounted node re-renders from new blob
 * WITHOUT page reload (invariant 7: Live, not build).
 *
 * Browser usage: subscribe to the canvas event bus (SSE).
 * Node usage: watch the local `plugins/` dir + the event bus.
 */

import type { DefChangeHandler } from '../../engines/plugin-hot-reload';

export interface HotReloadOptions {
  /** Browser-side: callback for live def updates from SSE. */
  onDefChanged?: DefChangeHandler;
  /** Browser-side: existing EventSource (created by useCanvasEvents). */
  eventSource?: EventSource;
}

export interface Disposer {
  (): void;
}

/**
 * Browser-side hot-reload subscription. Hooks into the SSE stream
 * established by useCanvasEvents. When a `canvas:def:updated` event
 * arrives, the callback fires — typically the caller invalidates a
 * TanStack Query so the affected node re-renders.
 */
export function hotReload(opts: HotReloadOptions): Disposer {
  if (!opts.onDefChanged || !opts.eventSource) {
    return () => {};
  }

  const handler = (msg: MessageEvent) => {
    try {
      const evt = JSON.parse(msg.data) as {
        type: string;
        definitionId?: string;
        slug?: string;
        version?: number;
      };
      if (
        evt.type === 'canvas:def:updated' &&
        evt.definitionId &&
        evt.slug &&
        typeof evt.version === 'number'
      ) {
        opts.onDefChanged!(evt.definitionId, evt.slug, evt.version);
      }
    } catch {
      // ignore malformed events
    }
  };

  opts.eventSource.addEventListener('message', handler);
  return () => {
    opts.eventSource!.removeEventListener('message', handler);
  };
}
