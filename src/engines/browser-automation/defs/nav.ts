// src/engines/browser-automation/defs/nav.ts
// Axis: nav — navigation & lifecycle (10 capabilities)

import type { BrowserCapabilityDef } from '../types.js'
import { TRUST, z } from '../registry.js'

const navUrl = z.object({ url: z.string().url() })

export const navigate: BrowserCapabilityDef = {
  id: 'auto:nav:navigate',
  axis: 'nav',
  description: 'Navigate the page to a URL.',
  params: navUrl,
  trust: TRUST.read,
  handler: async ({ slaveId, governor, params }) => {
    await governor.evaluate(slaveId, `window.location.href = ${JSON.stringify(params.url)}`)
    await new Promise((r) => setTimeout(r, 400))
    return { ok: true, detail: `navigated to ${params.url}` }
  },
}

export const reload: BrowserCapabilityDef = {
  id: 'auto:nav:reload',
  axis: 'nav',
  description: 'Reload the current page.',
  params: z.object({}),
  trust: TRUST.read,
  handler: async ({ slaveId, governor }) => {
    await governor.cdp.send(slaveId, 'Page.reload', {})
    return { ok: true, detail: 'reloaded' }
  },
}

export const back: BrowserCapabilityDef = {
  id: 'auto:nav:back',
  axis: 'nav',
  description: 'Navigate back in history.',
  params: z.object({}),
  trust: TRUST.read,
  handler: async ({ slaveId, governor }) => {
    await governor.evaluate(slaveId, 'history.back()')
    return { ok: true, detail: 'back' }
  },
}

export const forward: BrowserCapabilityDef = {
  id: 'auto:nav:forward',
  axis: 'nav',
  description: 'Navigate forward in history.',
  params: z.object({}),
  trust: TRUST.read,
  handler: async ({ slaveId, governor }) => {
    await governor.evaluate(slaveId, 'history.forward()')
    return { ok: true, detail: 'forward' }
  },
}

export const stop: BrowserCapabilityDef = {
  id: 'auto:nav:stop',
  axis: 'nav',
  description: 'Stop the current page load.',
  params: z.object({}),
  trust: TRUST.read,
  handler: async ({ slaveId, governor }) => {
    await governor.cdp.send(slaveId, 'Page.stopLoading', {})
    return { ok: true, detail: 'stopped' }
  },
}

export const closePage: BrowserCapabilityDef = {
  id: 'auto:nav:close-page',
  axis: 'nav',
  description: 'Close the active page/tab.',
  params: z.object({}),
  trust: TRUST.write,
  handler: async ({ slaveId, governor }) => {
    await governor.cdp.send(slaveId, 'Page.close', {})
    return { ok: true, detail: 'page closed' }
  },
}

export const newPage: BrowserCapabilityDef = {
  id: 'auto:nav:new-page',
  axis: 'nav',
  description: 'Open a new blank page.',
  params: z.object({ url: z.string().url().optional() }),
  trust: TRUST.read,
  handler: async ({ slaveId, governor, params }) => {
    const res = (await governor.cdp.send(slaveId, 'Target.createTarget', {
      url: (params.url as string) ?? 'about:blank',
    })) as { targetId?: string }
    return { ok: true, detail: `created ${res.targetId}` }
  },
}

export const gotoFragment: BrowserCapabilityDef = {
  id: 'auto:nav:goto-fragment',
  axis: 'nav',
  description: 'Navigate to a URL fragment/anchor.',
  params: z.object({ fragment: z.string() }),
  trust: TRUST.read,
  handler: async ({ slaveId, governor, params }) => {
    await governor.evaluate(slaveId, `location.hash = ${JSON.stringify(params.fragment)}`)
    return { ok: true, detail: `hash ${params.fragment}` }
  },
}

export const historyList: BrowserCapabilityDef = {
  id: 'auto:nav:history-list',
  axis: 'nav',
  description: 'Return current URL.',
  params: z.object({}),
  trust: TRUST.read,
  handler: async ({ slaveId, governor }) => {
    const url = await governor.evaluate(slaveId, 'location.href')
    return { ok: true, output: url, detail: String(url) }
  },
}

export const prefetch: BrowserCapabilityDef = {
  id: 'auto:nav:prefetch',
  axis: 'nav',
  description: 'Prefetch a URL via a link element.',
  params: navUrl,
  trust: TRUST.read,
  handler: async ({ slaveId, governor, params }) => {
    await governor.evaluate(
      slaveId,
      `(function(){var l=document.createElement('link');l.rel='prefetch';l.href=${JSON.stringify(params.url)};document.head.appendChild(l);})()`,
    )
    return { ok: true, detail: `prefetch ${params.url}` }
  },
}
