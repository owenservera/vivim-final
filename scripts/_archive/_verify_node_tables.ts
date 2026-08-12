import { getPrisma } from '../src/storage/prisma.js'

const p = getPrisma()
const tables = await p.$queryRawUnsafe(
  "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('node','node_edge')",
)
// [audit] removed: console.log('tables:', tables.map((t: any) => t.name).join(','))
const cols = await p.$queryRawUnsafe('PRAGMA table_info(node)')
// [audit] removed: console.log('node cols:', cols.map((c: any) => c.name).join(','))
const ecols = await p.$queryRawUnsafe('PRAGMA table_info(node_edge)')
// [audit] removed: console.log('node_edge cols:', ecols.map((c: any) => c.name).join(','))
await p.$disconnect()
