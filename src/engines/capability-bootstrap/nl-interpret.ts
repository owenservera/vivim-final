// src/engines/capability-bootstrap/nl-interpret.ts
// registerNlInterpretCapability — registers the NL interpretation capability.
// Session 7 (2026-08-07): Extracted from capability-bootstrap.ts.

import type { NLCLEngine } from '../nlcl/nlcl-engine.js'
import type { NLCContext } from '../nlcl/types.js'
import type { UnifiedCapability, UnifiedCapabilityRegistry } from '../unified-registry.js'
import { makeCapability } from './types.js'

export function registerNlInterpretCapability(
  registry: UnifiedCapabilityRegistry,
  nlclEngine: NLCLEngine,
): void {
  const handler: UnifiedCapability['handler'] = async (input, capCtx) => {
    const text = String(input.text ?? '')
    const extra =
      input.ctx && typeof input.ctx === 'object' ? (input.ctx as Record<string, unknown>) : {}
    const nlCtx: NLCContext = {
      surface: 'api',
      providerId: (extra.providerId as string | undefined) ?? capCtx.providerId,
      accountId: extra.accountId as string | undefined,
      conversationId: (extra.conversationId as string | undefined) ?? capCtx.conversationId,
      slaveId: (extra.slaveId as string | undefined) ?? capCtx.slaveId,
      userId: (extra.userId as string | undefined) ?? capCtx.userId,
      metadata: { ...(extra.metadata as Record<string, unknown>), ...capCtx.metadata },
    }
    return nlclEngine.interpret(text, nlCtx)
  }

  registry.register(
    makeCapability(
      {
        id: 'cap:nlcl:interpret',
        slug: 'nl_interpret',
        name: 'Interpret Natural Language',
        description:
          'Resolve natural language to a capability chain (self-referential NL parsing).',
        category: 'nlcl',
        inputSchema: {
          type: 'object',
          properties: { text: { type: 'string' }, ctx: { type: 'object' } },
          required: ['text'],
        },
        outputSchema: { type: 'object' },
        cliCommand: { name: 'nl', aliases: ['interpret'], examples: ['nl "list providers"'] },
        ui: { component: 'composer', position: 'composer', order: 0 },
        mcpToolName: 'nl_interpret',
        apiEndpoint: { method: 'POST', path: '/api/interpret' },
      },
      handler,
    ),
  )
}
