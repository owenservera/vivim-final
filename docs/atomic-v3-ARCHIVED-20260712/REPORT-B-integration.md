# Report B — Integration Coherence (SUPERSEDED)

> **⚠️ SUPERSEDED — See `docs/atomic-v3-fork-canon/REPORT-B-integration.md` for current analysis.**
> This report analyzed the original v3 tracker and identified integration issues that have been resolved in fork-canon.

**Pass date:** 2026-07-11 (archived)
**Scope:** Cross-unit interface / naming / ownership coherence of the 108 atomic specs. Complements Report A (dependency integrity).
**Method:** Producer→consumer tracing of every `**Produces:**` symbol against the `**Depends on:**` and runtime assumptions of downstream units.

---

## 🔴 P0 — Schema/ownership conflicts (will cause integration breakage)

### B1. Duplicate ownership of `TelemetryAuditInterceptor`
- `5.8` (consent-enforcement) **Produces:** "`TelemetryAuditInterceptor` blocks unconsented outbound calls."
- `8.4` (audit-interceptor) **Produces:** "`TelemetryAuditInterceptor` monkey-patches `globalThis.fetch` and `Bun.fetch`."

Two units claim to *define* the same class. At implementation time this is a merge/overwrite hazard — `5.8` and `8.4` will both scaffold `src/.../telemetry-audit-interceptor.ts` (or extend it) with no declared dependency between them (`5.8` deps `5.1, Phase 9`; `8.4` deps `5.8`).

**Fix:** Make `8.4` the single owner of `TelemetryAuditInterceptor`; `5.8` should *consume* it (add `8.4` to `5.8`'s deps) and only supply the *consent policy* it enforces. Removes the conflict and the implied-but-undeclared edge.

### B2. Duplicate ownership of `AutomationSchedule`
- `8.8` (health-digest) **Produces:** "`AutomationSchedule` that runs daily and writes a markdown digest."
- `9.7` (backup-schedule) **Produces:** "`AutomationSchedule` for periodic encrypted backups."

Same symbol, two owners, no dep link (`8.8` deps `8.3, 8.6`; `9.7` deps `9.6`).

**Fix:** Extract a shared `AutomationSchedule` engine (scheduler primitive) produced by one unit (recommend `8.8`); `9.7` consumes it and registers a backup job. Or rename `9.7`'s symbol to `BackupSchedule` to avoid collision.

### B3. `ExportEngine.export` extended without declaring the base dep
- `6.9` (memory-io) **Produces:** "`ExportEngine.export(format)`; symmetric `import(json)`."
- `9.6` (encrypted-export) **Produces:** "`ExportEngine.export` produces an encrypted bundle" — but `9.6` **Depends on:** `9.1` only (not `6.9`).

`9.6` extends `6.9`'s engine yet doesn't declare `6.9` as a prerequisite. The build order won't guarantee `6.9` exists when `9.6` is implemented.

**Fix:** Add `6.9` to `9.6`'s `Depends on:`.

---

## 🟠 P1 — Naming drift (ambiguity, not yet breakage)

### B4. `UnifiedCapabilityRegistry` vs `LiveCapabilityRegistry`
- `1.3` (capability-bootstrap) **Produces:** "A registry populated at startup with ~20 default capabilities … `UnifiedCapabilityRegistry`".
- `2.7` (live-cap-store) **Produces:** "`live_capability` table; capabilities loaded … `LiveCapabilityRegistry`."

Two registry names for what is very likely *one* registry (the unified one, with a `live_capability` table added in 2.7). Downstream units reference both inconsistently (`2.9`/`2.10` say "LiveCapabilityRegistry", `3.13`/`4.6`/`6.6` say "UnifiedCapabilityRegistry").

**Fix:** Standardize on `UnifiedCapabilityRegistry` everywhere; treat `2.7` as *extending* it (add `1.3` is already a dep of `2.7`, good). Update the `2.7` prose + `2.9`/`2.10` to match.

### B5. Minor slug/title garbling in tracker (covered by Report A1)
The same garbled slugs that broke `relPath` (A1) also appear as unit *titles* in the tracker (e.g. "Providor", "composite-steps", "telementary-v2"). Titles are human-only, but fix alongside A1 for consistency.

---

## 🟡 P2 — Orphaned producers (no declared consumer)

~40 units `Produce:` a symbol that **no other unit lists as a `Depends on:`**. Most are legitimate leaf capabilities/surfaces consumed only at runtime — but the graph doesn't capture the coupling, so a future refactor could drop a producer with no flagged impact. Grouped by phase:

- **Phase 2:** `2.3` intent-clarify, `2.5` composer-recursive, `2.6` composer-surfaces, `2.8` live-cap-sandbox, `2.10` live-cap-http, `2.12` loop-integration
- **Phase 3:** `3.2` templates, `3.8` discovery-write, `3.10` router, `3.11` ws, `3.12` security
- **Phase 4:** `4.2` presets, `4.4` conversation-surface, `4.6` capability-palette, `4.7` memory-browser, `4.8` provider-settings, `4.10` devops-console, `4.11` workspace-agent-actions
- **Phase 5:** `5.2` llamacpp, `5.6` mcp-discovery, `5.7` mcp-exposure, `5.9` discovery-ui, `5.10` provider-harness
- **Phase 6:** `6.3` extractor-continuous, `6.4` synthesis-v2, `6.9` memory-io, `6.10` memory-browser-full
- **Phase 7:** `7.2` step-reflection, `7.4` hitl-pause, `7.7` healer-v2, `7.8` provider-failover, `7.9` composite-step, `7.10` task-templates, `7.11` task-search, `7.12` canvas-integration
- **Phase 8:** `8.2` provenance-surface, `8.7` latency-budget, `8.8` health-digest
- **Phase 9:** `9.2` db-encryption, `9.5` offline-autonomous, `9.7` backup-schedule, `9.8` device-pairing, `9.9` zero-cloud-proof

**Assessment:** Not blocking. These are the expected "tip of the tree" units. **Recommendation:** leave as-is, *but* for the 6 that feed another phase's hard dep, ensure the consumer's `Depends on:` is explicit (see B3 already; the rest are intra-phase or soft `Phase N`). No action required beyond awareness.

---

## 🟢 P3 — Verified coherent
- **`ProvenanceGraph` chain is clean:** `2.14` (`provenance_node`/`provenance_edge` + `ProvenanceRecorder`) → `2.15` (`ProvenanceQuery`) → consumed by `7.7` (healer), `8.1` (tracing), `8.2` (surface), `7.2`/`7.5` (replay/reflection). All edges declared.
- **`AgenticConversationLoop` wiring is clean:** `2.11` → `2.12` (`ConversationManager.send` delegates) → `4.5` (`AgentFrontendSurface`) and `7.2`/`7.3`. Declared end-to-end.
- **`AutonomousExecutionEngine.planGoal` delegation is clean:** `7.1` deps `2.1, 2.2` (IntentDecomposer); `1.2` wires the engine into bootstrap. Declared.
- **`CanvasMirror`/`CanvasDiscovery`/`CanvasBinder` chain is clean:** `3.3`→`3.4/3.5/3.7`→`3.6/3.8`→`3.10/3.13`. All declared; `3.13` (agent-tools) correctly aggregates `3.3,3.4,3.5,3.7`.
- **`SandboxRunner` single owner:** produced `2.13`, consumed `2.8`, `3.12`. No conflict.
- **`WorkspaceManager` chain clean:** `4.1`→`4.2/4.3`→`4.4..4.11`.

---

## P4 — Recommended overall adjustments (from Report B)
1. **Resolve the 3 ownership/extension conflicts (B1, B2, B3)** — single owner per symbol; consumers declare the dep. Highest integration risk.
2. **Unify the registry name (B4)** to `UnifiedCapabilityRegistry` across `2.7/2.9/2.10`.
3. **No structural change needed for orphaned producers (P2)** — accept as leaf units; only enforce explicit deps where a hard cross-phase consumer exists.
4. After edits, run a grep-coherence check: each `Produces:` class/symbol should appear in ≤1 `Produces:` and ≥0 `Depends on:` (its consumers).

---
*End Report B.*
