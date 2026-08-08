// src/engines/browser-automation/defs/input.ts
// Axis: input — interaction primitives (20 capabilities)

import { z } from 'zod'
import { EngineError } from '../../../errors.js'
import type { BrowserCapabilityDef, CapCtx } from '../types.js'
import { TRUST } from '../types.js'

const sel = z.object({
  selector: z.string().optional(),
  text: z.string().optional(),
  ariaLabel: z.string().optional(),
  placeholder: z.string().optional(),
  role: z.string().optional(),
  testid: z.string().optional(),
  /** Max ms to wait for the resolved target before acting (default 1500). */
  waitMs: z.number().optional(),
})
const withSel = <T extends z.ZodRawShape>(extra: T) => sel.extend(extra)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Resolve the injected `__selector` and wait for it to be present.
 * Throws EngineError when grounding failed to resolve a target (no silent
 * default element — never fall back to the first tag on the page) or when the
 * element does not appear within `waitMs`.
 */
async function requireTarget(ctx: CapCtx, what: string): Promise<string> {
  const s = ctx.params.__selector as string | undefined
  if (!s) {
    throw new EngineError(
      `${what}: no target element resolved — pass text/ariaLabel/selector (or waitMs to retry)`,
    )
  }
  const waitMs = (ctx.params.waitMs as number | undefined) ?? 1500
  const deadline = Date.now() + waitMs
  while (Date.now() < deadline) {
    const present = (await ctx.governor.evaluate(ctx.slaveId, probeExpr(ctx, s))) as boolean
    if (present) return s
    await sleep(100)
  }
  throw new EngineError(`${what}: target not ready after ${waitMs}ms: ${s}`)
}

/** Presence probe that drills into the resolved frame when frame-scoped. */
function probeExpr(ctx: CapCtx, s: string): string {
  const frame = ctx.params.__frame as number | undefined
  if (frame === undefined) return `!!document.querySelector(${JSON.stringify(s)})`
  return `(()=>{var f=document.querySelectorAll('iframe')[${frame}];var d=f&&f.contentDocument;return d?!!d.querySelector(${JSON.stringify(s)}):false;})()`
}

/**
 * Build an IIFE that queries the resolved element (main frame or resolved
 * iframe) and runs `body` against it as `$E`. `body` must NOT reference
 * `document` directly — use `$E` so the same handler works across frames.
 */
function targetExpr(ctx: CapCtx, body: (e: string) => string): string {
  const s = ctx.params.__selector as string
  const frame = ctx.params.__frame as number | undefined
  if (frame === undefined) {
    return `(()=>{var $E=document.querySelector(${JSON.stringify(s)});if(!$E)return;${body('$E')}})()`
  }
  return `(()=>{var $F=document.querySelectorAll('iframe')[${frame}];var $D=$F&&$F.contentDocument;if(!$D)return;var $E=$D.querySelector(${JSON.stringify(s)});if(!$E)return;${body('$E')}})()`
}

/** Click an element resolved via grounding (`__selector` injected by registry). */
async function clickResolved(
  ctx: CapCtx,
): Promise<{ ok: boolean; detail?: string; error?: string }> {
  const s = await requireTarget(ctx, 'click')
  await ctx.governor.evaluate(ctx.slaveId, targetExpr(ctx, ($E) => `${$E}.click()`))
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
    const s = await requireTarget(ctx, 'double-click')
    await ctx.governor.evaluate(
      ctx.slaveId,
      targetExpr(
        ctx,
        ($E) =>
          `var r=${$E}.getBoundingClientRect();var o=new MouseEvent('dblclick',{bubbles:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2});${$E}.dispatchEvent(o);`,
      ),
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
    const s = await requireTarget(ctx, 'right-click')
    await ctx.governor.evaluate(
      ctx.slaveId,
      targetExpr(
        ctx,
        ($E) =>
          `var r=${$E}.getBoundingClientRect();var o=new MouseEvent('contextmenu',{bubbles:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2});${$E}.dispatchEvent(o);`,
      ),
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
  groundingExclude: new Set(['text']),
  trust: TRUST.write,
  handler: async (ctx) => {
    const s = await requireTarget(ctx, 'type')
    const value = ctx.params.text as string
    const body = ctx.params.append
      ? ($E: string) =>
          `if(${$E}){${$E}.value=(${$E}.value||'')+${JSON.stringify(value)};${$E}.dispatchEvent(new Event('input',{bubbles:true}));}`
      : ($E: string) =>
          `if(${$E}){${$E}.value=${JSON.stringify(value)};${$E}.dispatchEvent(new Event('input',{bubbles:true}));}`
    await ctx.governor.evaluate(ctx.slaveId, targetExpr(ctx, body))
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
    const s = await requireTarget(ctx, 'clear')
    await ctx.governor.evaluate(
      ctx.slaveId,
      targetExpr(ctx, ($E) => `if(${$E}){${$E}.value='';${$E}.dispatchEvent(new Event('input',{bubbles:true}));}`),
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
    const s = await requireTarget(ctx, 'hover')
    await ctx.governor.evaluate(
      ctx.slaveId,
      targetExpr(
        ctx,
        ($E) =>
          `var r=${$E}.getBoundingClientRect();var o=new MouseEvent('mouseover',{bubbles:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2});${$E}.dispatchEvent(o);`,
      ),
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
    const s = await requireTarget(ctx, 'focus')
    await ctx.governor.evaluate(ctx.slaveId, targetExpr(ctx, ($E) => `${$E}.focus()`))
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
    const s = await requireTarget(ctx, 'blur')
    await ctx.governor.evaluate(ctx.slaveId, targetExpr(ctx, ($E) => `${$E}.blur()`))
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
    const s = await requireTarget(ctx, 'select')
    const byLabel = ctx.params.label as string | undefined
    const body = byLabel
      ? ($E: string) =>
          `var o=[...${$E}.options].find(o=>o.text===${JSON.stringify(byLabel)});if(o)${$E}.value=o.value;${$E}.dispatchEvent(new Event('change',{bubbles:true}));`
      : ($E: string) =>
          `${$E}.value=${JSON.stringify(ctx.params.value)};${$E}.dispatchEvent(new Event('change',{bubbles:true}));`
    await ctx.governor.evaluate(ctx.slaveId, targetExpr(ctx, body))
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
    const s = await requireTarget(ctx, 'check')
    await ctx.governor.evaluate(
      ctx.slaveId,
      targetExpr(ctx, ($E) => `if(${$E}&&!${$E}.checked){${$E}.checked=true;${$E}.dispatchEvent(new Event('change',{bubbles:true}));}`),
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
    const s = await requireTarget(ctx, 'uncheck')
    await ctx.governor.evaluate(
      ctx.slaveId,
      targetExpr(ctx, ($E) => `if(${$E}&&${$E}.checked){${$E}.checked=false;${$E}.dispatchEvent(new Event('change',{bubbles:true}));}`),
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
    const s = await requireTarget(ctx, 'range-set')
    await ctx.governor.evaluate(
      ctx.slaveId,
      targetExpr(ctx, ($E) => `${$E}.value=${JSON.stringify(ctx.params.value)};${$E}.dispatchEvent(new Event('input',{bubbles:true}));`),
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
    const s = await requireTarget(ctx, 'color-set')
    await ctx.governor.evaluate(
      ctx.slaveId,
      targetExpr(ctx, ($E) => `${$E}.value=${JSON.stringify(ctx.params.value)};${$E}.dispatchEvent(new Event('input',{bubbles:true}));`),
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
    const s = await requireTarget(ctx, 'upload')
    await ctx.governor.evaluate(
      ctx.slaveId,
      targetExpr(ctx, ($E) => `if(${$E}){${$E}.setAttribute('data-vivim-files',${JSON.stringify(JSON.stringify(ctx.params.files))});${$E}.dispatchEvent(new Event('change',{bubbles:true}));}`),
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
