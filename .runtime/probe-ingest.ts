import { PrismaClient } from '@prisma/client'
const DB = process.env.DATABASE_URL ?? ''
const prisma = new PrismaClient({ datasources: { db: { url: DB } } } as never) as unknown as {
  agentSession: { findMany: (a: never) => Promise<Array<Record<string, unknown>>> }
  conversationMessage: { findMany: (a: never) => Promise<Array<Record<string, unknown>>> }
  streamBlock: { findMany: (a: never) => Promise<Array<Record<string, unknown>>> }
  eventRecord: { findMany: (a: never) => Promise<Array<Record<string, unknown>>> }
  agentPermissionDecision: { findMany: (a: never) => Promise<Array<Record<string, unknown>>> }
}
const clean = (o: unknown): unknown =>
  JSON.parse(JSON.stringify(o, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)))

const sessions = await prisma.agentSession.findMany({} as never)
console.log('=== AgentSession:', sessions.length)
for (const s of sessions) console.log(' ', JSON.stringify(clean(s)))

const msgs = await prisma.conversationMessage.findMany({} as never)
console.log('=== ConversationMessage:', msgs.length)
for (const m of msgs.slice(-8)) {
  const c = clean(m) as Record<string, unknown>
  console.log(' ', c.id, 'role=', c.role, 'text=', String(c.text ?? '').slice(0, 120))
}

const evs = await prisma.eventRecord.findMany({} as never)
console.log('=== EventRecord:', evs.length, '(last 5)')
for (const e of evs.slice(-5)) {
  const c = clean(e) as Record<string, unknown>
  console.log(' ', c.id, 'type=', c.type, 'source=', c.source)
}

const perms = await prisma.agentPermissionDecision.findMany({} as never)
console.log('=== AgentPermissionDecision:', perms.length)
for (const p of perms) console.log(' ', JSON.stringify(clean(p)).slice(0, 200))
