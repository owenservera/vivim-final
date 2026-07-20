// src/engines/local-agent/local-agent-executor.ts
// LocalAgentProviderExecutor — runs one-shot (and resumable) agentic tasks via the opencode CLI.
// No CDP / ChromeGovernor imports (Governor Canon).
//
// Parser contract VERIFIED against opencode v1.17.15 (`--format json` = NDJSON, one JSON
// object per line). Each line carries a top-level `type`; assistant content lives in
// `part.text` / `part.type` — NOT the legacy `message.parts` / `role` shape the old impl
// assumed. See docs/research/briefs/opencode-deep/ for the full evidence.

import { EngineError } from '../../errors.js'
import type { ContentBlock } from '../../schema/streaming.js'
import type { LocalAgentStore } from '../../storage/contracts/local-agent-store.js'
import type { CapabilityEventBus } from '../capability-event-bus.js'

export const LOCAL_AGENT_SLUG = 'opencode'

export interface AgentRunInput {
  prompt: string
  model?: string
  /** Resume an existing opencode session (verified: `-s/--session <id>`, NOT `--continue <id>`). */
  sessionId?: string
  /** Working directory the agent operates in. Defaults to process.cwd(). */
  cwd?: string
}

export interface AgentRunResult {
  blocks: ContentBlock[]
  model: string
  sessionId: string
  exitCode: number
  cost: number
  tokens: {
    input: number
    output: number
    reasoning: number
    cacheRead: number
    cacheWrite: number
  }
  raw: string
  timedOut: boolean
  /** Set when opencode silently denied a required tool (part.tool === 'invalid'). */
  permissionDenied?: boolean
}

interface OpencodeEvent {
  type?: string
  subtype?: string
  sessionID?: string
  error?: { name?: string; data?: { message?: string; ref?: string } } | string
  part?: {
    type?: string
    text?: string
    tool?: string
    callID?: string
    state?: {
      status?: string
      input?: unknown
      output?: string
    }
    reason?: string
    tokens?: {
      total?: number
      input?: number
      output?: number
      reasoning?: number
      cache?: { read?: number; write?: number }
    }
    cost?: number
    sessionID?: string
  }
}

/**
 * Parse the opencode `--format json` NDJSON stream into the canonical ContentBlock[].
 *
 * Verified event grammar (opencode v1.17.15):
 *   step_start  -> part.type:'step-start', part.sessionID
 *   reasoning    -> part.type:'reasoning', part.text        (only with --thinking)
 *   tool_use     -> part.type:'tool', part.tool, part.callID, part.state{status,input,output}
 *                  part.tool === 'invalid' => silent permission denial (exit still 0)
 *   text         -> part.type:'text', part.text
 *   step_finish  -> part.reason ('tool-calls' | 'stop'), part.tokens{...}, part.cost
 *   error        -> error{name,data.message}
 */
export function parseOpencodeJson(raw: string): {
  blocks: ContentBlock[]
  cost: number
  tokens: {
    input: number
    output: number
    reasoning: number
    cacheRead: number
    cacheWrite: number
  }
  sessionId: string
  permissionDenied: boolean
} {
  const blocks: ContentBlock[] = []
  let cost = 0
  let sessionId = ''
  let permissionDenied = false
  const tokens = { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0 }

  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0)
  for (const line of lines) {
    let obj: OpencodeEvent
    try {
      obj = JSON.parse(line) as OpencodeEvent
    } catch {
      continue
    }

    if (typeof obj.sessionID === 'string' && obj.sessionID && !sessionId) {
      sessionId = obj.sessionID
    }

    if (obj.type === 'error') {
      const message =
        typeof obj.error === 'string'
          ? obj.error
          : (obj.error?.data?.message ?? obj.error?.name ?? 'agent run failed')
      blocks.push({ type: 'error', message, code: 'AGENT_FAILED' })
      continue
    }

    const part = obj.part
    if (!part) continue

    if (typeof part.sessionID === 'string' && part.sessionID && !sessionId) {
      sessionId = part.sessionID
    }

    switch (part.type) {
      case 'text':
        if (typeof part.text === 'string') blocks.push({ type: 'text', text: part.text })
        break
      case 'reasoning':
        if (typeof part.text === 'string') blocks.push({ type: 'reasoning', text: part.text })
        break
      case 'step-start':
        blocks.push({ type: 'step-start' })
        break
      case 'tool': {
        if (part.tool === 'invalid') {
          permissionDenied = true
          const detail = part.state?.output ?? 'tool call was gated out by opencode permissions'
          blocks.push({ type: 'error', message: detail, code: 'PERMISSION_DENIED' })
          break
        }
        blocks.push({
          type: 'tool-call',
          toolCallId: part.callID ?? `tc_${blocks.length}`,
          toolName: part.tool ?? 'unknown',
          input: (part.state?.input as Record<string, unknown>) ?? {},
          state: part.state?.status === 'completed' ? 'output-available' : 'pending',
        })
        if (part.state?.output != null) {
          blocks.push({
            type: 'tool-result',
            toolCallId: part.callID ?? `tc_${blocks.length}`,
            output: part.state.output,
          })
        }
        break
      }
      default:
        break
    }

    if (part.reason !== undefined || part.cost !== undefined || part.tokens) {
      if (typeof part.cost === 'number') cost = part.cost
      if (part.tokens) {
        tokens.input = part.tokens.input ?? tokens.input
        tokens.output = part.tokens.output ?? tokens.output
        tokens.reasoning = part.tokens.reasoning ?? tokens.reasoning
        tokens.cacheRead = part.tokens.cache?.read ?? tokens.cacheRead
        tokens.cacheWrite = part.tokens.cache?.write ?? tokens.cacheWrite
      }
    }
  }

  return { blocks, cost, tokens, sessionId, permissionDenied }
}

export class LocalAgentProviderExecutor {
  private store: LocalAgentStore
  private eventBus?: CapabilityEventBus

  constructor(store: LocalAgentStore, eventBus?: CapabilityEventBus) {
    this.store = store
    this.eventBus = eventBus
  }

  async run(input: AgentRunInput): Promise<AgentRunResult> {
    const start = Date.now()
    const provider = await this.store.getAgentProvider(LOCAL_AGENT_SLUG)
    if (!provider) {
      throw new EngineError(`local-agent provider '${LOCAL_AGENT_SLUG}' is not seeded`)
    }
    const config = await this.store.getAgentConfig(LOCAL_AGENT_SLUG)
    if (!config) {
      throw new EngineError(`local-agent provider '${LOCAL_AGENT_SLUG}' has no config`)
    }
    const model = input.model ?? config.defaultModel
    if (!model) {
      throw new EngineError(`local-agent provider '${LOCAL_AGENT_SLUG}' has no model configured`)
    }
    if (!(await this.store.isModelAllowed(LOCAL_AGENT_SLUG, model))) {
      throw new EngineError(`model '${model}' is not in the local-agent allow-list`)
    }

    // Verified invocation: always pass -m (neutralizes repo default_agent:build -> unauth sonnet),
    // --auto (non-interactive), --format json (NDJSON). Resume via -s/--session when given.
    const args = ['run', '--auto', '--model', model, '--format', 'json']
    if (input.sessionId) args.push('--session', input.sessionId)
    args.push(input.prompt)

    const proc = Bun.spawn([config.binary, ...args], {
      cwd: input.cwd ?? process.cwd(),
      stdout: 'pipe',
      stderr: 'pipe',
    })

    let timedOut = false
    let raw = ''
    let stderrText = ''
    try {
      const timeout = new Promise<'timeout'>((resolve) =>
        setTimeout(() => resolve('timeout'), config.timeoutMs),
      )
      const read = (async (): Promise<{ out: string; err: string }> => {
        const out = await new Response(proc.stdout).text()
        const err = await new Response(proc.stderr).text()
        return { out, err }
      })()
      const race = await Promise.race([read, timeout])
      if (race === 'timeout') {
        timedOut = true
        proc.kill()
        stderrText = (await new Response(proc.stderr).text()) ?? ''
        raw = (await new Response(proc.stdout).text()) ?? ''
      } else {
        raw = race.out + (race.err ? `\n${race.err}` : '')
        stderrText = race.err
      }
    } catch {
      raw = ''
    }

    const exitCode = timedOut ? -1 : (proc.exitCode ?? -1)
    const parsed = parseOpencodeJson(raw)
    const { blocks, cost, tokens, sessionId, permissionDenied } = parsed

    // Fatal CLI error (e.g. bad session id) surfaces on stderr with exit != 0 and no error block.
    const hasErrorBlock = blocks.some((b) => b.type === 'error')
    if (exitCode !== 0 && !timedOut && !hasErrorBlock && stderrText.trim()) {
      blocks.push({
        type: 'error',
        message: stderrText.trim().split('\n').pop() ?? 'agent run failed',
        code: 'AGENT_FAILED',
      })
    }

    const ok = exitCode === 0 && !timedOut && !permissionDenied && !hasErrorBlock

    if (this.eventBus) {
      const latencyMs = Date.now() - start
      if (ok) {
        this.eventBus.emit({
          type: 'capability:executed',
          capabilityId: 'cap:agent:run',
          providerId: LOCAL_AGENT_SLUG,
          traceId: `${LOCAL_AGENT_SLUG}-${start}`,
          ok: true,
          latencyMs,
        })
      } else {
        this.eventBus.emit({
          type: 'capability:failed',
          capabilityId: 'cap:agent:run',
          providerId: LOCAL_AGENT_SLUG,
          traceId: `${LOCAL_AGENT_SLUG}-${start}`,
          error: timedOut ? 'timeout' : permissionDenied ? 'permission_denied' : `exit ${exitCode}`,
          recoveryBehavior: 'retry_selector',
        })
      }
    }

    return {
      blocks,
      model,
      sessionId,
      exitCode,
      cost,
      tokens,
      raw,
      timedOut,
      permissionDenied,
    }
  }
}
