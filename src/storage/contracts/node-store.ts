// src/storage/contracts/node-store.ts
// NodeStore contract — universal persistence for every piece of data in the
// second brain. Every node type (message, email, document, contact, task,
// event, media, social post, financial, ...) is stored here. parentId enables
// forking; rawSource preserves the original payload for remux; schemaVersion +
// immutable ids enable local time travel.

import type { Edge, NodeBase, NodeType } from '../../schema/node.js'

export interface NodeRow {
  id: string
  type: string
  parentId: string | null
  schemaVersion: number
  rawSource: string | null
  dataJson: string
  edgesJson: string
  metaJson: string
  searchText: string
  conversationId: string | null
  messageId: string | null
  sourceParser: string | null
  // ── Node-layer v2: ACU-proven fields ──
  contentHash: string | null
  version: number
  state: string
  securityLevel: number | null
  contentType: string | null
  authorDid: string | null
  signature: string | null
  aclJson: string
  qualityJson: string
  validFrom: number | null
  validUntil: number | null
  parentVersion: number | null
  createdAt: number
  updatedAt: number
}

export interface NodeVersionRow {
  id: string
  nodeId: string
  version: number
  hash: string
  contentRef: string
  op: string
  parentVersion: number | null
  createdAt: number
}

export interface NodeAliasRow {
  id: string
  aliasId: string
  canonicalId: string
  method: string
  confidence: number
  createdAt: number
}

export interface NodeQueryOpts {
  type?: NodeType | string
  parentId?: string
  conversationId?: string
  messageId?: string
  limit?: number
  offset?: number
  orderBy?: 'createdAt' | 'updatedAt'
  orderDir?: 'asc' | 'desc'
}

export interface NodeStoreContract {
  // Persist a node (insert). Never updates an existing id — ids are immutable.
  putNode(node: NodeBase): Promise<void>
  // Fetch a node by id (the canonical, immutable record).
  getNode(id: string): Promise<NodeRow | null>
  // List nodes matching filters (time-ordered for travel/replay).
  listNodes(opts?: NodeQueryOpts): Promise<NodeRow[]>
  // Direct children of a node (fork chain).
  getChildren(id: string): Promise<NodeRow[]>
  // History of a node's lineage: the node + all ancestors via parentId.
  getLineage(id: string): Promise<NodeRow[]>
  // Re-parse support: fetch the rawSource of a node for remux.
  getRawSource(id: string): Promise<string | null>
  // Edge graph operations.
  putEdge(edge: { id: string; sourceId: string; targetId: string; edgeType: string; label?: string; properties?: Record<string, unknown>; createdAt: number }): Promise<void>
  getOutgoingEdges(sourceId: string): Promise<Edge[]>
  getIncomingEdges(targetId: string): Promise<Edge[]>
  // Count of all stored nodes (compliance / coverage reporting).
  countNodes(): Promise<number>

  // ── Node-layer v2: version chain (time travel) ──
  // Update an existing node, bumping its version and writing a NodeVersion entry.
  updateNode(id: string, patch: Partial<Pick<NodeRow, 'dataJson' | 'edgesJson' | 'metaJson' | 'searchText' | 'state' | 'contentHash' | 'aclJson' | 'qualityJson' | 'validUntil' | 'securityLevel' | 'contentType' | 'authorDid' | 'signature'>>): Promise<void>
  // Point-in-time read of a node at a specific version.
  getNodeAtVersion(nodeId: string, version: number): Promise<NodeVersionRow | null>
  // Full version history of a node (oldest → newest).
  getNodeHistory(nodeId: string): Promise<NodeVersionRow[]>

  // ── Node-layer v2: alias → canonical resolution (entity merge) ──
  registerAlias(aliasId: string, canonicalId: string, method: string, confidence?: number): Promise<void>
  resolveAlias(aliasId: string): Promise<string | null>

  // ── Node-layer v2: rebuildable graph (OG ADR-001) ──
  // Rebuild the materialized edge + node_graph from the current node set.
  // Returns the count of edges (re)materialized.
  rebuildGraphFromNodes(): Promise<number>
}
