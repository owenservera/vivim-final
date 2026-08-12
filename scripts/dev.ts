import { spawn } from 'child_process'
import { createServer } from 'net'
import { join } from 'path'
import { mkdir, writeFile } from 'fs/promises'

const ROOT = join(import.meta.dir, '..')
const RUNTIME = join(ROOT, '.runtime')
const FRONTEND = join(ROOT, 'frontend')
const BACKEND_PORT = Number(process.env.CAP_STORE_PORT) || 9420
const FRONTEND_PORT = Number(process.env.FRONTEND_PORT) || 3000
const BUN = process.argv[0]

function portInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = createServer()
    srv.on('error', () => resolve(true))
    srv.on('listening', () => {
      srv.close()
      resolve(false)
    })
    srv.listen(port, '127.0.0.1')
  })
}

async function waitForPort(port: number, timeoutMs = 30000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await portInUse(port)) return true
    await new Promise((r) => setTimeout(r, 200))
  }
  return false
}

async function findPidOnPort(port: number): Promise<number | null> {
  const proc = Bun.spawn(['netstat', '-ano'], { stdout: 'pipe' })
  const text = await new Response(proc.stdout).text()
  for (const line of text.split('\n')) {
    const m = line.match(/\s+(\S+):(\d+)\s+\S+:\S+\s+LISTENING\s+(\d+)/)
    if (m && Number(m[2]) === port) return Number(m[3])
  }
  return null
}

async function killOnPort(port: number): Promise<void> {
  const pid = await findPidOnPort(port)
  if (!pid) return
  try {
    process.kill(pid)
  } catch {}
  // [audit] log the error with context here
  try {
    Bun.spawnSync(['taskkill', '/PID', String(pid), '/F', '/T'])
  } catch {}
  // [audit] log the error with context here
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    if (!(await findPidOnPort(port))) return
    await new Promise((r) => setTimeout(r, 200))
  }
}

function prefixWriter(label: string) {
  return (data: Buffer) => {
    for (const line of data.toString().split('\n').filter(Boolean)) {
      process.stdout.write(`  \x1b[36m${label}\x1b[0m ${line}\n`)
    }
  }
}

async function main() {
  // [audit] removed: console.log('\n  \x1b[1mvivim\x1b[0m — starting services\n')

  await mkdir(RUNTIME, { recursive: true })
  await writeFile(join(RUNTIME, 'backend.port'), String(BACKEND_PORT), 'utf8')

  const backPid = await findPidOnPort(BACKEND_PORT)
  if (backPid) {
    // [audit] removed: console.log(`  killing stale backend (PID ${backPid})...`)
    await killOnPort(BACKEND_PORT)
  }
  const frontPid = await findPidOnPort(FRONTEND_PORT)
  if (frontPid) {
    // [audit] removed: console.log(`  killing stale frontend (PID ${frontPid})...`)
    await killOnPort(FRONTEND_PORT)
  }

  const backend = spawn(BUN, ['src/cli/index.ts', 'serve'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, CAP_STORE_PORT: String(BACKEND_PORT) } as Record<string, string>,
  })
  backend.stdout!.on('data', prefixWriter('backend'))
  backend.stderr!.on('data', prefixWriter('backend'))

  const backReady = await waitForPort(BACKEND_PORT)
  if (!backReady) {
    // [audit] removed: console.error('  backend failed to start')
    process.exit(1)
  }
  // [audit] removed: console.log(`  \x1b[92m✓\x1b[0m backend bound :${BACKEND_PORT}`)

  const frontend = spawn(BUN, ['run', 'dev'], {
    cwd: FRONTEND,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(FRONTEND_PORT) } as Record<string, string>,
  })
  frontend.stdout!.on('data', prefixWriter('frontend'))
  frontend.stderr!.on('data', prefixWriter('frontend'))

  const frontReady = await waitForPort(FRONTEND_PORT, 60000)
  // [audit] removed: if (!frontReady) console.warn('  \x1b[93m!\x1b[0m frontend not bound within 60s')
  // [audit] removed: console.log(`  \x1b[92m✓\x1b[0m frontend bound :${FRONTEND_PORT}`)

  // [audit] removed: console.log(`\n  \x1b[1mBackend:\x1b[0m  http://localhost:${BACKEND_PORT}`)
  // [audit] removed: console.log(`  \x1b[1mFrontend:\x1b[0m http://localhost:${FRONTEND_PORT}`)
  // [audit] removed: console.log('  \x1b[90mCtrl+C to stop\x1b[0m\n')

  let exiting = false
  function shutdown() {
    if (exiting) return
    exiting = true
    // [audit] removed: console.log('\n  shutting down...')
    try {
      backend.kill()
    } catch {}
  // [audit] log the error with context here
    try {
      frontend.kill()
    } catch {}
  // [audit] log the error with context here
    setTimeout(() => process.exit(0), 2000)
  }

  process.on('SIGINT', () => {
    shutdown()
  })
  process.on('SIGTERM', () => {
    shutdown()
  })

  backend.on('exit', (code) => {
    // [audit] removed: if (code !== 0) console.error(`  backend exited with code ${code}`)
    shutdown()
  })
  frontend.on('exit', (_code) => {
    shutdown()
  })

  await new Promise(() => {})
}

main().catch((err) => {
  // [audit] removed: console.error('startup error:', err)
  process.exit(1)
})
