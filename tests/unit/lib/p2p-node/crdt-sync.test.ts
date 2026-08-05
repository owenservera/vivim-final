// tests/unit/lib/p2p-node/crdt-sync.test.ts
// CRDTDocument — Lamport clock, operations, sync

import { describe, expect, it } from 'bun:test'

const { CRDTDocument } = await import('../../../../src/lib/p2p-node/crdt-sync.js')

describe('CRDTDocument', () => {
  it('creates with documentId', () => {
    const doc = new CRDTDocument('doc-1')
    expect(doc).toBeDefined()
  })

  it('initial clock is 0', () => {
    const doc = new CRDTDocument('doc-1')
    expect(doc.getClock()).toBe(0)
  })

  it('initial version is v0:0', () => {
    const doc = new CRDTDocument('doc-1')
    expect(doc.getVersion()).toBe('v0:0')
  })

  it('applyOperation increments clock', () => {
    const doc = new CRDTDocument('doc-1')
    doc.applyOperation({
      id: 'op-1',
      type: 'insert',
      position: 0,
      value: 'hello',
      lamportClock: 1,
      authorPeerId: 'peer-1',
    })
    expect(doc.getClock()).toBe(2)
    expect(doc.getVersion()).toBe('v1:2')
  })

  it('applyOperation uses max of clocks', () => {
    const doc = new CRDTDocument('doc-1')
    doc.applyOperation({ id: 'op-a', type: 'insert', position: 0, value: 'a', lamportClock: 5, authorPeerId: 'p1' })
    expect(doc.getClock()).toBe(6) // max(0, 5) + 1 = 6
    doc.applyOperation({ id: 'op-b', type: 'insert', position: 1, value: 'b', lamportClock: 3, authorPeerId: 'p2' })
    expect(doc.getClock()).toBe(7) // max(6, 3) + 1 = 7
    doc.applyOperation({ id: 'op-c', type: 'insert', position: 2, value: 'c', lamportClock: 10, authorPeerId: 'p3' })
    expect(doc.getClock()).toBe(11) // max(7, 10) + 1 = 11
  })

  it('getOperationsSince returns only newer ops', () => {
    const doc = new CRDTDocument('doc-1')
    doc.applyOperation({ id: 'op-a', type: 'insert', position: 0, value: 'a', lamportClock: 1, authorPeerId: 'p1' })
    doc.applyOperation({ id: 'op-b', type: 'insert', position: 1, value: 'b', lamportClock: 3, authorPeerId: 'p2' })
    doc.applyOperation({ id: 'op-c', type: 'insert', position: 2, value: 'c', lamportClock: 5, authorPeerId: 'p3' })

    const since1 = doc.getOperationsSince(1)
    expect(since1).toHaveLength(2) // ops with clock 3 and 5

    const since3 = doc.getOperationsSince(3)
    expect(since3).toHaveLength(1) // op with clock 5

    const since5 = doc.getOperationsSince(5)
    expect(since5).toHaveLength(0)
  })

  it('getOperationsSince with clock 0 returns all', () => {
    const doc = new CRDTDocument('doc-1')
    doc.applyOperation({ id: 'op-a', type: 'insert', position: 0, value: 'a', lamportClock: 1, authorPeerId: 'p1' })
    doc.applyOperation({ id: 'op-b', type: 'delete', position: 1, lamportClock: 2, authorPeerId: 'p2' })

    const all = doc.getOperationsSince(0)
    expect(all).toHaveLength(2)
  })
})
