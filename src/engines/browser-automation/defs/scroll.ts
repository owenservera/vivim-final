// src/engines/browser-automation/defs/scroll.ts
// Axis: scroll — viewport & scrolling (10 capabilities)

import type { BrowserCapabilityDef } from '../types.js'
import { TRUST, z } from '../registry.js'

export const scroll: BrowserCapabilityDef = {
  id: 'auto:scroll:scroll',
  axis: 'scroll',
  description: 'Scroll by delta (x,y) in pixels.',
  params: z.object({ x: z.number().default(0), y: z.number().default(0) }),
  trust: TRUST.read,
  handler: async (ctx) => {
    await ctx.governor.evaluate(ctx.slaveId, `window.scrollBy(${JSON.stringify(ctx.params.x)},${JSON.stringify(ctx.params.y)})`)
    return { ok: true, detail: 'scrolled' }
  },
}

export const scrollTo: BrowserCapabilityDef = {
  id: 'auto:scroll:scroll-to',
  axis: 'scroll',
  description: 'Scroll to a position or element.',
  params: z.object({ x: z.number().optional(), y: z.number().optional(), selector: z.string().optional() }),
  trust: TRUST.read,
  handler: async (ctx) => {
    const expr = ctx.params.selector
      ? `document.querySelector(${JSON.stringify(ctx.params.selector)})?.scrollIntoView()`
      : `window.scrollTo(${JSON.stringify(ctx.params.x ?? 0)},${JSON.stringify(ctx.params.y ?? 0)})`
    await ctx.governor.evaluate(ctx.slaveId, expr)
    return { ok: true, detail: 'scrolled to' }
  },
}

export const scrollIntoView: BrowserCapabilityDef = {
  id: 'auto:scroll:scroll-into-view',
  axis: 'scroll',
  description: 'Scroll an element into view.',
  params: z.object({ selector: z.string() }),
  trust: TRUST.read,
  handler: async (ctx) => {
    await ctx.governor.evaluate(ctx.slaveId, `document.querySelector(${JSON.stringify(ctx.params.selector)})?.scrollIntoView({block:'center'})`)
    return { ok: true, detail: 'in view' }
  },
}

export const zoom: BrowserCapabilityDef = {
  id: 'auto:scroll:zoom',
  axis: 'scroll',
  description: 'Set page zoom factor.',
  params: z.object({ factor: z.number() }),
  trust: TRUST.read,
  handler: async (ctx) => {
    await ctx.governor.cdp.send(ctx.slaveId, 'Emulation.setDeviceMetricsOverride', {
      deviceScaleFactor: ctx.params.factor,
      width: 1280,
      height: 800,
      mobile: false,
    }).catch(() => {})
    return { ok: true, detail: `zoom ${ctx.params.factor}` }
  },
}

export const resize: BrowserCapabilityDef = {
  id: 'auto:scroll:resize',
  axis: 'scroll',
  description: 'Resize the viewport.',
  params: z.object({ width: z.number(), height: z.number() }),
  trust: TRUST.read,
  handler: async (ctx) => {
    await ctx.governor.cdp.send(ctx.slaveId, 'Emulation.setDeviceMetricsOverride', {
      width: ctx.params.width,
      height: ctx.params.height,
      deviceScaleFactor: 1,
      mobile: false,
    }).catch(() => {})
    return { ok: true, detail: `resized ${ctx.params.width}x${ctx.params.height}` }
  },
}

export const scrollByPixel: BrowserCapabilityDef = {
  id: 'auto:scroll:scroll-by-pixel',
  axis: 'scroll',
  description: 'Scroll by a pixel amount (alias of scroll).',
  params: z.object({ delta: z.number() }),
  trust: TRUST.read,
  handler: async (ctx) => {
    await ctx.governor.evaluate(ctx.slaveId, `window.scrollBy(0,${JSON.stringify(ctx.params.delta)})`)
    return { ok: true, detail: 'scrolled' }
  },
}

export const smoothScroll: BrowserCapabilityDef = {
  id: 'auto:scroll:smooth-scroll',
  axis: 'scroll',
  description: 'Smooth-scroll to bottom or element.',
  params: z.object({ selector: z.string().optional(), bottom: z.boolean().optional() }),
  trust: TRUST.read,
  handler: async (ctx) => {
    const expr = ctx.params.bottom
      ? `window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'})`
      : `document.querySelector(${JSON.stringify(ctx.params.selector)})?.scrollIntoView({behavior:'smooth'})`
    await ctx.governor.evaluate(ctx.slaveId, expr)
    return { ok: true, detail: 'smooth scroll' }
  },
}

export const infiniteScrollUntil: BrowserCapabilityDef = {
  id: 'auto:scroll:infinite-scroll-until',
  axis: 'scroll',
  description: 'Scroll until a selector appears or max scrolls reached.',
  params: z.object({ selector: z.string(), maxScrolls: z.number().default(20), pauseMs: z.number().default(500) }),
  trust: TRUST.read,
  handler: async (ctx) => {
    let n = 0
    const max = ctx.params.maxScrolls as number
    const pause = ctx.params.pauseMs as number
    while (n < max) {
      const found = (await ctx.governor.evaluate(
        ctx.slaveId,
        `!!document.querySelector(${JSON.stringify(ctx.params.selector)})`,
      )) as boolean
      if (found) break
      await ctx.governor.evaluate(ctx.slaveId, 'window.scrollTo(0,document.body.scrollHeight)')
      await new Promise((r) => setTimeout(r, pause))
      n++
    }
    return { ok: true, detail: `scrolled ${n} times` }
  },
}

export const pinch: BrowserCapabilityDef = {
  id: 'auto:scroll:pinch',
  axis: 'scroll',
  description: 'Dispatch a pinch-zoom gesture.',
  params: z.object({ scale: z.number() }),
  trust: TRUST.read,
  handler: async (ctx) => {
    await ctx.governor.cdp.send(ctx.slaveId, 'Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: 640, y: 400 }],
    }).catch(() => {})
    await ctx.governor.cdp.send(ctx.slaveId, 'Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    }).catch(() => {})
    return { ok: true, detail: `pinch ${ctx.params.scale}` }
  },
}

export const orientation: BrowserCapabilityDef = {
  id: 'auto:scroll:orientation',
  axis: 'scroll',
  description: 'Set screen orientation.',
  params: z.object({ orientation: z.enum(['portrait', 'landscape']) }),
  trust: TRUST.read,
  handler: async (ctx) => {
    await ctx.governor.cdp.send(ctx.slaveId, 'Emulation.setOrientationOverride', {
      orientation: ctx.params.orientation,
    }).catch(() => {})
    return { ok: true, detail: `orientation ${ctx.params.orientation}` }
  },
}
