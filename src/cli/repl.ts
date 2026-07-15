// src/cli/repl.ts
// Units 24.8 / 25.8 / 29.2 — interactive natural-language read-eval-print loop.
// The CLI REPL and the frontend chat box issue identical /api/interpret
// requests: both resolve NL → capability via the NLCL, then the universal
// execute route. This file is the CLI half; 25.8/29.2 flesh out streaming +
// interactive-session wiring.

export interface ReplOptions {
  remote: string
  auth?: string
}

// Phase 29.2: Session context
interface ReplContext {
  activeSessionId: string | null
  activeProviderId: string | null
  activeConversationId: string | null
}

function buildHeaders(auth?: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (auth) headers.Authorization = `Bearer ${auth}`
  return headers
}

function formatResult(out: unknown): string {
  if (out && typeof out === 'object' && 'output' in out) {
    return JSON.stringify((out as { output: unknown }).output, null, 2)
  }
  return JSON.stringify(out, null, 2)
}

export async function startRepl(opts: ReplOptions): Promise<void> {
  const { remote, auth } = opts
  const headers = buildHeaders(auth)
  const interpretUrl = `${remote}/api/interpret`
  const stdin = process.stdin
  const stdout = process.stdout

  // Phase 29.2: Track active session
  const ctx: ReplContext = {
    activeSessionId: null,
    activeProviderId: null,
    activeConversationId: null,
  }

  const prompt = (): Promise<string> =>
    new Promise((resolve) => {
      stdout.write('\x1b[36mvivim>\x1b[0m ')
      stdin.once('data', (chunk) => resolve(chunk.toString().trim()))
    })

  stdout.write('vivim interactive shell — type natural language ("exit" to quit).\n')
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const line = await prompt()
    if (!line) continue
    if (line === 'exit' || line === 'quit' || line === ':q') break

    try {
      const res = await fetch(interpretUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text: line, ctx }),
      })
      const data = (await res.json()) as Record<string, unknown>
      if (!res.ok) {
        stdout.write(`! ${JSON.stringify(data)}\n`)
        continue
      }

      // Handle clarification (25.6)
      const clarification = data.clarification as { prompt?: string } | undefined
      if (clarification) {
        stdout.write(`? ${clarification.prompt ?? 'Clarification needed'}\n`)
        continue
      }

      // Handle confirmation (25.6)
      if (data.requiresConfirmation === true) {
        const confirmation = data.confirmation as { prompt?: string } | undefined
        stdout.write(`[CONFIRM] ${confirmation?.prompt ?? 'Action requires confirmation'}\n`)
        continue
      }

      // Phase 29.2: Update session context on session_load
      const sessionId = data.sessionId as string | undefined
      if (sessionId) {
        ctx.activeSessionId = sessionId
        ctx.activeProviderId = (data.providerId as string) ?? null
        ctx.activeConversationId = (data.conversationId as string) ?? null
        stdout.write(`[${(data.providerId as string) ?? 'session'} session active: ${sessionId}]\n`)
      }

      const out = (data.output as Record<string, unknown>) ?? data
      if (out && typeof out === 'object' && 'capabilityId' in out) {
        stdout.write(`→ ${out.capabilityId}: ${out.text ?? JSON.stringify(out)}\n`)
      } else {
        stdout.write(`${typeof out === 'string' ? out : formatResult(out)}\n`)
      }
    } catch (err) {
      stdout.write(`! ${(err as Error).message}\n`)
    }
  }

  stdout.write('bye.\n')
  process.exit(0)
}
