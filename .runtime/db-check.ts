import { PrismaClient } from '@prisma/client'
const p = new PrismaClient({
  datasources: { db: { url: 'file:C:/0-BlackBoxProject-0/vivim-final/prisma/dev.db' } },
})
await p.$connect()
const sess = await p.providerSession.findMany({
  where: { id: 'ses_0215b7a86ffeDTfzyUqAfnug1w' },
})
const ser = (v: unknown) => JSON.stringify(v, (_k, val) => (typeof val === 'bigint' ? Number(val) : val))
console.log('PROVIDER_SESSIONS', ser(sess))
const agent = await p.agentSession.findMany({
  where: { providerSessionId: 'ses_0215b7a86ffeDTfzyUqAfnug1w' },
})
console.log('AGENT_SESSIONS', ser(agent))
const convs = await p.conversation.findMany({
  where: { providerSessionId: 'ses_0215b7a86ffeDTfzyUqAfnug1w' },
})
console.log('CONVERSATIONS', ser(convs.map((c) => ({ id: c.id, title: c.title }))))
await p.$disconnect()
