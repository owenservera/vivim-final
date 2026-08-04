# Lessons from `devops-session-learn.md` → Toolkit Upgrades

**Source:** `devops-session-learn.md` (units 4.4–4.6 of the autonomous devops loop, 36/114 done).
**Goal:** Turn recurring friction observed in the session into concrete upgrades to the devops orchestrator (`devops/`), `package.json` scripts, and the AGENTS/CLAUDE conventions.

---

## Patterns observed (evidence in the log)

1. **Prisma `any` escape-hatch is a recurring need.** Each storage impl (`version-store-impl.ts`, likely others) needs a contained `private get p(): any` getter, suppressed with `// biome-ignore lint/suspicious/noExplicitAny: intentional Prisma escape hatch`. It works but is reinvented each time and the agent deliberates about it.

2. **`biome check` warnings do NOT fail the gate.** `bun run devops gate` = `tsc --noEmit` + `biome check src/ tests/ seeds/` + `bun test`. The log shows `noUnusedVariables` warnings (e.g. `stream-parser.ts:113`, `provider-health.test.ts:53`) yet `lint` exits 0 → gate green. Warning debt accrues silently.

3. **`bun run format` is unsafe in the loop.** `format` = `biome check --write` and aborts on the FIRST error in ANY file, including pre-existing errors in untouched files (`stream-parser.ts:113` `builtinSystemFallback`). The agent correctly avoided it and used targeted `bunx @biomejs/biome lint <files>` instead. This is fragile and undocumented.

4. **Two-commit audit anti-pattern.** After `git commit`, a second commit renames `[PENDING-COMMIT]` → `<sha>` in `PROGRESS.md`. Avoidable.

5. **Git hygiene noise.** Every commit emits `LF will be replaced by CRLF` and `too many unreachable loose objects; run git prune`. No `.gitattributes`, `core.autocrlf` unset, no periodic prune.

6. **Good: verification discipline.** typecheck → targeted lint on changed files → unit tests → full gate. Worth codifying as the standard order.

7. **Good: DRIFT reconciliation.** Conflicts between atomic spec and design → logged to `PROGRESS.md` + patched atomic file (4.4 §8, `parser_health` table non-existent). Ad hoc; no template.

8. **Good: event-naming discipline.** New transitions got a specific `binding:status_changed` event rather than overloading `capability:status_changed`. Reusable convention.

---

## Toolkit upgrades (ordered, actionable)

### 1. Add a scoped format/lint command (fixes Pattern 3)
- Add `devops fmt` that runs `biome check --write` only on files changed vs the base branch:
  `git diff --name-only main...HEAD` + untracked, filter to `*.ts`, pass to `bome check --write`.
- Keep repo-wide `bun run format` but document: "do not run during the loop; use `bun run devops fmt`."

### 2. Clear the pre-existing lint errors (unblocks Pattern 3)
- Fix `src/engines/stream-parser.ts:113` (`builtinSystemFallback` unused) — remove or reference it.
- Fix `tests/unit/engines/provider-health.test.ts:53` unused `providerId`/`windowMs` (prefix `_`).
- After these, repo-wide `biome check --write` runs clean, so `format` is safe again.

### 3. Harden the gate against warning debt (fixes Pattern 2)
- Extend `devops/gate.ts` with a `strict` flag (or new `bun run devops gate --strict`). In strict mode, run `biome check --json`, parse diagnostics, and **fail** if any *error* OR any *warning* touches a file changed in this unit (diff-scoped). Errors in untouched files stay non-blocking (pre-existing), but new warnings in touched files fail.
- This prevents the loop from shipping warning debt while not blocking on legacy warnings.

### 4. Sanction the Prisma `any` escape-hatch (fixes Pattern 1)
- Add to `AGENTS.md` / `CLAUDE.md` a "Storage Impl Conventions" snippet:
  ```ts
  // Contained escape hatch: generated Prisma client types are verbose and add
  // no safety at the call site. Typed through `any` here only.
  // biome-ignore lint/suspicious/noExplicitAny: intentional Prisma escape hatch
  private get p(): any { return this.db.prisma }
  ```
- State the rule: escape hatch only at the `p` getter, never propagate `any` into engine code.

### 5. Single-pass audit commit (fixes Pattern 4)
- Extend `devops mark <id> done` to accept an optional message and, in one step: mark done, append the audit line with the resolved `<sha>` to `PROGRESS.md`, `git add -A`, `git commit`. No `[PENDING-COMMIT]` placeholder.

### 6. Git hygiene (fixes Pattern 5)
- Add `.gitattributes` with `* text=auto` to stop CRLF churn.
- Add `git prune`/gc housekeeping: a `devops gc` command or a lefthook `post-commit`/`pre-push` step running `git gc --prune=now` periodically (guard so it runs at most daily).

### 7. Document the working conventions (codify Patterns 6–8)
- Add to `AGENTS.md`: verification order (typecheck → targeted lint → unit → gate); DRIFT log template (timestamp, id, name, finding, resolution, sha); event-naming rule (new scope → new event type, don't overload).
- Add a `### DRIFT` template block to `docs/atomic/PROGRESS.md` header.

---

## Risks / non-goals
- Do not make the whole gate fail on legacy warnings repo-wide — that would block the loop on pre-existing debt. Scoping to changed files is essential.
- Leave engine logic and atomic specs untouched; this plan only changes tooling/docs.

## Validation
- After 1–2: `bun run format` runs clean with no abort.
- After 3: `bun run devops gate --strict` fails when a new warning is introduced in a touched file, passes otherwise.
- After 5: `bun run devops mark <id> done "<msg>"` produces exactly one commit containing the PROGRESS.md audit line with a real sha.
- After 6: a fresh commit shows no CRLF warnings; `git prune` runs without "too many unreachable" notice.
