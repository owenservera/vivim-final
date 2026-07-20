// src/engines/browser-automation/defs/extract.ts
// Axis: extract — read & extraction (15 capabilities)

import { z } from 'zod'
import type { BrowserCapabilityDef } from '../types.js'
import { TRUST } from '../types.js'

const sel = z.object({ selector: z.string().optional() })

export const extractText: BrowserCapabilityDef = {
  id: 'auto:extract:text',
  axis: 'extract',
  description: 'Extract text content of an element or page.',
  params: sel,
  trust: TRUST.read,
  handler: async (ctx) => {
    const expr = ctx.params.selector
      ? `document.querySelector(${JSON.stringify(ctx.params.selector)})?.innerText`
      : 'document.body.innerText'
    const out = await ctx.governor.evaluate(ctx.slaveId, expr)
    return { ok: true, output: out ?? '', detail: 'text extracted' }
  },
}

export const extractHtml: BrowserCapabilityDef = {
  id: 'auto:extract:html',
  axis: 'extract',
  description: 'Extract outerHTML of an element or page.',
  params: sel,
  trust: TRUST.read,
  handler: async (ctx) => {
    const expr = ctx.params.selector
      ? `document.querySelector(${JSON.stringify(ctx.params.selector)})?.outerHTML`
      : 'document.documentElement.outerHTML'
    const out = await ctx.governor.evaluate(ctx.slaveId, expr)
    return { ok: true, output: out ?? '', detail: 'html extracted' }
  },
}

export const extractMarkdown: BrowserCapabilityDef = {
  id: 'auto:extract:markdown',
  axis: 'extract',
  description: 'Extract page body as lightweight markdown.',
  params: z.object({}),
  trust: TRUST.read,
  handler: async (ctx) => {
    const md = await ctx.governor.evaluate(
      ctx.slaveId,
      `(function(){var e=document.body.cloneNode(true);['script','style','nav','footer','header'].forEach(function(t){e.querySelectorAll(t).forEach(function(n){n.remove()})});return e.innerText.replace(/\\n{3,}/g,'\\n\\n').trim();})()`,
    )
    return { ok: true, output: md ?? '', detail: 'markdown extracted' }
  },
}

export const extractJson: BrowserCapabilityDef = {
  id: 'auto:extract:json',
  axis: 'extract',
  description: 'Extract JSON from a <script type=application/json> or page text.',
  params: z.object({ selector: z.string().optional() }),
  trust: TRUST.read,
  handler: async (ctx) => {
    const expr = ctx.params.selector
      ? `JSON.parse(document.querySelector(${JSON.stringify(ctx.params.selector)})?.textContent||'null')`
      : '(function(){try{return JSON.parse(document.body.innerText);}catch(e){return null;}})()'
    const out = await ctx.governor.evaluate(ctx.slaveId, expr)
    return { ok: true, output: out, detail: 'json extracted' }
  },
}

export const extractTable: BrowserCapabilityDef = {
  id: 'auto:extract:table',
  axis: 'extract',
  description: 'Extract an HTML table as array of row objects.',
  params: z.object({ selector: z.string().optional(), nth: z.number().optional() }),
  trust: TRUST.read,
  handler: async (ctx) => {
    const expr = `(function(){var t=document.querySelectorAll('table');var tbl=${JSON.stringify(ctx.params.selector ?? '')}?document.querySelector(${JSON.stringify(ctx.params.selector)}):t[${typeof ctx.params.nth === 'number' ? ctx.params.nth : 0}];if(!tbl)return [];var rows=[...tbl.querySelectorAll('tr')];return rows.map(function(r){return [...r.children].map(function(c){return c.innerText.trim()})});})()`
    const out = await ctx.governor.evaluate(ctx.slaveId, expr)
    return { ok: true, output: out, detail: 'table extracted' }
  },
}

export const extractList: BrowserCapabilityDef = {
  id: 'auto:extract:list',
  axis: 'extract',
  description: 'Extract a list (li/options) as string array.',
  params: sel,
  trust: TRUST.read,
  handler: async (ctx) => {
    const expr = ctx.params.selector
      ? `[...document.querySelectorAll(${JSON.stringify(ctx.params.selector)} + ' li, ' + ${JSON.stringify(ctx.params.selector)} + ' option')].map(function(e){return e.innerText.trim()})`
      : '[...document.querySelectorAll("li")].map(function(e){return e.innerText.trim()})'
    const out = await ctx.governor.evaluate(ctx.slaveId, expr)
    return { ok: true, output: out, detail: 'list extracted' }
  },
}

export const extractMeta: BrowserCapabilityDef = {
  id: 'auto:extract:meta',
  axis: 'extract',
  description: 'Extract meta tags (description, og:*, title).',
  params: z.object({}),
  trust: TRUST.read,
  handler: async (ctx) => {
    const out = await ctx.governor.evaluate(
      ctx.slaveId,
      `(function(){var m={};document.querySelectorAll('meta').forEach(function(e){var k=e.getAttribute('name')||e.getAttribute('property');if(k)m[k]=e.getAttribute('content')});m.title=document.title;return m;})()`,
    )
    return { ok: true, output: out, detail: 'meta extracted' }
  },
}

export const extractLinks: BrowserCapabilityDef = {
  id: 'auto:extract:links',
  axis: 'extract',
  description: 'Extract all links as {text,href}.',
  params: z.object({ sameOrigin: z.boolean().optional() }),
  trust: TRUST.read,
  handler: async (ctx) => {
    const out = await ctx.governor.evaluate(
      ctx.slaveId,
      `(function(){var base=location.origin;return [...document.querySelectorAll('a[href]')].map(function(a){return {text:a.innerText.trim(),href:a.href}}).filter(function(l){return ${ctx.params.sameOrigin ? 'l.href.startsWith(base)' : 'true'};});})()`,
    )
    return { ok: true, output: out, detail: 'links extracted' }
  },
}

export const extractImages: BrowserCapabilityDef = {
  id: 'auto:extract:images',
  axis: 'extract',
  description: 'Extract image src list.',
  params: z.object({}),
  trust: TRUST.read,
  handler: async (ctx) => {
    const out = await ctx.governor.evaluate(
      ctx.slaveId,
      '[...document.images].map(function(i){return i.src})',
    )
    return { ok: true, output: out, detail: 'images extracted' }
  },
}

export const extractFeed: BrowserCapabilityDef = {
  id: 'auto:extract:feed',
  axis: 'extract',
  description: 'Extract RSS/Atom feed links.',
  params: z.object({}),
  trust: TRUST.read,
  handler: async (ctx) => {
    const out = await ctx.governor.evaluate(
      ctx.slaveId,
      `[...document.querySelectorAll('link[type="application/rss+xml"],link[type="application/atom+xml"]')].map(function(l){return l.href})`,
    )
    return { ok: true, output: out, detail: 'feed extracted' }
  },
}

export const readDom: BrowserCapabilityDef = {
  id: 'auto:extract:read-dom',
  axis: 'extract',
  description: 'Return a trimmed DOM summary (tag + text).',
  params: z.object({}),
  trust: TRUST.read,
  handler: async (ctx) => {
    const out = await ctx.governor.evaluate(ctx.slaveId, 'document.body.innerText.slice(0,4000)')
    return { ok: true, output: out, detail: 'dom summary' }
  },
}

export const readA11y: BrowserCapabilityDef = {
  id: 'auto:extract:read-a11y',
  axis: 'extract',
  description: 'Return the accessibility tree.',
  params: z.object({}),
  trust: TRUST.read,
  handler: async (ctx) => {
    const out = await ctx.grounding.getAccessibilityTree(ctx.slaveId)
    return { ok: true, output: out, detail: 'a11y tree' }
  },
}

export const readForms: BrowserCapabilityDef = {
  id: 'auto:extract:read-forms',
  axis: 'extract',
  description: 'Extract form field descriptions.',
  params: z.object({}),
  trust: TRUST.read,
  handler: async (ctx) => {
    const out = await ctx.governor.evaluate(
      ctx.slaveId,
      `(function(){return [...document.querySelectorAll('input,textarea,select')].map(function(e){return {tag:e.tagName,name:e.name,type:e.type,label:(e.labels&&e.labels[0]&&e.labels[0].innerText)||e.getAttribute('aria-label')||e.placeholder}});})()`,
    )
    return { ok: true, output: out, detail: 'forms read' }
  },
}

export const readCookies: BrowserCapabilityDef = {
  id: 'auto:extract:read-cookies',
  axis: 'extract',
  description: 'Read document cookies.',
  params: z.object({}),
  trust: TRUST.read,
  handler: async (ctx) => {
    const out = await ctx.governor.evaluate(ctx.slaveId, 'document.cookie')
    return { ok: true, output: out, detail: 'cookies read' }
  },
}

export const readStorage: BrowserCapabilityDef = {
  id: 'auto:extract:read-storage',
  axis: 'extract',
  description: 'Read localStorage or sessionStorage keys.',
  params: z.object({ which: z.enum(['local', 'session']).default('local') }),
  trust: TRUST.read,
  handler: async (ctx) => {
    const out = await ctx.governor.evaluate(
      ctx.slaveId,
      `Object.fromEntries(Object.entries(${ctx.params.which === 'session' ? 'sessionStorage' : 'localStorage'}))`,
    )
    return { ok: true, output: out, detail: 'storage read' }
  },
}
