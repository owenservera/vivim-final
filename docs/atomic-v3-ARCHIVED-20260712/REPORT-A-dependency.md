# Report A — Dependency Integrity (SUPERSEDED)

> **⚠️ SUPERSEDED — See `docs/atomic-v3-fork-canon/REPORT-A-dependency.md` for current analysis.**
> This report analyzed the original v3 tracker and identified issues that have been resolved in fork-canon.

**Pass date:** 2026-07-11 (archived)
**Scope:** All 108 atomic spec files under `docs/atomic-v3/phase-*/`, cross-checked against `docs/atomic-v3/01-tracker.md`.
**Method:** Sequential read of every spec's `**Depends on:**` / `**Produces:**` headers + tracker `relPath` resolution + full graph reachability/cycle analysis.

---

## 🔴 P0 — Critical (blocks correct tooling / ordering)

### A1. Tracker `relPath` mismatch — 15 of 108 entries point to non-existent files
The tracker is declared the "authoritative source of truth," but 15 of its `→ \`path\`` links 404. `devops/trackers.ts:45` parses this path into group 6; any reader or future tool that follows it (incl. `devops roadmap` audit/merge and human navigation) lands on a missing file. Current `mark`/`select` only mutate/read tracker state and do **not** open the spec by relPath, so execution is not yet broken — but the source-of-truth is corrupted.

| Unit | Tracker says | Actual file on disk |
|------|--------------|----------------------|
| 7.9  | `phase-07-.../7.9-composite-steps.md`  | `7.9-composite-step.md` |
| 8.1  | `phase-08-.../8.1-tracing.md`           | `8.1-tracing-spans.md` |
| 8.2  | `phase-08-.../8.2-provenance-viz.md`    | `8.2-provenance-surface.md` |
| 8.3  | `phase-08-.../8.3-telemetry-v2.md`     | `8.3-telemetry-dashboard-v2.md` |
| 8.4  | `phase-08-.../8.4-audit-enforce.md`    | `8.4-audit-interceptor.md` |
| 8.7  | `phase-08-.../8.7-latency-budgets.md` | `8.7-latency-budget.md` |
| 8.8  | `phase-08-.../8.8-daily-digest.md`     | `8.8-health-digest.md` |
| 9.3  | `phase-09-.../9.3-sync-v2.md`         | `9.3-multi-device-sync.md` |
| 9.8  | `phase-09-.../9.8-pairing-ux.md`      | `9.8-device-pairing.md` |
| 10.1 | `phase-10-.../10.1-sdk-v2.md`          | `10.1-typed-sdk.md` |
| 10.2 | `phase-10-.../10.2-workspace-sdk.md`    | `10.2-react-workspace-sdk.md` |
| 10.3 | `phase-10-.../10.3-onboarding.md`       | `10.3-onboarding-flow.md` |
| 10.4 | `phase-10-.../10.4-performance.md`     | `10.4-performance-tuning.md` |
| 10.6 | `phase-10-.../10.6-openapi.md`         | `10.6-api-documentation.md` |
| 10.8 | `phase-10-.../10.3-v3-release.md`      | `10.8-v3-release.md` ⚠ wrong number **and** slug |

> Note the garbled slugs (`tracing`, `provenance-viz`, `telemetry-v2`, `audit-enforce`, `latency-budgets`, `daily-digest`, `sync-v2`, `pairing-ux`, `sdk-v2`, `workspace-sdk`, `onboarding`, `performance`, `openapi`) mirror the `devops/generate-atomic.ts` deterministic slugger that the user rejected. The AI-authored files used correct slugs; the tracker was not updated to match.

**Fix:** rewrite the 15 `relPath` values in `01-tracker.md` to the actual filenames. (Script-able: for each mismatch, replace the tracker path string with the disk path.)

### A2. Dependency CYCLE: `5.8 ↔ 9.4`
- `5.8` (consent-enforcement) **Depends on:** `5.1, Phase 9`
- `9.4` (airgap-default, inside *Phase 9*) **Depends on:** `5.1, 5.8`

`5.8 → 9.4 → 5.8` is a hard circular dependency. Under the `bun run devops select` phase-gate, `5.8` is held until Phase 9 completes, but `9.4` is held until `5.8` completes → deadlock.

**Fix (pick one):**
- (a) `5.8` drops `Phase 9` from its deps (consent logic is self-contained on `5.1`); `9.4` keeps `5.8`. Cycle broken, ordering preserved. **(recommended)**
- (b) `9.4` drops `5.8` and depends only on `5.1`; the airgap↔consent coupling is documented as a runtime concern, not a build dep.

### A3. Forward cross-phase HARD dependency + mislabel — `2.2 → 5.3`
- `2.2` (intent-llm, **Phase 2**) **Depends on:** `2.1, 5.3`
- `5.3` is **API-direct providers (Phase 5)**.

A Phase-2 unit hard-depends on a Phase-5 unit. The `select` gate (Phase 1 first, then in-order) will refuse `2.2` until `5.3` is done — i.e., Phase 2 cannot be selected/completed before Phase 5. Also the inline note `5.3 (local model adapter)` is **wrong**: `5.3` is API providers; local adapters are `5.1` (Ollama) / `5.2` (llama.cpp).

**Fix:**
- Repoint `2.2`'s dep to `5.1` (local model adapter) — or, if the LLM decomposer needs the *adapter base* that `5.3` defines, promote that adapter base to a Phase-1/Phase-2 unit so the edge is backward.
- Correct the label to `5.1 (local model adapter)`.

---

## 🟢 P1 — Verified clean
- **0 dangling unit-ID references.** Every ID cited in any `Depends on:` exists among the 108 units.
- **No other cycles.** Beyond A2, the graph is DAG except the soft `Phase N` bundle edges (which are forward-only and safe on their own).
- **Phase totals correct:** 12+15+13+11+10+10+12+8+9+8 = **108**. Matches tracker `Done: 108`.
- **`Produces:` ↔ `Depends on:` supply/demand is coherent** for all explicit edges (e.g. `3.3` is produced-as-`canvas_instance` and consumed by `3.4/3.5/3.7/3.10/3.13/4.1/4.11`; `2.7` (`live_capability`) consumed by `2.8/2.9/2.10`).

---

## 🟠 P2 — Soft-phase ordering notes (not blockers, but worth a glance)
- `2.2 → 5.3` is the **only** explicit forward (higher-phase) unit-to-unit edge. All other forward edges are *soft* `Phase N` bundles (`4.7→Phase 6`, `4.8→Phase 5`, `4.9→Phase 8`, `5.8→Phase 9`, `5.9→Phase 3`, `7.12→Phase 3`, `10.2→Phase 4`, `10.3→Phase 4/5`). These resolve fine because the dependent unit is a *consumer* of a later phase's output, not a gate on it.
- `10.1/10.4/10.5/10.6/10.7/10.8` declare `Depends on: all` — correct for a terminal release phase.

---

## P3 — Recommended overall adjustments (from Report A)
1. **Fix the 15 tracker `relPath`s (A1)** — highest leverage; restores the tracker as source-of-truth. One-pass edit.
2. **Break the `5.8 ↔ 9.4` cycle (A2)** via option (a).
3. **Repoint + relabel `2.2 → 5.3` (A3)** to `5.1 (local model adapter)`.
4. After edits, re-run `bun run devops report` to confirm `108/108` and re-validate no new cycle via the dep parser (`devops/deps.ts`).

---
*End Report A.*
