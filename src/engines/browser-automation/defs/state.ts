// src/engines/browser-automation/defs/state.ts
// Axis: state — auth & state (10 capabilities)

import { z } from 'zod'
import type { BrowserCapabilityDef } from '../types.js'
import { TRUST } from '../types.js'

export const authLogin: BrowserCapabilityDef = {
  id: 'auto:state:auth-login',
  axis: 'state',
  description: 'Fill credentials and submit a login form (semantic).',
  params: z.object({
    user: z.string(),
    pass: z.string(),
    userSelector: z.string().optional(),
    passSelector: z.string().optional(),
    submitSelector: z.string().optional(),
  }),
  grounding: 'composite',
  trust: { autoRead: true, autoWrite: true, confidenceThreshold: 0.7 },
  handler: async (ctx) => {
    const u =
      (ctx.params.userSelector as string) ??
      'input[type=email],input[name=user],input[name=username],input#user'
    const p = (ctx.params.passSelector as string) ?? 'input[type=password]'
    const s = (ctx.params.submitSelector as string) ?? 'button[type=submit],button'
    await ctx.governor.evaluate(
      ctx.slaveId,
      `(()=>{var a=document.querySelector(${JSON.stringify(u)});if(a){a.value=${JSON.stringify(ctx.params.user)};a.dispatchEvent(new Event('input',{bubbles:true}));}var b=document.querySelector(${JSON.stringify(p)});if(b){b.value=${JSON.stringify(ctx.params.pass)};b.dispatchEvent(new Event('input',{bubbles:true}));}var c=document.querySelector(${JSON.stringify(s)});if(c)c.click();})()`,
    )
    return { ok: true, detail: 'login submitted' }
  },
}

export const authLogout: BrowserCapabilityDef = {
  id: 'auto:state:auth-logout',
  axis: 'state',
  description: 'Click a logout control (semantic).',
  params: z.object({ selector: z.string().optional() }),
  grounding: 'composite',
  trust: TRUST.write,
  handler: async (ctx) => {
    const s =
      (ctx.params.selector as string) ??
      'a[href*="logout"],button:contains("Log out"),button:contains("Sign out")'
    await ctx.governor.evaluate(
      ctx.slaveId,
      `document.querySelector(${JSON.stringify(s)})?.click()`,
    )
    return { ok: true, detail: 'logout clicked' }
  },
}

export const formSubmit: BrowserCapabilityDef = {
  id: 'auto:state:form-submit',
  axis: 'state',
  description: 'Submit the nearest form for a field or a form selector.',
  params: z.object({ selector: z.string().optional() }),
  grounding: 'composite',
  trust: TRUST.write,
  handler: async (ctx) => {
    const s = (ctx.params.selector as string) ?? 'form'
    await ctx.governor.evaluate(
      ctx.slaveId,
      `(()=>{var f=document.querySelector(${JSON.stringify(s)});if(f)f.requestSubmit?f.requestSubmit():f.submit();})()`,
    )
    return { ok: true, detail: 'form submitted' }
  },
}

export const sessionSave: BrowserCapabilityDef = {
  id: 'auto:state:session-save',
  axis: 'state',
  description: 'Note the current URL as a saved session point.',
  params: z.object({}),
  trust: TRUST.read,
  handler: async (ctx) => {
    const url = (await ctx.governor.evaluate(ctx.slaveId, 'location.href')) as string
    return { ok: true, output: url, detail: 'session saved' }
  },
}

export const sessionRestore: BrowserCapabilityDef = {
  id: 'auto:state:session-restore',
  axis: 'state',
  description: 'Navigate back to a saved session URL.',
  params: z.object({ url: z.string().url() }),
  trust: TRUST.read,
  handler: async (ctx) => {
    await ctx.governor.evaluate(
      ctx.slaveId,
      `window.location.href=${JSON.stringify(ctx.params.url)}`,
    )
    return { ok: true, detail: 'session restored' }
  },
}

export const storageSet: BrowserCapabilityDef = {
  id: 'auto:state:storage-set',
  axis: 'state',
  description: 'Set a localStorage/sessionStorage value.',
  params: z.object({
    key: z.string(),
    value: z.string(),
    which: z.enum(['local', 'session']).default('local'),
  }),
  trust: TRUST.write,
  handler: async (ctx) => {
    const expr = `${ctx.params.which === 'session' ? 'sessionStorage' : 'localStorage'}.setItem(${JSON.stringify(ctx.params.key)},${JSON.stringify(ctx.params.value)})`
    await ctx.governor.evaluate(ctx.slaveId, expr)
    return { ok: true, detail: 'storage set' }
  },
}

export const storageClear: BrowserCapabilityDef = {
  id: 'auto:state:storage-clear',
  axis: 'state',
  description: 'Clear localStorage or sessionStorage.',
  params: z.object({ which: z.enum(['local', 'session', 'all']).default('local') }),
  trust: TRUST.write,
  handler: async (ctx) => {
    const expr =
      ctx.params.which === 'all'
        ? 'localStorage.clear();sessionStorage.clear()'
        : `${ctx.params.which === 'session' ? 'sessionStorage' : 'localStorage'}.clear()`
    await ctx.governor.evaluate(ctx.slaveId, expr)
    return { ok: true, detail: 'storage cleared' }
  },
}

export const geoSet: BrowserCapabilityDef = {
  id: 'auto:state:geo-set',
  axis: 'state',
  description: 'Override geolocation (best-effort).',
  params: z.object({ lat: z.number(), lng: z.number() }),
  trust: TRUST.write,
  handler: async (ctx) => {
    await ctx.governor.cdp
      .send(ctx.slaveId, 'Emulation.setGeolocationOverride', {
        latitude: ctx.params.lat,
        longitude: ctx.params.lng,
        accuracy: 100,
      })
      .catch(() => {})
    return { ok: true, detail: 'geo override set' }
  },
}

export const permissionGrant: BrowserCapabilityDef = {
  id: 'auto:state:permission-grant',
  axis: 'state',
  description: 'Grant a permission override (best-effort).',
  params: z.object({ permission: z.string() }),
  trust: TRUST.write,
  handler: async (ctx) => {
    await ctx.governor.cdp
      .send(ctx.slaveId, 'Browser.grantPermissions', { permissions: [ctx.params.permission] })
      .catch(() => {})
    return { ok: true, detail: `permission granted: ${ctx.params.permission}` }
  },
}

export const permissionDeny: BrowserCapabilityDef = {
  id: 'auto:state:permission-deny',
  axis: 'state',
  description: 'Deny a permission override (best-effort).',
  params: z.object({ permission: z.string() }),
  trust: TRUST.write,
  handler: async (ctx) => {
    await ctx.governor.cdp.send(ctx.slaveId, 'Browser.resetPermissions', {}).catch(() => {})
    return { ok: true, detail: `permission reset: ${ctx.params.permission}` }
  },
}
