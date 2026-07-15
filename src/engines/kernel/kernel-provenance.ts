// src/engines/kernel/kernel-provenance.ts
// KernelProvenance — records causal chains for operations.
// Tracks what caused what: selector → parser → result → action → error.

import { newId } from '../../ids.js'
import type { CausalNode, KernelStore } from '../../storage/contracts/kernel-store.js'

export interface ProvenanceChain {
  traceId: string
  nodes: CausalNode[]
  rootCause?: CausalNode
  totalDuration?: number
}

export class KernelProvenance {
  private buffer: CausalNode[] = []
  private bufferCapacity: number
  private store: KernelStore | null

  constructor(opts?: { bufferCapacity?: number; store?: KernelStore }) {
    this.bufferCapacity = opts?.bufferCapacity ?? 1000
    this.store = opts?.store ?? null
  }

  setStore(store: KernelStore): void {
    this.store = store
  }

  async record(node: Omit<CausalNode, 'id' | 'timestamp'>): Promise<string> {
    const fullNode: CausalNode = {
      ...node,
      id: newId(),
      timestamp: Date.now(),
    }

    this.buffer.push(fullNode)
    if (this.buffer.length > this.bufferCapacity) {
      this.buffer = this.buffer.slice(-Math.floor(this.bufferCapacity / 2))
    }

    if (this.store) {
      try {
        await this.store.insertProvenanceNode({
          traceId: fullNode.traceId,
          parentId: fullNode.parentId,
          kind: fullNode.kind,
          engineId: fullNode.engineId,
          description: fullNode.description,
          input: fullNode.input,
          output: fullNode.output,
          duration: fullNode.duration,
        })
      } catch (err) {
        console.error('[provenance] persist failed', err)
      }
    }

    return fullNode.id
  }

  getChain(traceId: string): ProvenanceChain {
    const nodes = this.buffer
      .filter((n) => n.traceId === traceId)
      .sort((a, b) => a.timestamp - b.timestamp)

    const rootCause = nodes.find((n) => n.kind === 'error') ?? nodes[0]
    const totalDuration = nodes.reduce((sum, n) => sum + (n.duration ?? 0), 0)

    return { traceId, nodes, rootCause, totalDuration }
  }

  getByEngine(engineId: string, limit = 50): CausalNode[] {
    return this.buffer.filter((n) => n.engineId === engineId).slice(-limit)
  }

  getByKind(kind: CausalNode['kind'], limit = 50): CausalNode[] {
    return this.buffer.filter((n) => n.kind === kind).slice(-limit)
  }

  getRecent(limit = 100): CausalNode[] {
    return this.buffer.slice(-limit)
  }

  clear(): void {
    this.buffer = []
  }

  size(): number {
    return this.buffer.length
  }
}
