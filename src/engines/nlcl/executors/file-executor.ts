// src/engines/nlcl/executors/file-executor.ts
// FileExecutor — file system operations (open, list, search, create).

import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { platform } from 'node:os'
import { basename, extname, join } from 'node:path'
import { newId } from '../../../ids.js'
import type { CommandExecutor, CommandResult, NLCContext, ParsedIntent } from '../types.js'

const _isWindows = platform() === 'win32'

const FILE_OPEN_COMMANDS: Record<string, string> = {
  win32: 'explorer',
  darwin: 'open',
  linux: 'xdg-open',
}

const _APP_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.csv',
  '.json',
  '.html',
  '.htm',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.bmp',
  '.svg',
  '.mp4',
  '.mp3',
  '.wav',
  '.avi',
  '.mov',
  '.zip',
  '.rar',
  '.7z',
  '.tar',
  '.gz',
])

const SEARCH_LOCATIONS: Record<string, string[]> = {
  win32: ['Documents', 'Desktop', 'Downloads', 'Pictures'],
  darwin: ['Documents', 'Desktop', 'Downloads', 'Pictures'],
  linux: ['Documents', 'Desktop', 'Downloads', 'Pictures'],
}

export class FileExecutor implements CommandExecutor {
  readonly id = 'file' as const

  async execute(intent: ParsedIntent, ctx: NLCContext): Promise<CommandResult> {
    const start = Date.now()
    const traceId = newId()

    try {
      switch (intent.intent) {
        case 'file.open':
          return await this.openFile(intent, ctx, traceId, start)
        case 'file.list':
          return await this.listFiles(intent, ctx, traceId, start)
        case 'file.search':
          return await this.searchFiles(intent, ctx, traceId, start)
        case 'file.create':
          return await this.createFile(intent, ctx, traceId, start)
        case 'file.read':
          return await this.readFile(intent, ctx, traceId, start)
        default:
          return this.fail(intent, traceId, start, `Unknown file intent: ${intent.intent}`)
      }
    } catch (err) {
      return this.fail(intent, traceId, start, err instanceof Error ? err.message : String(err))
    }
  }

  private async openFile(
    intent: ParsedIntent,
    ctx: NLCContext,
    traceId: string,
    start: number,
  ): Promise<CommandResult> {
    const fileName = intent.input.name as string | undefined
    const filePath = intent.input.path as string | undefined

    if (filePath) {
      const resolved = this.resolvePath(filePath, ctx)
      if (!existsSync(resolved)) {
        return this.fail(intent, traceId, start, `File not found: ${filePath}`)
      }
      await this.launchFile(resolved)
      return {
        ok: true,
        intent: intent.intent,
        output: { path: resolved, opened: true },
        text: `Opened ${basename(resolved)}`,
        latencyMs: Date.now() - start,
        traceId,
        classification: 'read',
      }
    }

    if (fileName) {
      const found = await this.findFile(fileName, ctx)
      if (!found) {
        return this.fail(intent, traceId, start, `Could not find "${fileName}" in common locations`)
      }
      await this.launchFile(found)
      return {
        ok: true,
        intent: intent.intent,
        output: { path: found, opened: true },
        text: `Opened ${basename(found)}`,
        latencyMs: Date.now() - start,
        traceId,
        classification: 'read',
      }
    }

    return this.fail(intent, traceId, start, 'No file name or path specified')
  }

  private async listFiles(
    intent: ParsedIntent,
    _ctx: NLCContext,
    traceId: string,
    start: number,
  ): Promise<CommandResult> {
    const folder = (intent.input.folder as string) ?? 'Documents'
    const home = this.getHomeDir()
    const locations = SEARCH_LOCATIONS[platform()] ?? ['Documents']
    const targetFolder = locations.find((l) => l.toLowerCase() === folder.toLowerCase()) ?? folder
    const dirPath = join(home, targetFolder)

    if (!existsSync(dirPath)) {
      return this.fail(intent, traceId, start, `Folder not found: ${targetFolder}`)
    }

    const entries = await readdir(dirPath, { withFileTypes: true })
    const files = entries
      .filter((e) => e.isFile())
      .map((e) => ({ name: e.name, extension: extname(e.name) }))
      .slice(0, 50)

    const dirs = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .slice(0, 20)

    return {
      ok: true,
      intent: intent.intent,
      output: { folder: targetFolder, files, dirs, totalFiles: files.length },
      text: `${files.length} files in ${targetFolder}`,
      latencyMs: Date.now() - start,
      traceId,
      classification: 'read',
    }
  }

  private async searchFiles(
    intent: ParsedIntent,
    _ctx: NLCContext,
    traceId: string,
    start: number,
  ): Promise<CommandResult> {
    const query = (intent.input.query as string) ?? (intent.input.name as string) ?? ''
    if (!query) {
      return this.fail(intent, traceId, start, 'No search query specified')
    }

    const home = this.getHomeDir()
    const locations = SEARCH_LOCATIONS[platform()] ?? ['Documents']
    const results: Array<{ path: string; name: string; size?: number }> = []

    for (const loc of locations) {
      const dirPath = join(home, loc)
      if (!existsSync(dirPath)) continue
      try {
        const entries = await readdir(dirPath, { withFileTypes: true })
        for (const entry of entries) {
          if (entry.name.toLowerCase().includes(query.toLowerCase())) {
            const fullPath = join(dirPath, entry.name)
            let size: number | undefined
            try {
              size = (await stat(fullPath)).size
            } catch {
              /* ignore */
            }
            results.push({ path: fullPath, name: entry.name, size })
          }
        }
      } catch {
        /* skip inaccessible dirs */
      }
    }

    return {
      ok: true,
      intent: intent.intent,
      output: { query, results: results.slice(0, 20), totalFound: results.length },
      text:
        results.length > 0
          ? `Found ${results.length} file(s) matching "${query}"`
          : `No files found matching "${query}"`,
      latencyMs: Date.now() - start,
      traceId,
      classification: 'read',
    }
  }

  private async createFile(
    intent: ParsedIntent,
    _ctx: NLCContext,
    traceId: string,
    start: number,
  ): Promise<CommandResult> {
    const name = intent.input.name as string
    const content = (intent.input.content as string) ?? ''
    const folder = (intent.input.folder as string) ?? 'Documents'

    if (!name) {
      return this.fail(intent, traceId, start, 'No file name specified')
    }

    const home = this.getHomeDir()
    const locations = SEARCH_LOCATIONS[platform()] ?? ['Documents']
    const targetFolder = locations.find((l) => l.toLowerCase() === folder.toLowerCase()) ?? folder
    const dirPath = join(home, targetFolder)
    const filePath = join(dirPath, name)

    if (!existsSync(dirPath)) {
      await mkdir(dirPath, { recursive: true })
    }

    await writeFile(filePath, content, 'utf-8')

    return {
      ok: true,
      intent: intent.intent,
      output: { path: filePath, name, created: true },
      text: `Created ${name} in ${targetFolder}`,
      latencyMs: Date.now() - start,
      traceId,
      classification: 'write',
    }
  }

  private async readFile(
    intent: ParsedIntent,
    ctx: NLCContext,
    traceId: string,
    start: number,
  ): Promise<CommandResult> {
    const name = intent.input.name as string
    if (!name) {
      return this.fail(intent, traceId, start, 'No file name specified')
    }

    const found = await this.findFile(name, ctx)
    if (!found) {
      return this.fail(intent, traceId, start, `File not found: ${name}`)
    }

    const content = await readFile(found, 'utf-8')
    const truncated = content.length > 10000 ? `${content.slice(0, 10000)}... (truncated)` : content

    return {
      ok: true,
      intent: intent.intent,
      output: { path: found, content: truncated, size: content.length },
      text: truncated.slice(0, 500),
      latencyMs: Date.now() - start,
      traceId,
      classification: 'read',
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private getHomeDir(): string {
    return process.env.HOME ?? process.env.USERPROFILE ?? '.'
  }

  private resolvePath(path: string, ctx: NLCContext): string {
    if (path.startsWith('~')) {
      return join(this.getHomeDir(), path.slice(1))
    }
    if (ctx.workspacePath && !path.startsWith('/') && !path.match(/^[A-Z]:/i)) {
      return join(ctx.workspacePath, path)
    }
    return path
  }

  private async findFile(name: string, ctx: NLCContext): Promise<string | null> {
    const home = this.getHomeDir()
    const locations = SEARCH_LOCATIONS[platform()] ?? ['Documents']

    if (existsSync(name)) return name
    if (ctx.workspacePath && existsSync(join(ctx.workspacePath, name))) {
      return join(ctx.workspacePath, name)
    }

    const lowerName = name.toLowerCase()
    for (const loc of locations) {
      const dirPath = join(home, loc)
      if (!existsSync(dirPath)) continue
      try {
        const entries = await readdir(dirPath, { withFileTypes: true })
        for (const entry of entries) {
          if (
            entry.name.toLowerCase() === lowerName ||
            entry.name.toLowerCase().replace(/\.[^.]+$/, '') === lowerName
          ) {
            return join(dirPath, entry.name)
          }
          if (entry.name.toLowerCase().includes(lowerName)) {
            return join(dirPath, entry.name)
          }
        }
      } catch {
        /* skip inaccessible */
      }
    }
    return null
  }

  private async launchFile(filePath: string): Promise<void> {
    const _ext = extname(filePath).toLowerCase()
    const cmd = FILE_OPEN_COMMANDS[platform()] ?? 'xdg-open'
    const { exec } = await import('node:child_process')
    exec(`${cmd} "${filePath}"`, (err) => {
      if (err) console.error(`[FileExecutor] Failed to launch ${filePath}:`, err.message)
    })
  }

  private fail(intent: ParsedIntent, traceId: string, start: number, error: string): CommandResult {
    return {
      ok: false,
      intent: intent.intent,
      error,
      latencyMs: Date.now() - start,
      traceId,
      classification: 'read',
    }
  }
}
