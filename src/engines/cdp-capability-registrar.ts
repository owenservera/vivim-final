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

/**
 * Light binding-store contract (G2). The registrar persists a CapabilityBinding
 * row per (cdp capability, provider) when a binding store is supplied. Kept as a
 * tiny inline contract so the registrar still honors the Store-Contract rule and
 * never imports Prisma directly. When absent, registration degrades gracefully
 * (the capability is still registered in-memory — our "relaxed" policy).
 */
export interface CdpBindingStore {
  /** Idempotent upsert of a CDP capability binding for a provider. */
  ensureCdpBinding(args: {
    capabilityId: string
    providerId: string
    status: string
    confidence: number
    reason?: string
  }): Promise<void>
}
import { catchDebug } from '../lib/catch-logger.js'
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

export type CdpExecutor = (
  method: string,
  params: Record<string, unknown>,
  ctx?: CapabilityContext,
) => Promise<unknown>

export interface CdpRegisterOptions {
  executeCdp: CdpExecutor
  /**
   * Provider scope for the binding (B/B2). When supplied, each registered CDP
   * command gets a CapabilityBinding row keyed by this provider. The registrar
   * itself never decides provider ownership — the caller (discovery on a live
   * slave) provides it, mirroring OG `capability.provider_id`.
   */
  providerId?: string
  /** Optional persistence for the binding row (G2 light gate). */
  bindingStore?: CdpBindingStore
  /**
   * D2 light-gate result. When present (method verified live on the attached
   * slave's protocol), the binding is written as `active` with the given
   * confidence; otherwise it is written as `prospect` (gated, not executable).
   */
  verified?: { confidence: number }
}

/** Build a UnifiedCapability from a discovered CDP method. */
export function cdpMethodToCapability(
  desc: CdpMethodDescriptor,
  opts: CdpRegisterOptions,
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
    // Provider scope is carried on tags so the binding lookup stays stateless.
    surfaces: ['cli', 'ui', 'api', 'mcp', 'workflow'],
    inputSchema: { type: 'object', properties, required },
    outputSchema: { type: 'object' },
    handler: async (input: Record<string, unknown>, ctx: CapabilityContext) =>
      opts.executeCdp(desc.fullName, input, ctx),
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
    tags: [
      'cdp',
      'discovered',
      desc.domain,
      ...(opts.providerId ? [`provider:${opts.providerId}`] : []),
    ],
  }
}

export interface RegisterCdpResult {
  registered: string[]
  skipped: string[]
  /** Provider binding rows persisted (empty when no bindingStore/providerId). */
  bound: string[]
}

function bindingStatusFor(opts: CdpRegisterOptions): { status: string; confidence: number } {
  // D2 light gate: a verified method (exists on the attached slave's protocol)
  // becomes `active`; everything else is parked as `prospect` until verified.
  if (opts.verified) return { status: 'active', confidence: opts.verified.confidence }
  return { status: 'prospect', confidence: 0 }
}

/** Register a set of discovered CDP methods into a registry. Duplicates are skipped. */
export function registerDiscoveredCdpMethods(
  registry: UnifiedCapabilityRegistry,
  descs: CdpMethodDescriptor[],
  opts: CdpRegisterOptions,
): RegisterCdpResult {
  const registered: string[] = []
  const skipped: string[] = []
  const bound: string[] = []
  const { status, confidence } = bindingStatusFor(opts)
  for (const desc of discoverCdpMethods(descs)) {
    try {
      registry.register(cdpMethodToCapability(desc, opts))
      registered.push(desc.fullName)
      if (opts.providerId && opts.bindingStore) {
        try {
          opts.bindingStore
            .ensureCdpBinding({
              capabilityId: `cap:cdp:${desc.fullName}`,
              providerId: opts.providerId,
              status,
              confidence,
              reason: opts.verified ? 'd2-live-protocol-verified' : 'd2-pending-verification',
            })
            .catch(() => {})
          bound.push(desc.fullName)
        } catch {
          catchDebug(_err, 'engines:cdp-capability-registrar:185')
          /* binding persistence is best-effort */
        }
      }
    } catch {
      skipped.push(desc.fullName)
    }
  }
  return { registered, skipped, bound }
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
