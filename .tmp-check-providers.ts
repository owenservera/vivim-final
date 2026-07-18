import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
try {
  const providers = await p.providerDefinition.findMany({ include: { accounts: true } })
  console.log(JSON.stringify(providers, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2))
} finally {
  await p.$disconnect()
}
