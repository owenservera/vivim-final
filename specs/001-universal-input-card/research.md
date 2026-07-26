# Research: Universal Atomic TextEntryBox

---

## Decision 1: Scope behavior dispatch — stub vs real

- **Decision**: Stub for now. `scope.behavior = 'chat'` calls `sendMessage()`. All other behavior values fire a generic `onBehaviorAction(behavior, text)` callback that logs to console. Real capability event dispatch is a follow-up.
- **Rationale**: The existing system only has one real input (chat composer). Other behaviors (search, execute, prompt, command, comment) will be wired when their respective surfaces (docs, automation, agents, shell) are built. The stub ensures the architecture works without blocking.
- **Alternatives considered**: Full capability dispatch via `CapabilityResolutionEngine` — over-engineered for now; the engine integration is straightforward and well-understood.

## Decision 2: Scope propagation — props vs React context

- **Decision**: Pass `scope` as a prop to `ComposerShell`. For deeply nested add-ons that need scope, create a `ComposerShellContext` that wraps the shell children and contains `scope` + all state (models, capabilities, streaming, etc.).
- **Rationale**: Props are explicit and testable. The context is created inside `ComposerShell` so add-ons receive it automatically without prop drilling.
- **Alternatives considered**: Global React context at the app level — overkill and couples the shell to app structure.

## Decision 3: Z-layer binding for composer

- **Decision**: The composer always mounts in whatever Z-layer its parent region specifies. The `scope.activeZLayer` field is purely informational for add-ons that want to know their depth. No rendering logic changes based on layer.
- **Rationale**: Z-layers determine visual stacking (opacity, depth, z-index), not input behavior. The existing `ZLayerConfig` from the workspace store already handles visual properties.
- **Alternatives considered**: Mapping behavior → Z-layer (chat=base, search=overlay, etc.) — too opinionated; surfaces already specify their layers via `routeSyncWorkspace`.

## Decision 4: Add-on data loading — parallel vs waterfall

- **Decision**: Fire all model/capability fetches in parallel in a single `useEffect` using `Promise.allSettled()`. Each add-on renders a null state (not rendered) until its data is available.
- **Rationale**: Models and capabilities are independent API calls. Parallel fetch minimizes time-to-interactive. Add-ons without data gracefully disappear.
- **Alternatives considered**: Sequential fetch — slower. Add-on-level data fetching — duplicates requests if two add-ons need the same data.

## Decision 5: ContentBlock normalization location

- **Decision**: Normalize in `ComposerShell` (the parent, passed down), not in `TextEntryBox`. The atomic unit never touches blocks.
- **Rationale**: TextEntryBox is pure text input/output. Block normalization belongs in the message-management layer.
- **Alternatives considered**: Normalize in a custom hook reused by both old `Composer` and new `ComposerShell` — good but out of scope for this feature; existing `Composer` already does it.

## Decision 6: localStorage key format

- **Decision**: `vivim:composer-addons:{instanceId}` — scoped per instance. On remount with a new `instanceId`, the config starts fresh (empty add-ons).
- **Rationale**: Instance-level isolation prevents cross-contamination. A future enhancement can fall back to `vivim:composer-addons:{workspaceId}:{surfaceSlug}:{regionSlotId}` for persistent defaults across remounts.
- **Alternatives considered**: Single key for all instances — loses per-box customization. Workspace-level key — too coarse.
