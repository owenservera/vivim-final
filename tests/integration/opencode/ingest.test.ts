// tests/integration/opencode/ingest.test.ts
// S1/S2: client + ingest projection into AgentSession/AgentPermissionDecision/
// AgentFileEdit + EventRecord, thread render via getAgentMessages, idempotency.

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { EventRecordStore } from '../../../src/engines/event-record-store.js'
import { OpenCodeClient } from '../../../src/engines/opencode/opencode-client.js'
import { OpenCodeIngest } from '../../../src/engines/opencode/opencode-ingest.js'
import { AgenticStoreImpl } from '../../../src/storage/impl/agentic-store-impl.js'
import { NodeStoreImpl } from '../../../src/storage/impl/node-store-impl.js'

const FIXTURE = join(import.meta.dir, '..', '..', 'fixtures', 'node-store-test.db')

let dir: string
let prisma: PrismaClient
let store: AgenticStoreImpl
let events: EventRecordStore

const SESSION = 'sess-integration-1'
const PASS = 'test'

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'opencode-ingest-'))
  const dbPath = join(dir, 'test.db')
  copyFileSync(FIXTURE, dbPath)
  prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } })
  await prisma.$connect()
  const nodes = new NodeStoreImpl(prisma as never)
  store = new AgenticStoreImpl(nodes, prisma)
  events = new EventRecordStore(prisma)
})

afterAll(async () => {
  await prisma.$disconnect().catch(() => {})
  await new Promise((r) => setTimeout(r, 50))
  rmSync(dir, { recursive: true, force: true })
})

function makeClient(): OpenCodeClient {
  // Port doesn't matter — we push events via ingestEvent() directly, not through
  // the SSE subscribe path. The client is only used for respondPermission (best-effort POST).
  return new OpenCodeClient({ port: 1, password: PASS, username: 'opencode' })
}

describe('S1/S2: ingest projection + thread render', () => {
  it('projects served events into landing tables + EventRecord, renders thread, idempotent', async () => {
    const client = makeClient()
    const ingest = new OpenCodeIngest({ client, agenticStore: store, eventRecordStore: events })
    await ingest.start(SESSION, {
      model: 'opencode/hy3-free',
      agentName: 'opencode',
      projectPath: '/tmp/x',
    })

    // Push events via ingestEvent() directly — subscribe is best-effort and the
    // mock server's ReadableStream SSE is not needed for the ingest layer itself.
    await ingest.ingestEvent(SESSION, {
      type: 'step_start',
      sessionID: SESSION,
      part: { type: 'step-start' },
    })
    await ingest.ingestEvent(SESSION, {
      type: 'text',
      sessionID: SESSION,
      part: { type: 'text', text: 'hello from opencode' },
    })
    await ingest.ingestEvent(SESSION, {
      type: 'permission',
      sessionID: SESSION,
      permissionID: 'perm-1',
      toolName: 'read',
    })
    await ingest.ingestEvent(SESSION, {
      type: 'diff',
      sessionID: SESSION,
      id: 'edit-1',
      filePath: '/tmp/x/a.txt',
      patch: [{ op: 'add', path: '/0', value: 'x' }],
    })

    await new Promise((r) => setTimeout(r, 400))

    const agentSession = await prisma.agentSession.findUnique({
      where: { providerSessionId: SESSION },
    })
    expect(agentSession).not.toBeNull()
    expect(agentSession?.providerId).toBe('opencode')

    const perms = await prisma.agentPermissionDecision.findMany({
      where: { agentSessionId: agentSession?.id },
    })
    expect(perms.length).toBe(1)
    expect(perms[0].toolName).toBe('read')
    expect(perms[0].decidedBy).toBe('governor')

    const edits = await prisma.agentFileEdit.findMany({
      where: { agentSessionId: agentSession?.id },
    })
    expect(edits.length).toBe(1)
    expect(JSON.parse(edits[0].patchJson)[0].op).toBe('add')

    const recs = await prisma.eventRecord.findMany({ where: { source: 'opencode' } })
    expect(recs.length).toBeGreaterThanOrEqual(4)

    // biome-ignore lint/style/noNonNullAssertion: agentSession is validated not.toBeNull() above
    const msgs = await store.getAgentMessages(agentSession!.conversationId)
    expect(msgs.length).toBeGreaterThan(0)

    // Idempotency: re-ingest same permission id -> no new row.
    await ingest.start(SESSION, {})
    const perms2 = await prisma.agentPermissionDecision.findMany({
      where: { agentSessionId: agentSession?.id },
    })
    expect(perms2.length).toBe(1)

    await ingest.stop(SESSION)
  })
})
