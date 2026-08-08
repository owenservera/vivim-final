import { PrismaClient } from '@prisma/client'
const DB = process.env.DATABASE_URL ?? ''
const port = (await Bun.file('.runtime/backend.port').text()).trim()
const prisma = new PrismaClient({ datasources: { db: { url: DB } } } as never) as unknown as {
  conversation: { findMany: (a: never) => Promise<Array<Record<string, unknown>>> }
  conversationMessage: { findMany: (a: never) => Promise<Array<Record<string, unknown>>> }
}
const clean = (o: unknown): unknown =>
  JSON.parse(JSON.stringify(o, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)))

// 1. Create session via backend
const createRes = await fetch(`http://localhost:${port}/api/opencode/session`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: 'opencode/deepseek-v4-flash-free' }),
})
const created = (await createRes.json()) as { ok?: boolean; sessionId?: string }
console.log('create:', createRes.status, JSON.stringify(created))
if (!created.sessionId) process.exit(1)

// 2. Send a prompt
const sendRes = await fetch(`http://localhost:${port}/api/opencode/send`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sessionId: created.sessionId, prompt: 'Reply with exactly: hello from vivim ingest', model: 'opencode/deepseek-v4-flash-free' }),
})
console.log('send:', sendRes.status, JSON.stringify(await sendRes.json()))

// 3. Wait for the run to go idle (poll serve session status via backend sessions list)
const deadline = Date.now() + 150_000
let idle = false
while (Date.now() < deadline) {
  const listRes = await fetch(`http://localhost:${port}/api/opencode/sessions`)
  const list = (await listRes.json()) as { sessions?: Array<{ id: string }> }
  const mine = (list.sessions ?? []).find((s) => s.id === created.sessionId)
  // serve /session has no explicit status; check DB messages instead
  const convs = await prisma.conversation.findMany({} as never)
  const myConv = (convs as Array<Record<string, unknown>>).find(
    (c) => c.providerSessionId === created.sessionId,
  )
  if (myConv) {
    const msgs = await prisma.conversationMessage.findMany({} as never)
    const mineMsgs = (msgs as Array<Record<string, unknown>>).filter(
      (m) => m.conversationId === myConv.id,
    )
    if (mineMsgs.length >= 2) {
      console.log(`\nidle reached: ${mineMsgs.length} messages`)
      for (const m of mineMsgs) {
        const mm = clean(m) as Record<string, unknown>
        console.log(`  [${mm.role}] model=${mm.model} :: ${String(mm.content ?? '').slice(0, 100)}`)
      }
      idle = true
      break
    }
  }
  await Bun.sleep(5000)
}
if (!idle) console.log('TIMEOUT waiting for transcript projection')

// 4. Also show session list from serve
const listRes = await fetch(`http://localhost:${port}/api/opencode/sessions`)
const list = (await listRes.json()) as { ok?: boolean; count?: number; sessions?: Array<Record<string, unknown>> }
console.log('\nsessions endpoint:', JSON.stringify({ ok: list.ok, count: list.count, first: (list.sessions ?? []).slice(0, 1) }).slice(0, 800))
