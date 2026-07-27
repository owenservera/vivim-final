// src/reprogrammability/canonical-surfaces.ts
// Phase 5 of ROADMAP-REPROGRAMMABLE-CANVAS.md — Reprogram-This Modal.
//
// A handful of canonical, in-memory ReprogrammableSurface implementations
// that register themselves with `surfaceRegistry` at boot. These cover the
// high-value surfaces users will most often want to reprogram:
//
//   - panel:conversations   — the conversations sidebar
//   - panel:providers       — the providers panel
//   - panel:settings        — the settings panel
//   - panel:mutation-diff   — the mutation diff panel (Phase 4)
//   - panel:mutation-history — the mutation history panel (Phase 4)
//   - chrome:composer       — the main text input (Phase 9 promotes to a real ChromeSurface)
//
// Each surface is a thin adapter that:
//   - holds a spec in memory
//   - implements `getSpec()` (returns a deep clone)
//   - implements `mutate(mutation)` (validates op, applies to spec, returns new spec)
//   - declares `supportedOps: '*'` (all 8 ops)
//
// Phase 8 will replace these with Prisma-backed surfaces. The contract is the
// same; only the storage layer changes.
//
// CONTRACT_VERSION: 1

import { ulid } from 'ulid'
import { surfaceRegistry } from './registry.js'
import type {
  ReprogrammableSurface,
  MutationOp,
} from './contract.js'
import type { SurfaceSpec } from './schema/spec.js'
import type { SurfaceMutation } from './mutation-schema.js'
import {
  UnsupportedMutationError,
  InvalidMutationPayloadError,
} from './contract.js'
import { z } from 'zod'

// ── Helper: deep clone via structuredClone (Bun + modern Node) ───────────────

function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}

// ── Generic in-memory surface ────────────────────────────────────────────────

/**
 * A simple in-memory ReprogrammableSurface. Holds a spec, supports all 8 ops,
 * and clones on read/write to enforce immutability.
 *
 * This is intentionally permissive — it does NOT enforce per-kind schema
 * validation (Phase 10 adds that). It only enforces:
 *   - op is one of the 8
 *   - replace / set_property / restyle payloads are well-formed
 *   - mutations are atomic (rolls back on any error)
 */
export class InMemorySurface implements ReprogrammableSurface {
  private spec: SurfaceSpec

  constructor(
    public readonly id: string,
    public readonly kind: ReprogrammableSurface['kind'],
    public readonly label: string,
    initialSpec: SurfaceSpec,
    public readonly slot?: string,
    public readonly capabilities?: readonly string[],
    public readonly tags?: readonly string[],
    public readonly supportedOps: readonly MutationOp[] | '*' = '*',
  ) {
    this.spec = deepClone(initialSpec)
  }

  getSpec(): SurfaceSpec {
    return deepClone(this.spec)
  }

  async mutate(mutation: SurfaceMutation): Promise<SurfaceSpec> {
    const before = deepClone(this.spec)
    try {
      switch (mutation.op) {
        case 'replace': {
          const newSpec = mutation.payload as SurfaceSpec
          if (!newSpec || typeof newSpec !== 'object' || typeof newSpec.kind !== 'string') {
            throw new InvalidMutationPayloadError(this.id, mutation.op, [
              { code: 'custom', path: ['payload'], message: 'payload must be a SurfaceSpec with a string kind', fatal: true } as never,
            ])
          }
          this.spec = deepClone(newSpec)
          break
        }
        case 'set_property': {
          const payload = mutation.payload as { path: string; value: unknown }
          if (!payload || typeof payload.path !== 'string') {
            throw new InvalidMutationPayloadError(this.id, mutation.op, [
              { code: 'custom', path: ['payload', 'path'], message: 'payload.path is required', fatal: true } as never,
            ])
          }
          this.setDeepPath(this.spec, payload.path, payload.value)
          break
        }
        case 'restyle': {
          const patch = mutation.payload as Record<string, unknown>
          if (!patch || typeof patch !== 'object') {
            throw new InvalidMutationPayloadError(this.id, mutation.op, [
              { code: 'custom', path: ['payload'], message: 'payload must be an object', fatal: true } as never,
            ])
          }
          const style = ((this.spec as Record<string, unknown>).style ?? {}) as Record<string, unknown>
          ;(this.spec as Record<string, unknown>).style = { ...style, ...patch }
          break
        }
        case 'set_slot': {
          const payload = mutation.payload as { slotId: string }
          if (!payload || typeof payload.slotId !== 'string') {
            throw new InvalidMutationPayloadError(this.id, mutation.op, [
              { code: 'custom', path: ['payload', 'slotId'], message: 'payload.slotId is required', fatal: true } as never,
            ])
          }
          ;(this.spec as Record<string, unknown>).slot = payload.slotId
          break
        }
        case 'remove': {
          // For a single surface, remove means "reset to empty/default" — we
          // don't actually delete the registration. Phase 8 versioning will
          // preserve the prior spec as a version.
          this.spec = {
            kind: 'custom',
            schemaUrl: 'about:blank',
            data: { removed: true, at: Date.now(), priorKind: this.spec.kind },
          }
          break
        }
        case 'insert':
        case 'reorder':
        case 'rebind': {
          // These ops require structural knowledge of the spec. For the in-memory
          // generic surface, we accept the mutation and store it as a sidecar
          // patch on a `custom` shell. Real surfaces (Phase 8+) implement these
          // properly against their own spec shape.
          const priorSpec = this.spec as Record<string, unknown>
          const patches = (Array.isArray(priorSpec.__patches) ? priorSpec.__patches : []) as unknown[]
          this.spec = {
            kind: 'custom',
            schemaUrl: 'about:blank',
            data: {
              ...priorSpec,
              __patches: [
                ...patches,
                { op: mutation.op, payload: mutation.payload, at: Date.now() },
              ],
            },
          } as unknown as SurfaceSpec
          break
        }
        default: {
          // Exhaustiveness check: if a new op is added to MutationOp without
          // a case here, this branch fires. `mutation` is narrowed to `never`
          // by the switch, so we cast to recover the type for the error.
          const op = (mutation as { op: MutationOp }).op
          throw new UnsupportedMutationError(this.id, op)
        }
      }
      return deepClone(this.spec)
    } catch (err) {
      // Atomic: rollback.
      this.spec = before
      throw err
    }
  }

  /** Set a deep dot-path on an object. */
  private setDeepPath(target: unknown, path: string, value: unknown): void {
    if (!target || typeof target !== 'object') return
    const parts = path.split('.')
    let cursor: Record<string, unknown> = target as Record<string, unknown>
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]!
      if (cursor[part] === undefined || typeof cursor[part] !== 'object') {
        cursor[part] = {}
      }
      cursor = cursor[part] as Record<string, unknown>
    }
    cursor[parts[parts.length - 1]!] = value
  }
}

// ── Default spec helper ──────────────────────────────────────────────────────
// (Removed: the `remove` op now resets to a `custom` shell spec rather than
// a per-kind default. The canonical-spec data above is the single source of
// truth for "factory" specs.)

// ── Canonical surfaces ───────────────────────────────────────────────────────

const CANONICAL_SURFACES: Array<{
  id: string
  kind: ReprogrammableSurface['kind']
  label: string
  spec: SurfaceSpec
  slot?: string
  capabilities?: readonly string[]
  tags?: readonly string[]
}> = [
  {
    id: 'panel:conversations',
    kind: 'panel',
    label: 'Conversations',
    spec: {
      kind: 'panel',
      variant: 'default',
      title: 'Conversations',
      dock: 'left',
      visible: true,
      collapsed: false,
      style: {},
    },
    slot: 'panel.left',
    capabilities: ['cap:conversation:list', 'cap:conversation:create'],
    tags: ['canonical', 'phase-5'],
  },
  {
    id: 'panel:providers',
    kind: 'panel',
    label: 'Providers',
    spec: {
      kind: 'panel',
      variant: 'default',
      title: 'Providers',
      dock: 'left',
      visible: true,
      collapsed: false,
      style: {},
    },
    slot: 'panel.left',
    capabilities: ['cap:provider:list', 'cap:provider:configure'],
    tags: ['canonical', 'phase-5'],
  },
  {
    id: 'panel:settings',
    kind: 'panel',
    label: 'Settings',
    spec: {
      kind: 'panel',
      variant: 'default',
      title: 'Settings',
      dock: 'right',
      visible: true,
      collapsed: true,
      style: {},
    },
    slot: 'panel.right',
    capabilities: ['cap:settings:get', 'cap:settings:set'],
    tags: ['canonical', 'phase-5'],
  },
  {
    id: 'panel:mutation-diff',
    kind: 'panel',
    label: 'Mutation Diff',
    spec: {
      kind: 'panel',
      variant: 'default',
      title: 'Mutation Diff',
      dock: 'right',
      visible: true,
      collapsed: false,
      style: {},
    },
    slot: 'panel.right',
    capabilities: ['cap:mutation:preview', 'cap:mutation:apply'],
    tags: ['canonical', 'phase-5', 'phase-4'],
  },
  {
    id: 'panel:mutation-history',
    kind: 'panel',
    label: 'Mutation History',
    spec: {
      kind: 'panel',
      variant: 'default',
      title: 'Mutation History',
      dock: 'right',
      visible: true,
      collapsed: true,
      style: {},
    },
    slot: 'panel.right',
    capabilities: ['cap:mutation:history', 'cap:mutation:undo', 'cap:mutation:redo'],
    tags: ['canonical', 'phase-5', 'phase-4'],
  },
  {
    id: 'chrome:composer',
    kind: 'chrome',
    label: 'Composer',
    spec: {
      kind: 'chrome',
      chromeKind: 'composer',
      enabled: true,
      strings: { placeholder: 'Send a message…' },
      style: {},
    },
    slot: 'chrome.bottom',
    capabilities: ['cap:composer:send', 'cap:composer:interpret'],
    tags: ['canonical', 'phase-5'],
  },
  {
    id: 'chrome:command-bar',
    kind: 'chrome',
    label: 'Command Bar',
    spec: {
      kind: 'chrome',
      chromeKind: 'command-bar',
      enabled: true,
      style: {},
    },
    slot: 'chrome.top',
    capabilities: ['cap:command:toggle-panel'],
    tags: ['canonical', 'phase-5'],
  },
  {
    id: 'chrome:main-menu',
    kind: 'chrome',
    label: 'Main Menu',
    spec: {
      kind: 'chrome',
      chromeKind: 'main-menu',
      enabled: true,
      style: {},
    },
    slot: 'chrome.top',
    capabilities: ['cap:menu:open', 'cap:menu:close'],
    tags: ['canonical', 'phase-5'],
  },
]

// ── Registration helper ──────────────────────────────────────────────────────

let registered = false

/**
 * Register all canonical surfaces with the singleton `surfaceRegistry`.
 * Idempotent — safe to call multiple times.
 */
export function registerCanonicalSurfaces(): void {
  if (registered) return
  for (const config of CANONICAL_SURFACES) {
    const surface = new InMemorySurface(
      config.id,
      config.kind,
      config.label,
      config.spec,
      config.slot,
      config.capabilities,
      config.tags,
    )
    surfaceRegistry.register(surface)
  }
  registered = true
}

/**
 * Test helper: reset the canonical surfaces (re-registers with original specs).
 * Only for use in tests.
 */
export function resetCanonicalSurfacesForTest(): void {
  for (const config of CANONICAL_SURFACES) {
    surfaceRegistry.unregister(config.id)
  }
  registered = false
  registerCanonicalSurfaces()
}

// ── Zod schema for the InMemorySurface spec (loose, accepts anything) ────────

export const InMemorySurfaceSpecSchema = z.object({
  kind: z.string(),
}).passthrough()
