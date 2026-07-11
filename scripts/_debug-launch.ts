import { appendFileSync } from 'node:fs'
import { openSync } from 'node:fs'
import { BunCdpClient } from '../src/executor/cdp.js'

const log = (m: string) => appendFileSync('dbg3.txt', m + '\n')

const binary = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const port = 9405
const profile = 'chrome-profiles/_dbg3_' + Date.now()
const args = [
  '--headless=new',
  '--remote-debugging-port=' + port,
  '--user-data-dir=' + profile,
  '--no-first-run',
  '--disable-extensions',
  '--disable-background-networking',
  '--disable-sync',
  '--disable-translate',
  '--metrics-recording-only',
]
log('args: ' + args.join(' '))

const errFd = openSync('chrome_stderr.txt', 'w')
const proc = Bun.spawn([binary, ...args], {
  stdout: 'ignore',
  stderr: errFd,
  env: { ...process.env },
})
log('spawned pid=' + proc.pid)

for (let i = 0; i < 30; i++) {
  try {
    const r = await fetch('http://127.0.0.1:' + port + '/json/version')
    if (r.ok) {
      log('VERSION OK ' + (i * 0.5).toFixed(1) + 's')
      break
    }
  } catch (e) {
    if (i === 29) log('FINAL err: ' + String(e))
  }
  await new Promise((r) => setTimeout(r, 500))
}
log('chrome stderr:')
try {
  const s = await Bun.file('chrome_stderr.txt').text()
  log(s.slice(0, 2000))
} catch {}
process.exit(0)
