import { PrismaClient } from '@prisma/client'
const DB = process.env.DATABASE_URL ?? ''
const port = (await Bun.file('.runtime/backend.port').text()).trim()
const prisma = new PrismaClient({ datasources: { db: { url: DB } } } as never) as unknown as {
  conversation: { findMany: (a: never) => Promise<Array<Record<string, unknown>>> }
  conversationMessage: { findMany: (a: never) => Promise<Array<Record<string, unknown>>> }
}
const clean = (o: unknown): unknown =>
  JSON.parse(JSON.stringify(o, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)))
const convs = await prisma.conversation.findMany({} as never)
const opencodeConvs = (convs as Array<Record<string, unknown>>).filter((c) => c.providerId === 'opencode')
console.log('opencode conversations:', opencodeConvs.length)
for (const c of opencodeConvs) {
  const cc = clean(c) as Record<string, unknown>
  console.log('  conv', cc.id, 'title=', cc.title, 'providerSessionId=', cc.providerSessionId)
  const msgs = await prisma.conversationMessage.findMany({} as never)
  const mine = (msgs as Array<Record<string, unknown>>).filter((m) => m.conversationId === cc.id)
  console.log('    messages:', mine.length)
  for (const m of mine) {
    const mm = clean(m) as Record<string, unknown>
    console.log('     ', mm.role, '->', String(mm.content ?? '').slice(0, 80))
  }
  // Test the frontend fetch path
  const r = await fetch(`http://localhost:${port}/api/conversations/${encodeURIComponent(String(cc.id))}/messages`)
  const j = await r.json()
  console.log('    GET /api/conversations/:id/messages status', r.status, '->', JSON.stringify(j).slice(0, 200))
}
