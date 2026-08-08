// Persistent MCP relay for live browser debugging.
//
// Spawns the browser MCP server once (headed Chrome when VIVIM_BROWSER_VISIBLE=1)
// and keeps it alive. Commands are read as newline-delimited JSON from
// .runtime/mcp-cmds.jsonl; each response is appended to .runtime/mcp-results.jsonl
// keyed by the same id. The agent (or a human) appends commands and reads results
// while the server + visible Chrome persist in the background.
//
// Command line: {"id":"c1","name":"browser_open","args":{"url":"https://..."}}
// Notification (no response): {"id":"c1","notify":"exit"}
import { existsSync, mkdirSync, appendFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { resolve } from 'node:path'

const CMD = resolve('.runtime/mcp-cmds.jsonl')
const RES = resolve('.runtime/mcp-results.jsonl')
const ENTRY = resolve('src/mcp/browser-mcp.ts')

mkdirSync(resolve('.runtime'), { recursive: true })

const child = spawn('bun', ['run', ENTRY], {
  cwd: process.cwd(),
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    VIVIM_LOG_STDERR: '1',
    VIVIM_BROWSER_VISIBLE: process.env.VIVIM_BROWSER_VISIBLE ?? '1',
  },
})

child.stderr.on('data', (d) => process.stderr.write(d))

const rl = createInterface({ input: child.stdout })
const pending = new Map<string, (msg: unknown) => void>()
let seq = 0

rl.on('line', (line) => {
  let msg: unknown
  try {
    msg = JSON.parse(line)
  } catch {
    return
  }
  const m = msg as { id?: unknown; result?: unknown; error?: unknown }
  const key = String(m.id ?? '')
  if (pending.has(key)) {
    pending.get(key)!(msg)
    pending.delete(key)
  }
})

function call(cmd: { id: string; name: string; args?: Record<string, unknown> }): void {
  const params = { name: cmd.name, arguments: cmd.args ?? {} }
  const reqId = `req-${++seq}`
  const timer = setTimeout(() => {
    if (pending.has(reqId)) {
      pending.delete(reqId)
      writeResult(cmd.id, { timeout: true })
    }
  }, 90_000)
  pending.set(reqId, (msg) => {
    clearTimeout(timer)
    writeResult(cmd.id, msg)
  })
  child.stdin.write(
    JSON.stringify({ jsonrpc: '2.0', id: reqId, method: 'tools/call', params }) + '\n',
  )
}

function writeResult(id: string, msg: unknown): void {
  appendFileSync(RES, JSON.stringify({ id, msg }) + '\n')
}

async function poll(): Promise<void> {
  if (!existsSync(CMD)) {
    setTimeout(poll, 400)
    return
  }
  const text = await Bun.file(CMD).text()
  const lines = text.split('\n').filter((l) => l.trim() !== '')
  if (lines.length === 0) {
    setTimeout(poll, 400)
    return
  }
  // truncate the command file: process all commands, keep none
  await Bun.write(CMD, '')
  for (const line of lines) {
    let cmd: { id?: string; name?: string; args?: Record<string, unknown>; notify?: string }
    try {
      cmd = JSON.parse(line)
    } catch {
      appendFileSync(RES, JSON.stringify({ id: '?', error: `bad json: ${line}` }) + '\n')
      continue
    }
    if (cmd.notify) {
      // notification (no response expected)
      if (cmd.notify === 'exit') {
        child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'exit' }) + '\n')
        setTimeout(() => process.exit(0), 1000)
        return
      }
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: cmd.notify }) + '\n')
      continue
    }
    if (!cmd.id || !cmd.name) {
      appendFileSync(RES, JSON.stringify({ id: cmd.id ?? '?', error: 'missing id/name' }) + '\n')
      continue
    }
    call({ id: cmd.id, name: cmd.name, args: cmd.args })
  }
  setTimeout(poll, 400)
}

console.log(`[relay] ready. commands -> ${CMD}\n[relay] results -> ${RES}\n[relay] pid=${process.pid}`)
poll().catch((e) => {
  console.error('[relay] fatal:', e)
  process.exit(1)
})

process.on('SIGINT', () => {
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'exit' }) + '\n')
  setTimeout(() => process.exit(0), 1000)
})
process.on('SIGTERM', () => {
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'exit' }) + '\n')
  setTimeout(() => process.exit(0), 1000)
})
