/**
 * app/api/agent/canvas/command/route.ts
 * --------------------------------------------------------------------
 * POST endpoint for agents to issue canvas commands.
 * Validates policy, executes via CanvasCommandExecutor, returns response.
 */

import { createCanvasCommandExecutor } from '@/engines/canvas-command-executor'
import type { AgentCanvasCommand, AgentCanvasPolicy } from '@/shared/agent-canvas'
import { DEFAULT_POLICY } from '@/shared/agent-canvas'
import { type NextRequest, NextResponse } from 'next/server'

// In-memory policy store (replace with DB in production)
const policyStore = new Map<string, AgentCanvasPolicy>()

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
    // TODO: Add proper auth when session is available
    // const session = await getServerSession();
    // if (!session?.user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

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

    // TODO: Audit log when DB is available
    // await db.agentCanvasAuditLog.create({ ... });

    return NextResponse.json(response)
  } catch (error) {
    console.error('[Agent Canvas Command] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    // TODO: Add proper auth
    // const session = await getServerSession();
    // if (!session?.user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

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
    // TODO: Add proper auth
    // const session = await getServerSession();
    // if (!session?.user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

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

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[Agent Canvas Policy Put] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
