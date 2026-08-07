/**
 * app/api/agent/canvas/command/route.ts
 * --------------------------------------------------------------------
 * POST endpoint for agents to issue canvas commands.
 * Validates policy, executes via CanvasCommandExecutor, returns response.
 *
 * Session 1 (2026-08-07): The 4 "TODO: Add proper auth" markers were replaced
 * with `assertLocalhostOrAuth()`. Alpha is local-first and AUTH_TOKEN is
 * optional (see `docs/ALPHA.md` out-of-scope register: auth-token). When no
 * AUTH_TOKEN is set, requests must originate from localhost. When AUTH_TOKEN
 * IS set, the bearer token is checked. This satisfies the alpha security
 * contract: no remote unauthenticated access.
 */

import { createCanvasCommandExecutor } from '@/engines/canvas-command-executor'
import type { AgentCanvasCommand, AgentCanvasPolicy } from '@/shared/agent-canvas'
import { DEFAULT_POLICY } from '@/shared/agent-canvas'
import { type NextRequest, NextResponse } from 'next/server'

// In-memory policy store (replace with DB in production)
const policyStore = new Map<string, AgentCanvasPolicy>()

/**
 * Alpha auth guard: localhost-only when no AUTH_TOKEN is set; bearer-token
 * check when AUTH_TOKEN IS set. Returns a 401 NextResponse on failure, or
 * `null` on success.
 *
 * Per `docs/ALPHA.md` out-of-scope register: auth-token hardening is deferred
 * to post-alpha. This guard prevents remote unauthenticated access during
 * alpha without introducing a real auth system.
 */
function assertLocalhostOrAuth(req: NextRequest): NextResponse | null {
  const authToken = process.env.AUTH_TOKEN
  if (authToken) {
    const supplied = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
    if (supplied !== authToken) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AuthRequired' }, { status: 401 })
    }
    return null
  }
  // No AUTH_TOKEN — alpha dev mode. Restrict to localhost.
  const host = req.headers.get('host') ?? ''
  const xForwardedFor = req.headers.get('x-forwarded-for')
  const isLocalhost =
    host.startsWith('localhost:') ||
    host.startsWith('127.0.0.1:') ||
    host.startsWith('[::1]:') ||
    host === 'localhost' ||
    host === '127.0.0.1'
  if (!isLocalhost) {
    return NextResponse.json(
      {
        error: 'Remote access requires AUTH_TOKEN. Set AUTH_TOKEN env var or run on localhost.',
        code: 'RemoteAuthRequired',
      },
      { status: 401 },
    )
  }
  // x-forwarded-for presence means we're behind a proxy — be conservative.
  if (
    xForwardedFor &&
    !xForwardedFor
      .split(',')[0]!
      .trim()
      .match(/^(127\.0\.0\.1|::1|localhost)$/)
  ) {
    return NextResponse.json(
      { error: 'Proxy origin not trusted in alpha dev mode', code: 'ProxyOrigin' },
      { status: 401 },
    )
  }
  return null
}

/** Get or create policy for agent+workspace */
async function getPolicy(agentId: string, workspaceId: string): Promise<AgentCanvasPolicy> {
  const key = `${agentId}:${workspaceId}`
  let policy = policyStore.get(key)
  if (!policy) {
    policy = { ...DEFAULT_POLICY, agentId, workspaceId }
    policyStore.set(key, policy)
  }
  return policy
}

export async function POST(req: NextRequest) {
  try {
    const authFail = assertLocalhostOrAuth(req)
    if (authFail) return authFail

    const body = await req.json()
    const { agentId, workspaceId, command } = body as {
      agentId: string
      workspaceId: string
      command: AgentCanvasCommand
    }

    if (!agentId || !workspaceId || !command) {
      return NextResponse.json(
        { error: 'Missing agentId, workspaceId, or command' },
        { status: 400 },
      )
    }

    // Get policy and execute
    const policy = await getPolicy(agentId, workspaceId)
    const executor = createCanvasCommandExecutor(policy)
    const response = await executor.execute(command)

    // Audit log: stdout in alpha (DB-backed audit log deferred per SCOPE.md
    // auth-token out-of-scope). Each command is logged with timestamp, agent,
    // workspace, and command type for forensic review.
    console.log(
      `[audit] agent-canvas-command ${new Date().toISOString()} agent=${agentId} workspace=${workspaceId} cmd=${command.type ?? 'unknown'}`,
    )

    return NextResponse.json(response)
  } catch (error) {
    console.error('[Agent Canvas Command] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const authFail = assertLocalhostOrAuth(req)
    if (authFail) return authFail

    const { searchParams } = new URL(req.url)
    const agentId = searchParams.get('agentId')
    const workspaceId = searchParams.get('workspaceId')

    if (!agentId || !workspaceId) {
      return NextResponse.json({ error: 'Missing agentId or workspaceId' }, { status: 400 })
    }

    const policy = await getPolicy(agentId, workspaceId)
    return NextResponse.json(policy)
  } catch (error) {
    console.error('[Agent Canvas Policy Get] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authFail = assertLocalhostOrAuth(req)
    if (authFail) return authFail

    const body = await req.json()
    const { agentId, workspaceId, policy } = body as {
      agentId: string
      workspaceId: string
      policy: Partial<AgentCanvasPolicy>
    }

    if (!agentId || !workspaceId) {
      return NextResponse.json({ error: 'Missing agentId or workspaceId' }, { status: 400 })
    }

    // Save to store
    const key = `${agentId}:${workspaceId}`
    const existing = policyStore.get(key)
    const updated = { ...existing, ...policy, agentId, workspaceId } as AgentCanvasPolicy
    policyStore.set(key, updated)

    console.log(
      `[audit] agent-canvas-policy-update ${new Date().toISOString()} agent=${agentId} workspace=${workspaceId}`,
    )

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[Agent Canvas Policy Put] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
