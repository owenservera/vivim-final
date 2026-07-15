# vivim-runtime — Gap Matrix (Current Repo vs Assumed-Enabled Baseline)

> Verdicts: ✅ exists · 🟡 partial / exists but not driven by a runtime cmd ·
> ❌ missing. Maps each baseline component (RUNTIME-OS-DESIGN.md §3) to current
> repo state and the tracker unit(s) that bridge it.

---

## A. Pre-flight / Supervisor / Runtimes

| Baseline component | Current state | Verdict | Bridged by |
|---|---|---|---|
| Logged-in provider slaves (`setup-slaves`) | `scripts/setup-slaves.ts` works (browser, --verify, --spec, --status) | ✅ | R1.3 (reuse) |
| Detached backend/frontend supervisor + ps1 | none — no ps1, no detached supervisor; agent owns nothing | ❌ | R1.1, R1.2, R1.4 |
| Pre-flight orchestrator (slaves+backend+frontend before loop) | `preflight()` stub exists in design only | ❌ | R1.3 |
| `devops runtime up/down/restart/health` dispatcher | not in `devops/index.ts` | ❌ | R1.4 |

## B. Engage + Discover

| Baseline component | Current state | Verdict | Bridged by |
|---|---|---|---|
| Engage live app as real user (ChromeGovernor) | `ChromeGovernor` + `ActionRegistry.dispatch` exist; not composed into an engage cmd | 🟡 | R2.1 |
| Discover backend (live slave → UnifiedCapability) | `capability-discovery-loop.ts`, `protocol-loop-parser.ts`, `provider-discovery.ts` exist; not driven by a runtime cmd | 🟡 | R2.2 |
| Discover frontend reusable-part gaps | `CapabilityRegistry` + `ActionRegistry` exist; no gap scan | 🟡 | R2.3 |

## C. Test + Debug

| Baseline component | Current state | Verdict | Bridged by |
|---|---|---|---|
| Real-provider E2E (tests/e2e live) | `tests/e2e` use `mockGovernor` only; no `--live` real-slave driver | 🟡 | R3.1 |
| Real-user UI gate (CDP, no Playwright) | `ChromeGovernor` is the UI authority; no gate harness | ❌ | R3.2 |
| Debug capture (backend trace + frontend DOM) | `observation-tap.ts`, `stream-block-store.ts` exist; no failure→target emitter | 🟡 | R3.3 |

## D. Build (FRONTEND = BACKEND)

| Baseline component | Current state | Verdict | Bridged by |
|---|---|---|---|
| Build reusable frontend part + bind to backend slug | `ActionRegistry.addRuntimeEntry` + auto-populate pattern exist; no scaffold cmd | 🟡 | R4.1 |
| Frontend data-flow wire (api-client → registries) | **missing** — grep `capability` in `web/ui/src` = 0; frontend never fetches backend caps | ❌ | R4.2 |
| Backend handler scaffold for discovered protocols | `unified-registry` exists; no scaffold from discovery output | 🟡 | R4.3 |

## E. Orchestration + Skill

| Baseline component | Current state | Verdict | Bridged by |
|---|---|---|---|
| `devops runtime loop` (lifecycle meta-cmd, 2 modes) | none | ❌ | R5.1 |
| `vivim-runtime` agent playbook skill | none (source-audit skill precedent exists for wiring) | ❌ | R5.2 |
| Cross-refs (system ref + AGENTS.md) | audit-code precedent to mirror | 🟡 | R5.3 |
| Per-unit spec files (loadDeps wired) | SPEC-INDEX.md only; not yet `phase-XX/*.md` | 🟡 | R5.4 |
| End-to-end loop smoke (acceptance gate) | none | ❌ | R5.5 |

---

## Summary

- **✅ 1** fully present (`setup-slaves`).
- **🟡 9** present but not wired into a runtime command or otherwise partial
  (engage, both discovers, real-provider E2E mock-only, debug capture, build
  scaffold pattern, cross-ref precedent, spec files).
- **❌ 8** missing (detached supervisor + ps1, preflight orchestrator, `runtime`
  dispatcher, real-user UI gate, frontend data-flow wire, `loop` meta-cmd,
  `vivim-runtime` skill, loop smoke).

**Hardest gaps:** frontend data-flow wire (R4.2) — the render bridge is entirely
absent; and the detached supervisor + ps1 (R1.1/R1.2) — the prerequisite for
"restart without breaking the session."

Sequencing enforced by phase gating: R1 → R2 → R3 → R4 → R5. Within a phase,
units are independent. See `01-tracker.md` (states) and `SPEC-INDEX.md` (specs).
