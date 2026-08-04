import { readFileSync } from 'node:fs'
import { newId } from '../src/ids.js'
import { getPrisma } from '../src/storage/prisma.js'

const p = getPrisma()

const migrationDir = 'prisma/migrations/20260718022736_universal_node_layer'
const filename = '20260718022736_universal_node_layer/migration.sql'
const sql = readFileSync(migrationDir + '/migration.sql', 'utf-8')
const checksum = await Bun.CryptoHasher.hash('sha256', sql, 'hex')

const existing = await p.migrationLog.findFirst({ where: { filename } })
if (existing) {
  console.log('migration already recorded:', filename)
} else {
  await p.migrationLog.create({
    data: { id: newId(), filename, checksum, appliedAt: Date.now() },
  })
  console.log('recorded migration:', filename, 'checksum', checksum.slice(0, 12))
}

const count = await p.node.count()
console.log('node rows:', count)
await p.$disconnect()
