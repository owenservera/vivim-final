// src/server/autonomous-router.ts
// REST API for autonomous task execution and observability

import type { AutonomousExecutionEngine, AutonomousGoal } from '../engines/autonomous-execution.js'
import type { ExecutionPolicyEngine } from '../engines/execution-policy.js'

export interface AutonomousRouterDeps {
  autonomousEngine: AutonomousExecutionEngine
  policyEngine: ExecutionPolicyEngine
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function error(message: string, status = 400): Response {
  return json({ error: message }, status)
}

export function createAutonomousRouter(deps: AutonomousRouterDeps) {
  const { autonomousEngine } = deps

  return async function handleAutonomousRoute(req: Request, url: URL): Promise<Response | null> {
    const path = url.pathname

    // POST /api/autonomous/execute
    if (path === '/api/autonomous/execute' && req.method === 'POST') {
      const body = (await req.json()) as { goal: AutonomousGoal }
      if (!body.goal?.description) return error('goal.description is required')
      const task = await autonomousEngine.execute(body.goal)
      return json({ taskId: task.id, status: task.status })
    }

    // GET /api/autonomous/tasks
    if (path === '/api/autonomous/tasks' && req.method === 'GET') {
      const status = url.searchParams.get('status') ?? undefined
      const limit = Number.parseInt(url.searchParams.get('limit') ?? '50', 10)
      const tasks = await autonomousEngine.listTasks({ status, limit })
      return json({
        tasks: tasks.map((t) => ({
          id: t.id,
          status: t.status,
          goal: t.goal.description,
          startedAt: t.startedAt,
          completedAt: t.completedAt,
        })),
      })
    }

    // GET /api/autonomous/gates
    if (path === '/api/autonomous/gates' && req.method === 'GET') {
      const gates = await autonomousEngine.getPendingGates()
      return json({ gates })
    }

    // POST /api/autonomous/gates/:id/resolve
    const gateResolveMatch = path.match(/^\/api\/autonomous\/gates\/([^/]+)\/resolve$/)
    if (gateResolveMatch && req.method === 'POST') {
      const gateId = gateResolveMatch[1] ?? ''
      const body = (await req.json()) as { response: string; resolvedBy: string }
      if (!body.response || !body.resolvedBy) return error('response and resolvedBy are required')
      await autonomousEngine.resolveGate(gateId, body.response, body.resolvedBy)
      return json({ ok: true, gateId, response: body.response })
    }

    // GET /api/autonomous/status/:id
    const statusMatch = path.match(/^\/api\/autonomous\/status\/([^/]+)$/)
    if (statusMatch && req.method === 'GET') {
      const task = await autonomousEngine.getStatus(statusMatch[1] ?? '')
      if (!task) return error('Task not found', 404)
      return json({ task })
    }

    // POST /api/autonomous/:id/cancel
    const cancelMatch = path.match(/^\/api\/autonomous\/([^/]+)\/cancel$/)
    if (cancelMatch && req.method === 'POST') {
      const taskId = cancelMatch[1] ?? ''
      await autonomousEngine.cancel(taskId)
      return json({ ok: true, taskId })
    }

    // POST /api/autonomous/:id/replay
    const replayMatch = path.match(/^\/api\/autonomous\/([^/]+)\/replay$/)
    if (replayMatch && req.method === 'POST') {
      const body = (await req.json().catch(() => ({}))) as { fromStep?: string }
      const task = await autonomousEngine.replay(replayMatch[1] ?? '', body.fromStep)
      return json({ taskId: task.id, status: task.status })
    }

    // GET /api/autonomous/:id/trace
    const traceMatch = path.match(/^\/api\/autonomous\/([^/]+)\/trace$/)
    if (traceMatch && req.method === 'GET') {
      const task = await autonomousEngine.getStatus(traceMatch[1] ?? '')
      if (!task) return error('Task not found', 404)
      const trace = task.steps.map((s) => ({
        stepId: s.id,
        stepIndex: s.stepIndex,
        action: s.action,
        classification: s.classification,
        status: s.status,
        startedAt: s.startedAt,
        completedAt: s.completedAt,
        error: s.error,
        result: s.result,
      }))
      return json({ taskId: task.id, trace })
    }

    // Not matched
    return null
  }
}
