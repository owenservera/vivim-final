// src/engines/protocol-discovery.ts
// ProtocolDiscoveryEngine — auto-discovers read/write protocol details
// for any provider URL via Chrome CDP probing. No hardcoded selectors needed.
//
// Self-contained: takes a BunCdpClient + sessionId, needs no governor.

import type { BunCdpClient } from '../executor/cdp.js'

export interface DiscoveredComposer {
  selector: string
  tagName: string
  composerType: 'textarea' | 'contenteditable' | 'quill' | 'codemirror' | 'unknown'
  placeholder: string
  ariaLabel: string | null
  role: string | null
  confidence: number
  evidence: string[]
}
export interface DiscoveredSendButton {
  selector: string
  text: string
  ariaLabel: string | null
  tagName: string
  nearComposer: boolean
  confidence: number
  evidence: string[]
}
export interface DiscoveredNetworkPattern {
  url: string
  method: string
  resourceType: string
  pathPattern: string
  isStreamingEndpoint: boolean
  responseBodyPreview: string | null
  format: 'sse' | 'json' | 'json_stream' | 'protobuf' | 'text' | 'unknown'
  confidence: number
}
export interface DiscoveredDOMResponse {
  selector: string
  tagName: string
  streamsProgressive: boolean
  confidence: number
  evidence: string[]
}
export interface DiscoveredProtocol {
  url: string
  title: string
  providerNameHint: string
  composers: DiscoveredComposer[]
  sendButtons: DiscoveredSendButton[]
  primaryComposer: DiscoveredComposer | null
  primarySendButton: DiscoveredSendButton | null
  networkPatterns: DiscoveredNetworkPattern[]
  primaryCapturePattern: string | null
  domResponses: DiscoveredDOMResponse[]
  detectedFramework: string | null
  manifestDraft: Record<string, unknown>
  confidence: number
  durationMs: number
}

const PROBE_COMPOSERS = `(()=>{
  const r=[];document.querySelectorAll('[contenteditable="true"],[contenteditable=""],[contenteditable],textarea,[role="textbox"]').forEach(el=>{
    if(!el.offsetParent)return;
    const re=el.getBoundingClientRect();
    r.push({selector:el.id?'#'+el.id:el.getAttribute('data-testid')?'[data-testid="'+el.getAttribute('data-testid')+'"]':el.className?'.'+(el.className.split(' ')[0]||''):el.tagName.toLowerCase(),tagName:el.tagName.toLowerCase(),composerType:el.classList?.contains('ql-editor')?'quill':el.getAttribute('contenteditable')==='true'?'contenteditable':el.tagName==='TEXTAREA'?'textarea':el.role==='textbox'?'unknown':'unknown',placeholder:el.placeholder||el.getAttribute('aria-placeholder')||'',ariaLabel:el.getAttribute('aria-label'),role:el.getAttribute('role'),isVisible:true,rect:{bottom:re.bottom,width:re.width,height:re.height}});
  });
  return r.sort((a,b)=>(b.rect.bottom+b.rect.width*0.1)-(a.rect.bottom+a.rect.width*0.1));
})()`

const PROBE_BUTTONS = `(()=>{
  const r=[];document.querySelectorAll('button,[role="button"],input[type="submit"],[data-testid*="send"]').forEach(el=>{
    if(!el.offsetParent||el.disabled)return;
    const re=el.getBoundingClientRect(),t=(el.textContent||'').trim()||el.value||'';
    r.push({selector:el.id?'#'+el.id:el.getAttribute('data-testid')?'[data-testid="'+el.getAttribute('data-testid')+'"]':el.getAttribute('aria-label')?'[aria-label="'+el.getAttribute('aria-label')+'"]':el.className?'.'+(el.className.split(' ')[0]||''):el.tagName.toLowerCase(),text:t,ariaLabel:el.getAttribute('aria-label'),tagName:el.tagName.toLowerCase(),isVisible:true,rect:{bottom:re.bottom},hasSendKeyword:/send|submit|enter|go|chat|reply|arrow|paper/i.test(t)});
  });
  return r.sort((a,b)=>(a.hasSendKeyword?1000:0)-(b.hasSendKeyword?1000:0)+b.rect.bottom*0.1-a.rect.bottom*0.1);
})()`

const PROBE_DOM = `(()=>{
  const r=[],s=new Set();
  document.querySelectorAll('article,[role="article"],[data-message-author-role],[data-testid*="message"],[data-testid*="response"],[class*="message"],[class*="response"],[class*="assistant"],[class*="reply"],[class*="markdown"],[class*="prose"],[class*="font-claude"]').forEach(el=>{
    if(!el.offsetParent)return;
    const k=el.id||el.getAttribute('data-testid')||el.className?.split(' ')[0]||el.tagName;
    if(s.has(k))return;s.add(k);
    const n=el.querySelectorAll('p,pre,code,ul,ol,table,img').length;
    r.push({selector:el.id?'#'+el.id:el.getAttribute('data-testid')?'[data-testid="'+el.getAttribute('data-testid')+'"]':el.getAttribute('data-message-author-role')?'[data-message-author-role="'+el.getAttribute('data-message-author-role')+'"]':'.'+(el.className?.split(' ')[0]||el.tagName.toLowerCase()),tagName:el.tagName.toLowerCase(),childCount:n,textLength:(el.textContent||'').length,isVisible:true});
  });
  return r.filter(e=>e.textLength>20).sort((a,b)=>b.textLength-a.textLength).slice(0,5);
})()`

const PROBE_FRAMEWORK = `(()=>{
  if(document.querySelector('.ql-editor'))return'quill';
  if(document.querySelector('.ProseMirror'))return'prosemirror';
  if(document.querySelector('.CodeMirror'))return'codemirror';
  if(document.querySelector('[data-reactroot],#__next'))return'react';
  return null;
})()`

function _classifyFormat(body: string): DiscoveredNetworkPattern['format'] {
  if (!body) return 'unknown'
  if (body.startsWith('data: ') || (body.includes('data: {') && body.includes('\n\n'))) return 'sse'
  if (body.startsWith('{') || body.startsWith('[')) {
    try {
      const lines = body.split('\n').filter(Boolean)
      if (lines.length > 1) {
        for (const l of lines.slice(0, 3)) JSON.parse(l.trim())
        return 'json_stream'
      }
      JSON.parse(body)
      return 'json'
    } catch {
      return 'text'
    }
  }
  return 'text'
}

export class ProtocolDiscoveryEngine {
  constructor(
    private client: BunCdpClient,
    private sessionId: string,
  ) {}

  private async eval(expr: string): Promise<unknown> {
    const r = (await this.client.send(
      'Runtime.evaluate',
      { expression: expr, returnByValue: true },
      { sessionId: this.sessionId },
    )) as { result?: { value?: unknown } }
    return r.result?.value
  }

  async discover(url: string, opts?: { providerNameHint?: string }): Promise<DiscoveredProtocol> {
    const start = Date.now()
    const hint = opts?.providerNameHint ?? new URL(url).hostname.split('.')[0] ?? 'unknown'

    await this.client.send('Page.navigate', { url }, { sessionId: this.sessionId }).catch(() => {})
    await new Promise((r) => setTimeout(r, 5000))

    const pageTitle = ((await this.eval('document.title')) as string) ?? hint

    // WRITE: composers
    const rawC =
      ((await this.eval(PROBE_COMPOSERS)) as
        | Array<{
            selector: string
            tagName: string
            composerType: string
            placeholder: string
            ariaLabel: string | null
            role: string | null
            isVisible: boolean
          }>
        | undefined) ?? []
    const composers: DiscoveredComposer[] = rawC.map((c) => {
      let conf = 0.5
      const ev: string[] = []
      if (c.tagName === 'textarea') {
        conf = 0.85
        ev.push('tag:textarea')
      }
      if (c.composerType === 'contenteditable') {
        ev.push('attr:contenteditable')
        if (conf < 0.8) conf = 0.75
      }
      if (c.role === 'textbox') {
        conf = Math.max(conf, 0.7)
        ev.push('attr:role=textbox')
      }
      if (c.placeholder) {
        conf = Math.max(conf, 0.9)
        ev.push(`placeholder:${c.placeholder.slice(0, 30)}`)
      }
      return {
        selector: c.selector,
        tagName: c.tagName,
        composerType: c.composerType as DiscoveredComposer['composerType'],
        placeholder: c.placeholder,
        ariaLabel: c.ariaLabel,
        role: c.role,
        confidence: conf,
        evidence: ev,
      }
    })

    // WRITE: send buttons
    const rawB =
      ((await this.eval(PROBE_BUTTONS)) as
        | Array<{
            selector: string
            text: string
            ariaLabel: string | null
            tagName: string
            isVisible: boolean
            hasSendKeyword: boolean
          }>
        | undefined) ?? []
    const sendButtons: DiscoveredSendButton[] = rawB.map((b) => {
      let conf = 0.3
      const ev: string[] = []
      if (b.hasSendKeyword) {
        conf = 0.7
        ev.push(`keyword:${b.text}`)
      }
      if (b.ariaLabel && /send|submit/i.test(b.ariaLabel)) {
        conf = 0.8
        ev.push(`aria-label:${b.ariaLabel}`)
      }
      return {
        selector: b.selector,
        text: b.text,
        ariaLabel: b.ariaLabel,
        tagName: b.tagName,
        nearComposer: true,
        confidence: conf,
        evidence: ev,
      }
    })

    // READ: DOM response containers
    const rawD =
      ((await this.eval(PROBE_DOM)) as
        | Array<{
            selector: string
            tagName: string
            childCount: number
            textLength: number
            isVisible: boolean
          }>
        | undefined) ?? []
    const domResponses: DiscoveredDOMResponse[] = rawD.map((d) => ({
      selector: d.selector,
      tagName: d.tagName,
      streamsProgressive: d.textLength < 500,
      confidence: d.childCount > 0 ? 0.7 : 0.4,
      evidence: [`tag:${d.tagName}`, `children:${d.childCount}`, `textLen:${d.textLength}`],
    }))

    const framework = (await this.eval(PROBE_FRAMEWORK)) as string | null

    const primaryComposer = composers[0] ?? null
    const primarySendButton = sendButtons[0] ?? null

    return {
      url,
      title: pageTitle,
      providerNameHint: hint,
      composers,
      sendButtons,
      primaryComposer,
      primarySendButton,
      networkPatterns: [],
      primaryCapturePattern: null,
      domResponses,
      detectedFramework: framework,
      manifestDraft: {
        slug: hint,
        display_name: pageTitle || hint,
        description: `Auto-discovered protocol for ${hint}`,
        provider_type: 'llm',
        base_url: url,
        endpoints: [
          {
            type: 'chat',
            url,
            selector_json: JSON.stringify({
              composer: primaryComposer?.selector ?? '',
              send_button: primarySendButton?.selector ?? '',
            }),
            composer_type: primaryComposer?.composerType ?? 'unknown',
            send_method: primarySendButton ? 'button_click' : 'enter_key',
          },
        ],
        dom_selectors: domResponses.map((d) => d.selector),
      },
      confidence: composers.length > 0 ? 0.6 : 0.1,
      durationMs: Date.now() - start,
    }
  }
}
