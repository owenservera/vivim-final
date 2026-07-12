// src/engines/plugin-hot-reload.ts
// PluginHotReload — watch plugins/ directory for .ts/.js changes and hot-reload.

import { type FSWatcher, watch } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { EngineError } from '../errors.js'

// ── Types ───────────────────────────────────────────────────────────────

export interface ProviderPlugin {
  id: string
  name: string
  version: string
  filePath: string
  exports: Record<string, unknown>
  loadedAt: number
}

export type PluginHandler = (plugin: ProviderPlugin) => void
export type PluginErrorHandler = (error: Error, filePath: string) => void
export type PluginUnloadHandler = (pluginId: string) => void

// ── PluginHotReload ─────────────────────────────────────────────────────

export class PluginHotReload {
  private watcher?: FSWatcher
  private loaded = new Map<string, ProviderPlugin>()
  private loadHandlers: PluginHandler[] = []
  private unloadHandlers: PluginUnloadHandler[] = []
  private errorHandlers: PluginErrorHandler[] = []
  private directory = ''

  async start(directory: string): Promise<void> {
    this.directory = directory
    // Initial load of all plugins
    await this.loadAllPlugins()

    // Watch for changes
    this.watcher = watch(directory, { recursive: true }, async (_event, filename) => {
      if (!filename) return
      const ext = extname(filename)
      if (ext !== '.ts' && ext !== '.js') return

      const filePath = join(directory, filename)
      try {
        const fileStat = await stat(filePath)
        if (fileStat.isFile()) {
          await this.loadPlugin(filePath)
        }
      } catch {
        // File was deleted
        this.unloadByPath(filePath)
      }
    })
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = undefined
    }
  }

  onPluginLoaded(handler: PluginHandler): void {
    this.loadHandlers.push(handler)
  }

  onPluginUnloaded(handler: PluginUnloadHandler): void {
    this.unloadHandlers.push(handler)
  }

  onPluginError(handler: PluginErrorHandler): void {
    this.errorHandlers.push(handler)
  }

  listLoaded(): string[] {
    return Array.from(this.loaded.keys())
  }

  // ── Private ────────────────────────────────────────────────────────────

  private async loadAllPlugins(): Promise<void> {
    try {
      const files = await readdir(this.directory)
      for (const file of files) {
        const ext = extname(file)
        if (ext === '.ts' || ext === '.js') {
          await this.loadPlugin(join(this.directory, file))
        }
      }
    } catch {
      // Directory may not exist yet
    }
  }

  private async loadPlugin(filePath: string): Promise<void> {
    try {
      // Unload existing plugin from same path
      this.unloadByPath(filePath)

      // Dynamic import
      const mod = await import(`${filePath}?t=${Date.now()}`)
      const plugin: ProviderPlugin = {
        id: mod.default?.id ?? mod.id ?? filePath,
        name: mod.default?.name ?? mod.name ?? filePath,
        version: mod.default?.version ?? mod.version ?? '0.0.0',
        filePath,
        exports: mod.default ?? mod,
        loadedAt: Date.now(),
      }

      this.loaded.set(plugin.id, plugin)
      for (const handler of this.loadHandlers) {
        handler(plugin)
      }
    } catch (err) {
      const error = err instanceof Error ? err : new EngineError(String(err))
      for (const handler of this.errorHandlers) {
        handler(error, filePath)
      }
    }
  }

  private unloadByPath(filePath: string): void {
    for (const [id, plugin] of this.loaded) {
      if (plugin.filePath === filePath) {
        this.loaded.delete(id)
        for (const handler of this.unloadHandlers) {
          handler(id)
        }
        break
      }
    }
  }
}
