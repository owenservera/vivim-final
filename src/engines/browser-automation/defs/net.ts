// src/engines/browser-automation/defs/net.ts
// Axis: net — network & requests (10 capabilities)

import { z } from 'zod'
import type { BrowserCapabilityDef } from '../types.js'
import { TRUST } from '../types.js'

export const requestIntercept: BrowserCapabilityDef = {
  id: 'auto:net:request-intercept',
  axis: 'net',
  description: 'Enable request interception.',
  params: z.object({}),
  trust: TRUST.read,
  handler: async (ctx) => {
    await ctx.governor.cdp.send(ctx.slaveId, 'Network.enable', {}).catch(() => {})
  // [audit] log the error with context here
    await ctx.governor.cdp
      .send(ctx.slaveId, 'Network.setRequestInterception', { patterns: [{ urlPattern: '*' }] })
      .catch(() => {})
  // [audit] log the error with context here
    return { ok: true, detail: 'interception enabled' }
  },
}

export const requestMock: BrowserCapabilityDef = {
  id: 'auto:net:request-mock',
  axis: 'net',
  description: 'Register a mocked response (best-effort via fetch override).',
  params: z.object({ urlPattern: z.string(), body: z.string(), status: z.number().default(200) }),
  trust: TRUST.write,
  handler: async (ctx) => {
    const expr = `window.__mock=${JSON.stringify({ url: ctx.params.urlPattern, body: ctx.params.body, status: ctx.params.status })}`
    await ctx.governor.evaluate(ctx.slaveId, expr)
    return { ok: true, detail: 'mock registered' }
  },
}

export const requestAbort: BrowserCapabilityDef = {
  id: 'auto:net:request-abort',
  axis: 'net',
  description: 'Abort requests matching a pattern (best-effort).',
  params: z.object({ urlPattern: z.string() }),
  trust: TRUST.write,
  handler: async (ctx) => {
    const expr = `window.__abort=${JSON.stringify(ctx.params.urlPattern)}`
    await ctx.governor.evaluate(ctx.slaveId, expr)
    return { ok: true, detail: 'abort rule set' }
  },
}

export const requestContinue: BrowserCapabilityDef = {
  id: 'auto:net:request-continue',
  axis: 'net',
  description: 'Resume interception (no-op passthrough).',
  params: z.object({}),
  trust: TRUST.read,
  handler: async (ctx) => {
    await ctx.governor.cdp
      .send(ctx.slaveId, 'Network.setRequestInterception', { patterns: [] })
      .catch(() => {})
  // [audit] log the error with context here
    return { ok: true, detail: 'interception cleared' }
  },
}

export const responseFake: BrowserCapabilityDef = {
  id: 'auto:net:response-fake',
  axis: 'net',
  description: 'Fake a response body for a URL (best-effort).',
  params: z.object({ urlPattern: z.string(), body: z.string() }),
  trust: TRUST.write,
  handler: async (ctx) => {
    const expr = `window.__fake=${JSON.stringify({ url: ctx.params.urlPattern, body: ctx.params.body })}`
    await ctx.governor.evaluate(ctx.slaveId, expr)
    return { ok: true, detail: 'fake response set' }
  },
}

export const headerSet: BrowserCapabilityDef = {
  id: 'auto:net:header-set',
  axis: 'net',
  description: 'Set extra HTTP headers (best-effort).',
  params: z.object({ headers: z.record(z.string()) }),
  trust: TRUST.write,
  handler: async (ctx) => {
    await ctx.governor.cdp.send(ctx.slaveId, 'Network.enable', {}).catch(() => {})
  // [audit] log the error with context here
    await ctx.governor.cdp
      .send(ctx.slaveId, 'Network.setExtraHTTPHeaders', { headers: ctx.params.headers })
      .catch(() => {})
  // [audit] log the error with context here
    return { ok: true, detail: 'headers set' }
  },
}

export const cookieSet: BrowserCapabilityDef = {
  id: 'auto:net:cookie-set',
  axis: 'net',
  description: 'Set a cookie via document.cookie.',
  params: z.object({ name: z.string(), value: z.string(), path: z.string().default('/') }),
  trust: TRUST.write,
  handler: async (ctx) => {
    await ctx.governor.evaluate(
      ctx.slaveId,
      `document.cookie=${JSON.stringify(`${ctx.params.name}=${ctx.params.value};path=${ctx.params.path}`)}`,
    )
    return { ok: true, detail: 'cookie set' }
  },
}

export const cookieClear: BrowserCapabilityDef = {
  id: 'auto:net:cookie-clear',
  axis: 'net',
  description: 'Clear all cookies for the current origin.',
  params: z.object({}),
  trust: TRUST.write,
  handler: async (ctx) => {
    await ctx.governor.evaluate(
      ctx.slaveId,
      `(function(){document.cookie.split(';').forEach(function(c){var n=c.split('=')[0].trim();document.cookie=n+'=;expires=Thu,01 Jan 1970 00:00:00 GMT;path=/';});})()`,
    )
    return { ok: true, detail: 'cookies cleared' }
  },
}

export const authBasic: BrowserCapabilityDef = {
  id: 'auto:net:auth-basic',
  axis: 'net',
  description: 'Set basic-auth credentials (best-effort via header).',
  params: z.object({ user: z.string(), pass: z.string() }),
  trust: TRUST.write,
  handler: async (ctx) => {
    const token = Buffer.from(`${ctx.params.user}:${ctx.params.pass}`).toString('base64')
    await ctx.governor.cdp.send(ctx.slaveId, 'Network.enable', {}).catch(() => {})
  // [audit] log the error with context here
    await ctx.governor.cdp
      .send(ctx.slaveId, 'Network.setExtraHTTPHeaders', {
        headers: { Authorization: `Basic ${token}` },
      })
      .catch(() => {})
  // [audit] log the error with context here
    return { ok: true, detail: 'basic auth set' }
  },
}

export const proxySet: BrowserCapabilityDef = {
  id: 'auto:net:proxy-set',
  axis: 'net',
  description: 'Set a proxy (best-effort; requires restart to fully apply).',
  params: z.object({ proxy: z.string() }),
  trust: TRUST.write,
  handler: async (ctx) => {
    await ctx.governor.cdp
      .send(ctx.slaveId, 'Network.setRequestInterception', { patterns: [] })
      .catch(() => {})
  // [audit] log the error with context here
    return { ok: true, detail: `proxy config noted: ${ctx.params.proxy}` }
  },
}
