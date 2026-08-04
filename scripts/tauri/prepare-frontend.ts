import { execSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dir, '..', '..')
const frontendDir = join(root, 'frontend')
const outDir = join(frontendDir, 'out')

// Build Next.js as a static export.
// frontend/next.config.mjs already has output: "export" (set during the Tauri V2 upgrade),
// so no config patching is needed — the build produces a complete static site directly
// to frontend/out/ with all HTML, JS, CSS, and assets.

console.log('[prepare] Building Next.js static export...')
execSync('bun run build', { cwd: frontendDir, stdio: 'inherit' })

if (existsSync(outDir)) {
  const countFiles = (dir: string): number => {
    let count = 0
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) count += countFiles(full)
      else count++
    }
    return count
  }
  const fileCount = countFiles(outDir)
  console.log(`[prepare] Static export ready: ${fileCount} files in ${outDir}`)
} else {
  console.error('[prepare] ERROR: frontend/out/ not created. Next.js static export failed.')
  process.exit(1)
}

console.log('[prepare] Done. frontendDist is ready for Tauri.')
