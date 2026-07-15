// scripts/fix-b7-errors.ts
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'

const d = JSON.parse(await readFile('docs/audits/findings.json', 'utf8'))
const all = d.findings.filter((x: any) => /new Error/.test(x.evidence || ''))

const map = new Map<string, string>()
for (const x of all) {
  const f = x.file.replace(/\\/g, '/')
  map.set(`${f}:${x.line}`, f)
}

const files = [...new Set([...map.values()])].map((f) => f.replace(/\\/g, '/'))
let changed = 0
let zeroArg = 0
const report: string[] = []

for (const f of files) {
  if (!existsSync(f)) {
    report.push('MISSING ' + f)
    continue
  }
  const lines = (await readFile(f, 'utf8')).split('\n')
  let fileChanged = false
  for (const [key, ff] of map) {
    if (ff !== f) continue
    const line = Number(key.split(':').pop())
    const cur = lines[line - 1]
    if (cur && cur.includes('new Error(')) {
      if (/new Error\(\)/.test(cur)) {
        zeroArg++
        report.push('ZEROARG ' + f + ':' + line + '  ' + cur.trim().slice(0, 70))
      }
      lines[line - 1] = cur.replace('new Error(', 'new EngineError(')
      fileChanged = true
    }
  }
  if (fileChanged) {
    let content = lines.join('\n')
    if (!/EngineError/.test(content)) {
      const segs = f.split('/')
      const depth = segs.length - 2
      const rel = '../'.repeat(depth) + 'errors.js'
      const importLine = `import { EngineError } from '${rel}'`
      const m = content.match(/^(import |export |const |class |interface )/m)
      const insertAt = m ? m.index! : 0
      const parts = content.split('\n')
      parts.splice(insertAt, 0, importLine)
      content = parts.join('\n')
    }
    await writeFile(f, content, 'utf8')
    changed++
    report.push('PATCHED ' + f)
  }
}
report.push(`files changed: ${changed}, zeroArg sites: ${zeroArg}`)
console.log(report.join('\n'))
