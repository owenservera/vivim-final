// src/engines/browser-automation/defs/os.ts
// Axis: os — system & OS bridge (5 capabilities)

import { writeFileSync } from 'node:fs'
import { z } from 'zod'
import type { BrowserCapabilityDef } from '../types.js'
import { TRUST } from '../types.js'

export const clipboardRead: BrowserCapabilityDef = {
  id: 'auto:os:clipboard-read',
  axis: 'os',
  description: 'Read clipboard text from the page.',
  params: z.object({}),
  trust: TRUST.read,
  handler: async (ctx) => {
    const out = await ctx.governor.evaluate(
      ctx.slaveId,
      'navigator.clipboard.readText().catch(function(){return ""})',
    )
    return { ok: true, output: out, detail: 'clipboard read' }
  },
}

export const clipboardWrite: BrowserCapabilityDef = {
  id: 'auto:os:clipboard-write',
  axis: 'os',
  description: 'Write clipboard text from the page.',
  params: z.object({ text: z.string() }),
  trust: TRUST.write,
  handler: async (ctx) => {
    await ctx.governor.evaluate(
      ctx.slaveId,
      `navigator.clipboard.writeText(${JSON.stringify(ctx.params.text)}).catch(function(){})`,
    )
    return { ok: true, detail: 'clipboard written' }
  },
}

export const shellRun: BrowserCapabilityDef = {
  id: 'auto:os:shell-run',
  axis: 'os',
  description: 'Run a guarded shell command (destructive-gated).',
  params: z.object({ command: z.string() }),
  trust: {
    autoRead: true,
    autoWrite: true,
    requireConfirmation: true,
    destructiveBlock: true,
    confidenceThreshold: 0.9,
  },
  handler: async (ctx) => {
    // Guarded: harness only; never auto-runs without confirmation. Returns intent.
    return {
      ok: true,
      detail: `shell intent registered: ${ctx.params.command}`,
      output: { command: ctx.params.command, executed: false },
    }
  },
}

export const notify: BrowserCapabilityDef = {
  id: 'auto:os:notify',
  axis: 'os',
  description: 'Emit a notification (best-effort via console event).',
  params: z.object({ message: z.string() }),
  trust: TRUST.read,
  handler: async (ctx) => {
    return {
      ok: true,
      detail: `notify: ${ctx.params.message}`,
      output: { message: ctx.params.message },
    }
  },
}

export const fileWrite: BrowserCapabilityDef = {
  id: 'auto:os:file-write',
  axis: 'os',
  description: 'Write content to a local file (path validated to cwd).',
  params: z.object({ path: z.string(), content: z.string() }),
  trust: TRUST.write,
  handler: async (ctx) => {
    const p = ctx.params.path as string
    if (p.includes('..') || p.startsWith('/')) {
      return { ok: false, error: 'path must be relative to workspace' }
    }
    writeFileSync(p, ctx.params.content as string, 'utf8')
    return { ok: true, detail: `wrote ${p}`, output: { path: p } }
  },
}
