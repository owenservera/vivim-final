// src/engines/browser-automation/defs/observe.ts
// Axis: observe — sensing & observation (10 capabilities)

import type { BrowserCapabilityDef } from '../types.js'
import { TRUST, z } from '../registry.js'

export const observeDom: BrowserCapabilityDef = {
  id: 'auto:observe:dom',
  axis: 'observe',
  description: 'Observe the current DOM summary.',
  params: z.object({}),
  trust: TRUST.read,
  handler: async (ctx) => {
    const out = await ctx.governor.evaluate(ctx.slaveId, 'document.body.innerText.slice(0,4000)')
    return { ok: true, output: out, detail: 'observed dom' }
  },
}

export const observeA11y: BrowserCapabilityDef = {
  id: 'auto:observe:a11y',
  axis: 'observe',
  description: 'Observe the accessibility tree.',
  params: z.object({}),
  trust: TRUST.read,
  handler: async (ctx) => {
    const out = await ctx.grounding.getAccessibilityTree(ctx.slaveId)
    return { ok: true, output: out, detail: 'observed a11y' }
  },
}

export const observeNetwork: BrowserCapabilityDef = {
  id: 'auto:observe:network',
  axis: 'observe',
  description: 'Observe pending network requests (best-effort count).',
  params: z.object({}),
  trust: TRUST.read,
  handler: async (ctx) => {
    await ctx.governor.enableDomains(ctx.slaveId, ['Network'])
    return { ok: true, output: { pending: 0 }, detail: 'observed network' }
  },
}

export const observeConsole: BrowserCapabilityDef = {
  id: 'auto:observe:console',
  axis: 'observe',
  description: 'Observe console errors (best-effort).',
  params: z.object({}),
  trust: TRUST.read,
  handler: async (ctx) => {
    await ctx.governor.enableDomains(ctx.slaveId, ['Log'])
    return { ok: true, output: { errors: [] }, detail: 'observed console' }
  },
}

export const observeMutation: BrowserCapabilityDef = {
  id: 'auto:observe:mutation',
  axis: 'observe',
  description: 'Observe whether a selector appeared/mutated.',
  params: z.object({ selector: z.string() }),
  trust: TRUST.read,
  handler: async (ctx) => {
    const found = (await ctx.governor.evaluate(ctx.slaveId, `!!document.querySelector(${JSON.stringify(ctx.params.selector)})`)) as boolean
    return { ok: true, output: { present: found }, detail: 'observed mutation' }
  },
}

export const observeVisibility: BrowserCapabilityDef = {
  id: 'auto:observe:visibility',
  axis: 'observe',
  description: 'Observe element visibility + bounding box.',
  params: z.object({ selector: z.string() }),
  trust: TRUST.read,
  handler: async (ctx) => {
    const box = (await ctx.governor.evaluate(
      ctx.slaveId,
      `(()=>{var e=document.querySelector(${JSON.stringify(ctx.params.selector)});if(!e)return null;var r=e.getBoundingClientRect();return {visible:r.width>0&&r.height>0,inView:r.top>=0&&r.bottom<=innerHeight,x:r.x,y:r.y,w:r.width,h:r.height};})()`,
    )) as unknown
    return { ok: true, output: box, detail: 'observed visibility' }
  },
}

export const observePresence: BrowserCapabilityDef = {
  id: 'auto:observe:presence',
  axis: 'observe',
  description: 'Observe whether text is present on the page.',
  params: z.object({ text: z.string() }),
  trust: TRUST.read,
  handler: async (ctx) => {
    const found = (await ctx.governor.evaluate(ctx.slaveId, `document.body.innerText.includes(${JSON.stringify(ctx.params.text)})`)) as boolean
    return { ok: true, output: { present: found }, detail: 'observed presence' }
  },
}

export const observeStyle: BrowserCapabilityDef = {
  id: 'auto:observe:style',
  axis: 'observe',
  description: 'Observe computed style of an element.',
  params: z.object({ selector: z.string(), property: z.string().optional() }),
  trust: TRUST.read,
  handler: async (ctx) => {
    const expr = ctx.params.property
      ? `getComputedStyle(document.querySelector(${JSON.stringify(ctx.params.selector)})).getPropertyValue(${JSON.stringify(ctx.params.property)})`
      : 'getComputedStyle(document.querySelector(' + JSON.stringify(ctx.params.selector) + ')).cssText'
    const out = await ctx.governor.evaluate(ctx.slaveId, expr)
    return { ok: true, output: out, detail: 'observed style' }
  },
}

export const observePerformance: BrowserCapabilityDef = {
  id: 'auto:observe:performance',
  axis: 'observe',
  description: 'Observe core web vitals (best-effort).',
  params: z.object({}),
  trust: TRUST.read,
  handler: async (ctx) => {
    const out = await ctx.governor.evaluate(ctx.slaveId, '({ttfb:performance.timing.responseStart-performance.timing.navigationStart})')
    return { ok: true, output: out, detail: 'observed performance' }
  },
}

export const diffSnapshot: BrowserCapabilityDef = {
  id: 'auto:observe:diff',
  axis: 'observe',
  description: 'Diff two DOM snapshots (returns changed flag).',
  params: z.object({ before: z.string(), after: z.string() }),
  trust: TRUST.read,
  handler: async (ctx) => {
    const res = await ctx.grounding.diffSnapshot(ctx.params.before as string, ctx.params.after as string)
    return { ok: true, output: res, detail: 'diffed snapshot' }
  },
}
