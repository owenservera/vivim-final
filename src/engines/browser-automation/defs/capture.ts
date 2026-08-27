// src/engines/browser-automation/defs/capture.ts
// Axis: capture — media & capture (10 capabilities)

import { z } from 'zod'
import type { BrowserCapabilityDef } from '../types.js'
import { TRUST } from '../types.js'

export const screenshot: BrowserCapabilityDef = {
  id: 'auto:capture:screenshot',
  axis: 'capture',
  description: 'Capture a screenshot (base64 PNG).',
  params: z.object({
    region: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).optional(),
  }),
  trust: TRUST.read,
  handler: async (ctx) => {
    const data = await ctx.governor.captureScreenshot(
      ctx.slaveId,
      ctx.params.region as { x: number; y: number; w: number; h: number } | undefined,
    )
    return { ok: true, output: data, detail: 'screenshot captured' }
  },
}

export const screenshotElement: BrowserCapabilityDef = {
  id: 'auto:capture:screenshot-element',
  axis: 'capture',
  description: 'Capture a screenshot of a specific element.',
  params: z.object({ selector: z.string() }),
  trust: TRUST.read,
  handler: async (ctx) => {
    const box = (await ctx.governor.evaluate(
      ctx.slaveId,
      `(()=>{var e=document.querySelector(${JSON.stringify(ctx.params.selector)});if(!e)return null;var r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};})()`,
    )) as { x: number; y: number; w: number; h: number } | null
    if (!box) return { ok: false, error: 'element not found' }
    const data = await ctx.governor.captureScreenshot(ctx.slaveId, box)
    return { ok: true, output: data, detail: 'element screenshot' }
  },
}

export const pdf: BrowserCapabilityDef = {
  id: 'auto:capture:pdf',
  axis: 'capture',
  description: 'Print the page to PDF (base64).',
  params: z.object({}),
  trust: TRUST.read,
  handler: async (ctx) => {
    const res = (await ctx.governor.cdp.send(ctx.slaveId, 'Page.printToPDF', {})) as {
      data?: string
    }
    return { ok: true, output: res.data, detail: 'pdf printed' }
  },
}

export const recordVideo: BrowserCapabilityDef = {
  id: 'auto:capture:record-video',
  axis: 'capture',
  description: 'Begin/stop a screencast (returns frames flag).',
  params: z.object({ action: z.enum(['start', 'stop']) }),
  trust: TRUST.read,
  handler: async (ctx) => {
    if (ctx.params.action === 'start') {
      await ctx.governor.cdp
        .send(ctx.slaveId, 'Page.startScreencast', { format: 'png', everyNthFrame: 1 })
        .catch(() => {})
      // [audit] log the error with context here
    } else {
      await ctx.governor.cdp.send(ctx.slaveId, 'Page.stopScreencast', {}).catch(() => {})
      // [audit] log the error with context here
    }
    return { ok: true, detail: `screencast ${ctx.params.action}` }
  },
}

export const captureConsole: BrowserCapabilityDef = {
  id: 'auto:capture:capture-console',
  axis: 'capture',
  description: 'Enable console capture (best-effort).',
  params: z.object({}),
  trust: TRUST.read,
  handler: async (ctx) => {
    await ctx.governor.enableDomains(ctx.slaveId, ['Log'])
    return { ok: true, detail: 'console capture enabled' }
  },
}

export const captureNetwork: BrowserCapabilityDef = {
  id: 'auto:capture:capture-network',
  axis: 'capture',
  description: 'Enable network capture (best-effort).',
  params: z.object({}),
  trust: TRUST.read,
  handler: async (ctx) => {
    await ctx.governor.enableDomains(ctx.slaveId, ['Network'])
    return { ok: true, detail: 'network capture enabled' }
  },
}

export const capturePerformance: BrowserCapabilityDef = {
  id: 'auto:capture:capture-performance',
  axis: 'capture',
  description: 'Return performance metrics.',
  params: z.object({}),
  trust: TRUST.read,
  handler: async (ctx) => {
    const out = await ctx.governor.evaluate(
      ctx.slaveId,
      'JSON.stringify(performance.getEntries().map(function(e){return {name:e.name,duration:e.duration}}) )',
    )
    return { ok: true, output: out, detail: 'performance captured' }
  },
}

export const captureTrace: BrowserCapabilityDef = {
  id: 'auto:capture:capture-trace',
  axis: 'capture',
  description: 'Start/stop a CDP tracing session.',
  params: z.object({ action: z.enum(['start', 'stop']) }),
  trust: TRUST.read,
  handler: async (ctx) => {
    if (ctx.params.action === 'start') {
      await ctx.governor.cdp
        .send(ctx.slaveId, 'Tracing.start', { categories: 'devtools.timeline' })
        .catch(() => {})
      // [audit] log the error with context here
    } else {
      await ctx.governor.cdp.send(ctx.slaveId, 'Tracing.end', {}).catch(() => {})
      // [audit] log the error with context here
    }
    return { ok: true, detail: `trace ${ctx.params.action}` }
  },
}

export const clipCopy: BrowserCapabilityDef = {
  id: 'auto:capture:clip-copy',
  axis: 'capture',
  description: 'Copy text to the clipboard.',
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

export const ocrRegion: BrowserCapabilityDef = {
  id: 'auto:capture:ocr-region',
  axis: 'capture',
  description: 'Capture a region (OCR delegated to caller; returns base64).',
  params: z.object({
    region: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
  }),
  trust: TRUST.read,
  handler: async (ctx) => {
    const data = await ctx.governor.captureScreenshot(
      ctx.slaveId,
      ctx.params.region as { x: number; y: number; w: number; h: number },
    )
    return { ok: true, output: data, detail: 'region captured for OCR' }
  },
}
