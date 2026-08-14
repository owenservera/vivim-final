// src/engines/nlcl/executors/browser-executor.ts
// BrowserExecutor — Chrome/browser operations via ChromeGovernor CDP.
// navigate, search, extract content, screenshot, type, click.

import { newId } from '../../../ids.js'
import { catchDebug } from '../../../lib/catch-logger.js'
import { getLogger } from '../../../lib/logger.js'
import type { ChromeGovernor } from '../../chrome-governor.js'
import type { ConversationManager } from '../../conversation-manager.js'
import type { CommandExecutor, CommandResult, NLCContext, ParsedIntent } from '../types.js'

const log = getLogger('browser-executor')

export class BrowserExecutor implements CommandExecutor {
  readonly id = 'browser' as const

  constructor(
    private governor?: ChromeGovernor,
    _conversationManager?: ConversationManager,
  ) {}

  async execute(intent: ParsedIntent, ctx: NLCContext): Promise<CommandResult> {
    const start = Date.now()
    const traceId = newId()

    try {
      switch (intent.intent) {
        case 'browser.navigate':
          return await this.navigate(intent, ctx, traceId, start)
        case 'browser.search':
          return await this.search(intent, ctx, traceId, start)
        case 'browser.extract':
          return await this.extract(intent, ctx, traceId, start)
        case 'browser.screenshot':
          return await this.screenshot(intent, ctx, traceId, start)
        case 'browser.open':
          return await this.openBrowser(intent, ctx, traceId, start)
        default:
          return this.fail(intent, traceId, start, `Unknown browser intent: ${intent.intent}`)
      }
    } catch (err) {
      return this.fail(intent, traceId, start, err instanceof Error ? err.message : String(err))
    }
  }

  private async navigate(
    intent: ParsedIntent,
    ctx: NLCContext,
    traceId: string,
    start: number,
  ): Promise<CommandResult> {
    const url = this.normalizeUrl(intent.input.url as string)
    if (!url) {
      return this.fail(intent, traceId, start, 'No URL specified')
    }

    if (this.governor && ctx.slaveId) {
      await this.governor.cdp.send(ctx.slaveId, 'Page.navigate', { url })
      return {
        ok: true,
        intent: intent.intent,
        output: { url, navigated: true },
        text: `Navigated to ${url}`,
        latencyMs: Date.now() - start,
        traceId,
        classification: 'navigate',
      }
    }

    await this.openExternal(url)
    return {
      ok: true,
      intent: intent.intent,
      output: { url, opened: true },
      text: `Opened ${url} in default browser`,
      latencyMs: Date.now() - start,
      traceId,
      classification: 'navigate',
    }
  }

  private async search(
    intent: ParsedIntent,
    ctx: NLCContext,
    traceId: string,
    start: number,
  ): Promise<CommandResult> {
    const query = intent.input.query as string
    if (!query) {
      return this.fail(intent, traceId, start, 'No search query specified')
    }

    const engine = (intent.input.engine as string) ?? 'google'
    const searchUrls: Record<string, string> = {
      google: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      bing: `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
      duckduckgo: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
      youtube: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
    }

    const url = searchUrls[engine.toLowerCase()] ?? searchUrls.google ?? 'https://google.com'

    if (this.governor && ctx.slaveId) {
      await this.governor.cdp.send(ctx.slaveId, 'Page.navigate', { url })
    } else {
      await this.openExternal(url)
    }

    return {
      ok: true,
      intent: intent.intent,
      output: { query, engine, url },
      text: `Searching "${query}" on ${engine}`,
      latencyMs: Date.now() - start,
      traceId,
      classification: 'navigate',
    }
  }

  private async extract(
    intent: ParsedIntent,
    ctx: NLCContext,
    traceId: string,
    start: number,
  ): Promise<CommandResult> {
    if (!this.governor || !ctx.slaveId) {
      return this.fail(intent, traceId, start, 'Browser not available — no governor/slave')
    }

    const pageState = await this.governor.cdp.getPageState(ctx.slaveId)

    let bodyText = ''
    try {
      const result = await this.governor.cdp.send(ctx.slaveId, 'Runtime.evaluate', {
        expression: 'document.body ? document.body.innerText : ""',
        returnByValue: true,
      })
      bodyText = (result as { result?: { value?: string } })?.result?.value ?? ''
    } catch (err) {
      catchDebug(err, 'engines:nlcl:executors:browser-executor:138')
      /* extraction best-effort */
    }

    const truncated =
      bodyText.length > 50000 ? `${bodyText.slice(0, 50000)}... (truncated)` : bodyText

    return {
      ok: true,
      intent: intent.intent,
      output: {
        url: pageState?.url,
        title: pageState?.title,
        text: truncated,
        length: bodyText.length,
      },
      text: `Extracted ${bodyText.length} characters from ${pageState?.title ?? 'page'}`,
      latencyMs: Date.now() - start,
      traceId,
      classification: 'read',
    }
  }

  private async screenshot(
    intent: ParsedIntent,
    ctx: NLCContext,
    traceId: string,
    start: number,
  ): Promise<CommandResult> {
    if (!this.governor || !ctx.slaveId) {
      return this.fail(intent, traceId, start, 'Browser not available — no governor/slave')
    }

    const result = await this.governor.cdp.send(ctx.slaveId, 'Page.captureScreenshot', {
      format: 'png',
    })
    const data = (result as { data?: string })?.data

    return {
      ok: true,
      intent: intent.intent,
      output: { captured: true, format: 'png', dataLength: data?.length ?? 0 },
      text: 'Screenshot captured',
      latencyMs: Date.now() - start,
      traceId,
      classification: 'read',
    }
  }

  private async openBrowser(
    intent: ParsedIntent,
    ctx: NLCContext,
    traceId: string,
    start: number,
  ): Promise<CommandResult> {
    const url = intent.input.url ? this.normalizeUrl(intent.input.url as string) : undefined

    if (this.governor && ctx.providerId && ctx.accountId) {
      const slave = await this.governor.ensureRunningForAccount(ctx.providerId, ctx.accountId)
      if (url) {
        await this.governor.cdp.send(slave.slaveId, 'Page.navigate', { url })
      }
      return {
        ok: true,
        intent: intent.intent,
        output: { slaveId: slave.slaveId, url },
        text: `Chrome opened (slave: ${slave.slaveId})`,
        latencyMs: Date.now() - start,
        traceId,
        classification: 'navigate',
      }
    }

    if (url) {
      await this.openExternal(url)
    } else {
      await this.openExternal('about:blank')
    }

    return {
      ok: true,
      intent: intent.intent,
      output: { opened: true },
      text: 'Browser opened',
      latencyMs: Date.now() - start,
      traceId,
      classification: 'navigate',
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private normalizeUrl(url: string): string {
    if (!url) return ''
    if (url.match(/^https?:\/\//i)) return url
    if (url.match(/^[\w-]+\.[\w.-]+/)) return `https://${url}`
    return `https://${url}`
  }

  private async openExternal(url: string): Promise<void> {
    const { platform } = await import('node:os')
    const os = platform()
    const cmd = os === 'win32' ? 'start' : os === 'darwin' ? 'open' : 'xdg-open'
    const { exec } = await import('node:child_process')
    const fullCmd = os === 'win32' ? `${cmd} "" "${url}"` : `${cmd} "${url}"`
    exec(fullCmd, (err) => {
      if (err) log.error({ err }, `[BrowserExecutor] Failed to open ${url}`)
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
