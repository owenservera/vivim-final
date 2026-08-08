import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

function walk(dir: string, acc: string[]): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.runtime') continue
      walk(p, acc)
    } else if (entry.name.endsWith('.ts')) {
      acc.push(p)
    }
  }
  return acc
}

const files = walk('src', [])
let changedFiles = 0
let changedRefs = 0

for (const file of files) {
  const src = readFileSync(file, 'utf8')
  const lines = src.split('\n')
  let dirty = false
  for (let i = 0; i < lines.length; i++) {
    // Current line references _err inside catchDebug/catchWarn.
    if (!/(catchDebug|catchWarn)\(_err,/.test(lines[i]!)) continue
    // Preceding line must be a bare `catch {` (no binding).
    const prev = i > 0 ? lines[i - 1]! : ''
    if (!/catch\s*\{\s*$/.test(prev)) continue
    lines[i - 1] = prev.replace(/catch\s*\{/, 'catch (err) {')
    lines[i] = lines[i]!.replace(/_err/g, 'err')
    changedRefs++
    dirty = true
  }
  if (dirty) {
    writeFileSync(file, lines.join('\n'), 'utf8')
    changedFiles++
  }
}

console.log(`fixed ${changedRefs} refs across ${changedFiles} files`)
