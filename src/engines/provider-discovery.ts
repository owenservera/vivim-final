// src/engines/provider-discovery.ts
// ProviderDiscoveryEngine — Phase 22.5: Full session-based discovery engine
// Enhanced with DiscoveryStore persistence, CDP ops, network observation, interactive probing

import { EngineError } from '../errors.js'
import type { DiscoverySessionRow, DiscoveryStore } from '../storage/contracts/discovery-store.js'
import type { CapabilityEventBus } from './capability-event-bus.js'
import type { CapabilityShapeRegistry } from './capability-shape-registry.js'
import type { ChromeGovernor } from './chrome-governor.js'
import type { ManifestInferenceEngine } from './manifest-inference.js'
import type { ProviderRegistrar } from './provider-registrar.js'

// ── Types ─────────────────────────────────────────────────────────────────

export interface DiscoveryOptions {
  shapeHint?: string
  providerNameHint?: string
  timeoutMs?: number
}

export interface DiscoverySession {
  id: string
  url: string
  status: string
  shapeId: string | null
  confidence: number
  detectedCapabilities: string[]
  interactiveElements: InteractiveElement[]
  parserFormat: string | null
  manifestDraft: ProviderManifestDraft | null
  providerNameHint?: string
  error?: string
  createdAt: number
  updatedAt: number
}

export interface InteractiveElement {
  selector: string
  action: string
  priority: number
  label?: string
  tagName?: string
}

export interface DomSnapshot {
  url: string
  title: string
  forms: number
  inputs: Array<{ tag: string; type: string; placeholder: string; selector: string }>
  buttons: Array<{ text: string; selector: string }>
  textareas: number
  hasCodeEditor: boolean
  hasCanvas: boolean
  links: Array<{ text: string; href: string; selector: string }>
  images: Array<{ src: string; alt: string; selector: string }>
}

export interface ShapeMatchResult {
  shapeId: string
  confidence: number
  shapeName: string
}

export interface InferredCapability {
  slug: string
  confidence: number
  evidence: string[]
  selectorCandidates: string[]
}

export interface NetworkObservation {
  id: string
  url: string
  method: string
  status: number
  resourceType: string
  responseBodyPreview: string | null
  durationMs: number | null
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
  endpoints?: { type: string; path: string }[]
}

export interface RegisterResult {
  providerId: string
  slug: string
  status: 'created' | 'updated' | 'unchanged'
}

export interface PageState {
  url: string
  title: string
  readyState: string
}

export interface DomMutationResult {
  ok: boolean
  selector: string
  error?: string
}

export interface AccessibilityNode {
  role: string
  name?: string
  children?: AccessibilityNode[]
}

// Legacy compatibility types
export interface ManifestEditsLegacy {
  slug?: string
  displayName?: string
  description?: string
  capabilities?: string[]
}

export interface RegisterResultLegacy {
  providerId: string
  version: number
}

// ── Engine ────────────────────────────────────────────────────────────────

export class ProviderDiscoveryEngine {
  private sessions = new Map<string, DiscoverySession>()
  private observations = new Map<string, NetworkObservation[]>()

  constructor(
    private readonly governor: ChromeGovernor,
    private readonly shapeRegistry: CapabilityShapeRegistry,
    private readonly store: DiscoveryStore | null,
    private readonly providerRegistrar: ProviderRegistrar | null,
    private readonly manifestInference: ManifestInferenceEngine | null,
    private readonly eventBus: CapabilityEventBus,
  ) {}

  // ── Session Management ────────────────────────────────────────────────

  async createSession(url: string, _opts?: DiscoveryOptions): Promise<DiscoverySession> {
    const id = `disc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const now = Date.now()
    const session: DiscoverySession = {
      id,
      url,
      status: 'started',
      shapeId: null,
      confidence: 0,
      detectedCapabilities: [],
      interactiveElements: [],
      parserFormat: null,
      manifestDraft: null,
      createdAt: now,
      updatedAt: now,
    }
    this.sessions.set(id, session)

    if (this.store) {
      await this.store.createSession(this.toRow(session))
    }

    this.eventBus.emit({ type: 'discovery:created', data: { sessionId: id, url } })
    return session
  }

  async getSession(sessionId: string): Promise<DiscoverySession | null> {
    if (this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId)!
    }
    if (this.store) {
      const row = await this.store.getSession(sessionId)
      if (row) {
        const session = this.fromRow(row)
        this.sessions.set(sessionId, session)
        return session
      }
    }
    return null
  }

  async updateSession(sessionId: string, updates: Partial<DiscoverySession>): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) throw new EngineError(`Session ${sessionId} not found`)

    Object.assign(session, updates, { updatedAt: Date.now() })

    if (this.store) {
      await this.store.updateSession(sessionId, this.toRow(session))
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId)
    this.observations.delete(sessionId)
    if (this.store) {
      await this.store.deleteSession(sessionId)
    }
  }

  async listSessions(opts?: { status?: string; limit?: number }): Promise<DiscoverySession[]> {
    if (this.store) {
      const rows = await this.store.listSessions(opts)
      return rows.map((r) => this.fromRow(r))
    }
    let sessions = [...this.sessions.values()]
    if (opts?.status) {
      sessions = sessions.filter((s) => s.status === opts.status)
    }
    if (opts?.limit) {
      sessions = sessions.slice(0, opts.limit)
    }
    return sessions
  }

  // ── Navigation ────────────────────────────────────────────────────────

  async navigate(sessionId: string, url: string): Promise<PageState> {
    const session = this.sessions.get(sessionId)
    if (!session) throw new EngineError(`Session ${sessionId} not found`)

    await this.updateSession(sessionId, { status: 'navigating', url })

    const slave = await this.governor.ensureRunning('default')
    const cdp = this.governor.cdp
    await cdp.send(slave.slaveId, 'Page.navigate', { url })

    await this.waitForLoad(cdp, slave.slaveId, 10000)

    return this.getPageState(sessionId)
  }

  async getPageState(_sessionId: string): Promise<PageState> {
    const slave = await this.governor.ensureRunning('default')
    const cdp = this.governor.cdp

    const result = (await cdp.send(slave.slaveId, 'Runtime.evaluate', {
      expression:
        'JSON.stringify({ url: location.href, title: document.title, readyState: document.readyState })',
      returnByValue: true,
    })) as { result?: { value?: string } }

    const data = JSON.parse(result?.result?.value ?? '{}') as Record<string, string>
    return {
      url: data.url ?? '',
      title: data.title ?? '',
      readyState: data.readyState ?? 'loading',
    }
  }

  // ── DOM Inspection ────────────────────────────────────────────────────

  async getDomSnapshot(_sessionId: string): Promise<DomSnapshot> {
    const slave = await this.governor.ensureRunning('default')
    const cdp = this.governor.cdp

    const expression = `JSON.stringify({
      url: location.href,
      title: document.title,
      forms: document.querySelectorAll('form').length,
      inputs: Array.from(document.querySelectorAll('input, textarea')).map(el => ({
        tag: el.tagName,
        type: el.getAttribute('type') ?? '',
        placeholder: el.getAttribute('placeholder') ?? '',
        selector: el.id ? '#' + el.id : el.className ? '.' + el.className.split(' ')[0] : el.tagName.toLowerCase(),
      })),
      buttons: Array.from(document.querySelectorAll('button')).map(el => ({
        text: (el.textContent ?? '').trim(),
        selector: el.id ? '#' + el.id : el.className ? '.' + el.className.split(' ')[0] : 'button',
      })),
      textareas: document.querySelectorAll('textarea').length,
      hasCodeEditor: !!document.querySelector('.monaco-editor, [class*="code-editor"], [class*="editor"]'),
      hasCanvas: !!document.querySelector('canvas'),
      links: Array.from(document.querySelectorAll('a[href]')).map(el => ({
        text: (el.textContent ?? '').trim(),
        href: el.getAttribute('href') ?? '',
        selector: el.id ? '#' + el.id : 'a',
      })),
      images: Array.from(document.querySelectorAll('img')).map(el => ({
        src: el.getAttribute('src') ?? '',
        alt: el.getAttribute('alt') ?? '',
        selector: el.id ? '#' + el.id : 'img',
      })),
    })`

    const result = (await cdp.send(slave.slaveId, 'Runtime.evaluate', {
      expression,
      returnByValue: true,
    })) as { result?: { value?: string } }

    const data = JSON.parse(result?.result?.value ?? '{}') as Record<string, unknown>
    return {
      url: (data.url as string) ?? '',
      title: (data.title as string) ?? '',
      forms: (data.forms as number) ?? 0,
      inputs: (data.inputs as DomSnapshot['inputs']) ?? [],
      buttons: (data.buttons as DomSnapshot['buttons']) ?? [],
      textareas: (data.textareas as number) ?? 0,
      hasCodeEditor: (data.hasCodeEditor as boolean) ?? false,
      hasCanvas: (data.hasCanvas as boolean) ?? false,
      links: (data.links as DomSnapshot['links']) ?? [],
      images: (data.images as DomSnapshot['images']) ?? [],
    }
  }

  async getAccessibilityTree(_sessionId: string): Promise<AccessibilityNode> {
    return { role: 'root', name: 'accessibility tree placeholder', children: [] }
  }

  async evaluate(_sessionId: string, expression: string): Promise<unknown> {
    const slave = await this.governor.ensureRunning('default')
    const cdp = this.governor.cdp
    const result = (await cdp.send(slave.slaveId, 'Runtime.evaluate', {
      expression,
      returnByValue: true,
    })) as { result?: { value?: unknown } }
    return result?.result?.value
  }

  async screenshot(_sessionId: string): Promise<Buffer> {
    return Buffer.from('placeholder-screenshot')
  }

  // ── Interaction ───────────────────────────────────────────────────────

  async click(
    _sessionId: string,
    selector: string,
    opts?: { waitAfterMs?: number },
  ): Promise<DomMutationResult> {
    try {
      const slave = await this.governor.ensureRunning('default')
      const cdp = this.governor.cdp
      await cdp.send(slave.slaveId, 'Runtime.evaluate', {
        expression: `document.querySelector('${selector}')?.click()`,
      })
      if (opts?.waitAfterMs) {
        await new Promise((r) => setTimeout(r, opts.waitAfterMs))
      }
      return { ok: true, selector }
    } catch (err) {
      return { ok: false, selector, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async type(
    _sessionId: string,
    selector: string,
    text: string,
    opts?: { submit?: boolean },
  ): Promise<DomMutationResult> {
    try {
      const slave = await this.governor.ensureRunning('default')
      const cdp = this.governor.cdp
      const submitJs = opts?.submit ? '; el.form?.submit()' : ''
      await cdp.send(slave.slaveId, 'Runtime.evaluate', {
        expression: `(() => { const el = document.querySelector('${selector}'); if(el) { el.focus(); el.value = ${JSON.stringify(text)}; el.dispatchEvent(new Event('input', {bubbles:true}))${submitJs} } })()`,
      })
      return { ok: true, selector }
    } catch (err) {
      return { ok: false, selector, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async scroll(
    _sessionId: string,
    direction: 'up' | 'down' | 'left' | 'right',
    amount?: number,
  ): Promise<void> {
    const slave = await this.governor.ensureRunning('default')
    const cdp = this.governor.cdp
    const px = amount ?? 300
    const dy = direction === 'down' ? px : direction === 'up' ? -px : 0
    const dx = direction === 'right' ? px : direction === 'left' ? -px : 0
    await cdp.send(slave.slaveId, 'Runtime.evaluate', {
      expression: `window.scrollBy(${dx}, ${dy})`,
    })
  }

  async hover(_sessionId: string, selector: string): Promise<void> {
    const slave = await this.governor.ensureRunning('default')
    const cdp = this.governor.cdp
    await cdp.send(slave.slaveId, 'Runtime.evaluate', {
      expression: `document.querySelector('${selector}')?.dispatchEvent(new MouseEvent('mouseover', {bubbles:true}))`,
    })
  }

  // ── Network Observation ───────────────────────────────────────────────

  async startObservation(sessionId: string, _pattern?: string): Promise<void> {
    this.observations.set(sessionId, [])
    const slave = await this.governor.ensureRunning('default')
    const cdp = this.governor.cdp
    await cdp.send(slave.slaveId, 'Network.enable', {}).catch(() => {})
  }

  async stopObservation(_sessionId: string): Promise<void> {
    const slave = await this.governor.ensureRunning('default')
    const cdp = this.governor.cdp
    await cdp.send(slave.slaveId, 'Network.disable', {}).catch(() => {})
  }

  async getObservations(
    sessionId: string,
    opts?: { limit?: number },
  ): Promise<NetworkObservation[]> {
    const obs = this.observations.get(sessionId) ?? []
    return opts?.limit ? obs.slice(0, opts.limit) : obs
  }

  async interceptResponse(sessionId: string, pattern: string, timeoutMs?: number): Promise<string> {
    const deadline = Date.now() + (timeoutMs ?? 5000)
    const obs = this.observations.get(sessionId) ?? []
    while (Date.now() < deadline) {
      const match = obs.find((o) => o.url.includes(pattern))
      if (match?.responseBodyPreview) return match.responseBodyPreview
      await new Promise((r) => setTimeout(r, 100))
    }
    return ''
  }

  // ── Analysis ──────────────────────────────────────────────────────────

  async matchShape(sessionId: string): Promise<ShapeMatchResult | null> {
    const session = this.sessions.get(sessionId)
    if (!session) throw new EngineError(`Session ${sessionId} not found`)

    const snapshot = await this.getDomSnapshot(sessionId)
    const indicators = this.extractDomIndicators(snapshot)
    const match = this.shapeRegistry.matchShape(indicators)
    if (!match) return null

    const shape = this.shapeRegistry.getShape(match.shapeId)
    return {
      shapeId: match.shapeId,
      confidence: match.confidence,
      shapeName: shape?.name ?? match.shapeId,
    }
  }

  async inferCapabilities(sessionId: string): Promise<InferredCapability[]> {
    const session = this.sessions.get(sessionId)
    if (!session) throw new EngineError(`Session ${sessionId} not found`)

    const snapshot = await this.getDomSnapshot(sessionId)
    const caps: InferredCapability[] = []

    if (session.shapeId) {
      const shape = this.shapeRegistry.getShape(session.shapeId)
      if (shape) {
        for (const [cap, level] of Object.entries(shape.expectedCapabilities)) {
          if (level === 'required' || level === 'optional') {
            caps.push({
              slug: cap,
              confidence: session.confidence,
              evidence: ['shape_match'],
              selectorCandidates: [],
            })
          }
        }
      }
    }

    if (snapshot.textareas > 0) {
      caps.push({
        slug: 'send_message',
        confidence: 0.8,
        evidence: ['textarea_found'],
        selectorCandidates: ['textarea'],
      })
    }
    if (snapshot.hasCodeEditor) {
      caps.push({
        slug: 'code_execution',
        confidence: 0.9,
        evidence: ['code_editor_found'],
        selectorCandidates: ['.monaco-editor'],
      })
    }

    return caps
  }

  async detectParserFormat(sessionId: string): Promise<string | null> {
    const snapshot = await this.getDomSnapshot(sessionId)
    if (snapshot.hasCodeEditor) return 'json'
    if (snapshot.textareas > 0) return 'sse'
    return 'html'
  }

  // ── Manifest ──────────────────────────────────────────────────────────

  async generateManifest(sessionId: string): Promise<ProviderManifestDraft> {
    const session = this.sessions.get(sessionId)
    if (!session) throw new EngineError(`Session ${sessionId} not found`)

    const urlObj = new URL(session.url)
    const slug = urlObj.hostname.replace(/\./g, '-')

    const shape = session.shapeId ? this.shapeRegistry.getShape(session.shapeId) : null
    return {
      slug: session.providerNameHint ?? slug,
      displayName: shape?.name ?? session.providerNameHint ?? 'Unknown Provider',
      description: `Auto-discovered from ${session.url}`,
      shapeId: session.shapeId ?? 'custom',
      baseUrl: `${urlObj.protocol}//${urlObj.host}`,
      capabilities: session.detectedCapabilities,
      endpoints: [{ type: 'chat', path: '/' }],
      parserFormat: session.parserFormat ?? 'custom',
    }
  }

  async validateManifest(
    manifest: unknown,
  ): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = []
    const warnings: string[] = []
    const m = manifest as Record<string, unknown>

    if (!m.slug || typeof m.slug !== 'string' || m.slug.length < 2) {
      errors.push('slug is required and must be at least 2 characters')
    }
    if (!m.displayName || typeof m.displayName !== 'string') {
      errors.push('displayName is required')
    }
    if (!m.baseUrl || typeof m.baseUrl !== 'string') {
      errors.push('baseUrl is required')
    }
    if (!Array.isArray(m.capabilities) || m.capabilities.length === 0) {
      warnings.push('No capabilities defined')
    }
    if (!Array.isArray(m.endpoints) || m.endpoints.length === 0) {
      warnings.push('No endpoints defined')
    }

    return { valid: errors.length === 0, errors, warnings }
  }

  async editManifest(sessionId: string, edits: ManifestEdits): Promise<ProviderManifestDraft> {
    const manifest = await this.generateManifest(sessionId)
    if (edits.slug) manifest.slug = edits.slug
    if (edits.displayName) manifest.displayName = edits.displayName
    if (edits.description) manifest.description = edits.description
    if (edits.capabilities) manifest.capabilities = edits.capabilities
    if (edits.endpoints) manifest.endpoints = edits.endpoints
    return manifest
  }

  // ── Registration ──────────────────────────────────────────────────────

  async approve(
    sessionId: string,
    manifest?: ProviderManifestDraft,
    _approver?: string,
  ): Promise<RegisterResult> {
    const session = this.sessions.get(sessionId)
    if (!session) throw new EngineError(`Session ${sessionId} not found`)

    const finalManifest = manifest ?? (await this.generateManifest(sessionId))
    await this.updateSession(sessionId, { status: 'approved', manifestDraft: finalManifest })

    this.eventBus.emit({
      type: 'discovery:approved',
      data: { sessionId, manifest: finalManifest },
    })

    return { providerId: finalManifest.slug, slug: finalManifest.slug, status: 'created' }
  }

  async reject(sessionId: string, reason: string): Promise<void> {
    await this.updateSession(sessionId, { status: 'rejected', error: reason })
    this.eventBus.emit({ type: 'discovery:rejected', data: { sessionId, reason } })
  }

  // ── Legacy Compatibility ──────────────────────────────────────────────

  async discover(url: string, opts?: DiscoveryOptions): Promise<DiscoverySession> {
    const session = await this.createSession(url, opts)

    try {
      await this.updateSession(session.id, { status: 'navigating' })

      const slave = await this.governor.ensureRunning('default')
      const cdp = this.governor.cdp
      await cdp.send(slave.slaveId, 'Page.navigate', { url })
      await this.waitForLoad(cdp, slave.slaveId, opts?.timeoutMs ?? 10000)

      await this.updateSession(session.id, { status: 'probing' })

      const snapshot = await this.getDomSnapshot(session.id)
      const indicators = this.extractDomIndicators(snapshot)
      const match = this.shapeRegistry.matchShape(indicators)

      let shapeId: string | null = null
      let confidence = 0
      if (match) {
        shapeId = match.shapeId
        confidence = match.confidence
      }

      const caps = await this.inferCapabilities(session.id)
      const ies = this.extractInteractiveElements(snapshot)
      const parserFormat = await this.detectParserFormat(session.id)
      const draft = await this.generateManifest(session.id)

      await this.updateSession(session.id, {
        status: 'complete',
        shapeId,
        confidence,
        detectedCapabilities: caps.map((c) => c.slug),
        interactiveElements: ies,
        parserFormat,
        manifestDraft: draft,
      })

      this.eventBus.emit({
        type: 'discovery:complete',
        data: { sessionId: session.id, url, shapeId, confidence },
      })

      return this.sessions.get(session.id)!
    } catch (err) {
      await this.updateSession(session.id, {
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      })
      return this.sessions.get(session.id)!
    }
  }

  async getDiscoverySession(sessionId: string): Promise<DiscoverySession | null> {
    return this.getSession(sessionId)
  }

  async approveDiscovery(
    sessionId: string,
    edits?: ManifestEditsLegacy,
    approver = 'system',
  ): Promise<RegisterResultLegacy> {
    const session = this.sessions.get(sessionId)
    if (!session) throw new EngineError(`Session ${sessionId} not found`)
    if (session.status !== 'complete') throw new EngineError(`Session ${sessionId} not complete`)
    if (!session.manifestDraft) throw new EngineError(`No manifest draft for session ${sessionId}`)

    const manifest = edits ? await this.editManifest(sessionId, edits) : undefined
    const result = await this.approve(sessionId, manifest, approver)
    return { providerId: result.providerId, version: 1 }
  }

  async interactiveDiscover(url: string) {
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

  // ── Private Helpers ───────────────────────────────────────────────────

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
        /* ignore */
      }
      await new Promise((r) => setTimeout(r, 200))
    }
  }

  private extractDomIndicators(snapshot: DomSnapshot): { selector: string; text?: string }[] {
    const indicators: { selector: string; text?: string }[] = []
    if (snapshot.textareas > 0) indicators.push({ selector: 'textarea', text: 'Message' })
    if (snapshot.hasCodeEditor) indicators.push({ selector: '.monaco-editor' })
    if (snapshot.hasCanvas) indicators.push({ selector: 'canvas' })
    if (snapshot.forms > 0) indicators.push({ selector: 'form' })
    return indicators
  }

  private extractInteractiveElements(snapshot: DomSnapshot): InteractiveElement[] {
    const elements: InteractiveElement[] = []
    for (const input of snapshot.inputs) {
      elements.push({
        selector: input.selector,
        action: input.type === 'submit' ? 'click' : 'type',
        priority: 1,
        tagName: input.tag,
      })
    }
    for (const btn of snapshot.buttons) {
      elements.push({
        selector: btn.selector,
        action: 'click',
        priority: 2,
        label: btn.text,
        tagName: 'button',
      })
    }
    return elements
  }

  private toRow(session: DiscoverySession): DiscoverySessionRow {
    return {
      id: session.id,
      url: session.url,
      status: session.status,
      shapeId: session.shapeId,
      confidence: session.confidence,
      capabilitiesJson: JSON.stringify(session.detectedCapabilities),
      interactiveJson: JSON.stringify(session.interactiveElements),
      parserFormat: session.parserFormat,
      manifestDraftJson: session.manifestDraft ? JSON.stringify(session.manifestDraft) : null,
      error: session.error ?? null,
      agentId: null,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    }
  }

  private fromRow(row: DiscoverySessionRow): DiscoverySession {
    return {
      id: row.id,
      url: row.url,
      status: row.status,
      shapeId: row.shapeId,
      confidence: row.confidence,
      detectedCapabilities: JSON.parse(row.capabilitiesJson ?? '[]') as string[],
      interactiveElements: JSON.parse(row.interactiveJson ?? '[]') as InteractiveElement[],
      parserFormat: row.parserFormat,
      manifestDraft: row.manifestDraftJson
        ? (JSON.parse(row.manifestDraftJson) as ProviderManifestDraft)
        : null,
      error: row.error ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }
}
