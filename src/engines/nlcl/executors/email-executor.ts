// src/engines/nlcl/executors/email-executor.ts
// EmailExecutor — email composition and sending.
// Uses system mailto: protocol by default; pluggable mail adapter for SMTP/API.

export interface MailAdapter {
  send(opts: { to: string; subject: string; body: string }): Promise<{ ok: boolean; messageId?: string; error?: string }>
}

import type { CommandExecutor, CommandResult, ParsedIntent, NLCContext } from '../types.js'
import { newId } from '../../../ids.js'

export class EmailExecutor implements CommandExecutor {
  readonly id = 'email' as const
  private mailAdapter: MailAdapter | null = null

  setMailAdapter(adapter: MailAdapter): void {
    this.mailAdapter = adapter
  }

  async execute(intent: ParsedIntent, ctx: NLCContext): Promise<CommandResult> {
    const start = Date.now()
    const traceId = newId()

    try {
      switch (intent.intent) {
        case 'email.send':
          return await this.sendEmail(intent, ctx, traceId, start)
        case 'email.compose':
          return await this.composeEmail(intent, ctx, traceId, start)
        default:
          return this.fail(intent, traceId, start, `Unknown email intent: ${intent.intent}`)
      }
    } catch (err) {
      return this.fail(intent, traceId, start, err instanceof Error ? err.message : String(err))
    }
  }

  private async sendEmail(
    intent: ParsedIntent,
    ctx: NLCContext,
    traceId: string,
    start: number,
  ): Promise<CommandResult> {
    const to = intent.input.to as string
    const subject = (intent.input.subject as string) ?? 'No Subject'
    const body = (intent.input.body as string) ?? ''

    if (!to) {
      return this.fail(intent, traceId, start, 'No recipient specified')
    }

    if (this.mailAdapter) {
      const result = await this.mailAdapter.send({ to, subject, body })
      return {
        ok: result.ok,
        intent: intent.intent,
        output: { to, subject, messageId: result.messageId },
        text: result.ok ? `Email sent to ${to}` : `Failed to send: ${result.error}`,
        error: result.error,
        latencyMs: Date.now() - start,
        traceId,
        classification: 'communication',
      }
    }

    const mailtoUrl = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    await this.openExternal(mailtoUrl)

    return {
      ok: true,
      intent: intent.intent,
      output: { to, subject, via: 'mailto' },
      text: `Email draft opened for ${to}`,
      latencyMs: Date.now() - start,
      traceId,
      classification: 'communication',
      followUp: 'Mail client opened. Review and send manually.',
    }
  }

  private async composeEmail(
    intent: ParsedIntent,
    ctx: NLCContext,
    traceId: string,
    start: number,
  ): Promise<CommandResult> {
    const to = (intent.input.to as string) ?? ''
    const subject = (intent.input.subject as string) ?? ''
    const body = (intent.input.body as string) ?? ''

    const mailtoUrl = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    await this.openExternal(mailtoUrl)

    return {
      ok: true,
      intent: intent.intent,
      output: { to, subject, via: 'mailto' },
      text: 'Email composer opened',
      latencyMs: Date.now() - start,
      traceId,
      classification: 'communication',
    }
  }

  private async openExternal(url: string): Promise<void> {
    const { platform } = await import('node:os')
    const os = platform()
    const cmd = os === 'win32' ? 'start' : os === 'darwin' ? 'open' : 'xdg-open'
    const { exec } = await import('node:child_process')
    const fullCmd = os === 'win32' ? `${cmd} "" "${url}"` : `${cmd} "${url}"`
    exec(fullCmd, (err) => {
      if (err) console.error(`[EmailExecutor] Failed to open ${url}:`, err.message)
    })
  }

  private fail(intent: ParsedIntent, traceId: string, start: number, error: string): CommandResult {
    return {
      ok: false,
      intent: intent.intent,
      error,
      latencyMs: Date.now() - start,
      traceId,
      classification: 'communication',
    }
  }
}
