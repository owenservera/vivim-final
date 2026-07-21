// devops/llm-testing/adapters/cli-adapter.ts
// CLI REPL adapter — spawns bun CLI, writes commands, captures stdout.

import { spawn, type ChildProcess } from 'node:child_process'
import { join } from 'node:path'
import { getLogger } from '../../../src/lib/logger.js'
import type { UnifiedCapabilityRegistry } from '../../../src/engines/unified-registry.js'
import type { TestCase, TestConfig, TestResult, TestSurface } from '../types.js'
import type { SurfaceAdapter } from './surface-adapter.js'

const log = getLogger('llm-testing:cli')

export class CliAdapter implements SurfaceAdapter {
  readonly name: TestSurface = 'cli'
  private config!: TestConfig
  private proc: ChildProcess | null = null
  private output = ''
  private timeoutMs = 5000
  private registry?: UnifiedCapabilityRegistry

  async init(config: TestConfig, registry?: UnifiedCapabilityRegistry): Promise<void> {
    this.config = config
    this.timeoutMs = config.timeoutMs
    this.registry = registry
  }

  async discoverCapabilities(): Promise<TestCase[]> {
    // ONE ENTRY POINT: derive test cases from the live UnifiedCapabilityRegistry
    // rather than a hardcoded command list, so the suite never drifts from the
    // canonical capability set. Fall back to a smoke list if no registry is wired.
    if (this.registry) {
      return this.registry
        .list({ surface: 'cli' })
        .map((cap) => ({
          id: `cli-${cap.slug}`,
          surface: 'cli' as TestSurface,
          capability: cap.slug,
          action: `Invoke CLI command: ${cap.cliCommand?.name ?? cap.slug}`,
          expected: `Command ${cap.cliCommand?.name ?? cap.slug} executes successfully`,
          input: { command: cap.cliCommand?.name ?? cap.slug },
        }))
    }

    log.warn('No registry wired to CliAdapter; using fallback smoke list')
    const commands = [
      { cmd: 'conversations list', capability: 'conversation_list', action: 'List all conversations', expected: 'Returns array of conversations' },
      { cmd: 'conversations create', capability: 'conversation_create', action: 'Create new conversation', expected: 'Returns new conversation object' },
      { cmd: 'capabilities list', capability: 'capability_list', action: 'List all capabilities', expected: 'Returns array of registered capabilities' },
      { cmd: 'help', capability: 'help', action: 'Show help text', expected: 'Returns help output with available commands' },
    ]
    return commands.map((c) => ({
      id: `cli-${c.capability}`,
      surface: 'cli' as TestSurface,
      capability: c.capability,
      action: c.action,
      expected: c.expected,
      input: { command: c.cmd },
    }))
  }

  async execute(test: TestCase): Promise<TestResult> {
    const start = Date.now()
    const command = (test.input?.command as string) ?? test.action

    try {
      const output = await this.runCliCommand(command)
      const durationMs = Date.now() - start

      return {
        id: test.id,
        surface: test.surface,
        capability: test.capability,
        action: test.action,
        expected: test.expected,
        actual: output,
        status: output.toLowerCase().includes('error') ? 'fail' : 'pass',
        durationMs,
        timestamp: new Date().toISOString(),
      }
    } catch (err) {
      const durationMs = Date.now() - start
      const msg = err instanceof Error ? err.message : String(err)

      return {
        id: test.id,
        surface: test.surface,
        capability: test.capability,
        action: test.action,
        expected: test.expected,
        actual: msg,
        status: 'error',
        durationMs,
        timestamp: new Date().toISOString(),
        error: msg,
      }
    }
  }

  async cleanup(): Promise<void> {
    if (this.proc && !this.proc.killed) {
      this.proc.kill()
      this.proc = null
    }
  }

  private runCliCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const cliPath = join(process.cwd(), 'src', 'cli', 'index.ts')
      const proc = spawn('bun', ['run', cliPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd(),
        env: { ...process.env, NO_COLOR: '1' },
      })

      let stdout = ''
      let stderr = ''
      let settled = false

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true
          proc.kill()
          reject(new Error(`CLI command timed out after ${this.timeoutMs}ms: ${command}`))
        }
      }, this.timeoutMs)

      proc.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString()
        stdout += chunk
        if (chunk.includes('> ') || chunk.includes('cap> ')) {
          proc.stdin?.write(command + '\n')
        }
      })

      proc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString()
      })

      proc.on('close', (code) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        if (code === 0 || stdout.length > 0) {
          resolve(stdout.trim())
        } else {
          reject(new Error(stderr.trim() || `CLI exited with code ${code}`))
        }
      })

      proc.on('error', (err) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        reject(err)
      })
    })
  }
}
