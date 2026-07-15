// src/engines/send-capability.ts
// Phase 28.5 — Send capability for email and messaging

import type {
  CapabilityContext,
  UnifiedCapability,
  UnifiedCapabilityRegistry,
} from './unified-registry.js'

export interface SendDeps {
  smtp?: {
    send: (opts: { to: string[]; subject: string; body: string; from?: string }) => Promise<{
      messageId: string
    }>
  }
  mux?: {
    sendMessage: (opts: { channelId: string; text: string }) => Promise<{ sent: boolean }>
  }
}

function makeSendCap(
  partial: Omit<
    UnifiedCapability,
    'surfaces' | 'isAsync' | 'requiresConfirmation' | 'tags' | 'handler'
  > & { requiresConfirmation?: boolean },
  handler: UnifiedCapability['handler'],
): UnifiedCapability {
  return {
    ...partial,
    surfaces: ['cli', 'ui', 'api', 'mcp', 'workflow'],
    handler,
    isAsync: true,
    requiresConfirmation: partial.requiresConfirmation ?? false,
    tags: ['send', 'communication'],
  }
}

export function registerSendCaps(registry: UnifiedCapabilityRegistry, deps: SendDeps): void {
  // cap:email:send
  registry.register(
    makeSendCap(
      {
        id: 'cap:email:send',
        slug: 'email_send',
        name: 'Send Email',
        description: 'Send an email via SMTP.',
        category: 'communication',
        inputSchema: {
          type: 'object',
          properties: {
            to: { type: 'array', items: { type: 'string' } },
            subject: { type: 'string' },
            body: { type: 'string' },
            from: { type: 'string' },
          },
          required: ['to', 'subject', 'body'],
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'email send',
          aliases: ['esend'],
          examples: ['email send --to user@example.com --subject "Hello" --body "World"'],
        },
        ui: { component: 'action-button', position: 'composer', order: 30 },
        mcpToolName: 'email_send',
        apiEndpoint: { method: 'POST', path: '/api/email/send' },
        requiresConfirmation: false,
      },
      async (input: Record<string, unknown>, _ctx: CapabilityContext) => {
        const { to, subject, body, from } = input as {
          to: string[]
          subject: string
          body: string
          from?: string
        }

        if (!deps.smtp) {
          return { ok: false, clarification: 'Configure SMTP settings to enable email sending' }
        }

        const result = await deps.smtp.send({ to, subject, body, from })
        return { ok: true, sent: true, messageId: result.messageId }
      },
    ),
  )

  // cap:message:send
  registry.register(
    makeSendCap(
      {
        id: 'cap:message:send',
        slug: 'message_send',
        name: 'Send Message',
        description: 'Send a message to a channel.',
        category: 'communication',
        inputSchema: {
          type: 'object',
          properties: {
            channelId: { type: 'string' },
            text: { type: 'string' },
          },
          required: ['channelId', 'text'],
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'message send',
          aliases: ['msend'],
          examples: ['message send --channelId ch:whatsapp:abc --text "Hello"'],
        },
        ui: { component: 'action-button', position: 'composer', order: 31 },
        mcpToolName: 'message_send',
        apiEndpoint: { method: 'POST', path: '/api/message/send' },
      },
      async (input: Record<string, unknown>, _ctx: CapabilityContext) => {
        const { channelId, text } = input as { channelId: string; text: string }

        if (!deps.mux) {
          return { ok: false, clarification: 'Configure mux for channel messaging' }
        }

        const result = await deps.mux.sendMessage({ channelId, text })
        return { ok: true, ...result }
      },
    ),
  )
}
