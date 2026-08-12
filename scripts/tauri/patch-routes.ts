import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const apiDir = join(import.meta.dir, '..', '..', 'frontend', 'src', 'app', 'api')

// Recursively find all route.ts files
function findRouteFiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) results.push(...findRouteFiles(full))
    else if (entry.name === 'route.ts') results.push(full)
  }
  return results
}

const files = findRouteFiles(apiDir)
let patched = 0

for (const file of files) {
  const content = readFileSync(file, 'utf-8')
  if (content.includes('export const dynamic')) continue

  // Find the last import line
  const lines = content.split('\n')
  let lastImportIdx = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.match(/^import\s/)) lastImportIdx = i
  }

  if (lastImportIdx === -1) {
    // No imports — check if there's a "use server" directive or similar
    // [audit] removed: console.warn(`SKIP (no imports): ${file}`)
    continue
  }

  // Insert after the last import line
  lines.splice(lastImportIdx + 1, 0, '', 'export const dynamic = "force-static";')
  writeFileSync(file, lines.join('\n'), 'utf-8')
  patched++
}

// [audit] removed: console.log(`Patched ${patched}/${files.length} route files`)
