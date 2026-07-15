// src/engines/cdp-capability-registrar.ts
// Unit U2 — CDP method ⇒ UnifiedCapability registrar.
//
// Per capability-driven-chat, every CDP command is an atomic capability backed by a
// registry row. This module turns a discovered CdpMethodDescriptor into a
// UnifiedCapability. The handler dispatches through an injected `executeCdp` (supplied
// by ChromeGovernor at runtime) — Governor Canon holds: this file NEVER imports
// BunCdpClient or any CDP transport.

import type { CapabilityProgramRow } from '../storage/contracts/capability-store.js'
import { type CdpMethodDescriptor, discoverCdpMethods } from './cdp-discovery.js'
import type { HarnessExecutor } from './harness/harness-contract.js'
import { makeHarnessCapability } from './harness/make-harness-capability.js'
import { configToProgram } from './harness/program-schema.js'
import type {
  CapabilityContext,
  UnifiedCapability,
  UnifiedCapabilityRegistry,
} from './unified-registry.js'

/** CDP commands that mutate browser/agent state — require user confirmation (B8). */
const DESTRUCTIVE_FULL = new Set<string>([
  'Page.navigate',
  'Page.reload',
  'Page.close',
  'Page.crash',
  'DOM.setAttributeValue',
  'DOM.removeNode',
  'Network.setBlockedURLs',
  'Target.closeTarget',
  'Input.dispatchKeyEvent',
  'Input.dispatchMouseEvent',
  'Input.insertText',
  'Fetch.fulfillRequest',
  'Fetch.failRequest',
  'Tracing.start',
  'Emulation.setDeviceMetricsOverride',
  'Emulation.setGeolocationOverride',
  'Debugger.pause',
])

function kebab(s: string): string {
  return s
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export type CdpExecutor = (method: string, params: Record<string, unknown>) => Promise<unknown>

/** Build a UnifiedCapability from a discovered CDP method. */
export function cdpMethodToCapability(
  desc: CdpMethodDescriptor,
  opts: { executeCdp: CdpExecutor },
): UnifiedCapability {
  const slug = `cdp-${kebab(desc.fullName)}`
  const properties: Record<string, unknown> = {}
  const required: string[] = []
  for (const p of desc.parameters) {
    properties[p.name] = { type: p.type === 'any' ? 'string' : p.type, description: p.description }
    if (!p.optional) required.push(p.name)
  }
  const destructive = DESTRUCTIVE_FULL.has(desc.fullName)

  return {
    id: `cap:cdp:${desc.fullName}`,
    slug,
    name: desc.fullName,
    description: desc.description || `CDP command ${desc.fullName}`,
    category: 'cdp',
    surfaces: ['cli', 'ui', 'api', 'mcp', 'workflow'],
    inputSchema: { type: 'object', properties, required },
    outputSchema: { type: 'object' },
    handler: async (input: Record<string, unknown>, _ctx: CapabilityContext) =>
      opts.executeCdp(desc.fullName, input),
    cliCommand: {
      name: `cdp ${desc.domain} ${desc.method}`,
      aliases: [slug],
      examples: [`cdp ${desc.domain} ${desc.method}`],
    },
    ui: {
      component: 'action-button',
      position: 'composer',
      group: 'cdp',
      order: 100,
      requiresConfirmation: destructive,
    },
    mcpToolName: slug,
    apiEndpoint: { method: 'POST', path: `/api/cdp/${slug}` },
    isAsync: true,
    requiresConfirmation: destructive,
    tags: ['cdp', 'discovered', desc.domain],
  }
}

export interface RegisterCdpResult {
  registered: string[]
  skipped: string[]
}

/** Register a set of discovered CDP methods into a registry. Duplicates are skipped. */
export function registerDiscoveredCdpMethods(
  registry: UnifiedCapabilityRegistry,
  descs: CdpMethodDescriptor[],
  opts: { executeCdp: CdpExecutor },
): RegisterCdpResult {
  const registered: string[] = []
  const skipped: string[] = []
  for (const desc of discoverCdpMethods(descs)) {
    try {
      registry.register(cdpMethodToCapability(desc, opts))
      registered.push(desc.fullName)
    } catch {
      skipped.push(desc.fullName)
    }
  }
  return { registered, skipped }
}

/**
 * Unit 25.2 - Turn a seeded program into a UnifiedCapability backed by the
 * harness executor. This makes every program reachable through the One Entry
 * Point, exactly like a CDP method capability.
 */
export function programToCapability(
  program: CapabilityProgramRow,
  opts: { executor: HarnessExecutor },
): UnifiedCapability {
  const recipe = configToProgram(program.configJson).recipe
  return makeHarnessCapability({
    id: `cap:prog:${recipe.capabilitySlug}:${recipe.providerId}`,
    slug: `prog-${recipe.capabilitySlug}-${recipe.providerId}`,
    name: `${recipe.capabilitySlug} @ ${recipe.providerId}`,
    description: recipe.description ?? `Program-driven capability for ${recipe.capabilitySlug}`,
    category: 'harness',
    executor: opts.executor,
    surfaces: ['cli', 'ui', 'api', 'mcp', 'workflow'],
    // Forward the real recipe slug + program id so execution resolves the exact
    // seeded program (not the synthetic `prog-*` slug).
    capabilitySlug: recipe.capabilitySlug,
    providerId: recipe.providerId,
    programId: program.id,
  })
}
