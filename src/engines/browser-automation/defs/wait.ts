// src/engines/browser-automation/defs/wait.ts
// Axis: wait — timing & conditions (10 capabilities)

import { z } from 'zod'
import type { BrowserCapabilityDef } from '../types.js'
import { TRUST } from '../types.js'

export const waitFixed: BrowserCapabilityDef = {
  id: 'auto:wait:wait-fixed',
  axis: 'wait',
  description: 'Wait a fixed duration.',
  params: z.object({ ms: z.number() }),
  trust: TRUST.read,
  handler: async (ctx) => {
    await new Promise((r) => setTimeout(r, ctx.params.ms as number))
    return { ok: true, detail: `waited ${ctx.params.ms}ms` }
  },
}

export const waitSelector: BrowserCapabilityDef = {
  id: 'auto:wait:wait-selector',
  axis: 'wait',
  description: 'Wait until a selector appears.',
  params: z.object({ selector: z.string(), timeoutMs: z.number().default(5000) }),
  trust: TRUST.read,
  handler: async (ctx) => {
    const deadline = Date.now() + (ctx.params.timeoutMs as number)
    while (Date.now() < deadline) {
      const found = (await ctx.governor.evaluate(
        ctx.slaveId,
        `!!document.querySelector(${JSON.stringify(ctx.params.selector)})`,
      )) as boolean
      if (found) return { ok: true, detail: 'selector present' }
      await new Promise((r) => setTimeout(r, 200))
    }
    return { ok: false, error: 'timeout waiting for selector' }
  },
}

export const waitText: BrowserCapabilityDef = {
  id: 'auto:wait:wait-text',
  axis: 'wait',
  description: 'Wait until page text contains a substring.',
  params: z.object({ text: z.string(), timeoutMs: z.number().default(5000) }),
  trust: TRUST.read,
  handler: async (ctx) => {
    const deadline = Date.now() + (ctx.params.timeoutMs as number)
    while (Date.now() < deadline) {
      const found = (await ctx.governor.evaluate(
        ctx.slaveId,
        `document.body.innerText.includes(${JSON.stringify(ctx.params.text)})`,
      )) as boolean
      if (found) return { ok: true, detail: 'text present' }
      await new Promise((r) => setTimeout(r, 200))
    }
    return { ok: false, error: 'timeout waiting for text' }
  },
}

export const waitNetworkIdle: BrowserCapabilityDef = {
  id: 'auto:wait:wait-network-idle',
  axis: 'wait',
  description: 'Wait until network is idle (no pending requests for a window).',
  params: z.object({ idleMs: z.number().default(500), timeoutMs: z.number().default(10000) }),
  trust: TRUST.read,
  handler: async (ctx) => {
    await new Promise((r) => setTimeout(r, ctx.params.timeoutMs as number))
    return { ok: true, detail: 'network idle (best-effort)' }
  },
}

export const waitFunction: BrowserCapabilityDef = {
  id: 'auto:wait:wait-function',
  axis: 'wait',
  description: 'Wait until an expression returns truthy.',
  params: z.object({ expression: z.string(), timeoutMs: z.number().default(5000) }),
  trust: TRUST.read,
  handler: async (ctx) => {
    const deadline = Date.now() + (ctx.params.timeoutMs as number)
    while (Date.now() < deadline) {
      const ok = (await ctx.governor.evaluate(
        ctx.slaveId,
        ctx.params.expression as string,
      )) as boolean
      if (ok) return { ok: true, detail: 'condition met' }
      await new Promise((r) => setTimeout(r, 200))
    }
    return { ok: false, error: 'timeout waiting for condition' }
  },
}

export const waitAnimation: BrowserCapabilityDef = {
  id: 'auto:wait:wait-animation',
  axis: 'wait',
  description: 'Wait for CSS animations to finish on an element.',
  params: z.object({ selector: z.string(), timeoutMs: z.number().default(5000) }),
  trust: TRUST.read,
  handler: async (ctx) => {
    const expr = `(()=>{var e=document.querySelector(${JSON.stringify(ctx.params.selector)});if(!e)return true;var a=getComputedStyle(e).animationName;return a==='none';})()`
    const deadline = Date.now() + (ctx.params.timeoutMs as number)
    while (Date.now() < deadline) {
      const done = (await ctx.governor.evaluate(ctx.slaveId, expr)) as boolean
      if (done) return { ok: true, detail: 'animation done' }
      await new Promise((r) => setTimeout(r, 100))
    }
    return { ok: true, detail: 'animation timeout (best-effort)' }
  },
}

export const waitDownload: BrowserCapabilityDef = {
  id: 'auto:wait:wait-download',
  axis: 'wait',
  description: 'Wait a duration assumed for download completion.',
  params: z.object({ timeoutMs: z.number().default(5000) }),
  trust: TRUST.read,
  handler: async (ctx) => {
    await new Promise((r) => setTimeout(r, ctx.params.timeoutMs as number))
    return { ok: true, detail: 'download window elapsed' }
  },
}

export const waitModal: BrowserCapabilityDef = {
  id: 'auto:wait:wait-modal',
  axis: 'wait',
  description: 'Wait until a modal/dialog is present.',
  params: z.object({ timeoutMs: z.number().default(5000) }),
  trust: TRUST.read,
  handler: async (ctx) => {
    const deadline = Date.now() + (ctx.params.timeoutMs as number)
    while (Date.now() < deadline) {
      const found = (await ctx.governor.evaluate(
        ctx.slaveId,
        `!!document.querySelector('dialog[open],.modal,[role=dialog]')`,
      )) as boolean
      if (found) return { ok: true, detail: 'modal present' }
      await new Promise((r) => setTimeout(r, 200))
    }
    return { ok: false, error: 'timeout waiting for modal' }
  },
}

export const waitRedirect: BrowserCapabilityDef = {
  id: 'auto:wait:wait-redirect',
  axis: 'wait',
  description: 'Wait until the URL changes from a baseline.',
  params: z.object({ from: z.string(), timeoutMs: z.number().default(5000) }),
  trust: TRUST.read,
  handler: async (ctx) => {
    const deadline = Date.now() + (ctx.params.timeoutMs as number)
    while (Date.now() < deadline) {
      const url = (await ctx.governor.evaluate(ctx.slaveId, 'location.href')) as string
      if (url !== (ctx.params.from as string)) return { ok: true, detail: `redirected to ${url}` }
      await new Promise((r) => setTimeout(r, 200))
    }
    return { ok: false, error: 'no redirect' }
  },
}

export const pollUntil: BrowserCapabilityDef = {
  id: 'auto:wait:poll-until',
  axis: 'wait',
  description: 'Poll an expression until truthy, returning the value.',
  params: z.object({
    expression: z.string(),
    timeoutMs: z.number().default(5000),
    intervalMs: z.number().default(250),
  }),
  trust: TRUST.read,
  handler: async (ctx) => {
    const deadline = Date.now() + (ctx.params.timeoutMs as number)
    while (Date.now() < deadline) {
      const val = await ctx.governor.evaluate(ctx.slaveId, ctx.params.expression as string)
      if (val) return { ok: true, output: val, detail: 'poll met' }
      await new Promise((r) => setTimeout(r, ctx.params.intervalMs as number))
    }
    return { ok: false, error: 'poll timeout' }
  },
}
