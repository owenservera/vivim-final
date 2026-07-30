import { existsSync } from 'fs'
import { join } from 'path'
import { rm } from 'fs/promises'

const ROOT = join(import.meta.dir, '..')
const RUNTIME = join(ROOT, '.runtime')
const PORTS = [
  { port: Number(process.env.CAP_STORE_PORT) || 9420, label: 'backend' },
  { port: Number(process.env.FRONTEND_PORT) || 3000, label: 'frontend' },
]

async function findPidOnPort(port: number): Promise<number | null> {
  const proc = Bun.spawn(['netstat', '-ano'], { stdout: 'pipe' })
  const text = await new Response(proc.stdout).text()
  for (const line of text.split('\n')) {
    const m = line.match(/\s+(\S+):(\d+)\s+\S+:\S+\s+LISTENING\s+(\d+)/)
    if (m && Number(m[2]) === port) return Number(m[3])
  }
  return null
}

async function kill(pid: number): Promise<void> {
  try {
    process.kill(pid)
  } catch {}
  try {
    Bun.spawnSync(['taskkill', '/PID', String(pid), '/F', '/T'])
  } catch {}
}

async function main() {
  console.log('\n  \x1b[1mvivim\x1b[0m — stopping services\n')
  for (const { port, label } of PORTS) {
    const pid = await findPidOnPort(port)
    if (pid) {
      await kill(pid)
      const deadline = Date.now() + 5000
      while (Date.now() < deadline) {
        if (!(await findPidOnPort(port))) break
        await new Promise((r) => setTimeout(r, 200))
      }
      console.log(`  \x1b[92m✓\x1b[0m ${label} stopped (was PID ${pid})`)
    } else {
      console.log(`  \x1b[90m—\x1b[0m ${label} not running`)
    }
  }

  if (existsSync(RUNTIME)) {
    await rm(RUNTIME, { recursive: true, force: true })
    console.log(`  \x1b[90m—\x1b[0m cleaned .runtime`)
  }
  console.log()
}

main().catch((err) => {
  console.error('stop error:', err)
  process.exit(1)
})
