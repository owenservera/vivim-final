# Non-TUI Kilocode / OpenCode — Convergence Trace

## Iteration 1
**Hypothesis:** Wire Kilo/OpenCode into vivim as a CDP provider next to chatgpt/gemini (Shape A).
**Search queries:** "kilo serve web UI selectors", "opencode web CDP composer", "vivim provider manifest CDP"
**Sources found:** 3 (Kilo CLI, OpenCode Server, vivim manifests)
**Confidence after:** Low — vivim manifests are browser/CDP-shaped; Kilo/OpenCode are not web UIs.
**Decision:** Continue (mismatch detected)

## Iteration 2
**Hypothesis:** They are LLM API *backends* (provider_type opposite to vivim). Use `run --auto` / `serve` as agent executors (Shape B).
**Search queries:** "opencode run --auto --format json", "opencode serve OpenAPI message API", "kilo run --auto autonomous mode CI"
**Sources found:** 5 (OpenCode CLI, OpenCode Server, Kilo CLI, config docs)
**Confidence after:** Medium-High — clean programmatic seam confirmed.
**Decision:** Continue (validate pitfalls)

## Iteration 3
**Hypothesis:** Shape B is viable if we handle autonomous-mode blind follow-ups, serve hangs, and permission denials.
**Search queries:** "opencode serve hang issue", "kilo autonomous mode follow-up questions", "opencode permission deny config"
**Sources found:** 4 (serve-hang issue, Kilo autonomous docs, config permission docs)
**Confidence after:** High — mitigations identified for all risks.
**Decision:** Converge

## Final Verdict
**Status:** CONFIRMED
**Iterations:** 3
**Time spent:** ~1 research session
