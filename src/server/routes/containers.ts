// src/server/routes/containers.ts
// REST API routes for entity container management.

import type { ServerContext } from '../index.js'
import { errorResponse, json } from '../response.js'

export function createContainersRouter(ctx: ServerContext) {
  return async function containersRouter(req: Request): Promise<Response | undefined> {
    const url = new URL(req.url)
    const path = url.pathname

    const store = (ctx as unknown as { containerStore?: {
      getContainerById(id: string): Promise<unknown>
      listContainers(query: unknown): Promise<unknown[]>
      createContainer(input: unknown): Promise<unknown>
      updateContainer(id: string, updates: unknown): Promise<unknown>
      deleteContainer(id: string): Promise<void>
      getMemberships(containerId: string): Promise<unknown[]>
      addMembership(input: unknown): Promise<unknown>
      removeMembership(containerId: string, userRole: string): Promise<void>
    }}).containerStore

    if (!store) {
      return errorResponse('ContainerStore not available', 'EngineUnavailable', 503)
    }

    try {
      // GET /api/containers
      if (req.method === 'GET' && path === '/api/containers') {
        const type = url.searchParams.get('type') ?? undefined
        const providerId = url.searchParams.get('providerId') ?? undefined
        const accountId = url.searchParams.get('accountId') ?? undefined
        const containers = await store.listContainers({ type, providerId, accountId })
        return json({ containers, count: (containers as unknown[]).length })
      }

      // POST /api/containers
      if (req.method === 'POST' && path === '/api/containers') {
        const body = (await req.json()) as {
          providerId?: string
          accountId?: string
          containerType?: string
          providerNativeId?: string
          name?: string
          description?: string
          iconUrl?: string
          metadataJson?: string
          parentContainerId?: string
        }
        if (!body.name || typeof body.name !== 'string') {
          return errorResponse('name is required', 'ValidationError', 400)
        }
        if (!body.containerType || typeof body.containerType !== 'string') {
          return errorResponse('containerType is required', 'ValidationError', 400)
        }
        if (!body.providerId || typeof body.providerId !== 'string') {
          return errorResponse('providerId is required', 'ValidationError', 400)
        }
        if (!body.accountId || typeof body.accountId !== 'string') {
          return errorResponse('accountId is required', 'ValidationError', 400)
        }
        if (!body.providerNativeId || typeof body.providerNativeId !== 'string') {
          return errorResponse('providerNativeId is required', 'ValidationError', 400)
        }
        const container = await store.createContainer(body)
        return json({ container }, 201)
      }

      // GET /api/containers/:id
      const containerMatch = path.match(/^\/api\/containers\/([^/]+)$/)
      if (req.method === 'GET' && containerMatch && containerMatch[1]) {
        const container = await store.getContainerById(containerMatch[1])
        if (!container) return errorResponse('Container not found', 'NotFound', 404)
        return json({ container })
      }

      // PUT /api/containers/:id
      if (req.method === 'PUT' && containerMatch && containerMatch[1]) {
        const body = (await req.json()) as Record<string, unknown>
        const container = await store.updateContainer(containerMatch[1], body)
        return json({ container })
      }

      // DELETE /api/containers/:id
      if (req.method === 'DELETE' && containerMatch && containerMatch[1]) {
        await store.deleteContainer(containerMatch[1])
        return json({ success: true })
      }

      // GET /api/containers/:id/members
      const membersMatch = path.match(/^\/api\/containers\/([^/]+)\/members$/)
      if (req.method === 'GET' && membersMatch && membersMatch[1]) {
        const memberships = await store.getMemberships(membersMatch[1])
        return json({ memberships, count: (memberships as unknown[]).length })
      }

      // POST /api/containers/:id/members
      if (req.method === 'POST' && membersMatch && membersMatch[1]) {
        const body = (await req.json()) as {
          userRole?: string
          notificationPreference?: string
          isFavorite?: number
        }
        const membership = await store.addMembership({
          containerId: membersMatch[1],
          userRole: body.userRole ?? 'member',
          notificationPreference: body.notificationPreference ?? 'all',
          isFavorite: body.isFavorite ?? 0,
        })
        return json({ membership }, 201)
      }

      // DELETE /api/containers/:id/members/:userRole
      const memberMatch = path.match(/^\/api\/containers\/([^/]+)\/members\/([^/]+)$/)
      if (req.method === 'DELETE' && memberMatch && memberMatch[1] && memberMatch[2]) {
        await store.removeMembership(memberMatch[1], decodeURIComponent(memberMatch[2]))
        return json({ success: true })
      }

      return undefined
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return errorResponse(message, 'InternalError', 500)
    }
  }
}
