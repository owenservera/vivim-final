/**
 * engines/plugin-hot-reload.ts
 * --------------------------------------------------------------------
 * Extended PluginHotReload (bundle 04 plugin-hot-reload.ts).
 *
 * Extension: in addition to watching `plugins/` for `.ts/.js` files, it
 * subscribes to CanvasDefinition row changes via the event bus (G1.3
 * requirement: "hotReload wraps PluginHotReload, also subscribes to def
 * rows"). A def edit → bus event → mounted node re-renders from new
 * blob WITHOUT page reload.
 */

import { type FSWatcher, watch } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import type { CapabilityEventBus } from './capability-event-bus';

export interface ProviderPlugin {
  id: string;
  name: string;
  version: string;
  filePath: string;
  exports: Record<string, unknown>;
  loadedAt: number;
}

export type PluginHandler = (plugin: ProviderPlugin) => void;
export type PluginErrorHandler = (error: Error, filePath: string) => void;
export type PluginUnloadHandler = (pluginId: string) => void;
export type DefChangeHandler = (definitionId: string, slug: string, version: number) => void;

export class PluginHotReload {
  private watcher?: FSWatcher;
  private loaded = new Map<string, ProviderPlugin>();
  private loadHandlers: PluginHandler[] = [];
  private unloadHandlers: PluginUnloadHandler[] = [];
  private errorHandlers: PluginErrorHandler[] = [];
  private defChangeHandlers: DefChangeHandler[] = [];
  private directory = '';
  private busUnsub?: () => void;
  private started = false;

  async start(directory: string, eventBus?: CapabilityEventBus): Promise<void> {
    if (this.started) return;
    this.started = true;
    this.directory = directory;
    await this.loadAllPlugins();

    // File-system watch for .ts/.js plugin files.
    try {
      this.watcher = watch(directory, { recursive: true }, async (_event, filename) => {
        if (!filename) return;
        const ext = extname(filename);
        if (ext !== '.ts' && ext !== '.js' && ext !== '.json') return;
        const filePath = join(directory, filename);
        try {
          const fileStat = await stat(filePath);
          if (fileStat.isFile()) {
            await this.loadPlugin(filePath);
          }
        } catch {
          this.unloadByPath(filePath);
        }
      });
    } catch {
      // Directory may not exist yet — file watch is best-effort.
    }

    // Event-bus subscription for CanvasDefinition row changes (the live
    // hot-swap path that does NOT require a file change).
    if (eventBus) {
      this.busUnsub = eventBus.on('canvas:def:updated', (e) => {
        const ev = e as { definitionId?: string; slug?: string; version?: number };
        if (ev.definitionId && ev.slug && typeof ev.version === 'number') {
          for (const handler of this.defChangeHandlers) {
            handler(ev.definitionId, ev.slug, ev.version);
          }
        }
      });
    }
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = undefined;
    }
    if (this.busUnsub) {
      this.busUnsub();
      this.busUnsub = undefined;
    }
    this.started = false;
  }

  onPluginLoaded(handler: PluginHandler): void {
    this.loadHandlers.push(handler);
  }

  onPluginUnloaded(handler: PluginUnloadHandler): void {
    this.unloadHandlers.push(handler);
  }

  onPluginError(handler: PluginErrorHandler): void {
    this.errorHandlers.push(handler);
  }

  onDefinitionChanged(handler: DefChangeHandler): void {
    this.defChangeHandlers.push(handler);
  }

  listLoaded(): string[] {
    return Array.from(this.loaded.keys());
  }

  private async loadAllPlugins(): Promise<void> {
    try {
      const files = await readdir(this.directory);
      for (const file of files) {
        const ext = extname(file);
        if (ext === '.ts' || ext === '.js' || ext === '.json') {
          await this.loadPlugin(join(this.directory, file));
        }
      }
    } catch {
      // Directory may not exist yet — that's OK.
    }
  }

  private async loadPlugin(filePath: string): Promise<void> {
    try {
      this.unloadByPath(filePath);
      // Dynamic import — cache-bust query so we always re-evaluate.
      // Use a Function wrapper so Next.js's bundler doesn't try to
      // statically analyze a `file://` URL (which would fail). This
      // code path only runs in Node, never in the browser bundle.
      const dynamicImport = new Function('s', 'return import(s)') as (s: string) => Promise<{
        default?: Record<string, unknown>;
        id?: string;
        name?: string;
        version?: string;
      }>;
      const url = `file://${filePath}?t=${Date.now()}`;
      const mod = await dynamicImport(url);
      const plugin: ProviderPlugin = {
        id: (mod.default?.id as string) ?? mod.id ?? filePath,
        name: (mod.default?.name as string) ?? mod.name ?? filePath,
        version: (mod.default?.version as string) ?? mod.version ?? '0.0.0',
        filePath,
        exports: mod.default ?? (mod as unknown as Record<string, unknown>),
        loadedAt: Date.now(),
      };
      this.loaded.set(plugin.id, plugin);
      for (const handler of this.loadHandlers) handler(plugin);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      for (const handler of this.errorHandlers) handler(error, filePath);
    }
  }

  private unloadByPath(filePath: string): void {
    for (const [id, plugin] of this.loaded) {
      if (plugin.filePath === filePath) {
        this.loaded.delete(id);
        for (const handler of this.unloadHandlers) handler(id);
        break;
      }
    }
  }
}
