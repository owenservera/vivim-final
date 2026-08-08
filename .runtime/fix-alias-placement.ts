// Move PrismaRow type aliases out of class bodies to module scope.
import { readFileSync, writeFileSync } from 'node:fs'

const files = [
  'content-item-store-impl',
  'entity-container-store-impl',
  'media-store-impl',
  'notification-store-impl',
  'sync-store-impl',
]

const re = /^\s*type \w+PrismaRow = Prisma\.\w+GetPayload<Record<string, never>>\n\n/m

for (const f of files) {
  const p = 'src/storage/impl/' + f + '.ts'
  let s = readFileSync(p, 'utf8')
  const m = s.match(re)
  if (!m) {
    console.log('no in-class alias in', f)
    continue
  }
  const alias = m[0].trim()
  s = s.replace(re, '')
  const importBlock = s.match(/^(?:import[^\n]*\n)+/m)
  if (!importBlock) {
    console.log('no import block in', f)
    continue
  }
  s = s.replace(importBlock[0], importBlock[0] + '\n' + alias + '\n\n')
  writeFileSync(p, s, 'utf8')
  console.log('moved alias out of class:', f)
}
