import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dir, '..', '..')
const frontendDir = join(root, 'frontend')
const outDir = join(frontendDir, 'out')
const configPath = join(frontendDir, 'next.config.mjs')

// Temporarily inject output: "export" for static HTML export (Tauri needs static files).
const originalConfig = readFileSync(configPath, 'utf8')
if (!originalConfig.includes('output:')) {
  const patched = originalConfig.replace(
    'const nextConfig = {',
    'const nextConfig = {\n  output: "export",',
  )
  writeFileSync(configPath, patched, 'utf8')
  console.log('[prepare] Patched next.config.mjs with output: "export"')
}

try {
  console.log('[prepare] Building Next.js static export...')
  execSync('bun run build', { cwd: frontendDir, stdio: 'inherit' })
} finally {
  // Restore original config.
  writeFileSync(configPath, originalConfig, 'utf8')
  console.log('[prepare] Restored next.config.mjs')
}

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
