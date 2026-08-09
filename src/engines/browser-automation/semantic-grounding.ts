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
    const hit = await this.locate(slaveId, selector)
    if (!hit) throw new EngineError(`SemanticGrounding: selector not found: ${selector}`)
    return { selector, mode: 'css', box: hit.box, frameIndex: hit.frameIndex }
  }

  /** Get the full accessibility tree (role/name) for semantic grounding + observe. */
  async getAccessibilityTree(
    slaveId: string,
    opts?: { maxDepth?: number },
  ): Promise<AccessibilityNode> {
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
    const maxDepth = opts?.maxDepth ?? 60
    // Prefer a document-ish root; fall back to the node nobody points at; last
    // resort the first node (previous code picked nodes[0] and could pick a leaf).
    const childOf = new Set<string>()
    for (const n of Object.values(nodes)) for (const c of n.childIds ?? []) childOf.add(c)
    const rootId =
      Object.keys(nodes).find((id) => {
        const role = nodes[id]?.role?.value ?? ''
        return /^(RootWebArea|WebArea|Document|Window|root)$/.test(role)
      }) ??
      Object.keys(nodes).find((id) => !childOf.has(id)) ??
      Object.keys(nodes)[0] ??
      ''
    const toNode = (id: string, depth: number): AccessibilityNode | null => {
      if (depth > maxDepth) return null
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
      // Keep ignored nodes that carry meaningful children (the previous
      // `.filter(!k.ignored)` collapsed the whole tree to the root when CDP
      // marks intermediate containers ignored).
      const kids = (n.childIds ?? [])
        .map((c) => toNode(c, depth + 1))
        .filter((k): k is AccessibilityNode => k !== null)
      if (kids.length) node.children = kids
      return node
    }
    const root = toNode(rootId, 0)
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
    // css/role/label/placeholder/testid: locate in main frame, then same-origin iframes.
    const hit = await this.locate(slaveId, selector)
    if (!hit) return null
    return { selector, mode, box: hit.box, frameIndex: hit.frameIndex }
  }

  /**
   * Resolve an element whose visible text equals `text` (trimmed). Generates a
   * stable nth-of-type CSS path IN-PAGE (no DOM attribute mutation), searching
   * the main frame first, then each same-origin iframe.
   */
  private async resolveByText(
    slaveId: string,
    text: string,
    nth?: number,
  ): Promise<ResolvedElement | null> {
    const frame = await this.searchFrames(slaveId, (docExpr) => {
      return `(function(){
        var doc = ${docExpr};
        if(!doc) return null;
        var els = Array.from(doc.querySelectorAll('a,button,input,textarea,select,[role],p,h1,h2,h3,h4,li,span'));
        var matches = els.filter(function(e){ return (e.textContent||'').trim() === ${JSON.stringify(text)}; });
        var el = matches[${typeof nth === 'number' ? nth : 0}];
        if(!el) return null;
        // nth-of-type path: tag[n] with tag ids when present.
        var path = [];
        var cur = el;
        while(cur && cur.nodeType === 1){
          var tag = cur.tagName.toLowerCase();
          var idx = 1, sib = cur.previousElementSibling;
          while(sib){ if(sib.tagName.toLowerCase()===tag) idx++; sib = sib.previousElementSibling; }
          path.unshift(cur.id ? tag+'#'+cur.id : tag+(idx>1?':nth-of-type('+idx+')':''));
          cur = cur.parentElement;
        }
        return path.join(' > ');
      })()`
    })
    if (!frame) return null
    const box = await this.boxInFrame(slaveId, frame.selector, frame.frameIndex)
    return box
      ? { selector: frame.selector, mode: 'text', box, frameIndex: frame.frameIndex }
      : null
  }

  private async resolveByAria(
    slaveId: string,
    aria: SemanticSelector['aria'],
    nth?: number,
  ): Promise<ResolvedElement | null> {
    const role = aria?.role ? JSON.stringify(aria.role) : 'null'
    const name = aria?.name ? JSON.stringify(aria.name) : 'null'
    const frame = await this.searchFrames(slaveId, (docExpr) => {
      return `(function(){
        var doc = ${docExpr};
        if(!doc) return null;
        var els = Array.from(doc.querySelectorAll('*'));
        var matches = els.filter(function(e){
          var r = e.getAttribute('role') || e.tagName.toLowerCase();
          var n = e.getAttribute('aria-label') || e.textContent || '';
          return (${role}===null || r===${role}) && (${name}===null || n.trim()===${name});
        });
        var el = matches[${typeof nth === 'number' ? nth : 0}];
        if(!el) return null;
        var path = [];
        var cur = el;
        while(cur && cur.nodeType === 1){
          var tag = cur.tagName.toLowerCase();
          var idx = 1, sib = cur.previousElementSibling;
          while(sib){ if(sib.tagName.toLowerCase()===tag) idx++; sib = sib.previousElementSibling; }
          path.unshift(cur.id ? tag+'#'+cur.id : tag+(idx>1?':nth-of-type('+idx+')':''));
          cur = cur.parentElement;
        }
        return path.join(' > ');
      })()`
    })
    if (!frame) return null
    const box = await this.boxInFrame(slaveId, frame.selector, frame.frameIndex)
    return box
      ? { selector: frame.selector, mode: 'aria', box, frameIndex: frame.frameIndex }
      : null
  }

  private async resolveXPath(slaveId: string, xpath: string): Promise<ResolvedElement | null> {
    const hit = await this.searchFrames(slaveId, (docExpr) => {
      return `(function(){
        var doc = ${docExpr};
        if(!doc) return null;
        var el = doc.evaluate(${JSON.stringify(xpath)}, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        if(!el) return null;
        var p = [];
        while(el && el.nodeType===1){
          var tag = el.tagName.toLowerCase();
          var idx = 1, sib = el.previousElementSibling;
          while(sib){ if(sib.tagName.toLowerCase()===tag) idx++; sib = sib.previousElementSibling; }
          p.unshift(el.id ? tag+'#'+el.id : tag+(idx>1?':nth-of-type('+idx+')':''));
          el = el.parentElement;
        }
        return p.join(' > ');
      })()`
    })
    if (!hit) return null
    const box = await this.boxInFrame(slaveId, hit.selector, hit.frameIndex)
    return box ? { selector: hit.selector, mode: 'xpath', box, frameIndex: hit.frameIndex } : null
  }

  /**
   * Run a frame-producing DOM search expression against the main frame, then
   * each same-origin iframe (skipping cross-origin / missing contentDocuments).
   * `buildExpr` receives a doc accessor string (`document` or
   * `iframe.contentDocument`) and must return a selector string or null.
   */
  private async searchFrames(
    slaveId: string,
    buildExpr: (docExpr: string) => string,
  ): Promise<{ selector: string; frameIndex?: number } | null> {
    const main = await this.governor.evaluate(slaveId, buildExpr('document'))
    if (typeof main === 'string' && main) return { selector: main }
    const frameCount = (await this.governor.evaluate(
      slaveId,
      `document.querySelectorAll('iframe').length`,
    )) as number
    const n = typeof frameCount === 'number' ? frameCount : 0
    for (let i = 0; i < n; i++) {
      const docExpr = `(document.querySelectorAll('iframe')[${i}] ? document.querySelectorAll('iframe')[${i}].contentDocument : null)`
      const hit = await this.governor.evaluate(slaveId, buildExpr(docExpr))
      if (typeof hit === 'string' && hit) return { selector: hit, frameIndex: i }
    }
    return null
  }

  /** Compute viewport-relative bounding box for a selector in the main frame. */
  private async boxFor(
    slaveId: string,
    selector: string,
  ): Promise<{ x: number; y: number; w: number; h: number } | null> {
    return this.boxInFrame(slaveId, selector, undefined)
  }

  /** Compute viewport-relative bounding box, optionally inside an iframe. */
  private async boxInFrame(
    slaveId: string,
    selector: string,
    frameIndex?: number,
  ): Promise<{ x: number; y: number; w: number; h: number } | null> {
    const docExpr =
      frameIndex === undefined
        ? 'document'
        : `(document.querySelectorAll('iframe')[${frameIndex}] ? document.querySelectorAll('iframe')[${frameIndex}].contentDocument : null)`
    const expr = `(function(){
      var doc = ${docExpr};
      if(!doc) return null;
      var el = doc.querySelector(${JSON.stringify(selector)});
      if(!el) return null;
      var r = el.getBoundingClientRect();
      return {x:r.x, y:r.y, w:r.width, h:r.height};
    })()`
    const box = await this.governor.evaluate(slaveId, expr)
    if (box && typeof box === 'object' && 'x' in box) {
      const b = box as {
        x: number
        y: number
        w?: number
        h?: number
        width?: number
        height?: number
      }
      // normalize CDP rects that arrive as {width,height}
      return { x: b.x, y: b.y, w: b.w ?? b.width ?? 0, h: b.h ?? b.height ?? 0 }
    }
    return null
  }

  /** Locate a selector across main frame + same-origin iframes (frame-aware). */
  private async locate(
    slaveId: string,
    selector: string,
  ): Promise<{ box: { x: number; y: number; w: number; h: number }; frameIndex?: number } | null> {
    const mainBox = await this.boxFor(slaveId, selector)
    if (mainBox) return { box: mainBox }
    const frameCount = (await this.governor.evaluate(
      slaveId,
      `document.querySelectorAll('iframe').length`,
    )) as number
    const n = typeof frameCount === 'number' ? frameCount : 0
    for (let i = 0; i < n; i++) {
      const box = await this.boxInFrame(slaveId, selector, i)
      if (box) return { box, frameIndex: i }
    }
    return null
  }
}
