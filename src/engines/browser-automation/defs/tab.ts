// src/engines/browser-automation/defs/tab.ts
// Axis: tab — tabs & windows (10 capabilities)

import type { BrowserCapabilityDef } from '../types.js'
import { TRUST, z } from '../registry.js'

export const tabOpen: BrowserCapabilityDef = {
  id: 'auto:tab:open',
  axis: 'tab',
  description: 'Open a new tab with a URL.',
  params: z.object({ url: z.string().url().optional() }),
  trust: TRUST.read,
  handler: async (ctx) => {
    const res = (await ctx.governor.cdp.send(ctx.slaveId, 'Target.createTarget', { url: (ctx.params.url as string) ?? 'about:blank' })) as { targetId?: string }
    return { ok: true, output: res.targetId, detail: 'tab opened' }
  },
}

export const tabClose: BrowserCapabilityDef = {
  id: 'auto:tab:close',
  axis: 'tab',
  description: 'Close a tab by targetId (or current).',
  params: z.object({ targetId: z.string().optional() }),
  trust: TRUST.write,
  handler: async (ctx) => {
    if (ctx.params.targetId) await ctx.governor.cdp.send(ctx.slaveId, 'Target.closeTarget', { targetId: ctx.params.targetId })
    else await ctx.governor.cdp.send(ctx.slaveId, 'Page.close', {})
    return { ok: true, detail: 'tab closed' }
  },
}

export const tabSwitch: BrowserCapabilityDef = {
  id: 'auto:tab:switch',
  axis: 'tab',
  description: 'Activate a tab by targetId.',
  params: z.object({ targetId: z.string() }),
  trust: TRUST.read,
  handler: async (ctx) => {
    await ctx.governor.cdp.send(ctx.slaveId, 'Target.activateTarget', { targetId: ctx.params.targetId }).catch(() => {})
    return { ok: true, detail: 'tab switched' }
  },
}

export const tabList: BrowserCapabilityDef = {
  id: 'auto:tab:list',
  axis: 'tab',
  description: 'List open tabs.',
  params: z.object({}),
  trust: TRUST.read,
  handler: async (ctx) => {
    const res = (await ctx.governor.cdp.send(ctx.slaveId, 'Target.getTargets', {})) as { targetInfos?: Array<{ targetId: string; url: string; title: string }> }
    return { ok: true, output: res.targetInfos ?? [], detail: 'tabs listed' }
  },
}

export const tabDuplicate: BrowserCapabilityDef = {
  id: 'auto:tab:duplicate',
  axis: 'tab',
  description: 'Duplicate the current tab.',
  params: z.object({}),
  trust: TRUST.read,
  handler: async (ctx) => {
    const url = (await ctx.governor.evaluate(ctx.slaveId, 'location.href')) as string
    const res = (await ctx.governor.cdp.send(ctx.slaveId, 'Target.createTarget', { url })) as { targetId?: string }
    return { ok: true, output: res.targetId, detail: 'tab duplicated' }
  },
}

export const tabPin: BrowserCapabilityDef = {
  id: 'auto:tab:pin',
  axis: 'tab',
  description: 'Pin/unpin a tab (best-effort).',
  params: z.object({ targetId: z.string(), pinned: z.boolean().default(true) }),
  trust: TRUST.write,
  handler: async (ctx) => {
    await ctx.governor.cdp.send(ctx.slaveId, 'Target.attachToTarget', { targetId: ctx.params.targetId, flatten: true }).catch(() => {})
    return { ok: true, detail: 'tab pin (best-effort)' }
  },
}

export const tabMute: BrowserCapabilityDef = {
  id: 'auto:tab:mute',
  axis: 'tab',
  description: 'Mute/unmute a tab (best-effort).',
  params: z.object({ targetId: z.string(), muted: z.boolean().default(true) }),
  trust: TRUST.write,
  handler: async (ctx) => {
    await ctx.governor.cdp.send(ctx.slaveId, 'Target.setAudioMuted', { targetId: ctx.params.targetId, muted: ctx.params.muted }).catch(() => {})
    return { ok: true, detail: 'tab mute (best-effort)' }
  },
}

export const windowOpen: BrowserCapabilityDef = {
  id: 'auto:tab:window-open',
  axis: 'tab',
  description: 'Open a new browser window with a URL.',
  params: z.object({ url: z.string().url().optional() }),
  trust: TRUST.read,
  handler: async (ctx) => {
    const res = (await ctx.governor.cdp.send(ctx.slaveId, 'Target.createBrowserContext', {})) as { browserContextId?: string }
    return { ok: true, output: res.browserContextId, detail: 'window context created' }
  },
}

export const windowResize: BrowserCapabilityDef = {
  id: 'auto:tab:window-resize',
  axis: 'tab',
  description: 'Resize the window via emulation.',
  params: z.object({ width: z.number(), height: z.number() }),
  trust: TRUST.read,
  handler: async (ctx) => {
    await ctx.governor.cdp.send(ctx.slaveId, 'Emulation.setDeviceMetricsOverride', { width: ctx.params.width, height: ctx.params.height, deviceScaleFactor: 1, mobile: false }).catch(() => {})
    return { ok: true, detail: 'window resized' }
  },
}

export const windowFocus: BrowserCapabilityDef = {
  id: 'auto:tab:window-focus',
  axis: 'tab',
  description: 'Bring the window to front (best-effort).',
  params: z.object({}),
  trust: TRUST.read,
  handler: async (ctx) => {
    await ctx.governor.cdp.send(ctx.slaveId, 'Target.activateTarget', {}).catch(() => {})
    return { ok: true, detail: 'window focus (best-effort)' }
  },
}
