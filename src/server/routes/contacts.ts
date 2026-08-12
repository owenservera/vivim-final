// src/server/routes/contacts.ts
// REST API routes for contact management with identity merging.

import { z } from 'zod'
import type { ServerContext } from '../index.js'
import { appErrorResponse, errorResponse, json } from '../response.js'
import { parseRequestBody } from '../validate.js'

export function createContactsRouter(ctx: ServerContext) {
  return async function contactsRouter(req: Request): Promise<Response | undefined> {
    const url = new URL(req.url)
    const path = url.pathname

    const store = (
      ctx as unknown as {
        contactStore?: {
          getContactById(id: string): Promise<unknown>
          getContactsByAccount(accountId: string): Promise<unknown[]>
          getContactByNativeId(
            providerId: string,
            accountId: string,
            providerNativeId: string,
          ): Promise<unknown>
          searchContacts(query: string, accountId?: string): Promise<unknown[]>
          createContact(input: unknown): Promise<unknown>
          updateContact(id: string, updates: unknown): Promise<unknown>
          deleteContact(id: string): Promise<void>
          mergeContacts(
            canonicalId: string,
            mergedId: string,
            method: string,
            confidence: number,
          ): Promise<unknown>
          getMergedContacts(contactId: string): Promise<unknown[]>
        }
      }
    ).contactStore

    if (!store) {
      return errorResponse('ContactStore not available', 'NotAvailable', 503)
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
        const schema = z.object({
          providerId: z.string().min(1, 'providerId is required'),
          accountId: z.string().min(1, 'accountId is required'),
          providerNativeId: z.string().min(1, 'providerNativeId is required'),
          displayName: z.string().min(1, 'displayName is required'),
          username: z.string().optional(),
          avatarUrl: z.string().optional(),
          phoneNumber: z.string().optional(),
          email: z.string().optional(),
          relationship: z.string().optional(),
          notes: z.string().optional(),
          metadataJson: z.string().optional(),
        })
        const parsed = await parseRequestBody(req, schema)
        if (!parsed.success) return parsed.response
        const contact = await store.createContact(parsed.data)
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
        const parsed = await parseRequestBody(req, z.record(z.string(), z.unknown()))
        if (!parsed.success) return parsed.response
        const contact = await store.updateContact(contactMatch[1], parsed.data)
        return json({ contact })
      }

      // DELETE /api/contacts/:id
      if (req.method === 'DELETE' && contactMatch && contactMatch[1]) {
        await store.deleteContact(contactMatch[1])
        return json({ success: true })
      }

      // POST /api/contacts/lookup
      if (req.method === 'POST' && path === '/api/contacts/lookup') {
        const parsed = await parseRequestBody(
          req,
          z.object({
            providerId: z.string().min(1),
            accountId: z.string().min(1),
            providerNativeId: z.string().min(1),
          }),
        )
        if (!parsed.success) return parsed.response
        const contact = await store.getContactByNativeId(
          parsed.data.providerId,
          parsed.data.accountId,
          parsed.data.providerNativeId,
        )
        if (!contact) return errorResponse('Contact not found', 'NotFound', 404)
        return json({ contact })
      }

      // POST /api/contacts/:id/merge
      const mergeMatch = path.match(/^\/api\/contacts\/([^/]+)\/merge$/)
      if (req.method === 'POST' && mergeMatch && mergeMatch[1]) {
        const schema = z.object({
          mergedContactId: z.string().min(1, 'mergedContactId is required'),
          method: z.string().optional(),
          confidence: z.number().min(0).max(1).optional(),
        })
        const parsed = await parseRequestBody(req, schema)
        if (!parsed.success) return parsed.response
        const identity = await store.mergeContacts(
          mergeMatch[1],
          parsed.data.mergedContactId,
          parsed.data.method ?? 'manual',
          parsed.data.confidence ?? 1.0,
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
      return appErrorResponse(err)
    }
  }
}
