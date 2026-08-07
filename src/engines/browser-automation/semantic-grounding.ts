// src/engines/browser-automation/semantic-grounding.ts
// SemanticGroundingEngine (SOTA-05) — resolve SemanticSelector → ResolvedElement
// via the ChromeGovernor CDP surface. All I/O goes through governor.governor.cdp /
// governor.evaluate (Governor Canon). No BunCdpClient import.

import { EngineError } from '../../errors.js'
import { catchDebug } from '../../lib/catch-logger.js'
import type { ChromeGovernor } from '../chrome-governor.js'
import type { AccessibilityNode, ResolvedElement, SemanticSelector } from './types.js'

/** Priority order for grounding modes (most semantic → most brittle). */
const MODE_PRIORITY: Array<keyof Omit<SemanticSelector, 'composite'>> = [
  'aria',
  'testid',
  'label',
  'placeholder',
  'role',
  'text',
  'css',
  'xpath',
  'visual',
]

/** Priority order for grounding modes (most semantic → most brittle). */
export class SemanticGroundingEngine {
  constructor(private governor: ChromeGovernor) {}

  /**
   * Resolve a SemanticSelector against the live DOM. Tries each provided mode in
   * priority order, then composite fallbacks. Throws EngineError on total failure
   * (the caller — SelectorHealer — may attempt LLM repair).
   */
  async resolve(slaveId: string, sel: SemanticSelector): Promise<ResolvedElement> {
    await this.governor.enableDomains(slaveId, ['DOM', 'Runtime'])

    // Composite: try each sub-selector in order.
    if (sel.composite && sel.composite.length > 0) {
      for (const sub of sel.composite) {
        try {
          const r = await this.resolve(slaveId, sub)
          return { ...r, healed: r.healed }
        } catch (err) {
          catchDebug(err, 'engines:browser-automation:semantic-grounding:41')
          // try next
        }
      }
      throw new EngineError('SemanticGrounding: no composite candidate matched')
    }

    const modes = this.activeModes(sel)
    for (const mode of modes) {
      const cand = await this.tryMode(slaveId, sel, mode)
      if (cand) return cand
    }
    // Last resort: visual → coordinate (handled by caller via screenshot).
    if (sel.visual) {
      throw new EngineError('SemanticGrounding: visual grounding requires screenshot pipeline')
    }
    throw new EngineError(`SemanticGrounding: no mode matched ${JSON.stringify(sel)}`)
  }

  /** Resolve directly from an already-known CSS selector (fast path). */
  async resolveBySelector(slaveId: string, selector: string): Promise<ResolvedElement> {
    await this.governor.enableDomains(slaveId, ['DOM', 'Runtime'])
    const box = await this.boxFor(slaveId, selector)
    if (!box) throw new EngineError(`SemanticGrounding: selector not found: ${selector}`)
    return { selector, mode: 'css', box }
  }

  /** Get the full accessibility tree (role/name) for semantic grounding + observe. */
  async getAccessibilityTree(slaveId: string): Promise<AccessibilityNode> {
    await this.governor.enableDomains(slaveId, ['Accessibility', 'Runtime'])
    const res = (await this.governor.cdp.send(slaveId, 'Accessibility.getFullAXTree', {})) as {
      nodes?: Record<
        string,
        {
          role?: { value?: string }
          name?: { value?: string }
          ignored?: boolean
          childIds?: string[]
          properties?: Array<{ name: string; value?: { value?: unknown } }>
        }
      >
    }
    if (!res?.nodes) throw new EngineError('SemanticGrounding: empty AX tree')
    const nodes = res.nodes
    // Find root (node with no parent — typically doc)
    const childOf = new Set<string>()
    for (const n of Object.values(nodes)) for (const c of n.childIds ?? []) childOf.add(c)
    const rootId = Object.keys(nodes).find((id) => !childOf.has(id)) ?? Object.keys(nodes)[0] ?? ''
    const toNode = (id: string): AccessibilityNode | null => {
      const n = nodes[id]
      if (!n) return null
      const props: Record<string, unknown> = {}
      for (const p of n.properties ?? []) props[p.name] = p.value?.value
      const node: AccessibilityNode = {
        role: n.role?.value ?? 'unknown',
        name: n.name?.value,
        description: props.description as string | undefined,
        value: props.value as string | undefined,
        checked: props.checked as boolean | undefined,
        focused: props.focused as boolean | undefined,
        ignored: n.ignored,
      }
      const kids = (n.childIds ?? [])
        .map(toNode)
        .filter((k): k is AccessibilityNode => k !== null && !k.ignored)
      if (kids.length) node.children = kids
      return node
    }
    const root = toNode(rootId)
    if (!root) throw new EngineError('SemanticGrounding: cannot build AX tree')
    return root
  }

  /** Capture a screenshot (base64 PNG) for visual grounding / observe. */
  async screenshot(
    slaveId: string,
    region?: { x: number; y: number; w: number; h: number },
  ): Promise<string> {
    const params: Record<string, unknown> = { format: 'png' }
    if (region) {
      params.captureBeyondViewport = true
      params.clip = { x: region.x, y: region.y, width: region.w, height: region.h, scale: 1 }
    }
    const res = (await this.governor.cdp.send(slaveId, 'Page.captureScreenshot', params)) as {
      data?: string
    }
    if (!res?.data) throw new EngineError('SemanticGrounding: screenshot failed')
    return res.data
  }

  /** DOM diff between two summaries (string-based, cheap). */
  async diffSnapshot(before: string, after: string): Promise<{ changed: boolean; delta: number }> {
    if (before === after) return { changed: false, delta: 0 }
    const a = new Set(before.split('\n'))
    const b = new Set(after.split('\n'))
    let delta = 0
    for (const l of b) if (!a.has(l)) delta++
    return { changed: true, delta }
  }

  // ── internals ───────────────────────────────────────────────────────────

  private activeModes(sel: SemanticSelector): Array<keyof Omit<SemanticSelector, 'composite'>> {
    return MODE_PRIORITY.filter((m) => sel[m] !== undefined)
  }

  private async tryMode(
    slaveId: string,
    sel: SemanticSelector,
    mode: keyof Omit<SemanticSelector, 'composite'>,
  ): Promise<ResolvedElement | null> {
    let selector: string
    switch (mode) {
      case 'testid':
        selector = `[data-testid="${sel.testid}"]`
        break
      case 'placeholder':
        selector = `[placeholder*="${sel.placeholder}"]`
        break
      case 'css':
        selector = sel.css as string
        break
      case 'role':
        selector = `[role="${sel.role}"]`
        break
      case 'label':
        selector = `[aria-label*="${sel.label}"]`
        break
      case 'xpath':
        return this.resolveXPath(slaveId, sel.xpath as string)
      case 'text':
        return this.resolveByText(slaveId, sel.text as string, sel.nth)
      case 'aria':
        return this.resolveByAria(slaveId, sel.aria, sel.nth)
      case 'visual':
        return null // handled by caller
      default:
        return null
    }
    const box = await this.boxFor(slaveId, selector)
    if (!box) return null
    return { selector, mode }
  }

  private async resolveByText(
    slaveId: string,
    text: string,
    nth?: number,
  ): Promise<ResolvedElement | null> {
    const expr = `(function(){
      var els = Array.from(document.querySelectorAll('a,button,input,textarea,select,[role],p,h1,h2,h3,h4,li,span'));
      var matches = els.filter(function(e){ return (e.textContent||'').trim() === ${JSON.stringify(text)}; });
      var el = matches[${typeof nth === 'number' ? nth : 0}];
      if(!el) return null;
      return el.outerHTML.slice(0,200);
    })()`
    const hit = await this.governor.evaluate(slaveId, expr)
    if (!hit) return null
    // Use text-based stable selector
    const sel = `[data-vivim-text="${text}"]`
    await this.governor.evaluate(
      slaveId,
      `(function(){ var els=Array.from(document.querySelectorAll('*')).filter(function(e){return (e.textContent||'').trim()===${JSON.stringify(text)};}); var el=els[${typeof nth === 'number' ? nth : 0}]; if(el) el.setAttribute('data-vivim-text', ${JSON.stringify(text)}); })()`,
    )
    const box = await this.boxFor(slaveId, sel)
    return box ? { selector: sel, mode: 'text' } : null
  }

  private async resolveByAria(
    slaveId: string,
    aria: SemanticSelector['aria'],
    nth?: number,
  ): Promise<ResolvedElement | null> {
    const role = aria?.role ? JSON.stringify(aria.role) : 'null'
    const name = aria?.name ? JSON.stringify(aria.name) : 'null'
    const expr = `(function(){
      var els = Array.from(document.querySelectorAll('*'));
      var matches = els.filter(function(e){
        var r = e.getAttribute('role') || e.tagName.toLowerCase();
        var n = e.getAttribute('aria-label') || e.textContent || '';
        return (${role}===null || r===${role}) && (${name}===null || n.trim()===${name});
      });
      var el = matches[${typeof nth === 'number' ? nth : 0}];
      return el ? true : false;
    })()`
    const hit = await this.governor.evaluate(slaveId, expr)
    if (!hit) return null
    const sel = aria?.name
      ? `[aria-label="${aria.name}"]${aria.role ? `[role="${aria.role}"]` : ''}`
      : `[role="${aria?.role}"]`
    const box = await this.boxFor(slaveId, sel)
    return box ? { selector: sel, mode: 'aria' } : null
  }

  private async resolveXPath(slaveId: string, xpath: string): Promise<ResolvedElement | null> {
    const expr = `(function(){
      var el = document.evaluate(${JSON.stringify(xpath)}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      return el ? el.tagName : null;
    })()`
    const hit = await this.governor.evaluate(slaveId, expr)
    if (!hit) return null
    // xpath is brittle; fall back to a generated css path
    const css = await this.governor.evaluate(
      slaveId,
      `(function(){ var el=document.evaluate(${JSON.stringify(xpath)},document,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null).singleNodeValue; if(!el) return null; var p=[]; while(el&&el.nodeType===1){ var i=1,s=el.previousSibling; while(s){ if(s.nodeType===1&&s.tagName===el.tagName) i++; s=s.previousSibling;} p.unshift(el.tagName.toLowerCase()+(el.id?('#'+el.id):i>1?(':nth-of-type('+i+')'):'')); el=el.parentNode;} return p.join('>'); })()`,
    )
    if (typeof css === 'string' && css) {
      const box = await this.boxFor(slaveId, css)
      return box ? { selector: css, mode: 'xpath' } : null
    }
    return null
  }

  /** Compute viewport-relative bounding box for a selector. */
  private async boxFor(
    slaveId: string,
    selector: string,
  ): Promise<{ x: number; y: number; w: number; h: number } | null> {
    const expr = `(function(){
      var el = document.querySelector(${JSON.stringify(selector)});
      if(!el) return null;
      var r = el.getBoundingClientRect();
      return {x:r.x, y:r.y, w:r.width, h:r.height};
    })()`
    const box = await this.governor.evaluate(slaveId, expr)
    if (box && typeof box === 'object' && 'x' in box) {
      return box as { x: number; y: number; w: number; h: number }
    }
    return null
  }
}
