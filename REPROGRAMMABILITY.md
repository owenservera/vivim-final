# REPROGRAMMABILITY.md

> **The Constitution.** This document declares the contract that every
> reprogrammable element in Vivim implements. It is the single source of
> truth for the invariants, the amendment process, and the version pin.
>
> **Cross-reference**: Registered in `/home/z/my-project/worklog.md` under
> Task ID `roadmap-reprogrammable-canvas-phase10`. The Phase 10 CI gate
> (`mini-services/backend/scripts/check-reprogrammability.ts`) reads
> `CONTRACT_VERSION` from `mini-services/backend/src/reprogrammability/contract.ts`
> and FAILS if this file references a different version.

---

## 1. Contract Version

**CONTRACT_VERSION: 1**

Defined in `mini-services/backend/src/reprogrammability/contract.ts` as a
`const`. Any breaking change to the contract MUST increment this number and
trigger a migration of all existing surfaces (Invariant #7).

This document references CONTRACT_VERSION = 1. The CI gate enforces
alignment.

---

## 2. The Contract

Every visible element in Vivim — every card, panel, layer, canvas primitive,
chrome element, slot — implements `ReprogrammableSurface`:

```typescript
interface ReprogrammableSurface {
  readonly id: string
  readonly kind: SurfaceKind  // 'card' | 'panel' | 'layer' | 'primitive' | 'chrome' | 'slot' | 'custom'
  readonly label: string
  readonly slot?: string
  readonly capabilities?: readonly string[]
  readonly tags?: readonly string[]
  readonly supportedOps: readonly MutationOp[] | '*'
  readonly specSchema?: z.ZodType<SurfaceSpec>

  getSpec(): SurfaceSpec
  mutate(mutation: SurfaceMutation): Promise<SurfaceSpec>
}
```

**Source of truth**: `mini-services/backend/src/reprogrammability/contract.ts`

The contract is implemented by:
- **Frontend classes** registered in `UniversalComponentRegistry`.
- **Backend descriptors** registered in `SurfaceRegistry` (Phase 1; Phase 8
  adds Prisma backing).
- **Plugin-provided factories** (Phase 9).

The `SurfaceRegistry` (singleton) is the single source of truth across all
three origins.

---

## 3. The 8 Mutation Ops

Every mutation is one of exactly 8 ops. No escape hatch; novel ops require
a contract amendment (§7).

| # | Op | Payload | Description |
|---|---|---|---|
| 1 | `replace` | `SurfaceSpec` | Replace the entire spec of the target |
| 2 | `insert` | `SurfaceSpec` + optional `index` | Insert a child surface into a container |
| 3 | `remove` | (none) | Remove the target (or a child by id) |
| 4 | `reorder` | `string[]` (child ids in new order) | Reorder children in a container |
| 5 | `restyle` | `Record<string, unknown>` (CSS-in-JS) | Deep-merge a style patch |
| 6 | `rebind` | `{ capabilityId, slot?, action: 'bind'\|'unbind' }` | Bind/unbind a capability |
| 7 | `set_property` | `{ path: string, value: unknown }` | Set a deep path on the spec |
| 8 | `set_slot` | `{ slotId: string }` | Change which slot a surface is mounted in |

**Source of truth**: `mini-services/backend/src/reprogrammability/mutation-schema.ts`
(`MUTATION_OPS` constant + Zod discriminated union).

---

## 4. The 6 Provenance Tags

Every mutation is logged with a provenance tag. Provenance drives trust
scoring (Phase 8) — `manual > nlcl > prefix > plugin > llm-harness > system`.

| # | Tag | Weight | Description |
|---|---|---|---|
| 1 | `manual` | 100 | User edited the spec JSON directly (Reprogram Modal) |
| 2 | `nlcl` | 90 | Natural Language Command Language (deterministic path) |
| 3 | `prefix` | 80 | Slash/tag/mention command (command-language system) |
| 4 | `plugin` | 60 | A registered plugin produced the mutation |
| 5 | `llm-harness` | 40 | The LLM harness agent produced the plan (Phase 7) |
| 6 | `system` | 20 | Internal: boot, migration, backup restore. Highest privilege, lowest trust |

**Source of truth**: `mini-services/backend/src/reprogrammability/mutation-schema.ts`
(`PROVENANCE_TAGS` constant + `ProvenanceEnumSchema`).

Trust scoring: `mini-services/backend/src/engines/trust-score.ts`
(`MUTATION_PROVENANCE_WEIGHTS` + `computeMutationTrustScore`, added in Phase 8).

---

## 5. The 7 Surface Kinds

Every surface declares a `kind` that determines the shape of its spec.

| # | Kind | Spec shape | Examples |
|---|---|---|---|
| 1 | `card` | `CardSpec` | DocCard, MediaCard, AutomationCard, AgentCard |
| 2 | `panel` | `PanelSpec` | ConversationsPanel, ProvidersPanel, SettingsPanel |
| 3 | `layer` | `LayerSpec` | Z-layers in the canvas |
| 4 | `primitive` | `PrimitiveSpec` | workspace, projects, knowledge, agents, providers, conversations |
| 5 | `chrome` | `ChromeSpec` | Composer, CommandBar, MainMenu, MobileNav, CommandPalette, ThemeSettings |
| 6 | `slot` | `SlotSpec` | chat.default, chat.capability.* |
| 7 | `custom` | `CustomSpec` | Escape hatch for surfaces not yet modeled; Phase 10 audit flags them for promotion |

**Source of truth**: `mini-services/backend/src/reprogrammability/schema/spec.ts`
(`SurfaceSpecSchema` discriminated union).

---

## 6. The 7 Invariants

These invariants are codified as runtime tests in
`mini-services/backend/src/reprogrammability/__tests__/invariants.test.ts`.
The CI gate (`mini-services/backend/scripts/check-reprogrammability.ts`)
fails if any invariant test fails.

### Invariant 1: Every visible element is a `ReprogrammableSurface`

No exceptions for "internal" or "system" elements — if it renders, it's a
surface. The Reprogram-This modal (Phase 5) can reprogram any surface;
the Visual Builder (Phase 6) can wire any surface as a node.

### Invariant 2: Every mutation is one of the 8 ops

No escape hatch for "custom" ops. Novel ops require a contract amendment
(§7). The `MutationExecutor` validates `op` against `MUTATION_OPS` before
calling `surface.mutate()`.

### Invariant 3: Every mutation is logged with provenance

No silent mutations. The `MutationExecutor.apply()` records `provenance`
on every `AppliedMutationRecord`. The `VersionStore` (Phase 8) persists
provenance with every `SurfaceVersion`.

### Invariant 4: Every mutation is reversible

The undo stack is never empty for an applied mutation. The
`MutationExecutor.apply()` pushes to the undo stack on success;
`MutationExecutor.undo()` restores the prior spec.

### Invariant 5: The LLM never produces code

The LLM produces `SurfaceMutationPlan` JSON only. The `LlmHarnessAgent`
(Phase 7) parses LLM output against `SurfaceMutationPlanSchema`; on
failure, retries up to MAX_RETRIES=2 with the validation error in the
prompt. After MAX_RETRIES, returns an error plan (NOT an exception).

### Invariant 6: The chrome is reprogrammable but the safe-mode keybind is not

⌘⇧R (Cmd+Shift+R) always resets the Composer to factory. The keybind is
hardcoded in `ChromeSurface.tsx` (Phase 9) and is NOT reprogrammable. If
the Composer's spec is corrupted, ⌘⇧R is the recovery path.

### Invariant 7: The contract is versioned

Any change to the contract increments `CONTRACT_VERSION` in
`contract.ts` and triggers a migration of all existing surfaces. The CI
gate compares `CONTRACT_VERSION` against this document; misalignment fails
the gate.

---

## 7. Amendment Process

Changes to this contract require:

1. A PR that:
   - Modifies the contract files (`contract.ts`, `mutation-schema.ts`,
     `schema/spec.ts`, `variant-schema.ts`).
   - Increments `CONTRACT_VERSION`.
   - Updates this document to reference the new version.
   - Adds a migration script under
     `mini-services/backend/src/reprogrammability/migrations/` that
     transforms existing surfaces to the new contract.
2. All invariant tests pass.
3. The Phase 10 CI gate passes.
4. Explicit user approval (recorded in `worklog.md` under the PR Task ID).

Until all four conditions are met, the amendment is not in effect.

---

## 8. CI Gate

**Script**: `mini-services/backend/scripts/check-reprogrammability.ts`

The script:
- Scans `src/components/{canvas,chat,builder,chrome}/**` for files that
  look like cards/panels/primitives.
- For each, checks it implements `ReprogrammableSurface` (via a static
  marker or `instanceof` check).
- Verifies `CONTRACT_VERSION` in `contract.ts` matches the version
  referenced in this document.
- Runs the invariant tests.
- Fails (exit 1) on any violation.

**Pre-commit hook**: `lefthook.yml` runs the script on every commit that
touches `src/components/{canvas,chat,builder,chrome}/**` or
`mini-services/backend/src/reprogrammability/**`.

**CI**: `.github/workflows/reprogrammability-gate.yml` runs the script on
every PR.

### Bypass

A `// @reprogrammability-skip` comment with a reason + issue link bypasses
the gate for a specific file. The bypass is flagged in the PR review and
must be approved by a maintainer. Bypasses are intended for:
- Test fixtures that aren't real surfaces.
- Legacy components that are being phased out.
- Experimental code that hasn't been promoted to the contract yet.

Bypasses are NOT intended for production code. Every bypass should have a
follow-up issue to either promote the file to the contract or remove it.

---

## 9. Roadmap Cross-Reference

This document is the deliverable of Phase 10 of
`ROADMAP-REPROGRAMMABLE-CANVAS.md`. The roadmap's PRESERVE COVENANT applies
to both documents — neither may be deleted or superseded without an
explicit SUPERSESSION REQUEST section at the bottom.

| Phase | Deliverable | Status |
|---|---|---|
| 1 | The Contract | 🟡 Planted |
| 2 | Wire the Substrate | 🟡 Planted |
| 3 | The Mutation DSL | 🟡 Planted |
| 4 | Composer-as-Builder | 🟡 Planted |
| 5 | Reprogram-This Modal | 🟡 Planted |
| 6 | Visual Builder | 🟡 Planted |
| 7 | LLM Harness Escalation | 🟡 Planted |
| 8 | Provenance & Versioning | 🟡 Planted |
| 9 | Plugin SDK v2 + Chrome | 🟡 Planted |
| 10 | Permanence & Invariants | 🟡 Planted (this document) |

Status matrix: see §13 of `ROADMAP-REPROGRAMMABLE-CANVAS.md`.

---

## 10. SUPERSESSION REQUESTS

*(Empty. Any future plan that intends to supersede this contract MUST
append a section here documenting the supersession, the new contract, the
completed phases, the invalidated phases, and explicit user approval.)*

---

*End of constitution. This document is permanent. Do not delete.*
