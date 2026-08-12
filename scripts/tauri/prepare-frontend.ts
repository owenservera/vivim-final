/**
 * scripts/tauri/prepare-frontend.ts
 * ------------------------------------
 * Builds the frontend as a static export for Tauri.
 * Called by `beforeBuildCommand` in tauri.conf.json.
 *
 * next.config.mjs is env-driven: setting TAURI_STATIC_EXPORT=1 switches the
 * output from `standalone` to `export`, so `bun run build` emits `frontend/out/`
 * (which `frontendDist` points at). The env var is set here so the build works
 * cross-platform (cmd / PowerShell), unlike `TAURI_STATIC_EXPORT=1 ...` inline.
 *
 * The `src/app/api/**` route handlers are proxied to the Vivim backend sidecar
 * in Tauri mode (getApiBase() returns `http://127.0.0.1:<port>`, see
 * frontend/src/lib/ws-url.ts). They are dynamic (read req.url/body) and cannot
 * be part of a static export, so they are stashed aside during the export build
 * and restored afterwards — keeping the dev/standalone server intact.
 */

import { existsSync, mkdirSync, cpSync, rmSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '../..')
const frontendDir = resolve(root, 'frontend')
const apiDir = resolve(frontendDir, 'src/app/api')
// Stash OUTSIDE the repo: Next clears `frontend/.next` at build start, which
// would wipe a stash kept inside it.
const apiStash = join(tmpdir(), 'vivim-frontend-api-stash')

// Static export mode is selected via env (see frontend/next.config.mjs).
process.env.TAURI_STATIC_EXPORT = '1'

function stashApiRoutes(): void {
  if (!existsSync(apiDir)) return
  if (existsSync(apiStash)) rmSync(apiStash, { recursive: true, force: true })
  // Copy + delete instead of rename: rename throws EPERM on Windows when the
  // TS language server holds an open handle on the directory.
  cpSync(apiDir, apiStash, { recursive: true, force: true })
  rmSync(apiDir, { recursive: true, force: true })
  // [audit] removed: console.log('[prepare-frontend] stashed src/app/api during static export')
}

function restoreApiRoutes(): void {
  if (existsSync(apiDir) || !existsSync(apiStash)) return
  cpSync(apiStash, apiDir, { recursive: true, force: true })
  rmSync(apiStash, { recursive: true, force: true })
  // [audit] removed: console.log('[prepare-frontend] restored src/app/api')
}

function main() {
  // [audit] removed: console.log('[prepare-frontend] Building frontend static export...')

  // Ensure fonts directory exists (layout.tsx references them)
  const fontsDir = resolve(frontendDir, 'public/fonts')
  if (!existsSync(fontsDir)) {
    mkdirSync(fontsDir, { recursive: true })
    // [audit] removed: console.log('[prepare-frontend] Created public/fonts/ (add font files before building)')
  }

  stashApiRoutes()
  try {
    const proc = spawnSync('bun', ['run', 'build'], {
      cwd: frontendDir,
      stdio: 'inherit',
      env: process.env,
    })
    if (proc.status !== 0) {
      // [audit] removed: console.error(`[prepare-frontend] Frontend build failed with exit code ${proc.status}`)
      process.exit(proc.status ?? 1)
    }
  } finally {
    restoreApiRoutes()
  }

  // [audit] removed: console.log('[prepare-frontend] Frontend static export ready at frontend/out/')
}

main()
