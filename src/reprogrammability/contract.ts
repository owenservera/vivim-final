// src/reprogrammability/contract.ts
// Phase 1 of ROADMAP-REPROGRAMMABLE-CANVAS.md — The Contract.
//
// Every visible element in the app (cards, panels, layers, canvas primitives,
// chrome elements) implements `ReprogrammableSurface`. This is the single
// abstraction that lets the Composer (Phase 4), Reprogram Modal (Phase 5),
// Visual Builder (Phase 6), LLM Harness (Phase 7), and Plugin SDK v2
// (Phase 9) all manipulate the same set of surfaces through the same
// `SurfaceMutation` shape (Phase 3).
//
// Invariants (codified in REPROGRAMMABILITY.md, Phase 10):
//   1. Every visible element is a ReprogrammableSurface.
//   2. Every mutation is one of the 8 ops (see mutation-schema.ts).
//   3. Every mutation is logged with provenance.
//   4. Every mutation is reversible.
//
// CONTRACT_VERSION: 1
// Bump on any breaking change to this file. REPROGRAMMABILITY.md must
// reference the same version; the Phase 10 check script enforces this.

import type { z } from 'zod'
import type { SurfaceSpec } from './schema/spec.js'
import type { SurfaceMutation } from './mutation-schema.js'

/** Semver-ish contract version. Bump on breaking changes. */
export const CONTRACT_VERSION = 1 as const

/**
 * The kind of surface. Determines the shape of `spec` and which mutation
 * ops are applicable. New kinds require a contract amendment (Phase 10).
 *
 * - `card`        — a content card (DocCard, MediaCard, AutomationCard, …)
 * - `panel`       — a dockable side panel (ConversationsPanel, ProvidersPanel, …)
 * - `layer`       — a canvas Z-layer (see ZLayerPanel)
 * - `primitive`   — a canvas primitive (workspace, projects, knowledge, …)
 * - `chrome`      — an app-chrome element (Composer, CommandBar, MainMenu, …)
 * - `slot`        — a chat slot (chat.default, chat.capability, …)
 * - `custom`      — escape hatch for surfaces not yet modeled. Spec is
 *                   `{ schemaUrl: string, data: unknown }`. Phase 10 audit
 *                   flags `custom` surfaces for promotion to a first-class kind.
 */
export type SurfaceKind =
  | 'card'
  | 'panel'
  | 'layer'
  | 'primitive'
  | 'chrome'
  | 'slot'
  | 'custom'

/**
 * Provenance tag for any mutation. Drives trust scoring (Phase 8).
 * Order from most-trusted to least-trusted (see trust-score.ts):
 *   manual > nlcl > prefix > plugin > llm-harness > system
 *
 * - `manual`      — user edited the spec JSON directly (Reprogram Modal)
 * - `nlcl`        — Natural Language Command Language (deterministic path)
 * - `prefix`      — slash/tag/mention command (command-language system)
 * - `plugin`      — a registered plugin produced the mutation
 * - `llm-harness` — the LLM harness agent produced the plan (Phase 7)
 * - `system`      — internal: boot, migration, backup restore. Highest
 *                   privilege, lowest trust — always logs + may notify user.
 */
export type MutationProvenance =
  | 'manual'
  | 'nlcl'
  | 'prefix'
  | 'plugin'
  | 'llm-harness'
  | 'system'

/**
 * The 8 mutation operations. No escape hatch; novel ops require a contract
 * amendment (Phase 10). See mutation-schema.ts for the full Zod schemas.
 *
 * - `replace`      — replace the entire spec of the target surface
 * - `insert`       — insert a child surface into a container (e.g. add a card to a panel)
 * - `remove`       — remove the target surface (or a child by id)
 * - `reorder`      — change the order of children in a container
 * - `restyle`      — apply a style patch (CSS-in-JS object) to the surface
 * - `rebind`       — rebind a capability to the surface (e.g. swap which
 *                    provider a chat slot uses)
 * - `set_property` — set a single property on the spec (deep path)
 * - `set_slot`     — change which slot a surface is mounted in
 */
export type MutationOp =
  | 'replace'
  | 'insert'
  | 'remove'
  | 'reorder'
  | 'restyle'
  | 'rebind'
  | 'set_property'
  | 'set_slot'

/**
 * The contract every reprogrammable element implements.
 *
 * Implementations may be:
 *   - Frontend classes registered in `UniversalComponentRegistry`
 *     (the existing hot-swap registry).
 *   - Backend descriptors persisted in Prisma (Phase 8 versioning).
 *   - Plugin-provided factories (Phase 9).
 *
 * The `SurfaceRegistry` (registry.ts) is the single source of truth across
 * all three origins.
 */
export interface ReprogrammableSurface {
  /** Stable unique id, e.g. `panel:conversations`, `card:doc:<ulid>`. */
  readonly id: string
  /** Discriminator for the spec shape. */
  readonly kind: SurfaceKind
  /** Display label, may be localized. */
  readonly label: string
  /** Optional slot id this surface is currently mounted in. */
  readonly slot?: string
  /** Optional capability ids this surface exposes (for Visual Builder ports). */
  readonly capabilities?: readonly string[]
  /** Optional tags for search/filter. */
  readonly tags?: readonly string[]

  /**
   * The current spec. Implementations MUST return a fresh deep clone on
   * every read (mutating the returned value must not affect the surface).
   */
  getSpec(): SurfaceSpec

  /**
   * Apply a mutation. Implementations MUST:
   *   1. Validate `mutation` against their own spec schema.
   *   2. Apply atomically — on any failure, roll back to the pre-mutation spec.
   *   3. Return the new spec (a deep clone).
   *   4. NOT perform side effects beyond the spec change (no DOM mutation,
   *      no network calls). Side effects are the executor's job.
   *
   * If the op is not supported for this kind, throw `UnsupportedMutationError`.
   */
  mutate(mutation: SurfaceMutation): Promise<SurfaceSpec>

  /**
   * Declare which ops this surface supports. The MutationExecutor uses
   * this to short-circuit unsupported ops before calling `mutate()`.
   * `*` means "all 8 ops".
   */
  readonly supportedOps: readonly MutationOp[] | '*'

  /**
   * Optional: a Zod schema validating the spec. Used by the Reprogram
   * Modal (Phase 5) and the LLM Harness (Phase 7) to validate plans.
   * If omitted, the registry falls back to the kind's default schema.
   */
  readonly specSchema?: z.ZodType<SurfaceSpec, z.ZodTypeDef, unknown>
}

/**
 * Error thrown when a mutation op is not supported by a surface.
 * The MutationExecutor catches this and routes to the user as a
 * "this surface doesn't support <op>" message.
 */
export class UnsupportedMutationError extends Error {
  readonly surfaceId: string
  readonly op: MutationOp
  constructor(surfaceId: string, op: MutationOp) {
    super(`Surface ${surfaceId} does not support op '${op}'`)
    this.name = 'UnsupportedMutationError'
    this.surfaceId = surfaceId
    this.op = op
  }
}

/**
 * Error thrown when a mutation's payload fails schema validation.
 */
export class InvalidMutationPayloadError extends Error {
  readonly surfaceId: string
  readonly op: MutationOp
  readonly issues: readonly z.ZodIssue[]
  constructor(
    surfaceId: string,
    op: MutationOp,
    issues: readonly z.ZodIssue[],
  ) {
    super(
      `Mutation '${op}' on ${surfaceId} failed validation: ${issues
        .map((i) => i.message)
        .join('; ')}`,
    )
    this.name = 'InvalidMutationPayloadError'
    this.surfaceId = surfaceId
    this.op = op
    this.issues = issues
  }
}

// Re-export the schema types for callers that import from the contract module.
// The canonical exports live in schema/spec.ts and mutation-schema.ts.
export type { SurfaceSpec, SurfaceSpecSchema } from './schema/spec.js'
export type { SurfaceMutation, SurfaceMutationSchema } from './mutation-schema.js'
