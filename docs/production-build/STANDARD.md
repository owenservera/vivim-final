# Professional Production Build Standard

**Status:** ACTIVE
**Owner:** Release Engineering (devops pipeline)
**Applies to:** Every shippable artifact of vivim-final (Tauri desktop installer, tagged release, CI artifacts).

This document is the canonical **standard** for what constitutes a professional,
production-grade build in this project. It is enforced by `bun run devops production-build`
(see `.kilo/skills/production-build`). The pipeline does not reinvent quality logic — it
orchestrates existing gates (lint/typecheck/test/invariants/audit/coverage), adds the
release-engineering hygiene that those gates don't cover (cleanup, docs, convergence,
smoke test), and fails fast with an auditable report.

---

## 1. Principles

1. **Reproducible from a clean, tagged commit.** No production build from a dirty tree
   (unless `--allow-dirty` is explicitly passed and logged).
2. **Quality gate is mandatory.** The devops quality gate (`gate --strict --full`) must
   be green: typecheck, lint, unit/integration tests, architectural invariants,
   dependency audit, coverage thresholds.
3. **Clean before you ship.** Stray dirs, temp artifacts, and caches are removed.
   Secrets are never allowed in the tree.
4. **Spec, code, and architecture must agree.** SpecKit convergence + invariant drift
   check run before build.
5. **Docs travel with the build.** ADR index and changelog are reconciled.
6. **Verify the artifact, not just the source.** A post-build smoke test proves the
   shipped binary actually serves.
7. **Everything is auditable.** Every phase emits structured findings; the final report
   is captured as a CI artifact.

---

## 2. The Pipeline (Phases)

| # | Phase | Responsibility | Blocker conditions |
|---|-------|----------------|--------------------|
| 1 | `precheck` | Verify toolchain + repo readiness | missing toolchain; dirty tree (no `--allow-dirty`) |
| 2 | `gate` | Reuse `devops gate --strict --full` | any gate step fails |
| 3 | `cleanup` | Remove stray dirs/temp artifacts; prune caches; secret scan | secrets found; removal fails |
| 4 | `converge` | SpecKit SDD convergence + invariant drift | invariant **blocks** present |
| 5 | `build` | Target artifact build (`scripts/tauri/build.ps1`) | build script non-zero |
| 6 | `docs` | Regenerate ADR index; ensure CHANGELOG | advisory only |
| 7 | `verify` | Desktop smoke test (health/readyz/nlcl) | `--strict-verify` + smoke fail |
| 8 | `report` | Structured JSON + release notes | summary only |

Run: `bun run devops production-build [<phase>] [--target=tauri] [--dry-run] [--out=report.json] [--allow-dirty] [--strict-verify]`

---

## 3. Cleanup Standard (§2.3 detail)

These rules MUST hold for any production build:

- **No stray top-level provider dirs.** Providers live ONLY under
  `chrome-profiles/<slug>/<account>`. A leaked top-level `gemini/`, `chatgpt/`, or
  `claude/` (browser user-data dump) is deleted.
- **No temp artifacts.** Test-compiled `*.exe`, `*.txt` capture logs, coverage dumps
  are pruned.
- **No secrets in tracked files.** Regex scan for `api_key|secret|token|password`
  assignments in tracked `.ts/.tsx/.js/.json/.env/.ps1/.toml`. HARD BLOCKER.
- **Dead code surfaced.** `biome lint --reporter=summary` output printed for the
  release engineer (non-fatal).
- **Caches pruned.** `coverage/`, `node_modules/.cache` removed so the artifact is lean.

---

## 4. Convergence Standard (§2.4 detail)

- SpecKit SDD convergence (`devops speckit-converge --report`) confirms the spec, plan,
  and tasks match the implemented code.
- Architectural invariant check (`devops invariants check`): **blocks** fail the build
  (e.g. truth score < 80%, engines reading `process.env` directly instead of
  `ConfigManager`); **warnings** are surfaced but do not block.
- Known current blockers (track to zero before first tagged release):
  - A4: Truth score 58% < 80% — run truth verification.
  - B5: `otel-sink.ts` reads `process.env` directly instead of `ConfigManager`.

---

## 5. Documentation Standard (§2.6 detail)

- `docs/decisions/ADR-INDEX.md` is regenerated from all `ADR-*.md` (title + status).
- `CHANGELOG.md` exists with an `Unreleased` section.
- Each shipped feature has a corresponding spec under `specs/` and, where a
  non-obvious decision was made, an `ADR-*.md`.

---

## 6. Verification Standard (§2.7 detail)

- For `target=tauri`, `tests/e2e/tauri-sidecar.test.ts` probes a live sidecar on
  `127.0.0.1:9421` for `/health` (ok), `/readyz` (ready), and `/api/nlcl/help` (object).
- CI: start the built sidecar, then run the smoke test. `--strict-verify` makes a
  failure block the release.
- The sidecar binary name `vivim-server-x86_64-pc-windows-msvc.exe` must match
  Tauri's `externalBin: ["binaries/vivim-server"]`.

---

## 7. Release Notes

The `report` phase emits a release-notes block summarizing every phase. Capture it
with `--out=report.json` and upload as a CI artifact. A human reviews the notes, then
tags the commit (`vX.Y.Z`) and (for desktop) publishes the MSI/NSIS/updater artifacts.

---

## 8. Extending the Standard

- New build targets: add a `case` in `phaseBuild` (`devops/production-build.ts`).
- New cleanup rules: extend `STRAY_DIRS` / `TEMP_ARTIFACT_PATTERNS` / `CACHE_DIRS` or
  the secret regex.
- New verification: add a verifier branch in `phaseVerify`.

This standard is intentionally additive: it wraps existing devops machinery rather
than replacing it, so it stays future-proof as the toolchain evolves.
