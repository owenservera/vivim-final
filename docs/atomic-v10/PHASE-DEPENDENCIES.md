# Phase Dependency Graph: atomic-v10

```
Phase 24 ──→ Phase 25 ──→ Phase 26 ─┐
(SOA spine)  (NLCL      → Phase 27 ─┤
              resolver)  → Phase 28 ─┤
                         → Phase 29 ─┘
                                      │
                                      ▼
                                Phase 30
                              (parity lock)
```

## Rules

- **Phase 24 must complete first.** The universal execute route + registry-as-SoT is the foundation every later phase registers capabilities into.
- **Phase 25 second.** NLCL is the formatting layer; Phases 26-29 add NL patterns that depend on the resolver (25.1-25.7).
- **Phases 26, 27, 28, 29 are parallelizable** after 24+25 — they each add a capability domain + its NL patterns. No cross-deps between them.
- **Phase 30 last.** Locks the parity invariant across everything.

## Intra-phase ordering

### Phase 24 (linear chain)
24.1 → 24.2 → 24.3 → (24.4, 24.5, 24.6 parallel) → 24.7 → 24.8 → 24.9 → 24.10

### Phase 25 (mostly linear, resolver core first)
25.1 → 25.2 → 25.3 → (25.4, 25.5 parallel) → 25.6 → 25.7 → (25.8, 25.9 parallel)

### Phases 26-29
Within each phase, capabilities (N.1) before NL patterns (N.3/N.4/N.6) before live integration (N.4-canvas/N.6-mux). See per-unit `**Depends:**`.

## Cross-version dependencies

- **Requires done:** atomic-v9 Phase 23 (ConfigUniversalSurface, kernel CLI, capability autobridge) — provides the registry + config spine v10 builds on.
- **Requires done:** atomic-v3-fork-canon Phase 1 (stabilization) — green devops gate baseline.
- **Does NOT require:** v3-fork-canon Phases 2-22 (those are larger architectural work; v10 is self-contained SOA unification on top of the existing engines).
