import { ulid } from '@/lib/ulid'
import type { AgentCanvasOp, AgentCanvasPlan } from '@/shared/agent-canvas'
import { type NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/agent/canvas/plan
 * Accepts a natural-language prompt, returns a proposed AgentCanvasPlan.
 * Production: wire to nlcl engine for structured extraction.
 */
export async function POST(req: NextRequest) {
  const parsed = await req.json().catch(() => ({}))
  // [audit] log the error with context here
  const prompt = (parsed.prompt ?? '').toString().trim()

  if (!prompt) {
    return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })
  }

  const traceId = ulid()
  const now = Date.now()

  // Parse the prompt into proposed ops (stub — production wires to nlcl engine).
  const promptLower = prompt.toLowerCase()
  const ops: AgentCanvasOp[] = []

  if (promptLower.includes('competitive analysis') || promptLower.includes('research')) {
    // Spawn 6 research nodes + a synthesis node.
    const researchTopics = [
      'Market Overview',
      'Competitor A',
      'Competitor B',
      'Pricing',
      'SWOT',
      'Synthesis',
    ]
    researchTopics.forEach((title, i) => {
      ops.push({
        id: `op:${traceId}:${i}`,
        type: 'createNode',
        action: 'spawn_node',
        nodeSpec: {
          slotId: 'chat.thread',
          title,
          category: 'chat',
          layout: { x: -400 + (i % 3) * 300, y: -200 + Math.floor(i / 3) * 200, w: 260, h: 160 },
        },
        payload: { title, category: 'chat' },
        status: 'pending',
        createdAt: now + i,
      })
    })
    // Wire them.
    for (let i = 0; i < 5; i++) {
      ops.push({
        id: `op:${traceId}:wire:${i}`,
        type: 'connectNodes',
        action: 'wire',
        payload: { fromNodeId: `agent-node:${traceId}:${i}`, toNodeId: `agent-node:${traceId}:5` },
        status: 'pending',
        createdAt: now + 10 + i,
      })
    }
  } else if (promptLower.includes('summarize') || promptLower.includes('summarise')) {
    ops.push({
      id: `op:${traceId}:0`,
      type: 'runLayout',
      action: 'layout',
      payload: {
        summary:
          'I would summarize the visible canvas region and create a synthesis node with the key findings.',
      },
      status: 'pending',
      createdAt: now,
    })
  } else {
    // Default: spawn a single chat node.
    ops.push({
      id: `op:${traceId}:0`,
      type: 'createNode',
      action: 'spawn_node',
      nodeSpec: {
        slotId: 'chat.thread',
        title: `Agent: ${prompt.slice(0, 40)}`,
        category: 'chat',
        layout: { x: -160, y: -100, w: 320, h: 200 },
      },
      payload: { title: `Agent: ${prompt.slice(0, 40)}`, category: 'chat' },
      status: 'pending',
      createdAt: now,
    })
  }

  const plan: AgentCanvasPlan = {
    id: `plan:${traceId}`,
    traceId,
    prompt,
    agentId: 'agent:default',
    workspaceId: 'ws:global',
    ops,
    status: 'proposed',
    createdAt: now,
  }

  return NextResponse.json({ ok: true, plan })
}
