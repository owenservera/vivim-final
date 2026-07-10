// src/engines/semantic-grounding.ts
// SemanticGroundingEngine — resolves selectors via accessibility tree + visual matching

import type { CDPTransport } from './chrome-governor.js'

// ── Types ───────────────────────────────────────────────────────────────

export type SemanticSelector =
  | { type: 'aria'; role: string; name?: string; description?: string }
  | { type: 'text'; text: string; elementRole?: string }
  | {
      type: 'visual'
      screenshotRegion: { x: number; y: number; width: number; height: number }
      description: string
    }
  | { type: 'css'; selector: string }
  | { type: 'composite'; primary: SemanticSelector; fallbacks: SemanticSelector[] }
  | { type: 'frame'; frameChain: string[]; inner: SemanticSelector }

export interface AccessibilityNode {
  nodeId: number
  backendNodeId: number
  role: string
  name?: string
  description?: string
  children: AccessibilityNode[]
}

export interface ResolvedElement {
  nodeId: number
  backendNodeId: number
  selector: string
  confidence: number
  matchedBy: SemanticSelector
}

export interface ScreenshotRegion {
  x: number
  y: number
  width: number
  height: number
}

// ── Engine ──────────────────────────────────────────────────────────────

export class SemanticGroundingEngine {
  private treeCache = new Map<string, { tree: AccessibilityNode; ts: number }>()
  private readonly TREE_TTL_MS = 5_000

  constructor(private readonly transport: CDPTransport) {}

  async resolve(slaveId: string, selector: SemanticSelector): Promise<ResolvedElement | null> {
    if (selector.type === 'composite') {
      const primary = await this.resolve(slaveId, selector.primary)
      if (primary) return primary
      for (const fb of selector.fallbacks) {
        const result = await this.resolve(slaveId, fb)
        if (result) return result
      }
      return null
    }

    if (selector.type === 'css') {
      return this.resolveCSS(slaveId, selector.selector)
    }

    if (selector.type === 'visual') {
      return this.resolveByVisual(slaveId, selector.screenshotRegion, selector.description)
    }

    if (selector.type === 'frame') {
      return this.resolveFrameAware(slaveId, selector)
    }

    const tree = await this.getAccessibilityTree(slaveId)
    if (!tree) return null

    if (selector.type === 'aria') {
      return this.matchAria(tree, selector)
    }

    if (selector.type === 'text') {
      return this.matchText(tree, selector)
    }

    return null
  }

  async resolveAll(slaveId: string, selector: SemanticSelector): Promise<ResolvedElement[]> {
    if (selector.type === 'composite') {
      const results = await this.resolveAll(slaveId, selector.primary)
      if (results.length > 0) return results
      for (const fb of selector.fallbacks) {
        const r = await this.resolveAll(slaveId, fb)
        if (r.length > 0) return r
      }
      return []
    }

    if (selector.type === 'css') {
      return this.resolveAllCSS(slaveId, selector.selector)
    }

    const tree = await this.getAccessibilityTree(slaveId)
    if (!tree) return []

    if (selector.type === 'aria') {
      return this.matchAllAria(tree, selector)
    }

    if (selector.type === 'text') {
      return this.matchAllText(tree, selector)
    }

    return []
  }

  async waitFor(
    slaveId: string,
    selector: SemanticSelector,
    timeoutMs = 10_000,
  ): Promise<ResolvedElement | null> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const result = await this.resolve(slaveId, selector)
      if (result) return result
      await new Promise((r) => setTimeout(r, 200))
    }
    return null
  }

  async getAccessibilityTree(slaveId: string): Promise<AccessibilityNode | null> {
    const cached = this.treeCache.get(slaveId)
    if (cached && Date.now() - cached.ts < this.TREE_TTL_MS) return cached.tree

    try {
      const result = (await this.transport.send(slaveId, 'Accessibility.getFullAXTree')) as {
        nodes: Array<{
          backendDOMNodeId?: number
          frontendNodeId?: number
          role: { value: string }
          name?: { value: string }
          description?: { value: string }
          childIds?: number[]
        }>
      }

      if (!result?.nodes) return null

      const nodeMap = new Map<number, AccessibilityNode>()
      for (const raw of result.nodes) {
        const id = raw.frontendNodeId ?? raw.backendDOMNodeId ?? 0
        nodeMap.set(id, {
          nodeId: id,
          backendNodeId: raw.backendDOMNodeId ?? 0,
          role: raw.role?.value ?? 'unknown',
          name: raw.name?.value,
          description: raw.description?.value,
          children: [],
        })
      }

      for (const raw of result.nodes) {
        const id = raw.frontendNodeId ?? raw.backendDOMNodeId ?? 0
        const node = nodeMap.get(id)
        if (!node) continue
        for (const childId of raw.childIds ?? []) {
          const child = nodeMap.get(childId)
          if (child) node.children.push(child)
        }
      }

      const root = nodeMap.values().next().value ?? null
      if (root) this.treeCache.set(slaveId, { tree: root, ts: Date.now() })
      return root ?? null
    } catch {
      return null
    }
  }

  private async resolveFrameAware(
    slaveId: string,
    selector: Extract<SemanticSelector, { type: 'frame' }>,
  ): Promise<ResolvedElement | null> {
    const { frameChain, inner } = selector

    let frameNodeId = 0
    const doc = (await this.transport.send(slaveId, 'DOM.getDocument', {
      depth: 0,
      pierce: true,
    })) as { root: { nodeId: number } }
    frameNodeId = doc.root.nodeId

    for (const frameUrl of frameChain) {
      const frameTree = (await this.transport.send(slaveId, 'Page.getFrameTree')) as {
        frameTree: { childFrames?: Array<{ frame: { id: string; url: string } }> }
      }

      const frame = frameTree.frameTree.childFrames?.find((f) => f.frame.url.includes(frameUrl))
      if (!frame) return null

      const evalResult = (await this.transport.send(slaveId, 'Runtime.evaluate', {
        expression: `document.querySelector('iframe[src*="${frameUrl}"]')`,
      })) as { result?: { objectId?: string } } | null

      if (evalResult?.result?.objectId) {
        const resolved = (await this.transport.send(slaveId, 'DOM.describeNode', {
          objectId: evalResult.result.objectId,
        })) as { node?: { contentDocument?: { nodeId: number } } } | null

        frameNodeId = resolved?.node?.contentDocument?.nodeId ?? 0
        if (!frameNodeId) return null
      }
    }

    if (inner.type === 'css') {
      const result = (await this.transport.send(slaveId, 'DOM.querySelector', {
        nodeId: frameNodeId,
        selector: inner.selector,
      })) as { nodeId: number } | null

      if (!result?.nodeId) return null

      return {
        nodeId: result.nodeId,
        backendNodeId: 0,
        selector: `frame(${frameChain.join('/')}) > ${inner.selector}`,
        confidence: 0.9,
        matchedBy: selector,
      }
    }

    return null
  }

  async resolveByVisual(
    slaveId: string,
    region: ScreenshotRegion,
    description: string,
  ): Promise<ResolvedElement | null> {
    const base64 = (await this.transport.send(slaveId, 'Page.captureScreenshot', {
      format: 'png',
    })) as string | null
    if (!base64) return null

    try {
      const backendNodeId = await this.getNodeAtPoint(
        slaveId,
        region.x + region.width / 2,
        region.y + region.height / 2,
      )
      if (!backendNodeId) return null

      return {
        nodeId: 0,
        backendNodeId,
        selector: `[visual-match at ${region.x},${region.y}]`,
        confidence: 0.6,
        matchedBy: { type: 'visual', screenshotRegion: region, description },
      }
    } catch {
      return null
    }
  }

  private async resolveCSS(slaveId: string, selector: string): Promise<ResolvedElement | null> {
    try {
      if (selector.includes('>>>')) {
        return this.resolveShadowCSS(slaveId, selector)
      }

      const doc = (await this.transport.send(slaveId, 'DOM.getDocument')) as {
        root: { nodeId: number }
      }
      const result = (await this.transport.send(slaveId, 'DOM.querySelector', {
        nodeId: doc.root.nodeId,
        selector,
      })) as { nodeId: number } | null

      if (!result?.nodeId) return null

      return {
        nodeId: result.nodeId,
        backendNodeId: 0,
        selector,
        confidence: 1.0,
        matchedBy: { type: 'css', selector },
      }
    } catch {
      return null
    }
  }

  private async resolveShadowCSS(
    slaveId: string,
    selector: string,
  ): Promise<ResolvedElement | null> {
    const parts = selector.split('>>>').map((s) => s.trim())
    let currentNodeId = 0

    const doc = (await this.transport.send(slaveId, 'DOM.getDocument', {
      depth: -1,
      pierce: true,
    })) as { root: { nodeId: number } }
    currentNodeId = doc.root.nodeId

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isLast = i === parts.length - 1

      const result = (await this.transport.send(slaveId, 'DOM.querySelector', {
        nodeId: currentNodeId,
        selector: part,
      })) as { nodeId: number } | null

      if (!result?.nodeId) return null

      if (isLast) {
        return {
          nodeId: result.nodeId,
          backendNodeId: 0,
          selector,
          confidence: 1.0,
          matchedBy: { type: 'css', selector },
        }
      }

      const shadow = (await this.transport.send(slaveId, 'DOM.describeNode', {
        nodeId: result.nodeId,
      })) as { node?: { shadowRootType?: string; contentDocument?: { nodeId: number } } } | null

      const childNodeId = shadow?.node?.contentDocument?.nodeId
      if (!childNodeId) return null
      currentNodeId = childNodeId
    }

    return null
  }

  private async resolveAllCSS(slaveId: string, selector: string): Promise<ResolvedElement[]> {
    try {
      if (selector.includes('>>>')) {
        const single = await this.resolveShadowCSS(slaveId, selector)
        return single ? [single] : []
      }

      const doc = (await this.transport.send(slaveId, 'DOM.getDocument')) as {
        root: { nodeId: number }
      }
      const result = (await this.transport.send(slaveId, 'DOM.querySelectorAll', {
        nodeId: doc.root.nodeId,
        selector,
      })) as { nodeIds: number[] } | null

      if (!result?.nodeIds) return []

      return result.nodeIds.map((nodeId) => ({
        nodeId,
        backendNodeId: 0,
        selector,
        confidence: 1.0,
        matchedBy: { type: 'css' as const, selector },
      }))
    } catch {
      return []
    }
  }

  private matchAria(
    root: AccessibilityNode,
    selector: Extract<SemanticSelector, { type: 'aria' }>,
  ): ResolvedElement | null {
    const node = this.findAriaMatch(root, selector)
    if (!node) return null
    return {
      nodeId: node.nodeId,
      backendNodeId: node.backendNodeId,
      selector: `[role="${selector.role}"]${selector.name ? `[name="${selector.name}"]` : ''}`,
      confidence: this.ariaConfidence(node, selector),
      matchedBy: selector,
    }
  }

  private matchAllAria(
    root: AccessibilityNode,
    selector: Extract<SemanticSelector, { type: 'aria' }>,
  ): ResolvedElement[] {
    const results: ResolvedElement[] = []
    this.collectAriaMatches(root, selector, results)
    return results
  }

  private collectAriaMatches(
    node: AccessibilityNode,
    selector: Extract<SemanticSelector, { type: 'aria' }>,
    results: ResolvedElement[],
  ): void {
    if (node.role === selector.role) {
      if (!selector.name || node.name === selector.name) {
        if (!selector.description || node.description === selector.description) {
          results.push({
            nodeId: node.nodeId,
            backendNodeId: node.backendNodeId,
            selector: `[role="${selector.role}"]${selector.name ? `[name="${selector.name}"]` : ''}`,
            confidence: this.ariaConfidence(node, selector),
            matchedBy: selector,
          })
        }
      }
    }
    for (const child of node.children) this.collectAriaMatches(child, selector, results)
  }

  private findAriaMatch(
    node: AccessibilityNode,
    selector: Extract<SemanticSelector, { type: 'aria' }>,
  ): AccessibilityNode | null {
    if (node.role === selector.role) {
      if (!selector.name || node.name === selector.name) {
        if (!selector.description || node.description === selector.description) return node
      }
    }
    for (const child of node.children) {
      const found = this.findAriaMatch(child, selector)
      if (found) return found
    }
    return null
  }

  private ariaConfidence(
    node: AccessibilityNode,
    selector: Extract<SemanticSelector, { type: 'aria' }>,
  ): number {
    let score = 0.5
    if (node.role === selector.role) score += 0.3
    if (selector.name && node.name === selector.name) score += 0.15
    if (selector.description && node.description === selector.description) score += 0.05
    return Math.min(score, 1.0)
  }

  private matchText(
    root: AccessibilityNode,
    selector: Extract<SemanticSelector, { type: 'text' }>,
  ): ResolvedElement | null {
    const node = this.findTextMatch(root, selector)
    if (!node) return null
    return {
      nodeId: node.nodeId,
      backendNodeId: node.backendNodeId,
      selector: `text="${selector.text}"`,
      confidence: node.name?.includes(selector.text) ? 0.9 : 0.7,
      matchedBy: selector,
    }
  }

  private matchAllText(
    root: AccessibilityNode,
    selector: Extract<SemanticSelector, { type: 'text' }>,
  ): ResolvedElement[] {
    const results: ResolvedElement[] = []
    this.collectTextMatches(root, selector, results)
    return results
  }

  private collectTextMatches(
    node: AccessibilityNode,
    selector: Extract<SemanticSelector, { type: 'text' }>,
    results: ResolvedElement[],
  ): void {
    const matchesText =
      node.name?.includes(selector.text) || node.description?.includes(selector.text)
    const matchesRole = !selector.elementRole || node.role === selector.elementRole
    if (matchesText && matchesRole) {
      results.push({
        nodeId: node.nodeId,
        backendNodeId: node.backendNodeId,
        selector: `text="${selector.text}"`,
        confidence: node.name?.includes(selector.text) ? 0.9 : 0.7,
        matchedBy: selector,
      })
    }
    for (const child of node.children) this.collectTextMatches(child, selector, results)
  }

  private findTextMatch(
    node: AccessibilityNode,
    selector: Extract<SemanticSelector, { type: 'text' }>,
  ): AccessibilityNode | null {
    const matchesText =
      node.name?.includes(selector.text) || node.description?.includes(selector.text)
    const matchesRole = !selector.elementRole || node.role === selector.elementRole
    if (matchesText && matchesRole) return node
    for (const child of node.children) {
      const found = this.findTextMatch(child, selector)
      if (found) return found
    }
    return null
  }

  private async getNodeAtPoint(slaveId: string, x: number, y: number): Promise<number | null> {
    try {
      const result = (await this.transport.send(slaveId, 'DOM.getNodeForLocation', {
        x: Math.round(x),
        y: Math.round(y),
        includeUserAgentShadowDOM: true,
      })) as { backendNodeId: number } | null
      return result?.backendNodeId ?? null
    } catch {
      return null
    }
  }
}
