// src/engines/harness/make-harness-capability.ts
// Unit 25.1 - Unified capability program handler (One Entry Point -> harness).
// Builds a UnifiedCapability whose handler delegates to HarnessExecutorEngine.
// Every program capability stays a UnifiedCapability surfaced across all
// surfaces; no new transport, no CDP touch here (Governor Canon).

import type { CapabilityContext, UnifiedCapability } from '../unified-registry.js'
import type { HarnessExecutor } from './harness-contract.js'

export interface MakeHarnessCapabilityOpts {
  id: string
  slug: string
  name: string
  description: string
  category?: string
  executor: HarnessExecutor
  surfaces: UnifiedCapability['surfaces']
  /** The recipe's real capability slug the executor resolves against (not the synthetic `prog-*` slug). */
  capabilitySlug: string
  /** Provider the program is bound to (used when ctx doesn't carry providerId). */
  providerId: string
  /** Optional program id so the executor resolves the exact seeded program. */
  programId?: string
}

export function makeHarnessCapability(opts: MakeHarnessCapabilityOpts): UnifiedCapability {
  return {
    id: opts.id,
    slug: opts.slug,
    name: opts.name,
    description: opts.description,
    category: opts.category ?? 'harness',
    surfaces: opts.surfaces,
    inputSchema: {
      type: 'object',
      properties: { input: { type: 'object' } },
      required: [],
    },
    outputSchema: { type: 'object' },
    handler: async (input: Record<string, unknown>, ctx: CapabilityContext) => {
      const providerId = String(ctx.providerId ?? input.providerId ?? opts.providerId)
      const accountId = String(input.accountId ?? '')
      return opts.executor.execute({
        // Use the recipe's real slug (+ programId) so program resolution hits the
        // seeded program, not the synthetic `prog-*` capability slug.
        capabilitySlug: opts.capabilitySlug,
        providerId,
        accountId,
        programId: opts.programId,
        input,
        conversationId: ctx.conversationId,
      })
    },
    cliCommand: opts.surfaces.includes('cli')
      ? { name: opts.slug, aliases: [], examples: [opts.slug] }
      : undefined,
    mcpToolName: opts.surfaces.includes('mcp') ? opts.slug : undefined,
    apiEndpoint: opts.surfaces.includes('api')
      ? { method: 'POST', path: `/api/capabilities/${opts.id}/execute` }
      : undefined,
    ui: opts.surfaces.includes('ui')
      ? {
          component: 'action-button',
          position: 'composer',
          group: 'harness',
          order: 0,
          requiresConfirmation: false,
        }
      : undefined,
    isAsync: true,
    requiresConfirmation: false,
    tags: ['harness'],
  }
}
