// src/server/webhook-router.ts
// WorkflowWebhook router — receive external webhook triggers and fire workflows

import type { WorkflowEngine } from '../engines/workflow-engine.js'
import type { CapStoreDb } from '../storage/db.js'

export interface WebhookStore {
  getWebhookByPath(path: string): Promise<{
    id: string
    workflowId: string
    path: string
    method: string
    active: boolean
    secret: string | null
  } | null>
}

export class WebhookRouter {
  constructor(
    private readonly workflowEngine: WorkflowEngine,
    private readonly db: CapStoreDb,
  ) {}

  async handle(request: Request, path: string): Promise<Response> {
    const webhook = await this.lookupWebhook(path)
    if (!webhook) {
      return new Response(JSON.stringify({ error: 'Webhook not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!webhook.active) {
      return new Response(JSON.stringify({ error: 'Webhook is inactive' }), {
        status: 410,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (webhook.method !== request.method) {
      return new Response(
        JSON.stringify({ error: `Method not allowed (expected ${webhook.method})` }),
        {
          status: 405,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Verify secret if configured
    if (webhook.secret) {
      const headerSig =
        request.headers.get('X-Webhook-Secret') || request.headers.get('X-Signature')
      if (headerSig !== webhook.secret) {
        return new Response(JSON.stringify({ error: 'Invalid secret' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    // Parse body as input
    let input: Record<string, unknown> = {}
    try {
      if (request.method !== 'GET' && request.body) {
        const body = (await request.json()) as Record<string, unknown>
        input = body
      }
    } catch {
      // Non-JSON body is ok — use empty input
    }

    // Execute the workflow
    try {
      const execution = await this.workflowEngine.execute(webhook.workflowId, input)

      return new Response(
        JSON.stringify({
          ok: true,
          executionId: execution.id,
          status: execution.status,
        }),
        {
          status: execution.status === 'failed' ? 500 : 200,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    } catch (err) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }
  }

  private async lookupWebhook(path: string) {
    const row = await this.db.prisma.workflowWebhook.findFirst({
      where: { path, active: true },
    })
    if (!row) return null
    return {
      id: row.id,
      workflowId: row.workflowId,
      path: row.path,
      method: row.method,
      active: row.active,
      secret: row.secret,
    }
  }
}

// Export a route handler for mounting in the server
export function createWebhookRoute(router: WebhookRouter): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    const url = new URL(request.url)
    const path = url.pathname.replace(/^\/api\/webhooks\//, '')
    return router.handle(request, path)
  }
}
