---
name: production-build
description: >-
  Professional, release-engineer-grade production build pipeline for vivim-final.
  Use when preparing a shippable build: a Tauri desktop installer, a tagged
  release, CI artifacts, or "make it production-ready / clean up for release".
  Drives `bun run devops production-build` — a gated, auditable, SpecKit-aware
  pipeline (precheck → gate → cleanup → converge → build → docs → verify → report)
  with cleanup, documentation reconciliation, and a post-build smoke test.
---

# Production Build — Professional Release Standard

A production build is **more than `tauri build`**. It is a gated, auditable pipeline
that enforces the bar a release engineer would: code quality, architectural
invariants, dead-code / artifact cleanup, spec↔code convergence (via the SpecKit
SDD system), artifact build, documentation reconciliation, and a post-build smoke
test. Every phase is independently runnable and emits a structured result so CI
can fail fast and humans can audit exactly what happened.

> **CANONICAL INVARIANT:** A production build must be reproducible from a clean,
> tagged commit. The pipeline refuses to build from a dirty tree unless
> `--allow-dirty` is passed, and it refuses to ship secrets or stray dirs.

## When to use

- "Prepare a production build" / "make a release" / "ship the desktop app"
- "Clean up before release" / "what's blocking a production build?"
- "Reconcile docs / ADRs for the release" / "generate release notes"
- CI: gate the release job on `bun run devops production-build` (with `--out=report.json`)

## The Pipeline

Run the full pipeline, or one phase at a time:

```
bun run devops production-build                      # full pipeline (target=tauri)
bun run devops production-build --dry-run            # preview all actions, no mutation
bun run devops production-build <phase>              # run a single phase
bun run devops production-build cleanup              # just the hygiene pass
bun run devops production-build --target=tauri --out=.runtime/prod-report.json
```

Phases (run in order; each is independently runnable):

| Phase | What it does | Fails build when |
|-------|--------------|------------------|
| `precheck` | Toolchain (node/bun/git; cargo for tauri), dirty-tree guard, branch/sha context | toolchain missing; dirty tree (no `--allow-dirty`) |
| `gate` | Reuses `devops gate --strict --full` (typecheck/lint/test/invariants/audit/coverage) | any quality-gate step fails |
| `cleanup` | Removes stray top-level provider dirs (`gemini/`,`chatgpt/`,`claude/`), temp artifacts, prunes caches; secret scan | secrets in tracked files; stray-dir/cache removal fails |
| `converge` | SpecKit SDD convergence + architectural invariant drift check | invariant **blocks** present |
| `build` | `scripts/tauri/build.ps1` (sidecar compile + `web:build` + `cargo tauri build`) | build script non-zero |
| `docs` | Regenerates `docs/decisions/ADR-INDEX.md`, ensures `CHANGELOG.md` | (advisory; does not fail) |
| `verify` | Desktop smoke test `tests/e2e/tauri-sidecar.test.ts` (health/readyz/nlcl) | with `--strict-verify`, non-zero smoke test |
| `report` | Structured JSON + human release-notes summary; writes `--out` if given | (summary only) |

Exit code is `0` only when **no phase failed**.

## Professional Cleanup Standard (what `cleanup` enforces)

These are the rules a production build must satisfy:

1. **No stray top-level provider dirs.** Per `AGENTS.md`, providers live ONLY under
   `chrome-profiles/<slug>/<account>`. A top-level `gemini/`, `chatgpt/`, `claude/`
   is a leaked browser-profile dump and is deleted. (This caught a real stray
   `gemini/` Chrome user-data dir during development.)
2. **No temp build/test artifacts** in the tree (`*.exe` test compiles, `capout.txt`,
   coverage dumps). Pruned automatically.
3. **No secrets in tracked files.** Regex-scans tracked `.ts/.json/.env/.ps1/.toml`
   for `api_key|secret|token|password` assignments. HARD BLOCKER.
4. **Dead-code surfaced.** `biome lint --reporter=summary` output is printed so the
   release engineer sees debt (non-fatal).
5. **Caches pruned** (`coverage/`, `node_modules/.cache`) so the artifact is lean.

## SpecKit Convergence (`converge`)

Leverages the existing SpecKit SDD system (`.specify/`, `devops/speckit-*`):
- Runs `devops speckit-converge --report` when available.
- Runs the architectural invariant check (`devops invariants check`). A production
  release cannot ship with invariant **blocks** (e.g. truth score < 80%, engines
  reading `process.env` directly instead of `ConfigManager`). Warnings are surfaced
  but do not block; blocks do.

This keeps the build honest: the spec, the code, and the architecture must agree
before anything is shipped.

## Documentation Reconciliation (`docs`)

- Regenerates `docs/decisions/ADR-INDEX.md` from all `ADR-*.md` files (title + status),
  so the release carries an accurate decision ledger.
- Ensures a `CHANGELOG.md` exists with an `Unreleased` section.

## Post-Build Verification (`verify`)

For `target=tauri`, runs `tests/e2e/tauri-sidecar.test.ts`, which probes a live
sidecar on `127.0.0.1:9421` for `/health`, `/readyz`, and `/api/nlcl/help`. In CI,
start the built sidecar first, then verify. Pass `--strict-verify` to make a failed
smoke test block the release.

## Extending to new targets

`phaseBuild` switches on `opts.target`. Add a `case` for `frontend-only`,
`backend-only`, or `docker` that invokes the appropriate script. The rest of the
pipeline (precheck/gate/cleanup/converge/docs/verify/report) is target-agnostic.

## Reading the output

- Each phase prints its findings, then `→ <summary>`.
- The final `report` phase prints `PRODUCTION BUILD READY` or `PRODUCTION BUILD BLOCKED`
  and a release-notes block listing every phase outcome.
- Pass `--out=path.json` to capture the full `BuildReport` for CI artifact upload.

## Integration with the rest of devops

- `gate` reuses `devops gate` (no reinvention of quality logic).
- `converge` reuses `devops invariants` and `devops speckit-converge`.
- `build` reuses `scripts/tauri/build.ps1` (the canonical Tauri build).
- The pipeline is the release counterpart to `devops run` (the autonomous
  implementation loop): loop builds features; `production-build` ships them.
