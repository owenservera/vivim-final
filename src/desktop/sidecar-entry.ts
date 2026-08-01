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

/**
 * Probe whether a TCP port is available. Returns true if the port is free.
 */
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const net = require('node:net') as typeof import('net')
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => {
      server.close(() => resolve(true))
    })
    server.listen(port, '127.0.0.1')
  })
}

/**
 * Find the next available port starting from `start`, probing up to `maxAttempts`.
 * Returns the available port or throws if none found.
 */
async function findAvailablePort(start: number, maxAttempts = 10): Promise<number> {
  for (let offset = 0; offset < maxAttempts; offset++) {
    const port = start + offset
    if (await isPortAvailable(port)) return port
  }
  throw new Error(`No available port found in range ${start}–${start + maxAttempts - 1}`)
}

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
// point at the wrong place. Default to %LOCALAPPDATA%/vivim/cap-store/cap-store.sqlite
// on Windows (matches config.ts defaultDataDir), ~/.local/share/vivim/cap-store on Linux,
// ~/Library/Application Support/vivim/cap-store on macOS.
function resolveDbUrl(): string {
  const raw = process.env.DATABASE_URL
  if (raw && !raw.startsWith('file:./') && !raw.startsWith('file:../')) return raw ?? ''
  const name = 'cap-store.sqlite'
  let base: string
  if (process.platform === 'win32') {
    base =
      process.env.LOCALAPPDATA ??
      process.env.APPDATA ??
      joinPaths(process.env.USERPROFILE ?? '.', 'AppData', 'Local')
  } else if (process.platform === 'darwin') {
    base = joinPaths(process.env.HOME ?? '.', 'Library', 'Application Support')
  } else {
    base = process.env.XDG_DATA_HOME ?? joinPaths(process.env.HOME ?? '.', '.local', 'share')
  }
  const dir = joinPaths(base, 'vivim', 'cap-store')
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
  // Self-healing: if the requested port is occupied, find the next available one.
  const port = await findAvailablePort(PORT)
  if (port !== PORT) {
    console.warn(`[vivim-server] port ${PORT} occupied, using ${port}`)
  }
  const ctx = await createServerWithEngines(port)
  console.log(`vivim-server listening on http://${HOST}:${ctx.port}`)
}

main().catch((err) => {
  console.error('vivim-server fatal:', err)
  process.exit(1)
})
