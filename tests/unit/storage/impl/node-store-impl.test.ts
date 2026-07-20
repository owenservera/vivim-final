// tests/unit/storage/impl/node-store-impl.test.ts
// Unit — NodeStoreImpl: version chain (time travel), history, alias
// resolution, rebuildable graph, and content-hash dedup. Uses a real
// in-memory SQLite Prisma client so relational features are exercised.

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import type { NodeBase } from '../../../../src/schema/node.js'
import { NodeStoreImpl } from '../../../../src/storage/impl/node-store-impl.js'

// Pre-built fixture DB (tests/fixtures/node-store-test.db) is kept in sync with
// prisma/schema.prisma via `bunx prisma db push` (see node-layer-v2 PRD). A
// fresh per-run copy is used so tests clean up after themselves.
let dir: string
let prisma: PrismaClient
let store: NodeStoreImpl

function mkNode(over: Partial<NodeBase> & Pick<NodeBase, 'id' | 'type'>): NodeBase {
  const now = Date.now()
  return {
    id: over.id,
    type: over.type,
    schemaVersion: 1,
    version: 1,
    state: 'active',
    data: over.data ?? { text: 'hello' },
    edges: over.edges ?? [],
    meta: over.meta ?? {},
    createdAt: now,
    updatedAt: now,
  }
}

const FIXTURE = join(
  import.meta.dir,
  '..',
  '..',
  '..',
  '..',
  'tests',
  'fixtures',
  'node-store-test.db',
)

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'node-store-test-'))
  const dbPath = join(dir, 'test.db')
  const copy = await import('node:fs')
  copy.copyFileSync(FIXTURE, dbPath)
  prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } })
  store = new NodeStoreImpl(prisma as never)
})

afterAll(async () => {
  await prisma.$disconnect()
  rmSync(dir, { recursive: true, force: true })
})

describe('NodeStoreImpl — version chain (time travel)', () => {
  it('writes a version-1 entry on putNode', async () => {
    await store.putNode(mkNode({ id: 'n_v1', type: 'cap-store.message' }))
    const history = await store.getNodeHistory('n_v1')
    expect(history).toHaveLength(1)
    expect(history[0]?.version).toBe(1)
    expect(history[0]?.op).toBe('create')
  })

  it('updateNode bumps version and appends history', async () => {
    await store.putNode(mkNode({ id: 'n_v2', type: 'cap-store.message' }))
    await store.updateNode('n_v2', { dataJson: JSON.stringify({ text: 'edited' }) })
    const history = await store.getNodeHistory('n_v2')
    expect(history).toHaveLength(2)
    expect(history[1]?.version).toBe(2)
    expect(history[1]?.op).toBe('update')
    expect(history[1]?.parentVersion).toBe(1)
    const atV1 = await store.getNodeAtVersion('n_v2', 1)
    expect(atV1?.version).toBe(1)
  })
})

describe('NodeStoreImpl — alias resolution', () => {
  it('registers and resolves alias -> canonical', async () => {
    await store.registerAlias('alias_a', 'canon_x', 'merge', 0.9)
    const resolved = await store.resolveAlias('alias_a')
    expect(resolved).toBe('canon_x')
  })

  it('returns null for unknown alias', async () => {
    expect(await store.resolveAlias('nope')).toBeNull()
  })
})

describe('NodeStoreImpl — rebuildable graph', () => {
  it('materializes edges from node edgesJson', async () => {
    await store.putNode(
      mkNode({
        id: 'n_src',
        type: 'cap-store.message',
        edges: [{ type: 'responds_to', targetId: 'n_tgt', properties: {} }],
      }),
    )
    await store.putNode(mkNode({ id: 'n_tgt', type: 'cap-store.message' }))
    const count = await store.rebuildGraphFromNodes()
    expect(count).toBeGreaterThanOrEqual(1)
    const out = await store.getOutgoingEdges('n_src')
    expect(out.some((e) => e.targetId === 'n_tgt' && e.type === 'responds_to')).toBe(true)
  })
})

describe('NodeStoreImpl — content hash', () => {
  it('computes and stores a contentHash on putNode', async () => {
    const node = mkNode({ id: 'n_hash', type: 'cap-store.message', data: { text: 'dedup me' } })
    await store.putNode(node)
    const row = await store.getNode('n_hash')
    expect(row?.contentHash).toBeTruthy()
    expect(typeof row?.contentHash).toBe('string')
  })
})
