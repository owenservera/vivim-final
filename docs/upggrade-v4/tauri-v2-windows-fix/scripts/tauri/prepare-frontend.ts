import { execSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, posix } from 'node:path'

const root = join(import.meta.dir, '..', '..')
const frontendDir = join(root, 'frontend')
const dotNext = join(frontendDir, '.next')
const outDir = join(frontendDir, 'out')

// 1. Temporarily patch next.config.mjs to use static export
//    Tauri requires a static file tree (HTML + JS + CSS), not a Node.js server.
//    We override output to 'export' for this build, then restore.
const nextConfigPath = join(frontendDir, 'next.config.mjs')
const originalConfig = readFileSync(nextConfigPath, 'utf-8')

console.log('[prepare] Patching next.config.mjs for static export...')
const patchedConfig = originalConfig
  .replace(/output:\s*"standalone"/, 'output: "export"')
  .replace(/turbopack:\s*\{[^}]*\},?/, '') // Remove hardcoded turbopack.root
  // Add basePath if running from Tauri's custom protocol
  .replace(
    'export default nextConfig;',
    'export default nextConfig;'
  )
writeFileSync(nextConfigPath, patchedConfig, 'utf-8')

try {
  // 2. Build Next.js as static export
  console.log('[prepare] Building Next.js as static export...')
  execSync('bun run build', { cwd: frontendDir, stdio: 'inherit' })

  // 3. The 'export' output mode writes directly to frontend/out/
  //    No manual index.html generation needed — Next.js produces a complete
  //    static site with all chunks, CSS, and HTML pages.
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
} finally {
  // 4. Restore original next.config.mjs
  console.log('[prepare] Restoring original next.config.mjs...')
  writeFileSync(nextConfigPath, originalConfig, 'utf-8')
}

console.log('[prepare] Done. frontendDist is ready for Tauri.')
