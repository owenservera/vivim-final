import { PrismaClient } from '@prisma/client'
const p = new PrismaClient({
  datasources: { db: { url: 'file:C:/0-BlackBoxProject-0/vivim-final/prisma/dev.db' } },
})
await p.$connect()
const ser = (v: unknown) => JSON.stringify(v, (_k, val) => (typeof val === 'bigint' ? Number(val) : val))
const msgs = await p.conversationMessage.findMany({
  where: { conversationId: '01KZFA9C2RX68C3W9A20Z2D2V3' },
})
console.log(
  'MESSAGES',
  ser(
    msgs.map((m) => ({
      role: m.role,
      content: (m.content ?? '').slice(0, 160),
      blocks: (m.blocksJson ?? '').slice(0, 160),
    })),
  ),
)
const evts = await p.eventRecord
  .findMany({ where: { sessionId: 'ses_0215b7a86ffeDTfzyUqAfnug1w' } })
  .catch(() => null)
console.log('EVENT_RECORDS', evts ? evts.length : 'table missing')
await p.$disconnect()
