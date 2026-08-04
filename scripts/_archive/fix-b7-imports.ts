// scripts/fix-b7-imports.ts
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const files = [
  'src/engines/backup-scheduler.ts',
  'src/engines/capability-event-bus-v2.ts',
  'src/engines/chrome-setup-wizard.ts',
  'src/engines/composer-typing.ts',
  'src/engines/config-universal-surface.ts',
  'src/engines/kernel/kernel-tracer.ts',
  'src/engines/lock-manager.ts',
  'src/engines/nlcl/graph/graph-model.ts',
  'src/engines/nlcl/intent-resolver.ts',
  'src/engines/nlcl/intent-router.ts',
  'src/engines/request-queue.ts',
  'src/engines/retry-engine.ts',
  'src/engines/streaming-channel-caps.ts',
]

let added = 0
const report: string[] = []

for (const f of files) {
  if (!existsSync(f)) continue
  let content = await readFile(f, 'utf8')
  const uses = /new EngineError\(|EngineError\b/.test(content)
  const imported = /^import\s.*\bEngineError\b/m.test(content)
  if (uses && !imported) {
    const dir = path.dirname(f)
    const rel = path.relative(dir, path.resolve('src')).split(path.sep).join('/')
    const importLine = `import { EngineError } from '${rel}/errors.js'`
    const m = content.match(/^(import |export |const |class |interface )/m)
    const insertAt = m ? m.index! : 0
    const parts = content.split('\n')
    parts.splice(insertAt, 0, importLine)
    content = parts.join('\n')
    await writeFile(f, content, 'utf8')
    added++
    report.push('ADDED ' + importLine + '  -> ' + f)
  }
}
report.push(`imports added: ${added}`)
console.log(report.join('\n'))
