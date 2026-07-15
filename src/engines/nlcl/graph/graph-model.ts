// src/engines/nlcl/graph/graph-model.ts
// NlclGraph — in-memory network graph of NLCL command knowledge.
// Nodes: category, intent, alias, keyword, example, synonym, stopword, filler, entity.
// Edges: contains, hasAlias, hasKeyword, hasExample, hasSynonym, hasStopword, hasFiller, consumesEntity.
// The graph is the single source of matching knowledge (aliases/keywords/examples/
// synonyms/normalization). Regex + execute logic stays in code (catalog.ts).
// Expansion = addNode/addEdge, no code edits. Hydrates from a DB store or seed.

import { EngineError } from '../../../errors.js'

export type NlclNodeKind =
  | 'category'
  | 'intent'
  | 'alias'
  | 'keyword'
  | 'example'
  | 'synonym'
  | 'stopword'
  | 'filler'
  | 'entity'
  | 'normalization'

export interface NlclGraphNode {
  id: string
  kind: NlclNodeKind
  label: string
  data?: Record<string, unknown>
}

export interface NlclGraphEdge {
  id: string
  fromId: string
  toId: string
  relation: string
  weight?: number
  data?: Record<string, unknown>
}

export interface IntentVocabulary {
  aliases: string[]
  keywords: string[]
  examples: string[]
  /** alias text → its synonyms */
  synonyms: Record<string, string[]>
}

export interface NormalizationConfig {
  stopwords: Set<string>
  fillers: Set<string>
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export const NORMALIZATION_ROOT_ID = 'normalization:root'

function nodeId(kind: NlclNodeKind, label: string): string {
  return `${kind}:${slugify(label)}`
}

export class NlclGraph {
  private nodes = new Map<string, NlclGraphNode>()
  private outEdges = new Map<string, NlclGraphEdge[]>()

  static fromData(nodes: NlclGraphNode[], edges: NlclGraphEdge[]): NlclGraph {
    const g = new NlclGraph()
    for (const n of nodes) g.nodes.set(n.id, n)
    for (const e of edges) {
      const list = g.outEdges.get(e.fromId) ?? []
      list.push(e)
      g.outEdges.set(e.fromId, list)
    }
    return g
  }

  getNodes(): NlclGraphNode[] {
    return [...this.nodes.values()]
  }

  getEdges(): NlclGraphEdge[] {
    return [...this.outEdges.values()].flat()
  }

  hasNode(id: string): boolean {
    return this.nodes.has(id)
  }

  getNode(id: string): NlclGraphNode | undefined {
    return this.nodes.get(id)
  }

  // ── Vocabulary extraction ──────────────────────────────────────────────

  getIntentIds(): string[] {
    return this.getNodes()
      .filter((n) => n.kind === 'intent')
      .map((n) => n.label)
  }

  getIntentVocabulary(intent: string): IntentVocabulary {
    const intentId = nodeId('intent', intent)
    const aliases: string[] = []
    const keywords: string[] = []
    const examples: string[] = []
    const synonyms: Record<string, string[]> = {}

    for (const e of this.outEdges.get(intentId) ?? []) {
      const target = this.nodes.get(e.toId)
      if (!target) continue
      if (e.relation === 'hasAlias' && target.kind === 'alias') {
        aliases.push(target.label)
        const synList: string[] = []
        for (const se of this.outEdges.get(target.id) ?? []) {
          const st = this.nodes.get(se.toId)
          if (se.relation === 'hasSynonym' && st?.kind === 'synonym') synList.push(st.label)
        }
        if (synList.length) synonyms[target.label] = synList
      } else if (e.relation === 'hasKeyword' && target.kind === 'keyword') {
        keywords.push(target.label)
      } else if (e.relation === 'hasExample' && target.kind === 'example') {
        examples.push(target.label)
      }
    }

    return { aliases, keywords, examples, synonyms }
  }

  /** All vocabulary terms for an intent (aliases + keywords + examples + synonyms). */
  getIntentTerms(intent: string): string[] {
    const v = this.getIntentVocabulary(intent)
    const terms = new Set<string>([...v.aliases, ...v.keywords, ...v.examples])
    for (const syns of Object.values(v.synonyms)) for (const s of syns) terms.add(s)
    return [...terms]
  }

  getNormalizationConfig(): NormalizationConfig {
    const root = this.nodes.get(NORMALIZATION_ROOT_ID)
    const stopwords = new Set<string>()
    const fillers = new Set<string>()
    if (!root) return { stopwords, fillers }
    for (const e of this.outEdges.get(root.id) ?? []) {
      const target = this.nodes.get(e.toId)
      if (!target) continue
      if (e.relation === 'hasStopword') stopwords.add(target.label)
      else if (e.relation === 'hasFiller') fillers.add(target.label)
    }
    return { stopwords, fillers }
  }

  // ── Expansion API (mutates in-memory; persist via store) ───────────────

  private upsertNode(
    kind: NlclNodeKind,
    label: string,
    data?: Record<string, unknown>,
  ): NlclGraphNode {
    const id = nodeId(kind, label)
    const existing = this.nodes.get(id)
    if (existing) return existing
    const node: NlclGraphNode = { id, kind, label, data }
    this.nodes.set(id, node)
    return node
  }

  private link(fromId: string, toId: string, relation: string, weight = 1): void {
    const list = this.outEdges.get(fromId) ?? []
    if (list.some((e) => e.fromId === fromId && e.toId === toId && e.relation === relation)) return
    list.push({ id: `${fromId}->${relation}->${toId}`, fromId, toId, relation, weight })
    this.outEdges.set(fromId, list)
  }

  addCategory(category: string): NlclGraphNode {
    return this.upsertNode('category', category)
  }

  addIntent(intent: string, category: string, executor: string): NlclGraphNode {
    const intentNode = this.upsertNode('intent', intent, { category, executor })
    const catNode = this.upsertNode('category', category)
    this.link(catNode.id, intentNode.id, 'contains')
    return intentNode
  }

  addAlias(intent: string, aliasText: string): NlclGraphNode {
    const intentId = nodeId('intent', intent)
    if (!this.nodes.has(intentId)) throw new EngineError(`Unknown intent: ${intent}`)
    const aliasNode = this.upsertNode('alias', `${intent}|${aliasText}`, {
      text: aliasText,
      intent,
    })
    this.link(intentId, aliasNode.id, 'hasAlias')
    return aliasNode
  }

  addSynonym(aliasText: string, intent: string, synonymText: string): void {
    const aliasId = nodeId('alias', `${intent}|${aliasText}`)
    const aliasNode = this.nodes.get(aliasId)
    if (!aliasNode) throw new EngineError(`Unknown alias: ${aliasText} for intent ${intent}`)
    const synNode = this.upsertNode('synonym', `${aliasId}|${synonymText}`, { text: synonymText })
    this.link(aliasNode.id, synNode.id, 'hasSynonym')
  }

  addKeyword(intent: string, keyword: string): void {
    const intentId = nodeId('intent', intent)
    const kwNode = this.upsertNode('keyword', keyword)
    this.link(intentId, kwNode.id, 'hasKeyword')
  }

  addExample(intent: string, example: string): void {
    const intentId = nodeId('intent', intent)
    const exNode = this.upsertNode('example', `${intent}|${example}`, { text: example })
    this.link(intentId, exNode.id, 'hasExample')
  }

  addEntity(type: string, label?: string): void {
    this.upsertNode('entity', type, { label: label ?? type })
  }

  addStopword(word: string): void {
    const root = this.upsertNode('normalization', 'root')
    const sw = this.upsertNode('stopword', word)
    this.link(root.id, sw.id, 'hasStopword')
  }

  addFiller(text: string): void {
    const root = this.upsertNode('normalization', 'root')
    const fl = this.upsertNode('filler', text)
    this.link(root.id, fl.id, 'hasFiller')
  }
}
