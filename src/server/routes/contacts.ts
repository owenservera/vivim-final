// src/server/routes/contacts.ts
// REST API routes for contact management with identity merging.

import type { ServerContext } from '../index.js'
import { errorResponse, json } from '../response.js'

export function createContactsRouter(ctx: ServerContext) {
  return async function contactsRouter(req: Request): Promise<Response | undefined> {
    const url = new URL(req.url)
    const path = url.pathname

    const store = (ctx as unknown as { contactStore?: {
      getContactById(id: string): Promise<unknown>
      getContactsByAccount(accountId: string): Promise<unknown[]>
      getContactByNativeId(providerId: string, accountId: string, providerNativeId: string): Promise<unknown>
      searchContacts(query: string, accountId?: string): Promise<unknown[]>
      createContact(input: unknown): Promise<unknown>
      updateContact(id: string, updates: unknown): Promise<unknown>
      deleteContact(id: string): Promise<void>
      mergeContacts(canonicalId: string, mergedId: string, method: string, confidence: number): Promise<unknown>
      getMergedContacts(contactId: string): Promise<unknown[]>
    }}).contactStore

    if (!store) {
      return errorResponse('ContactStore not available', 'EngineUnavailable', 503)
    }

    try {
      // GET /api/contacts/search
      if (req.method === 'GET' && path === '/api/contacts/search') {
        const q = url.searchParams.get('q') ?? ''
        const accountId = url.searchParams.get('accountId') ?? undefined
        const contacts = await store.searchContacts(q, accountId)
        return json({ contacts, count: (contacts as unknown[]).length })
      }

      // GET /api/contacts
      if (req.method === 'GET' && path === '/api/contacts') {
        const accountId = url.searchParams.get('accountId') ?? undefined
        if (!accountId) return errorResponse('accountId is required', 'ValidationError', 400)
        const contacts = await store.getContactsByAccount(accountId)
        return json({ contacts, count: (contacts as unknown[]).length })
      }

      // POST /api/contacts
      if (req.method === 'POST' && path === '/api/contacts') {
        const body = (await req.json()) as {
          providerId?: string
          accountId?: string
          providerNativeId?: string
          displayName?: string
          username?: string
          avatarUrl?: string
          phoneNumber?: string
          email?: string
          relationship?: string
          notes?: string
          metadataJson?: string
        }
        if (!body.displayName || typeof body.displayName !== 'string') {
          return errorResponse('displayName is required', 'ValidationError', 400)
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
        const contact = await store.createContact(body)
        return json({ contact }, 201)
      }

      // GET /api/contacts/:id
      const contactMatch = path.match(/^\/api\/contacts\/([^/]+)$/)
      if (req.method === 'GET' && contactMatch && contactMatch[1]) {
        const contact = await store.getContactById(contactMatch[1])
        if (!contact) return errorResponse('Contact not found', 'NotFound', 404)
        return json({ contact })
      }

      // PUT /api/contacts/:id
      if (req.method === 'PUT' && contactMatch && contactMatch[1]) {
        const body = (await req.json()) as Record<string, unknown>
        const contact = await store.updateContact(contactMatch[1], body)
        return json({ contact })
      }

      // DELETE /api/contacts/:id
      if (req.method === 'DELETE' && contactMatch && contactMatch[1]) {
        await store.deleteContact(contactMatch[1])
        return json({ success: true })
      }

      // POST /api/contacts/lookup
      if (req.method === 'POST' && path === '/api/contacts/lookup') {
        const body = (await req.json()) as { providerId?: string; accountId?: string; providerNativeId?: string }
        if (!body.providerId || !body.accountId || !body.providerNativeId) {
          return errorResponse('providerId, accountId, and providerNativeId are required', 'ValidationError', 400)
        }
        const contact = await store.getContactByNativeId(body.providerId, body.accountId, body.providerNativeId)
        if (!contact) return errorResponse('Contact not found', 'NotFound', 404)
        return json({ contact })
      }

      // POST /api/contacts/:id/merge
      const mergeMatch = path.match(/^\/api\/contacts\/([^/]+)\/merge$/)
      if (req.method === 'POST' && mergeMatch && mergeMatch[1]) {
        const body = (await req.json()) as { mergedContactId?: string; method?: string; confidence?: number }
        if (!body.mergedContactId || typeof body.mergedContactId !== 'string') {
          return errorResponse('mergedContactId is required', 'ValidationError', 400)
        }
        const identity = await store.mergeContacts(
          mergeMatch[1],
          body.mergedContactId,
          body.method ?? 'manual',
          body.confidence ?? 1.0,
        )
        return json({ identity }, 201)
      }

      // GET /api/contacts/:id/merged
      const mergedMatch = path.match(/^\/api\/contacts\/([^/]+)\/merged$/)
      if (req.method === 'GET' && mergedMatch && mergedMatch[1]) {
        const merged = await store.getMergedContacts(mergedMatch[1])
        return json({ merged, count: (merged as unknown[]).length })
      }

      return undefined
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return errorResponse(message, 'InternalError', 500)
    }
  }
}
