// src/server/routes/containers.ts
// REST API routes for entity container management.

import { z } from 'zod'
import type { ServerContext } from '../index.js'
import { appErrorResponse, errorResponse, json } from '../response.js'
import { parseRequestBody } from '../validate.js'

export function createContainersRouter(ctx: ServerContext) {
  return async function containersRouter(req: Request): Promise<Response | undefined> {
    const url = new URL(req.url)
    const path = url.pathname

    const store = (
      ctx as unknown as {
        containerStore?: {
          getContainerById(id: string): Promise<unknown>
          listContainers(query: unknown): Promise<unknown[]>
          createContainer(input: unknown): Promise<unknown>
          updateContainer(id: string, updates: unknown): Promise<unknown>
          deleteContainer(id: string): Promise<void>
          getMemberships(containerId: string): Promise<unknown[]>
          addMembership(input: unknown): Promise<unknown>
          removeMembership(containerId: string, userRole: string): Promise<void>
        }
      }
    ).containerStore

    if (!store) {
      return errorResponse('ContainerStore not available', 'NotAvailable', 503)
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
        const schema = z.object({
          providerId: z.string().min(1, 'providerId is required'),
          accountId: z.string().min(1, 'accountId is required'),
          containerType: z.string().min(1, 'containerType is required'),
          providerNativeId: z.string().min(1, 'providerNativeId is required'),
          name: z.string().min(1, 'name is required'),
          description: z.string().optional(),
          iconUrl: z.string().optional(),
          metadataJson: z.string().optional(),
          parentContainerId: z.string().optional(),
        })
        const parsed = await parseRequestBody(req, schema)
        if (!parsed.success) return parsed.response
        const container = await store.createContainer(parsed.data)
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
        const parsed = await parseRequestBody(req, z.record(z.string(), z.unknown()))
        if (!parsed.success) return parsed.response
        const container = await store.updateContainer(containerMatch[1], parsed.data)
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
        const parsed = await parseRequestBody(
          req,
          z.object({
            userRole: z.string().optional(),
            notificationPreference: z.string().optional(),
            isFavorite: z.number().optional(),
          }),
        )
        if (!parsed.success) return parsed.response
        const membership = await store.addMembership({
          containerId: membersMatch[1],
          userRole: parsed.data.userRole ?? 'member',
          notificationPreference: parsed.data.notificationPreference ?? 'all',
          isFavorite: parsed.data.isFavorite ?? 0,
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
      return appErrorResponse(err)
    }
  }
}
