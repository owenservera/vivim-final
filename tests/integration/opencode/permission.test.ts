// tests/integration/opencode/permission.test.ts
// S2b: Governor-owned permission — tier-4 bash auto-denied; decision POSTed back.

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { EventRecordStore } from '../../../src/engines/event-record-store.js'
import { OpenCodeClient } from '../../../src/engines/opencode/opencode-client.js'
import { OpenCodeIngest } from '../../../src/engines/opencode/opencode-ingest.js'
import type { OpencodeEvent } from '../../../src/engines/opencode/types.js'
import { AgenticStoreImpl } from '../../../src/storage/impl/agentic-store-impl.js'
import { NodeStoreImpl } from '../../../src/storage/impl/node-store-impl.js'

const FIXTURE = join(import.meta.dir, '..', '..', 'fixtures', 'node-store-test.db')
const SESSION = 'sess-perm-1'
const PASS = 'test'

// Minimal client stub: no SSE; capture permission responses via respondPermission.
class MockClient extends OpenCodeClient {
  public posted: Array<{ id: string; decision: string }> = []
  constructor(port: number, password: string) {
    super({ port, password })
  }
  async respondPermission(
    _sessionId: string,
    permissionId: string,
    decision: string,
  ): Promise<void> {
    this.posted.push({ id: permissionId, decision })
  }
}

let dir: string
let prisma: PrismaClient

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'opencode-perm-'))
  const dbPath = join(dir, 'test.db')
  copyFileSync(FIXTURE, dbPath)
  prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } })
  await prisma.$connect()
})

afterAll(async () => {
  await prisma.$disconnect().catch(() => {})
  await new Promise((r) => setTimeout(r, 50))
  rmSync(dir, { recursive: true, force: true })
})

describe('S2b: Governor permission (tier > 3 auto-deny)', () => {
  it('denies a tier-4 bash permission and POSTs decision:deny', async () => {
    const nodes = new NodeStoreImpl(prisma as never)
    const store = new AgenticStoreImpl(nodes, prisma)
    const events = new EventRecordStore(prisma)
    const client = new MockClient(0, PASS)
    const ingest = new OpenCodeIngest({ client, agenticStore: store, eventRecordStore: events })
    await ingest.start(SESSION, {})

    const ev: OpencodeEvent = {
      type: 'permission',
      sessionID: SESSION,
      permissionID: 'perm-bash',
      toolName: 'bash',
    }
    await ingest.ingestEvent(SESSION, ev)

    const agentSession = await prisma.agentSession.findUnique({
      where: { providerSessionId: SESSION },
    })
    const perms = await prisma.agentPermissionDecision.findMany({
      where: { agentSessionId: agentSession?.id },
    })
    expect(perms.length).toBe(1)
    expect(perms[0]?.decision).toBe('deny')
    expect(perms[0]?.riskTier).toBe(4)
    expect(perms[0]?.decidedBy).toBe('governor')
    expect(client.posted).toContainEqual({ id: 'perm-bash', decision: 'deny' })

    await ingest.stop(SESSION)
  })
})
