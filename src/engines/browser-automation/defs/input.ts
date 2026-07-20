// src/engines/browser-automation/defs/input.ts
// Axis: input — interaction primitives (20 capabilities)

import { z } from 'zod'
import type { BrowserCapabilityDef, CapCtx } from '../types.js'
import { TRUST } from '../types.js'

const sel = z.object({
  selector: z.string().optional(),
  text: z.string().optional(),
  ariaLabel: z.string().optional(),
  placeholder: z.string().optional(),
  role: z.string().optional(),
  testid: z.string().optional(),
})
const withSel = <T extends z.ZodRawShape>(extra: T) => sel.extend(extra)

/** Click an element resolved via grounding (`__selector` injected by registry). */
async function clickResolved(
  ctx: CapCtx,
): Promise<{ ok: boolean; detail?: string; error?: string }> {
  const s = (ctx.params.__selector as string) ?? 'button'
  await ctx.governor.evaluate(ctx.slaveId, `document.querySelector(${JSON.stringify(s)})?.click()`)
  return { ok: true, detail: `clicked ${s}` }
}

export const click: BrowserCapabilityDef = {
  id: 'auto:input:click',
  axis: 'input',
  description: 'Click an element (matched by text/selector/aria).',
  params: sel,
  grounding: 'composite',
  trust: TRUST.write,
  handler: async (ctx) => clickResolved(ctx),
}

export const doubleClick: BrowserCapabilityDef = {
  id: 'auto:input:double-click',
  axis: 'input',
  description: 'Double-click an element.',
  params: sel,
  grounding: 'composite',
  trust: TRUST.write,
  handler: async (ctx) => {
    const s = (ctx.params.__selector as string) ?? 'button'
    await ctx.governor.evaluate(
      ctx.slaveId,
      `(()=>{var e=document.querySelector(${JSON.stringify(s)});if(e){var r=e.getBoundingClientRect();var o=new MouseEvent('dblclick',{bubbles:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2});e.dispatchEvent(o);}})()`,
    )
    return { ok: true, detail: `double-clicked ${s}` }
  },
}

export const rightClick: BrowserCapabilityDef = {
  id: 'auto:input:right-click',
  axis: 'input',
  description: 'Right-click an element (context menu).',
  params: sel,
  grounding: 'composite',
  trust: TRUST.write,
  handler: async (ctx) => {
    const s = (ctx.params.__selector as string) ?? 'button'
    await ctx.governor.evaluate(
      ctx.slaveId,
      `(()=>{var e=document.querySelector(${JSON.stringify(s)});if(e){var r=e.getBoundingClientRect();var o=new MouseEvent('contextmenu',{bubbles:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2});e.dispatchEvent(o);}})()`,
    )
    return { ok: true, detail: `right-clicked ${s}` }
  },
}

export const type: BrowserCapabilityDef = {
  id: 'auto:input:type',
  axis: 'input',
  description: 'Type text into a field.',
  params: withSel({ text: z.string(), append: z.boolean().optional() }),
  grounding: 'composite',
  trust: TRUST.write,
  handler: async (ctx) => {
    const s = (ctx.params.__selector as string) ?? 'textarea'
    const value = ctx.params.text as string
    const expr = ctx.params.append
      ? `(()=>{var e=document.querySelector(${JSON.stringify(s)});if(e){e.value=(e.value||'')+${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true}));}})()`
      : `(()=>{var e=document.querySelector(${JSON.stringify(s)});if(e){e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true}));}})()`
    await ctx.governor.evaluate(ctx.slaveId, expr)
    return { ok: true, detail: `typed into ${s}` }
  },
}

export const clear: BrowserCapabilityDef = {
  id: 'auto:input:clear',
  axis: 'input',
  description: 'Clear a field value.',
  params: sel,
  grounding: 'composite',
  trust: TRUST.write,
  handler: async (ctx) => {
    const s = (ctx.params.__selector as string) ?? 'textarea'
    await ctx.governor.evaluate(
      ctx.slaveId,
      `(()=>{var e=document.querySelector(${JSON.stringify(s)});if(e){e.value='';e.dispatchEvent(new Event('input',{bubbles:true}));}})()`,
    )
    return { ok: true, detail: `cleared ${s}` }
  },
}

export const press: BrowserCapabilityDef = {
  id: 'auto:input:press',
  axis: 'input',
  description: 'Press a keyboard key (e.g. Enter, Escape).',
  params: z.object({ key: z.string() }),
  trust: TRUST.write,
  handler: async (ctx) => {
    await ctx.governor.cdp.send(ctx.slaveId, 'Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: ctx.params.key as string,
    })
    await ctx.governor.cdp.send(ctx.slaveId, 'Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: ctx.params.key as string,
    })
    return { ok: true, detail: `pressed ${ctx.params.key}` }
  },
}

export const keyDown: BrowserCapabilityDef = {
  id: 'auto:input:keydown',
  axis: 'input',
  description: 'Send keyDown for a key.',
  params: z.object({ key: z.string() }),
  trust: TRUST.write,
  handler: async (ctx) => {
    await ctx.governor.cdp.send(ctx.slaveId, 'Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: ctx.params.key as string,
    })
    return { ok: true, detail: `keydown ${ctx.params.key}` }
  },
}

export const keyUp: BrowserCapabilityDef = {
  id: 'auto:input:keyup',
  axis: 'input',
  description: 'Send keyUp for a key.',
  params: z.object({ key: z.string() }),
  trust: TRUST.write,
  handler: async (ctx) => {
    await ctx.governor.cdp.send(ctx.slaveId, 'Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: ctx.params.key as string,
    })
    return { ok: true, detail: `keyup ${ctx.params.key}` }
  },
}

export const hover: BrowserCapabilityDef = {
  id: 'auto:input:hover',
  axis: 'input',
  description: 'Hover over an element.',
  params: sel,
  grounding: 'composite',
  trust: TRUST.write,
  handler: async (ctx) => {
    const s = (ctx.params.__selector as string) ?? 'a'
    await ctx.governor.evaluate(
      ctx.slaveId,
      `(()=>{var e=document.querySelector(${JSON.stringify(s)});if(e){var r=e.getBoundingClientRect();var o=new MouseEvent('mouseover',{bubbles:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2});e.dispatchEvent(o);}})()`,
    )
    return { ok: true, detail: `hovered ${s}` }
  },
}

export const focus: BrowserCapabilityDef = {
  id: 'auto:input:focus',
  axis: 'input',
  description: 'Focus an element.',
  params: sel,
  grounding: 'composite',
  trust: TRUST.write,
  handler: async (ctx) => {
    const s = (ctx.params.__selector as string) ?? 'input'
    await ctx.governor.evaluate(
      ctx.slaveId,
      `document.querySelector(${JSON.stringify(s)})?.focus()`,
    )
    return { ok: true, detail: `focused ${s}` }
  },
}

export const blur: BrowserCapabilityDef = {
  id: 'auto:input:blur',
  axis: 'input',
  description: 'Blur (unfocus) an element.',
  params: sel,
  grounding: 'composite',
  trust: TRUST.write,
  handler: async (ctx) => {
    const s = (ctx.params.__selector as string) ?? 'input'
    await ctx.governor.evaluate(ctx.slaveId, `document.querySelector(${JSON.stringify(s)})?.blur()`)
    return { ok: true, detail: `blurred ${s}` }
  },
}

export const drag: BrowserCapabilityDef = {
  id: 'auto:input:drag',
  axis: 'input',
  description: 'Drag from source to target (by selectors).',
  params: z.object({ source: z.string(), target: z.string() }),
  trust: TRUST.write,
  handler: async (ctx) => {
    const expr = `(()=>{var a=document.querySelector(${JSON.stringify(ctx.params.source)});var b=document.querySelector(${JSON.stringify(ctx.params.target)});if(a&&b){[['dragstart',a],['dragenter',b],['dragover',b],['drop',b],['dragend',a]].forEach(function(p){var r=(p[1]).getBoundingClientRect();var ev=new DragEvent(p[0],{bubbles:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2});p[1].dispatchEvent(ev);});}})()`
    await ctx.governor.evaluate(ctx.slaveId, expr)
    return { ok: true, detail: `dragged ${ctx.params.source} -> ${ctx.params.target}` }
  },
}

export const drop: BrowserCapabilityDef = {
  id: 'auto:input:drop',
  axis: 'input',
  description: 'Drop a payload onto a target element.',
  params: z.object({ target: z.string(), data: z.string() }),
  trust: TRUST.write,
  handler: async (ctx) => {
    const expr = `(()=>{var b=document.querySelector(${JSON.stringify(ctx.params.target)});if(b){var ev=new DragEvent('drop',{bubbles:true,dataTransfer:{getData:()=>${JSON.stringify(ctx.params.data)}}});b.dispatchEvent(ev);}})()`
    await ctx.governor.evaluate(ctx.slaveId, expr)
    return { ok: true, detail: `dropped on ${ctx.params.target}` }
  },
}

export const select: BrowserCapabilityDef = {
  id: 'auto:input:select',
  axis: 'input',
  description: 'Select an option in a <select>.',
  params: withSel({ value: z.string(), label: z.string().optional() }),
  grounding: 'composite',
  trust: TRUST.write,
  handler: async (ctx) => {
    const s = (ctx.params.__selector as string) ?? 'select'
    const byLabel = ctx.params.label as string | undefined
    const expr = byLabel
      ? `(()=>{var e=document.querySelector(${JSON.stringify(s)});if(e){var o=[...e.options].find(o=>o.text===${JSON.stringify(byLabel)});if(o)e.value=o.value;e.dispatchEvent(new Event('change',{bubbles:true}));}})()`
      : `(()=>{var e=document.querySelector(${JSON.stringify(s)});if(e){e.value=${JSON.stringify(ctx.params.value)};e.dispatchEvent(new Event('change',{bubbles:true}));}})()`
    await ctx.governor.evaluate(ctx.slaveId, expr)
    return { ok: true, detail: `selected in ${s}` }
  },
}

export const check: BrowserCapabilityDef = {
  id: 'auto:input:check',
  axis: 'input',
  description: 'Check a checkbox.',
  params: sel,
  grounding: 'composite',
  trust: TRUST.write,
  handler: async (ctx) => {
    const s = (ctx.params.__selector as string) ?? 'input[type=checkbox]'
    await ctx.governor.evaluate(
      ctx.slaveId,
      `(()=>{var e=document.querySelector(${JSON.stringify(s)});if(e&&!e.checked){e.checked=true;e.dispatchEvent(new Event('change',{bubbles:true}));}})()`,
    )
    return { ok: true, detail: `checked ${s}` }
  },
}

export const uncheck: BrowserCapabilityDef = {
  id: 'auto:input:uncheck',
  axis: 'input',
  description: 'Uncheck a checkbox.',
  params: sel,
  grounding: 'composite',
  trust: TRUST.write,
  handler: async (ctx) => {
    const s = (ctx.params.__selector as string) ?? 'input[type=checkbox]'
    await ctx.governor.evaluate(
      ctx.slaveId,
      `(()=>{var e=document.querySelector(${JSON.stringify(s)});if(e&&e.checked){e.checked=false;e.dispatchEvent(new Event('change',{bubbles:true}));}})()`,
    )
    return { ok: true, detail: `unchecked ${s}` }
  },
}

export const rangeSet: BrowserCapabilityDef = {
  id: 'auto:input:range-set',
  axis: 'input',
  description: 'Set a range/slider value.',
  params: withSel({ value: z.number() }),
  grounding: 'composite',
  trust: TRUST.write,
  handler: async (ctx) => {
    const s = (ctx.params.__selector as string) ?? 'input[type=range]'
    await ctx.governor.evaluate(
      ctx.slaveId,
      `(()=>{var e=document.querySelector(${JSON.stringify(s)});if(e){e.value=${JSON.stringify(ctx.params.value)};e.dispatchEvent(new Event('input',{bubbles:true}));}})()`,
    )
    return { ok: true, detail: `range set ${ctx.params.value}` }
  },
}

export const colorSet: BrowserCapabilityDef = {
  id: 'auto:input:color-set',
  axis: 'input',
  description: 'Set a color input value.',
  params: withSel({ value: z.string() }),
  grounding: 'composite',
  trust: TRUST.write,
  handler: async (ctx) => {
    const s = (ctx.params.__selector as string) ?? 'input[type=color]'
    await ctx.governor.evaluate(
      ctx.slaveId,
      `(()=>{var e=document.querySelector(${JSON.stringify(s)});if(e){e.value=${JSON.stringify(ctx.params.value)};e.dispatchEvent(new Event('input',{bubbles:true}));}})()`,
    )
    return { ok: true, detail: `color set ${ctx.params.value}` }
  },
}

export const upload: BrowserCapabilityDef = {
  id: 'auto:input:upload',
  axis: 'input',
  description: 'Set files on a file input (path injected by harness).',
  params: withSel({ files: z.array(z.string()) }),
  grounding: 'composite',
  trust: TRUST.write,
  handler: async (ctx) => {
    const s = (ctx.params.__selector as string) ?? 'input[type=file]'
    await ctx.governor.evaluate(
      ctx.slaveId,
      `(()=>{var e=document.querySelector(${JSON.stringify(s)});if(e){e.setAttribute('data-vivim-files',${JSON.stringify(JSON.stringify(ctx.params.files))});e.dispatchEvent(new Event('change',{bubbles:true}));}})()`,
    )
    return { ok: true, detail: `upload set on ${s}` }
  },
}

export const paste: BrowserCapabilityDef = {
  id: 'auto:input:paste',
  axis: 'input',
  description: 'Paste text into the focused element.',
  params: z.object({ text: z.string() }),
  trust: TRUST.write,
  handler: async (ctx) => {
    await ctx.governor.evaluate(
      ctx.slaveId,
      `(()=>{var e=document.activeElement;if(e){var s=document.createEvent('TextEvent');s.initTextEvent('textInput',true,true,null,${JSON.stringify(ctx.params.text)});e.dispatchEvent(s);}else{throw new Error('no active element');}})()`,
    )
    return { ok: true, detail: 'pasted' }
  },
}

export const copy: BrowserCapabilityDef = {
  id: 'auto:input:copy',
  axis: 'input',
  description: 'Copy the current selection to clipboard.',
  params: z.object({}),
  trust: TRUST.read,
  handler: async (ctx) => {
    const text = await ctx.governor.evaluate(ctx.slaveId, 'window.getSelection().toString()')
    return { ok: true, output: text, detail: 'copied selection' }
  },
}

export const cut: BrowserCapabilityDef = {
  id: 'auto:input:cut',
  axis: 'input',
  description: 'Cut the current selection.',
  params: z.object({}),
  trust: TRUST.write,
  handler: async (ctx) => {
    const text = await ctx.governor.evaluate(
      ctx.slaveId,
      '(function(){var t=window.getSelection().toString();window.getSelection().deleteFromDocument();return t;})()',
    )
    return { ok: true, output: text, detail: 'cut selection' }
  },
}
