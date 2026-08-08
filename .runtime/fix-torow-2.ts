// Fix remaining store-impl issues:
// 1. Add `import type { Prisma } from '@prisma/client'` to files that reference
//    Prisma in a row alias but never imported it (comment-header files).
// 2. Insert the PrismaRow alias for module-level toRow/toLogRow functions that
//    the first pass missed.
import { readFileSync, writeFileSync } from 'node:fs'

const prismaFiles = [
  'content-item-store-impl',
  'entity-container-store-impl',
  'media-store-impl',
  'notification-store-impl',
  'sync-store-impl',
]
const moduleFnFiles = [
  { file: 'parser-execution-log-store-impl', model: 'ParserExecutionLog', method: 'toLogRow' },
  { file: 'content-unit-store-impl', model: 'ContentUnit', method: 'toRow' },
]

for (const f of prismaFiles) {
  const p = 'src/storage/impl/' + f + '.ts'
  let s = readFileSync(p, 'utf8')
  if (!/@prisma\/client/.test(s)) {
    s = s.replace(/(^(?:import[^\n]*\n)+)/m, '$1import type { Prisma } from \'@prisma/client\'\n')
    writeFileSync(p, s, 'utf8')
    console.log('added Prisma import:', f)
  } else {
    console.log('already has Prisma import:', f)
  }
}

for (const t of moduleFnFiles) {
  const p = 'src/storage/impl/' + t.file + '.ts'
  let s = readFileSync(p, 'utf8')
  const aliasName = t.model + 'PrismaRow'
  if (!new RegExp(`type ${aliasName} =`).test(s)) {
    if (!/@prisma\/client/.test(s)) {
      s = s.replace(/(^(?:import[^\n]*\n)+)/m, '$1import type { Prisma } from \'@prisma/client\'\n')
    }
    const fnRe = new RegExp(`(\\n)([ \\t]*)function ${t.method}\\(`)
    const m = s.match(fnRe)
    if (m) {
      s = s.replace(
        fnRe,
        `$1type ${aliasName} = Prisma.${t.model}GetPayload<Record<string, never>>\n\n$2function ${t.method}(`,
      )
      writeFileSync(p, s, 'utf8')
      console.log('added alias:', t.file)
    } else {
      console.log('could not locate fn:', t.file)
    }
  } else {
    console.log('alias already present:', t.file)
  }
}
