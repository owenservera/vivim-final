// src/server/routes/users.ts
// REST API routes for user identity management (CAP-003).

import { z } from 'zod'
import type { ServerContext } from '../index.js'
import { appErrorResponse, errorResponse, json } from '../response.js'

export function createUserRouter(ctx: ServerContext) {
  return async function userRouter(req: Request): Promise<Response | undefined> {
    const url = new URL(req.url)
    const path = url.pathname

    if (!ctx.userIdentity) {
      return errorResponse('UserIdentityEngine not available', 'NotAvailable', 503)
    }

    try {
      // GET /api/users/current
      if (req.method === 'GET' && path === '/api/users/current') {
        const user = await ctx.userIdentity.getCurrentUser()
        if (!user) return json({ user: null })
        return json({ user })
      }

      // GET /api/users — list profiles
      if (req.method === 'GET' && path === '/api/users') {
        const users = await ctx.userIdentity.listProfiles()
        return json({ users, count: users.length })
      }

      // POST /api/users — create profile
      if (req.method === 'POST' && path === '/api/users') {
        const schema = z.object({
          name: z.string().min(1, 'name is required'),
          avatarColor: z.string().optional(),
        })
        const parsed = schema.safeParse(await req.json())
        if (!parsed.success) return errorResponse(parsed.error.message, 'ValidationError', 400)
        const user = await ctx.userIdentity.createProfile(parsed.data.name, {
          avatarColor: parsed.data.avatarColor,
        })
        return json({ user }, 201)
      }

      // POST /api/users/switch — switch active profile
      if (req.method === 'POST' && path === '/api/users/switch') {
        const schema = z.object({ userId: z.string().min(1, 'userId is required') })
        const parsed = schema.safeParse(await req.json())
        if (!parsed.success) return errorResponse(parsed.error.message, 'ValidationError', 400)
        const result = await ctx.userIdentity.switchProfile(parsed.data.userId)
        return json(result)
      }

      // PATCH /api/users/:id — update profile
      const userMatch = path.match(/^\/api\/users\/([^/]+)$/)
      if (req.method === 'PATCH' && userMatch && userMatch[1]) {
        const userId = userMatch[1]
        const schema = z.object({
          displayName: z.string().optional(),
          avatarColor: z.string().optional(),
          avatarUrl: z.string().nullable().optional(),
        })
        const parsed = schema.safeParse(await req.json())
        if (!parsed.success) return errorResponse(parsed.error.message, 'ValidationError', 400)
        await ctx.userIdentity.updateProfile(userId, parsed.data)
        const updated = await ctx.userIdentity.getProfile(userId)
        return json({ user: updated })
      }

      // DELETE /api/users/:id — delete profile (soft)
      if (req.method === 'DELETE' && userMatch && userMatch[1]) {
        const userId = userMatch[1]
        await ctx.userIdentity.deleteProfile(userId)
        return json({ ok: true })
      }

      // PATCH /api/users/:id/role — set role (admin/dev only)
      const roleMatch = path.match(/^\/api\/users\/([^/]+)\/role$/)
      if (req.method === 'PATCH' && roleMatch && roleMatch[1]) {
        const userId = roleMatch[1]
        const body = (await req.json()) as { role?: string }
        if (!body.role || !['member', 'admin', 'developer'].includes(body.role)) {
          return errorResponse('role must be member, admin, or developer', 'ValidationError', 400)
        }
        await ctx.userIdentity.setRole(userId, body.role as 'member' | 'admin' | 'developer')
        return json({ ok: true, userId, role: body.role })
      }
    } catch (err) {
      return appErrorResponse(err)
    }

    return undefined
  }
}
