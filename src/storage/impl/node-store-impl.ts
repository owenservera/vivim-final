// src/storage/impl/node-store-impl.ts
// NodeStoreImpl — Prisma-backed universal Node persistence.
// Every data type in the second brain is stored as a Node; this is the single
// write path that makes the database fully compliant (nothing is dropped).

import type { PrismaClient } from '@prisma/client'
import { hashContent, newId } from '../../ids.js'
import type { Edge, NodeBase } from '../../schema/node.js'
import type {
  NodeQueryOpts,
  NodeRow,
  NodeStoreContract,
  NodeVersionRow,
} from '../contracts/node-store.js'

function toRow(n: NodeBase): NodeRow {
  return {
    id: n.id,
    type: n.type,
    parentId: n.parentId ?? null,
    schemaVersion: n.schemaVersion,
    rawSource: n.source ?? null,
    dataJson: JSON.stringify(n.data ?? {}),
    edgesJson: JSON.stringify(n.edges ?? []),
    metaJson: JSON.stringify(n.meta ?? {}),
    searchText: n.searchText ?? (n.meta?.searchText as string | undefined) ?? '',
    conversationId: n.conversationId ?? (n.meta?.conversationId as string | undefined) ?? null,
    messageId: (n.meta?.messageId as string | undefined) ?? null,
    sourceParser: (n.meta?.sourceParser as string | undefined) ?? null,
    contentHash: n.contentHash ?? (n.data ? hashContent(JSON.stringify(n.data)) : null),
    version: n.version,
    state: n.state,
    securityLevel: n.securityLevel ?? null,
    contentType: n.contentType ?? null,
    authorDid: n.authorDid ?? null,
    signature: n.signature ?? null,
    aclJson: JSON.stringify(n.acl ?? {}),
    qualityJson: JSON.stringify(n.quality ?? {}),
    validFrom: n.validFrom ?? null,
    validUntil: n.validUntil ?? null,
    parentVersion: n.parentVersion ?? null,
    // ACU fields
    acuType: (n as Record<string, unknown>).acuType ?? null,
    lineageKind: (n as Record<string, unknown>).lineageKind ?? null,
    extractorVersion: (n as Record<string, unknown>).extractorVersion ?? null,
    parserVersion: (n as Record<string, unknown>).parserVersion ?? null,
    valueScore: (n as Record<string, unknown>).valueScore ?? null,
    isHighValue: (n as Record<string, unknown>).isHighValue ? 1 : 0,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
  }
}

export class NodeStoreImpl implements NodeStoreContract {
  constructor(private readonly prisma: PrismaClient) {}

  async putNode(node: NodeBase): Promise<void> {
    const row = toRow(node)
    await this.prisma.node.create({
      data: {
        id: row.id,
        type: row.type,
        parentId: row.parentId,
        schemaVersion: row.schemaVersion,
        rawSource: row.rawSource,
        dataJson: row.dataJson,
        edgesJson: row.edgesJson,
        metaJson: row.metaJson,
        searchText: row.searchText,
        conversationId: row.conversationId,
        messageId: row.messageId,
        sourceParser: row.sourceParser,
        contentHash: row.contentHash,
        version: row.version,
        state: row.state,
        securityLevel: row.securityLevel,
        contentType: row.contentType,
        authorDid: row.authorDid,
        signature: row.signature,
        aclJson: row.aclJson,
        qualityJson: row.qualityJson,
        validFrom: row.validFrom,
        validUntil: row.validUntil,
        parentVersion: row.parentVersion,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    })
    // Version-chain entry (time travel): version 1 = create.
    await this.prisma.nodeVersion.create({
      data: {
        id: newId(),
        nodeId: row.id,
        version: row.version,
        hash: row.contentHash ?? hashContent(row.dataJson),
        contentRef: row.dataJson,
        op: 'create',
        parentVersion: row.parentVersion,
        createdAt: row.createdAt,
      },
    })
    // Materialize edges for graph traversal.
    const edges = JSON.parse(row.edgesJson) as Edge[]
    for (const e of edges) {
      await this.putEdge({
        id: newId(),
        sourceId: row.id,
        targetId: e.targetId,
        edgeType: e.type,
        label: e.label,
        properties: e.properties,
        createdAt: row.createdAt,
      }).catch(() => {})
    }
  }

  async getNode(id: string): Promise<NodeRow | null> {
    const r = await this.prisma.node.findUnique({ where: { id } })
    return r ? (r as unknown as NodeRow) : null
  }

  async listNodes(opts: NodeQueryOpts = {}): Promise<NodeRow[]> {
    const rows = await this.prisma.node.findMany({
      where: {
        type: opts.type,
        parentId: opts.parentId,
        conversationId: opts.conversationId,
        messageId: opts.messageId,
      },
      orderBy: { [opts.orderBy ?? 'createdAt']: opts.orderDir ?? 'asc' },
      take: opts.limit,
      skip: opts.offset,
    })
    return rows as unknown as NodeRow[]
  }

  async getChildren(id: string): Promise<NodeRow[]> {
    const rows = await this.prisma.node.findMany({
      where: { parentId: id },
      orderBy: { createdAt: 'asc' },
    })
    return rows as unknown as NodeRow[]
  }

  async getLineage(id: string): Promise<NodeRow[]> {
    const lineage: NodeRow[] = []
    let current = await this.getNode(id)
    while (current) {
      lineage.push(current)
      if (!current.parentId) break
      current = await this.getNode(current.parentId)
    }
    return lineage
  }

  async getRawSource(id: string): Promise<string | null> {
    const r = await this.prisma.node.findUnique({
      where: { id },
      select: { rawSource: true },
    })
    return (r?.rawSource as string | null) ?? null
  }

  async putEdge(edge: {
    id: string
    sourceId: string
    targetId: string
    edgeType: string
    label?: string
    properties?: Record<string, unknown>
    createdAt: number
  }): Promise<void> {
    await this.prisma.nodeEdge.create({
      data: {
        id: edge.id,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
        edgeType: edge.edgeType,
        label: edge.label ?? null,
        propertiesJson: JSON.stringify(edge.properties ?? {}),
        createdAt: edge.createdAt,
      },
    })
  }

  async getOutgoingEdges(sourceId: string): Promise<Edge[]> {
    const rows = await this.prisma.nodeEdge.findMany({ where: { sourceId } })
    return rows.map((r: Record<string, unknown>) => ({
      type: r.edgeType,
      targetId: r.targetId,
      label: r.label ?? undefined,
      properties: JSON.parse(r.propertiesJson),
    }))
  }

  async getIncomingEdges(targetId: string): Promise<Edge[]> {
    const rows = await this.prisma.nodeEdge.findMany({ where: { targetId } })
    return rows.map((r: Record<string, unknown>) => ({
      type: r.edgeType,
      targetId: r.sourceId,
      label: r.label ?? undefined,
      properties: JSON.parse(r.propertiesJson),
    }))
  }

  async countNodes(): Promise<number> {
    return this.prisma.node.count()
  }

  // ── Node-layer v2: version chain (time travel) ──

  async updateNode(
    id: string,
    patch: Partial<
      Pick<
        NodeRow,
        | 'dataJson'
        | 'edgesJson'
        | 'metaJson'
        | 'searchText'
        | 'state'
        | 'contentHash'
        | 'aclJson'
        | 'qualityJson'
        | 'validUntil'
        | 'securityLevel'
        | 'contentType'
        | 'authorDid'
        | 'signature'
      >
    >,
  ): Promise<void> {
    const current = await this.prisma.node.findUnique({ where: { id } })
    if (!current) throw new Error(`updateNode: node ${id} not found`)
    const nextVersion = (current.version as number) + 1
    const nextContentHash =
      patch.contentHash ?? hashContent(patch.dataJson ?? (current.dataJson as string))
    await this.prisma.node.update({
      where: { id },
      data: {
        version: nextVersion,
        dataJson: patch.dataJson,
        edgesJson: patch.edgesJson,
        metaJson: patch.metaJson,
        searchText: patch.searchText,
        state: patch.state,
        contentHash: nextContentHash,
        aclJson: patch.aclJson,
        qualityJson: patch.qualityJson,
        validUntil: patch.validUntil,
        securityLevel: patch.securityLevel,
        contentType: patch.contentType,
        authorDid: patch.authorDid,
        signature: patch.signature,
        parentVersion: current.version,
        updatedAt: Date.now(),
      },
    })
    await this.prisma.nodeVersion.create({
      data: {
        id: newId(),
        nodeId: id,
        version: nextVersion,
        hash: nextContentHash,
        contentRef: patch.dataJson ?? (current.dataJson as string),
        op: 'update',
        parentVersion: current.version,
        createdAt: Date.now(),
      },
    })
  }

  async getNodeAtVersion(nodeId: string, version: number): Promise<NodeVersionRow | null> {
    const r = await this.prisma.nodeVersion.findUnique({
      where: { nodeId_version: { nodeId, version } },
    })
    return r ? (r as unknown as NodeVersionRow) : null
  }

  async getNodeHistory(nodeId: string): Promise<NodeVersionRow[]> {
    const rows = await this.prisma.nodeVersion.findMany({
      where: { nodeId },
      orderBy: { version: 'asc' },
    })
    return rows as unknown as NodeVersionRow[]
  }

  // ── Node-layer v2: alias → canonical resolution ──

  async registerAlias(
    aliasId: string,
    canonicalId: string,
    method: string,
    confidence = 1.0,
  ): Promise<void> {
    await this.prisma.nodeAlias.upsert({
      where: { aliasId },
      create: {
        id: newId(),
        aliasId,
        canonicalId,
        method,
        confidence,
        createdAt: Date.now(),
      },
      update: { canonicalId, method, confidence },
    })
  }

  async resolveAlias(aliasId: string): Promise<string | null> {
    const r = await this.prisma.nodeAlias.findUnique({ where: { aliasId } })
    return (r?.canonicalId as string | null) ?? null
  }

  // ── Node-layer v2: rebuildable graph (OG ADR-001) ──

  async rebuildGraphFromNodes(): Promise<number> {
    // Clear materialized edges, then re-materialize from each node's edgesJson.
    await this.prisma.nodeEdge.deleteMany({})
    const nodes = await this.prisma.node.findMany({
      select: { id: true, edgesJson: true, createdAt: true },
    })
    let count = 0
    for (const n of nodes) {
      const edges = JSON.parse(n.edgesJson as string) as Edge[]
      for (const e of edges) {
        await this.prisma.nodeEdge
          .create({
            data: {
              id: newId(),
              sourceId: n.id,
              targetId: e.targetId,
              edgeType: e.type,
              label: e.label ?? null,
              weight: e.weight ?? null,
              propertiesJson: JSON.stringify(e.properties ?? {}),
              createdAt: n.createdAt,
            },
          })
          .catch(() => {})
        count++
      }
    }
    return count
  }
}
