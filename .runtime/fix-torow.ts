// Fix store-impl toRow signatures: replace Record<string, unknown> params with
// typed Prisma payload rows (mirrors contact-store-impl.ts pattern).
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

interface Target {
  file: string
  model: string
  method: string // method name (private toRow / module toRow / toLogRow)
}

const targets: Target[] = [
  { file: 'content-item-store-impl.ts', model: 'ContentItem', method: 'toRow' },
  { file: 'entity-container-store-impl.ts', model: 'EntityContainer', method: 'toRow' },
  { file: 'media-store-impl.ts', model: 'MediaAttachment', method: 'toRow' },
  { file: 'notification-store-impl.ts', model: 'Notification', method: 'toRow' },
  { file: 'sync-store-impl.ts', model: 'SyncState', method: 'toRow' },
  { file: 'parser-execution-log-store-impl.ts', model: 'ParserExecutionLog', method: 'toLogRow' },
  { file: 'content-unit-store-impl.ts', model: 'ContentUnit', method: 'toRow' },
]

let changed = 0
for (const t of targets) {
  const p = join('src/storage/impl', t.file)
  let s = readFileSync(p, 'utf8')
  const before = s

  // 1. Add Prisma type import (after existing imports) if missing
  if (!/@prisma\/client/.test(s)) {
    s = s.replace(
      /^(import\s+[^\n]*\n)+/,
      (m) => m + `import type { Prisma } from '@prisma/client'\n`,
    )
  }

  // 2. Add typed row alias near the toRow definition (before it)
  const aliasName = `${t.model}PrismaRow`
  if (!new RegExp(`type ${aliasName} =`).test(s)) {
    const methodRe = new RegExp(`(?<=\\n)([ \\t]*)(private )?${t.method}\\(r: `)
    const m = s.match(methodRe)
    if (m) {
      s = s.replace(
        methodRe,
        `$1type ${aliasName} = Prisma.${t.model}GetPayload<Record<string, never>>\n\n$1$2${t.method}(r: `,
      )
    }
  }

  // 3. Retype the toRow parameter
  s = s.replace(
    new RegExp(`((?:private )?${t.method}\\(r: )Record<string, unknown>`),
    `$1${aliasName}`,
  )

  // 4. Drop the explicit Record<string, unknown> annotations in reduce callbacks
  //    so the typed prisma row is inferred
  s = s.replace(/\(s: number, r: Record<string, unknown>\)/g, '(s: number, r)')

  if (s !== before) {
    writeFileSync(p, s, 'utf8')
    console.log('fixed:', t.file)
    changed++
  } else {
    console.log('no-op:', t.file)
  }
}
console.log(`\nupdated ${changed} files`)
