// src/engines/provider-discovery.ts
// ProviderDiscoveryEngine — navigate→infer→generate draft manifest

import type { CapabilityEventBus } from './capability-event-bus.js'
import type { CapabilityShape, CapabilityShapeRegistry } from './capability-shape-registry.js'
import type { ChromeGovernor } from './chrome-governor.js'

export interface DiscoveryOptions {
  timeoutMs?: number
  maxDepth?: number
  followRedirects?: boolean
}

export interface DiscoverySession {
  id: string
  url: string
  status: 'started' | 'navigating' | 'probing' | 'complete' | 'failed'
  shape: CapabilityShape | null
  confidence: number
  detectedCapabilities: string[]
  interactiveElements: { selector: string; action: string; priority: number }[]
  parserFormat: string | null
  manifestDraft: ProviderManifestDraft | null
  error?: string
  createdAt: number
  updatedAt: number
}

export interface ProviderManifestDraft {
  slug: string
  displayName: string
  description: string
  shapeId: string
  baseUrl: string
  capabilities: string[]
  endpoints: { type: string; path: string }[]
  parserFormat: string
}

export interface ManifestEdits {
  slug?: string
  displayName?: string
  description?: string
  capabilities?: string[]
}

export interface RegisterResult {
  providerId: string
  version: number
}

export interface InteractiveDiscoverySession extends DiscoverySession {
  pendingApprovals: { selector: string; action: string; approved: boolean }[]
}

export class ProviderDiscoveryEngine {
  private sessions = new Map<string, DiscoverySession>()

  constructor(
    private readonly governor: ChromeGovernor,
    private readonly shapeRegistry: CapabilityShapeRegistry,
    private readonly eventBus: CapabilityEventBus,
  ) {}

  async discover(url: string, opts?: DiscoveryOptions): Promise<DiscoverySession> {
    const sessionId = `disc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const session: DiscoverySession = {
      id: sessionId,
      url,
      status: 'started',
      shape: null,
      confidence: 0,
      detectedCapabilities: [],
      interactiveElements: [],
      parserFormat: null,
      manifestDraft: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    this.sessions.set(sessionId, session)

    try {
      session.status = 'navigating'
      session.updatedAt = Date.now()

      const slave = await this.governor.ensureRunning('default')
      const cdp = this.governor.cdp
      await cdp.send(slave.slaveId, 'Page.navigate', { url })

      await this.waitForLoad(cdp, slave.slaveId, opts?.timeoutMs ?? 10000)

      session.status = 'probing'
      session.updatedAt = Date.now()

      const domResult = await this.probeDom(cdp, slave.slaveId)
      const match = this.shapeRegistry.matchShape(domResult.domIndicators)
      if (match) {
        session.shape = this.shapeRegistry.getShape(match.shapeId) ?? null
        session.confidence = match.confidence
      }

      session.detectedCapabilities = this.inferCapabilities(session.shape, domResult)
      session.interactiveElements = domResult.interactiveElements
      session.parserFormat = this.detectParserFormat(domResult)
      session.manifestDraft = this.generateManifestDraft(url, session)

      session.status = 'complete'
      session.updatedAt = Date.now()

      this.eventBus.emit({
        type: 'discovery:complete',
        data: { sessionId, url, shapeId: session.shape?.id, confidence: session.confidence },
      } as never)
    } catch (err) {
      session.status = 'failed'
      session.error = err instanceof Error ? err.message : String(err)
      session.updatedAt = Date.now()
    }

    return session
  }

  async getDiscoverySession(sessionId: string): Promise<DiscoverySession | null> {
    return this.sessions.get(sessionId) ?? null
  }

  async approveDiscovery(
    sessionId: string,
    edits?: ManifestEdits,
    approver = 'system',
  ): Promise<RegisterResult> {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error(`Session ${sessionId} not found`)
    if (session.status !== 'complete') throw new Error(`Session ${sessionId} not complete`)
    if (!session.manifestDraft) throw new Error(`No manifest draft for session ${sessionId}`)

    const manifest = { ...session.manifestDraft }
    if (edits) {
      if (edits.slug) manifest.slug = edits.slug
      if (edits.displayName) manifest.displayName = edits.displayName
      if (edits.description) manifest.description = edits.description
      if (edits.capabilities) manifest.capabilities = edits.capabilities
    }

    this.eventBus.emit({
      type: 'discovery:approved',
      data: { sessionId, manifest, approver },
    } as never)

    return { providerId: manifest.slug, version: 1 }
  }

  async interactiveDiscover(url: string): Promise<InteractiveDiscoverySession> {
    const base = await this.discover(url)
    return {
      ...base,
      pendingApprovals: base.interactiveElements.map((el) => ({
        selector: el.selector,
        action: el.action,
        approved: false,
      })),
    }
  }

  private async waitForLoad(
    cdp: {
      send: (slaveId: string, method: string, params?: Record<string, unknown>) => Promise<unknown>
    },
    slaveId: string,
    timeoutMs: number,
  ) {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      try {
        const result = (await cdp.send(slaveId, 'Runtime.evaluate', {
          expression: 'document.readyState',
        })) as { result?: { value?: string } }
        if (result?.result?.value === 'complete') return
      } catch {
        // ignore
      }
      await new Promise((r) => setTimeout(r, 200))
    }
  }

  private async probeDom(
    cdp: {
      send: (slaveId: string, method: string, params?: Record<string, unknown>) => Promise<unknown>
    },
    slaveId: string,
  ) {
    const expression = `JSON.stringify({
      url: location.href,
      title: document.title,
      forms: document.querySelectorAll('form').length,
      inputs: Array.from(document.querySelectorAll('input, textarea')).map(el => ({
        tag: el.tagName,
        type: el.getAttribute('type'),
        placeholder: el.getAttribute('placeholder'),
        selector: el.id ? '#' + el.id : el.className ? '.' + el.className.split(' ')[0] : el.tagName.toLowerCase(),
      })),
      buttons: Array.from(document.querySelectorAll('button')).map(el => ({
        text: el.textContent.trim(),
        selector: el.id ? '#' + el.id : el.className ? '.' + el.className.split(' ')[0] : 'button',
      })),
      textareas: document.querySelectorAll('textarea').length,
      hasCodeEditor: !!document.querySelector('.monaco-editor, [class*="code-editor"], [class*="editor"]'),
      hasCanvas: !!document.querySelector('canvas'),
    })`
    const result = (await cdp.send(slaveId, 'Runtime.evaluate', {
      expression,
      returnByValue: true,
    })) as { result?: { value?: string } }

    const data = JSON.parse(result?.result?.value ?? '{}')
    return {
      domIndicators: this.extractDomIndicators(data),
      interactiveElements: this.extractInteractiveElements(data),
      rawData: data,
    }
  }

  private extractDomIndicators(data: Record<string, unknown>) {
    const indicators: { selector: string; text?: string }[] = []
    if ((data.textareas as number) > 0) {
      indicators.push({ selector: 'textarea', text: 'Message' })
    }
    if (data.hasCodeEditor) {
      indicators.push({ selector: '.monaco-editor' })
    }
    if (data.hasCanvas) {
      indicators.push({ selector: 'canvas' })
    }
    if ((data.forms as number) > 0) {
      indicators.push({ selector: 'form' })
    }
    return indicators
  }

  private extractInteractiveElements(data: Record<string, unknown>) {
    const elements: { selector: string; action: string; priority: number }[] = []
    const inputs = data.inputs as
      | { tag: string; type: string; placeholder: string; selector: string }[]
      | undefined
    if (inputs) {
      for (const input of inputs) {
        elements.push({
          selector: input.selector,
          action: input.type === 'submit' ? 'click' : 'type',
          priority: 1,
        })
      }
    }
    const buttons = data.buttons as { text: string; selector: string }[] | undefined
    if (buttons) {
      for (const btn of buttons) {
        elements.push({
          selector: btn.selector,
          action: 'click',
          priority: 2,
        })
      }
    }
    return elements
  }

  private inferCapabilities(
    shape: CapabilityShape | null,
    domResult: { rawData: Record<string, unknown> },
  ): string[] {
    const caps: string[] = []
    if (shape) {
      for (const [cap, level] of Object.entries(shape.expectedCapabilities)) {
        if (level === 'required' || level === 'optional') caps.push(cap)
      }
    }
    const data = domResult.rawData
    if ((data.textareas as number) > 0) caps.push('send_message')
    if ((data.forms as number) > 0) caps.push('form_submit')
    if (data.hasCodeEditor) caps.push('code_execution')
    return [...new Set(caps)]
  }

  private detectParserFormat(domResult: { rawData: Record<string, unknown> }): string | null {
    const data = domResult.rawData
    if (data.hasCodeEditor) return 'json'
    if ((data.textareas as number) > 0) return 'sse'
    return 'html'
  }

  private generateManifestDraft(url: string, session: DiscoverySession): ProviderManifestDraft {
    const urlObj = new URL(url)
    const slug = urlObj.hostname.replace(/\./g, '-')
    return {
      slug,
      displayName: session.shape?.name ?? 'Unknown Provider',
      description: `Auto-discovered from ${url}`,
      shapeId: session.shape?.id ?? 'custom',
      baseUrl: `${urlObj.protocol}//${urlObj.host}`,
      capabilities: session.detectedCapabilities,
      endpoints: [{ type: 'chat', path: '/' }],
      parserFormat: session.parserFormat ?? 'custom',
    }
  }
}
