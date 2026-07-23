/**
 * app/api/agent/canvas/route.ts (V6 #2)
 * --------------------------------------------------------------------
 * POST /api/agent/canvas — Agent Canvas Co-Pilot.
 *
 * Accepts a natural-language prompt, returns an AgentCanvasPlan with
 * proposed ops (spawn_node, wire, arrange_cluster, summarize_region).
 * The canvas renders these as ghost overlays; user accepts/rejects (HITL).
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getEngineBag, isSeeded, markSeeded } from '@/lib/canvas-engine-bootstrap';
import { seedCanvasModel } from '@/lib/seed-canvas-model';
import { ulid } from '@/lib/ulid';
import type { AgentCanvasPlan, AgentCanvasOp } from '@/shared/agent-canvas';

const SCHEMA = z.object({
  prompt: z.string(),
  workspaceId: z.string().default('ws:global'),
});

export async function POST(req: Request) {
  const body = (await req.json()) as unknown;
  const parsed = SCHEMA.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });

  const bag = getEngineBag();
  if (!isSeeded()) { await seedCanvasModel(bag); markSeeded(); }

  const traceId = ulid();
  const now = Date.now();

  // Parse the prompt into proposed ops (stub — production wires to nlcl engine).
  const prompt = parsed.data.prompt.toLowerCase();
  const ops: AgentCanvasOp[] = [];

  if (prompt.includes('competitive analysis') || prompt.includes('research')) {
    // Spawn 6 research nodes + a synthesis node.
    const researchTopics = ['Market Overview', 'Competitor A', 'Competitor B', 'Pricing', 'SWOT', 'Synthesis'];
    researchTopics.forEach((title, i) => {
      ops.push({
        id: `op:${traceId}:${i}`,
        action: 'spawn_node',
        nodeId: `agent-node:${traceId}:${i}`,
        nodeSpec: {
          slotId: 'chat.thread',
          title,
          category: 'chat',
          layout: { x: -400 + (i % 3) * 300, y: -200 + Math.floor(i / 3) * 200, w: 260, h: 160 },
        },
        status: 'pending',
        timestamp: now + i,
      });
    });
    // Wire them.
    for (let i = 0; i < 5; i++) {
      ops.push({
        id: `op:${traceId}:wire:${i}`,
        action: 'wire',
        nodeId: `agent-node:${traceId}:${i}`,
        targetNodeId: `agent-node:${traceId}:5`,
        connectionSpec: { fromPort: 'output', toPort: 'input', type: 'data' },
        status: 'pending',
        timestamp: now + 10 + i,
      });
    }
  } else if (prompt.includes('summarize') || prompt.includes('summarise')) {
    ops.push({
      id: `op:${traceId}:0`,
      action: 'summarize_region',
      nodeId: `agent-summary:${traceId}`,
      summary: 'I would summarize the visible canvas region and create a synthesis node with the key findings.',
      status: 'pending',
      timestamp: now,
    });
  } else {
    // Default: spawn a single chat node.
    ops.push({
      id: `op:${traceId}:0`,
      action: 'spawn_node',
      nodeId: `agent-node:${traceId}:0`,
      nodeSpec: {
        slotId: 'chat.thread',
        title: `Agent: ${parsed.data.prompt.slice(0, 40)}`,
        category: 'chat',
        layout: { x: -160, y: -100, w: 320, h: 200 },
      },
      status: 'pending',
      timestamp: now,
    });
  }

  const plan: AgentCanvasPlan = {
    id: `plan:${traceId}`,
    traceId,
    prompt: parsed.data.prompt,
    ops,
    status: 'pending',
    createdAt: now,
  };

  return NextResponse.json({ ok: true, plan });
}
