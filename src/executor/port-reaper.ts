// src/executor/port-reaper.ts
// Cleans up orphaned Chrome processes and their debug ports.

import { catchDebug } from '../lib/catch-logger.js'

export class PortReaperError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PortReaperError'
  }
}

export interface PortReaperOptions {
  defaultPortRange?: [number, number]
  periodicIntervalMs?: number
}

export interface ReapResult {
  reaped: number
  failed: number
  orphans: Array<{ pid: number; port: number }>
  durationMs: number
}

export interface OrphanInfo {
  pid: number
  port: number
  cmd: string
}

export class PortReaper {
  private opts: Required<PortReaperOptions>
  private knownPids = new Map<number, number>() // port -> pid
  private periodicTimer: ReturnType<typeof setInterval> | null = null

  constructor(opts?: PortReaperOptions) {
    this.opts = {
      defaultPortRange: opts?.defaultPortRange ?? [9222, 9230],
      periodicIntervalMs: opts?.periodicIntervalMs ?? 30_000,
    }
  }

  trackPid(port: number, pid: number): void {
    this.knownPids.set(port, pid)
  }

  untrackPid(port: number): void {
    this.knownPids.delete(port)
  }

  async reap(portRange?: [number, number]): Promise<ReapResult> {
    const start = Date.now()
    const range = portRange ?? this.opts.defaultPortRange
    const orphans = await this.findOrphans(range)
    let reaped = 0
    let failed = 0
    const reapedOrphans: Array<{ pid: number; port: number }> = []

    for (const orphan of orphans) {
      try {
        const ok = await this.reapProcess(orphan.pid)
        if (ok) {
          reaped++
          reapedOrphans.push({ pid: orphan.pid, port: orphan.port })
        } else {
          failed++
        }
      } catch (e) {
        catchDebug(e, 'port-reaper: kill attempt failed')
        failed++
      }
    }

    return {
      reaped,
      failed,
      orphans: reapedOrphans,
      durationMs: Date.now() - start,
    }
  }

  async reapProcess(pid: number): Promise<boolean> {
    if (process.platform === 'win32') {
      const proc = Bun.spawn({
        cmd: ['taskkill', '/PID', String(pid), '/F', '/T'],
        stdout: 'pipe',
        stderr: 'pipe',
      })
      await proc.exited
      return proc.exitCode === 0
    }

    // Unix: SIGTERM, then SIGKILL after 2s
    try {
      process.kill(pid, 'SIGTERM')
    } catch (e) {
      catchDebug(e, 'port-reaper: SIGTERM failed')
      return false
    }

    const start = Date.now()
    while (Date.now() - start < 2000) {
      if (!this.isProcessRunning(pid)) return true
      await Bun.sleep(100)
    }

    try {
      process.kill(pid, 'SIGKILL')
      return true
    } catch (e) {
      catchDebug(e, 'port-reaper: SIGKILL failed')
      return false
    }
  }

  async findOrphans(portRange: [number, number]): Promise<OrphanInfo[]> {
    const orphans: OrphanInfo[] = []
    const [start, end] = portRange

    for (let port = start; port <= end; port++) {
      const pid = await this.getPidOnPort(port)
      if (pid === null) continue

      // Skip processes we intentionally launched
      const expectedPid = this.knownPids.get(port)
      if (expectedPid !== undefined && expectedPid === pid) continue

      const cmd = await this.getProcessCommand(pid)
      if (!this.isChromeProcess(cmd)) continue

      orphans.push({ pid, port, cmd })
    }

    return orphans
  }

  startPeriodicReap(intervalMs?: number): void {
    this.stopPeriodicReap()
    const ms = intervalMs ?? this.opts.periodicIntervalMs
    this.periodicTimer = setInterval(() => {
      this.reap().catch(() => {})
    }, ms)
  }

  stopPeriodicReap(): void {
    if (this.periodicTimer) {
      clearInterval(this.periodicTimer)
      this.periodicTimer = null
    }
  }

  private async getPidOnPort(port: number): Promise<number | null> {
    if (process.platform === 'win32') {
      try {
        const proc = Bun.spawn({
          cmd: ['cmd', '/c', `netstat -ano | findstr :${port} | findstr LISTENING`],
          stdout: 'pipe',
          stderr: 'ignore',
        })
        const output = (await new Response(proc.stdout).text()).trim()
        for (const line of output.split('\n').filter(Boolean)) {
          const parts = line.trim().split(/\s+/)
          const pid = Number.parseInt(parts[parts.length - 1] ?? '', 10)
          if (Number.isFinite(pid) && pid > 0) return pid
        }
      } catch (e) {
        catchDebug(e, 'port-reaper: scan netstat failed')
      }
      return null
    }

    // Unix: lsof
    try {
      const proc = Bun.spawn({
        cmd: ['lsof', '-t', `-i:${port}`],
        stdout: 'pipe',
        stderr: 'ignore',
      })
      const pidText = (await new Response(proc.stdout).text()).trim()
      const firstPid = pidText.split('\n').filter(Boolean)[0]
      if (firstPid) {
        const pid = Number.parseInt(firstPid, 10)
        if (Number.isFinite(pid) && pid > 0) return pid
      }
    } catch (e) {
      catchDebug(e, 'port-reaper: PowerShell command failed')
    }
    return null
  }

  private async getProcessCommand(pid: number): Promise<string> {
    if (process.platform === 'win32') {
      try {
        // Use Get-CimInstance instead of deprecated wmic (removed in Win11 24H2)
        const proc = Bun.spawn({
          cmd: [
            'powershell',
            '-NoProfile',
            '-Command',
            `Get-CimInstance Win32_Process -Filter "ProcessId=${pid}" | Select-Object -ExpandProperty CommandLine`,
          ],
          stdout: 'pipe',
          stderr: 'ignore',
        })
        const output = (await new Response(proc.stdout).text()).trim()
        return output || ''
      } catch (e) {
        catchDebug(e, 'port-reaper: shell command failed')
        return ''
      }
    }

    try {
      const proc = Bun.spawn({
        cmd: ['cat', `/proc/${pid}/cmdline`],
        stdout: 'pipe',
        stderr: 'ignore',
      })
      const output = (await new Response(proc.stdout).text()).trim()
      return output.replace(/\0/g, ' ')
    } catch (e) {
      catchDebug(e, 'port-reaper: PowerShell output failed')
      return ''
    }
  }

  private isChromeProcess(cmd: string): boolean {
    const lower = cmd.toLowerCase()
    return lower.includes('chrome') || lower.includes('chromium')
  }

  private isProcessRunning(pid: number): boolean {
    try {
      process.kill(pid, 0)
      return true
    } catch (e) {
      catchDebug(e, 'port-reaper: process running check failed')
      return false
    }
  }
}
