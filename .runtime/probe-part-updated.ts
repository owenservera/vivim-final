import { PrismaClient } from '@prisma/client'
const DB = process.env.DATABASE_URL ?? ''
const prisma = new PrismaClient({ datasources: { db: { url: DB } } } as never) as unknown as {
  eventRecord: { findMany: (a: never) => Promise<Array<Record<string, unknown>>> }
}
const clean = (o: unknown): unknown =>
  JSON.parse(JSON.stringify(o, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)))
const target = 'ses_0211482c4ffemwAQl5iI4O2v3S'
const evs = await prisma.eventRecord.findMany({} as never)
const mine = (evs as Array<Record<string, unknown>>).filter((e) => e.providerSessionId === target)
for (const want of ['message.part.updated', 'message.updated', 'session.status', 'session.updated']) {
  const samples = mine.filter((e) => e.type === want).slice(0, 3)
  console.log(`\n=== ${want} (${samples.length} of shown) ===`)
  for (const s of samples) {
    const c = clean(s) as { payloadJson?: string }
    try {
      console.log(JSON.stringify(JSON.parse(c.payloadJson ?? '{}')).slice(0, 900))
    } catch {
      console.log(c.payloadJson)
    }
  }
}
