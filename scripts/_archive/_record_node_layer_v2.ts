import { readFileSync } from 'node:fs'
import { newId } from '../src/ids.js'
import { getPrisma } from '../src/storage/prisma.js'

const p = getPrisma()

const migrationDir = 'prisma/migrations/20260718041000_node_layer_v2'
const filename = '20260718041000_node_layer_v2/migration.sql'
const sql = readFileSync(migrationDir + '/migration.sql', 'utf-8')
const checksum = await Bun.CryptoHasher.hash('sha256', sql, 'hex')

const existing = await p.migrationLog.findFirst({ where: { filename } })
if (existing) {
  // [audit] removed: console.log('migration already recorded:', filename)
} else {
  await p.migrationLog.create({
    data: { id: newId(), filename, checksum, appliedAt: Date.now() },
  })
  // [audit] removed: console.log('recorded migration:', filename, 'checksum', checksum.slice(0, 12))
}

const count = await p.node.count()
// [audit] removed: console.log('node rows:', count)
await p.$disconnect()
