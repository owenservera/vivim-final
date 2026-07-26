/**
 * src/server/agent-canvas-router.ts
 * --------------------------------------------------------------------
 * Router for agent ↔ canvas command bridge (P4 Agent-Composable).
 * Handles POST /api/agent/canvas/command, GET/PUT /api/agent/canvas/policy
 */

import { ulid } from 'ulid'
import type {
  AgentCanvasCommand,
  AgentCanvasPolicy,
} from '../shared/agent-canvas.js'
import { DEFAULT_POLICY } from '../shared/agent-canvas.js'
import { getLogger } from '../lib/logger.js'
import type { ServerContext } from './index.js'

const log = getLogger('agent-canvas-router')
import { errorResponse, json } from './response.js'

// In-memory policy store (replace with DB in production)
const policyStore = new Map<string, AgentCanvasPolicy>()

function policyKey(agentId: string, workspaceId: string): string {
  return `${agentId}:${workspaceId}`
}

async function getPolicy(agentId: string, workspaceId: string): Promise<AgentCanvasPolicy> {
  const key = policyKey(agentId, workspaceId)
  let policy = policyStore.get(key)
  if (!policy) {
    policy = { ...DEFAULT_POLICY, agentId, workspaceId }
    policyStore.set(key, policy)
  }
  return policy
}

export function createAgentCanvasRouter(_ctx: ServerContext) {
  return async function agentCanvasRouter(req: Request, url: URL): Promise<Response | null> {
    // POST /api/agent/canvas/command — execute agent canvas command
    if (url.pathname === '/api/agent/canvas/command' && req.method === 'POST') {
      try {
        const body = await req.json()
        const { agentId, workspaceId, command } = body as {
          agentId: string
          workspaceId: string
          command: AgentCanvasCommand
        }

        if (!agentId || !workspaceId || !command) {
          return errorResponse('Missing agentId, workspaceId, or command', 'VALIDATION_ERROR', 400)
        }

        // Canvas commands require the browser EventBus — the server cannot execute them directly.
        // Frontend should call /api/agent/canvas/command via the Next.js rewrite (see frontend/src/app/api/agent/canvas/command/route.ts)
        // which forwards to this endpoint, and the canvas executor runs on the client.
        return json({ type: 'canvas.error', payload: { code: 'SERVER_EXECUTOR_UNAVAILABLE', message: 'Canvas commands must be executed via the frontend canvas executor. The server does not have access to the browser EventBus.' } }, 501)
      } catch (err) {
        log.error({ err }, '[AgentCanvasRouter] Error executing command')
        return errorResponse('Internal server error', 'INTERNAL_ERROR', 500)
      }
    }

    // GET /api/agent/canvas/policy?agentId=...&workspaceId=...
    if (url.pathname === '/api/agent/canvas/policy' && req.method === 'GET') {
      const agentId = url.searchParams.get('agentId')
      const workspaceId = url.searchParams.get('workspaceId')

      if (!agentId || !workspaceId) {
        return errorResponse('Missing agentId or workspaceId', 'VALIDATION_ERROR', 400)
      }

      const policy = await getPolicy(agentId, workspaceId)
      return json(policy)
    }

    // PUT /api/agent/canvas/policy — update agent canvas policy
    if (url.pathname === '/api/agent/canvas/policy' && req.method === 'PUT') {
      try {
        const body = await req.json()
        const { agentId, workspaceId, policy } = body as {
          agentId: string
          workspaceId: string
          policy: Partial<AgentCanvasPolicy>
        }

        if (!agentId || !workspaceId) {
          return errorResponse('Missing agentId or workspaceId', 'VALIDATION_ERROR', 400)
        }

        const key = policyKey(agentId, workspaceId)
        const existing = policyStore.get(key) ?? { ...DEFAULT_POLICY, agentId, workspaceId }
        const updated = { ...existing, ...policy, agentId, workspaceId }
        policyStore.set(key, updated)

        return json(updated)
      } catch (err) {
        log.error({ err }, '[AgentCanvasRouter] Error updating policy')
        return errorResponse('Internal server error', 'INTERNAL_ERROR', 500)
      }
    }

    // POST /api/agent/canvas/plan — natural language → canvas plan
    if (url.pathname === '/api/agent/canvas/plan' && req.method === 'POST') {
      try {
        const body = (await req.json()) as Record<string, unknown>
        const prompt = (body.prompt ?? '').toString().trim()

        if (!prompt) {
          return errorResponse('Missing prompt', 'VALIDATION_ERROR', 400)
        }

        // TODO: Wire to NLCL engine for structured extraction
        // For now, return a stub plan based on keyword matching
        const promptLower = prompt.toLowerCase()
        const traceId = ulid()
        const now = Date.now()
        const ops = []

        if (promptLower.includes('competitive analysis') || promptLower.includes('research')) {
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
                layout: {
                  x: -400 + (i % 3) * 300,
                  y: -200 + Math.floor(i / 3) * 200,
                  w: 260,
                  h: 160,
                },
              },
              payload: { title, category: 'chat' },
              status: 'pending',
              createdAt: now + i,
            })
          })
          // Wire them to synthesis
          for (let i = 0; i < 5; i++) {
            ops.push({
              id: `op:${traceId}:wire:${i}`,
              type: 'connectNodes',
              action: 'wire',
              payload: {
                fromNodeId: `agent-node:${traceId}:${i}`,
                toNodeId: `agent-node:${traceId}:5`,
              },
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
          // Default: spawn a single chat node
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

        const plan = {
          id: `plan:${traceId}`,
          traceId,
          prompt,
          ops,
          status: 'proposed',
          createdAt: now,
        }

        return json({ ok: true, plan })
      } catch (err) {
        log.error({ err }, '[AgentCanvasRouter] Error creating plan')
        return errorResponse('Internal server error', 'INTERNAL_ERROR', 500)
      }
    }

    return null
  }
}
