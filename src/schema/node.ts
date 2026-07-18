// src/schema/node.ts
// Universal Node abstraction — every piece of data in the second brain
// is a Node. NodeSchemaRegistry provides typed schemas + validation per type.

import { z } from 'zod'
import { newId, hashContent } from '../ids.js'

// ── Edge ─────────────────────────────────────────────────────────────────
// Directed relationship between two nodes. weight mirrors OG AcuLink.weight.

export interface Edge {
  type: string
  targetId: string
  label?: string
  weight?: number
  properties?: Record<string, unknown>
}

export const EdgeSchema = z.object({
  type: z.string().min(1),
  targetId: z.string().min(1),
  label: z.string().optional(),
  weight: z.number().optional(),
  properties: z.record(z.unknown()).optional(),
})

// ── Node ACL (access control) ─────────────────────────────────────────────
// Mirrors OG AtomicChatUnit sharing* fields.

export interface NodeAcl {
  sharingPolicy?: string
  sharingCircles?: string[]
  canView?: boolean
  canAnnotate?: boolean
  canRemix?: boolean
  canReshare?: boolean
}

// ── Node quality (curation scoring) ───────────────────────────────────────
// Mirrors OG AtomicChatUnit quality* fields.

export interface NodeQuality {
  overall?: number
  structuralIntegrity?: number
  uniqueness?: number
}

// ── Node lifecycle states ─────────────────────────────────────────────────

export type NodeState = 'draft' | 'active' | 'superseded' | 'archived'

// ── Node (universal container) ────────────────────────────────────────────
// Immutable id (ULID). parentId enables forking. source preserves the raw
// import payload for remux/re-parse. data is typed per schema.

export type NodeType =
  | 'cap-store.message'
  | 'cap-store.conversation'
  | 'cap-store.email'
  | 'cap-store.email-thread'
  | 'cap-store.document'
  | 'cap-store.code'
  | 'cap-store.knowledge'
  | 'cap-store.webpage'
  | 'cap-store.contact'
  | 'cap-store.organization'
  | 'cap-store.task'
  | 'cap-store.project'
  | 'cap-store.event'
  | 'cap-store.reminder'
  | 'cap-store.media'
  | 'cap-store.social-post'
  | 'cap-store.import-batch'
  | 'cap-store.financial'
  | 'cap-store.location'
  | 'cap-store.health'
  | 'cap-store.workflow'
  | 'cap-store.reference'
  | 'cap-store.memory'
  | 'cap-store.notebook'
  | 'cap-store.note'
  | 'cap-store.bookmark'
  | 'cap-store.artifact'
  | 'cap-store.acu'

export interface NodeBase {
  id: string
  type: NodeType
  parentId?: string
  createdAt: number
  updatedAt: number
  schemaVersion: number
  // ── ACU-proven fields (adopted from vivim-app-og AtomicChatUnit) ──
  // Content integrity / dedup hash (OG contentHash). Computed from
  // rawSource ?? JSON(data). Used for deduplication and tamper-evidence.
  contentHash?: string
  // Monotonic edit version, starts at 1, incremented by updateNode.
  version: number
  // Lifecycle state (OG state).
  state: NodeState
  // Sensitivity tier (OG securityLevel).
  securityLevel?: number
  // Fine-grained content classification (OG contentType).
  contentType?: string
  // Provenance (OG authorDid / signature).
  authorDid?: string
  signature?: string
  // Access control list (OG sharing*).
  acl?: NodeAcl
  // Curation quality scoring (OG quality*).
  quality?: NodeQuality
  // Temporal validity window (OG validFrom / validUntil / superseded_at).
  validFrom?: number
  validUntil?: number
  // Predecessor version in the version chain (OG LCG parent).
  parentVersion?: number
  source?: string
  data: unknown
  edges?: Edge[]
  meta?: Record<string, unknown>
}

export function createNode<T extends NodeType>(
  type: T,
  data: unknown,
  opts?: {
    parentId?: string
    source?: string
    edges?: Edge[]
    meta?: Record<string, unknown>
    authorDid?: string
    securityLevel?: number
    contentType?: string
    acl?: NodeAcl
    quality?: NodeQuality
    validFrom?: number
    validUntil?: number
    parentVersion?: number
    state?: NodeState
    version?: number
  },
): NodeBase {
  const now = Date.now()
  return {
    id: newId(),
    type,
    parentId: opts?.parentId,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
    contentHash: opts?.source ? hashContent(opts.source) : hashContent(JSON.stringify(data)),
    version: opts?.version ?? 1,
    state: opts?.state ?? 'active',
    securityLevel: opts?.securityLevel,
    contentType: opts?.contentType ?? type.replace('cap-store.', ''),
    authorDid: opts?.authorDid,
    acl: opts?.acl,
    quality: opts?.quality,
    validFrom: opts?.validFrom,
    validUntil: opts?.validUntil,
    parentVersion: opts?.parentVersion,
    source: opts?.source,
    data,
    edges: opts?.edges,
    meta: opts?.meta,
  }
}

// ── NodeSchema — typed schema definition per node type ─────────────────────
// Registered schema controls validation, search indexing, embedding, and
// import adapters for each node type.

export interface NodeSchema<T extends NodeType, D> {
  type: T
  version: number
  schema: z.ZodType<D>
  edges?: Record<string, z.ZodType<unknown>>
  indexContent?: (data: D) => string
  embeddingText?: (data: D) => string
  importAdapters?: Array<{ name: string; parse: (raw: string) => D }>
}

// ── SchemaRegistry ────────────────────────────────────────────────────────
// Typed in-memory registry. Register every node schema at boot.

export class SchemaRegistry {
  private schemas = new Map<NodeType, NodeSchema<NodeType, unknown>>()

  register<T extends NodeType, D>(def: NodeSchema<T, D>): void {
    this.schemas.set(def.type, def as NodeSchema<NodeType, unknown>)
  }

  get(type: NodeType): NodeSchema<NodeType, unknown> | undefined {
    return this.schemas.get(type)
  }

  has(type: string): boolean {
    return this.schemas.has(type as NodeType)
  }

  all(): NodeSchema<NodeType, unknown>[] {
    return Array.from(this.schemas.values())
  }

  validate(type: NodeType, data: unknown): { ok: boolean; error?: string } {
    const def = this.schemas.get(type)
    if (!def) return { ok: false, error: `No schema registered for '${type}'` }
    const result = def.schema.safeParse(data)
    if (result.success) return { ok: true }
    return { ok: false, error: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') }
  }

  indexContent(node: NodeBase): string {
    const def = this.schemas.get(node.type as NodeType)
    if (def?.indexContent) return def.indexContent(node.data)
    return String(node.data)
  }

  embeddingText(node: NodeBase): string {
    const def = this.schemas.get(node.type as NodeType)
    if (def?.embeddingText) return def.embeddingText(node.data)
    return String(node.data)
  }
}

// Singleton — populated at boot by registerAllSchemas() in schemas.ts.
export const schemaRegistry = new SchemaRegistry()
