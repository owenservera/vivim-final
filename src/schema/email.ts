// src/schema/email.ts
// Email node types for the second brain.

import { z } from 'zod'

// ── EmailNode (cap-store.email) ───────────────────────────────────────────
// Full email with headers, body, attachments, threading.

export interface EmailData {
  messageId: string
  subject: string
  from: { name?: string; address: string }
  to: Array<{ name?: string; address: string }>
  cc?: Array<{ name?: string; address: string }>
  bcc?: Array<{ name?: string; address: string }>
  body: string
  bodyType: 'plain' | 'html' | 'markdown'
  headers?: Record<string, string>
  attachments?: Array<{
    filename: string
    mediaType: string
    size?: number
    nodeId?: string
  }>
  threadId?: string
  inReplyTo?: string
  references?: string[]
  receivedAt: number
  labels?: string[]
  folder?: string
  read?: boolean
}

export const EmailAddressSchema = z.object({
  name: z.string({ error: 'Invalid string' }).optional(),
  address: z.string({ error: 'Invalid string' }).email(),
})

export const EmailAttachmentSchema = z.object({
  filename: z.string({ error: 'Invalid string' }),
  mediaType: z.string({ error: 'Invalid string' }),
  size: z.number({ error: 'Invalid number' }).int().positive().optional(),
  nodeId: z.string({ error: 'Invalid string' }).optional(),
})

export const EmailDataSchema = z.object({
  messageId: z.string({ error: 'Invalid string' }),
  subject: z.string({ error: 'Invalid string' }),
  from: EmailAddressSchema,
  to: z.array(EmailAddressSchema),
  cc: z.array(EmailAddressSchema).optional(),
  bcc: z.array(EmailAddressSchema).optional(),
  body: z.string({ error: 'Invalid string' }),
  bodyType: z.enum(['plain', 'html', 'markdown']),
  headers: z.record(z.string(), z.string({ error: 'Invalid string' })).optional(),
  attachments: z.array(EmailAttachmentSchema).optional(),
  threadId: z.string({ error: 'Invalid string' }).optional(),
  inReplyTo: z.string({ error: 'Invalid string' }).optional(),
  references: z.array(z.string({ error: 'Invalid string' })).optional(),
  receivedAt: z.number({ error: 'Invalid number' }),
  labels: z.array(z.string({ error: 'Invalid string' })).optional(),
  folder: z.string({ error: 'Invalid string' }).optional(),
  read: z.boolean({ error: 'Invalid boolean' }).optional(),
})

// ── EmailThreadNode (cap-store.email-thread) ──────────────────────────────
// Groups emails by thread.

export interface EmailThreadData {
  threadId: string
  subject: string
  participants: string[]
  emailIds: string[]
  latestAt: number
  messageCount: number
  labels?: string[]
}

export const EmailThreadDataSchema = z.object({
  threadId: z.string({ error: 'Invalid string' }),
  subject: z.string({ error: 'Invalid string' }),
  participants: z.array(z.string({ error: 'Invalid string' })),
  emailIds: z.array(z.string({ error: 'Invalid string' })),
  latestAt: z.number({ error: 'Invalid number' }),
  messageCount: z.number({ error: 'Invalid number' }).int().positive(),
  labels: z.array(z.string({ error: 'Invalid string' })).optional(),
})

// ── Node schemas for registration ─────────────────────────────────────────

export const emailNodeSchema = {
  type: 'cap-store.email' as const,
  version: 1,
  schema: EmailDataSchema,
  indexContent: (data: EmailData) => `${data.subject}\n${data.body}`,
  embeddingText: (data: EmailData) => `${data.subject}\n${data.body}`,
}

export const emailThreadNodeSchema = {
  type: 'cap-store.email-thread' as const,
  version: 1,
  schema: EmailThreadDataSchema,
  indexContent: (data: EmailThreadData) => `${data.subject} ${data.participants.join(' ')}`,
  embeddingText: (data: EmailThreadData) => data.subject,
}
