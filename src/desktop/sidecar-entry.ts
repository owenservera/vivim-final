// src/desktop/sidecar-entry.ts
// Compiled entry for the Tauri sidecar (`vivim-server.exe`).
// Reuses the existing Bun.serve backend bootstrap — no new transport,
// no new protocol. The Rust core spawns this with `serve --host 127.0.0.1 --port 9421`.
//
// Bound to loopback only: the WebView (same machine) is the only client.
// This keeps the "One Entry Point" invariant — every operation is still a
// UnifiedCapability resolved through POST /api/interpret + /api/capabilities/:id/execute.

import { createServerWithEngines } from '../server/index.js'

// Skip the 'serve' subcommand if present (launch.bat passes it)
const argv = process.argv.filter((a) => a !== 'serve')

const PORT = Number(
  (process.env.PORT ?? argv.includes('--port'))
    ? (() => {
        const i = argv.indexOf('--port')
        return i >= 0 ? Number(argv[i + 1]) || 9421 : 9421
      })()
    : process.env.PORT || 9421,
)

const HOST = argv.includes('--host')
  ? (() => {
      const i = argv.indexOf('--host')
      return i >= 0 ? (argv[i + 1] ?? '127.0.0.1') : '127.0.0.1'
    })()
  : '127.0.0.1'

// Production posture: a compiled sidecar must not spawn pino-pretty worker threads.
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'production'

// Resolve DATABASE_URL to an absolute, machine-stable path when it is relative.
// A sidecar runs from the app's install/resource dir, so `file:./dev.db` would
// point at the wrong place. Default to %APPDATA%/vivim/app.db on Windows,
// $XDG_DATA_HOME/vivim on Linux, ~/Library/Application Support/vivim on macOS.
function resolveDbUrl(): string {
  const raw = process.env.DATABASE_URL
  if (raw && !raw.startsWith('file:./') && !raw.startsWith('file:../')) return raw ?? ''
  const name = 'app.db'
  let base: string
  if (process.platform === 'win32') {
    base = process.env.APPDATA ?? joinPaths(process.env.USERPROFILE ?? '.', 'AppData', 'Roaming')
  } else if (process.platform === 'darwin') {
    base = joinPaths(process.env.HOME ?? '.', 'Library', 'Application Support')
  } else {
    base = process.env.XDG_DATA_HOME ?? joinPaths(process.env.HOME ?? '.', '.local', 'share')
  }
  const dir = joinPaths(base, 'vivim')
  mkdirRecursive(dir)
  return `file:${joinPaths(dir, name)}`
}
function joinPaths(...parts: string[]): string {
  return parts.reduce((acc, p) =>
    acc.endsWith('/') || acc.endsWith('\\') ? acc + p : `${acc}/${p}`,
  )
}
function mkdirRecursive(dir: string): void {
  const fs = require('node:fs') as typeof import('fs')
  fs.mkdirSync(dir, { recursive: true })
}
process.env.DATABASE_URL = resolveDbUrl()

async function main() {
  const ctx = await createServerWithEngines(PORT)
  console.log(`vivim-server listening on http://${HOST}:${ctx.port}`)
}

main().catch((err) => {
  console.error('vivim-server fatal:', err)
  process.exit(1)
})
