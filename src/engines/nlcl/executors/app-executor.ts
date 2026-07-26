// src/engines/nlcl/executors/app-executor.ts
// AppExecutor — launch native applications (notepad, calculator, terminal, etc.)

import { platform } from 'node:os'
import { newId } from '../../../ids.js'
import { getLogger } from '../../../lib/logger.js'
import type { CommandExecutor, CommandResult, NLCContext, ParsedIntent } from '../types.js'

const log = getLogger('app-executor')

const APP_MAP: Record<string, Record<string, string[]>> = {
  win32: {
    notepad: ['notepad.exe'],
    calculator: ['calc.exe'],
    calc: ['calc.exe'],
    terminal: ['wt.exe', 'cmd.exe'],
    cmd: ['cmd.exe'],
    powershell: ['powershell.exe'],
    explorer: ['explorer.exe'],
    taskmanager: ['taskmgr.exe'],
    paint: ['mspaint.exe'],
    word: ['winword.exe'],
    excel: ['excel.exe'],
    chrome: ['chrome.exe'],
    edge: ['msedge.exe'],
    settings: ['start', 'ms-settings:'],
    snipping: ['snippingtool.exe'],
    'snip & sketch': ['ms-screenclip:'],
  },
  darwin: {
    calculator: ['open', '-a', 'Calculator'],
    calc: ['open', '-a', 'Calculator'],
    terminal: ['open', '-a', 'Terminal'],
    textedit: ['open', '-a', 'TextEdit'],
    notepad: ['open', '-a', 'TextEdit'],
    safari: ['open', '-a', 'Safari'],
    chrome: ['open', '-a', 'Google Chrome'],
    finder: ['open', '-a', 'Finder'],
    notes: ['open', '-a', 'Notes'],
    mail: ['open', '-a', 'Mail'],
    calendar: ['open', '-a', 'Calendar'],
    'app store': ['open', '-a', 'App Store'],
    activity: ['open', '-a', 'Activity Monitor'],
    screenshot: ['screencapture', '-i'],
  },
  linux: {
    terminal: ['x-terminal-emulator'],
    file: ['nautilus'],
    files: ['nautilus'],
    calculator: ['gnome-calculator'],
    calc: ['gnome-calculator'],
    text: ['gedit'],
    notepad: ['gedit'],
    chrome: ['google-chrome'],
    firefox: ['firefox'],
    settings: ['gnome-control-center'],
  },
}

export class AppExecutor implements CommandExecutor {
  readonly id = 'app' as const

  async execute(intent: ParsedIntent, _ctx: NLCContext): Promise<CommandResult> {
    const start = Date.now()
    const traceId = newId()

    try {
      const appName = ((intent.input.app as string) ?? (intent.input.name as string) ?? '')
        .toLowerCase()
        .trim()
      if (!appName) {
        return this.fail(intent, traceId, start, 'No application specified')
      }

      const os = platform()
      const appMap = APP_MAP[os] ?? APP_MAP.linux
      if (!appMap) {
        return this.fail(intent, traceId, start, `No app map for platform: ${os}`)
      }
      const cmdParts = appMap[appName]

      if (!cmdParts) {
        const available = Object.keys(appMap).join(', ')
        return this.fail(
          intent,
          traceId,
          start,
          `Unknown app "${appName}". Available: ${available}`,
        )
      }

      const { exec } = await import('node:child_process')
      const exe = cmdParts[0] ?? appName
      const args = cmdParts.slice(1)

      exec(`${exe} ${args.join(' ')}`, (err: Error | null) => {
        if (err) log.error({ err }, `[AppExecutor] Failed to launch ${appName}`)
      })

      return {
        ok: true,
        intent: intent.intent,
        output: { app: appName, launched: true, command: cmdParts.join(' ') },
        text: `Launched ${appName}`,
        latencyMs: Date.now() - start,
        traceId,
        classification: 'system',
      }
    } catch (err) {
      return this.fail(intent, traceId, start, err instanceof Error ? err.message : String(err))
    }
  }

  private fail(intent: ParsedIntent, traceId: string, start: number, error: string): CommandResult {
    return {
      ok: false,
      intent: intent.intent,
      error,
      latencyMs: Date.now() - start,
      traceId,
      classification: 'system',
    }
  }
}
